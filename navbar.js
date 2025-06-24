// navbar.js
// This file handles loading the navigation bar HTML and rendering it
// based on the provided user authentication state and default theme.

// --- Local Module Imports --
// Import applyTheme and getAvailableThemes from themes.js
import { applyTheme, getAvailableThemes } from './themes.js';
// Import shared Firebase instances and utilities from firebase-init.js
// It's crucial to import auth, db, firebaseReadyPromise, etc., to ensure they are available
import { auth, db, appId, getUserProfileFromFirestore, firebaseReadyPromise, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME } from './firebase-init.js';

/**
 * Loads the navigation bar HTML into the 'navbar-placeholder' element
 * and updates its dynamic behavior based on the provided user object.
 * This function no longer contains an onAuthStateChanged listener or
 * internal firebaseReadyPromise await. It assumes the caller (e.g., page script)
 * has already handled Firebase initialization and auth state resolution.
 * @param {object|null} user - The current Firebase User object, or null if logged out.
 * @param {string} defaultProfilePic - Default profile picture URL.
 * @param {string} defaultThemeName - Default theme ID.
 */
export async function loadNavbar(user, defaultProfilePic, defaultThemeName) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');
  console.log("DEBUG: loadNavbar function called.");

  if (navbarPlaceholder) {
    console.log("DEBUG: 'navbar-placeholder' element found.");
    try {
      // Hardcoded Navbar HTML (as per previous instructions to embed for debugging)
      const navbarHtml = `
        <nav class="navbar-bg p-4 shadow-lg w-full fixed top-0 left-0 z-50 rounded-b-lg">
          <div class="container mx-auto flex justify-between items-center">
            <a href="index.html" class="navbar-text text-2xl font-bold flex items-center gap-2">
              <svg class="h-6 w-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1v-3m0 0l-1-1h-4l-1 1m0 0h-4a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H9.75z"></path>
              </svg>
              Arcator.co.uk
            </a>
            <div class="flex items-center space-x-4">
                <a href="about.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">About Us</a>
                <a href="servers.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Servers</a>
                <a href="community.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Community</a>
                <a href="interests.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Interests</a>
                <a href="games.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Games</a>
                <a href="https://wiki.arcator.co.uk/" target="_blank" rel="noopener noreferrer" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Wiki</a>
                <a href="forms.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Forms</a>
                <a href="index.html#join-us" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Join Us</a>
                <a href="donations.html" class="text-gray-300 hover:text-gray-50 transition duration-300 ease-in-out text-lg font-medium rounded-md p-2 hover:bg-gray-800">Support Us</a>
              <a id="navbar-user-settings-link" href="settings.html" class="hidden items-center space-x-2 navbar-text navbar-link px-3 py-2 rounded-md font-medium">
                <img id="navbar-user-profile-pic" class="profile-pic-small" src="${defaultProfilePic}" alt="Profile Picture">
                <span id="navbar-user-display-name">Settings</span>
                <span id="navbar-user-id-display" class="text-xs text-gray-400 ml-1"></span>
              </a>
              <a id="navbar-signin-link" href="sign.html" class="flex items-center space-x-2 navbar-text navbar-link px-3 py-2 rounded-md font-medium">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                <span>Sign In</span>
              </a>
            </div>
          </div>
        </nav>
      `;
      navbarPlaceholder.innerHTML = navbarHtml;
      console.log("DEBUG: 'navbar.html' content injected successfully.");

      // Get references to dynamic elements AFTER injecting HTML
      const navbarUserIcon = document.getElementById('navbar-user-profile-pic');
      const navbarUserDisplayName = document.getElementById('navbar-user-display-name');
      const navbarUserSettingsLink = document.getElementById('navbar-user-settings-link');
      const navbarSigninLink = document.getElementById('navbar-signin-link');
      const navbarUserIdDisplay = document.getElementById('navbar-user-id-display');

      // Update UI based on the provided user object
      if (user) {
        // User is signed in
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'flex';
        if (navbarSigninLink) navbarSigninLink.style.display = 'none';

        // Fetch user profile from Firestore to get display name and photo URL
        const userProfile = await getUserProfileFromFirestore(user.uid);
        const displayName = userProfile?.displayName || user.displayName || 'Settings';
        const photoURL = userProfile?.photoURL || user.photoURL || defaultProfilePic;
        const userId = user.uid;

        if (navbarUserDisplayName) navbarUserDisplayName.textContent = displayName;
        if (navbarUserIcon) navbarUserIcon.src = photoURL;
        if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = `UID: ${userId.substring(0, 8)}...`; // Display a truncated UID
        console.log("DEBUG: Navbar UI updated for logged-in user.");

      } else {
        // User is signed out
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
        if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
        if (navbarUserIcon) navbarUserIcon.src = defaultProfilePic;
        if (navbarUserDisplayName) navbarUserDisplayName.textContent = 'Sign In';
        if (navbarUserIdDisplay) navbarUserIdDisplay.textContent = ''; // Clear UID for guests
        console.log("DEBUG: Navbar UI updated for logged-out user.");
      }
    } catch (error) {
      console.error("ERROR: Failed to load navigation bar:", error);
      // Fallback UI if fetching/parsing navbar.html fails or other errors
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
