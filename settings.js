// settings.js: Handles user settings, including profile, preferences,
// password management, notifications, accessibility, and account deletion.

// Import necessary Firebase SDK functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import local module functions
import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';
import { showMessageBox, showCustomConfirm, sanitizeHandle } from './utils.js'; // Removed parseEmojis as not directly used here
import { getUserProfileFromFirestore, updateUserProfileInFirestore, deleteUserProfileFromFirestore, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME } from './firebase-init.js';


// Firebase configuration (re-defined locally as per the working pattern)
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
let firebaseReadyPromise; // This promise will manage local Firebase initialization

const DEFAULT_THEME = 'dark'; // Use a constant for default theme
// DEFAULT_PROFILE_PIC is imported from firebase-init.js if needed, otherwise defined here


// Re-establish local Firebase initialization logic within a promise
firebaseReadyPromise = new Promise((resolve) => {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase initialized successfully (settings.html local).");

    // Pass local db, auth, appId to themes.js setup function
    setupThemesFirebase(db, auth, appId);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("onAuthStateChanged triggered during settings.html local initialization. User:", user ? user.uid : "none");
      unsubscribe(); // Unsubscribe after the first call

      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token && !user) {
        signInWithCustomToken(auth, __initial_auth_token)
          .then(() => console.log("DEBUG: Signed in with custom token from Canvas (settings page) during init."))
          .catch((error) => {
            console.error("ERROR: Error signing in with custom token (settings page) during init:", error);
            signInAnonymously(auth)
              .then(() => console.log("DEBUG: Signed in anonymously (settings page) after custom token failure during init."))
              .catch((anonError) => console.error("ERROR: Error signing in anonymously on settings page during init:", anonError));
          })
          .finally(() => resolve());
      } else if (!user) {
        signInAnonymously(auth)
          .then(() => console.log("DEBUG: Signed in anonymously (no custom token) on settings page during init."))
          .catch((anonError) => console.error("ERROR: Error signing in anonymously on settings page during init:", anonError))
          .finally(() => resolve());
      } else {
        resolve();
      }
    });
  } catch (e) {
    console.error("Error initializing Firebase (settings.html local block):", e);
    resolve();
  }
});


// --- DOM Elements ---
const loadingSpinner = document.getElementById('loading-spinner');
const settingsContent = document.getElementById('settings-content');
const loginRequiredMessage = document.getElementById('login-required-message');

// Profile fields
const profilePictureDisplay = document.getElementById('profile-picture-display');
const displayNameText = document.getElementById('display-name-text');
const emailText = document.getElementById('email-text');
const displayNameInput = document.getElementById('display-name-input');
// const handleInput = document.getElementById('handle-input'); // Removed handle-input as per HTML
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


// --- Helper Functions ---

/**
 * Shows the loading spinner and hides content.
 */
function showLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'flex';
  if (settingsContent) settingsContent.style.display = 'none';
  if (loginRequiredMessage) loginRequiredMessage.style.display = 'none';
}

/**
 * Hides the loading spinner and shows content.
 */
function hideLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'none';
  if (settingsContent) settingsContent.style.display = 'block';
}

/**
 * Displays the login required message.
 */
function showLoginRequired() {
  if (loadingSpinner) loadingSpinner.style.display = 'none';
  if (settingsContent) settingsContent.style.display = 'none';
  if (loginRequiredMessage) loginRequiredMessage.style.display = 'block';
}


/**
 * Populates the theme dropdown with available themes.
 */
async function populateThemeDropdown() {
  const themes = await getAvailableThemes();
  if (themeSelect) {
    themeSelect.innerHTML = ''; // Clear existing options
    themes.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name + (theme.isCustom ? ' (Custom)' : '');
      themeSelect.appendChild(option);
    });
  }
}

/**
 * Loads user profile and preferences from Firestore and populates the form fields.
 */
async function loadUserSettings() {
  showLoading();
  await firebaseReadyPromise; // Ensure Firebase is ready
  const user = auth.currentUser;

  if (!user) {
    showLoginRequired();
    return;
  }

  // Populate profile section
  displayNameText.textContent = user.displayName || 'Set Display Name';
  emailText.textContent = user.email || 'N/A';
  profilePictureDisplay.src = user.photoURL || DEFAULT_PROFILE_PIC;
  displayNameInput.value = user.displayName || '';
  profilePictureUrlInput.value = user.photoURL || '';

  // Fetch user profile from Firestore
  const userProfile = await getUserProfileFromFirestore(user.uid);

  if (userProfile) {
    // Update display name and picture if profile has more recent info
    displayNameText.textContent = userProfile.displayName || displayNameText.textContent;
    profilePictureDisplay.src = userProfile.photoURL || profilePictureDisplay.src;
    displayNameInput.value = userProfile.displayName || '';
    profilePictureUrlInput.value = userProfile.photoURL || '';

    // Set preferences
    if (themeSelect && userProfile.themePreference) {
      themeSelect.value = userProfile.themePreference;
    }
    if (fontSizeSelect && userProfile.fontSize) {
      fontSizeSelect.value = userProfile.fontSize;
    }
    if (fontFamilySelect && userProfile.fontFamily) {
      fontFamilySelect.value = userProfile.fontFamily;
    }
    if (backgroundPatternSelect && userProfile.backgroundPattern) {
      backgroundPatternSelect.value = userProfile.backgroundPattern;
    }
    if (emailNotificationsCheckbox) {
      emailNotificationsCheckbox.checked = userProfile.emailNotifications || false;
    }
    if (inappNotificationsCheckbox) {
      inappNotificationsCheckbox.checked = userProfile.inAppNotifications || false;
    }
    if (highContrastCheckbox) {
      highContrastCheckbox.checked = userProfile.highContrastMode || false;
    }
    if (reducedMotionCheckbox) {
      reducedMotionCheckbox.checked = userProfile.reducedMotion || false;
    }
  }

  // Session Information
  if (user.metadata) {
    if (lastLoginTimeElement && user.metadata.lastSignInTime) {
      lastLoginTimeElement.textContent = `Last Login: ${new Date(user.metadata.lastSignInTime).toLocaleString()}`;
    }
    if (accountCreationTimeElement && user.metadata.creationTime) {
      accountCreationTimeElement.textContent = `Account Created: ${new Date(user.metadata.creationTime).toLocaleString()}`;
    }
  }

  hideLoading();
}

/**
 * Saves profile changes to Firebase Auth and Firestore.
 */
async function saveProfileChanges() {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to save profile changes.", true);
    return;
  }

  const newDisplayName = displayNameInput.value.trim();
  const newPhotoURL = profilePictureUrlInput.value.trim();
  // const newHandle = sanitizeHandle(handleInput.value.trim()); // Removed handle

  // Update Firebase Auth profile
  try {
    await updateProfile(user, {
      displayName: newDisplayName,
      photoURL: newPhotoURL || DEFAULT_PROFILE_PIC
    });
    showMessageBox("Profile updated successfully in Firebase Auth!", false);
  } catch (error) {
    console.error("Error updating Firebase Auth profile:", error);
    showMessageBox(`Error updating Firebase Auth profile: ${error.message}`, true);
  }

  // Update profile in Firestore (user_profiles collection)
  const profileData = {
    displayName: newDisplayName,
    photoURL: newPhotoURL || DEFAULT_PROFILE_PIC,
    // handle: newHandle // Removed handle
  };
  const success = await updateUserProfileInFirestore(user.uid, profileData);
  if (success) {
    showMessageBox("Profile updated successfully in Firestore!", false);
  } else {
    showMessageBox("Failed to update profile in Firestore.", true);
  }

  loadUserSettings(); // Reload to reflect changes
}

/**
 * Saves user preferences (theme, font size, font family, background pattern).
 */
async function savePreferences() {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to save preferences.", true);
    return;
  }

  const preferences = {
    themePreference: themeSelect.value,
    fontSize: fontSizeSelect.value,
    fontFamily: fontFamilySelect.value,
    backgroundPattern: backgroundPatternSelect.value
  };

  // Apply the theme immediately
  await applyTheme(preferences.themePreference);

  const success = await updateUserProfileInFirestore(user.uid, preferences);
  if (success) {
    showMessageBox("Preferences saved successfully!", false);
  } else {
    showMessageBox("Failed to save preferences.", true);
  }
}

/**
 * Changes user password.
 */
async function changePassword() {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to change password.", true);
    return;
  }
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmNewPassword = confirmNewPasswordInput.value;

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    showMessageBox("All password fields are required.", true);
    return;
  }
  if (newPassword.length < 6) {
    showMessageBox("New password must be at least 6 characters long.", true);
    return;
  }
  if (newPassword !== confirmNewPassword) {
    showMessageBox("New password and confirm new password do not match.", true);
    return;
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    showMessageBox("Password updated successfully!", false);
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    confirmNewPasswordInput.value = '';
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
  if (!user) {
    showMessageBox("You must be logged in to save notification settings.", true);
    return;
  }

  const notifications = {
    emailNotifications: emailNotificationsCheckbox.checked,
    inAppNotifications: inappNotificationsCheckbox.checked
  };

  const success = await updateUserProfileInFirestore(user.uid, notifications);
  if (success) {
    showMessageBox("Notification settings saved successfully!", false);
  } else {
    showMessageBox("Failed to save notification settings.", true);
  }
}

/**
 * Saves accessibility settings.
 */
async function saveAccessibility() {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to save accessibility settings.", true);
    return;
  }

  const accessibility = {
    highContrastMode: highContrastCheckbox.checked,
    reducedMotion: reducedMotionCheckbox.checked
  };

  const success = await updateUserProfileInFirestore(user.uid, accessibility);
  if (success) {
    showMessageBox("Accessibility settings saved successfully!", false);
    // Immediately apply high contrast if enabled (logic needs to be in themes.js or directly here)
    if (highContrastCheckbox.checked) {
      applyTheme('high-contrast'); // Assuming 'high-contrast' is an existing theme ID
    } else {
      // Reapply user's actual theme preference if high contrast is turned off
      const userProfile = await getUserProfileFromFirestore(user.uid);
      if (userProfile && userProfile.themePreference) {
        applyTheme(userProfile.themePreference);
      } else {
        applyTheme(DEFAULT_THEME_NAME);
      }
    }
  } else {
    showMessageBox("Failed to save accessibility settings.", true);
  }
}

/**
 * Deletes the user account.
 */
async function deleteAccount() {
  await firebaseReadyPromise;
  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to delete your account.", true);
    return;
  }
  const password = deleteAccountPasswordInput.value;

  if (!password) {
    showMessageBox("Please enter your password to confirm account deletion.", true);
    return;
  }

  const confirmation = await showCustomConfirm(
    "Are you absolutely sure you want to delete your account?",
    "This action is permanent and cannot be undone."
  );

  if (!confirmation) {
    showMessageBox("Account deletion cancelled.", false);
    return;
  }

  try {
    // Re-authenticate user before deleting
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    // Delete user profile from Firestore first
    await deleteUserProfileFromFirestore(user.uid);
    // Then delete the Firebase Auth user
    await deleteUser(user);

    showMessageBox("Account deleted successfully! Redirecting to sign-up page...", false);
    setTimeout(() => {
      window.location.href = 'sign.html'; // Redirect to sign-up/login page
    }, 2000);
  } catch (error) {
    console.error("Error deleting account:", error);
    showMessageBox(`Error deleting account: ${error.message}`, true);
  }
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("settings.js - DOMContentLoaded event fired.");

  await firebaseReadyPromise; // Ensure Firebase is ready

  // Load navbar
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME); // Pass explicit values

  // Populate theme dropdown on load
  await populateThemeDropdown();

  // Check auth state and load settings or show login message
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await loadUserSettings();
      // Apply initial theme based on user preference or default
      const userProfile = await getUserProfileFromFirestore(user.uid);
      const allThemes = await getAvailableThemes();
      const themeToApply = allThemes.find(t => t.id === userProfile?.themePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
      applyTheme(themeToApply.id, themeToApply);
    } else {
      showLoginRequired();
    }
  });

  // Event listeners for buttons
  if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfileChanges);
  if (savePreferencesBtn) savePreferencesBtn.addEventListener('click', savePreferences);
  if (changePasswordBtn) changePasswordBtn.addEventListener('click', changePassword);
  if (saveNotificationsBtn) saveNotificationsBtn.addEventListener('click', saveNotifications);
  if (saveAccessibilityBtn) saveAccessibilityBtn.addEventListener('click', saveAccessibility);
  if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', deleteAccount);

  // Set current year for footer
  const currentYearElement = document.getElementById('current-year-settings');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }
});
