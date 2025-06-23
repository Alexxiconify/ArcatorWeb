/* global EasyMDE, marked */ // Explicitly declare EasyMDE and marked as global variables

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
// Corrected import: only pull what forms.js directly uses
import { showMessageBox, showCustomConfirm, COMMON_EMOJIS, parseEmojis, parseMentions, renderReactionButtons, getUserProfileFromFirestore, sanitizeHandle } from './utils.js';
import { auth, db, appId, getCurrentUser, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME } from './firebase-init.js'; // Import centralized Firebase instances and functions


// --- DOM Elements ---
const createThreadForm = document.getElementById('create-thread-form');
const threadTitleInput = document.getElementById('thread-title');
const threadThemeSelect = document.getElementById('thread-theme-select'); // For selecting theme
const threadContentInput = document.getElementById('thread-content');
const threadsList = document.getElementById('threads-list');
const threadDetailModal = document.getElementById('thread-detail-modal');
const modalThreadTitle = document.getElementById('modal-thread-title');
const modalThreadMeta = document.getElementById('modal-thread-meta');
const modalThreadContent = document.getElementById('modal-thread-content');
const addCommentForm = document.getElementById('add-comment-form');
const commentContentInput = document.getElementById('comment-content');
const commentsList = document.getElementById('comments-list');
const threadReactionsContainer = document.getElementById('thread-reactions-container');
const logoutBtn = document.getElementById('logout-btn'); // Assuming this exists in navbar or forms if needed
const customConfirmModal = document.getElementById('custom-confirm-modal'); // Re-get it for this scope
const loginRequiredMessage = document.getElementById('login-required-message');

const threadCategoryList = document.getElementById('thread-category-list'); // For filter buttons
const categoriesLoadingMessage = document.getElementById('categories-loading-message'); // Loading message for categories

// EasyMDE instance for creating new threads
let easyMDECreateThread;
// EasyMDE instance for comments (if implemented as EasyMDE, currently textarea)
let easyMDEComment;

let currentThreadId = null; // To keep track of the thread currently open in the modal
let unsubscribeComments = null; // To unsubscribe from comments listener when modal closes
let unsubscribeReactions = null; // To unsubscribe from reactions listener when modal closes

let availableForumThemes = []; // To store fetched forum themes (renamed from availableForumCategories)

// --- Firebase Initialization (handled by firebase-init.js) ---
// The `auth`, `db`, and `appId` variables are now imported from firebase-init.js.
// `setupFirebaseAndUser()` is called in window.onload.

/**
 * Fetches all available forum themes from Firestore.
 * @returns {Promise<Array>} A promise that resolves with an array of theme objects.
 */
async function fetchForumThemes() { // Renamed from fetchForumCategories
  if (!db) {
    console.error("Firestore DB not initialized for fetching forum themes.");
    return [];
  }
  const themesCol = collection(db, `artifacts/${appId}/public/data/themes`); // Points to themes collection
  try {
    const querySnapshot = await getDocs(themesCol);
    const themes = []; // Renamed from categories
    querySnapshot.forEach(doc => {
      themes.push({ id: doc.id, ...doc.data() });
    });
    availableForumThemes = themes; // Store for later use (renamed from availableForumCategories)
    console.log("DEBUG: Fetched forum themes:", themes.length, themes);
    return themes;
  } catch (error) {
    console.error("Error fetching forum themes:", error);
    showMessageBox("Error loading forum themes.", true);
    return [];
  }
}

/**
 * Populates the thread theme select dropdown with available themes.
 */
async function populateThreadCategorySelect() { // Function name kept for now, but internally uses 'theme'
  if (!threadThemeSelect) return;

  threadThemeSelect.innerHTML = '<option value="">Select a Theme</option>'; // Default option (changed from Category)
  if (availableForumThemes.length === 0) { // Renamed from availableForumCategories
    threadThemeSelect.innerHTML += '<option value="" disabled>No themes available</option>'; // Changed from categories
    return;
  }

  availableForumThemes.forEach(theme => { // Changed from category
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    threadThemeSelect.appendChild(option);
  });
}

/**
 * Renders the theme filter buttons dynamically.
 * @param {Array} themes - Array of theme objects. (renamed from categories)
 * @param {string} activeThemeId - The ID of the currently active theme filter, or 'all'. (renamed from activeCategoryId)
 */
async function renderCategoryFilterButtons(themes, activeThemeId = 'all') { // Function name kept for now, but internally uses 'theme'
  if (!threadCategoryList) return;

  threadCategoryList.innerHTML = ''; // Clear existing buttons
  categoriesLoadingMessage.style.display = 'none'; // Hide loading message

  // Add "All Threads" button
  const allThreadsButton = document.createElement('button');
  allThreadsButton.textContent = 'All Threads'; // Kept as All Threads for general filter
  allThreadsButton.dataset.categoryId = 'all'; // Kept dataset for consistency with filter logic
  allThreadsButton.classList.add('px-4', 'py-2', 'rounded-full', 'transition', 'duration-300', 'ease-in-out', 'shadow-lg', 'text-sm');
  if (activeThemeId === 'all') {
    allThreadsButton.classList.add('active-category-filter');
  }
  allThreadsButton.addEventListener('click', () => {
    filterThreadsByCategory('all');
    updateActiveFilterButton('all');
  });
  threadCategoryList.appendChild(allThreadsButton);

  // Add buttons for each theme
  themes.forEach(theme => { // Changed from category
    const button = document.createElement('button');
    button.textContent = theme.name; // Display theme name on button
    button.dataset.categoryId = theme.id; // Kept dataset for consistency with filter logic
    button.classList.add('px-4', 'py-2', 'rounded-full', 'transition', 'duration-300', 'ease-in-out', 'shadow-lg', 'text-sm');
    if (activeThemeId === theme.id) {
      button.classList.add('active-category-filter');
    }
    button.addEventListener('click', () => {
      filterThreadsByCategory(theme.id);
      updateActiveFilterButton(theme.id);
    });
    threadCategoryList.appendChild(button);
  });
}

/**
 * Updates the visual active state of the theme filter buttons.
 * @param {string} activeId - The ID of the currently active theme.
 */
function updateActiveFilterButton(activeId) {
  document.querySelectorAll('#thread-category-list button').forEach(button => {
    if (button.dataset.categoryId === activeId) {
      button.classList.add('active-category-filter');
    } else {
      button.classList.remove('active-category-filter');
    }
  });
}

/**
 * Filters and renders threads based on the selected theme.
 * @param {string} themeId - The ID of the theme to filter by, or 'all'. (renamed from categoryId)
 */
async function filterThreadsByCategory(themeId) { // Function name kept for now, but internally uses 'themeId'
  console.log("DEBUG: Filtering threads by theme:", themeId);
  await fetchThreads(themeId);
}


/**
 * Creates a new forum thread.
 * @param {string} title - The title of the thread.
 * @param {string} content - The content of the thread (Markdown).
 * @param {string} themeId - The ID of the selected theme. (renamed from categoryId)
 */
async function createThread(title, content, themeId) { // Renamed from createThread(title, content, categoryId)
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to create a thread.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot create thread.", true);
    return;
  }
  if (!themeId) { // Changed from categoryId
    showMessageBox("Please select a theme for your thread.", true); // Changed message
    return;
  }

  const threadsCol = collection(db, `artifacts/${appId}/public/data/threads`);
  try {
    const docRef = await addDoc(threadsCol, {
      title: title,
      content: content,
      authorUid: user.uid,
      authorDisplayName: user.displayName || user.email,
      authorProfilePic: user.photoURL || DEFAULT_PROFILE_PIC,
      themeId: themeId, // Store the selected theme ID (changed from categoryId)
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      commentsCount: 0,
      reactions: {} // Initialize reactions object
    });
    showMessageBox("Thread created successfully!", false);
    threadTitleInput.value = '';
    easyMDECreateThread.value(''); // Clear EasyMDE editor
    threadThemeSelect.value = ''; // Reset theme select (changed from category select)
    await fetchThreads('all'); // Re-fetch all threads to show the new one
    console.log("DEBUG: Thread created:", docRef.id);
  } catch (error) {
    console.error("Error creating thread:", error);
    showMessageBox(`Error creating thread: ${error.message}`, true);
  }
}

/**
 * Fetches forum threads from Firestore, optionally filtered by theme.
 * @param {string|null} themeId - The ID of the theme to filter by, or 'all'/'null' for all threads. (renamed from categoryId)
 */
async function fetchThreads(themeId = 'all') { // Renamed from fetchThreads(categoryId)
  if (!db) {
    threadsList.innerHTML = '<p class="text-red-500 text-center text-lg">Database not initialized. Cannot load threads.</p>';
    return;
  }

  threadsList.innerHTML = '<p class="text-gray-400 text-center text-lg">Loading threads...</p>';
  document.getElementById('threads-loading-error').classList.add('hidden');
  document.getElementById('no-threads-message').classList.add('hidden');

  let threadsQuery = collection(db, `artifacts/${appId}/public/data/threads`);

  // Apply theme filter if not 'all'
  if (themeId && themeId !== 'all') { // Changed from categoryId
    threadsQuery = query(threadsQuery, where("themeId", "==", themeId)); // Filter by themeId (changed from categoryId)
  }

  // Sort by createdAt in descending order (newest first)
  threadsQuery = query(threadsQuery, orderBy("createdAt", "desc"));

  try {
    const querySnapshot = await getDocs(threadsQuery);
    const threads = [];
    if (querySnapshot.empty) {
      document.getElementById('no-threads-message').classList.remove('hidden');
      threadsList.innerHTML = ''; // Clear loading message
      return;
    }
    querySnapshot.forEach(doc => {
      threads.push({ id: doc.id, ...doc.data() });
    });
    renderThreads(threads);
    console.log("DEBUG: Fetched threads:", threads.length, "for theme:", themeId); // Changed from category
  } catch (error) {
    console.error("Error fetching threads:", error);
    document.getElementById('threads-loading-error').classList.remove('hidden');
    threadsList.innerHTML = ''; // Clear loading message
    showMessageBox(`Error loading threads: ${error.message}`, true);
  }
}


/**
 * Renders the list of forum threads.
 * @param {Array} threads - An array of thread objects.
 */
async function renderThreads(threads) {
  threadsList.innerHTML = ''; // Clear existing threads

  if (threads.length === 0) {
    document.getElementById('no-threads-message').classList.remove('hidden');
    return;
  }

  for (const thread of threads) {
    const threadElement = document.createElement('div');
    threadElement.classList.add('thread-item', 'mb-6'); // Apply modern Reddit-like styling

    // Fetch author profile for display name and picture if not already present or updated
    let authorDisplayName = thread.authorDisplayName || "Anonymous";
    let authorProfilePic = thread.authorProfilePic || DEFAULT_PROFILE_PIC;
    try {
      // Pass db and appId explicitly to getUserProfileFromFirestore if it's imported from utils.js
      const authorProfile = await getUserProfileFromFirestore(db, appId, thread.authorUid);
      if (authorProfile) {
        authorDisplayName = authorProfile.displayName || authorDisplayName;
        authorProfilePic = authorProfile.photoURL || authorProfilePic;
      }
    } catch (e) {
      console.warn("Could not fetch author profile for thread:", thread.authorUid, e);
    }

    const formattedDate = thread.createdAt?.toDate ? new Date(thread.createdAt.toDate()).toLocaleString() : 'N/A';
    const commentsCount = thread.commentsCount || 0;

    let themeName = 'Uncategorized'; // Renamed from categoryName
    if (thread.themeId) { // Changed from categoryId
      const theme = availableForumThemes.find(t => t.id === thread.themeId); // Renamed from category, availableForumCategories
      if (theme) {
        themeName = theme.name; // Changed from categoryName = category.name
      }
    }

    const contentPreview = thread.content ? marked.parse(thread.content).substring(0, 200) + '...' : 'No content preview available.';

    threadElement.innerHTML = `
      <div class="flex items-center mb-4">
        <img src="${authorProfilePic}" alt="${authorDisplayName}'s profile picture" class="profile-pic-small mr-3">
        <div>
          <p class="text-gray-200 font-semibold">${authorDisplayName}</p>
          <p class="text-gray-400 text-xs">${formattedDate}</p>
        </div>
      </div>
      <h3 class="thread-title mb-2 cursor-pointer">${parseEmojis(thread.title)}</h3>
      <p class="thread-meta">Comments: ${commentsCount} | Theme: <span class="thread-category-tag">/t/${themeName}</span></p>
      <div class="thread-content-preview prose max-w-none">${contentPreview}</div>
      <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-300 view-thread-btn" data-id="${thread.id}">View Thread</button>
    `;
    threadsList.appendChild(threadElement);
  }

  // Add event listeners to "View Thread" buttons
  document.querySelectorAll('.view-thread-btn').forEach(button => {
    button.addEventListener('click', (event) => {
      const threadId = event.target.dataset.id;
      openThreadDetailModal(threadId);
    });
  });
}

/**
 * Opens the thread detail modal and populates it with thread and comment data.
 * @param {string} threadId - The ID of the thread to display.
 */
async function openThreadDetailModal(threadId) {
  currentThreadId = threadId; // Set the current thread ID for comment/reaction functions

  // Clear previous data and show loading state
  modalThreadTitle.textContent = 'Loading...';
  modalThreadMeta.textContent = '';
  modalThreadContent.innerHTML = '<p>Loading thread content...</p>';
  commentsList.innerHTML = '<p class="text-gray-300 text-center">Loading comments...</p>';
  threadReactionsContainer.innerHTML = ''; // Clear reactions too

  threadDetailModal.style.display = 'flex'; // Show modal

  // Fetch thread details
  const threadDocRef = doc(db, `artifacts/${appId}/public/data/threads`, threadId);
  try {
    const threadSnap = await getDoc(threadDocRef);
    if (threadSnap.exists()) {
      const threadData = threadSnap.data();

      // Fetch author profile for display name and picture
      let authorDisplayName = threadData.authorDisplayName || "Anonymous";
      let authorProfilePic = threadData.authorProfilePic || DEFAULT_PROFILE_PIC;
      try {
        // Pass db and appId explicitly to getUserProfileFromFirestore if it's imported from utils.js
        const authorProfile = await getUserProfileFromFirestore(db, appId, threadData.authorUid);
        if (authorProfile) {
          authorDisplayName = authorProfile.displayName || authorDisplayName;
          authorProfilePic = authorProfile.photoURL || authorProfilePic;
        }
      } catch (e) {
        console.warn("Could not fetch author profile for thread detail:", threadData.authorUid, e);
      }

      const formattedDate = threadData.createdAt?.toDate ? new Date(threadData.createdAt.toDate()).toLocaleString() : 'N/A';
      const themeName = availableForumThemes.find(t => t.id === threadData.themeId)?.name || 'Uncategorized'; // Renamed from categoryName, availableForumCategories, categoryId


      modalThreadTitle.textContent = parseEmojis(threadData.title);
      modalThreadMeta.innerHTML = `By ${authorDisplayName} on ${formattedDate} | Comments: ${threadData.commentsCount || 0} | Theme: /t/${themeName}`; // Changed from Category
      // Parse Markdown content to HTML
      // Ensure parseMentions also receives db and appId if it needs them from forms.js scope
      modalThreadContent.innerHTML = parseEmojis(await parseMentions(marked.parse(threadData.content || '')));


      // Setup real-time listeners for comments and reactions
      setupCommentsListener(threadId);
      setupReactionsListener(threadId);

    } else {
      modalThreadContent.innerHTML = '<p class="text-red-500">Thread not found.</p>';
      commentsList.innerHTML = '';
      threadReactionsContainer.innerHTML = '';
    }
  } catch (error) {
    console.error("Error fetching thread details:", error);
    modalThreadContent.innerHTML = `<p class="text-red-500">Error loading thread: ${error.message}</p>`;
    commentsList.innerHTML = '';
    threadReactionsContainer.innerHTML = '';
  }
}

/**
 * Sets up a real-time listener for comments on the current thread.
 * @param {string} threadId - The ID of the thread.
 */
function setupCommentsListener(threadId) {
  // Unsubscribe from previous listener if it exists
  if (unsubscribeComments) {
    unsubscribeComments();
    console.log("DEBUG: Unsubscribed from previous comments listener.");
  }

  const commentsColRef = collection(db, `artifacts/${appId}/public/data/threads`, threadId, 'comments');
  const q = query(commentsColRef, orderBy('createdAt', 'asc')); // Order comments by creation time

  unsubscribeComments = onSnapshot(q, async (snapshot) => {
    commentsList.innerHTML = ''; // Clear existing comments
    if (snapshot.empty) {
      commentsList.innerHTML = '<p class="text-gray-300 text-center">No comments yet. Be the first to reply!</p>';
      // Update comments count on the main thread display as well
      await updateThreadCommentsCount(threadId, 0);
      return;
    }

    let count = 0;
    for (const commentDoc of snapshot.docs) {
      count++;
      const comment = commentDoc.data();
      const commentElement = document.createElement('div');
      commentElement.classList.add('bg-gray-700', 'p-4', 'rounded-lg', 'shadow-sm', 'relative'); // Apply card-like styling

      let authorDisplayName = comment.authorDisplayName || "Anonymous";
      let authorProfilePic = comment.authorProfilePic || DEFAULT_PROFILE_PIC;
      try {
        // Pass db and appId explicitly to getUserProfileFromFirestore if it's imported from utils.js
        const authorProfile = await getUserProfileFromFirestore(db, appId, comment.authorUid);
        if (authorProfile) {
          authorDisplayName = authorProfile.displayName || authorDisplayName;
          authorProfilePic = authorProfile.photoURL || authorProfilePic;
        }
      } catch (e) {
        console.warn("Could not fetch author profile for comment:", comment.authorUid, e);
      }

      const formattedDate = comment.createdAt?.toDate ? new Date(comment.createdAt.toDate()).toLocaleString() : 'N/A';
      // Ensure parseMentions also receives db and appId if it needs them from forms.js scope
      const parsedContent = parseEmojis(await parseMentions(marked.parse(comment.content || '')));

      commentElement.innerHTML = `
        <div class="flex items-center mb-2">
          <img src="${authorProfilePic}" alt="${authorDisplayName}'s profile picture" class="profile-pic-small mr-2">
          <div>
            <p class="text-gray-200 font-semibold">${authorDisplayName}</p>
            <p class="text-gray-400 text-xs">${formattedDate}</p>
          </div>
        </div>
        <div class="prose text-gray-100 mb-2">${parsedContent}</div>
        ${getCurrentUser() && getCurrentUser().uid === comment.authorUid ? `<button class="text-red-500 hover:text-red-700 text-sm delete-comment-btn absolute top-2 right-2" data-comment-id="${commentDoc.id}">Delete</button>` : ''}
      `;
      commentsList.appendChild(commentElement);
    }
    // Update comments count on the main thread display (and in Firestore)
    await updateThreadCommentsCount(threadId, count);

    // Add event listeners for delete comment buttons
    document.querySelectorAll('.delete-comment-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const commentId = event.target.dataset.commentId;
        const confirmation = await showCustomConfirm("Are you sure you want to delete this comment?", "This action cannot be undone.");
        if (confirmation) {
          await deleteComment(threadId, commentId);
        } else {
          showMessageBox("Comment deletion cancelled.", false);
        }
      });
    });

    console.log("DEBUG: Comments rendered. Count:", count);
  }, (error) => {
    console.error("Error listening to comments:", error);
    commentsList.innerHTML = `<p class="text-red-500 text-center">Error loading comments: ${error.message}</p>`;
  });
}

/**
 * Sets up a real-time listener for reactions on the current thread.
 * @param {string} threadId - The ID of the thread.
 */
function setupReactionsListener(threadId) {
  // Unsubscribe from previous listener if it exists
  if (unsubscribeReactions) {
    unsubscribeReactions();
    console.log("DEBUG: Unsubscribed from previous reactions listener.");
  }

  const threadDocRef = doc(db, `artifacts/${appId}/public/data/threads`, threadId);
  unsubscribeReactions = onSnapshot(threadDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const reactions = docSnap.data().reactions || {};
      renderReactionButtons(
        'thread',
        threadId,
        reactions,
        threadReactionsContainer,
        getCurrentUser // Pass the getCurrentUser function
      );
      console.log("DEBUG: Reactions rendered for thread:", threadId);

      // Re-attach event listeners for reaction buttons
      document.querySelectorAll('#thread-reactions-container .reaction-btn').forEach(button => {
        const emoji = button.textContent.split(' ')[0]; // Extract emoji from button text
        button.addEventListener('click', () => toggleReaction(threadId, emoji));
      });

    } else {
      console.log("DEBUG: Thread not found for reactions:", threadId);
      threadReactionsContainer.innerHTML = '';
    }
  }, (error) => {
    console.error("Error listening to reactions:", error);
    threadReactionsContainer.innerHTML = `<p class="text-red-500">Error loading reactions: ${error.message}</p>`;
  });
}


/**
 * Toggles a user's reaction to a thread.
 * @param {string} threadId - The ID of the thread.
 * @param {string} emoji - The emoji character (e.g., '👍').
 */
async function toggleReaction(threadId, emoji) {
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to react.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot react.", true);
    return;
  }

  const threadRef = doc(db, `artifacts/${appId}/public/data/threads`, threadId);
  try {
    // Atomically update the reactions map
    await updateDoc(threadRef, {
      [`reactions.${emoji}.${user.uid}`]: user.uid // Set user's UID under the emoji to mark reaction
    });
    console.log(`DEBUG: Toggled reaction '${emoji}' for user ${user.uid} on thread ${threadId}.`);
    // The onSnapshot listener will automatically re-render the reactions.
  } catch (error) {
    console.error("Error toggling reaction:", error);
    showMessageBox(`Failed to add reaction: ${error.message}`, true);
  }
}


/**
 * Adds a new comment to the current thread.
 * @param {Event} event - The form submission event.
 */
async function addComment(event) {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to post a comment.", true);
    return;
  }
  if (!currentThreadId) {
    showMessageBox("No thread selected to add a comment.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot add comment.", true);
    return;
  }

  const content = commentContentInput.value.trim();
  if (!content) {
    showMessageBox("Comment cannot be empty.", true);
    return;
  }

  const commentsCol = collection(db, `artifacts/${appId}/public/data/threads`, currentThreadId, 'comments');
  try {
    await addDoc(commentsCol, {
      content: content,
      authorUid: user.uid,
      authorDisplayName: user.displayName || user.email,
      authorProfilePic: user.photoURL || DEFAULT_PROFILE_PIC,
      createdAt: serverTimestamp()
    });
    showMessageBox("Comment posted successfully!", false);
    commentContentInput.value = ''; // Clear textarea
    // The onSnapshot listener for comments will automatically update the list.
    console.log("DEBUG: Comment added to thread:", currentThreadId);
  } catch (error) {
    console.error("Error adding comment:", error);
    showMessageBox(`Error posting comment: ${error.message}`, true);
  }
}

/**
 * Deletes a comment from a thread.
 * @param {string} threadId - The ID of the thread the comment belongs to.
 * @param {string} commentId - The ID of the comment to delete.
 */
async function deleteComment(threadId, commentId) {
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to delete comments.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete comment.", true);
    return;
  }

  const commentDocRef = doc(db, `artifacts/${appId}/public/data/threads`, threadId, 'comments', commentId);
  try {
    const commentSnap = await getDoc(commentDocRef);
    if (!commentSnap.exists()) {
      showMessageBox("Comment not found.", true);
      return;
    }

    const commentData = commentSnap.data();
    // Only allow the author or an admin to delete the comment
    const currentUserData = getCurrentUser(); // Get enriched user data (including isAdmin)
    if (commentData.authorUid !== user.uid && (!currentUserData || !currentUserData.isAdmin)) {
      showMessageBox("You do not have permission to delete this comment.", true);
      return;
    }

    await deleteDoc(commentDocRef);
    showMessageBox("Comment deleted successfully!", false);
    // The onSnapshot listener will automatically update the UI.
    console.log(`DEBUG: Comment ${commentId} deleted from thread ${threadId}.`);
  } catch (error) {
    console.error("Error deleting comment:", error);
    showMessageBox(`Error deleting comment: ${error.message}`, true);
  }
}

/**
 * Updates the comments count in a thread's Firestore document.
 * This is called by the comments listener to keep the main thread document updated.
 * @param {string} threadId - The ID of the thread.
 * @param {number} count - The new comments count.
 */
async function updateThreadCommentsCount(threadId, count) {
  if (!db) {
    console.error("DB not initialized for updating comments count.");
    return;
  }
  const threadRef = doc(db, `artifacts/${appId}/public/data/threads`, threadId);
  try {
    await updateDoc(threadRef, {
      commentsCount: count,
      updatedAt: serverTimestamp() // Also update the last modified timestamp
    });
    console.log(`DEBUG: Thread ${threadId} comments count updated to: ${count}`);
    // Re-fetch all threads to reflect the updated count on the main page
    await fetchThreads(document.querySelector('#thread-category-list button.active-category-filter')?.dataset.categoryId || 'all');
  } catch (error) {
    console.error("Error updating thread comments count:", error);
  }
}


/**
 * Handles the click of the modal close button.
 */
function closeModal() {
  threadDetailModal.style.display = 'none';
  // Unsubscribe from real-time listeners when modal closes
  if (unsubscribeComments) {
    unsubscribeComments();
    unsubscribeComments = null;
    console.log("DEBUG: Unsubscribed from comments listener on modal close.");
  }
  if (unsubscribeReactions) {
    unsubscribeReactions();
    unsubscribeReactions = null;
    console.log("DEBUG: Unsubscribed from reactions listener on modal close.");
  }
  currentThreadId = null; // Clear the current thread ID
}

// --- DOMContentLoaded and Initial Setup ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("forms.js - DOMContentLoaded event fired.");

  // Initialize Firebase and set up user authentication
  await setupFirebaseAndUser();
  // Initialize themes Firebase integration (required for getAvailableThemes)
  setupThemesFirebase(db, auth, appId);
  // Load the navbar
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Initialize EasyMDE for new thread creation
  easyMDECreateThread = new EasyMDE({
    element: threadContentInput,
    spellChecker: false,
    forceSync: true,
    minHeight: "150px",
    toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "guide"]
  });
  console.log("EasyMDE initialized for thread creation.");


  // Initial UI update based on current auth state
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      createThreadForm?.classList.remove('hidden'); // Show create thread form
      addCommentForm?.classList.remove('hidden'); // Show add comment form
      loginRequiredMessage?.classList.add('hidden'); // Hide login message
    } else {
      createThreadForm?.classList.add('hidden'); // Hide create thread form
      addCommentForm?.classList.add('hidden'); // Hide add comment form
      loginRequiredMessage?.classList.remove('hidden'); // Show login message
    }
  });

  // Fetch and render forum themes
  categoriesLoadingMessage.style.display = 'block'; // Show loading message before fetching
  await fetchForumThemes(); // Changed from fetchForumCategories
  await populateThreadCategorySelect(); // Populate the dropdown (name kept for now)
  await renderCategoryFilterButtons(availableForumThemes, 'all'); // Render filter buttons (changed from availableForumCategories)
  categoriesLoadingMessage.style.display = 'none'; // Hide loading message after rendering

  // Fetch and render all threads initially
  await fetchThreads('all');


  // Event listener for Create Thread Form submission
  createThreadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = threadTitleInput.value.trim();
    const content = easyMDECreateThread.value().trim(); // Get content from EasyMDE
    const themeId = threadThemeSelect.value; // Get selected theme ID (changed from categoryId)

    if (!title || !content) {
      showMessageBox("Please enter both title and content for your thread.", true);
      return;
    }
    await createThread(title, content, themeId); // Changed from categoryId
  });

  // Event listener for Add Comment Form submission
  addCommentForm?.addEventListener('submit', addComment);

  // Event listener for modal close button
  threadDetailModal.querySelector('.close-button')?.addEventListener('click', closeModal);

  // Event listener for clicking outside the modal content
  window.addEventListener('click', (event) => {
    if (event.target === threadDetailModal) {
      closeModal();
    }
  });

  // Set the current year for the footer
  const currentYearElement = document.getElementById('current-year-forms');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }
});
