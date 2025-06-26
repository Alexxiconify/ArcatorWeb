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

/**
 * Loads the navigation bar dynamically.
 * @param {object|null} user - The current authenticated user object, or null.
 * @param {string} defaultProfilePic - URL for the default profile picture.
 * @param {string} defaultThemeName - The default theme name.
 */
window.loadNavbar = async function(user, defaultProfilePic, defaultThemeName) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');
  console.log("Loading navbar.");

  if (navbarPlaceholder) {
    console.log("Navbar placeholder found.");
    try {
      const navbarHtml = `
        <nav class="navbar-bg p-4 shadow-lg w-full">
          <div class="container mx-auto flex justify-between items-center">
            <a href="index.html" class="text-gray-50 text-2xl font-bold">Arcator.co.uk</a>
            <div class="flex items-center space-x-4">
              <a href="users.html" id="navbar-user-settings-link" class="flex items-center text-gray-300 hover:text-gray-50 px-3 py-2 rounded-md text-lg font-medium" style="display: ${user ? 'flex' : 'none'};">
                <img id="navbar-user-icon" src="${user && user.photoURL ? user.photoURL : defaultProfilePic}" alt="User Icon" class="w-8 h-8 rounded-full mr-2 object-cover">
                <span id="navbar-user-display-name">${user && user.displayName ? user.displayName : 'Loading...'}</span>
                <span id="navbar-user-id-display" class="text-xs text-gray-500 ml-2">${user ? user.uid.substring(0, 6) : ''}</span>
              </a>
              <a href="users.html" id="navbar-signin-link" class="text-gray-300 hover:text-gray-50 px-3 py-2 rounded-md text-lg font-medium" style="display: ${user ? 'none' : 'flex'};">Sign In</a>
              <button id="navbar-signout-btn" class="text-gray-300 hover:text-gray-50 px-3 py-2 rounded-md text-lg font-medium" style="display: ${user ? 'flex' : 'none'};">Sign Out</button>
            </div>
          </div>
        </nav>
      `;
      navbarPlaceholder.innerHTML = navbarHtml;
      console.log("Navbar content injected.");

      const signoutButton = document.getElementById('navbar-signout-btn');
      if (signoutButton) {
        signoutButton.addEventListener('click', async () => {
          try {
            await window.auth.signOut();
            console.log("User signed out.");
            window.location.href = 'users.html';
          } catch (error) {
            console.error("Error signing out:", error);
          }
        });
        console.log("Signout button event listener attached.");
      }

      const navbarUserSettingsLink = document.getElementById('navbar-user-settings-link');
      const navbarSigninLink = document.getElementById('navbar-signin-link');
      const navbarUserIcon = document.getElementById('navbar-user-icon');
      const navbarUserDisplayName = document.getElementById('navbar-user-display-name');
      const navbarUserIdDisplay = document.getElementById('navbar-user-id-display');

      if (user) {
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'flex';
        if (navbarSigninLink) navbarSigninLink.style.display = 'none';
        if (navbarUserIcon) navbarUserIcon.src = user.photoURL || defaultProfilePic;
        if (navbarUserDisplayName) navbarUserDisplayName.textContent = user.displayName || 'Account';
        if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = user.uid ? user.uid.substring(0, 6) : '';
        console.log("Navbar UI updated for logged-in user.");
      } else {
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
        if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
        if (navbarUserIcon) navbarUserIcon.src = defaultProfilePic;
        if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Sign In';
        if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = '';
        console.log("Navbar UI updated for logged-out user.");
      }
    } catch (error) {
      console.error("Failed to load navigation bar:", error);
      const manualNavbar = `
        <nav class="navbar-bg p-4 shadow-lg w-full">
          <div class="container mx-auto flex justify-between items-center">
            <a href="index.html" class="text-gray-50 text-2xl font-bold">Arcator.co.uk</a>
            <div>
              <a href="users.html" class="text-gray-300 hover:text-gray-50 px-3 py-2 rounded-md text-lg font-medium">Sign In / Account</a>
            </div>
          </div>
        </nav>
      `;
      if (navbarPlaceholder) navbarPlaceholder.innerHTML = manualNavbar;
      console.log("Fallback manual navbar injected due to error.");
    }
  } else {
    console.error("Navbar placeholder element not found.");
  }
};


// --- Forms Page Specific Logic ---

// DOM elements - will be initialized in DOMContentLoaded
let mainLoadingSpinner;
let formsContentSection;
let mainLoginRequiredMessage;

let createThemaForm;
let newThemaNameInput;
let newThemaDescriptionInput;
let themaList;

let threadsSection;
let backToThematasBtn;
let currentThemaTitle;
let currentThemaDescription;
let createThreadForm;
let newThreadTitleInput;
let newThreadInitialCommentInput;
let threadList;

let commentsSection;
let backToThreadsBtn;
let currentThreadTitle;
let currentThreadInitialComment;
let addCommentForm;
let newCommentContentInput;
let commentList;

let currentThemaId = null;
let currentThreadId = null;
let unsubscribeThemaComments = null;
let unsubscribeThreads = null;
let unsubscribeThematas = null;

/**
 * Initializes DOM elements for the forms page.
 */
function initializeDOMElements() {
  mainLoadingSpinner = document.getElementById('loading-spinner');
  formsContentSection = document.getElementById('forms-content');
  mainLoginRequiredMessage = document.getElementById('login-required-message');

  createThemaForm = document.getElementById('create-thema-form');
  newThemaNameInput = document.getElementById('new-thema-name');
  newThemaDescriptionInput = document.getElementById('new-thema-description');
  themaList = document.getElementById('thema-list');

  threadsSection = document.getElementById('threads-section');
  backToThematasBtn = document.getElementById('back-to-thematas-btn');
  currentThemaTitle = document.getElementById('current-thema-title');
  currentThemaDescription = document.getElementById('current-thema-description');
  createThreadForm = document.getElementById('create-thread-form');
  newThreadTitleInput = document.getElementById('new-thread-title');
  newThreadInitialCommentInput = document.getElementById('new-thread-initial-comment');
  threadList = document.getElementById('thread-list');

  commentsSection = document.getElementById('comments-section');
  backToThreadsBtn = document.getElementById('back-to-threads-btn');
  currentThreadTitle = document.getElementById('current-thread-title');
  currentThreadInitialComment = document.getElementById('current-thread-initial-comment');
  addCommentForm = document.getElementById('add-comment-form');
  newCommentContentInput = document.getElementById('new-comment-content');
  commentList = document.getElementById('comment-list');

  console.log("DOM elements initialized.");
}

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
 */
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
    console.log("New théma added.");
  } catch (error) {
    console.error("Error creating théma:", error);
    showMessageBox(`Error creating théma: ${error.message}`, true);
  }
}

/**
 * Renders thémata from Firestore in real-time.
 */
function renderThematas() {
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
    console.log("onSnapshot callback fired for thematas. Changes:", snapshot.docChanges().length);
    themaList.innerHTML = '';
    if (snapshot.empty) {
      themaList.innerHTML = '<li class="card p-4 text-center">No thémata found. Be the first to create one!</li>';
      return;
    }

    const createdByUids = new Set();
    snapshot.forEach(doc => {
      const thema = doc.data();
      if (thema.createdBy) {
        createdByUids.add(thema.createdBy);
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
      }).catch(error => console.error("Error fetching user profiles for thematas:", error));
    }

    snapshot.forEach((doc) => {
      const thema = doc.data();
      const li = document.createElement('li');
      li.classList.add('thema-item', 'card');
      const createdAt = thema.createdAt ? new Date(thema.createdAt.toDate()).toLocaleString() : 'N/A';
      const creatorDisplayName = userProfiles[thema.createdBy] || thema.creatorDisplayName || 'Unknown';

      li.innerHTML = `
            <h3 class="text-xl font-bold text-heading-card">${thema.name}</h3>
            <p class="thema-description mt-2">${thema.description}</p>
            <p class="meta-info">Created by ${creatorDisplayName} on ${createdAt}</p>
            <button data-thema-id="${doc.id}" data-thema-name="${thema.name}" data-thema-description="${thema.description}" class="view-threads-btn btn-primary btn-blue mt-4">View Threads</button>
            ${(window.currentUser && window.currentUser.isAdmin) ? `<button data-thema-id="${doc.id}" class="delete-thema-btn btn-primary btn-red ml-2 mt-4">Delete</button>` : ''}
        `;
      themaList.appendChild(li);
    });

    document.querySelectorAll('.view-threads-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        const themaId = event.target.dataset.themaId;
        const themaName = event.target.dataset.themaName;
        const themaDescription = event.target.dataset.themaDescription;
        console.log(`View Threads clicked for themaId: ${themaId}`);
        displayThreadsForThema(themaId, themaName, themaDescription);
      });
    });

    document.querySelectorAll('.delete-thema-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const themaId = event.target.dataset.themaId;
        console.log(`Delete Théma clicked for themaId: ${themaId}`);
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
    const threadsCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads`);
    await addDoc(threadsCol, {
      title: title,
      initialComment: initialComment,
      createdAt: serverTimestamp(),
      createdBy: window.auth.currentUser.uid,
      creatorDisplayName: window.currentUser ? window.currentUser.displayName : 'Anonymous'
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

/**
 * Renders comment threads for the current thema in real-time.
 */
function renderThreads() {
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
    console.log("onSnapshot callback fired for threads. Changes:", snapshot.docChanges().length);
    threadList.innerHTML = '';
    if (snapshot.empty) {
      threadList.innerHTML = '<li class="card p-4 text-center">No threads yet. Be the first to start one!</li>';
      return;
    }

    const threadCreatedByUids = new Set();
    snapshot.forEach(doc => {
      const thread = doc.data();
      if (thread.createdBy) {
        threadCreatedByUids.add(thread.createdBy);
      }
    });

    const threadUserProfiles = {};
    if (threadCreatedByUids.size > 0) {
      const usersRef = collection(window.db, `artifacts/${window.appId}/public/data/user_profiles`);
      const threadUserQuery = query(usersRef, where('uid', 'in', Array.from(threadCreatedByUids)));
      await getDocs(threadUserQuery).then(userSnapshot => {
        userSnapshot.forEach(userDoc => {
          const userData = userDoc.data();
          threadUserProfiles[userDoc.id] = userData.displayName || 'Unknown User';
        });
      }).catch(error => console.error("Error fetching user profiles for threads:", error));
    }

    snapshot.forEach((doc) => {
      const thread = doc.data();
      const li = document.createElement('li');
      li.classList.add('thread-item', 'card');
      const createdAt = thread.createdAt ? new Date(thread.createdAt.toDate()).toLocaleString() : 'N/A';
      const creatorDisplayName = threadUserProfiles[thread.createdBy] || thread.creatorDisplayName || 'Unknown';

      li.innerHTML = `
        <h3 class="text-xl font-bold text-heading-card">${thread.title}</h3>
        <p class="thread-initial-comment mt-2">${thread.initialComment}</p>
        <p class="meta-info">Started by ${creatorDisplayName} on ${createdAt}</p>
        <button data-thread-id="${doc.id}" data-thread-title="${thread.title}" data-thread-initial-comment="${thread.initialComment}" class="view-comments-btn btn-primary btn-green mt-4">View Comments</button>
        ${(window.currentUser && window.currentUser.isAdmin) ? `<button data-thread-id="${doc.id}" class="delete-thread-btn btn-primary btn-red ml-2 mt-4">Delete</button>` : ''}
      `;
      threadList.appendChild(li);
    });

    document.querySelectorAll('.view-comments-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        const threadId = event.target.dataset.threadId;
        const threadTitle = event.target.dataset.threadTitle;
        const threadInitialComment = event.target.dataset.threadInitialComment;
        console.log(`View Comments clicked for threadId: ${threadId}`);
        displayCommentsForThread(threadId, threadTitle, threadInitialComment);
      });
    });

    document.querySelectorAll('.delete-thread-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const threadId = event.target.dataset.threadId;
        console.log(`Delete Thread clicked for threadId: ${threadId}`);
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
    const commentsCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`);
    await addDoc(commentsCol, {
      content: content,
      createdAt: serverTimestamp(),
      createdBy: window.auth.currentUser.uid,
      creatorDisplayName: window.currentUser ? window.currentUser.displayName : 'Anonymous'
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
      const displayName = commentUserProfiles[comment.createdBy] || comment.creatorDisplayName || 'Unknown User';

      li.innerHTML = `
        <p class="comment-content">${comment.content}</p>
        <p class="meta-info">By ${displayName} on ${createdAt}
        ${(window.currentUser && window.currentUser.isAdmin) ? `<button data-comment-id="${doc.id}" class="delete-comment-btn btn-primary btn-red ml-2 text-xs">Delete</button>` : ''}
        </p>
      `;
      commentList.appendChild(li);
    });

    document.querySelectorAll('.delete-comment-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const commentId = event.target.dataset.commentId;
        console.log(`Delete Comment clicked for commentId: ${commentId}`);
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
 * Deletes a comment from Firestore.
 * @param {string} themaId - The ID of the parent thema.
 * @param {string} threadId - The ID of the parent thread.
 * @param {string} commentId - The ID of the comment to delete.
 */
async function deleteComment(themaId, threadId, commentId) {
  try {
    console.log(`Deleting comment: ${commentId}`);
    await deleteDoc(doc(window.db, `artifacts/${window.appId}/public/data/thematas/${themaId}/threads/${threadId}/comments`, commentId));
    showMessageBox("Comment deleted successfully!", false);
    console.log(`Comment ${commentId} deleted.`);
  } catch (error) {
    console.error("Error deleting comment:", error);
    showMessageBox(`Error deleting comment: ${error.message}`, true);
  }
}


// --- Event Listeners and Initial Load ---
document.addEventListener('DOMContentLoaded', async function() {
  console.log("Initializing forms page.");
  
  // Initialize DOM elements first
  initializeDOMElements();
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
    await window.loadNavbar(window.auth.currentUser, window.DEFAULT_PROFILE_PIC, window.DEFAULT_THEME_NAME);
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

  if (createThreadForm && newThreadTitleInput && newThreadInitialCommentInput) {
    createThreadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      console.log("Create Thread form submitted.");
      const title = newThreadTitleInput.value.trim();
      const initialComment = newThreadInitialCommentInput.value.trim();
      if (currentThemaId && title && initialComment) {
        await addCommentThread(currentThemaId, title, initialComment);
      } else {
        showMessageBox("Please fill in both Thread Title and Initial Comment.", true);
        console.log("Missing title or initial comment.");
      }
    });
    console.log("Create Thread form listener attached.");
  } else {
    console.warn("Create thread form elements not found.");
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
});
