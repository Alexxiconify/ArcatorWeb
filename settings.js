import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection, // Added for querying handles
  query,      // Added for querying handles
  where,      // Added for querying handles
  getDocs     // Added for querying handles
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { setupCustomThemeManagement } from './custom_theme_modal.js'; // Unminified
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js'; // Unminified
import { loadNavbar } from './navbar.js'; // Unminified navbar.js

// Firebase configuration object (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app",
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM"
};

// Global variables provided by Canvas environment
const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : null;
const appId = canvasAppId || firebaseConfig.projectId || 'default-app-id';

let app;
let auth;
let db;
let firebaseReadyPromise; // Promise to ensure Firebase is fully initialized and authenticated
let isFirebaseInitialized = false;

const DEFAULT_PROFILE_PIC = 'https://placehold.co/128x128/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark'; // Ensure this matches a theme ID in themes.js

// --- DOM Elements ---
const loadingSpinner = document.getElementById('loading-spinner');
const settingsContent = document.getElementById('settings-content');
const loginRequiredMessage = document.getElementById('login-required-message');

// Profile Info
const profilePictureDisplay = document.getElementById('profile-picture-display');
const displayNameText = document.getElementById('display-name-text');
const emailText = document.getElementById('email-text');
const displayNameInput = document.getElementById('display-name-input');
const handleInput = document.getElementById('handle-input'); // New handle input
const handleMessage = document.getElementById('handle-message'); // New handle message
const profilePictureUrlInput = document.getElementById('profile-picture-url-input');
const urlPreviewMessage = document.getElementById('url-preview-message');
const saveProfileBtn = document.getElementById('save-profile-btn');

// Personalization
const userThemeSelect = document.getElementById('theme-select');
const userFontSizeSelect = document.getElementById('font-size-select');
const userFontFamilySelect = document.getElementById('font-family-select');
const userBackgroundPatternSelect = document.getElementById('background-pattern-select');
const savePreferencesBtn = document.getElementById('save-preferences-btn');
const createCustomThemeBtn = document.getElementById('create-custom-theme-btn');

// Password Management
const currentPasswordInput = document.getElementById('current-password-input');
const newPasswordInput = document.getElementById('new-password-input');
const confirmNewPasswordInput = document.getElementById('confirm-new-password-input');
const changePasswordBtn = document.getElementById('change-password-btn');

// Account Deletion
const deleteAccountPasswordInput = document.getElementById('delete-account-password');
const deleteAccountBtn = document.getElementById('delete-account-btn');

// Session Management
const lastLoginTimeDisplay = document.getElementById('last-login-time');
const accountCreationTimeDisplay = document.getElementById('account-creation-time');

// Notification Preferences
const emailNotificationsCheckbox = document.getElementById('email-notifications-checkbox');
const inappNotificationsCheckbox = document.getElementById('inapp-notifications-checkbox');
const saveNotificationsBtn = document.getElementById('save-notifications-btn');

// Accessibility Settings
const highContrastCheckbox = document.getElementById('high-contrast-checkbox');
const reducedMotionCheckbox = document.getElementById('reduced-motion-checkbox');
const saveAccessibilityBtn = document.getElementById('save-accessibility-btn');


// Message Box & Custom Confirm Modal
const messageBox = document.getElementById('message-box');
const customConfirmModal = document.getElementById('custom-confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmSubmessage = document.getElementById('confirm-submessage');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');


/**
 * Displays a custom message box for user feedback.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True for error, false for success.
 */
window.showMessageBox = function(message, isError) {
  const msgBox = document.getElementById('message-box');
  if (msgBox) {
    msgBox.textContent = message;
    msgBox.className = 'message-box'; // Reset classes
    if (isError) {
      msgBox.classList.add('error');
    } else {
      msgBox.classList.add('success');
    }
    msgBox.style.display = 'block';
    setTimeout(() => {
      msgBox.style.display = 'none';
    }, 5000);
  } else {
    console.warn("Message box element not found.");
  }
};

/**
 * Shows a custom confirmation modal.
 * @param {string} message - The main confirmation message.
 * @param {string} [subMessage=''] - An optional sub-message.
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled.
 */
function showCustomConfirm(message, subMessage = '') {
  return new Promise(resolve => {
    confirmMessage.textContent = message;
    confirmSubmessage.textContent = subMessage;
    customConfirmModal.style.display = 'flex'; // Use flex to center

    const onConfirm = () => {
      customConfirmModal.style.display = 'none';
      confirmYesBtn.removeEventListener('click', onConfirm);
      confirmNoBtn.removeEventListener('click', onCancel);
      resolve(true);
    };

    const onCancel = () => {
      customConfirmModal.style.display = 'none';
      confirmYesBtn.removeEventListener('click', onConfirm);
      confirmNoBtn.removeEventListener('click', onCancel);
      resolve(false);
    };

    confirmYesBtn.addEventListener('click', onConfirm);
    confirmNoBtn.addEventListener('click', onCancel);
  });
}

/**
 * Fetches user profile data from Firestore.
 * @param {string} uid - The user's UID.
 * @returns {Promise<Object|null>} - User profile data or null if not found.
 */
async function getUserProfileFromFirestore(uid) {
  // Wait for Firebase to be ready before attempting Firestore operations
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
 * Checks if a handle is unique in Firestore (case-insensitive).
 * @param {string} handle - The handle to check.
 * @param {string} currentUid - The UID of the current user (to allow their own handle).
 * @returns {Promise<boolean>} True if unique, false otherwise.
 */
async function isHandleUnique(handle, currentUid) {
  if (!db) {
    console.error("Firestore DB not initialized for isHandleUnique.");
    return false;
  }
  if (!handle) return false; // Empty handle is not unique

  const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
  // Query for documents where the 'handle' field matches the provided handle
  const q = query(userProfilesRef, where("handle", "==", handle));
  try {
    const querySnapshot = await getDocs(q);
    // If no documents are found, or the only document found belongs to the current user, it's unique
    return querySnapshot.empty || (querySnapshot.docs.length === 1 && querySnapshot.docs[0].id === currentUid);
  } catch (error) {
    console.error("Error checking handle uniqueness:", error);
    return false; // Assume not unique on error
  }
}

/**
 * Updates user profile data in Firestore.
 * @param {string} uid - The user's UID.
 * @param {Object} profileData - The data to update (themePreference, displayName, photoURL, handle, etc.).
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
    return true; // Return true on success, message handled by calling function
  } catch (error) {
    console.error("Error updating user profile in Firestore:", error);
    window.showMessageBox(`Error saving profile: ${error.message}`, true);
    return false;
  }
}

/**
 * Populates the theme selection dropdown with available themes.
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

  // Set the current theme, or default if the selected one isn't found
  if (selectedThemeId && availableThemes.some(t => t.id === selectedThemeId)) {
    userThemeSelect.value = selectedThemeId;
  } else {
    userThemeSelect.value = DEFAULT_THEME_NAME;
  }
}

/**
 * Initializes and loads user settings into the form fields.
 */
async function initializeUserSettings() {
  loadingSpinner.style.display = 'flex';
  settingsContent.style.display = 'none';
  loginRequiredMessage.style.display = 'none';

  await firebaseReadyPromise; // Ensure Firebase is initialized and auth state determined

  if (!auth.currentUser) {
    loadingSpinner.style.display = 'none';
    loginRequiredMessage.style.display = 'block';
    return;
  }

  const user = auth.currentUser;
  emailText.textContent = user.email;

  // Fetch user profile from Firestore
  const userProfile = await getUserProfileFromFirestore(user.uid);

  // Set profile info
  displayNameInput.value = userProfile?.displayName || user.displayName || user.email.split('@')[0];
  displayNameText.textContent = displayNameInput.value;
  // Populate handle input
  handleInput.value = userProfile?.handle || '';
  // Initial display of handle (not in settings page's top display yet, but will be if saved)

  const photoURL = userProfile?.photoURL || user.photoURL || DEFAULT_PROFILE_PIC;
  profilePictureUrlInput.value = photoURL === DEFAULT_PROFILE_PIC ? '' : photoURL; // Clear input if it's the default placeholder
  profilePictureDisplay.src = photoURL;

  // Set theme preference
  const themePreference = userProfile?.themePreference || DEFAULT_THEME_NAME;
  await populateThemeSelect(themePreference); // Populate and then set value

  // Set font size preference
  const fontSizePreference = userProfile?.fontSizePreference || '16px';
  userFontSizeSelect.value = fontSizePreference;
  document.body.style.fontSize = fontSizePreference;

  // Set font family preference
  const fontFamilyPreference = userProfile?.fontFamilyPreference || 'Inter, sans-serif';
  userFontFamilySelect.value = fontFamilyPreference;
  document.body.style.fontFamily = fontFamilyPreference;

  // Set background pattern preference
  const backgroundPatternPreference = userProfile?.backgroundPatternPreference || 'none';
  userBackgroundPatternSelect.value = backgroundPatternPreference;
  document.body.classList.remove('pattern-dots', 'pattern-grid'); // Remove existing patterns
  if (backgroundPatternPreference !== 'none') {
    document.body.classList.add(`pattern-${backgroundPatternPreference}`);
  }

  // Set notification preferences
  emailNotificationsCheckbox.checked = userProfile?.notificationPreferences?.email || false;
  inappNotificationsCheckbox.checked = userProfile?.notificationPreferences?.inApp || false;

  // Set accessibility settings
  highContrastCheckbox.checked = userProfile?.accessibilitySettings?.highContrast || false;
  reducedMotionCheckbox.checked = userProfile?.accessibilitySettings?.reducedMotion || false;
  document.body.classList.toggle('high-contrast-mode', highContrastCheckbox.checked);
  document.body.classList.toggle('reduced-motion', reducedMotionCheckbox.checked);


  // Set session management info
  if (user.metadata) {
    lastLoginTimeDisplay.textContent = `Last Login: ${new Date(user.metadata.lastSignInTime).toLocaleString()}`;
    accountCreationTimeDisplay.textContent = `Account Created: ${new Date(user.metadata.creationTime).toLocaleString()}`;
  }

  loadingSpinner.style.display = 'none';
  settingsContent.style.display = 'block';
}

// Initialize Firebase app and services
firebaseReadyPromise = new Promise((resolve) => {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseInitialized = true;
    console.log("Firebase initialized successfully.");

    // Pass Firebase instances to themes.js for custom theme management
    setupThemesFirebase(db, auth, appId);

    // Initial authentication check for Canvas environment
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("onAuthStateChanged triggered during initialization. User:", user ? user.uid : "none");
      unsubscribe(); // Unsubscribe immediately after the first state change

      if (typeof __initial_auth_token !== 'undefined' && !user) {
        // If Canvas provides a token and no user is signed in, try custom token sign-in
        signInWithCustomToken(auth, __initial_auth_token)
          .then(() => console.log("DEBUG: Signed in with custom token from Canvas (settings page) during init."))
          .catch((error) => {
            console.error("ERROR: Error signing in with custom token (settings page) during init:", error);
            signInAnonymously(auth) // Fallback to anonymous sign-in if custom token fails
              .then(() => console.log("DEBUG: Signed in anonymously (settings page) after custom token failure during init."))
              .catch((anonError) => console.error("ERROR: Error signing in anonymously on settings page during init:", anonError));
          })
          .finally(() => resolve()); // Always resolve after token attempt
      } else if (!user && typeof __initial_auth_token === 'undefined') {
        // If no Canvas token and no user, sign in anonymously
        signInAnonymously(auth)
          .then(() => console.log("DEBUG: Signed in anonymously (no custom token) on settings page during init."))
          .catch((anonError) => console.error("ERROR: Error signing in anonymously on settings page during init:", anonError))
          .finally(() => resolve());
      } else {
        // If user is already authenticated (e.g., from a previous page), resolve immediately
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
  // Wait for Firebase to be ready before proceeding
  await firebaseReadyPromise;

  // Load navbar (always load regardless of auth state)
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Set current year for footer
  document.getElementById('current-year-settings').textContent = new Date().getFullYear();

  // Initialize user settings if Firebase is ready
  if (isFirebaseInitialized) {
    await initializeUserSettings();
  } else {
    loadingSpinner.style.display = 'none';
    loginRequiredMessage.style.display = 'block';
    window.showMessageBox("Firebase is not initialized. Please ensure your Firebase config is provided.", true);
  }

  // --- Event Listeners ---

  // Handle input changes for handle uniqueness check
  if (handleInput) {
    handleInput.addEventListener('input', async () => {
      const newHandle = handleInput.value.trim();
      if (newHandle.length === 0) {
        handleMessage.textContent = 'Handle cannot be empty.';
        handleMessage.classList.remove('text-green-500');
        handleMessage.classList.add('text-red-500');
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(newHandle)) {
        handleMessage.textContent = 'Handle can only contain letters, numbers, underscores, periods, and hyphens.';
        handleMessage.classList.remove('text-green-500');
        handleMessage.classList.add('text-red-500');
        return;
      }
      if (newHandle.length < 3 || newHandle.length > 20) {
        handleMessage.textContent = 'Handle must be between 3 and 20 characters.';
        handleMessage.classList.remove('text-green-500');
        handleMessage.classList.add('text-red-500');
        return;
      }

      const unique = await isHandleUnique(newHandle, auth.currentUser.uid);
      if (unique) {
        handleMessage.textContent = 'Handle is available!';
        handleMessage.classList.remove('text-red-500');
        handleMessage.classList.add('text-green-500');
      } else {
        handleMessage.textContent = 'Handle is already taken.';
        handleMessage.classList.remove('text-green-500');
        handleMessage.classList.add('text-red-500');
      }
    });
  }


  // Save Profile Changes
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to save profile changes.", true);
        return;
      }

      const newDisplayName = displayNameInput.value.trim();
      const newHandle = handleInput.value.trim();
      let newPhotoURL = profilePictureUrlInput.value.trim();

      if (!newHandle) {
        window.showMessageBox("Handle is required.", true);
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(newHandle)) {
        window.showMessageBox("Handle can only contain letters, numbers, underscores, periods, and hyphens.", true);
        return;
      }
      if (newHandle.length < 3 || newHandle.length > 20) {
        window.showMessageBox("Handle must be between 3 and 20 characters.", true);
        return;
      }

      const uniqueHandle = await isHandleUnique(newHandle, auth.currentUser.uid);
      if (!uniqueHandle) {
        window.showMessageBox("The chosen handle is already taken or invalid. Please choose another.", true);
        return;
      }


      if (newPhotoURL === '') {
        newPhotoURL = DEFAULT_PROFILE_PIC; // If empty, revert to default placeholder
      }

      const success = await updateUserProfileInFirestore(auth.currentUser.uid, {
        displayName: newDisplayName,
        photoURL: newPhotoURL,
        handle: newHandle // Save the new handle
      });

      if (success) {
        // Update local UI immediately
        displayNameText.textContent = newDisplayName;
        profilePictureDisplay.src = newPhotoURL;
        window.showMessageBox("Profile updated successfully!", false);

        // Also update Firebase Auth profile (important for navbar.js and other Firebase-aware parts)
        // Note: Firebase Auth doesn't have a direct 'handle' field, so we just update displayName and photoURL
        await auth.currentUser.updateProfile({
          displayName: newDisplayName,
          photoURL: newPhotoURL
        }).catch(error => {
          console.error("Error updating Auth profile:", error);
          window.showMessageBox(`Error updating profile in Auth: ${error.message}`, true);
        });
      }
    });
  }

  // Save Preferences (Theme, Font Size, Font Family, Background Pattern)
  if (savePreferencesBtn) {
    savePreferencesBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to save preferences.", true);
        return;
      }

      const newTheme = userThemeSelect.value;
      const newFontSize = userFontSizeSelect.value;
      const newFontFamily = userFontFamilySelect.value;
      const newBackgroundPattern = userBackgroundPatternSelect.value;

      const success = await updateUserProfileInFirestore(auth.currentUser.uid, {
        themePreference: newTheme,
        fontSizePreference: newFontSize,
        fontFamilyPreference: newFontFamily,
        backgroundPatternPreference: newBackgroundPattern
      });

      if (success) {
        document.body.style.fontSize = newFontSize;
        document.body.style.fontFamily = newFontFamily;
        document.body.classList.remove('pattern-dots', 'pattern-grid'); // Clear existing patterns
        if (newBackgroundPattern !== 'none') {
          document.body.classList.add(`pattern-${newBackgroundPattern}`);
        }

        const allThemes = await getAvailableThemes();
        const selectedTheme = allThemes.find(t => t.id === newTheme);
        applyTheme(selectedTheme.id, selectedTheme); // Apply the theme using the imported function

        window.showMessageBox("Preferences saved successfully!", false);
      }
    });
  }


  // Profile Picture URL Preview
  if (profilePictureUrlInput && profilePictureDisplay && urlPreviewMessage) {
    profilePictureUrlInput.addEventListener('input', () => {
      const url = profilePictureUrlInput.value.trim();
      if (url === '') {
        profilePictureDisplay.src = DEFAULT_PROFILE_PIC;
        urlPreviewMessage.style.display = 'none';
        return;
      }
      // Simple regex for URL validation (can be improved)
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
    // Fallback if image fails to load after setting src
    profilePictureDisplay.onerror = function() {
      this.src = DEFAULT_PROFILE_PIC;
      urlPreviewMessage.textContent = 'Image failed to load. Check the URL or use a different one.';
      urlPreviewMessage.classList.remove('text-secondary');
      urlPreviewMessage.classList.add('text-red-500');
      urlPreviewMessage.style.display = 'block';
    };
  }

  // Create Custom Theme Button setup
  // Ensure Firebase is initialized before setting up custom theme management
  if (createCustomThemeBtn && isFirebaseInitialized) {
    setupCustomThemeManagement(db, auth, appId, window.showMessageBox, populateThemeSelect, userThemeSelect, DEFAULT_THEME_NAME, auth.currentUser);
  } else if (!createCustomThemeBtn) {
    console.warn("Create Custom Theme button not found.");
  }

  // Change Password
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to change your password.", true);
        return;
      }

      const currentPassword = currentPasswordInput.value;
      const newPassword = newPasswordInput.value;
      const confirmNewPassword = confirmNewPasswordInput.value;

      if (!currentPassword || !newPassword || !confirmNewPassword) {
        window.showMessageBox("All password fields are required.", true);
        return;
      }
      if (newPassword !== confirmNewPassword) {
        window.showMessageBox("New passwords do not match.", true);
        return;
      }
      if (newPassword.length < 6) {
        window.showMessageBox("New password must be at least 6 characters long.", true);
        return;
      }

      try {
        // Re-authenticate user with their current password for security
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);

        // Update the password
        await updatePassword(auth.currentUser, newPassword);

        window.showMessageBox("Password changed successfully!", false);
        // Clear password fields
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmNewPasswordInput.value = '';
      } catch (error) {
        console.error("Error changing password:", error);
        let errorMessage = "Failed to change password.";
        if (error.code === "auth/wrong-password") {
          errorMessage = "Incorrect current password.";
        } else if (error.code === "auth/user-mismatch" || error.code === "auth/user-not-found") {
          errorMessage = "Authentication error. Please re-login."; // User's session might be old
        } else if (error.code === "auth/weak-password") {
          errorMessage = "New password is too weak.";
        }
        window.showMessageBox(errorMessage, true);
      }
    });
  }

  // Account Deletion
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to delete your account.", true);
        return;
      }

      const passwordToConfirm = deleteAccountPasswordInput.value;
      if (!passwordToConfirm) {
        window.showMessageBox("Please enter your password to confirm account deletion.", true);
        return;
      }

      const confirmation = await showCustomConfirm(
        "Are you absolutely sure you want to delete your account?",
        "This action is irreversible. All your data will be permanently lost!"
      );

      if (!confirmation) {
        window.showMessageBox("Account deletion cancelled.", false);
        return;
      }

      try {
        // Re-authenticate user before deleting for security
        const credential = EmailAuthProvider.credential(auth.currentUser.email, passwordToConfirm);
        await reauthenticateWithCredential(auth.currentUser, credential);

        // Delete user profile from Firestore first
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid));

        // Delete user from Firebase Authentication
        await deleteUser(auth.currentUser);

        window.showMessageBox("Account deleted successfully! Redirecting...", false);
        setTimeout(() => {
          window.location.href = 'sign.html'; // Redirect to sign-in page after deletion
        }, 2000);

      } catch (error) {
        console.error("Error deleting account:", error);
        let errorMessage = "Failed to delete account.";
        if (error.code === "auth/wrong-password") {
          errorMessage = "Incorrect password. Account deletion failed.";
        } else if (error.code === "auth/requires-recent-login") {
          errorMessage = "Please re-login recently to delete your account (due to security policies).";
        }
        window.showMessageBox(errorMessage, true);
      }
    });
  }

  // Save Notification Preferences
  if (saveNotificationsBtn) {
    saveNotificationsBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to save notification settings.", true);
        return;
      }
      const emailNotifications = emailNotificationsCheckbox.checked;
      const inAppNotifications = inappNotificationsCheckbox.checked;

      const success = await updateUserProfileInFirestore(auth.currentUser.uid, {
        notificationPreferences: {
          email: emailNotifications,
          inApp: inAppNotifications
        }
      });
      if (success) {
        window.showMessageBox("Notification settings saved successfully!", false);
      }
    });
  }

  // Save Accessibility Settings
  if (saveAccessibilityBtn) {
    saveAccessibilityBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to save accessibility settings.", true);
        return;
      }
      const highContrast = highContrastCheckbox.checked;
      const reducedMotion = reducedMotionCheckbox.checked;

      const success = await updateUserProfileInFirestore(auth.currentUser.uid, {
        accessibilitySettings: {
          highContrast: highContrast,
          reducedMotion: reducedMotion
        }
      });
      if (success) {
        // Apply immediately to the body for visual feedback
        document.body.classList.toggle('high-contrast-mode', highContrast);
        document.body.classList.toggle('reduced-motion', reducedMotion);
        window.showMessageBox("Accessibility settings saved successfully!", false);
      }
    });
  }

  // Close Custom Confirm Modal when clicking its close button
  document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', () => {
      customConfirmModal.style.display = 'none';
    });
  });

  // Close Custom Confirm Modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === customConfirmModal) {
      customConfirmModal.style.display = 'none';
    }
  });

};
