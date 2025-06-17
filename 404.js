import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase configuration
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
let firebaseReadyPromise; // Promise to ensure Firebase is fully initialized and authenticated

const DEFAULT_THEME = 'dark';
const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV'; // Default placeholder

/**
 * Fetches user profile data from Firestore.
 * @param {string} uid - The user's UID.
 * @returns {Promise<Object|null>} - User profile data or null if not found.
 */
async function getUserProfileFromFirestore(uid) {
  await firebaseReadyPromise; // Ensure Firebase is initialized
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore.");
    return null;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("Error fetching user profile from Firestore:", error);
  }
  return null;
}

// Initialize Firebase and setup firebaseReadyPromise
firebaseReadyPromise = new Promise((resolve) => {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase initialized successfully.");
    setupThemesFirebase(db, auth, appId); // Pass Firebase instances to themes.js

    // Critical: Ensure auth state is settled before resolving
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("onAuthStateChanged triggered during initialization. User:", user ? user.uid : "none");
      unsubscribe(); // Unsubscribe after the first call

      // Perform initial sign-in if in Canvas and no user is already authenticated
      if (typeof __initial_auth_token !== 'undefined' && !user) {
        signInWithCustomToken(auth, __initial_auth_token)
          .then(() => console.log("DEBUG: Signed in with custom token from Canvas (404 page) during init."))
          .catch((error) => {
            console.error("ERROR: Error signing in with custom token (404 page) during init:", error);
            signInAnonymously(auth) // Fallback to anonymous sign-in if custom token fails
              .then(() => console.log("DEBUG: Signed in anonymously (404 page) after custom token failure during init."))
              .catch((anonError) => console.error("ERROR: Error signing in anonymously on 404 page during init:", anonError));
          })
          .finally(() => resolve()); // Resolve promise after token attempt
      } else if (!user && typeof __initial_auth_token === 'undefined') {
        signInAnonymously(auth)
          .then(() => console.log("DEBUG: Signed in anonymously (no custom token) on 404 page during init."))
          .catch((anonError) => console.error("ERROR: Error signing in anonymously on 404 page during init:", anonError))
          .finally(() => resolve());
      }
      else {
        resolve(); // Resolve immediately if user is already authenticated or no token to use
      }
    });
  } catch (e) {
    console.error("Error initializing Firebase (initial block):", e);
    resolve(); // Resolve immediately on error to prevent infinite loading
  }
});


// Main execution logic on window load
window.onload = async function() {
  // Wait for Firebase to be ready before proceeding
  await firebaseReadyPromise;

  // Load navbar dynamically
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME);

  // Apply theme
  onAuthStateChanged(auth, async (user) => {
    let userThemePreference = null;
    if (user) {
      const userProfile = await getUserProfileFromFirestore(user.uid);
      userThemePreference = userProfile?.themePreference;
    }
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME);
    applyTheme(themeToApply.id, themeToApply);
  });
};
