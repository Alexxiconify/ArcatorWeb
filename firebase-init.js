// firebase-init.js - Centralized Firebase Initialization
import {getApp, getApps, initializeApp} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    createUserWithEmailAndPassword,
    getAuth,
    GithubAuthProvider,
    GoogleAuthProvider,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithCustomToken,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    onSnapshot,
    query,
    setDoc,
    updateDoc,
    where,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {firebaseConfig as externalFirebaseConfig} from "./firebase-config.js";
import {getAppId, getFirebaseConfig, getInitialAuthToken} from './runtime-globals.js';

// Prefer injected runtime globals (if any) read via helper getters
const __app_id = getAppId();
const __firebase_config = getFirebaseConfig();
const __initial_auth_token = getInitialAuthToken();

const canvasAppId = typeof __app_id !== "undefined" ? __app_id : null;
export const appId = canvasAppId || externalFirebaseConfig.projectId || "default-app-id";
export let app;
export let auth;
export let db;
export let currentUser = null;
export const DEFAULT_PROFILE_PIC = "https://placehold.co/32x32/1F2937/E5E7EB?text=AV";
export const DEFAULT_THEME_NAME = "dark";
export const ADMIN_UIDS = ["CEch8cXWemSDQnM3dHVKPt0RGpn2", "OoeTK1HmebQyOf3gEiCKAHVtD6l2"];
let firebaseReadyResolve;
export const firebaseReadyPromise = new Promise((resolve) => {
    firebaseReadyResolve = resolve;
});
export async function getUserProfileFromFirestore(uid) {
  await firebaseReadyPromise;
  if (!db) return null;
  try {
    const docSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid));
    return docSnap.exists() ? { uid: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}
export async function setUserProfileInFirestore(uid, profileData) {
  await firebaseReadyPromise;
  if (!db) return false;
  try {
    await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid), profileData, { merge: true });
      if (auth.currentUser?.uid === uid) currentUser = await getUserProfileFromFirestore(uid);
    return true;
  } catch (error) {
    console.error("Error updating user profile:", error);
    return false;
  }
}

function setupFirebaseCore() {
    try {
        if (getApps().length === 0) {
            let finalFirebaseConfig = externalFirebaseConfig || {};
            if (typeof __firebase_config !== "undefined" && __firebase_config !== null) {
                if (typeof __firebase_config === "string") {
                    try {
                        finalFirebaseConfig = JSON.parse(__firebase_config);
                    } catch (e) {
                        console.error("Failed to parse __firebase_config, using hardcoded config");
                    }
                } else if (typeof __firebase_config === "object") {
                    finalFirebaseConfig = __firebase_config;
                }
            }
      app = initializeApp(finalFirebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
        } else {
            app = getApp();
            db = getFirestore(app);
            auth = getAuth(app);
        }
        firebaseReadyResolve();
        if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
            signInWithCustomToken(auth, __initial_auth_token).catch((error) => console.error("Custom token sign-in failed:", error));
        }
    } catch (e) {
        console.error("Error initializing Firebase:", e);
        firebaseReadyResolve();
    }
}
setupFirebaseCore();
setTimeout(async () => {
  try {
    await firebaseReadyPromise;
    if (db) {
        try {
            await getDoc(doc(db, `artifacts/${appId}/public/data/test_connection/doc`));
        } catch (error) {
            if (error.code !== 'permission-denied' && error.code !== 'not-found') {
                console.error("Firestore connection test failed:", error);
            }
        }
    }
  } catch (error) {
      if (error.code !== 'permission-denied') {
          console.error("Firebase ready promise failed:", error);
      }
  }
}, 2000);
firebaseReadyPromise.then(() => {
  onAuthStateChanged(auth, async (user) => {
      const _displayNameEl = typeof document !== 'undefined' ? document.getElementById('display-name') : null;
      if (_displayNameEl) {
          _displayNameEl.textContent = user?.displayName || 'Guest';
      }
    if (user) {
      let userProfile = await getUserProfileFromFirestore(user.uid);
      if (!userProfile) {
        userProfile = {
          uid: user.uid,
          displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
          email: user.email || null,
          photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          themePreference: DEFAULT_THEME_NAME,
          isAdmin: ADMIN_UIDS.includes(user.uid),
          handle: user.uid.substring(0, 6),
        };
        await setUserProfileInFirestore(user.uid, userProfile);
      } else {
          const updateData = {lastLoginAt: new Date(), isAdmin: ADMIN_UIDS.includes(user.uid)};
          if (!userProfile.photoURL) updateData.photoURL = DEFAULT_PROFILE_PIC;
        await setUserProfileInFirestore(user.uid, updateData);
        userProfile.isAdmin = ADMIN_UIDS.includes(user.uid);
      }
      currentUser = userProfile;
      window.currentUser = userProfile;
        localStorage.setItem('userProfile', JSON.stringify(userProfile)); // Store user data in local storage
      if (typeof window.onUserReady === "function") window.onUserReady();
        // Refresh navbar/profile UI; do not forcibly redirect to the same page as it can create reload loops
      await refreshNavbar();
    } else {
      currentUser = null;
      window.currentUser = null;
        localStorage.removeItem('userProfile'); // Remove user data from local storage on logout
      if (typeof window.onUserReady === "function") window.onUserReady();
        await refreshNavbar();
    }
    async function refreshNavbar() {
      if (typeof window.refreshNavbarProfilePicture === "function") {
        setTimeout(async () => {
          try {
            await window.refreshNavbarProfilePicture();
          } catch (error) {
            console.error("Error refreshing navbar profile picture:", error);
          }
        }, 100);
      }
    }
  });
}).catch((error) => {
    console.error("Error setting up auth state listener:", error);
});
export async function getCurrentUser() {
    // Returns a merged view of the auth user + stored Firestore profile (if available)
    if (!auth || !auth.currentUser) return null;
  const user = auth.currentUser;
  try {
    const userProfile = await getUserProfileFromFirestore(user.uid);
    if (!userProfile) {
        return {
            uid: user.uid,
            email: user.email || null,
            displayName: user.displayName || "Anonymous",
            photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
            handle: null,
            isAdmin: ADMIN_UIDS.includes(user.uid),
        };
    }
      return {
          uid: user.uid,
          email: user.email || userProfile.email || null,
          displayName: userProfile.displayName || user.displayName || "Anonymous",
          photoURL: userProfile.photoURL || user.photoURL || DEFAULT_PROFILE_PIC,
          handle: userProfile.handle || null,
          isAdmin: userProfile.isAdmin || ADMIN_UIDS.includes(user.uid),
          ...userProfile,
      };
  } catch (error) {
      console.error("Error getting current user:", error);
      return {
          uid: user.uid,
          email: user.email || null,
          displayName: user.displayName || "Anonymous",
          photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
          handle: null,
          isAdmin: ADMIN_UIDS.includes(user.uid),
      };
  }
}

// Consolidated exports for auth and firestore helpers (local helpers are exported where declared)
export {
    getAuth,
    onAuthStateChanged,
    signInWithCustomToken,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile,
    signOut,
    // Firestore helpers
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    setDoc,
    updateDoc,
    query,
    where,
    onSnapshot,
};