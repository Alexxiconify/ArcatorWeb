// forms.js: This script handles forum thread, comment, reaction,
// announcement, and direct message functionality for the community hub.

/* global EasyMDE, marked, DOMPurify */ // Explicitly declare global variables

// --- Firebase SDK Imports ---
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Local Module Imports ---
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js';
import { loadNavbar } from './navbar.js';
import { showMessageBox, showCustomConfirm, COMMON_EMOJIS, parseEmojis, parseMentions, renderReactionButtons } from './utils.js';
import { getUserProfileFromFirestore, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, auth, db, appId, firebaseReadyPromise, ADMIN_UIDS } from './firebase-init.js';


// --- DOM Elements ---
// Tab Navigation
const threadsTabButton = document.getElementById('threads-tab');
const announcementsTabButton = document.getElementById('announcements-tab');
const conversationsTabButton = document.getElementById('conversations-tab');
const allTabButtons = [threadsTabButton, announcementsTabButton, conversationsTabButton];

// Tab Panels
const threadsPanel = document.getElementById('threads-panel');
const announcementsPanel = document.getElementById('announcements-panel');
const conversationsPanel = document.getElementById('conversations-panel');
const allTabPanels = [threadsPanel, announcementsPanel, conversationsPanel];


// Threads Section Elements
const createThreadForm = document.getElementById('create-thread-form');
const threadTitleInput = document.getElementById('thread-title');
const threadThemeSelect = document.getElementById('thread-theme-select');
const threadContentInput = document.getElementById('thread-content');
const createThreadSection = document.getElementById('create-thread-section');
const forumLoginRequiredMessage = document.getElementById('forum-login-required-message');

const categoryFilterButtonsContainer = document.getElementById('category-filter-buttons');
const categoriesLoadingMessage = document.getElementById('categories-loading-message');
const noCategoriesMessage = document.getElementById('no-categories-message');
const categoriesErrorMessage = document.getElementById('categories-error-message');

const actualThreadsList = document.getElementById('actual-threads-list');
const threadsLoadingMessage = document.getElementById('threads-loading-message');
const threadsErrorMessage = document.getElementById('threads-error-message');
const noThreadsMessage = document.getElementById('no-threads-message');

// Announcements Section Elements
const actualAnnouncementsList = document.getElementById('actual-announcements-list');
const announcementsLoadingMessage = document.getElementById('announcements-loading-message');
const announcementsErrorMessage = document.getElementById('announcements-error-message');
const noAnnouncementsMessage = document.getElementById('no-announcements-message');

// Conversations Section Elements
const actualRecentDMsList = document.getElementById('actual-recent-dms-list');
const dmsLoadingMessage = document.getElementById('dms-loading-message');
const dmsErrorMessage = document.getElementById('dms-error-error-message'); // Corrected ID
const noDMsMessage = document.getElementById('no-dms-message');


// Modal Elements (for Thread Detail)
const threadDetailModal = document.getElementById('thread-detail-modal');
const modalThreadTitle = document.getElementById('modal-thread-title');
const modalThreadMeta = document.getElementById('modal-thread-meta');
const modalThreadContent = document.getElementById('modal-thread-content');
const addCommentForm = document.getElementById('add-comment-form');
const commentContentInput = document.getElementById('comment-content');
const commentsList = document.getElementById('comments-list');
const threadReactionsContainer = document.getElementById('thread-reactions-container');


// --- State Variables ---
let easyMDECreateThread;
let currentThreadId = null;
let unsubscribeComments = null;
let unsubscribeReactions = null;
let availableForumThemes = [];


// --- Utility Functions ---

/**
 * Toggles the 'hidden' class and display style for a given HTML element.
 * @param {HTMLElement} element - The DOM element to manage visibility for.
 * @param {boolean} show - If true, element is shown; otherwise, it's hidden.
 */
function toggleVisibility(element, show) {
  if (element) {
    if (show) {
      element.classList.remove('hidden');
      element.style.display = ''; // Clear inline style that might set display: none
    } else {
      element.classList.add('hidden');
    }
  }
}

/**
 * Activates a specific tab and shows its content, hiding others.
 * @param {string} tabId - The data-tab attribute of the tab to activate (e.g., 'threads', 'announcements', 'conversations').
 */
function activateTab(tabId) {
  allTabButtons.forEach(button => {
    if (button.dataset.tab === tabId) {
      button.classList.add('active');
      button.setAttribute('aria-selected', 'true');
    } else {
      button.classList.remove('active');
      button.setAttribute('aria-selected', 'false');
    }
  });

  allTabPanels.forEach(panel => {
    if (panel.id === `${tabId}-panel`) {
      toggleVisibility(panel, true);
    } else {
      toggleVisibility(panel, false);
    }
  });

  // Re-fetch content when a tab is activated to ensure freshness.
  // This also handles initial load for the default tab.
  switch (tabId) {
    case 'threads':
      fetchThreads('all');
      break;
    case 'announcements':
      fetchAnnouncements();
      break;
    case 'conversations':
      fetchConversations(); // This already handles auth state
      break;
  }
  console.log(`DEBUG: Activated tab: ${tabId}`);
}


// --- Forum Thread Functions ---

/**
 * Fetches all available forum themes from Firestore.
 * Updates loading/error/empty messages accordingly.
 * @returns {Promise<Array>} A promise that resolves with an array of theme objects.
 */
async function fetchForumThemes() {
  toggleVisibility(categoriesLoadingMessage, true);
  toggleVisibility(noCategoriesMessage, false);
  toggleVisibility(categoriesErrorMessage, false);
  if (categoryFilterButtonsContainer) categoryFilterButtonsContainer.innerHTML = '';

  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for fetching forum themes.");
    toggleVisibility(categoriesLoadingMessage, false);
    toggleVisibility(categoriesErrorMessage, true);
    return [];
  }

  const themesCol = collection(db, `artifacts/${appId}/public/data/themes`);
  console.log("DEBUG: Attempting to fetch themes from path:", `artifacts/${appId}/public/data/themes`);
  try {
    const querySnapshot = await getDocs(themesCol);
    availableForumThemes = [];
    querySnapshot.forEach(doc => {
      availableForumThemes.push({ id: doc.id, ...doc.data() });
    });
    console.log("DEBUG: Fetched forum themes. Count:", availableForumThemes.length);

    toggleVisibility(categoriesLoadingMessage, false);
    if (availableForumThemes.length === 0) {
      toggleVisibility(noCategoriesMessage, true);
    } else {
      populateThreadCategorySelect();
      renderCategoryFilterButtons(availableForumThemes, 'all');
    }
    return availableForumThemes;
  } catch (error) {
    console.error("Error fetching forum themes:", error);
    toggleVisibility(categoriesLoadingMessage, false);
    toggleVisibility(categoriesErrorMessage, true);
    showMessageBox(`Error loading forum categories: ${error.message}`, true);
    return [];
  }
}

/**
 * Populates the thread theme select dropdown with available themes.
 */
function populateThreadCategorySelect() {
  if (!threadThemeSelect) return;
  threadThemeSelect.innerHTML = '<option value="">Select a Theme</option>';
  if (availableForumThemes.length === 0) {
    threadThemeSelect.innerHTML += '<option value="" disabled>No themes available</option>';
    return;
  }
  availableForumThemes.forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    threadThemeSelect.appendChild(option);
  });
}

/**
 * Renders the theme filter buttons dynamically.
 * @param {Array} themes - Array of theme objects.
 * @param {string} activeThemeId - The ID of the currently active theme filter, or 'all'.
 */
function renderCategoryFilterButtons(themes, activeThemeId = 'all') {
  if (!categoryFilterButtonsContainer) return;
  categoryFilterButtonsContainer.innerHTML = '';

  const allThreadsButton = document.createElement('button');
  allThreadsButton.textContent = 'All Threads';
  allThreadsButton.dataset.categoryId = 'all';
  allThreadsButton.classList.add('px-4', 'py-2', 'rounded-full', 'transition', 'duration-300', 'ease-in-out', 'shadow-lg', 'text-sm');
  if (activeThemeId === 'all') {
    allThreadsButton.classList.add('active-category-filter');
  }
  allThreadsButton.addEventListener('click', () => {
    filterThreadsByCategory('all');
    updateActiveFilterButton('all');
  });
  categoryFilterButtonsContainer.appendChild(allThreadsButton);

  themes.forEach(theme => {
    const button = document.createElement('button');
    button.textContent = theme.name;
    button.dataset.categoryId = theme.id;
    button.classList.add('px-4', 'py-2', 'rounded-full', 'transition', 'duration-300', 'ease-in-out', 'shadow-lg', 'text-sm');
    if (activeThemeId === theme.id) {
      button.classList.add('active-category-filter');
    }
    button.addEventListener('click', () => {
      filterThreadsByCategory(theme.id);
      updateActiveFilterButton(theme.id);
    });
    categoryFilterButtonsContainer.appendChild(button);
  });
}

/**
 * Updates the visual active state of the theme filter buttons.
 * @param {string} activeId - The ID of the currently active theme.
 */
function updateActiveFilterButton(activeId) {
  document.querySelectorAll('#category-filter-buttons button').forEach(button => {
    if (button.dataset.categoryId === activeId) {
      button.classList.add('active-category-filter');
    } else {
      button.classList.remove('active-category-filter');
    }
  });
}

/**
 * Filters and re-fetches threads based on the selected theme.
 * @param {string} themeId - The ID of the theme to filter by, or 'all'.
 */
async function filterThreadsByCategory(themeId) {
  await fetchThreads(themeId);
}

/**
 * Creates a new forum thread in Firestore.
 * @param {string} title - The title of the thread.
 * @param {string} content - The content of the thread (Markdown).
 * @param {string} themeId - The ID of the selected theme.
 */
async function createThread(title, content, themeId) {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to create a thread.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot create thread.", true);
    return;
  }
  if (!themeId) {
    showMessageBox("Please select a theme for your thread.", true);
    return;
  }

  const threadsCol = collection(db, `artifacts/${appId}/public/data/forum_threads`);
  try {
    const docRef = await addDoc(threadsCol, {
      title: title,
      content: content,
      authorUid: user.uid,
      authorDisplayName: user.displayName || user.email,
      authorProfilePic: user.photoURL || DEFAULT_PROFILE_PIC,
      themeId: themeId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      commentsCount: 0,
      reactions: {}
    });
    showMessageBox("Thread created successfully!", false);
    if (createThreadForm) createThreadForm.reset();
    if (easyMDECreateThread) easyMDECreateThread.value('');
    if (threadThemeSelect) threadThemeSelect.value = '';
    await fetchThreads('all'); // Refresh the list after creating a new thread
  } catch (error) {
    console.error("Error creating thread:", error);
    showMessageBox(`Error creating thread: ${error.message}`, true);
  }
}

/**
 * Fetches forum threads from Firestore, optionally filtered by theme.
 * Manages loading, error, and empty state messages.
 * @param {string|null} themeId - The ID of the theme to filter by, or 'all'/'null' for all threads.
 */
async function fetchThreads(themeId = 'all') {
  toggleVisibility(threadsLoadingMessage, true);
  toggleVisibility(threadsErrorMessage, false);
  toggleVisibility(noThreadsMessage, false);
  if (actualThreadsList) actualThreadsList.innerHTML = '';

  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for fetching threads.");
    toggleVisibility(threadsLoadingMessage, false);
    toggleVisibility(threadsErrorMessage, true);
    return;
  }

  let threadsQuery = collection(db, `artifacts/${appId}/public/data/forum_threads`);

  if (themeId && themeId !== 'all') {
    threadsQuery = query(threadsQuery, where("themeId", "==", themeId));
  }
  threadsQuery = query(threadsQuery, orderBy("createdAt", "desc"));

  try {
    const querySnapshot = await getDocs(threadsQuery);
    const threads = [];
    querySnapshot.forEach(doc => {
      threads.push({ id: doc.id, ...doc.data() });
    });

    toggleVisibility(threadsLoadingMessage, false);
    if (threads.length === 0) {
      toggleVisibility(noThreadsMessage, true);
    } else {
      renderThreads(threads);
    }
  } catch (error) {
    console.error("Error fetching threads:", error);
    toggleVisibility(threadsLoadingMessage, false);
    toggleVisibility(threadsErrorMessage, true);
    showMessageBox(`Error loading threads: ${error.message}`, true);
  }
}

/**
 * Renders the list of forum threads into the DOM.
 * @param {Array} threads - An array of thread objects.
 */
async function renderThreads(threads) {
  if (!actualThreadsList) return;
  actualThreadsList.innerHTML = '';

  if (threads.length === 0) {
    toggleVisibility(noThreadsMessage, true);
    return;
  }

  for (const thread of threads) {
    const threadElement = document.createElement('div');
    threadElement.classList.add('thread-item', 'mb-6');

    let authorDisplayName = thread.authorDisplayName || "Anonymous";
    let authorProfilePic = thread.authorProfilePic || DEFAULT_PROFILE_PIC;
    try {
      const authorProfile = await getUserProfileFromFirestore(thread.authorUid);
      if (authorProfile) {
        authorDisplayName = authorProfile.displayName || authorDisplayName;
        authorProfilePic = authorProfile.photoURL || authorProfilePic;
      }
    } catch (e) {
      console.warn("Could not fetch author profile for thread:", thread.authorUid, e);
    }

    const formattedDate = thread.createdAt?.toDate ? new Date(thread.createdAt.toDate()).toLocaleString() : 'N/A';
    const commentsCount = thread.commentsCount || 0;

    let themeName = 'Uncategorized';
    if (thread.themeId) {
      const theme = availableForumThemes.find(t => t.id === thread.themeId);
      if (theme) {
        themeName = theme.name;
      }
    }

    const sanitizedContent = DOMPurify.sanitize(marked.parse(thread.content || ''));
    const contentPreview = sanitizedContent.length > 200 ? sanitizedContent.substring(0, 200) + '...' : sanitizedContent;

    threadElement.innerHTML = `
      <div class="flex items-center mb-4">
        <img src="${authorProfilePic}" alt="${authorDisplayName}'s profile picture" class="profile-pic-small mr-3">
        <div>
          <p class="text-text-primary font-semibold">${authorDisplayName}</p>
          <p class="text-text-secondary text-xs">${formattedDate}</p>
        </div>
      </div>
      <h3 class="thread-title mb-2 cursor-pointer text-xl font-bold">${parseEmojis(thread.title)}</h3>
      <p class="thread-meta text-sm">${commentsCount} comments | Theme: <span class="thread-category-tag">${themeName}</span></p>
      <div class="thread-content-preview prose text-text-primary mt-2 max-w-none">${parseEmojis(await parseMentions(contentPreview))}</div>
      <button class="bg-button-blue-bg text-button-text px-4 py-2 rounded-md hover:bg-button-blue-hover transition duration-300 view-thread-btn mt-4" data-id="${thread.id}">View Thread</button>
    `;
    actualThreadsList.appendChild(threadElement);
  }

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
  await firebaseReadyPromise;
  currentThreadId = threadId;

  if (modalThreadTitle) modalThreadTitle.textContent = 'Loading...';
  if (modalThreadMeta) modalThreadMeta.textContent = '';
  if (modalThreadContent) modalThreadContent.innerHTML = '<p>Loading thread content...</p>';
  if (commentsList) commentsList.innerHTML = '<p class="text-text-secondary text-center">Loading comments...</p>';
  if (threadReactionsContainer) threadReactionsContainer.innerHTML = '';

  toggleVisibility(threadDetailModal, true);

  const threadDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
  try {
    const threadSnap = await getDoc(threadDocRef);
    if (threadSnap.exists()) {
      const threadData = threadSnap.data();

      let authorDisplayName = threadData.authorDisplayName || "Anonymous";
      let authorProfilePic = threadData.authorProfilePic || DEFAULT_PROFILE_PIC;
      try {
        const authorProfile = await getUserProfileFromFirestore(threadData.authorUid);
        if (authorProfile) {
          authorDisplayName = authorProfile.displayName || authorDisplayName;
          authorProfilePic = authorProfile.photoURL || authorProfilePic;
        }
      } catch (e) {
        console.warn("Could not fetch author profile for thread detail:", threadData.authorUid, e);
      }

      const formattedDate = threadData.createdAt?.toDate ? new Date(threadData.createdAt.toDate()).toLocaleString() : 'N/A';
      const themeName = availableForumThemes.find(t => t.id === threadData.themeId)?.name || 'Uncategorized';

      if (modalThreadTitle) modalThreadTitle.textContent = parseEmojis(threadData.title);
      if (modalThreadMeta) modalThreadMeta.innerHTML = `By ${authorDisplayName} on ${formattedDate} | Comments: ${threadData.commentsCount || 0} | Theme: /t/${themeName}`;
      if (modalThreadContent) modalThreadContent.innerHTML = parseEmojis(await parseMentions(DOMPurify.sanitize(marked.parse(threadData.content || ''))));

      setupCommentsListener(threadId);
      setupReactionsListener(threadId);

      if (auth.currentUser) {
        toggleVisibility(addCommentForm, true);
      } else {
        toggleVisibility(addCommentForm, false);
      }

    } else {
      if (modalThreadContent) modalThreadContent.innerHTML = '<p class="text-red-500">Thread not found.</p>';
      if (commentsList) commentsList.innerHTML = '';
      if (threadReactionsContainer) threadReactionsContainer.innerHTML = '';
      toggleVisibility(addCommentForm, false);
    }
  } catch (error) {
    console.error("Error fetching thread details:", error);
    if (modalThreadContent) modalThreadContent.innerHTML = `<p class="text-red-500">Error loading thread: ${error.message}</p>`;
    if (commentsList) commentsList.innerHTML = '';
    if (threadReactionsContainer) threadReactionsContainer.innerHTML = '';
    toggleVisibility(addCommentForm, false);
  }
}

/**
 * Sets up a real-time listener for comments on the current thread.
 * @param {string} threadId - The ID of the thread.
 */
function setupCommentsListener(threadId) {
  if (unsubscribeComments) {
    unsubscribeComments();
  }

  const commentsColRef = collection(db, `artifacts/${appId}/public/data/forum_threads`, threadId, 'comments');
  const q = query(commentsColRef, orderBy('createdAt', 'asc'));

  unsubscribeComments = onSnapshot(q, async (snapshot) => {
    if (commentsList) commentsList.innerHTML = '';
    if (snapshot.empty) {
      if (commentsList) commentsList.innerHTML = '<p class="text-text-secondary text-center">No comments yet. Be the first to reply!</p>';
      await updateThreadCommentsCount(threadId, 0);
      return;
    }

    let count = 0;
    for (const commentDoc of snapshot.docs) {
      count++;
      const comment = commentDoc.data();
      const commentElement = document.createElement('div');
      commentElement.classList.add('comment-card');

      let authorDisplayName = comment.authorDisplayName || "Anonymous";
      let authorProfilePic = comment.authorProfilePic || DEFAULT_PROFILE_PIC;
      try {
        const authorProfile = await getUserProfileFromFirestore(comment.authorUid);
        if (authorProfile) {
          authorDisplayName = authorProfile.displayName || authorDisplayName;
          authorProfilePic = authorProfile.photoURL || authorProfilePic;
        }
      } catch (e) {
        console.warn("Could not fetch author profile for comment:", comment.authorUid, e);
      }

      const formattedDate = comment.createdAt?.toDate ? new Date(comment.createdAt.toDate()).toLocaleString() : 'N/A';
      const parsedContent = parseEmojis(await parseMentions(DOMPurify.sanitize(marked.parse(comment.content || ''))));

      commentElement.innerHTML = `
        <div class="flex items-center mb-2">
          <img src="${authorProfilePic}" alt="${authorDisplayName}'s profile picture" class="profile-pic-small mr-2">
          <div>
            <p class="author-handle font-semibold">${authorDisplayName}</p>
            <p class="timestamp text-xs">${formattedDate}</p>
          </div>
        </div>
        <div class="prose mb-2">${parsedContent}</div>
        ${auth.currentUser && (auth.currentUser.uid === comment.authorUid || ADMIN_UIDS.includes(auth.currentUser.uid)) ? `<button class="text-red-500 hover:text-red-700 text-sm delete-comment-btn absolute top-2 right-2" data-comment-id="${commentDoc.id}">Delete</button>` : ''}
      `;
      if (commentsList) commentsList.appendChild(commentElement);
    }
    await updateThreadCommentsCount(threadId, count);

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
  });
}

/**
 * Sets up a real-time listener for reactions on the current thread.
 * @param {string} threadId - The ID of the thread.
 */
function setupReactionsListener(threadId) {
  if (unsubscribeReactions) {
    unsubscribeReactions();
  }

  const threadDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
  unsubscribeReactions = onSnapshot(threadDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const reactions = docSnap.data().reactions || {};
      if (threadReactionsContainer) {
        renderReactionButtons(
          'thread',
          threadId,
          reactions,
          threadReactionsContainer,
          auth.currentUser
        );
      }
      document.querySelectorAll('#thread-reactions-container .reaction-btn').forEach(button => {
        const emoji = button.textContent.split(' ')[0];
        button.addEventListener('click', () => toggleReaction(threadId, emoji));
      });

    } else {
      if (threadReactionsContainer) threadReactionsContainer.innerHTML = '';
    }
  });
}

/**
 * Toggles a user's reaction to a thread.
 * @param {string} threadId - The ID of the thread.
 * @param {string} emoji - The emoji character (e.g., '👍').
 */
async function toggleReaction(threadId, emoji) {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to react.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot react.", true);
    return;
  }

  const threadRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
  try {
    const threadSnap = await getDoc(threadRef);
    if (!threadSnap.exists()) {
      showMessageBox("Thread not found.", true);
      return;
    }

    const currentReactions = threadSnap.data().reactions || {};
    const emojiReactions = currentReactions[emoji] || {};

    if (emojiReactions[user.uid]) {
      delete emojiReactions[user.uid];
      showMessageBox(`Removed ${emoji} reaction.`, false);
    } else {
      emojiReactions[user.uid] = user.uid;
      showMessageBox(`Added ${emoji} reaction!`, false);
    }

    await updateDoc(threadRef, {
      [`reactions.${emoji}`]: emojiReactions
    });
  }
  catch (error) {
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
  await firebaseReadyPromise;
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

  const commentsCol = collection(db, `artifacts/${appId}/public/data/forum_threads`, currentThreadId, 'comments');
  try {
    await addDoc(commentsCol, {
      content: content,
      authorUid: user.uid,
      authorDisplayName: user.displayName || user.email,
      authorProfilePic: user.photoURL || DEFAULT_PROFILE_PIC,
      createdAt: serverTimestamp()
    });
    showMessageBox("Comment posted successfully!", false);
    if (commentContentInput) commentContentInput.value = '';
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
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to delete comments.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete comment.", true);
    return;
  }

  const commentDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId, 'comments', commentId);
  try {
    const commentSnap = await getDoc(commentDocRef);
    if (!commentSnap.exists()) {
      showMessageBox("Comment not found.", true);
      return;
    }

    const commentData = commentSnap.data();
    if (commentData.authorUid !== user.uid && !ADMIN_UIDS.includes(user.uid)) {
      showMessageBox("You do not have permission to delete this comment.", true);
      return;
    }

    await deleteDoc(commentDocRef);
    showMessageBox("Comment deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting comment:", error);
    showMessageBox(`Error deleting comment: ${error.message}`, true);
  }
}

/**
 * Updates the comments count in a thread's Firestore document.
 * @param {string} threadId - The ID of the thread.
 * @param {number} count - The new comments count.
 */
async function updateThreadCommentsCount(threadId, count) {
  await firebaseReadyPromise;
  if (!db) {
    console.error("DB not initialized for updating comments count.");
    return;
  }
  const threadRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
  try {
    await updateDoc(threadRef, {
      commentsCount: count,
      updatedAt: serverTimestamp()
    });
    const activeCategoryId = document.querySelector('#category-filter-buttons .active-category-filter')?.dataset.categoryId || 'all';
    await fetchThreads(activeCategoryId);
  } catch (error) {
    console.error("Error updating thread comments count:", error);
  }
}

/**
 * Handles the click of the modal close button.
 */
function closeModal() {
  toggleVisibility(threadDetailModal, false);
  if (unsubscribeComments) {
    unsubscribeComments();
    unsubscribeComments = null;
  }
  if (unsubscribeReactions) {
    unsubscribeReactions();
    unsubscribeReactions = null;
  }
  currentThreadId = null;
}


// --- Announcement Functions ---

/**
 * Fetches announcements from Firestore.
 * Manages loading, error, and empty state messages.
 */
async function fetchAnnouncements() {
  toggleVisibility(announcementsLoadingMessage, true);
  toggleVisibility(noAnnouncementsMessage, false);
  toggleVisibility(announcementsErrorMessage, false);
  if (actualAnnouncementsList) actualAnnouncementsList.innerHTML = '';

  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for fetching announcements.");
    toggleVisibility(announcementsLoadingMessage, false);
    toggleVisibility(announcementsErrorMessage, true);
    return;
  }

  const announcementsCol = collection(db, `artifacts/${appId}/public/data/announcements`);
  const q = query(announcementsCol, orderBy("createdAt", "desc"), limit(5));

  try {
    const querySnapshot = await getDocs(q);
    const announcements = [];
    querySnapshot.forEach(doc => {
      announcements.push({ id: doc.id, ...doc.data() });
    });

    toggleVisibility(announcementsLoadingMessage, false);
    if (announcements.length === 0) {
      toggleVisibility(noAnnouncementsMessage, true);
    } else {
      renderAnnouncements(announcements);
    }
  } catch (error) {
    console.error("Error fetching announcements:", error);
    toggleVisibility(announcementsLoadingMessage, false);
    toggleVisibility(announcementsErrorMessage, true);
  }
}

/**
 * Renders the fetched announcements into the DOM.
 * @param {Array} announcements - Array of announcement objects.
 */
function renderAnnouncements(announcements) {
  if (!actualAnnouncementsList) return;
  actualAnnouncementsList.innerHTML = '';

  if (announcements.length === 0) {
    toggleVisibility(noAnnouncementsMessage, true);
    return;
  }

  announcements.forEach(announcement => {
    const announcementElement = document.createElement('div');
    announcementElement.classList.add('announcement-item', 'mb-2');
    const formattedDate = announcement.createdAt?.toDate ? new Date(announcement.createdAt.toDate()).toLocaleDateString() : 'N/A';
    const sanitizedContent = DOMPurify.sanitize(marked.parse(announcement.content || ''));
    announcementElement.innerHTML = `
      <h4 class="font-semibold text-lg mb-1">${parseEmojis(announcement.title || 'No Title')}</h4>
      <p class="text-text-secondary text-sm mb-2">${formattedDate}</p>
      <div class="prose text-text-primary text-sm max-w-none">${parseEmojis(sanitizedContent)}</div>
    `;
    actualAnnouncementsList.appendChild(announcementElement);
  });
}


// --- Direct Message Functions (Conversations Summary) ---

/**
 * Fetches conversations for the current user.
 * Displays a summary of the latest message in each conversation.
 * Manages loading, error, and empty state messages.
 */
async function fetchConversations() {
  toggleVisibility(dmsLoadingMessage, true);
  toggleVisibility(noDMsMessage, false);
  toggleVisibility(dmsErrorMessage, false);
  if (actualRecentDMsList) actualRecentDMsList.innerHTML = '';

  await firebaseReadyPromise;
  const user = auth.currentUser;

  if (!user) {
    toggleVisibility(dmsLoadingMessage, false);
    toggleVisibility(noDMsMessage, true);
    if (noDMsMessage) noDMsMessage.textContent = 'Sign in to view conversations.';
    return;
  }
  if (!db) {
    console.error("Firestore DB not initialized for fetching DMs.");
    toggleVisibility(dmsLoadingMessage, false);
    toggleVisibility(dmsErrorMessage, true);
    return;
  }

  const dmsCol = collection(db, `artifacts/${appId}/public/data/direct_messages`);
  const q = query(dmsCol, where("participants", "array-contains", user.uid), orderBy("lastMessageAt", "desc"), limit(3));

  try {
    const querySnapshot = await getDocs(q);
    const conversations = [];
    for (const dmDoc of querySnapshot.docs) {
      const dmData = dmDoc.data();

      const otherParticipantUid = dmData.participants.find(uid => uid !== user.uid);
      let otherParticipantName = "Unknown User";
      let otherParticipantPic = DEFAULT_PROFILE_PIC;

      if (otherParticipantUid) {
        const otherProfile = await getUserProfileFromFirestore(otherParticipantUid);
        if (otherProfile) {
          otherParticipantName = otherProfile.displayName || otherParticipantName;
          otherParticipantPic = otherProfile.photoURL || otherParticipantPic;
        }
      }

      let lastMessageContent = dmData.lastMessageContent || "No messages yet.";
      let lastMessageTimestamp = dmData.lastMessageAt?.toDate() || null;

      if (lastMessageContent === "No messages yet." && dmDoc.ref) {
        const messagesColRef = collection(dmDoc.ref, 'messages');
        const latestMessageSnap = await getDocs(query(messagesColRef, orderBy('createdAt', 'desc'), limit(1)));
        if (!latestMessageSnap.empty) {
          const latestMsg = latestMessageSnap.docs[0].data();
          lastMessageContent = latestMsg.content || lastMessageContent;
          lastMessageTimestamp = latestMsg.createdAt?.toDate() || lastMessageTimestamp;
        }
      }

      conversations.push({
        id: dmDoc.id,
        otherParticipantName: otherParticipantName,
        otherParticipantPic: otherParticipantPic,
        lastMessage: lastMessageContent,
        lastMessageAt: lastMessageTimestamp ? new Date(lastMessageTimestamp).toLocaleString() : 'N/A'
      });
    }

    toggleVisibility(dmsLoadingMessage, false);
    if (conversations.length === 0) {
      toggleVisibility(noDMsMessage, true);
      if (user) {
        if (noDMsMessage) noDMsMessage.textContent = 'No conversations available. Start a new one!';
      } else {
        if (noDMsMessage) noDMsMessage.textContent = 'Sign in to view conversations.';
      }
    } else {
      renderConversations(conversations);
    }
  } catch (error) {
    console.error("Error fetching conversations:", error);
    toggleVisibility(dmsLoadingMessage, false);
    toggleVisibility(dmsErrorMessage, true);
  }
}

/**
 * Renders the fetched conversations into the DOM.
 * @param {Array} conversations - Array of conversation objects.
 */
function renderConversations(conversations) {
  if (!actualRecentDMsList) return;
  actualRecentDMsList.innerHTML = '';

  if (conversations.length === 0) {
    toggleVisibility(noDMsMessage, true);
    return;
  }

  conversations.forEach(conv => {
    const dmElement = document.createElement('div');
    dmElement.classList.add('dm-conversation-item', 'mb-2');
    dmElement.innerHTML = `
      <div class="flex items-center mb-1">
        <img src="${conv.otherParticipantPic}" alt="${conv.otherParticipantName}'s profile picture" class="profile-pic-small mr-2">
        <h4 class="font-semibold text-lg">${conv.otherParticipantName}</h4>
      </div>
      <p class="text-text-secondary text-sm mb-1 truncate">${parseEmojis(conv.lastMessage)}</p>
      <p class="text-text-secondary text-xs text-right">${conv.lastMessageAt}</p>
    `;
    actualRecentDMsList.appendChild(dmElement);
  });
}


// --- DOMContentLoaded and Initial Setup ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("forms.js - DOMContentLoaded event fired.");

  // It's crucial to wait for Firebase initialization here
  console.log("DEBUG: Waiting for firebaseReadyPromise...");
  try {
    await firebaseReadyPromise;
    console.log("DEBUG: firebaseReadyPromise resolved in forms.js. Firebase is ready.");
  } catch (error) {
    console.error("CRITICAL ERROR: firebaseReadyPromise rejected:", error);
    showMessageBox("Failed to initialize Firebase. Please check your console for details.", true);
    return; // Stop execution if Firebase isn't ready
  }

  // Load Navbar (depends on Firebase auth/db)
  try {
    await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
    console.log("DEBUG: Navbar loaded successfully.");
  } catch (error) {
    console.error("ERROR: Failed to load navbar:", error);
  }

  // Initialize EasyMDE for new thread creation
  if (threadContentInput) {
    easyMDECreateThread = new EasyMDE({
      element: threadContentInput,
      spellChecker: false,
      forceSync: true,
      minHeight: "150px",
      toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "guide"]
    });
    console.log("DEBUG: EasyMDE initialized for thread creation.");
  } else {
    console.warn("WARNING: threadContentInput element not found. EasyMDE not initialized.");
  }

  // Set up auth state listener for UI visibility and DM fetching
  onAuthStateChanged(auth, async (user) => {
    console.log("DEBUG: onAuthStateChanged callback fired. User:", user ? user.uid : "null");
    if (user) {
      toggleVisibility(createThreadSection, true);
      toggleVisibility(forumLoginRequiredMessage, false);
      toggleVisibility(addCommentForm, true);
      console.log("DEBUG: User authenticated. Create thread and comment forms visible.");
    } else {
      toggleVisibility(createThreadSection, false);
      toggleVisibility(forumLoginRequiredMessage, true);
      toggleVisibility(addCommentForm, false);
      console.log("DEBUG: User not authenticated. Create thread and comment forms hidden.");
    }
    await fetchConversations(); // Fetch conversations here as they depend on user authentication
  });

  // Initial Data Fetches for all tabs
  await fetchForumThemes(); // Populates `availableForumThemes` and category filter buttons
  // Note: fetchThreads, fetchAnnouncements, fetchConversations are called by activateTab.

  // Tab Event Listeners
  allTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      activateTab(button.dataset.tab);
    });
  });

  // Initial Tab Activation (Default to 'threads')
  activateTab('threads');

  // Other Event Listeners (Form submissions, Modal close)
  if (createThreadForm) {
    createThreadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = threadTitleInput.value.trim();
      const content = easyMDECreateThread.value().trim();
      const themeId = threadThemeSelect.value;

      if (!title || !content) {
        showMessageBox("Please enter both title and content for your thread.", true);
        return;
      }
      if (!themeId) {
        showMessageBox("Please select a category/theme for your thread.", true);
        return;
      }
      await createThread(title, content, themeId);
    });
  }


  if (addCommentForm) {
    addCommentForm.addEventListener('submit', addComment);
  }


  if (threadDetailModal && threadDetailModal.querySelector('.close-button')) {
    threadDetailModal.querySelector('.close-button').addEventListener('click', closeModal);
  }

  window.addEventListener('click', (event) => {
    if (event.target === threadDetailModal) {
      closeModal();
    }
  });

  // Set current year for footer
  const currentYearElement = document.getElementById('current-year-forms');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  } else {
    console.warn("WARNING: current-year-forms element not found.");
  }
  console.log("forms.js - Initial setup complete.");
});
