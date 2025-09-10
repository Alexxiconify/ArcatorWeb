// core.js: Core functionality for the Arcator website
import {
    auth,
    DEFAULT_PROFILE_PIC,
    DEFAULT_THEME_NAME,
    firebaseReadyPromise,
    getUserProfileFromFirestore
} from "./firebase-init.js";
import {applyCachedTheme, applyTheme, getAvailableThemes} from "./themes.js";
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

// NAVBAR MANAGEMENT
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

function generateNavbarHTML(user, userProfile, defaultProfilePic) {
  const profilePic = userProfile?.photoURL || defaultProfilePic;
  const displayName = userProfile?.displayName || user?.displayName || "Guest";
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
}
  // FOOTER MANAGEMENT
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

  // PAGE INITIALIZATION
  export async function initializePage(pageName, yearElementId = null, useWindowLoad = false) {
    const initFunction = async () => {
      try {
        await setupFirebaseCore();
        await applyCachedTheme();
        await loadNavbar(null, null, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
        loadFooter(yearElementId);
        auth.onAuthStateChanged(async (user) => {
          let userProfile = null;
          if (user) {
            userProfile = await getUserProfileFromFirestore(user.uid);
          }
          await loadNavbar(user, userProfile, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
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

  // TAB MANAGEMENT
  export function setupTabs(tabButtonSelector = '.tab-button', tabContentSelector = '.tab-content') {
    const tabButtons = document.querySelectorAll(tabButtonSelector);
    const tabContents = document.querySelectorAll(tabContentSelector);

    function activateTab(tabName, updateHash = false) {
      let found = false;
      tabButtons.forEach(btn => {
        const btnTab = btn.getAttribute('data-tab');
        if (btnTab === tabName) {
          btn.classList.add('active');
          found = true;
        } else {
          btn.classList.remove('active');
        }
      });
      tabContents.forEach(content => {
        const contentTab = content.getAttribute('data-tab');
        if (contentTab === tabName) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
      if (updateHash && found) {
        history.replaceState(null, '', `#${tabName}`);
      }
    }

    // Tab click event
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        activateTab(targetTab, true);
      });
    });

    // On page load, activate tab from hash if present
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      activateTab(hash);
    } else if (tabButtons.length > 0) {
      // Default: activate first tab
      const firstTab = tabButtons[0].getAttribute('data-tab');
      activateTab(firstTab);
    }

    // Listen for hash changes (browser navigation)
    window.addEventListener('hashchange', () => {
      const newHash = window.location.hash.replace(/^#/, '');
      if (newHash) activateTab(newHash);
    });
  }