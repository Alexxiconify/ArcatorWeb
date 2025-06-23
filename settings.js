// settings.js: Handles user settings, including profile, preferences,
// password management, notifications, accessibility, and account deletion.

// Import necessary Firebase SDK functions (these imports are still needed for direct Firebase SDK calls like updatePassword, etc.)
import { EmailAuthProvider, updatePassword, reauthenticateWithCredential, deleteUser, updateProfile, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import local module functions, including the centralized Firebase instances
import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js'; // Corrected syntax
import { showMessageBox, showCustomConfirm, sanitizeHandle } from './utils.js';
import { getUserProfileFromFirestore, setUserProfileInFirestore, deleteUserProfileFromFirestore, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, auth, db, appId, firebaseReadyPromise } from './firebase-init.js';


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
  if (settingsContent) settingsContent.style.display = 'block'; // Make settings content visible
  if (loginRequiredMessage) loginRequiredMessage.style.display = 'none'; // Ensure login message is hidden
}

/**
 * Displays the login required message.
 */
function showLoginRequired() {
  console.log("DEBUG: showLoginRequired called. Hiding settings content, showing login message.");
  if (loadingSpinner) loadingSpinner.style.display = 'none';
  if (settingsContent) settingsContent.style.display = 'none'; // Ensure settings content is hidden
  if (loginRequiredMessage) loginRequiredMessage.style.display = 'block';
}


/**
 * Populates the theme dropdown with available themes.
 */
async function populateThemeDropdown() {
  console.log("DEBUG: populateThemeDropdown called.");
  const themes = await getAvailableThemes();
  if (themeSelect) {
    themeSelect.innerHTML = ''; // Clear existing options
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
    hideLoading(); // Ensure spinner is hidden
    return;
  }

  console.log("DEBUG: loadUserSettings: User is authenticated. Populating initial UI from FirebaseAuth user object.");
  // Populate profile section with initial Firebase Auth data
  if (displayNameText) {
    displayNameText.textContent = user.displayName || 'Set Display Name';
    console.log("DEBUG: loadUserSettings: Set displayNameText from Auth:", displayNameText.textContent);
  }
  if (emailText) {
    emailText.textContent = user.email || 'N/A';
    console.log("DEBUG: loadUserSettings: Set emailText from Auth:", emailText.textContent);
  }
  if (profilePictureDisplay) {
    profilePictureDisplay.src = user.photoURL || DEFAULT_PROFILE_PIC;
    console.log("DEBUG: loadUserSettings: Set profilePictureDisplay.src from Auth:", profilePictureDisplay.src);
  }
  if (displayNameInput) {
    displayNameInput.value = user.displayName || '';
    console.log("DEBUG: loadUserSettings: Set displayNameInput.value from Auth:", displayNameInput.value);
  }
  if (profilePictureUrlInput) {
    profilePictureUrlInput.value = user.photoURL || '';
    console.log("DEBUG: loadUserSettings: Set profilePictureUrlInput.value from Auth:", profilePictureUrlInput.value);
  }


  // Fetch user profile from Firestore
  console.log("DEBUG: loadUserSettings: Attempting to fetch user profile from Firestore for UID:", user.uid);
  const userProfile = await getUserProfileFromFirestore(user.uid);
  console.log("DEBUG: loadUserSettings: User profile fetched from Firestore:", userProfile);

  // Use optional chaining and nullish coalescing for safer access and default values
  // This ensures fields are always set, even if userProfile or its properties are undefined.
  if (userProfile) {
    console.log("DEBUG: loadUserSettings: User profile exists in Firestore. Populating UI with Firestore data.");
    console.log("DEBUG: loadUserSettings: userProfile.displayName:", userProfile.displayName);
    console.log("DEBUG: loadUserSettings: userProfile.photoURL:", userProfile.photoURL);
    console.log("DEBUG: loadUserSettings: userProfile.themePreference:", userProfile.themePreference);
    console.log("DEBUG: loadUserSettings: userProfile.fontSize:", userProfile.fontSize);
    console.log("DEBUG: loadUserSettings: userProfile.fontFamily:", userProfile.fontFamily);
    console.log("DEBUG: loadUserSettings: userProfile.backgroundPattern:", userProfile.backgroundPattern);

    // Update display name and picture from Firestore, falling back to Auth data if Firestore is empty
    if (displayNameText) displayNameText.textContent = userProfile.displayName || user.displayName || 'Set Display Name';
    if (profilePictureDisplay) profilePictureDisplay.src = userProfile.photoURL || user.photoURL || DEFAULT_PROFILE_PIC;
    if (displayNameInput) displayNameInput.value = userProfile.displayName || user.displayName || '';
    if (profilePictureUrlInput) profilePictureUrlInput.value = userProfile.photoURL || user.photoURL || '';

    // Set preferences from Firestore, with sensible defaults
    if (themeSelect) {
      themeSelect.value = userProfile.themePreference || DEFAULT_THEME_NAME;
      console.log("DEBUG: loadUserSettings: Applied theme preference from Firestore (or default):", themeSelect.value);
    }
    if (fontSizeSelect) {
      fontSizeSelect.value = userProfile.fontSize || '16px'; // Default font size
      console.log("DEBUG: loadUserSettings: Applied font size preference from Firestore (or default):", fontSizeSelect.value);
    }
    if (fontFamilySelect) {
      fontFamilySelect.value = userProfile.fontFamily || 'Inter, sans-serif'; // Default font family
      console.log("DEBUG: loadUserSettings: Applied font family preference from Firestore (or default):", fontFamilySelect.value);
    }
    if (backgroundPatternSelect) {
      backgroundPatternSelect.value = userProfile.backgroundPattern || 'none'; // Default background pattern
      console.log("DEBUG: loadUserSettings: Applied background pattern preference from Firestore (or default):", backgroundPatternSelect.value);
    }
    if (emailNotificationsCheckbox) {
      emailNotificationsCheckbox.checked = userProfile.emailNotifications ?? false; // Use nullish coalescing for boolean
      console.log("DEBUG: loadUserSettings: Email notifications checked:", emailNotificationsCheckbox.checked);
    }
    if (inappNotificationsCheckbox) {
      inappNotificationsCheckbox.checked = userProfile.inAppNotifications ?? false;
      console.log("DEBUG: loadUserSettings: In-app notifications checked:", inappNotificationsCheckbox.checked);
    }
    if (highContrastCheckbox) {
      highContrastCheckbox.checked = userProfile.highContrastMode ?? false;
      console.log("DEBUG: loadUserSettings: High contrast checked:", highContrastCheckbox.checked);
    }
    if (reducedMotionCheckbox) {
      reducedMotionCheckbox.checked = userProfile.reducedMotion ?? false;
      console.log("DEBUG: loadUserSettings: Reduced motion checked:", reducedMotionCheckbox.checked);
    }
  } else {
    console.warn("WARNING: loadUserSettings: No user profile found in Firestore for UID:", user.uid, ". Applying default settings to UI.");
    // If no user profile exists in Firestore, ensure all fields are set to defaults
    if (themeSelect) themeSelect.value = DEFAULT_THEME_NAME;
    if (fontSizeSelect) fontSizeSelect.value = '16px';
    if (fontFamilySelect) fontFamilySelect.value = 'Inter, sans-serif';
    if (backgroundPatternSelect) backgroundPatternSelect.value = 'none';
    if (emailNotificationsCheckbox) emailNotificationsCheckbox.checked = false;
    if (inappNotificationsCheckbox) inappNotificationsCheckbox.checked = false;
    if (highContrastCheckbox) highContrastCheckbox.checked = false;
    if (reducedMotionCheckbox) reducedMotionCheckbox.checked = false;
  }

  // Session Information (always from user.metadata, as it's from Auth)
  if (user.metadata) {
    if (lastLoginTimeElement && user.metadata.lastSignInTime) {
      lastLoginTimeElement.textContent = `Last Login: ${new Date(user.metadata.lastSignInTime).toLocaleString()}`;
      console.log("DEBUG: loadUserSettings: Set Last Login Time:", lastLoginTimeElement.textContent);
    } else if (lastLoginTimeElement) {
      lastLoginTimeElement.textContent = `Last Login: N/A`; // Ensure it's not stuck on "Loading..."
      console.warn("WARNING: loadUserSettings: lastLoginTimeElement found but user.metadata.lastSignInTime is missing.");
    }
    if (accountCreationTimeElement && user.metadata.creationTime) {
      accountCreationTimeElement.textContent = `Account Created: ${new Date(user.metadata.creationTime).toLocaleString()}`;
      console.log("DEBUG: loadUserSettings: Set Account Creation Time:", accountCreationTimeElement.textContent);
    } else if (accountCreationTimeElement) {
      accountCreationTimeElement.textContent = `Account Created: N/A`; // Ensure it's not stuck on "Loading..."
      console.warn("WARNING: loadUserSettings: accountCreationTimeElement found but user.metadata.creationTime is missing.");
    }
  } else {
    console.warn("WARNING: loadUserSettings: User metadata not available.");
    if (lastLoginTimeElement) lastLoginTimeElement.textContent = `Last Login: N/A`;
    if (accountCreationTimeElement) accountCreationTimeElement.textContent = `Account Created: N/A`;
  }

  console.log("DEBUG: --- Finished loadUserSettings ---");
  hideLoading(); // Hide spinner and show content after data population attempt
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
  };
  const success = await setUserProfileInFirestore(user.uid, profileData);
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

  const success = await setUserProfileInFirestore(user.uid, preferences);
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

  const success = await setUserProfileInFirestore(user.uid, notifications);
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

  const success = await setUserProfileInFirestore(user.uid, accessibility);
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

  // Pass setupThemesFirebase the imported db, auth, and appId
  setupThemesFirebase(db, auth, appId);

  // Load navbar
  await loadNavbar({ auth: auth, db: db, appId: appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Populate theme dropdown on load
  await populateThemeDropdown();

  // Check auth state and load settings or show login message
  onAuthStateChanged(auth, async (user) => {
    console.log("DEBUG: settings.js onAuthStateChanged. User:", user ? user.uid : "null");
    if (user) {
      console.log("DEBUG: User authenticated. Attempting to call loadUserSettings().");
      try {
        await loadUserSettings();
      } catch (e) {
        console.error("ERROR: settings.js - Error calling loadUserSettings:", e);
        showMessageBox("Error loading user settings. Please try again.", true);
        hideLoading(); // Ensure spinner is hidden on error
      }
      // Apply initial theme based on user preference or default
      const userProfile = await getUserProfileFromFirestore(user.uid);
      const allThemes = await getAvailableThemes();
      const themeToApply = allThemes.find(t => t.id === userProfile?.themePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
      applyTheme(themeToApply.id, userProfile?.themePreference); // Pass userProfile.themePreference directly for applyTheme
    } else {
      console.log("DEBUG: User not authenticated. Calling showLoginRequired().");
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
  console.log("DEBUG: settings.js - DOMContentLoaded event listener finished.");
});
