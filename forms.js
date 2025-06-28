/* jshint esversion: 11 */
/* global __app_id, __firebase_config, __initial_auth_token */

// forms.js: Centralized JavaScript for Forms page, encompassing Firebase, utilities, theme, navbar, and core forms logic.

// --- Firebase SDK Imports ---
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  onSnapshot,
  getDocs,
  where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Global Firebase Instances and Constants ---
const firebaseConfig = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app",
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM"
};

const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : null;
window.appId = canvasAppId || firebaseConfig.projectId || 'default-app-id';

window.app = null; // Initialize to null
window.auth = null; // Initialize to null
window.db = null;   // Initialize to null
window.currentUser = null;

window.DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
window.DEFAULT_THEME_NAME = 'dark';
window.ADMIN_UIDS = ['uOaZ8v76y2Q0X7PzJtU7Y3A2C1B4'];

let firebaseReadyResolve;
window.firebaseReadyPromise = new Promise((resolve) => {
  firebaseReadyResolve = resolve;
});

// Retrieves user profile from Firestore.
window.getUserProfileFromFirestore = async function(uid) {
  await window.firebaseReadyPromise;
  if (!window.db) {
    console.error("Firestore DB not initialized.");
    return null;
  }
  const userDocRef = doc(window.db, `artifacts/${window.appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return { uid: docSnap.id, ...docSnap.data() };
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
  }
  return null;
};

// Sets or updates user profile in Firestore.
window.setUserProfileInFirestore = async function(uid, profileData) {
  await window.firebaseReadyPromise;
  if (!window.db) { console.error("Firestore DB not initialized."); return false; }
  const userDocRef = doc(window.db, `artifacts/${window.appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    if (window.currentUser && window.currentUser.uid === uid) { window.currentUser = { ...window.currentUser, ...profileData }; }
    console.log("User profile updated in Firestore for UID:", uid);
    return true;
  }
  catch (error) { console.error("Error updating user profile in Firestore:", error); return false; }
};

// Deletes user profile from Firestore (currently commented out).
window.deleteUserProfileFromFirestore = async function(uid) {
  return false;
};

// Initializes Firebase app, authentication, and Firestore.
async function setupFirebaseAndUser() {
  console.log("Setup Firebase and user.");

  if (getApps().length === 0) {
    let finalFirebaseConfig = firebaseConfig;

    if (typeof __firebase_config !== 'undefined' && __firebase_config !== null) {
      if (typeof __firebase_config === 'string') {
        try {
          finalFirebaseConfig = JSON.parse(__firebase_config);
          console.log("Parsed __firebase_config.");
        } catch (e) {
          if (e instanceof SyntaxError && __firebase_config.trim() === '[object Object]') {
            console.warn("WARN: __firebase_config is the literal string '[object Object]' and caused a parse error. Using hardcoded config.");
          } else {
            console.error("Error parsing __firebase_config as JSON. Using hardcoded config.", e);
          }
          finalFirebaseConfig = firebaseConfig;
        }
      } else if (typeof __firebase_config === 'object') {
        finalFirebaseConfig = __firebase_config;
        console.log("Using __firebase_config object directly.");
      } else {
        console.warn("__firebase_config provided but not string or object. Using hardcoded config. Type:", typeof __firebase_config);
      }
    } else {
      console.log("__firebase_config not provided. Using hardcoded config.");
    }

    try {
      window.app = initializeApp(finalFirebaseConfig);
      window.auth = getAuth(window.app);
      window.db = getFirestore(window.app);
      console.log("Firebase initialized.");

      const unsubscribe = onAuthStateChanged(window.auth, async (user) => {
        console.log("Auth state changed. User:", user ? user.uid : "none");
        if (user) {
          let userProfile = await window.getUserProfileFromFirestore(user.uid);
          if (!userProfile) {
            console.log("No profile found. Creating default.");
            userProfile = {
              uid: user.uid, displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
              email: user.email || null, photoURL: user.photoURL || window.DEFAULT_PROFILE_PIC,
              createdAt: new Date(), lastLoginAt: new Date(), themePreference: window.DEFAULT_THEME_NAME,
              isAdmin: window.ADMIN_UIDS.includes(user.uid)
            };
            await window.setUserProfileInFirestore(user.uid, userProfile);
          } else {
            await window.setUserProfileInFirestore(user.uid, { lastLoginAt: new Date(), isAdmin: window.ADMIN_UIDS.includes(user.uid) });
            userProfile.isAdmin = window.ADMIN_UIDS.includes(user.uid);
          }
          window.currentUser = userProfile;
          console.log("currentUser set:", window.currentUser);
        } else {
          console.log("User logged out. currentUser set to null.");
          window.currentUser = null;
        }
        firebaseReadyResolve();
        unsubscribe(); // Unsubscribe after initial state received
      });

      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        console.log("Signing in with custom token.");
        await signInWithCustomToken(window.auth, __initial_auth_token)
          .then(() => console.log("Signed in with custom token."))
          .catch((error) => {
            console.error("Custom token sign-in failed:", error);
          });
      } else {
        console.log("__initial_auth_token not defined. Relying on platform for initial auth state.");
      }
    } catch (e) {
      console.error("Error initializing Firebase:", e);
      firebaseReadyResolve();
    }
  } else {
    window.app = getApp();
    window.db = getFirestore(window.app);
    window.auth = getAuth(window.app);
    console.log("Firebase app already initialized. Re-using instance.");
    firebaseReadyResolve();
  }
}
setupFirebaseAndUser();

// --- Utility Functions ---
const messageBox = document.getElementById('message-box');
let messageBoxTimeout;

// Displays a temporary message box.
function showMessageBox(message, isError = false) {
  if (!messageBox) {
    console.error("Message box element not found.");
    return;
  }
  if (messageBoxTimeout) {
    clearTimeout(messageBoxTimeout);
  }
  messageBox.textContent = message;
  messageBox.className = 'message-box';
  if (isError) {
    messageBox.classList.add('error');
  } else {
    messageBox.classList.add('success');
  }
  messageBox.classList.add('show');
  messageBoxTimeout = setTimeout(() => {
    messageBox.classList.remove('show');
  }, 3000);
}

// Sanitizes input string for a handle.
function sanitizeHandle(input) {
  return input.toLowerCase().replace(/[^a-z0-9_.]/g, '');
}

const customConfirmModal = document.getElementById('custom-confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmSubmessage = document.getElementById('confirm-submessage');
const confirmYesButton = document.getElementById('confirm-yes');
const confirmNoButton = document.getElementById('confirm-no');
const closeButton = document.querySelector('.custom-confirm-modal .close-button');
let resolveConfirmPromise;

// Displays a custom confirmation modal.
function showCustomConfirm(message, submessage = '') {
  if (!customConfirmModal || !confirmMessage || !confirmYesButton || !confirmNoButton || !closeButton) {
    console.error("Custom confirmation modal elements not found.");
    return Promise.resolve(false);
  }
  confirmMessage.textContent = message;
  confirmSubmessage.textContent = submessage;
  customConfirmModal.style.display = 'flex';
  return new Promise((resolve) => {
    resolveConfirmPromise = resolve;
    confirmYesButton.onclick = () => { customConfirmModal.style.display = 'none'; resolveConfirmPromise(true); };
    confirmNoButton.onclick = () => { customConfirmModal.style.display = 'none'; resolveConfirmPromise(false); };
    closeButton.onclick = () => { customConfirmModal.style.display = 'none'; resolveConfirmPromise(false); };
    customConfirmModal.onclick = (event) => {
      if (event.target === customConfirmModal) { customConfirmModal.style.display = 'none'; resolveConfirmPromise(false); }
    };
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (customConfirmModal) {
    console.log("Custom confirm modal element found.");
    if (customConfirmModal.style.display === '' || customConfirmModal.style.display === 'block') {
      customConfirmModal.style.display = 'none';
      console.log("Custom confirm modal forcibly hidden.");
    }
  }
});


// --- Theme Management Functions ---
let _db;
let _auth;
let _appId;
let _themeSelect;
let _allThemes = [];

const predefinedThemes = [
  {
    id: 'dark', name: 'Dark Theme',
    variables: {
      '--color-body-bg': '#1a202c', '--color-text-primary': '#e2e8f0', '--color-text-secondary': '#a0aec0',
      '--color-link': '#63b3ed', '--color-link-hover': '#4299e1', '--color-navbar-bg': '#2d3748',
      '--color-card-bg': '#2d3748', '--color-input-bg': '#4a5568', '--color-input-border': '#2d3748',
      '--color-button-bg-primary': '#4299e1', '--color-button-text': '#ffffff',
      '--color-button-hover-primary': '#3182ce', '--color-bg-card': '#2d3748',
      '--color-heading-main': '#F9FAFB',
      '--color-heading-card': '#93C5FD'
    }
  },
  {
    id: 'light', name: 'Light Theme',
    variables: {
      '--color-body-bg': '#f7fafc', '--color-text-primary': '#2d3748', '--color-text-secondary': '#4a5568',
      '--color-link': '#3182ce', '--color-link-hover': '#2b6cb0', '--color-navbar-bg': '#ffffff',
      '--color-card-bg': '#ffffff', '--color-input-bg': '#edf2f7', '--color-input-border': '#e2e8f0',
      '--color-button-bg-primary': '#3182ce', '--color-button-text': '#ffffff',
      '--color-button-hover-primary': '#2b6cb0', '--color-bg-card': '#ffffff',
      '--color-heading-main': '#1F2937',
      '--color-heading-card': '#3B82F6'
    }
  }
];

// Sets up Firebase instances for theme management.
window.setupThemesFirebase = function(dbInstance, authInstance, appIdInstance) {
  _db = dbInstance;
  _auth = authInstance;
  _appId = appIdInstance;
  _themeSelect = document.getElementById('theme-select');
  console.log("Themes Firebase setup complete.");
};

// Fetches custom themes from Firestore.
async function fetchCustomThemes() {
  if (!_db || !_auth || !_auth.currentUser) {
    console.log("Not fetching custom themes - DB not ready or user not logged in.");
    return [];
  }
  const userId = _auth.currentUser.uid;
  const customThemesColRef = collection(_db, `artifacts/${_appId}/users/${userId}/custom_themes`);
  try {
    const querySnapshot = await getDocs(customThemesColRef);
    const customThemes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("Fetched custom themes:", customThemes.length);
    return customThemes;
  } catch (error) {
    console.error("Error fetching custom themes:", error);
    return [];
  }
}

// Saves a custom theme to Firestore.
async function saveCustomTheme(theme) {
  if (!_db || !_auth || !_auth.currentUser) {
    showMessageBox("Please sign in to save custom themes.", true);
    return false;
  }
  const userId = _auth.currentUser.uid;
  const themeDocRef = doc(_db, `artifacts/${_appId}/users/${userId}/custom_themes`, theme.id);
  try {
    await setDoc(themeDocRef, theme);
    showMessageBox("Theme saved successfully!", false);
    console.log("Theme saved for user.", theme.id);
    return true;
  } catch (error) {
    console.error("Error saving custom theme:", error);
    showMessageBox("Failed to save theme.", true);
    return false;
  }
}

// Deletes a custom theme from Firestore.
async function deleteCustomTheme(themeId) {
  if (!_db || !_auth || !_auth.currentUser) {
    showMessageBox("Please sign in to delete custom themes.", true);
    return false;
  }
  const userId = _auth.currentUser.uid;
  const themeDocRef = doc(_db, `artifacts/${_appId}/users/${userId}/custom_themes`, themeId);
  try {
    await deleteDoc(themeDocRef);
    showMessageBox("Theme deleted successfully!", false);
    console.log("Theme deleted.", themeId);
    return true;
  } catch (error) {
    console.error("Error deleting custom theme:", error);
    showMessageBox("Failed to delete theme.", true);
    return false;
  }
}


// DOM elements
const mainLoadingSpinner = document.getElementById('loading-spinner');
const formsContentSection = document.getElementById('forms-content');
const mainLoginRequiredMessage = document.getElementById('login-required-message');

const createThemaForm = document.getElementById('create-thema-form');
const newThemaNameInput = document.getElementById('new-thema-name');
const newThemaDescriptionInput = document.getElementById('new-thema-description');
const themaList = document.getElementById('thema-boxes');

const threadsSection = document.getElementById('threads-section');
const backToThematasBtn = document.getElementById('back-to-thematas-btn');
const currentThemaTitle = document.getElementById('current-thema-title');
const currentThemaDescription = document.getElementById('current-thema-description');
const createThreadForm = document.getElementById('create-thread-form');
const newThreadTitleInput = document.getElementById('new-thread-title');
const newThreadInitialCommentInput = document.getElementById('new-thread-initial-comment');
const threadList = document.getElementById('thread-list');

const commentsSection = document.getElementById('comments-section');
const backToThreadsBtn = document.getElementById('back-to-threads-btn');
const currentThreadTitle = document.getElementById('current-thread-title');
const currentThreadInitialComment = document.getElementById('current-thread-initial-comment');
const addCommentForm = document.getElementById('add-comment-form');
const newCommentContentInput = document.getElementById('new-comment-content');
const commentList = document.getElementById('comment-list');

let currentThemaId = null;
let currentThreadId = null;
let unsubscribeThemaComments = null;
let unsubscribeThreads = null;
let unsubscribeThematas = null;

// Displays the main loading spinner.
function showMainLoading() {
  if (mainLoadingSpinner) {
    mainLoadingSpinner.style.display = 'flex';
  }
  if (formsContentSection) {
    formsContentSection.style.display = 'none';
  }
  if (mainLoginRequiredMessage) {
    mainLoginRequiredMessage.style.display = 'none';
  }
  console.log("Spinner visible, content hidden.");
}

// Hides the main loading spinner.
function hideMainLoading() {
  if (mainLoadingSpinner) {
    mainLoadingSpinner.style.display = 'none';
  }
  console.log("Spinner hidden.");
}

// Updates UI visibility based on authentication and user profile readiness.
async function updateUIBasedOnAuthAndData() {
  console.log("Updating UI based on auth and data.");
  hideMainLoading();

  if (window.auth.currentUser) {
    console.log("User logged in.", window.auth.currentUser.uid);
    let profileReady = false;
    for (let i = 0; i < 30; i++) { // Max 3 seconds wait
      if (window.currentUser && window.currentUser.uid === window.auth.currentUser.uid && typeof window.currentUser.displayName !== 'undefined' && window.currentUser.displayName !== null) {
        profileReady = true;
        console.log("currentUser profile ready after", i * 100, "ms.");
        break;
      }
      console.log("Waiting for currentUser to be set. Attempt:", i + 1);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
    }

    if (profileReady) {
      if (formsContentSection) {
        formsContentSection.style.display = 'block';
      }
      if (mainLoginRequiredMessage) {
        mainLoginRequiredMessage.style.display = 'none';
      }
      console.log("Forms content visible, login message hidden.");
      renderThematas();
    } else {
      console.warn("currentUser profile not fully loaded after waiting. Showing login message.");
      showMessageBox("Failed to load user profile. Please try refreshing or logging in again.", true);
      if (formsContentSection) {
        formsContentSection.style.display = 'none';
      }
      if (mainLoginRequiredMessage) {
        mainLoginRequiredMessage.style.display = 'block';
      }
    }
  } else {
    console.log("User NOT logged in. Showing login message.");
    if (formsContentSection) {
      formsContentSection.style.display = 'none';
    }
    if (mainLoginRequiredMessage) {
      mainLoginRequiredMessage.style.display = 'block';
    }
  }
}

// Add new thema
async function addThema(name, description) {
  if (!window.auth.currentUser) {
    showMessageBox("You must be logged in to create a théma.", true);
    return;
  }
  if (!window.db) {
    showMessageBox("Database not initialized.", true);
    return;
  }

  try {
    const thematasCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas`);
    await addDoc(thematasCol, {
      name: name,
      description: description,
      createdAt: serverTimestamp(),
      createdBy: window.auth.currentUser.uid,
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
  if (!window.db) {
    themaList.innerHTML = '<li class="thema-item text-center text-red-400">Database not initialized.</li>';
    return;
  }

  const thematasCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas`);
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
        <span class="font-bold text-lg">${sanitizeHandle(thema.name)}</span>
        <div class="thema-description text-text-secondary text-sm">${sanitizeHandle(thema.description)}</div>
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
  if (!window.db) return;

  const threadsContainer = document.querySelector(`#threads-for-${themaId}`);
  if (!threadsContainer) return;

  try {
    const threadsCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`);
    const q = query(threadsCol, orderBy("createdAt", "desc"));
    const threadsSnapshot = await getDocs(q);
    
    if (threadsSnapshot.empty) {
      threadsContainer.innerHTML = '<div class="no-threads">No threads yet. Be the first to start one!</div>';
      return;
    }

    let threadsHtml = [];
    threadsHtml.push(`
      <div class="create-thread-section mb-4">
        <h4 class="text-lg font-bold mb-2">Create New Thread</h4>
        <form class="create-thread-form space-y-2" data-thema-id="${themaId}">
          <input type="text" class="form-input" placeholder="Thread title" required>
          <textarea class="form-input" placeholder="Initial comment" rows="3" required></textarea>
          <button type="submit" class="btn-primary btn-blue">Create Thread</button>
        </form>
      </div>
    `);

    threadsHtml.push('<div class="threads-list space-y-3">');
    
    for (const threadDoc of threadsSnapshot.docs) {
      const thread = threadDoc.data();
      const createdAt = thread.createdAt ? new Date(thread.createdAt.toDate()).toLocaleString() : 'N/A';
      
      threadsHtml.push(`
        <div class="thread-item card p-3" data-thread-id="${threadDoc.id}">
          <div class="thread-header">
            <h5 class="text-lg font-semibold">${sanitizeHandle(thread.title)}</h5>
            <div class="thread-actions">
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
          <p class="thread-initial-comment text-sm">${sanitizeHandle(thread.initialComment)}</p>
          <p class="meta-info text-xs">Created on ${createdAt}</p>
          <div class="thread-comments" data-thread-id="${threadDoc.id}">
            <div class="comments-loading">Loading comments...</div>
          </div>
        </div>
      `);
    }
    
    threadsHtml.push('</div>');
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
  if (!window.db) return;

  const commentsContainer = document.querySelector(`[data-thread-id="${threadId}"] .thread-comments`);
  if (!commentsContainer) return;

  try {
    const commentsCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`);
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
        
        commentsHtml.push(`
          <div class="comment-item p-2 bg-gray-50 rounded" data-comment-id="${commentDoc.id}">
            <div class="comment-header flex justify-between items-start">
              <p class="comment-content text-sm">${sanitizeHandle(comment.content)}</p>
              <div class="comment-actions">
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
            <p class="meta-info text-xs">Posted on ${createdAt}</p>
          </div>
        `);
      }
      
      commentsHtml.push('</div>');
    }

    // Add comment form
    commentsHtml.push(`
      <div class="add-comment-section mt-3">
        <form class="add-comment-form space-y-2" data-thema-id="${themaId}" data-thread-id="${threadId}">
          <textarea class="form-input text-sm" placeholder="Add a comment..." rows="2" required></textarea>
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
  if (!window.auth.currentUser) {
    showMessageBox("You must be logged in to create a thread.", true);
    return;
  }

  try {
    const threadsCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`);
    await addDoc(threadsCol, {
      title: title,
      initialComment: initialComment,
      createdAt: serverTimestamp(),
      createdBy: window.auth.currentUser.uid,
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
  if (!window.auth.currentUser) {
    showMessageBox("You must be logged in to add a comment.", true);
    return;
  }

  try {
    const commentsCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`);
    await addDoc(commentsCol, {
      content: content,
      createdAt: serverTimestamp(),
      createdBy: window.auth.currentUser.uid,
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
    const threadsRef = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`);
    const threadsSnapshot = await getDocs(threadsRef);
    
    for (const threadDoc of threadsSnapshot.docs) {
      const commentsRef = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadDoc.id}/comments`);
      const commentsSnapshot = await getDocs(commentsRef);
      
      for (const commentDoc of commentsSnapshot.docs) {
        await deleteDoc(doc(commentsRef, commentDoc.id));
      }
      await deleteDoc(doc(threadsRef, threadDoc.id));
    }
    
    await deleteDoc(doc(window.db, `artifacts/${window.appId}/public/data/thematas`, themaId));
    showMessageBox("Théma and all content deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting théma:", error);
    showMessageBox(`Error deleting théma: ${error.message}`, true);
  }
}

// Delete thread and subcollection
async function deleteThreadAndSubcollection(themaId, threadId) {
  try {
    const commentsRef = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`);
    const commentsSnapshot = await getDocs(commentsRef);
    
    for (const commentDoc of commentsSnapshot.docs) {
      await deleteDoc(doc(commentsRef, commentDoc.id));
    }
    
    await deleteDoc(doc(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`, threadId));
    showMessageBox("Thread and comments deleted successfully!", false);
  } catch (error) {
    console.error("Error deleting thread:", error);
    showMessageBox(`Error deleting thread: ${error.message}`, true);
  }
}

// Delete comment
async function deleteComment(themaId, threadId, commentId) {
  try {
    await deleteDoc(doc(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`, commentId));
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
  const dmTabBtn = document.getElementById('tab-dms');
  const dmTabContent = document.getElementById('dm-tab-content');
  const themataTabContent = document.getElementById('thema-all-tab-content');

  dmTabBtn?.addEventListener('click', () => {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    dmTabContent.style.display = 'block';
    dmTabBtn.classList.add('active');
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