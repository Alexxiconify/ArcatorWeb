// about.js: Page-specific logic for the About Us page.

// Import necessary Firebase instances and functions from firebase-init.js
import { auth, firebaseReadyPromise, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, getUserProfileFromFirestore } from './firebase-init.js';
// Import theme-related functions
import { applyTheme, getAvailableThemes } from './themes.js';
// Import navbar loading function
import { loadNavbar } from './navbar.js';

// Main execution logic once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', async function() {
  console.log("about.js: DOMContentLoaded event fired.");

  // Wait for Firebase to be fully initialized and authenticated.
  await firebaseReadyPromise;
  console.log("about.js: Firebase ready.");

  // Load navbar dynamically after Firebase is ready
  // Pass auth.currentUser, which is guaranteed to be set after firebaseReadyPromise resolves.
  await loadNavbar(auth.currentUser, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
  console.log("about.js: Navbar loaded.");

  // Set current year for the footer
  const currentYearElement = document.getElementById('current-year-about');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear();
    console.log("about.js: Current year set for footer.");
  }

  // Apply the user's theme or default theme
  let userThemePreference = null;
  if (auth.currentUser) {
    // If a user is logged in, try to fetch their theme preference from their profile
    const userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
    userThemePreference = userProfile?.themePreference;
    console.log("about.js: User theme preference fetched:", userThemePreference);
  }

  // Get all available themes (predefined + custom)
  const allThemes = await getAvailableThemes();
  // Determine which theme to apply: user's preference, or the default
  const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);

  if (themeToApply) {
    await applyTheme(themeToApply.id);
    console.log(`about.js: Theme '${themeToApply.id}' applied.`);
  } else {
    console.warn("about.js: Could not find theme to apply. Default theme might be missing.");
  }

  console.log("about.js: Page initialization complete.");
});
