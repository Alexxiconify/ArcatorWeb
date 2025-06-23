// navbar.js
// This file handles loading the navigation bar HTML and managing user authentication state
// and theme application based on user preferences.

// --- Firebase Imports ---
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- Local Module Imports ---
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js'; // Import setupThemesFirebase
import { db, appId, auth, getCurrentUser, getUserProfileFromFirestore } from './firebase-init.js'; // Import shared Firebase instances and utility

/**
 * Loads the navigation bar HTML into the 'navbar-placeholder' element
 * and sets up its dynamic behavior based on user authentication status.
 * It also applies the user's theme preference.
 *
 * @param {object} firebaseInstances - An object containing initialized Firebase instances (auth, db, appId).
 * @param {string} defaultProfilePic - The default URL for a user's profile picture if none is set.
 * @param {string} defaultThemeName - The ID of the default theme to apply.
 */
export async function loadNavbar(firebaseInstances, defaultProfilePic, defaultThemeName) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');

  if (navbarPlaceholder) {
    try {
      const response = await fetch('navbar.html');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const navbarHtml = await response.text();
      navbarPlaceholder.innerHTML = navbarHtml;

      const navbarUserIcon = document.getElementById('navbar-user-profile-pic');
      const navbarUserDisplayName = document.getElementById('navbar-user-display-name');
      const navbarUserSettingsLink = document.getElementById('navbar-user-settings-link');
      const navbarSigninLink = document.getElementById('navbar-signin-link');
      const navbarSignInText = document.getElementById('navbar-signin-text');
      const navbarUserIdDisplay = document.getElementById('navbar-user-id');

      if (auth && db && appId) { // Ensure Firebase instances are available
        // IMPORTANT: Initialize themes.js with Firebase instances here
        setupThemesFirebase(db, auth, appId);

        onAuthStateChanged(auth, async (user) => {
          if (user) {
            if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'flex';
            if (navbarSigninLink) navbarSigninLink.style.display = 'none';

            const userProfile = await getUserProfileFromFirestore(user.uid);
            const currentUser = getCurrentUser();

            if (navbarUserDisplayName) {
              navbarUserDisplayName.textContent = currentUser?.displayName || userProfile?.displayName || user.displayName || 'Settings';
            }
            if (navbarUserIcon) {
              navbarUserIcon.src = currentUser?.photoURL || userProfile?.photoURL || user.photoURL || defaultProfilePic;
            }
            if (navbarUserIdDisplay) {
              navbarUserIdDisplay.textContent = `UID: ${currentUser?.uid || user.uid}`;
              if (currentUser?.handle) {
                navbarUserIdDisplay.textContent += ` (@${currentUser.handle})`;
              }
            }

            const userThemePreference = userProfile?.themePreference;
            const allThemes = await getAvailableThemes();
            const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === defaultThemeName);
            applyTheme(themeToApply.id, themeToApply);
            console.log(`DEBUG: Navbar applied user theme: ${themeToApply.name}`);

          } else {
            if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
            if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
            if (navbarSignInText) navbarSignInText.textContent = 'Sign In';
            if (navbarUserIcon) navbarUserIcon.src = defaultProfilePic;
            if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Guest';
            if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = 'UID: Guest User';

            applyTheme(defaultThemeName);
            console.log(`DEBUG: Navbar applied default theme: ${defaultThemeName}`);
          }
        });
      } else {
        console.warn("Firebase Auth or DB not available. Dynamic navbar features disabled.");
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
        if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
        if (navbarUserIcon) navbarUserIcon.src = defaultProfilePic;
        if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Guest';
        if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = 'UID: Not available';
        applyTheme(defaultThemeName);
      }

    } catch (error) {
      console.error("Failed to load navigation bar:", error);
    }
  }
}
