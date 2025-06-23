// forms.js: This script handles forum thread and comment functionality,
// including real-time updates, reactions, emoji parsing, and user mentions.

/* global EasyMDE, marked */ // Explicitly declare EasyMDE and marked as global variables

// Import necessary Firebase SDK functions and local modules
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js';
import { loadNavbar } from './navbar.js';
import { showMessageBox, showCustomConfirm, COMMON_EMOJIS, parseEmojis, parseMentions, renderReactionButtons } from './utils.js';
// Import auth, db, appId, firebaseReadyPromise directly from firebase-init.js
import { getUserProfileFromFirestore, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, auth, db, appId, firebaseReadyPromise, ADMIN_UIDS } from './firebase-init.js';


// --- DOM Elements ---
const createThreadForm = document.getElementById('create-thread-form');
const threadTitleInput = document.getElementById('thread-title');
const threadThemeSelect = document.getElementById('thread-theme-select');
const threadContentInput = document.getElementById('thread-content');

// Thread List elements
const categoryFilterButtonsContainer = document.getElementById('category-filter-buttons');
const categoriesLoadingMessage = document.getElementById('categories-loading-message');
const noCategoriesMessage = document.getElementById('no-categories-message');
const actualThreadsList = document.getElementById('actual-threads-list');
const threadsLoadingMessage = document.getElementById('threads-loading-message');
const threadsLoadingError = document.getElementById('threads-loading-error');
const noThreadsMessage = document.getElementById('no-threads-message');

const threadDetailModal = document.getElementById('thread-detail-modal');
const modalThreadTitle = document.getElementById('modal-thread-title');
const modalThreadMeta = document.getElementById('modal-thread-meta');
const modalThreadContent = document.getElementById('modal-thread-content');
const addCommentForm = document.getElementById('add-comment-form');
const commentContentInput = document.getElementById('comment-content');
const commentsList = document.getElementById('comments-list');
const threadReactionsContainer = document.getElementById('thread-reactions-container');
const logoutBtn = document.getElementById('logout-btn'); // Assuming this is defined for any page where forms.js is used
const customConfirmModal = document.getElementById('custom-confirm-modal');
const loginRequiredMessage = document.getElementById('login-required-message');


// New DOM elements for Announcements and DMs
const actualAnnouncementsList = document.getElementById('actual-announcements-list');
const announcementsLoadingMessage = document.getElementById('announcements-loading-message');
const noAnnouncementsMessage = document.getElementById('no-announcements-message');
const announcementsErrorMessage = document.getElementById('announcements-error-message');

const actualRecentDMsList = document.getElementById('actual-recent-dms-list');
const dmsLoadingMessage = document.getElementById('dms-loading-message');
const noDMsMessage = document.getElementById('no-dms-message');
const dmsErrorMessage = document.getElementById('dms-error-message');


let easyMDECreateThread;
let easyMDEComment; // Not currently used as comment input is a textarea

let currentThreadId = null;
let unsubscribeComments = null;
let unsubscribeReactions = null;

let availableForumThemes = [];


/**
 * Helper function to show/hide elements.
 * @param {HTMLElement} element - The DOM element to manage.
 * @param {boolean} show - True to show, false to hide.
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
 * Fetches all available forum themes from Firestore.
 * @returns {Promise<Array>} A promise that resolves with an array of theme objects.
 */
async function fetchForumThemes() {
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for fetching forum themes. Cannot fetch themes.");
    toggleVisibility(categoriesLoadingMessage, false);
    toggleVisibility(noCategoriesMessage, false); // Hide, as error message will be shown via showMessageBox
    showMessageBox("Error: Database not initialized for themes.", true);
    return [];
  }

  toggleVisibility(categoriesLoadingMessage, true);
  toggleVisibility(noCategoriesMessage, false); // Hide "No categories" while loading
  console.log("DEBUG: Attempting to fetch themes from path:", `artifacts/${appId}/public/data/themes`);
  try {
    const themesCol = collection(db, `artifacts/${appId}/public/data/themes`);
    const querySnapshot = await getDocs(themesCol);
    const themes = [];
    querySnapshot.forEach(doc => {
      themes.push({ id: doc.id, ...doc.data() });
    });
    availableForumThemes = themes;
    console.log("DEBUG: Fetched forum themes. Count:", themes.length, "Themes:", themes);

    toggleVisibility(categoriesLoadingMessage, false); // Hide loading message
    if (themes.length === 0) {
      toggleVisibility(noCategoriesMessage, true);
    } else {
      toggleVisibility(noCategoriesMessage, false);
    }

    return themes;
  } catch (error) {
    console.error("Error fetching forum themes:", error);
    toggleVisibility(categoriesLoadingMessage, false);
    toggleVisibility(noCategoriesMessage, true); // Show "No categories" or a more specific error
    showMessageBox(`Error loading forum themes: ${error.message}`, true);
    return [];
  }
}

/**
 * Populates the thread theme select dropdown with available themes.
 */
async function populateThreadCategorySelect() {
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
  console.log("DEBUG: Thread category select populated with", availableForumThemes.length, "themes.");
}

/**
 * Renders the theme filter buttons dynamically.
 * @param {Array} themes - Array of theme objects.
 * @param {string} activeThemeId - The ID of the currently active theme filter, or 'all'.
 */
async function renderCategoryFilterButtons(themes, activeThemeId = 'all') {
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
 * Filters and renders threads based on the selected theme.
 * @param {string} themeId - The ID of the theme to filter by, or 'all'.
 */
async function filterThreadsByCategory(themeId) {
  console.log("DEBUG: Filtering threads by theme:", themeId);
  await fetchThreads(themeId);
}


/**
 * Creates a new forum thread.
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
    await fetchThreads('all');
    console.log("DEBUG: Thread created:", docRef.id);
  } catch (error) {
    console.error("Error creating thread:", error);
    showMessageBox(`Error creating thread: ${error.message}`, true);
  }
}

/**
 * Fetches forum threads from Firestore, optionally filtered by theme.
 * @param {string|null} themeId - The ID of the theme to filter by, or 'all'/'null' for all threads.
 */
async function fetchThreads(themeId = 'all') {
  await firebaseReadyPromise;
  if (!db) {
    toggleVisibility(threadsLoadingMessage, false);
    toggleVisibility(threadsLoadingError, true);
    toggleVisibility(noThreadsMessage, false);
    if (actualThreadsList) actualThreadsList.innerHTML = '';
    console.error("Firestore DB not initialized for fetching threads. Cannot fetch threads.");
    return;
  }

  toggleVisibility(threadsLoadingMessage, true);
  toggleVisibility(threadsLoadingError, false);
  toggleVisibility(noThreadsMessage, false);
  if (actualThreadsList) actualThreadsList.innerHTML = ''; // Clear previous threads

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
      toggleVisibility(noThreadsMessage, false);
      await renderThreads(threads);
    }
  } catch (error) {
    console.error("Error fetching threads:", error);
    toggleVisibility(threadsLoadingMessage, false);
    toggleVisibility(threadsLoadingError, true);
    toggleVisibility(noThreadsMessage, false); // Hide no threads message in case of error
    if (actualThreadsList) actualThreadsList.innerHTML = '';
    showMessageBox(`Error loading threads: ${error.message}`, true);
  }
}


/**
 * Renders the list of forum threads.
 * @param {Array} threads - An array of thread objects.
 */
async function renderThreads(threads) {
  if (!actualThreadsList) return;

  actualThreadsList.innerHTML = ''; // Clear previous content, replaced by messages above

  if (threads.length === 0) {
    toggleVisibility(noThreadsMessage, true);
    console.log("DEBUG: No threads to render.");
    return;
  }

  for (const thread of threads) {
    const threadElement = document.createElement('div');
    threadElement.classList.add('bg-gray-800', 'p-6', 'rounded-lg', 'shadow-md', 'mb-6'); // Apply styling here

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

    const fullContentHtml = thread.content ? marked.parse(thread.content) : '';
    const contentPreview = fullContentHtml.length > 200 ? fullContentHtml.substring(0, 200) + '...' : fullContentHtml;


    threadElement.innerHTML = `
      <div class="flex items-center mb-4">
        <img src="${authorProfilePic}" alt="${authorDisplayName}'s profile picture" class="profile-pic-small mr-3">
        <div>
          <p class="text-gray-200 font-semibold">${authorDisplayName}</p>
          <p class="text-gray-400 text-xs">${formattedDate}</p>
        </div>
      </div>
      <h3 class="thread-title mb-2 cursor-pointer text-xl font-bold text-blue-300">${parseEmojis(thread.title)}</h3>
      <p class="thread-meta text-sm text-gray-400 mb-2">Comments: ${commentsCount} | Theme: <span class="thread-category-tag font-semibold text-blue-200">/t/${themeName}</span></p>
      <div class="thread-content-preview prose text-gray-100 mb-4 max-w-none">${parseEmojis(await parseMentions(contentPreview))}</div>
      <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-300 view-thread-btn" data-id="${thread.id}">View Thread</button>
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
  if (commentsList) commentsList.innerHTML = '<p class="text-gray-300 text-center">Loading comments...</p>';
  if (threadReactionsContainer) threadReactionsContainer.innerHTML = '';

  if (threadDetailModal) threadDetailModal.style.display = 'flex';
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
      if (modalThreadContent) modalThreadContent.innerHTML = parseEmojis(await parseMentions(marked.parse(threadData.content || '')));


      setupCommentsListener(threadId);
      setupReactionsListener(threadId);

    } else {
      if (modalThreadContent) modalThreadContent.innerHTML = '<p class="text-red-500">Thread not found.</p>';
      if (commentsList) commentsList.innerHTML = '';
      if (threadReactionsContainer) threadReactionsContainer.innerHTML = '';
      console.warn("DEBUG: Thread document does not exist for ID:", threadId);
    }
  } catch (error) {
    console.error("Error fetching thread details:", error);
    if (modalThreadContent) modalThreadContent.innerHTML = `<p class="text-red-500">Error loading thread: ${error.message}</p>`;
    if (commentsList) commentsList.innerHTML = '';
    if (threadReactionsContainer) threadReactionsContainer.innerHTML = '';
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
      if (commentsList) commentsList.innerHTML = '<p class="text-gray-300 text-center">No comments yet. Be the first to reply!</p>';
      await updateThreadCommentsCount(threadId, 0);
      console.log("DEBUG: No comments found for thread ID:", threadId);
      return;
    }

    let count = 0;
    for (const commentDoc of snapshot.docs) {
      count++;
      const comment = commentDoc.data();
      const commentElement = document.createElement('div');
      commentElement.classList.add('bg-gray-700', 'p-4', 'rounded-lg', 'shadow-sm', 'relative');

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
        const emoji = button.textContent.split(' ')[0];
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
    await fetchThreads(activeCategoryId);
  } catch (error) {
    console.error("Error updating thread comments count:", error);
  }
}


/**
 * Handles the click of the modal close button.
 */
function closeModal() {
  if (threadDetailModal) threadDetailModal.style.display = 'none';
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

/**
 * Fetches recent announcements from Firestore.
 */
async function fetchAnnouncements() {
  await firebaseReadyPromise;
  if (!db) {
    toggleVisibility(announcementsLoadingMessage, false);
    toggleVisibility(announcementsErrorMessage, true);
    if (actualAnnouncementsList) actualAnnouncementsList.innerHTML = '';
    console.error("Firestore DB not initialized for fetching announcements.");
    return;
  }

  toggleVisibility(announcementsLoadingMessage, true);
  toggleVisibility(noAnnouncementsMessage, false);
  toggleVisibility(announcementsErrorMessage, false);
  if (actualAnnouncementsList) actualAnnouncementsList.innerHTML = '';

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
      toggleVisibility(noAnnouncementsMessage, false);
      renderAnnouncements(announcements);
    }
  } catch (error) {
    console.error("Error fetching announcements:", error);
    toggleVisibility(announcementsLoadingMessage, false);
    toggleVisibility(announcementsErrorMessage, true);
    toggleVisibility(noAnnouncementsMessage, false);
    if (actualAnnouncementsList) actualAnnouncementsList.innerHTML = '';
  }
}

/**
 * Renders the fetched announcements into the DOM.
 * @param {Array} announcements - Array of announcement objects.
 */
function renderAnnouncements(announcements) {
  if (!actualAnnouncementsList) return;

  if (announcements.length === 0) {
    toggleVisibility(noAnnouncementsMessage, true);
    return;
  }

  actualAnnouncementsList.innerHTML = '';
  announcements.forEach(announcement => {
    const announcementElement = document.createElement('div');
    announcementElement.classList.add('bg-gray-800', 'p-3', 'rounded-md', 'shadow-sm', 'mb-2');
    const formattedDate = announcement.createdAt?.toDate ? new Date(announcement.createdAt.toDate()).toLocaleDateString() : 'N/A';
    announcementElement.innerHTML = `
      <h4 class="font-semibold text-blue-200 text-lg mb-1">${parseEmojis(announcement.title || 'No Title')}</h4>
      <p class="text-gray-400 text-sm mb-2">${formattedDate}</p>
      <div class="prose text-gray-200 text-sm max-w-none">${parseEmojis(marked.parse(announcement.content || ''))}</div>
    `;
    actualAnnouncementsList.appendChild(announcementElement);
  });
  console.log("DEBUG: Announcements rendered.");
}


/**
 * Fetches recent direct messages (conversations) for the current user.
 * Displays a summary of the latest message in each conversation.
 */
async function fetchRecentDMs() {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) {
    toggleVisibility(dmsLoadingMessage, false);
    toggleVisibility(dmsErrorMessage, false);
    toggleVisibility(noDMsMessage, true); // Show 'Sign in to view DMs'
    if (actualRecentDMsList) actualRecentDMsList.innerHTML = '';
    return;
  }
  if (!db) {
    toggleVisibility(dmsLoadingMessage, false);
    toggleVisibility(dmsErrorMessage, true);
    toggleVisibility(noDMsMessage, false);
    if (actualRecentDMsList) actualRecentDMsList.innerHTML = '';
    console.error("Firestore DB not initialized for fetching DMs.");
    return;
  }

  toggleVisibility(dmsLoadingMessage, true);
  toggleVisibility(noDMsMessage, false);
  toggleVisibility(dmsErrorMessage, false);
  if (actualRecentDMsList) actualRecentDMsList.innerHTML = '';

  const dmsCol = collection(db, `artifacts/${appId}/public/data/direct_messages`);

  const q1 = query(dmsCol, where("participants", "array-contains", user.uid), orderBy("lastMessageAt", "desc"), limit(5));
  console.log("DEBUG: Attempting to fetch recent DMs for user:", user.uid);

  try {
    const querySnapshot = await getDocs(q1);
    const conversations = [];
    for (const dmDoc of querySnapshot.docs) {
      const dmData = dmDoc.data();
      const messagesCol = collection(db, `artifacts/${appId}/public/data/direct_messages`, dmDoc.id, 'messages');
      const latestMessageQuery = query(messagesCol, orderBy("createdAt", "desc"), limit(1));
      const messageSnap = await getDocs(latestMessageQuery);

      let lastMessageContent = "No messages yet.";
      let lastMessageTimestamp = null;
      let otherParticipantName = "Unknown User";
      let otherParticipantPic = DEFAULT_PROFILE_PIC;

      if (!messageSnap.empty) {
        const lastMessage = messageSnap.docs[0].data();
        lastMessageContent = lastMessage.content || lastMessageContent;
        lastMessageTimestamp = lastMessage.createdAt?.toDate();
      }

      const otherParticipantUid = dmData.participants.find(uid => uid !== user.uid);
      if (otherParticipantUid) {
        const otherProfile = await getUserProfileFromFirestore(otherParticipantUid);
        if (otherProfile) {
          otherParticipantName = otherProfile.displayName || otherParticipantName;
          otherParticipantPic = otherProfile.photoURL || otherParticipantPic;
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
      } else { // If user not logged in
        if (noDMsMessage) noDMsMessage.textContent = 'Sign in to view DMs.';
      }
    } else {
      toggleVisibility(noDMsMessage, false);
      renderRecentDMs(conversations);
    }
  } catch (error) {
    console.error("Error fetching recent DMs:", error);
    toggleVisibility(dmsLoadingMessage, false);
    toggleVisibility(dmsErrorMessage, true);
    toggleVisibility(noDMsMessage, false);
    if (actualRecentDMsList) actualRecentDmsList.innerHTML = '';
  }
}


/**
 * Renders the fetched recent direct messages into the DOM.
 * @param {Array} conversations - Array of conversation objects.
 */
function renderRecentDMs(conversations) {
  if (!actualRecentDMsList) return;

  if (conversations.length === 0) {
    toggleVisibility(noDMsMessage, true);
    return;
  }

  actualRecentDMsList.innerHTML = '';
  conversations.forEach(conv => {
    const dmElement = document.createElement('div');
    dmElement.classList.add('bg-gray-800', 'p-3', 'rounded-md', 'shadow-sm', 'mb-2');
    dmElement.innerHTML = `
      <div class="flex items-center mb-1">
        <img src="${conv.otherParticipantPic}" alt="${conv.otherParticipantName}'s profile picture" class="profile-pic-small mr-2">
        <h4 class="font-semibold text-blue-200 text-lg">${conv.otherParticipantName}</h4>
      </div>
      <p class="text-gray-400 text-sm mb-1 truncate">${conv.lastMessage}</p>
      <p class="text-gray-500 text-xs text-right">${conv.lastMessageAt}</p>
    `;
    actualRecentDMsList.appendChild(dmElement);
  });
  console.log("DEBUG: Recent DMs rendered.");
}


// --- DOMContentLoaded and Initial Setup ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("forms.js - DOMContentLoaded event fired.");

  await firebaseReadyPromise;
  console.log("DEBUG: firebaseReadyPromise resolved in forms.js");

  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
  console.log("DEBUG: Navbar loaded in forms.js");

  if (threadContentInput) {
    easyMDECreateThread = new EasyMDE({
      element: threadContentInput,
      spellChecker: false,
      forceSync: true,
      minHeight: "150px",
      toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "guide"]
    });
    console.log("DEBUG: EasyMDE initialized for thread creation.");
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (createThreadForm) createThreadForm.classList.remove('hidden');
      if (addCommentForm) addCommentForm.classList.remove('hidden');
      if (loginRequiredMessage) loginRequiredMessage.classList.add('hidden');
      console.log("DEBUG: User is authenticated. Forms visible.");
    } else {
      if (createThreadForm) createThreadForm.classList.add('hidden');
      if (addCommentForm) addCommentForm.classList.add('hidden');
      if (loginRequiredMessage) loginRequiredMessage.classList.remove('hidden');
      console.log("DEBUG: User is not authenticated. Forms hidden, login message shown.");
    }
  });

  // Initial fetch and render for categories and threads
  await fetchForumThemes();
  await populateThreadCategorySelect();
  await renderCategoryFilterButtons(availableForumThemes, 'all'); // Pass the themes to render buttons
  await fetchThreads('all');
  console.log("DEBUG: Initial thread fetch completed.");

  // Fetch and render announcements and DMs
  await fetchAnnouncements();
  await fetchRecentDMs();


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

  const currentYearElement = document.getElementById('current-year-forms');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }
});
