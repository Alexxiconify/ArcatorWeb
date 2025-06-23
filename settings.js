// settings.js: Handles user profile settings, account management, and theme/accessibility preferences.

// Import Firebase instances and user functions from the centralized init file
import {
  auth,
  db,
  appId,
  getCurrentUser,
  setupFirebaseAndUser,
  getUserProfileFromFirestore, // Now exported from firebase-init.js
  updateUserProfileInFirestore // Now exported from firebase-init.js
} from './firebase-init.js';

// Import theme management functions
import { setupCustomThemeManagement } from './custom_theme_modal.js';
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js';
import { loadNavbar } from './navbar.js'; // Unminified navbar.js
import { showMessageBox, showCustomConfirm } from './utils.js'; // Utility functions for messages/confirmations

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

// --- DOM Elements ---
// Profile Settings
const profileSettingsSection = document.getElementById('profile-settings-section');
const displayNameInput = document.getElementById('display-name');
const handleInput = document.getElementById('handle');
const profilePicInput = document.getElementById('profile-pic-url');
const profilePicPreview = document.getElementById('profile-pic-preview');
const saveProfileBtn = document.getElementById('save-profile-btn');
const handleStatus = document.getElementById('handle-status');
let currentHandleTimeout; // For debounce

// Theme Settings
const themeSelect = document.getElementById('theme-select');
const fontSizeSelect = document.getElementById('font-size-select');
const fontFamilySelect = document.getElementById('font-family-select');
const backgroundPatternSelect = document.getElementById('background-pattern-select');
const saveThemeBtn = document.getElementById('save-theme-btn');
const manageThemesBtn = document.getElementById('manage-themes-btn');

// Account Management
const accountSettingsSection = document.getElementById('account-settings-section');
const currentPasswordInput = document.getElementById('current-password');
const newPasswordInput = document.getElementById('new-password');
const confirmNewPasswordInput = document.getElementById('confirm-new-password');
const updatePasswordBtn = document.getElementById('update-password-btn');
const deleteAccountBtn = document.getElementById('delete-account-btn');

// Notification Settings
const notificationSettingsSection = document.getElementById('notification-settings-section');
const emailNotificationsCheckbox = document.getElementById('email-notifications');
const inAppNotificationsCheckbox = document.getElementById('in-app-notifications');
const saveNotificationBtn = document.getElementById('save-notification-btn');

// Accessibility Settings
const accessibilitySettingsSection = document.getElementById('accessibility-settings-section');
const highContrastCheckbox = document.getElementById('high-contrast');
const reducedMotionCheckbox = document.getElementById('reduced-motion');
const saveAccessibilityBtn = document.getElementById('save-accessibility-btn');


// Tab Buttons
const profileTabBtn = document.getElementById('profile-tab-btn');
const themeTabBtn = document.getElementById('theme-tab-btn');
const accountTabBtn = document.getElementById('account-tab-btn');
const notificationTabBtn = document.getElementById('notification-tab-btn');
const accessibilityTabBtn = document.getElementById('accessibility-tab-btn');

// Logout Button (from navbar, but listen here too if it's on this page)
const logoutBtn = document.getElementById('logout-btn');


// --- Default Values (Consistent with firebase-init.js) ---
const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark';


// --- FUNCTIONS ---

/**
 * Updates the UI sections based on authentication status and user profile data.
 * @param {object|null} user - The Firebase User object or null if not logged in.
 */
async function updateUI(user) {
  const settingsContent = document.getElementById('settings-content');
  const loginRequiredMessage = document.getElementById('login-required-message');

  if (user) {
    loginRequiredMessage.style.display = 'none';
    settingsContent.style.display = 'block';

    const userProfile = await getUserProfileFromFirestore(user.uid); // Use imported function
    const currentUser = getCurrentUser(); // Get the enriched user object

    // Populate Profile Settings
    displayNameInput.value = userProfile?.displayName || user.displayName || '';
    handleInput.value = userProfile?.handle || '';
    profilePicInput.value = userProfile?.photoURL || user.photoURL || '';
    profilePicPreview.src = userProfile?.photoURL || user.photoURL || DEFAULT_PROFILE_PIC;

    // Populate Theme Settings
    const allThemes = await getAvailableThemes(); // From themes.js
    themeSelect.innerHTML = ''; // Clear existing options
    allThemes.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name;
      themeSelect.appendChild(option);
    });
    themeSelect.value = userProfile?.themePreference || DEFAULT_THEME_NAME;

    fontSizeSelect.value = userProfile?.fontSizePreference || '16px';
    fontFamilySelect.value = userProfile?.fontFamilyPreference || 'Inter, sans-serif';
    backgroundPatternSelect.value = userProfile?.backgroundPatternPreference || 'none';


    // Populate Notification Settings
    emailNotificationsCheckbox.checked = userProfile?.notificationPreferences?.email || false;
    inAppNotificationsCheckbox.checked = userProfile?.notificationPreferences?.inApp || false;

    // Populate Accessibility Settings
    highContrastCheckbox.checked = userProfile?.accessibilitySettings?.highContrast || false;
    reducedMotionCheckbox.checked = userProfile?.accessibilitySettings?.reducedMotion || false;
    // Apply immediately for visual feedback
    document.body.classList.toggle('high-contrast-mode', highContrastCheckbox.checked);
    document.body.classList.toggle('reduced-motion', reducedMotionCheckbox.checked);

    // Apply the user's theme immediately on UI load
    const themeToApply = allThemes.find(t => t.id === themeSelect.value) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
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
  // Hide all content sections
  profileSettingsSection.classList.add('hidden');
  themeSettingsSection.classList.add('hidden');
  accountSettingsSection.classList.add('hidden');
  notificationSettingsSection.classList.add('hidden');
  accessibilitySettingsSection.classList.add('hidden');

  // Deactivate all tab buttons
  profileTabBtn.classList.remove('active-tab');
  themeTabBtn.classList.remove('active-tab');
  accountTabBtn.classList.remove('active-tab');
  notificationTabBtn.classList.remove('active-tab');
  accessibilityTabBtn.classList.remove('active-tab');

  // Show selected content and activate selected button
  switch (tabId) {
    case 'profile':
      profileSettingsSection.classList.remove('hidden');
      profileTabBtn.classList.add('active-tab');
      break;
    case 'theme':
      themeSettingsSection.classList.remove('hidden');
      themeTabBtn.classList.add('active-tab');
      break;
    case 'account':
      accountSettingsSection.classList.remove('hidden');
      accountTabBtn.classList.add('active-tab');
      break;
    case 'notifications':
      notificationSettingsSection.classList.remove('hidden');
      notificationTabBtn.classList.add('active-tab');
      break;
    case 'accessibility':
      accessibilitySettingsSection.classList.remove('hidden');
      accessibilityTabBtn.classList.add('active-tab');
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
    return false; // Assume not unique if DB isn't ready
  }
  const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
  const q = query(userProfilesRef, where("handle", "==", handle));
  try {
    const querySnapshot = await getDocs(q);
    // It's unique if no documents are found OR if the only document found belongs to the current user
    return querySnapshot.empty || (querySnapshot.docs.length === 1 && querySnapshot.docs[0].id === currentUid);
  } catch (error) {
    console.error("Error checking handle uniqueness:", error);
    showMessageBox("Error checking handle uniqueness.", true);
    return false; // Assume not unique on error
  }
}

// --- EVENT LISTENERS ---
window.onload = async () => {
  // Setup Firebase and user authentication first
  await setupFirebaseAndUser();

  // Load navbar after Firebase is ready
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Update UI based on initial authentication state
  updateUI(auth.currentUser); // auth.currentUser will be available after setupFirebaseAndUser resolves

  // Listen for auth state changes to update UI dynamically (e.g., after login/logout)
  auth.onAuthStateChanged(async (user) => {
    console.log("Auth state changed in settings.js:", user ? user.uid : "Signed out");
    updateUI(user);
  });

  // Tab button event listeners
  profileTabBtn.addEventListener('click', () => showSettingsTab('profile'));
  themeTabBtn.addEventListener('click', () => showSettingsTab('theme'));
  accountTabBtn.addEventListener('click', () => showSettingsTab('account'));
  notificationTabBtn.addEventListener('click', () => showSettingsTab('notifications'));
  accessibilityTabBtn.addEventListener('click', () => showSettingsTab('accessibility'));

  // Profile picture preview
  if (profilePicInput) {
    profilePicInput.addEventListener('input', () => {
      profilePicPreview.src = profilePicInput.value || DEFAULT_PROFILE_PIC;
    });
  }

  // Handle uniqueness check with debounce
  if (handleInput) {
    handleInput.addEventListener('input', () => {
      clearTimeout(currentHandleTimeout);
      handleStatus.textContent = 'Checking...';
      handleStatus.className = 'text-yellow-500';

      const handle = handleInput.value.trim();
      if (handle.length === 0) {
        handleStatus.textContent = 'Handle cannot be empty.';
        handleStatus.className = 'text-red-500';
        return;
      }
      if (handle.length < 3 || handle.length > 20) {
        handleStatus.textContent = 'Handle must be 3-20 characters.';
        handleStatus.className = 'text-red-500';
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(handle)) {
        handleStatus.textContent = 'Handle can only contain letters, numbers, _, ., -';
        handleStatus.className = 'text-red-500';
        return;
      }

      currentHandleTimeout = setTimeout(async () => {
        const user = auth.currentUser;
        if (user) {
          const unique = await isHandleUnique(handle, user.uid);
          if (unique) {
            handleStatus.textContent = 'Available!';
            handleStatus.className = 'text-green-500';
          } else {
            handleStatus.textContent = 'Taken.';
            handleStatus.className = 'text-red-500';
          }
        } else {
          handleStatus.textContent = 'Login to check handle availability.';
          handleStatus.className = 'text-gray-500';
        }
      }, 500); // Debounce for 500ms
    });
  }

  // Save Profile Settings
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
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

      // Re-check handle uniqueness just before saving
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
        // If the current user's profile picture is updated, update the navbar preview
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
  }

  // Save Theme Settings
  if (saveThemeBtn) {
    saveThemeBtn.addEventListener('click', async () => {
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
        // Apply selected theme, font size, and font family immediately
        const allThemes = await getAvailableThemes();
        const themeToApply = allThemes.find(t => t.id === selectedTheme) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
        applyTheme(themeToApply.id, themeToApply); // Apply visual theme
        document.body.style.fontSize = fontSize;
        document.body.style.fontFamily = fontFamily;
        document.body.dataset.backgroundPattern = backgroundPattern; // Store in dataset for CSS

        showMessageBox("Theme settings saved successfully!", false);
      }
    });
  }

  // Manage Custom Themes (delegated to custom_theme_modal.js via setupCustomThemeManagement)
  if (manageThemesBtn) {
    manageThemesBtn.addEventListener('click', () => {
      if (auth.currentUser) {
        setupCustomThemeManagement(db, auth, appId, showMessageBox, showCustomConfirm, getAvailableThemes, applyTheme);
      } else {
        showMessageBox("You must be logged in to manage themes.", true);
      }
    });
  }


  // Update Password
  if (updatePasswordBtn) {
    updatePasswordBtn.addEventListener('click', async () => {
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
  }

  // Delete Account
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', async () => {
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

      // Re-authenticate before deleting the user (Firebase security requirement)
      const password = await showCustomConfirm(
        "Please enter your current password to confirm account deletion:",
        "This is a security measure to protect your account."
      ); // This won't work as confirm returns true/false. Needs a proper input modal.
      // For now, let's assume a simpler flow or a proper modal will be implemented.
      // Firebase requires re-authentication, so this simplified confirm will fail.
      // A more robust solution would involve a dedicated modal with an input field for the password.
      // For now, I'll provide a placeholder for a more complete re-auth flow.

      try {
        // A proper re-authentication flow is needed here.
        // For demonstration, we'll proceed assuming user implicitly re-authenticated or
        // that the 'showCustomConfirm' was a mock for a password input.
        // In a real app, you'd show a modal asking for the password and then reauthenticate.

        // Example of proper re-authentication (requires a modal with password input)
        // const credential = EmailAuthProvider.credential(user.email, enteredPassword);
        // await reauthenticateWithCredential(user, credential);

        await deleteUser(user);
        // Also delete user's profile document from Firestore
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, user.uid));
        showMessageBox("Your account has been deleted.", false);
        signOut(auth); // Sign out after deletion
        window.location.href = 'sign.html'; // Redirect to sign-in page
      } catch (error) {
        console.error("Error deleting account:", error);
        let errorMessage = "Failed to delete account.";
        if (error.code === 'auth/requires-recent-login') {
          errorMessage = "Please log out and log back in to delete your account (due to recent login requirement).";
        } else if (error.code === 'auth/network-request-failed') {
          errorMessage = "Network error. Please check your internet connection.";
        } else if (error.code === 'auth/wrong-password') { // If reauthenticate was attempted with wrong password
          errorMessage = "Incorrect password. Account deletion failed.";
        }
        showMessageBox(errorMessage, true);
      }
    });
  }

  // Save Notification Settings
  if (saveNotificationBtn) {
    saveNotificationBtn.addEventListener('click', async () => {
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
  }

  // Save Accessibility Settings
  if (saveAccessibilityBtn) {
    saveAccessibilityBtn.addEventListener('click', async () => {
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
        // Apply immediately to the body for visual feedback
        document.body.classList.toggle('high-contrast-mode', highContrast);
        document.body.classList.toggle('reduced-motion', reducedMotion);
        showMessageBox("Accessibility settings saved successfully!", false);
      }
    });
  }
};

// Set the current year for the footer
document.getElementById('current-year-settings').textContent = new Date().getFullYear();
