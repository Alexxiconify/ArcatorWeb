// core.js: Core functionality for the Arcator website
import {
    auth,
    db,
    DEFAULT_PROFILE_PIC,
    DEFAULT_THEME_NAME,
    firebaseReadyPromise,
    getUserProfileFromFirestore
} from "./firebase-init.js";
import {applyCachedTheme, applyTheme, getAvailableThemes} from "./themes.js";
import {setupTabs, showMessageBox} from "./utils.js";

export {loadNavbar, loadFooter} from "./navbar.js";

async function waitForFirebase() {
    await firebaseReadyPromise;
    if (!auth || !db) {
        throw new Error("Firebase not initialized");
    }
}

export async function initializePage(pageName, yearElementId = null, useWindowLoad = false) {
    const {loadNavbar, loadFooter} = await import("./navbar.js");
    const initFunction = async () => {
        try {
            await waitForFirebase();
            applyCachedTheme();
            await loadNavbar(null, null, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
            loadFooter(yearElementId);
            const handleAuthChange = async (user) => {
                let userProfile = null;
                if (user) userProfile = await getUserProfileFromFirestore(user.uid);
                await loadNavbar(user, userProfile, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
                if (userProfile?.themePreference) {
                    const themes = await getAvailableThemes();
                    const userTheme = themes.find(t => t.id === userProfile.themePreference);
                    if (userTheme) applyTheme(userTheme.id, userTheme);
                }
            };
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => auth.onAuthStateChanged(handleAuthChange), {timeout: 500});
            } else {
                setTimeout(() => auth.onAuthStateChanged(handleAuthChange), 0);
            }
            console.log(`Page ${pageName} initialized successfully`);
        } catch (error) {
            console.error(`Error initializing page ${pageName}:`, error);
            showMessageBox("Failed to initialize page", true);
        }
    };
    if (useWindowLoad) {
        if (document.readyState === 'complete') initFunction();
        else window.addEventListener("load", initFunction);
    } else {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFunction);
        else initFunction();
    }
}

export {setupTabs};