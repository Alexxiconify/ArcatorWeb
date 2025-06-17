import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setupCustomThemeManagement } from './custom_theme_modal.js';
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js';
import { loadNavbar } from './navbar.js';

// Firebase configuration object
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
const appId = canvasAppId || firebaseConfig.projectId || 'default-app-id';

let app;
let auth;
let db;
let firebaseReadyPromise; // Promise to ensure Firebase is fully initialized and authenticated
let isFirebaseInitialized = false;

const DEFAULT_PROFILE_PIC = 'https://placehold.co/128x128/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark'; // Use a named constant for consistency

// DOM elements
const loadingSpinner = document.getElementById('loading-spinner');
const settingsContent = document.getElementById('settings-content');
const loginRequiredMessage = document.getElementById('login-required-message');

const profilePictureDisplay = document.getElementById('profile-picture-display');
const displayNameText = document.getElementById('display-name-text');
const emailText = document.getElementById('email-text');
const displayNameInput = document.getElementById('display-name-input');
const profilePictureUrlInput = document.getElementById('profile-picture-url-input');
const urlPreviewMessage = document.getElementById('url-preview-message');
const saveProfileBtn = document.getElementById('save-profile-btn');

const userThemeSelect = document.getElementById('theme-select');
const userFontSizeSelect = document.getElementById('font-size-select');
const savePreferencesBtn = document.getElementById('save-preferences-btn');
const createCustomThemeBtn = document.getElementById('create-custom-theme-btn');


/**
 * Displays a custom message box for user feedback.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True for error, false for success.
 */
window.showMessageBox = function(message, isError) {
  const messageBox = document.getElementById('message-box');
  if (messageBox) {
    messageBox.textContent = message;
    messageBox.className = 'message-box'; // Reset classes
    if (isError) {
      messageBox.classList.add('error');
    } else {
      messageBox.classList.add('success');
    }
    messageBox.style.display = 'block';
    setTimeout(() => {
      messageBox.style.display = 'none';
    }, 5000);
  } else {
    console.warn("Message box element not found.");
  }
};


/**
 * Fetches user profile data from Firestore.
 * @param {string} uid - The user's UID.
 * @returns {Promise<Object|null>} - User profile data or null if not found.
 */
async function getUserProfileFromFirestore(uid) {
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore.");
    return null;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("Error fetching user profile from Firestore:", error);
    window.showMessageBox(`Error fetching user profile: ${error.message}`, true);
  }
  return null;
}

/**
 * Updates user profile data in Firestore.
 * @param {string} uid - The user's UID.
 * @param {Object} profileData - The data to update.
 */
async function updateUserProfileInFirestore(uid, profileData) {
  await firebaseReadyPromise;
  if (!db) {
    window.showMessageBox("Database not initialized. Cannot save profile.", true);
    return false;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    return true;
  } catch (error) {
    console.error("Error updating user profile in Firestore:", error);
    window.showMessageBox(`Error saving profile: ${error.message}`, true);
    return false;
  }
}

/**
 * Populates the theme select dropdown with available themes.
 * @param {string} selectedThemeId - The ID of the currently selected theme.
 */
async function populateThemeSelect(selectedThemeId) {
  userThemeSelect.innerHTML = ''; // Clear existing options
  const availableThemes = await getAvailableThemes(); // From themes.js
  availableThemes.forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    userThemeSelect.appendChild(option);
  });
  // Set the selected theme after populating options
  if (selectedThemeId && availableThemes.some(t => t.id === selectedThemeId)) {
    userThemeSelect.value = selectedThemeId;
  } else {
    userThemeSelect.value = DEFAULT_THEME_NAME;
  }
}

/**
 * Initializes user settings: loads profile, preferences, and sets up UI.
 */
async function initializeUserSettings() {
  loadingSpinner.style.display = 'flex';
  settingsContent.style.display = 'none';
  loginRequiredMessage.style.display = 'none';

  await firebaseReadyPromise; // Ensure Firebase is ready

  if (!auth.currentUser) {
    loadingSpinner.style.display = 'none';
    loginRequiredMessage.style.display = 'block';
    return;
  }

  const user = auth.currentUser;
  emailText.textContent = user.email;

  const userProfile = await getUserProfileFromFirestore(user.uid);
  console.log("User Profile Data:", userProfile);

  // Set initial display name
  displayNameInput.value = userProfile?.displayName || user.displayName || user.email.split('@')[0];
  displayNameText.textContent = displayNameInput.value;

  // Set initial profile picture
  const photoURL = userProfile?.photoURL || user.photoURL || DEFAULT_PROFILE_PIC;
  profilePictureUrlInput.value = photoURL === DEFAULT_PROFILE_PIC ? '' : photoURL; // Clear input if default pic
  profilePictureDisplay.src = photoURL;

  // Populate and set theme preference
  const themePreference = userProfile?.themePreference || DEFAULT_THEME_NAME;
  await populateThemeSelect(themePreference);
  applyTheme(themePreference, await getAvailableThemes()); // Apply initial theme

  // Set font size preference
  const fontSizePreference = userProfile?.fontSizePreference || '16px';
  userFontSizeSelect.value = fontSizePreference;
  document.body.style.fontSize = fontSizePreference;

  loadingSpinner.style.display = 'none';
  settingsContent.style.display = 'block';
}

// Initialize Firebase and setup firebaseReadyPromise
firebaseReadyPromise = new Promise((resolve) => {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseInitialized = true;
    console.log("Firebase initialized successfully.");
    setupThemesFirebase(db, auth, appId); // Pass Firebase instances to themes.js

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("onAuthStateChanged triggered during initialization. User:", user ? user.uid : "none");
      unsubscribe(); // Unsubscribe after the first call

      if (typeof __initial_auth_token !== 'undefined' && !user) {
        signInWithCustomToken(auth, __initial_auth_token)
          .then(() => console.log("DEBUG: Signed in with custom token from Canvas (settings page) during init."))
          .catch((error) => {
            console.error("ERROR: Error signing in with custom token (settings page) during init:", error);
            signInAnonymously(auth)
              .then(() => console.log("DEBUG: Signed in anonymously (settings page) after custom token failure during init."))
              .catch((anonError) => console.error("ERROR: Error signing in anonymously on settings page during init:", anonError));
          })
          .finally(() => resolve());
      } else if (!user && typeof __initial_auth_token === 'undefined') {
        signInAnonymously(auth)
          .then(() => console.log("DEBUG: Signed in anonymously (no custom token) on settings page during init."))
          .catch((anonError) => console.error("ERROR: Error signing in anonymously on settings page during init:", anonError))
          .finally(() => resolve());
      } else {
        resolve();
      }
    });
  } catch (e) {
    console.error("Error initializing Firebase (initial block):", e);
    window.showMessageBox("Error initializing Firebase. Please ensure your Firebase config is provided.", true);
    resolve(); // Resolve immediately on error to prevent infinite loading
  }
});


// Main execution logic on window load
window.onload = async function() {
  await firebaseReadyPromise; // Ensure Firebase is ready before loading navbar or settings

  // Load navbar first
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Set current year for footer
  document.getElementById('current-year-settings').textContent = new Date().getFullYear();

  // Initialize settings AFTER navbar is loaded and Firebase is ready
  if (isFirebaseInitialized) {
    await initializeUserSettings();
  } else {
    loadingSpinner.style.display = 'none';
    loginRequiredMessage.style.display = 'block';
    window.showMessageBox("Firebase is not initialized. Please ensure your Firebase config is provided.", true);
  }

  // Event Listeners for profile changes
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to save profile changes.", true);
        return;
      }
      const newDisplayName = displayNameInput.value.trim();
      let newPhotoURL = profilePictureUrlInput.value.trim();

      // If photo URL is empty, set to default placeholder
      if (newPhotoURL === '') {
        newPhotoURL = DEFAULT_PROFILE_PIC;
      }

      const success = await updateUserProfileInFirestore(auth.currentUser.uid, {
        displayName: newDisplayName,
        photoURL: newPhotoURL
      });
      if (success) {
        displayNameText.textContent = newDisplayName;
        profilePictureDisplay.src = newPhotoURL;
        window.showMessageBox("Profile updated successfully!", false);
        // Also update Firebase Auth profile for immediate display in navbar if needed
        await auth.currentUser.updateProfile({
          displayName: newDisplayName,
          photoURL: newPhotoURL
        }).catch(error => console.error("Error updating Auth profile:", error));
      }
    });
  }

  // Event Listeners for preferences changes
  if (savePreferencesBtn) {
    savePreferencesBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to save preferences.", true);
        return;
      }
      const newTheme = userThemeSelect.value;
      const newFontSize = userFontSizeSelect.value;

      const success = await updateUserProfileInFirestore(auth.currentUser.uid, {
        themePreference: newTheme,
        fontSizePreference: newFontSize
      });
      if (success) {
        document.body.style.fontSize = newFontSize;
        const allThemes = await getAvailableThemes();
        const selectedTheme = allThemes.find(t => t.id === newTheme);
        applyTheme(selectedTheme.id, selectedTheme);
        window.showMessageBox("Preferences saved successfully!", false);
      }
    });
  }

  // Live preview for profile picture URL
  if (profilePictureUrlInput && profilePictureDisplay && urlPreviewMessage) {
    profilePictureUrlInput.addEventListener('input', () => {
      const url = profilePictureUrlInput.value.trim();
      if (url === '') {
        profilePictureDisplay.src = DEFAULT_PROFILE_PIC;
        urlPreviewMessage.style.display = 'none';
        return;
      }
      // Simple regex for URL validation (not exhaustive)
      const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
      if (urlRegex.test(url)) {
        profilePictureDisplay.src = url;
        urlPreviewMessage.style.display = 'block';
        urlPreviewMessage.textContent = 'Previewing new image. Click Save to apply.';
        urlPreviewMessage.classList.remove('text-red-500');
        urlPreviewMessage.classList.add('text-secondary');
      } else {
        profilePictureDisplay.src = DEFAULT_PROFILE_PIC; // Fallback on invalid URL
        urlPreviewMessage.textContent = 'Invalid URL. Please enter a valid direct link to an image.';
        urlPreviewMessage.classList.remove('text-secondary');
        urlPreviewMessage.classList.add('text-red-500');
        urlPreviewMessage.style.display = 'block';
      }
    });
    // Add an onerror handler to the image element itself to catch broken image links
    profilePictureDisplay.onerror = function() {
      this.src = DEFAULT_PROFILE_PIC; // Fallback to default
      urlPreviewMessage.textContent = 'Image failed to load. Check the URL or use a different one.';
      urlPreviewMessage.classList.remove('text-secondary');
      urlPreviewMessage.classList.add('text-red-500');
      urlPreviewMessage.style.display = 'block';
    };
  }


  const createCustomThemeBtnElement = document.getElementById('create-custom-theme-btn');
  if (createCustomThemeBtnElement && isFirebaseInitialized) {
    setupCustomThemeManagement(db, auth, appId, window.showMessageBox, populateThemeSelect, userThemeSelect, DEFAULT_THEME_NAME, auth.currentUser);
  } else if (!createCustomThemeBtnElement) {
    console.warn("Create Custom Theme button not found.");
  }
};
