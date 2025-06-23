// sign.js: Handles user sign-in, sign-up, and logout.

// Import Firebase instances and user functions from the centralized init file
import {
  auth,
  db,
  appId,
  getCurrentUser,
  firebaseReadyPromise, // Import firebaseReadyPromise
  getUserProfileFromFirestore,
  updateUserProfileInFirestore,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME
} from './firebase-init.js';

// Import specific Auth methods (these come directly from the Firebase SDK)
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile // For updating display name, photo URL directly on Auth user
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Import theme and navbar functions
import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';
import { showMessageBox, showCustomConfirm } from './utils.js'; // Import message box utility

// --- DOM Elements ---
const userSettingsSection = document.getElementById('user-settings-section'); // For logged-in user display
const userDisplayEmail = document.getElementById('user-display-email');
const userProfilePicture = document.getElementById('user-profile-picture');
const userDisplayName = document.getElementById('user-display-name');
const goToSettingsBtn = document.getElementById('go-to-settings-btn');
const logoutBtn = document.getElementById('logout-btn');

const loginSection = document.getElementById('login-section'); // For login form display
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const showSignupBtn = document.getElementById('show-signup-btn');
const forgotPasswordBtn = document.getElementById('forgot-password-btn'); // New element for forgot password

const signupSection = document.getElementById('signup-section'); // For signup form display
const signupEmailInput = document.getElementById('signup-email');
const signupPasswordInput = document.getElementById('signup-password');
const signupConfirmPasswordInput = document.getElementById('signup-confirm-password');
const signupDisplayNameInput = document.getElementById('signup-display-name'); // New element for signup display name
const signupBtn = document.getElementById('signup-btn');
const showLoginBtn = document.getElementById('show-login-btn');


// --- Functions ---

/**
 * Updates the UI based on the current authentication state.
 * @param {object|null} user - The Firebase User object or null.
 */
async function updateUI(user) {
  if (user) {
    // User is signed in
    loginSection?.classList.add('hidden');
    signupSection?.classList.add('hidden');
    userSettingsSection?.classList.remove('hidden');

    if (userDisplayEmail) userDisplayEmail.textContent = user.email || 'N/A';
    if (userProfilePicture) userProfilePicture.src = user.photoURL || DEFAULT_PROFILE_PIC;

    const userProfile = await getUserProfileFromFirestore(user.uid);
    if (userDisplayName) userDisplayName.textContent = userProfile?.displayName || user.displayName || 'Guest';

    // Apply user's theme preference
    const userThemePreference = userProfile?.themePreference;
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    applyTheme(themeToApply.id, themeToApply);

  } else {
    // No user signed in
    userSettingsSection?.classList.add('hidden');
    loginSection?.classList.remove('hidden');
    signupSection?.classList.add('hidden'); // Default to showing login form
    applyTheme(DEFAULT_THEME_NAME); // Apply default theme if no user
  }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
  // Ensure Firebase is set up before proceeding.
  // This will also trigger the initial onAuthStateChanged.
  await firebaseReadyPromise;

  // Setup themes Firebase integration (needed for applyTheme and getAvailableThemes)
  setupThemesFirebase(db, auth, appId);

  // Load navbar after Firebase is ready
  await loadNavbar(); // loadNavbar now retrieves its own Firebase instances

  // Listen for auth state changes to update UI dynamically
  // This listener is already set up in firebase-init.js, but adding one here
  // ensures this specific page's UI updates correctly after any auth changes.
  onAuthStateChanged(auth, async (user) => {
    console.log("Auth state changed in sign.js:", user ? user.uid : "Signed out");
    updateUI(user);
  });

  // Toggle between login and signup forms
  showSignupBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    loginSection?.classList.add('hidden');
    signupSection?.classList.remove('hidden');
    showMessageBox("", false); // Clear any messages
  });

  showLoginBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    signupSection?.classList.add('hidden');
    loginSection?.classList.remove('hidden');
    showMessageBox("", false); // Clear any messages
  });

  // Handle Login
  loginBtn?.addEventListener('click', async (event) => {
    event.preventDefault(); // Prevent default form submission for login form
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;

    if (!email || !password) {
      showMessageBox("Please enter both email and password.", true);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showMessageBox("Signed in successfully!", false);
      // onAuthStateChanged will handle UI update
    } catch (error) {
      console.error("Login failed:", error);
      let errorMessage = "Login failed.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "Invalid email or password.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email format.";
      }
      showMessageBox(errorMessage, true);
    }
  });

  // Handle Signup
  signupBtn?.addEventListener('click', async (event) => {
    event.preventDefault(); // Prevent default form submission for signup form
    const email = signupEmailInput.value;
    const password = signupPasswordInput.value;
    const confirmPassword = signupConfirmPasswordInput.value;
    const displayName = signupDisplayNameInput.value.trim(); // Get display name

    if (!email || !password || !confirmPassword) {
      showMessageBox("Please fill in all required fields.", true);
      return;
    }
    if (password !== confirmPassword) {
      showMessageBox("Passwords do not match.", true);
      return;
    }
    if (password.length < 6) {
      showMessageBox("Password must be at least 6 characters long.", true);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Set initial display name (prefer provided, else part of email)
      const finalDisplayName = displayName || email.split('@')[0];
      await updateProfile(user, {
        displayName: finalDisplayName,
        photoURL: DEFAULT_PROFILE_PIC // Set a default profile picture
      });

      // Create user profile in Firestore
      await updateUserProfileInFirestore(user.uid, {
        displayName: finalDisplayName,
        photoURL: DEFAULT_PROFILE_PIC,
        themePreference: DEFAULT_THEME_NAME,
        fontSizePreference: '16px', // Default font size
        fontFamilyPreference: 'Inter, sans-serif',
        backgroundPatternPreference: 'none',
        notificationPreferences: { email: false, inApp: false },
        accessibilitySettings: { highContrast: false, reducedMotion: false },
        createdAt: new Date().toISOString() // Timestamp
      });

      showMessageBox("Account created successfully!", false);
      // onAuthStateChanged will handle UI update
    } catch (error) {
      console.error("Signup failed:", error);
      let errorMessage = "Signup failed.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Email already in use.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email format.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password is too weak.";
      }
      showMessageBox(errorMessage, true);
    }
  });

  // Handle Forgot Password (basic implementation for now)
  forgotPasswordBtn?.addEventListener('click', async () => {
    const email = loginEmailInput.value.trim();
    if (!email) {
      showMessageBox("Please enter your email in the sign-in form to reset your password.", true);
      return;
    }

    const confirmed = await showCustomConfirm(`Send password reset email to ${email}?`, "If the email exists, a reset link will be sent.");
    if (confirmed) {
      try {
        // Implement Firebase's sendPasswordResetEmail here if needed
        // await sendPasswordResetEmail(auth, email);
        showMessageBox("Password reset functionality is not yet fully implemented. Please contact support.", false);
      } catch (error) {
        console.error("Password reset failed:", error);
        showMessageBox(`Password reset failed: ${error.message}`, true);
      }
    }
  });


  // Handle Logout
  logoutBtn?.addEventListener('click', async () => {
    showMessageBox("", false); // Clear message box
    try {
      await signOut(auth);
      showMessageBox("You have been signed out.", false);
      // UI will update via onAuthStateChanged
    } catch (error) {
      console.error("Logout failed:", error);
      showMessageBox("Logout failed: " + error.message, true);
    }
  });

  // Go to Settings Button
  goToSettingsBtn?.addEventListener('click', () => {
    window.location.href = 'settings.html';
  });

  // Set the current year for the footer
  const currentYearElement = document.getElementById('current-year-sign');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }
});
