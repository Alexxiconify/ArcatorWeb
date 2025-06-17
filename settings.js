import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
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
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  setupCustomThemeManagement
} from './custom_theme_modal.min.js';
import {
  applyTheme,
  getAvailableThemes,
  setupThemesFirebase
} from './themes.min.js';
import {
  loadNavbar
} from './navbar.min.js';
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
let firebaseReadyPromise;
let isFirebaseInitialized = false;
const DEFAULT_PROFILE_PIC = 'https://placehold.co/128x128/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark';
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
const userFontFamilySelect = document.getElementById('font-family-select');
const userBackgroundPatternSelect = document.getElementById('background-pattern-select');
const savePreferencesBtn = document.getElementById('save-preferences-btn');
const createCustomThemeBtn = document.getElementById('create-custom-theme-btn');
const currentPasswordInput = document.getElementById('current-password-input');
const newPasswordInput = document.getElementById('new-password-input');
const confirmNewPasswordInput = document.getElementById('confirm-new-password-input');
const changePasswordBtn = document.getElementById('change-password-btn');
const deleteAccountPasswordInput = document.getElementById('delete-account-password');
const deleteAccountBtn = document.getElementById('delete-account-btn');
const lastLoginTimeDisplay = document.getElementById('last-login-time');
const accountCreationTimeDisplay = document.getElementById('account-creation-time');
const emailNotificationsCheckbox = document.getElementById('email-notifications-checkbox');
const inappNotificationsCheckbox = document.getElementById('inapp-notifications-checkbox');
const saveNotificationsBtn = document.getElementById('save-notifications-btn');
const highContrastCheckbox = document.getElementById('high-contrast-checkbox');
const reducedMotionCheckbox = document.getElementById('reduced-motion-checkbox');
const saveAccessibilityBtn = document.getElementById('save-accessibility-btn');
const messageBox = document.getElementById('message-box');
const customConfirmModal = document.getElementById('custom-confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmSubmessage = document.getElementById('confirm-submessage');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');
window.showMessageBox = function(message, isError) {
  const msgBox = document.getElementById('message-box');
  if (msgBox) {
    msgBox.textContent = message;
    msgBox.className = 'message-box';
    if (isError) {
      msgBox.classList.add('error')
    } else {
      msgBox.classList.add('success')
    }
    msgBox.style.display = 'block';
    setTimeout(() => {
      msgBox.style.display = 'none'
    }, 5000)
  } else {
    console.warn("Message box element not found.")
  }
};

function showCustomConfirm(message, subMessage = '') {
  return new Promise(resolve => {
    confirmMessage.textContent = message;
    confirmSubmessage.textContent = subMessage;
    customConfirmModal.style.display = 'flex';
    const onConfirm = () => {
      customConfirmModal.style.display = 'none';
      confirmYesBtn.removeEventListener('click', onConfirm);
      confirmNoBtn.removeEventListener('click', onCancel);
      resolve(true)
    };
    const onCancel = () => {
      customConfirmModal.style.display = 'none';
      confirmYesBtn.removeEventListener('click', onConfirm);
      confirmNoBtn.removeEventListener('click', onCancel);
      resolve(false)
    };
    confirmYesBtn.addEventListener('click', onConfirm);
    confirmNoBtn.addEventListener('click', onCancel)
  })
}
async function getUserProfileFromFirestore(uid) {
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore.");
    return null
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data()
    }
  } catch (error) {
    console.error("Error fetching user profile from Firestore:", error);
    window.showMessageBox(`Error fetching user profile: ${error.message}`, true)
  }
  return null
}
async function updateUserProfileInFirestore(uid, profileData) {
  await firebaseReadyPromise;
  if (!db) {
    window.showMessageBox("Database not initialized. Cannot save profile.", true);
    return false
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, {
      merge: true
    });
    return true
  } catch (error) {
    console.error("Error updating user profile in Firestore:", error);
    window.showMessageBox(`Error saving profile: ${error.message}`, true);
    return false
  }
}
async function populateThemeSelect(selectedThemeId) {
  userThemeSelect.innerHTML = '';
  const availableThemes = await getAvailableThemes();
  availableThemes.forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    userThemeSelect.appendChild(option)
  });
  if (selectedThemeId && availableThemes.some(t => t.id === selectedThemeId)) {
    userThemeSelect.value = selectedThemeId
  } else {
    userThemeSelect.value = DEFAULT_THEME_NAME
  }
}
async function initializeUserSettings() {
  loadingSpinner.style.display = 'flex';
  settingsContent.style.display = 'none';
  loginRequiredMessage.style.display = 'none';
  await firebaseReadyPromise;
  if (!auth.currentUser) {
    loadingSpinner.style.display = 'none';
    loginRequiredMessage.style.display = 'block';
    return
  }
  const user = auth.currentUser;
  emailText.textContent = user.email;
  const userProfile = await getUserProfileFromFirestore(user.uid);
  displayNameInput.value = userProfile ? .displayName || user.displayName || user.email.split('@')[0];
  displayNameText.textContent = displayNameInput.value;
  const photoURL = userProfile ? .photoURL || user.photoURL || DEFAULT_PROFILE_PIC;
  profilePictureUrlInput.value = photoURL === DEFAULT_PROFILE_PIC ? '' : photoURL;
  profilePictureDisplay.src = photoURL;
  const themePreference = userProfile ? .themePreference || DEFAULT_THEME_NAME;
  await populateThemeSelect(themePreference);
  const fontSizePreference = userProfile ? .fontSizePreference || '16px';
  userFontSizeSelect.value = fontSizePreference;
  document.body.style.fontSize = fontSizePreference;
  const fontFamilyPreference = userProfile ? .fontFamilyPreference || 'Inter, sans-serif';
  userFontFamilySelect.value = fontFamilyPreference;
  document.body.style.fontFamily = fontFamilyPreference;
  const backgroundPatternPreference = userProfile ? .backgroundPatternPreference || 'none';
  userBackgroundPatternSelect.value = backgroundPatternPreference;
  document.body.classList.remove('pattern-dots', 'pattern-grid');
  if (backgroundPatternPreference !== 'none') {
    document.body.classList.add(`pattern-${backgroundPatternPreference}`)
  }
  emailNotificationsCheckbox.checked = userProfile ? .notificationPreferences ? .email || false;
  inappNotificationsCheckbox.checked = userProfile ? .notificationPreferences ? .inApp || false;
  highContrastCheckbox.checked = userProfile ? .accessibilitySettings ? .highContrast || false;
  reducedMotionCheckbox.checked = userProfile ? .accessibilitySettings ? .reducedMotion || false;
  if (user.metadata) {
    lastLoginTimeDisplay.textContent = `Last Login: ${new Date(user.metadata.lastSignInTime).toLocaleString()}`;
    accountCreationTimeDisplay.textContent = `Account Created: ${new Date(user.metadata.creationTime).toLocaleString()}`
  }
  loadingSpinner.style.display = 'none';
  settingsContent.style.display = 'block'
}
firebaseReadyPromise = new Promise(resolve => {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseInitialized = true;
    console.log("Firebase initialized successfully.");
    setupThemesFirebase(db, auth, appId);
    const unsubscribe = onAuthStateChanged(auth, async user => {
      console.log("onAuthStateChanged triggered during initialization. User:", user ? user.uid : "none");
      unsubscribe();
      if (typeof __initial_auth_token !== 'undefined' && !user) {
        signInWithCustomToken(auth, __initial_auth_token).then(() => console.log("DEBUG: Signed in with custom token from Canvas (settings page) during init.")).catch(error => {
          console.error("ERROR: Error signing in with custom token (settings page) during init:", error);
          signInAnonymously(auth).then(() => console.log("DEBUG: Signed in anonymously (settings page) after custom token failure during init.")).catch(anonError => console.error("ERROR: Error signing in anonymously on settings page during init:", anonError));
        }).finally(() => resolve());
      } else if (!user && typeof __initial_auth_token === 'undefined') {
        signInAnonymously(auth).then(() => console.log("DEBUG: Signed in anonymously (no custom token) on settings page during init.")).catch(anonError => console.error("ERROR: Error signing in anonymously on settings page during init:", anonError)).finally(() => resolve());
      } else {
        resolve()
      }
    });
  }
} catch (e) {
  console.error("Error initializing Firebase (initial block):", e);
  window.showMessageBox("Error initializing Firebase. Please ensure your Firebase config is provided.", true);
  resolve()
}
});
window.onload = async function() {
  await firebaseReadyPromise;
  await loadNavbar({
    auth,
    db,
    appId
  }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
  document.getElementById('current-year-settings').textContent = (new Date).getFullYear();
  if (isFirebaseInitialized) {
    await initializeUserSettings()
  } else {
    loadingSpinner.style.display = 'none';
    loginRequiredMessage.style.display = 'block';
    window.showMessageBox("Firebase is not initialized. Please ensure your Firebase config is provided.", true)
  }
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to save profile changes.", true);
        return
      }
      const newDisplayName = displayNameInput.value.trim();
      let newPhotoURL = profilePictureUrlInput.value.trim();
      if (newPhotoURL === '') {
        newPhotoURL = DEFAULT_PROFILE_PIC
      }
      const success = await updateUserProfileInFirestore(auth.currentUser.uid, {
        displayName: newDisplayName,
        photoURL: newPhotoURL
      });
      if (success) {
        displayNameText.textContent = newDisplayName;
        profilePictureDisplay.src = newPhotoURL;
        window.showMessageBox("Profile updated successfully!", false);
        await auth.currentUser.updateProfile({
          displayName: newDisplayName,
          photoURL: newPhotoURL
        }).catch(error => console.error("Error updating Auth profile:", error));
      }
    })
  }
  if (savePreferencesBtn) {
    savePreferencesBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to save preferences.", true);
        return
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
        document.body.classList.remove('pattern-dots', 'pattern-grid');
        if (newBackgroundPattern !== 'none') {
          document.body.classList.add(`pattern-${newBackgroundPattern}`)
        }
        const allThemes = await getAvailableThemes();
        const selectedTheme = allThemes.find(t => t.id === newTheme);
        applyTheme(selectedTheme.id, selectedTheme);
        window.showMessageBox("Preferences saved successfully!", false);
      }
    })
  }
  if (profilePictureUrlInput && profilePictureDisplay && urlPreviewMessage) {
    profilePictureUrlInput.addEventListener('input', () => {
      const url = profilePictureUrlInput.value.trim();
      if (url === '') {
        profilePictureDisplay.src = DEFAULT_PROFILE_PIC;
        urlPreviewMessage.style.display = 'none';
        return
      }
      const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
      if (urlRegex.test(url)) {
        profilePictureDisplay.src = url;
        urlPreviewMessage.style.display = 'block';
        urlPreviewMessage.textContent = 'Previewing new image. Click Save to apply.';
        urlPreviewMessage.classList.remove('text-red-500');
        urlPreviewMessage.classList.add('text-secondary');
      } else {
        profilePictureDisplay.src = DEFAULT_PROFILE_PIC;
        urlPreviewMessage.textContent = 'Invalid URL. Please enter a valid direct link to an image.';
        urlPreviewMessage.classList.remove('text-secondary');
        urlPreviewMessage.classList.add('text-red-500');
        urlPreviewMessage.style.display = 'block';
      }
    });
    profilePictureDisplay.onerror = function() {
      this.src = DEFAULT_PROFILE_PIC;
      urlPreviewMessage.textContent = 'Image failed to load. Check the URL or use a different one.';
      urlPreviewMessage.classList.remove('text-secondary');
      urlPreviewMessage.classList.add('text-red-500');
      urlPreviewMessage.style.display = 'block';
    };
  }
  if (createCustomThemeBtn && isFirebaseInitialized) {
    setupCustomThemeManagement(db, auth, appId, window.showMessageBox, populateThemeSelect, userThemeSelect, DEFAULT_THEME_NAME, auth.currentUser);
  } else if (!createCustomThemeBtn) {
    console.warn("Create Custom Theme button not found.")
  }
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to change your password.", true);
        return
      }
      const currentPassword = currentPasswordInput.value;
      const newPassword = newPasswordInput.value;
      const confirmNewPassword = confirmNewPasswordInput.value;
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        window.showMessageBox("All password fields are required.", true);
        return
      }
      if (newPassword !== confirmNewPassword) {
        window.showMessageBox("New passwords do not match.", true);
        return
      }
      if (newPassword.length < 6) {
        window.showMessageBox("New password must be at least 6 characters long.", true);
        return
      }
      try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
        window.showMessageBox("Password changed successfully!", false);
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmNewPasswordInput.value = ''
      } catch (error) {
        console.error("Error changing password:", error);
        let errorMessage = "Failed to change password.";
        if (error.code === "auth/wrong-password") {
          errorMessage = "Incorrect current password."
        } else if (error.code === "auth/user-mismatch" || error.code === "auth/user-not-found") {
          errorMessage = "Authentication error. Please re-login."
        } else if (error.code === "auth/weak-password") {
          errorMessage = "New password is too weak."
        }
        window.showMessageBox(errorMessage, true)
      }
    })
  }
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to delete your account.", true);
        return
      }
      const passwordToConfirm = deleteAccountPasswordInput.value;
      if (!passwordToConfirm) {
        window.showMessageBox("Please enter your password to confirm account deletion.", true);
        return
      }
      const confirmation = await showCustomConfirm("Are you absolutely sure you want to delete your account?", "This action is irreversible. All your data will be permanently lost!");
      if (!confirmation) {
        window.showMessageBox("Account deletion cancelled.", false);
        return
      }
      try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, passwordToConfirm);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid));
        await deleteUser(auth.currentUser);
        window.showMessageBox("Account deleted successfully! Redirecting...", false);
        setTimeout(() => {
          window.location.href = 'sign.html';
        }, 2000);
      } catch (error) {
        console.error("Error deleting account:", error);
        let errorMessage = "Failed to delete account.";
        if (error.code === "auth/wrong-password") {
          errorMessage = "Incorrect password. Account deletion failed."
        } else if (error.code === "auth/requires-recent-login") {
          errorMessage = "Please re-login recently to delete your account (due to security policies)."
        }
        window.showMessageBox(errorMessage, true)
      }
    })
  }
  if (saveNotificationsBtn) {
    saveNotificationsBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to save notification settings.", true);
        return
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
        window.showMessageBox("Notification settings saved successfully!", false)
      }
    })
  }
  if (saveAccessibilityBtn) {
    saveAccessibilityBtn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        window.showMessageBox("You must be logged in to save accessibility settings.", true);
        return
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
        document.body.classList.toggle('high-contrast-mode', highContrast);
        document.body.classList.toggle('reduced-motion', reducedMotion);
        window.showMessageBox("Accessibility settings saved successfully!", false)
      }
    })
  }
  document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', () => {
      customConfirmModal.style.display = 'none';
    });
  });
  window.addEventListener('click', event => {
    if (event.target === customConfirmModal) {
      customConfirmModal.style.display = 'none';
    }
  });
