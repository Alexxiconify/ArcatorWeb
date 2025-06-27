// navbar.js - Handles loading the navigation bar HTML and rendering it dynamically.

import { auth, db, appId, getUserProfileFromFirestore, firebaseReadyPromise, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, onAuthStateChanged, currentUser } from './firebase-init.js';
import { applyTheme, getAvailableThemes } from './themes.js';


/**
 * Loads the navigation bar HTML into the 'navbar-placeholder' element
 * and updates its dynamic behavior based on the current user's authentication state and profile.
 * This function assumes Firebase is already initialized via firebase-init.js.
 * @param {Object|null} authUser - The current Firebase User object or null if logged out.
 * @param {Object|null} userProfile - The custom userProfile object (from Firestore).
 * @param {string} defaultProfilePic - Default profile picture URL.
 * @param {string} defaultThemeName - Default theme ID.
 */
export async function loadNavbar(authUser, userProfile, defaultProfilePic, defaultThemeName) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');
  console.log("DEBUG: loadNavbar function called.");

  if (navbarPlaceholder) {
    console.log("DEBUG: 'navbar-placeholder' element found.");
    try {
      const response = await fetch('navbar.html');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const navbarHtml = await response.text();
      navbarPlaceholder.innerHTML = navbarHtml;

      // Get dynamic elements from the loaded navbar
      const userSettingsLink = document.getElementById('navbar-user-settings-link');
      const userProfilePic = document.getElementById('navbar-user-profile-pic');
      const userDisplayName = document.getElementById('navbar-user-display-name');
      const signinLink = document.getElementById('navbar-signin-link');
      const signoutButton = document.getElementById('navbar-signout-btn'); // Get the sign-out button

      // Check if user is logged in
      if (authUser && userProfile) { // Check both authUser and the enriched userProfile
        if (userSettingsLink) userSettingsLink.classList.remove('hidden');
        if (signinLink) signinLink.classList.add('hidden');
        // Validate photoURL before using
        let safePhotoURL = userProfile.photoURL;
        if (!safePhotoURL || typeof safePhotoURL !== 'string' || !/^https?:\/\//.test(safePhotoURL)) {
          safePhotoURL = defaultProfilePic;
        }
        if (userProfilePic) userProfilePic.src = safePhotoURL;
      } else {
        if (userSettingsLink) userSettingsLink.classList.add('hidden');
        if (signinLink) signinLink.classList.remove('hidden');
      }

      console.log("DEBUG: Navbar content injected and UI updated based on auth state.");

      // Add event listener for sign out button
      if (signoutButton) {
        signoutButton.addEventListener('click', async () => {
          try {
            await auth.signOut();
            console.log("DEBUG: User signed out from navbar.");
            // Redirect to index.html after logout
            window.location.href = 'index.html'; // Changed redirection to index.html
          } catch (error) {
            console.error("Error signing out:", error);
          }
        });
      }

    } catch (error) {
      console.error("ERROR: Failed to load navigation bar:", error);
      // Fallback UI if fetching/parsing fails or other errors
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
      console.log("DEBUG: Fallback navbar rendered due to error.");
    }
  } else {
    console.error("ERROR: Element with ID 'navbar-placeholder' not found.");
  }
}

// Attach loadNavbar to run after Firebase is ready and auth state changes
// This ensures that the navbar updates dynamically with user login/logout.
firebaseReadyPromise.then(() => {
  onAuthStateChanged(auth, async (user) => {
    // onAuthStateChanged provides the raw Firebase user object.
    // We need to pass the enriched currentUser from firebase-init.js for profile details.
    await loadNavbar(user, currentUser, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

    // Apply the user's theme immediately after authentication state is determined and navbar is loaded
    let userThemePreference = DEFAULT_THEME_NAME;
    if (currentUser && currentUser.themePreference) {
      userThemePreference = currentUser.themePreference;
    }
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    applyTheme(themeToApply.id, themeToApply);
  });
});
