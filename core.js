// core.js: Core functionality for the Arcator website
import {auth, firebaseReadyPromise, getCurrentUser} from "./firebase-init.js";
import {showMessageBox} from "./utils.js";

// FIREBASE CORE SETUP
async function setupFirebaseCore() {
  try {
    await firebaseReadyPromise;
    console.log("Firebase core initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize Firebase core:", error);
    showMessageBox("Failed to initialize core services", true);
    return false;
  }
}

// NAVBAR SYSTEM
export async function loadNavbar(user, userProfile, defaultProfilePic, defaultTheme) {
  try {
    const navbarPlaceholder = document.getElementById("navbar-placeholder");
    if (!navbarPlaceholder) {
      console.warn("Navbar placeholder not found");
      return;
    }

      const navbarHTML = generateNavbarHTML(user, userProfile, defaultProfilePic);
      navbarPlaceholder.innerHTML = navbarHTML;

    setupNavbarEventListeners();
  } catch (error) {
    console.error("Error loading navbar:", error);
  }
}

function generateNavbarHTML(user, userProfile, defaultProfilePic) {
    const profilePic = userProfile?.photoURL || user?.photoURL || defaultProfilePic;
  const displayName = userProfile?.displayName || user?.displayName || "Guest";
    const handle = userProfile?.handle || user?.handle || "";

  return `
    <nav class="bg-navbar-footer text-white p-4 shadow-lg navbar-fixed">
      <div class="container mx-auto flex justify-between items-center">
        <div class="flex items-center space-x-4">
          <a href="index.html" class="text-xl font-bold hover:text-link transition-colors">Arcator.co.uk</a>
          <div class="hidden md:flex space-x-4">
            <a href="index.html" class="hover:text-link transition-colors">Home</a>
            <a href="about.html" class="hover:text-link transition-colors">About</a>
            <a href="games.html" class="hover:text-link transition-colors">Servers</a>
            <a href="forms.html" class="hover:text-link transition-colors">Community</a>
            <a href="users.html" class="hover:text-link transition-colors">Settings</a>
          </div>
        </div>
        
        <div class="flex items-center space-x-4">
          ${user ? `
            <div class="flex items-center space-x-2">
              <img src="${profilePic}" alt="Profile" class="w-8 h-8 rounded-full navbar-profile-icon">
              <span class="hidden sm:inline">${displayName}</span>
              ${handle ? `<span class="hidden lg:inline text-gray-300">@${handle}</span>` : ''}
            </div>
            <button onclick="logout()" class="btn-primary btn-red navbar-btn-sm">Logout</button>
          ` : `
            <a href="users.html" class="btn-primary btn-blue navbar-btn-sm">Login</a>
          `}
        </div>
      </div>
    </nav>
  `;
}

function setupNavbarEventListeners() {
    // Logout function
    window.logout = async () => {
        try {
            await auth.signOut();
            window.location.reload();
        } catch (error) {
            console.error("Logout failed:", error);
            showMessageBox("Logout failed", true);
        }
    };
}

// FOOTER SYSTEM
export function loadFooter(yearElementId = null) {
    const footerPlaceholder = document.getElementById("footer-placeholder");
    if (!footerPlaceholder) {
        console.warn("Footer placeholder not found");
        return;
    }

    const currentYear = new Date().getFullYear();
    const yearText = yearElementId ?
        `<span id="${yearElementId}">${currentYear}</span>` :
        currentYear;

    footerPlaceholder.innerHTML = `
    <footer class="bg-navbar-footer text-white py-8 mt-16">
      <div class="container mx-auto px-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 class="text-lg font-bold mb-4">Arcator.co.uk</h3>
            <p class="text-gray-300">A community-driven Minecraft server network.</p>
          </div>
          <div>
            <h3 class="text-lg font-bold mb-4">Quick Links</h3>
            <div class="space-y-2">
              <a href="about.html" class="footer-link block">About</a>
              <a href="games.html" class="footer-link block">Servers</a>
              <a href="forms.html" class="footer-link block">Community</a>
              <a href="privacy.html" class="footer-link block">Privacy</a>
            </div>
          </div>
          <div>
            <h3 class="text-lg font-bold mb-4">Connect</h3>
            <div class="space-y-2">
              <a href="https://discord.gg/arcator" target="_blank" class="footer-link block">Discord</a>
              <a href="https://github.com/arcator" target="_blank" class="footer-link block">GitHub</a>
            </div>
          </div>
        </div>
        <div class="border-t border-gray-600 mt-8 pt-8 text-center">
          <p>&copy; ${yearText} Arcator.co.uk. All rights reserved.</p>
        </div>
      </div>
    </footer>
  `;
}

// PAGE INITIALIZATION
export async function initializePage(pageName, yearElementId = null, useWindowLoad = false) {
    const initFunction = async () => {
        try {
            // Setup Firebase core
            const firebaseReady = await setupFirebaseCore();
            if (!firebaseReady) return;

            // Load navbar and footer
            const currentUser = getCurrentUser();
            await loadNavbar(currentUser, null, "https://placehold.co/32x32/1F2937/E5E7EB?text=AV", "dark");
            loadFooter(yearElementId);

            // Page-specific initialization
            if (pageName === 'about') {
                console.log("About page initialized");
            } else if (pageName === 'admin') {
                console.log("Admin page initialized");
            } else if (pageName === 'forms') {
                console.log("Forms page initialized");
            }

            console.log(`${pageName} page initialized successfully`);
        } catch (error) {
            console.error("Failed to initialize page:", error);
            showMessageBox("Failed to initialize page", true);
        }
    };

    if (useWindowLoad) {
        window.addEventListener('load', initFunction);
    } else {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initFunction);
    } else {
            initFunction();
        }
    }
}

// TAB SYSTEM
export function setupTabs(tabButtonSelector = '.tab-button', tabContentSelector = '.tab-content') {
    const tabButtons = document.querySelectorAll(tabButtonSelector);
    const tabContents = document.querySelectorAll(tabContentSelector);

    function activateTab(tabName, updateHash = false) {
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
        });

        tabContents.forEach(content => {
            content.classList.toggle('active', content.getAttribute('data-tab') === tabName);
        });

        if (updateHash) {
            window.location.hash = tabName;
        }
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            activateTab(tabName, true);
        });
    });

    // Initialize from hash
    const hash = window.location.hash.slice(1);
    if (hash) {
        activateTab(hash);
    }
}