// navbar.js
// This file handles loading the navigation bar HTML and managing user authentication state
// and theme application based on user preferences.

// --- Firebase Imports ---
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- Local Module Imports --
// Import applyTheme and getAvailableThemes from themes.js
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js';
// Import shared Firebase instances and utilities from firebase-init.js
import { db, appId, auth, getUserProfileFromFirestore, firebaseReadyPromise, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME } from './firebase-init.js';

/**
 * Loads the navigation bar HTML into the 'navbar-placeholder' element
 * and sets up its dynamic behavior based on user authentication status.
 * It also applies the user's theme preference.
 * @param {object} firebaseInstances - Object containing auth, db, appId.
 * @param {string} defaultProfilePic - Default profile picture URL.
 * @param {string} defaultThemeName - Default theme ID.
 */
export async function loadNavbar(firebaseInstances, defaultProfilePic, defaultThemeName) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');

  if (navbarPlaceholder) {
    try {
      const response = await fetch('navbar.html'); // Assuming navbar.html exists at root
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const navbarHtml = await response.text();
      navbarPlaceholder.innerHTML = navbarHtml;

      const navbarUserIcon = document.getElementById('navbar-user-profile-pic');
      const navbarUserDisplayName = document.getElementById('navbar-user-display-name');
      const navbarUserSettingsLink = document.getElementById('navbar-user-settings-link');
      const navbarSigninLink = document.getElementById('navbar-signin-link');
      const navbarUserIdDisplay = document.getElementById('navbar-user-id-display');

      // Ensure Firebase is ready before setting up auth state listener and themes
      await firebaseReadyPromise;

      // Pass the centralized Firebase instances to themes.js setup function
      if (firebaseInstances.db && firebaseInstances.auth && firebaseInstances.appId) {
        setupThemesFirebase(firebaseInstances.db, firebaseInstances.auth, firebaseInstances.appId);
      } else {
        console.warn("Firebase instances not fully available in loadNavbar for theme setup.");
      }

      // Listen for auth state changes to update the navbar UI
      onAuthStateChanged(firebaseInstances.auth, async (user) => {
        if (user) {
          // User is signed in
          if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'flex';
          if (navbarSigninLink) navbarSigninLink.style.display = 'none';

          const userProfile = await getUserProfileFromFirestore(user.uid);

          const displayName = userProfile?.displayName || user.displayName || 'Settings';
          const photoURL = userProfile?.photoURL || user.photoURL || defaultProfilePic;
          const userId = user.uid; // Always display full UID

          if (navbarUserDisplayName) navbarUserDisplayName.textContent = displayName;
          if (navbarUserIcon) navbarUserIcon.src = photoURL;
          if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = `UID: ${userId}`;

          // Apply user's theme preference
          let userThemePreference = userProfile?.themePreference;
          const allThemes = await getAvailableThemes(); // Correct function call
          const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === defaultThemeName);
          if (themeToApply) {
            applyTheme(themeToApply.id, themeToApply);
          } else {
            console.warn(`Default theme '${defaultThemeName}' not found.`);
            // Fallback for extreme cases where no themes are found
            document.documentElement.style.setProperty('--color-body-bg', '#1F2937'); // Dark fallback
            document.documentElement.style.setProperty('--color-text-primary', '#E5E7EB');
          }

        } else {
          // User is signed out
          if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
          if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
          if (navbarUserIcon) navbarUserIcon.src = defaultProfilePic;
          if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Sign In';
          if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = ''; // Clear UID for guests

          // Apply default theme if no user is logged in or if user has no preference
          try {
            const allThemes = await getAvailableThemes(); // Correct function call
            const defaultThemeObj = allThemes.find(t => t.id === defaultThemeName);
            if (defaultThemeObj) {
              applyTheme(defaultThemeObj.id, defaultThemeObj);
            } else {
              console.warn(`Default theme '${defaultThemeName}' not found for unauthenticated user.`);
              // Fallback to hardcoded dark theme if default not found
              document.documentElement.style.setProperty('--color-body-bg', '#1F2937');
              document.documentElement.style.setProperty('--color-text-primary', '#E5E7EB');
            }
          } catch (themeError) {
            console.error("Error applying default theme after firebaseReadyPromise:", themeError);
            // Fallback for extreme cases where theme application fails
            document.documentElement.style.setProperty('--color-body-bg', '#1F2937'); // Dark fallback
            document.documentElement.style.setProperty('--color-text-primary', '#E5E7EB');
          }
        }
      });
    } catch (error) {
      console.error("Failed to load navigation bar:", error);
      // Fallback UI if fetching/parsing navbar.html fails
      const manualNavbar = `
        <nav class="navbar-bg p-4 shadow-lg w-full">
          <div class="container mx-auto flex justify-between items-center">
            <a href="index.html" class="text-gray-50 text-2xl font-bold">Arcator.co.uk</a>
            <div>
              <a href="sign.html" class="text-gray-300 hover:text-gray-50 px-3 py-2 rounded-md text-lg font-medium">Sign In / Account</a>
            </div>
          </div>
        </nav>
      `;
      if (navbarPlaceholder) navbarPlaceholder.innerHTML = manualNavbar;
    }
  }
}
