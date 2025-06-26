// forms.js: Handles functionality for the Thémata (Subreddits) and Comment Threads page.

// Assume firebase-init.js, themes.js, and utils.js are loaded before this script
// and expose their functionalities globally via the 'window' object, or are imported.
// For this consolidated approach, all are embedded into the HTML.

// DOM elements
const loadingSpinner = document.getElementById('loading-spinner');
const formsContent = document.getElementById('forms-content');
const loginRequiredMessage = document.getElementById('login-required-message');

// Théma elements
const createThemaForm = document.getElementById('create-thema-form');
const newThemaNameInput = document.getElementById('new-thema-name');
const newThemaDescriptionInput = document.getElementById('new-thema-description');
const themaList = document.getElementById('thema-list');

// Threads elements
const threadsSection = document.getElementById('threads-section');
const backToThematasBtn = document.getElementById('back-to-thematas-btn');
const currentThemaTitle = document.getElementById('current-thema-title');
const currentThemaDescription = document.getElementById('current-thema-description');
const createThreadForm = document.getElementById('create-thread-form');
const newThreadTitleInput = document.getElementById('new-thread-title');
const newThreadInitialCommentInput = document.getElementById('new-thread-initial-comment');
const threadList = document.getElementById('thread-list');

// Comments elements
const commentsSection = document.getElementById('comments-section');
const backToThreadsBtn = document.getElementById('back-to-threads-btn');
const currentThreadTitle = document.getElementById('current-thread-title');
const currentThreadInitialComment = document.getElementById('current-thread-initial-comment');
const addCommentForm = document.getElementById('add-comment-form');
const newCommentContentInput = document.getElementById('new-comment-content');
const commentList = document.getElementById('comment-list');

// State variables for currently selected théma and thread
let currentThemaId = null;
let currentThreadId = null;
let unsubscribeThemaComments = null; // To unsubscribe from comment snapshots

// --- Utility Functions (exposed globally by firebase-init.js and utils.js) ---
const auth = window.auth;
const db = window.db;
const appId = window.appId;
const firebaseReadyPromise = window.firebaseReadyPromise;
const DEFAULT_PROFILE_PIC = window.DEFAULT_PROFILE_PIC;
const DEFAULT_THEME_NAME = window.DEFAULT_THEME_NAME;
const currentUser = window.currentUser; // Live user profile
const showMessageBox = window.showMessageBox;
const showCustomConfirm = window.showCustomConfirm;
const getUserProfileFromFirestore = window.getUserProfileFromFirestore; // Assuming it's exposed globally

/**
 * Shows the loading spinner and hides content.
 */
function showLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'flex';
  if (formsContent) formsContent.style.display = 'none';
  if (loginRequiredMessage) loginRequiredMessage.style.display = 'none';
}

/**
 * Hides the loading spinner.
 */
function hideLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'none';
}

/**
 * Updates UI based on user authentication status.
 * @param {object|null} user - The Firebase User object or null.
 */
async function updateUIBasedOnAuth(user) {
  hideLoading();
  if (user) {
    // Await currentUser to be fully populated by firebase-init.js
    // This is important because currentUser.displayName and .photoURL are used.
    // Give it a short delay to allow firebase-init.js's onAuthStateChanged to run and populate currentUser.
    let profileLoaded = false;
    for (let i = 0; i < 10; i++) {
      if (window.currentUser && window.currentUser.uid === user.uid && typeof window.currentUser.displayName !== 'undefined') {
        profileLoaded = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
    }

    if (profileLoaded) {
      if (formsContent) formsContent.style.display = 'block';
      if (loginRequiredMessage) loginRequiredMessage.style.display = 'none';
    } else {
      // Fallback if profile doesn't load for some reason (e.g., Firestore error)
      showMessageBox("Failed to load user profile. Some features might be limited.", true);
      if (formsContent) formsContent.style.display = 'none'; // Still hide interactive forms
      if (loginRequiredMessage) loginRequiredMessage.style.display = 'block';
    }
  } else {
    if (formsContent) formsContent.style.display = 'none';
    if (loginRequiredMessage) loginRequiredMessage.style.display = 'block';
  }
}

// --- Thémata Functions ---

/**
 * Adds a new théma (subreddit) to Firestore.
 * @param {string} name - The name of the théma.
 * @param {string} description - The description of the théma.
 */
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

/**
 * Renders the list of thémata (subreddits) from Firestore.
 */
function renderThematas() {
  if (!db) {
    themaList.innerHTML = '<li class="card p-4 text-center text-red-400">Database not initialized.</li>';
    return;
  }

  const thematasCol = collection(db, `artifacts/${appId}/public/data/thematas`);
  const q = query(thematasCol, orderBy("createdAt", "desc")); // Order by creation time

  onSnapshot(q, (snapshot) => {
    themaList.innerHTML = ''; // Clear current list
    if (snapshot.empty) {
      themaList.innerHTML = '<li class="card p-4 text-center">No thémata found. Be the first to create one!</li>';
      return;
    }

    snapshot.forEach((doc) => {
      const thema = doc.data();
      const li = document.createElement('li');
      li.classList.add('thema-item', 'card');
      const createdAt = thema.createdAt ? new Date(thema.createdAt.toDate()).toLocaleString() : 'N/A';

      li.innerHTML = `
        <h3 class="text-xl font-bold text-heading-card">${thema.name}</h3>
        <p class="thema-description mt-2">${thema.description}</p>
        <p class="meta-info">Created by ${thema.creatorDisplayName || 'Unknown'} on ${createdAt}</p>
        <button data-thema-id="${doc.id}" data-thema-name="${thema.name}" data-thema-description="${thema.description}" class="view-threads-btn btn-primary btn-blue mt-4">View Threads</button>
        ${(window.currentUser && window.currentUser.isAdmin) ? `<button data-thema-id="${doc.id}" class="delete-thema-btn btn-primary btn-red ml-2 mt-4">Delete</button>` : ''}
      `;
      themaList.appendChild(li);
    });

    // Attach event listeners for "View Threads" buttons
    document.querySelectorAll('.view-threads-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        const themaId = event.target.dataset.themaId;
        const themaName = event.target.dataset.themaName;
        const themaDescription = event.target.dataset.themaDescription;
        displayThreadsForThema(themaId, themaName, themaDescription);
      });
    });

    // Attach event listeners for "Delete Théma" buttons (only visible to admins)
    document.querySelectorAll('.delete-thema-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const themaId = event.target.dataset.themaId;
        const confirmed = await showCustomConfirm("Are you sure you want to delete this théma?", "All threads and comments within it will also be deleted.");
        if (confirmed) {
          await deleteThemaAndSubcollections(themaId);
        } else {
          showMessageBox("Théma deletion cancelled.", false);
        }
      });
    });
  }, (error) => {
    console.error("Error fetching thémata:", error);
    themaList.innerHTML = `<li class="card p-4 text-center text-red-400">Error loading thémata: ${error.message}</li>`;
  });
}

/**
 * Deletes a théma and all its subcollections (threads and comments).
 * This requires careful handling as Firestore doesn't directly support recursive deletes.
 * @param {string} themaId - The ID of the théma to delete.
 */
async function deleteThemaAndSubcollections(themaId) {
  try {
    // Delete all comments within all threads of this théma
    const threadsRef = collection(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads`);
    const threadsSnapshot = await getDocs(threadsRef);
    for (const threadDoc of threadsSnapshot.docs) {
      const commentsRef = collection(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadDoc.id}/comments`);
      const commentsSnapshot = await getDocs(commentsRef);
      for (const commentDoc of commentsSnapshot.docs) {
        await deleteDoc(doc(commentsRef, commentDoc.id));
      }
      // After deleting comments, delete the thread itself
      await deleteDoc(doc(threadsRef, threadDoc.id));
    }
    // Finally, delete the théma document
    await deleteDoc(doc(db, `artifacts/${appId}/public/data/thematas`, themaId));

    showMessageBox("Théma and all its content deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting théma and subcollections:", error);
    showMessageBox(`Error deleting théma: ${error.message}`, true);
  }
}


/**
 * Displays the threads section for a selected théma.
 * @param {string} themaId - The ID of the selected théma.
 * @param {string} themaName - The name of the selected théma.
 * @param {string} themaDescription - The description of the selected théma.
 */
function displayThreadsForThema(themaId, themaName, themaDescription) {
  currentThemaId = themaId;
  currentThemaTitle.textContent = `Théma: ${themaName}`;
  currentThemaDescription.textContent = themaDescription;

  // Hide main content (thema list) and show threads section
  themaList.parentElement.style.display = 'none'; // Hide the parent of the themaList
  createThemaForm.parentElement.style.display = 'none'; // Hide create thema form
  threadsSection.style.display = 'block';
  commentsSection.style.display = 'none'; // Ensure comments section is hidden

  renderThreads(); // Load threads for the selected théma
}

// --- Comment Threads Functions ---

/**
 * Adds a new comment thread to a specific théma.
 * @param {string} themaId - The ID of the théma.
 * @param {string} title - The title of the thread.
 * @param {string} initialComment - The initial comment content.
 */
async function addCommentThread(themaId, title, initialComment) {
  if (!auth.currentUser) {
    showMessageBox("You must be logged in to create a thread.", true);
    return;
  }
  if (!db || !themaId) {
    showMessageBox("Database or Théma not initialized.", true);
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
    newThreadTitleInput.value = '';
    newThreadInitialCommentInput.value = '';
  } catch (error) {
    console.error("Error creating thread:", error);
    showMessageBox(`Error creating thread: ${error.message}`, true);
  }
}

/**
 * Renders the list of comment threads for the current théma.
 */
function renderThreads() {
  if (!db || !currentThemaId) {
    threadList.innerHTML = '<li class="card p-4 text-center text-red-400">Select a Théma to view threads.</li>';
    return;
  }

  const threadsCol = collection(db, `artifacts/${appId}/public/data/thematas/${currentThemaId}/threads`);
  const q = query(threadsCol, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    threadList.innerHTML = ''; // Clear current list
    if (snapshot.empty) {
      threadList.innerHTML = '<li class="card p-4 text-center">No threads yet. Be the first to start one!</li>';
      return;
    }

    snapshot.forEach((doc) => {
      const thread = doc.data();
      const li = document.createElement('li');
      li.classList.add('thread-item', 'card');
      const createdAt = thread.createdAt ? new Date(thread.createdAt.toDate()).toLocaleString() : 'N/A';

      li.innerHTML = `
        <h3 class="text-xl font-bold text-heading-card">${thread.title}</h3>
        <p class="thread-initial-comment mt-2">${thread.initialComment}</p>
        <p class="meta-info">Started by ${thread.creatorDisplayName || 'Unknown'} on ${createdAt}</p>
        <button data-thread-id="${doc.id}" data-thread-title="${thread.title}" data-thread-initial-comment="${thread.initialComment}" class="view-comments-btn btn-primary btn-green mt-4">View Comments</button>
        ${(window.currentUser && window.currentUser.isAdmin) ? `<button data-thread-id="${doc.id}" class="delete-thread-btn btn-primary btn-red ml-2 mt-4">Delete</button>` : ''}
      `;
      threadList.appendChild(li);
    });

    // Attach event listeners for "View Comments" buttons
    document.querySelectorAll('.view-comments-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        const threadId = event.target.dataset.threadId;
        const threadTitle = event.target.dataset.threadTitle;
        const threadInitialComment = event.target.dataset.threadInitialComment;
        displayCommentsForThread(threadId, threadTitle, threadInitialComment);
      });
    });

    // Attach event listeners for "Delete Thread" buttons (only visible to admins)
    document.querySelectorAll('.delete-thread-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const threadId = event.target.dataset.threadId;
        const confirmed = await showCustomConfirm("Are you sure you want to delete this thread?", "All comments within it will also be deleted.");
        if (confirmed) {
          await deleteThreadAndSubcollection(currentThemaId, threadId);
        } else {
          showMessageBox("Thread deletion cancelled.", false);
        }
      });
    });
  }, (error) => {
    console.error("Error fetching threads:", error);
    threadList.innerHTML = `<li class="card p-4 text-center text-red-400">Error loading threads: ${error.message}</li>`;
  });
}

/**
 * Deletes a thread and all its comments.
 * @param {string} themaId - The ID of the parent théma.
 * @param {string} threadId - The ID of the thread to delete.
 */
async function deleteThreadAndSubcollection(themaId, threadId) {
  try {
    // Delete all comments within this thread
    const commentsRef = collection(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`);
    const commentsSnapshot = await getDocs(commentsRef);
    for (const commentDoc of commentsSnapshot.docs) {
      await deleteDoc(doc(commentsRef, commentDoc.id));
    }
    // After deleting comments, delete the thread document itself
    await deleteDoc(doc(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads`, threadId));

    showMessageBox("Thread and its comments deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting thread and subcollection:", error);
    showMessageBox(`Error deleting thread: ${error.message}`, true);
  }
}


/**
 * Displays the comments section for a selected thread.
 * @param {string} threadId - The ID of the selected thread.
 * @param {string} threadTitle - The title of the selected thread.
 * @param {string} threadInitialComment - The initial comment of the selected thread.
 */
function displayCommentsForThread(threadId, threadTitle, threadInitialComment) {
  currentThreadId = threadId;
  currentThreadTitle.textContent = `Thread: ${threadTitle}`;
  currentThreadInitialComment.textContent = threadInitialComment;

  // Hide threads section and show comments section
  threadsSection.style.display = 'none';
  commentsSection.style.display = 'block';

  renderComments(); // Load comments for the selected thread
}

// --- Comments Functions ---

/**
 * Adds a new comment to a specific thread.
 * @param {string} themaId - The ID of the parent théma.
 * @param {string} threadId - The ID of the parent thread.
 * @param {string} content - The content of the comment.
 */
async function addComment(themaId, threadId, content) {
  if (!auth.currentUser) {
    showMessageBox("You must be logged in to add a comment.", true);
    return;
  }
  if (!db || !themaId || !threadId) {
    showMessageBox("Database, Théma, or Thread not initialized.", true);
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
    newCommentContentInput.value = '';
  } catch (error) {
    console.error("Error posting comment:", error);
    showMessageBox(`Error posting comment: ${error.message}`, true);
  }
}

/**
 * Renders the list of comments for the current thread.
 */
function renderComments() {
  if (unsubscribeThemaComments) {
    unsubscribeThemaComments(); // Unsubscribe from previous listener
  }
  if (!db || !currentThemaId || !currentThreadId) {
    commentList.innerHTML = '<li class="card p-4 text-center text-red-400">Select a Thread to view comments.</li>';
    return;
  }

  const commentsCol = collection(db, `artifacts/${appId}/public/data/thematas/${currentThemaId}/threads/${currentThreadId}/comments`);
  const q = query(commentsCol, orderBy("createdAt", "asc")); // Order comments by creation time

  unsubscribeThemaComments = onSnapshot(q, async (snapshot) => {
    commentList.innerHTML = ''; // Clear current list
    if (snapshot.empty) {
      commentList.innerHTML = '<li class="card p-4 text-center">No comments yet. Be the first to comment!</li>';
      return;
    }

    // Fetch all user profiles once to avoid repeated calls in loop
    const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
    const usersSnapshot = await getDocs(usersRef);
    const userProfiles = {};
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      userProfiles[doc.id] = data.displayName || 'Unknown User';
    });


    snapshot.forEach((doc) => {
      const comment = doc.data();
      const li = document.createElement('li');
      li.classList.add('comment-item', 'card');
      const createdAt = comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleString() : 'N/A';
      const displayName = userProfiles[comment.createdBy] || comment.creatorDisplayName || 'Unknown User';

      li.innerHTML = `
        <p class="comment-content">${comment.content}</p>
        <p class="meta-info">By ${displayName} on ${createdAt}
        ${(window.currentUser && window.currentUser.isAdmin) ? `<button data-comment-id="${doc.id}" class="delete-comment-btn btn-primary btn-red ml-2 text-xs">Delete</button>` : ''}
        </p>
      `;
      commentList.appendChild(li);
    });

    // Attach event listeners for "Delete Comment" buttons (only visible to admins)
    document.querySelectorAll('.delete-comment-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const commentId = event.target.dataset.commentId;
        const confirmed = await showCustomConfirm("Are you sure you want to delete this comment?", "This action cannot be undone.");
        if (confirmed) {
          await deleteComment(currentThemaId, currentThreadId, commentId);
        } else {
          showMessageBox("Comment deletion cancelled.", false);
        }
      });
    });
  }, (error) => {
    console.error("Error fetching comments:", error);
    commentList.innerHTML = `<li class="card p-4 text-center text-red-400">Error loading comments: ${error.message}</li>`;
  });
}

/**
 * Deletes a specific comment from a thread.
 * @param {string} themaId - The ID of the parent théma.
 * @param {string} threadId - The ID of the parent thread.
 * @param {string} commentId - The ID of the comment to delete.
 */
async function deleteComment(themaId, threadId, commentId) {
  try {
    await deleteDoc(doc(db, `artifacts/${appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`, commentId));
    showMessageBox("Comment deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting comment:", error);
    showMessageBox(`Error deleting comment: ${error.message}`, true);
  }
}


// --- Event Listeners and Initial Load ---

document.addEventListener('DOMContentLoaded', async function() {
  showLoading();

  // Wait for Firebase to be ready and user state determined
  await firebaseReadyPromise;

  // Setup themes integration
  window.setupThemesFirebase(window.db, window.auth, window.appId);

  // Load the navbar
  await window.loadNavbar(window.auth.currentUser, window.DEFAULT_PROFILE_PIC, window.DEFAULT_THEME_NAME);

  // Apply the theme based on user preference or default
  let userThemePreference = window.DEFAULT_THEME_NAME;
  if (window.currentUser && window.currentUser.themePreference) {
    userThemePreference = window.currentUser.themePreference;
  }
  const allThemes = await window.getAvailableThemes();
  const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === window.DEFAULT_THEME_NAME);
  window.applyTheme(themeToApply.id, themeToApply);

  // Update UI based on initial auth state
  onAuthStateChanged(window.auth, (user) => {
    updateUIBasedOnAuth(user);
    if (user) {
      renderThematas(); // Start rendering thémata if user is logged in
    }
  });


  // Set current year for footer
  const currentYearElement = document.getElementById('current-year-forms');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }

  // Théma Form Submission
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

  // Back to Thémata button
  backToThematasBtn?.addEventListener('click', () => {
    threadsSection.style.display = 'none';
    commentsSection.style.display = 'none'; // Ensure comments section is hidden too
    if (themaList.parentElement) {
      themaList.parentElement.style.display = 'block'; // Show the parent of the themaList
    }
    if (createThemaForm.parentElement) {
      createThemaForm.parentElement.style.display = 'block'; // Show create thema form
    }
    currentThemaId = null;
    currentThreadId = null;
    if (unsubscribeThemaComments) {
      unsubscribeThemaComments(); // Unsubscribe from comments
    }
  });

  // Thread Form Submission
  createThreadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = newThreadTitleInput.value.trim();
    const initialComment = newThreadInitialCommentInput.value.trim();
    if (currentThemaId && title && initialComment) {
      await addCommentThread(currentThemaId, title, initialComment);
    } else {
      showMessageBox("Please fill in both Thread Title and Initial Comment.", true);
    }
  });

  // Back to Threads button
  backToThreadsBtn?.addEventListener('click', () => {
    commentsSection.style.display = 'none';
    threadsSection.style.display = 'block';
    currentThreadId = null;
    if (unsubscribeThemaComments) {
      unsubscribeThemaComments(); // Unsubscribe from comments
    }
  });

  // Comment Form Submission
  addCommentForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = newCommentContentInput.value.trim();
    if (currentThemaId && currentThreadId && content) {
      await addComment(currentThemaId, currentThreadId, content);
    } else {
      showMessageBox("Please type your comment.", true);
    }
  });
});
