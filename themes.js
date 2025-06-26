// themes.js - Handles dynamic theme application, fetching, saving, and deletion.

import { doc, setDoc, deleteDoc, collection, getDocs, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showMessageBox } from './utils.js';
import { auth, db, appId, DEFAULT_THEME_NAME } from './firebase-init.js'; // Import Firebase instances and constants

let _themeSelect;
let _allThemes = []; // Cache for all available themes (predefined + custom)

// Define core predefined themes
const predefinedThemes = [
  {
    id: 'dark', name: 'Dark Theme',
    variables: {
      '--color-body-bg': '#1a202c', '--color-text-primary': '#e2e8f0', '--color-text-secondary': '#a0aec0',
      '--color-link': '#63b3ed', '--color-link-hover': '#4299e1', '--color-navbar-bg': '#2d3748',
      '--color-card-bg': '#2d3748', '--color-input-bg': '#4a5568', '--color-input-border': '#2d3748',
      '--color-button-bg-primary': '#4299e1', '--color-button-text': '#ffffff',
      '--color-button-hover-primary': '#3182ce', '--color-bg-card': '#2d3748'
    }
  },
  {
    id: 'light', name: 'Light Theme',
    variables: {
      '--color-body-bg': '#f7fafc', '--color-text-primary': '#2d3748', '--color-text-secondary': '#4a5568',
      '--color-link': '#3182ce', '--color-link-hover': '#2b6cb0', '--color-navbar-bg': '#ffffff',
      '--color-card-bg': '#ffffff', '--color-input-bg': '#edf2f7', '--color-input-border': '#e2e8f0',
      '--color-button-bg-primary': '#3182ce', '--color-button-text': '#ffffff',
      '--color-button-hover-primary': '#2b6cb0', '--color-bg-card': '#ffffff'
    }
  }
];

/**
 * Initializes the theme module by setting up necessary DOM elements.
 * This is called from the main page script once Firebase is ready.
 */
export function setupThemesFirebase() {
  _themeSelect = document.getElementById('theme-select');
  console.log("DEBUG: Themes Firebase setup complete.");
}

/**
 * Fetches custom themes for the current user from Firestore.
 * @returns {Promise<Array<Object>>} An array of custom theme objects.
 */
async function fetchCustomThemes() {
  // Ensure Firebase instances are available and user is logged in before accessing Firestore
  if (!db || !auth || !auth.currentUser) {
    console.log("DEBUG: Not fetching custom themes - DB not ready or user not logged in.");
    return [];
  }
  const userId = auth.currentUser.uid;
  // Firestore path for custom themes: artifacts/{appId}/users/{userId}/custom_themes
  const customThemesColRef = collection(db, `artifacts/${appId}/users/${userId}/custom_themes`);
  try {
    const querySnapshot = await getDocs(customThemesColRef);
    const customThemes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("DEBUG: Fetched custom themes:", customThemes.length);
    return customThemes;
  } catch (error) {
    console.error("Error fetching custom themes:", error);
    showMessageBox("Failed to fetch custom themes.", true);
    return [];
  }
}

/**
 * Saves a custom theme to Firestore for the current user.
 * @param {Object} theme - The theme object to save. Must have an 'id' property.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function saveCustomTheme(theme) {
  if (!db || !auth || !auth.currentUser) {
    showMessageBox("Please sign in to save custom themes.", true);
    return false;
  }
  const userId = auth.currentUser.uid;
  const themeDocRef = doc(db, `artifacts/${appId}/users/${userId}/custom_themes`, theme.id);
  try {
    await setDoc(themeDocRef, theme);
    showMessageBox("Theme saved successfully!", false);
    return true;
  } catch (error) {
    console.error("Error saving custom theme:", error);
    showMessageBox("Failed to save theme.", true);
    return false;
  }
}

/**
 * Deletes a custom theme from Firestore for the current user.
 * @param {string} themeId - The ID of the theme to delete.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function deleteCustomTheme(themeId) {
  if (!db || !auth || !auth.currentUser) {
    showMessageBox("Please sign in to delete custom themes.", true);
    return false;
  }
  const userId = auth.currentUser.uid;
  const themeDocRef = doc(db, `artifacts/${appId}/users/${userId}/custom_themes`, themeId);
  try {
    await deleteDoc(themeDocRef);
    showMessageBox("Theme deleted successfully!", false);
    return true;
  } catch (error) {
    console.error("Error deleting custom theme:", error);
    showMessageBox("Failed to delete theme.", true);
    return false;
  }
}

/**
 * Applies the specified theme to the document's root element by setting CSS variables.
 * If themeObject is not provided, it fetches themes to find it.
 * @param {string} themeId - The ID of the theme to apply.
 * @param {Object|null} themeObject - Optional. The full theme object to apply directly.
 */
export async function applyTheme(themeId, themeObject = null) {
  let themeToApply = themeObject;
  if (!themeToApply) {
    // If theme object wasn't passed directly, try to find it in our cached themes
    themeToApply = _allThemes.find(t => t.id === themeId);
  }
  if (!themeToApply) {
    // If still not found, refresh _allThemes from Firestore (in case new themes were added/deleted)
    _allThemes = [...predefinedThemes, ...(await fetchCustomThemes())];
    themeToApply = _allThemes.find(t => t.id === themeId);
  }

  // If theme is still not found after attempting to fetch, fall back to default
  if (!themeToApply) {
    console.warn(`Theme '${themeId}' not found after all attempts. Applying default theme.`);
    themeToApply = predefinedThemes.find(t => t.id === DEFAULT_THEME_NAME) || predefinedThemes[0];
  }

  // Apply CSS variables if a valid theme is found
  if (themeToApply && themeToApply.variables) {
    for (const [key, value] of Object.entries(themeToApply.variables)) {
      document.documentElement.style.setProperty(key, value);
    }
    console.log(`Applied theme: ${themeToApply.name} (${themeToApply.id})`);
  } else {
    console.error(`Failed to apply theme: ${themeId}. Variables property missing or invalid.`);
  }
}

/**
 * Populates the theme selection dropdown with all available themes.
 */
async function populateThemeSelect() {
  _allThemes = [...predefinedThemes, ...(await fetchCustomThemes())];
  if (_themeSelect) {
    _themeSelect.innerHTML = ''; // Clear existing options
    _allThemes.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name;
      _themeSelect.appendChild(option);
    });
  }
}

/**
 * Returns an array of all available themes (predefined and custom).
 * Ensures themes are fetched and cached before returning.
 * @returns {Promise<Array<Object>>} An array of theme objects.
 */
export async function getAvailableThemes() {
  // Populate themes if not already populated (e.g., on first call)
  if (_allThemes.length === 0) {
    await populateThemeSelect();
  }
  return _allThemes;
}

// Event listener for theme selection changes (set up once DOM is ready)
document.addEventListener('DOMContentLoaded', async () => {
  // This part assumes setupThemesFirebase has already been called
  // which generally happens on window.onload in user-main.js
  // We need to re-select _themeSelect here, as it might be null if DOMContentLoaded fires before window.onload fully sets it up.
  if (!_themeSelect) {
    _themeSelect = document.getElementById('theme-select');
  }

  if (_themeSelect) {
    _themeSelect.addEventListener('change', async (event) => {
      const selectedThemeId = event.target.value;
      await applyTheme(selectedThemeId); // Apply the newly selected theme

      // Save the user's theme preference to Firestore if they are logged in
      if (auth.currentUser) {
        try {
          await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid),
            { themePreference: selectedThemeId }, { merge: true });
          console.log(`User theme preference '${selectedThemeId}' saved.`);
        } catch (error) {
          console.error("Error saving user theme preference:", error);
          showMessageBox("Failed to save theme preference.", true);
        }
      }
    });
  }
});
