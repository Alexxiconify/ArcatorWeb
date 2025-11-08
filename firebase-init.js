import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
    createUserWithEmailAndPassword,
    getAuth,
    GithubAuthProvider,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    startAfter,
    updateDoc,
    where
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
    authDomain: "arcator-web.firebaseapp.com",
    projectId: "arcator-web",
    storageBucket: "arcator-web.appspot.com",
    messagingSenderId: "919078249743",
    appId: "1:919078249743:web:050cc10de97b51f10b9830"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Constants
export const DEFAULT_PROFILE_PIC = './defaultuser.png';
export const DEFAULT_THEME_NAME = 'dark';
export const appId = firebaseConfig.appId;

// Collection paths
export const COLLECTIONS = {
    USERS: 'users',
    DMS: (userId) => `users/${userId}/dms`,
    MESSAGES: (userId, dmId) => `users/${userId}/dms/${dmId}/messages`,
    USER_PROFILES: `artifacts/${appId}/public/data/user_profiles`,
    THEMES: `artifacts/${appId}/public/data/themes`,
    PAGES: `artifacts/${appId}/public/data/pages`,
    FORMS: `artifacts/${appId}/public/data/forms`,
    SUBMISSIONS: 'submissions',
    ADMIN: `artifacts/${appId}/public/data/admin`,
};

// Firebase ready promise
export const firebaseReadyPromise = new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(true);
    });
});

// Helper function to get user profile from Firestore
export async function getUserProfileFromFirestore(uid) {
    if (!uid) return null;
    try {
        const userRef = doc(db, COLLECTIONS.USER_PROFILES, uid);
        const userDoc = await getDoc(userRef);
        return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}

// Helper function to save user profile to Firestore
export async function setUserProfileInFirestore(uid, data) {
    if (!uid) return false;
    try {
        const userRef = doc(db, COLLECTIONS.USER_PROFILES, uid);
        await setDoc(userRef, {
            ...data,
            lastUpdated: serverTimestamp()
        }, {merge: true});
        return true;
    } catch (error) {
        console.error('Error setting user profile:', error);
        return false;
    }
}

// Helper function to get DMs for a user
export async function getUserDMs(userId) {
    if (!userId) return [];
    try {
        const dmsRef = collection(db, COLLECTIONS.DMS(userId));
        const dmsSnap = await getDocs(dmsRef);
        return dmsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    } catch (error) {
        console.error('Error getting user DMs:', error);
        return [];
    }
}

// Helper function to get messages for a DM
export async function getDMMessages(userId, dmId, limit = 50) {
    if (!userId || !dmId) return [];
    try {
        const messagesRef = collection(db, COLLECTIONS.MESSAGES(userId, dmId));
        const q = query(messagesRef, orderBy('createdAt', 'desc'), (limit));
        const messagesSnap = await getDocs(q);
        return messagesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    } catch (error) {
        console.error('Error getting DM messages:', error);
        return [];
    }
}

// Export Firebase instances and functions
export {
    app,
    auth,
    db,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    GithubAuthProvider,
    signOut,
    updateProfile
};