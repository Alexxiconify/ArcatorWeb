// settings.js: Handles user settings, including profile, preferences,
// password management, notifications, accessibility, and account deletion.

// --- Firebase SDK Imports (External) ---
import { EmailAuthProvider, updatePassword, reauthenticateWithCredential, deleteUser, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Local Module Imports ---
import {
  auth,
  db,
  appId,
  firebaseReadyPromise,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME,
  getUserProfileFromFirestore,
  setUserProfileInFirestore,
  deleteUserProfileFromFirestore
} from './firebase-init.js';

import { applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';
import { showMessageBox, showCustomConfirm, sanitizeHandle } from './utils.js';


// --- DOM Elements ---
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


// --- Helper Functions ---

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
  // Ensure Firebase is ready and auth.currentUser is populated BEFORE proceeding
  await firebaseReadyPromise;
  const user = auth.currentUser;
  console.log("DEBUG: loadUserSettings: Current user object from Auth:", user);
  console.log("DEBUG: loadUserSettings: Current user UID:", user ? user.uid : "none");


  if (!user) {
    console.log("DEBUG: loadUserSettings: User not authenticated, showing login required message.");
    showLoginRequired();
    hideLoading();
    return;
  }

  // If user is anonymous, show login required and return
  if (user.isAnonymous) {
    console.log("DEBUG: loadUserSettings: Anonymous user logged in. Showing login required message for full settings.");
    showLoginRequired();
    hideLoading();
    return;
  }


  console.log("DEBUG: loadUserSettings: User is authenticated (non-anonymous). Populating initial UI from FirebaseAuth user object.");
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
  if (!user || user.isAnonymous) { showMessageBox("You must be logged in with a non-anonymous account to save profile changes.", true); return; }

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
  if (!user || user.isAnonymous) { showMessageBox("You must be logged in with a non-anonymous account to save preferences.", true); return; }

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
  if (!user || user.isAnonymous) { showMessageBox("You must be logged in with a non-anonymous account to change password.", true); return; }
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
  if (!user || user.isAnonymous) { showMessageBox("You must be logged in with a non-anonymous account to save notification settings.", true); return; }

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
  if (!user || user.isAnonymous) { showMessageBox("You must be logged in with a non-anonymous account to save accessibility settings.", true); return; }

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
  if (!user || user.isAnonymous) { showMessageBox("You must be logged in with a non-anonymous account to delete your account.", true); return; }
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

  // Wait for firebase-init.js to initialize Firebase and resolve its promise.
  await firebaseReadyPromise;

  // Load navbar after Firebase is ready
  // It's crucial to pass auth.currentUser as it will be populated after firebaseReadyPromise resolves.
  if (auth && auth.currentUser) {
    await loadNavbar(auth.currentUser, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
  } else {
    // If no user is authenticated, still load the navbar but pass null for user.
    await loadNavbar(null, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
  }


  // Populate theme dropdown with available themes
  await populateThemeDropdown();

  // Load user settings only AFTER firebaseReadyPromise has resolved and auth.currentUser is set
  if (auth && auth.currentUser) {
    // Check if the user is anonymous. If so, show the login required message.
    if (auth.currentUser.isAnonymous) {
      console.log("DEBUG: Anonymous user on settings page. Showing login required.");
      showLoginRequired();
      hideLoading();
      await applyTheme(DEFAULT_THEME_NAME); // Apply default theme for anonymous users
      return; // Stop further settings loading for anonymous users
    }

    console.log("DEBUG: User authenticated (non-anonymous) after initial setup. Calling loadUserSettings().");
    try {
      await loadUserSettings();
    } catch (e) {
      console.error("ERROR: settings.js - Error calling loadUserSettings:", e);
      showMessageBox("Error loading user settings. Please try again.", true);
      hideLoading();
    }
    // Apply initial theme based on user preference or default
    const userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userProfile?.themePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    await applyTheme(themeToApply.id); // applyTheme now expects just the theme ID
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
ad
