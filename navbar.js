// navbar.js - Clean, modern navbar functionality

import { auth, db, appId, getUserProfileFromFirestore, firebaseReadyPromise, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, onAuthStateChanged, currentUser } from './firebase-init.js';
import { applyTheme, getAvailableThemes } from './themes.js';

/**
 * Loads and renders the navigation bar
 * @param {Object|null} authUser - Firebase User object or null
 * @param {Object|null} userProfile - Enriched user profile from Firestore
 * @param {string} defaultProfilePic - Default profile picture URL
 * @param {string} defaultThemeName - Default theme name
 */
export async function loadNavbar(authUser, userProfile, defaultProfilePic, defaultThemeName) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');

  if (!navbarPlaceholder) {
    console.error('Navbar placeholder element not found');
    return;
  }

  try {
    // Load navbar HTML
    const response = await fetch('navbar.html');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const navbarHtml = await response.text();
    navbarPlaceholder.innerHTML = navbarHtml;

    // Update navbar state based on authentication
    updateNavbarState(authUser, userProfile, defaultProfilePic);

    console.log('Navbar loaded successfully');

  } catch (error) {
    console.error('Failed to load navbar:', error);
    renderFallbackNavbar(navbarPlaceholder);
  }
}

/**
 * Updates navbar UI based on user authentication state
 * @param {Object|null} authUser - Firebase User object
 * @param {Object|null} userProfile - User profile from Firestore
 * @param {string} defaultProfilePic - Default profile picture URL
 */
function updateNavbarState(authUser, userProfile, defaultProfilePic) {
  const userSettingsLink = document.getElementById('navbar-user-settings-link');
  const userProfilePic = document.getElementById('navbar-user-profile-pic');
  const signinLink = document.getElementById('navbar-signin-link');

  if (authUser && userProfile) {
    // User is logged in
    if (userSettingsLink) {
      userSettingsLink.classList.remove('hidden');
    }
    if (signinLink) {
      signinLink.classList.add('hidden');
    }

    // Update profile picture
    if (userProfilePic) {
      const safePhotoURL = validatePhotoURL(userProfile.photoURL, defaultProfilePic);
      userProfilePic.src = safePhotoURL;
      userProfilePic.alt = userProfile.displayName || 'User Profile';
    }
  } else {
    // User is not logged in
    if (userSettingsLink) {
      userSettingsLink.classList.add('hidden');
    }
    if (signinLink) {
      signinLink.classList.remove('hidden');
    }
  }
}

/**
 * Validates and sanitizes profile picture URL
 * @param {string} photoURL - User's photo URL
 * @param {string} defaultPic - Default profile picture URL
 * @returns {string} Safe photo URL
 */
function validatePhotoURL(photoURL, defaultPic) {
  if (!photoURL || typeof photoURL !== 'string') {
    return defaultPic;
  }

  // Basic URL validation
  try {
    const url = new URL(photoURL);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return defaultPic;
    }
    return photoURL;
  } catch {
    return defaultPic;
  }
}

/**
 * Renders fallback navbar when loading fails
 * @param {HTMLElement} container - Container element
 */
function renderFallbackNavbar(container) {
  const fallbackNavbar = `
    <nav class="navbar-bg">
      <div class="navbar-container">
        <a href="index.html" class="navbar-logo">
          <span>Arcator.co.uk</span>
        </a>
        <div class="navbar-links">
          <a href="users.html" class="navbar-link">
            <span>Sign In</span>
          </a>
        </div>
      </div>
    </nav>
  `;

  container.innerHTML = fallbackNavbar;
  console.log('Fallback navbar rendered');
}

/**
 * Applies user theme after navbar is loaded
 * @param {string} userThemePreference - User's theme preference
 * @param {string} defaultThemeName - Default theme name
 */
async function applyUserTheme(userThemePreference, defaultThemeName) {
  try {
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) ||
      allThemes.find(t => t.id === defaultThemeName);

    if (themeToApply) {
      applyTheme(themeToApply.id, themeToApply);
    }
  } catch (error) {
    console.error('Failed to apply user theme:', error);
  }
}

// Initialize navbar when Firebase is ready
firebaseReadyPromise.then(() => {
  onAuthStateChanged(auth, async (user) => {
    // Load navbar with current user state
    await loadNavbar(user, currentUser, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

    // Apply user theme
    const userThemePreference = currentUser?.themePreference || DEFAULT_THEME_NAME;
    await applyUserTheme(userThemePreference, DEFAULT_THEME_NAME);
  });
});
