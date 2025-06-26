// navbar.js - Handles loading the navigation bar HTML and rendering it dynamically.

import { auth, db, appId, getUserProfileFromFirestore, firebaseReadyPromise, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME } from './firebase-init.js';

/**
 * Loads the navigation bar HTML into the 'navbar-placeholder' element
 * and updates its dynamic behavior based on the current user's authentication state and profile.
 * This function assumes Firebase is already initialized via firebase-init.js.
 * @param {Object|null} user - The current Firebase User object or the custom userProfile object, or null if logged out.
 * @param {string} defaultProfilePic - Default profile picture URL.
 * @param {string} defaultThemeName - Default theme ID.
 */
export async function loadNavbar(user, defaultProfilePic, defaultThemeName) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');
  console.log("DEBUG: loadNavbar function called.");

  if (navbarPlaceholder) {
    console.log("DEBUG: 'navbar-placeholder' element found.");
    try {
      // Fetch the full user profile if a basic Firebase User object is provided,
      // as it might not contain all custom fields like 'handle'.
      let userProfile = null;
      if (user && user.uid) { // Check for uid to confirm it's a valid user object
        userProfile = await getUserProfileFromFirestore(user.uid);
      }

      // Use the profile data for display, falling back to basic user info or defaults
      const displayUserName = userProfile?.displayName || user?.displayName || 'Sign In';
      const userHandleDisplay = userProfile?.handle ? `@${userProfile.handle}` : (user?.uid ? user.uid.substring(0, 6) : '');
      const userPhotoURL = userProfile?.photoURL || user?.photoURL || defaultProfilePic;
      const isLoggedIn = user && !user.isAnonymous;

      const navbarHtml = `
        <nav class="navbar-bg p-4 shadow-lg w-full">
          <div class="container mx-auto flex justify-between items-center">
            <a href="index.html" class="text-gray-50 text-2xl font-bold">Arcator.co.uk</a>
            <div class="flex items-center space-x-4">
              <a href="user.html" id="navbar-user-settings-link" class="flex items-center text-gray-300 hover:text-gray-50 px-3 py-2 rounded-md text-lg font-medium" style="display: ${isLoggedIn ? 'flex' : 'none'};">
                <img id="navbar-user-icon" src="${userPhotoURL}" alt="User Icon" class="w-8 h-8 rounded-full mr-2 object-cover">
                <span id="navbar-user-display-name">${displayUserName}</span>
                <span id="navbar-user-id-display" class="text-xs text-gray-500 ml-2">${userHandleDisplay}</span>
              </a>
              <a href="user.html" id="navbar-signin-link" class="text-gray-300 hover:text-gray-50 px-3 py-2 rounded-md text-lg font-medium" style="display: ${isLoggedIn ? 'none' : 'flex'};">Sign In</a>
              <button id="navbar-signout-btn" class="text-gray-300 hover:text-gray-50 px-3 py-2 rounded-md text-lg font-medium" style="display: ${isLoggedIn ? 'flex' : 'none'};">Sign Out</button>
            </div>
          </div>
        </nav>
      `;
      navbarPlaceholder.innerHTML = navbarHtml;
      console.log("DEBUG: Navbar content injected and UI updated based on auth state.");

      // Add event listener for sign out button
      const signoutButton = document.getElementById('navbar-signout-btn');
      if (signoutButton) {
        signoutButton.addEventListener('click', async () => {
          try {
            await auth.signOut();
            console.log("DEBUG: User signed out from navbar.");
            window.location.href = 'user.html'; // Redirect to user.html to show sign-in form
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
              <a href="user.html" class="text-gray-300 hover:text-gray-50 px-3 py-2 rounded-md text-lg font-medium">Sign In / Account</a>
            </div>
          </div>
        </nav>
      `;
      if (navbarPlaceholder) navbarPlaceholder.innerHTML = manualNavbar;
      console.log("DEBUG: Fallback manual navbar injected due to error.");
    }
  } else {
    console.error("ERROR: Navbar placeholder element not found.");
  }
}
