// page-init.js - Consolidated page initialization for all pages
import {
  auth,
  firebaseReadyPromise,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME,
  getUserProfileFromFirestore,
} from "./firebase-init.js";
import {
  setupThemesFirebase,
  applyTheme,
  getAvailableThemes,
} from "./themes.js";
import { loadNavbar } from "./navbar.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

/**
 * Initialize a page with common functionality (navbar, themes, footer year)
 * @param {string} pageName - Name of the page for logging
 * @param {string} yearElementId - ID of the element to set current year
 * @param {boolean} useWindowLoad - Whether to use window.onload instead of DOMContentLoaded
 */
export async function initializePage(
  pageName,
  yearElementId = null,
  useWindowLoad = false,
) {
  const initFunction = async () => {
    console.log(`${pageName}: Initialization started.`);

    // Wait for Firebase to be ready
    await firebaseReadyPromise;
    console.log(`${pageName}: Firebase ready.`);

    // Setup themes
    setupThemesFirebase();

    // Load navbar
    let userProfile = null;
    if (auth.currentUser) {
      userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
    }
    await loadNavbar(
      auth.currentUser,
      userProfile,
      DEFAULT_PROFILE_PIC,
      DEFAULT_THEME_NAME,
    );
    console.log(`${pageName}: Navbar loaded.`);

    // Set current year for footer
    if (yearElementId) {
      const currentYearElement = document.getElementById(yearElementId);
      if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
        console.log(`${pageName}: Current year set for footer.`);
      }
    }

    // Apply theme
    onAuthStateChanged(auth, async (user) => {
      let userThemePreference = null;
      if (user) {
        const userProfile = await getUserProfileFromFirestore(user.uid);
        userThemePreference = userProfile?.themePreference;
      }
      const allThemes = await getAvailableThemes();
      const themeToApply =
        allThemes.find((t) => t.id === userThemePreference) ||
        allThemes.find((t) => t.id === DEFAULT_THEME_NAME);
      applyTheme(themeToApply.id, themeToApply);
    });

    console.log(`${pageName}: Page initialization complete.`);
  };

  if (useWindowLoad) {
    window.onload = initFunction;
  } else {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initFunction);
    } else {
      initFunction();
    }
  }
}

/**
 * Initialize a page with custom initialization logic
 * @param {string} pageName - Name of the page for logging
 * @param {Function} customInit - Custom initialization function to run after common setup
 * @param {string} yearElementId - ID of the element to set current year
 * @param {boolean} useWindowLoad - Whether to use window.onload instead of DOMContentLoaded
 */
export async function initializePageWithCustom(
  pageName,
  customInit,
  yearElementId = null,
  useWindowLoad = false,
) {
  const initFunction = async () => {
    console.log(`${pageName}: Initialization started.`);

    // Wait for Firebase to be ready
    await firebaseReadyPromise;
    console.log(`${pageName}: Firebase ready.`);

    // Setup themes
    setupThemesFirebase();

    // Load navbar
    let userProfile = null;
    if (auth.currentUser) {
      userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
    }
    await loadNavbar(
      auth.currentUser,
      userProfile,
      DEFAULT_PROFILE_PIC,
      DEFAULT_THEME_NAME,
    );
    console.log(`${pageName}: Navbar loaded.`);

    // Set current year for footer
    if (yearElementId) {
      const currentYearElement = document.getElementById(yearElementId);
      if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
        console.log(`${pageName}: Current year set for footer.`);
      }
    }

    // Apply theme
    onAuthStateChanged(auth, async (user) => {
      let userThemePreference = null;
      if (user) {
        const userProfile = await getUserProfileFromFirestore(user.uid);
        userThemePreference = userProfile?.themePreference;
      }
      const allThemes = await getAvailableThemes();
      const themeToApply =
        allThemes.find((t) => t.id === userThemePreference) ||
        allThemes.find((t) => t.id === DEFAULT_THEME_NAME);
      applyTheme(themeToApply.id, themeToApply);
    });

    // Run custom initialization
    if (customInit && typeof customInit === "function") {
      await customInit();
    }

    console.log(`${pageName}: Page initialization complete.`);
  };

  if (useWindowLoad) {
    window.onload = initFunction;
  } else {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initFunction);
    } else {
      initFunction();
    }
  }
}
