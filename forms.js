/* global __app_id */ // Explicitly declare __app_id as a global for linters

// forms.js: This script handles forum thread and comment functionality,
// including real-time updates, reactions, emoji parsing, and user mentions.
// It now also includes Direct Messages and Announcements features with tabbed navigation.

// Debug log to check if the script starts executing.
console.log("forms.js - Script parsing initiated.");

// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Local Module Imports ---
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js';
import { loadNavbar } from './navbar.js';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app",
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM"
};

/** @global {string} appId - The application ID derived from __app_id or firebaseConfig.projectId. */
const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : null;
const appId = canvasAppId || firebaseConfig.projectId || 'default-app-id';

// --- Global Firebase Instances ---
/** @global {object} app - The Firebase app instance. */
let app;
/** @global {object} auth - The Firebase Auth instance. */
let auth;
/** @global {object} db - The Firestore database instance. */
let db;
/** @global {object|null} currentUser - Stores the current user object, including custom profile data like 'handle' and 'isAdmin'. */
let currentUser = null;
/** @global {boolean} isFirebaseInitialized - Flag indicating if Firebase has been initialized. */
let isFirebaseInitialized = false;

// --- Admin UIDs for Announcements (Replace with your actual Admin UIDs) ---
// IMPORTANT: Replace 'CEch8cXWemSDQnM3dHVKPt0RGpn2' and 'OoeTK1HmebQyOf3gEiCKAHVtD6l2' with the actual UIDs of your Firebase authenticated admin users.
// You can find UIDs in the Firebase Authentication section of your Firebase console.
const ADMIN_UIDS = ['CEch8cXWemSDQnM3dHVKPt0RGpn2', 'OoeTK1HmebQyOf3gEiCKAHVtD6l2'];

// --- Default Values ---
const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark';

// --- DM State Variables ---
let selectedConversationId = null;
let unsubscribeCurrentMessages = null; // Listener for messages in the currently selected conversation
let allConversations = []; // Array to hold fetched conversations for sorting
let currentSortOption = 'lastMessageAt_desc'; // Default sort for conversations list

// --- DOM Elements ---
// Forum Elements
const threadsList = document.getElementById('threads-list');
const createThreadForm = document.getElementById('create-thread-form');
const threadTitleInput = document.getElementById('thread-title');
const threadContentInput = document.getElementById('thread-content');
const threadsLoadingError = document.getElementById('threads-loading-error');
const noThreadsMessage = document.getElementById('no-threads-message');

// DM Elements (Updated IDs for new structure)
const conversationsPanel = document.getElementById('conversations-panel'); // Reference to the left panel
const messagesPanel = document.getElementById('messages-panel');       // Reference to the right panel
const backToChatsBtn = document.getElementById('back-to-chats-btn'); // New Back button

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
const userHandlesDatalist = document.getElementById('user-handles-list'); // New datalist element


// Announcement Elements
const createAnnouncementSection = document.getElementById('create-announcement-section');
const createAnnouncementForm = document.getElementById('create-announcement-form');
const announcementContentInput = document.getElementById('announcement-content');
const announcementsList = document.getElementById('announcements-list');
const noAnnouncementsMessage = document.getElementById('no-announcements-message');

// Tab Elements
const tabForum = document.getElementById('tab-forum');
const tabDMs = document.getElementById('tab-dms');
const tabAnnouncements = document.getElementById('tab-announcements');

const contentForum = document.getElementById('content-forum');
const contentDMs = document.getElementById('content-dms');
const contentAnnouncements = document.getElementById('content-announcements');

// Message Box and Confirm Modal
const messageBox = document.getElementById('message-box');
const customConfirmModal = document.getElementById('custom-confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmSubmessage = document.getElementById('confirm-submessage');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');

// --- EMOJI & MENTION CONFIGURATION ---
const COMMON_EMOJIS = ['👍', '👎', '😂', '❤️', '🔥', '🎉', '💡', '🤔'];
const EMOJI_MAP = {
  ':smile:': '😄', ':laugh:': '😆', ':love:': '❤️', ':thumbsup:': '👍',
  ':thumbsdown:': '👎', ':fire:': '🔥', ':party:': '🎉', ':bulb:': '💡',
  ':thinking:': '🤔', ':star:': '⭐', ':rocket:': '🚀', ':clap:': '👏',
  ':cry:': '😢', ':sleepy:': '😴'
};
let userHandleCache = {};
let handleUidCache = {};

/**
 * Sanitizes a string to be suitable for a user handle.
 * Converts to lowercase and removes any characters not allowed (alphanumeric, underscore, dot, hyphen).
 * @param {string} input - The raw string to sanitize.
 * @returns {string} The sanitized handle string.
 */
function sanitizeHandle(input) {
  return input.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}

/**
 * Resolves an array of user handles to their corresponding UIDs.
 * Caches results for future use.
 * @param {string[]} handles - An array of user handles (e.g., ['@user1', 'user2']).
 * @returns {Promise<string[]>} A Promise that resolves to an array of user UIDs.
 */
async function resolveHandlesToUids(handles) {
  const uids = [];
  const handlesToFetch = [];

  for (const handle of handles) {
    const sanitizedHandle = sanitizeHandle(handle.startsWith('@') ? handle.substring(1) : handle);
    if (handleUidCache[sanitizedHandle]) {
      uids.push(handleUidCache[sanitizedHandle]);
    } else {
      handlesToFetch.push(sanitizedHandle);
    }
  }

  if (handlesToFetch.length > 0) {
    const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
    // Firestore 'in' query supports up to 10 items
    const q = query(userProfilesRef, where("handle", "in", handlesToFetch));
    try {
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(docSnap => {
        const profile = docSnap.data();
        const uid = docSnap.id;
        if (profile.handle) {
          userHandleCache[uid] = profile.handle;
          handleUidCache[profile.handle] = uid;
          uids.push(uid);
        }
      });
    } catch (error) {
      console.error("Error resolving handles from Firestore:", error);
      showMessageBox("Error resolving some user handles.", true);
    }
  }
  return uids;
}


/**
 * Generates a unique handle for a given user UID and saves it to their profile in Firestore.
 * This is called for both newly authenticated users and anonymous users to ensure they always have a handle.
 * It checks for uniqueness and appends a counter if the base handle is already taken.
 * @param {string} uid - The user's UID.
 * @param {string} initialSuggestion - A suggested handle (e.g., derived from display name or email).
 * @returns {Promise<string>} A Promise that resolves with the generated unique handle.
 */
async function generateUniqueHandle(uid, initialSuggestion) {
  let baseHandle = sanitizeHandle(initialSuggestion || 'anonuser');
  if (baseHandle.length === 0) {
    baseHandle = 'user';
  }
  let handle = baseHandle;
  let counter = 0;
  let isUnique = false;

  const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);

  while (!isUnique) {
    const q = query(userProfilesRef, where("handle", "==", handle));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      isUnique = true;
    } else {
      counter++;
      handle = `${baseHandle}${counter}`;
    }
  }

  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  await setDoc(userDocRef, { handle: handle }, { merge: true });

  console.log(`Generated and saved unique handle for ${uid}: ${handle}`);
  return handle;
}

/**
 * Replaces emoji shortcodes (e.g., :smile:) in a given text with their corresponding emoji characters.
 * @param {string} text - The input text containing potential emoji shortcodes.
 * @returns {string} The text with shortcodes replaced by emojis.
 */
function parseEmojis(text) {
  let processedText = text;
  for (const shortcode in EMOJI_MAP) {
    const emoji = EMOJI_MAP[shortcode];
    processedText = processedText.split(shortcode).join(emoji);
  }
  return processedText;
}

/**
 * Parses a given text for user mentions (e.g., @username) and converts them into clickable links.
 * It looks up the mentioned handles in Firestore (or cache) to get their UIDs for the link.
 * @param {string} text - The input text containing potential user mentions.
 * @returns {Promise<string>} A Promise that resolves with the text, with mentions converted to HTML links.
 */
async function parseMentions(text) {
  let processedText = text;
  const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
  let match;
  const mentionsToResolve = new Map();

  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionedHandle = match[1];
    if (!mentionsToResolve.has(mentionedHandle)) {
      mentionsToResolve.set(mentionedHandle, null);
    }
  }

  for (const [mentionedHandle, _] of mentionsToResolve) {
    let resolvedUid = handleUidCache[mentionedHandle];

    if (!resolvedUid) {
      const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
      const q = query(userProfilesRef, where("handle", "==", mentionedHandle));
      try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          querySnapshot.forEach(docSnap => {
            resolvedUid = docSnap.id;
            userHandleCache[resolvedUid] = mentionedHandle;
            handleUidCache[mentionedHandle] = resolvedUid;
          });
        }
      } catch (error) {
        console.error("Error resolving mentioned handle from Firestore:", error);
      }
    }
    mentionsToResolve.set(mentionedHandle, resolvedUid);
  }

  processedText = text.replace(mentionRegex, (fullMatch, mentionedHandle) => {
    const resolvedUid = mentionsToResolve.get(mentionedHandle);
    if (resolvedUid) {
      return `<a href="settings.html?uid=${resolvedUid}" class="text-blue-400 hover:underline">@${mentionedHandle}</a>`;
    } else {
      return fullMatch;
    }
  });

  return processedText;
}

// --- UTILITY FUNCTIONS ---

/**
 * Displays a custom message box for user feedback (success or error).
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if it's an error message, false for success.
 */
window.showMessageBox = function(message, isError) {
  if (!messageBox) {
    console.error("MessageBox element not found. Message:", message);
    return;
  }
  messageBox.textContent = message;
  messageBox.className = 'message-box';
  if (isError) {
    messageBox.classList.add('error');
  } else {
    messageBox.classList.add('success');
  }
  messageBox.style.display = 'block';
  setTimeout(() => {
    messageBox.style.display = 'none';
  }, 5000);
};

/**
 * Shows a custom confirmation modal to the user.
 * @param {string} message - The main confirmation question or statement.
 * @param {string} [subMessage=''] - An optional secondary message for more detail.
 * @returns {Promise<boolean>} A Promise that resolves to `true` if the user confirms, `false` if cancelled.
 */
function showCustomConfirm(message, subMessage = '') {
  return new Promise(resolve => {
    confirmMessage.textContent = message;
    confirmSubmessage.textContent = subMessage;
    customConfirmModal.style.display = 'flex';

    const onConfirm = () => {
      customConfirmModal.style.display = 'none';
      confirmYesBtn.removeEventListener('click', onConfirm);
      confirmNoBtn.removeEventListener('click', onCancel);
      resolve(true);
    };

    const onCancel = () => {
      customConfirmModal.style.display = 'none';
      confirmYesBtn.removeEventListener('click', onConfirm);
      confirmNoBtn.removeEventListener('click', onCancel);
      resolve(false);
    };

    confirmYesBtn.addEventListener('click', onConfirm);
    confirmNoBtn.addEventListener('click', onCancel);
  });
}

/**
 * Fetches user profile data from the 'user_profiles' collection in Firestore.
 * @param {string} uid - The User ID (UID) to fetch the profile for.
 * @returns {Promise<Object|null>} A Promise that resolves with the user's profile data, or `null` if not found or an error occurs.
 */
async function getUserProfileFromFirestore(uid) {
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore.");
    return null;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("Error fetching user profile from Firestore:", error);
  }
  return null;
}

// --- FORUM THREAD FUNCTIONS ---

/**
 * Creates a new forum thread in Firestore.
 * @param {string} title - The title of the new thread.
 * @param {string} content - The main content/body of the thread.
 */
async function createThread(title, content) {
  if (!currentUser || !currentUser.uid || !currentUser.handle) {
    showMessageBox("You must be logged in and have a handle to create a thread.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot create thread.", true);
    return;
  }

  const threadsCol = collection(db, `artifacts/${appId}/public/data/forum_threads`);
  const threadData = {
    title: title,
    content: content,
    authorId: currentUser.uid,
    authorHandle: currentUser.handle,
    authorDisplayName: currentUser.displayName,
    authorPhotoURL: currentUser.photoURL || DEFAULT_PROFILE_PIC,
    createdAt: serverTimestamp(),
    reactions: {},
    commentCount: 0
  };

  try {
    await addDoc(threadsCol, threadData);
    showMessageBox("Thread created successfully!", false);
    createThreadForm.reset();
  } catch (error) {
    console.error("Error creating thread:", error);
    showMessageBox(`Error creating thread: ${error.message}`, true);
  }
}

/**
 * Deletes a forum thread and all its associated comments from Firestore.
 * @param {string} threadId - The ID of the thread to be deleted.
 */
async function deleteThread(threadId) {
  if (!currentUser) {
    showMessageBox("You must be logged in to delete a thread.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete thread.", true);
    return;
  }

  const confirmation = await showCustomConfirm(
    "Are you sure you want to delete this thread?",
    "This will also delete all comments and reactions associated with it. This action cannot be undone."
  );
  if (!confirmation) {
    showMessageBox("Thread deletion cancelled.", false);
    return;
  }

  const threadDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
  try {
    const commentsColRef = collection(threadDocRef, 'comments');
    const commentsSnapshot = await getDocs(commentsColRef);
    const deleteCommentPromises = [];
    commentsSnapshot.forEach(commentDoc => {
      deleteCommentPromises.push(deleteDoc(commentDoc.ref));
    });
    await Promise.all(deleteCommentPromises);

    await deleteDoc(threadDocRef);
    showMessageBox("Thread deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting thread:", error);
    showMessageBox(`Error deleting thread: ${error.message}`, true);
  }
}

// --- COMMENT FUNCTIONS (FOR FORUM) ---

/**
 * Adds a new comment to a specific forum thread in Firestore.
 * @param {string} threadId - The ID of the parent thread for the comment.
 * @param {string} content - The content of the new comment.
 */
async function addCommentToThread(threadId, content) {
  if (!currentUser || !currentUser.uid || !currentUser.handle) {
    showMessageBox("You must be logged in and have a handle to comment.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot add comment.", true);
    return;
  }
  if (content.trim() === '') {
    showMessageBox("Comment cannot be empty.", true);
    return;
  }

  const commentsCol = collection(db, `artifacts/${appId}/public/data/forum_threads/${threadId}/comments`);
  const commentData = {
    content: content,
    authorId: currentUser.uid,
    authorHandle: currentUser.handle,
    authorDisplayName: currentUser.displayName,
    authorPhotoURL: currentUser.photoURL || DEFAULT_PROFILE_PIC,
    createdAt: serverTimestamp(),
    reactions: {},
  };

  try {
    await addDoc(commentsCol, commentData);
    const threadRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
    const currentThreadData = (await getDoc(threadRef)).data();
    await updateDoc(threadRef, {
      commentCount: (currentThreadData?.commentCount || 0) + 1
    });
    showMessageBox("Comment added successfully!", false);
  } catch (error) {
    console.error("Error adding comment:", error);
    showMessageBox(`Error adding comment: ${error.message}`, true);
  }
}

/**
 * Deletes a specific comment from a thread in Firestore.
 * @param {string} threadId - The ID of the parent thread.
 * @param {string} commentId - The ID of the comment to delete.
 */
async function deleteComment(threadId, commentId) {
  if (!currentUser) {
    showMessageBox("You must be logged in to delete a comment.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete comment.", true);
    return;
  }

  const confirmation = await showCustomConfirm("Are you sure you want to delete this comment?", "This action cannot be undone.");
  if (!confirmation) {
    showMessageBox("Comment deletion cancelled.", false);
    return;
  }

  const commentDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads/${threadId}/comments`, commentId);
  try {
    await deleteDoc(commentDocRef);
    const threadRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
    const currentThreadData = (await getDoc(threadRef)).data();
    await updateDoc(threadRef, {
      commentCount: Math.max(0, (currentThreadData?.commentCount || 0) - 1)
    });
    showMessageBox("Comment deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting comment:", error);
    showMessageBox(`Error deleting comment: ${error.message}`, true);
  }
}

// --- REACTION FUNCTIONS ---

/**
 * Handles adding or removing an emoji reaction to a thread or a comment.
 * @param {'thread'|'comment'} type - The type of item (thread or comment) being reacted to.
 * @param {string} itemId - The ID of the thread (for thread reactions) or the parent thread (for comment reactions).
 * @param {string | null} commentId - The ID of the comment (if `type` is 'comment'), otherwise `null`.
 * @param {string} emoji - The emoji string (e.g., '👍', '❤️') to apply/remove as a reaction.
 */
async function handleReaction(type, itemId, commentId = null, emoji) {
  if (!currentUser) {
    showMessageBox("You must be logged in to react.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot add reaction.", true);
    return;
  }

  let itemRef;
  if (type === 'thread') {
    itemRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, itemId);
  } else if (type === 'comment') {
    itemRef = doc(db, `artifacts/${appId}/public/data/forum_threads/${itemId}/comments`, commentId);
  } else {
    console.error("Invalid reaction type:", type);
    return;
  }

  try {
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) {
      console.error("Item for reaction not found.");
      showMessageBox("Item not found for reaction.", true);
      return;
    }

    const currentReactions = itemSnap.data().reactions || {};
    const userUid = currentUser.uid;

    const emojiUsers = currentReactions[emoji] || {};
    let newEmojiUsers = { ...emojiUsers };

    if (newEmojiUsers[userUid]) {
      delete newEmojiUsers[userUid];
      showMessageBox(`Removed ${emoji} reaction.`, false);
    } else {
      newEmojiUsers[userUid] = true;
      showMessageBox(`Added ${emoji} reaction!`, false);
    }

    await updateDoc(itemRef, {
      [`reactions.${emoji}`]: newEmojiUsers
    });

  } catch (error) {
    console.error("Error handling reaction:", error);
    showMessageBox(`Error reacting: ${error.message}`, true);
  }
}

/**
 * Renders the emoji reaction buttons (and their counts) for a given thread or comment.
 * @param {string} type - 'thread' or 'comment'.
 * @param {string} itemId - The ID of the thread or comment.
 * @param {Object} reactions - The reactions object from Firestore for this item.
 * @param {HTMLElement} containerElement - The DOM element where the reaction buttons should be appended.
 * @param {string | null} commentId - Optional: The ID of the comment if `type` is 'comment'.
 */
function renderReactionButtons(type, itemId, reactions, containerElement, commentId = null) {
  containerElement.innerHTML = '';

  COMMON_EMOJIS.forEach(emoji => {
    const count = reactions[emoji] ? Object.keys(reactions[emoji]).length : 0;
    const hasUserReacted = currentUser && reactions[emoji] && reactions[emoji][currentUser.uid];
    const buttonClass = hasUserReacted ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700';

    const button = document.createElement('button');
    button.className = `reaction-btn px-2 py-1 rounded-full text-sm mr-1 mb-1 transition-colors duration-200 ${buttonClass}`;
    button.innerHTML = `${emoji} <span class="font-bold">${count}</span>`;
    button.addEventListener('click', () => handleReaction(type, itemId, commentId, emoji));
    containerElement.appendChild(button);
  });

  for (const emoji in reactions) {
    if (!COMMON_EMOJIS.includes(emoji)) {
      const count = Object.keys(reactions[emoji]).length;
      const hasUserReacted = currentUser && reactions[emoji] && reactions[emoji][currentUser.uid];
      const buttonClass = hasUserReacted ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700';

      const button = document.createElement('button');
      button.className = `reaction-btn px-2 py-1 rounded-full text-sm mr-1 mb-1 transition-colors duration-200 ${buttonClass}`;
      button.innerHTML = `${emoji} <span class="font-bold">${count}</span>`;
      button.addEventListener('click', () => handleReaction(type, itemId, commentId, emoji));
      containerElement.appendChild(button);
    }
  }
}

// --- DIRECT MESSAGE (DM) FUNCTIONS (MAJOR REFACTOR) ---

/**
 * Creates a new conversation (private or group chat) in Firestore.
 * @param {string} type - 'private' or 'group'.
 * @param {string[]} participantHandles - Handles of all participants (including current user for groups).
 * @param {string} [groupName=''] - Optional name for group chats.
 */
async function createConversation(type, participantHandles, groupName = '') {
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
    // If only one participant and it's the current user, it's a self-DM. Valid.
    // If two participants, one is current user and another, it's a 1-to-1. Valid.
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


  const conversationsCol = collection(db, `artifacts/${appId}/public/data/conversations`);

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
let unsubscribeConversations = null;
function renderConversationsList() {
  if (!db || !conversationsList || !currentUser) {
    console.warn("DB, conversationsList, or currentUser not ready for conversations rendering.");
    if (conversationsList) conversationsList.innerHTML = '<p class="text-gray-400 text-center">Please log in to view conversations.</p>';
    if (noConversationsMessage) noConversationsMessage.style.display = 'none';
    return;
  }

  // Unsubscribe from previous listener if active
  if (unsubscribeConversations) {
    unsubscribeConversations();
    unsubscribeConversations = null;
  }

  const conversationsCol = collection(db, `artifacts/${appId}/public/data/conversations`);
  // Query for conversations where the current user is a participant.
  // This query requires a composite index: 'participants' (array) + 'lastMessageAt' (desc)
  const q = query(
    conversationsCol,
    where('participants', 'array-contains', currentUser.uid)
    // orderBy is not used here to avoid additional composite indexes
    // Sorting will be done client-side after fetching all conversations for the user
  );

  unsubscribeConversations = onSnapshot(q, async (snapshot) => {
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

    // Fetch all necessary user profiles in one go
    const fetchedProfiles = new Map();
    for (const uid of profilesToFetch) {
      const profile = await getUserProfileFromFirestore(uid);
      if (profile) {
        fetchedProfiles.set(uid, profile);
        userHandleCache[uid] = profile.handle;
        handleUidCache[profile.handle] = uid;
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
      let displayPhoto = DEFAULT_PROFILE_PIC;
      let lastMessageSnippet = conv.lastMessageContent || 'No messages yet.';
      if (lastMessageSnippet.length > 50) lastMessageSnippet = lastMessageSnippet.substring(0, 47) + '...';

      if (conv.type === 'private') {
        const otherParticipantUid = conv.participants.find(uid => uid !== currentUser.uid);
        if (!otherParticipantUid) { // Self-DM case
          chatName = "Self Chat";
          displayPhoto = currentUser.photoURL || DEFAULT_PROFILE_PIC; // Use user's own photo
        } else {
          const otherProfile = fetchedProfiles.get(otherParticipantUid);
          chatName = otherProfile?.displayName || otherProfile?.handle || 'Unknown User';
          displayPhoto = otherProfile?.photoURL || DEFAULT_PROFILE_PIC;
        }
      } else { // Group chat
        chatName = conv.name || `Group Chat (${conv.participants.length} members)`;
        // For group chats, a generic group icon or first participant's photo
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
      item.addEventListener('click', () => {
        const convId = item.dataset.conversationId;
        const selectedConv = allConversations.find(conv => conv.id === convId);
        if (selectedConv) {
          selectConversation(convId, selectedConv);
        }
      });
    });

    // If a conversation was previously selected and is still in the list, re-select it
    if (selectedConversationId && !allConversations.some(c => c.id === selectedConversationId)) {
      // If selected conversation no longer exists, clear selection
      updateDmUiForNoConversationSelected();
    } else if (selectedConversationId) {
      // If it exists, ensure it's visually active
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
async function selectConversation(convId, conversationData) {
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
 * Clears the right DM panel when no conversation is selected (or when the selected one is deleted).
 * Also returns to the conversations list view.
 */
function updateDmUiForNoConversationSelected() {
  selectedConversationId = null;
  if (unsubscribeCurrentMessages) {
    unsubscribeCurrentMessages();
    unsubscribeCurrentMessages = null;
  }
  conversationTitleHeader.textContent = 'Select a Conversation';
  deleteConversationBtn.classList.add('hidden');
  messageInputArea.classList.add('hidden');
  conversationMessagesContainer.innerHTML = '';
  noMessagesMessage.style.display = 'block'; // Show "No messages..." message
  document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active')); // Deactivate all list items

  // --- UI Update: Show Conversations Panel, Hide Messages Panel ---
  conversationsPanel.classList.remove('hidden');
  messagesPanel.classList.add('hidden');
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

  const messagesCol = collection(db, `artifacts/${appId}/public/data/conversations/${convId}/messages`);
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
      profilesToFetch.add(msgDoc.data().senderId);
    });

    const fetchedProfiles = new Map();
    for (const uid of profilesToFetch) {
      const profile = await getUserProfileFromFirestore(uid);
      if (profile) {
        fetchedProfiles.set(uid, profile);
        userHandleCache[uid] = profile.handle;
        handleUidCache[profile.handle] = uid;
      }
    }

    // Process and render messages in reverse order for "bottom-up" chat display
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse(); // Reverse for display

    messages.forEach(async msg => {
      const isSentByMe = msg.senderId === currentUser.uid;
      const senderProfile = fetchedProfiles.get(msg.senderId) || {};
      const senderDisplayName = senderProfile.displayName || msg.senderDisplayName || 'Unknown User';
      const senderPhotoURL = senderProfile.photoURL || msg.senderPhotoURL || DEFAULT_PROFILE_PIC;

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
                    ${currentUser && currentUser.uid === msg.senderId ? `
                        <button class="delete-message-btn text-red-300 hover:text-red-400 ml-2 text-sm" data-message-id="${msg.id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    ` : ''}
                </div>
            `;
      conversationMessagesContainer.appendChild(messageElement);
    });
    conversationMessagesContainer.scrollTop = conversationMessagesContainer.scrollHeight; // Scroll to bottom

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
async function sendMessage(content) {
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

  const messagesCol = collection(db, `artifacts/${appId}/public/data/conversations/${selectedConversationId}/messages`);
  const conversationDocRef = doc(db, `artifacts/${appId}/public/data/conversations`, selectedConversationId);

  const messageData = {
    senderId: currentUser.uid,
    senderHandle: currentUser.handle,
    senderDisplayName: currentUser.displayName,
    senderPhotoURL: currentUser.photoURL || DEFAULT_PROFILE_PIC,
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
async function deleteMessage(messageId) {
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

  const messageDocRef = doc(db, `artifacts/${appId}/public/data/conversations/${selectedConversationId}/messages`, messageId);
  try {
    await deleteDoc(messageDocRef);
    showMessageBox("Message deleted!", false);

    // Optional: Re-evaluate last message in conversation if the deleted one was the last
    const messagesCol = collection(db, `artifacts/${appId}/public/data/conversations/${selectedConversationId}/messages`);
    const q = query(messagesCol, orderBy("createdAt", "desc")); // Get the new last message (removed limit for better accuracy if there are few messages)
    const snapshot = await getDocs(q); // Use getDocs instead of onSnapshot for a one-time fetch here
    const conversationDocRef = doc(db, `artifacts/${appId}/public/data/conversations`, selectedConversationId);

    if (!snapshot.empty) {
      const lastMsg = snapshot.docs[0].data();
      await updateDoc(conversationDocRef, {
        lastMessageAt: lastMsg.createdAt,
        lastMessageContent: lastMsg.content,
        lastMessageSenderHandle: lastMsg.senderHandle,
        lastMessageSenderId: lastMsg.senderId,
      });
    } else {
      // No messages left, update conversation to reflect this
      await updateDoc(conversationDocRef, {
        lastMessageAt: null, // Set to null if no messages
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
async function deleteConversation(convId) {
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

  const conversationDocRef = doc(db, `artifacts/${appId}/public/data/conversations`, convId);
  const messagesColRef = collection(conversationDocRef, 'messages');

  try {
    // Delete all messages in the subcollection (in batches if many)
    const messagesSnapshot = await getDocs(messagesColRef);
    const batch = writeBatch(db);
    messagesSnapshot.docs.forEach((msgDoc) => {
      batch.delete(msgDoc.ref);
    });
    await batch.commit();

    // Delete the conversation document itself
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
async function populateUserHandlesDatalist() {
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


// --- ANNOUNCEMENT FUNCTIONS ---

/**
 * Sends a new announcement (admin only).
 * @param {string} content - The announcement content.
 */
async function postAnnouncement(content) {
  if (!currentUser || !currentUser.uid || !currentUser.isAdmin) {
    showMessageBox("You do not have permission to post announcements.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot post announcement.", true);
    return;
  }
  if (content.trim() === '') {
    showMessageBox("Announcement content cannot be empty.", true);
    return;
  }

  const announcementsCol = collection(db, `artifacts/${appId}/public/data/announcements`);
  const announcementData = {
    authorId: currentUser.uid,
    authorHandle: currentUser.handle,
    authorDisplayName: currentUser.displayName,
    authorPhotoURL: currentUser.photoURL || DEFAULT_PROFILE_PIC,
    content: content,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(announcementsCol, announcementData);
    showMessageBox("Announcement posted successfully!", false);
    createAnnouncementForm.reset();
  } catch (error) {
    console.error("Error posting announcement:", error);
    showMessageBox(`Error posting announcement: ${error.message}`, true);
  }
}

/**
 * Deletes an announcement (admin only).
 * @param {string} announcementId - The ID of the announcement to delete.
 */
async function deleteAnnouncement(announcementId) {
  if (!currentUser || !currentUser.uid || !currentUser.isAdmin) {
    showMessageBox("You do not have permission to delete announcements.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete announcement.", true);
    return;
  }

  const confirmation = await showCustomConfirm("Are you sure you want to delete this announcement?", "This action cannot be undone.");
  if (!confirmation) {
    showMessageBox("Announcement deletion cancelled.", false);
    return;
  }

  const announcementDocRef = doc(db, `artifacts/${appId}/public/data/announcements`, announcementId);
  try {
    await deleteDoc(announcementDocRef);
    showMessageBox("Announcement deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting announcement:", error);
    showMessageBox(`Error deleting announcement: ${error.message}`, true);
  }
}

// --- REAL-TIME RENDERING (ONSNAPSHOT) ---

let unsubscribeForum = null;
let unsubscribeConversationsList = null; // Renamed for clarity
let unsubscribeAnnouncements = null;

/**
 * Renders the forum threads in real-time.
 */
function renderForumThreads() {
  // Unsubscribe from other listeners if active
  if (unsubscribeConversationsList) { // Use new name
    unsubscribeConversationsList();
    unsubscribeConversationsList = null;
  }
  if (unsubscribeCurrentMessages) { // Important for DM tab
    unsubscribeCurrentMessages();
    unsubscribeCurrentMessages = null;
  }
  if (unsubscribeAnnouncements) {
    unsubscribeAnnouncements();
    unsubscribeAnnouncements = null;
  }

  if (!db || !threadsList) {
    console.error("Firestore DB or threadsList element not ready for forum rendering.");
    return;
  }

  const threadsCol = collection(db, `artifacts/${appId}/public/data/forum_threads`);
  const q = query(threadsCol, orderBy("createdAt", "desc"));

  // Attach new listener for forum threads
  unsubscribeForum = onSnapshot(q, async (snapshot) => {
    threadsList.innerHTML = '';
    if (snapshot.empty) {
      noThreadsMessage.style.display = 'block';
      threadsLoadingError.style.display = 'none';
    } else {
      noThreadsMessage.style.display = 'none';
      threadsLoadingError.style.display = 'none';
    }

    const profilesToFetch = new Set();
    snapshot.forEach(threadDoc => {
      profilesToFetch.add(threadDoc.data().authorId);
    });

    const fetchedProfiles = new Map();
    for (const uid of profilesToFetch) {
      const profile = await getUserProfileFromFirestore(uid);
      if (profile) {
        fetchedProfiles.set(uid, profile);
        userHandleCache[uid] = profile.handle;
        handleUidCache[profile.handle] = uid;
      }
    }

    for (const threadDoc of snapshot.docs) {
      const thread = threadDoc.data();
      const threadId = threadDoc.id;
      const authorProfile = fetchedProfiles.get(thread.authorId) || {};
      const authorDisplayName = authorProfile.displayName || thread.authorDisplayName || 'Anonymous User';
      const authorHandle = authorProfile.handle || thread.authorHandle || 'N/A';
      const authorPhotoURL = authorProfile.photoURL || thread.authorPhotoURL || DEFAULT_PROFILE_PIC;

      const threadElement = document.createElement('div');
      threadElement.id = `thread-${threadId}`;
      threadElement.className = 'bg-gray-700 p-6 rounded-lg shadow-md mb-8';

      const parsedContent = await parseMentions(parseEmojis(thread.content));

      threadElement.innerHTML = `
        <div class="flex items-center mb-4">
          <img src="${authorPhotoURL}" alt="Profile" class="w-10 h-10 rounded-full mr-3 object-cover">
          <div>
            <p class="font-semibold text-gray-200">${authorDisplayName} <span class="text-gray-400 text-sm">(@${authorHandle})</span></p>
            <p class="text-sm text-gray-400">${thread.createdAt ? new Date(thread.createdAt.toDate()).toLocaleString() : 'N/A'}</p>
          </div>
        </div>
        <h3 class="text-2xl font-bold text-blue-300 mb-2">${thread.title}</h3>
        <p class="text-gray-300 mb-4">${parsedContent}</p>
        <div class="flex items-center text-gray-400 text-sm mb-4">
          <span class="mr-4">Comments: ${thread.commentCount || 0}</span>
          <div id="thread-reactions-${threadId}" class="flex flex-wrap items-center">
            <!-- Reaction buttons will be rendered here -->
          </div>
        </div>
        <div class="flex justify-end space-x-2 mb-4">
          ${currentUser && currentUser.uid === thread.authorId ? `<button class="delete-thread-btn bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition duration-300" data-id="${threadId}">Delete Thread</button>` : ''}
        </div>

        <!-- Comments Section -->
        <div class="mt-6 border-t border-gray-600 pt-6">
          <h4 class="text-xl font-semibold text-gray-200 mb-4">Comments</h4>
          <div id="comments-${threadId}" class="space-y-4">
            <!-- Comments will be loaded here dynamically -->
          </div>
          ${currentUser ? `
            <div class="mt-6 flex items-center">
              <input type="text" id="comment-input-${threadId}" placeholder="Add a comment..." class="flex-grow bg-gray-600 text-gray-100 p-3 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <button class="post-comment-btn bg-blue-600 text-white p-3 rounded-r-md hover:bg-blue-700 transition duration-300" data-thread-id="${threadId}">Post</button>
            </div>
            <div class="mt-2 text-sm text-gray-400">
                You can use emoji shortcodes (e.g., :smile:) and mention users (e.g., @username).
                <div class="emoji-palette flex flex-wrap gap-2 mt-2">
                  ${COMMON_EMOJIS.map(emoji => `<span class="emoji-item cursor-pointer text-xl" data-emoji="${emoji}">${emoji}</span>`).join('')}
                </div>
            </div>
          ` : `<p class="text-gray-400 mt-4">Log in to post comments.</p>`}
        </div>
      `;
      threadsList.appendChild(threadElement);

      const threadReactionsContainer = document.getElementById(`thread-reactions-${threadId}`);
      renderReactionButtons('thread', threadId, thread.reactions || {}, threadReactionsContainer);

      const commentsColRef = collection(db, `artifacts/${appId}/public/data/forum_threads/${threadId}/comments`);
      const commentsQuery = query(commentsColRef, orderBy("createdAt", "asc"));

      onSnapshot(commentsQuery, async (commentSnapshot) => {
        const commentsListDiv = document.getElementById(`comments-${threadId}`);
        if (!commentsListDiv) return;

        commentsListDiv.innerHTML = '';
        if (commentSnapshot.empty) {
          commentsListDiv.innerHTML = '<p class="text-gray-400">No comments yet.</p>';
        }

        const commentAuthorUidsToFetch = new Set();
        commentSnapshot.forEach(commentDoc => {
          commentAuthorUidsToFetch.add(commentDoc.data().authorId);
        });

        const fetchedCommentAuthorProfiles = new Map();
        for (const uid of commentAuthorUidsToFetch) {
          const profile = await getUserProfileFromFirestore(uid);
          if (profile) {
            fetchedCommentAuthorProfiles.set(uid, profile);
            userHandleCache[uid] = profile.handle;
            handleUidCache[profile.handle] = uid;
          }
        }

        for (const commentDoc of commentSnapshot.docs) {
          const comment = commentDoc.data();
          const commentId = commentDoc.id;
          const commentAuthorProfile = fetchedCommentAuthorProfiles.get(comment.authorId) || {};
          const commentAuthorDisplayName = commentAuthorProfile.displayName || comment.authorDisplayName || 'Anonymous User';
          const commentAuthorHandle = commentAuthorProfile.handle || comment.authorHandle || 'N/A';
          const commentAuthorPhotoURL = commentAuthorProfile.photoURL || comment.authorPhotoURL || DEFAULT_PROFILE_PIC;

          const parsedCommentContent = await parseMentions(parseEmojis(comment.content));

          const commentElement = document.createElement('div');
          commentElement.className = 'bg-gray-800 p-4 rounded-md shadow-sm';
          commentElement.innerHTML = `
            <div class="flex items-center mb-2">
              <img src="${commentAuthorPhotoURL}" alt="Profile" class="w-8 h-8 rounded-full mr-2 object-cover">
              <div>
                <p class="font-semibold text-gray-200">${commentAuthorDisplayName} <span class="text-gray-400 text-xs">(@${commentAuthorHandle})</span></p>
                <p class="text-xs text-gray-500">${comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleString() : 'N/A'}</p>
              </div>
            </div>
            <p class="text-gray-300 mb-2">${parsedCommentContent}</p>
            <div class="flex items-center text-gray-400 text-xs">
                <div id="comment-reactions-${commentId}" class="flex flex-wrap items-center">
                    <!-- Comment reaction buttons will be rendered here -->
                </div>
                ${currentUser && (currentUser.uid === comment.authorId || currentUser.uid === thread.authorId) ? `
                    <button class="delete-comment-btn text-red-400 hover:text-red-500 ml-auto transition duration-300" data-thread-id="${threadId}" data-comment-id="${commentId}">
                        <i class="fas fa-trash-alt"></i> Delete
                    </button>
                ` : ''}
            </div>
          `;
          commentsListDiv.appendChild(commentElement);

          const commentReactionsContainer = document.getElementById(`comment-reactions-${commentId}`);
          renderReactionButtons('comment', threadId, comment.reactions || {}, commentReactionsContainer, commentId);
        }

        const postCommentBtn = threadElement.querySelector(`.post-comment-btn[data-thread-id="${threadId}"]`);
        if (postCommentBtn) {
          postCommentBtn.removeEventListener('click', handlePostComment);
          postCommentBtn.addEventListener('click', handlePostComment);
        }
        const emojiPalette = threadElement.querySelector('.emoji-palette');
        if (emojiPalette) {
          emojiPalette.removeEventListener('click', handleEmojiPaletteClick);
          emojiPalette.addEventListener('click', handleEmojiPaletteClick);
        }
      }, (commentError) => {
        console.error(`Error fetching comments for thread ${threadId}:`, commentError);
        const commentsListDiv = document.getElementById(`comments-${threadId}`);
        if (commentsListDiv) {
          commentsListDiv.innerHTML = `<p class="text-red-500">Error loading comments.</p>`;
        }
      });

      const deleteThreadBtn = threadElement.querySelector(`.delete-thread-btn[data-id="${threadId}"]`);
      if (deleteThreadBtn) {
        deleteThreadBtn.removeEventListener('click', handleDeleteThread);
        deleteThreadBtn.addEventListener('click', handleDeleteThread);
      }
    }

    threadsList.removeEventListener('click', handleCommentAction);
    threadsList.addEventListener('click', handleCommentAction);
  }, (error) => {
    console.error("Error fetching real-time threads:", error);
    threadsLoadingError.textContent = `Failed to load threads: ${error.message || 'Unknown error'}`;
    threadsLoadingError.style.display = 'block';
    noThreadsMessage.style.display = 'none';
  });
}

/**
 * Renders the direct messages in real-time.
 * This function now manages the conversation list in the left panel.
 */
function renderDirectMessages() {
  // Unsubscribe from other listeners if active
  if (unsubscribeForum) {
    unsubscribeForum();
    unsubscribeForum = null;
  }
  if (unsubscribeAnnouncements) {
    unsubscribeAnnouncements();
    unsubscribeAnnouncements = null;
  }

  // Also unsubscribe from current messages listener if switching away from DMs
  if (unsubscribeCurrentMessages) {
    unsubscribeCurrentMessages();
    unsubscribeCurrentMessages = null;
  }

  if (!db || !conversationsList || !currentUser) {
    console.warn("Firestore DB, conversationsList, or currentUser not ready for DM rendering.");
    if (conversationsList) conversationsList.innerHTML = '<p class="text-gray-400 text-center">Please log in to view conversations.</p>';
    if (noConversationsMessage) noConversationsMessage.style.display = 'none';
    updateDmUiForNoConversationSelected(); // Clear right panel if no user or DB not ready
    return;
  }

  // Initial state for DM UI: show conversations panel
  conversationsPanel.classList.remove('hidden');
  messagesPanel.classList.add('hidden'); // Ensure messages panel is hidden

  updateDmUiForNoConversationSelected(); // Ensures right panel is clear initially
  populateUserHandlesDatalist(); // Populate the datalist with user handles
  renderConversationsList(); // Start listening for conversations
}

/**
 * Renders the announcements in real-time.
 */
function renderAnnouncements() {
  // Unsubscribe from other listeners if active
  if (unsubscribeForum) {
    unsubscribeForum();
    unsubscribeForum = null;
  }
  if (unsubscribeConversationsList) { // Use new name
    unsubscribeConversationsList();
    unsubscribeConversationsList = null;
  }
  if (unsubscribeCurrentMessages) { // Important for DM tab
    unsubscribeCurrentMessages();
    unsubscribeCurrentMessages = null;
  }

  if (!db || !announcementsList) {
    console.error("Firestore DB or announcementsList element not ready for announcement rendering.");
    return;
  }

  // Show/hide admin announcement form
  if (currentUser && currentUser.isAdmin && createAnnouncementSection) {
    createAnnouncementSection.classList.remove('hidden');
  } else if (createAnnouncementSection) {
    createAnnouncementSection.classList.add('hidden');
  }

  const announcementsCol = collection(db, `artifacts/${appId}/public/data/announcements`);
  const q = query(announcementsCol, orderBy("createdAt", "desc"));

  // Attach new listener for announcements
  unsubscribeAnnouncements = onSnapshot(q, async (snapshot) => {
    announcementsList.innerHTML = '';
    if (snapshot.empty) {
      noAnnouncementsMessage.style.display = 'block';
    } else {
      noAnnouncementsMessage.style.display = 'none';
    }

    const profilesToFetch = new Set();
    snapshot.forEach(doc => profilesToFetch.add(doc.data().authorId));

    const fetchedProfiles = new Map();
    for (const uid of profilesToFetch) {
      const profile = await getUserProfileFromFirestore(uid);
      if (profile) {
        fetchedProfiles.set(uid, profile);
        userHandleCache[uid] = profile.handle;
        handleUidCache[profile.handle] = uid;
      }
    }

    for (const docSnapshot of snapshot.docs) {
      const announcement = docSnapshot.data();
      const announcementId = docSnapshot.id;
      const authorProfile = fetchedProfiles.get(announcement.authorId) || {};
      const authorDisplayName = authorProfile.displayName || announcement.authorDisplayName || 'Admin';
      const authorHandle = authorProfile.handle || announcement.authorHandle || 'N/A';
      const authorPhotoURL = authorProfile.photoURL || announcement.authorPhotoURL || DEFAULT_PROFILE_PIC;

      const announcementElement = document.createElement('div');
      announcementElement.className = 'bg-gray-800 p-4 rounded-lg shadow-md mb-4';
      announcementElement.innerHTML = `
        <div class="flex items-center mb-2">
          <img src="${authorPhotoURL}" alt="Admin" class="w-8 h-8 rounded-full mr-3 object-cover">
          <div>
            <p class="font-semibold text-gray-200">${authorDisplayName} <span class="text-gray-400 text-xs">(@${authorHandle})</span></p>
            <p class="text-xs text-gray-500">${announcement.createdAt ? new Date(announcement.createdAt.toDate()).toLocaleString() : 'N/A'}</p>
          </div>
        </div>
        <p class="text-gray-300 mb-2">${await parseMentions(parseEmojis(announcement.content))}</p>
        ${currentUser && currentUser.isAdmin ? `<button class="delete-announcement-btn text-red-400 hover:text-red-500 float-right transition duration-300" data-id="${announcementId}">
            <i class="fas fa-trash-alt"></i> Delete
        </button>` : ''}
      `;
      announcementsList.appendChild(announcementElement);
    }

    // Attach event listener for delete announcement buttons
    announcementsList.querySelectorAll('.delete-announcement-btn').forEach(button => {
      button.removeEventListener('click', handleDeleteAnnouncement); // Prevent duplicates
      button.addEventListener('click', handleDeleteAnnouncement);
    });
  }, (error) => {
    console.error("Error fetching announcements:", error);
    if (announcementsList) announcementsList.innerHTML = `<p class="text-red-500 text-center">Error loading announcements: ${error.message}</p>`;
    if (noAnnouncementsMessage) noAnnouncementsMessage.style.display = 'none';
  });

  // Attach event listener for creating announcements (admin only)
  if (createAnnouncementForm) {
    createAnnouncementForm.removeEventListener('submit', handlePostAnnouncement); // Prevent duplicates
    createAnnouncementForm.addEventListener('submit', handlePostAnnouncement);
  }
}

// --- EVENT HANDLERS ---

async function handlePostComment(event) {
  event.preventDefault(); // Prevent page reload
  const threadId = event.target.dataset.threadId;
  const commentInput = document.getElementById(`comment-input-${threadId}`);
  const commentContent = commentInput.value;
  await addCommentToThread(threadId, commentContent);
  commentInput.value = '';
}

async function handleDeleteThread(event) {
  event.preventDefault(); // Prevent page reload
  const threadId = event.target.dataset.id;
  await deleteThread(threadId);
}

function handleCommentAction(event) {
  if (event.target.classList.contains('delete-comment-btn') || event.target.closest('.delete-comment-btn')) {
    const button = event.target.closest('.delete-comment-btn');
    const threadId = button.dataset.threadId;
    const commentId = button.dataset.commentId;
    deleteComment(threadId, commentId);
  }
}

function handleEmojiPaletteClick(event) {
  const emojiItem = event.target.closest('.emoji-item');
  if (emojiItem) {
    const emoji = emojiItem.dataset.emoji;
    const threadElement = emojiItem.closest('.bg-gray-700');
    const threadId = threadElement.id.replace('thread-', '');
    const commentInput = document.getElementById(`comment-input-${threadId}`);
    if (commentInput) {
      const start = commentInput.selectionStart;
      const end = commentInput.selectionEnd;
      commentInput.value = commentInput.value.substring(0, start) + emoji + commentInput.value.substring(end);
      commentInput.setSelectionRange(start + emoji.length, start + emoji.length);
      commentInput.focus();
    }
  }
}

async function handleCreateConversation(event) {
  event.preventDefault();
  const chatType = newChatTypeSelect.value;
  let participantHandles = [];
  let groupName = '';

  if (chatType === 'private') {
    const recipientHandle = privateChatRecipientInput.value.trim();
    if (recipientHandle) {
      participantHandles.push(recipientHandle);
    }
  } else { // 'group'
    groupName = groupChatNameInput.value.trim();
    const handlesText = groupChatParticipantsInput.value.trim();
    if (handlesText) {
      participantHandles = handlesText.split(',').map(h => h.trim());
    }
  }
  await createConversation(chatType, participantHandles, groupName);
}

async function handleSendMessage(event) {
  event.preventDefault();
  const content = messageContentInput.value.trim();
  if (!content) {
    showMessageBox("Message cannot be empty.", true);
    return;
  }
  await sendMessage(content);
}

async function handleDeleteMessage(event) {
  event.preventDefault();
  const messageId = event.target.dataset.messageId || event.target.closest('.delete-message-btn').dataset.messageId;
  if (selectedConversationId && messageId) {
    await deleteMessage(messageId);
  } else {
    console.error("No selected conversation or message ID for deletion.");
    showMessageBox("Could not delete message. No active conversation or message selected.", true);
  }
}

async function handleDeleteConversationClick(event) {
  event.preventDefault();
  const convId = event.target.dataset.conversationId;
  if (convId) {
    await deleteConversation(convId);
  }
}

async function handlePostAnnouncement(event) {
  event.preventDefault();
  const content = announcementContentInput.value.trim();
  if (!content) {
    showMessageBox("Please enter announcement content.", true);
    return;
  }
  await postAnnouncement(content);
}

async function handleDeleteAnnouncement(event) {
  event.preventDefault();
  const announcementId = event.target.dataset.id;
  await deleteAnnouncement(announcementId);
}

// --- TAB SWITCHING LOGIC ---

let currentActiveTab = 'forum'; // Default active tab

function showTab(tabId) {
  // Deactivate all tab buttons and hide all content sections
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active-tab');
    button.classList.remove('border-blue-500', 'text-blue-300');
    button.classList.add('border-transparent', 'text-gray-300');
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden'); // This is Tailwind's display: none
  });

  // Activate the selected tab button and show its content section
  const selectedButton = document.getElementById(`tab-${tabId}`);
  const selectedContent = document.getElementById(`content-${tabId}`);

  if (selectedButton && selectedContent) {
    selectedButton.classList.add('active-tab');
    selectedButton.classList.add('border-blue-500', 'text-blue-300');
    selectedButton.classList.remove('border-transparent', 'text-gray-300');
    selectedContent.classList.remove('hidden'); // This is where it should remove 'hidden'
    currentActiveTab = tabId; // Update active tab state

    // Render content for the newly active tab
    switch (tabId) {
      case 'forum':
        renderForumThreads();
        break;
      case 'dms':
        renderDirectMessages();
        break;
      case 'announcements':
        renderAnnouncements();
        break;
    }
  }
}

// --- INITIALIZATION Function ---
/**
 * Initializes Firebase, sets up authentication, and retrieves/creates the user profile with a unique handle.
 * This function consolidates the repetitive Firebase initialization logic.
 * @returns {Promise<void>} Resolves when Firebase is ready and currentUser is set.
 */
async function setupFirebaseAndUser() {
  return new Promise((resolve) => {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      isFirebaseInitialized = true;
      console.log("Firebase initialized successfully.");

      setupThemesFirebase(db, auth, appId);

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log("onAuthStateChanged triggered. User:", user ? user.uid : "none");
        unsubscribe(); // Unsubscribe after the first state change to avoid multiple calls on subsequent updates.

        if (user) {
          currentUser = user;
          let userProfile = await getUserProfileFromFirestore(currentUser.uid);

          if (!userProfile) {
            // For new authenticated users without a profile
            const initialHandle = currentUser.email?.split('@')[0] || `user${currentUser.uid.substring(0, 5)}`;
            const generatedHandle = await generateUniqueHandle(currentUser.uid, initialHandle);
            userProfile = {
              displayName: currentUser.displayName || initialHandle,
              photoURL: currentUser.photoURL,
              handle: generatedHandle,
              themePreference: DEFAULT_THEME_NAME,
              fontSizePreference: '16px',
              fontFamilyPreference: 'Inter, sans-serif',
              backgroundPatternPreference: 'none',
              notificationPreferences: { email: false, inApp: false },
              accessibilitySettings: { highContrast: false, reducedMotion: false },
              createdAt: serverTimestamp(),
            };
            await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), userProfile, { merge: true });
            console.log("New user profile created with handle:", generatedHandle);
          } else if (!userProfile.handle) {
            // For existing profiles missing a handle
            const initialHandle = userProfile.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || `user${currentUser.uid.substring(0, 5)}`;
            const generatedHandle = await generateUniqueHandle(currentUser.uid, initialHandle);
            userProfile.handle = generatedHandle;
            userProfile.displayName = userProfile.displayName || currentUser.displayName || initialHandle;
            await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), { handle: generatedHandle, displayName: userProfile.displayName }, { merge: true });
            console.log("Handle generated and added to existing profile:", generatedHandle);
          } else {
            // If profile exists and has a handle, ensure displayName and photoURL are consistent
            userProfile.displayName = userProfile.displayName || currentUser.displayName || (userProfile.handle.startsWith('anon') ? `Anon ${currentUser.uid.substring(0,5)}` : userProfile.handle);
            userProfile.photoURL = userProfile.photoURL || currentUser.photoURL || DEFAULT_PROFILE_PIC;
          }

          // Always update currentUser object with the latest profile details (from fetched or newly created)
          currentUser.displayName = userProfile.displayName;
          currentUser.photoURL = userProfile.photoURL;
          currentUser.handle = userProfile.handle;
          currentUser.isAdmin = ADMIN_UIDS.includes(currentUser.uid); // Set admin status

          userHandleCache[currentUser.uid] = currentUser.handle;
          handleUidCache[currentUser.handle] = currentUser.uid;

          resolve();
        } else {
          // Anonymous sign-in path
          if (typeof __initial_auth_token !== 'undefined') {
            signInWithCustomToken(auth, __initial_auth_token)
              .then(async (userCredential) => {
                currentUser = userCredential.user;
                console.log("DEBUG: Signed in with custom token from Canvas (forms page).");
                let userProfile = await getUserProfileFromFirestore(currentUser.uid);
                if (!userProfile || !userProfile.handle) {
                  const generatedHandle = await generateUniqueHandle(currentUser.uid, `anon${currentUser.uid.substring(0, 5)}`);
                  if (!userProfile) userProfile = {};
                  userProfile.handle = generatedHandle;
                  userProfile.displayName = `Anon ${currentUser.uid.substring(0, 5)}`;
                  userProfile.photoURL = DEFAULT_PROFILE_PIC;
                  userProfile.themePreference = userProfile.themePreference || DEFAULT_THEME_NAME;
                  userProfile.fontSizePreference = userProfile.fontSizePreference || '16px';
                  userProfile.fontFamilyPreference = userProfile.fontFamilyPreference || 'Inter, sans-serif';
                  userProfile.backgroundPatternPreference = userProfile.backgroundPatternPreference || 'none';
                  userProfile.notificationPreferences = userProfile.notificationPreferences || { email: false, inApp: false };
                  userProfile.accessibilitySettings = userProfile.accessibilitySettings || { highContrast: false, reducedMotion: false };
                  await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), userProfile, { merge: true });
                }
                // Ensure currentUser object is updated with profile info
                currentUser.displayName = userProfile.displayName;
                currentUser.photoURL = userProfile.photoURL;
                currentUser.handle = userProfile.handle;
                currentUser.isAdmin = ADMIN_UIDS.includes(currentUser.uid);

                userHandleCache[currentUser.uid] = currentUser.handle;
                handleUidCache[currentUser.handle] = currentUser.uid;

                resolve();
              })
              .catch((error) => {
                console.error("ERROR: Error signing in with custom token (forms page):", error);
                signInAnonymously(auth)
                  .then(async (userCredential) => {
                    currentUser = userCredential.user;
                    console.log("DEBUG: Signed in anonymously (forms page) after custom token failure.");
                    const generatedHandle = await generateUniqueHandle(currentUser.uid, `anon${currentUser.uid.substring(0, 5)}`);
                    await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), {
                      handle: generatedHandle,
                      displayName: `Anon ${currentUser.uid.substring(0, 5)}`,
                      photoURL: DEFAULT_PROFILE_PIC,
                      themePreference: DEFAULT_THEME_NAME,
                      fontSizePreference: '16px',
                      fontFamilyPreference: 'Inter, sans-serif',
                      backgroundPatternPreference: 'none',
                      notificationPreferences: { email: false, inApp: false },
                      accessibilitySettings: { highContrast: false, reducedMotion: false },
                      createdAt: serverTimestamp()
                    }, { merge: true });
                    currentUser.displayName = `Anon ${currentUser.uid.substring(0, 5)}`;
                    currentUser.photoURL = DEFAULT_PROFILE_PIC;
                    currentUser.handle = generatedHandle;
                    currentUser.isAdmin = ADMIN_UIDS.includes(currentUser.uid);

                    userHandleCache[currentUser.uid] = currentUser.handle;
                    handleUidCache[currentUser.handle] = currentUser.uid;
                    resolve();
                  })
                  .catch((anonError) => {
                    console.error("ERROR: Error signing in anonymously on forms page:", anonError);
                    showMessageBox("Error during anonymous sign-in.", true);
                    resolve();
                  });
              });
          } else {
            signInAnonymously(auth)
              .then(async (userCredential) => {
                currentUser = userCredential.user;
                console.log("DEBUG: Signed in anonymously (no custom token) on forms page.");
                const generatedHandle = await generateUniqueHandle(currentUser.uid, `anon${currentUser.uid.substring(0, 5)}`);
                await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), {
                  handle: generatedHandle,
                  displayName: `Anon ${currentUser.uid.substring(0, 5)}`,
                  photoURL: DEFAULT_PROFILE_PIC,
                  themePreference: DEFAULT_THEME_NAME,
                  fontSizePreference: '16px',
                  fontFamilyPreference: 'Inter, sans-serif',
                  backgroundPatternPreference: 'none',
                  notificationPreferences: { email: false, inApp: false },
                  accessibilitySettings: { highContrast: false, reducedMotion: false },
                  createdAt: serverTimestamp()
                }, { merge: true });
                currentUser.displayName = `Anon ${currentUser.uid.substring(0, 5)}`;
                currentUser.photoURL = DEFAULT_PROFILE_PIC;
                currentUser.handle = generatedHandle;
                currentUser.isAdmin = ADMIN_UIDS.includes(currentUser.uid);

                userHandleCache[currentUser.uid] = currentUser.handle;
                handleUidCache[currentUser.handle] = currentUser.uid;
                resolve();
              })
              .catch((anonError) => {
                console.error("ERROR: Error signing in anonymously on forms page:", anonError);
                showMessageBox("Error during anonymous sign-in.", true);
                resolve();
              });
          }
        }
      });
    } catch (e) {
      console.error("Error initializing Firebase (initial block):", e);
      showMessageBox("Error initializing Firebase. Cannot proceed.", true);
      resolve();
    }
  });
}


// Main execution logic that runs once the window is loaded.
window.onload = async function() {
  if (customConfirmModal) {
    customConfirmModal.style.display = 'none';
  }

  await setupFirebaseAndUser();

  // Corrected loadNavbar call: it no longer expects applyThemeFunc or getAvailableThemesFunc
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Apply the user's saved theme preference. This block now assumes `currentUser` is fully populated.
  // Re-fetch user profile to ensure the latest theme preference is used, as it might have been set during initial sign-up
  const userProfileForTheme = await getUserProfileFromFirestore(currentUser.uid);
  const userThemePreference = userProfileForTheme?.themePreference;
  const allThemes = await getAvailableThemes();
  const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
  applyTheme(themeToApply.id, themeToApply);

  // --- Initial Tab Setup and Event Listeners for Tabs ---
  if (tabForum) tabForum.addEventListener('click', () => showTab('forum'));
  if (tabDMs) tabDMs.addEventListener('click', () => showTab('dms'));
  if (tabAnnouncements) tabAnnouncements.addEventListener('click', () => showTab('announcements'));

  // Event listeners for DM creation form type change
  if (newChatTypeSelect) {
    newChatTypeSelect.addEventListener('change', (event) => {
      if (event.target.value === 'private') {
        privateChatFields.classList.remove('hidden');
        groupChatFields.classList.add('hidden');
      } else {
        privateChatFields.classList.add('hidden');
        groupChatFields.classList.remove('hidden');
      }
    });
  }

  // Event listener for conversation sorting select
  if (sortConversationsBySelect) {
    sortConversationsBySelect.addEventListener('change', (event) => {
      currentSortOption = event.target.value;
      renderConversationsList(); // Re-render with new sort order
    });
  }

  // Show the default tab on load
  showTab(currentActiveTab); // This will call renderForumThreads initially.

  // --- Attach Forum-specific Form Listener ---
  if (createThreadForm) {
    createThreadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = threadTitleInput.value.trim();
      const content = threadContentInput.value.trim();

      if (!title || !content) {
        showMessageBox("Please enter both title and content for your thread.", true);
        return;
      }
      await createThread(title, content);
    });
  }

  // --- Attach DM-specific Form Listeners ---
  if (createConversationForm) {
    createConversationForm.addEventListener('submit', handleCreateConversation);
  }
  if (sendMessageForm) {
    sendMessageForm.addEventListener('submit', handleSendMessage);
  }
  if (deleteConversationBtn) {
    deleteConversationBtn.addEventListener('click', handleDeleteConversationClick);
  }
  if (backToChatsBtn) { // New back button listener
    backToChatsBtn.addEventListener('click', updateDmUiForNoConversationSelected);
  }
  // No need for separate handleDeleteMessage listener here, it's attached inside renderConversationMessages

  // --- Attach Announcement-specific Form Listener ---
  if (createAnnouncementForm) {
    createAnnouncementForm.addEventListener('submit', handlePostAnnouncement);
  }

  // Set the current year in the footer.
  document.getElementById('current-year-forms').textContent = new Date().getFullYear();
};
