// forms.js: This script handles forum thread and comment functionality,
// including real-time updates, reactions, emoji parsing, user mentions,
// and dynamic display of temporary pages.

// Debug log to check if the script starts executing.
console.log("forms.js - Script parsing initiated.");

/* global EasyMDE, marked */ // Explicitly declare EasyMDE and marked as globals for linters

// --- Firebase Imports ---
import {
  auth,
  db,
  appId,
  getCurrentUser,
  getUserProfileFromFirestore,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME,
  firebaseReadyPromise
} from './firebase-init.js';

import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot, // Using onSnapshot for real-time updates
  query,
  getDocs,
  serverTimestamp,
  // arrayUnion, // Not currently used, removed for clarity
  // arrayRemove // Not currently used, removed for clarity
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Local Module Imports ---
import { applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';
import { showMessageBox, showCustomConfirm } from './utils.js'; // Utility for messages and confirmations

// --- DOM Elements (Declared as null, assigned in DOMContentLoaded) ---
let createThreadForm = null;
let threadTitleInput = null;
let threadThemeSelect = null; // New: Thread theme/category select
let threadContentTextarea = null;
let threadsList = null;
let threadDetailModal = null;
let modalThreadTitle = null;
let modalThreadMeta = null;
let modalThreadContent = null;
let threadReactionsContainer = null;
let commentsList = null;
let addCommentForm = null;
let commentContentTextarea = null;
let temporaryPagesList = null;
let threadCategoryListDiv = null; // New: Container for thread category buttons
let showAllThreadsBtn = null; // New: Button to show all threads

// EasyMDE instance for thread content
let easyMDEThreadContent;

let currentThreadId = null; // To keep track of the currently viewed thread
let unsubscribeComments = null; // To unsubscribe from comments snapshot listener
let currentThreadFilterThemeId = null; // To keep track of the currently applied thread filter theme


// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("forms.js - DOMContentLoaded event fired.");

  // Assign DOM elements now that the document is ready
  createThreadForm = document.getElementById('create-thread-form');
  threadTitleInput = document.getElementById('thread-title');
  threadThemeSelect = document.getElementById('thread-theme-select'); // Assign new element
  threadContentTextarea = document.getElementById('thread-content');
  threadsList = document.getElementById('threads-list');
  threadDetailModal = document.getElementById('thread-detail-modal');
  modalThreadTitle = document.getElementById('modal-thread-title');
  modalThreadMeta = document.getElementById('modal-thread-meta');
  modalThreadContent = document.getElementById('modal-thread-content');
  threadReactionsContainer = document.getElementById('thread-reactions-container');
  commentsList = document.getElementById('comments-list');
  addCommentForm = document.getElementById('add-comment-form');
  commentContentTextarea = document.getElementById('comment-content');
  temporaryPagesList = document.getElementById('temporary-pages-list');
  threadCategoryListDiv = document.getElementById('thread-category-list'); // Assign new element
  showAllThreadsBtn = document.getElementById('show-all-threads-btn'); // Assign new element

  // Await Firebase to be fully ready before proceeding with any Firebase-dependent operations
  await firebaseReadyPromise;

  // Load the navbar
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Initialize EasyMDE for thread content after DOM is ready
  if (threadContentTextarea) {
    easyMDEThreadContent = new EasyMDE({
      element: threadContentTextarea,
      spellChecker: false,
      forceSync: true,
      minHeight: "150px",
      toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "guide"]
    });
    console.log("EasyMDE for thread content initialized.");
  } else {
    console.warn("Thread content textarea not found for EasyMDE initialization.");
  }

  // Set the current year for the footer
  const currentYearElement = document.getElementById('current-year-forms');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }

  // Populate theme dropdown for new threads
  await populateThreadThemeSelect();

  // Fetch and display content on load (initial render of all threads)
  await renderThreads(null); // Render all threads initially
  await renderTemporaryPages(); // Render temporary pages
  await renderThreadCategories(); // Render theme/category buttons for filtering

  // Attach event listeners
  if (createThreadForm) {
    createThreadForm.addEventListener('submit', handleCreateThread);
  }

  if (addCommentForm) {
    addCommentForm.addEventListener('submit', handleAddComment);
  }

  // Event listener for "Show All Threads" button
  if (showAllThreadsBtn) {
    showAllThreadsBtn.addEventListener('click', () => {
      currentThreadFilterThemeId = null; // Clear filter
      renderThreads(null); // Re-render all threads
      showMessageBox("Showing all threads.", false);
    });
  }

  // Close modal when clicking on the close button or outside
  threadDetailModal?.querySelector('.close-button')?.addEventListener('click', () => {
    if (threadDetailModal) threadDetailModal.style.display = 'none';
    if (unsubscribeComments) {
      unsubscribeComments(); // Unsubscribe from comments when modal closes
      unsubscribeComments = null;
    }
  });

  window.addEventListener('click', (event) => {
    if (event.target === threadDetailModal) {
      if (threadDetailModal) threadDetailModal.style.display = 'none';
      if (unsubscribeComments) {
        unsubscribeComments();
        unsubscribeComments = null;
      }
    }
  });

  // Apply initial theme based on user preference or default
  const user = getCurrentUser();
  let userProfile = null;
  if (user && user.uid) {
    userProfile = await getUserProfileFromFirestore(user.uid);
  }
  const userThemePreference = userProfile?.themePreference || DEFAULT_THEME_NAME;
  const allThemes = await getAvailableThemes();
  const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
  applyTheme(themeToApply.id, themeToApply);
});


// --- Thread Functions ---

/**
 * Populates the theme/category select dropdown for creating new threads.
 */
async function populateThreadThemeSelect() {
  if (!threadThemeSelect) return;
  threadThemeSelect.innerHTML = '<option value="">Loading themes...</option>';
  const allThemes = await getAvailableThemes();
  threadThemeSelect.innerHTML = ''; // Clear loading message

  // Add a default "No Category" option
  const noCategoryOption = document.createElement('option');
  noCategoryOption.value = '';
  noCategoryOption.textContent = 'No Specific Category';
  threadThemeSelect.appendChild(noCategoryOption);

  allThemes.forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    threadThemeSelect.appendChild(option);
  });
  console.log("Thread theme select populated.");
}

/**
 * Handles the creation of a new forum thread.
 * @param {Event} event - The form submission event.
 */
async function handleCreateThread(event) {
  event.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to create a thread.", true);
    return;
  }

  const title = threadTitleInput.value.trim();
  const content = easyMDEThreadContent.value().trim(); // Get content from EasyMDE
  const selectedThemeId = threadThemeSelect.value || null; // Get selected theme ID

  if (!title || !content) {
    showMessageBox("Please enter both a title and content for your thread.", true);
    return;
  }

  try {
    const userProfile = await getUserProfileFromFirestore(user.uid);
    const authorDisplayName = userProfile?.displayName || user.displayName || 'Anonymous';
    const authorHandle = userProfile?.handle || `user${user.uid.substring(0, 5)}`;
    const authorPhotoURL = userProfile?.photoURL || DEFAULT_PROFILE_PIC;

    const threadsCollectionRef = collection(db, `artifacts/${appId}/public/data/forum_threads`);
    await addDoc(threadsCollectionRef, {
      title: title,
      content: content,
      themeId: selectedThemeId, // Save the selected theme ID
      authorId: user.uid,
      authorDisplayName: authorDisplayName,
      authorHandle: authorHandle,
      authorPhotoURL: authorPhotoURL,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastCommentAt: serverTimestamp(),
      commentsCount: 0,
      reactions: {}
    });
    showMessageBox("Thread created successfully!", false);
    threadTitleInput.value = '';
    threadThemeSelect.value = ''; // Reset theme select
    easyMDEThreadContent.value(''); // Clear EasyMDE content
    await renderThreads(currentThreadFilterThemeId); // Re-render with current filter
  } catch (error) {
    console.error("Error creating thread:", error);
    showMessageBox(`Error creating thread: ${error.message}`, true);
  }
}

/**
 * Fetches forum threads from Firestore, optionally filtered by theme.
 * Performs client-side sorting.
 * @param {string|null} themeId - Optional. The ID of the theme to filter by. If null, fetches all.
 * @returns {Promise<Array<Object>>} An array of thread objects.
 */
async function fetchThreads(themeId = null) {
  if (!db) {
    console.error("Firestore DB not initialized for fetching threads.");
    return [];
  }
  const threadsCollectionRef = collection(db, `artifacts/${appId}/public/data/forum_threads`);
  let q = threadsCollectionRef;

  // No Firestore .where() or .orderBy() used to avoid index requirements
  // All filtering and sorting will be client-side.

  try {
    const querySnapshot = await getDocs(q);
    let threads = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      threads.push({ id: doc.id, ...data });
    });

    // Client-side filtering by theme
    if (themeId) {
      threads = threads.filter(thread => thread.themeId === themeId);
    }

    // Client-side sorting by lastCommentAt (descending), then by createdAt (descending)
    threads.sort((a, b) => {
      const aLastCommentTime = a.lastCommentAt?.toDate() || a.createdAt?.toDate();
      const bLastCommentTime = b.lastCommentAt?.toDate() || b.createdAt?.toDate();
      const timeA = aLastCommentTime ? aLastCommentTime.getTime() : 0;
      const timeB = bLastCommentTime ? bLastCommentTime.getTime() : 0;
      return timeB - timeA; // Descending order
    });

    console.log(`Threads fetched (${threads.length}) with filter: ${themeId || 'None'}`);
    return threads;
  } catch (error) {
    console.error("Error fetching threads:", error);
    showMessageBox(`Error loading threads: ${error.message}`, true);
    return [];
  }
}

/**
 * Renders the list of forum threads.
 * @param {string|null} filterThemeId - Optional theme ID to filter by.
 */
async function renderThreads(filterThemeId = null) {
  currentThreadFilterThemeId = filterThemeId; // Update global filter state
  if (!threadsList) return;

  threadsList.innerHTML = '<p class="text-gray-300 text-center">Loading threads...</p>';
  const threads = await fetchThreads(filterThemeId);
  threadsList.innerHTML = ''; // Clear loading message

  if (threads.length === 0) {
    threadsList.innerHTML = '<p class="text-gray-300 text-center">No threads found for this category. Be the first to create one!</p>';
    return;
  }

  // Fetch all themes to display theme names
  const allThemes = await getAvailableThemes();
  const getThemeName = (id) => {
    const theme = allThemes.find(t => t.id === id);
    return theme ? theme.name : 'Uncategorized';
  };

  threads.forEach(thread => {
    const threadElement = document.createElement('div');
    threadElement.classList.add('thread-item', 'border', 'border-input-border', 'hover:border-link', 'p-4', 'rounded-lg', 'mb-4', 'cursor-pointer');
    threadElement.dataset.threadId = thread.id;

    const createdAt = thread.createdAt?.toDate ? new Date(thread.createdAt.toDate()).toLocaleString() : 'N/A';
    const lastCommentAt = thread.lastCommentAt?.toDate ? new Date(thread.lastCommentAt.toDate()).toLocaleString() : 'N/A';
    const threadThemeName = getThemeName(thread.themeId);

    threadElement.innerHTML = `
      <div class="flex items-center mb-2">
        <img src="${thread.authorPhotoURL || DEFAULT_PROFILE_PIC}" alt="${thread.authorDisplayName}'s profile pic" class="profile-pic-small mr-2">
        <div>
          <p class="thread-title">${thread.title}</p>
          <p class="thread-meta">
            By <span class="font-semibold">${thread.authorHandle}</span> on ${createdAt}
            ${thread.lastCommentAt ? ` | Last activity: ${lastCommentAt}` : ''}
            | Comments: ${thread.commentsCount || 0}
            | Category: <span class="font-semibold text-blue-400">${threadThemeName}</span>
          </p>
        </div>
      </div>
      <div class="thread-content line-clamp-2">${marked.parse(thread.content || '')}</div>
    `;
    threadsList.appendChild(threadElement);

    threadElement.addEventListener('click', () => openThreadDetailModal(thread.id));
  });
}

/**
 * Opens the modal to display a specific thread and its comments.
 * @param {string} threadId - The ID of the thread to display.
 */
async function openThreadDetailModal(threadId) {
  currentThreadId = threadId;
  if (unsubscribeComments) {
    unsubscribeComments();
  }

  if (modalThreadTitle) modalThreadTitle.textContent = 'Loading...';
  if (modalThreadMeta) modalThreadMeta.textContent = '';
  if (modalThreadContent) modalThreadContent.innerHTML = '<p class="text-gray-300">Loading thread content...</p>';
  if (commentsList) commentsList.innerHTML = '<p class="text-gray-300 text-center">Loading comments...</p>';
  if (threadReactionsContainer) threadReactionsContainer.innerHTML = '';

  if (threadDetailModal) threadDetailModal.style.display = 'flex';

  try {
    const threadDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
    const threadSnap = await getDoc(threadDocRef);

    if (threadSnap.exists()) {
      const threadData = threadSnap.data();
      if (modalThreadTitle) modalThreadTitle.textContent = threadData.title;

      const createdAt = threadData.createdAt?.toDate ? new Date(threadData.createdAt.toDate()).toLocaleString() : 'N/A';
      const lastCommentAt = threadData.lastCommentAt?.toDate ? new Date(threadData.lastCommentAt.toDate()).toLocaleString() : 'N/A';
      const allThemes = await getAvailableThemes();
      const threadThemeName = allThemes.find(t => t.id === threadData.themeId)?.name || 'Uncategorized';

      if (modalThreadMeta) modalThreadMeta.innerHTML = `By <span class="font-semibold">${threadData.authorHandle}</span> on ${createdAt} ${threadData.lastCommentAt ? `| Last activity: ${lastCommentAt}` : ''} | Comments: ${threadData.commentsCount || 0} | Category: <span class="font-semibold text-blue-400">${threadThemeName}</span>`;

      if (modalThreadContent) modalThreadContent.innerHTML = marked.parse(threadData.content || '');

      renderReactions(threadData.reactions || {});

      const commentsCollectionRef = collection(db, `artifacts/${appId}/public/data/forum_threads/${threadId}/comments`);
      const q = query(commentsCollectionRef);
      unsubscribeComments = onSnapshot(q, (snapshot) => {
        const comments = [];
        snapshot.forEach(commentDoc => {
          comments.push({ id: commentDoc.id, ...commentDoc.data() });
        });
        comments.sort((a, b) => (a.createdAt?.toDate()?.getTime() || 0) - (b.createdAt?.toDate()?.getTime() || 0));
        renderComments(comments);
      }, (error) => {
        console.error("Error listening to comments:", error);
        if (commentsList) commentsList.innerHTML = `<p class="text-red-400 text-center">Error loading comments: ${error.message}</p>`;
      });

    } else {
      if (modalThreadTitle) modalThreadTitle.textContent = 'Thread Not Found';
      if (modalThreadMeta) modalThreadMeta.textContent = '';
      if (modalThreadContent) modalThreadContent.innerHTML = '<p class="text-red-400">The requested thread does not exist.</p>';
      if (commentsList) commentsList.innerHTML = '';
      showMessageBox("Thread not found.", true);
    }
  } catch (error) {
    console.error("Error opening thread modal:", error);
    showMessageBox(`Error loading thread: ${error.message}`, true);
  }
}

// --- Comment Functions (remain largely the same) ---

/**
 * Handles adding a new comment to the current thread.
 * @param {Event} event - The form submission event.
 */
async function handleAddComment(event) {
  event.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to post a comment.", true);
    return;
  }
  if (!currentThreadId) {
    showMessageBox("No thread selected to comment on.", true);
    return;
  }

  const content = commentContentTextarea.value.trim();
  if (!content) {
    showMessageBox("Comment cannot be empty.", true);
    return;
  }

  try {
    const userProfile = await getUserProfileFromFirestore(user.uid);
    const authorDisplayName = userProfile?.displayName || user.displayName || 'Anonymous';
    const authorHandle = userProfile?.handle || `user${user.uid.substring(0, 5)}`;
    const authorPhotoURL = userProfile?.photoURL || DEFAULT_PROFILE_PIC;

    const commentsCollectionRef = collection(db, `artifacts/${appId}/public/data/forum_threads/${currentThreadId}/comments`);
    await addDoc(commentsCollectionRef, {
      content: content,
      authorId: user.uid,
      authorDisplayName: authorDisplayName,
      authorHandle: authorHandle,
      authorPhotoURL: authorPhotoURL,
      createdAt: serverTimestamp()
    });

    const threadDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, currentThreadId);
    const threadSnap = await getDoc(threadDocRef);
    const currentCommentsCount = threadSnap.exists() ? threadSnap.data().commentsCount || 0 : 0;

    await updateDoc(threadDocRef, {
      commentsCount: currentCommentsCount + 1,
      lastCommentAt: serverTimestamp()
    });

    commentContentTextarea.value = '';
    showMessageBox("Comment posted successfully!", false);
    await renderThreads(currentThreadFilterThemeId); // Re-render threads list to update comment count/last activity
  } catch (error) {
    console.error("Error adding comment:", error);
    showMessageBox(`Error posting comment: ${error.message}`, true);
  }
}

/**
 * Renders the list of comments for the current thread.
 * @param {Array<Object>} comments - An array of comment objects.
 */
function renderComments(comments) {
  if (!commentsList) return;
  commentsList.innerHTML = '';

  if (comments.length === 0) {
    commentsList.innerHTML = '<p class="text-gray-300 text-center">No comments yet. Be the first to reply!</p>';
    return;
  }

  comments.forEach(comment => {
    const commentElement = document.createElement('div');
    commentElement.classList.add('comment-item');
    commentElement.innerHTML = `
      <div class="flex items-center mb-2">
        <img src="${comment.authorPhotoURL || DEFAULT_PROFILE_PIC}" alt="${comment.authorDisplayName}'s profile pic" class="profile-pic-small mr-2">
        <p class="font-semibold text-text-primary">${comment.authorHandle}</p>
        <p class="text-comment-meta ml-auto">${comment.createdAt?.toDate ? new Date(comment.createdAt.toDate()).toLocaleString() : 'N/A'}</p>
      </div>
      <p class="comment-content">${marked.parse(comment.content || '')}</p>
    `;
    commentsList.appendChild(commentElement);
  });
}

// --- Reaction Functions (remain largely the same) ---

const availableEmojis = ['👍', '👎', '❤️', '😂', '😢', '🔥', '🤔'];

/**
 * Renders the reaction buttons and counts for a thread.
 * @param {Object} reactions - The reactions object from thread data.
 */
function renderReactions(reactions) {
  if (!threadReactionsContainer) return;
  threadReactionsContainer.innerHTML = '';

  const user = auth.currentUser;
  const currentUserId = user ? user.uid : null;

  availableEmojis.forEach(emoji => {
    const count = Object.keys(reactions[emoji] || {}).length;
    const hasReacted = currentUserId && reactions[emoji]?.[currentUserId];

    const button = document.createElement('button');
    button.classList.add('reaction-btn', 'px-3', 'py-1', 'rounded-full', 'border', 'border-input-border', 'bg-input-bg', 'text-text-primary', 'flex', 'items-center', 'space-x-1', 'hover:bg-input-border', 'transition');
    if (hasReacted) {
      button.classList.add('reacted');
    }
    button.innerHTML = `
      <span>${emoji}</span>
      <span class="text-sm">${count}</span>
    `;
    button.addEventListener('click', () => toggleReaction(currentThreadId, emoji));
    threadReactionsContainer.appendChild(button);
  });
}

/**
 * Toggles a user's reaction to a thread.
 * @param {string} threadId - The ID of the thread.
 * @param {string} emoji - The emoji character for the reaction.
 */
async function toggleReaction(threadId, emoji) {
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to react.", true);
    return;
  }

  try {
    const threadDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
    const threadSnap = await getDoc(threadDocRef);

    if (threadSnap.exists()) {
      const threadData = threadSnap.data();
      const reactions = threadData.reactions || {};
      const emojiReactions = reactions[emoji] || {};

      let newReactions = { ...reactions };

      if (emojiReactions[user.uid]) {
        delete emojiReactions[user.uid];
        if (Object.keys(emojiReactions).length === 0) {
          delete newReactions[emoji];
        } else {
          newReactions[emoji] = emojiReactions;
        }
      } else {
        newReactions[emoji] = { ...emojiReactions, [user.uid]: true };
      }

      await updateDoc(threadDocRef, { reactions: newReactions });
      showMessageBox("Reaction updated!", false);
    }
  } catch (error) {
    console.error("Error toggling reaction:", error);
    showMessageBox(`Error updating reaction: ${error.message}`, true);
  }
}

// --- Temporary Pages Functions ---

/**
 * Fetches all temporary pages from Firestore.
 * @returns {Promise<Array<Object>>} An array of temporary page objects.
 */
async function fetchTemporaryPages() {
  if (!db) {
    console.error("Firestore DB not initialized for fetching temporary pages.");
    return [];
  }
  const tempPagesCollectionRef = collection(db, `artifacts/${appId}/public/data/temp_pages`);
  try {
    const querySnapshot = await getDocs(tempPagesCollectionRef);
    const pages = [];
    querySnapshot.forEach(doc => {
      pages.push({ id: doc.id, ...doc.data() });
    });
    pages.sort((a, b) => (b.createdAt?.toDate()?.getTime() || 0) - (a.createdAt?.toDate()?.getTime() || 0));
    console.log("Temporary pages fetched and sorted:", pages.length);
    return pages;
  } catch (error) {
    console.error("Error fetching temporary pages:", error);
    showMessageBox(`Error loading temporary pages: ${error.message}`, true);
    return [];
  }
}

/**
 * Renders the list of temporary pages as clickable buttons.
 */
async function renderTemporaryPages() {
  if (!temporaryPagesList) return;
  temporaryPagesList.innerHTML = '<p class="text-gray-300">Loading temporary pages...</p>';
  const pages = await fetchTemporaryPages();
  temporaryPagesList.innerHTML = '';

  if (pages.length === 0) {
    temporaryPagesList.innerHTML = '<p class="text-gray-300">No temporary pages available.</p>';
    return;
  }

  pages.forEach(page => {
    const li = document.createElement('li');
    li.classList.add('flex', 'items-center', 'justify-between');

    const button = document.createElement('button');
    button.classList.add(
      'bg-blue-600', 'hover:bg-blue-700', 'text-white', 'font-bold', 'py-2', 'px-4',
      'rounded-full', 'transition', 'duration-300', 'ease-in-out', 'shadow-lg', 'text-sm',
      'w-full', 'text-left'
    );
    button.textContent = page.title;
    button.addEventListener('click', () => {
      // Link to temp-page-viewer.html with the page ID
      window.open(`temp-page-viewer.html?id=${page.id}`, '_blank');
    });

    li.appendChild(button);
    temporaryPagesList.appendChild(li);
  });
}

// --- Thread Categories / Themes for Filtering (New) ---

/**
 * Renders buttons for available themes to filter threads.
 */
async function renderThreadCategories() {
  if (!threadCategoryListDiv) return;
  threadCategoryListDiv.innerHTML = '<p class="text-gray-300 text-center">Loading categories...</p>';

  const allThemes = await getAvailableThemes(); // Get all themes (visual + custom)
  threadCategoryListDiv.innerHTML = ''; // Clear loading message

  // Add the "Show All Threads" button back (if it was cleared)
  const showAllBtn = document.createElement('button');
  showAllBtn.id = "show-all-threads-btn"; // Ensure it has the ID
  showAllBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700', 'text-white', 'px-4', 'py-2', 'rounded-full', 'transition', 'duration-300', 'ease-in-out', 'shadow-lg', 'text-sm');
  showAllBtn.textContent = 'All Threads';
  showAllBtn.addEventListener('click', () => {
    currentThreadFilterThemeId = null;
    renderThreads(null);
    showMessageBox("Showing all threads.", false);
    // Highlight 'All Threads' button and un-highlight others
    highlightCategoryButton(null);
  });
  threadCategoryListDiv.appendChild(showAllBtn);

  // Render buttons for each theme
  allThemes.forEach(theme => {
    const button = document.createElement('button');
    button.classList.add(
      'bg-gray-500', 'hover:bg-gray-600', 'text-white', 'px-4', 'py-2',
      'rounded-full', 'transition', 'duration-300', 'ease-in-out', 'shadow-lg', 'text-sm',
      'category-filter-btn' // Add a common class for these buttons
    );
    button.textContent = theme.name;
    button.dataset.themeId = theme.id;
    button.addEventListener('click', () => {
      currentThreadFilterThemeId = theme.id; // Set the filter
      applyTheme(theme.id, theme); // Also apply the visual theme
      renderThreads(theme.id); // Filter threads
      showMessageBox(`Showing threads for category: ${theme.name}`, false);
      // Highlight the clicked button
      highlightCategoryButton(theme.id);
    });
    threadCategoryListDiv.appendChild(button);
  });

  // Apply initial highlight based on currentThreadFilterThemeId
  highlightCategoryButton(currentThreadFilterThemeId);
}

/**
 * Highlights the currently active category button and un-highlights others.
 * @param {string|null} activeThemeId - The ID of the theme to highlight, or null for "All Threads".
 */
function highlightCategoryButton(activeThemeId) {
  const buttons = threadCategoryListDiv.querySelectorAll('.category-filter-btn');
  const allThreadsButton = document.getElementById('show-all-threads-btn');

  // Reset all buttons to default style
  buttons.forEach(btn => {
    btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    btn.classList.add('bg-gray-500', 'hover:bg-gray-600');
  });

  if (allThreadsButton) {
    allThreadsButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    allThreadsButton.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
  }


  if (activeThemeId === null) {
    // Highlight "All Threads" button
    if (allThreadsButton) {
      allThreadsButton.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
      allThreadsButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
    }
  } else {
    // Highlight the specific theme button
    const activeBtn = threadCategoryListDiv.querySelector(`button[data-theme-id="${activeThemeId}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('bg-gray-500', 'hover:bg-gray-600');
      activeBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    }
  }
}
