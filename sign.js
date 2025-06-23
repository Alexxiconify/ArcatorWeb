// This is a temporarily combined JavaScript file for debugging purposes.
// It merges logic from sign.js, firebase-init.js, utils.js, themes.js, and navbar.js.
// Not recommended for production due to lack of modularity.

// --- Firebase SDK Imports (External - remain unchanged) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc, query, where, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- Global Firebase Configuration & Instances (from firebase-init.js) ---
let rawFirebaseConfig = '';
let firebaseConfig = {}; // Initialize as empty object and export

// IMPORTANT: These are placeholders. In the Canvas environment, these will be populated by the system.
// For local development, you would replace these with your actual Firebase project details.
const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : null;
const tempProjectId = "arcator-web"; // Fallback for testing if __app_id is not set.

// Determine appId based on Canvas environment or fallback
const appId = canvasAppId || tempProjectId || 'default-app-id';

let app;
let auth; // Will be initialized later
let db;   // Will be initialized later
let currentUser = null; // Stores the current authenticated user's profile data

const DEFAULT_PROFILE_PIC = 'https://jylina.arcator.co.uk/standalone/img/default-profile.png';
const DEFAULT_THEME_NAME = 'dark'; // Default theme ID for new users
const ADMIN_UIDS = ['uOaZ8v76y2Q0X7PzJtU7Y3A2C1B4']; // Example admin UIDs

// Promise that resolves when Firebase app is initialized and auth state is determined
let firebaseReadyResolve;
const firebaseReadyPromise = new Promise(resolve => {
  firebaseReadyResolve = resolve;
});

/**
 * Retrieves a user's profile from the 'user_profiles' collection in Firestore.
 * Caches the result locally if possible for performance.
 * This function waits for `firebaseReadyPromise` if `db` is not yet initialized.
 * @param {string} uid - The User ID (UID) of the profile to fetch.
 * @returns {Promise<Object|null>} The user profile data, or null if not found.
 */
async function getUserProfileFromFirestore(uid) {
  await firebaseReadyPromise; // Ensure Firebase is initialized and auth state is ready
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore after firebaseReadyPromise.");
    return null;
  }
  // Check if it's the current user's profile already cached
  if (currentUser && currentUser.uid === uid) {
    return currentUser;
  }

  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return { uid: docSnap.id, ...docSnap.data() };
    } else {
      console.log("No such user profile in Firestore for UID:", uid);
      return null;
    }
  } catch (error) {
    console.error("Error getting user profile from Firestore:", error);
    return null;
  }
}

/**
 * Sets or updates a user's profile in the 'user_profiles' collection in Firestore.
 * This function waits for `firebaseReadyPromise` if `db` is not yet initialized.
 * @param {string} uid - The User ID (UID) of the profile to set/update.
 * @param {Object} profileData - The profile data to set.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function setUserProfileInFirestore(uid, profileData) {
  await firebaseReadyPromise; // Ensure Firebase is initialized and auth state is ready
  if (!db) {
    console.error("Firestore DB not initialized for setUserProfileInFirestore after firebaseReadyPromise.");
    return false;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true }); // Use merge to update fields, not overwrite
    // Update the local currentUser object if it's the current user
    if (currentUser && currentUser.uid === uid) {
      currentUser = { ...currentUser, ...profileData };
    }
    console.log("DEBUG: User profile updated in Firestore for UID:", uid);
    return true;
  } catch (error) {
    console.error("Error updating user profile in Firestore:", error);
    return false;
  }
}

/**
 * Deletes a user's profile from the 'user_profiles' collection in Firestore.
 * This function waits for `firebaseReadyPromise` if `db` is not yet initialized.
 * @param {string} uid - The User ID (UID) of the profile to delete.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function deleteUserProfileFromFirestore(uid) {
  await firebaseReadyPromise; // Ensure Firebase is initialized and auth state is ready
  if (!db) {
    console.error("Firestore DB not initialized for deleteUserProfileFromFirestore after firebaseReadyPromise.");
    return false;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await deleteDoc(userDocRef);
    console.log("DEBUG: User profile deleted from Firestore for UID:", uid);
    return true;
  } catch (error) {
    console.error("Error deleting user profile from Firestore:", error);
    return false;
  }
}

/**
 * Initializes Firebase, sets up authentication, and resolves firebaseReadyPromise.
 */
async function setupFirebaseAndUser() {
  console.log("DEBUG: setupFirebaseAndUser called.");

  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    if (typeof __firebase_config === 'string') {
      try {
        firebaseConfig = JSON.parse(__firebase_config);
        console.log("DEBUG: __firebase_config provided as string and parsed successfully.");
      } catch (e) {
        console.error("ERROR: Failed to parse __firebase_config string as JSON. Using empty config.", e);
        firebaseConfig = {}; // Ensure it's an object even on parse error
      }
    } else if (typeof __firebase_config === 'object' && __firebase_config !== null) {
      firebaseConfig = __firebase_config;
      console.log("DEBUG: __firebase_config provided as object. Using directly.");
    } else {
      console.warn("DEBUG: __firebase_config provided but not a string or object. Type:", typeof __firebase_config);
      firebaseConfig = {}; // Ensure it's an object if type is unexpected
    }
  } else {
    console.log("DEBUG: __firebase_config not provided. Using fallback for local testing.");
    // Fallback for local testing if __firebase_config is not defined
    firebaseConfig = {
      apiKey: "YOUR_API_KEY", // REPLACE WITH YOUR ACTUAL LOCAL FIREBASE CONFIG
      authDomain: `${tempProjectId}.firebaseapp.com`,
      projectId: tempProjectId,
      storageBucket: `${tempProjectId}.appspot.com`,
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID"
    };
  }

  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("DEBUG: Firebase app, Firestore, and Auth initialized. DB instance:", db);

    // Sign in anonymously if no custom token, or with custom token if provided
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      console.log("DEBUG: Attempting to sign in with custom token.");
      await signInWithCustomToken(auth, __initial_auth_token);
      console.log("DEBUG: Signed in with custom token.");
    } else {
      console.log("DEBUG: __initial_auth_token not defined or empty. Signing in anonymously.");
      await signInAnonymously(auth);
      console.log("DEBUG: Signed in anonymously.");
    }

    // Set up Auth state observer
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("Auth State Changed: User logged in:", user.uid);
        let userProfile = await getUserProfileFromFirestore(user.uid);

        if (!userProfile) {
          // Create a basic profile if none exists
          console.log("No profile found for new user. Creating default profile.");
          userProfile = {
            uid: user.uid,
            displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
            email: user.email || null,
            photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
            createdAt: new Date(),
            lastLoginAt: new Date(),
            selectedTheme: DEFAULT_THEME_NAME,
            isAdmin: ADMIN_UIDS.includes(user.uid) // Check if user is an admin
          };
          await setUserProfileInFirestore(user.uid, userProfile);
        } else {
          // Update last login time and admin status on existing profile
          await setUserProfileInFirestore(user.uid, {
            lastLoginAt: new Date(),
            isAdmin: ADMIN_UIDS.includes(user.uid)
          });
          // Merge admin status into the userProfile object for immediate use
          userProfile.isAdmin = ADMIN_UIDS.includes(user.uid);
        }
        currentUser = userProfile; // Store the full profile
        console.log("DEBUG: currentUser set:", currentUser);
      } else {
        console.log("Auth State Changed: User logged out.");
        currentUser = null;
      }
      console.log("DEBUG: firebaseReadyPromise resolving.");
      firebaseReadyResolve(); // Resolve the promise once auth state is settled
    });

  } catch (error) {
    console.error("FATAL ERROR: Failed to initialize Firebase or sign in:", error);
    // Even if there's an error, resolve the promise to allow other parts of the app to try loading
    console.log("DEBUG: firebaseReadyPromise resolving due to error during initialization.");
    firebaseReadyResolve();
  }
}

/**
 * Returns the currently authenticated user's profile, including custom data from Firestore.
 * This function ensures that the currentUser object is populated.
 * Call this function only after `firebaseReadyPromise` has resolved.
 * @returns {Object|null} The current user's profile object, or null if not logged in.
 */
function getCurrentUser() {
  return currentUser;
}


// --- Utility Functions (from utils.js) ---
let messageBoxTimeout;

/**
 * Displays a custom message box for user feedback.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True for error message (red background), false for success message (green background).
 */
function showMessageBox(message, isError) {
  const messageBox = document.getElementById('message-box');
  if (!messageBox) {
    console.warn("Message box element not found.");
    return;
  }

  clearTimeout(messageBoxTimeout); // Clear any existing timeout

  messageBox.textContent = message;
  messageBox.className = 'message-box'; // Reset classes
  if (isError) {
    messageBox.classList.add('error');
  } else {
    messageBox.classList.add('success');
  }
  messageBox.style.display = 'block';

  // Automatically hide after 5 seconds
  messageBoxTimeout = setTimeout(() => {
    messageBox.style.display = 'none';
  }, 5000);
}

/**
 * Sanitizes a string to be suitable for a user handle.
 * Converts to lowercase and removes any characters not allowed (alphanumeric, underscore, dot, hyphen).
 * @param {string} input - The raw string to sanitize.
 * @returns {string} The sanitized handle string.
 */
function sanitizeHandle(input) {
  return input.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}

/**
 * Custom confirmation dialog.
 * @param {string} message - The main message to display.
 * @param {string} [subMessage=''] - An optional sub-message.
 * @returns {Promise<boolean>} Resolves with true if confirmed, false otherwise.
 */
function customConfirm(message, subMessage = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmSubMessage = document.getElementById('confirm-submessage');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');
    const closeButton = modal.querySelector('.close-button');

    if (!modal || !confirmMessage || !confirmYes || !confirmNo || !closeButton) {
      console.error("Custom confirm modal elements not found.");
      resolve(false); // Default to false if elements are missing
      return;
    }

    confirmMessage.textContent = message;
    confirmSubMessage.textContent = subMessage;

    // Show the modal
    modal.style.display = 'flex';

    const cleanUp = () => {
      modal.style.display = 'none';
      confirmYes.removeEventListener('click', onYes);
      confirmNo.removeEventListener('click', onNo);
      closeButton.removeEventListener('click', onNo);
    };

    const onYes = () => {
      cleanUp();
      resolve(true);
    };

    const onNo = () => {
      cleanUp();
      resolve(false);
    };

    confirmYes.addEventListener('click', onYes);
    confirmNo.addEventListener('click', onNo);
    closeButton.addEventListener('click', onNo);
  });
}

/**
 * Shows a custom confirmation modal.
 * @param {string} message - The main confirmation message.
 * @param {string} [subMessage=''] - An optional sub-message for more details.
 * @returns {Promise<boolean>} Resolves to true if confirmed (Yes), false if cancelled (No).
 */
function showCustomConfirm(message, subMessage = '') {
  console.log("DEBUG: showCustomConfirm called with message:", message);
  const customConfirmModal = document.getElementById('custom-confirm-modal');
  const confirmMessageElement = document.getElementById('confirm-message');
  const confirmSubMessageElement = document.getElementById('confirm-submessage');
  const confirmYesBtn = document.getElementById('confirm-yes');
  const confirmNoBtn = document.getElementById('confirm-no');

  if (!customConfirmModal || !confirmMessageElement || !confirmYesBtn || !confirmNoBtn) {
    console.error("Confirmation modal elements not found.");
    // Fallback to native confirm if elements are missing (for debugging/critical path)
    return Promise.resolve(window.confirm(message + (subMessage ? `\n\n${subMessage}` : '')));
  }

  confirmMessageElement.textContent = message;
  confirmSubMessageElement.textContent = subMessage;
  customConfirmModal.style.display = 'flex'; // Use flex to center content

  return new Promise(resolve => {
    const cleanup = () => {
      confirmYesBtn.removeEventListener('click', onYes);
      confirmNoBtn.removeEventListener('click', onNo);
      customConfirmModal.removeEventListener('click', onClickOutside);
      customConfirmModal.style.display = 'none';
    };

    const onYes = () => {
      resolve(true);
      cleanup();
    };

    const onNo = () => {
      resolve(false);
      cleanup();
    };

    const onClickOutside = (event) => {
      if (event.target === customConfirmModal) {
        resolve(false); // Treat click outside as a cancellation
        cleanup();
      }
    };

    confirmYesBtn.addEventListener('click', onYes);
    confirmNoBtn.addEventListener('click', onNo);
    customConfirmModal.addEventListener('click', onClickOutside); // Close if clicked outside modal content
  });
}

// Common Emojis and parsing functions (from utils.js)
const COMMON_EMOJIS = {
  like: '👍',
  heart: '❤️',
  laugh: '😂',
  sad: '😢',
  fire: '🔥',
};

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

  // Create a map of handles to UIDs to avoid redundant Firestore calls
  const handleToUidMap = new Map();
  for (const match of matches) {
    const handle = match[1];
  }

  parsedText = text.replace(mentionRegex, (match, handle) => {
    return `<span class="font-semibold text-link">@${handle}</span>`;
  });

  return parsedText;
}

async function resolveHandlesToUids(handles) {
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized. Cannot resolve handles to UIDs.");
    return [];
  }

  const resolvedUids = [];
  const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);

  for (const handle of handles) {
    const q = query(userProfilesRef, where("displayName", "==", handle), limit(1));
    try {
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        resolvedUids.push(querySnapshot.docs[0].id);
      }
    } catch (error) {
      console.error(`Error resolving handle "${handle}" to UID:`, error);
    }
  }
  return resolvedUids;
}

function renderReactionButtons(type, itemId, reactions, containerElement, currentUser, commentId = null) {
  if (!containerElement) {
    console.error("Reaction buttons container not found.");
    return;
  }
  containerElement.innerHTML = ''; // Clear existing buttons

  const addReactionBtn = document.createElement('button');
  addReactionBtn.classList.add(
    'bg-input-bg', 'text-text-primary', 'py-1', 'px-2', 'rounded', 'mr-2', 'reaction-btn',
    'hover:bg-input-border', 'transition-colors', 'duration-200'
  );
  addReactionBtn.innerHTML = `<i class="fas fa-plus"></i>`; // Font Awesome plus icon
  addReactionBtn.title = "Add Reaction";
  addReactionBtn.addEventListener('click', () => {
    const defaultEmoji = '�';
    showMessageBox("Emoji picker not implemented yet. Click existing reactions to toggle.", false);
  });

  for (const emoji of Object.values(COMMON_EMOJIS)) {
    const userUids = reactions[emoji] ? Object.keys(reactions[emoji]) : [];
    const count = userUids.length;
    const hasReacted = currentUser ? userUids.includes(currentUser.uid) : false;

    const button = document.createElement('button');
    button.classList.add(
      'py-1', 'px-3', 'rounded-full', 'reaction-btn',
      'flex', 'items-center', 'space-x-1', 'text-sm'
    );

    if (hasReacted) {
      button.classList.add('reacted'); // Apply active styling
    } else {
      button.classList.add('bg-input-bg', 'text-text-primary');
    }

    button.innerHTML = `<span>${emoji}</span> <span class="font-bold">${count}</span>`;
    button.dataset.emoji = emoji; // Store emoji for handler
    button.dataset.itemId = itemId;
    button.dataset.type = type;
    if (commentId) button.dataset.commentId = commentId;
    containerElement.appendChild(button);
  }
}


// --- Theme Management Functions (from themes.html script) ---
let availableThemesCache = null;

// Predefined themes (copied from themes.html)
const PREDEFINED_THEMES = {
  'dark': {
    id: 'dark', // Explicit ID for predefined themes
    name: 'Dark',
    isCustom: false,
    properties: {
      bodyBg: '#1F2937',
      textPrimary: '#E5E7EB',
      textSecondary: '#CBD5E0',
      headingMain: '#F87171',
      headingCard: '#60A5FA',
      bgNavbar: '#111827',
      bgContentSection: '#1F2937',
      bgCard: '#2D3748',
      bgIpBox: '#1A202C',
      borderIpBox: '#4A5568',
      inputBg: '#374151',
      inputText: '#E5E7EB',
      inputBorder: '#4B5563',
      placeholder: '#9CA3AF',
      tableThBg: '#374151',
      tableThText: '#F87171',
      tableTdBorder: '#374151',
      tableRowEvenBg: '#2F3B4E',
      link: '#60A5FA',
      buttonText: 'white',
      buttonBlueBg: '#2563EB',
      buttonBlueHover: '#1D4ED8',
      buttonRedBg: '#DC2626',
      buttonRedHover: '#B91C1C',
      buttonGreenBg: '#16A34A',
      buttonGreenHover: '#15803D',
      buttonYellowBg: '#D97706',
      buttonYellowHover: '#B45309',
      buttonPurpleBg: '#9333EA',
      buttonPurpleHover: '#7E22CE',
      buttonIndigoBg: '#4F46E5',
      buttonIndigoHover: '#4338CA',
      buttonTealBg: '#0D9488',
      buttonTealHover: '#0F766E',
      messageBoxBgSuccess: '#4CAF50',
      messageBoxBgError: '#F44336',
      modalBg: '#2D3748',
      modalText: '#E5E7EB',
      modalInputBg: '#374151',
      modalInputText: '#E5E7EB'
    }
  },
  'light': {
    id: 'light', // Explicit ID
    name: 'Light',
    isCustom: false,
    properties: {
      bodyBg: '#F3F4F6',
      textPrimary: '#1F2937',
      textSecondary: '#4B5563',
      headingMain: '#DC2626',
      headingCard: '#2563EB',
      bgNavbar: '#E5E7EB',
      bgContentSection: '#F9FAFB',
      bgCard: '#FFFFFF',
      bgIpBox: '#E2E8F0',
      borderIpBox: '#CBD5E0',
      inputBg: '#FFFFFF',
      inputText: '#1F2937',
      inputBorder: '#D1D5DB',
      placeholder: '#6B7280',
      tableThBg: '#E0E0E0',
      tableThText: '#4B5563',
      tableTdBorder: '#E0E0E0',
      tableRowEvenBg: '#F0F0F0',
      link: '#2563EB',
      buttonText: 'white',
      buttonBlueBg: '#2563EB',
      buttonBlueHover: '#1D4ED8',
      buttonRedBg: '#DC2626',
      buttonRedHover: '#B91C1C',
      buttonGreenBg: '#16A34A',
      buttonGreenHover: '#15803D',
      buttonYellowBg: '#D97706',
      buttonYellowHover: '#B45309',
      buttonPurpleBg: '#9333EA',
      buttonPurpleHover: '#7E22CE',
      buttonIndigoBg: '#4F46E5',
      buttonIndigoHover: '#4338CA',
      buttonTealBg: '#0D9488',
      buttonTealHover: '#0F766E',
      messageBoxBgSuccess: '#4CAF50',
      messageBoxBgError: '#F44336',
      modalBg: '#FFFFFF',
      modalText: '#1F2937',
      modalInputBg: '#FFFFFF',
      modalInputText: '#1F2937'
    }
  },
  'arcator-blue': {
    id: 'arcator-blue', // Explicit ID
    name: 'Arcator Blue',
    isCustom: false,
    properties: {
      bodyBg: '#1a202c',
      textPrimary: '#E2E8F0',
      textSecondary: '#CBD5E0',
      headingMain: '#FC8181',
      headingCard: '#63B3ED',
      bgNavbar: '#111827',
      bgContentSection: '#1a202c',
      bgCard: '#2b3b55',
      bgIpBox: '#1A253A',
      borderIpBox: '#3B82F6',
      inputBg: '#3b4d6b',
      inputText: '#E2E8F0',
      inputBorder: '#5a6e8f',
      placeholder: '#94A3B8',
      tableThBg: '#3b4d6b',
      tableThText: '#90CDF4',
      tableTdBorder: '#374151',
      tableRowEvenBg: '#2F3B4E',
      link: '#63B3ED',
      buttonText: 'white',
      buttonBlueBg: '#4299E1',
      buttonBlueHover: '#3182CE',
      buttonRedBg: '#FC8181',
      buttonRedHover: '#E53E3E',
      buttonGreenBg: '#48BB78',
      buttonGreenHover: '#38A169',
      buttonYellowBg: '#ECC94B',
      buttonYellowHover: '#D69E2E',
      buttonPurpleBg: '#9F7AEA',
      buttonPurpleHover: '#805AD5',
      buttonIndigoBg: '#667EEA',
      buttonIndigoHover: '#5A67D8',
      buttonTealBg: '#38B2AC',
      buttonTealHover: '#319795',
      messageBoxBgSuccess: '#4CAF50',
      messageBoxBgError: '#F44336',
      modalBg: '#2b3b55',
      modalText: '#E2E8F0',
      modalInputBg: '#3b4d6b',
      modalInputText: '#E2E8F0'
    }
  }
};

let customThemes = {}; // Stores fetched custom themes

/**
 * Converts camelCase to kebab-case (for CSS variables).
 * @param {string} camelCaseString
 * @returns {string} kebab-case string
 */
function camelToKebab(camelCaseString) {
  return camelCaseString.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Fetches custom themes from Firestore.
 * @returns {Promise<Object>} A dictionary of custom themes.
 */
async function fetchCustomThemes() {
  await firebaseReadyPromise; // Ensure DB is initialized
  if (!db) {
    console.warn("Firestore DB not initialized. Cannot fetch custom themes.");
    return {};
  }
  const themesCollectionRef = collection(db, `artifacts/${appId}/public/data/custom_themes`);
  const fetchedThemes = {};
  try {
    const querySnapshot = await getDocs(themesCollectionRef);
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      fetchedThemes[docSnap.id] = {
        id: docSnap.id,
        name: data.name || docSnap.id,
        isCustom: true,
        properties: data.properties || {}
      };
    });
    console.log("Custom themes fetched:", fetchedThemes);
  } catch (error) {
    console.error("Error fetching custom themes:", error);
  }
  return fetchedThemes;
}

/**
 * Applies the specified theme by setting CSS variables.
 * @param {string} themeId - The ID of the theme to apply (e.g., 'dark', 'my-custom-theme').
 */
async function applyTheme(themeId) {
  const allThemes = await getAvailableThemes();
  const theme = allThemes.find(t => t.id === themeId) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);

  if (theme && theme.properties) {
    console.log(`DEBUG: Applying theme: ${theme.name || theme.id}`);
    for (const [key, value] of Object.entries(theme.properties)) {
      document.documentElement.style.setProperty(`--color-${camelToKebab(key)}`, value);
    }
    document.documentElement.setAttribute('data-theme', theme.id);

    // Add or remove theme-specific body classes for any special background-image logic
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-arcator-blue');
    if (theme.id === 'dark') {
      document.body.classList.add('theme-dark');
    } else if (theme.id === 'light') {
      document.body.classList.add('theme-light');
    } else if (theme.id === 'arcator-blue') {
      document.body.classList.add('theme-arcator-blue');
    }

  } else {
    console.warn(`WARN: Theme '${themeId}' not found or has no properties. Applying default.`);
    // Fallback to default if preferred theme is missing or malformed
    const defaultTheme = allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    if (defaultTheme && defaultTheme.properties) {
      for (const [key, value] of Object.entries(defaultTheme.properties)) {
        document.documentElement.style.setProperty(`--color-${camelToKebab(key)}`, value);
      }
      document.documentElement.setAttribute('data-theme', defaultTheme.id);
      document.body.classList.remove('theme-dark', 'theme-light', 'theme-arcator-blue');
      document.body.classList.add(`theme-${defaultTheme.id}`);
    } else {
      console.error("ERROR: Default theme not found or malformed. CSS variables might not be set.");
    }
  }
}

/**
 * Returns a combined list of predefined and custom themes.
 * @returns {Promise<Array<Object>>} An array of theme objects.
 */
async function getAvailableThemes() {
  // Only fetch custom themes once after Firebase is ready
  if (Object.keys(customThemes).length === 0) { // Check if customThemes is empty
    customThemes = await fetchCustomThemes();
  }
  // Return a new array combining values from both objects
  return [
    ...Object.values(PREDEFINED_THEMES),
    ...Object.values(customThemes)
  ];
}

/**
 * Sets up Firebase integration for themes.
 * (This function is now integrated into setupFirebaseAndUser and main DOMContentLoaded)
 * This is a placeholder to prevent errors if other modules still call it.
 */
function setupThemesFirebase() {
  console.log("DEBUG: setupThemesFirebase acknowledged (functionality now integrated).");
}

// --- Navigation Bar Logic (from navbar.js) ---
/**
 * Loads the navigation bar HTML into the 'navbar-placeholder' element
 * and sets up its dynamic behavior based on user authentication status.
 * It also applies the user's theme preference.
 * For debugging, a simple inline HTML is used instead of fetching navbar.html directly.
 * @param {object} firebaseInstances - Object containing auth, db, appId.
 * @param {string} defaultProfilePic - Default profile picture URL.
 * @param {string} defaultThemeName - Default theme ID.
 */
async function loadNavbar(firebaseInstances, defaultProfilePic, defaultThemeName) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');
  console.log("DEBUG: loadNavbar function called.");

  if (navbarPlaceholder) {
    console.log("DEBUG: 'navbar-placeholder' element found.");
    try {
      // For debugging, use a simple hardcoded navbar HTML instead of fetching
      const navbarHtml = `
        <nav class="navbar-bg p-4 shadow-lg w-full fixed top-0 left-0 z-50 rounded-b-lg">
          <div class="container mx-auto flex justify-between items-center">
            <!-- Logo/Site Title -->
            <a href="index.html" class="navbar-text text-2xl font-bold flex items-center gap-2">
              <svg class="h-6 w-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1v-3m0 0l-1-1h-4l-1 1m0 0h-4a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H9.75z"></path>
              </svg>
              Arcator.co.uk
            </a>

            <!-- Navigation Links and User Info -->
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
              <!--User Profile Link - Hidden by default, shown by settings.html when logged in -->
              <a id="navbar-user-settings-link" href="settings.html" class="hidden items-center space-x-2 navbar-text navbar-link px-3 py-2 rounded-md font-medium">
                <img id="navbar-user-profile-pic" class="profile-pic-small" src="${defaultProfilePic}" alt="Profile Picture">
                <span id="navbar-user-display-name">Settings</span>
              </a>

              <!-- Sign In/Account Link - Visible by default, hidden by settings.html when logged in -->
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
      const navbarUserIdDisplay = document.getElementById('navbar-user-id-display'); // Assuming this element exists

      await firebaseReadyPromise; // Ensure Firebase is ready

      // Listen for auth state changes to update the navbar UI
      onAuthStateChanged(firebaseInstances.auth, async (user) => {
        console.log("DEBUG: onAuthStateChanged triggered in loadNavbar. User:", user ? user.uid : "null");
        if (user) {
          // User is signed in
          if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'flex';
          if (navbarSigninLink) navbarSigninLink.style.display = 'none';

          const userProfile = await getUserProfileFromFirestore(user.uid);
          console.log("DEBUG: User profile fetched in navbar.js:", userProfile);

          const displayName = userProfile?.displayName || user.displayName || 'Settings';
          const photoURL = userProfile?.photoURL || user.photoURL || defaultProfilePic;
          const userId = user.uid; // Always display full UID

          if (navbarUserDisplayName) navbarUserDisplayName.textContent = displayName;
          if (navbarUserIcon) navbarUserIcon.src = photoURL;
          if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = `UID: ${userId}`;
          console.log("DEBUG: Navbar UI updated for logged-in user.");

          let userThemePreference = userProfile?.themePreference || defaultThemeName;
          console.log("DEBUG: Applying user theme preference from navbar.js:", userThemePreference);
          await applyTheme(userThemePreference);

        } else {
          // User is signed out
          if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
          if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
          if (navbarUserIcon) navbarUserIcon.src = defaultProfilePic;
          if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Sign In';
          if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = ''; // Clear UID for guests
          console.log("DEBUG: Navbar UI updated for logged-out user.");

          console.log("DEBUG: Applying default theme for logged-out user from navbar.js:", defaultThemeName);
          await applyTheme(defaultThemeName);
        }
      });
    } catch (error) {
      console.error("ERROR: Failed to load navigation bar:", error);
      // Fallback UI if fetching/parsing navbar.html fails
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

// --- DOM Elements (from original sign.js) ---
const signInSection = document.getElementById('signin-section');
const signUpSection = document.getElementById('signup-section');
const forgotPasswordSection = document.getElementById('forgot-password-section');

// Sign In elements
const signInEmailInput = document.getElementById('signin-email');
const signInPasswordInput = document.getElementById('signin-password');
const signInButton = document.getElementById('signin-form')?.querySelector('button[type="submit"]'); // Use optional chaining for safety
const goToSignUpLink = document.getElementById('go-to-signup');
const goToForgotPasswordLink = document.getElementById('go-to-forgot-password');

// Sign Up elements
const signUpEmailInput = document.getElementById('signup-email');
const signUpPasswordInput = document.getElementById('signup-password');
const signUpConfirmPasswordInput = document.getElementById('signup-confirm-password');
const signUpDisplayNameInput = document.getElementById('signup-display-name');
const signUpButton = document.getElementById('signup-form')?.querySelector('button[type="submit"]'); // Use optional chaining for safety
const goToSignInLink = document.getElementById('go-to-signin');

// Forgot Password elements
const forgotEmailInput = document.getElementById('forgot-email');
const resetPasswordButton = document.getElementById('forgot-password-form')?.querySelector('button[type="submit"]'); // Use optional chaining for safety
const goToSignInFromForgotLink = document.getElementById('go-to-signin-from-forgot');

const loadingSpinner = document.getElementById('loading-spinner');

/**
 * Shows the loading spinner.
 */
function showLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'flex';
}

/**
 * Hides the loading spinner.
 */
function hideLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'none';
}

/**
 * Displays a specific section and hides others.
 * @param {HTMLElement} sectionToShow - The section to display.
 */
function showSection(sectionToShow) {
  // Hide all potential sections
  if (signInSection) signInSection.style.display = 'none';
  if (signUpSection) signUpSection.style.display = 'none';
  if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';

  // Show the requested section
  if (sectionToShow) sectionToShow.style.display = 'block';
}

/**
 * Handles user sign-in.
 */
async function handleSignIn(event) {
  event.preventDefault(); // Prevent default form submission
  showLoading();
  await firebaseReadyPromise; // Ensure Firebase is ready
  const email = signInEmailInput.value;
  const password = signInPasswordInput.value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log("User signed in:", user.uid);

    // After successful sign-in, ensure a user profile exists or update it
    const userProfileRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, user.uid);
    const docSnap = await getDoc(userProfileRef);

    if (!docSnap.exists()) {
      // Create a default user profile if it doesn't exist
      await setDoc(userProfileRef, {
        uid: user.uid,
        displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
        email: user.email,
        photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        themePreference: DEFAULT_THEME_NAME,
        // Add other default settings
        fontSize: '16px',
        fontFamily: 'Inter, sans-serif',
        backgroundPattern: 'none',
        emailNotifications: true,
        inAppNotifications: true,
        highContrastMode: false,
        reducedMotion: false,
      });
      console.log("Default user profile created for new sign-in.");
    } else {
      // Update last login time for existing users
      await setDoc(userProfileRef, { lastLoginAt: new Date() }, { merge: true });
      console.log("User profile updated with last login time.");
    }

    showMessageBox("Signed in successfully!", false);
    window.location.href = 'settings.html'; // Redirect to settings page or dashboard
  } catch (error) {
    console.error("Sign-in error:", error);
    showMessageBox(`Sign-in failed: ${error.message}`, true);
  } finally {
    hideLoading();
  }
}

/**
 * Handles user sign-up.
 */
async function handleSignUp(event) {
  event.preventDefault(); // Prevent default form submission
  showLoading();
  await firebaseReadyPromise; // Ensure Firebase is ready
  const email = signUpEmailInput.value;
  const password = signUpPasswordInput.value;
  const confirmPassword = signUpConfirmPasswordInput.value;
  const displayName = sanitizeHandle(signUpDisplayNameInput.value.trim()); // Sanitize display name

  if (password !== confirmPassword) {
    showMessageBox("Passwords do not match.", true);
    hideLoading();
    return;
  }
  if (password.length < 6) {
    showMessageBox("Password must be at least 6 characters long.", true);
    hideLoading();
    return;
  }
  if (!displayName) {
    showMessageBox("Display Name is required.", true);
    hideLoading();
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update Firebase Auth profile with display name and default photo
    await updateProfile(user, {
      displayName: displayName,
      photoURL: DEFAULT_PROFILE_PIC
    });

    // Create user profile in Firestore
    const userProfileRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, user.uid);
    await setDoc(userProfileRef, {
      uid: user.uid,
      displayName: displayName,
      email: email,
      photoURL: DEFAULT_PROFILE_PIC,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      themePreference: DEFAULT_THEME_NAME, // Set default theme
      fontSize: '16px',
      fontFamily: 'Inter, sans-serif',
      backgroundPattern: 'none',
      emailNotifications: true,
      inAppNotifications: true,
      highContrastMode: false,
      reducedMotion: false,
    });

    console.log("User signed up and profile created:", user.uid);
    showMessageBox("Account created successfully! Redirecting to settings...", false);
    window.location.href = 'settings.html'; // Redirect to settings page
  } catch (error) {
    console.error("Sign-up error:", error);
    showMessageBox(`Sign-up failed: ${error.message}`, true);
  } finally {
    hideLoading();
  }
}

/**
 * Handles password reset.
 */
async function handlePasswordReset(event) {
  event.preventDefault(); // Prevent default form submission
  showLoading();
  await firebaseReadyPromise; // Ensure Firebase is ready
  const email = forgotEmailInput.value;

  if (!email) {
    showMessageBox("Please enter your email address.", true);
    hideLoading();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessageBox("Password reset email sent. Check your inbox!", false);
    showSection(signInSection); // Go back to sign-in after sending
  } catch (error) {
    console.error("Password reset error:", error);
    showMessageBox(`Password reset failed: ${error.message}`, true);
  } finally {
    hideLoading();
  }
}

// --- Main Event Listener ---
document.addEventListener('DOMContentLoaded', async () => {
  showLoading(); // Show loading spinner initially

  // Initialize Firebase (now consolidated)
  setupFirebaseAndUser(); // Call the combined Firebase setup
  await firebaseReadyPromise; // Ensure Firebase is ready

  // Load the navbar (now consolidated and uses inline HTML for debugging)
  // Pass the global auth, db, appId directly as firebaseInstances are no longer explicitly passed to loadNavbar
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);


  // Apply initial theme based on user preference or default immediately
  onAuthStateChanged(auth, async (user) => {
    let userThemePreference = null;
    if (user) {
      const userProfile = await getUserProfileFromFirestore(user.uid);
      userThemePreference = userProfile?.themePreference;
    }
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    await applyTheme(themeToApply.id);

    hideLoading(); // Hide loading spinner once theme is applied and auth state is checked
  });

  // Default to showing the sign-in section
  showSection(signInSection);

  // Link event listeners
  if (goToSignUpLink) goToSignUpLink.addEventListener('click', () => showSection(signUpSection));
  if (goToSignInLink) goToSignInLink.addEventListener('click', () => showSection(signInSection));
  if (goToForgotPasswordLink) goToForgotPasswordLink.addEventListener('click', () => showSection(forgotPasswordSection));
  if (goToSignInFromForgotLink) goToSignInFromForgotLink.addEventListener('click', () => showSection(signInSection));

  // Form submission event listeners
  const signInForm = document.getElementById('signin-form');
  const signUpForm = document.getElementById('signup-form');
  const forgotPasswordForm = document.getElementById('forgot-password-form');

  if (signInForm) signInForm.addEventListener('submit', handleSignIn);
  if (signUpForm) signUpForm.addEventListener('submit', handleSignUp);
  if (forgotPasswordForm) forgotPasswordForm.addEventListener('submit', handlePasswordReset);

  // DEBUGGING INITIAL MODAL STATE --- from utils.js
  const customConfirmModal = document.getElementById('custom-confirm-modal');
  if (customConfirmModal) {
    console.log("DEBUG-INIT: custom-confirm-modal element found.");
    const currentDisplay = window.getComputedStyle(customConfirmModal).display;
    if (currentDisplay !== 'none') {
      console.log(`DEBUG-INIT: custom-confirm-modal is VISIBLE by default! Current display: ${currentDisplay}. Forcibly hiding it.`);
      // Attempt to hide it forcefully if it's visible by default
      customConfirmModal.style.display = 'none';
    } else {
      console.log("DEBUG-INIT: custom-confirm-modal is correctly hidden by default.");
    }
  } else {
    console.error("DEBUG-INIT: custom-confirm-modal element not found.");
  }
});
