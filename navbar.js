// navbar.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Loads the navigation bar HTML and sets up its dynamic behavior based on user authentication.
 * @param {object} firebaseInstances - Object containing initialized Firebase instances (auth, db, appId)
 * @param {function} applyThemeFunc - Reference to the window.applyTheme function from themes.js
 * @param {function} getAvailableThemesFunc - Reference to the window.getAvailableThemes function from themes.js
 * @param {string} defaultProfilePic - Default URL for profile pictures
 * @param {string} defaultThemeName - Default theme name
 */
export async function loadNavbar(firebaseInstances, applyThemeFunc, getAvailableThemesFunc, defaultProfilePic, defaultThemeName) {
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

      // Listen for authentication state changes
      if (auth) {
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            // User is signed in
            const userProfile = await getUserProfileFromFirestore(db, appId, user.uid);
            const displayName = userProfile?.displayName || user.displayName || 'Settings';
            const photoURL = userProfile?.photoURL || user.photoURL || defaultProfilePic;
            const themePreference = userProfile?.themePreference || defaultThemeName;

            if (navbarUserIcon && navbarUserDisplayName && navbarUserSettingsLink) {
              navbarUserIcon.src = photoURL;
              navbarUserDisplayName.textContent = displayName;
              navbarUserSettingsLink.style.display = 'flex'; // Show user profile link
            }
            if (navbarSigninLink) {
              navbarSigninLink.style.display = 'none'; // Hide sign-in link
            }

            // Apply user's theme using the passed function
            const allThemes = await getAvailableThemesFunc();
            const selectedTheme = allThemes.find(theme => theme.id === themePreference);
            if (selectedTheme) {
              applyThemeFunc(selectedTheme.id, selectedTheme);
            } else {
              applyThemeFunc(defaultThemeName);
            }

          } else {
            // User is signed out
            if (navbarUserSettingsLink) {
              navbarUserSettingsLink.style.display = 'none'; // Hide user profile link
            }
            if (navbarSigninLink) {
              navbarSigninLink.style.display = 'flex'; // Show sign-in link
            }
            applyThemeFunc(defaultThemeName); // Apply default theme
          }
        });
      } else {
        console.warn("Firebase Auth not provided to loadNavbar. Dynamic navbar features disabled.");
        // Ensure sign-in link is shown if auth is not available
        if (navbarUserSettingsLink) navbarUserSettingsLink.style.display = 'none';
        if (navbarSigninLink) navbarSigninLink.style.display = 'flex';
        applyThemeFunc(defaultThemeName); // Apply default theme
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
