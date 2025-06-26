// forum.js: Handles forum threads, comments, and reactions.

import { db, appId, getCurrentUser, ADMIN_UIDS } from './firebase-init.js';
import { showMessageBox, showCustomConfirm, parseEmojis, parseMentions, renderReactionButtons, COMMON_EMOJIS, getUserProfileFromFirestore } from './utils.js';
import { allThemesCache, populateThemeDropdowns, displayCurrentThemeInfo } from './themes-api.js';
import { collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- DOM Elements ---
const threadsList = document.getElementById('threads-list');
const createThreadForm = document.getElementById('create-thread-form');
const createThreadThemeSelect = document.getElementById('create-thread-theme');
const threadTitleInput = document.getElementById('thread-title');
const threadContentInput = document.getElementById('thread-content');
const threadsLoadingError = document.getElementById('threads-loading-error');
const noThreadsMessage = document.getElementById('no-threads-message');
const themeSelect = document.getElementById('theme-select'); // Theme filter select


// --- State Variables ---
export let currentSelectedThemeId = 'all'; // Default to show all threads
let unsubscribeForumThreads = null; // Listener for forum threads


// --- FORUM THREAD FUNCTIONS ---

/**
 * Creates a new forum thread in Firestore.
 * @param {string} themeId - The ID of the theme this thread belongs to.
 * @param {string} themeName - The name of the theme (denormalized for display).
 * @param {string} title - The title of the new thread.
 * @param {string} content - The main content/body of the thread.
 */
export async function createThread(themeId, themeName, title, content) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.uid || !currentUser.handle) {
    showMessageBox("You must be logged in and have a handle to create a thread.", true);
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
  if (!title || !content) {
    showMessageBox("Please enter both title and content for your thread.", true);
    return;
  }

  const threadsCol = collection(db, `artifacts/${appId}/public/data/forum_threads`);
  const threadData = {
    themeId: themeId,
    themeName: themeName, // Store denormalized name
    title: title,
    content: content,
    authorId: currentUser.uid,
    authorHandle: currentUser.handle,
    authorDisplayName: currentUser.displayName,
    authorPhotoURL: currentUser.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV',
    createdAt: serverTimestamp(),
    reactions: {}, // Will be used for 'points'
    commentCount: 0
  };

  try {
    await addDoc(threadsCol, threadData);
    showMessageBox("Thread created successfully!", false);
    createThreadForm.reset();
    createThreadThemeSelect.value = ''; // Reset theme selection
  } catch (error) {
    console.error("Error creating thread:", error);
    showMessageBox(`Error creating thread: ${error.message}`, true);
  }
}

/**
 * Deletes a forum thread and all its associated comments from Firestore.
 * @param {string} threadId - The ID of the thread to be deleted.
 */
export async function deleteThread(threadId) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    showMessageBox("You must be logged in to delete a thread.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete thread.", true);
    return;
  }

  const threadDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
  const threadSnap = await getDoc(threadDocRef);
  if (!threadSnap.exists()) {
    showMessageBox("Thread not found.", true);
    return;
  }
  const threadData = threadSnap.data();

  // Check permissions: thread author, theme mod, or server admin
  const isAuthor = currentUser.uid === threadData.authorId;
  const isThemeMod = threadData.themeId ? (allThemesCache.find(t => t.id === threadData.themeId)?.moderators.includes(currentUser.uid)) : false;
  const isServerAdmin = currentUser.isAdmin;

  if (!(isAuthor || isThemeMod || isServerAdmin)) {
    showMessageBox("You do not have permission to delete this thread.", true);
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
 * @param {string} content - The main content of the new comment.
 */
export async function addCommentToThread(threadId, content) {
  const currentUser = getCurrentUser();
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
    authorDisplayName: currentUser.displayName,
    authorPhotoURL: currentUser.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV',
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
export async function deleteComment(threadId, commentId) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    showMessageBox("You must be logged in to delete a comment.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete comment.", true);
    return;
  }

  const commentDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads/${threadId}/comments`, commentId);
  const commentSnap = await getDoc(commentDocRef);
  if (!commentSnap.exists()) {
    showMessageBox("Comment not found.", true);
    return;
  }
  const commentData = commentSnap.data();

  const threadDocRef = doc(db, `artifacts/${appId}/public/data/forum_threads`, threadId);
  const threadSnap = await getDoc(threadDocRef);
  const threadData = threadSnap.data(); // Get thread data to check theme mod permissions

  // Check permissions: comment author, thread author, theme mod, or server admin
  const isAuthor = currentUser.uid === commentData.authorId;
  const isThreadAuthor = currentUser.uid === threadData.authorId;
  const isThemeMod = threadData.themeId ? (allThemesCache.find(t => t.id === threadData.themeId)?.moderators.includes(currentUser.uid)) : false;
  const isServerAdmin = currentUser.isAdmin;

  if (!(isAuthor || isThreadAuthor || isThemeMod || isServerAdmin)) {
    showMessageBox("You do not have permission to delete this comment.", true);
    return;
  }

  const confirmation = await showCustomConfirm("Are you sure you want to delete this comment?", "This action cannot be undone.");
  if (!confirmation) {
    showMessageBox("Comment deletion cancelled.", false);
    return;
  }

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
export async function handleReaction(type, itemId, commentId = null, emoji) {
  const currentUser = getCurrentUser();
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


// --- REAL-TIME RENDERING (ONSNAPSHOT) ---

/**
 * Renders the forum threads in real-time.
 * @param {string} selectedThemeId - The ID of the theme to filter by, or 'all'.
 */
export function renderForumThreads(selectedThemeId = 'all') {
  currentSelectedThemeId = selectedThemeId; // Update global state
  localStorage.setItem('currentSelectedThemeId', selectedThemeId); // Persist state

  if (unsubscribeForumThreads) {
    unsubscribeForumThreads();
  }

  if (!db || !threadsList) {
    console.error("Firestore DB or threadsList element not ready for forum rendering.");
    return;
  }

  populateThemeDropdowns(); // Ensure theme dropdowns are always populated
  displayCurrentThemeInfo(currentSelectedThemeId); // Update theme info panel

  const threadsCol = collection(db, `artifacts/${appId}/public/data/forum_threads`);
  let q;
  if (currentSelectedThemeId === 'all') {
    q = query(threadsCol, orderBy("createdAt", "desc"));
    noThreadsMessage.textContent = 'No threads found. Be the first to post!';
  } else {
    // This query requires a composite index: (themeId ASC, createdAt DESC)
    // Go to Firebase Console > Firestore Database > Indexes and create:
    // Collection ID: forum_threads
    // Fields: themeId (Ascending), createdAt (Descending)
    q = query(threadsCol, where("themeId", "==", currentSelectedThemeId), orderBy("createdAt", "desc"));
    const selectedTheme = allThemesCache.find(t => t.id === currentSelectedThemeId);
    noThreadsMessage.textContent = `No threads found in "${selectedTheme ? selectedTheme.name : 'this theme'}". Be the first to post!`;
  }


  // Attach new listener for forum threads
  unsubscribeForumThreads = onSnapshot(q, async (snapshot) => {
    threadsList.innerHTML = '';
    if (snapshot.empty) {
      noThreadsMessage.style.display = 'block';
      threadsLoadingError.style.display = 'none';
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
      }
    }

    for (const threadDoc of snapshot.docs) {
      const thread = threadDoc.data();
      const threadId = threadDoc.id;
      const authorProfile = fetchedProfiles.get(thread.authorId) || {};
      const authorDisplayName = authorProfile.displayName || thread.authorDisplayName || 'Anonymous User';
      const authorHandle = authorProfile.handle || thread.authorHandle || 'N/A';
      const authorPhotoURL = authorProfile.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';

      // Calculate total upvotes/downvotes
      const upvotes = Object.keys(thread.reactions?.['👍'] || {}).length;
      const downvotes = Object.keys(thread.reactions?.['👎'] || {}).length;
      const score = upvotes - downvotes;

      const threadElement = document.createElement('div');
      threadElement.id = `thread-${threadId}`;
      threadElement.className = 'thread-card';

      const parsedContentSnippet = (await parseMentions(parseEmojis(thread.content))).substring(0, 200) + (thread.content.length > 200 ? '...' : '');
      const currentUser = getCurrentUser();

      threadElement.innerHTML = `
        <div class="thread-card-sidebar">
          <i class="fas fa-arrow-up cursor-pointer" data-action="react" data-type="thread" data-item-id="${threadId}" data-emoji="👍"></i>
          <span class="score">${score}</span>
          <i class="fas fa-arrow-down cursor-pointer" data-action="react" data-type="thread" data-item-id="${threadId}" data-emoji="👎"></i>
        </div>
        <div class="thread-card-content">
          <div class="thread-card-info">
            <img src="${authorPhotoURL}" alt="Profile" class="w-6 h-6 rounded-full mr-2 object-cover">
            <a href="#" class="theme-link hover:underline" data-theme-id="${thread.themeId}">t/${thread.themeName || 'general'}</a>
            <span class="text-gray-400 mx-1">• Posted by</span>
            <span class="author-handle">@${authorHandle}</span>
            <span class="text-gray-400 mx-1">•</span>
            <span class="timestamp">${thread.createdAt ? new Date(thread.createdAt.toDate()).toLocaleString() : 'N/A'}</span>
          </div>
          <h3 class="thread-card-title">${thread.title}</h3>
          <div class="thread-card-body">
            <p>${parsedContentSnippet}</p>
          </div>
          <div class="thread-actions">
            <button class="action-btn comment-count-btn">
              <i class="fas fa-comment-alt"></i> ${thread.commentCount || 0} Comments
            </button>
            <div id="thread-reactions-${threadId}" class="flex flex-wrap items-center">
                <!-- Reaction buttons will be rendered here -->
            </div>
            ${currentUser && (currentUser.uid === thread.authorId || currentUser.isAdmin || (thread.themeId && allThemesCache.find(t => t.id === thread.themeId)?.moderators.includes(currentUser.uid))) ? `
                <button class="delete-thread-btn action-btn bg-red-600 text-white hover:bg-red-700 transition duration-300" data-id="${threadId}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            ` : ''}
          </div>

          <!-- Comments Section -->
          <div class="comments-section">
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
        </div>
      `;
      threadsList.appendChild(threadElement);

      // Attach reaction handlers directly to the newly created elements
      const upvoteBtn = threadElement.querySelector(`.thread-card-sidebar .fa-arrow-up`);
      const downvoteBtn = threadElement.querySelector(`.thread-card-sidebar .fa-arrow-down`);

      if (upvoteBtn) upvoteBtn.addEventListener('click', () => handleReaction('thread', threadId, null, '👍'));
      if (downvoteBtn) downvoteBtn.addEventListener('click', () => handleReaction('thread', threadId, null, '👎'));

      const threadReactionsContainer = document.getElementById(`thread-reactions-${threadId}`);
      // Pass handleReaction directly to renderReactionButtons for other emojis
      const reactionHandler = (type, itemId, commentId, emoji) => handleReaction(type, itemId, commentId, emoji);
      renderReactionButtons('thread', threadId, thread.reactions || {}, threadReactionsContainer);


      const commentsColRef = collection(db, `artifacts/${appId}/public/data/forum_threads/${threadId}/comments`);
      const commentsQuery = query(commentsColRef, orderBy("createdAt", "asc"));

      onSnapshot(commentsQuery, async (commentSnapshot) => {
        const commentsListDiv = document.getElementById(`comments-${threadId}`);
        if (!commentsListDiv) return;

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
          }
        }

        for (const commentDoc of commentSnapshot.docs) {
          const comment = commentDoc.data();
          const commentId = commentDoc.id;
          const commentAuthorProfile = fetchedCommentAuthorProfiles.get(comment.authorId) || {};
          const commentAuthorDisplayName = commentAuthorProfile.displayName || comment.authorDisplayName || 'Anonymous User';
          const commentAuthorHandle = commentAuthorProfile.handle || comment.authorHandle || 'N/A';
          const commentAuthorPhotoURL = commentAuthorProfile.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';

          const parsedCommentContent = await parseMentions(parseEmojis(comment.content));

          const commentElement = document.createElement('div');
          commentElement.className = 'comment-card';
          commentElement.innerHTML = `
            <div class="comment-card-info">
              <img src="${commentAuthorPhotoURL}" alt="Profile" class="w-6 h-6 rounded-full mr-2 object-cover">
              <span class="author-handle">@${commentAuthorHandle}</span>
              <span class="timestamp">${comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleString() : 'N/A'}</span>
            </div>
            <div class="comment-card-content">
              <p>${parsedCommentContent}</p>
            </div>
            <div class="comment-actions">
                <div id="comment-reactions-${commentId}" class="flex flex-wrap items-center">
                    <!-- Comment reaction buttons will be rendered here -->
                </div>
                ${currentUser && (currentUser.uid === comment.authorId || currentUser.uid === thread.authorId || currentUser.isAdmin || (thread.themeId && allThemesCache.find(t => t.id === thread.themeId)?.moderators.includes(currentUser.uid))) ? `
                    <button class="delete-comment-btn text-red-400 hover:text-red-500 transition duration-300" data-thread-id="${threadId}" data-comment-id="${commentId}">
                        <i class="fas fa-trash-alt"></i> Delete
                    </button>
                ` : ''}
            </div>
          `;
          commentsListDiv.appendChild(commentElement);

          const commentReactionsContainer = document.getElementById(`comment-reactions-${commentId}`);
          renderReactionButtons('comment', threadId, comment.reactions || {}, commentReactionsContainer, commentId);
        }

        // Re-attach listeners for dynamically added content
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
        commentsListDiv.querySelectorAll('.delete-comment-btn').forEach(btn => {
          btn.removeEventListener('click', handleDeleteComment);
          btn.addEventListener('click', handleDeleteComment);
        });

      }, (commentError) => {
        console.error(`Error fetching comments for thread ${threadId}:`, commentError);
        const commentsListDiv = document.getElementById(`comments-${threadId}`);
        if (commentsListDiv) {
          commentsListDiv.innerHTML = `<p class="text-red-500">Error loading comments.</p>`;
        }
      });

      // Attach listeners for thread actions
      const deleteThreadBtn = threadElement.querySelector(`.delete-thread-btn[data-id="${threadId}"]`);
      if (deleteThreadBtn) {
        deleteThreadBtn.removeEventListener('click', handleDeleteThread);
        deleteThreadBtn.addEventListener('click', handleDeleteThread);
      }
    }
  }, (error) => {
    console.error("Error fetching real-time threads:", error);
    threadsLoadingError.textContent = `Failed to load threads: ${error.message || 'Unknown error'}`;
    threadsLoadingError.style.display = 'block';
    noThreadsMessage.style.display = 'none';
  });
}

/**
 * Unsubscribes the current forum threads listener.
 */
export function unsubscribeForumThreadsListener() {
  if (unsubscribeForumThreads) {
    unsubscribeForumThreads();
    unsubscribeForumThreads = null;
  }
}

// --- Event Handlers (exported for forms.js to attach) ---

export async function handlePostComment(event) {
  event.preventDefault(); // Prevent page reload
  const threadId = event.target.dataset.threadId;
  const commentInput = document.getElementById(`comment-input-${threadId}`);
  const commentContent = commentInput.value;
  await addCommentToThread(threadId, commentContent);
  commentInput.value = '';
}

export async function handleDeleteThread(event) {
  event.preventDefault(); // Prevent page reload
  const threadId = event.target.dataset.id;
  await deleteThread(threadId);
}

export function handleEmojiPaletteClick(event) {
  const emojiItem = event.target.closest('.emoji-item');
  if (emojiItem) {
    const emoji = emojiItem.dataset.emoji;
    const threadElement = emojiItem.closest('.thread-card');
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

export async function handleDeleteComment(event) {
  event.preventDefault();
  const button = event.target.closest('.delete-comment-btn');
  const threadId = button.dataset.threadId;
  const commentId = button.dataset.commentId;
  await deleteComment(threadId, commentId);
}
