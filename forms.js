/* global __app_id */ // Explicitly declare __app_id as a global for linters

// forms.js: This script handles forum thread and comment functionality,
// including real-time updates, reactions, emoji parsing, and user mentions.

// Debug log to check if the script starts executing.
console.log("forms.js - Script parsing initiated.");

// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
/** @global {object|null} currentUser - Stores the current user object, including custom profile data like 'handle'. */
let currentUser = null;
/** @global {boolean} isFirebaseInitialized - Flag indicating if Firebase has been initialized. */
let isFirebaseInitialized = false;

// --- Default Values ---
const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark';

// --- DOM Elements ---
/** @global {HTMLElement} threadsList - The container for forum threads. */
const threadsList = document.getElementById('threads-list');
/** @global {HTMLFormElement} createThreadForm - The form for creating new threads. */
const createThreadForm = document.getElementById('create-thread-form');
/** @global {HTMLInputElement} threadTitleInput - Input field for thread title. */
const threadTitleInput = document.getElementById('thread-title');
/** @global {HTMLTextAreaElement} threadContentInput - Textarea for thread content. */
const threadContentInput = document.getElementById('thread-content');
/** @global {HTMLElement} threadsLoadingError - Element to display thread loading errors. */
const threadsLoadingError = document.getElementById('threads-loading-error');
/** @global {HTMLElement} noThreadsMessage - Element to display when no threads are found. */
const noThreadsMessage = document.getElementById('no-threads-message');

/** @global {HTMLElement} messageBox - Custom message display box. */
const messageBox = document.getElementById('message-box');
/** @global {HTMLElement} customConfirmModal - Custom confirmation modal. */
const customConfirmModal = document.getElementById('custom-confirm-modal');
/** @global {HTMLElement} confirmMessage - Element for the main confirmation message. */
const confirmMessage = document.getElementById('confirm-message');
/** @global {HTMLElement} confirmSubmessage - Element for the sub-message in confirmation modal. */
const confirmSubmessage = document.getElementById('confirm-submessage');
/** @global {HTMLButtonElement} confirmYesBtn - 'Yes' button in confirmation modal. */
const confirmYesBtn = document.getElementById('confirm-yes');
/** @global {HTMLButtonElement} confirmNoBtn - 'No' button in confirmation modal. */
const confirmNoBtn = document.getElementById('confirm-no');

// --- EMOJI & MENTION CONFIGURATION ---
/** @global {string[]} COMMON_EMOJIS - Array of commonly used emojis. */
const COMMON_EMOJIS = ['👍', '👎', '😂', '❤️', '🔥', '🎉', '💡', '🤔'];
/** @global {object} EMOJI_MAP - Mapping of shortcodes to emoji characters. */
const EMOJI_MAP = {
  ':smile:': '😄', ':laugh:': '😆', ':love:': '❤️', ':thumbsup:': '👍',
  ':thumbsdown:': '👎', ':fire:': '🔥', ':party:': '🎉', ':bulb:': '�',
  ':thinking:': '🤔', ':star:': '⭐', ':rocket:': '🚀', ':clap:': '👏',
  ':cry:': '😢', ':sleepy:': '😴'
};
/** @global {object} userHandleCache - Cache for UID -> handle mapping. */
let userHandleCache = {};
/** @global {object} handleUidCache - Cache for handle -> UID mapping. */
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
    baseHandle = 'user'; // Fallback if initial suggestion becomes empty.
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
  let processedText;
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

// --- THREAD FUNCTIONS ---

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
    authorDisplayName: currentUser.displayName, // Ensure this uses the populated currentUser.displayName
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

// --- COMMENT FUNCTIONS ---

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
    authorDisplayName: currentUser.displayName, // Ensure this uses the populated currentUser.displayName
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

// --- REAL-TIME RENDERING (ONSNAPSHOT) ---

/**
 * Sets up real-time listeners for the main forum threads and their nested comments.
 * This function uses Firestore's `onSnapshot` to get real-time updates and re-render the UI.
 */
function setupRealtimeListeners() {
  if (!db) {
    console.error("Firestore DB not initialized. Cannot set up real-time listeners.");
    return;
  }

  const threadsCol = collection(db, `artifacts/${appId}/public/data/forum_threads`);
  const q = query(threadsCol, orderBy("createdAt", "desc"));

  onSnapshot(q, async (snapshot) => {
    threadsList.innerHTML = '';
    if (snapshot.empty) {
      noThreadsMessage.style.display = 'block';
      threadsLoadingError.style.display = 'none';
      return;
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
      // Use authorProfile.displayName if available, otherwise fallback.
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
          // Use commentAuthorProfile.displayName if available, otherwise fallback.
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
        commentsListDiv.innerHTML = `<p class="text-red-500">Error loading comments.</p>`;
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

// --- EVENT HANDLERS ---

async function handlePostComment(event) {
  const threadId = event.target.dataset.threadId;
  const commentInput = document.getElementById(`comment-input-${threadId}`);
  const commentContent = commentInput.value;
  await addCommentToThread(threadId, commentContent);
  commentInput.value = '';
}

async function handleDeleteThread(event) {
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
        unsubscribe();

        if (user) {
          currentUser = user;
          let userProfile = await getUserProfileFromFirestore(currentUser.uid);

          if (!userProfile) {
            // For new authenticated users without a profile
            const initialHandle = currentUser.email?.split('@')[0] || `user${currentUser.uid.substring(0, 5)}`;
            const generatedHandle = await generateUniqueHandle(currentUser.uid, initialHandle);
            userProfile = {
              displayName: currentUser.displayName || initialHandle, // Use provided display name or derived from email/UID
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
            // Ensure displayName is retained or defaulted if missing
            userProfile.displayName = userProfile.displayName || currentUser.displayName || initialHandle;
            await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), { handle: generatedHandle, displayName: userProfile.displayName }, { merge: true });
            console.log("Handle generated and added to existing profile:", generatedHandle);
          } else {
            // If profile exists and has a handle, ensure displayName and photoURL are set for currentUser
            userProfile.displayName = userProfile.displayName || currentUser.displayName || (userProfile.handle.startsWith('anon') ? `Anon ${currentUser.uid.substring(0,5)}` : userProfile.handle);
            userProfile.photoURL = userProfile.photoURL || currentUser.photoURL || DEFAULT_PROFILE_PIC;
            // No need to setDoc again if no changes to profile data, but ensure currentUser object is updated.
          }

          // Always update currentUser object with the latest profile details (from fetched or newly created)
          currentUser.displayName = userProfile.displayName;
          currentUser.photoURL = userProfile.photoURL;
          currentUser.handle = userProfile.handle;

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
                  userProfile.displayName = `Anon ${currentUser.uid.substring(0, 5)}`; // Explicit display name for anon
                  userProfile.photoURL = DEFAULT_PROFILE_PIC; // Default photo for anon
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
                      displayName: `Anon ${currentUser.uid.substring(0, 5)}`, // Explicit display name for anon
                      photoURL: DEFAULT_PROFILE_PIC,
                      themePreference: DEFAULT_THEME_NAME,
                      fontSizePreference: '16px',
                      fontFamilyPreference: 'Inter, sans-serif',
                      backgroundPatternPreference: 'none',
                      notificationPreferences: { email: false, inApp: false },
                      accessibilitySettings: { highContrast: false, reducedMotion: false },
                      createdAt: serverTimestamp()
                    }, { merge: true });
                    // Ensure currentUser object is updated with profile info
                    currentUser.displayName = `Anon ${currentUser.uid.substring(0, 5)}`;
                    currentUser.photoURL = DEFAULT_PROFILE_PIC;
                    currentUser.handle = generatedHandle;

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
                  displayName: `Anon ${currentUser.uid.substring(0, 5)}`, // Explicit display name for anon
                  photoURL: DEFAULT_PROFILE_PIC,
                  themePreference: DEFAULT_THEME_NAME,
                  fontSizePreference: '16px',
                  fontFamilyPreference: 'Inter, sans-serif',
                  backgroundPatternPreference: 'none',
                  notificationPreferences: { email: false, inApp: false },
                  accessibilitySettings: { highContrast: false, reducedMotion: false },
                  createdAt: serverTimestamp()
                }, { merge: true });
                // Ensure currentUser object is updated with profile info
                currentUser.displayName = `Anon ${currentUser.uid.substring(0, 5)}`;
                currentUser.photoURL = DEFAULT_PROFILE_PIC;
                currentUser.handle = generatedHandle;

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

  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Apply the user's saved theme preference. This block now assumes `currentUser` is fully populated.
  const userProfileForTheme = await getUserProfileFromFirestore(currentUser.uid); // Re-fetch to ensure latest profile data including theme
  const userThemePreference = userProfileForTheme?.themePreference;
  const allThemes = await getAvailableThemes();
  const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
  applyTheme(themeToApply.id, themeToApply);

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

  document.getElementById('current-year-forms').textContent = new Date().getFullYear();

  setupRealtimeListeners();
};
