// sign.js: Handles user sign-up, sign-in, and password reset functionalities.

// Import necessary Firebase SDK functions
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import shared Firebase instances and utilities from firebase-init.js
// Removed 'setupFirebaseAndUser' as it is not exported and runs automatically.
import {
  auth,
  db,
  appId,
  firebaseReadyPromise,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME,
  getUserProfileFromFirestore
} from './firebase-init.js';
import { showMessageBox, sanitizeHandle } from './utils.js';
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js'; // Ensure themes setup is also imported


// --- DOM Elements ---
const signInSection = document.getElementById('signin-section');
const signUpSection = document.getElementById('signup-section');
const forgotPasswordSection = document.getElementById('forgot-password-section');

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
const forgotEmailInput = document.getElementById('forgot-email');
const resetPasswordButton = document.getElementById('reset-password-btn');
const goToSignInFromForgotLink = document.getElementById('go-to-signin-from-forgot');

const loadingSpinner = document.getElementById('loading-spinner');

/**
 * Shows the loading spinner.
 */
function showLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'flex';
}

/**
 * Hides the loading spinner.
 */
function hideLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'none';
}

/**
 * Displays a specific section and hides others.
 * @param {HTMLElement} sectionToShow - The section to display.
 */
function showSection(sectionToShow) {
  if (signInSection) signInSection.style.display = 'none';
  if (signUpSection) signUpSection.style.display = 'none';
  if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';

  if (sectionToShow) sectionToShow.style.display = 'block';
}

/**
 * Handles user sign-in.
 */
async function handleSignIn() {
  showLoading();
  await firebaseReadyPromise; // Ensure Firebase is ready
  const email = signInEmailInput.value;
  const password = signInPasswordInput.value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log("User signed in:", user.uid);

    // After successful sign-in, ensure a user profile exists or update it
    const userProfileRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, user.uid);
    const docSnap = await getDoc(userProfileRef);

    if (!docSnap.exists()) {
      // Create a default user profile if it doesn't exist
      await setDoc(userProfileRef, {
        uid: user.uid,
        displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
        email: user.email,
        photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        themePreference: DEFAULT_THEME_NAME,
        // Add other default settings
        fontSize: '16px',
        fontFamily: 'Inter, sans-serif',
        backgroundPattern: 'none',
        emailNotifications: true,
        inAppNotifications: true,
        highContrastMode: false,
        reducedMotion: false,
      });
      console.log("Default user profile created for new sign-in.");
    } else {
      // Update last login time for existing users
      await setDoc(userProfileRef, { lastLoginAt: new Date() }, { merge: true });
      console.log("User profile updated with last login time.");
    }

    showMessageBox("Signed in successfully!", false);
    window.location.href = 'settings.html'; // Redirect to settings page or dashboard
  } catch (error) {
    console.error("Sign-in error:", error);
    showMessageBox(`Sign-in failed: ${error.message}`, true);
  } finally {
    hideLoading();
  }
}

/**
 * Handles user sign-up.
 */
async function handleSignUp() {
  showLoading();
  await firebaseReadyPromise; // Ensure Firebase is ready
  const email = signUpEmailInput.value;
  const password = signUpPasswordInput.value;
  const confirmPassword = signUpConfirmPasswordInput.value;
  const displayName = sanitizeHandle(signUpDisplayNameInput.value.trim()); // Sanitize display name

  if (password !== confirmPassword) {
    showMessageBox("Passwords do not match.", true);
    hideLoading();
    return;
  }
  if (password.length < 6) {
    showMessageBox("Password must be at least 6 characters long.", true);
    hideLoading();
    return;
  }
  if (!displayName) {
    showMessageBox("Display Name is required.", true);
    hideLoading();
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update Firebase Auth profile with display name and default photo
    await updateProfile(user, {
      displayName: displayName,
      photoURL: DEFAULT_PROFILE_PIC
    });

    // Create user profile in Firestore
    const userProfileRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, user.uid);
    await setDoc(userProfileRef, {
      uid: user.uid,
      displayName: displayName,
      email: email,
      photoURL: DEFAULT_PROFILE_PIC,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      themePreference: DEFAULT_THEME_NAME, // Set default theme
      fontSize: '16px',
      fontFamily: 'Inter, sans-serif',
      backgroundPattern: 'none',
      emailNotifications: true,
      inAppNotifications: true,
      highContrastMode: false,
      reducedMotion: false,
    });

    console.log("User signed up and profile created:", user.uid);
    showMessageBox("Account created successfully! Redirecting to settings...", false);
    window.location.href = 'settings.html'; // Redirect to settings page
  } catch (error) {
    console.error("Sign-up error:", error);
    showMessageBox(`Sign-up failed: ${error.message}`, true);
  } finally {
    hideLoading();
  }
}

/**
 * Handles password reset.
 */
async function handlePasswordReset() {
  showLoading();
  await firebaseReadyPromise; // Ensure Firebase is ready
  const email = forgotEmailInput.value;

  if (!email) {
    showMessageBox("Please enter your email address.", true);
    hideLoading();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessageBox("Password reset email sent. Check your inbox!", false);
    showSection(signInSection); // Go back to sign-in after sending
  } catch (error) {
    console.error("Password reset error:", error);
    showMessageBox(`Password reset failed: ${error.message}`, true);
  } finally {
    hideLoading();
  }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
  showLoading(); // Show loading spinner initially
  await firebaseReadyPromise; // Ensure Firebase is ready before doing anything with auth state
  setupThemesFirebase(db, auth, appId); // Initialize themes module with Firebase instances

  // Apply initial theme based on user preference or default immediately
  onAuthStateChanged(auth, async (user) => {
    let userThemePreference = null;
    if (user) {
      const userProfile = await getUserProfileFromFirestore(user.uid);
      userThemePreference = userProfile?.themePreference;
    }
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    await applyTheme(themeToApply.id, userThemePreference); // Pass userProfile.themePreference directly for applyTheme

    hideLoading(); // Hide loading spinner once theme is applied and auth state is checked
  });


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
});
