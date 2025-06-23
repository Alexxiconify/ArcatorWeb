// firebase-init.js - Centralized Firebase Initialization and Exports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase configuration (use __firebase_config if available, otherwise fallback)
let rawFirebaseConfig = '';
let firebaseConfig = {}; // Initialize as empty object

if (typeof __firebase_config !== 'undefined' && __firebase_config) {
  rawFirebaseConfig = __firebase_config;
  console.log("DEBUG: __firebase_config provided. Raw value:", rawFirebaseConfig);
} else {
  // IMPORTANT: For local testing, ensure this fallback JSON is valid.
  // The error "Unexpected token '-'" might indicate a malformed string if not used with backticks.
  rawFirebaseConfig = `{
        "apiKey": "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
        "authDomain": "arcator-web.firebaseapp.com",
        "projectId": "arcator-web",
        "storageBucket": "arcator-web.firebasestorage.app",
        "messagingSenderId": "1033082068049",
        "appId": "1:1033082068049:web:dd154c8b188bde1930ec70",
        "measurementId": "G-DJXNT1L7CM"
    }`;
  console.log("DEBUG: Using fallback firebaseConfig string.");
}

try {
  firebaseConfig = JSON.parse(rawFirebaseConfig);
  console.log("DEBUG: Parsed firebaseConfig object:", firebaseConfig);
} catch (e) {
  console.error("ERROR: Failed to parse firebaseConfig JSON. Raw config was:", rawFirebaseConfig, "Error:", e);
  // Fallback to a minimal, potentially non-functional config if parsing fails
  firebaseConfig = {
    apiKey: "PARSE_ERROR_FALLBACK",
    authDomain: "error.firebaseapp.com",
    projectId: "error-project",
    appId: "1:1:web:error"
  };
  // Attempt to extract API key from the error message if it's the specific ReferenceError
  const apiKeyMatch = e.message.match(/(\w{20,})/); // Regex to find a long alphanumeric string
  if (apiKeyMatch && apiKeyMatch[1] === rawFirebaseConfig) { // Check if the raw config was just the key itself
    console.error("HINT: It appears your __firebase_config might be provided as an unquoted string, e.g., AIza... instead of \"AIza...\". It must be a valid JSON string.");
  }
}

// Determine appId for Firestore paths
export const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId || 'default-app-id';

// Firebase instances (will be initialized and exported)
export let app;
export let auth;
export let db;

// Promise that resolves once Firebase is initialized and authenticated
export let firebaseReadyPromise;

// Current authenticated user (enriched with profile data)
let currentUser = null;
// IMPORTANT: Add actual admin UIDs here for privilege checking
export const ADMIN_UIDS = [];

// Default values
export const DEFAULT_PROFILE_PIC = 'https://placehold.co/128x128/1F2937/E5E7EB?text=AV';
export const DEFAULT_THEME_NAME = 'dark';

/**
 * Initializes Firebase and sets up the authentication state listener.
 * This function is called once at the start of the application.
 * It resolves the firebaseReadyPromise once authentication state is established.
 */
export async function setupFirebaseAndUser() {
  if (firebaseReadyPromise) {
    console.log("Firebase already initializing or initialized. Returning existing promise.");
    return firebaseReadyPromise;
  }

  // Create a new promise that resolves when Firebase is truly ready
  firebaseReadyPromise = new Promise(async (resolve) => {
    try {
      // Only attempt to initialize Firebase if a valid API key (or non-fallback) exists
      if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "PARSE_ERROR_FALLBACK") {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized successfully.");
      } else {
        console.error("Firebase initialization skipped due to invalid or missing API key in config.");
        resolve(); // Resolve promise even on initialization failure to prevent blocking
        return;
      }

      // Set up auth state listener to update currentUser and handle custom token
      // This listener handles the initial authentication state.
      onAuthStateChanged(auth, async (user) => {
        console.log("onAuthStateChanged triggered. User:", user ? user.uid : "none");
        if (user) {
          // User is logged in (via email/password or custom token)
          currentUser = { ...user, isAdmin: ADMIN_UIDS.includes(user.uid) };
          // Fetch additional profile data and merge
          const userProfile = await getUserProfileFromFirestore(user.uid);
          if (userProfile) {
            currentUser = { ...currentUser, ...userProfile };
          }
          resolve(); // Resolve the promise once we have a user (or determined anonymous)
        } else {
          // No user or signed out. Attempt anonymous login if no custom token provided.
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            try {
              await signInWithCustomToken(auth, __initial_auth_token);
              console.log("DEBUG: Signed in with custom token from Canvas.");
              // onAuthStateChanged will trigger again with the new user, and resolve then.
              return;
            } catch (error) {
              console.error("ERROR: Error signing in with custom token:", error);
              // Fallback to anonymous if custom token fails
              await signInAnonymously(auth);
              console.log("DEBUG: Signed in anonymously after custom token failure.");
              // onAuthStateChanged will trigger again with anonymous user, and resolve then.
              return;
            }
          } else {
            await signInAnonymously(auth);
            console.log("DEBUG: Signed in anonymously (no custom token available).");
            // onAuthStateChanged will trigger again with anonymous user, and resolve then.
            return;
          }
        }
      });

      // If onAuthStateChanged doesn't immediately resolve (e.g., no user, or custom token pending),
      // ensure we resolve eventually. This handles cases where initial state might not lead to an immediate `user` callback.
      // This is a safety net; the `onAuthStateChanged` callbacks above are designed to resolve the promise.
      setTimeout(() => {
        if (!currentUser && auth && !auth.currentUser) { // If still no user and no pending auth, resolve.
          console.warn("FirebaseReadyPromise timed out waiting for onAuthStateChanged initial resolution. Resolving anyway.");
          resolve();
        }
      }, 5000); // 5 second timeout for auth state to settle

    } catch (e) {
      console.error("Error initializing Firebase:", e);
      // Even if init fails, resolve the promise to avoid blocking other modules indefinitely
      resolve();
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
    console.error("Firestore DB not initialized for getUserProfileFromFirestore after firebaseReadyPromise.");
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
    console.error("Firestore DB not initialized for updateUserProfileInFirestore after firebaseReadyPromise.");
    return false;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    // Also update the local currentUser object if it's the current user
    if (currentUser && currentUser.uid === uid) {
      currentUser = { ...currentUser, ...profileData };
    }
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
    return true;
  } catch (error) {
    console.error("Error deleting user profile from Firestore:", error);
    return false;
  }
}


// Call initialization function immediately when the script loads.
// This starts the process of setting up Firebase, but other modules
// should await `firebaseReadyPromise` before using `db` or `auth` directly.
setupFirebaseAndUser();
