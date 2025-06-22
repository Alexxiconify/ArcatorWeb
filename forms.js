import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js'; // Unminified themes.js
import { loadNavbar } from './navbar.js'; // Unminified navbar.js

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app",
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM"
};

const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : null;
const appId = canvasAppId || firebaseConfig.projectId || 'default-app-id';

let app;
let auth;
let db;
let firebaseReadyPromise;
let isFirebaseInitialized = false;
let currentUser = null; // Store current user object with updated profile info

const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark';

// DOM Elements
const threadsList = document.getElementById('threads-list');
const createThreadForm = document.getElementById('create-thread-form');
const threadTitleInput = document.getElementById('thread-title');
const threadContentInput = document.getElementById('thread-content');
const threadsLoadingError = document.getElementById('threads-loading-error');
const noThreadsMessage = document.getElementById('no-threads-message');

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
// userHandleCache will store UID -> handle mapping
let userHandleCache = {};
// handleUidCache will store handle -> UID mapping for quick lookups during mention parsing
let handleUidCache = {};

/**
 * Sanitizes a string to be suitable for a handle.
 * Removes non-alphanumeric characters (except underscore, dot, hyphen) and converts to lowercase.
 * @param {string} input - The string to sanitize.
 * @returns {string} The sanitized handle.
 */
function sanitizeHandle(input) {
  return input.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}

/**
 * Generates a unique handle for a user and saves it to their profile.
 * This is crucial for both new authenticated and anonymous users.
 * @param {string} uid - The user's UID.
 * @param {string} initialSuggestion - A suggested handle (e.g., from displayName or email).
 * @returns {Promise<string>} The generated unique handle.
 */
async function generateUniqueHandle(uid, initialSuggestion) {
  let baseHandle = sanitizeHandle(initialSuggestion || 'anonuser');
  if (baseHandle.length === 0) { // Fallback if initial suggestion becomes empty after sanitization
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

  // Save the generated handle to the user's profile
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  await setDoc(userDocRef, { handle: handle }, { merge: true });

  console.log(`Generated and saved unique handle for ${uid}: ${handle}`);
  return handle;
}


// Function to replace emoji shortcodes with actual emojis
function parseEmojis(text) {
  let parsedText = text;
  for (const shortcode in EMOJI_MAP) {
    const emoji = EMOJI_MAP[shortcode];
    parsedText = parsedText.split(shortcode).join(emoji);
  }
  return parsedText;
}

// Function to parse mentions and make them clickable
async function parseMentions(text) {
  let parsedText = text;
  // Regex to find @ followed by alphanumeric, underscore, dot, hyphen
  const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
  let match;
  const mentionsToResolve = new Map(); // Map to store handle -> UID, to avoid redundant lookups

  // First pass: Find all unique handles mentioned in the text
  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionedHandle = match[1];
    if (!mentionsToResolve.has(mentionedHandle)) {
      mentionsToResolve.set(mentionedHandle, null); // Placeholder for UID
    }
  }

  // Second pass: Resolve handles to UIDs using cache or Firestore
  for (const [mentionedHandle, _] of mentionsToResolve) {
    let resolvedUid = handleUidCache[mentionedHandle]; // Check local cache first

    if (!resolvedUid) {
      // If not in cache, query Firestore for the handle
      const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
      const q = query(userProfilesRef, where("handle", "==", mentionedHandle));
      try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          querySnapshot.forEach(docSnap => {
            resolvedUid = docSnap.id;
            userHandleCache[resolvedUid] = mentionedHandle; // Update UID->handle cache
            handleUidCache[mentionedHandle] = resolvedUid; // Update handle->UID cache
          });
        }
      } catch (error) {
        console.error("Error resolving mentioned handle from Firestore:", error);
      }
    }
    mentionsToResolve.set(mentionedHandle, resolvedUid); // Store the resolved UID
  }

  // Third pass: Replace mentions in the text with clickable links
  // Use a replacer function with string.replace to handle all matches
  parsedText = text.replace(mentionRegex, (fullMatch, mentionedHandle) => {
    const resolvedUid = mentionsToResolve.get(mentionedHandle);
    if (resolvedUid) {
      return `<a href="settings.html?uid=${resolvedUid}" class="text-blue-400 hover:underline">@${mentionedHandle}</a>`;
    } else {
      return fullMatch; // If handle not found, keep original text
    }
  });

  return parsedText;
}


// --- UTILITY FUNCTIONS ---

/**
 * Displays a custom message box for user feedback.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True for error, false for success.
 */
window.showMessageBox = function(message, isError) {
  if (!messageBox) {
    console.error("MessageBox element not found. Message:", message);
    return;
  }
  messageBox.textContent = message;
  messageBox.className = 'message-box'; // Reset classes
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
 * Shows a custom confirmation modal.
 * @param {string} message - The main confirmation message.
 * @param {string} [subMessage=''] - An optional sub-message.
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled.
 */
function showCustomConfirm(message, subMessage = '') {
  return new Promise(resolve => {
    confirmMessage.textContent = message;
    confirmSubmessage.textContent = subMessage;
    customConfirmModal.style.display = 'flex'; // Use flex to center

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
 * Fetches user profile data from Firestore.
 * @param {string} uid - The user's UID.
 * @returns {Promise<Object|null>} - User profile data or null if not found.
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
    // showMessageBox(`Error fetching user profile: ${error.message}`, true); // Don't show modal for every profile fetch
  }
  return null;
}

// --- THREAD FUNCTIONS ---

/**
 * Creates a new forum thread.
 * @param {string} title - The title of the thread.
 * @param {string} content - The content of the thread.
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
    authorHandle: currentUser.handle, // Use the unique handle here
    authorDisplayName: currentUser.displayName || currentUser.handle, // Display name or fallback to handle
    authorPhotoURL: currentUser.photoURL || DEFAULT_PROFILE_PIC,
    createdAt: serverTimestamp(),
    reactions: {}, // Store reactions as a map: { emoji: { userId1: true, userId2: true } }
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
 * Deletes a forum thread.
 * @param {string} threadId - The ID of the thread to delete.
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
    "This will also delete all comments and reactions associated with it."
  );
  if (!confirmation) {
    showMessageBox("Thread deletion cancelled.", false);
    return;
  }

  const threadDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
  try {
    // Delete comments subcollection first (Firestore does not cascade delete subcollections automatically)
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
 * Adds a comment to a specific thread.
 * @param {string} threadId - The ID of the thread.
 * @param {string} content - The content of the comment.
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
    authorHandle: currentUser.handle, // Use the unique handle here
    authorDisplayName: currentUser.displayName || currentUser.handle, // Display name or fallback to handle
    authorPhotoURL: currentUser.photoURL || DEFAULT_PROFILE_PIC,
    createdAt: serverTimestamp(),
    reactions: {}, // Initialize reactions for comments too
  };

  try {
    await addDoc(commentsCol, commentData);
    // Increment commentCount on the parent thread
    const threadRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
    await updateDoc(threadRef, {
      commentCount: (await getDoc(threadRef)).data().commentCount + 1 || 1
    });
    showMessageBox("Comment added successfully!", false);
  } catch (error) {
    console.error("Error adding comment:", error);
    showMessageBox(`Error adding comment: ${error.message}`, true);
  }
}

/**
 * Deletes a comment from a thread.
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
    // Decrement commentCount on the parent thread
    const threadRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
    await updateDoc(threadRef, {
      commentCount: (await getDoc(threadRef)).data().commentCount - 1 || 0 // Ensure it doesn't go below 0
    });
    showMessageBox("Comment deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting comment:", error);
    showMessageBox(`Error deleting comment: ${error.message}`, true);
  }
}

// --- REACTION FUNCTIONS ---

/**
 * Handles adding/removing reactions to a thread or comment.
 * @param {'thread'|'comment'} type - The type of item being reacted to.
 * @param {string} itemId - The ID of the thread or comment.
 * @param {string} [commentId=null] - The ID of the comment if type is 'comment'.
 * @param {string} emoji - The emoji string to react with.
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
      // User has already reacted with this emoji, so remove it
      delete newEmojiUsers[userUid];
      showMessageBox(`Removed ${emoji} reaction.`, false);
    } else {
      // User has not reacted with this emoji, so add it
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
 * Renders the emoji reaction buttons for a given item.
 * @param {string} type - 'thread' or 'comment'.
 * @param {string} itemId - ID of the thread or comment.
 * @param {Object} reactions - The reactions object from Firestore.
 * @param {HTMLElement} containerElement - The DOM element to append buttons to.
 * @param {string} [commentId=null] - Optional: comment ID if type is 'comment'.
 */
function renderReactionButtons(type, itemId, reactions, containerElement, commentId = null) {
  containerElement.innerHTML = ''; // Clear existing buttons

  // Add the predefined common emojis
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

  // Add any custom emojis already used in reactions that are not in COMMON_EMOJIS
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
 * Sets up real-time listeners for forum threads and comments.
 */
function setupRealtimeListeners() {
  if (!db) {
    console.error("Firestore DB not initialized. Cannot set up real-time listeners.");
    return;
  }

  const threadsCol = collection(db, `artifacts/${appId}/public/data/forum_threads`);
  const q = query(threadsCol, orderBy("createdAt", "desc")); // Order by creation time

  onSnapshot(q, async (snapshot) => {
    threadsList.innerHTML = ''; // Clear list to re-render
    if (snapshot.empty) {
      noThreadsMessage.style.display = 'block';
      threadsLoadingError.style.display = 'none';
      return;
    } else {
      noThreadsMessage.style.display = 'none';
      threadsLoadingError.style.display = 'none';
    }

    // Prepare a map to store profile fetches for threads and comments
    const profilesToFetch = new Set();
    snapshot.forEach(threadDoc => {
      const thread = threadDoc.data();
      profilesToFetch.add(thread.authorId);
      // Also collect comment author IDs for batch fetching
      const commentsColRef = collection(db, `artifacts/${appId}/public/data/forum_threads/${threadDoc.id}/comments`);
      getDocs(commentsColRef).then(commentSnapshot => {
        commentSnapshot.forEach(commentDoc => {
          profilesToFetch.add(commentDoc.data().authorId);
        });
      }).catch(e => console.error("Error fetching comments for profile collection:", e));
    });

    // Fetch all unique profiles needed for this snapshot
    const fetchedProfiles = new Map(); // uid -> profileData
    for (const uid of profilesToFetch) {
      const profile = await getUserProfileFromFirestore(uid);
      if (profile) {
        fetchedProfiles.set(uid, profile);
        userHandleCache[uid] = profile.handle; // Populate UID->handle cache
        handleUidCache[profile.handle] = uid; // Populate handle->UID cache
      }
    }


    for (const threadDoc of snapshot.docs) { // Use snapshot.docs for direct iteration
      const thread = threadDoc.data();
      const threadId = threadDoc.id;
      const authorProfile = fetchedProfiles.get(thread.authorId) || {};
      // Use authorHandle if available, else authorDisplayName (from old data) or 'Anonymous'
      const authorToDisplay = authorProfile.handle || thread.authorHandle || thread.authorDisplayName || 'Anonymous';
      const authorPhotoURL = authorProfile.photoURL || thread.authorPhotoURL || DEFAULT_PROFILE_PIC;

      const threadElement = document.createElement('div');
      threadElement.id = `thread-${threadId}`;
      threadElement.className = 'bg-gray-700 p-6 rounded-lg shadow-md mb-8';

      // Parse emojis and mentions in content before display
      // Ensure parseMentions is awaited as it now performs Firestore lookups
      const parsedContent = await parseMentions(parseEmojis(thread.content));

      threadElement.innerHTML = `
        <div class="flex items-center mb-4">
          <img src="${authorPhotoURL}" alt="Profile" class="w-10 h-10 rounded-full mr-3 object-cover">
          <div>
            <p class="font-semibold text-gray-200">@${authorToDisplay}</p>
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

      // Render initial reactions for the thread
      const threadReactionsContainer = document.getElementById(`thread-reactions-${threadId}`);
      renderReactionButtons('thread', threadId, thread.reactions || {}, threadReactionsContainer);

      // Set up comments listener for this thread
      const commentsColRef = collection(db, `artifacts/${appId}/public/data/forum_threads/${threadId}/comments`);
      const commentsQuery = query(commentsColRef, orderBy("createdAt", "asc"));

      onSnapshot(commentsQuery, async (commentSnapshot) => {
        const commentsListDiv = document.getElementById(`comments-${threadId}`);
        commentsListDiv.innerHTML = ''; // Clear comments to re-render
        if (commentSnapshot.empty) {
          commentsListDiv.innerHTML = '<p class="text-gray-400">No comments yet.</p>';
        }

        for (const commentDoc of commentSnapshot.docs) {
          const comment = commentDoc.data();
          const commentId = commentDoc.id;
          const commentAuthorProfile = fetchedProfiles.get(comment.authorId) || {};
          // Use authorHandle if available, else authorDisplayName (from old data) or 'Anonymous'
          const commentAuthorToDisplay = commentAuthorProfile.handle || comment.authorHandle || comment.authorDisplayName || 'Anonymous';
          const commentAuthorPhotoURL = commentAuthorProfile.photoURL || comment.authorPhotoURL || DEFAULT_PROFILE_PIC;


          // Parse emojis and mentions in comment content before display
          const parsedCommentContent = await parseMentions(parseEmojis(comment.content));

          const commentElement = document.createElement('div');
          commentElement.className = 'bg-gray-800 p-4 rounded-md shadow-sm';
          commentElement.innerHTML = `
            <div class="flex items-center mb-2">
              <img src="${commentAuthorPhotoURL}" alt="Profile" class="w-8 h-8 rounded-full mr-2 object-cover">
              <div>
                <p class="font-semibold text-gray-200">@${commentAuthorToDisplay}</p>
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

          // Render reactions for the comment
          const commentReactionsContainer = document.getElementById(`comment-reactions-${commentId}`);
          renderReactionButtons('comment', threadId, comment.reactions || {}, commentReactionsContainer, commentId);
        }

        // Add event listener for the comment button after it's been added to DOM
        const postCommentBtn = threadElement.querySelector(`.post-comment-btn[data-thread-id="${threadId}"]`);
        if (postCommentBtn) {
          postCommentBtn.removeEventListener('click', handlePostComment); // Prevent duplicate listeners
          postCommentBtn.addEventListener('click', handlePostComment);
        }
        // Add event listener for emoji palette
        const emojiPalette = threadElement.querySelector('.emoji-palette');
        if (emojiPalette) {
          emojiPalette.removeEventListener('click', handleEmojiPaletteClick); // Prevent duplicate listeners
          emojiPalette.addEventListener('click', handleEmojiPaletteClick);
        }
      }, (commentError) => {
        console.error(`Error fetching comments for thread ${threadId}:`, commentError);
        const commentsListDiv = document.getElementById(`comments-${threadId}`);
        commentsListDiv.innerHTML = `<p class="text-red-500">Error loading comments.</p>`;
      });

      // Add event listener for delete thread button (outside comments listener to ensure it's always attached once per thread)
      const deleteThreadBtn = threadElement.querySelector(`.delete-thread-btn[data-id="${threadId}"]`);
      if (deleteThreadBtn) {
        deleteThreadBtn.removeEventListener('click', handleDeleteThread); // Prevent duplicate listeners
        deleteThreadBtn.addEventListener('click', handleDeleteThread);
      }
    });

    // Delegate comment delete button handling to the threadsList (more efficient for dynamic elements)
    threadsList.removeEventListener('click', handleCommentAction); // Remove old listener
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
  commentInput.value = ''; // Clear input after posting
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

// --- INITIALIZATION ---

firebaseReadyPromise = new Promise((resolve) => {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseInitialized = true;
    console.log("Firebase initialized successfully.");

    // Pass Firebase instances to themes.js
    setupThemesFirebase(db, auth, appId);

    // Ensure user authentication state is known before proceeding with Firestore operations
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("onAuthStateChanged triggered. User:", user ? user.uid : "none");
      unsubscribe(); // Unsubscribe immediately after the first state change

      if (user) {
        currentUser = user;
        // Fetch or create user profile, ensuring a handle exists
        let userProfile = await getUserProfileFromFirestore(currentUser.uid);

        if (!userProfile) {
          // New user or profile doesn't exist, create one
          const initialHandle = currentUser.displayName || currentUser.email?.split('@')[0] || `user${currentUser.uid.substring(0, 5)}`;
          const generatedHandle = await generateUniqueHandle(currentUser.uid, initialHandle);
          userProfile = {
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            handle: generatedHandle,
            createdAt: serverTimestamp(),
            // Add other default profile fields if necessary
          };
          await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), userProfile, { merge: true });
          console.log("New user profile created with handle:", generatedHandle);
        } else if (!userProfile.handle) {
          // Existing profile but no handle, generate one
          const initialHandle = userProfile.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || `user${currentUser.uid.substring(0, 5)}`;
          const generatedHandle = await generateUniqueHandle(currentUser.uid, initialHandle);
          userProfile.handle = generatedHandle;
          await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), { handle: generatedHandle }, { merge: true });
          console.log("Handle generated and added to existing profile:", generatedHandle);
        }

        // Update currentUser object with the handle and photoURL from profile
        currentUser.displayName = userProfile.displayName || currentUser.displayName; // Keep display name for other parts of the app
        currentUser.photoURL = userProfile.photoURL || currentUser.photoURL;
        currentUser.handle = userProfile.handle;

        // Populate caches
        userHandleCache[currentUser.uid] = currentUser.handle;
        handleUidCache[currentUser.handle] = currentUser.uid;

        resolve();

      } else { // No authenticated user
        if (typeof __initial_auth_token !== 'undefined') {
          // If Canvas provides a token and no user is signed in, try custom token sign-in
          signInWithCustomToken(auth, __initial_auth_token)
            .then(async (userCredential) => {
              currentUser = userCredential.user;
              console.log("DEBUG: Signed in with custom token from Canvas (forms page).");
              // Check/generate handle for this user
              let userProfile = await getUserProfileFromFirestore(currentUser.uid);
              if (!userProfile || !userProfile.handle) {
                const initialHandle = currentUser.displayName || currentUser.email?.split('@')[0] || `user${currentUser.uid.substring(0, 5)}`;
                const generatedHandle = await generateUniqueHandle(currentUser.uid, initialHandle);
                if (!userProfile) userProfile = {}; // Initialize if not fetched
                userProfile.handle = generatedHandle;
                userProfile.displayName = userProfile.displayName || currentUser.displayName;
                userProfile.photoURL = userProfile.photoURL || currentUser.photoURL;
                await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), userProfile, { merge: true });
              }
              currentUser.displayName = userProfile.displayName;
              currentUser.photoURL = userProfile.photoURL;
              currentUser.handle = userProfile.handle;

              userHandleCache[currentUser.uid] = currentUser.handle;
              handleUidCache[currentUser.handle] = currentUser.uid;

              resolve();
            })
            .catch((error) => {
              console.error("ERROR: Error signing in with custom token (forms page):", error);
              signInAnonymously(auth) // Fallback to anonymous sign-in
                .then(async (userCredential) => {
                  currentUser = userCredential.user;
                  console.log("DEBUG: Signed in anonymously (forms page) after custom token failure.");
                  // Generate handle for anonymous user
                  const generatedHandle = await generateUniqueHandle(currentUser.uid, `anon${currentUser.uid.substring(0, 5)}`);
                  await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), { handle: generatedHandle, displayName: `Anon ${currentUser.uid.substring(0, 5)}`, photoURL: DEFAULT_PROFILE_PIC, createdAt: serverTimestamp() }, { merge: true });
                  currentUser.displayName = `Anon ${currentUser.uid.substring(0, 5)}`;
                  currentUser.photoURL = DEFAULT_PROFILE_PIC;
                  currentUser.handle = generatedHandle;

                  userHandleCache[currentUser.uid] = currentUser.handle;
                  handleUidCache[currentUser.handle] = currentUser.uid;
                  resolve();
                })
                .catch((anonError) => {
                  console.error("ERROR: Error signing in anonymously on forms page:", anonError);
                  resolve(); // Resolve even on error to prevent infinite loading
                });
            });
        } else {
          // No Canvas token and no user, sign in anonymously
          signInAnonymously(auth)
            .then(async (userCredential) => {
              currentUser = userCredential.user;
              console.log("DEBUG: Signed in anonymously (no custom token) on forms page.");
              // Generate handle for anonymous user
              const generatedHandle = await generateUniqueHandle(currentUser.uid, `anon${currentUser.uid.substring(0, 5)}`);
              await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), { handle: generatedHandle, displayName: `Anon ${currentUser.uid.substring(0, 5)}`, photoURL: DEFAULT_PROFILE_PIC, createdAt: serverTimestamp() }, { merge: true });
              currentUser.displayName = `Anon ${currentUser.uid.substring(0, 5)}`;
              currentUser.photoURL = DEFAULT_PROFILE_PIC;
              currentUser.handle = generatedHandle;

              userHandleCache[currentUser.uid] = currentUser.handle;
              handleUidCache[currentUser.handle] = currentUser.uid;
              resolve();
            })
            .catch((anonError) => {
              console.error("ERROR: Error signing in anonymously on forms page:", anonError);
              resolve(); // Resolve even on error
            });
        }
      }
    });
  } catch (e) {
    console.error("Error initializing Firebase (initial block):", e);
    showMessageBox("Error initializing Firebase. Cannot proceed.", true);
    resolve(); // Resolve immediately on error to prevent infinite loading
  }
});

// Main execution logic on window load
window.onload = async function() {
  // Explicitly hide the custom confirmation modal on page load
  if (customConfirmModal) {
    customConfirmModal.style.display = 'none';
  }

  await firebaseReadyPromise; // Wait for Firebase init and auth state to be known

  // Load navbar
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // After everything is loaded and Firebase is ready, apply the user's theme
  let userThemePreference = null;
  if (currentUser) {
    const userProfile = await getUserProfileFromFirestore(currentUser.uid);
    userThemePreference = userProfile?.themePreference;
  }
  const allThemes = await getAvailableThemes();
  const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
  applyTheme(themeToApply.id, themeToApply);


  // Attach form submit listener
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

  // Get current year for footer
  document.getElementById('current-year-forms').textContent = new Date().getFullYear();

  // Setup real-time listeners for threads and comments after initialization
  setupRealtimeListeners();
};
