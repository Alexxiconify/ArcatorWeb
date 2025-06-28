/* forms.js: Forum-specific functionality for thémata, threads, and comments */

// Import existing modules
import { auth, db, appId, getUserProfileFromFirestore, setUserProfileInFirestore } from './firebase-init.js';
import { showMessageBox, showCustomConfirm } from './utils.js';
import { loadFooter } from './navbar.js';

// Import DM functionality
import { 
  renderConversationsList, 
  selectConversation, 
  sendMessage, 
  deleteMessage, 
  deleteConversation,
  populateUserHandlesDatalist,
  unsubscribeConversationsListListener,
  unsubscribeCurrentMessagesListener,
  attachDmEventListeners,
  handleCreateConversation,
  initializeDmSystem,
  loadConversations,
  updateDmUiForNoConversationSelected
} from './dms.js';

// Import Firebase functions
import {
  doc, getDoc, setDoc, deleteDoc, collection, query, orderBy, addDoc,
  serverTimestamp, onSnapshot, getDocs, where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM elements
const createThemaForm = document.getElementById('create-thema-form');
const newThemaNameInput = document.getElementById('new-thema-name');
const newThemaDescriptionInput = document.getElementById('new-thema-description');
const themaList = document.getElementById('thema-boxes');

// DM elements
const dmTabBtn = document.getElementById('tab-dms');
const dmTabContent = document.getElementById('dm-tab-content');
const themataTabContent = document.getElementById('thema-all-tab-content');

let unsubscribeThematas = null;

// DM Tab Functionality
let currentSortOption = 'lastMessageAt_desc';

// Utility: escape HTML for safe rendering
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper: get current user info
function getCurrentUserInfo() {
  if (window.currentUser) {
    return {
      uid: window.currentUser.uid,
      displayName: window.currentUser.displayName || 'Anonymous',
      photoURL: window.currentUser.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV',
      isAdmin: window.currentUser.isAdmin || false
    };
  }
  if (auth.currentUser) {
    return {
      uid: auth.currentUser.uid,
      displayName: auth.currentUser.displayName || 'Anonymous',
      photoURL: auth.currentUser.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV',
      isAdmin: false
    };
  }
  return { uid: null, displayName: 'Anonymous', photoURL: '', isAdmin: false };
}

// Add new thema
async function addThema(name, description) {
  if (!auth.currentUser) {
    showMessageBox("You must be logged in to create a théma.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized.", true);
    return;
  }

  try {
    const thematasCol = collection(db, `artifacts/${appId}/public/data/thematas`);
    await addDoc(thematasCol, {
      name: name,
      description: description,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid,
      creatorDisplayName: window.currentUser ? window.currentUser.displayName : 'Anonymous'
    });
    showMessageBox("Théma created successfully!", false);
    newThemaNameInput.value = '';
    newThemaDescriptionInput.value = '';
  } catch (error) {
    console.error("Error creating théma:", error);
    showMessageBox(`Error creating théma: ${error.message}`, true);
  }
}

// Render thémata with Reddit-style layout
function renderThematas() {
  if (unsubscribeThematas) unsubscribeThematas();
  if (!db) {
    themaList.innerHTML = '<li class="thema-item text-center text-red-400">Database not initialized.</li>';
    return;
  }

  const thematasCol = collection(db, `artifacts/${appId}/public/data/thematas`);
  const q = query(thematasCol, orderBy("createdAt", "desc"));
  
  unsubscribeThematas = onSnapshot(q, async (snapshot) => {
    themaList.innerHTML = '';
    if (snapshot.empty) {
      themaList.innerHTML = '<li class="thema-item text-center text-text-secondary">No thémata found.</li>';
      return;
    }

    snapshot.forEach(docSnap => {
      const thema = docSnap.data();
      const themaId = docSnap.id;
      const li = document.createElement('li');
      li.className = 'thema-item mb-6 p-4 bg-card rounded-lg shadow';
      
      const header = document.createElement('div');
      header.className = 'flex items-center justify-between mb-2';
      
      const titleBox = document.createElement('div');
      titleBox.innerHTML = `
        <span class="font-bold text-lg">${escapeHtml(thema.name)}</span>
        <div class="thema-description text-text-secondary text-sm">${escapeHtml(thema.description)}</div>
      `;
      
      const actions = document.createElement('div');
      actions.className = 'flex items-center gap-2';
      
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-themata-btn text-blue-400 hover:text-blue-300 p-1';
      editBtn.title = 'Edit Themata';
      editBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>';
      editBtn.onclick = () => openEditThemaModal(themaId, thema);
      
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-themata-btn text-red-400 hover:text-red-300 p-1';
      delBtn.title = 'Delete Themata';
      delBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>';
      delBtn.onclick = () => deleteThemaAndSubcollections(themaId);
      
      actions.append(editBtn, delBtn);
      header.append(titleBox, actions);
      li.append(header);
      
      const threadsDiv = document.createElement('div');
      threadsDiv.id = `threads-for-${themaId}`;
      threadsDiv.className = 'mt-2';
      li.append(threadsDiv);
      themaList.appendChild(li);
      
      loadThreadsForThema(themaId);
    });
  });
}

// Load threads for thema inline
async function loadThreadsForThema(themaId) {
  if (!db) return;

  const threadsContainer = document.querySelector(`#threads-for-${themaId}`);
  if (!threadsContainer) return;

  try {
    const threadsCol = collection(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads`);
    const q = query(threadsCol, orderBy("createdAt", "desc"));
    const threadsSnapshot = await getDocs(q);

    let threadsHtml = [];
    // Always show create thread form
    threadsHtml.push(`
      <div class="create-thread-section mb-4">
        <h4 class="text-lg font-bold mb-2">Create New Thread</h4>
        <form class="create-thread-form space-y-2" data-thema-id="${themaId}">
          <input type="text" class="${inputClass}" placeholder="Thread title" required>
          <textarea class="${textareaClass}" placeholder="Initial comment" rows="3" required></textarea>
          <button type="submit" class="btn-primary btn-blue">Create Thread</button>
        </form>
      </div>
    `);

    if (threadsSnapshot.empty) {
      threadsHtml.push('<div class="no-threads">No threads yet. Be the first to start one!</div>');
    } else {
      threadsHtml.push('<div class="threads-list space-y-3">');
      for (const threadDoc of threadsSnapshot.docs) {
        const thread = threadDoc.data();
        const createdAt = thread.createdAt ? new Date(thread.createdAt.toDate()).toLocaleString() : 'N/A';
        // Fetch user profile for thread creator
        let userProfile = { displayName: thread.creatorDisplayName || 'Anonymous', photoURL: null };
        if (thread.createdBy) {
          try {
            userProfile = await getUserProfileFromFirestore(thread.createdBy) || userProfile;
          } catch {}
        }
        const photoURL = userProfile.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
        threadsHtml.push(`
          <div class="thread-item ${cardClass} p-3" data-thread-id="${threadDoc.id}">
            <div class="thread-header flex items-center gap-3">
              <img src="${photoURL}" alt="User" class="w-8 h-8 rounded-full object-cover mr-2">
              <div>
                <h5 class="text-lg font-semibold">${escapeHtml(thread.title)}</h5>
                <span class="text-xs text-text-secondary">by ${escapeHtml(userProfile.displayName || 'Anonymous')}</span>
              </div>
              <div class="thread-actions ml-auto">
                ${(window.currentUser && window.currentUser.isAdmin) ? `
                  <button class="edit-thread-btn btn-primary btn-blue" title="Edit Thread">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                  </button>
                  <button class="delete-thread-btn btn-primary btn-red" title="Delete Thread">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                ` : ''}
              </div>
            </div>
            <p class="thread-initial-comment text-sm mt-2">${escapeHtml(thread.initialComment)}</p>
            <div class="reactions-bar mt-2">
              <button class="reaction-btn" title="Like">👍 <span class="reaction-count">0</span></button>
              <button class="reaction-btn" title="Love">❤️ <span class="reaction-count">0</span></button>
              <button class="reaction-btn" title="Laugh">😂 <span class="reaction-count">0</span></button>
            </div>
            <p class="meta-info text-xs mt-2">Created on ${createdAt}</p>
            <div class="thread-comments" data-thread-id="${threadDoc.id}">
              <div class="comments-loading">Loading comments...</div>
            </div>
          </div>
        `);
      }
      threadsHtml.push('</div>');
    }
    threadsContainer.innerHTML = threadsHtml.join('');

    // Load comments for each thread
    for (const threadDoc of threadsSnapshot.docs) {
      await loadCommentsForThread(themaId, threadDoc.id);
    }

    // Add event listeners
    setupThreadEventListeners(themaId);

  } catch (error) {
    console.error("Error loading threads for thema:", themaId, error);
    threadsContainer.innerHTML = '<div class="error">Error loading threads</div>';
  }
}

// Load comments for thread inline
async function loadCommentsForThread(themaId, threadId) {
  if (!db) return;

  const commentsContainer = document.querySelector(`[data-thread-id="${threadId}"] .thread-comments`);
  if (!commentsContainer) return;

  try {
    const commentsCol = collection(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`);
    const q = query(commentsCol, orderBy("createdAt", "asc"));
    const commentsSnapshot = await getDocs(q);

    let commentsHtml = [];

    if (commentsSnapshot.empty) {
      commentsHtml.push('<div class="no-comments text-sm text-gray-500">No comments yet.</div>');
    } else {
      commentsHtml.push('<div class="comments-list space-y-2">');
      for (const commentDoc of commentsSnapshot.docs) {
        const comment = commentDoc.data();
        const createdAt = comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleString() : 'N/A';
        // Fetch user profile for comment creator
        let userProfile = { displayName: comment.creatorDisplayName || 'Anonymous', photoURL: null };
        if (comment.createdBy) {
          try {
            userProfile = await getUserProfileFromFirestore(comment.createdBy) || userProfile;
          } catch {}
        }
        const photoURL = userProfile.photoURL || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
        commentsHtml.push(`
          <div class="${commentClass}" data-comment-id="${commentDoc.id}">
            <div class="${commentHeaderClass}">
              <img src="${photoURL}" alt="User" class="w-7 h-7 rounded-full object-cover mr-2">
              <div>
                <span class="text-xs text-text-secondary">${escapeHtml(userProfile.displayName || 'Anonymous')}</span>
                <p class="comment-content text-sm mt-1">${escapeHtml(comment.content)}</p>
              </div>
              <div class="comment-actions ml-auto">
                ${(window.currentUser && window.currentUser.isAdmin) ? `
                  <button class="edit-comment-btn btn-primary btn-blue" title="Edit Comment">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                  </button>
                  <button class="delete-comment-btn btn-primary btn-red" title="Delete Comment">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                ` : ''}
              </div>
            </div>
            <div class="reactions-bar mt-1">
              <button class="reaction-btn" title="Like">👍 <span class="reaction-count">0</span></button>
              <button class="reaction-btn" title="Love">❤️ <span class="reaction-count">0</span></button>
              <button class="reaction-btn" title="Laugh">😂 <span class="reaction-count">0</span></button>
            </div>
            <p class="meta-info text-xs mt-1">Posted on ${createdAt}</p>
          </div>
        `);
      }
      commentsHtml.push('</div>');
    }

    // Add comment form
    commentsHtml.push(`
      <div class="add-comment-section mt-3">
        <form class="add-comment-form space-y-2" data-thema-id="${themaId}" data-thread-id="${threadId}">
          <textarea class="${textareaClass} text-sm" placeholder="Add a comment..." rows="2" required></textarea>
          <button type="submit" class="btn-primary btn-blue text-sm">Add Comment</button>
        </form>
      </div>
    `);

    commentsContainer.innerHTML = commentsHtml.join('');
    setupCommentEventListeners(themaId, threadId);

  } catch (error) {
    console.error("Error loading comments for thread:", threadId, error);
    commentsContainer.innerHTML = '<div class="error text-sm">Error loading comments</div>';
  }
}

// Setup thread event listeners
function setupThreadEventListeners(themaId) {
  const threadsContainer = document.querySelector(`#threads-for-${themaId}`);
  if (!threadsContainer) return;

  // Create thread form
  threadsContainer.querySelectorAll('.create-thread-form').forEach(form => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const titleInput = form.querySelector('input[type="text"]');
      const commentInput = form.querySelector('textarea');
      
      if (titleInput.value.trim() && commentInput.value.trim()) {
        await addCommentThread(themaId, titleInput.value.trim(), commentInput.value.trim());
        titleInput.value = '';
        commentInput.value = '';
      }
    });
  });

  // Thread actions
  threadsContainer.querySelectorAll('.edit-thread-btn').forEach(button => {
    button.addEventListener('click', () => {
      showMessageBox("Edit functionality coming soon!", false);
    });
  });

  threadsContainer.querySelectorAll('.delete-thread-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      const threadId = event.target.closest('.thread-item').dataset.threadId;
      const confirmed = await showCustomConfirm("Delete this thread?", "All comments will also be deleted.");
      if (confirmed) {
        await deleteThreadAndSubcollection(themaId, threadId);
      }
    });
  });
}

// Setup comment event listeners
function setupCommentEventListeners(themaId, threadId) {
  const commentsContainer = document.querySelector(`[data-thread-id="${threadId}"] .thread-comments`);
  if (!commentsContainer) return;

  // Add comment form
  commentsContainer.querySelectorAll('.add-comment-form').forEach(form => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const commentInput = form.querySelector('textarea');
      
      if (commentInput.value.trim()) {
        await addComment(themaId, threadId, commentInput.value.trim());
        commentInput.value = '';
      }
    });
  });

  // Comment actions
  commentsContainer.querySelectorAll('.edit-comment-btn').forEach(button => {
    button.addEventListener('click', () => {
      showMessageBox("Edit functionality coming soon!", false);
    });
  });

  commentsContainer.querySelectorAll('.delete-comment-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      const commentId = event.target.closest('.comment-item').dataset.commentId;
      const confirmed = await showCustomConfirm("Delete this comment?", "This action cannot be undone.");
      if (confirmed) {
        await deleteComment(themaId, threadId, commentId);
      }
    });
  });
}

// Add comment thread
async function addCommentThread(themaId, title, initialComment) {
  if (!auth.currentUser) {
    showMessageBox("You must be logged in to create a thread.", true);
    return;
  }

  try {
    const threadsCol = collection(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads`);
    await addDoc(threadsCol, {
      title: title,
      initialComment: initialComment,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid,
      creatorDisplayName: window.currentUser ? window.currentUser.displayName : 'Anonymous'
    });
    showMessageBox("Thread created successfully!", false);
  } catch (error) {
    console.error("Error creating thread:", error);
    showMessageBox(`Error creating thread: ${error.message}`, true);
  }
}

// Add comment
async function addComment(themaId, threadId, content) {
  if (!auth.currentUser) {
    showMessageBox("You must be logged in to add a comment.", true);
    return;
  }

  try {
    const commentsCol = collection(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`);
    await addDoc(commentsCol, {
      content: content,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid,
      creatorDisplayName: window.currentUser ? window.currentUser.displayName : 'Anonymous'
    });
    showMessageBox("Comment posted successfully!", false);
  } catch (error) {
    console.error("Error posting comment:", error);
    showMessageBox(`Error posting comment: ${error.message}`, true);
  }
}

// Delete thema and subcollections
async function deleteThemaAndSubcollections(themaId) {
  try {
    const threadsRef = collection(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads`);
    const threadsSnapshot = await getDocs(threadsRef);
    
    for (const threadDoc of threadsSnapshot.docs) {
      const commentsRef = collection(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadDoc.id}/comments`);
      const commentsSnapshot = await getDocs(commentsRef);
      
      for (const commentDoc of commentsSnapshot.docs) {
        await deleteDoc(doc(commentsRef, commentDoc.id));
      }
      await deleteDoc(doc(threadsRef, threadDoc.id));
    }
    
    await deleteDoc(doc(db, `artifacts/${appId}/public/data/thematas`, themaId));
    showMessageBox("Théma and all content deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting théma:", error);
    showMessageBox(`Error deleting théma: ${error.message}`, true);
  }
}

// Delete thread and subcollection
async function deleteThreadAndSubcollection(themaId, threadId) {
  try {
    const commentsRef = collection(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`);
    const commentsSnapshot = await getDocs(commentsRef);
    
    for (const commentDoc of commentsSnapshot.docs) {
      await deleteDoc(doc(commentsRef, commentDoc.id));
    }
    
    await deleteDoc(doc(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads`, threadId));
    showMessageBox("Thread and comments deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting thread:", error);
    showMessageBox(`Error deleting thread: ${error.message}`, true);
  }
}

// Delete comment
async function deleteComment(themaId, threadId, commentId) {
  try {
    await deleteDoc(doc(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`, commentId));
    showMessageBox("Comment deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting comment:", error);
    showMessageBox(`Error deleting comment: ${error.message}`, true);
  }
}

// Edit thema modal (placeholder)
function openEditThemaModal(themaId, thema) {
  showMessageBox(`Edit functionality coming soon for: ${thema.name}`, false);
}

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  // Load footer
  loadFooter('current-year-forms');

  // Create thema form
  createThemaForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = newThemaNameInput.value.trim();
    const description = newThemaDescriptionInput.value.trim();
    
    if (name && description) {
      await addThema(name, description);
    } else {
      showMessageBox("Please fill in both Théma Name and Description.", true);
    }
  });

  // Tab navigation
  dmTabBtn?.addEventListener('click', async () => {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    dmTabContent.style.display = 'block';
    dmTabBtn.classList.add('active');
    
    // Initialize DM functionality when tab is opened
    await initializeDmTab();
  });

  const allThematasTabBtn = document.getElementById('tab-themata-all');
  allThematasTabBtn?.addEventListener('click', () => {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    themataTabContent.style.display = 'block';
    allThematasTabBtn.classList.add('active');
    renderThematas();
  });

  // Collapsible sections
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const icon = header.querySelector('.material-icons');
      
      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = 'expand_less';
      } else {
        content.style.display = 'none';
        icon.textContent = 'expand_more';
      }
    });
  });

  // Initialize thematas
  renderThematas();
});

async function handleEditThread(themaId, threadId, oldTitle, oldComment) {
  const threadDiv = document.querySelector(`[data-thread-id="${threadId}"]`);
  if (!threadDiv) return;
  threadDiv.querySelector('.thread-initial-comment').innerHTML = `<textarea class="form-input w-full" rows="2">${escapeHtml(oldComment)}</textarea>`;
  threadDiv.querySelector('.thread-header h5').innerHTML = `<input class="form-input w-full" value="${escapeHtml(oldTitle)}">`;
  const actions = threadDiv.querySelector('.thread-actions');
  actions.innerHTML = `<button class="btn-primary btn-blue save-edit-thread">Save</button><button class="btn-primary btn-red cancel-edit-thread">Cancel</button>`;
  actions.querySelector('.save-edit-thread').onclick = async () => {
    const newTitle = threadDiv.querySelector('.thread-header input').value.trim();
    const newComment = threadDiv.querySelector('.thread-initial-comment textarea').value.trim();
    if (newTitle && newComment) {
      const threadRef = doc(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads`, threadId);
      await setDoc(threadRef, { title: newTitle, initialComment: newComment }, { merge: true });
      await loadThreadsForThema(themaId);
    }
  };
  actions.querySelector('.cancel-edit-thread').onclick = () => loadThreadsForThema(themaId);
}

async function handleEditComment(themaId, threadId, commentId, oldContent) {
  const commentDiv = document.querySelector(`[data-comment-id="${commentId}"]`);
  if (!commentDiv) return;
  commentDiv.querySelector('.comment-content').innerHTML = `<textarea class="form-input w-full" rows="2">${escapeHtml(oldContent)}</textarea>`;
  const actions = commentDiv.querySelector('.comment-actions');
  actions.innerHTML = `<button class="btn-primary btn-blue save-edit-comment">Save</button><button class="btn-primary btn-red cancel-edit-comment">Cancel</button>`;
  actions.querySelector('.save-edit-comment').onclick = async () => {
    const newContent = commentDiv.querySelector('.comment-content textarea').value.trim();
    if (newContent) {
      const commentRef = doc(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`, commentId);
      await setDoc(commentRef, { content: newContent }, { merge: true });
      await loadCommentsForThread(themaId, threadId);
    }
  };
  actions.querySelector('.cancel-edit-comment').onclick = () => loadCommentsForThread(themaId, threadId);
}

// --- PATCH: REACTIONS ---
async function handleReaction(type, themaId, threadId, commentId = null) {
  const user = getCurrentUserInfo();
  if (!user.uid) return;
  let ref;
  if (commentId) {
    ref = doc(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`, commentId);
  } else {
    ref = doc(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads`, threadId);
  }
  const docSnap = await getDoc(ref);
  let reactions = docSnap.data().reactions || {};
  if (reactions[user.uid] === type) {
    delete reactions[user.uid];
  } else {
    reactions[user.uid] = type;
  }
  await setDoc(ref, { reactions }, { merge: true });
  if (commentId) await loadCommentsForThread(themaId, threadId);
  else await loadThreadsForThema(themaId);
}

const inputClass = 'form-input bg-card text-text-primary border-none rounded w-full';
const textareaClass = 'form-input bg-card text-text-primary border-none rounded w-full';
const cardClass = 'bg-card text-text-primary border border-input-border rounded-lg shadow';
const commentClass = 'comment-item p-2 ' + cardClass + ' mt-2';
const threadHeaderClass = 'thread-header flex items-center gap-3 bg-card text-text-primary';
const commentHeaderClass = threadHeaderClass;

// DM Tab Functionality
async function initializeDmTab() {
  console.log('Initializing DM tab...');
  
  try {
    // Initialize DM functionality
    await initializeDmSystem();
    
    // Set up event listeners for DM tab
    setupDmEventListeners();
    
    // Load initial conversations
    await loadConversations();
    
    console.log('DM tab initialized successfully');
  } catch (error) {
    console.error('Error initializing DM tab:', error);
  }
}

async function setupDmEventListeners() {
  // DM-specific event listeners
  attachDmEventListeners();
  
  // Sort conversations
  const sortSelect = document.getElementById('sort-conversations-by');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentSortOption = sortSelect.value;
      renderConversationsList();
    });
  }
  
  // Back to chats button
  const backBtn = document.getElementById('back-to-chats-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      updateDmUiForNoConversationSelected();
    });
  }
  
  // Create conversation form - ensure it's properly connected
  const createForm = document.getElementById('create-conversation-form');
  if (createForm) {
    // Remove any existing listeners to prevent duplicates
    createForm.removeEventListener('submit', handleCreateConversation);
    createForm.addEventListener('submit', handleCreateConversation);
  }
  
  // Click outside suggestions to hide them
  document.addEventListener('click', (event) => {
    const privateSuggestions = document.getElementById('private-chat-suggestions');
    const groupSuggestions = document.getElementById('group-chat-suggestions');
    
    if (privateSuggestions && !event.target.closest('.recipient-input-container')) {
      privateSuggestions.style.display = 'none';
    }
    
    if (groupSuggestions && !event.target.closest('.recipient-input-container')) {
      groupSuggestions.style.display = 'none';
    }
  });
}
