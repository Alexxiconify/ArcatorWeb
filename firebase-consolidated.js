// firebase-consolidated.js - Consolidated Firebase initialization for HTML files
// This file eliminates the need for duplicate Firebase initialization code in HTML files

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  setupThemesFirebase,
  applyTheme,
  getAvailableThemes,
} from "./themes.js";
import { loadNavbar } from "./navbar.js";

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app",
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM",
};

// Determine the correct appId for Firestore paths
const canvasAppId = typeof __app_id !== "undefined" ? __app_id : null;
const appId = canvasAppId || firebaseConfig.projectId || "default-app-id";

// Firebase instances
let app;
let auth;
let db;
let firebaseReadyPromise;

// Constants
const DEFAULT_PROFILE_PIC = "https://placehold.co/32x32/1F2937/E5E7EB?text=AV";
const DEFAULT_THEME_NAME = "dark";

/**
 * Fetches user profile data from Firestore.
 * @param {string} uid - The user's UID.
 * @returns {Promise<Object|null>} - User profile data or null if not found.
 */
async function getUserProfileFromFirestore(uid) {
  await firebaseReadyPromise;
  if (!db) {
    console.error(
      "Firestore DB not initialized for getUserProfileFromFirestore.",
    );
    return null;
  }
  const userDocRef = doc(
    db,
    `artifacts/${appId}/public/data/user_profiles`,
    uid,
  );
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

/**
 * Initialize Firebase and setup firebaseReadyPromise
 */
function initializeFirebase() {
  firebaseReadyPromise = new Promise((resolve) => {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      console.log("Firebase initialized successfully.");
      setupThemesFirebase(db, auth, appId);

      // Critical: Ensure auth state is settled before resolving
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log(
          "onAuthStateChanged triggered during initialization. User:",
          user ? user.uid : "none",
        );
        unsubscribe();

        // Perform initial sign-in if in Canvas and no user is already authenticated
        if (typeof __initial_auth_token !== "undefined" && !user) {
          signInWithCustomToken(auth, __initial_auth_token)
            .then(() =>
              console.log(
                "DEBUG: Signed in with custom token from Canvas during init.",
              ),
            )
            .catch((error) => {
              console.error(
                "ERROR: Error signing in with custom token during init:",
                error,
              );
              signInAnonymously(auth)
                .then(() =>
                  console.log(
                    "DEBUG: Signed in anonymously after custom token failure during init.",
                  ),
                )
                .catch((anonError) =>
                  console.error(
                    "ERROR: Error signing in anonymously during init:",
                    anonError,
                  ),
                );
            })
            .finally(() => resolve());
        } else if (!user && typeof __initial_auth_token === "undefined") {
          signInAnonymously(auth)
            .then(() =>
              console.log(
                "DEBUG: Signed in anonymously (no custom token) during init.",
              ),
            )
            .catch((anonError) =>
              console.error(
                "ERROR: Error signing in anonymously during init:",
                anonError,
              ),
            )
            .finally(() => resolve());
        } else {
          resolve();
        }
      });
    } catch (e) {
      console.error("Error initializing Firebase:", e);
      resolve();
    }
  });
}

/**
 * Initialize a page with Firebase, navbar, and themes
 * @param {string} pageName - Name of the page for logging
 * @param {string} yearElementId - ID of the element to set current year
 * @param {boolean} useWindowLoad - Whether to use window.onload instead of DOMContentLoaded
 */
export async function initializePageWithFirebase(
  pageName,
  yearElementId = null,
  useWindowLoad = false,
) {
  const initFunction = async () => {
    console.log(`${pageName}: Initialization started.`);

    // Initialize Firebase
    initializeFirebase();
    await firebaseReadyPromise;
    console.log(`${pageName}: Firebase ready.`);

    // Load navbar
    let userProfile = null;
    if (auth.currentUser) {
      userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
    }
    await loadNavbar(
      auth.currentUser,
      userProfile,
      DEFAULT_PROFILE_PIC,
      DEFAULT_THEME_NAME,
    );
    console.log(`${pageName}: Navbar loaded.`);

    // Set current year for footer
    if (yearElementId) {
      const currentYearElement = document.getElementById(yearElementId);
      if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
        console.log(`${pageName}: Current year set for footer.`);
      }
    }

    // Apply theme
    const userThemePreference = userProfile?.themePreference;
    const allThemes = await getAvailableThemes();
    const themeToApply =
      allThemes.find((t) => t.id === userThemePreference) ||
      allThemes.find((t) => t.id === DEFAULT_THEME_NAME);
    if (themeToApply) {
      applyTheme(themeToApply.id, themeToApply);
      console.log(
        `${pageName}: Applied theme ${themeToApply.id} (${themeToApply.name})`,
      );
    }

    console.log(`${pageName}: Page initialization complete.`);
  };

  if (useWindowLoad) {
    window.onload = initFunction;
  } else {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initFunction);
    } else {
      initFunction();
    }
  }
}

// Export Firebase instances for backward compatibility
export {
  app,
  auth,
  db,
  firebaseReadyPromise,
  appId,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME,
  getUserProfileFromFirestore,
};
