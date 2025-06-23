// navbar.js
// This file handles loading the navigation bar HTML and managing user authentication state
// and theme application based on user preferences.

// --- Firebase Imports ---
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- Local Module Imports --
// Import applyTheme and getAvailableThemes from themes.js
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js';
// Import shared Firebase instances and utilities from firebase-init.js
import { db, appId, auth, getCurrentUser, getUserProfileFromFirestore, firebaseReadyPromise, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, setupFirebaseAndUser } from './firebase-init.js'; // Import setupFirebaseAndUser

/**
 * Loads the navigation bar HTML into the 'navbar-placeholder' element
 * and sets up its dynamic behavior based on user authentication status.
 * It also applies the user's theme preference.
 */
export async function loadNavbar() {
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
      const navbarSignInText = document.getElementById('navbar-signin-text');
      const navbarUserIdDisplay = document.getElementById('navbar-user-id');

      // Ensure Firebase is initialized and ready
      await setupFirebaseAndUser(); // Call and await the exported function
      await firebaseReadyPromise;

      // Now auth, db, appId should be fully initialized and available
      if (auth && db && appId) {
        // Initialize themes Firebase integration (required for getAvailableThemes within onAuthStateChanged)
        setupThemesFirebase(db, auth, appId);

        onAuthStateChanged(auth, async (user) => {
          if (user) {
            // User is signed in
            if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'flex';
            if (navbarSigninLink) navbarSigninLink.style.display = 'none';

            // Get user profile from Firestore (which uses the now ready 'db' instance)
            const userProfile = await getUserProfileFromFirestore(user.uid);
            const currentUser = getCurrentUser(); // Get the enriched user object from firebase-init

            if (navbarUserDisplayName) {
              // Prefer userProfile displayName, then auth.currentUser.displayName, then email, then UID
              navbarUserDisplayName.textContent = userProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Settings';
            }
            if (navbarUserIcon) {
              navbarUserIcon.src = userProfile?.photoURL || user.photoURL || DEFAULT_PROFILE_PIC;
            }
            if (navbarUserIdDisplay) {
              navbarUserIdDisplay.textContent = `UID: ${user.uid}`;
              if (userProfile?.handle) { // Use handle from userProfile if available
                navbarUserIdDisplay.textContent += ` (@${userProfile.handle})`;
              }
            }

            const userThemePreference = userProfile?.themePreference;
            const allThemes = await getAvailableThemes(); // This call should now work correctly as firebaseReadyPromise is awaited
            const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
            applyTheme(themeToApply.id, themeToApply);
            // console.log(`DEBUG: Navbar applied user theme: ${themeToApply.name}`);

          } else {
            // No user signed in
            if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
            if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
            if (navbarSignInText) navbarSignInText.textContent = 'Sign In';
            if (navbarUserIcon) navbarUserIcon.src = DEFAULT_PROFILE_PIC;
            if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Guest';
            if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = 'UID: Guest User';

            // Attempt to apply default theme
            try {
              const allThemes = await getAvailableThemes(); // This now happens *after* firebaseReadyPromise, so it's safer
              const defaultThemeObj = allThemes.find(t => t.id === DEFAULT_THEME_NAME);
              applyTheme(defaultThemeObj.id, defaultThemeObj);
            } catch (themeError) {
              console.error("Error applying default theme after firebaseReadyPromise:", themeError);
              // Fallback for extreme cases where theme application fails
              document.documentElement.style.setProperty('--color-body-bg', '#1F2937'); // Dark fallback
              document.documentElement.style.setProperty('--color-text-primary', '#E5E7EB');
            }
          }
        });
      } else {
        console.warn("Firebase Auth or DB not available even after waiting for firebaseReadyPromise. Dynamic navbar features disabled.");
        // Fallback UI if Firebase instances are still not available
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
        if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
        if (navbarUserIcon) navbarUserIcon.src = DEFAULT_PROFILE_PIC;
        if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Guest';
        if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = 'UID: Not available';
        // Apply a very basic theme as a last resort
        document.documentElement.style.setProperty('--color-body-bg', '#1F2937');
        document.documentElement.style.setProperty('--color-text-primary', '#E5E7EB');
      }

    } catch (error) {
      console.error("Failed to load navigation bar:", error);
    }
  }
}
