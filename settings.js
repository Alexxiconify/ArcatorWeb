// settings.js: Combined file for debugging purposes.
// It merges logic from settings.js, firebase-init.js, utils.js, themes.js, and navbar.js.
// Not recommended for production due to lack of modularity and potential for large file size.

// --- Firebase SDK Imports (External - remain unchanged) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { EmailAuthProvider, updatePassword, reauthenticateWithCredential, deleteUser, updateProfile, onAuthStateChanged, getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- Global Firebase Configuration & Instances (from firebase-init.js) ---
// Define a default Firebase config (this will be used if __firebase_config is not provided)
// This is the configuration provided by the user in the latest prompt.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  databaseURL: "https://arcator-web-default-rtdb.firebaseio.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app",
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM"
};

const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : null;
const tempProjectId = "arcator-web"; // Fallback for testing if __app_id is not set.
const appId = canvasAppId || tempProjectId || 'default-app-id';

let app;
let auth;
let db;
let currentUser = null;

const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV'; // Reliable placeholder
const DEFAULT_THEME_NAME = 'dark';
const ADMIN_UIDS = ['uOaZ8v76y2Q0X7PzJtU7Y3A2C1B4'];

let firebaseReadyResolve;
// `firebaseReadyPromise` is now resolved inside onAuthStateChanged to ensure `auth.currentUser` is set.
const firebaseReadyPromise = new Promise(resolve => {
  firebaseReadyResolve = resolve;
});

/**
 * Retrieves a user's profile from the 'user_profiles' collection in Firestore.
 */
async function getUserProfileFromFirestore(uid) {
  await firebaseReadyPromise; // Ensure Firebase is fully initialized and auth state is determined
  if (!db) { console.error("Firestore DB not initialized for getUserProfileFromFirestore."); return null; }
  if (currentUser && currentUser.uid === uid) { return currentUser; } // Return cached if current user

  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) { return { uid: docSnap.id, ...docSnap.data() }; }
    else { console.log("No such user profile in Firestore for UID:", uid); return null; }
  } catch (error) { console.error("Error getting user profile from Firestore:", error); return null; }
}

/**
 * Sets or updates a user's profile in the 'user_profiles' collection in Firestore.
 */
async function setUserProfileInFirestore(uid, profileData) {
  await firebaseReadyPromise; // Ensure Firebase is fully initialized and auth state is determined
  if (!db) { console.error("Firestore DB not initialized for setUserProfileInFirestore."); return false; }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    if (currentUser && currentUser.uid === uid) { currentUser = { ...currentUser, ...profileData }; }
    console.log("DEBUG: User profile updated in Firestore for UID:", uid);
    return true;
  } catch (error) { console.error("Error updating user profile in Firestore:", error); return false; }
}

/**
 * Deletes a user's profile from the 'user_profiles' collection in Firestore.
 */
async function deleteUserProfileFromFirestore(uid) {
  await firebaseReadyPromise; // Ensure Firebase is fully initialized and auth state is determined
  if (!db) { console.error("Firestore DB not initialized for deleteUserProfileFromFirestore."); return false; }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await deleteDoc(userDocRef);
    console.log("DEBUG: User profile deleted from Firestore for UID:", uid);
    return true;
  } catch (error) { console.error("Error deleting user profile from Firestore:", error); return false; }
}

/**
 * Initializes Firebase, sets up authentication, and resolves firebaseReadyPromise.
 */
async function setupFirebaseAndUser() {
  console.log("DEBUG: setupFirebaseAndUser called.");

  // Only initialize app if it hasn't been already
  if (app) { // If app is already initialized, just ensure promise resolves and return.
    console.log("DEBUG: Firebase app already initialized. Skipping initialization.");
    firebaseReadyResolve();
    return;
  }

  let finalFirebaseConfig = DEFAULT_FIREBASE_CONFIG; // Start with the provided default config

  // Check if Canvas environment provides its config
  if (typeof __firebase_config !== 'undefined' && __firebase_config !== null) {
    if (typeof __firebase_config === 'string') {
      try {
        finalFirebaseConfig = JSON.parse(__firebase_config);
        console.log("DEBUG: __firebase_config provided as string and parsed successfully.");
      } catch (e) {
        console.error("ERROR: Failed to parse __firebase_config string as JSON. Using provided DEFAULT_FIREBASE_CONFIG.", e);
        // Fallback to DEFAULT_FIREBASE_CONFIG if parsing fails
      }
    } else if (typeof __firebase_config === 'object') {
      finalFirebaseConfig = __firebase_config;
      console.log("DEBUG: __firebase_config provided as object. Using directly.");
    } else {
      console.warn("DEBUG: __firebase_config provided but not string or object. Type:", typeof __firebase_config, ". Using provided DEFAULT_FIREBASE_CONFIG.");
    }
  } else {
    console.log("DEBUG: __firebase_config not provided. Using provided DEFAULT_FIREBASE_CONFIG.");
  }

  firebaseConfig = finalFirebaseConfig; // Assign the determined config to the global firebaseConfig

  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app); // Ensure auth is assigned right after getAuth(app)
    console.log("DEBUG: Firebase app, Firestore, and Auth initialized.");

    // IMPORTANT: Ensure 'auth' is defined before trying to attach a listener
    if (!auth) {
      console.error("FATAL ERROR: Firebase Auth instance is undefined after initialization.");
      firebaseReadyResolve(); // Resolve to unblock, but indicate error
      return;
    }

    // Set up Auth state observer FIRST, then attempt sign-in
    // This ensures `firebaseReadyPromise` resolves only after the initial auth state is processed.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth State Changed: User logged in:", user ? user.uid : "null");
      if (user) {
        let userProfile = await getUserProfileFromFirestore(user.uid); // Fetch profile for current user
        if (!userProfile) {
          console.log("No profile found. Creating default.");
          userProfile = {
            uid: user.uid, displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
            email: user.email || null, photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
            createdAt: new Date(), lastLoginAt: new Date(), selectedTheme: DEFAULT_THEME_NAME,
            isAdmin: ADMIN_UIDS.includes(user.uid)
          };
          await setUserProfileInFirestore(user.uid, userProfile);
        } else {
          await setUserProfileInFirestore(user.uid, { lastLoginAt: new Date(), isAdmin: ADMIN_UIDS.includes(user.uid) });
          userProfile.isAdmin = ADMIN_UIDS.includes(user.uid);
        }
        currentUser = userProfile;
        console.log("DEBUG: currentUser set:", currentUser);
      } else {
        console.log("Auth State Changed: User logged out.");
        currentUser = null;
      }
      console.log("DEBUG: firebaseReadyPromise resolving.");
      firebaseReadyResolve(); // Resolve the promise AFTER currentUser is set or confirmed null
      unsubscribe(); // Unsubscribe after the first state change to prevent multiple resolves
    });

    // Attempt sign-in with custom token or anonymously.
    // The onAuthStateChanged listener above will handle the result and resolve the promise.
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      console.log("DEBUG: Attempting to sign in with custom token.");
      await signInWithCustomToken(auth, __initial_auth_token).catch(e => {
        console.error("ERROR: Custom token sign-in failed:", e);
        // Fallback to anonymous sign-in if custom token fails, but don't re-init onAuthStateChanged
        signInAnonymously(auth).catch(anonError => console.error("ERROR: Anonymous sign-in failed:", anonError));
      });
    } else {
      console.log("DEBUG: __initial_auth_token not defined or empty. Signing in anonymously.");
      await signInAnonymously(auth).catch(e => console.error("ERROR: Anonymous sign-in failed:", e));
    }

  } catch (error) {
    console.error("FATAL ERROR: Failed to initialize Firebase or sign in:", error);
    // Resolve immediately on fatal error to unblock page load, even if auth state isn't perfect.
    firebaseReadyResolve();
  }
}

function getCurrentUser() {
  return currentUser;
}

// --- Utility Functions (from utils.js) ---
let messageBoxTimeout;

function showMessageBox(message, isError) {
  const messageBox = document.getElementById('message-box');
  if (!messageBox) { console.warn("Message box element not found."); return; }
  clearTimeout(messageBoxTimeout);
  messageBox.textContent = message;
  messageBox.className = 'message-box';
  if (isError) { messageBox.classList.add('error'); } else { messageBox.classList.add('success'); }
  messageBox.style.display = 'block';
  messageBoxTimeout = setTimeout(() => { messageBox.style.display = 'none'; }, 5000);
}

function sanitizeHandle(input) {
  return input.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}

function customConfirm(message, subMessage = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmSubMessage = document.getElementById('confirm-submessage');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');
    const closeButton = modal.querySelector('.close-button');

    if (!modal || !confirmMessage || !confirmYes || !confirmNo || !closeButton) {
      console.error("Custom confirm modal elements not found."); resolve(false); return;
    }
    confirmMessage.textContent = message;
    confirmSubMessage.textContent = subMessage;
    modal.style.display = 'flex';

    const cleanUp = () => {
      modal.style.display = 'none';
      confirmYes.removeEventListener('click', onYes);
      confirmNo.removeEventListener('click', onNo);
      closeButton.removeEventListener('click', onNo);
    };
    const onYes = () => { cleanUp(); resolve(true); };
    const onNo = () => { cleanUp(); resolve(false); };
    confirmYes.addEventListener('click', onYes);
    confirmNo.addEventListener('click', onNo);
    closeButton.addEventListener('click', onNo);
  });
}

function showCustomConfirm(message, subMessage = '') {
  console.log("DEBUG: showCustomConfirm called with message:", message);
  const customConfirmModal = document.getElementById('custom-confirm-modal');
  const confirmMessageElement = document.getElementById('confirm-message');
  const confirmSubMessageElement = document.getElementById('confirm-submessage');
  const confirmYesBtn = document.getElementById('confirm-yes');
  const confirmNoBtn = document.getElementById('confirm-no');

  if (!customConfirmModal || !confirmMessageElement || !confirmYesBtn || !confirmNoBtn) {
    console.error("Confirmation modal elements not found.");
    return Promise.resolve(window.confirm(message + (subMessage ? `\n\n${subMessage}` : '')));
  }

  confirmMessageElement.textContent = message;
  confirmSubMessageElement.textContent = subMessage;
  customConfirmModal.style.display = 'flex';

  return new Promise(resolve => {
    const cleanup = () => {
      confirmYesBtn.removeEventListener('click', onYes);
      confirmNoBtn.removeEventListener('click', onNo);
      customConfirmModal.removeEventListener('click', onClickOutside);
      customConfirmModal.style.display = 'none';
    };
    const onYes = () => { resolve(true); cleanup(); };
    const onNo = () => { resolve(false); cleanup(); };
    const onClickOutside = (event) => {
      if (event.target === customConfirmModal) { resolve(false); cleanup(); }
    };
    confirmYesBtn.addEventListener('click', onYes);
    confirmNoBtn.addEventListener('click', onNo);
    customConfirmModal.addEventListener('click', onClickOutside);
  });
}

const COMMON_EMOJIS = { like: '👍', heart: '❤️', laugh: '😂', sad: '😢', fire: '🔥' };

function parseEmojis(text) {
  let parsedText = text;
  for (const key in COMMON_EMOJIS) {
    const emojiCode = `:${key}:`;
    const emojiChar = COMMON_EMOJIS[key];
    parsedText = parsedText.split(emojiCode).join(emojiChar);
  }
  return parsedText;
}

async function parseMentions(text) {
  const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
  let parsedText = text;
  const matches = [...text.matchAll(mentionRegex)];
  parsedText = text.replace(mentionRegex, (match, handle) => {
    return `<span class="font-semibold text-link">@${handle}</span>`;
  });
  return parsedText;
}

async function resolveHandlesToUids(handles) {
  await firebaseReadyPromise;
  if (!db) { console.error("Firestore DB not initialized."); return []; }
  const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
  for (const handle of handles) {
    const q = query(userProfilesRef, where("displayName", "==", handle), limit(1));
    try {
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) { resolvedUids.push(querySnapshot.docs[0].id); }
    } catch (error) { console.error(`Error resolving handle "${handle}" to UID:`, error); }
  }
  return resolvedUids;
}

function renderReactionButtons(type, itemId, reactions, containerElement, currentUser, commentId = null) {
  if (!containerElement) { console.error("Reaction buttons container not found."); return; }
  containerElement.innerHTML = '';
  const addReactionBtn = document.createElement('button');
  addReactionBtn.classList.add('bg-input-bg', 'text-text-primary', 'py-1', 'px-2', 'rounded', 'mr-2', 'reaction-btn', 'hover:bg-input-border', 'transition-colors', 'duration-200');
  addReactionBtn.innerHTML = `<i class="fas fa-plus"></i>`;
  addReactionBtn.title = "Add Reaction";
  addReactionBtn.addEventListener('click', () => { showMessageBox("Emoji picker not implemented yet. Click existing reactions to toggle.", false); });

  for (const emoji of Object.values(COMMON_EMOJIS)) {
    const userUids = reactions[emoji] ? Object.keys(reactions[emoji]) : [];
    const count = userUids.length;
    const hasReacted = currentUser ? userUids.includes(currentUser.uid) : false;
    const button = document.createElement('button');
    button.classList.add('py-1', 'px-3', 'rounded-full', 'reaction-btn', 'flex', 'items-center', 'space-x-1', 'text-sm');
    if (hasReacted) { button.classList.add('reacted'); } else { button.classList.add('bg-input-bg', 'text-text-primary'); }
    button.innerHTML = `<span>${emoji}</span> <span class="font-bold">${count}</span>`;
    button.dataset.emoji = emoji;
    button.dataset.itemId = itemId;
    button.dataset.type = type;
    if (commentId) button.dataset.commentId = commentId;
    containerElement.appendChild(button);
  }
}


// --- Theme Management Functions (from themes.html script) ---
let availableThemesCache = null;

const PREDEFINED_THEMES = {
  'dark': {
    id: 'dark', name: 'Dark', isCustom: false, properties: {
      bodyBg: '#1F2937', textPrimary: '#E5E7EB', textSecondary: '#CBD5E0', headingMain: '#F87171', headingCard: '#60A5FA', bgNavbar: '#111827', bgContentSection: '#1F2937', bgCard: '#2D3748', bgIpBox: '#1A202C', borderIpBox: '#4A5568', inputBg: '#374151', inputText: '#E5E7EB', inputBorder: '#4B5563', placeholder: '#9CA3AF', tableThBg: '#374151', tableThText: '#F87171', tableTdBorder: '#374151', tableRowEvenBg: '#2F3B4E', link: '#60A5FA', buttonText: 'white', buttonBlueBg: '#2563EB', buttonBlueHover: '#1D4ED8', buttonRedBg: '#DC2626', buttonRedHover: '#B91C1C', buttonGreenBg: '#16A34A', buttonGreenHover: '#15803D', buttonYellowBg: '#D97706', buttonYellowHover: '#B45309', buttonPurpleBg: '#9333EA', buttonPurpleHover: '#7E22CE', buttonIndigoBg: '#4F46E5', buttonIndigoHover: '#4338CA', buttonTealBg: '#0D9488', buttonTealHover: '#0F766E', messageBoxBgSuccess: '#4CAF50', messageBoxBgError: '#F44336', modalBg: '#2D3748', modalText: '#E5E7EB', modalInputBg: '#374151', modalInputText: '#E5E7EB'
    }
  },
  'light': {
    id: 'light', name: 'Light', isCustom: false, properties: {
      bodyBg: '#F3F4F6', textPrimary: '#1F2937', textSecondary: '#4B5563', headingMain: '#DC2626', headingCard: '#2563EB', bgNavbar: '#E5E7EB', bgContentSection: '#F9FAFB', bgCard: '#FFFFFF', bgIpBox: '#E2E8F0', borderIpBox: '#CBD5E0', inputBg: '#FFFFFF', inputText: '#1F2937', inputBorder: '#D1D5DB', placeholder: '#6B7280', tableThBg: '#E0E0E0', tableThText: '#4B5563', tableTdBorder: '#E0E0E0', tableRowEvenBg: '#F0F0F0', link: '#2563EB', buttonText: 'white', buttonBlueBg: '#2563EB', buttonBlueHover: '#1D4ED8', buttonRedBg: '#DC2626', buttonRedHover: '#B91C1C', buttonGreenBg: '#16A34A', buttonGreenHover: '#15803D', buttonYellowBg: '#D97706', buttonYellowHover: '#B45309', buttonPurpleBg: '#9333EA', buttonPurpleHover: '#7E22CE', buttonIndigoBg: '#4F46E5', buttonIndigoHover: '#4338CA', buttonTealBg: '#0D9488', buttonTealHover: '#0F766E', messageBoxBgSuccess: '#4CAF50', messageBoxBgError: '#F44336', modalBg: '#FFFFFF', modalText: '#1F2937', modalInputBg: '#FFFFFF', modalInputText: '#1F2937'
    }
  },
  'arcator-blue': {
    id: 'arcator-blue', name: 'Arcator Blue', isCustom: false, properties: {
      bodyBg: '#1a202c', textPrimary: '#E2E8F0', textSecondary: '#CBD5E0', headingMain: '#FC8181', headingCard: '#63B3ED', bgNavbar: '#111827', bgContentSection: '#1a202c', bgCard: '#2b3b55', bgIpBox: '#1A253A', borderIpBox: '#3B82F6', inputBg: '#3b4d6b', inputText: '#E2E8F0', inputBorder: '#5a6e8f', placeholder: '#94A3B8', tableThBg: '#3b4d6b', tableThText: '#90CDF4', tableTdBorder: '#374151', tableRowEvenBg: '#2F3B4E', link: '#63B3ED', buttonText: 'white', buttonBlueBg: '#4299E1', buttonBlueHover: '#3182CE', buttonRedBg: '#FC8181', buttonRedHover: '#E53E3E', buttonGreenBg: '#48BB78', buttonGreenHover: '#38A169', buttonYellowBg: '#ECC94B', buttonYellowHover: '#D69E2E', buttonPurpleBg: '#9F7AEA', buttonPurpleHover: '#805AD5', buttonIndigoBg: '#4F46E5', buttonIndigoHover: '#4338CA', buttonTealBg: '#38B2AC', buttonTealHover: '#319795', messageBoxBgSuccess: '#4CAF50', messageBoxBgError: '#F44336', modalBg: '#2b3b55', modalText: '#E2E8F0', modalInputBg: '#3b4d6b', modalInputText: '#E2E8F0'
    }
  }
};

let customThemes = {};

function camelToKebab(camelCaseString) {
  return camelCaseString.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

async function fetchCustomThemes() {
  await firebaseReadyPromise;
  if (!db) { console.warn("Firestore DB not initialized."); return {}; }
  const themesCollectionRef = collection(db, `artifacts/${appId}/public/data/custom_themes`);
  const fetchedThemes = {};
  try {
    const querySnapshot = await getDocs(themesCollectionRef);
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      fetchedThemes[docSnap.id] = { id: docSnap.id, name: data.name || docSnap.id, isCustom: true, properties: data.properties || {} };
    });
    console.log("Custom themes fetched:", fetchedThemes);
  } catch (error) { console.error("Error fetching custom themes:", error); }
  return fetchedThemes;
}

async function applyTheme(themeId) {
  const allThemes = await getAvailableThemes();
  const theme = allThemes.find(t => t.id === themeId) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);

  if (theme && theme.properties) {
    console.log(`DEBUG: Applying theme: ${theme.name || theme.id}`);
    for (const [key, value] of Object.entries(theme.properties)) {
      document.documentElement.style.setProperty(`--color-${camelToKebab(key)}`, value);
    }
    document.documentElement.setAttribute('data-theme', theme.id);
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-arcator-blue');
    if (theme.id === 'dark') { document.body.classList.add('theme-dark'); }
    else if (theme.id === 'light') { document.body.classList.add('theme-light'); }
    else if (theme.id === 'arcator-blue') { document.body.classList.add('theme-arcator-blue'); }
  } else {
    console.warn(`WARN: Theme '${themeId}' not found or has no properties. Applying default.`);
    const defaultTheme = allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    if (defaultTheme && defaultTheme.properties) {
      for (const [key, value] of Object.entries(defaultTheme.properties)) {
        document.documentElement.style.setProperty(`--color-${camelToKebab(key)}`, value);
      }
      document.documentElement.setAttribute('data-theme', defaultTheme.id);
      document.body.classList.remove('theme-dark', 'theme-light', 'theme-arcator-blue');
      document.body.classList.add(`theme-${defaultTheme.id}`);
    } else { console.error("ERROR: Default theme not found or malformed. CSS variables might not be set."); }
  }
}

async function getAvailableThemes() {
  if (Object.keys(customThemes).length === 0) {
    customThemes = await fetchCustomThemes();
  }
  return [...Object.values(PREDEFINED_THEMES), ...Object.values(customThemes)];
}

function setupThemesFirebase() {
  console.log("DEBUG: setupThemesFirebase acknowledged (functionality now integrated).");
}

// --- Navigation Bar Logic (from navbar.js) ---
/**
 * Loads the navigation bar HTML into the 'navbar-placeholder' element
 * and updates its dynamic behavior based on the provided user object.
 * @param {object|null} user - The current Firebase User object, or null if logged out.
 * @param {string} defaultProfilePic - Default profile picture URL.
 * @param {string} defaultThemeName - Default theme ID.
 */
async function loadNavbar(user, defaultProfilePic, defaultThemeName) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');
  console.log("DEBUG: loadNavbar function called.");

  if (navbarPlaceholder) {
    console.log("DEBUG: 'navbar-placeholder' element found.");
    try {
      // Inline hardcoded navbar HTML for debugging
      const navbarHtml = `
        <nav class="navbar-bg p-4 shadow-lg w-full fixed top-0 left-0 z-50 rounded-b-lg">
          <div class="container mx-auto flex justify-between items-center">
            <a href="index.html" class="navbar-text text-2xl font-bold flex items-center gap-2">
              <svg class="h-6 w-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1v-3m0 0l-1-1h-4l-1 1m0 0h-4a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H9.75z"></path>
              </svg>
              Arcator.co.uk
            </a>
            <div class="flex items-center space-x-4">
                <a href="about.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">About Us</a>
                <a href="servers.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Servers</a>
                <a href="community.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Community</a>
                <a href="interests.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Interests</a>
                <a href="games.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Games</a>
                <a href="https://wiki.arcator.co.uk/" target="_blank" rel="noopener noreferrer" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Wiki</a>
                <a href="forms.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Forms</a>
                <a href="index.html#join-us" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Join Us</a>
                <a href="donations.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Support Us</a>
              <a id="navbar-user-settings-link" href="settings.html" class="hidden items-center space-x-2 navbar-text navbar-link px-3 py-2 rounded-md font-medium">
                <img id="navbar-user-profile-pic" class="profile-pic-small" src="${defaultProfilePic}" alt="Profile Picture">
                <span id="navbar-user-display-name">Settings</span>
              </a>
              <a id="navbar-signin-link" href="sign.html" class="flex items-center space-x-2 navbar-text navbar-link px-3 py-2 rounded-md font-medium">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                <span>Sign In</span>
              </a>
            </div>
          </div>
        </nav>
      `;
      navbarPlaceholder.innerHTML = navbarHtml;
      console.log("DEBUG: 'navbar.html' content injected successfully.");

      const navbarUserIcon = document.getElementById('navbar-user-profile-pic');
      const navbarUserDisplayName = document.getElementById('navbar-user-display-name');
      const navbarUserSettingsLink = document.getElementById('navbar-user-settings-link');
      const navbarSigninLink = document.getElementById('navbar-signin-link');
      const navbarUserIdDisplay = document.getElementById('navbar-user-id-display');

      if (user) {
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'flex';
        if (navbarSigninLink) navbarSigninLink.style.display = 'none';

        const userProfile = await getUserProfileFromFirestore(user.uid);
        const displayName = userProfile?.displayName || user.displayName || 'Settings';
        const photoURL = userProfile?.photoURL || user.photoURL || defaultProfilePic;
        const userId = user.uid;

        if (navbarUserDisplayName) navbarUserDisplayName.textContent = displayName;
        if (navbarUserIcon) navbarUserIcon.src = photoURL;
        if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = `UID: ${userId}`;
        console.log("DEBUG: Navbar UI updated for logged-in user.");

        let userThemePreference = userProfile?.themePreference || defaultThemeName;
        await applyTheme(userThemePreference);

      } else {
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
        if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
        if (navbarUserIcon) navbarUserIcon.src = defaultProfilePic;
        if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Sign In';
        if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = '';
        console.log("DEBUG: Navbar UI updated for logged-out user.");
        await applyTheme(defaultThemeName);
      }
    } catch (error) {
      console.error("ERROR: Failed to load navigation bar:", error);
      const manualNavbar = `
        <nav class="navbar-bg p-4 shadow-lg w-full">
          <div class="container mx-auto flex justify-between items-center">
            <a href="index.html" class="text-gray-50 text-2xl font-bold">Arcator.co.uk</a>
            <div>
              <a href="sign.html" class="text-gray-300 hover:text-gray-50 px-3 py-2 rounded-md text-lg font-medium">Sign In / Account</a>
            </div>
          </div>
        </nav>
      `;
      if (navbarPlaceholder) navbarPlaceholder.innerHTML = manualNavbar;
      console.log("DEBUG: Fallback manual navbar injected due to error.");
    }
  } else {
    console.error("ERROR: 'navbar-placeholder' element not found in the HTML. Cannot load navbar.");
  }
}


// --- DOM Elements (from settings.js) ---
const loadingSpinner = document.getElementById('loading-spinner');
const settingsContent = document.getElementById('settings-content');
const loginRequiredMessage = document.getElementById('login-required-message');

// Profile fields
const profilePictureDisplay = document.getElementById('profile-picture-display');
const displayNameText = document.getElementById('display-name-text');
const emailText = document.getElementById('email-text');
const displayNameInput = document.getElementById('display-name-input');
const profilePictureUrlInput = document.getElementById('profile-picture-url-input');
const saveProfileBtn = document.getElementById('save-profile-btn');

// Theme and Font Preferences
const themeSelect = document.getElementById('theme-select');
const fontSizeSelect = document.getElementById('font-size-select');
const fontFamilySelect = document.getElementById('font-family-select');
const backgroundPatternSelect = document.getElementById('background-pattern-select');
const savePreferencesBtn = document.getElementById('save-preferences-btn');
const createCustomThemeBtn = document.getElementById('create-custom-theme-btn');

// Password Management
const currentPasswordInput = document.getElementById('current-password-input');
const newPasswordInput = document.getElementById('new-password-input');
const confirmNewPasswordInput = document.getElementById('confirm-new-password-input');
const changePasswordBtn = document.getElementById('change-password-btn');

// Notification Preferences
const emailNotificationsCheckbox = document.getElementById('email-notifications-checkbox');
const inappNotificationsCheckbox = document.getElementById('inapp-notifications-checkbox');
const saveNotificationsBtn = document.getElementById('save-notifications-btn');

// Accessibility Settings
const highContrastCheckbox = document.getElementById('high-contrast-checkbox');
const reducedMotionCheckbox = document.getElementById('reduced-motion-checkbox');
const saveAccessibilityBtn = document.getElementById('save-accessibility-btn');

// Session Information
const lastLoginTimeElement = document.getElementById('last-login-time');
const accountCreationTimeElement = document.getElementById('account-creation-time');

// Delete Account
const deleteAccountPasswordInput = document.getElementById('delete-account-password');
const deleteAccountBtn = document.getElementById('delete-account-btn');


// --- Helper Functions (from settings.js) ---

/**
 * Shows the loading spinner and hides content.
 */
function showLoading() {
  console.log("DEBUG: showLoading called. Hiding settings content and login message.");
  if (loadingSpinner) loadingSpinner.style.display = 'flex';
  if (settingsContent) settingsContent.style.display = 'none';
  if (loginRequiredMessage) loginRequiredMessage.style.display = 'none';
}

/**
 * Hides the loading spinner and shows content.
 */
function hideLoading() {
  console.log("DEBUG: hideLoading called. Showing settings content.");
  if (loadingSpinner) loadingSpinner.style.display = 'none';
  if (settingsContent) settingsContent.style.display = 'block';
  if (loginRequiredMessage) loginRequiredMessage.style.display = 'none';
}

/**
 * Displays the login required message.
 */
function showLoginRequired() {
  console.log("DEBUG: showLoginRequired called. Hiding settings content, showing login message.");
  if (loadingSpinner) loadingSpinner.style.display = 'none';
  if (settingsContent) settingsContent.style.display = 'none';
  if (loginRequiredMessage) loginRequiredMessage.style.display = 'block';
}


/**
 * Populates the theme dropdown with available themes.
 */
async function populateThemeDropdown() {
  console.log("DEBUG: populateThemeDropdown called.");
  const themes = await getAvailableThemes();
  if (themeSelect) {
    themeSelect.innerHTML = '';
    themes.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name + (theme.isCustom ? ' (Custom)' : '');
      themeSelect.appendChild(option);
    });
    console.log("DEBUG: Theme dropdown populated with", themes.length, "themes.");
  } else {
    console.warn("WARNING: themeSelect element not found.");
  }
}

/**
 * Loads user profile and preferences from Firestore and populates the form fields.
 */
async function loadUserSettings() {
  console.log("DEBUG: >>> Entering loadUserSettings function <<<");
  showLoading();
  await firebaseReadyPromise; // Ensure Firebase is ready
  const user = auth.currentUser;
  console.log("DEBUG: loadUserSettings: Current user object from Auth:", user);
  console.log("DEBUG: loadUserSettings: Current user UID:", user ? user.uid : "none");


  if (!user) {
    console.log("DEBUG: loadUserSettings: User not authenticated, showing login required message.");
    showLoginRequired();
    hideLoading();
    return;
  }

  console.log("DEBUG: loadUserSettings: User is authenticated. Populating initial UI from FirebaseAuth user object.");
  if (displayNameText) {
    displayNameText.textContent = user.displayName || 'Set Display Name';
  }
  if (emailText) {
    emailText.textContent = user.email || 'N/A';
  }
  if (profilePictureDisplay) {
    profilePictureDisplay.src = user.photoURL || DEFAULT_PROFILE_PIC;
  }
  if (displayNameInput) {
    displayNameInput.value = user.displayName || '';
  }
  if (profilePictureUrlInput) {
    profilePictureUrlInput.value = user.photoURL || '';
  }

  console.log("DEBUG: loadUserSettings: Attempting to fetch user profile from Firestore for UID:", user.uid);
  const userProfile = await getUserProfileFromFirestore(user.uid);
  console.log("DEBUG: loadUserSettings: User profile fetched from Firestore:", userProfile);

  if (userProfile) {
    console.log("DEBUG: loadUserSettings: User profile exists in Firestore. Populating UI with Firestore data.");
    if (displayNameText) displayNameText.textContent = userProfile.displayName || user.displayName || 'Set Display Name';
    if (profilePictureDisplay) profilePictureDisplay.src = userProfile.photoURL || user.photoURL || DEFAULT_PROFILE_PIC;
    if (displayNameInput) displayNameInput.value = userProfile.displayName || user.displayName || '';
    if (profilePictureUrlInput) profilePictureUrlInput.value = userProfile.photoURL || user.photoURL || '';

    if (themeSelect) { themeSelect.value = userProfile.themePreference || DEFAULT_THEME_NAME; }
    if (fontSizeSelect) { fontSizeSelect.value = userProfile.fontSize || '16px'; }
    if (fontFamilySelect) { fontFamilySelect.value = userProfile.fontFamily || 'Inter, sans-serif'; }
    if (backgroundPatternSelect) { backgroundPatternSelect.value = userProfile.backgroundPattern || 'none'; }
    if (emailNotificationsCheckbox) { emailNotificationsCheckbox.checked = userProfile.emailNotifications ?? false; }
    if (inappNotificationsCheckbox) { inappNotificationsCheckbox.checked = userProfile.inAppNotifications ?? false; }
    if (highContrastCheckbox) { highContrastCheckbox.checked = userProfile.highContrastMode ?? false; }
    if (reducedMotionCheckbox) { reducedMotionCheckbox.checked = userProfile.reducedMotion ?? false; }
  } else {
    console.warn("WARNING: loadUserSettings: No user profile found in Firestore for UID:", user.uid, ". Applying default settings to UI.");
    if (themeSelect) themeSelect.value = DEFAULT_THEME_NAME;
    if (fontSizeSelect) fontSizeSelect.value = '16px';
    if (fontFamilySelect) fontFamilySelect.value = 'Inter, sans-serif';
    if (backgroundPatternSelect) backgroundPatternSelect.value = 'none';
    if (emailNotificationsCheckbox) emailNotificationsCheckbox.checked = false;
    if (inappNotificationsCheckbox) inappNotificationsCheckbox.checked = false;
    if (highContrastCheckbox) highContrastCheckbox.checked = false;
    if (reducedMotionCheckbox) reducedMotionCheckbox.checked = false;
  }

  if (user.metadata) {
    if (lastLoginTimeElement && user.metadata.lastSignInTime) {
      lastLoginTimeElement.textContent = `Last Login: ${new Date(user.metadata.lastSignInTime).toLocaleString()}`;
    } else if (lastLoginTimeElement) {
      lastLoginTimeElement.textContent = `Last Login: N/A`;
    }
    if (accountCreationTimeElement && user.metadata.creationTime) {
      accountCreationTimeElement.textContent = `Account Created: ${new Date(user.metadata.creationTime).toLocaleString()}`;
    } else if (accountCreationTimeElement) {
      accountCreationTimeElement.textContent = `Account Created: N/A`;
    }
  } else {
    console.warn("WARNING: loadUserSettings: User metadata not available.");
    if (lastLoginTimeElement) lastLoginTimeElement.textContent = `Last Login: N/A`;
    if (accountCreationTimeElement) accountCreationTimeElement.textContent = `Account Created: N/A`;
  }
  console.log("DEBUG: --- Finished loadUserSettings ---");
  hideLoading();
}

/**
 * Saves profile changes to Firebase Auth and Firestore.
 */
async function saveProfileChanges() {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) { showMessageBox("You must be logged in to save profile changes.", true); return; }

  const newDisplayName = displayNameInput.value.trim();
  const newPhotoURL = profilePictureUrlInput.value.trim();

  try {
    await updateProfile(user, { displayName: newDisplayName, photoURL: newPhotoURL || DEFAULT_PROFILE_PIC });
    showMessageBox("Profile updated successfully in Firebase Auth!", false);
  } catch (error) {
    console.error("Error updating Firebase Auth profile:", error);
    showMessageBox(`Error updating Firebase Auth profile: ${error.message}`, true);
  }

  const profileData = { displayName: newDisplayName, photoURL: newPhotoURL || DEFAULT_PROFILE_PIC };
  const success = await setUserProfileInFirestore(user.uid, profileData);
  if (success) { showMessageBox("Profile updated successfully in Firestore!", false); }
  else { showMessageBox("Failed to update profile in Firestore.", true); }

  loadUserSettings();
}

/**
 * Saves user preferences (theme, font size, font family, background pattern).
 */
async function savePreferences() {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) { showMessageBox("You must be logged in to save preferences.", true); return; }

  const preferences = {
    themePreference: themeSelect.value, fontSize: fontSizeSelect.value,
    fontFamily: fontFamilySelect.value, backgroundPattern: backgroundPatternSelect.value
  };

  await applyTheme(preferences.themePreference);

  const success = await setUserProfileInFirestore(user.uid, preferences);
  if (success) { showMessageBox("Preferences saved successfully!", false); }
  else { showMessageBox("Failed to save preferences.", true); }
}

/**
 * Changes user password.
 */
async function changePassword() {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) { showMessageBox("You must be logged in to change password.", true); return; }
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmNewPassword = confirmNewPasswordInput.value;

  if (!currentPassword || !newPassword || !confirmNewPassword) { showMessageBox("All password fields are required.", true); return; }
  if (newPassword.length < 6) { showMessageBox("New password must be at least 6 characters long.", true); return; }
  if (newPassword !== confirmNewPassword) { showMessageBox("New password and confirm new password do not match.", true); return; }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    showMessageBox("Password updated successfully!", false);
    currentPasswordInput.value = ''; newPasswordInput.value = ''; confirmNewPasswordInput.value = '';
  } catch (error) {
    console.error("Error changing password:", error);
    showMessageBox(`Error changing password: ${error.message}`, true);
  }
}

/**
 * Saves notification preferences.
 */
async function saveNotifications() {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) { showMessageBox("You must be logged in to save notification settings.", true); return; }

  const notifications = { emailNotifications: emailNotificationsCheckbox.checked, inAppNotifications: inappNotificationsCheckbox.checked };

  const success = await setUserProfileInFirestore(user.uid, notifications);
  if (success) { showMessageBox("Notification settings saved successfully!", false); }
  else { showMessageBox("Failed to save notification settings.", true); }
}

/**
 * Saves accessibility settings.
 */
async function saveAccessibility() {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) { showMessageBox("You must be logged in to save accessibility settings.", true); return; }

  const accessibility = { highContrastMode: highContrastCheckbox.checked, reducedMotion: reducedMotionCheckbox.checked };

  const success = await setUserProfileInFirestore(user.uid, accessibility);
  if (success) {
    showMessageBox("Accessibility settings saved successfully!", false);
    if (highContrastCheckbox.checked) { applyTheme('high-contrast'); } // Assuming 'high-contrast' is a defined theme
    else {
      const userProfile = await getUserProfileFromFirestore(user.uid);
      if (userProfile && userProfile.themePreference) { applyTheme(userProfile.themePreference); }
      else { applyTheme(DEFAULT_THEME_NAME); }
    }
  } else { showMessageBox("Failed to save accessibility settings.", true); }
}

/**
 * Deletes the user account.
 */
async function deleteAccount() {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) { showMessageBox("You must be logged in to delete your account.", true); return; }
  const password = deleteAccountPasswordInput.value;

  if (!password) { showMessageBox("Please enter your password to confirm account deletion.", true); return; }

  const confirmation = await showCustomConfirm(
    "Are you absolutely sure you want to delete your account?",
    "This action is permanent and cannot be undone."
  );

  if (!confirmation) { showMessageBox("Account deletion cancelled.", false); return; }

  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    await deleteUserProfileFromFirestore(user.uid);
    await deleteUser(user);

    showMessageBox("Account deleted successfully! Redirecting to sign-up page...", false);
    setTimeout(() => { window.location.href = 'sign.html'; }, 2000);
  } catch (error) {
    console.error("Error deleting account:", error);
    showMessageBox(`Error deleting account: ${error.message}`, true);
  }
}


// --- Main Event Listener ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("settings.js - DOMContentLoaded event fired.");

  showLoading(); // Show loading spinner initially

  // Initialize Firebase and ensure readiness
  // This will also set up the primary onAuthStateChanged listener
  await setupFirebaseAndUser();
  await firebaseReadyPromise; // Ensure Firebase is fully ready including currentUser

  // Load navbar (now uses inline HTML for debugging)
  // `auth` and `db` are guaranteed to be initialized after firebaseReadyPromise resolves
  // Add a check for 'auth' and 'auth.currentUser' before passing them to loadNavbar
  if (auth && auth.currentUser) {
    await loadNavbar(auth.currentUser, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME); // Pass auth.currentUser directly
  } else {
    // If no user is authenticated, still load the navbar but pass null for user
    await loadNavbar(null, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
  }


  // Populate theme dropdown with available themes
  await populateThemeDropdown();

  // Load user settings only AFTER firebaseReadyPromise has resolved and currentUser is set
  if (auth && auth.currentUser) { // Added auth check here
    console.log("DEBUG: User authenticated after initial setup. Calling loadUserSettings().");
    try {
      await loadUserSettings();
    } catch (e) {
      console.error("ERROR: settings.js - Error calling loadUserSettings:", e);
      showMessageBox("Error loading user settings. Please try again.", true);
      hideLoading();
    }
    // Apply initial theme based on user preference or default
    // getAvailableThemes is called again here to ensure it uses the latest data after possible user profile creation/update
    const userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
    const themeToApply = (await getAvailableThemes()).find(t => t.id === userProfile?.themePreference) || (await getAvailableThemes()).find(t => t.id === DEFAULT_THEME_NAME);
    await applyTheme(themeToApply.id);
  } else {
    console.log("DEBUG: User not authenticated after initial setup. Showing login required.");
    showLoginRequired();
    hideLoading();
    // Also apply default theme if no user is logged in
    await applyTheme(DEFAULT_THEME_NAME);
  }

  // Event listeners for buttons
  if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfileChanges);
  if (savePreferencesBtn) savePreferencesBtn.addEventListener('click', savePreferences);
  if (changePasswordBtn) changePasswordBtn.addEventListener('click', changePassword);
  if (saveNotificationsBtn) saveNotificationsBtn.addEventListener('click', saveNotifications);
  if (saveAccessibilityBtn) saveAccessibilityBtn.addEventListener('click', saveAccessibility);
  if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', deleteAccount);
  if (createCustomThemeBtn) createCustomThemeBtn.addEventListener('click', () => showMessageBox("Custom theme creation is not implemented in this debugging version.", false));


  // Set current year for footer
  const currentYearElement = document.getElementById('current-year-settings');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }
  console.log("DEBUG: settings.js - DOMContentLoaded event listener finished.");

  // DEBUGGING INITIAL MODAL STATE (from utils.js)
  const customConfirmModal = document.getElementById('custom-confirm-modal');
  if (customConfirmModal) {
    console.log("DEBUG-INIT: custom-confirm-modal element found.");
    const currentDisplay = window.getComputedStyle(customConfirmModal).display;
    if (currentDisplay !== 'none') {
      console.log(`DEBUG-INIT: custom-confirm-modal is VISIBLE by default! Current display: ${currentDisplay}. Forcibly hiding it.`);
      customConfirmModal.style.display = 'none';
    } else {
      console.log("DEBUG-INIT: custom-confirm-modal is correctly hidden by default.");
    }
  } else {
    console.error("DEBUG-INIT: custom-confirm-modal element not found.");
  }
});
