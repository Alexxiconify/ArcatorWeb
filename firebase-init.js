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
export const ADMIN_UIDS = ['uOaZ8v76y2Q0X7PzJtU7Y3A2C1B4']; // Example admin UIDs

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
  await firebaseReadyPromise; // Ensure Firebase is ready
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
  await firebaseReadyPromise; // Ensure Firebase is ready
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

/**
 * Deletes a user's profile from the 'user_profiles' collection in Firestore.
 * @param {string} uid - The User ID.
 * @returns {boolean} True if successful, false otherwise.
 */
export async function deleteUserProfileFromFirestore(uid) {
  await firebaseReadyPromise; // Ensure Firebase is ready
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
 * Initializes Firebase, sets up authentication, and resolves firebaseReadyPromise.
 * This function is called immediately when the module loads.
 */
async function setupFirebaseAndUser() {
  console.log("DEBUG: setupFirebaseAndUser called.");

  if (getApps().length === 0) {
    let finalFirebaseConfig = firebaseConfig;

    // Attempt to parse __firebase_config from the Canvas environment
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
      // Initialize Firebase app and services
      app = initializeApp(finalFirebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      console.log("Firebase initialized successfully.");

      // Resolve firebaseReadyPromise as soon as Firebase instances are available
      firebaseReadyResolve();

      // Listen for auth state changes to update currentUser and handle initial profile creation
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
              photoURL: DEFAULT_PROFILE_PIC,
              createdAt: new Date(),
              lastLoginAt: new Date(),
              themePreference: DEFAULT_THEME_NAME,
              isAdmin: ADMIN_UIDS.includes(user.uid),
              handle: user.uid.substring(0, 6) // Default handle from UID
            };
            await setUserProfileInFirestore(user.uid, userProfile);
          } else {
            // Update last login time and isAdmin status for existing profiles
            await setUserProfileInFirestore(user.uid, { lastLoginAt: new Date(), isAdmin: ADMIN_UIDS.includes(user.uid) });
            userProfile.isAdmin = ADMIN_UIDS.includes(user.uid); // Ensure local object is updated
          }
          currentUser = userProfile;
          console.log("DEBUG: currentUser set:", currentUser);
        } else {
          console.log("Auth State Changed: User logged out.");
          currentUser = null;
        }
        // Do NOT unsubscribe here, as other parts of the app might need to react to auth changes.
      });

      // Attempt to sign in with custom token if provided (e.g., from Canvas environment)
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

// Call initialization function immediately when the script loads.
setupFirebaseAndUser();
