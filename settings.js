// settings.js: Handles user profile settings, account management, and theme/accessibility preferences.

// Import Firebase instances and user functions from the centralized init file
import {
  auth,
  db, // db instance is needed for local Firestore functions
  appId, // appId is needed for Firestore paths
  getCurrentUser,
  setupFirebaseAndUser,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME
} from './firebase-init.js';

// Import theme management functions
import { setupCustomThemeManagement } from './custom_theme_modal.js';
import { applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';
import { showMessageBox, showCustomConfirm } from './utils.js'; // Import message and confirm utilities

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  doc, // Explicitly import doc for Firestore operations
  getDoc, // Explicitly import getDoc for Firestore operations
  setDoc, // Explicitly import setDoc for Firestore operations
  deleteDoc, // Explicitly import deleteDoc for Firestore operations
  collection, // Needed for potential future queries, keeping for now
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// Declare DOM element variables and initialize them to null.
// They will be assigned their actual DOM element references inside DOMContentLoaded.
let profileSettingsSection = null;
let displayNameInput = null;
let profilePicInput = null;
let profilePicPreview = null;
let saveProfileBtn = null;

let themeSettingsSection = null;
let themeSelect = null;
let fontSizeSelect = null;
let fontFamilySelect = null;
let backgroundPatternSelect = null;
let saveThemeBtn = null;
let manageThemesBtn = null;

let accountSettingsSection = null;
let currentPasswordInput = null;
let newPasswordInput = null;
let confirmNewPasswordInput = null;
let updatePasswordBtn = null;
let deleteAccountBtn = null;

let notificationSettingsSection = null;
let emailNotificationsCheckbox = null;
let inAppNotificationsCheckbox = null;
let saveNotificationBtn = null;

let accessibilitySettingsSection = null;
let highContrastCheckbox = null;
let reducedMotionCheckbox = null;
let saveAccessibilityBtn = null;

let profileTabBtn = null;
let themeTabBtn = null;
let accountTabBtn = null;
let notificationTabBtn = null;
let accessibilityTabBtn = null;

let logoutBtn = null;

let profilePictureDisplay = null;
let displayNameText = null;
let emailText = null;
let lastLoginTimeDisplay = null;
let accountCreationTimeDisplay = null;
let deleteAccountPasswordInput = null;

let loadingSpinner = null;
let settingsContent = null;
let loginRequiredMessage = null;


/**
 * Populates the theme select dropdown with available themes.
 * @param {string} [selectedThemeId] - The ID of the theme to pre-select.
 */
async function populateThemeSelect(selectedThemeId) {
  if (!themeSelect) {
    console.error("Theme select element not found.");
    return;
  }
  themeSelect.innerHTML = ''; // Clear existing options
  const availableThemes = await getAvailableThemes();
  availableThemes.forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    themeSelect.appendChild(option);
  });
  if (selectedThemeId && availableThemes.some(t => t.id === selectedThemeId)) {
    themeSelect.value = selectedThemeId;
  } else {
    themeSelect.value = DEFAULT_THEME_NAME; // Fallback to default if selected not found
  }
}

/**
 * Fetches a user's profile data from the 'user_profiles' collection in Firestore.
 * This is a helper function used internally.
 * @param {string} uid - The User ID (UID) of the profile to fetch.
 * @returns {Promise<Object|null>} A Promise that resolves with the user's profile data object,
 * or `null` if the profile is not found or an error occurs.
 */
async function getUserProfileFromFirestore(uid) {
  // Ensure Firebase is ready before attempting Firestore operations
  await setupFirebaseAndUser(); // Ensure setupFirebaseAndUser has resolved
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
    showMessageBox(`Error fetching user profile: ${error.message}`, true);
  }
  return null;
}

/**
 * Updates a user's profile data in Firestore.
 * @param {string} uid - The User ID (UID) of the profile to update.
 * @param {Object} profileData - An object containing the fields to update (e.g., { displayName: "New Name" }).
 * @returns {Promise<boolean>} A Promise that resolves to true if the update was successful, false otherwise.
 */
async function updateUserProfileInFirestore(uid, profileData) {
  // Ensure Firebase is ready before attempting Firestore operations
  await setupFirebaseAndUser(); // Ensure setupFirebaseAndUser has resolved
  if (!db) {
    showMessageBox("Database not initialized. Cannot save profile.", true);
    return false;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, {
      merge: true
    }); // Use setDoc with merge for partial updates
    return true;
  } catch (error) {
    console.error("Error updating user profile in Firestore:", error);
    showMessageBox(`Error saving profile: ${error.message}`, true);
    return false;
  }
}


/**
 * Populates the settings UI elements with user profile data.
 * This function *only* populates, it does not control visibility.
 * @param {object} user - The Firebase User object.
 * @param {object|null} userProfile - The user's profile data from Firestore.
 */
async function populateSettingsUI(user, userProfile) {
  if (displayNameInput) displayNameInput.value = userProfile?.displayName || user.displayName || '';
  if (displayNameText) displayNameText.textContent = displayNameInput.value;
  if (emailText) emailText.textContent = user.email || '';

  if (profilePicInput) profilePicInput.value = userProfile?.photoURL || user.photoURL || '';
  if (profilePicPreview) profilePicPreview.src = userProfile?.photoURL || user.photoURL || DEFAULT_PROFILE_PIC;
  if (profilePictureDisplay) profilePictureDisplay.src = userProfile?.photoURL || user.photoURL || DEFAULT_PROFILE_PIC;

  await populateThemeSelect(userProfile?.themePreference); // Populate dropdown and select current theme

  if (fontSizeSelect) fontSizeSelect.value = userProfile?.fontSizePreference || '16px';
  if (fontFamilySelect) fontFamilySelect.value = userProfile?.fontFamilyPreference || 'Inter, sans-serif';
  if (backgroundPatternSelect) backgroundPatternSelect.value = userProfile?.backgroundPatternPreference || 'none';

  if (emailNotificationsCheckbox) emailNotificationsCheckbox.checked = userProfile?.notificationPreferences?.email || false;
  if (inAppNotificationsCheckbox) inAppNotificationsCheckbox.checked = userProfile?.notificationPreferences?.inApp || false;

  if (highContrastCheckbox) highContrastCheckbox.checked = userProfile?.accessibilitySettings?.highContrast || false;
  if (reducedMotionCheckbox) reducedMotionCheckbox.checked = userProfile?.accessibilitySettings?.reducedMotion || false;
  // Apply accessibility classes immediately for feedback
  document.body.classList.toggle('high-contrast-mode', highContrastCheckbox?.checked || false);
  document.body.classList.toggle('reduced-motion', reducedMotionCheckbox?.checked || false);

  if (user.metadata && lastLoginTimeDisplay && accountCreationTimeDisplay) {
    lastLoginTimeDisplay.textContent = `Last Login: ${new Date(user.metadata.lastSignInTime).toLocaleString()}`;
    accountCreationTimeDisplay.textContent = `Account Created: ${new Date(user.metadata.creationTime).toLocaleString()}`;
  }

  // Apply the user's theme, font size, and font family immediately
  const themeToApply = (await getAvailableThemes()).find(t => t.id === (themeSelect?.value || DEFAULT_THEME_NAME)) || (await getAvailableThemes()).find(t => t.id === DEFAULT_THEME_NAME);
  applyTheme(themeToApply.id, themeToApply);
  document.body.style.fontSize = fontSizeSelect?.value || '16px';
  document.body.style.fontFamily = fontFamilySelect?.value || 'Inter, sans-serif';

  document.body.classList.remove('pattern-dots', 'pattern-grid');
  if (backgroundPatternSelect?.value !== 'none') {
    document.body.classList.add(`pattern-${backgroundPatternSelect?.value}`);
  }

  // Initial tab selection
  showSettingsTab('profile');
}


/**
 * Updates the UI sections based on authentication status and user profile data.
 * This function now controls the visibility of main content sections.
 * @param {object|null} user - The Firebase User object or null if not logged in.
 */
async function updateUI(user) {
  if (!settingsContent || !loginRequiredMessage || !loadingSpinner) {
    console.error("Critical settings UI elements not found for updateUI.");
    return;
  }

  // Always show spinner while loading user profile and preferences
  loadingSpinner.style.display = 'flex';
  settingsContent.style.display = 'none';
  loginRequiredMessage.style.display = 'none';

  if (user) {
    const userProfile = await getUserProfileFromFirestore(user.uid);
    await populateSettingsUI(user, userProfile); // Populate fields
    loadingSpinner.style.display = 'none';
    settingsContent.style.display = 'block'; // Show content for logged-in users
  } else {
    loadingSpinner.style.display = 'none';
    loginRequiredMessage.style.display = 'block'; // Show login message for logged-out users
    // Apply default theme if not logged in
    const allThemes = await getAvailableThemes();
    const defaultThemeObj = allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    applyTheme(defaultThemeObj.id, defaultThemeObj);
  }
}

/**
 * Shows the selected settings tab and hides others.
 * @param {string} tabId - The ID of the tab to show (e.g., 'profile', 'theme', 'account').
 */
function showSettingsTab(tabId) {
  // Ensure all sections and buttons are defined before attempting to access them
  const sections = [profileSettingsSection, themeSettingsSection, accountSettingsSection, notificationSettingsSection, accessibilitySettingsSection];
  const buttons = [profileTabBtn, themeTabBtn, accountTabBtn, notificationTabBtn, accessibilityTabBtn];

  sections.forEach(section => section && section.classList.add('hidden'));
  buttons.forEach(button => button && button.classList.remove('active-tab'));

  // Show selected content and activate selected button
  switch (tabId) {
    case 'profile':
      profileSettingsSection && profileSettingsSection.classList.remove('hidden');
      profileTabBtn && profileTabBtn.classList.add('active-tab');
      break;
    case 'theme':
      themeSettingsSection && themeSettingsSection.classList.remove('hidden');
      themeTabBtn && themeTabBtn.classList.add('active-tab');
      break;
    case 'account':
      accountSettingsSection && accountSettingsSection.classList.remove('hidden');
      accountTabBtn && accountTabBtn.classList.add('active-tab');
      break;
    case 'notifications':
      notificationSettingsSection && notificationSettingsSection.classList.remove('hidden');
      notificationTabBtn && notificationTabBtn.classList.add('active-tab');
      break;
    case 'accessibility':
      accessibilitySettingsSection && accessibilitySettingsSection.classList.remove('hidden');
      accessibilityTabBtn && accessibilityTabBtn.classList.add('active-tab');
      break;
  }
}

// --- EVENT LISTENERS ---
// Use DOMContentLoaded to ensure all HTML elements are loaded before accessing them
document.addEventListener('DOMContentLoaded', async () => {
  // Assign DOM elements after the document is ready
  loadingSpinner = document.getElementById('loading-spinner');
  settingsContent = document.getElementById('settings-content');
  loginRequiredMessage = document.getElementById('login-required-message');

  profileSettingsSection = document.getElementById('profile-settings-section');
  displayNameInput = document.getElementById('display-name-input');
  profilePicInput = document.getElementById('profile-picture-url-input');
  profilePicPreview = document.getElementById('profile-picture-display');
  saveProfileBtn = document.getElementById('save-profile-btn');

  profilePictureDisplay = document.getElementById('profile-picture-display');
  displayNameText = document.getElementById('display-name-text');
  emailText = document.getElementById('email-text');
  lastLoginTimeDisplay = document.getElementById('last-login-time');
  accountCreationTimeDisplay = document.getElementById('account-creation-time');
  deleteAccountPasswordInput = document.getElementById('delete-account-password');

  themeSettingsSection = document.getElementById('theme-settings-section');
  themeSelect = document.getElementById('theme-select');
  fontSizeSelect = document.getElementById('font-size-select');
  fontFamilySelect = document.getElementById('font-family-select');
  backgroundPatternSelect = document.getElementById('background-pattern-select');
  saveThemeBtn = document.getElementById('save-preferences-btn');
  manageThemesBtn = document.getElementById('create-custom-theme-btn');

  accountSettingsSection = document.getElementById('account-settings-section');
  currentPasswordInput = document.getElementById('current-password-input');
  newPasswordInput = document.getElementById('new-password-input');
  confirmNewPasswordInput = document.getElementById('confirm-new-password-input');
  updatePasswordBtn = document.getElementById('change-password-btn');
  deleteAccountBtn = document.getElementById('delete-account-btn');

  notificationSettingsSection = document.getElementById('notification-settings-section');
  emailNotificationsCheckbox = document.getElementById('email-notifications-checkbox');
  inAppNotificationsCheckbox = document.getElementById('inapp-notifications-checkbox');
  saveNotificationBtn = document.getElementById('save-notifications-btn');

  accessibilitySettingsSection = document.getElementById('accessibility-settings-section');
  highContrastCheckbox = document.getElementById('high-contrast-checkbox');
  reducedMotionCheckbox = document.getElementById('reduced-motion-checkbox');
  saveAccessibilityBtn = document.getElementById('save-accessibility-btn');

  // Tab buttons (assuming these are correctly defined in HTML based on your structure)
  profileTabBtn = document.getElementById('profile-tab-btn');
  themeTabBtn = document.getElementById('theme-tab-btn');
  accountTabBtn = document.getElementById('account-tab-btn');
  notificationTabBtn = document.getElementById('notification-tab-btn');
  accessibilityTabBtn = document.getElementById('accessibility-tab-btn');

  logoutBtn = document.getElementById('logout-btn');


  // Setup Firebase and user authentication first (this also sets up the onAuthStateChanged listener)
  await setupFirebaseAndUser();

  // Load navbar after Firebase is ready
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Initial UI update based on current auth state. The onAuthStateChanged listener will handle subsequent changes.
  updateUI(auth.currentUser);

  // Listen for auth state changes to update UI dynamically (e.g., after login/logout)
  // This listener is crucial and ensures the UI reacts to Firebase auth changes.
  auth.onAuthStateChanged(async (user) => {
    console.log("Auth state changed in settings.js:", user ? user.uid : "Signed out");
    updateUI(user);
  });

  // Tab button event listeners
  profileTabBtn?.addEventListener('click', () => showSettingsTab('profile'));
  themeTabBtn?.addEventListener('click', () => showSettingsTab('theme'));
  accountTabBtn?.addEventListener('click', () => showSettingsTab('account'));
  notificationTabBtn?.addEventListener('click', () => showSettingsTab('notifications'));
  accessibilityTabBtn?.addEventListener('click', () => showSettingsTab('accessibility'));

  // Profile picture preview
  profilePicInput?.addEventListener('input', () => {
    if (profilePicPreview) {
      profilePicPreview.src = profilePicInput.value || DEFAULT_PROFILE_PIC;
    }
  });


  // Save Profile Settings
  saveProfileBtn?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showMessageBox("You must be logged in to save profile.", true);
      return;
    }

    const displayName = displayNameInput.value.trim();
    const photoURL = profilePicInput.value.trim();

    const success = await updateUserProfileInFirestore(user.uid, {
      displayName: displayName,
      photoURL: photoURL
    });
    if (success) {
      showMessageBox("Profile updated successfully!", false);
      // Update navbar profile pic and display name
      const navbarUserIcon = document.getElementById('navbar-user-profile-pic');
      if (navbarUserIcon) {
        navbarUserIcon.src = photoURL || DEFAULT_PROFILE_PIC;
      }
      const navbarUserDisplayName = document.getElementById('navbar-user-display-name');
      if (navbarUserDisplayName) {
        navbarUserDisplayName.textContent = displayName || 'Settings';
      }
      // Update the profile display on the settings page itself
      if (displayNameText) displayNameText.textContent = displayName;
      if (profilePictureDisplay) profilePictureDisplay.src = photoURL || DEFAULT_PROFILE_PIC;
    }
  });

  // Save Theme Settings
  saveThemeBtn?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showMessageBox("You must be logged in to save theme settings.", true);
      return;
    }

    const selectedTheme = themeSelect.value;
    const fontSize = fontSizeSelect.value;
    const fontFamily = fontFamilySelect.value;
    const backgroundPattern = backgroundPatternSelect.value;

    const success = await updateUserProfileInFirestore(user.uid, {
      themePreference: selectedTheme,
      fontSizePreference: fontSize,
      fontFamilyPreference: fontFamily,
      backgroundPatternPreference: backgroundPattern
    });

    if (success) {
      const allThemes = await getAvailableThemes();
      const themeToApply = allThemes.find(t => t.id === selectedTheme) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
      applyTheme(themeToApply.id, themeToApply);
      document.body.style.fontSize = fontSize;
      document.body.style.fontFamily = fontFamily;
      // Remove existing patterns first
      document.body.classList.remove('pattern-dots', 'pattern-grid');
      if (backgroundPattern !== 'none') {
        document.body.classList.add(`pattern-${backgroundPattern}`);
      }

      showMessageBox("Theme settings saved successfully!", false);
    }
  });

  // Manage Custom Themes (delegated to custom_theme_modal.js via setupCustomThemeManagement)
  manageThemesBtn?.addEventListener('click', () => {
    if (auth.currentUser) {
      // Pass correctly imported Firebase instances and utility functions
      setupCustomThemeManagement(db, auth, appId, showMessageBox, populateThemeSelect, themeSelect, DEFAULT_THEME_NAME, auth.currentUser);
    } else {
      showMessageBox("You must be logged in to manage themes.", true);
    }
  });


  // Update Password
  updatePasswordBtn?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showMessageBox("You must be logged in to update your password.", true);
      return;
    }

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showMessageBox("Please fill in all password fields.", true);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showMessageBox("New password and confirmation do not match.", true);
      return;
    }
    if (newPassword.length < 6) {
      showMessageBox("New password must be at least 6 characters long.", true);
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
      console.error("Error updating password:", error);
      let errorMessage = "Failed to update password.";
      if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect current password.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password is too weak. Choose a stronger one.";
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = "Please log out and log back in to update your password.";
      }
      showMessageBox(errorMessage, true);
    }
  });

  // Delete Account
  deleteAccountBtn?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showMessageBox("You must be logged in to delete your account.", true);
      return;
    }

    const confirmation = await showCustomConfirm(
      "Are you sure you want to delete your account?",
      "This action is irreversible and will delete all your data."
    );

    if (!confirmation) {
      showMessageBox("Account deletion cancelled.", false);
      return;
    }

    const passwordToConfirm = deleteAccountPasswordInput.value;
    if (!passwordToConfirm) {
      showMessageBox("Please enter your password to confirm account deletion.", true);
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, passwordToConfirm);
      await reauthenticateWithCredential(user, credential);

      // Delete user from Firebase Auth
      await deleteUser(user);
      // Correct Firestore data deletion syntax using doc and deleteDoc
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, user.uid));

      showMessageBox("Your account has been deleted.", false);
      signOut(auth);
      window.location.href = 'sign.html';
    } catch (error) {
      console.error("Error deleting account:", error);
      let errorMessage = "Failed to delete account.";
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = "Please log out and log back in to delete your account (due to recent login requirement).";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect password. Account deletion failed.";
      }
      showMessageBox(errorMessage, true);
    }
  });

  // Save Notification Settings
  saveNotificationBtn?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showMessageBox("You must be logged in to save notification settings.", true);
      return;
    }
    const email = emailNotificationsCheckbox.checked;
    const inApp = inappNotificationsCheckbox.checked;

    const success = await updateUserProfileInFirestore(user.uid, {
      notificationPreferences: {
        email: email,
        inApp: inApp
      }
    });
    if (success) {
      showMessageBox("Notification settings saved successfully!", false);
    }
  });

  // Save Accessibility Settings
  saveAccessibilityBtn?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showMessageBox("You must be logged in to save accessibility settings.", true);
      return;
    }
    const highContrast = highContrastCheckbox.checked;
    const reducedMotion = reducedMotionCheckbox.checked;

    const success = await updateUserProfileInFirestore(user.uid, {
      accessibilitySettings: {
        highContrast: highContrast,
        reducedMotion: reducedMotion
      }
    });
    if (success) {
      document.body.classList.toggle('high-contrast-mode', highContrast);
      document.body.classList.toggle('reduced-motion', reducedMotion);
      showMessageBox("Accessibility settings saved successfully!", false);
    }
  });

  // General close button logic for OTHER modals (e.g., custom_theme_modal)
  document.querySelectorAll('.modal .close-button').forEach(button => {
    const modal = button.closest('.modal');
    // Ensure this doesn't interfere with the custom-confirm-modal which is handled by utils.js
    if (modal && modal.id !== 'custom-confirm-modal') {
      button.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
  });

  // General outside click logic for OTHER modals (not custom-confirm-modal)
  window.addEventListener('click', (event) => {
    document.querySelectorAll('.modal').forEach(modal => {
      // Exclude custom-confirm-modal, which has its own click-outside logic in utils.js
      if (modal.id !== 'custom-confirm-modal') {
        const modalContent = modal.querySelector('.modal-content');
        // Only close if the click is directly on the modal overlay (not its content)
        if (modal.style.display === 'flex' && modalContent && !modalContent.contains(event.target) && event.target === modal) {
          modal.style.display = 'none';
        }
      }
    });
  });

  // Set the current year for the footer
  const currentYearElement = document.getElementById('current-year-settings');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }
});

// window.onload is no longer needed here as DOMContentLoaded handles all necessary initialization.
// Any code below this point will execute after DOMContentLoaded but before window.onload,
// but the core setup is managed by the DOMContentLoaded listener.
