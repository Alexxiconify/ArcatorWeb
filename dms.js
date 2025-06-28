// dms.js: Handles Direct Messages and Group Chats.

import { db, appId, getCurrentUser } from './firebase-init.js';
import { showMessageBox, showCustomConfirm, sanitizeHandle, resolveHandlesToUids, getUserProfileFromFirestore, parseEmojis, parseMentions } from './utils.js';
import { collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

const DEFAULT_PROFILE_PIC = 'https://placehold.co/40x40/1F2937/E5E7EB?text=AV';

// --- DM FUNCTIONS ---

/**
 * Creates a new conversation (private or group chat) in Firestore.
 * @param {string} type - 'private' or 'group'.
 * @param {string[]} participantHandles - Handles of all participants (including current user for groups).
 * @param {string} [groupName=''] - Optional name for group chats.
 */
export async function createConversation(type, participantHandles, groupName = '') {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.uid || !currentUser.handle) {
    showMessageBox("You must be logged in and have a handle to start a chat.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot create chat.", true);
    return;
  }

  // Sanitize and ensure current user is always included in participants for *all* chats
  const uniqueParticipantHandles = new Set(
    participantHandles.map(h => sanitizeHandle(h.startsWith('@') ? h.substring(1) : h))
  );
  uniqueParticipantHandles.add(currentUser.handle); // Add current user's handle

  const participantUids = await resolveHandlesToUids(Array.from(uniqueParticipantHandles));

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
  const conversationsCol = collection(db, `artifacts/${appId}/users/${currentUser.uid}/dms`);

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
    createConversationForm.reset();
    privateChatFields.classList.remove('hidden'); // Reset UI
    groupChatFields.classList.add('hidden');
    privateChatRecipientInput.value = '';
    groupChatNameInput.value = '';
    groupChatParticipantsInput.value = '';

    // Automatically select the new conversation
    const newConvSnap = await getDoc(newConvRef);
    if (newConvSnap.exists()) {
      selectConversation(newConvRef.id, newConvSnap.data());
    }

  } catch (error) {
    console.error("Error creating conversation:", error);
    showMessageBox(`Error creating chat: ${error.message}`, true);
  }
}

/**
 * Renders the list of conversations for the current user.
 * Subscribes to real-time updates.
 */
export function renderConversationsList() {
  const conversationsListEl = document.getElementById('conversations-list');
  const noConversationsEl = document.getElementById('no-conversations-message');
  
  if (!conversationsListEl) return;
  
  if (allConversations.length === 0) {
    conversationsListEl.innerHTML = '';
    noConversationsEl.style.display = 'block';
    return;
  }
  
  noConversationsEl.style.display = 'none';
  
  // Sort conversations based on current sort option
  const sortBy = document.getElementById('sort-conversations-by')?.value || 'lastMessageAt_desc';
  const [sortField, sortDirection] = sortBy.split('_');
  
  const sortedConversations = [...allConversations].sort((a, b) => {
    const getDisplayNameForSorting = (conv) => {
      if (conv.type === 'group') {
        return conv.name || 'Unnamed Group';
      } else {
        return conv.name || 'Unknown User';
      }
    };
    
    let aVal, bVal;
    
    switch (sortField) {
      case 'lastMessageAt':
        aVal = conv.lastMessageAt || conv.createdAt || 0;
        bVal = conv.lastMessageAt || conv.createdAt || 0;
        break;
      case 'createdAt':
        aVal = conv.createdAt || 0;
        bVal = conv.createdAt || 0;
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
        aVal = conv.lastMessageAt || conv.createdAt || 0;
        bVal = conv.lastMessageAt || conv.createdAt || 0;
    }
    
    if (sortDirection === 'desc') {
      return aVal > bVal ? -1 : 1;
    } else {
      return aVal < bVal ? -1 : 1;
    }
  });
  
  conversationsListEl.innerHTML = sortedConversations.map(conv => {
    const isActive = selectedConversationId === conv.id;
    const displayName = conv.type === 'group' ? (conv.name || 'Unnamed Group') : (conv.name || 'Unknown User');
    const lastMessagePreview = conv.lastMessageContent ? 
      (conv.lastMessageContent.length > 30 ? conv.lastMessageContent.substring(0, 30) + '...' : conv.lastMessageContent) : 
      'No messages yet';
    
    const lastMessageTime = conv.lastMessageAt ? 
      new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
      '';
    
    // Get avatar - use first participant's avatar for group chats, or other user's avatar for private chats
    const avatarUrl = conv.type === 'group' ? 
      (conv.participants.map(uid => getUserProfileFromFirestore(uid)?.photoURL).find(url => url) || DEFAULT_PROFILE_PIC) : 
      (conv.otherUserAvatar || DEFAULT_PROFILE_PIC);
    
    return `
      <div class="conversation-item ${isActive ? 'active' : ''}" data-conversation-id="${conv.id}">
        <img src="${avatarUrl}" alt="${displayName}" class="conversation-avatar" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
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
}

/**
 * Selects a conversation, loads its messages, and updates the right panel UI.
 * @param {string} convId - The ID of the conversation to select.
 * @param {object} conversationData - The conversation object data.
 */
export async function selectConversation(convId, conversationData) {
  const currentUser = getCurrentUser();
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
      displayName = conversationData.groupName || 'Unnamed Group';
      subtitle = `${conversationData.participants?.length || 0} members`;
      avatarUrl = 'https://placehold.co/40x40/1F2937/E5E7EB?text=GC'; // Group chat icon
    } else {
      // Private chat - find the other participant
      const otherUid = conversationData.participants?.find(uid => uid !== currentUser.uid);
      if (otherUid) {
        try {
          const otherProfile = await getUserProfileFromFirestore(otherUid);
          displayName = otherProfile?.displayName || otherProfile?.handle || 'Unknown User';
          subtitle = otherProfile?.handle ? `@${otherProfile.handle}` : 'User';
          avatarUrl = otherProfile?.photoURL || DEFAULT_PROFILE_PIC;
        } catch (error) {
          console.warn("Could not fetch other user's profile:", error);
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
 * Updates the UI when no conversation is selected.
 */
export function updateDmUiForNoConversationSelected() {
  selectedConversationId = null;
  conversationsPanel.classList.remove('hidden');
  messagesPanel.classList.add('hidden');
  messageInputArea.classList.add('hidden');
  noMessagesMessage.style.display = 'block';
  conversationMessagesContainer.innerHTML = '';
  conversationTitleHeader.textContent = 'Select a conversation';
  deleteConversationBtn.classList.add('hidden');
}

/**
 * Renders messages for a specific conversation in real-time.
 * @param {string} convId - The ID of the conversation whose messages to render.
 */
function renderConversationMessages(convId) {
  const messagesContainer = document.getElementById('conversation-messages-container');
  const noMessagesEl = document.getElementById('no-messages-message');
  
  if (!messagesContainer) return;
  
  if (!currentMessages || currentMessages.length === 0) {
    messagesContainer.innerHTML = '';
    noMessagesEl.style.display = 'block';
    return;
  }
  
  noMessagesEl.style.display = 'none';
  
  const currentUser = getCurrentUser();
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
            <img src="${senderAvatar}" alt="${senderName}" class="w-4 h-4 rounded-full" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
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
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.uid || !currentUser.handle || !selectedConversationId) {
    showMessageBox("Cannot send message. User not logged in or no conversation selected.", true);
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
  const messagesCol = collection(db, `artifacts/${appId}/users/${currentUser.uid}/dms/${selectedConversationId}/messages`);
  const conversationDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/dms`, selectedConversationId);

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
  const currentUser = getCurrentUser();
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
  const messageDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/dms/${selectedConversationId}/messages`, messageId);
  try {
    await deleteDoc(messageDocRef);
    showMessageBox("Message deleted!", false);

    // Re-evaluate last message in conversation if the deleted one was the last
    const messagesCol = collection(db, `artifacts/${appId}/users/${currentUser.uid}/dms/${selectedConversationId}/messages`);
    const q = query(messagesCol, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q); // Use getDocs instead of onSnapshot for a one-time fetch here
    const conversationDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/dms`, selectedConversationId);

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
 * Initialize the DM system
 */
export async function initializeDmSystem() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.warn("No current user for DM system initialization");
    return;
  }
  
  console.log("Initializing DM system for user:", currentUser.uid);
  
  // Set up real-time listeners for conversations
  await setupConversationsListener();
  
  // Populate user handles for autocomplete
  await populateUserHandlesDatalist();
}

/**
 * Set up real-time listener for conversations
 */
async function setupConversationsListener() {
  const currentUser = getCurrentUser();
  if (!currentUser || !db) return;
  
  if (unsubscribeConversationsList) {
    unsubscribeConversationsList();
  }
  
  const conversationsCol = collection(db, `artifacts/${appId}/users/${currentUser.uid}/dms`);
  const q = query(conversationsCol, where('participants', 'array-contains', currentUser.uid));
  
  unsubscribeConversationsList = onSnapshot(q, async (snapshot) => {
    allConversations = [];
    
    if (snapshot.empty) {
      renderConversationsList();
      return;
    }
    
    const profilesToFetch = new Set();
    snapshot.forEach(doc => {
      const conv = doc.data();
      conv.participants.forEach(uid => profilesToFetch.add(uid));
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
        const otherUid = conv.participants.find(uid => uid !== currentUser.uid);
        if (otherUid) {
          const otherProfile = fetchedProfiles.get(otherUid);
          conv.otherUsername = otherProfile?.displayName || otherProfile?.handle || 'Unknown User';
          conv.otherUserAvatar = otherProfile?.photoURL || DEFAULT_PROFILE_PIC;
        }
      }
    });
    
    renderConversationsList();
  }, (error) => {
    console.error("Error fetching conversations:", error);
    showMessageBox(`Error loading conversations: ${error.message}`, true);
  });
}

/**
 * Load messages for a specific conversation
 */
async function loadMessagesForConversation(convId) {
  const currentUser = getCurrentUser();
  if (!currentUser || !convId || !db) return;
  
  if (unsubscribeCurrentMessages) {
    unsubscribeCurrentMessages();
  }
  
  const messagesCol = collection(db, `artifacts/${appId}/users/${currentUser.uid}/dms/${convId}/messages`);
  const q = query(messagesCol, orderBy("createdAt", "asc"));
  
  unsubscribeCurrentMessages = onSnapshot(q, async (snapshot) => {
    currentMessages = [];
    
    if (snapshot.empty) {
      renderConversationMessages(convId);
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
    
    renderConversationMessages(convId);
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
  
  const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
  try {
    const querySnapshot = await getDocs(userProfilesRef);
    querySnapshot.forEach(docSnap => {
      const profile = docSnap.data();
      if (profile.handle) {
        const option = document.createElement('option');
        option.value = `@${profile.handle}`;
        userHandlesDatalist.appendChild(option);
      }
    });
    console.log("User handles datalist populated.");
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
  const recipientInput = document.getElementById('private-chat-recipient');
  const groupNameInput = document.getElementById('group-chat-name');
  const participantsInput = document.getElementById('group-chat-participants');
  
  const type = typeSelect?.value || 'private';
  let participantHandles = [];
  let groupName = '';
  
  if (type === 'private') {
    const recipient = recipientInput?.value?.trim();
    if (recipient) {
      participantHandles = [recipient];
    }
  } else if (type === 'group') {
    groupName = groupNameInput?.value?.trim() || '';
    const participants = participantsInput?.value?.trim();
    if (participants) {
      participantHandles = participants.split(',').map(p => p.trim()).filter(p => p);
    }
  }
  
  if (participantHandles.length === 0 && type === 'group') {
    showMessageBox("Please enter at least one participant for group chat.", true);
    return;
  }
  
  await createConversation(type, participantHandles, groupName);
  
  // Clear form
  if (recipientInput) recipientInput.value = '';
  if (groupNameInput) groupNameInput.value = '';
  if (participantsInput) participantsInput.value = '';
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
  const convId = event.currentTarget.dataset.conversationId;
  const conversation = allConversations.find(c => c.id === convId);
  if (conversation) {
    selectConversation(convId, conversation);
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
  
  // Conversation items (handled in renderConversationsList)
  // Back button (handled in forms.js)
}