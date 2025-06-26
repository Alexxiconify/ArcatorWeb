/* jshint esversion: 11 */
/* global __app_id, __firebase_config, __initial_auth_token */

// forms.js: Centralized JavaScript for Forms page, encompassing Firebase, utilities, theme, navbar, and core forms logic.

// --- Firebase SDK Imports ---
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  onSnapshot,
  getDocs,
  where,
  arrayUnion,
  arrayRemove,
  increment
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

// Enhanced features constants
window.REACTION_TYPES = ['👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🎉', '🔥', '💯'];
window.DM_TYPES = {
  DIRECT: 'direct',
  GROUP: 'group'
};
window.GROUP_PERMISSIONS = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member'
};
window.EDIT_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

let firebaseReadyResolve;
window.firebaseReadyPromise = new Promise((resolve) => {
  firebaseReadyResolve = resolve;
});

// Add a timeout to prevent hanging
setTimeout(() => {
  if (firebaseReadyResolve) {
    console.warn("Firebase ready promise timed out after 10 seconds. Continuing anyway.");
    firebaseReadyResolve();
  }
}, 10000);

/**
 * Retrieves user profile from Firestore.
 * @param {string} uid - The user ID.
 * @returns {Promise<object|null>} The user profile object or null if not found/error.
 */
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

/**
 * Sets or updates user profile in Firestore.
 * @param {string} uid - The user ID.
 * @param {object} profileData - The profile data to set or merge.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
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

/**
 * Deletes user profile from Firestore (currently commented out).
 * @param {string} uid - The user ID.
 * @returns {Promise<boolean>} Always false as it's commented out.
 */
window.deleteUserProfileFromFirestore = async function(uid) {
  return false;
};

/**
 * Initializes Firebase app, authentication, and Firestore.
 */
async function setupFirebaseAndUser() {
  console.log("Setup Firebase and user.");

  try {
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
  } catch (error) {
    console.error("Critical error in Firebase setup:", error);
    firebaseReadyResolve();
  }
}
setupFirebaseAndUser();

// --- Utility Functions ---
let messageBox;
let messageBoxTimeout;

/**
 * Displays a temporary message box.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - True if it's an error message, false for success.
 */
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

let customConfirmModal;
let confirmMessage;
let confirmSubmessage;
let confirmYesButton;
let confirmNoButton;
let closeButton;
let resolveConfirmPromise;

/**
 * Displays a custom confirmation modal.
 * @param {string} message - The main confirmation message.
 * @param {string} [submessage=''] - An optional sub-message for more details.
 * @returns {Promise<boolean>} A promise that resolves to true if 'Yes' is clicked, false otherwise.
 */
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

/**
 * Initializes utility DOM elements.
 */
function initializeUtilityElements() {
  messageBox = document.getElementById('message-box');
  customConfirmModal = document.getElementById('custom-confirm-modal');
  confirmMessage = document.getElementById('confirm-message');
  confirmSubmessage = document.getElementById('confirm-submessage');
  confirmYesButton = document.getElementById('confirm-yes');
  confirmNoButton = document.getElementById('confirm-no');
  closeButton = document.querySelector('.custom-confirm-modal .close-button');

  if (customConfirmModal) {
    console.log("Custom confirm modal element found.");
    if (customConfirmModal.style.display === '' || customConfirmModal.style.display === 'block') {
      customConfirmModal.style.display = 'none';
      console.log("Custom confirm modal forcibly hidden.");
    }
  }

  console.log("Utility elements initialized.");
}

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

/**
 * Sets up Firebase instances for theme management.
 * @param {object} dbInstance - Firestore database instance.
 * @param {object} authInstance - Firebase Auth instance.
 * @param {string} appIdInstance - The application ID.
 */
window.setupThemesFirebase = function(dbInstance, authInstance, appIdInstance) {
  _db = dbInstance;
  _auth = authInstance;
  _appId = appIdInstance;
  _themeSelect = document.getElementById('theme-select');
  if (!_themeSelect) {
    console.log("Theme select element not found - this is normal for forms page.");
  }
  console.log("Themes Firebase setup complete.");
};

/**
 * Fetches custom themes from Firestore.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of custom theme objects.
 */
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

/**
 * Applies a theme by setting CSS variables.
 * @param {string} themeId - The ID of the theme to apply.
 * @param {object} [themeObject=null] - Optional theme object to apply directly.
 */
window.applyTheme = async function(themeId, themeObject = null) {
  let themeToApply = themeObject;
  if (!themeToApply) {
    _allThemes = [...predefinedThemes, ...(await fetchCustomThemes())];
    themeToApply = _allThemes.find(t => t.id === themeId);
  }
  if (!themeToApply) {
    console.warn(`Theme '${themeId}' not found. Applying default theme.`);
    themeToApply = predefinedThemes.find(t => t.id === window.DEFAULT_THEME_NAME) || predefinedThemes[0];
  }
  if (themeToApply && themeToApply.variables) {
    for (const [key, value] of Object.entries(themeToApply.variables)) {
      document.documentElement.style.setProperty(key, value);
    }
    console.log(`Applied theme: ${themeToApply.name} (${themeToApply.id})`);
  } else {
    console.error(`Failed to apply theme: ${themeId}. Variables not found.`);
  }
};

/**
 * Populates the theme selection dropdown.
 */
async function populateThemeSelect() {
  _allThemes = [...predefinedThemes, ...(await fetchCustomThemes())];
  if (_themeSelect) {
    _themeSelect.innerHTML = '';
    _allThemes.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name;
      _themeSelect.appendChild(option);
    });
    console.log("Theme select populated with", _allThemes.length, "themes.");
  } else {
    console.log("Theme select element not found - skipping population.");
  }
}

/**
 * Returns available themes.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of available theme objects.
 */
window.getAvailableThemes = async function() {
  if (_allThemes.length === 0) { await populateThemeSelect(); }
  return _allThemes;
};

// At the top of forms.js
import { loadNavbar } from './navbar.js';

/**
 * Displays the main loading spinner and hides content sections.
 */
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

/**
 * Hides the main loading spinner.
 */
function hideMainLoading() {
  if (mainLoadingSpinner) {
    mainLoadingSpinner.style.display = 'none';
  }
  console.log("Spinner hidden.");
}

/**
 * Updates UI visibility based on authentication and user profile readiness.
 */
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
      renderGlobalThreads();
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

/**
 * Adds a new thema (main topic) to Firestore.
 * @param {string} name - The name of the thema.
 * @param {string} description - The description of the thema.
 * @param {Array} rules - Optional array of rules for the thema.
 */
async function addThema(name, description, rules = []) {
  if (!window.auth.currentUser) {
    showMessageBox("You must be logged in to create a théma.", true);
    return;
  }
  if (!window.db) {
    showMessageBox("Database not initialized.", true);
    return;
  }
  try {
    const user = window.currentUser;
    const thematasCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas`);
    await addDoc(thematasCol, {
      name: name,
      description: description,
      rules: rules,
      createdAt: serverTimestamp(),
      authorId: window.auth.currentUser.uid,
      authorDisplayName: user?.displayName || 'Anonymous',
      authorHandle: user?.handle || '',
      authorPhotoURL: user?.photoURL || window.DEFAULT_PROFILE_PIC,
      threadCount: 0,
      commentCount: 0,
      lastActivity: serverTimestamp()
    });
    showMessageBox("Théma created successfully!", false);
    newThemaNameInput.value = '';
    newThemaDescriptionInput.value = '';
    console.log("New théma added.");
  } catch (error) {
    console.error("Error creating théma:", error);
    showMessageBox(`Error creating théma: ${error.message}`, true);
  }
}

// --- CACHING UTILS ---
function cacheSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* ignore quota errors */ }
}
function cacheGet(key) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch (e) { return null; }
}

// --- CACHED THEMES ---
function renderThematasFromCache() {
  const cached = cacheGet('arcator_themes_cache');
  if (cached && Array.isArray(cached)) {
    themaList.innerHTML = '';
    cached.forEach(thema => {
      const li = document.createElement('li');
      li.classList.add('thema-item', 'card');
      const createdAt = thema.createdAt ? new Date(thema.createdAt).toLocaleString() : 'N/A';
      const creatorDisplayName = thema.authorDisplayName || 'Unknown';
      li.innerHTML = `
        <h3 class="text-xl font-bold text-heading-card">${thema.name}</h3>
        <p class="thema-description mt-2">${thema.description}</p>
        <p class="meta-info">Created by ${creatorDisplayName} on ${createdAt}</p>
        <button data-thema-id="${thema.id}" data-thema-name="${thema.name}" data-thema-description="${thema.description}" class="view-threads-btn btn-primary btn-blue mt-4">View Threads</button>
      `;
      themaList.appendChild(li);
    });
  }
}

// --- CACHED THREADS ---
function renderThreadsFromCache(themaId) {
  const cached = cacheGet('arcator_threads_cache_' + themaId);
  if (cached && Array.isArray(cached)) {
    threadList.innerHTML = '';
    cached.forEach(thread => {
      const li = document.createElement('li');
      li.classList.add('thread-item', 'card');
      const createdAt = thread.createdAt ? new Date(thread.createdAt).toLocaleString() : 'N/A';
      const creatorDisplayName = thread.authorDisplayName || 'Unknown';
      li.innerHTML = `
        <h3 class="text-xl font-bold text-heading-card">${thread.title}</h3>
        <p class="thread-initial-comment mt-2">${thread.initialComment}</p>
        <p class="meta-info">Started by ${creatorDisplayName} on ${createdAt}</p>
        <button data-thread-id="${thread.id}" data-thread-title="${thread.title}" data-thread-initial-comment="${thread.initialComment}" class="view-comments-btn btn-primary btn-green">View Comments</button>
      `;
      threadList.appendChild(li);
    });
  }
}

// --- PATCH renderThematas: Use <details> for collapsible thémata ---
function renderThematas() {
  renderThematasFromCache(); // Show cached immediately
  console.log("Rendering thematas. DB:", !!window.db);
  if (unsubscribeThematas) {
    unsubscribeThematas();
    console.log("Unsubscribed from previous thémata listener.");
  }
  if (!window.db) {
    themaList.innerHTML = '<li class="card p-4 text-center text-red-400">Database not initialized. Cannot load thémata.</li>';
    return;
  }

  const thematasCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas`);
  const q = query(thematasCol, orderBy("createdAt", "desc"));

  unsubscribeThematas = onSnapshot(q, async (snapshot) => {
    themaList.innerHTML = '';
    if (snapshot.empty) {
      themaList.innerHTML = '<li class="card p-4 text-center">No thémata found. Be the first to create one!</li>';
      return;
    }
    const themasArr = [];
    snapshot.forEach((doc) => {
      const thema = doc.data();
      themasArr.push({ ...thema, id: doc.id });
      const createdAt = thema.createdAt ? new Date(thema.createdAt.toDate()).toLocaleString() : 'N/A';
      const creatorDisplayName = thema.authorDisplayName || 'Unknown';
      const details = document.createElement('details');
      details.className = 'thema-collapsible';
      const summary = document.createElement('summary');
      summary.innerHTML = `<span class="font-bold">${thema.name}</span> <span class="ml-2 text-sm text-gray-400">${thema.description}</span>`;
      details.appendChild(summary);
      const inner = document.createElement('div');
      inner.innerHTML = `
        <p class="meta-info">Created by ${creatorDisplayName} on ${createdAt}</p>
        <button data-thema-id="${doc.id}" data-thema-name="${thema.name}" data-thema-description="${thema.description}" class="view-threads-btn btn-primary btn-blue mt-4">View Threads</button>
        ${(window.currentUser && window.currentUser.isAdmin) ? `<button data-thema-id="${doc.id}" class="delete-thema-btn btn-primary btn-red ml-2 mt-4">Delete</button>` : ''}
      `;
      details.appendChild(inner);
      const li = document.createElement('li');
      li.appendChild(details);
      themaList.appendChild(li);
    });
    cacheSet('arcator_themes_cache', themasArr);
    document.querySelectorAll('.view-threads-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        const themaId = event.target.dataset.themaId;
        const themaName = event.target.dataset.themaName;
        const themaDescription = event.target.dataset.themaDescription;
        displayThreadsForThema(themaId, themaName, themaDescription);
      });
    });
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
    themaList.innerHTML = `<li class="card p-4 text-center text-red-400">Error loading thémata: ${error.message}</li>`;
  });
}

/**
 * Deletes a thema and all its subcollections (threads, comments) from Firestore.
 * @param {string} themaId - The ID of the thema to delete.
 */
async function deleteThemaAndSubcollections(themaId) {
  try {
    console.log(`Deleting thema: ${themaId}`);
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

    showMessageBox("Théma and all its content deleted successfully!", false);
    console.log(`Thema ${themaId} and all content deleted.`);
  } catch (error) {
    console.error("Error deleting théma and subcollections:", error);
    showMessageBox(`Error deleting théma: ${error.message}`, true);
  }
}

/**
 * Displays threads for a selected thema.
 * @param {string} themaId - The ID of the selected thema.
 * @param {string} themaName - The name of the selected thema.
 * @param {string} themaDescription - The description of the selected thema.
 */
function displayThreadsForThema(themaId, themaName, themaDescription) {
  currentThemaId = themaId;
  currentThemaTitle.textContent = `Théma: ${themaName}`;
  currentThemaDescription.textContent = themaDescription;

  document.getElementById('create-thema-section').style.display = 'none';
  themaList.style.display = 'none';
  document.querySelector('#main-content > h2').style.display = 'none';
  document.querySelector('#main-content > h3').style.display = 'none';

  threadsSection.style.display = 'block';
  commentsSection.style.display = 'none';

  // Show create thread form for all logged-in users
  const createThreadSection = document.getElementById('create-thread-section');
  if (createThreadSection) {
    if (window.auth && window.auth.currentUser) {
      createThreadSection.style.display = 'block';
    } else {
      createThreadSection.style.display = 'none';
    }
  }

  console.log(`Displaying threads for thema: ${themaId}`);
  renderThreads();
}

/**
 * Adds a new comment thread to Firestore.
 * @param {string} themaId - The ID of the thema to which the thread belongs.
 * @param {string} title - The title of the new thread.
 * @param {string} initialComment - The initial comment of the thread.
 */
async function addCommentThread(themaId, title, initialComment) {
  if (!window.auth.currentUser) {
    showMessageBox("You must be logged in to create a thread.", true);
    return;
  }
  if (!window.db) {
    showMessageBox("Database or Théma not initialized.", true);
    return;
  }
  try {
    const user = window.currentUser;
    const mentions = parseMentions(initialComment);
    const threadsCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`);
    const threadDoc = await addDoc(threadsCol, {
      title: title,
      initialComment: initialComment,
      mentions: mentions,
      reactions: {},
      createdAt: serverTimestamp(),
      authorId: window.auth.currentUser.uid,
      authorDisplayName: user?.displayName || 'Anonymous',
      authorHandle: user?.handle || '',
      authorPhotoURL: user?.photoURL || window.DEFAULT_PROFILE_PIC,
      commentCount: 0,
      lastActivity: serverTimestamp(),
      editedAt: null,
      editedBy: null
    });
    // Update thema thread count
    const themaRef = doc(window.db, `artifacts/${window.appId}/public/data/thematas`, themaId);
    await updateDoc(themaRef, {
      threadCount: increment(1),
      lastActivity: serverTimestamp()
    });
    showMessageBox("Thread created successfully!", false);
    newThreadTitleInput.value = '';
    newThreadInitialCommentInput.value = '';
    console.log("New thread added.");
  } catch (error) {
    console.error("Error creating thread:", error);
    showMessageBox(`Error creating thread: ${error.message}`, true);
  }
}

// --- PATCH renderThreads: Show user icon, edit/delete for all users/admins, emoji reactions ---
function renderThreads() {
  renderThreadsFromCache(currentThemaId); // Show cached immediately
  console.log("Rendering threads. DB:", !!window.db, "currentThemaId:", currentThemaId);
  if (unsubscribeThreads) {
    unsubscribeThreads();
    console.log("Unsubscribed from previous threads listener.");
  }
  if (!window.db || !currentThemaId) {
    threadList.innerHTML = '<li class="card p-4 text-center text-red-400">Select a Théma to view threads.</li>';
    return;
  }

  const threadsCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${currentThemaId}/threads`);
  const q = query(threadsCol, orderBy("createdAt", "desc"));

  unsubscribeThreads = onSnapshot(q, async (snapshot) => {
    threadList.innerHTML = '';
    if (snapshot.empty) {
      threadList.innerHTML = '<li class="card p-4 text-center">No threads yet. Be the first to start one!</li>';
      return;
    }
    const threadsArr = [];
    snapshot.forEach((doc) => {
      const thread = doc.data();
      threadsArr.push({ ...thread, id: doc.id });
      const createdAt = thread.createdAt ? new Date(thread.createdAt.toDate()).toLocaleString() : 'N/A';
      const creatorDisplayName = thread.authorDisplayName || 'Unknown';
      const creatorPhotoURL = thread.authorPhotoURL || window.DEFAULT_PROFILE_PIC;
      const details = document.createElement('details');
      details.className = 'thread-collapsible';
      const summary = document.createElement('summary');
      summary.innerHTML = `<span class="font-bold">${thread.title}</span> <span class="ml-2 text-sm text-gray-400">${thread.initialComment}</span>`;
      details.appendChild(summary);
      const inner = document.createElement('div');
      inner.innerHTML = `
        <div class="flex items-center mb-2">
          <img src="${creatorPhotoURL}" alt="User Icon" class="w-8 h-8 rounded-full mr-2 object-cover">
          <span class="meta-info">Started by ${creatorDisplayName} on ${createdAt}</span>
        </div>
        <div class="reactions-container mt-2">
          ${(thread.reactions ? Object.entries(thread.reactions).map(([emoji, data]) => {
            const hasReacted = data.users.includes(window.auth.currentUser?.uid);
            return createReactionButton(emoji, data.count, hasReacted, doc.id, 'thread').outerHTML;
          }).join('') : '')}
          <button class="add-reaction-btn text-gray-500 hover:text-gray-700 text-sm" onclick="showReactionPalette('${doc.id}', 'thread', event.clientX, event.clientY)">+</button>
        </div>
        <div class="thread-actions mt-4">
          <button data-thread-id="${doc.id}" data-thread-title="${thread.title}" data-thread-initial-comment="${thread.initialComment}" class="view-comments-btn btn-primary btn-green">View Comments (${thread.commentCount || 0})</button>
          ${(canEditPost(thread, window.currentUser) ? `<button onclick=\"showEditForm('${thread.initialComment.replace(/'/g, "&#39;")}', '${doc.id}', 'thread')\" class="edit-thread-btn btn-primary btn-blue ml-2">Edit</button>` : '')}
          ${(canDeletePost(thread, window.currentUser) ? `<button data-thread-id="${doc.id}" class="delete-thread-btn btn-primary btn-red ml-2">Delete</button>` : '')}
        </div>
      `;
      details.appendChild(inner);
      const li = document.createElement('li');
      li.appendChild(details);
      threadList.appendChild(li);
    });
    cacheSet('arcator_threads_cache_' + currentThemaId, threadsArr);
    document.querySelectorAll('.view-comments-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        const threadId = event.target.dataset.threadId;
        const threadTitle = event.target.dataset.threadTitle;
        const threadInitialComment = event.target.dataset.threadInitialComment;
        displayCommentsForThread(threadId, threadTitle, threadInitialComment);
      });
    });
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
    threadList.innerHTML = `<li class="card p-4 text-center text-red-400">Error loading threads: ${error.message}</li>`;
  });
}

/**
 * Deletes a thread and its comments from Firestore.
 * @param {string} themaId - The ID of the parent thema.
 * @param {string} threadId - The ID of the thread to delete.
 */
async function deleteThreadAndSubcollection(themaId, threadId) {
  try {
    console.log(`Deleting thread: ${threadId}`);
    const commentsRef = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`);
    const commentsSnapshot = await getDocs(commentsRef);
    for (const commentDoc of commentsSnapshot.docs) {
      await deleteDoc(doc(commentsRef, commentDoc.id));
    }
    await deleteDoc(doc(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`, threadId));

    showMessageBox("Thread and its comments deleted successfully!", false);
    console.log(`Thread ${threadId} and comments deleted.`);
  } catch (error) {
    console.error("Error deleting thread and subcollection:", error);
    showMessageBox(`Error deleting thread: ${error.message}`, true);
  }
}

/**
 * Displays comments for a selected thread.
 * @param {string} threadId - The ID of the selected thread.
 * @param {string} threadTitle - The title of the selected thread.
 * @param {string} threadInitialComment - The initial comment of the selected thread.
 */
function displayCommentsForThread(threadId, threadTitle, threadInitialComment) {
  currentThreadId = threadId;
  currentThreadTitle.textContent = `Thread: ${threadTitle}`;
  currentThreadInitialComment.textContent = threadInitialComment;

  threadsSection.style.display = 'none';
  commentsSection.style.display = 'block';

  console.log(`Displaying comments for thread: ${threadId}`);
  renderComments();
}

/**
 * Adds a new comment to Firestore.
 * @param {string} themaId - The ID of the parent thema.
 * @param {string} threadId - The ID of the parent thread.
 * @param {string} content - The content of the new comment.
 */
async function addComment(themaId, threadId, content) {
  if (!window.auth.currentUser) {
    showMessageBox("You must be logged in to add a comment.", true);
    return;
  }
  if (!window.db) {
    showMessageBox("Database or Théma not initialized.", true);
    return;
  }
  try {
    const user = window.currentUser;
    const mentions = parseMentions(content);
    const commentsCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`);
    await addDoc(commentsCol, {
      content: content,
      mentions: mentions,
      reactions: {},
      createdAt: serverTimestamp(),
      authorId: window.auth.currentUser.uid,
      authorDisplayName: user?.displayName || 'Anonymous',
      authorHandle: user?.handle || '',
      authorPhotoURL: user?.photoURL || window.DEFAULT_PROFILE_PIC,
      editedAt: null,
      editedBy: null
    });
    // Update thread comment count
    const threadRef = doc(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`, threadId);
    await updateDoc(threadRef, {
      commentCount: increment(1),
      lastActivity: serverTimestamp()
    });
    // Update thema comment count
    const themaRef = doc(window.db, `artifacts/${window.appId}/public/data/thematas`, themaId);
    await updateDoc(themaRef, {
      commentCount: increment(1),
      lastActivity: serverTimestamp()
    });
    showMessageBox("Comment posted successfully!", false);
    newCommentContentInput.value = '';
    console.log("New comment added.");
  } catch (error) {
    console.error("Error posting comment:", error);
    showMessageBox(`Error posting comment: ${error.message}`, true);
  }
}

/**
 * Renders comments for the current thread in real-time.
 */
function renderComments() {
  console.log("Rendering comments. DB:", !!window.db, "currentThemaId:", currentThemaId, "currentThreadId:", currentThreadId);
  if (unsubscribeThemaComments) {
    unsubscribeThemaComments();
    console.log("Unsubscribed from previous comments listener.");
  }
  if (!window.db || !currentThemaId || !currentThreadId) {
    commentList.innerHTML = '<li class="card p-4 text-center text-red-400">Select a Thread to view comments.</li>';
    return;
  }

  const commentsCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${currentThemaId}/threads/${currentThreadId}/comments`);
  const q = query(commentsCol, orderBy("createdAt", "asc"));

  unsubscribeThemaComments = onSnapshot(q, async (snapshot) => {
    console.log("onSnapshot callback fired for comments. Changes:", snapshot.docChanges().length);
    commentList.innerHTML = '';
    if (snapshot.empty) {
      commentList.innerHTML = '<li class="card p-4 text-center">No comments yet. Be the first to comment!</li>';
      return;
    }

    const commentCreatedByUids = new Set();
    snapshot.forEach(doc => {
      const comment = doc.data();
      if (comment.createdBy) {
        commentCreatedByUids.add(comment.createdBy);
      }
    });

    const commentUserProfiles = {};
    if (commentCreatedByUids.size > 0) {
      const usersRef = collection(window.db, `artifacts/${window.appId}/public/data/user_profiles`);
      const commentUserQuery = query(usersRef, where('uid', 'in', Array.from(commentCreatedByUids)));
      await getDocs(commentUserQuery).then(userSnapshot => {
        userSnapshot.forEach(userDoc => {
          const userData = userDoc.data();
          commentUserProfiles[userDoc.id] = userData.displayName || 'Unknown User';
        });
      }).catch(error => console.error("Error fetching user profiles for comments:", error));
    }

    snapshot.forEach((doc) => {
      const comment = doc.data();
      const li = document.createElement('li');
      li.classList.add('comment-item', 'card');
      const createdAt = comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleString() : 'N/A';
      const displayName = commentUserProfiles[comment.createdBy] || comment.authorDisplayName || 'Unknown';
      const isEdited = comment.editedAt ? ` (edited by ${comment.editedBy})` : '';
      const authorPhotoURL = comment.authorPhotoURL || window.DEFAULT_PROFILE_PIC;
      // Create reactions HTML
      const reactionsHtml = comment.reactions ? Object.entries(comment.reactions)
        .map(([emoji, data]) => {
          const hasReacted = data.users.includes(window.auth.currentUser?.uid);
          return createReactionButton(emoji, data.count, hasReacted, doc.id, 'comment').outerHTML;
        }).join('') : '';
      li.innerHTML = `
        <div class="flex items-center mb-2">
          <img src="${authorPhotoURL}" alt="User Icon" class="w-8 h-8 rounded-full mr-2 object-cover">
          <span class="meta-info">By ${displayName} on ${createdAt}${isEdited}</span>
        </div>
        <div class="comment-content">
          <p>${convertMentionsToHTML(comment.content)}</p>
        </div>
        <div class="reactions-container mt-2">
          ${reactionsHtml}
          <button class="add-reaction-btn text-gray-500 hover:text-gray-700 text-sm" onclick="showReactionPalette('${doc.id}', 'comment', event.clientX, event.clientY)">+</button>
        </div>
        <div class="comment-actions mt-2">
          ${(canEditPost(comment, window.currentUser) ? `<button onclick=\"showEditForm('${comment.content.replace(/'/g, "&#39;")}', '${doc.id}', 'comment')\" class="edit-comment-btn btn-primary btn-blue text-xs">Edit</button>` : '')}
          ${(canDeletePost(comment, window.currentUser) ? `<button data-comment-id=\"${doc.id}\" class=\"delete-comment-btn btn-primary btn-red text-xs ml-2\">Delete</button>` : '')}
        </div>
      `;
      commentList.appendChild(li);
    });
    // Add event listeners
    document.querySelectorAll('.delete-comment-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const commentId = event.target.dataset.commentId;
        const confirmed = await showCustomConfirm("Are you sure you want to delete this comment?", "This action cannot be undone.");
        if (confirmed) {
          // Delete comment logic
          const commentRef = doc(window.db, `artifacts/${window.appId}/public/data/thematas/${currentThemaId}/threads/${currentThreadId}/comments`, commentId);
          await deleteDoc(commentRef);
          showMessageBox("Comment deleted successfully!", false);
        }
      });
    });
  });
}

/**
 * Views a temporary page
 * @param {string} pageId - The page ID
 * @param {string} pageTitle - The page title
 * @param {string} pageContent - The page content
 */
function viewTempPage(pageId, pageTitle, pageContent) {
  window.location.href = `temp-page-viewer.html?id=${encodeURIComponent(pageId)}`;
}

/**
 * Deletes a temporary page
 * @param {string} pageId - The page ID
 */
async function deleteTempPage(pageId) {
  if (!window.auth.currentUser || !window.db) {
    showMessageBox("You must be logged in to delete a temporary page.", true);
    return;
  }

  try {
    const pageRef = doc(window.db, `artifacts/${window.appId}/public/data/temp_pages`, pageId);
    await deleteDoc(pageRef);
    showMessageBox("Temporary page deleted successfully!", false);
    console.log("Temporary page deleted successfully");
  } catch (error) {
    console.error("Error deleting temporary page:", error);
    showMessageBox("Error deleting temporary page.", true);
  }
}

// Enhanced utility functions
/**
 * Parses text for @mentions and returns array of mentioned user IDs
 * @param {string} text - The text to parse
 * @returns {Array<string>} Array of mentioned user IDs
 */
function parseMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}

/**
 * Converts text with @mentions to HTML with clickable links
 * @param {string} text - The text to convert
 * @returns {string} HTML with clickable mentions
 */
function convertMentionsToHTML(text) {
  return text.replace(/@(\w+)/g, '<span class="mention" data-username="$1">@$1</span>');
}

/**
 * Checks if user can edit a post (within time limit or is admin)
 * @param {object} post - The post object
 * @param {object} user - The current user
 * @returns {boolean} True if user can edit
 */
function canEditPost(post, user) {
  return true;
}

/**
 * Checks if user can delete a post
 * @param {object} post - The post object
 * @param {object} user - The current user
 * @returns {boolean} True if user can delete
 */
function canDeletePost(post, user) {
  return true;
}

/**
 * Gets user display name by UID
 * @param {string} uid - User ID
 * @param {object} userProfiles - Object mapping UIDs to user profiles
 * @returns {string} Display name
 */
function getUserDisplayName(uid, userProfiles) {
  return userProfiles[uid]?.displayName || 'Unknown User';
}

/**
 * Creates a reaction button element
 * @param {string} emoji - The reaction emoji
 * @param {number} count - The reaction count
 * @param {boolean} hasReacted - Whether current user has reacted
 * @param {string} itemId - The item ID (thread or comment)
 * @param {string} itemType - The item type ('thread' or 'comment')
 * @returns {HTMLElement} The reaction button element
 */
function createReactionButton(emoji, count, hasReacted, itemId, itemType) {
  const button = document.createElement('button');
  button.className = `reaction-btn ${hasReacted ? 'reacted' : ''} px-2 py-1 rounded text-sm mr-2 mb-2`;
  button.innerHTML = `${emoji} ${count}`;
  button.onclick = () => handleReaction(itemType, itemId, emoji);
  return button;
}

/**
 * Shows the reaction palette
 * @param {string} itemId - The item ID
 * @param {string} itemType - The item type
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function showReactionPalette(itemId, itemType, x, y) {
  if (!reactionPalette) return;

  reactionPalette.innerHTML = '';
  window.REACTION_TYPES.forEach(emoji => {
    const button = document.createElement('button');
    button.className = 'reaction-option text-2xl p-2 hover:bg-gray-200 rounded';
    button.textContent = emoji;
    button.onclick = () => {
      handleReaction(itemType, itemId, emoji);
      hideReactionPalette();
    };
    reactionPalette.appendChild(button);
  });

  reactionPalette.style.left = `${x}px`;
  reactionPalette.style.top = `${y}px`;
  reactionPalette.style.display = 'block';
}

/**
 * Hides the reaction palette
 */
function hideReactionPalette() {
  if (reactionPalette) {
    reactionPalette.style.display = 'none';
  }
}

/**
 * Shows the edit form
 * @param {string} content - Current content
 * @param {string} itemId - Item ID
 * @param {string} itemType - Item type
 */
function showEditForm(content, itemId, itemType) {
  if (!editForm || !editInput) return;

  currentEditId = { id: itemId, type: itemType };
  editInput.value = content;
  editForm.style.display = 'block';
}

/**
 * Hides the edit form
 */
function hideEditForm() {
  if (editForm) {
    editForm.style.display = 'none';
  }
  currentEditId = null;
}

/**
 * Handles reactions on threads and comments
 * @param {string} itemType - The type of item ('thread' or 'comment')
 * @param {string} itemId - The ID of the item
 * @param {string} emoji - The reaction emoji
 */
async function handleReaction(itemType, itemId, emoji) {
  if (!window.auth.currentUser || !window.db) {
    showMessageBox("You must be logged in to react.", true);
    return;
  }

  try {
    const userId = window.auth.currentUser.uid;
    let itemRef;

    if (itemType === 'thread') {
      itemRef = doc(window.db, `artifacts/${window.appId}/public/data/thematas/${currentThemaId}/threads`, itemId);
    } else if (itemType === 'comment') {
      itemRef = doc(window.db, `artifacts/${window.appId}/public/data/thematas/${currentThemaId}/threads/${currentThreadId}/comments`, itemId);
    } else {
      console.error("Invalid item type for reaction:", itemType);
      return;
    }

    const itemDoc = await getDoc(itemRef);
    if (!itemDoc.exists()) {
      console.error("Item not found for reaction");
      return;
    }

    const itemData = itemDoc.data();
    const reactions = itemData.reactions || {};
    const emojiReactions = reactions[emoji] || { count: 0, users: [] };

    const userIndex = emojiReactions.users.indexOf(userId);
    if (userIndex > -1) {
      // Remove reaction
      emojiReactions.users.splice(userIndex, 1);
      emojiReactions.count--;
    } else {
      // Add reaction
      emojiReactions.users.push(userId);
      emojiReactions.count++;
    }

    if (emojiReactions.count === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = emojiReactions;
    }

    await updateDoc(itemRef, { reactions: reactions, lastActivity: serverTimestamp() });
    console.log(`Reaction ${emoji} ${userIndex > -1 ? 'removed from' : 'added to'} ${itemType}`);
  } catch (error) {
    console.error("Error handling reaction:", error);
    showMessageBox("Error updating reaction.", true);
  }
}

/**
 * Edits a post (thread or comment)
 * @param {string} itemType - The type of item ('thread' or 'comment')
 * @param {string} itemId - The ID of the item
 * @param {string} newContent - The new content
 */
async function editPost(itemType, itemId, newContent) {
  if (!window.auth.currentUser || !window.db) {
    showMessageBox("You must be logged in to edit.", true);
    return;
  }

  try {
    let itemRef;
    const updateData = {
      editedAt: serverTimestamp(),
      editedBy: window.currentUser.displayName,
      lastActivity: serverTimestamp()
    };

    if (itemType === 'thread') {
      itemRef = doc(window.db, `artifacts/${window.appId}/public/data/thematas/${currentThemaId}/threads`, itemId);
      updateData.initialComment = newContent;
      updateData.mentions = parseMentions(newContent);
    } else if (itemType === 'comment') {
      itemRef = doc(window.db, `artifacts/${window.appId}/public/data/thematas/${currentThemaId}/threads/${currentThreadId}/comments`, itemId);
      updateData.content = newContent;
      updateData.mentions = parseMentions(newContent);
    } else {
      console.error("Invalid item type for editing:", itemType);
      return;
    }

    await updateDoc(itemRef, updateData);
    showMessageBox("Post edited successfully!", false);
    hideEditForm();
    console.log(`${itemType} edited successfully`);
  } catch (error) {
    console.error("Error editing post:", error);
    showMessageBox("Error editing post.", true);
  }
}

/**
 * Creates a new DM conversation
 * @param {string} type - The type of DM ('direct' or 'group')
 * @param {Array} participantIds - Array of participant user IDs
 * @param {string} groupName - Optional group name for group DMs
 * @returns {Promise<string>} The conversation ID
 */
async function createDM(type, participantIds, groupName = '') {
  if (!window.auth.currentUser || !window.db) {
    showMessageBox("You must be logged in to create a DM.", true);
    return null;
  }

  try {
    const currentUserId = window.auth.currentUser.uid;
    const allParticipants = [...new Set([currentUserId, ...participantIds])];

    const dmData = {
      type: type,
      participants: allParticipants,
      participantProfiles: {},
      createdAt: serverTimestamp(),
      createdBy: currentUserId,
      lastActivity: serverTimestamp()
    };

    if (type === window.DM_TYPES.GROUP) {
      dmData.groupName = groupName || 'Group Chat';
      dmData.permissions = {
        [currentUserId]: window.GROUP_PERMISSIONS.OWNER
      };
      // Set other participants as members
      participantIds.forEach(pid => {
        if (pid !== currentUserId) {
          dmData.permissions[pid] = window.GROUP_PERMISSIONS.MEMBER;
        }
      });
    }

    const dmCol = collection(window.db, `artifacts/${window.appId}/users/${currentUserId}/dms`);
    const dmDoc = await addDoc(dmCol, dmData);

    // Create the same DM for other participants
    for (const participantId of participantIds) {
      if (participantId !== currentUserId) {
        const participantDmCol = collection(window.db, `artifacts/${window.appId}/users/${participantId}/dms`);
        await addDoc(participantDmCol, {
          ...dmData,
          dmId: dmDoc.id // Reference to the original DM
        });
      }
    }

    showMessageBox("DM created successfully!", false);
    return dmDoc.id;
  } catch (error) {
    console.error("Error creating DM:", error);
    showMessageBox("Error creating DM.", true);
    return null;
  }
}

/**
 * Sends a message in a DM
 * @param {string} dmId - The DM ID
 * @param {string} content - The message content
 */
async function sendDMMessage(dmId, content) {
  if (!window.auth.currentUser || !window.db) {
    showMessageBox("You must be logged in to send a message.", true);
    return;
  }

  try {
    const currentUserId = window.auth.currentUser.uid;
    const mentions = parseMentions(content);

    const messageData = {
      content: content,
      mentions: mentions,
      createdAt: serverTimestamp(),
      createdBy: currentUserId,
      creatorDisplayName: window.currentUser.displayName
    };

    const messagesCol = collection(window.db, `artifacts/${window.appId}/users/${currentUserId}/dms/${dmId}/messages`);
    await addDoc(messagesCol, messageData);

    // Update DM last activity
    const dmRef = doc(window.db, `artifacts/${window.appId}/users/${currentUserId}/dms`, dmId);
    await updateDoc(dmRef, { lastActivity: serverTimestamp() });

    console.log("DM message sent successfully");
  } catch (error) {
    console.error("Error sending DM message:", error);
    showMessageBox("Error sending message.", true);
  }
}

/**
 * Renders DM conversations list
 */
function renderDMList() {
  if (!window.auth.currentUser || !window.db) return;

  const currentUserId = window.auth.currentUser.uid;
  const dmCol = collection(window.db, `artifacts/${window.appId}/users/${currentUserId}/dms`);
  const q = query(dmCol, orderBy("lastActivity", "desc"));

  if (unsubscribeDmList) {
    unsubscribeDmList();
  }

  unsubscribeDmList = onSnapshot(q, async (snapshot) => {
    if (!dmList) return;

    dmList.innerHTML = '';
    if (snapshot.empty) {
      dmList.innerHTML = '<li class="card p-4 text-center">No conversations yet. Start a new DM!</li>';
      return;
    }

    for (const doc of snapshot.docs) {
      const dmData = doc.data();
      const li = document.createElement('li');
      li.className = 'dm-item card cursor-pointer';
      li.onclick = () => selectDM(doc.id, dmData);

      const displayName = dmData.type === window.DM_TYPES.GROUP
        ? dmData.groupName
        : dmData.participants.find(p => p !== currentUserId) || 'Unknown';

      li.innerHTML = `
        <h3 class="text-lg font-bold">${displayName}</h3>
        <p class="text-sm text-gray-500">${dmData.type === window.DM_TYPES.GROUP ? 'Group' : 'Direct'} message</p>
        <p class="text-xs text-gray-400">Last activity: ${dmData.lastActivity ? new Date(dmData.lastActivity.toDate()).toLocaleString() : 'N/A'}</p>
      `;
      dmList.appendChild(li);
    }
  });
}

/**
 * Selects a DM conversation
 * @param {string} dmId - The DM ID
 * @param {object} dmData - The DM data
 */
function selectDM(dmId, dmData) {
  currentDmId = dmId;

  if (dmTitle) {
    dmTitle.textContent = dmData.type === window.DM_TYPES.GROUP
      ? dmData.groupName
      : 'Direct Message';
  }

  if (dmParticipants) {
    const participantNames = dmData.participants
      .filter(p => p !== window.auth.currentUser.uid)
      .map(p => getUserDisplayName(p, {}))
      .join(', ');
    dmParticipants.textContent = `Participants: ${participantNames}`;
  }

  // Show DM section, hide others
  if (dmSection) dmSection.style.display = 'block';
  if (formsContentSection) formsContentSection.style.display = 'none';
  if (tempPagesSection) tempPagesSection.style.display = 'none';

  renderDMMessages();
}

/**
 * Renders DM messages
 */
function renderDMMessages() {
  if (!window.auth.currentUser || !window.db || !currentDmId) return;

  const currentUserId = window.auth.currentUser.uid;
  const messagesCol = collection(window.db, `artifacts/${window.appId}/users/${currentUserId}/dms/${currentDmId}/messages`);
  const q = query(messagesCol, orderBy("createdAt", "asc"));

  if (unsubscribeDmMessages) {
    unsubscribeDmMessages();
  }

  unsubscribeDmMessages = onSnapshot(q, (snapshot) => {
    if (!dmMessages) return;

    dmMessages.innerHTML = '';
    if (snapshot.empty) {
      dmMessages.innerHTML = '<li class="text-center text-gray-500">No messages yet. Start the conversation!</li>';
      return;
    }

    snapshot.forEach(doc => {
      const message = doc.data();
      const li = document.createElement('li');
      li.className = `message-item ${message.createdBy === currentUserId ? 'own-message' : 'other-message'}`;

      li.innerHTML = `
        <div class="message-content">
          <p>${convertMentionsToHTML(message.content)}</p>
          <small class="text-gray-500">${message.creatorDisplayName} - ${message.createdAt ? new Date(message.createdAt.toDate()).toLocaleString() : 'N/A'}</small>
        </div>
      `;
      dmMessages.appendChild(li);
    });

    // Scroll to bottom
    dmMessages.scrollTop = dmMessages.scrollHeight;
  });
}

/**
 * Creates a temporary page
 * @param {string} title - The page title
 * @param {string} content - The page content
 */
async function createTempPage(title, content) {
  if (!window.auth.currentUser || !window.db) {
    showMessageBox("You must be logged in to create a temporary page.", true);
    return;
  }

  try {
    const tempPageData = {
      title: title,
      content: content,
      createdAt: serverTimestamp(),
      createdBy: window.auth.currentUser.uid,
      creatorDisplayName: window.currentUser.displayName,
      lastModified: serverTimestamp()
    };

    const tempPagesCol = collection(window.db, `artifacts/${window.appId}/public/data/temp_pages`);
    await addDoc(tempPagesCol, tempPageData);

    showMessageBox("Temporary page created successfully!", false);
    if (tempPageTitleInput) tempPageTitleInput.value = '';
    if (tempPageContentInput) tempPageContentInput.value = '';
    console.log("Temporary page created successfully");
  } catch (error) {
    console.error("Error creating temporary page:", error);
    showMessageBox("Error creating temporary page.", true);
  }
}

/**
 * Renders temporary pages list
 */
function renderTempPages() {
  if (!window.db) return;

  const tempPagesCol = collection(window.db, `artifacts/${window.appId}/public/data/temp_pages`);
  const q = query(tempPagesCol, orderBy("lastModified", "desc"));

  onSnapshot(q, async (snapshot) => {
    if (!tempPagesList) return;

    tempPagesList.innerHTML = '';
    if (snapshot.empty) {
      tempPagesList.innerHTML = '<li class="card p-4 text-center">No temporary pages yet. Create one!</li>';
      return;
    }

    const createdByUids = new Set();
    snapshot.forEach(doc => {
      const page = doc.data();
      if (page.createdBy) {
        createdByUids.add(page.createdBy);
      }
    });

    const userProfiles = {};
    if (createdByUids.size > 0) {
      const usersRef = collection(window.db, `artifacts/${window.appId}/public/data/user_profiles`);
      const userQuery = query(usersRef, where('uid', 'in', Array.from(createdByUids)));
      await getDocs(userQuery).then(userSnapshot => {
        userSnapshot.forEach(userDoc => {
          const userData = userDoc.data();
          userProfiles[userDoc.id] = userData.displayName || 'Unknown User';
        });
      }).catch(error => console.error("Error fetching user profiles for temp pages:", error));
    }

    snapshot.forEach(doc => {
      const page = doc.data();
      const li = document.createElement('li');
      li.className = 'temp-page-item card';
      const createdAt = page.createdAt ? new Date(page.createdAt.toDate()).toLocaleString() : 'N/A';
      const creatorDisplayName = userProfiles[page.createdBy] || page.creatorDisplayName || 'Unknown';

      li.innerHTML = `
        <h3 class="text-xl font-bold text-heading-card">${page.title}</h3>
        <p class="temp-page-content mt-2">${page.content.substring(0, 200)}${page.content.length > 200 ? '...' : ''}</p>
        <p class="meta-info">Created by ${creatorDisplayName} on ${createdAt}</p>
        <button data-page-id="${doc.id}" data-page-title="${page.title}" data-page-content="${page.content}" class="view-temp-page-btn btn-primary btn-blue mt-4">View Page</button>
        ${canDeletePost(page, window.currentUser) ? `<button data-page-id="${doc.id}" class="delete-temp-page-btn btn-primary btn-red ml-2 mt-4">Delete</button>` : ''}
      `;
      tempPagesList.appendChild(li);
    });

    // Add event listeners
    document.querySelectorAll('.view-temp-page-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        const pageId = event.target.dataset.pageId;
        const pageTitle = event.target.dataset.pageTitle;
        const pageContent = event.target.dataset.pageContent;
        viewTempPage(pageId, pageTitle, pageContent);
      });
    });

    document.querySelectorAll('.delete-temp-page-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const pageId = event.target.dataset.pageId;
        const confirmed = await showCustomConfirm("Are you sure you want to delete this temporary page?", "This action cannot be undone.");
        if (confirmed) {
          await deleteTempPage(pageId);
        }
      });
    });
  });
}

// --- Event Listeners and Initial Load ---
document.addEventListener('DOMContentLoaded', async function() {
  console.log("Initializing forms page.");

  // Initialize utility elements only
  initializeUtilityElements();

  // Check if essential elements exist
  if (!mainLoadingSpinner || !formsContentSection || !mainLoginRequiredMessage) {
    console.error("Essential DOM elements not found. Cannot initialize forms page.");
    return;
  }

  showMainLoading();

  await window.firebaseReadyPromise;
  console.log("Firebase ready. Current User:", window.auth.currentUser ? window.auth.currentUser.uid : "None");

  // Check if Firebase is properly initialized
  if (!window.auth || !window.db) {
    console.error("Firebase not properly initialized. Showing error message.");
    hideMainLoading();
    if (mainLoginRequiredMessage) {
      mainLoginRequiredMessage.style.display = 'block';
      mainLoginRequiredMessage.innerHTML = `
        <h2 class="text-4xl font-bold text-heading-main mb-6">Connection Error</h2>
        <p class="text-lg text-text-secondary mb-8">
          Unable to connect to the server. Please check your internet connection and try again.
        </p>
        <button onclick="location.reload()" class="inline-block btn-blue text-white font-bold py-3 px-8 rounded-full transition duration-300 ease-in-out transform hover:scale-105 shadow-lg">Retry</button>
      `;
    }
    return;
  }

  window.setupThemesFirebase(window.db, window.auth, window.appId);
  console.log("Themes setup complete.");

  try {
    await loadNavbar(window.auth, window.currentUser, window.DEFAULT_PROFILE_PIC, window.DEFAULT_THEME_NAME);
    console.log("Navbar loaded.");
  } catch (error) {
    console.error("Error loading navbar:", error);
    // Continue without navbar if it fails
  }

  let userThemePreference = window.DEFAULT_THEME_NAME;
  if (window.currentUser && window.currentUser.themePreference) {
    userThemePreference = window.currentUser.themePreference;
    console.log("User theme preference found:", userThemePreference);
  } else if (window.currentUser) {
    console.log("No specific theme preference for logged-in user, using default.");
  } else {
    console.log("No user logged in, using default theme.");
  }

  try {
    const allThemes = await window.getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === window.DEFAULT_THEME_NAME);
    window.applyTheme(themeToApply.id, themeToApply);
    console.log("Theme applied.");
  } catch (error) {
    console.error("Error applying theme:", error);
    // Continue without theme if it fails
  }

  onAuthStateChanged(window.auth, (user) => {
    console.log("Auth state changed. User:", user ? user.uid : "None");
    updateUIBasedOnAuthAndData();
  });

  const currentYearElement = document.getElementById('current-year-forms');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
    console.log("Footer year set.");
  }

  // Attach event listeners only if elements exist
  if (createThemaForm && newThemaNameInput && newThemaDescriptionInput) {
    createThemaForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      console.log("Create Thema form submitted.");
      const name = newThemaNameInput.value.trim();
      const description = newThemaDescriptionInput.value.trim();
      if (name && description) {
        await addThema(name, description);
      } else {
        showMessageBox("Please fill in both Théma Name and Description.", true);
        console.log("Missing thema name or description.");
      }
    });
    console.log("Create Théma form listener attached.");
  } else {
    console.warn("Create thema form elements not found.");
  }

  if (backToThematasBtn && threadsSection && commentsSection && themaList) {
    backToThematasBtn.addEventListener('click', () => {
      console.log("Back to Thémata button clicked.");
      threadsSection.style.display = 'none';
      commentsSection.style.display = 'none';
      if (document.getElementById('create-thema-section')) {
        document.getElementById('create-thema-section').style.display = 'block';
      }
      if (themaList) {
        themaList.style.display = 'block';
      }
      if (document.querySelector('#main-content > h2')) {
        document.querySelector('#main-content > h2').style.display = 'block';
      }
      if (document.querySelector('#main-content > h3')) {
        document.querySelector('#main-content > h3').style.display = 'block';
      }

      currentThemaId = null;
      currentThreadId = null;
      if (unsubscribeThemaComments) {
        unsubscribeThemaComments();
        unsubscribeThemaComments = null;
      }
      if (unsubscribeThreads) {
        unsubscribeThreads();
        unsubscribeThreads = null;
      }
      console.log("Returned to thémata list view.");
    });
    console.log("Back to Thémata button listener attached.");
  } else {
    console.warn("Back to thematas button elements not found.");
  }

  // Add after DOM elements initialization
  let threadThemaSelect = null;

  function populateThreadThemaSelect() {
    threadThemaSelect = document.getElementById('thread-thema-select');
    if (!threadThemaSelect) return;
    // Clear and add Global option
    threadThemaSelect.innerHTML = '<option value="global">Global</option>';
    // Fetch thémata from cache or Firestore
    const cached = cacheGet('arcator_themes_cache');
    if (cached && Array.isArray(cached)) {
      cached.forEach(thema => {
        const option = document.createElement('option');
        option.value = thema.id;
        option.textContent = thema.name;
        threadThemaSelect.appendChild(option);
      });
    }
    // Also update when thémata are re-rendered
  }

  // Patch renderThematas to also call populateThreadThemaSelect
  const origRenderThematas = renderThematas;
  renderThematas = function() {
    origRenderThematas();
    populateThreadThemaSelect();
  };

  // On DOMContentLoaded, also call populateThreadThemaSelect
  const origDOMContentLoaded = document.addEventListener;
  document.addEventListener = function(type, listener, options) {
    if (type === 'DOMContentLoaded') {
      origDOMContentLoaded.call(document, type, function(e) {
        listener(e);
        populateThreadThemaSelect();
      }, options);
    } else {
      origDOMContentLoaded.call(document, type, listener, options);
    }
  };

  if (createThreadForm && newThreadTitleInput && newThreadInitialCommentInput) {
    createThreadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = newThreadTitleInput.value.trim();
      const initialComment = newThreadInitialCommentInput.value.trim();
      threadThemaSelect = document.getElementById('thread-thema-select');
      const location = threadThemaSelect ? threadThemaSelect.value : 'global';
      if (title && initialComment) {
        if (location === 'global') {
          await addGlobalThread(title, initialComment);
        } else {
          await addCommentThread(location, title, initialComment);
        }
      } else {
        showMessageBox('Please fill in both Thread Title and Initial Comment.', true);
      }
    });
  }

  if (backToThreadsBtn && commentsSection && threadsSection) {
    backToThreadsBtn.addEventListener('click', () => {
      console.log("Back to Threads button clicked.");
      commentsSection.style.display = 'none';
      threadsSection.style.display = 'block';
      currentThreadId = null;
      if (unsubscribeThemaComments) {
        unsubscribeThemaComments();
        unsubscribeThemaComments = null;
      }
      console.log("Returned to threads list view.");
    });
    console.log("Back to Threads button listener attached.");
  } else {
    console.warn("Back to threads button elements not found.");
  }

  if (addCommentForm && newCommentContentInput) {
    addCommentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      console.log("Add Comment form submitted.");
      const content = newCommentContentInput.value.trim();
      if (currentThemaId && currentThreadId && content) {
        await addComment(currentThemaId, currentThreadId, content);
      } else {
        showMessageBox("Please type your comment.", true);
        console.log("Missing comment content.");
      }
    });
    console.log("Add Comment form listener attached.");
  } else {
    console.warn("Add comment form elements not found.");
  }

  // Enhanced features event listeners
  if (editSaveBtn && editCancelBtn && editInput) {
    editSaveBtn.addEventListener('click', async () => {
      if (currentEditId && editInput.value.trim()) {
        await editPost(currentEditId.type, currentEditId.id, editInput.value.trim());
      }
    });

    editCancelBtn.addEventListener('click', () => {
      hideEditForm();
    });
  }

  if (dmSendBtn && dmInput) {
    dmSendBtn.addEventListener('click', async () => {
      if (currentDmId && dmInput.value.trim()) {
        await sendDMMessage(currentDmId, dmInput.value.trim());
        dmInput.value = '';
      }
    });
  }

  if (dmBackBtn) {
    dmBackBtn.addEventListener('click', () => {
      if (dmSection) dmSection.style.display = 'none';
      if (formsContentSection) formsContentSection.style.display = 'block';
      currentDmId = null;
      if (unsubscribeDmMessages) {
        unsubscribeDmMessages();
        unsubscribeDmMessages = null;
      }
    });
  }

  if (tempPageForm && tempPageTitleInput && tempPageContentInput) {
    tempPageForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = tempPageTitleInput.value.trim();
      const content = tempPageContentInput.value.trim();
      if (title && content) {
        await createTempPage(title, content);
      } else {
        showMessageBox("Please fill in both title and content.", true);
      }
    });
  }

  // Initialize enhanced features
  if (window.auth.currentUser) {
    renderDMList();
    renderTempPages();
  }

  // Global click handler for reaction palette
  document.addEventListener('click', (event) => {
    if (!reactionPalette?.contains(event.target) && !event.target.classList.contains('add-reaction-btn')) {
      hideReactionPalette();
    }
  });

  // Attach event listener for creating global threads
  if (createGlobalThreadForm && globalThreadTitleInput && globalThreadContentInput) {
    createGlobalThreadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = globalThreadTitleInput.value.trim();
      const content = globalThreadContentInput.value.trim();
      if (title && content) {
        await addGlobalThread(title, content);
      } else {
        showMessageBox("Please fill in both Thread Title and Content.", true);
      }
    });
  }

  // Navigation tab logic
  const tabThema = document.getElementById('tab-thematas');
  const tabDms = document.getElementById('tab-dms');
  const tabTempPages = document.getElementById('tab-temp-pages');

  function showThemaTab() {
    // Hide all other sections
    if (threadsSection) threadsSection.style.display = 'none';
    if (commentsSection) commentsSection.style.display = 'none';
    if (dmSection) dmSection.style.display = 'none';
    if (tempPagesSection) tempPagesSection.style.display = 'none';
    if (conversationsSection) conversationsSection.style.display = 'none';
    // Show main forms content and thémata list
    if (formsContentSection) formsContentSection.style.display = 'block';
    if (themaList) themaList.style.display = 'block';
    if (document.getElementById('create-thema-section')) document.getElementById('create-thema-section').style.display = 'block';
    if (document.querySelector('#main-content > h2')) document.querySelector('#main-content > h2').style.display = 'block';
    if (document.querySelector('#main-content > h3')) document.querySelector('#main-content > h3').style.display = 'block';
    // Remove active from all tabs, set active on this
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (tabThema) tabThema.classList.add('active');
    // Always re-render thémata
    renderThematas();
  }

  function showDmTab() {
    if (formsContentSection) formsContentSection.style.display = 'none';
    if (dmSection) dmSection.style.display = 'block';
    if (tempPagesSection) tempPagesSection.style.display = 'none';
    if (conversationsSection) conversationsSection.style.display = 'none';
    if (threadsSection) threadsSection.style.display = 'none';
    if (commentsSection) commentsSection.style.display = 'none';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (tabDms) tabDms.classList.add('active');
    renderDMList();
  }

  function showTempPagesTab() {
    if (formsContentSection) formsContentSection.style.display = 'none';
    if (dmSection) dmSection.style.display = 'none';
    if (tempPagesSection) tempPagesSection.style.display = 'block';
    if (conversationsSection) conversationsSection.style.display = 'none';
    if (threadsSection) threadsSection.style.display = 'none';
    if (commentsSection) commentsSection.style.display = 'none';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (tabTempPages) tabTempPages.classList.add('active');
    renderTempPages();
  }

  if (tabThema) tabThema.addEventListener('click', showThemaTab);
  if (tabDms) tabDms.addEventListener('click', showDmTab);
  if (tabTempPages) tabTempPages.addEventListener('click', showTempPagesTab);

  // Optionally, show Thémata tab by default on load
  showThemaTab();

  populateThreadThemaSelect();
});

let unsubscribeThemaComments = null;
let unsubscribeThreads = null;
let unsubscribeThematas = null;
let unsubscribeDmList = null;

// --- CONVERSATIONS (DMs) ---
let conversationsSection = null;
let startConversationBtn = null;
let conversationsList = null;
let conversationMessagesSection = null;
let conversationMessages = null;
let conversationInput = null;
let conversationSendBtn = null;
let currentConversationId = null;
let unsubscribeConversations = null;
let unsubscribeConversationMessages = null;

function initializeConversationElements() {
  conversationsSection = document.getElementById('conversations-section');
  startConversationBtn = document.getElementById('start-conversation-btn');
  conversationsList = document.getElementById('conversations-list');
  conversationMessagesSection = document.getElementById('conversation-messages-section');
  conversationMessages = document.getElementById('conversation-messages');
  conversationInput = document.getElementById('conversation-input');
  conversationSendBtn = document.getElementById('conversation-send-btn');
}

function showConversationsSection() {
  if (conversationsSection) conversationsSection.style.display = 'block';
  if (formsContentSection) formsContentSection.style.display = 'none';
  if (dmSection) dmSection.style.display = 'none';
  if (tempPagesSection) tempPagesSection.style.display = 'none';
  if (themaRulesSection) themaRulesSection.style.display = 'none';
  renderConversations();
}

function renderConversations() {
  if (!window.db || !window.auth.currentUser) return;
  if (!conversationsList) return;
  if (unsubscribeConversations) unsubscribeConversations();
  const userId = window.auth.currentUser.uid;
  const convCol = collection(window.db, `artifacts/${window.appId}/public/data/conversations`);
  const q = query(convCol, where('participants', 'array-contains', userId), orderBy('lastMessageAt', 'desc'));
  unsubscribeConversations = onSnapshot(q, (snapshot) => {
    conversationsList.innerHTML = '';
    if (snapshot.empty) {
      conversationsList.innerHTML = '<li class="card p-4 text-center">No conversations yet.</li>';
      return;
    }
    snapshot.forEach(doc => {
      const conv = doc.data();
      const li = document.createElement('li');
      li.className = 'card cursor-pointer';
      li.innerHTML = `
        <div class="flex flex-col">
          <span class="font-bold text-lg">${conv.name || 'Conversation'}</span>
          <span class="text-sm text-gray-400">Last: ${conv.lastMessageContent || ''}</span>
          <span class="text-xs text-gray-500">${conv.lastMessageAt ? new Date(conv.lastMessageAt.toDate()).toLocaleString() : ''}</span>
        </div>
      `;
      li.onclick = () => selectConversation(doc.id, conv);
      conversationsList.appendChild(li);
    });
  });
}

function selectConversation(convId, convData) {
  currentConversationId = convId;
  if (conversationMessagesSection) conversationMessagesSection.style.display = 'block';
  renderConversationMessages(convId);
}

function renderConversationMessages(convId) {
  if (!window.db || !window.auth.currentUser) return;
  if (!conversationMessages) return;
  if (unsubscribeConversationMessages) unsubscribeConversationMessages();
  const messagesCol = collection(window.db, `artifacts/${window.appId}/public/data/conversations/${convId}/messages`);
  const q = query(messagesCol, orderBy('createdAt', 'asc'));
  unsubscribeConversationMessages = onSnapshot(q, (snapshot) => {
    conversationMessages.innerHTML = '';
    if (snapshot.empty) {
      conversationMessages.innerHTML = '<li class="text-center text-gray-500">No messages yet.</li>';
      return;
    }
    snapshot.forEach(doc => {
      const msg = doc.data();
      const li = document.createElement('li');
      li.className = `message-item ${msg.createdBy === window.auth.currentUser.uid ? 'own-message' : 'other-message'}`;
      li.innerHTML = `
        <div class="message-content">
          <p>${convertMentionsToHTML(msg.content)}</p>
          <small class="text-gray-500">${msg.lastMessageSenderHandle || msg.createdBy} - ${msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleString() : ''}</small>
        </div>
      `;
      conversationMessages.appendChild(li);
    });
    conversationMessages.scrollTop = conversationMessages.scrollHeight;
  });
}

async function sendConversationMessage() {
  if (!window.db || !window.auth.currentUser || !currentConversationId) return;
  const content = conversationInput.value.trim();
  if (!content) return;
  const user = window.currentUser;
  const msgData = {
    content: content,
    createdAt: serverTimestamp(),
    createdBy: window.auth.currentUser.uid,
    lastMessageSenderHandle: user?.handle || user?.displayName || 'You',
    lastMessageSenderId: window.auth.currentUser.uid
  };
  const messagesCol = collection(window.db, `artifacts/${window.appId}/public/data/conversations/${currentConversationId}/messages`);
  await addDoc(messagesCol, msgData);
  // Update conversation last message
  const convRef = doc(window.db, `artifacts/${window.appId}/public/data/conversations`, currentConversationId);
  await updateDoc(convRef, {
    lastMessageAt: serverTimestamp(),
    lastMessageContent: content,
    lastMessageSenderHandle: msgData.lastMessageSenderHandle,
    lastMessageSenderId: msgData.lastMessageSenderId
  });
  conversationInput.value = '';
}

async function startNewConversation() {
  if (!window.db || !window.auth.currentUser) return;
  const userId = window.auth.currentUser.uid;
  let participantId = prompt('Enter the user ID to DM (leave blank to DM yourself):', userId);
  if (!participantId) participantId = userId;
  const participants = [userId, participantId];
  const convCol = collection(window.db, `artifacts/${window.appId}/public/data/conversations`);
  const convDoc = await addDoc(convCol, {
    participants: participants,
    type: participantId === userId ? 'private' : 'private',
    createdBy: userId,
    createdAt: serverTimestamp(),
    lastMessageAt: null,
    lastMessageContent: '',
    lastMessageSenderHandle: '',
    lastMessageSenderId: '',
    name: participantId === userId ? 'Self DM' : ''
  });
  selectConversation(convDoc.id, {});
  showMessageBox('Conversation started!', false);
}

document.addEventListener('DOMContentLoaded', function() {
  initializeConversationElements();
  if (startConversationBtn) {
    startConversationBtn.addEventListener('click', startNewConversation);
  }
  if (conversationSendBtn) {
    conversationSendBtn.addEventListener('click', sendConversationMessage);
  }
  // Add tab for conversations
  const tabConversations = document.getElementById('tab-dms');
  if (tabConversations) {
    tabConversations.addEventListener('click', showConversationsSection);
  }
});

// --- PATCH: Fix thread deletion for both global and thema threads ---
// In renderThreads and renderGlobalThreads, update delete button event listeners:
function attachThreadDeleteListeners() {
  document.querySelectorAll('.delete-thread-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      const threadId = event.target.dataset.threadId;
      const isGlobal = event.target.dataset.global === 'true';
      const confirmed = await showCustomConfirm("Are you sure you want to delete this thread?", "All comments within it will also be deleted.");
      if (confirmed) {
        if (isGlobal) {
          // Delete global thread
          const threadRef = doc(window.db, `artifacts/${window.appId}/public/data/threads`, threadId);
          await deleteDoc(threadRef);
        } else {
          // Delete thema thread
          await deleteThreadAndSubcollection(currentThemaId, threadId);
        }
        showMessageBox("Thread deleted successfully!", false);
      } else {
        showMessageBox("Thread deletion cancelled.", false);
      }
    });
  });
}
// Call attachThreadDeleteListeners after rendering threads/global threads
// --- PATCH: Allow moving a thread to another thema or global ---
async function moveThread(threadId, fromThemaId, toThemaId) {
  if (!window.db) return;
  let threadData = null;
  let threadRef = null;
  if (fromThemaId === 'global') {
    threadRef = doc(window.db, `artifacts/${window.appId}/public/data/threads`, threadId);
  } else {
    threadRef = doc(window.db, `artifacts/${window.appId}/public/data/thematas/${fromThemaId}/threads`, threadId);
  }
  const threadSnap = await getDoc(threadRef);
  if (!threadSnap.exists()) return;
  threadData = threadSnap.data();
  // Remove from old location
  await deleteDoc(threadRef);
  // Add to new location
  let newRef;
  if (toThemaId === 'global') {
    newRef = collection(window.db, `artifacts/${window.appId}/public/data/threads`);
  } else {
    newRef = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${toThemaId}/threads`);
  }
  await addDoc(newRef, threadData);
  showMessageBox('Thread moved successfully!', false);
}
// In renderThreads and renderGlobalThreads, add a dropdown to each thread for moving
// Example for renderThreads:
// ... inside thread rendering loop ...
// <select class="move-thread-select" data-thread-id="${doc.id}" data-from-thema="${currentThemaId}">
//   <option value="">Move to...</option>
//   <option value="global">Global</option>
//   ...populate with all thémata...
// </select>
// After rendering, attach event listeners:
function attachMoveThreadListeners() {
  document.querySelectorAll('.move-thread-select').forEach(select => {
    select.addEventListener('change', async (event) => {
      const toThemaId = event.target.value;
      const threadId = event.target.dataset.threadId;
      const fromThemaId = event.target.dataset.fromThema;
      if (toThemaId && threadId) {
        await moveThread(threadId, fromThemaId, toThemaId);
      }
    });
  });
}
// After rendering threads/global threads, call attachThreadDeleteListeners() and attachMoveThreadListeners()

const mainLoadingSpinner = document.getElementById('loading-spinner');
const formsContentSection = document.getElementById('forms-content');
const mainLoginRequiredMessage = document.getElementById('login-required-message');
const createThemaForm = document.getElementById('create-thema-form');
const newThemaNameInput = document.getElementById('new-thema-name');
const newThemaDescriptionInput = document.getElementById('new-thema-description');
const themaList = document.getElementById('thema-list');
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
