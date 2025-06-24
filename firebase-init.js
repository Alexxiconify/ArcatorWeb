// firebase-init.js - Centralized Firebase Initialization and Exports
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase configuration object
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
export const appId = canvasAppId || firebaseConfig.projectId || 'default-app-id'; // Export appId

export let app;
export let auth;
export let db;
export let currentUser = null; // Stores the current authenticated user's profile data

// Exporting constants for profile pic, theme, and admin UIDs
export const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV'; // Default placeholder
export const DEFAULT_THEME_NAME = 'dark'; // Default theme name
export const ADMIN_UIDS = ['uOaZ8v76y2Q0X7PzJtU7Y3A2C1B4']; // Example admin UIDs

let firebaseReadyResolve;
export const firebaseReadyPromise = new Promise((resolve) => {
  firebaseReadyResolve = resolve;
});


/**
 * Fetches user profile data from Firestore.
 * @param {string} uid - The user's UID.
 * @returns {Promise<Object|null>} - User profile data or null if not found.
 */
export async function getUserProfileFromFirestore(uid) {
  await firebaseReadyPromise; // Ensure Firebase is initialized
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore.");
    return null;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return { uid: docSnap.id, ...docSnap.data() }; // Include UID in the returned object
    }
  } catch (error) {
    console.error("Error fetching user profile from Firestore:", error);
  }
  return null;
}

/**
 * Sets or updates a user's profile in the 'user_profiles' collection in Firestore.
 * @param {string} uid - The User ID.
 * @param {Object} profileData - The data to set/merge into the user's profile.
 * @returns {boolean} True if successful, false otherwise.
 */
export async function setUserProfileInFirestore(uid, profileData) {
  await firebaseReadyPromise;
  if (!db) { console.error("Firestore DB not initialized for setUserProfileInFirestore."); return false; }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    if (currentUser && currentUser.uid === uid) { currentUser = { ...currentUser, ...profileData }; }
    console.log("DEBUG: User profile updated in Firestore for UID:", uid);
    return true;
  } catch (error) { console.error("Error updating user profile in Firestore:", error); return false; }
}

/**
 * Deletes a user's profile from the 'user_profiles' collection in Firestore.
 * @param {string} uid - The User ID.
 * @returns {boolean} True if successful, false otherwise.
 */
export async function deleteUserProfileFromFirestore(uid) {
  await firebaseReadyPromise;
  if (!db) { console.error("Firestore DB not initialized for deleteUserProfileFromFirestore."); return false; }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await deleteDoc(userDocRef);
    console.log("DEBUG: User profile deleted from Firestore for UID:", uid);
    return true;
  } catch (error) { console.error("Error deleting user profile from Firestore:", error); return false; }
}


/**
 * Initializes Firebase, sets up authentication, and resolves firebaseReadyPromise.
 * This function should be called once at application start.
 */
async function setupFirebaseAndUser() {
  console.log("DEBUG: setupFirebaseAndUser called.");

  // Check if Firebase app is already initialized to prevent "duplicate-app" error
  if (getApps().length === 0) {
    let finalFirebaseConfig = firebaseConfig; // Start with the hardcoded config

    if (typeof __firebase_config !== 'undefined' && __firebase_config !== null) {
      if (typeof __firebase_config === 'string') {
        try {
          finalFirebaseConfig = JSON.parse(__firebase_config);
          console.log("DEBUG: __firebase_config provided as string and parsed successfully.");
        } catch (e) {
          console.error("ERROR: Failed to parse __firebase_config string as JSON. Retaining hardcoded firebaseConfig.", e);
        }
      } else if (typeof __firebase_config === 'object') {
        finalFirebaseConfig = __firebase_config;
        console.log("DEBUG: __firebase_config provided as object. Using directly.");
      } else {
        console.warn("DEBUG: __firebase_config provided but not string or object. Type:", typeof __firebase_config, ". Retaining hardcoded firebaseConfig.");
      }
    } else {
      console.log("DEBUG: __firebase_config not provided. Using hardcoded firebaseConfig.");
    }

    try {
      app = initializeApp(finalFirebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      console.log("Firebase initialized successfully.");

      // Critical: Ensure auth state is settled before resolving firebaseReadyPromise
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log("onAuthStateChanged triggered during initialization. User:", user ? user.uid : "none");
        if (user) {
          let userProfile = await getUserProfileFromFirestore(user.uid);
          if (!userProfile) {
            console.log("No profile found. Creating default.");
            userProfile = {
              uid: user.uid, displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
              email: user.email || null, photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
              createdAt: new Date(), lastLoginAt: new Date(), themePreference: DEFAULT_THEME_NAME,
              isAdmin: ADMIN_UIDS.includes(user.uid)
            };
            await setUserProfileInFirestore(user.uid, userProfile);
          } else {
            await setUserProfileInFirestore(user.uid, { lastLoginAt: new Date(), isAdmin: ADMIN_UIDS.includes(user.uid) });
            userProfile.isAdmin = ADMIN_UIDS.includes(user.uid); // Update isAdmin status
          }
          currentUser = userProfile;
          console.log("DEBUG: currentUser set:", currentUser);
        } else {
          console.log("Auth State Changed: User logged out.");
          currentUser = null;
        }
        firebaseReadyResolve(); // Resolve the promise AFTER currentUser is set or confirmed null
        unsubscribe(); // Unsubscribe after the first state change to prevent multiple resolutions
      });

      // Attempt initial sign-in: either with custom token.
      // DO NOT explicitly call signInAnonymously here. The Canvas environment
      // will automatically sign in an anonymous user if no custom token is provided
      // and no user is logged in. This avoids redundant anonymous sign-ins.
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        console.log("DEBUG: Attempting to sign in with custom token.");
        await signInWithCustomToken(auth, __initial_auth_token)
            .then(() => console.log("DEBUG: Signed in with custom token."))
            .catch((error) => {
              console.error("ERROR: Custom token sign-in failed:", error);
              // No explicit anonymous fallback here. Rely on platform's default.
            });
      } else {
        console.log("DEBUG: __initial_auth_token not defined. Relying on platform for initial auth state (could be anonymous or null).");
        // The onAuthStateChanged listener above will handle the actual user state.
      }

    } catch (e) {
      console.error("Error initializing Firebase (initial block):", e);
      firebaseReadyResolve(); // Resolve immediately on error to prevent infinite loading
    }
  } else {
    // If app already exists, retrieve it and set global variables
    app = getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("DEBUG: Firebase app already initialized. Re-using existing app instance.");
    firebaseReadyResolve(); // Ensure promise is resolved if already initialized
  }
}

// Call initialization function immediately when the script loads.
setupFirebaseAndUser();
