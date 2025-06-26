// forms.js: Consolidates all JavaScript for the Forms page, including Firebase init,
// utility functions, theme management, navbar loading, and specific forms page logic.

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
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Global Firebase Instances and Constants (formerly in firebase-init.js) ---
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

window.app;
window.auth;
window.db;
window.currentUser = null;

window.DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
window.DEFAULT_THEME_NAME = 'dark';
window.ADMIN_UIDS = ['uOaZ8v76y2Q0X7PzJtU7Y3A2C1B4'];

let firebaseReadyResolve;
window.firebaseReadyPromise = new Promise((resolve) => {
  firebaseReadyResolve = resolve;
});

// Re-enabled: getUserProfileFromFirestore for full functionality
window.getUserProfileFromFirestore = async function(uid) {
  await window.firebaseReadyPromise;
  if (!window.db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore.");
    return null;
  }
  const userDocRef = doc(window.db, `artifacts/${window.appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return { uid: docSnap.id, ...docSnap.data() };
    }
  } catch (error) {
    console.error("Error fetching user profile from Firestore:", error);
  }
  return null;
};

// Re-enabled: setUserProfileInFirestore
window.setUserProfileInFirestore = async function(uid, profileData) {
  await window.firebaseReadyPromise;
  if (!window.db) { console.error("Firestore DB not initialized for setUserProfileInFirestore."); return false; }
  const userDocRef = doc(window.db, `artifacts/${window.appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    if (window.currentUser && window.currentUser.uid === uid) { window.currentUser = { ...window.currentUser, ...profileData }; }
    console.log("DEBUG: User profile updated in Firestore for UID:", uid);
    return true;
  }
  catch (error) { console.error("Error updating user profile in Firestore:", error); return false; }
};

// Commented out: deleteUserProfileFromFirestore (kept for future re-enablement)
window.deleteUserProfileFromFirestore = async function(uid) {
  // console.log("DEBUG: deleteUserProfileFromFirestore commented out.");
  return false;
};

async function setupFirebaseAndUser() {
  console.log("DEBUG forms.js (setupFirebaseAndUser): Function called.");

  if (getApps().length === 0) {
    let finalFirebaseConfig = firebaseConfig;

    if (typeof __firebase_config !== 'undefined' && __firebase_config !== null) {
      if (typeof __firebase_config === 'string') {
        if (__firebase_config.trim() === '[object Object]') {
          console.warn("WARN forms.js (setupFirebaseAndUser): __firebase_config provided as literal string '[object Object]'. This is likely an error. Skipping parse.");
          finalFirebaseConfig = firebaseConfig;
        } else {
          try {
            finalFirebaseConfig = JSON.parse(__firebase_config);
            console.log("DEBUG forms.js (setupFirebaseAndUser): __firebase_config provided as string and parsed successfully.");
          } catch (e) {
            console.error("ERROR forms.js (setupFirebaseAndUser): Failed to parse __firebase_config string as JSON. Retaining hardcoded firebaseConfig.", e);
            finalFirebaseConfig = firebaseConfig;
          }
        }
      } else if (typeof __firebase_config === 'object') {
        finalFirebaseConfig = __firebase_config;
        console.log("DEBUG forms.js (setupFirebaseAndUser): __firebase_config provided as object. Using directly.");
      } else {
        console.warn("DEBUG forms.js (setupFirebaseAndUser): __firebase_config provided but not string or object. Retaining hardcoded firebaseConfig. Type:", typeof __firebase_config);
      }
    } else {
      console.log("DEBUG forms.js (setupFirebaseAndUser): __firebase_config not provided. Using hardcoded firebaseConfig.");
    }

    try {
      window.app = initializeApp(finalFirebaseConfig);
      window.auth = getAuth(window.app);
      window.db = getFirestore(window.app);
      console.log("DEBUG forms.js (setupFirebaseAndUser): Firebase initialized successfully.");

      const unsubscribe = onAuthStateChanged(window.auth, async (user) => {
        console.log("DEBUG forms.js (onAuthStateChanged): Triggered. User:", user ? user.uid : "none");
        if (user) {
          // Now properly fetch user profile
          let userProfile = await window.getUserProfileFromFirestore(user.uid);
          if (!userProfile) {
            console.log("DEBUG forms.js (onAuthStateChanged): No profile found. Creating default.");
            userProfile = {
              uid: user.uid, displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
              email: user.email || null, photoURL: user.photoURL || window.DEFAULT_PROFILE_PIC,
              createdAt: new Date(), lastLoginAt: new Date(), themePreference: window.DEFAULT_THEME_NAME,
              isAdmin: window.ADMIN_UIDS.includes(user.uid)
            };
            await window.setUserProfileInFirestore(user.uid, userProfile);
          } else {
            await window.setUserProfileInFirestore(user.uid, { lastLoginAt: new Date(), isAdmin: window.ADMIN_UIDS.includes(user.uid) });
            userProfile.isAdmin = window.ADMIN_UIDS.includes(user.uid); // Ensure isAdmin is updated
          }
          window.currentUser = userProfile;
          console.log("DEBUG forms.js (onAuthStateChanged): currentUser set:", window.currentUser);
        } else {
          console.log("DEBUG forms.js (onAuthStateChanged): User logged out. currentUser set to null.");
          window.currentUser = null;
        }
        firebaseReadyResolve();
        unsubscribe(); // Unsubscribe after initial state received
      });

      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        console.log("DEBUG forms.js (setupFirebaseAndUser): Attempting to sign in with custom token.");
        await signInWithCustomToken(window.auth, __initial_auth_token)
          .then(() => console.log("DEBUG forms.js (setupFirebaseAndUser): Signed in with custom token."))
          .catch((error) => {
            console.error("ERROR forms.js (setupFirebaseAndUser): Custom token sign-in failed:", error);
          });
      } else {
        console.log("DEBUG forms.js (setupFirebaseAndUser): __initial_auth_token not defined. Relying on platform for initial auth state.");
      }
    } catch (e) {
      console.error("ERROR forms.js (setupFirebaseAndUser): Error initializing Firebase:", e);
      firebaseReadyResolve();
    }
  } else {
    window.app = getApp();
    window.db = getFirestore(window.app);
    window.auth = getAuth(window.app);
    console.log("DEBUG forms.js (setupFirebaseAndUser): Firebase app already initialized. Re-using existing instance.");
    firebaseReadyResolve();
  }
}
setupFirebaseAndUser();

// --- Utility Functions (formerly in utils.js) ---
const messageBox = document.getElementById('message-box');
let messageBoxTimeout;

function showMessageBox(message, isError = false) {
  if (!messageBox) {
    console.error("Message box element not found. Cannot show message.");
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

// Re-enabled: sanitizeHandle
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

// Re-enabled: showCustomConfirm
function showCustomConfirm(message, submessage = '') {
  if (!customConfirmModal || !confirmMessage || !confirmYesButton || !confirmNoButton || !closeButton) {
    console.error("Custom confirmation modal elements not found. Cannot show confirm dialog.");
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
    console.log("DEBUG forms.js (DOMContentLoaded, utils part): custom-confirm-modal element found.");
    if (customConfirmModal.style.display === '' || customConfirmModal.style.display === 'block') {
      customConfirmModal.style.display = 'none';
      console.log("DEBUG forms.js (DOMContentLoaded, utils part): custom-confirm-modal forcibly hidden.");
    }
  }
});


// --- Theme Management Functions (formerly in themes.js) ---
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

window.setupThemesFirebase = function(dbInstance, authInstance, appIdInstance) {
  _db = dbInstance;
  _auth = authInstance;
  _appId = appIdInstance;
  _themeSelect = document.getElementById('theme-select');
  console.log("DEBUG forms.js (setupThemesFirebase): Themes Firebase setup complete.");
};

// Re-enabled: fetchCustomThemes
async function fetchCustomThemes() {
  if (!_db || !_auth || !_auth.currentUser) {
    console.log("DEBUG forms.js (fetchCustomThemes): Not fetching custom themes - DB not ready or user not logged in.");
    return [];
  }
  const userId = _auth.currentUser.uid;
  const customThemesColRef = collection(_db, `artifacts/${_appId}/users/${userId}/custom_themes`);
  try {
    const querySnapshot = await getDocs(customThemesColRef);
    const customThemes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("DEBUG forms.js (fetchCustomThemes): Fetched custom themes:", customThemes.length);
    return customThemes;
  } catch (error) {
    console.error("ERROR forms.js (fetchCustomThemes): Error fetching custom themes:", error);
    return [];
  }
}

// Re-enabled: saveCustomTheme
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
    console.log("DEBUG forms.js (saveCustomTheme): Theme saved for user.", theme.id);
    return true;
  } catch (error) {
    console.error("ERROR forms.js (saveCustomTheme): Error saving custom theme:", error);
    showMessageBox("Failed to save theme.", true);
    return false;
  }
}

// Re-enabled: deleteCustomTheme
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
    console.log("DEBUG forms.js (deleteCustomTheme): Theme deleted.", themeId);
    return true;
  } catch (error) {
    console.error("ERROR forms.js (deleteCustomTheme): Error deleting custom theme:", error);
    showMessageBox("Failed to delete theme.", true);
    return false;
  }
}

window.applyTheme = async function(themeId, themeObject = null) {
  let themeToApply = themeObject;
  if (!themeToApply) {
    _allThemes = [...predefinedThemes, ...(await fetchCustomThemes())]; // Re-enabled fetching custom themes
    themeToApply = _allThemes.find(t => t.id === themeId);
  }
  if (!themeToApply) {
    console.warn(`WARN forms.js (applyTheme): Theme '${themeId}' not found. Applying default theme.`);
    themeToApply = predefinedThemes.find(t => t.id === window.DEFAULT_THEME_NAME) || predefinedThemes[0];
  }
  if (themeToApply && themeToApply.variables) {
    for (const [key, value] of Object.entries(themeToApply.variables)) {
      document.documentElement.style.setProperty(key, value);
    }
    console.log(`DEBUG forms.js (applyTheme): Applied theme: ${themeToApply.name} (${themeToApply.id})`);
  } else {
    console.error(`ERROR forms.js (applyTheme): Failed to apply theme: ${themeId}. Variables not found.`);
  }
};

// Re-enabled: populateThemeSelect
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
    console.log("DEBUG forms.js (populateThemeSelect): Theme select populated with", _allThemes.length, "themes.");
  } else {
    console.log("DEBUG forms.js (populateThemeSelect): Theme select element not found.");
  }
}

window.getAvailableThemes = async function() {
  if (_allThemes.length === 0) { await populateThemeSelect(); } // Re-enabled populateThemeSelect call
  return _allThemes;
};

// --- Navbar Loading Function (formerly in navbar.js) ---
window.loadNavbar = async function(user, defaultProfilePic, defaultThemeName) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');
  console.log("DEBUG forms.js (loadNavbar): Function called.");

  if (navbarPlaceholder) {
    console.log("DEBUG forms.js (loadNavbar): 'navbar-placeholder' element found.");
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
      console.log("DEBUG forms.js (loadNavbar): 'navbar.html' content injected successfully.");

      const signoutButton = document.getElementById('navbar-signout-btn');
      if (signoutButton) {
        signoutButton.addEventListener('click', async () => {
          try {
            await window.auth.signOut();
            console.log("DEBUG forms.js (navbar signout): User signed out.");
            window.location.href = 'users.html'; // Changed to users.html
          } catch (error) {
            console.error("ERROR forms.js (navbar signout): Error signing out:", error);
          }
        });
        console.log("DEBUG forms.js (loadNavbar): Signout button event listener attached.");
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
        console.log("DEBUG forms.js (loadNavbar): Navbar UI updated for logged-in user.");
      } else {
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
        if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
        if (navbarUserIcon) navbarUserIcon.src = defaultProfilePic;
        if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Sign In';
        if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = '';
        console.log("DEBUG forms.js (loadNavbar): Navbar UI updated for logged-out user.");
      }
    } catch (error) {
      console.error("ERROR forms.js (loadNavbar): Failed to load navigation bar:", error);
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
      console.log("DEBUG forms.js (loadNavbar): Fallback manual navbar injected due to error.");
    }
  } else {
    console.error("ERROR forms.js (loadNavbar): Navbar placeholder element not found.");
  }
};


// --- Forms Page Specific Logic ---

// DOM elements
const mainLoadingSpinner = document.getElementById('loading-spinner');
const formsContentSection = document.getElementById('forms-content');
const mainLoginRequiredMessage = document.getElementById('login-required-message');

// Re-enabled: createThemaForm and related inputs
const createThemaForm = document.getElementById('create-thema-form');
const newThemaNameInput = document.getElementById('new-thema-name');
const newThemaDescriptionInput = document.getElementById('new-thema-description');
const themaList = document.getElementById('thema-list');

// Commented out: threadsSection and related elements (for now)
const threadsSection = document.getElementById('threads-section');
const backToThematasBtn = document.getElementById('back-to-thematas-btn');
const currentThemaTitle = document.getElementById('current-thema-title');
const currentThemaDescription = document.getElementById('current-thema-description');
const createThreadForm = null; // document.getElementById('create-thread-form');
const newThreadTitleInput = null; // document.getElementById('new-thread-title');
const newThreadInitialCommentInput = null; // document.getElementById('new-thread-initial-comment');
const threadList = document.getElementById('thread-list');

// Commented out: commentsSection and related elements (for now)
const commentsSection = document.getElementById('comments-section');
const backToThreadsBtn = document.getElementById('back-to-threads-btn');
const currentThreadTitle = document.getElementById('current-thread-title');
const currentThreadInitialComment = document.getElementById('current-thread-initial-comment');
const addCommentForm = null; // document.getElementById('add-comment-form');
const newCommentContentInput = null; // document.getElementById('new-comment-content');
const commentList = document.getElementById('comment-list');

let currentThemaId = null;
let currentThreadId = null;
let unsubscribeThemaComments = null;
let unsubscribeThreads = null;
let unsubscribeThematas = null;

function showMainLoading() {
  if (mainLoadingSpinner) mainLoadingSpinner.style.display = 'flex';
  if (formsContentSection) formsContentSection.style.display = 'none';
  if (mainLoginRequiredMessage) mainLoginRequiredMessage.style.display = 'none';
  console.log("DEBUG forms.js (showMainLoading): Spinner visible, content hidden.");
}

function hideMainLoading() {
  if (mainLoadingSpinner) mainLoadingSpinner.style.display = 'none';
  console.log("DEBUG forms.js (hideMainLoading): Spinner hidden.");
}

async function updateUIBasedOnAuthAndData() {
  console.log("DEBUG forms.js (updateUIBasedOnAuthAndData): Called.");
  hideMainLoading();

  if (window.auth.currentUser) {
    console.log("DEBUG forms.js (updateUIBasedOnAuthAndData): User is logged in.", window.auth.currentUser.uid);
    let profileReady = false;
    for (let i = 0; i < 30; i++) { // Max 3 seconds wait (30 * 100ms)
      if (window.currentUser && window.currentUser.uid === window.auth.currentUser.uid && typeof window.currentUser.displayName !== 'undefined' && window.currentUser.displayName !== null) {
        profileReady = true;
        console.log("DEBUG forms.js (updateUIBasedOnAuthAndData): currentUser profile ready after", i * 100, "ms.");
        break;
      }
      console.log("DEBUG forms.js (updateUIBasedOnAuthAndData): Waiting for currentUser to be set. Attempt:", i + 1);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
    }

    if (profileReady) {
      if (formsContentSection) formsContentSection.style.display = 'block';
      if (mainLoginRequiredMessage) mainLoginRequiredMessage.style.display = 'none';
      console.log("DEBUG forms.js (updateUIBasedOnAuthAndData): Forms content visible, login message hidden.");
      renderThematas(); // Re-enabled: Start real-time listening for thémata
    } else {
      console.warn("WARN forms.js (updateUIBasedOnAuthAndData): currentUser profile not fully loaded after waiting. Showing login message.");
      showMessageBox("Failed to load user profile. Please try refreshing or logging in again.", true);
      if (formsContentSection) formsContentSection.style.display = 'none';
      if (mainLoginRequiredMessage) mainLoginRequiredMessage.style.display = 'block';
    }
  } else {
    console.log("DEBUG forms.js (updateUIBasedOnAuthAndData): User is NOT logged in. Showing login message.");
    if (formsContentSection) formsContentSection.style.display = 'none';
    if (mainLoginRequiredMessage) mainLoginRequiredMessage.style.display = 'block';
  }
}

// Re-enabled: addThema
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
    console.log("DEBUG forms.js (addThema): New théma added.");
  } catch (error) {
    console.error("ERROR forms.js (addThema): Error creating théma:", error);
    showMessageBox(`Error creating théma: ${error.message}`, true);
  }
}

// Re-enabled: renderThematas
function renderThematas() {
  console.log("DEBUG forms.js (renderThematas): Called. DB:", !!window.db);
  if (unsubscribeThematas) {
    unsubscribeThematas();
    console.log("DEBUG forms.js (renderThematas): Unsubscribed from previous thémata listener.");
  }
  if (!window.db) {
    themaList.innerHTML = '<li class="card p-4 text-center text-red-400">Database not initialized. Cannot load thémata.</li>';
    return;
  }

  const thematasCol = collection(window.db, `artifacts/${window.appId}/public/data/thematas`);
  const q = query(thematasCol, orderBy("createdAt", "desc"));

  unsubscribeThematas = onSnapshot(q, (snapshot) => {
    console.log("DEBUG forms.js (renderThematas): onSnapshot callback fired. Changes:", snapshot.docChanges().length);
    themaList.innerHTML = '';
    if (snapshot.empty) {
      themaList.innerHTML = '<li class="card p-4 text-center">No thémata found. Be the first to create one!</li>';
      return;
    }

    // Fetch user profiles for display names
    const userProfilePromises = [];
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
      userProfilePromises.push(getDocs(userQuery).then(userSnapshot => {
        userSnapshot.forEach(userDoc => {
          const userData = userDoc.data();
          userProfiles[userDoc.id] = userData.displayName || 'Unknown User';
        });
      }).catch(error => console.error("Error fetching user profiles for thematas:", error)));
    }

    Promise.all(userProfilePromises).then(() => {
      snapshot.forEach((doc) => {
        const thema = doc.data();
        const li = document.createElement('li');
        li.classList.add('thema-item', 'card');
        const createdAt = thema.createdAt ? new Date(thema.createdAt.toDate()).toLocaleString() : 'N/A';
        const creatorDisplayName = userProfiles[thema.createdBy] || thema.creatorDisplayName || 'Unknown'; // Prioritize fetched display name

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
          console.log(`DEBUG forms.js (renderThematas): View Threads clicked for themaId: ${themaId}`);
          displayThreadsForThema(themaId, themaName, themaDescription);
        });
      });

      document.querySelectorAll('.delete-thema-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
          const themaId = event.target.dataset.themaId;
          console.log(`DEBUG forms.js (renderThematas): Delete Théma clicked for themaId: ${themaId}`);
          const confirmed = await showCustomConfirm("Are you sure you want to delete this théma?", "All threads and comments within it will also be deleted.");
          if (confirmed) {
            await deleteThemaAndSubcollections(themaId);
          } else {
            showMessageBox("Théma deletion cancelled.", false);
          }
        });
      });
    });
  }, (error) => {
    console.error("ERROR forms.js (renderThematas): Error fetching thémata:", error);
    themaList.innerHTML = `<li class="card p-4 text-center text-red-400">Error loading thémata: ${error.message}</li>`;
  });
}

// Re-enabled: deleteThemaAndSubcollections
async function deleteThemaAndSubcollections(themaId) {
  try {
    console.log(`DEBUG forms.js (deleteThemaAndSubcollections): Deleting thema: ${themaId}`);
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
    console.log(`DEBUG forms.js (deleteThemaAndSubcollections): Thema ${themaId} and all content deleted.`);
  } catch (error) {
    console.error("ERROR forms.js (deleteThemaAndSubcollections): Error deleting théma and subcollections:", error);
    showMessageBox(`Error deleting théma: ${error.message}`, true);
  }
}


// Commented out: displayThreadsForThema (for now)
function displayThreadsForThema(themaId, themaName, themaDescription) {
  console.log("DEBUG: displayThreadsForThema commented out.");
  if (threadsSection) threadsSection.style.display = 'none';
  showMessageBox("Thread display functionality is currently disabled.", true);
}

// Commented out: addCommentThread (for now)
// async function addCommentThread(themaId, title, initialComment) {
//   console.log("DEBUG: addCommentThread commented out.");
// }

// Commented out: renderThreads (for now)
function renderThreads() {
  console.log("DEBUG: renderThreads commented out.");
  if (threadList) {
    threadList.innerHTML = '<li class="card p-4 text-center">Thread loading functionality is currently disabled.</li>';
  }
}

// Commented out: deleteThreadAndSubcollection (for now)
// async function deleteThreadAndSubcollection(themaId, threadId) {
//     console.log("DEBUG: deleteThreadAndSubcollection commented out.");
// }


// Commented out: displayCommentsForThread (for now)
function displayCommentsForThread(threadId, threadTitle, threadInitialComment) {
  console.log("DEBUG: displayCommentsForThread commented out.");
  if (commentsSection) commentsSection.style.display = 'none';
  showMessageBox("Comment display functionality is currently disabled.", true);
}

// Commented out: addComment (for now)
// async function addComment(themaId, threadId, content) {
//   console.log("DEBUG: addComment commented out.");
// }

// Commented out: renderComments (for now)
function renderComments() {
  console.log("DEBUG: renderComments commented out.");
  if (commentList) {
    commentList.innerHTML = '<li class="card p-4 text-center">Comment loading functionality is currently disabled.</li>';
  }
}

// Commented out: deleteComment (for now)
// async function deleteComment(themaId, threadId, commentId) {
//     console.log("DEBUG: deleteComment commented out.");
// }


// --- Event Listeners and Initial Load ---
document.addEventListener('DOMContentLoaded', async function() {
  console.log("DEBUG forms.js (DOMContentLoaded listener): Initializing page.");
  showMainLoading(); // Show spinner immediately

  await window.firebaseReadyPromise;
  console.log("DEBUG forms.js (DOMContentLoaded listener): Firebase ready. Current User:", window.auth.currentUser ? window.auth.currentUser.uid : "None");

  window.setupThemesFirebase(window.db, window.auth, window.appId);
  console.log("DEBUG forms.js (DOMContentLoaded listener): Themes setup complete.");

  // Load the navbar - this should happen regardless of auth state
  await window.loadNavbar(window.auth.currentUser, window.DEFAULT_PROFILE_PIC, window.DEFAULT_THEME_NAME);
  console.log("DEBUG forms.js (DOMContentLoaded listener): Navbar loaded.");

  // Apply theme based on user preference or default
  let userThemePreference = window.DEFAULT_THEME_NAME;
  // Simplified for testing:
  if (window.currentUser && window.currentUser.themePreference) {
    userThemePreference = window.currentUser.themePreference;
  }
  const allThemes = await window.getAvailableThemes(); // This will now only return predefined themes
  const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === window.DEFAULT_THEME_NAME);
  window.applyTheme(themeToApply.id, themeToApply);
  console.log("DEBUG forms.js (DOMContentLoaded listener): Theme applied.");

  // This onAuthStateChanged ensures the UI reacts to login/logout events *after* initial load
  // and triggers content loading based on authentication.
  onAuthStateChanged(window.auth, (user) => {
    console.log("DEBUG forms.js (onAuthStateChanged listener at end of DOMContentLoaded): User state changed. User:", user ? user.uid : "None");
    updateUIBasedOnAuthAndData(); // Update UI and load content based on new auth state
  });

  // Set current year for footer
  const currentYearElement = document.getElementById('current-year-forms');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
    console.log("DEBUG forms.js (DOMContentLoaded listener): Footer year set.");
  }

  // Re-enabled: Théma Form Submission
  createThemaForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    console.log("DEBUG forms.js (createThemaForm submit): Form submitted.");
    const name = newThemaNameInput.value.trim();
    const description = newThemaDescriptionInput.value.trim();
    if (name && description) {
      await addThema(name, description);
    } else {
      showMessageBox("Please fill in both Théma Name and Description.", true);
      console.log("DEBUG forms.js (createThemaForm submit): Missing name or description.");
    }
  });
  console.log("DEBUG forms.js (DOMContentLoaded listener): Create Théma form listener attached.");


  // Commented out: Back to Thémata button listener (for now, as threads are disabled)
  backToThematasBtn?.addEventListener('click', () => {
    console.log("DEBUG forms.js (backToThematasBtn click): Back to Thémata button clicked - commented out.");
    showMessageBox("Navigation to thémata is disabled for testing.", true);
  });
  // console.log("DEBUG forms.js (DOMContentLoaded listener): Back to Thémata button listener (commented out).");

  // Commented out: Thread Form Submission (for now)
  // createThreadForm?.addEventListener('submit', async (event) => {
  //   event.preventDefault();
  //   console.log("DEBUG forms.js (createThreadForm submit): Form submitted - commented out.");
  //   showMessageBox("Creating threads is disabled for testing.", true);
  // });
  // console.log("DEBUG forms.js (DOMContentLoaded listener): Create Thread form listener (commented out).");


  // Commented out: Back to Threads button listener (for now)
  backToThreadsBtn?.addEventListener('click', () => {
    console.log("DEBUG forms.js (backToThreadsBtn click): Back to Threads button clicked - commented out.");
    showMessageBox("Navigation to threads is disabled for testing.", true);
  });
  // console.log("DEBUG forms.js (DOMContentLoaded listener): Back to Threads button listener (commented out).");


  // Commented out: Comment Form Submission (for now)
  // addCommentForm?.addEventListener('submit', async (event) => {
  //   event.preventDefault();
  //   console.log("DEBUG forms.js (addCommentForm submit): Form submitted - commented out.");
  //   showMessageBox("Adding comments is disabled for testing.", true);
  // });
  // console.log("DEBUG forms.js (DOMContentLoaded listener): Add Comment form listener (commented out).");
});
