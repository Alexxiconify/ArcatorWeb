// sign.js: Handles user sign-in, sign-up, and logout.

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
import { showMessageBox } from './utils.js'; // Import message box utility

// --- DOM Elements ---
const userSettingsSection = document.getElementById('user-settings-section');
const userDisplayEmail = document.getElementById('user-display-email');
const userProfilePicture = document.getElementById('user-profile-picture');
const userDisplayName = document.getElementById('user-display-name');
const goToSettingsBtn = document.getElementById('go-to-settings-btn');
const logoutBtn = document.getElementById('logout-btn');

const loginSection = document.getElementById('login-section');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const showSignupBtn = document.getElementById('show-signup-btn');

const signupSection = document.getElementById('signup-section');
const signupEmailInput = document.getElementById('signup-email');
const signupPasswordInput = document.getElementById('signup-password');
const signupConfirmPasswordInput = document.getElementById('signup-confirm-password');
const signupBtn = document.getElementById('signup-btn');
const showLoginBtn = document.getElementById('show-login-btn');


// --- Default Values (Consistent with firebase-init.js) ---
const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark';


// --- Functions ---

/**
 * Updates the UI based on the current authentication state.
 * @param {object|null} user - The Firebase User object or null.
 */
async function updateUI(user) {
  if (user) {
    // User is signed in
    loginSection.classList.add('hidden');
    signupSection.classList.add('hidden');
    userSettingsSection.classList.remove('hidden');

    userDisplayEmail.textContent = user.email || 'N/A';
    userProfilePicture.src = user.photoURL || DEFAULT_PROFILE_PIC;

    const userProfile = await getUserProfileFromFirestore(user.uid);
    userDisplayName.textContent = userProfile?.displayName || user.displayName || 'Guest';

    // Apply user's theme preference
    const userThemePreference = userProfile?.themePreference;
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    applyTheme(themeToApply.id, themeToApply);

  } else {
    // No user signed in
    userSettingsSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    signupSection.classList.add('hidden'); // Default to showing login form
    applyTheme(DEFAULT_THEME_NAME); // Apply default theme if no user
  }
}

// --- Event Listeners ---
window.onload = async () => {
  // Setup Firebase and user authentication first
  await setupFirebaseAndUser();

  // Load navbar after Firebase is ready
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Listen for auth state changes to update UI dynamically
  onAuthStateChanged(auth, async (user) => {
    console.log("Auth state changed in sign.js:", user ? user.uid : "Signed out");
    updateUI(user);
  });

  // Toggle between login and signup forms
  if (showSignupBtn) {
    showSignupBtn.addEventListener('click', (event) => {
      event.preventDefault();
      loginSection.classList.add('hidden');
      signupSection.classList.remove('hidden');
      showMessageBox("", false); // Clear any messages
    });
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', (event) => {
      event.preventDefault();
      signupSection.classList.add('hidden');
      loginSection.classList.remove('hidden');
      showMessageBox("", false); // Clear any messages
    });
  }

  // Handle Login
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
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
  }

  // Handle Signup
  if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
      const email = signupEmailInput.value;
      const password = signupPasswordInput.value;
      const confirmPassword = signupConfirmPasswordInput.value;

      if (!email || !password || !confirmPassword) {
        showMessageBox("Please fill in all fields.", true);
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

        // Set initial display name to part of email, if not set by Firebase directly
        const defaultDisplayName = email.split('@')[0];
        await updateProfile(user, {
          displayName: defaultDisplayName,
          photoURL: DEFAULT_PROFILE_PIC // Set a default profile picture
        });

        // Create user profile in Firestore
        // updateUserProfileInFirestore is now imported from firebase-init.js
        await updateUserProfileInFirestore(user.uid, {
          displayName: defaultDisplayName, // Default display name
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
  }

  // Handle Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      showMessageBox("", false); // Clear message box
      try {
        await signOut(auth);
        showMessageBox("You have been signed out.", false);
        // UI will update via onAuthStateChanged
        // No redirect needed here, as the page will update and show login form
      } catch (error) {
        console.error("Logout failed:", error);
        showMessageBox("Logout failed: " + error.message, true);
      }
    });
  }

  // Go to Settings Button
  if (goToSettingsBtn) {
    goToSettingsBtn.addEventListener('click', () => {
      window.location.href = 'settings.html';
    });
  }
};
