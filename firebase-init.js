// firebase-init.js - Centralized Firebase Initialization and Exports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase configuration (use __firebase_config if available, otherwise fallback)
let rawFirebaseConfig = '';
export let firebaseConfig = {}; // Initialize as empty object and export

if (typeof __firebase_config !== 'undefined' && __firebase_config) {
  // Ensure __firebase_config is a string before attempting to parse
  if (typeof __firebase_config === 'string') {
    rawFirebaseConfig = __firebase_config;
    console.log("DEBUG: __firebase_config provided as string. Raw value:", rawFirebaseConfig);
  } else if (typeof __firebase_config === 'object' && __firebase_config !== null) {
    // If it's already an object, assume it's pre-parsed and use it directly
    firebaseConfig = __firebase_config;
    console.log("DEBUG: __firebase_config provided as object. Using directly.");
  } else {
    console.warn("DEBUG: __firebase_config provided but not a string or object. Type:", typeof __firebase_config);
  }
} else {
  // IMPORTANT: For local testing, ensure this fallback JSON is valid.
  rawFirebaseConfig = ` {
        "apiKey": "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
        "authDomain": "arcator-web.firebaseapp.com",
        "projectId": "arcator-web",
        "storageBucket": "arcator-web.firebasestorage.app",
        "messagingSenderId": "1033082068049",
        "appId": "1:1033082068049:web:dd154c8b188bde1930ec70",
        "measurementId": "G-DJXNT1L7CM"
    }
  `;
  console.log("DEBUG: __firebase_config not provided. Using fallback. Raw value:", rawFirebaseConfig);
}

// Only attempt JSON.parse if rawFirebaseConfig is a non-empty string and firebaseConfig wasn't set as an object already
if (typeof firebaseConfig.apiKey === 'undefined' && rawFirebaseConfig) {
  try {
    firebaseConfig = JSON.parse(rawFirebaseConfig);
    console.log("DEBUG: Successfully parsed firebaseConfig.");
  } catch (e) {
    console.error("ERROR: Failed to parse firebaseConfig JSON. Raw config was:", rawFirebaseConfig, "Error:", e);
    firebaseConfig = { apiKey: "PARSE_ERROR_FALLBACK" }; // Fallback to prevent app crash
  }
}


// Determine appId for Firestore paths
export const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId || 'default-app-id';
console.log("DEBUG: App ID set to:", appId);

// Firebase instances (will be initialized and exported)
export let app;
export let auth;
export let db;

// Promise that resolves once Firebase is initialized and authenticated
export let firebaseReadyPromise;

// Current authenticated user (enriched with profile data)
let currentUser = null;
// IMPORTANT: Add actual admin UIDs here for privilege checking
export const ADMIN_UIDS = []; // Define ADMIN_UIDS in firebase-init.js


// Default values
export const DEFAULT_PROFILE_PIC = 'https://placehold.co/128x128/1F2937/E5E7EB?text=AV';
export const DEFAULT_THEME_NAME = 'dark';


/**
 * Initializes Firebase and sets up the authentication state listener.
 * This function is called once at the start of the application.
 * It resolves the firebaseReadyPromise once authentication state is established.
 */
export async function setupFirebaseAndUser() { // Export this function
  if (firebaseReadyPromise) {
    console.log("DEBUG: firebaseReadyPromise already exists. Returning existing promise.");
    return firebaseReadyPromise; // Return existing promise if already initializing
  }

  firebaseReadyPromise = new Promise(async (resolve) => {
    try {
      if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "PARSE_ERROR_FALLBACK") {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("DEBUG: Firebase app, auth, db initialized.");
      } else {
        console.error("Firebase initialization skipped: Invalid or missing API key.");
        resolve(); // Resolve promise even on initialization failure
        return;
      }

      // Check if auth is defined before using onAuthStateChanged
      if (auth) {
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            currentUser = { ...user, isAdmin: ADMIN_UIDS.includes(user.uid) };
            console.log("DEBUG: User signed in:", user.uid, "Is Admin:", currentUser.isAdmin);
            const userProfile = await getUserProfileFromFirestore(user.uid);
            if (userProfile) {
              currentUser = { ...currentUser, ...userProfile };
              console.log("DEBUG: User profile fetched and merged.");
            }
            resolve();
          } else {
            console.log("DEBUG: No user signed in. Attempting anonymous or custom token login.");
            // If no user, try to sign in with custom token or anonymously
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
              try {
                await signInWithCustomToken(auth, __initial_auth_token);
                console.log("DEBUG: Signed in with custom token.");
              } catch (error) {
                console.warn("Error signing in with custom token:", error.message, "Falling back to anonymous.");
                await signInAnonymously(auth); // Fallback to anonymous
              }
            } else {
              await signInAnonymously(auth);
              console.log("DEBUG: Signed in anonymously.");
            }
            // The onAuthStateChanged listener will trigger again with the new user state
            // and resolve the promise from that new state.
          }
        });
      } else {
        console.error("Firebase Auth not initialized. Cannot set up onAuthStateChanged listener.");
        resolve(); // Resolve promise if auth is not available
      }
    } catch (e) {
      console.error("Error initializing Firebase (setupFirebaseAndUser):", e);
      resolve(); // Resolve on error to prevent indefinite loading
    }
  });
  return firebaseReadyPromise;
}

/**
 * Gets the current authenticated user object, including isAdmin status and profile data.
 * This will reflect the state after `setupFirebaseAndUser` has resolved.
 * @returns {Object|null} The current user object or null.
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Fetches a user's profile data from the 'user_profiles' collection in Firestore.
 * This function waits for `firebaseReadyPromise` if `db` is not yet initialized.
 * @param {string} uid - The User ID (UID) of the profile to fetch.
 * @returns {Promise<Object|null>} A Promise that resolves with the user's profile data object,
 * or `null` if the profile is not found or an error occurs.
 */
export async function getUserProfileFromFirestore(uid) {
  await firebaseReadyPromise; // Ensure Firebase is initialized and auth state is ready
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore.");
    return null;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log("DEBUG: User profile not found for UID:", uid);
    }
  } catch (error) {
    console.error("Error fetching user profile from Firestore:", error);
  }
  return null;
}

/**
 * Updates a user's profile data in the 'user_profiles' collection in Firestore.
 * This function waits for `firebaseReadyPromise` if `db` is not yet initialized.
 * @param {string} uid - The User ID (UID) of the profile to update.
 * @param {Object} profileData - An object containing the profile data to set or merge.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export async function updateUserProfileInFirestore(uid, profileData) {
  await firebaseReadyPromise; // Ensure Firebase is initialized and auth state is ready
  if (!db) {
    console.error("Firestore DB not initialized for updateUserProfileInFirestore.");
    return false;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    // Also update the local currentUser object if it's the current user
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
 * This function waits for `firebaseReadyPromise` if `db` is not yet initialized.
 * @param {string} uid - The User ID (UID) of the profile to delete.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export async function deleteUserProfileFromFirestore(uid) {
  await firebaseReadyPromise; // Ensure Firebase is initialized and auth state is ready
  if (!db) {
    console.error("Firestore DB not initialized for deleteUserProfileFromFirestore after firebaseReadyPromise.");
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


// Call initialization function immediately when the script loads.
// Other modules should await `firebaseReadyPromise` before using `db` or `auth` directly.
setupFirebaseAndUser();
