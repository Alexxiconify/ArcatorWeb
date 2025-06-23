// forms.js: This script handles forum thread and comment functionality,
// including real-time updates, reactions, emoji parsing, and user mentions.

/* global EasyMDE, marked */ // Explicitly declare EasyMDE and marked as global variables

// Import necessary Firebase SDK functions and local modules
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const threadsList = document.getElementById('threads-list');
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

const threadCategoryList = document.getElementById('thread-category-list');
const categoriesLoadingMessage = document.getElementById('categories-loading-message');


let easyMDECreateThread;
let easyMDEComment; // Not currently used as comment input is a textarea

let currentThreadId = null;
let unsubscribeComments = null;
let unsubscribeReactions = null;

let availableForumThemes = [];


/**
 * Fetches all available forum themes from Firestore.
 * @returns {Promise<Array>} A promise that resolves with an array of theme objects.
 */
async function fetchForumThemes() {
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for fetching forum themes. Cannot fetch themes.");
    showMessageBox("Error: Database not initialized for themes.", true);
    return [];
  }
  const themesCol = collection(db, `artifacts/${appId}/public/data/themes`);
  console.log("DEBUG: Attempting to fetch themes from path:", `artifacts/${appId}/public/data/themes`);
  try {
    const querySnapshot = await getDocs(themesCol);
    const themes = [];
    querySnapshot.forEach(doc => {
      themes.push({ id: doc.id, ...doc.data() });
    });
    availableForumThemes = themes;
    console.log("DEBUG: Fetched forum themes. Count:", themes.length, "Themes:", themes);
    return themes;
  } catch (error) {
    console.error("Error fetching forum themes:", error);
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
  if (!threadCategoryList) return;

  threadCategoryList.innerHTML = '';
  if (categoriesLoadingMessage) categoriesLoadingMessage.style.display = 'none'; // Hide loading message here

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
  threadCategoryList.appendChild(allThreadsButton);

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
    threadCategoryList.appendChild(button);
  });
  console.log("DEBUG: Category filter buttons rendered.");
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

  // Changed collection name from 'threads' to 'forum_threads' as per user's query
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
    if (createThreadForm) createThreadForm.reset(); // Safely reset form
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
    if (threadsList) threadsList.innerHTML = '<p class="text-red-500 text-center text-lg">Database not initialized. Cannot load threads.</p>';
    console.error("Firestore DB not initialized for fetching threads. Cannot fetch threads.");
    return;
  }

  if (threadsList) threadsList.innerHTML = '<p class="text-gray-400 text-center text-lg">Loading threads...</p>';
  if (document.getElementById('threads-loading-error')) document.getElementById('threads-loading-error').classList.add('hidden');
  if (document.getElementById('no-threads-message')) document.getElementById('no-threads-message').classList.add('hidden');

  // Changed collection name from 'threads' to 'forum_threads' as per user's query
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
    if (querySnapshot.empty) {
      if (document.getElementById('no-threads-message')) document.getElementById('no-threads-message').classList.remove('hidden');
      if (threadsList) threadsList.innerHTML = '';
      console.log("DEBUG: No threads found in collection or for the selected theme.");
      return;
    }
    querySnapshot.forEach(doc => {
      threads.push({ id: doc.id, ...doc.data() });
    });
    console.log("DEBUG: Successfully fetched threads. Count:", threads.length, "Threads data:", threads);
    await renderThreads(threads);
  } catch (error) {
    console.error("Error fetching threads:", error);
    if (document.getElementById('threads-loading-error')) document.getElementById('threads-loading-error').classList.remove('hidden');
    if (threadsList) threadsList.innerHTML = '';
    showMessageBox(`Error loading threads: ${error.message}`, true);
  }
}


/**
 * Renders the list of forum threads.
 * @param {Array} threads - An array of thread objects.
 */
async function renderThreads(threads) {
  if (threadsList) threadsList.innerHTML = '';

  if (threads.length === 0) {
    if (document.getElementById('no-threads-message')) document.getElementById('no-threads-message').classList.remove('hidden');
    console.log("DEBUG: No threads to render.");
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
      <h3 class="thread-title mb-2 cursor-pointer">${parseEmojis(thread.title)}</h3>
      <p class="thread-meta">Comments: ${commentsCount} | Theme: <span class="thread-category-tag">/t/${themeName}</span></p>
      <div class="thread-content-preview prose max-w-none">${parseEmojis(await parseMentions(contentPreview))}</div>
      <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-300 view-thread-btn" data-id="${thread.id}">View Thread</button>
    `;
    if (threadsList) threadsList.appendChild(threadElement);
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

  // Changed collection name from 'threads' to 'forum_threads' as per user's query
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

  // Changed collection name from 'threads' to 'forum_threads' as per user's query
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

  // Changed collection name from 'threads' to 'forum_threads' as per user's query
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

  // Changed collection name from 'threads' to 'forum_threads' as per user's query
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

  // Changed collection name from 'threads' to 'forum_threads' as per user's query
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

  // Changed collection name from 'threads' to 'forum_threads' as per user's query
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
  // Changed collection name from 'threads' to 'forum_threads' as per user's query
  const threadRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
  try {
    await updateDoc(threadRef, {
      commentsCount: count,
      updatedAt: serverTimestamp()
    });
    console.log(`DEBUG: Thread ${threadId} comments count updated to: ${count}`);
    const activeCategoryId = document.querySelector('#thread-category-list button.active-category-filter')?.dataset.categoryId || 'all';
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

// --- DOMContentLoaded and Initial Setup ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("forms.js - DOMContentLoaded event fired.");

  // IMPORTANT: Wait for Firebase to be fully initialized and authenticated
  await firebaseReadyPromise;
  console.log("DEBUG: firebaseReadyPromise resolved in forms.js");

  // Now that Firebase is ready, load the navbar and other page-specific settings
  // The loadNavbar function will now use the globally available 'auth', 'db', 'appId'
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
  console.log("DEBUG: Navbar loaded in forms.js");


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

  if (categoriesLoadingMessage) {
    categoriesLoadingMessage.style.display = 'block';
    console.log("DEBUG: Categories loading message displayed.");
  }
  await fetchForumThemes();
  await populateThreadCategorySelect();
  await renderCategoryFilterButtons(availableForumThemes, 'all');
  if (categoriesLoadingMessage) {
    categoriesLoadingMessage.style.display = 'none';
    console.log("DEBUG: Categories loading message hidden.");
  }


  await fetchThreads('all');
  console.log("DEBUG: Initial thread fetch completed.");

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
