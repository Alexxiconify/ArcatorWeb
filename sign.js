// sign.js: Handles user sign-up, sign-in, and password reset functionalities.

// Import necessary Firebase SDK functions
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged // Still needed for specific listener in this file if any
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import shared Firebase instances and utilities from firebase-init.js
// Crucial: All Firebase-related variables are now imported from the central firebase-init.js
import {
  auth,
  db,
  appId,
  firebaseReadyPromise,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME,
  getUserProfileFromFirestore,
  setUserProfileInFirestore // Assuming this might be needed for user profile creation/updates during sign-up
} from './firebase-init.js';

// Import other local module functions
import { showMessageBox, sanitizeHandle } from './utils.js';
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js'; // Ensure themes setup is also imported
import { loadNavbar } from './navbar.js'; // Import loadNavbar

// --- DOM Elements ---
const signInSection = document.getElementById('signin-section');
const signUpSection = document.getElementById('signup-section');
const forgotPasswordSection = document.getElementById('forgot-password-section');
const loadingSpinner = document.getElementById('loading-spinner'); // Assuming you have a loading spinner in sign.html

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
  console.log("DEBUG: handleSignIn called.");

  const email = signInEmailInput.value.trim();
  const password = signInPasswordInput.value.trim();

  if (!email || !password) {
    showMessageBox("Please enter both email and password.", true);
    hideLoading();
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    showMessageBox("Signed in successfully! Redirecting...", false);
    console.log("DEBUG: User signed in:", userCredential.user.uid);

    // Update user profile with last login time
    await setUserProfileInFirestore(userCredential.user.uid, { lastLoginAt: new Date() });

    setTimeout(() => {
      window.location.href = 'settings.html'; // Redirect to settings page or dashboard
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
  console.log("DEBUG: handleSignUp called.");

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
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update Firebase Auth profile
    await updateProfile(user, {
      displayName: sanitizedDisplayName,
      photoURL: DEFAULT_PROFILE_PIC // Set default profile picture
    });

    // Create user profile in Firestore
    const userProfileData = {
      uid: user.uid,
      displayName: sanitizedDisplayName,
      email: user.email,
      photoURL: DEFAULT_PROFILE_PIC,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      themePreference: DEFAULT_THEME_NAME, // Default theme for new users
      isAdmin: false // Default to not admin
    };
    await setUserProfileInFirestore(user.uid, userProfileData);

    showMessageBox("Account created successfully! You are now logged in.", false);
    console.log("DEBUG: User signed up and profile created:", user.uid);
    setTimeout(() => {
      window.location.href = 'settings.html'; // Redirect to settings page or dashboard
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
  console.log("DEBUG: handlePasswordReset called.");

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
    setTimeout(() => showSection(signInSection), 2000); // Redirect to sign in after message
  } catch (error) {
    console.error("Error sending password reset email:", error);
    showMessageBox(`Password reset failed: ${error.message}`, true);
    hideLoading();
  }
}

// --- Main Script Execution ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("sign.js - DOMContentLoaded event fired.");
  showLoading(); // Show loading spinner immediately

  // Wait for Firebase to be ready (initialized and auth state determined)
  await firebaseReadyPromise;
  console.log("sign.js: Firebase ready. Proceeding with UI and auth state check.");

  // Get current user after Firebase is ready
  const user = auth.currentUser;

  // Load navbar based on current auth state
  await loadNavbar(user, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Apply initial theme based on user preference or default
  let userThemePreference = null;
  if (user) {
    const userProfile = await getUserProfileFromFirestore(user.uid);
    userThemePreference = userProfile?.themePreference;
  }
  const allThemes = await getAvailableThemes();
  const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
  await applyTheme(themeToApply.id); // applyTheme now expects just the theme ID

  hideLoading(); // Hide loading spinner once theme is applied and auth state is checked


  // Default to showing the sign-in section
  showSection(signInSection);

  // Link event listeners
  if (goToSignUpLink) goToSignUpLink.addEventListener('click', () => showSection(signUpSection));
  if (goToSignInLink) goToSignInLink.addEventListener('click', () => showSection(signInSection));
  if (goToForgotPasswordLink) goToForgotPasswordLink.addEventListener('click', () => showSection(forgotPasswordSection));
  if (goToSignInFromForgotLink) goToSignInFromForgotLink.addEventListener('click', () => showSection(signInSection));

  // Button event listeners
  if (signInButton) signInButton.addEventListener('click', handleSignIn);
  if (signUpButton) signUpButton.addEventListener('click', handleSignUp);
  if (resetPasswordButton) resetPasswordButton.addEventListener('click', handlePasswordReset);

  // Set current year for footer (assuming there's a footer with a current-year-sign id)
  const currentYearElement = document.getElementById('current-year-sign');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }
});
