// firebase-init.js - Centralized Firebase Initialization
import {getApp, getApps, initializeApp} from 'firebase/app';
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
    updateProfile
} from "firebase/auth";
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
    where
} from "firebase/firestore";
import {firebaseConfig} from "./firebase-config.js";
import {getAppId, getFirebaseConfig, getInitialAuthToken} from './runtime-globals.js';
import {showMessageBox} from './utils.js';

// Constants
export const DEFAULT_PROFILE_PIC = "https://placehold.co/32x32/1F2937/E5E7EB?text=AV";
export const DEFAULT_THEME_NAME = "dark";
export const ADMIN_UIDS = ["CEch8cXWemSDQnM3dHVKPt0RGpn2", "OoeTK1HmebQyOf3gEiCKAHVtD6l2"];

// Firebase instances
export const appId = getAppId() || firebaseConfig.projectId || "default-app-id";
export let app, auth, db, currentUser = null;

// Firebase Ready Promise
let firebaseResolve, firebaseReject;
export const firebaseReadyPromise = new Promise((resolve, reject) => {
    firebaseResolve = resolve;
    firebaseReject = reject;
});

// Initialize Firebase
function initializeFirebase() {
    try {
        if (getApps().length === 0) {
            const config = getFirebaseConfig() || firebaseConfig;
            app = initializeApp(config);
            auth = getAuth(app);
            db = getFirestore(app);
        } else {
            app = getApp();
            auth = getAuth(app);
            db = getFirestore(app);
        }

        // Handle initial auth token if provided
        const initialToken = getInitialAuthToken();
        if (initialToken) {
            signInWithCustomToken(auth, initialToken).catch(error => {
                console.error("Initial auth token sign-in failed:", error);
            });
        }

        // Set up auth state listener
        onAuthStateChanged(auth, handleAuthStateChange);

        firebaseResolve(true);
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        firebaseReject(error);
    }
}

async function handleAuthStateChange(user) {
    try {
        if (user) {
            currentUser = await getUserProfileFromFirestore(user.uid) || await createInitialProfile(user);
            window.currentUser = currentUser;
            localStorage.setItem('userProfile', JSON.stringify(currentUser));
        } else {
            currentUser = null;
            window.currentUser = null;
            localStorage.removeItem('userProfile');
        }

        // Update UI and notify
        updateDisplayName();
        notifyAuthStateChange();
    } catch (error) {
        console.error("Auth state change handler failed:", error);
        showMessageBox('Failed to update user state', true);
    }
}

function updateDisplayName() {
    const displayNameEl = document.getElementById('display-name');
    if (displayNameEl) {
        displayNameEl.textContent = currentUser?.displayName || 'Guest';
    }
}

function notifyAuthStateChange() {
    if (typeof window.onUserReady === 'function') {
        try {
            window.onUserReady();
        } catch (error) {
            console.error("onUserReady handler failed:", error);
        }
    }
}

export async function getUserProfileFromFirestore(uid) {
    if (!db || !uid) return null;
    try {
        const snapshot = await getDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid));
        return snapshot.exists() ? {uid: snapshot.id, ...snapshot.data()} : null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

export async function setUserProfileInFirestore(uid, profileData) {
    if (!db || !uid) return false;
    try {
        await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid), profileData, {merge: true});
        if (auth.currentUser?.uid === uid) {
            currentUser = await getUserProfileFromFirestore(uid);
            window.currentUser = currentUser;
        }
        return true;
    } catch (error) {
        console.error("Error updating user profile:", error);
        return false;
    }
}

async function createInitialProfile(user) {
    const profile = {
        uid: user.uid,
        displayName: user.displayName || `User-${user.uid.substring(0, 6)}`,
        email: user.email,
        photoURL: user.photoURL || DEFAULT_PROFILE_PIC,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        themePreference: DEFAULT_THEME_NAME,
        isAdmin: ADMIN_UIDS.includes(user.uid),
        handle: user.uid.substring(0, 6)
    };

    await setUserProfileInFirestore(user.uid, profile);
    return profile;
}

export async function getCurrentUser() {
    if (!auth?.currentUser) return null;
    try {
        return await getUserProfileFromFirestore(auth.currentUser.uid) || {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            displayName: auth.currentUser.displayName || "Anonymous",
            photoURL: auth.currentUser.photoURL || DEFAULT_PROFILE_PIC,
            handle: null,
            isAdmin: ADMIN_UIDS.includes(auth.currentUser.uid)
        };
    } catch (error) {
        console.error("Error getting current user:", error);
        return null;
    }
}

// Initialize Firebase
initializeFirebase();

// Export Firebase services and utilities
export {
    auth,
    db,
    firebaseReadyPromise,
    // Auth utilities
    signInWithCustomToken,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile,
    signOut,
    // Firestore utilities
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    onSnapshot
};