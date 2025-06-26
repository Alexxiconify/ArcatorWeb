// navbar.js - Handles loading the navigation bar HTML and rendering it dynamically.

// Import only necessary Firebase instances and constants from firebase-init.js
// We explicitly import auth for signOut and appId for path construction.
// getUserProfileFromFirestore, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME are still needed.
import { auth, appId, getUserProfileFromFirestore, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME } from './firebase-init.js';

/**
 * Loads the navigation bar HTML into the 'navbar-placeholder' element
 * and updates its dynamic behavior based on the current user's authentication state and profile.
 * This function assumes Firebase is already initialized via firebase-init.js.
 *
 * @param {Object|null} userAuthObject - The basic Firebase User object (from onAuthStateChanged), or null if logged out.
 * @param {Object|null} userProfile - The detailed user profile object fetched from Firestore, or null if not found/logged out.
 * @param {string} defaultProfilePic - Default profile picture URL.
 * @param {string} defaultThemeName - Default theme ID.
 */
export async function loadNavbar(userAuthObject, userProfile, defaultProfilePic, defaultThemeName) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');
  console.log("DEBUG: loadNavbar function called.");

  if (navbarPlaceholder) {
    console.log("DEBUG: 'navbar-placeholder' element found.");
    try {
      // Determine display values based on the provided userProfile, falling back to userAuthObject or defaults
      const displayUserName = userProfile?.displayName || userAuthObject?.displayName || 'Sign In';
      const userHandleDisplay = userProfile?.handle ? `@${userProfile.handle}` : (userAuthObject?.uid ? userAuthObject.uid.substring(0, 6) : '');
      const userPhotoURL = userProfile?.photoURL || userAuthObject?.photoURL || defaultProfilePic;
      // Check if userAuthObject exists and is not anonymous for login state
      const isLoggedIn = userAuthObject && !userAuthObject.isAnonymous;

      const navbarHtml = `
        <nav class="navbar-bg p-4 shadow-lg w-full">
          <div class="container mx-auto flex justify-between items-center">
            <a href="index.html" class="text-gray-50 text-2xl font-bold">Arcator.co.uk</a>
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
              <!-- User Profile Link -->
              <a href="users.html" id="navbar-user-settings-link" class="flex items-center space-x-2 navbar-text navbar-link px-3 py-2 rounded-md font-medium" style="display: ${isLoggedIn ? 'flex' : 'none'};">
                <img id="navbar-user-icon" src="${userPhotoURL}" alt="User Icon" class="w-8 h-8 rounded-full mr-2 object-cover">
                <span id="navbar-user-display-name">${displayUserName}</span>
                <span id="navbar-user-id-display" class="text-xs text-gray-500 ml-2">${userHandleDisplay}</span>
              </a>
              <!-- Sign In Link -->
              <a href="users.html" id="navbar-signin-link" class="flex items-center space-x-2 navbar-text navbar-link px-3 py-2 rounded-md font-medium" style="display: ${isLoggedIn ? 'none' : 'flex'};">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                <span>Sign In</span>
              </a>
              <!-- Sign Out Button -->
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
              <a href="users.html" class="text-gray-300 hover:text-gray-50 px-3 py-2 rounded-md text-lg font-medium">Sign In / Account</a>
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
