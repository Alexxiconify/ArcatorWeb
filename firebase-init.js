// firebase-init.js - Centralized Firebase Initialization and Exports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase configuration (use __firebase_config if available, otherwise fallback)
let rawFirebaseConfig = '';
export let firebaseConfig = {}; // Initialize as empty object and export

// IMPORTANT: These are placeholders. In the Canvas environment, these will be populated by the system.
// For local development, you would replace these with your actual Firebase project details.
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
export let auth; // Will be initialized later
export let db;   // Will be initialized later
export let currentUser = null; // Stores the current authenticated user's profile data
export const DEFAULT_PROFILE_PIC = 'https://jylina.arcator.co.uk/standalone/img/default-profile.png';
export const DEFAULT_THEME_NAME = 'dark'; // Default theme ID for new users
export const ADMIN_UIDS = ['uOaZ8v76y2Q0X7PzJtU7Y3A2C1B4']; // Example admin UIDs

// Promise that resolves when Firebase app is initialized and auth state is determined
let firebaseReadyResolve;
export const firebaseReadyPromise = new Promise(resolve => {
  firebaseReadyResolve = resolve;
});

/**
 * Retrieves a user's profile from the 'user_profiles' collection in Firestore.
 * Caches the result locally if possible for performance.
 * This function waits for `firebaseReadyPromise` if `db` is not yet initialized.
 * @param {string} uid - The User ID (UID) of the profile to fetch.
 * @returns {Promise<Object|null>} The user profile data, or null if not found.
 */
export async function getUserProfileFromFirestore(uid) {
  await firebaseReadyPromise; // Ensure Firebase is initialized and auth state is ready
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore after firebaseReadyPromise.");
    return null;
  }
  // Check if it's the current user's profile already cached
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
 * This function waits for `firebaseReadyPromise` if `db` is not yet initialized.
 * @param {string} uid - The User ID (UID) of the profile to set/update.
 * @param {Object} profileData - The profile data to set.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export async function setUserProfileInFirestore(uid, profileData) {
  await firebaseReadyPromise; // Ensure Firebase is initialized and auth state is ready
  if (!db) {
    console.error("Firestore DB not initialized for setUserProfileInFirestore after firebaseReadyPromise.");
    return false;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true }); // Use merge to update fields, not overwrite
    // Update the local currentUser object if it's the current user
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

/**
 * Initializes Firebase, sets up authentication, and resolves firebaseReadyPromise.
 */
async function setupFirebaseAndUser() {
  console.log("DEBUG: setupFirebaseAndUser called.");

  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    if (typeof __firebase_config === 'string') {
      try {
        firebaseConfig = JSON.parse(__firebase_config);
        console.log("DEBUG: __firebase_config provided as string and parsed successfully.");
      } catch (e) {
        console.error("ERROR: Failed to parse __firebase_config string as JSON. Using empty config.", e);
        firebaseConfig = {}; // Ensure it's an object even on parse error
      }
    } else if (typeof __firebase_config === 'object' && __firebase_config !== null) {
      firebaseConfig = __firebase_config;
      console.log("DEBUG: __firebase_config provided as object. Using directly.");
    } else {
      console.warn("DEBUG: __firebase_config provided but not a string or object. Type:", typeof __firebase_config);
      firebaseConfig = {}; // Ensure it's an object if type is unexpected
    }
  } else {
    console.log("DEBUG: __firebase_config not provided. Using fallback for local testing.");
    // Fallback for local testing if __firebase_config is not defined
    // REPLACE WITH YOUR ACTUAL LOCAL FIREBASE CONFIG IF TESTING LOCALLY
    firebaseConfig = {
      apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
      authDomain: "arcator-web.firebaseapp.com",
      projectId: "arcator-web",
      storageBucket: "arcator-web.firebasestorage.app",
      messagingSenderId: "1033082068049",
      appId: "1:1033082068049:web:dd154c8b188bde1930ec70"
    };
  }

  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("DEBUG: Firebase app, Firestore, and Auth initialized. DB instance:", db);

    // Sign in anonymously if no custom token, or with custom token if provided
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      console.log("DEBUG: Attempting to sign in with custom token.");
      await signInWithCustomToken(auth, __initial_auth_token);
      console.log("DEBUG: Signed in with custom token.");
    } else {
      console.log("DEBUG: __initial_auth_token not defined or empty. Signing in anonymously.");
      await signInAnonymously(auth);
      console.log("DEBUG: Signed in anonymously.");
    }

    // Set up Auth state observer
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("Auth State Changed: User logged in:", user.uid);
        let userProfile = await getUserProfileFromFirestore(user.uid);

        if (!userProfile) {
          // Create a basic profile if none exists
          console.log("No profile found for new user. Creating default profile.");
          userProfile = {
            uid: user.uid,
            displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
            email: user.email || null,
            photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
            createdAt: new Date(),
            lastLoginAt: new Date(),
            selectedTheme: DEFAULT_THEME_NAME,
            isAdmin: ADMIN_UIDS.includes(user.uid) // Check if user is an admin
          };
          await setUserProfileInFirestore(user.uid, userProfile);
        } else {
          // Update last login time and admin status on existing profile
          await setUserProfileInFirestore(user.uid, {
            lastLoginAt: new Date(),
            isAdmin: ADMIN_UIDS.includes(user.uid)
          });
          // Merge admin status into the userProfile object for immediate use
          userProfile.isAdmin = ADMIN_UIDS.includes(user.uid);
        }
        currentUser = userProfile; // Store the full profile
        console.log("DEBUG: currentUser set:", currentUser);
      } else {
        console.log("Auth State Changed: User logged out.");
        currentUser = null;
      }
      console.log("DEBUG: firebaseReadyPromise resolving.");
      firebaseReadyResolve(); // Resolve the promise once auth state is settled
    });

  } catch (error) {
    console.error("FATAL ERROR: Failed to initialize Firebase or sign in:", error);
    // Even if there's an error, resolve the promise to allow other parts of the app to try loading
    console.log("DEBUG: firebaseReadyPromise resolving due to error during initialization.");
    firebaseReadyResolve();
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
