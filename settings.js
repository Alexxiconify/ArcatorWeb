// sign.js: Handles user sign-up, sign-in, and password reset functionalities.

// Import necessary Firebase SDK functions
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut // <--- signOut is imported here
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import shared Firebase instances and utilities from firebase-init.js
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

// Import other local module functions
import { showMessageBox, sanitizeHandle } from './utils.js';
import { applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';

// --- DOM Elements ---
const signInSection = document.getElementById('signin-section');
const signUpSection = document.getElementById('signup-section');
const forgotPasswordSection = document.getElementById('forgot-password-section');
const loadingSpinner = document.getElementById('loading-spinner');

// Sign In elements
const signInEmailInput = document.getElementById('signin-email');
const signInPasswordInput = document.getElementById('signin-password');
const signInButton = document.getElementById('signin-btn');
const goToSignUpLink = document.getElementById('go-to-signup');
const goToForgotPasswordLink = document.getElementById('go-to-forgot-password');

// Sign Up elements
const signUpEmailInput = document.getElementById('signup-email');
const signUpPasswordInput = document.getElementById('signup-password');
const signUpConfirmPasswordInput = document.getElementById('signup-confirm-password');
const signUpDisplayNameInput = document.getElementById('signup-display-name');
const signUpButton = document.getElementById('signup-btn');
const goToSignInLink = document.getElementById('go-to-signin');

// Forgot Password elements
const forgotPasswordEmailInput = document.getElementById('forgot-password-email');
const resetPasswordButton = document.getElementById('reset-password-btn');
const goToSignInFromForgotLink = document.getElementById('go-to-signin-from-forgot');

// Settings Page DOM Elements (New additions for profile display)
const profilePictureDisplay = document.getElementById('profile-picture-display');
const displayNameText = document.getElementById('display-name-text');
const emailText = document.getElementById('email-text');


// --- Helper Functions ---

/**
 * Shows the specified section and hides others.
 * @param {HTMLElement} sectionElement - The section element to show.
 */
function showSection(sectionElement) {
  if (signInSection) signInSection.style.display = 'none';
  if (signUpSection) signUpSection.style.display = 'none';
  if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';
  if (sectionElement) sectionElement.style.display = 'block';
  console.log(`DEBUG: Displaying section: ${sectionElement ? sectionElement.id : 'N/A'}`);
}

/**
 * Shows the loading spinner.
 */
function showLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'flex';
  if (signInSection) signInSection.style.display = 'none';
  if (signUpSection) signUpSection.style.display = 'none';
  if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';
}

/**
 * Hides the loading spinner.
 */
function hideLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'none';
}

/**
 * Handles user sign-in.
 */
async function handleSignIn(event) {
  event.preventDefault();
  showLoading();
  await firebaseReadyPromise; // Ensure Firebase is ready

  const email = signInEmailInput.value.trim();
  const password = signInPasswordInput.value.trim();

  if (!email || !password) {
    showMessageBox("Please enter both email and password.", true);
    hideLoading();
    return;
  }

  try {
    // If an anonymous user is logged in, sign them out first
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      console.log("DEBUG: Anonymous user detected. Signing out anonymous user before email sign-in.");
      await signOut(auth); // <--- Anonymous user signed out here
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    showMessageBox("Signed in successfully! Redirecting...", false);
    console.log("DEBUG: User signed in:", userCredential.user.uid);

    await setUserProfileInFirestore(userCredential.user.uid, { lastLoginAt: new Date() });

    setTimeout(() => {
      window.location.href = 'settings.html';
    }, 1500);
  } catch (error) {
    console.error("Error signing in:", error);
    showMessageBox(`Sign in failed: ${error.message}`, true);
    hideLoading();
  }
}

/**
 * Handles user sign-up.
 */
async function handleSignUp(event) {
  event.preventDefault();
  showLoading();
  await firebaseReadyPromise; // Ensure Firebase is ready

  const email = signUpEmailInput.value.trim();
  const password = signUpPasswordInput.value.trim();
  const confirmPassword = signUpConfirmPasswordInput.value.trim();
  const displayName = signUpDisplayNameInput.value.trim();
  const sanitizedDisplayName = sanitizeHandle(displayName);

  if (!email || !password || !confirmPassword || !displayName) {
    showMessageBox("All fields are required.", true);
    hideLoading();
    return;
  }
  if (password.length < 6) {
    showMessageBox("Password must be at least 6 characters long.", true);
    hideLoading();
    return;
  }
  if (password !== confirmPassword) {
    showMessageBox("Passwords do not match.", true);
    hideLoading();
    return;
  }
  if (sanitizedDisplayName !== displayName) {
    showMessageBox("Display name contains invalid characters. Only alphanumeric, _, ., - allowed.", true);
    hideLoading();
    return;
  }

  try {
    // If an anonymous user is logged in, sign them out first for a clean sign-up
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      console.log("DEBUG: Anonymous user detected. Signing out anonymous user before email sign-up.");
      await signOut(auth); // <--- Anonymous user signed out here
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await updateProfile(user, {
      displayName: sanitizedDisplayName,
      photoURL: DEFAULT_PROFILE_PIC
    });

    const userProfileData = {
      uid: user.uid,
      displayName: sanitizedDisplayName,
      email: user.email,
      photoURL: DEFAULT_PROFILE_PIC,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      themePreference: DEFAULT_THEME_NAME,
      isAdmin: false
    };
    await setUserProfileInFirestore(user.uid, userProfileData);

    showMessageBox("Account created successfully! You are now logged in.", false);
    console.log("DEBUG: User signed up and profile created:", user.uid);
    setTimeout(() => {
      window.location.href = 'settings.html';
    }, 1500);

  } catch (error) {
    console.error("Error signing up:", error);
    showMessageBox(`Sign up failed: ${error.message}`, true);
    hideLoading();
  }
}

/**
 * Handles password reset requests.
 */
async function handlePasswordReset(event) {
  event.preventDefault();
  showLoading();
  await firebaseReadyPromise; // Ensure Firebase is ready

  const email = forgotPasswordEmailInput.value.trim();

  if (!email) {
    showMessageBox("Please enter your email address.", true);
    hideLoading();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessageBox("Password reset email sent! Check your inbox.", false);
    console.log("DEBUG: Password reset email sent to:", email);
    hideLoading();
    setTimeout(() => showSection(signInSection), 2000);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    showMessageBox(`Password reset failed: ${error.message}`, true);
    hideLoading();
  }
}

// --- Main Script Execution ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("sign.js - DOMContentLoaded event fired.");
  showLoading();

  await firebaseReadyPromise;
  console.log("sign.js: Firebase ready. Proceeding with UI and auth state check.");

  const user = auth.currentUser;

  await loadNavbar(user, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  let userThemePreference = null;
  if (user) {
    const userProfile = await getUserProfileFromFirestore(user.uid);
    userThemePreference = userProfile?.themePreference;

    // *** NEW CODE TO UPDATE PROFILE DISPLAY ***
    if (userProfile) {
      if (profilePictureDisplay) profilePictureDisplay.src = userProfile.photoURL || DEFAULT_PROFILE_PIC;
      if (displayNameText) displayNameText.textContent = userProfile.displayName || 'N/A';
      if (emailText) emailText.textContent = userProfile.email || 'N/A';
    } else {
      // If no user profile found, display default or generic info
      if (profilePictureDisplay) profilePictureDisplay.src = DEFAULT_PROFILE_PIC;
      if (displayNameText) displayNameText.textContent = 'Guest User';
      if (emailText) emailText.textContent = 'Sign in to view profile';
    }
    // *** END NEW CODE ***

  } else {
    // If no user is logged in, hide settings content and show login message
    document.getElementById('settings-content').style.display = 'none';
    document.getElementById('login-required-message').style.display = 'block';
  }

  const allThemes = await getAvailableThemes();
  const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
  await applyTheme(themeToApply.id);

  hideLoading();

  // Only show sign-in section if settings content is not displayed (i.e., user is not logged in)
  if (document.getElementById('login-required-message').style.display === 'none') {
    showSection(signInSection); // This line needs to be re-evaluated based on the page's primary function
  } else {
    // If login required message is shown, no need to show a sign-in section from settings.js
    // This script is sign.js, so it should always default to sign-in.
    // The previous debug logs confirm this file's context is 'sign.js'
    showSection(signInSection);
  }

  if (goToSignUpLink) goToSignUpLink.addEventListener('click', () => showSection(signUpSection));
  if (goToSignInLink) goToSignInLink.addEventListener('click', () => showSection(signInSection));
  if (goToForgotPasswordLink) goToForgotPasswordLink.addEventListener('click', () => showSection(forgotPasswordSection));
  if (goToSignInFromForgotLink) goToSignInFromForgotLink.addEventListener('click', () => showSection(signInSection));

  if (signInButton) signInButton.addEventListener('click', handleSignIn);
  if (signUpButton) signUpButton.addEventListener('click', handleSignUp);
  if (resetPasswordButton) resetPasswordButton.addEventListener('click', handlePasswordReset);

  const currentYearElement = document.getElementById('current-year-sign');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }
});
