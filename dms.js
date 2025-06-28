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
  const currentUser = getCurrentUser();
  if (!db || !conversationsList || !currentUser) {
    console.warn("DB, conversationsList, or currentUser not ready for conversations rendering.");
    if (conversationsList) conversationsList.innerHTML = '<p class="text-gray-400 text-center">Please log in to view conversations.</p>';
    if (noConversationsMessage) noConversationsMessage.style.display = 'none';
    return;
  }

  if (unsubscribeConversationsList) {
    unsubscribeConversationsList();
    unsubscribeConversationsList = null;
  }

  // Explicitly set initial panel visibility when DM tab is opened
  conversationsPanel.classList.remove('hidden');
  messagesPanel.classList.add('hidden');

  // Use the correct path structure for conversations
  const conversationsCol = collection(db, `artifacts/${appId}/users/${currentUser.uid}/dms`);
  // Query for conversations where the current user is a participant.
  // This query requires a composite index: 'participants' (array) + 'lastMessageAt' (desc)
  const q = query(
    conversationsCol,
    where('participants', 'array-contains', currentUser.uid)
    // orderBy is not used here to avoid additional composite indexes
    // Sorting will be done client-side after fetching all conversations for the user
  );

  unsubscribeConversationsList = onSnapshot(q, async (snapshot) => {
    allConversations = []; // Reset for each snapshot
    if (snapshot.empty) {
      noConversationsMessage.style.display = 'block';
      conversationsList.innerHTML = '';
      updateDmUiForNoConversationSelected(); // Clear right panel if no conversations
      return;
    } else {
      noConversationsMessage.style.display = 'none';
    }

    const profilesToFetch = new Set();
    snapshot.forEach(doc => {
      const conv = doc.data();
      conv.participants.forEach(uid => profilesToFetch.add(uid));
      allConversations.push({ id: doc.id, ...conv });
    });

    const fetchedProfiles = new Map();
    for (const uid of profilesToFetch) {
      const profile = await getUserProfileFromFirestore(uid);
      if (profile) {
        fetchedProfiles.set(uid, profile);
      }
    }

    // Apply sorting based on currentSortOption
    allConversations.sort((a, b) => {
      const getDisplayNameForSorting = (conv) => {
        if (conv.type === 'group') return conv.name || 'Unnamed Group';
        // For private chat, find the other participant's handle
        const otherUid = conv.participants.find(uid => uid !== currentUser.uid);
        // If otherUid is undefined (e.g., self-DM), use current user's handle
        if (!otherUid) return "Self Chat";
        const otherProfile = fetchedProfiles.get(otherUid);
        return otherProfile?.handle || otherProfile?.displayName || 'Unknown User';
      };

      switch (currentSortOption) {
        case 'lastMessageAt_desc':
          return (b.lastMessageAt?.toMillis() || 0) - (a.lastMessageAt?.toMillis() || 0);
        case 'createdAt_desc':
          return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        case 'createdAt_asc':
          return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
        case 'otherUsername_asc':
          const nameA_asc = getDisplayNameForSorting(a);
          const nameB_asc = getDisplayNameForSorting(b);
          return nameA_asc.localeCompare(nameB_asc);
        case 'otherUsername_desc':
          const nameA_desc = getDisplayNameForSorting(a);
          const nameB_desc = getDisplayNameForSorting(b);
          return nameB_desc.localeCompare(nameA_desc);
        case 'groupName_asc':
          const groupA_asc = a.type === 'group' ? a.name || 'Unnamed Group' : '';
          const groupB_asc = b.type === 'group' ? b.name || 'Unnamed Group' : '';
          return groupA_asc.localeCompare(groupB_asc);
        case 'groupName_desc':
          const groupA_desc = a.type === 'group' ? a.name || 'Unnamed Group' : '';
          const groupB_desc = b.type === 'group' ? b.name || 'Unnamed Group' : '';
          return groupB_desc.localeCompare(groupA_desc);
        default:
          return (b.lastMessageAt?.toMillis() || 0) - (a.lastMessageAt?.toMillis() || 0);
      }
    });

    conversationsList.innerHTML = '';
    allConversations.forEach(conv => {
      let chatName = conv.name;
      let displayPhoto = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV'; // Default avatar
      let lastMessageSnippet = conv.lastMessageContent || 'No messages yet.';
      if (lastMessageSnippet.length > 50) lastMessageSnippet = lastMessageSnippet.substring(0, 47) + '...';

      if (conv.type === 'private') {
        const otherParticipantUid = conv.participants.find(uid => uid !== currentUser.uid);
        if (!otherParticipantUid) { // Self-DM case
          chatName = "Self Chat";
          displayPhoto = currentUser.photoURL || displayPhoto; // Use user's own photo
        } else {
          const otherProfile = fetchedProfiles.get(otherParticipantUid);
          chatName = otherProfile?.displayName || otherProfile?.handle || 'Unknown User';
          displayPhoto = otherProfile?.photoURL || displayPhoto;
        }
      } else { // Group chat
        chatName = conv.name || `Group Chat (${conv.participants.length} members)`;
        displayPhoto = 'https://placehold.co/32x32/1F2937/E5E7EB?text=GC'; // Generic Group Chat icon
      }

      const conversationItem = document.createElement('div');
      conversationItem.className = `conversation-item flex items-center p-3 rounded-lg cursor-pointer ${selectedConversationId === conv.id ? 'active' : ''}`;
      conversationItem.dataset.conversationId = conv.id;
      conversationItem.innerHTML = `
                <img src="${displayPhoto}" alt="User" class="w-10 h-10 rounded-full mr-3 object-cover">
                <div class="flex-grow">
                    <p class="font-semibold text-gray-200">${chatName}</p>
                    <p class="text-sm text-gray-400">${lastMessageSnippet}</p>
                </div>
            `;
      conversationsList.appendChild(conversationItem);
    });

    // Re-attach click listeners for conversation items
    conversationsList.querySelectorAll('.conversation-item').forEach(item => {
      item.removeEventListener('click', handleSelectConversationClick); // Prevent duplicates
      item.addEventListener('click', handleSelectConversationClick);
    });

    // If a conversation was previously selected and is still in the list, re-select it
    if (selectedConversationId && !allConversations.some(c => c.id === selectedConversationId)) {
      updateDmUiForNoConversationSelected(); // If selected conversation no longer exists, clear selection
    } else if (selectedConversationId) {
      const activeItem = document.querySelector(`.conversation-item[data-conversation-id="${selectedConversationId}"]`);
      if (activeItem) {
        document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active'));
        activeItem.classList.add('active');
      }
    }
  }, (error) => {
    console.error("Error fetching conversations:", error);
    showMessageBox(`Error loading conversations: ${error.message}`, true);
    conversationsList.innerHTML = `<p class="text-red-500 text-center">Error loading conversations.</p>`;
    noConversationsMessage.style.display = 'none';
  });
}

/**
 * Selects a conversation, loads its messages, and updates the right panel UI.
 * @param {string} convId - The ID of the conversation to select.
 * @param {object} conversationData - The conversation object data.
 */
export async function selectConversation(convId, conversationData) {
  selectedConversationId = convId;
  if (unsubscribeCurrentMessages) {
    unsubscribeCurrentMessages(); // Unsubscribe from previous messages listener
  }

  // --- UI Update: Show Messages Panel, Hide Conversations Panel ---
  conversationsPanel.classList.add('hidden');
  messagesPanel.classList.remove('hidden');

  // Update UI for active conversation item
  document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active'));
  const activeItem = document.querySelector(`.conversation-item[data-conversation-id="${convId}"]`);
  if (activeItem) {
    activeItem.classList.add('active');
  }

  // Update header
  let displayTitle = conversationData.name;
  const currentUser = getCurrentUser();
  if (conversationData.type === 'private') {
    const otherParticipantUid = conversationData.participants.find(uid => uid !== currentUser.uid);
    if (!otherParticipantUid) { // Self-DM case
      displayTitle = "Self Chat";
    } else {
      const otherProfile = await getUserProfileFromFirestore(otherParticipantUid);
      displayTitle = otherProfile?.displayName || otherProfile?.handle || 'Unknown User';
    }
  } else {
    displayTitle = conversationData.name || `Group Chat (${conversationData.participants.length} members)`;
  }
  conversationTitleHeader.textContent = displayTitle;
  deleteConversationBtn.classList.remove('hidden');
  deleteConversationBtn.dataset.conversationId = convId; // Set ID for deletion

  messageInputArea.classList.remove('hidden');
  noMessagesMessage.style.display = 'none';
  conversationMessagesContainer.innerHTML = ''; // Clear previous messages

  renderConversationMessages(convId);
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
  if (!db || !conversationMessagesContainer || !convId) {
    console.error("DB, conversationMessagesContainer, or convId not ready for messages rendering.");
    return;
  }

  const currentUser = getCurrentUser();
  // Use the correct path structure for messages
  const messagesCol = collection(db, `artifacts/${appId}/users/${currentUser.uid}/dms/${convId}/messages`);
  const q = query(messagesCol, orderBy("createdAt", "desc")); // Order by creation time (newest first)

  unsubscribeCurrentMessages = onSnapshot(q, async (snapshot) => {
    conversationMessagesContainer.innerHTML = ''; // Clear messages before re-rendering
    if (snapshot.empty) {
      noMessagesMessage.style.display = 'block';
      return;
    } else {
      noMessagesMessage.style.display = 'none';
    }

    const profilesToFetch = new Set();
    snapshot.forEach(msgDoc => {
      profilesToFetch.add(msgDoc.data().createdBy); // Use createdBy instead of senderId
    });

    const fetchedProfiles = new Map();
    for (const uid of profilesToFetch) {
      const profile = await getUserProfileFromFirestore(uid);
      if (profile) {
        fetchedProfiles.set(uid, profile);
      }
    }

    // Process and render messages in reverse order for "bottom-up" chat display
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse(); // Reverse for display

    for (const msg of messages) {
      const isSentByMe = msg.createdBy === currentUser.uid; // Use createdBy instead of senderId
      const senderProfile = fetchedProfiles.get(msg.createdBy) || {};
      const senderDisplayName = senderProfile.displayName || msg.creatorDisplayName || 'Unknown User';
      const senderPhotoURL = senderProfile.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';

      const messageElement = document.createElement('div');
      messageElement.className = `message-bubble ${isSentByMe ? 'sent' : 'received'}`;
      messageElement.dataset.messageId = msg.id; // Store message ID for deletion
      messageElement.innerHTML = `
                <div class="flex items-center ${isSentByMe ? 'justify-end' : 'justify-start'}">
                    ${!isSentByMe ? `<img src="${senderPhotoURL}" alt="${senderDisplayName}" class="w-6 h-6 rounded-full mr-2 object-cover">` : ''}
                    <span class="message-author">${isSentByMe ? 'You' : senderDisplayName}</span>
                    ${isSentByMe ? `<img src="${senderPhotoURL}" alt="You" class="w-6 h-6 rounded-full ml-2 object-cover">` : ''}
                </div>
                <p class="text-gray-100 mt-1">${await parseMentions(parseEmojis(msg.content))}</p>
                <div class="flex items-center mt-1 text-gray-300">
                    <span class="message-timestamp flex-grow">${msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleString() : 'N/A'}</span>
                    ${currentUser && currentUser.uid === msg.createdBy ? `
                        <button class="delete-message-btn text-red-300 hover:text-red-400 ml-2 text-sm" data-message-id="${msg.id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    ` : ''}
                </div>
            `;
      conversationMessagesContainer.appendChild(messageElement);
    }
    conversationMessagesContainer.scrollTop = conversationMessagesContainer.scrollHeight;

    // Re-attach delete message listeners
    conversationMessagesContainer.querySelectorAll('.delete-message-btn').forEach(btn => {
      btn.removeEventListener('click', handleDeleteMessage);
      btn.addEventListener('click', handleDeleteMessage);
    });
  }, (error) => {
    console.error("Error fetching messages:", error);
    conversationMessagesContainer.innerHTML = `<p class="text-red-500 text-center">Error loading messages: ${error.message}</p>`;
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
 * Deletes an entire conversation and all its messages.
 * @param {string} convId - The ID of the conversation to delete.
 */
export async function deleteConversation(convId) {
  const currentUser = getCurrentUser();
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
  const conversationDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/dms`, convId);
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
    updateDmUiForNoConversationSelected(); // Clear the right panel and go back to list
  } catch (error) {
    console.error("Error deleting conversation:", error);
    showMessageBox(`Error deleting conversation: ${error.message}`, true);
  }
}

/**
 * Fetches all user handles from Firestore and populates the datalist for recipient suggestions.
 */
export async function populateUserHandlesDatalist() {
  if (!db || !userHandlesDatalist) {
    console.warn("Firestore DB or userHandlesDatalist not ready for populating handles.");
    return;
  }
  userHandlesDatalist.innerHTML = ''; // Clear existing options

  const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
  try {
    const querySnapshot = await getDocs(userProfilesRef);
    querySnapshot.forEach(docSnap => {
      const profile = docSnap.data();
      if (profile.handle) {
        const option = document.createElement('option');
        option.value = `@${profile.handle}`; // Add '@' prefix for display
        userHandlesDatalist.appendChild(option);
      }
    });
    console.log("User handles datalist populated.");
  } catch (error) {
    console.error("Error fetching user handles for datalist:", error);
  }
}

/**
 * Unsubscribes the current conversations list listener.
 */
export function unsubscribeConversationsListListener() {
  if (unsubscribeConversationsList) {
    unsubscribeConversationsList();
    unsubscribeConversationsList = null;
  }
}

/**
 * Unsubscribes the current messages listener.
 */
export function unsubscribeCurrentMessagesListener() {
  if (unsubscribeCurrentMessages) {
    unsubscribeCurrentMessages();
    unsubscribeCurrentMessages = null;
  }
}

// --- Event Handlers (exported for forms.js to attach) ---

export async function handleCreateConversation(event) {
  event.preventDefault();
  const type = newChatTypeSelect.value;
  let participantHandles = [];
  let groupName = '';

  if (type === 'private') {
    const recipient = privateChatRecipientInput.value.trim();
    if (recipient) {
      participantHandles = [recipient];
    }
  } else if (type === 'group') {
    groupName = groupChatNameInput.value.trim();
    const participants = groupChatParticipantsInput.value.trim();
    if (participants) {
      participantHandles = participants.split(',').map(p => p.trim()).filter(p => p);
    }
  }

  if (participantHandles.length === 0 && type === 'group') {
    showMessageBox("Please enter at least one participant for group chat.", true);
    return;
  }

  await createConversation(type, participantHandles, groupName);
}

export async function handleSendMessage(event) {
  event.preventDefault();
  const content = messageContentInput.value.trim();
  if (content) {
    await sendMessage(content);
  }
}

export async function handleDeleteMessage(event) {
  event.preventDefault();
  const messageId = event.target.dataset.messageId || event.target.closest('.delete-message-btn')?.dataset.messageId;
  if (selectedConversationId && messageId) {
    await deleteMessage(messageId);
  } else {
    console.error("No selected conversation or message ID for deletion.");
    showMessageBox("Could not delete message. No active conversation or message selected.", true);
  }
}

export async function handleDeleteConversationClick(event) {
  event.preventDefault();
  const convId = event.target.dataset.conversationId || event.target.closest('#delete-conversation-btn')?.dataset.conversationId;
  if (convId) {
    await deleteConversation(convId);
  } else {
    console.error("No conversation ID for deletion.");
    showMessageBox("Could not delete conversation. No conversation selected.", true);
  }
}

function handleSelectConversationClick(event) {
  const convId = event.currentTarget.dataset.conversationId;
  const conversation = allConversations.find(c => c.id === convId);
  if (conversation) {
    selectConversation(convId, conversation);
  }
}

export function attachDmEventListeners() {
  if (createConversationForm) {
    createConversationForm.addEventListener('submit', handleCreateConversation);
  }

  if (sendMessageForm) {
    sendMessageForm.addEventListener('submit', handleSendMessage);
  }

  if (deleteConversationBtn) {
    deleteConversationBtn.addEventListener('click', handleDeleteConversationClick);
  }

  if (backToChatsBtn) {
    backToChatsBtn.addEventListener('click', () => {
      updateDmUiForNoConversationSelected();
    });
  }

  if (newChatTypeSelect) {
    newChatTypeSelect.addEventListener('change', () => {
      if (newChatTypeSelect.value === 'private') {
        privateChatFields.classList.remove('hidden');
        groupChatFields.classList.add('hidden');
      } else if (newChatTypeSelect.value === 'group') {
        privateChatFields.classList.add('hidden');
        groupChatFields.classList.remove('hidden');
      }
    });
  }

  if (sortConversationsBySelect) {
    sortConversationsBySelect.addEventListener('change', () => {
      currentSortOption = sortConversationsBySelect.value;
      renderConversationsList(); // Re-render with new sort
    });
  }
}

