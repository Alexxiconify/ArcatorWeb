// core.js: Core functionality for the Arcator website
import {
  auth,
  db,
  appId,
  firebaseReadyPromise,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME,
  getUserProfileFromFirestore,
  setUserProfileInFirestore,
} from "./firebase-init.js";
import {
  getAvailableThemes,
  applyTheme,
  applyCachedTheme,
} from "./themes.js";
import { showMessageBox, showCustomConfirm, escapeHtml } from "./utils.js";

// ============================================================================
// FIREBASE CORE SETUP
// ============================================================================

/**
 * Sets up Firebase core functionality.
 */
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

// ============================================================================
// NAVBAR MANAGEMENT
// ============================================================================

/**
 * Loads the navbar with user information.
 * @param {Object} user - The Firebase user object.
 * @param {Object} userProfile - The user profile data.
 * @param {string} defaultProfilePic - The default profile picture URL.
 * @param {string} defaultTheme - The default theme name.
 */
export async function loadNavbar(user, userProfile, defaultProfilePic, defaultTheme) {
  try {
    const navbarPlaceholder = document.getElementById("navbar-placeholder");
    if (!navbarPlaceholder) {
      console.warn("Navbar placeholder not found");
      return;
    }

    // Apply user theme if available
    if (userProfile?.themePreference) {
      const themes = await getAvailableThemes();
      const userTheme = themes.find(t => t.id === userProfile.themePreference);
      if (userTheme) {
        applyTheme(userTheme.id, userTheme);
      }
    }

    // Render navbar content
    navbarPlaceholder.innerHTML = generateNavbarHTML(user, userProfile, defaultProfilePic);
    setupNavbarEventListeners();
  } catch (error) {
    console.error("Error loading navbar:", error);
  }
}

/**
 * Generates navbar HTML.
 * @param {Object} user - The Firebase user object.
 * @param {Object} userProfile - The user profile data.
 * @param {string} defaultProfilePic - The default profile picture URL.
 * @returns {string} - The navbar HTML.
 */
function generateNavbarHTML(user, userProfile, defaultProfilePic) {
  const profilePic = userProfile?.photoURL || defaultProfilePic;
  const displayName = userProfile?.displayName || user?.displayName || "Guest";
  // Modernized navbar with divider, blur, and smaller button
  return `
    <nav class="bg-navbar-footer fixed top-0 left-0 right-0 z-50">
        <div class="flex justify-between items-center">
            <a href="index.html" class="text-lg font-bold whitespace-nowrap text-white">Arcator</a>
            <a href="about.html" class="text-sm hover:text-link transition-colors text-white">About</a>
            <a href="games.html" class="text-sm hover:text-link transition-colors text-white">Games</a>
            <a href="forms.html" class="text-sm hover:text-link transition-colors text-white">Forms</a>
            <a href="pages.html" class="text-sm hover:text-link transition-colors text-white">Pages</a>
            <a href="privacy.html" class="text-sm hover:text-link transition-colors text-white">Privacy</a>
              <a href="admin.html" class="text-sm hover:text-link transition-colors text-white">Admin</a>
            ${user ? `
              <div class="flex items-center space-x-2">
                <button id="logout-btn" class="btn-primary btn-blue navbar-btn-sm text-xs px-3 py-1 text-white rounded-md shadow-sm transition hover:bg-blue-700" style="min-width:unset;">Logout</button>
                <a href="users.html" class="text-xs font-medium text-white">
                <img src="${profilePic}" class="navbar-profile-icon" style="vertical-align: middle;">
                ${displayName}</a>
              </div>
            ` : `
              <a href="users.html" class="btn-primary btn-blue navbar-btn-sm text-xs px-3 py-1 text-white rounded-md shadow-sm transition hover:bg-blue-700" style="min-width:unset;">Login</a>
            `}
        </div>
      </div>
    </nav>
  `;
}

/**
 * Sets up navbar event listeners.
 */
function setupNavbarEventListeners() {
  // Logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await auth.signOut();
        window.location.href = "index.html";
      } catch (error) {
        console.error("Logout error:", error);
        showMessageBox("Logout failed", true);
      }
    });
  }
  
  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener("click", () => {
      const isHidden = mobileMenu.classList.contains("hidden");
      if (isHidden) {
        mobileMenu.classList.remove("hidden");
        mobileMenuBtn.innerHTML = `
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        `;
      } else {
        mobileMenu.classList.add("hidden");
        mobileMenuBtn.innerHTML = `
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        `;
      }
    });
  }
  
  // Close mobile menu when clicking outside
  document.addEventListener("click", (event) => {
    if (mobileMenu && mobileMenuBtn) {
      const isClickInside = mobileMenu.contains(event.target) || mobileMenuBtn.contains(event.target);
      if (!isClickInside && !mobileMenu.classList.contains("hidden")) {
        mobileMenu.classList.add("hidden");
        mobileMenuBtn.innerHTML = `
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        `;
      }
    }
  });
}

// ============================================================================
// FOOTER MANAGEMENT
// ============================================================================

/**
 * Loads the footer.
 * @param {string} yearElementId - The year element ID.
 */
export function loadFooter(yearElementId = null) {
  const footerPlaceholder = document.getElementById("footer-placeholder");
  if (!footerPlaceholder) {
    console.warn("Footer placeholder not found");
    return;
  }

  const currentYear = new Date().getFullYear();
  
  footerPlaceholder.innerHTML = `
    <footer class="bg-navbar-footer">
      <div class="text-center">
          <a class="text-white text-xs" href="about.html" class="hover:text-link transition-colors">About</a>
          <a class="text-white text-xs" href="games.html" class="hover:text-link transition-colors ml-2">Games</a>
          <a class="text-white text-xs" href="forms.html" class="hover:text-link transition-colors ml-2">Community</a>
          <a class="text-white text-xs" href="privacy.html" class="hover:text-link transition-colors ml-2">Privacy</a>
          <a class="text-white text-xs" href="https://discord.gg/arcator" target="_blank" class="hover:text-link transition-colors ml-2">Discord</a>
        <p class="text-xs">©2012-${yearElementId ? `<span class="text-whitetext-xs" id="${yearElementId}">${currentYear}</span>` : currentYear} Arcator.co.uk A community-driven Minecraft server network.</p>
      </div>
    </footer>
  `;
}

// User profile functions are imported from firebase-init.js

// ============================================================================
// PAGE INITIALIZATION
// ============================================================================

/**
 * Initializes a page with common functionality.
 * @param {string} pageName - The page name.
 * @param {string} yearElementId - The year element ID.
 * @param {boolean} useWindowLoad - Whether to use window load event.
 */
export async function initializePage(pageName, yearElementId = null, useWindowLoad = false) {
  const initFunction = async () => {
    try {
      // Setup Firebase core
      await setupFirebaseCore();
      
      // Apply cached theme
      await applyCachedTheme();
      
      // Load navbar and footer
      await loadNavbar(null, null, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
      loadFooter(yearElementId);
      
      // Setup auth state listener
      auth.onAuthStateChanged(async (user) => {
        let userProfile = null;
        if (user) {
          userProfile = await getUserProfileFromFirestore(user.uid);
        }
        
        await loadNavbar(user, userProfile, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
        
        // Apply user theme
        if (userProfile?.themePreference) {
          const themes = await getAvailableThemes();
          const userTheme = themes.find(t => t.id === userProfile.themePreference);
          if (userTheme) {
            applyTheme(userTheme.id, userTheme);
          }
        }
      });
      
      console.log(`Page ${pageName} initialized successfully`);
    } catch (error) {
      console.error(`Error initializing page ${pageName}:`, error);
      showMessageBox("Failed to initialize page", true);
    }
  };

  if (useWindowLoad) {
    window.addEventListener("load", initFunction);
  } else {
    await initFunction();
  }
}

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

/**
 * Sets up tab functionality.
 * @param {string} tabButtonSelector - The tab button selector.
 * @param {string} tabContentSelector - The tab content selector.
 */
export function setupTabs(tabButtonSelector = '.tab-button', tabContentSelector = '.tab-content') {
  const tabButtons = document.querySelectorAll(tabButtonSelector);
  const tabContents = document.querySelectorAll(tabContentSelector);

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      const targetContent = document.querySelector(`${tabContentSelector}[data-tab="${targetTab}"]`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}