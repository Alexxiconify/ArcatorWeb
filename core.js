// core.js - Core application functionality
import {auth, COLLECTIONS, db, DEFAULT_PROFILE_PIC, doc, getDoc, serverTimestamp, setDoc} from "./firebase-init.js";
import {themeManager} from "./theme-manager.js";
import {showMessageBox} from "./utils.js";

const navbarHTML = `
<nav class="navbar">
    <div class="container navbar-content">
        <div class="flex items-center gap-4">
            <a href="./index.html" class="text-xl font-bold text-text hover:text-accent-light">Arcator</a>
            <div class="flex items-center gap-4">
                <a href="./index.html" class="nav-link">Home</a>
                <a href="./games.html" class="nav-link">Games</a>
                <a href="./forms.html" class="nav-link">Forms</a>
                <a href="./pages.html" class="nav-link">Pages</a>
                <a href="./about.html" class="nav-link">About</a>
                <a href="./admin.html" class="nav-link">Admin</a>
            </div>
        </div>
        <div id="user-section" class="flex items-center gap-4"></div>
    </div>
</nav>`;

const footerHTML = `
<footer class="footer bg-surface mt-auto">
    <div class="container py-4">
        <div class="flex justify-between items-center">
            <div class="flex gap-4">
                <a href="https://bluemaps.arcator.co.uk" class="footer-link" target="_blank" rel="noopener">Blue Maps</a>
                <a href="https://wiki.arcator.co.uk" class="footer-link" target="_blank" rel="noopener">Wiki</a>
            </div>
            <div class="text-text-2">&copy; ${new Date().getFullYear()} Arcator</div>
        </div>
    </div>
</footer>`;

const elementCache = new Map();
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
    const navbar = getElement('navbar-placeholder');
    if (!navbar) return;

    navbar.innerHTML = navbarHTML;

    const userSection = getElement('user-section');
    if (!userSection) return;

    userSection.innerHTML = user
        ? `<a href="./users.html" class="flex items-center gap-2">
             <img src="${userProfile?.photoURL || DEFAULT_PROFILE_PIC}" alt="Profile" 
                  class="profile-image">
             <span class="text-text">${userProfile?.displayName || user.email}</span>
           </a>`
        : `<a href="./users.html" class="btn-primary">Sign In</a>`;

    // Highlight current page
    const currentPage = globalThis.location.pathname.split('/').pop() || 'index.html';
    navbar.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href').replace('./', '') === currentPage) {
            link.classList.add('nav-link-active');
        }
    });
}

export function loadFooter() {
    const footer = getElement('footer-placeholder');
    if (footer) footer.innerHTML = footerHTML;
}

async function loadUserProfile(userId) {
    if (!userId) return null;
    try {
        const userRef = doc(db, COLLECTIONS.USER_PROFILES, userId);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            await setDoc(userRef, {
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp(),
                isAdmin: false,
                themePreference: 'dark'
            }, {merge: true});
            return await getDoc(userRef).then(doc => doc.data());
        }
        return userDoc.data();
    } catch (error) {
        console.error('Error loading user profile:', error);
        return null;
    }
}

export function setupTabs(containerId, defaultTab = 0) {
    const container = getElement(containerId);
    if (!container) return;

    const tabs = container.querySelectorAll('[role="tab"]');
    const panels = container.querySelectorAll('[role="tabpanel"]');

    function switchTab(oldTab, newTab) {
        newTab.focus();
        newTab.setAttribute('aria-selected', 'true');
        oldTab.setAttribute('aria-selected', 'false');
        oldTab.focus();

        const newPanelId = newTab.getAttribute('aria-controls');
        const newPanel = getElement(newPanelId);
        const oldPanelId = oldTab.getAttribute('aria-controls');
        const oldPanel = getElement(oldPanelId);

        if (newPanel && oldPanel) {
            newPanel.classList.remove('hidden');
            oldPanel.classList.add('hidden');
        }
    }

    // Set initial tab
    if (tabs[defaultTab]) {
        tabs[defaultTab].click();
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', e => {
            e.preventDefault();
            const currentTab = container.querySelector('[aria-selected="true"]');
            if (e.currentTarget !== currentTab) {
                switchTab(currentTab, e.currentTarget);
            }
        });
    });
}

// Page initialization with shortcut support
export async function initializePage(pageName, requireAuth = false) {
    try {
        await themeManager.init();

        if (currentNavbarUnsubscribe) {
            currentNavbarUnsubscribe();
            currentNavbarUnsubscribe = null;
        }

        const user = await new Promise(resolve => {
            const unsubscribe = auth.onAuthStateChanged(user => {
                unsubscribe();
                resolve(user);
            });
        });

        if (requireAuth && !user) {
            window.location.href = './users.html';
            return;
        }

        const userProfile = user ? await loadUserProfile(user.uid) : null;
        await loadNavbar(user, userProfile);

        if (user) {
            currentNavbarUnsubscribe = auth.onAuthStateChanged(async user => {
                const profile = user ? await loadUserProfile(user.uid) : null;
                await loadNavbar(user, profile);
            });
        }

        console.log(`Page ${pageName} initialized successfully`);
    } catch (error) {
        console.error('Page initialization error:', error);
        showMessageBox('Failed to initialize page', true);
    }
}

export function getCurrentUser() {
    return auth.currentUser;
}