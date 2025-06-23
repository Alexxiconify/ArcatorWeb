// forms.js: This script handles forum thread, comment, reaction,
// announcement, and direct message functionality for the community hub.

/* global EasyMDE, marked */ // Explicitly declare EasyMDE and marked as global variables

// --- Firebase SDK Imports ---
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Local Module Imports ---
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js';
import { loadNavbar } from './navbar.js';
import { showMessageBox, showCustomConfirm, COMMON_EMOJIS, parseEmojis, parseMentions, renderReactionButtons } from './utils.js';
import { getUserProfileFromFirestore, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, auth, db, appId, firebaseReadyPromise, ADMIN_UIDS } from './firebase-init.js';


// --- DOM Elements ---
const createThreadForm = document.getElementById('create-thread-form');
const threadTitleInput = document.getElementById('thread-title');
const threadThemeSelect = document.getElementById('thread-theme-select');
const threadContentInput = document.getElementById('thread-content');
const createThreadSection = document.getElementById('create-thread-section'); // Section containing the form
const forumLoginRequiredMessage = document.getElementById('forum-login-required-message');

const categoryFilterButtonsContainer = document.getElementById('category-filter-buttons');
const categoriesLoadingMessage = document.getElementById('categories-loading-message');
const noCategoriesMessage = document.getElementById('no-categories-message');
const categoriesErrorMessage = document.getElementById('categories-error-message');

const actualThreadsList = document.getElementById('actual-threads-list');
const threadsLoadingMessage = document.getElementById('threads-loading-message');
const threadsErrorMessage = document.getElementById('threads-error-message');
const noThreadsMessage = document.getElementById('no-threads-message');

const actualAnnouncementsList = document.getElementById('actual-announcements-list');
const announcementsLoadingMessage = document.getElementById('announcements-loading-message');
const announcementsErrorMessage = document.getElementById('announcements-error-message');
const noAnnouncementsMessage = document.getElementById('no-announcements-message');

const actualRecentDMsList = document.getElementById('actual-recent-dms-list');
const dmsLoadingMessage = document.getElementById('dms-loading-message');
const dmsErrorMessage = document.getElementById('dms-error-message');
const noDMsMessage = document.getElementById('no-dms-message');


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
let unsubscribeComments = null; // Firestore real-time listener unsubscriber for comments
let unsubscribeReactions = null; // Firestore real-time listener unsubscriber for reactions
let availableForumThemes = []; // Cached list of forum themes


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
 * Parses user mentions in content and converts them to clickable links.
 * Uses a dummy URL for now, assumes user profiles might exist elsewhere.
 * @param {string} text - The text content to parse.
 * @returns {Promise<string>} The parsed HTML string with mentions as links.
 */
// This function is already in utils.js, but re-defining it here for clarity if forms.js relies on it directly
// In a modular setup, you would just import `parseMentions` and use it.
// Assuming it's imported from utils.js, so this comment serves as a reminder.


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
  if (categoryFilterButtonsContainer) categoryFilterButtonsContainer.innerHTML = ''; // Clear existing buttons

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
    availableForumThemes = []; // Clear previous themes
    querySnapshot.forEach(doc => {
      availableForumThemes.push({ id: doc.id, ...doc.data() });
    });
    console.log("DEBUG: Fetched forum themes. Count:", availableForumThemes.length, "Themes:", availableForumThemes);

    toggleVisibility(categoriesLoadingMessage, false);
    if (availableForumThemes.length === 0) {
      toggleVisibility(noCategoriesMessage, true);
    } else {
      populateThreadCategorySelect();
      renderCategoryFilterButtons(availableForumThemes, 'all'); // Render filter buttons
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
    console.log("DEBUG: No available forum themes to populate dropdown.");
    return;
  }

  availableForumThemes.forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    threadThemeSelect.appendChild(option);
  });
  console.log("DEBUG: Thread category select populated.");
}

/**
 * Renders the theme filter buttons dynamically.
 * @param {Array} themes - Array of theme objects.
 * @param {string} activeThemeId - The ID of the currently active theme filter, or 'all'.
 */
function renderCategoryFilterButtons(themes, activeThemeId = 'all') {
  if (!categoryFilterButtonsContainer) return;

  categoryFilterButtonsContainer.innerHTML = ''; // Clear existing buttons

  // Add "All Threads" button
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

  // Add buttons for each theme
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
  console.log("DEBUG: Category filter buttons rendered.");
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
  console.log("DEBUG: Active filter button updated to:", activeId);
}

/**
 * Filters and re-fetches threads based on the selected theme.
 * @param {string} themeId - The ID of the theme to filter by, or 'all'.
 */
async function filterThreadsByCategory(themeId) {
  console.log("DEBUG: Filtering threads by theme:", themeId);
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
    console.log("DEBUG: Thread created:", docRef.id);
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
  if (actualThreadsList) actualThreadsList.innerHTML = ''; // Clear previous threads

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
    console.log(`DEBUG: Querying threads for specific theme: ${themeId}`);
  } else {
    console.log("DEBUG: Querying all threads.");
  }

  threadsQuery = query(threadsQuery, orderBy("createdAt", "desc"));

  try {
    const querySnapshot = await getDocs(threadsQuery);
    const threads = [];
    querySnapshot.forEach(doc => {
      threads.push({ id: doc.id, ...doc.data() });
    });
    console.log("DEBUG: Successfully fetched threads. Count:", threads.length, "Threads data:", threads);

    toggleVisibility(threadsLoadingMessage, false); // Hide loading message
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

  actualThreadsList.innerHTML = ''; // Clear existing threads before rendering new ones

  if (threads.length === 0) { // This check might be redundant if fetchThreads already handled it, but good for safety
    toggleVisibility(noThreadsMessage, true);
    return;
  }

  for (const thread of threads) {
    const threadElement = document.createElement('div');
    threadElement.classList.add('thread-item', 'mb-6'); // Use the .thread-item class from forms.css

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

    // Sanitize content for display, especially if it contains user-generated HTML
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
  console.log("DEBUG: Threads rendered into DOM.");
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
  console.log("DEBUG: Opening thread detail modal for thread ID:", threadId);

  const threadDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
  try {
    const threadSnap = await getDoc(threadDocRef);
    if (threadSnap.exists()) {
      const threadData = threadSnap.data();
      console.log("DEBUG: Thread data loaded for modal:", threadData);

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

      // Show comment form if user is logged in
      if (auth.currentUser) {
        toggleVisibility(addCommentForm, true);
      } else {
        toggleVisibility(addCommentForm, false);
      }

    } else {
      if (modalThreadContent) modalThreadContent.innerHTML = '<p class="text-red-500">Thread not found.</p>';
      if (commentsList) commentsList.innerHTML = '';
      if (threadReactionsContainer) threadReactionsContainer.innerHTML = '';
      toggleVisibility(addCommentForm, false); // Hide comment form if thread not found
      console.warn("DEBUG: Thread document does not exist for ID:", threadId);
    }
  } catch (error) {
    console.error("Error fetching thread details:", error);
    if (modalThreadContent) modalThreadContent.innerHTML = `<p class="text-red-500">Error loading thread: ${error.message}</p>`;
    if (commentsList) commentsList.innerHTML = '';
    if (threadReactionsContainer) threadReactionsContainer.innerHTML = '';
    toggleVisibility(addCommentForm, false); // Hide comment form on error
  }
}

/**
 * Sets up a real-time listener for comments on the current thread.
 * @param {string} threadId - The ID of the thread.
 */
function setupCommentsListener(threadId) {
  if (unsubscribeComments) {
    unsubscribeComments();
    console.log("DEBUG: Unsubscribed from previous comments listener.");
  }

  const commentsColRef = collection(db, `artifacts/${appId}/public/data/forum_threads`, threadId, 'comments');
  const q = query(commentsColRef, orderBy('createdAt', 'asc'));
  console.log("DEBUG: Setting up comments listener for thread ID:", threadId);

  unsubscribeComments = onSnapshot(q, async (snapshot) => {
    if (commentsList) commentsList.innerHTML = '';
    if (snapshot.empty) {
      if (commentsList) commentsList.innerHTML = '<p class="text-text-secondary text-center">No comments yet. Be the first to reply!</p>';
      await updateThreadCommentsCount(threadId, 0);
      console.log("DEBUG: No comments found for thread ID:", threadId);
      return;
    }

    let count = 0;
    for (const commentDoc of snapshot.docs) {
      count++;
      const comment = commentDoc.data();
      const commentElement = document.createElement('div');
      commentElement.classList.add('comment-card'); // Use the .comment-card class from forms.css

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

    console.log("DEBUG: Comments rendered. Count:", count);
  }, (error) => {
    console.error("Error listening to comments:", error);
    if (commentsList) commentsList.innerHTML = `<p class="text-red-500 text-center">Error loading comments: ${error.message}</p>`;
  });
}

/**
 * Sets up a real-time listener for reactions on the current thread.
 * @param {string} threadId - The ID of the thread.
 */
function setupReactionsListener(threadId) {
  if (unsubscribeReactions) {
    unsubscribeReactions();
    console.log("DEBUG: Unsubscribed from previous reactions listener.");
  }

  const threadDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
  console.log("DEBUG: Setting up reactions listener for thread ID:", threadId);
  unsubscribeReactions = onSnapshot(threadDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const reactions = docSnap.data().reactions || {};
      if (threadReactionsContainer) {
        renderReactionButtons(
          'thread',
          threadId,
          reactions,
          threadReactionsContainer,
          () => auth.currentUser // Pass a function to get the current user
        );
      }
      console.log("DEBUG: Reactions rendered for thread:", threadId);

      document.querySelectorAll('#thread-reactions-container .reaction-btn').forEach(button => {
        const emoji = button.textContent.split(' ')[0]; // Get the emoji part
        button.addEventListener('click', () => toggleReaction(threadId, emoji));
      });

    } else {
      console.log("DEBUG: Thread not found for reactions:", threadId);
      if (threadReactionsContainer) threadReactionsContainer.innerHTML = '';
    }
  }, (error) => {
    console.error("Error listening to reactions:", error);
    if (threadReactionsContainer) threadReactionsContainer.innerHTML = `<p class="text-red-500">Error loading reactions: ${error.message}</p>`;
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
      console.error("Attempted to toggle reaction on non-existent thread:", threadId);
      showMessageBox("Thread not found.", true);
      return;
    }

    const currentReactions = threadSnap.data().reactions || {};
    const emojiReactions = currentReactions[emoji] || {};

    // Toggle logic: If user has reacted, remove their reaction; otherwise, add it.
    if (emojiReactions[user.uid]) {
      delete emojiReactions[user.uid];
      showMessageBox(`Removed ${emoji} reaction.`, false);
    } else {
      emojiReactions[user.uid] = user.uid; // Store user ID to mark their reaction
      showMessageBox(`Added ${emoji} reaction!`, false);
    }

    await updateDoc(threadRef, {
      [`reactions.${emoji}`]: emojiReactions // Update the specific emoji's reactions map
    });

    console.log(`DEBUG: Toggled reaction '${emoji}' for user ${user.uid} on thread ${threadId}.`);
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
    // Check if the current user is the author of the comment or an admin
    if (commentData.authorUid !== user.uid && !ADMIN_UIDS.includes(user.uid)) {
      showMessageBox("You do not have permission to delete this comment.", true);
      return;
    }

    await deleteDoc(commentDocRef);
    showMessageBox("Comment deleted successfully!", false);
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
    console.log(`DEBUG: Thread ${threadId} comments count updated to: ${count}`);
    const activeCategoryId = document.querySelector('#category-filter-buttons button.active-category-filter')?.dataset.categoryId || 'all';
    // Re-fetch threads to reflect updated comment count on the main list
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
  // Unsubscribe from real-time listeners when modal is closed
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
  currentThreadId = null;
}


// --- Announcement Functions ---

/**
 * Fetches recent announcements from Firestore.
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
  const q = query(announcementsCol, orderBy("createdAt", "desc"), limit(5)); // Fetch up to 5 most recent
  console.log("DEBUG: Attempting to fetch announcements from path:", `artifacts/${appId}/public/data/announcements`);

  try {
    const querySnapshot = await getDocs(q);
    const announcements = [];
    querySnapshot.forEach(doc => {
      announcements.push({ id: doc.id, ...doc.data() });
    });
    console.log("DEBUG: Fetched announcements. Count:", announcements.length);

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

  actualAnnouncementsList.innerHTML = ''; // Clear previous content

  if (announcements.length === 0) { // This check might be redundant if fetchAnnouncements already handled it
    toggleVisibility(noAnnouncementsMessage, true);
    return;
  }

  announcements.forEach(announcement => {
    const announcementElement = document.createElement('div');
    announcementElement.classList.add('announcement-item', 'mb-2'); // Use .announcement-item from forms.css
    const formattedDate = announcement.createdAt?.toDate ? new Date(announcement.createdAt.toDate()).toLocaleDateString() : 'N/A';
    const sanitizedContent = DOMPurify.sanitize(marked.parse(announcement.content || ''));
    announcementElement.innerHTML = `
      <h4 class="font-semibold text-lg mb-1">${parseEmojis(announcement.title || 'No Title')}</h4>
      <p class="text-text-secondary text-sm mb-2">${formattedDate}</p>
      <div class="prose text-text-primary text-sm max-w-none">${parseEmojis(sanitizedContent)}</div>
    `;
    actualAnnouncementsList.appendChild(announcementElement);
  });
  console.log("DEBUG: Announcements rendered.");
}


// --- Direct Message Functions (Recent Conversations Summary) ---

/**
 * Fetches recent direct messages (conversations) for the current user.
 * Displays a summary of the latest message in each conversation.
 * Manages loading, error, and empty state messages.
 */
async function fetchRecentDMs() {
  toggleVisibility(dmsLoadingMessage, true);
  toggleVisibility(noDMsMessage, false);
  toggleVisibility(dmsErrorMessage, false);
  if (actualRecentDMsList) actualRecentDMsList.innerHTML = '';

  await firebaseReadyPromise;
  const user = auth.currentUser;

  if (!user) {
    toggleVisibility(dmsLoadingMessage, false);
    toggleVisibility(noDMsMessage, true);
    if (noDMsMessage) noDMsMessage.textContent = 'Sign in to view recent conversations.';
    return;
  }
  if (!db) {
    console.error("Firestore DB not initialized for fetching DMs.");
    toggleVisibility(dmsLoadingMessage, false);
    toggleVisibility(dmsErrorMessage, true);
    return;
  }

  const dmsCol = collection(db, `artifacts/${appId}/public/data/direct_messages`);

  // Query for DMs where the current user is a participant
  // lastMessageAt is a timestamp field expected in the DM document itself
  const q = query(dmsCol, where("participants", "array-contains", user.uid), orderBy("lastMessageAt", "desc"), limit(3)); // Fetch top 3 recent conversations
  console.log("DEBUG: Attempting to fetch recent DMs for user:", user.uid);

  try {
    const querySnapshot = await getDocs(q);
    const conversations = [];
    for (const dmDoc of querySnapshot.docs) {
      const dmData = dmDoc.data();

      // Determine the other participant's info
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

      // Get the last message directly from the DM document if available, or fetch from subcollection
      let lastMessageContent = dmData.lastMessageContent || "No messages yet."; // Assuming a 'lastMessageContent' field
      let lastMessageTimestamp = dmData.lastMessageAt?.toDate() || null;

      // Fallback: If lastMessageContent not directly in DM doc, try to fetch from subcollection
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
    console.log("DEBUG: Fetched recent DMs. Count:", conversations.length);

    toggleVisibility(dmsLoadingMessage, false);
    if (conversations.length === 0) {
      toggleVisibility(noDMsMessage, true);
      if (user) { // If user is logged in but no DMs
        if (noDMsMessage) noDMsMessage.textContent = 'No recent conversations.';
      }
    } else {
      renderRecentDMs(conversations);
    }
  } catch (error) {
    console.error("Error fetching recent DMs:", error);
    toggleVisibility(dmsLoadingMessage, false);
    toggleVisibility(dmsErrorMessage, true);
  }
}

/**
 * Renders the fetched recent direct messages into the DOM.
 * @param {Array} conversations - Array of conversation objects.
 */
function renderRecentDMs(conversations) {
  if (!actualRecentDMsList) return;

  actualRecentDMsList.innerHTML = ''; // Clear previous content

  if (conversations.length === 0) { // Redundant but safe check
    toggleVisibility(noDMsMessage, true);
    return;
  }

  conversations.forEach(conv => {
    const dmElement = document.createElement('div');
    dmElement.classList.add('dm-conversation-item', 'mb-2'); // Use .dm-conversation-item from forms.css
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
  console.log("DEBUG: Recent DMs rendered.");
}


// --- DOMContentLoaded and Initial Setup ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("forms.js - DOMContentLoaded event fired.");

  // It's crucial to wait for Firebase initialization here
  await firebaseReadyPromise;
  console.log("DEBUG: firebaseReadyPromise resolved in forms.js");

  // Load navbar after Firebase is ready, as it depends on auth and db
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
  console.log("DEBUG: Navbar loaded in forms.js.");

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

  // Set up auth state listener for UI visibility
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      toggleVisibility(createThreadSection, true);
      toggleVisibility(forumLoginRequiredMessage, false);
      toggleVisibility(addCommentForm, true); // Show comment form in modal when user is logged in
      console.log("DEBUG: User authenticated. Create thread and comment forms visible.");
    } else {
      toggleVisibility(createThreadSection, false);
      toggleVisibility(forumLoginRequiredMessage, true);
      toggleVisibility(addCommentForm, false); // Hide comment form in modal when user is logged out
      console.log("DEBUG: User not authenticated. Create thread and comment forms hidden.");
    }
    // Re-fetch DMs as their visibility/content depends on auth state
    await fetchRecentDMs();
  });

  // Initial data fetches (order matters for dependencies, e.g., threads need themes)
  await fetchForumThemes(); // Populates `availableForumThemes`
  // populateThreadCategorySelect and renderCategoryFilterButtons are called inside fetchForumThemes
  await fetchThreads('all');
  await fetchAnnouncements();
  // fetchRecentDMs is called inside onAuthStateChanged to handle login state
  console.log("DEBUG: Initial data fetches completed for forms.js.");

  // --- Event Listeners ---
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
  } else {
    console.warn("WARNING: createThreadForm not found.");
  }


  if (addCommentForm) {
    addCommentForm.addEventListener('submit', addComment);
  } else {
    console.warn("WARNING: addCommentForm not found.");
  }


  if (threadDetailModal && threadDetailModal.querySelector('.close-button')) {
    threadDetailModal.querySelector('.close-button').addEventListener('click', closeModal);
  } else {
    console.warn("WARNING: Thread detail modal or its close button not found.");
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
});
