// firebase-init.js - Centralized Firebase Initialization and Exports
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Define a robust default Firebase config. This ensures firebaseConfig is always defined.
// This is the configuration provided by the user previously.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  databaseURL: "https://arcator-web-default-rtdb.firebaseio.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app",
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM"
};

const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : null;
const tempProjectId = "arcator-web"; // Fallback for local testing if __app_id is not set.
export const appId = canvasAppId || tempProjectId || 'default-app-id'; // Export appId

// Initialize firebaseConfig with the default. It can be updated later if __firebase_config is valid.
let firebaseConfig = DEFAULT_FIREBASE_CONFIG;

export let app; // Will be initialized later
export let auth; // Will be initialized later
export let db;   // Will be initialized later
export let currentUser = null; // Stores the current authenticated user's profile data
export const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
export const DEFAULT_THEME_NAME = 'dark'; // Default theme ID for new users
export const ADMIN_UIDS = ['uOaZ8v76y2Q0X7PzJtU7Y3A2C1B4']; // Example admin UIDs

let firebaseReadyResolve;
// Export firebaseReadyPromise so other modules can await it.
export const firebaseReadyPromise = new Promise(resolve => {
  firebaseReadyResolve = resolve;
});

/**
 * Retrieves a user's profile from the 'user_profiles' collection in Firestore.
 * This function is used across multiple modules (settings, navbar, forms).
 * @param {string} uid - The User ID.
 * @returns {Object|null} The user's profile data, or null if not found/error.
 */
export async function getUserProfileFromFirestore(uid) {
  // Ensure Firebase is ready before attempting Firestore operations
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore.");
    return null;
  }
  // If currentUser is already set and matches, return cached profile to avoid redundant fetches
  if (currentUser && currentUser.uid === uid) {
    return currentUser;
  }

  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return { uid: docSnap.id, ...docSnap.data() };
    } else {
      console.log("No such user profile in Firestore for UID:", uid);
      return null;
    }
  } catch (error) {
    console.error("Error getting user profile from Firestore:", error);
    return null;
  }
}

/**
 * Sets or updates a user's profile in the 'user_profiles' collection in Firestore.
 * @param {string} uid - The User ID.
 * @param {Object} profileData - The data to set/merge into the user's profile.
 * @returns {boolean} True if successful, false otherwise.
 */
export async function setUserProfileInFirestore(uid, profileData) {
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for setUserProfileInFirestore.");
    return false;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    // Update the global currentUser object if the updated profile belongs to the current user
    if (currentUser && currentUser.uid === uid) {
      currentUser = { ...currentUser, ...profileData };
    }
    console.log("DEBUG: User profile updated in Firestore for UID:", uid);
    return true;
  } catch (error) {
    console.error("Error updating user profile in Firestore:", error);
    return false;
  }
}

/**
 * Deletes a user's profile from the 'user_profiles' collection in Firestore.
 * @param {string} uid - The User ID.
 * @returns {boolean} True if successful, false otherwise.
 */
export async function deleteUserProfileFromFirestore(uid) {
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for deleteUserProfileFromFirestore.");
    return false;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await deleteDoc(userDocRef);
    console.log("DEBUG: User profile deleted from Firestore for UID:", uid);
    return true;
  } catch (error) {
    console.error("Error deleting user profile from Firestore:", error);
    return false;
  }
}


/**
 * Initializes Firebase, sets up authentication, and resolves firebaseReadyPromise.
 * This function should be called once at application start.
 */
async function setupFirebaseAndUser() {
  console.log("DEBUG: setupFirebaseAndUser called.");

  // Check if Firebase app is already initialized to prevent "duplicate-app" error
  if (getApps().length === 0) {
    // Determine the final Firebase configuration to use
    let finalFirebaseConfig = DEFAULT_FIREBASE_CONFIG; // Start with the provided default config

    if (typeof __firebase_config !== 'undefined' && __firebase_config !== null) {
      if (typeof __firebase_config === 'string') {
        try {
          finalFirebaseConfig = JSON.parse(__firebase_config); // Update global firebaseConfig
          console.log("DEBUG: __firebase_config provided as string and parsed successfully.");
        } catch (e) {
          console.error("ERROR: Failed to parse __firebase_config string as JSON. Retaining DEFAULT_FIREBASE_CONFIG.", e);
        }
      } else if (typeof __firebase_config === 'object') {
        finalFirebaseConfig = __firebase_config; // Update global firebaseConfig
        console.log("DEBUG: __firebase_config provided as object. Using directly.");
      } else {
        console.warn("DEBUG: __firebase_config provided but not string or object. Type:", typeof __firebase_config, ". Retaining DEFAULT_FIREBASE_CONFIG.");
      }
    } else {
      console.log("DEBUG: __firebase_config not provided. Using provided DEFAULT_FIREBASE_CONFIG.");
    }

    // Assign the determined config to the global firebaseConfig variable
    firebaseConfig = finalFirebaseConfig;

    try {
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app); // Assign auth instance immediately after getting it

      console.log("DEBUG: Firebase app, Firestore, and Auth initialized. DB instance:", db, "Auth instance:", auth);

      // IMPORTANT: Ensure 'auth' is defined before trying to attach a listener
      if (!auth) {
        console.error("FATAL ERROR: Firebase Auth instance is undefined after initialization.");
        firebaseReadyResolve(); // Resolve to unblock, but indicate error
        return;
      }

      // Set up Auth state observer. This will resolve firebaseReadyPromise on first auth state change.
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log("Auth State Changed: User logged in:", user ? user.uid : "null");
        if (user) {
          let userProfile = await getUserProfileFromFirestore(user.uid);
          if (!userProfile) {
            console.log("No profile found. Creating default.");
            userProfile = {
              uid: user.uid, displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
              email: user.email || null, photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
              createdAt: new Date(), lastLoginAt: new Date(), themePreference: DEFAULT_THEME_NAME, // Corrected property name
              isAdmin: ADMIN_UIDS.includes(user.uid)
            };
            await setUserProfileInFirestore(user.uid, userProfile);
          } else {
            // Update last login and admin status for existing profiles
            await setUserProfileInFirestore(user.uid, { lastLoginAt: new Date(), isAdmin: ADMIN_UIDS.includes(user.uid) });
            // Ensure currentUser reflects the latest data after the update
            userProfile.isAdmin = ADMIN_UIDS.includes(user.uid); // Add isAdmin to the returned object
          }
          currentUser = userProfile;
          console.log("DEBUG: currentUser set:", currentUser);
        } else {
          console.log("Auth State Changed: User logged out.");
          currentUser = null;
        }
        console.log("DEBUG: firebaseReadyPromise resolving.");
        firebaseReadyResolve(); // Resolve the promise AFTER currentUser is set or confirmed null
        unsubscribe(); // Unsubscribe after the first state change to prevent multiple resolutions
      });

      // Attempt initial sign-in: either with custom token or anonymously.
      // The `onAuthStateChanged` listener will then process the result.
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        console.log("DEBUG: Attempting to sign in with custom token.");
        await signInWithCustomToken(auth, __initial_auth_token).catch(e => {
          console.error("ERROR: Custom token sign-in failed:", e);
          // Fallback to anonymous sign-in if custom token fails, but don't re-init onAuthStateChanged
          signInAnonymously(auth).catch(anonError => console.error("ERROR: Anonymous sign-in failed during fallback:", anonError));
        });
      } else {
        console.log("DEBUG: __initial_auth_token not defined or empty. Signing in anonymously.");
        await signInAnonymously(auth).catch(e => console.error("ERROR: Anonymous sign-in failed:", e));
      }

    } catch (error) {
      console.error("FATAL ERROR: Failed to initialize Firebase or sign in:", error);
      // Resolve the promise even on error to unblock dependent components
      firebaseReadyResolve();
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

/**
 * Returns the currently authenticated user's profile, including custom data from Firestore.
 * This function ensures that the currentUser object is populated.
 * Call this function only after `firebaseReadyPromise` has resolved.
 * @returns {Object|null} The current user's profile object, or null if not logged in.
 */
export function getCurrentUser() {
  return currentUser;
}

// Call initialization function immediately when the script loads.
// Other modules should await `firebaseReadyPromise` before using `db` or `auth` directly.
setupFirebaseAndUser();
