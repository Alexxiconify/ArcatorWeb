// firebase-init.js: Centralized Firebase initialization and user state management.
/* global __app_id, __firebase_config, __initial_auth_token */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
// IMPORTANT: YOU MUST REPLACE THESE PLACEHOLDER VALUES WITH YOUR ACTUAL FIREBASE PROJECT CONFIGURATION.
// You can find these details in your Firebase project console: Project settings -> General.
// If you do not replace these, Firebase functions will fail with "auth/api-key-not-valid".
const defaultFirebaseConfig = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4", // <--- 🚨 REPLACE THIS WITH YOUR ACTUAL API KEY 🚨
  authDomain: "arcator-web.firebaseapp.com", // <--- REPLACE THIS
  projectId: "arcator-web", // <--- REPLACE THIS
  storageBucket: "arcator-web.firebasestorage.app", // <--- REPLACE THIS
  messagingSenderId: "1033082068049", // <--- REPLACE THIS
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70", // <--- REPLACE THIS
  // measurementId: "YOUR_MEASUREMENT_ID" // Optional, if you use Google Analytics
};

// Safely determine Firebase config from Canvas environment or default.
let firebaseConfig = {};
if (typeof __firebase_config === 'object' && __firebase_config !== null) {
  // If __firebase_config is already an object, use it directly
  firebaseConfig = __firebase_config;
  console.log("DEBUG: Using __firebase_config provided as an object.");
} else if (typeof __firebase_config === 'string' && __firebase_config.trim() !== '') {
  // If it's a non-empty string, try parsing it as JSON
  try {
    firebaseConfig = JSON.parse(__firebase_config);
    console.log("DEBUG: Parsed __firebase_config from string.");
  } catch (e) {
    console.error("ERROR: Failed to parse __firebase_config JSON. Using default config.", e);
    firebaseConfig = defaultFirebaseConfig; // Fallback
  }
} else {
  // If __firebase_config is not provided or empty, use the hardcoded default
  console.warn("WARN: __firebase_config not provided or is empty. Using default config. Please ensure your Canvas environment provides a valid Firebase config.");
  firebaseConfig = defaultFirebaseConfig;
}


/** @global {string} appId - The application ID derived from __app_id or firebaseConfig.projectId. */
const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : null;
export const appId = canvasAppId || firebaseConfig.projectId || 'default-app-id';

// --- Global Firebase Instances ---
export let app;
export let auth;
export let db;

/** @global {object|null} currentUser - Stores the current user object, including custom profile data like 'handle'. */
let currentUser = null;

// --- Default Values ---
export const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
export const DEFAULT_THEME_NAME = 'dark';
// IMPORTANT: Replace with the actual UIDs of your Firebase authenticated admin users.
export const ADMIN_UIDS = ['YOUR_ADMIN_UID_1', 'YOUR_ADMIN_UID_2']; // <--- REPLACE THIS


/**
 * @private
 * Generates a unique handle for a given user UID and saves it to their profile in Firestore.
 * This is called for both newly authenticated users and anonymous users to ensure they always have a handle.
 * It checks for uniqueness and appends a counter if the base handle is already taken.
 * @param {string} uid - The user's UID.
 * @param {string} initialSuggestion - A suggested handle (e.g., derived from display name or email).
 * @returns {Promise<string>} A Promise that resolves with the generated unique handle.
 */
async function generateUniqueHandle(uid, initialSuggestion) {
  if (!db) {
    console.error("Firestore DB not initialized. Cannot generate handle.");
    return `anon${uid.substring(0, 5)}`; // Fallback
  }
  let baseHandle = initialSuggestion.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
  if (baseHandle.length === 0) {
    baseHandle = 'user'; // Fallback if initial suggestion becomes empty.
  }
  let handle = baseHandle;
  let counter = 0;
  let isUnique = false;

  const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);

  while (!isUnique) {
    const q = query(userProfilesRef, where("handle", "==", handle));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      isUnique = true;
    } else {
      counter++;
      handle = `${baseHandle}${counter}`;
    }
  }

  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  await setDoc(userDocRef, { handle: handle }, { merge: true });

  console.log(`Generated and saved unique handle for ${uid}: ${handle}`);
  return handle;
}

/**
 * Fetches user profile data from the 'user_profiles' collection in Firestore.
 * This is a core function for user data retrieval.
 * @param {string} uid - The User ID (UID) to fetch the profile for.
 * @returns {Promise<Object|null>} A Promise that resolves with the user's profile data, or `null` if not found or an error occurs.
 */
export async function getUserProfileFromFirestore(uid) {
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

/**
 * Updates user profile data in Firestore.
 * @param {string} uid - The user's UID.
 * @param {Object} profileData - The data to update (themePreference, displayName, photoURL, etc.).
 * @returns {Promise<boolean>} - True if update was successful, false otherwise.
 */
export async function updateUserProfileInFirestore(uid, profileData) {
  if (!db) {
    console.error("Firestore DB not initialized. Cannot update user profile.");
    return false;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    console.log(`User profile for ${uid} updated successfully.`);
    // Optionally update the in-memory currentUser object if it's the current user
    if (currentUser && currentUser.uid === uid) {
      currentUser = { ...currentUser, ...profileData };
      // Re-evaluate isAdmin if relevant profile fields are changed
      if (profileData.uid) { // If UID changes (unlikely for existing user)
        currentUser.isAdmin = ADMIN_UIDS.includes(currentUser.uid);
      }
    }
    return true;
  } catch (error) {
    console.error("Error updating user profile in Firestore:", error);
    return false;
  }
}


/**
 * Initializes Firebase, sets up authentication, and retrieves/creates the user profile with a unique handle.
 * This function consolidates the repetitive Firebase initialization logic.
 * It also sets the global `currentUser` object.
 * @returns {Promise<void>} Resolves when Firebase is ready and currentUser is set.
 */
export async function setupFirebaseAndUser() {
  return new Promise((resolve) => {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      console.log("Firebase initialized successfully.");

      // Use onAuthStateChanged to handle initial auth state and subsequent changes
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe(); // Unsubscribe immediately after the first state change to prevent multiple calls

        if (user) {
          currentUser = user;
          let userProfile = await getUserProfileFromFirestore(currentUser.uid);

          if (!userProfile) {
            const initialHandle = currentUser.displayName || currentUser.email?.split('@')[0] || `user${currentUser.uid.substring(0, 5)}`;
            const generatedHandle = await generateUniqueHandle(currentUser.uid, initialHandle);
            userProfile = {
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              handle: generatedHandle,
              themePreference: DEFAULT_THEME_NAME,
              fontSizePreference: '16px',
              fontFamilyPreference: 'Inter, sans-serif',
              backgroundPatternPreference: 'none',
              notificationPreferences: { email: false, inApp: false },
              accessibilitySettings: { highContrast: false, reducedMotion: false },
              createdAt: serverTimestamp(),
            };
            await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), userProfile, { merge: true });
            console.log("New user profile created with handle:", generatedHandle);
          } else if (!userProfile.handle) {
            const initialHandle = userProfile.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || `user${currentUser.uid.substring(0, 5)}`;
            const generatedHandle = await generateUniqueHandle(currentUser.uid, initialHandle);
            userProfile.handle = generatedHandle;
            await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), { handle: generatedHandle }, { merge: true });
            console.log("Handle generated and added to existing profile:", generatedHandle);
          }
          // Enrich currentUser object with custom profile data
          currentUser = {
            ...currentUser,
            displayName: userProfile.displayName || currentUser.displayName,
            photoURL: userProfile.photoURL || currentUser.photoURL,
            handle: userProfile.handle,
            // Add other profile fields if desired
            themePreference: userProfile.themePreference,
            fontSizePreference: userProfile.fontSizePreference,
            fontFamilyPreference: userProfile.fontFamilyPreference,
            backgroundPatternPreference: userProfile.backgroundPatternPreference,
            notificationPreferences: userProfile.notificationPreferences,
            accessibilitySettings: userProfile.accessibilitySettings,
            isAdmin: ADMIN_UIDS.includes(user.uid), // Set isAdmin based on UIDs
          };
          resolve();
        } else {
          // No user logged in, try custom token or anonymous sign-in
          const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

          if (initialAuthToken) {
            signInWithCustomToken(auth, initialAuthToken)
              .then(async (userCredential) => {
                currentUser = userCredential.user;
                console.log("Signed in with custom token from Canvas.");
                // Check for profile and generate handle for new sign-ins via token
                let userProfile = await getUserProfileFromFirestore(currentUser.uid);
                if (!userProfile || !userProfile.handle) {
                  const initialHandle = currentUser.displayName || currentUser.email?.split('@')[0] || `user${currentUser.uid.substring(0, 5)}`;
                  const generatedHandle = await generateUniqueHandle(currentUser.uid, initialHandle);
                  if (!userProfile) userProfile = {};
                  userProfile.handle = generatedHandle;
                  userProfile.displayName = userProfile.displayName || currentUser.displayName;
                  userProfile.photoURL = userProfile.photoURL || currentUser.photoURL;
                  userProfile.themePreference = userProfile.themePreference || DEFAULT_THEME_NAME;
                  userProfile.fontSizePreference = userProfile.fontSizePreference || '16px';
                  userProfile.fontFamilyPreference = userProfile.fontFamilyPreference || 'Inter, sans-serif';
                  userProfile.backgroundPatternPreference = userProfile.backgroundPatternPreference || 'none';
                  userProfile.notificationPreferences = userProfile.notificationPreferences || { email: false, inApp: false };
                  userProfile.accessibilitySettings = userProfile.accessibilitySettings || { highContrast: false, reducedMotion: false };
                  await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), userProfile, { merge: true });
                }
                currentUser = {
                  ...currentUser,
                  displayName: userProfile.displayName,
                  photoURL: userProfile.photoURL,
                  handle: userProfile.handle,
                  isAdmin: ADMIN_UIDS.includes(currentUser.uid),
                };
                resolve();
              })
              .catch((error) => {
                console.error("Error signing in with custom token:", error);
                // Fallback to anonymous sign-in if custom token fails
                signInAnonymously(auth)
                  .then(async (userCredential) => {
                    currentUser = userCredential.user;
                    console.log("Signed in anonymously after custom token failure.");
                    const generatedHandle = await generateUniqueHandle(currentUser.uid, `anon${currentUser.uid.substring(0, 5)}`);
                    await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), {
                      handle: generatedHandle,
                      displayName: `Anon ${currentUser.uid.substring(0, 5)}`,
                      photoURL: DEFAULT_PROFILE_PIC,
                      themePreference: DEFAULT_THEME_NAME,
                      fontSizePreference: '16px',
                      fontFamilyPreference: 'Inter, sans-serif',
                      backgroundPatternPreference: 'none',
                      notificationPreferences: { email: false, inApp: false },
                      accessibilitySettings: { highContrast: false, reducedMotion: false },
                      createdAt: serverTimestamp()
                    }, { merge: true });
                    currentUser = {
                      ...currentUser,
                      displayName: `Anon ${currentUser.uid.substring(0, 5)}`,
                      photoURL: DEFAULT_PROFILE_PIC,
                      handle: generatedHandle,
                      isAdmin: ADMIN_UIDS.includes(currentUser.uid),
                    };
                    resolve();
                  })
                  .catch((anonError) => {
                    console.error("Error signing in anonymously:", anonError);
                    currentUser = null; // Ensure currentUser is null on full failure
                    resolve();
                  });
              });
          } else {
            signInAnonymously(auth)
              .then(async (userCredential) => {
                currentUser = userCredential.user;
                console.log("Signed in anonymously (no custom token).");
                const generatedHandle = await generateUniqueHandle(currentUser.uid, `anon${currentUser.uid.substring(0, 5)}`);
                await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), {
                  handle: generatedHandle,
                  displayName: `Anon ${currentUser.uid.substring(0, 5)}`,
                  photoURL: DEFAULT_PROFILE_PIC,
                  themePreference: DEFAULT_THEME_NAME,
                  fontSizePreference: '16px',
                  fontFamilyPreference: 'Inter, sans-serif',
                  backgroundPatternPreference: 'none',
                  notificationPreferences: { email: false, inApp: false },
                  accessibilitySettings: { highContrast: false, reducedMotion: false },
                  createdAt: serverTimestamp()
                }, { merge: true });
                currentUser = {
                  ...currentUser,
                  displayName: `Anon ${currentUser.uid.substring(0, 5)}`,
                  photoURL: DEFAULT_PROFILE_PIC,
                  handle: generatedHandle,
                  isAdmin: ADMIN_UIDS.includes(currentUser.uid),
                };
                resolve();
              })
              .catch((anonError) => {
                console.error("Error signing in anonymously:", anonError);
                currentUser = null;
                resolve();
              });
          }
        }
      }, (error) => {
        console.error("Error in onAuthStateChanged listener:", error);
        currentUser = null;
        resolve(); // Resolve even on listener error to allow page to load
      });
    } catch (e) {
      console.error("Error initializing Firebase:", e);
      resolve(); // Always resolve to prevent infinite loading state
    }
  });
}

/**
 * Returns the globally managed current user object.
 * This object is enriched with custom profile data (like handle, displayName, photoURL).
 * @returns {object|null} The current user object or null if not authenticated/initialized.
 */
export function getCurrentUser() {
  return currentUser;
}
