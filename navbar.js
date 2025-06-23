// navbar.js
// This file handles loading the navigation bar HTML and managing user authentication state
// and theme application based on user preferences.

// --- Firebase Imports ---
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// No direct Firestore imports needed here, as getUserProfileFromFirestore is now in utils.js

// --- Local Module Imports ---
import { applyTheme, getAvailableThemes } from './themes.js';
import { db, appId, auth, getCurrentUser } from './firebase-init.js'; // Import shared Firebase instances
import { getUserProfileFromFirestore } from './utils.js'; // Import utility function

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
  // Destructure Firebase instances for easier access.
  // Note: We are now using the globally exported `auth`, `db`, `appId` from `firebase-init.js`
  // so `firebaseInstances` parameter is largely for consistency or if this function is called before global exports are ready.
  // We'll primarily rely on the imported globals here.
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
      const navbarUserIdDisplay = document.getElementById('navbar-user-id'); // Assuming this exists now for userId display

      if (auth) {
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'flex';
            if (navbarSigninLink) navbarSigninLink.style.display = 'none';

            // Get the user profile from the shared utility function
            const userProfile = await getUserProfileFromFirestore(user.uid);
            const currentUser = getCurrentUser(); // Get the enriched user object

            if (navbarUserDisplayName) {
              navbarUserDisplayName.textContent = currentUser?.displayName || userProfile?.displayName || user.displayName || 'Settings';
            }
            if (navbarUserIcon) {
              navbarUserIcon.src = currentUser?.photoURL || userProfile?.photoURL || user.photoURL || defaultProfilePic;
            }
            if (navbarUserIdDisplay) {
              // Show the full UID for authenticated users, or 'Guest' for anonymous
              navbarUserIdDisplay.textContent = `UID: ${currentUser?.uid || user.uid}`;
              if (currentUser?.handle) {
                navbarUserIdDisplay.textContent += ` (@${currentUser.handle})`;
              }
            }


            const userThemePreference = userProfile?.themePreference;
            const allThemes = await getAvailableThemes();
            const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === defaultThemeName);
            applyTheme(themeToApply.id, themeToApply);

          } else {
            if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
            if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
            if (navbarSignInText) navbarSignInText.textContent = 'Sign In';
            if (navbarUserIcon) navbarUserIcon.src = defaultProfilePic; // Reset to default
            if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Guest'; // Display 'Guest' for anonymous
            if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = 'UID: Guest User'; // Display for anonymous
            applyTheme(defaultThemeName);
          }
        });
      } else {
        console.warn("Firebase Auth not available. Dynamic navbar features disabled.");
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
        if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
        if (navbarUserIcon) navbarUserIcon.src = defaultProfilePic; // Fallback
        if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Guest';
        if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = 'UID: Not available';
        applyTheme(defaultThemeName);
      }

    } catch (error) {
      console.error("Failed to load navigation bar:", error);
    }
  }
}
