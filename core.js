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
  
  return `
    <nav class="bg-navbar-footer text-text-primary shadow-lg fixed top-0 left-0 right-0 z-50">
      <div class="container mx-auto px-4">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center space-x-4">
            <a href="index.html" class="text-xl font-bold text-heading-main">Arcator.co.uk</a>
            <div class="hidden md:flex space-x-4">
              <a href="about.html" class="hover:text-link transition-colors">About</a>
              <a href="games.html" class="hover:text-link transition-colors">Games</a>
              <a href="forms.html" class="hover:text-link transition-colors">Community</a>
            </div>
          </div>
          
          <div class="flex items-center space-x-4">
            ${user ? `
              <div class="flex items-center space-x-2">
                <img src="${profilePic}" alt="Profile" class="w-8 h-8 rounded-full">
                <span class="hidden sm:inline">${displayName}</span>
                <button id="logout-btn" class="btn-primary btn-red text-sm">Logout</button>
              </div>
            ` : `
              <a href="users.html" class="btn-primary btn-blue">Login</a>
            `}
          </div>
        </div>
      </div>
    </nav>
  `;
}

/**
 * Sets up navbar event listeners.
 */
function setupNavbarEventListeners() {
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
    <footer class="bg-navbar-footer text-text-primary py-8 mt-16">
      <div class="container mx-auto px-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 class="text-lg font-bold mb-4">Arcator.co.uk</h3>
            <p class="text-text-secondary">A community-driven Minecraft server network.</p>
          </div>
          <div>
            <h4 class="font-semibold mb-4">Quick Links</h4>
            <ul class="space-y-2">
              <li><a href="about.html" class="hover:text-link transition-colors">About</a></li>
              <li><a href="games.html" class="hover:text-link transition-colors">Games</a></li>
              <li><a href="forms.html" class="hover:text-link transition-colors">Community</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-semibold mb-4">Resources</h4>
            <ul class="space-y-2">
              <li><a href="privacy.html" class="hover:text-link transition-colors">Privacy</a></li>
              <li><a href="https://discord.gg/arcator" target="_blank" class="hover:text-link transition-colors">Discord</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-semibold mb-4">Connect</h4>
            <p class="text-text-secondary">Join our community!</p>
            <div class="mt-2">
              <a href="https://discord.gg/arcator" target="_blank" class="btn-primary btn-blue text-sm">Join Discord</a>
            </div>
          </div>
        </div>
        <div class="border-t border-input-border mt-8 pt-8 text-center">
          <p class="text-text-secondary">
            © ${yearElementId ? `<span id="${yearElementId}">${currentYear}</span>` : currentYear} Arcator.co.uk. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  `;
}

// ============================================================================
// USER PROFILE MANAGEMENT
// ============================================================================

/**
 * Gets user profile from Firestore.
 * @param {string} uid - The user UID.
 * @returns {Promise<Object|null>} - The user profile or null.
 */
export async function getUserProfileFromFirestore(uid) {
  try {
    const userDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

/**
 * Sets user profile in Firestore.
 * @param {string} uid - The user UID.
 * @param {Object} profileData - The profile data to set.
 * @returns {Promise<boolean>} - Whether the operation was successful.
 */
export async function setUserProfileInFirestore(uid, profileData) {
  try {
    await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid), {
      ...profileData,
      lastUpdated: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error setting user profile:", error);
    return false;
  }
}

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

// ============================================================================
// EXPORTS
// ============================================================================

export {
  setupFirebaseCore,
  loadNavbar,
  loadFooter,
  getUserProfileFromFirestore,
  setUserProfileInFirestore,
  initializePage,
  setupTabs,
};
