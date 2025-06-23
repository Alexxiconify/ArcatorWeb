// forms.js: Manages forum threads, comments, and reactions, including client-side sorting.

// Import Firebase instances and user functions from the centralized init file
import {
  auth,
  db,
  appId,
  getCurrentUser,
  setupFirebaseAndUser,
  getUserProfileFromFirestore,
  updateUserProfileInFirestore,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME
} from './firebase-init.js';

// Import theme and navbar functions
import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';
import { showMessageBox, showCustomConfirm } from './utils.js';

import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot, // For real-time updates
  query,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM elements
const createThreadForm = document.getElementById('create-thread-form');
const threadTitleInput = document.getElementById('thread-title');
const threadContentInput = document.getElementById('thread-content');
const threadsContainer = document.getElementById('threads-container');
const loadingSpinner = document.getElementById('loading-spinner');
const threadModal = document.getElementById('thread-modal');
const modalThreadTitle = document.getElementById('modal-thread-title');
const modalThreadAuthor = document.getElementById('modal-thread-author');
const modalThreadContent = document.getElementById('modal-thread-content');
const commentsContainer = document.getElementById('comments-container');
const addCommentForm = document.getElementById('add-comment-form');
const commentContentInput = document.getElementById('comment-content');
const threadCloseButton = document.getElementById('thread-close-button');
let currentOpenThreadId = null; // Store the ID of the thread currently open in the modal

// EasyMDE instances
let easyMDEThreadContent;
let easyMDECommentContent;

// --- Firebase Collection References ---
const THREADS_COLLECTION = `artifacts/${appId}/public/data/forum_threads`;
const COMMENTS_COLLECTION_PREFIX = (threadId) => `artifacts/${appId}/public/data/forum_threads/${threadId}/comments`;

// --- Utility Functions --- (Re-importing from utils.js, but defining for clarity if not available globally)
// The showMessageBox and showCustomConfirm functions are assumed to be imported from './utils.js'
// If they are not found, fallback to console.error or simple alerts.

// --- Thread Functions ---

/**
 * Creates a new forum thread in Firestore.
 * @param {string} title - The title of the thread.
 * @param {string} content - The content of the thread (Markdown supported).
 */
async function createThread(title, content) {
  if (!auth.currentUser) {
    showMessageBox("You must be logged in to create a thread.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot create thread.", true);
    return;
  }

  try {
    const user = getCurrentUser();
    const threadData = {
      title: title,
      content: content,
      authorUid: user.uid,
      authorDisplayName: user.displayName || user.email || 'Anonymous',
      authorHandle: user.handle || 'N/A',
      authorPhotoURL: user.photoURL || DEFAULT_PROFILE_PIC,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      commentCount: 0,
      reactions: {} // { emoji: count, emoji2: count }
    };
    await addDoc(collection(db, THREADS_COLLECTION), threadData);
    showMessageBox("Thread created successfully!", false);
    threadTitleInput.value = '';
    easyMDEThreadContent.value(''); // Clear EasyMDE editor
  } catch (error) {
    console.error("Error creating thread:", error);
    showMessageBox(`Failed to create thread: ${error.message}`, true);
  }
}

/**
 * Fetches all forum threads from Firestore and sorts them by creation date (newest first).
 * This avoids requiring a composite index on Firestore by sorting client-side.
 * @returns {Promise<Array<Object>>} An array of thread objects.
 */
async function fetchAndSortThreads() {
  if (!db) {
    console.error("Firestore DB not initialized for fetching threads.");
    return [];
  }
  try {
    const q = collection(db, THREADS_COLLECTION);
    const querySnapshot = await getDocs(q);
    let threads = [];
    querySnapshot.forEach((doc) => {
      threads.push({ id: doc.id, ...doc.data() });
    });

    // Client-side sorting by creation date (newest first)
    threads.sort((a, b) => {
      // Handle cases where createdAt might be a Firestore Timestamp object or null
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt || new Date(0));
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt || new Date(0));
      return dateB - dateA; // Descending order
    });

    return threads;
  } catch (error) {
    console.error("Failed to load threads:", error);
    showMessageBox(`Failed to load threads: ${error.message}`, true);
    return [];
  }
}

/**
 * Renders all forum threads to the UI.
 */
async function renderThreads() {
  if (loadingSpinner) loadingSpinner.style.display = 'block';
  if (threadsContainer) threadsContainer.innerHTML = ''; // Clear previous threads

  const threads = await fetchAndSortThreads();

  if (loadingSpinner) loadingSpinner.style.display = 'none';

  if (threads.length === 0) {
    if (threadsContainer) threadsContainer.innerHTML = '<p class="text-center text-gray-400 py-8">No threads found. Be the first to create one!</p>';
    return;
  }

  threads.forEach(thread => {
    const threadElement = document.createElement('div');
    threadElement.classList.add('bg-gray-700', 'p-6', 'rounded-lg', 'shadow-md', 'mb-4', 'cursor-pointer', 'hover:bg-gray-600', 'transition', 'duration-200');
    threadElement.innerHTML = `
      <h3 class="text-xl font-bold text-blue-300 mb-2">${thread.title}</h3>
      <p class="text-sm text-gray-400 mb-3">By ${thread.authorDisplayName || thread.authorHandle || 'Anonymous'} - ${thread.createdAt ? new Date(thread.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</p>
      <div class="prose prose-invert max-w-none text-gray-300 mb-4 line-clamp-3">${marked.parse(thread.content || '')}</div>
      <div class="flex items-center text-gray-400 text-sm">
        <span class="mr-4">${thread.commentCount || 0} Comments</span>
        <span class="flex items-center">
          ${Object.entries(thread.reactions || {}).map(([emoji, count]) => `
            <span class="flex items-center mr-2 bg-gray-800 rounded-full px-2 py-1 text-xs">
              ${emoji} ${count}
            </span>
          `).join('')}
        </span>
      </div>
    `;
    threadElement.addEventListener('click', () => openThreadModal(thread.id));
    threadsContainer?.appendChild(threadElement);
  });
}

/**
 * Opens the thread modal and loads thread details and comments.
 * @param {string} threadId - The ID of the thread to open.
 */
async function openThreadModal(threadId) {
  currentOpenThreadId = threadId;
  if (!db) {
    showMessageBox("Database not initialized.", true);
    return;
  }

  // Show loading state
  modalThreadTitle.textContent = 'Loading...';
  modalThreadAuthor.textContent = '';
  modalThreadContent.innerHTML = '';
  commentsContainer.innerHTML = '<p class="text-center py-4">Loading comments...</p>';
  threadModal.style.display = 'flex';

  try {
    const threadDocRef = doc(db, THREADS_COLLECTION, threadId);
    const threadSnap = await getDoc(threadDocRef);

    if (threadSnap.exists()) {
      const thread = threadSnap.data();
      modalThreadTitle.textContent = thread.title;
      modalThreadAuthor.textContent = `By ${thread.authorDisplayName || thread.authorHandle || 'Anonymous'} on ${thread.createdAt ? new Date(thread.createdAt.seconds * 1000).toLocaleString() : 'N/A'}`;
      modalThreadContent.innerHTML = marked.parse(thread.content || '');

      // Initialize EasyMDE for comments if not already done
      if (!easyMDECommentContent) {
        easyMDECommentContent = new EasyMDE({
          element: commentContentInput,
          spellChecker: false,
          forceSync: true,
          minHeight: "100px",
          toolbar: ["bold", "italic", "|", "link", "guide"]
        });
      }
      easyMDECommentContent.value(''); // Clear comment editor

      // Set up real-time listener for comments
      setupCommentsListener(threadId);

    } else {
      showMessageBox("Thread not found.", true);
      threadModal.style.display = 'none';
    }
  } catch (error) {
    console.error("Error opening thread modal:", error);
    showMessageBox(`Failed to open thread: ${error.message}`, true);
    threadModal.style.display = 'none';
  }
}

/**
 * Sets up a real-time listener for comments on a specific thread.
 * Comments are sorted client-side.
 * @param {string} threadId - The ID of the thread whose comments to listen to.
 */
function setupCommentsListener(threadId) {
  if (!db) {
    console.error("Firestore DB not initialized for comments listener.");
    return;
  }

  const commentsRef = collection(db, COMMENTS_COLLECTION_PREFIX(threadId));

  // Listen for real-time updates
  onSnapshot(commentsRef, (snapshot) => {
    let comments = [];
    snapshot.forEach(doc => {
      comments.push({ id: doc.id, ...doc.data() });
    });

    // Client-side sorting by createdAt (oldest first)
    comments.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt || new Date(0));
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt || new Date(0));
      return dateA - dateB; // Ascending order
    });

    renderComments(comments);
    // Update comment count on the thread document itself
    updateThreadCommentCount(threadId, comments.length);
  }, (error) => {
    console.error("Error listening to comments:", error);
    showMessageBox(`Error loading comments: ${error.message}`, true);
    commentsContainer.innerHTML = '<p class="text-center text-red-400 py-4">Failed to load comments.</p>';
  });
}

/**
 * Renders comments to the UI.
 * @param {Array<Object>} comments - An array of comment objects.
 */
function renderComments(comments) {
  if (commentsContainer) commentsContainer.innerHTML = '';
  if (comments.length === 0) {
    if (commentsContainer) commentsContainer.innerHTML = '<p class="text-center text-gray-400 py-4">No comments yet. Be the first to add one!</p>';
    return;
  }

  comments.forEach(comment => {
    const commentElement = document.createElement('div');
    commentElement.classList.add('bg-gray-800', 'p-4', 'rounded-lg', 'shadow-sm', 'mb-3');
    commentElement.innerHTML = `
      <div class="flex items-center mb-2">
        <img src="${comment.authorPhotoURL || DEFAULT_PROFILE_PIC}" alt="Avatar" class="w-8 h-8 rounded-full mr-2 profile-pic-small">
        <span class="font-semibold text-white">${comment.authorDisplayName || comment.authorHandle || 'Anonymous'}</span>
        <span class="text-gray-400 text-xs ml-2">${comment.createdAt ? new Date(comment.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</span>
      </div>
      <div class="prose prose-invert max-w-none text-gray-300">
        ${marked.parse(comment.content || '')}
      </div>
      <div class="flex items-center mt-3">
        ${Object.entries(comment.reactions || {}).map(([emoji, count]) => `
            <span class="flex items-center mr-2 bg-gray-700 rounded-full px-2 py-1 text-xs">
              ${emoji} ${count}
            </span>
          `).join('')}
        <button class="reaction-btn text-gray-400 hover:text-blue-400 transition-colors duration-200 ml-auto" data-comment-id="${comment.id}" data-thread-id="${currentOpenThreadId}">Add Reaction</button>
      </div>
    `;
    commentsContainer?.appendChild(commentElement);
  });

  // Add event listeners for reaction buttons
  document.querySelectorAll('.reaction-btn').forEach(button => {
    button.addEventListener('click', (event) => {
      event.stopPropagation(); // Prevent modal from closing if this is inside a modal
      const commentId = event.target.dataset.commentId;
      const threadId = event.target.dataset.threadId;
      showEmojiPalette(event.target, threadId, commentId, 'comment');
    });
  });
}


/**
 * Adds a new comment to a thread.
 * @param {string} threadId - The ID of the thread to comment on.
 * @param {string} content - The content of the comment.
 */
async function addComment(threadId, content) {
  if (!auth.currentUser) {
    showMessageBox("You must be logged in to comment.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot add comment.", true);
    return;
  }

  try {
    const user = getCurrentUser();
    const commentData = {
      content: content,
      authorUid: user.uid,
      authorDisplayName: user.displayName || user.email || 'Anonymous',
      authorHandle: user.handle || 'N/A',
      authorPhotoURL: user.photoURL || DEFAULT_PROFILE_PIC,
      createdAt: serverTimestamp(),
      reactions: {}
    };
    await addDoc(collection(db, COMMENTS_COLLECTION_PREFIX(threadId)), commentData);
    showMessageBox("Comment added successfully!", false);
    easyMDECommentContent.value(''); // Clear EasyMDE editor
  } catch (error) {
    console.error("Error adding comment:", error);
    showMessageBox(`Failed to add comment: ${error.message}`, true);
  }
}

/**
 * Updates the comment count on the main thread document.
 * @param {string} threadId - The ID of the thread.
 * @param {number} count - The new comment count.
 */
async function updateThreadCommentCount(threadId, count) {
  if (!db) return;
  const threadDocRef = doc(db, THREADS_COLLECTION, threadId);
  try {
    await updateDoc(threadDocRef, {
      commentCount: count,
      updatedAt: serverTimestamp() // Update timestamp when comments change
    });
    // No message box here, as this is a background update
  } catch (error) {
    console.error("Error updating thread comment count:", error);
  }
}

/**
 * Adds or updates a reaction to a thread or comment.
 * @param {string} type - 'thread' or 'comment'.
 * @param {string} targetId - The ID of the thread or comment.
 * @param {string} emoji - The emoji character (e.g., '👍').
 */
async function addReaction(type, targetId, emoji) {
  if (!auth.currentUser) {
    showMessageBox("You must be logged in to react.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized.", true);
    return;
  }

  let docRef;
  if (type === 'thread') {
    docRef = doc(db, THREADS_COLLECTION, targetId);
  } else if (type === 'comment') {
    docRef = doc(db, COMMENTS_COLLECTION_PREFIX(currentOpenThreadId), targetId);
  } else {
    console.error("Invalid reaction type:", type);
    return;
  }

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const currentReactions = data.reactions || {};
      const newCount = (currentReactions[emoji] || 0) + 1;
      const updatedReactions = { ...currentReactions, [emoji]: newCount };

      await updateDoc(docRef, {
        reactions: updatedReactions,
        updatedAt: serverTimestamp()
      });
      // No message, real-time listener will update UI
    }
  } catch (error) {
    console.error("Error adding reaction:", error);
    showMessageBox(`Failed to add reaction: ${error.message}`, true);
  }
}

/**
 * Displays an emoji palette next to the clicked element.
 * @param {HTMLElement} targetElement - The button that was clicked.
 * @param {string} threadId - The ID of the thread.
 * @param {string} [commentId] - The ID of the comment (if type is 'comment').
 * @param {string} type - 'thread' or 'comment'.
 */
function showEmojiPalette(targetElement, threadId, commentId = null, type = 'thread') {
  const emojis = ['👍', '❤️', '😂', '🔥', '🤔', '🥳', '🎉']; // Common emojis
  let palette = document.getElementById('emoji-palette');

  if (!palette) {
    palette = document.createElement('div');
    palette.id = 'emoji-palette';
    palette.classList.add('emoji-palette', 'absolute', 'z-10', 'flex', 'flex-wrap', 'gap-2');
    document.body.appendChild(palette);
  } else {
    palette.innerHTML = ''; // Clear existing emojis
  }

  emojis.forEach(emoji => {
    const emojiSpan = document.createElement('span');
    emojiSpan.textContent = emoji;
    emojiSpan.classList.add('emoji-item');
    emojiSpan.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent closing palette immediately
      addReaction(type, commentId || threadId, emoji);
      palette.style.display = 'none';
    });
    palette.appendChild(emojiSpan);
  });

  // Position the palette
  const rect = targetElement.getBoundingClientRect();
  palette.style.left = `${rect.left + window.scrollX}px`;
  palette.style.top = `${rect.bottom + window.scrollY + 10}px`; // 10px below the button
  palette.style.display = 'flex';

  // Hide palette when clicking anywhere else
  const hidePalette = (e) => {
    if (!palette.contains(e.target) && e.target !== targetElement) {
      palette.style.display = 'none';
      document.removeEventListener('click', hidePalette);
    }
  };
  document.addEventListener('click', hidePalette);
}


// --- Event Listeners and Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
  // Ensure Firebase is initialized and user authentication state is settled.
  await setupFirebaseAndUser();
  // IMPORTANT: Initialize setupThemesFirebase AFTER setupFirebaseAndUser resolves
  setupThemesFirebase(db, auth, appId);

  // Load navbar dynamically
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Set current year for footer
  const currentYearElement = document.getElementById('current-year-forms');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }

  // Initialize EasyMDE for thread creation form
  if (threadContentInput) {
    easyMDEThreadContent = new EasyMDE({
      element: threadContentInput,
      spellChecker: false,
      forceSync: true,
      minHeight: "150px",
      toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "guide"]
    });
  }

  // Event listener for Create Thread Form submission
  createThreadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = threadTitleInput.value.trim();
    const content = easyMDEThreadContent ? easyMDEThreadContent.value().trim() : threadContentInput.value.trim();

    if (!title || !content) {
      showMessageBox("Please enter both title and content for your thread.", true);
      return;
    }
    await createThread(title, content);
  });

  // Event listener for Add Comment Form submission
  addCommentForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const commentContent = easyMDECommentContent ? easyMDECommentContent.value().trim() : commentContentInput.value.trim();

    if (!commentContent) {
      showMessageBox("Please enter content for your comment.", true);
      return;
    }
    if (currentOpenThreadId) {
      await addComment(currentOpenThreadId, commentContent);
    } else {
      showMessageBox("No thread selected to add comment.", true);
    }
  });

  // Event listener for Thread Modal Close Button
  threadCloseButton?.addEventListener('click', () => {
    threadModal.style.display = 'none';
    currentOpenThreadId = null; // Clear the current thread ID
  });

  // Close modal when clicking outside of it
  window.addEventListener('click', (event) => {
    if (event.target === threadModal) {
      threadModal.style.display = 'none';
      currentOpenThreadId = null;
    }
  });


  // Initial render of threads
  renderThreads();

  // Optionally, set up a real-time listener for all threads to update the main page
  // This could be heavy for very large collections. Consider a simpler periodic refresh or just rely on manual refresh.
  // For this example, we will re-render all threads after a new thread is added or a comment count changes.
  // A dedicated onSnapshot for the main threads collection could be added here if truly real-time main page updates are desired.
});
