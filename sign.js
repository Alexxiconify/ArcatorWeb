import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  signInAnonymously,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';

// Hardcoded Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  databaseURL: "https://arcator-web-default-rtdb.firebaseio.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app",
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM"
};

const appId = "arcator-web"; // Explicitly set appId

let app;
let auth;
let db;
let isFirebaseInitialized = false;

// DOM Elements (assigned inside window.onload)
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
let messageBox;

const DEFAULT_PROFILE_PIC = 'https://placehold.co/96x96/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME = 'dark'; // Default theme name

/**
 * Displays a custom message box for user feedback.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True for error, false for success.
 */
window.showMessageBox = function(message, isError) {
  if (messageBox) {
    messageBox.textContent = message;
    messageBox.className = 'message-box';
    if (isError) {
      messageBox.classList.add('error');
    } else {
      messageBox.classList.add('success');
    }
    messageBox.style.display = 'block';
    setTimeout(() => {
      messageBox.style.display = 'none';
    }, 5000);
  } else {
    console.warn("showMessageBox called before messageBox element was available:", message);
  }
}

/**
 * Fetches user profile data from Firestore.
 * @param {string} uid - The user's UID.
 * @returns {Promise<Object|null>} - User profile data or null if not found.
 */
async function getUserProfileFromFirestore(uid) {
  if (!db) {
    console.error("Firestore DB not initialized.");
    return null;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    window.showMessageBox(`Error loading profile: ${error.message}`, true);
  }
  return null;
}

/**
 * Updates user profile data in Firestore.
 * @param {string} uid - The user's UID.
 * @param {Object} profileData - The data to update.
 */
async function updateUserProfileInFirestore(uid, profileData) {
  if (!db) {
    window.showMessageBox("Database not initialized. Cannot save profile.", true);
    return false;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    return true;
  } catch (error) {
    console.error("Error updating user profile in Firestore:", error);
    window.showMessageBox(`Error saving profile: ${error.message}`, true);
    return false;
  }
}

// Main authentication state listener and UI update logic
async function setupAuthStateListener() {
  if (!auth) {
    console.error("Auth is not initialized. Cannot set up auth state listener.");
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("User detected on sign.html:", user.uid);
      // Fetch user profile from Firestore
      const userProfile = await getUserProfileFromFirestore(user.uid);

      userDisplayEmail.textContent = user.email || "Anonymous User";
      userProfilePicture.src = userProfile?.photoURL || user.photoURL || DEFAULT_PROFILE_PIC;
      userDisplayName.textContent = userProfile?.displayName || user.displayName || '';

      // Show logged-in section, hide login/signup forms
      userSettingsSection.classList.remove('hidden');
      loginSection.classList.add('hidden');
      signupSection.classList.add('hidden');

      // Apply user's theme preference if available, otherwise default
      const userThemePreference = userProfile?.themePreference || DEFAULT_THEME;
      const allThemes = await getAvailableThemes(); // Call imported function
      const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME);
      applyTheme(themeToApply.id, themeToApply); // Call imported function

    } else {
      console.log("No user detected on sign.html. Showing login form.");
      // Apply default theme if not logged in
      const allThemes = await getAvailableThemes(); // Call imported function
      const defaultThemeObj = allThemes.find(t => t.id === DEFAULT_THEME);
      applyTheme(defaultThemeObj.id, defaultThemeObj); // Call imported function

      // Show login form by default if not logged in
      userSettingsSection.classList.add('hidden');
      loginSection.classList.remove('hidden');
      signupSection.classList.add('hidden');

      // Attempt anonymous sign-in if Firebase is initialized
      if (isFirebaseInitialized) {
        signInAnonymously(auth).then(() => {
          console.log("Signed in anonymously on sign.html (Canvas env).");
        }).catch(error => {
          console.error("Anonymous sign-in failed during theme load:", error);
        });
      }
    }
  });
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
  messageBox = document.getElementById('message-box');

  // IMPORTANT: Make sure __app_id and __firebase_config are handled for Canvas
  const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId;
  const firebaseConfigFromCanvas = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
  const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

  // Initialize Firebase
  try {
    app = initializeApp(firebaseConfigFromCanvas);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseInitialized = true;
    console.log("Firebase initialized successfully on sign.html.");
    setupThemesFirebase(db, auth, canvasAppId); // Pass auth and appId to themes.js

    // Attempt initial sign-in for Canvas if token is available
    if (initialAuthToken) {
      await signInWithCustomToken(auth, initialAuthToken);
      console.log("Signed in with custom token from Canvas (sign.html).");
    } else {
      // Fallback to anonymous sign-in if no custom token
      await signInAnonymously(auth);
      console.log("Signed in anonymously on sign.html (no custom token).");
    }
  } catch (e) {
    console.error("Error initializing Firebase on sign.html:", e);
    window.showMessageBox("Error initializing Firebase. Authentication features will not work. Please check console.", true);
  }

  // Load navbar dynamically after Firebase is initialized
  await loadNavbar({ auth, db, appId: canvasAppId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME);

  if (isFirebaseInitialized) {
    setupAuthStateListener(); // Start listening for auth changes
  } else {
    // If Firebase not initialized, just show login form and apply default theme
    userSettingsSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    signupSection.classList.add('hidden');
    applyTheme(DEFAULT_THEME); // Call imported function
  }

  // Event Listeners for login/signup forms
  if (showSignupBtn) {
    showSignupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginSection.classList.add('hidden');
      signupSection.classList.remove('hidden');
      window.showMessageBox("", false); // Clear any messages
    });
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      signupSection.classList.add('hidden');
      loginSection.classList.remove('hidden');
      window.showMessageBox("", false); // Clear any messages
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      window.showMessageBox("", false);
      const email = loginEmailInput.value;
      const password = loginPasswordInput.value;
      if (!email || !password) {
        window.showMessageBox("Please enter both email and password.", true);
        return;
      }
      if (!auth) {
        window.showMessageBox("Firebase Auth not initialized.", true);
        return;
      }
      try {
        await signInWithEmailAndPassword(auth, email, password);
        window.showMessageBox("Logged in successfully!", false);
        // onAuthStateChanged will handle UI update
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
        window.showMessageBox(errorMessage, true);
      }
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
      window.showMessageBox("", false);
      const email = signupEmailInput.value;
      const password = signupPasswordInput.value;
      const confirmPassword = signupConfirmPasswordInput.value;

      if (!email || !password || !confirmPassword) {
        window.showMessageBox("All fields are required.", true);
        return;
      }
      if (password !== confirmPassword) {
        window.showMessageBox("Passwords do not match.", true);
        return;
      }
      if (password.length < 6) {
        window.showMessageBox("Password should be at least 6 characters.", true);
        return;
      }
      if (!auth) {
        window.showMessageBox("Firebase Auth not initialized.", true);
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

        window.showMessageBox("Account created successfully!", false);
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
        window.showMessageBox(errorMessage, true);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      window.showMessageBox("", false);
      try {
        await signOut(auth);
        window.location.href = 'sign.html'; // Redirect to sign-in page after logout
        window.showMessageBox("You have been signed out.", false); // This might not show due to redirect
      } catch (error) {
        console.error("Logout failed:", error);
        window.showMessageBox("Logout failed: " + error.message, true);
      }
    });
  }

  if (goToSettingsBtn) {
    goToSettingsBtn.addEventListener('click', () => {
      window.location.href = 'settings.html';
    });
  }
};
