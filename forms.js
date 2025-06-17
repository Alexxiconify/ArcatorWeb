import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js'; // Import loadNavbar
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app", // Corrected storageBucket value
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM"
};

// Ensure global __app_id and __initial_auth_token are accessible
const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : null;
const canvasInitialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Determine appId for Firestore path - prioritize Canvas provided, then project ID
const appId = canvasAppId || firebaseConfig.projectId || 'default-app-id';
const initialAuthToken = canvasInitialAuthToken;

// Initialize Firebase
let app;
let auth;
let db;
let currentUser = null; // To store the current authenticated user
let isAdminUser = false; // Flag to track if the current user is an admin
let firebaseReadyPromise; // Promise to ensure Firebase is fully initialized and authenticated

firebaseReadyPromise = new Promise((resolve) => {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase initialized successfully.");
    setupThemesFirebase(db, auth, appId); // Initialize themes.js with Firebase instances

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("onAuthStateChanged triggered during initialization. User:", user ? user.uid : "none");
      unsubscribe(); // Unsubscribe after the first call

      if (typeof __initial_auth_token !== 'undefined' && !user) {
        signInWithCustomToken(auth, __initial_auth_token)
          .then(() => console.log("DEBUG: Signed in with custom token from Canvas (forms page) during init."))
          .catch((error) => {
            console.error("ERROR: Error signing in with custom token (forms page) during init:", error);
            signInAnonymously(auth)
              .then(() => console.log("DEBUG: Signed in anonymously (forms page) after custom token failure during init."))
              .catch((anonError) => console.error("ERROR: Error signing in anonymously on forms page during init:", anonError));
          })
          .finally(() => resolve());
      } else if (!user && typeof __initial_auth_token === 'undefined') {
        signInAnonymously(auth)
          .then(() => console.log("DEBUG: Signed in anonymously (no custom token) on forms page during init."))
          .catch((anonError) => console.error("ERROR: Error signing in anonymously on forms page during init:", anonError))
          .finally(() => resolve());
      } else {
        resolve();
      }
    });
  } catch (e) {
    console.error("Error initializing Firebase:", e);
    document.getElementById('threads-loading-error').textContent = 'Error initializing Firebase. Cannot load or create threads.';
    document.getElementById('threads-loading-error').style.display = 'block';
    resolve(); // Resolve even on error to prevent infinite loading
  }
});


// DOM Elements
const loadingSpinner = document.getElementById('loading-spinner');
const loginRequiredMessage = document.getElementById('login-required-message');
const newThreadSection = document.getElementById('new-thread-section');
const createThreadForm = document.getElementById('create-thread-form');
const threadTitleInput = document.getElementById('thread-title');
const threadContentTextarea = document.getElementById('thread-content');
const formMessage = document.getElementById('form-message');
const threadsContainer = document.getElementById('threads-container');
const noThreadsMessage = document.getElementById('no-threads-message');
const threadsLoadingError = document.getElementById('threads-loading-error');

// Confirmation Modal Elements
const confirmationModal = document.getElementById('confirmation-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const confirmActionButton = document.getElementById('confirm-action-btn');
const cancelActionButton = document.getElementById('cancel-action-btn');

// Edit Modal Elements
const editModal = document.getElementById('edit-modal');
const modalEditTitle = document.getElementById('modal-edit-title');
const editTitleLabel = document.getElementById('edit-title-label');
const editModalTitleInput = document.getElementById('edit-title-input');
const editModalContentTextarea = document.getElementById('edit-content-textarea');
const saveEditBtn = document.getElementById('save-edit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

let pendingAction = null; // Stores the function to call after modal confirmation
let currentEditingDocRef = null; // Stores the docRef for the item being edited
let currentEditingType = null; // 'thread' or 'comment'


// Default profile picture (generic placeholder)
const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
// Default theme (dark) for styling application
const DEFAULT_THEME = 'dark';

// Cache for user profiles to avoid repeated Firestore reads
const userProfileCache = {};

/**
 * Checks if the current user is an admin.
 * @param {string} uid - The user ID.
 * @returns {Promise<boolean>}
 */
async function checkAdminStatus(uid) {
  await firebaseReadyPromise;
  if (!db || !uid) return false;
  const adminDocRef = doc(db, `artifacts/${appId}/public/data/whitelisted_admins`, uid);
  try {
    const docSnap = await getDoc(adminDocRef);
    return docSnap.exists();
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Shows the custom confirmation modal.
 * @param {string} title - The title of the modal.
 * @param {string} message - The message to display.
 * @param {Function} actionFunction - The function to call if confirmed.
 */
function showConfirmationModal(title, message, actionFunction) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  pendingAction = actionFunction;
  confirmationModal.style.display = 'flex'; // Use flex to center
}

// Handle modal confirmation
confirmActionButton.addEventListener('click', async () => {
  confirmationModal.style.display = 'none';
  if (pendingAction) {
    await pendingAction();
  }
  pendingAction = null;
});

// Handle modal cancellation
cancelActionButton.addEventListener('click', () => {
  confirmationModal.style.display = 'none';
  pendingAction = null;
});


/**
 * Opens the edit modal for a thread or comment.
 * @param {'thread'|'comment'} type - The type of item being edited.
 * @param {string} threadId - The ID of the parent thread.
 * @param {string} docId - The ID of the thread or comment document.
 * @param {string} [initialTitle=''] - The initial title for threads.
 * @param {string} initialContent - The initial content.
 */
function openEditModal(type, threadId, docId, initialTitle = '', initialContent) {
  modalEditTitle.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  editModalTitleInput.style.display = 'none'; // Hide by default
  editTitleLabel.style.display = 'none'; // Hide label by default

  if (type === 'thread') {
    editModalTitleInput.style.display = 'block'; // Show for threads
    editTitleLabel.style.display = 'block'; // Show label for threads
    editModalTitleInput.value = initialTitle;
    currentEditingDocRef = doc(db, `artifacts/${appId}/public/data/discussion_threads`, docId);
  } else if (type === 'comment') {
    editModalTitleInput.style.display = 'none'; // No title for comments
    editTitleLabel.style.display = 'none'; // No label for comments
    currentEditingDocRef = doc(db, `artifacts/${appId}/public/data/discussion_threads`, threadId, 'comments', docId);
  }
  editModalContentTextarea.value = initialContent;
  editModal.style.display = 'flex';
  currentEditingType = type;
}

/**
 * Saves the edited content of a thread or comment to Firestore.
 */
async function saveEdit() {
  if (!currentEditingDocRef || !currentUser) {
    console.error("No document selected for editing or user not logged in.");
    showFormMessage("Error: No item selected for editing or not logged in.", true);
    return;
  }

  const newContent = editModalContentTextarea.value.trim();
  if (!newContent) {
    showFormMessage("Content cannot be empty.", true);
    return;
  }

  let updateData = {
    content: newContent,
    editedAt: serverTimestamp() // Add edited timestamp
  };

  if (currentEditingType === 'thread') {
    const newTitle = editModalTitleInput.value.trim();
    if (!newTitle) {
      showFormMessage("Thread title cannot be empty.", true);
      return;
    }
    updateData.title = newTitle;
  }

  try {
    await updateDoc(currentEditingDocRef, updateData);
    showFormMessage(`${currentEditingType.charAt(0).toUpperCase() + currentEditingType.slice(1)} updated successfully!`, false);
  } catch (error) {
    console.error(`Error updating ${currentEditingType}:`, error);
    showFormMessage(`Error updating ${currentEditingType}: ${error.message || 'Unknown error'}`, true);
  } finally {
    editModal.style.display = 'none';
    currentEditingDocRef = null;
    currentEditingType = null;
  }
}

// Handle edit modal save
if (saveEditBtn) {
  saveEditBtn.addEventListener('click', saveEdit);
}

// Handle edit modal cancel
if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', () => {
    editModal.style.display = 'none';
    currentEditingDocRef = null;
    currentEditingType = null;
  });
}


/**
 * Fetches user profile data from Firestore.
 * @param {string} uid - The user's UID.
 * @returns {Promise<Object|null>} - User profile data or null if not found.
 */
async function getUserProfile(uid) {
  if (userProfileCache[uid]) {
    return userProfileCache[uid];
  }
  await firebaseReadyPromise; // Ensure Firebase is initialized
  if (!db) {
    console.warn("Firestore not initialized, cannot fetch user profile.");
    return null;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      userProfileCache[uid] = docSnap.data();
      return userProfileCache[uid];
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
  }
  return null;
}

/**
 * Displays a message for the form (success/error).
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if it's an error, false for success.
 */
function showFormMessage(message, isError) {
  formMessage.textContent = message;
  formMessage.style.display = 'block';
  formMessage.classList.remove('text-green-400', 'text-red-500');
  if (isError) {
    formMessage.classList.add('text-red-500');
  } else {
    formMessage.classList.add('text-green-400');
  }
  setTimeout(() => {
    formMessage.style.display = 'none';
  }, 5000);
}

/**
 * Renders content (thread or comment), embedding images and videos.
 * @param {string} rawContent - The raw content string.
 * @returns {string} - HTML string with embedded media.
 */
function renderContentWithMedia(rawContent) {
  // Regex for common image file extensions
  const imageRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))(?:\s|$)/gi;
  // Regex for common video file extensions
  const videoRegex = /(https?:\/\/[^\s]+\.(?:mp4|webm|ogg))(?:\s|$)/gi;

  let processedContent = rawContent;

  // Replace video URLs with <video> tags
  processedContent = processedContent.replace(videoRegex, (match, url) => {
    return `<div class="media-container"><video controls class="w-full rounded-md" src="${url}"><source src="${url}" type="video/${url.split('.').pop()}">Your browser does not support the video tag.</video></div>`;
  });

  // Replace image URLs with <img> tags
  processedContent = processedContent.replace(imageRegex, (match, url) => {
    // Add onerror to display a placeholder if the image fails to load
    return `<div class="media-container"><img class="w-full rounded-md" src="${url}" alt="Embedded Image" onerror="this.onerror=null;this.src='https://placehold.co/400x200/cccccc/000000?text=Image+Load+Error';"></div>`;
  });

  // Convert remaining newlines to <br> for basic paragraph breaks
  processedContent = processedContent.replace(/\n/g, '<br>');

  // Basic link detection for any remaining URLs that weren't caught by media regex
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  processedContent = processedContent.replace(urlRegex, (match) => {
    return `<a href="${match}" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });

  return processedContent;
}


// Set up Firebase Authentication listener
if (auth) {
  onAuthStateChanged(auth, async (user) => {
    loadingSpinner.style.display = 'none'; // Hide initial spinner

    if (user) {
      currentUser = user;
      isAdminUser = await checkAdminStatus(user.uid); // Check admin status on login
      loginRequiredMessage.style.display = 'none';
      newThreadSection.style.display = 'block';
      console.log("User is logged in:", user.uid, user.displayName || user.email, "Is Admin:", isAdminUser);

      // Apply user's saved theme
      const userProfile = await getUserProfile(user.uid);
      const themePreference = userProfile?.themePreference || DEFAULT_THEME;
      const allThemes = await getAvailableThemes();
      const themeToApply = allThemes.find(t => t.id === themePreference) || allThemes.find(t => t.id === DEFAULT_THEME);
      applyTheme(themeToApply.id, themeToApply);

    } else {
      currentUser = null;
      isAdminUser = false; // Reset admin status
      loginRequiredMessage.style.display = 'block';
      newThreadSection.style.display = 'none';
      console.log("User is logged out.");
      const allThemes = await getAvailableThemes();
      const defaultThemeObj = allThemes.find(t => t.id === DEFAULT_THEME);
      applyTheme(defaultThemeObj.id, defaultThemeObj); // Apply default theme if no user
    }
  });
}

// Handle new thread creation
if (createThreadForm && db) {
  createThreadForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!currentUser) {
      showFormMessage("You must be logged in to create a thread.", true);
      return;
    }

    const title = threadTitleInput.value.trim();
    const content = threadContentTextarea.value.trim();

    if (!title || !content) {
      showFormMessage("Thread title and content cannot be empty.", true);
      return;
    }

    // Fetch the latest profile data from Firestore for the current user
    const userProfile = await getUserProfile(currentUser.uid);
    const authorName = userProfile?.displayName || currentUser.displayName || currentUser.email || 'Anonymous User';
    const authorPhotoURL = userProfile?.photoURL || currentUser.photoURL || DEFAULT_PROFILE_PIC; // Prioritize Firestore profile

    try {
      await addDoc(collection(db, `artifacts/${appId}/public/data/discussion_threads`), {
        title: title,
        content: content,
        authorUid: currentUser.uid,
        authorName: authorName,
        authorPhotoURL: authorPhotoURL,
        timestamp: serverTimestamp(),
        upvoters: [], // Initialize empty array for upvoters
        downvoters: [] // Initialize empty array for downvoters
      });
      showFormMessage("Thread created successfully!", false);
      threadTitleInput.value = '';
      threadContentTextarea.value = '';
    } catch (error) {
      console.error("Error adding thread:", error);
      showFormMessage(`Error creating thread: ${error.message || 'Unknown error'}`, true);
    }
  });
}

/**
 * Deletes a thread from Firestore.
 * @param {string} threadId - The ID of the thread to delete.
 */
async function deleteThread(threadId) {
  if (!currentUser) {
    showFormMessage("You must be logged in to delete threads.", true);
    return;
  }
  try {
    // Security rules will prevent deletion if not author or admin
    await deleteDoc(doc(db, `artifacts/${appId}/public/data/discussion_threads`, threadId));
    console.log("Thread deleted successfully:", threadId);
    showFormMessage("Thread deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting thread:", error);
    showFormMessage(`Error deleting thread: ${error.message || 'Unknown error'}`, true);
  }
}

/**
 * Adds a new comment to a specific thread.
 * @param {string} threadId - The ID of the thread to comment on.
 * @param {string} commentContent - The content of the comment.
 */
async function addCommentToThread(threadId, commentContent) {
  if (!currentUser) {
    showFormMessage("You must be logged in to post a comment.", true);
    return;
  }
  if (!commentContent.trim()) {
    showFormMessage("Comment cannot be empty.", true);
    return;
  }

  // Fetch the latest profile data from Firestore for the current user
  const userProfile = await getUserProfile(currentUser.uid);
  const authorName = userProfile?.displayName || currentUser.displayName || currentUser.email || 'Anonymous User';
  const authorPhotoURL = userProfile?.photoURL || currentUser.photoURL || DEFAULT_PROFILE_PIC; // Prioritize Firestore profile

  try {
    await addDoc(collection(db, `artifacts/${appId}/public/data/discussion_threads`, threadId, 'comments'), {
      content: commentContent,
      authorUid: currentUser.uid,
      authorName: authorName,
      authorPhotoURL: authorPhotoURL,
      timestamp: serverTimestamp(),
      upvoters: [], // Initialize empty array for upvoters
      downvoters: [] // Initialize empty array for downvoters
    });
    console.log("Comment added successfully to thread:", threadId);
  } catch (error) {
    console.error("Error adding comment:", error);
    showFormMessage(`Error posting comment: ${error.message || 'Unknown error'}`, true);
  }
}

/**
 * Deletes a comment from Firestore.
 * @param {string} threadId - The ID of the parent thread.
 * @param {string} commentId - The ID of the comment to delete.
 */
async function deleteComment(threadId, commentId) {
  if (!currentUser) {
    showFormMessage("You must be logged in to delete comments.", true);
    return;
  }
  try {
    // Security rules will prevent deletion if not author or admin
    await deleteDoc(doc(db, `artifacts/${appId}/public/data/discussion_threads`, threadId, 'comments', commentId));
    console.log("Comment deleted successfully:", commentId);
    showFormMessage("Comment deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting comment:", error);
    showFormMessage(`Error deleting comment: ${error.message || 'Unknown error'}`, true);
  }
}

/**
 * Deletes a user's profile from Firestore.
 * This does NOT delete the Firebase Authentication account.
 * @param {string} uidToDelete - The UID of the user whose profile to delete.
 * @param {string} displayName - The display name of the user being deleted.
 */
async function deleteUserProfile(uidToDelete, displayName) {
  if (!currentUser || !isAdminUser) {
    showFormMessage("You must be an admin to delete user profiles.", true);
    return;
  }
  if (currentUser.uid === uidToDelete) {
    showFormMessage("You cannot delete your own profile through this interface.", true);
    return;
  }

  try {
    await deleteDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uidToDelete));
    console.log(`User profile for ${displayName} (UID: ${uidToDelete}) deleted successfully.`);
    showFormMessage(`User profile for ${displayName} deleted successfully!`, false);
    // Invalidate cache for this user
    delete userProfileCache[uidToDelete];
  } catch (error) {
    console.error(`Error deleting user profile for ${displayName} (UID: ${uidToDelete}):`, error);
    showFormMessage(`Error deleting profile for ${displayName}: ${error.message || 'Unknown error'}`, true);
  }
}


/**
 * Handles upvoting or downvoting a thread or comment.
 * @param {string} parentType - 'thread' or 'comment'.
 * @param {string} parentId - ID of the thread.
 * @param {string|null} childId - ID of the comment (if parentType is 'comment').
 * @param {'up'|'down'} voteType - 'up' for upvote, 'down' for downvote.
 */
async function handleVote(parentType, parentId, childId, voteType) {
  if (!currentUser) {
    showFormMessage("You must be logged in to vote.", true);
    return;
  }

  let docRef;
  if (parentType === 'thread') {
    docRef = doc(db, `artifacts/${appId}/public/data/discussion_threads`, parentId);
  } else if (parentType === 'comment') {
    docRef = doc(db, `artifacts/${appId}/public/data/discussion_threads`, parentId, 'comments', childId);
  } else {
    console.error("Invalid parentType for voting:", parentType);
    return;
  }

  const userId = currentUser.uid;

  try {
    // Fetch the current document state to prevent race conditions for array updates
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.error("Document not found for voting.");
      showFormMessage("Item not found. Cannot vote.", true);
      return;
    }
    const data = docSnap.data();
    let currentUpvoters = data.upvoters || [];
    let currentDownvoters = data.downvoters || [];

    let updateData = {};

    if (voteType === 'up') {
      if (currentUpvoters.includes(userId)) {
        // User already upvoted, remove their upvote (toggle off)
        updateData = { upvoters: arrayRemove(userId) };
      } else {
        // User upvoting, remove downvote if exists, then add upvote
        updateData = {
          upvoters: arrayUnion(userId),
          downvoters: arrayRemove(userId)
        };
      }
    } else if (voteType === 'down') {
      if (currentDownvoters.includes(userId)) {
        // User already downvoted, remove their downvote (toggle off)
        updateData = { downvoters: arrayRemove(userId) };
      } else {
        // User downvoting, remove upvote if exists, then add downvote
        updateData = {
          downvoters: arrayUnion(userId),
          upvoters: arrayRemove(userId)
        };
      }
    }

    await updateDoc(docRef, updateData);
    console.log(`Vote (${voteType}) cast successfully on ${parentType} ${parentId}`);
    // The onSnapshot listener will handle UI update
  } catch (error) {
    console.error(`Error casting vote on ${parentType} ${parentId}:`, error);
    showFormMessage(`Error voting: ${error.message || 'Unknown error'}`, true);
  }
}


// Listen for real-time updates to discussion threads
if (db) {
  const q = query(collection(db, `artifacts/${appId}/public/data/discussion_threads`), orderBy("timestamp", "desc"));

  onSnapshot(q, async (snapshot) => { // Made callback async to await getUserProfile
    threadsContainer.innerHTML = ''; // Clear existing threads
    if (snapshot.empty) {
      noThreadsMessage.style.display = 'block';
      threadsLoadingError.style.display = 'none';
    } else {
      noThreadsMessage.style.display = 'none';
      threadsLoadingError.style.display = 'none';
      // Process threads in parallel to fetch user profiles
      for (const threadDoc of snapshot.docs) {
        const thread = threadDoc.data();
        const threadId = threadDoc.id;
        const threadTimestamp = thread.timestamp ? new Date(thread.timestamp.toDate()).toLocaleString() : 'Just now';

        // Fetch author profile
        const authorProfile = await getUserProfile(thread.authorUid);
        const authorName = authorProfile?.displayName || thread.authorName || 'Anonymous User';
        const authorPhotoURL = authorProfile?.photoURL || thread.authorPhotoURL || DEFAULT_PROFILE_PIC;

        const upvotes = (thread.upvoters || []).length;
        const downvotes = (thread.downvoters || []).length;

        // Check if current user has upvoted/downvoted this thread
        const userHasUpvotedThread = currentUser && (thread.upvoters || []).includes(currentUser.uid);
        const userHasDownvotedThread = currentUser && (thread.downvoters || []).includes(currentUser.uid);

        const threadElement = document.createElement('div');
        threadElement.classList.add('thread-card');
        threadElement.innerHTML = `
          <div class="flex justify-between items-center mb-2">
              <div class="profile-info flex items-center">
                  <img src="${authorPhotoURL}" alt="${authorName}'s profile picture" class="profile-pic w-8 h-8 rounded-full mr-2" onerror="this.onerror=null;this.src='${DEFAULT_PROFILE_PIC}';">
                  <p class="font-semibold text-gray-200">${authorName}</p>
                  ${isAdminUser && currentUser.uid !== thread.authorUid ? `<button data-user-uid="${thread.authorUid}" data-display-name="${authorName}" class="delete-user-profile-btn text-red-400 hover:text-red-600 text-sm focus:outline-none ml-2"><i class="fas fa-user-minus"></i> Delete Profile</button>` : ''}
              </div>
              <div>
                  ${(currentUser && currentUser.uid === thread.authorUid) || isAdminUser ? `<button data-thread-id="${threadId}" data-title="${thread.title}" data-content="${encodeURIComponent(thread.content)}" class="edit-thread-btn text-blue-400 hover:text-blue-600 focus:outline-none mr-2"><i class="fas fa-edit"></i> Edit</button>` : ''}
                  ${(currentUser && currentUser.uid === thread.authorUid) || isAdminUser ? `<button data-thread-id="${threadId}" class="delete-thread-btn text-red-400 hover:text-red-600 focus:outline-none"><i class="fas fa-trash-alt"></i></button>` : ''}
              </div>
          </div>
          <h3 class="text-2xl font-bold text-red-300 mb-2">${thread.title}</h3>
          <p class="text-gray-400 text-sm mb-4">Posted on ${threadTimestamp}
              ${thread.editedAt ? `<span class="italic ml-2">(Edited on ${new Date(thread.editedAt.toDate()).toLocaleString()})</span>` : ''}
          </p>
          <div class="thread-content text-gray-200 mb-4">
              ${renderContentWithMedia(thread.content)}
          </div>
          <div class="flex items-center space-x-4 mb-4">
              <div class="vote-buttons flex items-center">
                  <button class="upvote-thread-btn ${userHasUpvotedThread ? 'active' : ''} p-2 rounded-full"><i class="fas fa-arrow-up"></i></button>
                  <span class="px-2">${upvotes}</span>
                  <button class="downvote-thread-btn ${userHasDownvotedThread ? 'active' : ''} p-2 rounded-full"><i class="fas fa-arrow-down"></i></button>
                  <span class="px-2">${downvotes}</span>
              </div>
          </div>
          <div class="comment-section">
              <h4 class="text-xl font-semibold text-gray-300 mb-3">Comments:</h4>
              <div id="comments-${threadId}" class="comments-list">
                  <!-- Comments will be loaded here -->
                  <p class="text-gray-500">Loading comments...</p>
              </div>
              <!-- Comment form -->
              <div class="mt-4">
                  <textarea id="comment-input-${threadId}" rows="3" class="w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Add a comment..." ${currentUser ? '' : 'disabled'}></textarea>
                  <button data-thread-id="${threadId}" class="post-comment-btn bg-green-600 text-white font-bold py-2 px-4 rounded-full mt-2 hover:bg-green-700 transition duration-300 ease-in-out" ${currentUser ? '' : 'disabled'}>Post Comment</button>
              </div>
          </div>
        `;
        threadsContainer.appendChild(threadElement);

        // Add event listener for the delete thread button
        const deleteThreadBtn = threadElement.querySelector(`.delete-thread-btn[data-thread-id="${threadId}"]`);
        if (deleteThreadBtn) {
          deleteThreadBtn.addEventListener('click', () => {
            showConfirmationModal('Delete Thread', 'Are you sure you want to delete this thread? This action cannot be undone.', () => deleteThread(threadId));
          });
        }

        // Add event listener for the edit thread button
        const editThreadBtn = threadElement.querySelector(`.edit-thread-btn[data-thread-id="${threadId}"]`);
        if (editThreadBtn) {
          editThreadBtn.addEventListener('click', () => {
            const title = editThreadBtn.dataset.title;
            const content = decodeURIComponent(editThreadBtn.dataset.content);
            openEditModal('thread', threadId, threadId, title, content);
          });
        }

        // Add event listener for delete user profile button
        const deleteUserProfileBtn = threadElement.querySelector(`.delete-user-profile-btn[data-user-uid="${thread.authorUid}"]`);
        if (deleteUserProfileBtn) {
          deleteUserProfileBtn.addEventListener('click', () => {
            const userUidToDelete = deleteUserProfileBtn.dataset.userUid;
            const userDisplayName = deleteUserProfileBtn.dataset.displayName;
            showConfirmationModal(
              'Delete User Profile',
              `Are you sure you want to delete the profile for "${userDisplayName}"? This will only remove their public profile data (display name, picture) but not their authentication account.`,
              () => deleteUserProfile(userUidToDelete, userDisplayName)
            );
          });
        }

        // Add event listeners for thread voting buttons
        const upvoteThreadBtn = threadElement.querySelector(`.upvote-thread-btn[data-thread-id="${threadId}"]`);
        const downvoteThreadBtn = threadElement.querySelector(`.downvote-thread-btn[data-thread-id="${threadId}"]`);

        if (upvoteThreadBtn) {
          upvoteThreadBtn.addEventListener('click', () => handleVote('thread', threadId, null, 'up'));
        }
        if (downvoteThreadBtn) {
          downvoteThreadBtn.addEventListener('click', () => handleVote('thread', threadId, null, 'down'));
        }


        // Listen for comments for this specific thread
        const commentsQuery = query(collection(db, `artifacts/${appId}/public/data/discussion_threads`, threadId, 'comments'), orderBy("timestamp", "asc"));
        onSnapshot(commentsQuery, async (commentSnapshot) => { // Made callback async
          const commentsListDiv = document.getElementById(`comments-${threadId}`);
          commentsListDiv.innerHTML = ''; // Clear existing comments

          if (commentSnapshot.empty) {
            commentsListDiv.innerHTML = '<p class="text-gray-500">No comments yet.</p>';
          } else {
            // Use for...of loop for comments too to ensure order and proper awaits
            for (const commentDoc of commentSnapshot.docs) {
              const comment = commentDoc.data();
              const commentId = commentDoc.id; // Get comment ID
              const commentTimestamp = comment.timestamp ? new Date(comment.timestamp.toDate()).toLocaleString() : 'Just now';

              const commentAuthorProfile = await getUserProfile(comment.authorUid);
              // Use the profile data from Firestore, fall back to what's in the comment doc, then default
              const commentAuthorName = commentAuthorProfile?.displayName || comment.authorName || 'Anonymous User';
              const commentAuthorPhoto = commentAuthorProfile?.photoURL || comment.authorPhotoURL || DEFAULT_PROFILE_PIC;

              const commentUpvotes = (comment.upvoters || []).length;
              const commentDownvotes = (comment.downvoters || []).length;

              // Check if current user has upvoted/downvoted this comment
              const userHasUpvotedComment = currentUser && (comment.upvoters || []).includes(currentUser.uid);
              const userHasDownvotedComment = currentUser && (comment.downvoters || []).includes(currentUser.uid);

              const commentElement = document.createElement('div');
              commentElement.classList.add('comment-card');
              commentElement.innerHTML = `
                        <div class="flex justify-between items-start mb-1">
                            <div class="profile-info flex items-center">
                                <img src="${commentAuthorPhoto}" alt="${commentAuthorName}'s profile picture" class="profile-pic w-7 h-7 rounded-full mr-2" onerror="this.onerror=null;this.src='${DEFAULT_PROFILE_PIC}';">
                                <p class="text-gray-300 font-semibold mr-2">${commentAuthorName} <span class="text-gray-500 text-xs">on ${commentTimestamp}</span>
                                  ${comment.editedAt ? `<span class="italic ml-2">(Edited on ${new Date(comment.editedAt.toDate()).toLocaleString()})</span>` : ''}
                                </p>
                                ${isAdminUser && currentUser.uid !== comment.authorUid ? `<button data-user-uid="${comment.authorUid}" data-display-name="${commentAuthorName}" class="delete-user-profile-btn text-red-400 hover:text-red-600 text-sm focus:outline-none ml-2"><i class="fas fa-user-minus"></i> Delete Profile</button>` : ''}
                            </div>
                            <div>
                                ${(currentUser && currentUser.uid === comment.authorUid) || isAdminUser ? `<button data-thread-id="${threadId}" data-comment-id="${commentId}" data-content="${encodeURIComponent(comment.content)}" class="edit-comment-btn text-blue-400 hover:text-blue-600 focus:outline-none mr-2"><i class="fas fa-edit"></i> Edit</button>` : ''}
                                ${(currentUser && currentUser.uid === comment.authorUid) || isAdminUser ? `<button data-thread-id="${threadId}" data-comment-id="${commentId}" class="delete-comment-btn text-red-400 hover:text-red-600 focus:outline-none"><i class="fas fa-trash-alt"></i></button>` : ''}
                            </div>
                        </div>
                        <div class="comment-content text-gray-200 mt-1">
                            ${renderContentWithMedia(comment.content)}
                        </div>
                        <div class="flex items-center space-x-4 mt-2">
                            <div class="vote-buttons flex items-center">
                                <button class="upvote-comment-btn ${userHasUpvotedComment ? 'active' : ''} p-2 rounded-full"><i class="fas fa-arrow-up"></i></button>
                                <span class="px-2">${commentUpvotes}</span>
                                <button class="downvote-comment-btn ${userHasDownvotedComment ? 'active' : ''} p-2 rounded-full"><i class="fas fa-arrow-down"></i></button>
                                <span class="px-2">${commentDownvotes}</span>
                            </div>
                        </div>
                    `;
              commentsListDiv.appendChild(commentElement);

              // Add event listener for the delete comment button
              const deleteCommentBtn = commentElement.querySelector(`.delete-comment-btn[data-comment-id="${commentId}"]`);
              if (deleteCommentBtn) {
                deleteCommentBtn.addEventListener('click', () => {
                  showConfirmationModal('Delete Comment', 'Are you sure you want to delete this comment? This action cannot be undone.', () => deleteComment(threadId, commentId));
                });
              }

              // Add event listener for the edit comment button
              const editCommentBtn = commentElement.querySelector(`.edit-comment-btn[data-comment-id="${commentId}"]`);
              if (editCommentBtn) {
                editCommentBtn.addEventListener('click', () => {
                  const content = decodeURIComponent(editCommentBtn.dataset.content);
                  openEditModal('comment', threadId, commentId, '', content); // No title for comments
                });
              }

              // Add event listener for delete user profile button within comments
              const deleteCommentUserProfileBtn = commentElement.querySelector(`.delete-user-profile-btn[data-user-uid="${comment.authorUid}"]`);
              if (deleteCommentUserProfileBtn) {
                deleteCommentUserProfileBtn.addEventListener('click', () => {
                  const userUidToDelete = deleteCommentUserProfileBtn.dataset.userUid;
                  const userDisplayName = deleteCommentUserProfileBtn.dataset.displayName;
                  showConfirmationModal(
                    'Delete User Profile',
                    `Are you sure you want to delete the profile for "${userDisplayName}"? This will only remove their public profile data (display name, picture) but not their authentication account.`,
                    () => deleteUserProfile(userUidToDelete, userDisplayName)
                  );
                });
              }

              // Add event listeners for comment voting buttons
              const upvoteCommentBtn = commentElement.querySelector(`.upvote-comment-btn[data-comment-id="${commentId}"]`);
              const downvoteCommentBtn = commentElement.querySelector(`.downvote-comment-btn[data-comment-id="${commentId}"]`);

              if (upvoteCommentBtn) {
                upvoteCommentBtn.addEventListener('click', () => handleVote('comment', threadId, commentId, 'up'));
              }
              if (downvoteCommentBtn) {
                downvoteCommentBtn.addEventListener('click', () => handleVote('comment', threadId, commentId, 'down'));
              }
            }
          }
        }, (commentError) => {
          console.error(`Error fetching comments for thread ${threadId}:`, commentError);
          const commentsListDiv = document.getElementById(`comments-${threadId}`);
          commentsListDiv.innerHTML = `<p class="text-red-500">Error loading comments.</p>`;
        });

        // Add event listener for the comment button after it's been added to DOM
        const postCommentBtn = threadElement.querySelector(`.post-comment-btn[data-thread-id="${threadId}"]`);
        if (postCommentBtn) {
          postCommentBtn.addEventListener('click', () => {
            const commentInput = document.getElementById(`comment-input-${threadId}`);
            const commentContent = commentInput.value;
            addCommentToThread(threadId, commentContent);
            commentInput.value = ''; // Clear input after posting
          });
        }
      }
    }
  }, (error) => {
    console.error("Error fetching real-time threads:", error);
    threadsLoadingError.textContent = `Failed to load threads: ${error.message || 'Unknown error'}`;
    threadsLoadingError.style.display = 'block';
    noThreadsMessage.style.display = 'none';
  });
}

// Get current year for footer
document.getElementById('current-year-forms').textContent = new Date().getFullYear();

window.onload = async function() {
  await firebaseReadyPromise;
  loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME);
};
