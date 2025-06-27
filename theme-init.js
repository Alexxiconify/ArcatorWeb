// theme-init.js - Global theme initialization for all pages
import {firebaseReadyPromise, auth, DEFAULT_THEME_NAME} from './firebase-init.js';
import {setupThemesFirebase, applyTheme, getAvailableThemes} from './themes.js';

/**
 * Initialize themes globally for all pages
 */
async function initializeGlobalThemes() {
  try {
    // Wait for Firebase to be ready
    await firebaseReadyPromise;

    // Setup themes module
    setupThemesFirebase();

    // Get available themes
    const themes = await getAvailableThemes();

    // Determine which theme to apply
    let themeToApply = themes.find(t => t.id === DEFAULT_THEME_NAME);

    // If user is logged in, try to get their theme preference
    if (auth.currentUser) {
      // Import getUserProfileFromFirestore dynamically to avoid circular imports
      const {getUserProfileFromFirestore} = await import('./firebase-init.js');
      const userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
      if (userProfile && userProfile.themePreference) {
        const userTheme = themes.find(t => t.id === userProfile.themePreference);
        if (userTheme) {
          themeToApply = userTheme;
        }
      }
    }

    // Apply the theme
    if (themeToApply) {
      applyTheme(themeToApply.id, themeToApply);
      console.log(`Global theme applied: ${themeToApply.name}`);
    }

  } catch (error) {
    console.error('Error initializing global themes:', error);
    // Fallback to default theme
    const themes = await getAvailableThemes();
    const defaultTheme = themes.find(t => t.id === DEFAULT_THEME_NAME);
    if (defaultTheme) {
      applyTheme(defaultTheme.id, defaultTheme);
    }
  }
}

// Initialize themes when the script loads
initializeGlobalThemes();

// Export for manual initialization if needed
export {initializeGlobalThemes};
