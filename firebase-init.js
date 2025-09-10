// firebase-init.js - Centralized Firebase Initialization
import {getApp, getApps, initializeApp} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    deleteDoc,
    doc,
    getDoc,
    getFirestore,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {firebaseConfig} from "./sensitive/firebase-config.js";

const canvasAppId = typeof __app_id !== "undefined" ? __app_id : null;
export const appId = canvasAppId || firebaseConfig.projectId || "default-app-id";

export let app;
export let auth;
export let db;
export let currentUser = null;

export const DEFAULT_PROFILE_PIC = "https://placehold.co/32x32/1F2937/E5E7EB?text=AV";
export const DEFAULT_THEME_NAME = "dark";
export const ADMIN_UIDS = [
  "CEch8cXWemSDQnM3dHVKPt0RGpn2",
  "OoeTK1HmebQyOf3gEiCKAHVtD6l2",
];

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
    if (auth.currentUser?.uid === uid) {
      currentUser = await getUserProfileFromFirestore(uid);
    }
    return true;
  } catch (error) {
    console.error("Error updating user profile:", error);
    return false;
  }
}

export { setUserProfileInFirestore as updateUserProfileInFirestore };

export async function deleteUserProfileFromFirestore(uid) {
  await firebaseReadyPromise;
  if (!db) return false;

  try {
    await deleteDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid));
    return true;
  } catch (error) {
    console.error("Error deleting user profile:", error);
    return false;
  }
}

async function setupFirebaseCore() {
  if (getApps().length === 0) {
    let finalFirebaseConfig = firebaseConfig;

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

    try {
      app = initializeApp(finalFirebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      firebaseReadyResolve();

      if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token)
          .catch((error) => console.error("Custom token sign-in failed:", error));
      }
    } catch (e) {
      console.error("Error initializing Firebase:", e);
      firebaseReadyResolve();
    }
  } else {
    app = getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    firebaseReadyResolve();
  }
}

setupFirebaseCore();

// Test Firestore connection after initialization
setTimeout(async () => {
  try {
    await firebaseReadyPromise;
    if (db) {
      await getDoc(doc(db, `artifacts/${appId}/public/data/test_connection/doc`));
    }
  } catch (error) {
    console.error("Firestore connection test failed:", error);
  }
}, 2000);

firebaseReadyPromise.then(() => {
  onAuthStateChanged(auth, async (user) => {
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
        const updateData = {
          lastLoginAt: new Date(),
          isAdmin: ADMIN_UIDS.includes(user.uid),
        };
        if (!userProfile.photoURL) {
          updateData.photoURL = DEFAULT_PROFILE_PIC;
        }
        await setUserProfileInFirestore(user.uid, updateData);
        userProfile.isAdmin = ADMIN_UIDS.includes(user.uid);
      }
      currentUser = userProfile;
      window.currentUser = userProfile;
      if (typeof window.onUserReady === "function") window.onUserReady();

      if (typeof window.refreshNavbarProfilePicture === "function") {
        setTimeout(async () => {
          try {
            await window.refreshNavbarProfilePicture();
          } catch (error) {
            console.error("Error refreshing navbar profile picture:", error);
          }
        }, 100);
      }
    } else {
      currentUser = null;
      window.currentUser = null;
      if (typeof window.onUserReady === "function") window.onUserReady();

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

export { onAuthStateChanged };

export async function getCurrentUser() {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const userProfile = await getUserProfileFromFirestore(user.uid);
    return {
      uid: user.uid,
      email: user.email,
      displayName: userProfile?.displayName || user.displayName || "Anonymous",
      photoURL: userProfile?.photoURL || user.photoURL || DEFAULT_PROFILE_PIC,
      handle: userProfile?.handle || null,
      isAdmin: userProfile?.isAdmin || false,
      ...userProfile,
    };
  } catch (error) {
    console.error("Error getting current user profile:", error);
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || "Anonymous",
      photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
      handle: null,
      isAdmin: false,
    };
  }
}