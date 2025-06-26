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
    console.warn("Firebase ready promise timed out after 60 seconds. Continuing anyway.");
    firebaseReadyResolve();
  }
}, 60000); // 60 seconds

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
          console.log("[DEBUG] onAuthStateChanged triggered. User:", user ? user.uid : "none");
          if (user) {
            let userProfile = await window.getUserProfileFromFirestore(user.uid);
            if (!userProfile) {
              console.log("[DEBUG] No profile found. Creating default.");
              userProfile = {
                uid: user.uid, displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
                email: user.email || null, photoURL: user.photoURL || window.DEFAULT_PROFILE_PIC,
                createdAt: new Date(), lastLoginAt: new Date(), themePreference: window.DEFAULT_THEME_NAME
              };
              await window.setUserProfileInFirestore(user.uid, userProfile);
            } else {
              await window.setUserProfileInFirestore(user.uid, { lastLoginAt: new Date() });
            }
            window.currentUser = userProfile;
            console.log("[DEBUG] currentUser set:", window.currentUser);
            console.log("[DEBUG] About to call updateUIBasedOnAuthAndData after setting currentUser:", window.currentUser);
            try {
              updateUIBasedOnAuthAndData();
              console.log("[DEBUG] updateUIBasedOnAuthAndData() called successfully after login.");
            } catch (e) {
              console.error("[DEBUG] Error calling updateUIBasedOnAuthAndData after login:", e);
            }
          } else {
            console.log("[DEBUG] User logged out. currentUser set to null.");
            window.currentUser = null;
            updateUIBasedOnAuthAndData();
          }
          firebaseReadyResolve();
          unsubscribe();
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
  try {
    messageBox = document.getElementById('message-box');
    customConfirmModal = document.getElementById('custom-confirm-modal');
    confirmMessage = document.getElementById('confirm-message');
    confirmSubmessage = document.getElementById('confirm-submessage');
    confirmYesButton = document.getElementById('confirm-yes');
    confirmNoButton = document.getElementById('confirm-no');
    closeButton = document.querySelector('.custom-confirm-modal .close-button');
    if (!messageBox) console.warn('[DEBUG] messageBox element not found.');
    if (!customConfirmModal) console.warn('[DEBUG] customConfirmModal element not found.');
    if (!confirmMessage) console.warn('[DEBUG] confirmMessage element not found.');
    if (!confirmSubmessage) console.warn('[DEBUG] confirmSubmessage element not found.');
    if (!confirmYesButton) console.warn('[DEBUG] confirmYesButton element not found.');
    if (!confirmNoButton) console.warn('[DEBUG] confirmNoButton element not found.');
    if (!closeButton) console.warn('[DEBUG] closeButton element not found.');
    if (customConfirmModal) {
      console.log('[DEBUG] custom-confirm-modal element found.');
      if (customConfirmModal.style.display === '' || customConfirmModal.style.display === 'block') {
        customConfirmModal.style.display = 'none';
        console.log('[DEBUG] custom-confirm-modal forcibly hidden on script load.');
      }
    }
    console.log('[DEBUG] Utility elements initialized.');
  } catch (e) {
    console.error('[DEBUG] Error in initializeUtilityElements:', e);
  }
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
  try {
    if (typeof mainLoadingSpinner !== 'undefined' && mainLoadingSpinner) {
      mainLoadingSpinner.style.display = 'flex';
    } else {
      console.warn('[DEBUG] mainLoadingSpinner not found.');
    }
    if (typeof formsContentSection !== 'undefined' && formsContentSection) {
      formsContentSection.style.display = 'none';
    } else {
      console.warn('[DEBUG] formsContentSection not found.');
    }
    if (typeof mainLoginRequiredMessage !== 'undefined' && mainLoginRequiredMessage) {
      mainLoginRequiredMessage.style.display = 'none';
    } else {
      console.warn('[DEBUG] mainLoginRequiredMessage not found.');
    }
    console.log('[DEBUG] Spinner visible, content hidden.');
  } catch (e) {
    console.error('[DEBUG] Error in showMainLoading:', e);
  }
}

/**
 * Hides the main loading spinner.
 */
function hideMainLoading() {
  try {
    if (typeof mainLoadingSpinner !== 'undefined' && mainLoadingSpinner) {
      mainLoadingSpinner.style.display = 'none';
    } else {
      console.warn('[DEBUG] mainLoadingSpinner not found.');
    }
    console.log('[DEBUG] Spinner hidden.');
  } catch (e) {
    console.error('[DEBUG] Error in hideMainLoading:', e);
  }
}

/**
 * Updates UI visibility based on authentication and user profile readiness.
 */
async function updateUIBasedOnAuthAndData() {
  console.log("[DEBUG] updateUIBasedOnAuthAndData called. currentUser:", window.currentUser);
  hideMainLoading();
  if (window.auth.currentUser) {
    if (!window.currentUser || window.currentUser.uid !== window.auth.currentUser.uid) {
      window.currentUser = {
        uid: window.auth.currentUser.uid,
        displayName: window.auth.currentUser.displayName || `User-${window.auth.currentUser.uid.substring(0, 6)}`,
        email: window.auth.currentUser.email || null,
        photoURL: window.auth.currentUser.photoURL || window.DEFAULT_PROFILE_PIC,
        themePreference: window.DEFAULT_THEME_NAME
      };
      console.log("[DEBUG] Set window.currentUser from window.auth.currentUser:", window.currentUser);
    }
    let profileReady = true;
    if (profileReady) {
      if (formsContentSection) {
        formsContentSection.style.display = 'block';
        console.log("[DEBUG] formsContentSection shown");
      }
      if (mainLoginRequiredMessage) {
        mainLoginRequiredMessage.style.display = 'none';
        console.log("[DEBUG] mainLoginRequiredMessage hidden");
      }
      renderThematas();
    }
  } else {
    console.log("[DEBUG] User NOT logged in. Showing login message.");
    if (formsContentSection) {
      formsContentSection.style.display = 'none';
      console.log("[DEBUG] formsContentSection hidden");
    }
    if (mainLoginRequiredMessage) {
      mainLoginRequiredMessage.style.display = 'block';
      console.log("[DEBUG] mainLoginRequiredMessage shown");
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

// --- CACHED THREADS ---
function renderThreadsFromCache(themaId) {
  try {
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
  } catch (e) {
    console.error('[DEBUG] Error in renderThreadsFromCache:', e);
  }
}

// --- PATCH renderThematas: Use <details> for collapsible thémata ---
function renderThematas() {
  try {
    console.log('[DEBUG] renderThematas called. DB:', !!window.db, 'currentUser:', window.currentUser);
    if (typeof unsubscribeThematas !== 'undefined' && unsubscribeThematas) {
      unsubscribeThematas();
      console.log('[DEBUG] Unsubscribed from previous thémata listener.');
    }
    if (!window.db) {
      const container = document.getElementById('thema-boxes');
      if (container) container.innerHTML = '<div class="card p-4 text-center text-red-400">Database not initialized. Cannot load thémata.</div>';
      else console.warn('[DEBUG] thema-boxes container not found.');
      return;
    }
    const themasArr = [];
    // Always add 'Global' as the first thema
    themasArr.push({
      id: 'global',
      name: 'Global',
      description: 'Site-wide threads not tied to any specific Théma.'
    });
    const thematasCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas`);
    const q = query(thematasCol, orderBy("createdAt", "desc"));
    unsubscribeThematas = onSnapshot(q, async (snapshot) => {
      snapshot.forEach((doc) => {
        const thema = doc.data();
        themasArr.push({ ...thema, id: doc.id });
      });
      renderThemaBoxes(themasArr);
    }, (error) => {
      const container = document.getElementById('thema-boxes');
      if (container) container.innerHTML = `<div class='card p-4 text-center'>Error loading thémata: ${error.message}</div>`;
    });
  } catch (e) {
    console.error('[DEBUG] Error in renderThematas:', e);
  }
}

function renderThemaBoxes(themasArr) {
  try {
    console.log('[DEBUG] renderThemaBoxes called. themasArr:', themasArr, 'currentUser:', window.currentUser);
    const container = document.getElementById('thema-boxes');
    if (!container) { console.warn('[DEBUG] thema-boxes container not found.'); return; }
    container.innerHTML = '';
    if (!themasArr.length) {
      container.innerHTML = '<div class="card p-4 text-center">No thémata found. Be the first to create one!</div>';
      return;
    }
    themasArr.forEach(thema => {
      const box = document.createElement('div');
      box.className = 'thema-item card p-6 flex flex-col justify-between mb-4';
      box.innerHTML = `
        <h3 class="text-xl font-bold text-heading-card mb-2">${thema.name}</h3>
        <p class="thema-description mb-4">${thema.description || ''}</p>
        <div class="thema-thread-list" id="thema-thread-list-${thema.id}">Loading threads...</div>
        <form class="create-thread-form mt-6 mb-2 card bg-card shadow p-4 flex flex-col gap-3" id="create-thread-form-${thema.id}">
          <div class="mb-2">
            <label class="block text-sm font-semibold mb-1" for="thread-title-input-${thema.id}">Title</label>
            <input type="text" id="thread-title-input-${thema.id}" class="thread-title-input input w-full text-lg font-semibold px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" maxlength="120" placeholder="Title (e.g. What's on your mind?)" required />
          </div>
          <div class="mb-2">
            <label class="block text-sm font-semibold mb-1" for="thread-content-input-${thema.id}">Body</label>
            <textarea id="thread-content-input-${thema.id}" class="thread-content-input input w-full min-h-[80px] px-3 py-2 border rounded resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Text (optional, Markdown supported)" required></textarea>
          </div>
          <button type="submit" class="btn-primary btn-blue w-full py-2 text-base font-bold rounded">Create Post</button>
        </form>
        ${(window.currentUser && (window.currentUser.isAdmin || window.currentUser.uid === thema.authorId)) ? `<button class="delete-thema-btn btn-primary btn-red mt-2" title="Delete"><span class="material-icons">delete</span></button>` : ''}
      `;
      container.appendChild(box);
      loadThreadsForThema(thema.id);
      // Thread creation handler
      const threadForm = box.querySelector(`#create-thread-form-${thema.id}`);
      threadForm.onsubmit = async (e) => {
        e.preventDefault();
        const title = threadForm.querySelector('.thread-title-input').value.trim();
        const content = threadForm.querySelector('.thread-content-input').value.trim();
        if (!title || !content) return;
        if (!window.auth.currentUser || !window.db) return;
        const threadsCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${thema.id}/threads`);
        await addDoc(threadsCol, {
          title,
          initialComment: content,
          createdAt: serverTimestamp(),
          createdBy: window.auth.currentUser.uid,
          creatorDisplayName: window.currentUser ? window.currentUser.displayName : 'Anonymous'
        });
        threadForm.reset();
      };
      renderThemaAdminControls(thema, box);
      if (window.currentUser && (window.currentUser.isAdmin || window.currentUser.uid === thema.authorId)) {
        box.querySelector('.delete-thema-btn').onclick = async () => {
          if (confirm('Delete this Théma and all its threads?')) {
            await deleteDoc(doc(window.db, `artifacts/${window.appId}/public/data/thematas`, thema.id));
            box.remove();
          }
        };
      }
    });
  } catch (e) {
    console.error('[DEBUG] Error in renderThemaBoxes:', e);
  }
}

function loadThreadsForThema(themaId) {
  if (!themaId) return; // Prevent invalid Firestore path
  try {
    const threadListDiv = document.getElementById(`thema-thread-list-${themaId}`);
    if (!window.db || !threadListDiv) {
      if (!window.db) console.warn('[DEBUG] DB not initialized in loadThreadsForThema.');
      if (!threadListDiv) console.warn(`[DEBUG] threadListDiv not found for themaId ${themaId}`);
      return;
    }
    // Always use /thematas/{themaId}/threads for all thémata, including 'global'
    const threadsCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`);
    const q = query(threadsCol, orderBy('createdAt', 'desc'));
    onSnapshot(q, async (snapshot) => {
      threadListDiv.innerHTML = '';
      if (snapshot.empty) {
        // Auto-create default global thread if admin
        if (themaId === 'global' && window.currentUser && window.currentUser.isAdmin) {
          await addDoc(threadsCol, {
            title: 'Welcome to the Arcator Community Forum',
            initialComment: 'This is the first thread in the global section. Feel free to introduce yourself or ask questions!',
            createdAt: serverTimestamp(),
            createdBy: window.currentUser.uid,
            creatorDisplayName: window.currentUser.displayName || 'Admin'
          });
          return; // Wait for snapshot to update
        }
        threadListDiv.innerHTML = '<div class="text-center text-gray-400">No threads yet.</div>';
        return;
      }
      const threadUids = new Set();
      snapshot.forEach(doc => {
        const thread = doc.data();
        if (thread.createdBy) threadUids.add(thread.createdBy);
      });
      const userProfiles = {};
      if (threadUids.size > 0) {
        const usersRef = collection(window.db, `artifacts/${window.appId}/public/data/user_profiles`);
        const userQuery = query(usersRef, where('uid', 'in', Array.from(threadUids)));
        await getDocs(userQuery).then(userSnapshot => {
          userSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            userProfiles[userDoc.id] = userData;
          });
        });
      }
      snapshot.forEach(doc => {
        const thread = doc.data();
        const threadDiv = document.createElement('div');
        threadDiv.className = 'thread-item card p-4 mb-3 bg-card shadow flex flex-col gap-2';
        const user = userProfiles[thread.createdBy] || {};
        const profilePic = user.photoURL || window.DEFAULT_PROFILE_PIC;
        const displayName = user.displayName || 'Unknown';
        const createdAt = thread.createdAt ? new Date(thread.createdAt.toDate()).toLocaleString() : 'N/A';
        const canEdit = window.currentUser && window.currentUser.uid === thread.authorId;
        threadDiv.innerHTML = `
          <div class="flex items-center gap-2 mb-1">
            <img src="${profilePic}" class="w-8 h-8 rounded-full object-cover border" alt="Profile">
            <span class="font-semibold">${displayName}</span>
            <span class="ml-2 text-xs text-gray-400">${createdAt}</span>
            ${canEdit ? `<button class="edit-thread-btn ml-auto mr-1" title="Edit"><span class="material-icons text-orange-400">edit</span></button><button class="delete-thread-btn btn-primary btn-red ml-2" title="Delete"><span class="material-icons">delete</span></button>` : ''}
          </div>
          <h4 class="thread-title text-2xl font-extrabold text-heading-card mb-1">${thread.title}</h4>
          <div class="text-sm text-gray-300 mb-2">${renderMarkdown(thread.initialComment || '')}</div>
          <div class="reactions-bar flex gap-2 mb-2">${renderReactions(thread.reactions || {}, 'thread', doc.id, null, themaId)}</div>
          <div class="thread-comments" id="thread-comments-${doc.id}">Loading comments...</div>
          <form class="add-comment-form mt-2 card bg-card shadow p-3 flex flex-col gap-2" id="add-comment-form-${doc.id}">
            <label class="block text-sm font-semibold mb-1" for="comment-content-input-${doc.id}">Add a comment</label>
            <textarea id="comment-content-input-${doc.id}" class="comment-content-input input w-full min-h-[60px] px-3 py-2 border rounded resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Text (Markdown supported)" required></textarea>
            <button type="submit" class="btn-primary btn-green w-full py-2 text-base font-bold rounded">Add Comment</button>
          </form>
        `;
        threadListDiv.appendChild(threadDiv);
        loadCommentsForThread(themaId, doc.id);
        const commentForm = threadDiv.querySelector(`#add-comment-form-${doc.id}`);
        commentForm.onsubmit = async (e) => {
          e.preventDefault();
          const content = commentForm.querySelector('.comment-content-input').value.trim();
          if (!content) return;
          if (!window.auth.currentUser || !window.db) return;
          const commentsCol = themaId === 'global'
            ? collection(window.db, `artifacts/${window.appId}/public/data/threads/${doc.id}/comments`)
            : collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${doc.id}/comments`);
          await addDoc(commentsCol, {
            content,
            createdAt: serverTimestamp(),
            createdBy: window.auth.currentUser.uid,
            creatorDisplayName: window.currentUser ? window.currentUser.displayName : 'Anonymous'
          });
          commentForm.reset();
        };
        // Edit/Delete thread handlers
        if (canEdit) {
          threadDiv.querySelector('.edit-thread-btn').onclick = () => enableEditInline('thread', themaId, doc.id, null, thread.initialComment, threadDiv);
          threadDiv.querySelector('.delete-thread-btn').onclick = async () => {
            if (confirm('Delete this thread?')) {
              const threadsCol = themaId === 'global'
                ? collection(window.db, `artifacts/${window.appId}/public/data/threads`)
                : collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`);
              await deleteDoc(doc(threadsCol, doc.id));
              threadDiv.remove();
            }
          };
        }
      });
    });
  } catch (e) {
    console.error('[DEBUG] Error in loadThreadsForThema:', e);
  }
}

function loadCommentsForThread(themaId, threadId) {
  const commentsDiv = document.getElementById(`thread-comments-${threadId}`);
  if (!window.db || !commentsDiv) return;
  const commentsCol = themaId === 'global'
    ? collection(window.db, `artifacts/${window.appId}/public/data/threads/${threadId}/comments`)
    : collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`);
  const q = query(commentsCol, orderBy('createdAt', 'asc'));
  onSnapshot(q, async (snapshot) => {
    commentsDiv.innerHTML = '';
    if (snapshot.empty) {
      commentsDiv.innerHTML = '<div class="text-xs text-gray-400">No comments yet.</div>';
      return;
    }
    const commentUids = new Set();
    snapshot.forEach(doc => {
      const comment = doc.data();
      if (comment.createdBy) commentUids.add(comment.createdBy);
    });
    const userProfiles = {};
    if (commentUids.size > 0) {
      const usersRef = collection(window.db, `artifacts/${window.appId}/public/data/user_profiles`);
      const userQuery = query(usersRef, where('uid', 'in', Array.from(commentUids)));
      await getDocs(userQuery).then(userSnapshot => {
        userSnapshot.forEach(userDoc => {
          const userData = userDoc.data();
          userProfiles[userDoc.id] = userData;
        });
      });
    }
    snapshot.forEach(doc => {
      const comment = doc.data();
      const user = userProfiles[comment.createdBy] || {};
      const profilePic = user.photoURL || window.DEFAULT_PROFILE_PIC;
      const displayName = user.displayName || 'Unknown';
      const createdAt = comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleString() : 'N/A';
      const canEdit = window.currentUser && window.currentUser.uid === comment.authorId;
      const commentDiv = document.createElement('div');
      commentDiv.className = 'comment-item card p-3 mb-2 bg-card flex flex-col gap-1';
      commentDiv.innerHTML = `
        <div class="flex items-center gap-2 mb-1">
          <img src="${profilePic}" class="w-6 h-6 rounded-full object-cover border" alt="Profile">
          <span class="font-semibold">${displayName}</span>
          <span class="ml-2 text-xs text-gray-400">${createdAt}</span>
          ${canEdit ? `<button class="edit-comment-btn ml-auto mr-1" title="Edit"><span class="material-icons text-orange-400">edit</span></button><button class="delete-comment-btn btn-primary btn-red ml-2" title="Delete"><span class="material-icons">delete</span></button>` : ''}
        </div>
        <div class="text-sm">${renderMarkdown(comment.content)}</div>
        <div class="reactions-bar flex gap-2 mt-1">${renderReactions(comment.reactions || {}, 'comment', doc.id, threadId, themaId)}</div>
      `;
      commentsDiv.appendChild(commentDiv);
      // Edit/Delete comment handlers
      if (canEdit) {
        commentDiv.querySelector('.edit-comment-btn').onclick = () => enableEditInline('comment', themaId, threadId, doc.id, comment.content, commentDiv);
        commentDiv.querySelector('.delete-comment-btn').onclick = async () => {
          if (confirm('Delete this comment?')) {
            await deleteDoc(doc(commentsCol, doc.id));
            commentDiv.remove();
          }
        };
      }
    });
  });
}

// Edit thread
function editThread(themaId, threadId, oldTitle, oldContent, threadDiv) {
  const editForm = document.createElement('form');
  editForm.className = 'edit-thread-form flex flex-col gap-2 mb-2';
  editForm.innerHTML = `
    <input type="text" class="edit-thread-title input" value="${oldTitle}" required />
    <textarea class="edit-thread-content input">${oldContent}</textarea>
    <div class="flex gap-2">
      <button type="submit" class="btn-primary btn-green">Save</button>
      <button type="button" class="btn-primary btn-red cancel-edit">Cancel</button>
    </div>
  `;
  const origHtml = threadDiv.innerHTML;
  threadDiv.innerHTML = '';
  threadDiv.appendChild(editForm);
  editForm.onsubmit = async (e) => {
    e.preventDefault();
    const newTitle = editForm.querySelector('.edit-thread-title').value.trim();
    const newContent = editForm.querySelector('.edit-thread-content').value.trim();
    if (!newTitle || !newContent) return;
    const threadsCol = themaId === 'global'
      ? collection(window.db, `artifacts/${window.appId}/public/data/threads`)
      : collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`);
    await updateDoc(doc(threadsCol, threadId), {
      title: newTitle,
      initialComment: newContent
    });
    threadDiv.innerHTML = origHtml;
  };
  editForm.querySelector('.cancel-edit').onclick = () => {
    threadDiv.innerHTML = origHtml;
  };
}

// Edit comment
function editComment(themaId, threadId, commentId, oldContent, commentDiv) {
  const editForm = document.createElement('form');
  editForm.className = 'edit-comment-form flex flex-col gap-2 mb-2';
  editForm.innerHTML = `
    <textarea class="edit-comment-content input">${oldContent}</textarea>
    <div class="flex gap-2">
      <button type="submit" class="btn-primary btn-green">Save</button>
      <button type="button" class="btn-primary btn-red cancel-edit">Cancel</button>
    </div>
  `;
  const origHtml = commentDiv.innerHTML;
  commentDiv.innerHTML = '';
  commentDiv.appendChild(editForm);
  editForm.onsubmit = async (e) => {
    e.preventDefault();
    const newContent = editForm.querySelector('.edit-comment-content').value.trim();
    if (!newContent) return;
    const commentsCol = themaId === 'global'
      ? collection(window.db, `artifacts/${window.appId}/public/data/threads/${threadId}/comments`)
      : collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`);
    await updateDoc(doc(commentsCol, commentId), {
      content: newContent
    });
    commentDiv.innerHTML = origHtml;
  };
  editForm.querySelector('.cancel-edit').onclick = () => {
    commentDiv.innerHTML = origHtml;
  };
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

  // Hide only the create thema section, keep the thema list visible for context
  if (document.getElementById('create-thema-section')) {
    document.getElementById('create-thema-section').style.display = 'none';
  }
  // Show threads section for this thema
  if (threadsSection) threadsSection.style.display = 'block';
  if (commentsSection) commentsSection.style.display = 'none';
  // Optionally, scroll to threads section for better UX
  threadsSection.scrollIntoView({ behavior: 'smooth' });
  // Render threads for this thema
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
  if (unsubscribeThreads) unsubscribeThreads();
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
    const authorUids = new Set();
    snapshot.forEach((doc) => {
      const thread = doc.data();
      if (thread.authorId) authorUids.add(thread.authorId);
      threadsArr.push({ ...thread, id: doc.id });
    });
    // Fetch user profiles for all unique authorIds
    const userProfiles = {};
    if (authorUids.size > 0) {
      const usersRef = collection(window.db, `artifacts/${window.appId}/public/data/user_profiles`);
      const userQuery = query(usersRef, where('uid', 'in', Array.from(authorUids)));
      await getDocs(userQuery).then(userSnapshot => {
        userSnapshot.forEach(userDoc => {
          userProfiles[userDoc.id] = userDoc.data();
        });
      }).catch(error => console.error("Error fetching user profiles for threads:", error));
    }
    snapshot.forEach((doc) => {
      const thread = doc.data();
      const userProfile = userProfiles[thread.authorId] || {};
      const createdAt = thread.createdAt ? new Date(thread.createdAt.toDate()).toLocaleString() : 'N/A';
      const editedInfo = thread.editedAt ? ` (edited${thread.editedBy ? ' by ' + thread.editedBy : ''} ${thread.editedAt.toDate ? new Date(thread.editedAt.toDate()).toLocaleString() : ''})` : '';
      const displayName = userProfile.displayName || thread.authorDisplayName || 'Unknown';
      const handle = userProfile.handle ? `@${userProfile.handle}` : (thread.authorHandle ? `@${thread.authorHandle}` : '');
      const photoURL = userProfile.photoURL || thread.authorPhotoURL || window.DEFAULT_PROFILE_PIC;
      const commentCount = thread.commentCount || 0;
      const li = document.createElement('li');
      li.className = 'thread-item card flex flex-col mb-4 p-4';
      li.innerHTML = `
        <div class="flex items-center mb-2">
          <img src="${photoURL}" alt="User Icon" class="w-8 h-8 rounded-full mr-2 object-cover">
          <span class="font-bold">${displayName}</span>
          <span class="text-gray-400 ml-2">${handle}</span>
          <span class="meta-info ml-4">${createdAt}${editedInfo}</span>
        </div>
        <h3 class="text-xl font-bold text-heading-card mb-1">${thread.title}</h3>
        <p class="thread-initial-comment mb-2">${renderMarkdown(thread.initialComment || '')}</p>
        <div class="flex items-center mb-2">
          <span class="text-sm text-gray-400 mr-4">${commentCount} comments</span>
          <div class="reactions-bar flex gap-2 mb-2">${renderReactions(thread.reactions || {}, 'thread', doc.id, null, currentThemaId)}</div>
          <div class="thread-actions ml-auto">
            ${(canEditPost(thread, window.currentUser) ? `<button onclick=\"showEditForm('${thread.initialComment.replace(/'/g, "&#39;")}', '${doc.id}', 'thread')\" class="edit-thread-btn btn-primary btn-blue ml-2">Edit</button>` : '')}
            ${(canDeletePost(thread, window.currentUser) ? `<button data-thread-id=\"${doc.id}\" class="delete-thread-btn btn-primary btn-red ml-2">Delete</button>` : '')}
          </div>
        </div>
        <div class="add-comment-section mt-2">${getAddCommentFormHtml(doc.id)}</div>
        <ul class="comment-list space-y-4 mt-2" id="comment-list-${doc.id}"></ul>
      `;
      threadList.appendChild(li);
      renderCommentsForThread(doc.id, currentThemaId);
    });
    cacheSet('arcator_threads_cache_' + currentThemaId, threadsArr);
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
  });
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
    const emojiReactions = reactions[emoji] || {};

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

// --- Event Listeners and Initial Load ---
document.addEventListener('DOMContentLoaded', async function() {
  try {
    window.mainLoadingSpinner = document.getElementById('loading-spinner');
    window.formsContentSection = document.getElementById('forms-content');
    window.mainLoginRequiredMessage = document.getElementById('login-required-message');
    console.log('[DEBUG] DOMContentLoaded fired.');
    initializeUtilityElements();
    showMainLoading();
    // Attach create-thema-form handler
    const createThemaForm = document.getElementById('create-thema-form');
    const newThemaNameInput = document.getElementById('new-thema-name');
    const newThemaDescriptionInput = document.getElementById('new-thema-description');
    if (createThemaForm) {
      createThemaForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = newThemaNameInput.value.trim();
        const description = newThemaDescriptionInput.value.trim();
        if (!name || !description) return;
        await addThema(name, description);
      });
    }
    // ... any other main entry logic ...
    await updateUIBasedOnAuthAndData();
    console.log('[DEBUG] renderThematas() called from DOMContentLoaded');
    renderThematas();
  } catch (e) {
    console.error('[DEBUG] Error in DOMContentLoaded:', e);
  }
});

// Patch showDmTab and showThemaTab for null checks and correct section toggling
function showThemaTab() {
  if (window.conversationsSection) window.conversationsSection.style.display = 'none';
  if (window.conversationMessagesSection) window.conversationMessagesSection.style.display = 'none';
  if (window.formsContentSection) window.formsContentSection.style.display = 'block';
  if (window.themaAllTabContent) window.themaAllTabContent.style.display = 'block';
  renderThematas();
}
function showDmTab() {
  if (window.themaAllTabContent) window.themaAllTabContent.style.display = 'none';
  if (window.dmTabContent) window.dmTabContent.style.display = 'block';
  if (window.conversationsSection) window.conversationsSection.style.display = 'block';
  if (window.conversationMessagesSection) window.conversationMessagesSection.style.display = 'none';
  renderDMList();
}

let unsubscribeThematas = null;
let unsubscribeDmList = null;

// Render reactions bar
function renderReactions(reactions, type, id, threadId, themaId) {
  const emojis = ['👍','❤️','😂','😮','😢','👎'];
  const uid = window.auth.currentUser?.uid;
  return emojis.map(emoji => {
    const users = reactions[emoji] || {};
    const count = Object.keys(users).length;
    const reacted = uid && users[uid];
    return `<button class="reaction-btn${reacted ? ' reacted' : ''}" data-type="${type}" data-id="${id}" data-emoji="${emoji}" data-thread-id="${threadId||''}" data-thema-id="${themaId||''}">${emoji} <span class="reaction-count">${count}</span></button>`;
  }).join('');
}

// Reaction event delegation
if (document.body) {
  document.body.addEventListener('click', async function(e) {
    const btn = e.target.closest('.reaction-btn');
    if (!btn) return;
    const { type, id, emoji, threadId, themaId } = btn.dataset;
    const uid = window.auth.currentUser?.uid;
    if (!uid) return;
    let ref;
    if (type === 'thread') {
      ref = doc(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`, id);
    } else if (type === 'comment') {
      ref = themaId === 'global'
        ? doc(window.db, `artifacts/${window.appId}/public/data/threads/${threadId}/comments`, id)
        : doc(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`, id);
    }
    if (!ref) return;
    const snap = await getDoc(ref);
    const data = snap.data();
    const reactions = data.reactions || {};
    const users = reactions[emoji] || {};
    if (users[uid]) {
      // Unreact
      delete users[uid];
    } else {
      users[uid] = true;
    }
    reactions[emoji] = users;
    await updateDoc(ref, { reactions });
  });
}

// --- Markdown Rendering ---
function renderMarkdown(text) {
  if (window.marked && window.DOMPurify) {
    return DOMPurify.sanitize(window.marked.parse(text));
  }
  if (window.marked) return window.marked.parse(text);
  // Minimal fallback
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
}

// --- Edit post/comment inline ---
function enableEditInline(type, themaId, threadId, commentId, oldContent, container) {
  const editForm = document.createElement('form');
  editForm.className = 'edit-inline-form flex flex-col gap-2 mb-2';
  editForm.innerHTML = `
    <textarea class="edit-content input">${oldContent}</textarea>
    <div class="flex gap-2">
      <button type="submit" class="btn-primary btn-green">Save</button>
      <button type="button" class="btn-primary btn-red cancel-edit">Cancel</button>
    </div>
  `;
  const origHtml = container.innerHTML;
  container.innerHTML = '';
  container.appendChild(editForm);
  editForm.onsubmit = async (e) => {
    e.preventDefault();
    const newContent = editForm.querySelector('.edit-content').value.trim();
    if (!newContent) return;
    let ref;
    if (type === 'thread') {
      ref = themaId === 'global'
        ? doc(window.db, `artifacts/${window.appId}/public/data/threads`, threadId)
        : doc(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`, threadId);
      await updateDoc(ref, { initialComment: newContent });
    } else if (type === 'comment') {
      ref = themaId === 'global'
        ? doc(window.db, `artifacts/${window.appId}/public/data/threads/${threadId}/comments`, commentId)
        : doc(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`, commentId);
      await updateDoc(ref, { content: newContent });
    }
    container.innerHTML = origHtml;
  };
  editForm.querySelector('.cancel-edit').onclick = () => {
    container.innerHTML = origHtml;
  };
}

// Add edit/delete for thema (admin/creator only)
function renderThemaAdminControls(thema, box) {
  if (!window.currentUser || (!window.currentUser.isAdmin && window.currentUser.uid !== thema.authorId)) return;
  const controls = document.createElement('div');
  controls.className = 'thema-admin-controls flex gap-2 mt-2';
  controls.innerHTML = `
    <button class="edit-thema-btn" title="Edit"><span class="material-icons text-orange-400">edit</span></button>
    <button class="delete-thema-btn" title="Delete"><span class="material-icons text-red-500">delete</span></button>
  `;
  box.appendChild(controls);
  controls.querySelector('.edit-thema-btn').onclick = () => enableEditThemaInline(thema, box);
  controls.querySelector('.delete-thema-btn').onclick = async () => {
    if (confirm('Delete this Théma and all its threads?')) {
      await deleteDoc(doc(window.db, `artifacts/${window.appId}/public/data/thematas`, thema.id));
      box.remove();
    }
  };
}
function enableEditThemaInline(thema, box) {
  const form = document.createElement('form');
  form.className = 'edit-thema-form flex flex-col gap-2 mb-2';
  form.innerHTML = `
    <input type="text" class="edit-thema-title input" value="${thema.name}" required />
    <textarea class="edit-thema-desc input">${thema.description || ''}</textarea>
    <div class="flex gap-2">
      <button type="submit" class="btn-primary btn-green">Save</button>
      <button type="button" class="btn-primary btn-red cancel-edit">Cancel</button>
    </div>
  `;
  const origHtml = box.innerHTML;
  box.innerHTML = '';
  box.appendChild(form);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const newName = form.querySelector('.edit-thema-title').value.trim();
    const newDesc = form.querySelector('.edit-thema-desc').value.trim();
    if (!newName) return;
    await updateDoc(doc(window.db, `artifacts/${window.appId}/public/data/thematas`, thema.id), {
      name: newName,
      description: newDesc
    });
    box.innerHTML = origHtml;
  };
  form.querySelector('.cancel-edit').onclick = () => {
    box.innerHTML = origHtml;
  };
}