// dms.js: Handles Direct Messages and Group Chats.

import { db, appId, getCurrentUser } from './firebase-init.js';
import { showMessageBox, showCustomConfirm, sanitizeHandle, resolveHandlesToUids, getUserProfileFromFirestore, parseEmojis, parseMentions } from './utils.js';
import { collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Utility: escape HTML for safe rendering
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- DOM Elements ---
const conversationsPanel = document.getElementById('conversations-panel');
const messagesPanel = document.getElementById('messages-panel');
const backToChatsBtn = document.getElementById('back-to-chats-btn');
const createConversationForm = document.getElementById('create-conversation-form');
const newChatTypeSelect = document.getElementById('new-chat-type');
const privateChatFields = document.getElementById('private-chat-fields');
const privateChatRecipientInput = document.getElementById('private-chat-recipient');
const groupChatFields = document.getElementById('group-chat-fields');
const groupChatNameInput = document.getElementById('group-chat-name');
const groupChatParticipantsInput = document.getElementById('group-chat-participants');
const sortConversationsBySelect = document.getElementById('sort-conversations-by');
const conversationsList = document.getElementById('conversations-list');
const noConversationsMessage = document.getElementById('no-conversations-message');
const selectedConversationHeader = document.getElementById('selected-conversation-header');
const conversationTitleHeader = document.getElementById('conversation-title');
const deleteConversationBtn = document.getElementById('delete-conversation-btn');
const conversationMessagesContainer = document.getElementById('conversation-messages-container');
const noMessagesMessage = document.getElementById('no-messages-message');
const messageInputArea = document.getElementById('message-input-area');
const sendMessageForm = document.getElementById('send-message-form');
const messageContentInput = document.getElementById('message-content-input');
const userHandlesDatalist = document.getElementById('user-handles-list');

// --- State Variables ---
let selectedConversationId = null;
let unsubscribeConversationsList = null;
let unsubscribeCurrentMessages = null;
let allConversations = []; // Array to hold fetched conversations for sorting
let currentSortOption = 'lastMessageAt_desc'; // Default sort for conversations list
let currentMessages = [];
let allUserProfiles = []; // Store all user profiles for suggestions
let selectedRecipients = new Map(); // Store selected recipients with their profiles

const DEFAULT_PROFILE_PIC = 'https://placehold.co/40x40/1F2937/E5E7EB?text=AV';

// --- DM FUNCTIONS ---

/**
 * Initialize the DM system
 */
export async function initializeDmSystem() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    console.warn("No current user for DM system initialization");
    return;
  }
  
  console.log("Initializing DM system for user:", currentUser.uid);
  
  try {
    // Always clear recipients and UI on init
    selectedRecipients.clear();
    renderRecipients('private');
    renderRecipients('group');
    renderUserCardList('private');
    renderUserCardList('group');
    
    // Load all user profiles for suggestions
    await loadAllUserProfiles();
    
    // Set up real-time listeners for conversations
    await setupConversationsListener();
    
    // Populate user handles for autocomplete
    await populateUserHandlesDatalist();
    
    // Set up recipient input handlers
    setupRecipientInputHandlers();
    
    console.log("DM system initialized successfully");
  } catch (error) {
    console.error("Error initializing DM system:", error);
  }
}

/**
 * Load all user profiles for suggestions (username primary, handle fallback)
 */
async function loadAllUserProfiles() {
  if (!db) return;
  try {
    const userProfilesRef = collection(db, `artifacts/arcator-web/public/data/user_profiles`);
    const querySnapshot = await getDocs(userProfilesRef);
    allUserProfiles = [];
    const usernameCount = {};
    // First pass: count usernames
    querySnapshot.forEach(docSnap => {
      const profile = docSnap.data();
      if (profile.displayName) {
        const uname = profile.displayName.trim().toLowerCase();
        usernameCount[uname] = (usernameCount[uname] || 0) + 1;
      }
    });
    // Second pass: build profile list with username/handle
    querySnapshot.forEach(docSnap => {
      const profile = docSnap.data();
      if (profile.handle && profile.displayName) {
        const uname = profile.displayName.trim();
        const unameKey = uname.toLowerCase();
        const showHandle = usernameCount[unameKey] > 1;
        allUserProfiles.push({
          uid: docSnap.id,
          handle: profile.handle,
          displayName: uname,
          photoURL: profile.photoURL || DEFAULT_PROFILE_PIC,
          usernameLabel: showHandle ? `${uname} (@${profile.handle})` : uname
        });
      }
    });
    console.log("Loaded", allUserProfiles.length, "user profiles for suggestions (username primary)");
    renderUserCardList('private');
    renderUserCardList('group');
  } catch (error) {
    console.error("Error loading user profiles:", error);
  }
}

/**
 * Render user cards for recipient selection (private or group)
 */
function renderUserCardList(type) {
  const listId = type === 'private' ? 'private-chat-recipient-list' : 'group-chat-recipient-list';
  const list = document.getElementById(listId);
  
  if (!list) {
    console.warn(`User list container not found: ${listId}`);
    return;
  }
  
  list.innerHTML = '';
  allUserProfiles.forEach(profile => {
    const isSelected = selectedRecipients.has(profile.uid);
    const card = document.createElement('div');
    card.className = 'user-card' + (isSelected ? ' selected' : '');
    card.dataset.uid = profile.uid;
    card.innerHTML = `
      <img src="${profile.photoURL}" alt="${profile.displayName}" class="w-8 h-8 rounded-full object-cover mr-2" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
      <span class="user-name">${escapeHtml(profile.usernameLabel)}</span>
    `;
    card.onclick = () => {
      if (type === 'private') {
        selectedRecipients.clear();
        selectedRecipients.set(profile.uid, profile);
      } else {
        if (selectedRecipients.has(profile.uid)) {
          selectedRecipients.delete(profile.uid);
        } else {
          selectedRecipients.set(profile.uid, profile);
        }
      }
      renderUserCardList(type);
      renderRecipients(type);
    };
    list.appendChild(card);
  });
}

/**
 * Call renderUserCardList after loading profiles
 */
async function populatePrivateChatRecipientSelect() {
  renderUserCardList('private');
}

async function populateGroupChatRecipientSelect() {
  renderUserCardList('group');
}

/**
 * Set up recipient input handlers for suggestions
 */
function setupRecipientInputHandlers() {
  const privateInput = document.getElementById('private-chat-recipient');
  const groupInput = document.getElementById('group-chat-participants');
  
  if (privateInput) {
    privateInput.addEventListener('input', (e) => handleRecipientInput(e, 'private'));
    privateInput.addEventListener('keydown', (e) => handleRecipientKeydown(e, 'private'));
  }
  
  if (groupInput) {
    groupInput.addEventListener('input', (e) => handleRecipientInput(e, 'group'));
    groupInput.addEventListener('keydown', (e) => handleRecipientKeydown(e, 'group'));
  }
}

/**
 * Handle recipient input for suggestions
 */
function handleRecipientInput(event, type) {
  const input = event.target;
  const value = input.value.trim();
  const suggestionsContainer = document.getElementById(`${type}-chat-suggestions`);
  if (!suggestionsContainer) return;
  if (!value || value.length < 1) {
    suggestionsContainer.style.display = 'none';
    input.classList.remove('input-valid', 'input-invalid');
    return;
  }
  // Validate input: green if valid, red if not
  const searchTerm = value.replace(/^@/, '').toLowerCase();
  let valid = false;
  for (const profile of allUserProfiles) {
    if (
      profile.usernameLabel.toLowerCase() === searchTerm ||
      profile.displayName.trim().toLowerCase() === searchTerm ||
      profile.handle.toLowerCase() === searchTerm
    ) {
      valid = true;
      break;
    }
  }
  input.classList.toggle('input-valid', valid);
  input.classList.toggle('input-invalid', !valid);
  // Suggestions logic
  const filteredProfiles = allUserProfiles.filter(profile => {
    const uname = profile.displayName.trim().toLowerCase();
    const handle = profile.handle.toLowerCase();
    return (
      uname.includes(searchTerm) ||
      handle.includes(searchTerm) ||
      profile.usernameLabel.toLowerCase().includes(searchTerm)
    );
  }).slice(0, 5);
  if (filteredProfiles.length === 0) {
    suggestionsContainer.style.display = 'none';
    return;
  }
  suggestionsContainer.innerHTML = filteredProfiles.map(profile => `
    <div class="handle-suggestion" data-uid="${profile.uid}">
      <img src="${profile.photoURL}" alt="${profile.displayName}" class="w-8 h-8 rounded-full object-cover mr-2" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
      <div class="suggestion-info">
        <div class="suggestion-name">${escapeHtml(profile.usernameLabel)}</div>
      </div>
    </div>
  `).join('');
  suggestionsContainer.style.display = 'block';
  suggestionsContainer.querySelectorAll('.handle-suggestion').forEach(suggestion => {
    suggestion.addEventListener('click', () => {
      const uid = suggestion.dataset.uid;
      const profile = allUserProfiles.find(p => p.uid === uid);
      if (profile) {
        addRecipient(type, profile);
        input.value = '';
        input.classList.remove('input-valid', 'input-invalid');
        suggestionsContainer.style.display = 'none';
      }
    });
  });
}

/**
 * Handle recipient input keydown events
 */
function handleRecipientKeydown(event, type) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const input = event.target;
    const value = input.value.trim();
    if (value) {
      // Try to find user by usernameLabel (username primary, handle fallback)
      const searchTerm = value.replace(/^@/, '').toLowerCase();
      let profile = allUserProfiles.find(p => p.usernameLabel.toLowerCase() === searchTerm);
      if (!profile) {
        // Try by displayName
        profile = allUserProfiles.find(p => p.displayName.trim().toLowerCase() === searchTerm);
      }
      if (!profile) {
        // Try by handle
        profile = allUserProfiles.find(p => p.handle.toLowerCase() === searchTerm);
      }
      if (profile) {
        addRecipient(type, profile);
        input.value = '';
        document.getElementById(`${type}-chat-suggestions`).style.display = 'none';
      } else {
        showMessageBox(`User not found. Please select from suggestions.`, true);
      }
    }
  }
}

/**
 * Add a recipient to the selected recipients
 */
function addRecipient(type, profile) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  // Don't add self as recipient
  if (profile.uid === currentUser.uid) {
    showMessageBox("You cannot add yourself as a recipient.", true);
    return;
  }
  
  // Check if already added
  if (selectedRecipients.has(profile.uid)) {
    showMessageBox(`@${profile.handle} is already added.`, true);
    return;
  }
  
  selectedRecipients.set(profile.uid, profile);
  renderRecipients(type);
}

/**
 * Remove a recipient from selected recipients
 */
function removeRecipient(type, uid) {
  selectedRecipients.delete(uid);
  renderRecipients(type);
}

/**
 * Make removeRecipient globally accessible
 */
window.removeRecipient = removeRecipient;

/**
 * Render selected recipients as bubbles
 */
function renderRecipients(type) {
  const container = document.getElementById(`${type}-chat-recipients`);
  if (!container) return;
  
  if (selectedRecipients.size === 0) {
    container.innerHTML = '';
    container.classList.add('empty');
    return;
  }
  
  container.classList.remove('empty');
  container.innerHTML = Array.from(selectedRecipients.values()).map(profile => `
    <div class="recipient-bubble" data-uid="${profile.uid}">
      <img src="${profile.photoURL}" alt="${profile.displayName}" class="w-8 h-8 rounded-full object-cover mr-2" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
      <span class="recipient-handle">@${escapeHtml(profile.handle)}</span>
      <button class="remove-recipient" data-type="${type}" data-uid="${profile.uid}" title="Remove recipient">
        ×
      </button>
    </div>
  `).join('');
  
  // Add event listeners to remove buttons
  container.querySelectorAll('.remove-recipient').forEach(button => {
    button.addEventListener('click', (event) => {
      const type = event.target.dataset.type;
      const uid = event.target.dataset.uid;
      removeRecipient(type, uid);
    });
  });
}

/**
 * Creates a new conversation (private or group chat) in Firestore.
 * @param {string} type - 'private' or 'group'.
 * @param {string[]} participantHandles - Handles of all participants (including current user for groups).
 * @param {string} [groupName=''] - Optional name for group chats.
 */
export async function createConversation(type, participantHandles, groupName = '') {
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.uid || !currentUser.handle) {
    showMessageBox("You must be logged in and have a handle to start a chat.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot create chat.", true);
    return;
  }

  // Use selected recipients if available, otherwise fall back to participantHandles
  let participantUids = [];
  
  if (selectedRecipients.size > 0) {
    // Use selected recipients
    participantUids = Array.from(selectedRecipients.keys());
  } else {
    // Fall back to old method with handle resolution
    const uniqueParticipantHandles = new Set(
      participantHandles.map(h => sanitizeHandle(h.startsWith('@') ? h.substring(1) : h))
    );
    uniqueParticipantHandles.add(currentUser.handle);
    
    participantUids = await resolveHandlesToUids(Array.from(uniqueParticipantHandles));
  }

  // Add current user to participants
  if (!participantUids.includes(currentUser.uid)) {
    participantUids.push(currentUser.uid);
  }

  if (participantUids.length === 0) {
    showMessageBox("Please provide at least one valid participant handle.", true);
    return;
  }

  // Specific validation for private chat (can be self-DM or 1-to-1 with another user)
  if (type === 'private') {
    if (participantUids.length > 2) {
      showMessageBox("Private chats can only have yourself and/or one other participant.", true);
      return;
    }
  }
  // Group chat must have at least 2 distinct participants (including self)
  else if (type === 'group' && participantUids.length < 2) {
    showMessageBox("Group chats require at least two participants (including yourself).", true);
    return;
  }

  // Use the correct path structure for conversations
  const conversationsCol = collection(db, `artifacts/arcator-web/users/${currentUser.uid}/dms`);

  // For private chats, check if a conversation already exists between these specific users
  if (type === 'private') {
    const sortedUids = participantUids.sort(); // Sort UIDs for consistent lookup
    const existingChatQuery = query(
      conversationsCol,
      where('type', '==', 'private'),
      where('participants', '==', sortedUids) // Exact match for private chat participants array
    );
    const existingChatsSnapshot = await getDocs(existingChatQuery);
    if (!existingChatsSnapshot.empty) {
      const existingConversation = existingChatsSnapshot.docs[0];
      showMessageBox("A private chat with this user(s) already exists. Opening it now.", false);
      selectConversation(existingConversation.id, existingConversation.data());
      return;
    }
  }

  const conversationData = {
    type: type,
    participants: participantUids.sort(), // Store sorted UIDs for consistency, especially for private chat lookup
    name: type === 'group' ? (groupName.trim() || 'Unnamed Group') : '',
    createdAt: serverTimestamp(),
    createdBy: currentUser.uid,
    lastMessageAt: serverTimestamp(), // Initialize with creation time
    lastMessageContent: type === 'private' ? 'Chat started' : `${currentUser.handle} started the group chat.`,
    lastMessageSenderHandle: currentUser.handle,
    lastMessageSenderId: currentUser.uid,
  };

  try {
    const newConvRef = await addDoc(conversationsCol, conversationData);
    showMessageBox(`New ${type} chat created successfully!`, false);
    console.log(`[DM] Success: Created ${type} chat (id: ${newConvRef.id})`);
    
    // Clear form and selected recipients
    clearCreateConversationForm();
    
    // Automatically select the new conversation
    const newConvSnap = await getDoc(newConvRef);
    if (newConvSnap.exists()) {
      selectConversation(newConvRef.id, newConvSnap.data());
    }

  } catch (error) {
    console.error(`[DM] Failed to create ${type} chat:`, error);
    showMessageBox(`Error creating chat: ${error.message}`, true);
  }
}

/**
 * Clear the create conversation form
 */
function clearCreateConversationForm() {
  const createForm = document.getElementById('create-conversation-form');
  if (createForm) createForm.reset();
  selectedRecipients.clear();
  renderRecipients('private');
  renderRecipients('group');
  renderUserCardList('private');
  renderUserCardList('group');
  document.getElementById('private-chat-suggestions').style.display = 'none';
  document.getElementById('group-chat-suggestions').style.display = 'none';
  const privateFields = document.getElementById('private-chat-fields');
  const groupFields = document.getElementById('group-chat-fields');
  if (privateFields) privateFields.classList.remove('hidden');
  if (groupFields) groupFields.classList.add('hidden');
}

/**
 * Renders the list of conversations for the current user.
 * Subscribes to real-time updates.
 */
export function renderConversationsList() {
  const conversationsListEl = document.getElementById('conversations-list');
  const noConversationsEl = document.getElementById('no-conversations-message');
  
  if (!conversationsListEl) return;
  
  if (!allConversations || allConversations.length === 0) {
    conversationsListEl.innerHTML = '';
    if (noConversationsEl) noConversationsEl.style.display = 'block';
    return;
  }
  
  if (noConversationsEl) noConversationsEl.style.display = 'none';
  
  try {
    // Sort conversations based on current sort option
    const sortBy = document.getElementById('sort-conversations-by')?.value || 'lastMessageAt_desc';
    const [sortField, sortDirection] = sortBy.split('_');
    
    const sortedConversations = [...allConversations].sort((a, b) => {
      const getDisplayNameForSorting = (conv) => {
        if (conv.type === 'group') {
          return conv.name || 'Unnamed Group';
        } else {
          return conv.name || conv.otherUsername || 'Unknown User';
        }
      };
      
      let aVal, bVal;
      
      switch (sortField) {
        case 'lastMessageAt':
          aVal = a.lastMessageAt?.toDate?.() || a.lastMessageAt || a.createdAt?.toDate?.() || a.createdAt || 0;
          bVal = b.lastMessageAt?.toDate?.() || b.lastMessageAt || b.createdAt?.toDate?.() || b.createdAt || 0;
          break;
        case 'createdAt':
          aVal = a.createdAt?.toDate?.() || a.createdAt || 0;
          bVal = b.createdAt?.toDate?.() || b.createdAt || 0;
          break;
        case 'otherUsername':
          aVal = getDisplayNameForSorting(a).toLowerCase();
          bVal = getDisplayNameForSorting(b).toLowerCase();
          break;
        case 'groupName':
          aVal = (a.name || 'Unnamed Group').toLowerCase();
          bVal = (b.name || 'Unnamed Group').toLowerCase();
          break;
        default:
          aVal = a.lastMessageAt?.toDate?.() || a.lastMessageAt || a.createdAt?.toDate?.() || a.createdAt || 0;
          bVal = b.lastMessageAt?.toDate?.() || b.lastMessageAt || b.createdAt?.toDate?.() || b.createdAt || 0;
      }
      
      if (sortDirection === 'desc') {
        return aVal > bVal ? -1 : 1;
      } else {
        return aVal < bVal ? -1 : 1;
      }
    });
    
    conversationsListEl.innerHTML = sortedConversations.map(conv => {
      const isActive = selectedConversationId === conv.id;
      const displayName = conv.type === 'group' ? (conv.name || 'Unnamed Group') : (conv.name || conv.otherUsername || 'Unknown User');
      const lastMessagePreview = conv.lastMessageContent ? 
        (conv.lastMessageContent.length > 30 ? conv.lastMessageContent.substring(0, 30) + '...' : conv.lastMessageContent) : 
        'No messages yet';
      
      const lastMessageTime = conv.lastMessageAt ? 
        new Date(conv.lastMessageAt.toDate?.() || conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
        '';
      
      // Get avatar - use first participant's avatar for group chats, or other user's avatar for private chats
      const avatarUrl = conv.type === 'group' ? 
        (conv.participants?.map(uid => getUserProfileFromFirestore(uid)?.photoURL).find(url => url) || DEFAULT_PROFILE_PIC) : 
        (conv.otherUserAvatar || DEFAULT_PROFILE_PIC);
      
      return `
        <div class="conversation-item ${isActive ? 'active' : ''}" data-conversation-id="${conv.id}">
          <img src="${avatarUrl}" alt="${displayName}" class="w-8 h-8 rounded-full object-cover mr-2" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
          <div class="conversation-info">
            <div class="conversation-name">${escapeHtml(displayName)}</div>
            <div class="conversation-preview">${escapeHtml(lastMessagePreview)}</div>
          </div>
          <div class="conversation-meta">
            <div class="conversation-time">${lastMessageTime}</div>
            ${conv.type === 'group' ? '<div class="text-xs opacity-60">👥</div>' : ''}
          </div>
        </div>
      `;
    }).join('');
    
    // Add click event listeners
    conversationsListEl.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', handleSelectConversationClick);
    });
  } catch (error) {
    console.error("Error rendering conversations list:", error);
    conversationsListEl.innerHTML = '<div class="error">Error loading conversations</div>';
  }
}

/**
 * Selects a conversation, loads its messages, and updates the right panel UI.
 * @param {string} convId - The ID of the conversation to select.
 * @param {object} conversationData - The conversation object data.
 */
export async function selectConversation(convId, conversationData) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !convId) {
    console.error("No current user or conversation ID for selection.");
    return;
  }

  selectedConversationId = convId;
  
  // Update conversation header
  const conversationTitleEl = document.getElementById('conversation-title');
  const conversationSubtitleEl = document.getElementById('conversation-subtitle');
  const conversationAvatarEl = document.getElementById('conversation-avatar');
  const deleteConversationBtn = document.getElementById('delete-conversation-btn');
  
  if (conversationData) {
    let displayName = 'Unknown Conversation';
    let subtitle = 'Loading...';
    let avatarUrl = DEFAULT_PROFILE_PIC;
    
    if (conversationData.type === 'group') {
      displayName = conversationData.name || 'Unnamed Group';
      subtitle = `${conversationData.participants?.length || 0} members`;
      avatarUrl = 'https://placehold.co/40x40/1F2937/E5E7EB?text=GC'; // Group chat icon
    } else {
      // Private chat - find the other participant
      const otherUid = conversationData.participants?.find(uid => uid !== currentUser.uid);
      if (otherUid) {
        try {
          const otherProfile = await getUserProfileFromFirestore(otherUid);
          if (otherProfile) {
            displayName = otherProfile.displayName || otherProfile.handle || 'Unknown User';
            subtitle = otherProfile.handle ? `@${otherProfile.handle}` : 'User';
            avatarUrl = otherProfile.photoURL || DEFAULT_PROFILE_PIC;
          } else {
            displayName = 'Unknown User';
            subtitle = 'User not found';
            avatarUrl = DEFAULT_PROFILE_PIC;
          }
        } catch (error) {
          console.warn("Could not fetch other user's profile:", error);
          displayName = 'Unknown User';
          subtitle = 'Error loading profile';
          avatarUrl = DEFAULT_PROFILE_PIC;
        }
      } else {
        displayName = 'Self Chat';
        subtitle = 'Your personal chat';
        avatarUrl = currentUser.photoURL || DEFAULT_PROFILE_PIC;
      }
    }
    
    if (conversationTitleEl) conversationTitleEl.textContent = displayName;
    if (conversationSubtitleEl) conversationSubtitleEl.textContent = subtitle;
    if (conversationAvatarEl) {
      conversationAvatarEl.src = avatarUrl;
      conversationAvatarEl.alt = displayName;
      conversationAvatarEl.onerror = () => { conversationAvatarEl.src = DEFAULT_PROFILE_PIC; };
    }
    
    // Show delete button for conversations the user can delete
    if (deleteConversationBtn) {
      deleteConversationBtn.style.display = 'block';
      deleteConversationBtn.dataset.conversationId = convId;
    }
  }
  
  // Update UI to show messages panel
  const conversationsPanel = document.getElementById('conversations-panel');
  const messagesPanel = document.getElementById('messages-panel');
  const messageInputArea = document.getElementById('message-input-area');
  
  if (conversationsPanel) conversationsPanel.classList.add('hidden');
  if (messagesPanel) messagesPanel.classList.remove('hidden');
  if (messageInputArea) messageInputArea.classList.remove('hidden');
  
  // Load and render messages
  await loadMessagesForConversation(convId);
}

/**
 * Update UI when no conversation is selected
 */
export function updateDmUiForNoConversationSelected() {
  selectedConversationId = null;
  
  // Update UI to show conversations panel
  const conversationsPanel = document.getElementById('conversations-panel');
  const messagesPanel = document.getElementById('messages-panel');
  const messageInputArea = document.getElementById('message-input-area');
  
  if (conversationsPanel) conversationsPanel.classList.remove('hidden');
  if (messagesPanel) messagesPanel.classList.add('hidden');
  if (messageInputArea) messageInputArea.classList.add('hidden');
  
  // Clear active conversation styling
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Clear messages
  currentMessages = [];
  const messagesContainer = document.getElementById('conversation-messages-container');
  if (messagesContainer) {
    messagesContainer.innerHTML = '';
  }
  
  // Hide delete button
  const deleteConversationBtn = document.getElementById('delete-conversation-btn');
  if (deleteConversationBtn) {
    deleteConversationBtn.style.display = 'none';
  }
}

/**
 * Renders messages for a specific conversation in real-time.
 * @param {string} convId - The ID of the conversation whose messages to render.
 */
async function renderConversationMessages(convId) {
  const messagesContainer = document.getElementById('conversation-messages-container');
  const noMessagesEl = document.getElementById('no-messages-message');
  
  if (!messagesContainer) return;
  
  if (!currentMessages || currentMessages.length === 0) {
    messagesContainer.innerHTML = '';
    noMessagesEl.style.display = 'block';
    return;
  }
  
  noMessagesEl.style.display = 'none';
  
  const currentUser = await getCurrentUser();
  if (!currentUser) return;
  
  messagesContainer.innerHTML = currentMessages.map(message => {
    const isOwnMessage = message.senderId === currentUser.uid;
    const messageTime = message.timestamp ? 
      new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
      '';
    
    // Get sender info
    const senderProfile = message.senderProfile || {};
    const senderName = senderProfile.displayName || senderProfile.handle || 'Unknown User';
    const senderAvatar = senderProfile.photoURL || DEFAULT_PROFILE_PIC;
    
    return `
      <div class="message-bubble ${isOwnMessage ? 'sent' : 'received'}">
        ${!isOwnMessage ? `
          <div class="message-author">
            <img src="${senderAvatar}" alt="${senderName}" class="w-8 h-8 rounded-full object-cover mr-2" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
            <span>${escapeHtml(senderName)}</span>
          </div>
        ` : ''}
        <div class="message-content">
          ${escapeHtml(message.content)}
        </div>
        <div class="message-timestamp">
          ${messageTime}
          ${isOwnMessage ? `
            <button class="delete-message-btn ml-2" data-message-id="${message.id}" title="Delete message">
              🗑️
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Add delete message event listeners
  messagesContainer.querySelectorAll('.delete-message-btn').forEach(btn => {
    btn.addEventListener('click', handleDeleteMessage);
  });
}

/**
 * Sends a message within the currently selected conversation.
 * Also updates the parent conversation's last message info.
 * @param {string} content - The message content.
 */
export async function sendMessage(content) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.uid || !currentUser.handle) {
    showMessageBox("You must be logged in and have a handle to send messages.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot send message.", true);
    return;
  }
  if (content.trim() === '') {
    showMessageBox("Message cannot be empty.", true);
    return;
  }

  // Use the correct path structure for messages
  const messagesCol = collection(db, `artifacts/arcator-web/users/${currentUser.uid}/dms/${selectedConversationId}/messages`);
  const conversationDocRef = doc(db, `artifacts/arcator-web/users/${currentUser.uid}/dms`, selectedConversationId);

  const messageData = {
    createdBy: currentUser.uid, // Use createdBy instead of senderId
    creatorDisplayName: currentUser.displayName,
    content: content,
    createdAt: serverTimestamp(),
  };

  try {
    await addDoc(messagesCol, messageData);
    // Update the parent conversation with last message info
    await updateDoc(conversationDocRef, {
      lastMessageAt: serverTimestamp(),
      lastMessageContent: content,
      lastMessageSenderHandle: currentUser.handle,
      lastMessageSenderId: currentUser.uid,
    });
    messageContentInput.value = '';
    showMessageBox("Message sent!", false);
  } catch (error) {
    console.error("Error sending message:", error);
    showMessageBox(`Error sending message: ${error.message}`, true);
  }
}

/**
 * Deletes a specific message from the current conversation.
 * @param {string} messageId - The ID of the message to delete.
 */
export async function deleteMessage(messageId) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.uid || !selectedConversationId) {
    showMessageBox("Cannot delete message. User not logged in or no conversation selected.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete message.", true);
    return;
  }

  const confirmation = await showCustomConfirm("Are you sure you want to delete this message?", "This message will be removed for everyone in this chat. This action cannot be undone.");
  if (!confirmation) {
    showMessageBox("Message deletion cancelled.", false);
    return;
  }

  // Use the correct path structure for messages
  const messageDocRef = doc(db, `artifacts/arcator-web/users/${currentUser.uid}/dms/${selectedConversationId}/messages`, messageId);
  try {
    await deleteDoc(messageDocRef);
    showMessageBox("Message deleted!", false);

    // Re-evaluate last message in conversation if the deleted one was the last
    const messagesCol = collection(db, `artifacts/arcator-web/users/${currentUser.uid}/dms/${selectedConversationId}/messages`);
    const q = query(messagesCol, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q); // Use getDocs instead of onSnapshot for a one-time fetch here
    const conversationDocRef = doc(db, `artifacts/arcator-web/users/${currentUser.uid}/dms`, selectedConversationId);

    if (!snapshot.empty) {
      const lastMsg = snapshot.docs[0].data();
      await updateDoc(conversationDocRef, {
        lastMessageAt: lastMsg.createdAt,
        lastMessageContent: lastMsg.content,
        lastMessageSenderHandle: currentUser.handle,
        lastMessageSenderId: currentUser.uid,
      });
    } else {
      await updateDoc(conversationDocRef, {
        lastMessageAt: null,
        lastMessageContent: 'No messages yet.',
        lastMessageSenderHandle: '',
        lastMessageSenderId: '',
      });
    }

  } catch (error) {
    console.error("Error deleting message:", error);
    showMessageBox(`Error deleting message: ${error.message}`, true);
  }
}

/**
 * Set up real-time listener for conversations
 */
async function setupConversationsListener() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !db) return;
  
  if (unsubscribeConversationsList) {
    unsubscribeConversationsList();
  }
  
  const conversationsCol = collection(db, `artifacts/arcator-web/users/${currentUser.uid}/dms`);
  const q = query(conversationsCol, orderBy("lastMessageAt", "desc"));
  
  unsubscribeConversationsList = onSnapshot(q, async (snapshot) => {
    try {
      allConversations = [];
      
      if (snapshot.empty) {
        renderConversationsList();
        return;
      }
      
      const profilesToFetch = new Set();
      snapshot.forEach(doc => {
        const conv = doc.data();
        if (conv.participants) {
          conv.participants.forEach(uid => profilesToFetch.add(uid));
        }
        allConversations.push({ id: doc.id, ...conv });
      });
      
      // Fetch user profiles for display names and avatars
      const fetchedProfiles = new Map();
      for (const uid of profilesToFetch) {
        try {
          const profile = await getUserProfileFromFirestore(uid);
          if (profile) {
            fetchedProfiles.set(uid, profile);
          }
        } catch (error) {
          console.warn("Could not fetch profile for user:", uid, error);
        }
      }
      
      // Enhance conversations with profile data
      allConversations.forEach(conv => {
        if (conv.type === 'private') {
          const otherUid = conv.participants?.find(uid => uid !== currentUser.uid);
          if (otherUid) {
            const otherProfile = fetchedProfiles.get(otherUid);
            if (otherProfile) {
              conv.otherUsername = otherProfile.displayName || otherProfile.handle || 'Unknown User';
              conv.otherUserAvatar = otherProfile.photoURL || DEFAULT_PROFILE_PIC;
              conv.name = otherProfile.displayName || otherProfile.handle || 'Unknown User';
            } else {
              conv.otherUsername = 'Unknown User';
              conv.otherUserAvatar = DEFAULT_PROFILE_PIC;
              conv.name = 'Unknown User';
            }
          } else {
            conv.otherUsername = 'Self Chat';
            conv.otherUserAvatar = currentUser.photoURL || DEFAULT_PROFILE_PIC;
            conv.name = 'Self Chat';
          }
        }
      });
      
      console.log("Enhanced conversations with profile data:", allConversations);
      renderConversationsList();
    } catch (error) {
      console.error("Error processing conversations:", error);
    }
  }, (error) => {
    console.error("Error fetching conversations:", error);
    showMessageBox(`Error loading conversations: ${error.message}`, true);
  });
}

/**
 * Load messages for a specific conversation
 */
async function loadMessagesForConversation(convId) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !convId || !db) return;
  
  if (unsubscribeCurrentMessages) {
    unsubscribeCurrentMessages();
  }
  
  const messagesCol = collection(db, `artifacts/arcator-web/users/${currentUser.uid}/dms/${convId}/messages`);
  const q = query(messagesCol, orderBy("createdAt", "asc"));
  
  unsubscribeCurrentMessages = onSnapshot(q, async (snapshot) => {
    currentMessages = [];
    
    if (snapshot.empty) {
      await renderConversationMessages(convId);
      return;
    }
    
    const profilesToFetch = new Set();
    snapshot.forEach(doc => {
      const msg = doc.data();
      profilesToFetch.add(msg.createdBy);
      currentMessages.push({ id: doc.id, ...msg });
    });
    
    // Fetch sender profiles
    const fetchedProfiles = new Map();
    for (const uid of profilesToFetch) {
      try {
        const profile = await getUserProfileFromFirestore(uid);
        if (profile) {
          fetchedProfiles.set(uid, profile);
        }
      } catch (error) {
        console.warn("Could not fetch profile for message sender:", uid, error);
      }
    }
    
    // Enhance messages with sender profile data
    currentMessages.forEach(msg => {
      const senderProfile = fetchedProfiles.get(msg.createdBy);
      msg.senderProfile = senderProfile || {};
      msg.senderId = msg.createdBy;
      msg.timestamp = msg.createdAt?.toDate?.() || msg.createdAt || new Date();
    });
    
    await renderConversationMessages(convId);
  }, (error) => {
    console.error("Error fetching messages:", error);
    showMessageBox(`Error loading messages: ${error.message}`, true);
  });
}

/**
 * Load conversations (alias for setupConversationsListener)
 */
export async function loadConversations() {
  await setupConversationsListener();
}

/**
 * Populate user handles datalist for autocomplete
 */
export async function populateUserHandlesDatalist() {
  if (!db) return;
  const userHandlesDatalist = document.getElementById('user-handles-list');
  if (!userHandlesDatalist) return;
  userHandlesDatalist.innerHTML = '';
  const userProfilesRef = collection(db, `artifacts/arcator-web/public/data/user_profiles`);
  try {
    const querySnapshot = await getDocs(userProfilesRef);
    const usernameCount = {};
    querySnapshot.forEach(docSnap => {
      const profile = docSnap.data();
      if (profile.displayName) {
        const uname = profile.displayName.trim().toLowerCase();
        usernameCount[uname] = (usernameCount[uname] || 0) + 1;
      }
    });
    querySnapshot.forEach(docSnap => {
      const profile = docSnap.data();
      if (profile.handle && profile.displayName) {
        const uname = profile.displayName.trim();
        const unameKey = uname.toLowerCase();
        const showHandle = usernameCount[unameKey] > 1;
        const option = document.createElement('option');
        option.value = showHandle ? `${uname} (@${profile.handle})` : uname;
        userHandlesDatalist.appendChild(option);
      }
    });
    console.log("User handles datalist populated (username primary, handle fallback)");
  } catch (error) {
    console.error("Error fetching user handles for datalist:", error);
  }
}

/**
 * Unsubscribe from listeners
 */
export function unsubscribeConversationsListListener() {
  if (unsubscribeConversationsList) {
    unsubscribeConversationsList();
    unsubscribeConversationsList = null;
  }
}

export function unsubscribeCurrentMessagesListener() {
  if (unsubscribeCurrentMessages) {
    unsubscribeCurrentMessages();
    unsubscribeCurrentMessages = null;
  }
}

/**
 * Event handlers
 */
export async function handleCreateConversation(event) {
  event.preventDefault();
  
  const typeSelect = document.getElementById('new-chat-type');
  const groupNameInput = document.getElementById('group-chat-name');
  
  const type = typeSelect?.value || 'private';
  let groupName = '';
  
  if (type === 'group') {
    groupName = groupNameInput?.value?.trim() || '';
  }
  
  // Check if we have selected recipients
  if (selectedRecipients.size === 0) {
    showMessageBox("Please select at least one recipient for the chat.", true);
    return;
  }
  
  await createConversation(type, [], groupName);
}

export async function handleSendMessage(event) {
  event.preventDefault();
  
  const messageInput = document.getElementById('message-content-input');
  const content = messageInput?.value?.trim();
  
  if (content && selectedConversationId) {
    await sendMessage(content);
    if (messageInput) messageInput.value = '';
  }
}

export async function handleDeleteMessage(event) {
  event.preventDefault();
  
  const messageId = event.target.dataset.messageId;
  if (selectedConversationId && messageId) {
    await deleteMessage(messageId);
  }
}

export async function handleDeleteConversationClick(event) {
  event.preventDefault();
  
  const convId = event.target.dataset.conversationId;
  if (convId) {
    await deleteConversation(convId);
  }
}

function handleSelectConversationClick(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const convId = event.currentTarget.dataset.conversationId;
  if (!convId) {
    console.error("No conversation ID found in click event");
    return;
  }
  
  const conversation = allConversations.find(c => c.id === convId);
  if (conversation) {
    console.log("Selecting conversation:", convId, conversation);
    selectConversation(convId, conversation);
  } else {
    console.error("Conversation not found in allConversations:", convId);
  }
}

/**
 * Attach all DM event listeners
 */
export function attachDmEventListeners() {
  // Create conversation form
  const createForm = document.getElementById('create-conversation-form');
  if (createForm) {
    createForm.addEventListener('submit', handleCreateConversation);
  }
  
  // Send message form
  const sendForm = document.getElementById('send-message-form');
  if (sendForm) {
    sendForm.addEventListener('submit', handleSendMessage);
  }
  
  // Delete conversation button
  const deleteBtn = document.getElementById('delete-conversation-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', handleDeleteConversationClick);
  }
  
  // Chat type switching
  const chatTypeSelect = document.getElementById('new-chat-type');
  if (chatTypeSelect) {
    chatTypeSelect.addEventListener('change', () => {
      const privateFields = document.getElementById('private-chat-fields');
      const groupFields = document.getElementById('group-chat-fields');
      selectedRecipients.clear();
      renderRecipients('private');
      renderRecipients('group');
      renderUserCardList('private');
      renderUserCardList('group');
      if (chatTypeSelect.value === 'private') {
        privateFields.classList.remove('hidden');
        groupFields.classList.add('hidden');
      } else {
        privateFields.classList.add('hidden');
        groupFields.classList.remove('hidden');
      }
    });
  }
  
  // Back button for conversations
  const backBtn = document.getElementById('back-to-chats-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      updateDmUiForNoConversationSelected();
    });
  }
  
  // Conversation items (handled in renderConversationsList)
}

/**
 * Deletes an entire conversation and all its messages.
 * @param {string} convId - The ID of the conversation to delete.
 */
export async function deleteConversation(convId) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.uid) {
    showMessageBox("You must be logged in to delete a conversation.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete conversation.", true);
    return;
  }

  const confirmation = await showCustomConfirm(
    "Are you sure you want to delete this entire chat?",
    "This will delete the conversation and all its messages for everyone. This action cannot be undone."
  );
  if (!confirmation) {
    showMessageBox("Conversation deletion cancelled.", false);
    return;
  }

  // Use the correct path structure
  const conversationDocRef = doc(db, `artifacts/arcator-web/users/${currentUser.uid}/dms`, convId);
  const messagesColRef = collection(conversationDocRef, 'messages');

  try {
    const messagesSnapshot = await getDocs(messagesColRef);
    const batch = writeBatch(db);
    messagesSnapshot.docs.forEach((msgDoc) => {
      batch.delete(msgDoc.ref);
    });
    await batch.commit();

    await deleteDoc(conversationDocRef);

    showMessageBox("Conversation deleted successfully!", false);
    updateDmUiForNoConversationSelected();
  } catch (error) {
    console.error("Error deleting conversation:", error);
    showMessageBox(`Error deleting conversation: ${error.message}`, true);
  }
}