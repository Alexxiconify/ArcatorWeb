// core.js - Core application functionality
import {
    auth,
    currentUser,
    db,
    DEFAULT_PROFILE_PIC,
    DEFAULT_THEME_NAME,
    firebaseReadyPromise,
    getUserProfileFromFirestore
} from "./firebase-init.js";
import {applyCachedTheme, applyTheme, getAvailableThemes} from "./themes.js";
import {setupTabs, showMessageBox} from "./utils.js";

const elementCache = new Map();
let isNavbarLoaded = false;
let currentNavbarUnsubscribe = null;

// DOM element helpers
function getElement(id) {
    if (!elementCache.has(id)) {
        const element = document.getElementById(id);
        if (element) elementCache.set(id, element);
        return element;
    }
    return elementCache.get(id);
}

// Navbar functionality
export async function loadNavbar(user, userProfile) {
    if (isNavbarLoaded && !user) return;

    try {
        const navbar = getElement('navbar-container');
        if (!navbar) return;

        navbar.innerHTML = generateNavbarHTML(user, userProfile);
        setupNavbarListeners();
        isNavbarLoaded = true;

        // Apply theme
        const userTheme = userProfile?.themePreference;
        const allThemes = await getAvailableThemes();
        const themeToApply = allThemes.find(t => t.id === userTheme) ||
            allThemes.find(t => t.id === DEFAULT_THEME_NAME);

        if (themeToApply) {
            applyTheme(themeToApply.id, themeToApply);
        }
    } catch (error) {
        console.error('Error loading navbar:', error);
    }
}

function generateNavbarHTML(user, userProfile) {
    const profilePic = userProfile?.photoURL || user?.photoURL || DEFAULT_PROFILE_PIC;
    const displayName = userProfile?.displayName || user?.displayName || 'Guest';

    return `
        <nav class="bg-navbar-footer text-text-primary p-4">
            <div class="container mx-auto flex justify-between items-center">
                <div class="flex items-center space-x-4">
                    <a href="./index.html" class="text-2xl font-bold">Arcator</a>
                    <div class="hidden md:flex space-x-4">
                        <a href="./about.html" class="hover:text-link transition-colors">About</a>
                        <a href="./games.html" class="hover:text-link transition-colors">Games</a>
                        <a href="./forms.html" class="hover:text-link transition-colors">Forms</a>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    ${user ? `
                        <div class="relative group">
                            <button id="user-menu-btn" class="flex items-center space-x-2">
                                <img src="${profilePic}" alt="Profile" class="w-8 h-8 rounded-full border-2 border-link">
                                <span id="display-name" class="hidden md:inline">${displayName}</span>
                            </button>
                            <div id="user-dropdown" class="absolute right-0 mt-2 w-48 bg-bg-card rounded-lg shadow-xl hidden">
                                <div class="py-1">
                                    <a href="./users.html" class="block px-4 py-2 hover:bg-link/10">Profile</a>
                                    ${userProfile?.isAdmin ?
        `<a href="./admin.html" class="block px-4 py-2 hover:bg-link/10">Admin</a>` : ''}
                                    <button id="logout-btn" class="w-full text-left px-4 py-2 hover:bg-link/10">
                                        Logout
                                    </button>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <a href="./users.html" class="btn-primary btn-blue">Sign In</a>
                    `}
                </div>
            </div>
        </nav>
    `;
}

function setupNavbarListeners() {
    const userMenuBtn = getElement('user-menu-btn');
    const userDropdown = getElement('user-dropdown');
    const logoutBtn = getElement('logout-btn');
    let menuTimeout;

    if (userMenuBtn && userDropdown) {
        const closeMenu = () => userDropdown.classList.add('hidden');
        const openMenu = () => userDropdown.classList.remove('hidden');

        userMenuBtn.addEventListener('mouseenter', () => {
            clearTimeout(menuTimeout);
            openMenu();
        });

        userMenuBtn.addEventListener('mouseleave', () => {
            menuTimeout = setTimeout(() => {
                if (!userDropdown.matches(':hover')) closeMenu();
            }, 200);
        });

        userDropdown.addEventListener('mouseenter', () => clearTimeout(menuTimeout));
        userDropdown.addEventListener('mouseleave', closeMenu);

        // Handle clicks outside
        document.addEventListener('click', (e) => {
            if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                closeMenu();
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                window.location.href = './index.html';
            } catch (error) {
                console.error('Logout failed:', error);
                showMessageBox('Failed to logout. Please try again.', true);
            }
        });
    }
}

export function loadFooter(yearElementId) {
    if (!yearElementId) return;
    const yearElement = getElement(yearElementId);
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear().toString();
    }
}

// Firebase initialization
async function waitForFirebase() {
    try {
        await firebaseReadyPromise;
        if (!auth || !db) new Error("Firebase not initialized");
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        throw error;
    }
}

// Initialize keyboard shortcuts
let shortcutsInitialized = false;

function initializeShortcuts() {
    if (shortcutsInitialized) return;

    import('./shortcuts.js')
        .then(({initShortcuts}) => {
            if (typeof initShortcuts === 'function') {
                initShortcuts();
                shortcutsInitialized = true;
            }
        })
        .catch(error => {
            console.error('Failed to initialize shortcuts:', error);
        });
}

// Page initialization with shortcut support
export async function initializePage(pageName, yearElementId = null, useWindowLoad = false) {
    const initFunction = async () => {
        try {
            await waitForFirebase();
            await applyCachedTheme();

            // Clean up any existing auth listener
            if (currentNavbarUnsubscribe) {
                currentNavbarUnsubscribe();
                currentNavbarUnsubscribe = null;
            }

            // Initialize UI without user first
            await loadNavbar(null, null);
            loadFooter(yearElementId);
            initializeShortcuts();

            // Set up auth listener
            currentNavbarUnsubscribe = auth.onAuthStateChanged(async (user) => {
                try {
                    let userProfile = null;
                    if (user) {
                        userProfile = await getUserProfileFromFirestore(user.uid);
                    }
                    await loadNavbar(user, userProfile);

                    // Apply user theme if available
                    if (userProfile?.themePreference) {
                        const themes = await getAvailableThemes();
                        const userTheme = themes.find(t => t.id === userProfile.themePreference);
                        if (userTheme) applyTheme(userTheme.id, userTheme);
                    }
                } catch (error) {
                    console.error('Auth state change handler failed:', error);
                    showMessageBox('Failed to update user state', true);
                }
            });

            console.log(`Page ${pageName} initialized successfully`);
        } catch (error) {
            console.error(`Error initializing page ${pageName}:`, error);
            showMessageBox("Failed to initialize page", true);
        }
    };

    const executeInit = () => {
        initFunction().catch(error => {
            console.error('Page initialization failed:', error);
            showMessageBox('Failed to initialize page', true);
        });
    };

    if (useWindowLoad) {
        if (document.readyState === 'complete') {
            executeInit();
        } else {
            window.addEventListener('load', executeInit);
        }
    } else {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', executeInit);
        } else {
            executeInit();
        }
    }
}

// Expose global utilities safely
Object.assign(window, {
    initializePage,
    loadNavbar: (...args) => loadNavbar(...args).catch(console.error),
    loadFooter,
    setupTabs,
    currentUser: () => currentUser
});