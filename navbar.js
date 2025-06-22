// navbar.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Import applyTheme and getAvailableThemes directly as named exports from themes.js
import { applyTheme, getAvailableThemes } from './themes.js';

/**
 * Loads the navigation bar HTML and sets up its dynamic behavior based on user authentication.
 * @param {object} firebaseInstances - Object containing initialized Firebase instances (auth, db, appId)
 * @param {string} defaultProfilePic - Default URL for profile pictures
 * @param {string} defaultThemeName - Default theme name
 */
export async function loadNavbar(firebaseInstances, defaultProfilePic, defaultThemeName) {
  const { auth, db, appId } = firebaseInstances;
  const navbarPlaceholder = document.getElementById('navbar-placeholder');

  if (navbarPlaceholder) {
    try {
      const response = await fetch('navbar.html');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const navbarHtml = await response.text();
      navbarPlaceholder.innerHTML = navbarHtml;

      // Get navbar elements after they are loaded into the DOM
      const navbarUserIcon = document.getElementById('navbar-user-profile-pic');
      const navbarUserDisplayName = document.getElementById('navbar-user-display-name');
      const navbarUserSettingsLink = document.getElementById('navbar-user-settings-link');
      const navbarSigninLink = document.getElementById('navbar-signin-link');
      const navbarSignInText = document.getElementById('navbar-signin-text');


      // Ensure auth is provided before setting up auth state listener
      if (auth) {
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            // User is signed in. Update UI for logged-in state.
            if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'flex';
            if (navbarSigninLink) navbarSigninLink.style.display = 'none';

            // Fetch user profile from Firestore to get custom display name and photo
            const userProfile = await getUserProfileFromFirestore(db, appId, user.uid);
            if (navbarUserDisplayName) {
              // Prefer display name from profile, then Firebase auth, then generic.
              navbarUserDisplayName.textContent = userProfile?.displayName || user.displayName || 'Settings';
            }
            if (navbarUserIcon) {
              // Prefer photo URL from profile, then Firebase auth, then default.
              navbarUserIcon.src = userProfile?.photoURL || user.photoURL || defaultProfilePic;
            }
            // Apply user's theme preference
            const userThemePreference = userProfile?.themePreference;
            const allThemes = await getAvailableThemes(); // Directly call the imported function
            const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === defaultThemeName);
            applyTheme(themeToApply.id, themeToApply); // Directly call the imported function

          } else {
            // User is signed out. Update UI for logged-out state.
            if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
            if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
            if (navbarSignInText) navbarSignInText.textContent = 'Sign In'; // Ensure it says "Sign In" when logged out
            applyTheme(defaultThemeName); // Directly call imported applyTheme
          }
        });
      } else {
        console.warn("Firebase Auth not provided to loadNavbar. Dynamic navbar features disabled.");
        // Ensure sign-in link is shown if auth is not available
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
        if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
        applyTheme(defaultThemeName); // Directly call imported applyTheme
      }

    } catch (error) {
      console.error("Failed to load navigation bar:", error);
    }
  }
}

/**
 * Fetches user profile data from Firestore.
 * This is a helper function for navbar.js.
 * @param {Firestore} dbInstance - The Firestore instance.
 * @param {string} appIdValue - The app ID for Firestore paths.
 * @param {string} uid - The user's UID.
 * @returns {Promise<Object|null>} - User profile data or null if not found.
 */
async function getUserProfileFromFirestore(dbInstance, appIdValue, uid) {
  if (!dbInstance) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore in navbar.js.");
    return null;
  }
  const userDocRef = doc(dbInstance, `artifacts/${appIdValue}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("Error fetching user profile from Firestore in navbar.js:", error);
  }
  return null;
}
