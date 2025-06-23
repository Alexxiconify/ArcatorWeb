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
  console.log("DEBUG: loadNavbar function called.");

  if (navbarPlaceholder) {
    console.log("DEBUG: 'navbar-placeholder' element found.");
    try {
      console.log("DEBUG: Attempting to fetch 'navbar.html'...");
      const response = await fetch('navbar.html'); // Assuming navbar.html exists at root
      if (!response.ok) {
        console.error(`ERROR: Failed to fetch navbar.html. HTTP error! status: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const navbarHtml = await response.text();
      navbarPlaceholder.innerHTML = navbarHtml;
      console.log("DEBUG: 'navbar.html' fetched and injected successfully.");

      const navbarUserIcon = document.getElementById('navbar-user-profile-pic');
      const navbarUserDisplayName = document.getElementById('navbar-user-display-name');
      const navbarUserSettingsLink = document.getElementById('navbar-user-settings-link');
      const navbarSigninLink = document.getElementById('navbar-signin-link');
      const navbarUserIdDisplay = document.getElementById('navbar-user-id-display');

      // Ensure Firebase is ready before setting up auth state listener and themes
      await firebaseReadyPromise;
      console.log("DEBUG: Firebase ready promise resolved in navbar.js.");

      // Note: setupThemesFirebase is typically called once in a main entry point (e.g., settings.js).
      // Redundant calls here are fine but not strictly necessary if already called globally.
      // This ensures themes.js has access to Firebase instances.
      if (firebaseInstances.db && firebaseInstances.auth && firebaseInstances.appId) {
        setupThemesFirebase(firebaseInstances.db, firebaseInstances.auth, firebaseInstances.appId);
        console.log("DEBUG: setupThemesFirebase called from navbar.js.");
      } else {
        console.warn("Firebase instances not fully available in loadNavbar for theme setup.");
      }

      // Listen for auth state changes to update the navbar UI
      onAuthStateChanged(firebaseInstances.auth, async (user) => {
        console.log("DEBUG: onAuthStateChanged triggered in navbar.js. User:", user ? user.uid : "null");
        if (user) {
          // User is signed in
          if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'flex';
          if (navbarSigninLink) navbarSigninLink.style.display = 'none';

          const userProfile = await getUserProfileFromFirestore(user.uid);
          console.log("DEBUG: User profile fetched in navbar.js:", userProfile);

          const displayName = userProfile?.displayName || user.displayName || 'Settings';
          const photoURL = userProfile?.photoURL || user.photoURL || defaultProfilePic;
          const userId = user.uid; // Always display full UID

          if (navbarUserDisplayName) navbarUserDisplayName.textContent = displayName;
          if (navbarUserIcon) navbarUserIcon.src = photoURL;
          if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = `UID: ${userId}`;
          console.log("DEBUG: Navbar UI updated for logged-in user.");

          // Apply user's theme preference.
          // applyTheme handles finding the theme and its own fallbacks.
          let userThemePreference = userProfile?.themePreference || defaultThemeName;
          console.log("DEBUG: Applying user theme preference:", userThemePreference);
          await applyTheme(userThemePreference); // Rely on applyTheme's internal fallback logic

        } else {
          // User is signed out
          if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
          if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
          if (navbarUserIcon) navbarUserIcon.src = defaultProfilePic;
          if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Sign In';
          if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = ''; // Clear UID for guests
          console.log("DEBUG: Navbar UI updated for logged-out user.");

          // Apply default theme if no user is logged in
          console.log("DEBUG: Applying default theme for logged-out user:", defaultThemeName);
          await applyTheme(defaultThemeName); // Rely on applyTheme's internal fallback logic
        }
      });
    } catch (error) {
      console.error("ERROR: Failed to load navigation bar:", error);
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
      console.log("DEBUG: Fallback manual navbar injected due to error.");
    }
  } else {
    console.error("ERROR: 'navbar-placeholder' element not found in the HTML. Cannot load navbar.");
  }
}
