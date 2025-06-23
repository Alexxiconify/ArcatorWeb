// sign.js: Handles user sign-up, login, and logout functionality.

import { auth, db, appId, getCurrentUser, setupFirebaseAndUser } from './firebase-init.js';
import { showMessageBox, getUserProfileFromFirestore, updateUserProfileInFirestore } from './utils.js';
import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


// --- Default Values (consistent with firebase-init.js) ---
const DEFAULT_PROFILE_PIC = 'https://placehold.co/96x96/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME = 'dark';

// --- DOM Elements (assigned inside window.onload for safety) ---
let userSettingsSection;
let loginSection;
let signupSection;
let userDisplayEmail;
let userProfilePicture;
let userDisplayName;
let goToSettingsBtn;
let logoutBtn;
let loginEmailInput;
let loginPasswordInput;
let loginBtn;
let showSignupBtn;
let signupEmailInput;
let signupPasswordInput;
let signupConfirmPasswordInput;
let signupBtn;
let showLoginBtn;
let messageBoxElement; // Renamed to avoid conflict with imported showMessageBox


// Main authentication state listener and UI update logic
async function setupAuthUIListener() {
  const user = getCurrentUser(); // Get the globally managed user

  if (user) {
    console.log("User detected on sign.html:", user.uid);

    userDisplayEmail.textContent = user.email || "Anonymous User";
    userProfilePicture.src = user.photoURL || DEFAULT_PROFILE_PIC;
    userDisplayName.textContent = user.displayName || user.handle || '';

    userSettingsSection.classList.remove('hidden');
    loginSection.classList.add('hidden');
    signupSection.classList.add('hidden');

    const userProfile = await getUserProfileFromFirestore(user.uid);
    const userThemePreference = userProfile?.themePreference || DEFAULT_THEME;
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME);
    applyTheme(themeToApply.id, themeToApply);

  } else {
    console.log("No user detected on sign.html. Showing login form.");
    // Apply default theme if not logged in
    const allThemes = await getAvailableThemes();
    const defaultThemeObj = allThemes.find(t => t.id === DEFAULT_THEME);
    applyTheme(defaultThemeObj.id, defaultThemeObj);

    userSettingsSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    signupSection.classList.add('hidden');
  }
}


// Load navbar first, then setup auth listener and initialize Firebase
window.onload = async function() {
  // Assign DOM elements safely inside window.onload
  userSettingsSection = document.getElementById('user-settings-section');
  loginSection = document.getElementById('login-section');
  signupSection = document.getElementById('signup-section');
  userDisplayEmail = document.getElementById('user-display-email');
  userProfilePicture = document.getElementById('user-profile-picture');
  userDisplayName = document.getElementById('user-display-name');
  goToSettingsBtn = document.getElementById('go-to-settings-btn');
  logoutBtn = document.getElementById('logout-btn');
  loginEmailInput = document.getElementById('login-email');
  loginPasswordInput = document.getElementById('login-password');
  loginBtn = document.getElementById('login-btn');
  showSignupBtn = document.getElementById('show-signup-btn');
  signupEmailInput = document.getElementById('signup-email');
  signupPasswordInput = document.getElementById('signup-password');
  signupConfirmPasswordInput = document.getElementById('signup-confirm-password');
  signupBtn = document.getElementById('signup-btn');
  showLoginBtn = document.getElementById('show-login-btn');
  messageBoxElement = document.getElementById('message-box'); // Assign the element


  await setupFirebaseAndUser(); // Initialize Firebase and authenticate user
  setupThemesFirebase(db, auth, appId); // Ensure themes.js has Firebase instances


  // Load navbar dynamically after Firebase is initialized
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME);

  setupAuthUIListener(); // Start listening for auth changes and update UI

  // Event Listeners for login/signup forms
  if (showSignupBtn) {
    showSignupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginSection.classList.add('hidden');
      signupSection.classList.remove('hidden');
      showMessageBox("", false); // Clear any messages
    });
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      signupSection.classList.add('hidden');
      loginSection.classList.remove('hidden');
      showMessageBox("", false); // Clear any messages
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      showMessageBox("", false);
      const email = loginEmailInput.value;
      const password = loginPasswordInput.value;
      if (!email || !password) {
        showMessageBox("Please enter both email and password.", true);
        return;
      }
      if (!auth) {
        showMessageBox("Firebase Auth not initialized.", true);
        return;
      }
      try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessageBox("Logged in successfully!", false);
        // onAuthStateChanged in setupAuthUIListener will handle UI update
      } catch (error) {
        console.error("Login failed:", error);
        let errorMessage = "Login failed. Please check your credentials.";
        if (error.code === 'auth/user-not-found') {
          errorMessage = "No user found with this email.";
        } else if (error.code === 'auth/wrong-password') {
          errorMessage = "Incorrect password.";
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = "Invalid email format.";
        }
        showMessageBox(errorMessage, true);
      }
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
      showMessageBox("", false);
      const email = signupEmailInput.value;
      const password = signupPasswordInput.value;
      const confirmPassword = signupConfirmPasswordInput.value;

      if (!email || !password || !confirmPassword) {
        showMessageBox("All fields are required.", true);
        return;
      }
      if (password !== confirmPassword) {
        showMessageBox("Passwords do not match.", true);
        return;
      }
      if (password.length < 6) {
        showMessageBox("Password should be at least 6 characters.", true);
        return;
      }
      if (!auth) {
        showMessageBox("Firebase Auth not initialized.", true);
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create initial user profile in Firestore
        await updateUserProfileInFirestore(user.uid, {
          displayName: user.email.split('@')[0], // Default display name
          photoURL: DEFAULT_PROFILE_PIC,
          themePreference: DEFAULT_THEME,
          fontSizePreference: '16px' // Default font size
        });

        showMessageBox("Account created successfully!", false);
        // onAuthStateChanged in setupAuthUIListener will handle UI update
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

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      showMessageBox("", false);
      try {
        await signOut(auth);
        window.location.href = 'sign.html';
        // This showMessageBox might not display due to immediate redirect
        showMessageBox("You have been signed out.", false);
      } catch (error) {
        console.error("Logout failed:", error);
        showMessageBox("Logout failed: " + error.message, true);
      }
    });
  }

  if (goToSettingsBtn) {
    goToSettingsBtn.addEventListener('click', () => {
      window.location.href = 'settings.html';
    });
  }
};
