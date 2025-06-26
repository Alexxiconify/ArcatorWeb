// user-main.js - Main script for the User Account page
// Handles authentication UI, user settings, and interactions.

// Import necessary functions and variables from other modules
import {
  auth,
  db,
  appId,
  firebaseReadyPromise,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME,
  getUserProfileFromFirestore,
  setUserProfileInFirestore
} from './firebase-init.js';

import { showMessageBox, sanitizeHandle, showCustomConfirm } from './utils.js';
import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js'; // Ensure loadNavbar is imported

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc // Added setDoc for saving preferences
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- DOM Elements --
// Auth sections
const signInSection = document.getElementById('signin-section');
const signUpSection = document.getElementById('signup-section');
const forgotPasswordSection = document.getElementById('forgot-password-section');

// Sign In elements
const signInEmailInput = document.getElementById('signin-email');
const signInPasswordInput = document.getElementById('signin-password');
const signInButton = document.getElementById('signin-btn');
const goToSignUpLink = document.getElementById('go-to-signup-link');
const goToForgotPasswordLink = document.getElementById('go-to-forgot-password-link');

// Sign Up elements
const signUpEmailInput = document.getElementById('signup-email');
const signUpPasswordInput = document.getElementById('signup-password');
const signUpConfirmPasswordInput = document.getElementById('signup-confirm-password');
const signUpDisplayNameInput = document.getElementById('signup-display-name');
const signUpHandleInput = document.getElementById('signup-handle');
const signUpButton = document.getElementById('signup-btn');
const goToSignInLink = document.getElementById('go-to-signin-link');

// Forgot Password elements
const forgotPasswordEmailInput = document.getElementById('forgot-password-email');
const resetPasswordButton = document.getElementById('reset-password-btn');
const goToSignInFromForgotLink = document.getElementById('go-to-signin-from-forgot-link');

// Settings elements
const profilePictureDisplay = document.getElementById('profile-picture-display');
const displayNameText = document.getElementById('display-name-text');
const handleText = document.getElementById('handle-text');
const emailText = document.getElementById('email-text');
const settingsContent = document.getElementById('settings-content');
const loginRequiredMessage = document.getElementById('login-required-message');
const loadingSpinner = document.getElementById('loading-spinner');
const displayNameInput = document.getElementById('display-name-input');
const handleInput = document.getElementById('handle-input');
const profilePictureUrlInput = document.getElementById('profile-picture-url-input');
const saveProfileBtn = document.getElementById('save-profile-btn');
const savePreferencesBtn = document.getElementById('save-preferences-btn');
const fontSizeSelect = document.getElementById('font-size-select');
const fontFamilySelect = document.getElementById('font-family-select');
const backgroundPatternSelect = document.getElementById('background-pattern-select');


/**
 * Shows a specific section and hides others within the main content area.
 * This is a central control for navigation between auth forms and settings.
 * @param {HTMLElement} sectionElement - The DOM element of the section to make visible.
 */
function showSection(sectionElement) {
  console.log(`DEBUG: showSection called with element: ${sectionElement ? sectionElement.id : 'null'}`);
  // Hide all main content sections first
  const sections = [signInSection, signUpSection, forgotPasswordSection, settingsContent, loginRequiredMessage];
  sections.forEach(sec => {
    if (sec) sec.style.display = 'none';
  });

  if (sectionElement) {
    sectionElement.style.display = 'block';
    console.log(`DEBUG: Displayed section: ${sectionElement.id}`);

    // Update hero banner based on section
    const heroTitle = document.getElementById('hero-title');
    const heroSubtitle = document.getElementById('hero-subtitle');
    if (heroTitle && heroSubtitle) {
      switch (sectionElement.id) {
        case 'signin-section':
          heroTitle.textContent = 'Welcome Back!';
          heroSubtitle.textContent = 'Sign in to your account.';
          break;
        case 'signup-section':
          heroTitle.textContent = 'Join Arcator.co.uk!';
          heroSubtitle.textContent = 'Create your new account.';
          break;
        case 'forgot-password-section':
          heroTitle.textContent = 'Forgot Your Password?';
          heroSubtitle.textContent = 'Reset it here.';
          break;
        case 'settings-content':
          heroTitle.textContent = 'User Settings';
          heroSubtitle.textContent = 'Personalize your Arcator.co.uk experience.';
          break;
        case 'login-required-message':
          heroTitle.textContent = 'Access Restricted';
          heroSubtitle.textContent = 'Please sign in to continue.';
          break;
        default:
          heroTitle.textContent = 'Welcome';
          heroSubtitle.textContent = 'Manage your account or sign in.';
          break;
      }
    }
  } else {
    console.warn(`Attempted to show null section element.`);
  }
  hideLoading(); // Always hide loading once a section is displayed
}

/**
 * Shows the loading spinner and hides all content sections.
 */
function showLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'flex';
  // Hide all known content sections
  const sections = [signInSection, signUpSection, forgotPasswordSection, settingsContent, loginRequiredMessage];
  sections.forEach(sec => {
    if (sec) sec.style.display = 'none';
  });
  console.log("DEBUG: showLoading - Spinner visible, content hidden.");
}

/**
 * Hides the loading spinner.
 */
function hideLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'none';
  console.log("DEBUG: hideLoading - Spinner hidden.");
}


// Handler for user sign-in
async function handleSignIn() {
  const email = signInEmailInput.value;
  const password = signInPasswordInput.value;
  if (!email || !password) {
    showMessageBox('Please enter both email and password.', true);
    return;
  }
  try {
    console.log("DEBUG: Attempting sign-in for:", email);
    await signInWithEmailAndPassword(auth, email, password);
    showMessageBox('Signed in successfully! Redirecting...', false);
    // UI will update via onAuthStateChanged listener
  } catch (error) {
    console.error('Sign-in error:', error);
    showMessageBox(`Sign-in failed: ${error.message}`, true);
  }
}

// Handler for user sign-up
async function handleSignUp() {
  const email = signUpEmailInput.value;
  const password = signUpPasswordInput.value;
  const confirmPassword = signUpConfirmPasswordInput.value;
  const displayName = signUpDisplayNameInput.value.trim();
  const rawHandle = signUpHandleInput.value.trim();
  const handle = sanitizeHandle(rawHandle); // Sanitize the handle

  if (!email || !password || !confirmPassword || !displayName || !rawHandle) {
    showMessageBox('Please fill in all fields.', true);
    return;
  }
  if (password.length < 6) {
    showMessageBox('Password should be at least 6 characters.', true);
    return;
  }
  if (password !== confirmPassword) {
    showMessageBox('Passwords do not match.', true);
    return;
  }
  if (handle.length < 3) {
    showMessageBox('Handle must be at least 3 characters.', true);
    return;
  }
  if (handle !== rawHandle.toLowerCase().replace(/[^a-z0-9_.]/g, '') && rawHandle !== '') {
    showMessageBox('Handle contains invalid characters. Use only alphanumeric, dots, and underscores.', true);
    return;
  }

  try {
    console.log("DEBUG: Checking handle uniqueness for:", handle);
    // Check for handle uniqueness before creating user
    const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
    const q = query(usersRef, where('handle', '==', handle));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      showMessageBox('This handle is already taken. Please choose another.', true);
      return;
    }
    console.log("DEBUG: Handle is unique. Proceeding with user creation.");

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log("DEBUG: Firebase user created:", user.uid);

    await updateProfile(user, {
      displayName: displayName,
      photoURL: DEFAULT_PROFILE_PIC
    });
    console.log("DEBUG: User profile updated in Firebase Auth.");

    const userProfileData = {
      uid: user.uid,
      displayName: displayName,
      email: email,
      photoURL: DEFAULT_PROFILE_PIC,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      themePreference: DEFAULT_THEME_NAME,
      isAdmin: false, // Default to not admin
      handle: handle // Store the sanitized handle
    };
    await setUserProfileInFirestore(user.uid, userProfileData);
    console.log("DEBUG: User profile saved to Firestore.");

    showMessageBox('Account created successfully! Please sign in.', false);
    showSection(signInSection); // Redirect to sign-in after successful signup
  } catch (error) {
    console.error('Sign-up error:', error);
    showMessageBox(`Sign-up failed: ${error.message}`, true);
  }
}

// Handler for password reset
async function handlePasswordReset() {
  const email = forgotPasswordEmailInput.value;
  if (!email) {
    showMessageBox('Please enter your email address.', true);
    return;
  }
  try {
    console.log("DEBUG: Sending password reset email to:", email);
    await sendPasswordResetEmail(auth, email);
    showMessageBox('Password reset email sent! Check your inbox.', false);
    showSection(signInSection); // Redirect to sign-in after sending reset email
  } catch (error) {
    console.error('Password reset error:', error);
    showMessageBox(`Password reset failed: ${error.message}`, true);
  }
}

// Handler for saving profile changes
async function handleSaveProfile() {
  const newDisplayName = displayNameInput.value.trim();
  const newPhotoURL = profilePictureUrlInput.value.trim();
  const rawNewHandle = handleInput.value.trim();
  const newHandle = sanitizeHandle(rawNewHandle);

  if (newHandle.length < 3) {
    showMessageBox('Handle must be at least 3 characters.', true);
    return;
  }
  if (newHandle !== rawNewHandle.toLowerCase().replace(/[^a-z0-9_.]/g, '') && rawNewHandle !== '') {
    showMessageBox('Handle contains invalid characters. Use only alphanumeric, dots, and underscores.', true);
    return;
  }

  if (auth.currentUser) {
    try {
      console.log("DEBUG: Preparing to save profile for UID:", auth.currentUser.uid);
      // Check for handle uniqueness if changing
      if (newHandle && newHandle !== (auth.currentUser.handle || '')) {
        const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
        const q = query(usersRef, where('handle', '==', newHandle));
        const querySnapshot = await getDocs(q);
        // Ensure the found handle is not for the current user
        if (!querySnapshot.empty && querySnapshot.docs[0].id !== auth.currentUser.uid) {
          showMessageBox('This handle is already taken. Please choose another.', true);
          return;
        }
        console.log("DEBUG: New handle is unique or belongs to current user.");
      }

      const updates = {};
      // Compare with current user data to avoid unnecessary updates
      const currentProfile = await getUserProfileFromFirestore(auth.currentUser.uid);

      if (newDisplayName !== (currentProfile?.displayName || auth.currentUser.displayName)) {
        updates.displayName = newDisplayName;
      }
      const effectivePhotoURL = newPhotoURL || DEFAULT_PROFILE_PIC;
      if (effectivePhotoURL !== (currentProfile?.photoURL || auth.currentUser.photoURL || DEFAULT_PROFILE_PIC)) {
        updates.photoURL = effectivePhotoURL;
      }
      if (newHandle !== (currentProfile?.handle || auth.currentUser.uid.substring(0,6))) { // Compare with Firestore handle or default UID handle
        updates.handle = newHandle;
      }

      if (Object.keys(updates).length > 0) {
        console.log("DEBUG: Detected profile updates:", updates);
        // Update Firebase Auth profile (display name and photo URL)
        await updateProfile(auth.currentUser, {
          displayName: updates.displayName !== undefined ? updates.displayName : auth.currentUser.displayName,
          photoURL: updates.photoURL !== undefined ? updates.photoURL : auth.currentUser.photoURL
        });
        console.log("DEBUG: Firebase Auth profile updated.");

        // Update Firestore user profile (all fields including handle)
        await setUserProfileInFirestore(auth.currentUser.uid, updates);
        console.log("DEBUG: Firestore user profile updated.");

        // Immediately update UI elements
        if (profilePictureDisplay) profilePictureDisplay.src = updates.photoURL || DEFAULT_PROFILE_PIC;
        if (displayNameText) displayNameText.textContent = updates.displayName || 'N/A';
        if (handleText) handleText.textContent = updates.handle ? `@${updates.handle}` : '';

        showMessageBox('Profile updated successfully!', false);
      } else {
        showMessageBox('No profile changes detected.', false);
        console.log("DEBUG: No profile changes detected.");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      showMessageBox(`Failed to update profile: ${error.message}`, true);
    }
  }
}

// Handler for saving preferences
async function handleSavePreferences() {
  const selectedFontSize = fontSizeSelect.value;
  const selectedFontFamily = fontFamilySelect.value;
  const selectedBackgroundPattern = backgroundPatternSelect.value;

  // Apply font size and family to body
  document.body.style.fontSize = selectedFontSize;
  document.body.style.fontFamily = selectedFontFamily;

  // Apply background pattern
  if (selectedBackgroundPattern === 'none') {
    document.body.style.backgroundImage = 'none';
  } else if (selectedBackgroundPattern === 'dots') {
    document.body.style.backgroundImage = 'linear-gradient(90deg, rgba(0,0,0,.1) 1px, transparent 1px), linear-gradient(rgba(0,0,0,.1) 1px, transparent 1px)';
    document.body.style.backgroundSize = '20px 20px';
  } else if (selectedBackgroundPattern === 'grid') {
    document.body.style.backgroundImage = 'linear-gradient(to right, rgba(0, 0, 0, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px)';
    document.body.style.backgroundSize = '40px 40px';
  }

  // Save to Firestore
  if (auth.currentUser) {
    try {
      console.log("DEBUG: Saving preferences for UID:", auth.currentUser.uid, "updates:", { selectedFontSize, selectedFontFamily, selectedBackgroundPattern });
      const updates = {
        fontSize: selectedFontSize,
        fontFamily: selectedFontFamily,
        backgroundPattern: selectedBackgroundPattern
      };
      await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid), updates, { merge: true });
      showMessageBox('Preferences saved successfully!', false);
      console.log("DEBUG: Preferences saved to Firestore.");
    } catch (error) {
      console.error("Error saving preferences:", error);
      showMessageBox(`Failed to save preferences: ${error.message}`, true);
    }
  }
}

// Main execution logic when the window loads
window.onload = async function() {
  console.log("user-main.js: window.onload fired.");
  showLoading(); // Show spinner initially

  try {
    // Wait for Firebase to be fully initialized and available
    await firebaseReadyPromise;
    console.log("user-main.js: Firebase is ready. Proceeding with auth state check.");

    // Initialize themes module (connects it to Firebase instances)
    setupThemesFirebase();
    console.log("DEBUG: Themes module initialized.");

    // Listen for authentication state changes
    onAuthStateChanged(auth, async (user) => {
      console.log("user-main.js: onAuthStateChanged triggered. User:", user ? user.uid : "none", "User email:", user ? user.email : "none");
      console.log("DEBUG: Starting onAuthStateChanged processing block.");

      let userProfile = null; // Initialize userProfile here

      if (user && !user.isAnonymous) {
        console.log("DEBUG: User is authenticated and not anonymous. Attempting to fetch user profile.");
        // User is signed in and not anonymous. Fetch user profile.
        userProfile = await getUserProfileFromFirestore(user.uid);
        console.log("user-main.js: User Profile fetched for settings:", userProfile);

        // Load navbar with *both* the basic user object and the fetched userProfile.
        // This ensures navbar has full data to render correctly.
        await loadNavbar(user, userProfile, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
        console.log("DEBUG: Navbar loaded.");


        if (userProfile) {
          console.log("DEBUG: User profile found. Populating settings UI.");
          const userThemePreference = userProfile.themePreference;

          // Update profile display elements
          if (profilePictureDisplay) profilePictureDisplay.src = userProfile.photoURL || DEFAULT_PROFILE_PIC;
          if (displayNameText) displayNameText.textContent = userProfile.displayName || 'N/A';
          if (handleText) handleText.textContent = userProfile.handle ? `@${userProfile.handle}` : '';
          if (emailText) emailText.textContent = userProfile.email || user.email || 'N/A';

          // Populate settings input fields
          if (displayNameInput) displayNameInput.value = userProfile.displayName || '';
          if (handleInput) handleInput.value = userProfile.handle || '';
          if (profilePictureUrlInput) profilePictureUrlInput.value = userProfile.photoURL || '';

          // Populate session information
          if (document.getElementById('last-login-time') && userProfile.lastLoginAt) {
            const lastLoginDate = userProfile.lastLoginAt.toDate ? userProfile.lastLoginAt.toDate() : new Date(userProfile.lastLoginAt);
            document.getElementById('last-login-time').textContent = `Last Login: ${lastLoginDate.toLocaleString()}`;
          }
          if (document.getElementById('account-creation-time') && userProfile.createdAt) {
            const creationDate = userProfile.createdAt.toDate ? userProfile.createdAt.toDate() : new Date(userProfile.createdAt);
            document.getElementById('account-creation-time').textContent = `Account Created: ${creationDate.toLocaleString()}`;
          }

          // Load existing preferences for dropdowns
          if (fontSizeSelect) fontSizeSelect.value = userProfile.fontSize || '16px';
          if (fontFamilySelect) fontFamilySelect.value = userProfile.fontFamily || 'Inter, sans-serif';
          if (backgroundPatternSelect) backgroundPatternSelect.value = userProfile.backgroundPattern || 'none';

          // Apply loaded preferences immediately to the body
          document.body.style.fontSize = userProfile.fontSize || '16px';
          document.body.style.fontFamily = userProfile.fontFamily || 'Inter, sans-serif';
          if (userProfile.backgroundPattern === 'none') {
            document.body.style.backgroundImage = 'none';
          } else if (userProfile.backgroundPattern === 'dots') {
            document.body.style.backgroundImage = 'linear-gradient(90deg, rgba(0,0,0,.1) 1px, transparent 1px), linear-gradient(rgba(0,0,0,.1) 1px, transparent 1px)';
            document.body.style.backgroundSize = '20px 20px';
          } else if (userProfile.backgroundPattern === 'grid') {
            document.body.style.backgroundImage = 'linear-gradient(to right, rgba(0, 0, 0, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px)';
            document.body.style.backgroundSize = '40px 40px';
          }

          showSection(settingsContent); // Display the settings section
        } else {
          console.warn("user-main.js: User profile not found in Firestore for UID:", user.uid, ". Displaying login required message.");
          showSection(loginRequiredMessage); // Fallback to login required
        }

        console.log("DEBUG: Attempting to apply theme after user profile processed.");
        // Apply the theme: user's preference, or the default theme.
        const allThemes = await getAvailableThemes();
        const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
        applyTheme(themeToApply.id, themeToApply);
        console.log("DEBUG: Theme applied.");

      } else {
        // User is signed out or anonymous. Display the sign-in form.
        console.log("user-main.js: User logged out or anonymous. Showing sign-in section.");
        // Load navbar for logged-out state
        await loadNavbar(user, null, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
        console.log("DEBUG: Navbar loaded for logged-out user.");
        showSection(signInSection);
        console.log("DEBUG: Sign-in section displayed.");

        // Apply default theme for logged-out users
        console.log("DEBUG: Applying default theme for logged-out user.");
        const allThemes = await getAvailableThemes();
        const themeToApply = allThemes.find(t => t.id === DEFAULT_THEME_NAME);
        applyTheme(themeToApply.id, themeToApply);
        console.log("DEBUG: Default theme applied.");
      }
    });

    // --- Event Listeners for Authentication Navigation ---
    if (goToSignUpLink) goToSignUpLink.addEventListener('click', (e) => { e.preventDefault(); showSection(signUpSection); });
    if (goToSignInLink) goToSignInLink.addEventListener('click', (e) => { e.preventDefault(); showSection(signInSection); });
    if (goToForgotPasswordLink) goToForgotPasswordLink.addEventListener('click', (e) => { e.preventDefault(); showSection(forgotPasswordSection); });
    if (goToSignInFromForgotLink) goToSignInFromForgotLink.addEventListener('click', (e) => { e.preventDefault(); showSection(signInSection); });
    if (document.getElementById('link-to-signin')) document.getElementById('link-to-signin').addEventListener('click', (e) => { e.preventDefault(); showSection(signInSection); });

    // --- Event Listeners for Authentication Actions ---
    if (signInButton) signInButton.addEventListener('click', handleSignIn);
    if (signUpButton) signUpButton.addEventListener('click', handleSignUp);
    if (resetPasswordButton) resetPasswordButton.addEventListener('click', handlePasswordReset);

    // --- Event listeners for profile/preferences saving ---
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', handleSaveProfile);
    if (savePreferencesBtn) savePreferencesBtn.addEventListener('click', handleSavePreferences);

    // --- Placeholder Event Listeners for Future Features ---
    const changePasswordBtn = document.getElementById('change-password-btn');
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', () => showMessageBox('Change Password functionality coming soon!', false));

    const saveNotificationsBtn = document.getElementById('save-notifications-btn');
    if (saveNotificationsBtn) saveNotificationsBtn.addEventListener('click', () => showMessageBox('Notification settings saving functionality coming soon!', false));

    const saveAccessibilityBtn = document.getElementById('save-accessibility-btn');
    if (saveAccessibilityBtn) saveAccessibilityBtn.addEventListener('click', () => showMessageBox('Accessibility settings saving functionality coming soon!', false));

    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', () => showMessageBox('Delete account functionality coming soon! Be careful with this one!', true));

    // Set the current year in the footer
    document.getElementById('current-year').textContent = new Date().getFullYear().toString();

  } catch (error) {
    console.error("user-main.js: Error during window.onload execution:", error);
    showMessageBox("An unexpected error occurred during page load.", true);
  } finally {
    // The hideLoading() is now consistently called within showSection()
    // which is invoked once the appropriate UI section is determined.
  }
};
