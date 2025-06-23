// settings.js: Handles user profile settings, account management, and theme/accessibility preferences.

// Import Firebase instances and user functions from the centralized init file
import {
  auth,
  db,
  appId,
  getCurrentUser,
  setupFirebaseAndUser,
  getUserProfileFromFirestore,
  updateUserProfileInFirestore
} from './firebase-init.js';

// Import theme management functions
import { setupCustomThemeManagement } from './custom_theme_modal.js';
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js';
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
  doc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// Declare DOM element variables; they will be assigned inside DOMContentLoaded
let profileSettingsSection;
let displayNameInput;
let handleInput;
let profilePicInput;
let profilePicPreview;
let saveProfileBtn;
let handleStatus;

let themeSelect;
let fontSizeSelect;
let fontFamilySelect;
let backgroundPatternSelect;
let saveThemeBtn;
let manageThemesBtn;

let accountSettingsSection;
let currentPasswordInput;
let newPasswordInput;
let confirmNewPasswordInput;
let updatePasswordBtn;
let deleteAccountBtn;

let notificationSettingsSection;
let emailNotificationsCheckbox;
let inAppNotificationsCheckbox;
let saveNotificationBtn;

let accessibilitySettingsSection;
let highContrastCheckbox;
let reducedMotionCheckbox;
let saveAccessibilityBtn;

let profileTabBtn;
let themeTabBtn;
let accountTabBtn;
let notificationTabBtn;
let accessibilityTabBtn;

let logoutBtn;

const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark';


/**
 * Updates the UI sections based on authentication status and user profile data.
 * This function now expects the DOM elements to be properly initialized.
 * @param {object|null} user - The Firebase User object or null if not logged in.
 */
async function updateUI(user) {
  const settingsContent = document.getElementById('settings-content');
  const loginRequiredMessage = document.getElementById('login-required-message');

  if (!settingsContent || !loginRequiredMessage) {
    console.error("Critical settings UI elements not found.");
    return;
  }

  if (user) {
    loginRequiredMessage.style.display = 'none';
    settingsContent.style.display = 'block';

    const userProfile = await getUserProfileFromFirestore(user.uid);
    const currentUser = getCurrentUser(); // Get the enriched user object

    // Populate Profile Settings
    if (displayNameInput) displayNameInput.value = userProfile?.displayName || user.displayName || '';
    if (handleInput) handleInput.value = userProfile?.handle || '';
    if (profilePicInput) profilePicInput.value = userProfile?.photoURL || user.photoURL || '';
    if (profilePicPreview) profilePicPreview.src = userProfile?.photoURL || user.photoURL || DEFAULT_PROFILE_PIC;

    // Populate Theme Settings
    const allThemes = await getAvailableThemes();
    if (themeSelect) {
      themeSelect.innerHTML = ''; // Clear existing options
      allThemes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.id;
        option.textContent = theme.name;
        themeSelect.appendChild(option);
      });
      themeSelect.value = userProfile?.themePreference || DEFAULT_THEME_NAME;
    }

    if (fontSizeSelect) fontSizeSelect.value = userProfile?.fontSizePreference || '16px';
    if (fontFamilySelect) fontFamilySelect.value = userProfile?.fontFamilyPreference || 'Inter, sans-serif';
    if (backgroundPatternSelect) backgroundPatternSelect.value = userProfile?.backgroundPatternPreference || 'none';


    // Populate Notification Settings
    if (emailNotificationsCheckbox) emailNotificationsCheckbox.checked = userProfile?.notificationPreferences?.email || false;
    if (inAppNotificationsCheckbox) inAppNotificationsCheckbox.checked = userProfile?.notificationPreferences?.inApp || false;

    // Populate Accessibility Settings
    if (highContrastCheckbox) highContrastCheckbox.checked = userProfile?.accessibilitySettings?.highContrast || false;
    if (reducedMotionCheckbox) reducedMotionCheckbox.checked = userProfile?.accessibilitySettings?.reducedMotion || false;
    // Apply immediately for visual feedback
    document.body.classList.toggle('high-contrast-mode', highContrastCheckbox?.checked || false);
    document.body.classList.toggle('reduced-motion', reducedMotionCheckbox?.checked || false);

    // Apply the user's theme immediately on UI load
    const themeToApply = allThemes.find(t => t.id === (themeSelect?.value || DEFAULT_THEME_NAME)) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    applyTheme(themeToApply.id, themeToApply);

    // Initial tab selection
    showSettingsTab('profile');

  } else {
    settingsContent.style.display = 'none';
    loginRequiredMessage.style.display = 'block';
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

/**
 * Checks if a handle is unique in Firestore.
 * @param {string} handle - The handle to check.
 * @param {string} currentUid - The UID of the current user (to exclude their own handle from the check).
 * @returns {Promise<boolean>} True if unique, false otherwise.
 */
async function isHandleUnique(handle, currentUid) {
  if (!db) {
    console.error("Firestore DB not initialized for handle uniqueness check.");
    return false;
  }
  const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
  const q = query(userProfilesRef, where("handle", "==", handle));
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty || (querySnapshot.docs.length === 1 && querySnapshot.docs[0].id === currentUid);
  } catch (error) {
    console.error("Error checking handle uniqueness:", error);
    showMessageBox("Error checking handle uniqueness.", true);
    return false;
  }
}

// --- EVENT LISTENERS ---
// Use DOMContentLoaded to ensure all HTML elements are loaded before accessing them
document.addEventListener('DOMContentLoaded', async () => {
  // Assign DOM elements after the document is ready
  profileSettingsSection = document.getElementById('profile-settings-section');
  displayNameInput = document.getElementById('display-name');
  handleInput = document.getElementById('handle');
  profilePicInput = document.getElementById('profile-pic-url');
  profilePicPreview = document.getElementById('profile-pic-preview');
  saveProfileBtn = document.getElementById('save-profile-btn');
  handleStatus = document.getElementById('handle-status');

  themeSelect = document.getElementById('theme-select');
  fontSizeSelect = document.getElementById('font-size-select');
  fontFamilySelect = document.getElementById('font-family-select');
  backgroundPatternSelect = document.getElementById('background-pattern-select');
  saveThemeBtn = document.getElementById('save-theme-btn');
  manageThemesBtn = document.getElementById('manage-themes-btn');

  accountSettingsSection = document.getElementById('account-settings-section');
  currentPasswordInput = document.getElementById('current-password');
  newPasswordInput = document.getElementById('new-password');
  confirmNewPasswordInput = document.getElementById('confirm-new-password');
  updatePasswordBtn = document.getElementById('update-password-btn');
  deleteAccountBtn = document.getElementById('delete-account-btn');

  notificationSettingsSection = document.getElementById('notification-settings-section');
  emailNotificationsCheckbox = document.getElementById('email-notifications');
  inAppNotificationsCheckbox = document.getElementById('in-app-notifications');
  saveNotificationBtn = document.getElementById('save-notification-btn');

  accessibilitySettingsSection = document.getElementById('accessibility-settings-section');
  highContrastCheckbox = document.getElementById('high-contrast');
  reducedMotionCheckbox = document.getElementById('reduced-motion');
  saveAccessibilityBtn = document.getElementById('save-accessibility-btn');

  profileTabBtn = document.getElementById('profile-tab-btn');
  themeTabBtn = document.getElementById('theme-tab-btn');
  accountTabBtn = document.getElementById('account-tab-btn');
  notificationTabBtn = document.getElementById('notification-tab-btn');
  accessibilityTabBtn = document.getElementById('accessibility-tab-btn');

  logoutBtn = document.getElementById('logout-btn');


  // Setup Firebase and user authentication first
  await setupFirebaseAndUser();
  // IMPORTANT: Initialize setupThemesFirebase AFTER setupFirebaseAndUser resolves
  setupThemesFirebase(db, auth, appId);

  // Load navbar after Firebase is ready
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Update UI based on initial authentication state
  updateUI(auth.currentUser);

  // Listen for auth state changes to update UI dynamically (e.g., after login/logout)
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

  // Handle uniqueness check with debounce
  let currentHandleTimeout;
  handleInput?.addEventListener('input', () => {
    clearTimeout(currentHandleTimeout);
    if (handleStatus) {
      handleStatus.textContent = 'Checking...';
      handleStatus.className = 'text-yellow-500';
    }

    const handle = handleInput.value.trim();
    if (handle.length === 0) {
      if (handleStatus) {
        handleStatus.textContent = 'Handle cannot be empty.';
        handleStatus.className = 'text-red-500';
      }
      return;
    }
    if (handle.length < 3 || handle.length > 20) {
      if (handleStatus) {
        handleStatus.textContent = 'Handle must be 3-20 characters.';
        handleStatus.className = 'text-red-500';
      }
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(handle)) {
      if (handleStatus) {
        handleStatus.textContent = 'Handle can only contain letters, numbers, _, ., -';
        handleStatus.className = 'text-red-500';
      }
      return;
    }

    currentHandleTimeout = setTimeout(async () => {
      const user = auth.currentUser;
      if (user) {
        const unique = await isHandleUnique(handle, user.uid);
        if (handleStatus) {
          if (unique) {
            handleStatus.textContent = 'Available!';
            handleStatus.className = 'text-green-500';
          } else {
            handleStatus.textContent = 'Taken.';
            handleStatus.className = 'text-red-500';
          }
        }
      } else {
        if (handleStatus) {
          handleStatus.textContent = 'Login to check handle availability.';
          handleStatus.className = 'text-gray-500';
        }
      }
    }, 500); // Debounce for 500ms
  });

  // Save Profile Settings
  saveProfileBtn?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showMessageBox("You must be logged in to save profile.", true);
      return;
    }

    const displayName = displayNameInput.value.trim();
    const handle = handleInput.value.trim();
    const photoURL = profilePicInput.value.trim();

    if (!handle) {
      showMessageBox("Handle cannot be empty.", true);
      return;
    }
    if (handle.length < 3 || handle.length > 20 || !/^[a-zA-Z0-9_.-]+$/.test(handle)) {
      showMessageBox("Handle must be 3-20 characters and contain only letters, numbers, _, ., -", true);
      return;
    }

    const unique = await isHandleUnique(handle, user.uid);
    if (!unique) {
      showMessageBox("Handle is already taken or invalid. Please choose another.", true);
      return;
    }

    const success = await updateUserProfileInFirestore(user.uid, {
      displayName: displayName,
      handle: handle,
      photoURL: photoURL
    });
    if (success) {
      showMessageBox("Profile updated successfully!", false);
      const navbarUserIcon = document.getElementById('navbar-user-profile-pic');
      if (navbarUserIcon) {
        navbarUserIcon.src = photoURL || DEFAULT_PROFILE_PIC;
      }
      const navbarUserDisplayName = document.getElementById('navbar-user-display-name');
      if (navbarUserDisplayName) {
        navbarUserDisplayName.textContent = displayName || 'Settings';
      }
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
      document.body.dataset.backgroundPattern = backgroundPattern;

      showMessageBox("Theme settings saved successfully!", false);
    }
  });

  // Manage Custom Themes (delegated to custom_theme_modal.js via setupCustomThemeManagement)
  manageThemesBtn?.addEventListener('click', () => {
    if (auth.currentUser) {
      setupCustomThemeManagement(db, auth, appId, showMessageBox, showCustomConfirm, getAvailableThemes, applyTheme, themeSelect, DEFAULT_THEME_NAME, auth.currentUser);
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

    // A proper re-authentication flow is needed here, as showCustomConfirm does not get password.
    // For a real application, you would implement a dedicated modal with an input field
    // for the user to enter their password before calling reauthenticateWithCredential.
    // For now, this will likely fail if the user's last sign-in was too long ago.
    try {
      // Placeholder for actual password input and reauthentication
      // const passwordEntered = prompt("Please enter your password to confirm:");
      // const credential = EmailAuthProvider.credential(user.email, passwordEntered);
      // await reauthenticateWithCredential(user, credential);

      await deleteUser(user);
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
    const inApp = inAppNotificationsCheckbox.checked;

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

  // Close Custom Confirm Modal when clicking its close button
  document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      if (modal) {
        modal.style.display = 'none';
      }
    });
  });

  // Close Custom Confirm Modal when clicking outside
  window.addEventListener('click', (event) => {
    const customConfirmModalElement = document.getElementById('custom-confirm-modal');
    if (event.target === customConfirmModalElement) {
      customConfirmModalElement.style.display = 'none';
    }
  });

  // Set the current year for the footer
  const currentYearElement = document.getElementById('current-year-settings');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }
});
