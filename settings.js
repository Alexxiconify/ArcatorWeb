// settings.js: Handles user settings for profile, personalization, security, and accessibility.

import { auth, db, appId, getCurrentUser, setupFirebaseAndUser } from './firebase-init.js';
import { showMessageBox, showCustomConfirm, getUserProfileFromFirestore, updateUserProfileInFirestore } from './utils.js';
import { setupCustomThemeManagement } from './custom_theme_modal.js';
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js'; // Global themes

import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, collection, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- Default Values (consistent with firebase-init.js) ---
const DEFAULT_PROFILE_PIC = 'https://placehold.co/128x128/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark';

// --- DOM Elements ---
const loadingSpinner = document.getElementById('loading-spinner');
const settingsContent = document.getElementById('settings-content');
const loginRequiredMessage = document.getElementById('login-required-message');

// Profile Info
const profilePictureDisplay = document.getElementById('profile-picture-display');
const displayNameText = document.getElementById('display-name-text');
const emailText = document.getElementById('email-text');
const displayNameInput = document.getElementById('display-name-input');
const handleInput = document.getElementById('handle-input');
const handleMessage = document.getElementById('handle-message');
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


/**
 * Checks if a handle is unique in Firestore (case-insensitive).
 * This is a local helper function for settings page handle validation.
 * @param {string} handle - The handle to check.
 * @param {string} currentUid - The UID of the current user (to allow their own handle).
 * @returns {Promise<boolean>} True if unique, false otherwise.
 */
async function isHandleUnique(handle, currentUid) {
  if (!db) {
    console.error("Firestore DB not initialized for isHandleUnique.");
    return false;
  }
  if (!handle) return false;

  const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
  const q = query(userProfilesRef, where("handle", "==", handle));
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty || (querySnapshot.docs.length === 1 && querySnapshot.docs[0].id === currentUid);
  } catch (error) {
    console.error("Error checking handle uniqueness:", error);
    return false;
  }
}

/**
 * Populates the theme selection dropdown with available themes.
 * @param {string} selectedThemeId - The ID of the currently selected theme.
 */
async function populateThemeSelect(selectedThemeId) {
  if (!userThemeSelect) return;
  userThemeSelect.innerHTML = '';
  const availableThemes = await getAvailableThemes();
  availableThemes.forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    userThemeSelect.appendChild(option);
  });

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

  const user = getCurrentUser(); // Get the globally managed current user
  if (!user) {
    loadingSpinner.style.display = 'none';
    loginRequiredMessage.style.display = 'block';
    return;
  }

  emailText.textContent = user.email;

  // Fetch user profile from Firestore (which also uses the global db and appId)
  const userProfile = await getUserProfileFromFirestore(user.uid);

  // Set profile info
  displayNameInput.value = userProfile?.displayName || user.displayName || user.email.split('@')[0];
  displayNameText.textContent = displayNameInput.value;
  handleInput.value = userProfile?.handle || '';

  const photoURL = userProfile?.photoURL || user.photoURL || DEFAULT_PROFILE_PIC;
  profilePictureUrlInput.value = photoURL === DEFAULT_PROFILE_PIC ? '' : photoURL;
  profilePictureDisplay.src = photoURL;

  // Set theme preference
  const themePreference = userProfile?.themePreference || DEFAULT_THEME_NAME;
  await populateThemeSelect(themePreference);

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
  document.body.classList.remove('pattern-dots', 'pattern-grid');
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


// Main execution logic on window load
window.onload = async function() {
  // Ensure custom confirm modal is hidden initially
  const customConfirmModal = document.getElementById('custom-confirm-modal');
  if (customConfirmModal) {
    customConfirmModal.style.display = 'none';
  }
  // Ensure theme management modal is hidden initially (if it exists on this page)
  const themeManagementModal = document.getElementById('theme-management-modal');
  if (themeManagementModal) {
    themeManagementModal.style.display = 'none';
  }


  await setupFirebaseAndUser(); // Initialize Firebase and get current user
  const currentUser = getCurrentUser(); // Get the user object after setup


  // Load navbar (always load regardless of auth state)
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Set current year for footer
  document.getElementById('current-year-settings').textContent = new Date().getFullYear();

  // Initialize user settings
  await initializeUserSettings();


  // --- Event Listeners ---

  // Handle input changes for handle uniqueness check
  if (handleInput) {
    handleInput.addEventListener('input', async () => {
      const newHandle = handleInput.value.trim();
      if (!currentUser) return; // Cannot validate if no user logged in.

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

      const unique = await isHandleUnique(newHandle, currentUser.uid);
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
      if (!currentUser) {
        showMessageBox("You must be logged in to save profile changes.", true);
        return;
      }

      const newDisplayName = displayNameInput.value.trim();
      const newHandle = handleInput.value.trim();
      let newPhotoURL = profilePictureUrlInput.value.trim();

      if (!newHandle) {
        showMessageBox("Handle is required.", true);
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(newHandle)) {
        showMessageBox("Handle can only contain letters, numbers, underscores, periods, and hyphens.", true);
        return;
      }
      if (newHandle.length < 3 || newHandle.length > 20) {
        showMessageBox("Handle must be between 3 and 20 characters.", true);
        return;
      }

      const uniqueHandle = await isHandleUnique(newHandle, currentUser.uid);
      if (!uniqueHandle) {
        showMessageBox("The chosen handle is already taken or invalid. Please choose another.", true);
        return;
      }


      if (newPhotoURL === '') {
        newPhotoURL = DEFAULT_PROFILE_PIC;
      }

      const success = await updateUserProfileInFirestore(currentUser.uid, {
        displayName: newDisplayName,
        photoURL: newPhotoURL,
        handle: newHandle
      });

      if (success) {
        displayNameText.textContent = newDisplayName;
        profilePictureDisplay.src = newPhotoURL;
        showMessageBox("Profile updated successfully!", false);

        // Update Firebase Auth profile (displayName and photoURL)
        await auth.currentUser.updateProfile({
          displayName: newDisplayName,
          photoURL: newPhotoURL
        }).catch(error => {
          console.error("Error updating Auth profile:", error);
          showMessageBox(`Error updating profile in Auth: ${error.message}`, true);
        });
      }
    });
  }

  // Save Preferences (Theme, Font Size, Font Family, Background Pattern)
  if (savePreferencesBtn) {
    savePreferencesBtn.addEventListener('click', async () => {
      if (!currentUser) {
        showMessageBox("You must be logged in to save preferences.", true);
        return;
      }

      const newTheme = userThemeSelect.value;
      const newFontSize = userFontSizeSelect.value;
      const newFontFamily = userFontFamilySelect.value;
      const newBackgroundPattern = userBackgroundPatternSelect.value;

      const success = await updateUserProfileInFirestore(currentUser.uid, {
        themePreference: newTheme,
        fontSizePreference: newFontSize,
        fontFamilyPreference: newFontFamily,
        backgroundPatternPreference: newBackgroundPattern
      });

      if (success) {
        document.body.style.fontSize = newFontSize;
        document.body.style.fontFamily = newFontFamily;
        document.body.classList.remove('pattern-dots', 'pattern-grid');
        if (newBackgroundPattern !== 'none') {
          document.body.classList.add(`pattern-${newBackgroundPattern}`);
        }

        const allThemes = await getAvailableThemes();
        const selectedTheme = allThemes.find(t => t.id === newTheme);
        applyTheme(selectedTheme.id, selectedTheme);

        showMessageBox("Preferences saved successfully!", false);
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
      const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
      if (urlRegex.test(url)) {
        profilePictureDisplay.src = url;
        urlPreviewMessage.style.display = 'block';
        urlPreviewMessage.textContent = 'Previewing new image. Click Save to apply.';
        urlPreviewMessage.classList.remove('text-red-500');
        urlPreviewMessage.classList.add('text-gray-500'); // Use a generic success/info color
      } else {
        profilePictureDisplay.src = DEFAULT_PROFILE_PIC;
        urlPreviewMessage.textContent = 'Invalid URL. Please enter a valid direct link to an image.';
        urlPreviewMessage.classList.remove('text-gray-500');
        urlPreviewMessage.classList.add('text-red-500');
        urlPreviewMessage.style.display = 'block';
      }
    });
    profilePictureDisplay.onerror = function() {
      this.src = DEFAULT_PROFILE_PIC;
      urlPreviewMessage.textContent = 'Image failed to load. Check the URL or use a different one.';
      urlPreviewMessage.classList.remove('text-gray-500');
      urlPreviewMessage.classList.add('text-red-500');
      urlPreviewMessage.style.display = 'block';
    };
  }

  // Create Custom Theme Button setup
  if (createCustomThemeBtn) {
    // Pass the actual current user (from firebase-init) to setupCustomThemeManagement
    setupCustomThemeManagement(db, auth, appId, showMessageBox, populateThemeSelect, userThemeSelect, DEFAULT_THEME_NAME, currentUser);
  } else {
    console.warn("Create Custom Theme button not found.");
  }

  // Change Password
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', async () => {
      if (!currentUser) {
        showMessageBox("You must be logged in to change your password.", true);
        return;
      }
      if (!currentUser.email) { // Password-based auth requires an email
        showMessageBox("Password changes are not available for anonymous accounts.", true);
        return;
      }

      const currentPassword = currentPasswordInput.value;
      const newPassword = newPasswordInput.value;
      const confirmNewPassword = confirmNewPasswordInput.value;

      if (!currentPassword || !newPassword || !confirmNewPassword) {
        showMessageBox("All password fields are required.", true);
        return;
      }
      if (newPassword !== confirmNewPassword) {
        showMessageBox("New passwords do not match.", true);
        return;
      }
      if (newPassword.length < 6) {
        showMessageBox("New password must be at least 6 characters long.", true);
        return;
      }

      try {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);

        showMessageBox("Password changed successfully!", false);
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmNewPasswordInput.value = '';
      } catch (error) {
        console.error("Error changing password:", error);
        let errorMessage = "Failed to change password.";
        if (error.code === "auth/wrong-password") {
          errorMessage = "Incorrect current password.";
        } else if (error.code === "auth/user-mismatch" || error.code === "auth/user-not-found") {
          errorMessage = "Authentication error. Please re-login.";
        } else if (error.code === "auth/weak-password") {
          errorMessage = "New password is too weak.";
        }
        showMessageBox(errorMessage, true);
      }
    });
  }

  // Account Deletion
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', async () => {
      if (!currentUser) {
        showMessageBox("You must be logged in to delete your account.", true);
        return;
      }
      if (!currentUser.email) { // Anonymous users don't have passwords to confirm deletion
        showMessageBox("Anonymous accounts can be deleted instantly by clearing browser data or by Google Admin. No password confirmation needed.", true);
        await deleteUser(currentUser).then(() => {
          showMessageBox("Anonymous account deleted successfully. Redirecting...", false);
          setTimeout(() => { window.location.href = 'sign.html'; }, 2000);
        }).catch(error => {
          console.error("Error deleting anonymous account:", error);
          showMessageBox(`Error deleting account: ${error.message}`, true);
        });
        return;
      }

      const passwordToConfirm = deleteAccountPasswordInput.value;
      if (!passwordToConfirm) {
        showMessageBox("Please enter your password to confirm account deletion.", true);
        return;
      }

      const confirmation = await showCustomConfirm(
        "Are you absolutely sure you want to delete your account?",
        "This action is irreversible. All your data will be permanently lost!"
      );

      if (!confirmation) {
        showMessageBox("Account deletion cancelled.", false);
        return;
      }

      try {
        const credential = EmailAuthProvider.credential(currentUser.email, passwordToConfirm);
        await reauthenticateWithCredential(currentUser, credential);

        await deleteDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid));
        await deleteUser(currentUser);

        showMessageBox("Account deleted successfully! Redirecting...", false);
        setTimeout(() => {
          window.location.href = 'sign.html';
        }, 2000);

      } catch (error) {
        console.error("Error deleting account:", error);
        let errorMessage = "Failed to delete account.";
        if (error.code === "auth/wrong-password") {
          errorMessage = "Incorrect password. Account deletion failed.";
        } else if (error.code === "auth/requires-recent-login") {
          errorMessage = "Please re-login recently to delete your account (due to security policies).";
        }
        showMessageBox(errorMessage, true);
      }
    });
  }

  // Save Notification Preferences
  if (saveNotificationsBtn) {
    saveNotificationsBtn.addEventListener('click', async () => {
      if (!currentUser) {
        showMessageBox("You must be logged in to save notification settings.", true);
        return;
      }
      const emailNotifications = emailNotificationsCheckbox.checked;
      const inAppNotifications = inappNotificationsCheckbox.checked;

      const success = await updateUserProfileInFirestore(currentUser.uid, {
        notificationPreferences: {
          email: emailNotifications,
          inApp: inAppNotifications
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
      if (!currentUser) {
        showMessageBox("You must be logged in to save accessibility settings.", true);
        return;
      }
      const highContrast = highContrastCheckbox.checked;
      const reducedMotion = reducedMotionCheckbox.checked;

      const success = await updateUserProfileInFirestore(currentUser.uid, {
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
  }
};
