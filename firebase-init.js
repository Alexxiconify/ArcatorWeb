/* global __app_id, __initial_auth_token */

// firebase-init.js: Centralized Firebase initialization and user authentication.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app",
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM"
};

/** @global {string} appId - The application ID derived from __app_id or firebaseConfig.projectId. */
const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : null;
export const appId = canvasAppId || firebaseConfig.projectId || 'default-app-id';

// --- Global Firebase Instances ---
export let app;
export let auth;
export let db;
export let currentUser = null; // Stores the current user object with custom profile data

// --- Admin UIDs (for server-level admin permissions) ---
// IMPORTANT: Replace with the actual UIDs of your Firebase authenticated admin users.
export const ADMIN_UIDS = ['CEch8cXWemSDQnM3dHVKPt0RGpn2', 'OoeTK1HmebQyOf3gEiCKAHVtD6l2'];

// --- Default Values ---
const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark';

/**
 * Sanitizes a string to be suitable for a user handle.
 * Converts to lowercase and removes any characters not allowed (alphanumeric, underscore, dot, hyphen).
 * This is an internal utility for firebase-init to avoid circular dependency with utils.js.
 * @param {string} input - The raw string to sanitize.
 * @returns {string} The sanitized handle string.
 */
function sanitizeHandle(input) {
  return input.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}

/**
 * Generates a unique handle for a given user UID and saves it to their profile in Firestore.
 * This is called for both newly authenticated users and anonymous users to ensure they always have a handle.
 * It checks for uniqueness and appends a counter if the base handle is already taken.
 * @param {string} uid - The user's UID.
 * @param {string} initialSuggestion - A suggested handle (e.g., derived from display name or email).
 * @returns {Promise<string>} A Promise that resolves with the generated unique handle.
 */
export async function generateUniqueHandle(uid, initialSuggestion) {
  let baseHandle = sanitizeHandle(initialSuggestion || 'anonuser');
  if (baseHandle.length === 0) {
    baseHandle = 'user';
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
 * Initializes Firebase, sets up authentication, and retrieves/creates the user profile with a unique handle.
 * @returns {Promise<void>} Resolves when Firebase is ready and currentUser is set.
 */
export async function setupFirebaseAndUser() {
  return new Promise(async (resolve) => {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      console.log("Firebase initialized successfully.");

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log("onAuthStateChanged triggered. User:", user ? user.uid : "none");
        unsubscribe(); // Unsubscribe after the first state change to avoid multiple calls on subsequent updates.

        if (user) {
          currentUser = user;
          let userProfile = await getUserProfileFromFirestore(currentUser.uid);

          if (!userProfile) {
            // For new authenticated users without a profile
            const initialHandle = currentUser.email?.split('@')[0] || `user${currentUser.uid.substring(0, 5)}`;
            const generatedHandle = await generateUniqueHandle(currentUser.uid, initialHandle);
            userProfile = {
              displayName: currentUser.displayName || initialHandle,
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
            // For existing profiles missing a handle
            const initialHandle = userProfile.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || `user${currentUser.uid.substring(0, 5)}`;
            const generatedHandle = await generateUniqueHandle(currentUser.uid, initialHandle);
            userProfile.handle = generatedHandle;
            userProfile.displayName = userProfile.displayName || currentUser.displayName || initialHandle;
            await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), { handle: generatedHandle, displayName: userProfile.displayName }, { merge: true });
            console.log("Handle generated and added to existing profile:", generatedHandle);
          } else {
            // If profile exists and has a handle, ensure displayName and photoURL are consistent
            userProfile.displayName = userProfile.displayName || currentUser.displayName || (userProfile.handle.startsWith('anon') ? `Anon ${currentUser.uid.substring(0,5)}` : userProfile.handle);
            userProfile.photoURL = userProfile.photoURL || currentUser.photoURL || DEFAULT_PROFILE_PIC;
          }

          // Always update currentUser object with the latest profile details (from fetched or newly created)
          currentUser.displayName = userProfile.displayName;
          currentUser.photoURL = userProfile.photoURL;
          currentUser.handle = userProfile.handle;
          currentUser.isAdmin = ADMIN_UIDS.includes(currentUser.uid); // Set server admin status
          // Note: isThemeMod is set dynamically in themes-api.js or based on theme data

          resolve();
        } else {
          // Anonymous sign-in path
          if (typeof __initial_auth_token !== 'undefined') {
            signInWithCustomToken(auth, __initial_auth_token)
              .then(async (userCredential) => {
                currentUser = userCredential.user;
                console.log("DEBUG: Signed in with custom token from Canvas.");
                let userProfile = await getUserProfileFromFirestore(currentUser.uid);
                if (!userProfile || !userProfile.handle) {
                  const generatedHandle = await generateUniqueHandle(currentUser.uid, `anon${currentUser.uid.substring(0, 5)}`);
                  if (!userProfile) userProfile = {};
                  userProfile.handle = generatedHandle;
                  userProfile.displayName = `Anon ${currentUser.uid.substring(0, 5)}`;
                  userProfile.photoURL = DEFAULT_PROFILE_PIC;
                  userProfile.themePreference = userProfile.themePreference || DEFAULT_THEME_NAME;
                  userProfile.fontSizePreference = userProfile.fontSizePreference || '16px';
                  userProfile.fontFamilyPreference = userProfile.fontFamilyPreference || 'Inter, sans-serif';
                  userProfile.backgroundPatternPreference = userProfile.backgroundPatternPreference || 'none';
                  userProfile.notificationPreferences = userProfile.notificationPreferences || { email: false, inApp: false };
                  userProfile.accessibilitySettings = userProfile.accessibilitySettings || { highContrast: false, reducedMotion: false };
                  await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, currentUser.uid), userProfile, { merge: true });
                }
                // Ensure currentUser object is updated with profile info
                currentUser.displayName = userProfile.displayName;
                currentUser.photoURL = userProfile.photoURL;
                currentUser.handle = userProfile.handle;
                currentUser.isAdmin = ADMIN_UIDS.includes(currentUser.uid);
                // Note: isThemeMod is set dynamically

                resolve();
              })
              .catch((error) => {
                console.error("ERROR: Error signing in with custom token:", error);
                signInAnonymously(auth)
                  .then(async (userCredential) => {
                    currentUser = userCredential.user;
                    console.log("DEBUG: Signed in anonymously after custom token failure.");
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
                    currentUser.displayName = `Anon ${currentUser.uid.substring(0, 5)}`;
                    currentUser.photoURL = DEFAULT_PROFILE_PIC;
                    currentUser.handle = generatedHandle;
                    currentUser.isAdmin = ADMIN_UIDS.includes(currentUser.uid);
                    // Note: isThemeMod is set dynamically
                    resolve();
                  })
                  .catch((anonError) => {
                    console.error("ERROR: Error signing in anonymously:", anonError);
                    // If even anonymous sign-in fails, we can't proceed with Firestore
                    // showMessageBox("Error during anonymous sign-in.", true); // This will fail if DB not init
                    resolve();
                  });
              });
          } else {
            signInAnonymously(auth)
              .then(async (userCredential) => {
                currentUser = userCredential.user;
                console.log("DEBUG: Signed in anonymously (no custom token).");
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
                currentUser.displayName = `Anon ${currentUser.uid.substring(0, 5)}`;
                currentUser.photoURL = DEFAULT_PROFILE_PIC;
                currentUser.handle = generatedHandle;
                currentUser.isAdmin = ADMIN_UIDS.includes(currentUser.uid);
                // Note: isThemeMod is set dynamically
                resolve();
              })
              .catch((anonError) => {
                console.error("ERROR: Error signing in anonymously:", anonError);
                // showMessageBox("Error during anonymous sign-in.", true); // This will fail if DB not init
                resolve();
              });
          }
        }
      });
    } catch (e) {
      console.error("Error initializing Firebase:", e);
      // showMessageBox("Error initializing Firebase. Cannot proceed.", true); // This will fail if DB not init
      resolve();
    }
  });
}

/**
 * Returns the current user object.
 * @returns {object|null} The current user object with profile details.
 */
export function getCurrentUser() {
  return currentUser;
}
