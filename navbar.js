// navbar.js
// This file handles loading the navigation bar HTML and managing user authentication state
// and theme application based on user preferences.

// --- Firebase Imports ---
// Importing only necessary Firebase Authentication and Firestore modules.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Local Module Imports ---
// Directly import applyTheme and getAvailableThemes as named exports from themes.js.
// This resolves the "getAvailableThemesFunc is not a function" error.
import { applyTheme, getAvailableThemes } from './themes.js';

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
  const { auth, db, appId } = firebaseInstances;
  // Get the placeholder element where the navbar HTML will be inserted.
  const navbarPlaceholder = document.getElementById('navbar-placeholder');

  // Check if the navbar placeholder exists in the DOM.
  if (navbarPlaceholder) {
    try {
      // Fetch the navbar HTML content from 'navbar.html'.
      const response = await fetch('navbar.html');
      // Throw an error if the network response was not successful.
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      // Get the HTML content as text.
      const navbarHtml = await response.text();
      // Insert the fetched HTML into the placeholder.
      navbarPlaceholder.innerHTML = navbarHtml;

      // Get references to specific navbar elements after they have been loaded into the DOM.
      const navbarUserIcon = document.getElementById('navbar-user-profile-pic');
      const navbarUserDisplayName = document.getElementById('navbar-user-display-name');
      const navbarUserSettingsLink = document.getElementById('navbar-user-settings-link');
      const navbarSigninLink = document.getElementById('navbar-signin-link');
      const navbarSignInText = document.getElementById('navbar-signin-text');

      // Check if Firebase Auth is provided and initialized.
      if (auth) {
        // Set up a listener for Firebase Authentication state changes.
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            // User is signed in. Update UI elements for a logged-in user.
            if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'flex';
            if (navbarSigninLink) navbarSigninLink.style.display = 'none';

            // Fetch the user's custom profile data from Firestore.
            const userProfile = await getUserProfileFromFirestore(db, appId, user.uid);
            if (navbarUserDisplayName) {
              // Set the display name: prefer custom profile name, then Firebase Auth name, then default 'Settings'.
              navbarUserDisplayName.textContent = userProfile?.displayName || user.displayName || 'Settings';
            }
            if (navbarUserIcon) {
              // Set the profile picture: prefer custom profile photo, then Firebase Auth photo, then default placeholder.
              navbarUserIcon.src = userProfile?.photoURL || user.photoURL || defaultProfilePic;
            }

            // Apply the user's saved theme preference.
            const userThemePreference = userProfile?.themePreference;
            // Call the directly imported getAvailableThemes function.
            const allThemes = await getAvailableThemes();
            // Determine which theme to apply: user's preference or the default.
            const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === defaultThemeName);
            // Call the directly imported applyTheme function.
            applyTheme(themeToApply.id, themeToApply);

          } else {
            // User is signed out. Update UI elements for a logged-out user.
            if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
            if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
            if (navbarSignInText) navbarSignInText.textContent = 'Sign In'; // Ensure the text displays "Sign In".
            // Apply the default theme when no user is signed in.
            applyTheme(defaultThemeName);
          }
        });
      } else {
        // Log a warning if Firebase Auth is not available (e.g., during testing without full Firebase setup).
        console.warn("Firebase Auth not provided to loadNavbar. Dynamic navbar features disabled.");
        // Ensure sign-in link is shown and other links are hidden if auth is not available.
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
        if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
        // Apply the default theme.
        applyTheme(defaultThemeName);
      }

    } catch (error) {
      // Log any errors that occur during the loading or setup of the navigation bar.
      console.error("Failed to load navigation bar:", error);
    }
  }
}

/**
 * Fetches a user's profile data from the 'user_profiles' collection in Firestore.
 * This is a helper function used internally by navbar.js to retrieve custom user data.
 *
 * @param {Firestore} dbInstance - The initialized Firestore instance.
 * @param {string} appIdValue - The application ID used for constructing Firestore paths.
 * @param {string} uid - The User ID (UID) of the profile to fetch.
 * @returns {Promise<Object|null>} A Promise that resolves with the user's profile data object,
 * or `null` if the profile is not found or an error occurs.
 */
async function getUserProfileFromFirestore(dbInstance, appIdValue, uid) {
  if (!dbInstance) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore in navbar.js.");
    return null;
  }
  // Create a document reference to the user's profile.
  const userDocRef = doc(dbInstance, `artifacts/${appIdValue}/public/data/user_profiles`, uid);
  try {
    // Attempt to get the document snapshot.
    const docSnap = await getDoc(userDocRef);
    // If the document exists, return its data.
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    // Log any errors during the Firestore fetch operation.
    console.error("Error fetching user profile from Firestore in navbar.js:", error);
  }
  // Return null if the document does not exist or an error occurred.
  return null;
}
