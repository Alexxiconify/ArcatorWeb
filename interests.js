// interests.js: Handles functionality for the interests page.

// Import Firebase instances and user functions from the centralized init file
import {
  auth,
  db,
  appId,
  firebaseReadyPromise, // This promise resolves when Firebase is fully initialized and authenticated
  getUserProfileFromFirestore, // Use the centralized function
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME
} from './firebase-init.js';

// Import theme management functions
import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
// Import navbar loading function
import { loadNavbar } from './navbar.js';
// Import Firebase Auth method onAuthStateChanged
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


// Main execution logic on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
  // Wait for Firebase to be ready before proceeding with any Firebase-dependent operations.
  // This ensures `auth`, `db`, and `appId` are initialized.
  await firebaseReadyPromise;

  // Initialize themes Firebase integration now that `db`, `auth`, `appId` are guaranteed to be set
  setupThemesFirebase(db, auth, appId);

  // Load navbar dynamically after Firebase is ready
  // loadNavbar now internally handles fetching its own Firebase instances, but passing them explicitly is safer.
  await loadNavbar(); // loadNavbar now relies on the centralized firebase-init.js exports

  // Set current year for footer
  const currentYearElement = document.getElementById('current-year-interests');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }

  // After everything is loaded and Firebase is ready, apply the user's theme
  // This onAuthStateChanged listener is still useful here to react to *any* auth state change
  // after the initial load (e.g., user logs in/out from another tab).
  onAuthStateChanged(auth, async (user) => {
    let userThemePreference = null;
    if (user) {
      // Use the centralized getUserProfileFromFirestore, which relies on the initialized `db`
      const userProfile = await getUserProfileFromFirestore(user.uid);
      userThemePreference = userProfile?.themePreference;
    }
    // Apply the theme: user's preference, or DEFAULT_THEME_NAME
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    applyTheme(themeToApply.id, themeToApply);
  });
});
