// firebase-init.js - Centralized Firebase Initialization and Exports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase configuration (use __firebase_config if available, otherwise fallback)
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' && __firebase_config ? __firebase_config : `{
    "apiKey": "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
    "authDomain": "arcator-web.firebaseapp.com",
    "projectId": "arcator-web",
    "storageBucket": "arcator-web.firebasestorage.app",
    "messagingSenderId": "1033082068049",
    "appId": "1:1033082068049:web:dd154c8b188bde1930ec70",
    "measurementId": "G-DJXNT1L7CM"
}`);

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
export const ADMIN_UIDS = [CEch8cXWemSDQnM3dHVKPt0RGpn2,OoeTK1HmebQyOf3gEiCKAHVtD6l2];

// Default values
export const DEFAULT_PROFILE_PIC = 'https://placehold.co/128x128/1F2937/E5E7EB?text=AV';
export const DEFAULT_THEME_NAME = 'dark';

/**
 * Initializes Firebase and sets up the authentication state listener.
 * This function is called once at the start of the application.
 */
export async function setupFirebaseAndUser() {
  if (firebaseReadyPromise) {
    console.log("Firebase already initializing or initialized.");
    return firebaseReadyPromise;
  }

  firebaseReadyPromise = new Promise(async (resolve) => {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      console.log("Firebase initialized successfully.");

      // Set up auth state listener to update currentUser and handle custom token
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log("onAuthStateChanged triggered. User:", user ? user.uid : "none");
        if (user) {
          // User is logged in (via email/password or custom token)
          currentUser = { ...user, isAdmin: ADMIN_UIDS.includes(user.uid) };
          // Fetch additional profile data and merge
          const userProfile = await getUserProfileFromFirestore(user.uid);
          if (userProfile) {
            currentUser = { ...currentUser, ...userProfile };
          }
        } else {
          // No user or signed out. Attempt anonymous login if no custom token provided.
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            try {
              await signInWithCustomToken(auth, __initial_auth_token);
              console.log("DEBUG: Signed in with custom token from Canvas.");
              // onAuthStateChanged will trigger again with the new user
              return; // Exit to avoid immediate anonymous login
            } catch (error) {
              console.error("ERROR: Error signing in with custom token:", error);
              // Fallback to anonymous if custom token fails
              await signInAnonymously(auth);
              console.log("DEBUG: Signed in anonymously after custom token failure.");
            }
          } else {
            await signInAnonymously(auth);
            console.log("DEBUG: Signed in anonymously (no custom token available).");
          }
          // After anonymous sign-in, onAuthStateChanged will trigger again with the anonymous user
          // and `currentUser` will be set based on that.
          currentUser = auth.currentUser ? { ...auth.currentUser, isAdmin: false } : null; // Set anonymous user as non-admin
        }
        unsubscribe(); // Unsubscribe after initial state is handled
        resolve(); // Resolve the promise once authentication state is established
      });

    } catch (e) {
      console.error("Error initializing Firebase:", e);
      // Even if init fails, resolve the promise to avoid blocking other modules
      resolve();
    }
  });
  return firebaseReadyPromise;
}

/**
 * Gets the current authenticated user object, including isAdmin status.
 * This will reflect the state after `setupFirebaseAndUser` has resolved.
 * @returns {Object|null} The current user object or null.
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Fetches a user's profile data from the 'user_profiles' collection in Firestore.
 * This is a helper function used internally.
 * @param {string} uid - The User ID (UID) of the profile to fetch.
 * @returns {Promise<Object|null>} A Promise that resolves with the user's profile data object,
 * or `null` if the profile is not found or an error occurs.
 */
export async function getUserProfileFromFirestore(uid) {
  // Ensure db is initialized before trying to use it
  if (!db) {
    console.error("Firestore DB not initialized in getUserProfileFromFirestore.");
    // Wait for Firebase to be ready if it's not yet
    await firebaseReadyPromise;
    if (!db) { // Check again after waiting
      console.error("Firestore DB still not initialized after waiting.");
      return null;
    }
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

// Call initialization function immediately when the script loads.
// This starts the process of setting up Firebase, but other modules
// should await `firebaseReadyPromise` before using `db` or `auth`.
setupFirebaseAndUser();
