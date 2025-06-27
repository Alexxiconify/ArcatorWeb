// firebase-init.js - Centralized Firebase Initialization and Exports
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase configuration object (replace with your actual config if different)
const firebaseConfig = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app",
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM"
};

// Determine the correct appId for Firestore paths
const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : null;
export const appId = canvasAppId || firebaseConfig.projectId || 'default-app-id';

// Declare Firebase instances globally (within this module)
export let app;
export let auth;
export let db;
export let currentUser = null; // Stores the current authenticated user's profile data

// Constants exported for use across modules
export const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
export const DEFAULT_THEME_NAME = 'dark';
export const ADMIN_UIDS = ['CEch8cXWemSDQnM3dHVKPt0RGpn2', 'OoeTK1HmebQyOf3gEiCKAHVtD6l2']; // Example admin UIDs

// Promise to signal when Firebase has been initialized and is ready
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
  await firebaseReadyPromise; // Ensure Firebase is ready before accessing db
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore.");
    return null;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return { uid: docSnap.id, ...docSnap.data() };
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
  await firebaseReadyPromise; // Ensure Firebase is ready before accessing db
  if (!db) { console.error("Firestore DB not initialized for setUserProfileInFirestore."); return false; }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    // Update the global currentUser object if this is the currently logged-in user
    if (auth.currentUser && auth.currentUser.uid === uid) {
      // Re-fetch the updated profile to ensure currentUser is fully synchronized
      currentUser = await getUserProfileFromFirestore(uid);
    }
    console.log("DEBUG: User profile updated in Firestore for UID:", uid);
    return true;
  } catch (error) {
    console.error("Error updating user profile in Firestore:", error);
    return false;
  }
}

// Export updateUserProfileInFirestore directly as requested by admin_and_dev.js
export { setUserProfileInFirestore as updateUserProfileInFirestore };


/**
 * Deletes a user's profile from the 'user_profiles' collection in Firestore.
 * @param {string} uid - The User ID.
 * @returns {boolean} True if successful, false otherwise.
 */
export async function deleteUserProfileFromFirestore(uid) {
  await firebaseReadyPromise; // Ensure Firebase is ready before accessing db
  if (!db) { console.error("Firestore DB not initialized for deleteUserProfileFromFirestore."); return false; }
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
 * Initializes Firebase app and core services.
 * This function is called immediately when the module loads.
 */
async function setupFirebaseCore() {
  console.log("DEBUG: setupFirebaseCore called.");

  if (getApps().length === 0) {
    let finalFirebaseConfig = firebaseConfig; // Default to hardcoded config

    // Attempt to get config from Canvas environment
    if (typeof __firebase_config !== 'undefined' && __firebase_config !== null) {
      if (typeof __firebase_config === 'string') {
        try {
          finalFirebaseConfig = JSON.parse(__firebase_config);
          console.log("DEBUG: __firebase_config provided as string and parsed successfully.");
        } catch (e) {
          console.error("ERROR: Failed to parse __firebase_config string as JSON. Using hardcoded firebaseConfig. Error:", e);
          finalFirebaseConfig = firebaseConfig;
        }
      } else if (typeof __firebase_config === 'object') {
        // If it's already an object, use it directly without parsing
        finalFirebaseConfig = __firebase_config;
        console.log("DEBUG: __firebase_config provided as object. Using directly.");
      } else {
        console.warn("DEBUG: __firebase_config provided but not string or object. Type:", typeof __firebase_config, ". Using hardcoded firebaseConfig.");
        finalFirebaseConfig = firebaseConfig;
      }
    } else {
      console.log("DEBUG: __firebase_config not provided by Canvas. Using hardcoded firebaseConfig.");
    }

    console.log("DEBUG: Final Firebase config to be used:", finalFirebaseConfig);

    try {
      // Initialize Firebase app and services
      app = initializeApp(finalFirebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      console.log("Firebase initialized successfully.");

      // Resolve firebaseReadyPromise as soon as Firebase instances are available
      firebaseReadyResolve();

      // Attempt to sign in with custom token if provided (e.g., from Canvas environment)
      // This is done after firebaseReadyResolve to ensure auth is fully set up.
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        console.log("DEBUG: Attempting to sign in with custom token.");
        await signInWithCustomToken(auth, __initial_auth_token)
            .then(() => console.log("DEBUG: Signed in with custom token."))
            .catch((error) => {
              console.error("ERROR: Custom token sign-in failed:", error);
            });
      } else {
        console.log("DEBUG: __initial_auth_token not defined. Relying on platform for initial auth state (could be anonymous or null).");
      }

    } catch (e) {
      console.error("Error initializing Firebase (initial block):", e);
      firebaseReadyResolve(); // Resolve on error to prevent infinite loading state
    }
  } else {
    // If app already exists (e.g., hot reload in dev environment), reuse existing instances
    app = getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("DEBUG: Firebase app already initialized. Re-using existing app instance.");
    firebaseReadyResolve(); // Ensure promise is resolved if already initialized
  }
}

// Call core initialization function immediately when the module loads.
setupFirebaseCore();

// Register onAuthStateChanged listener ONLY after firebaseReadyPromise resolves.
// This ensures 'auth' and 'db' instances are definitely available.
firebaseReadyPromise.then(() => {
  // Export onAuthStateChanged directly from here so it can be imported by other modules
  // The onAuthStateChanged listener needs to be set up here within firebase-init.js,
  // while the exported `onAuthStateChanged` is for other modules to subscribe to changes.
  // This is a common pattern for modules that provide a service (like Firebase auth state).
  // The global 'onAuthStateChanged' function from the Firebase SDK is imported at the top.
  // We can then re-export it along with our setup logic.

  // No change needed to the listener itself, just ensuring the function is exported.
  // The listener below is for internal state management within firebase-init.js,
  onAuthStateChanged(auth, async (user) => {
    console.log("onAuthStateChanged triggered. User:", user ? user.uid : "none");
    if (user) {
      // Check if user profile exists in Firestore, create if not
      let userProfile = await getUserProfileFromFirestore(user.uid);
      if (!userProfile) {
        console.log("No profile found. Creating default.");
        userProfile = {
          uid: user.uid,
          displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
          email: user.email || null,
          photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          themePreference: DEFAULT_THEME_NAME,
          isAdmin: ADMIN_UIDS.includes(user.uid),
          handle: user.uid.substring(0, 6) // Default handle from UID
        };
        await setUserProfileInFirestore(user.uid, userProfile);
      } else {
        // Update last login time and isAdmin status for existing profiles
        const updateData = {
          lastLoginAt: new Date(),
          isAdmin: ADMIN_UIDS.includes(user.uid)
        };
        if (!userProfile.photoURL) {
          updateData.photoURL = DEFAULT_PROFILE_PIC;
        }
        await setUserProfileInFirestore(user.uid, updateData);
        userProfile.isAdmin = ADMIN_UIDS.includes(user.uid); // Ensure local object is updated
      }
      currentUser = userProfile;
      window.currentUser = userProfile; // Ensure global sync for forms.js
      // Notify UI when user/profile is ready
      if (typeof window.onUserReady === 'function') window.onUserReady();

      // Refresh navbar profile picture if navbar is loaded
      if (typeof window.refreshNavbarProfilePicture === 'function') {
        try {
          // Add a small delay to ensure navbar is loaded
          setTimeout(async () => {
            try {
              await window.refreshNavbarProfilePicture();
            } catch (error) {
              console.error('[DEBUG] Error refreshing navbar profile picture after delay:', error);
            }
          }, 100);
        } catch (error) {
          console.error('[DEBUG] Error refreshing navbar profile picture:', error);
        }
      }
    } else {
      console.log("Auth State Changed: User logged out.");
      currentUser = null;
      window.currentUser = null; // Ensure global sync for forms.js
      if (typeof window.onUserReady === 'function') window.onUserReady();

      // Refresh navbar profile picture if navbar is loaded
      if (typeof window.refreshNavbarProfilePicture === 'function') {
        try {
          // Add a small delay to ensure navbar is loaded
          setTimeout(async () => {
            try {
              await window.refreshNavbarProfilePicture();
            } catch (error) {
              console.error('[DEBUG] Error refreshing navbar profile picture after delay:', error);
            }
          }, 100);
        } catch (error) {
          console.error('[DEBUG] Error refreshing navbar profile picture:', error);
        }
      }
    }
    // Do NOT unsubscribe here, allowing subsequent auth state changes to be caught.
  });
}).catch(error => {
  console.error("Error setting up onAuthStateChanged listener after Firebase ready:", error);
});

// Explicitly export onAuthStateChanged from firebase/auth for use in other modules
export { onAuthStateChanged };
