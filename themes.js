// themes.js - Handles theme management, including loading default and custom themes,
// applying themes, and interacting with Firestore for custom theme storage.

// Imports from firebase-init.js for Firebase instances and constants
// Import db, auth, and appId directly as they are now globally exported from firebase-init.js
import { db, auth, appId, firebaseReadyPromise, DEFAULT_THEME_NAME } from './firebase-init.js';
import { showMessageBox } from './utils.js'; // For showing messages

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc, // Added deleteDoc import
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables for Firebase instances
// These are not strictly necessary if using direct imports from firebase-init.js
// but are kept for consistency with the pattern if other parts of themes.js rely on them.
let themesDb = db; // Assign global db instance
let themesAuth = auth; // Assign global auth instance
let themesAppId = appId; // Assign global appId instance

// Cache for available themes
let availableThemesCache = null;

// Default themes (always available)
const defaultThemes = [
  {
    id: 'dark',
    name: 'Dark Theme',
    properties: {
      '--color-body-bg': '#1a202c',
      '--color-text-primary': '#e2e8f0',
      '--color-text-secondary': '#a0aec0',
      '--color-bg-navbar': '#111827',
      '--color-bg-content-section': '#2d3748',
      '--color-bg-card': '#2d3748',
      '--color-bg-ip-box': '#1a202c',
      '--color-border-ip-box': '#4a5568',
      '--color-link': '#63b3ed',
      '--color-link-hover': '#90cdf4',
      '--color-button-text': '#ffffff',
      '--color-button-blue-bg': '#4299e1',
      '--color-button-blue-hover': '#3182ce',
      '--color-button-red-bg': '#e53e3e',
      '--color-button-red-hover': '#c53030',
      '--color-button-green-bg': '#48bb78',
      '--color-button-green-hover': '#38a169',
      '--color-button-purple-bg': '#805ad5',
      '--color-button-purple-hover': '#6b46c1',
      '--color-button-yellow-bg': '#ecc94b',
      '--color-button-yellow-hover': '#d69e2e',
      '--color-button-orange-bg': '#ed8936',
      '--color-button-orange-hover': '#dd6b20',
      '--color-button-indigo-bg': '#667eea',
      '--color-button-indigo-hover': '#5a67d8',
      '--color-button-teal-bg': '#319795',
      '--color-button-teal-hover': '#2c7a7b',
      '--color-input-bg': '#2d3748',
      '--color-input-text': '#e2e8f0',
      '--color-input-border': '#4a5568',
      '--color-placeholder': '#a0aec0',
      '--color-table-th-bg': '#2a4365',
      '--color-table-th-text': '#e2e8f0',
      '--color-table-td-border': '#4a5568',
      '--color-table-row-even-bg': '#2c3748',
      '--color-modal-bg': '#2d3748',
      '--color-modal-text': '#e2e8f0',
      '--color-modal-input-bg': '#1a202c',
      '--color-message-box-bg-success': '#28a745',
      '--color-message-box-bg-error': '#dc3545',
      '--color-heading-main': '#F9FAFB',
      '--color-heading-card': '#93C5FD'
    }
  },
  {
    id: 'light',
    name: 'Light Theme',
    properties: {
      '--color-body-bg': '#f7fafc',
      '--color-text-primary': '#2d3748',
      '--color-text-secondary': '#4a5568',
      '--color-bg-navbar': '#ffffff',
      '--color-bg-content-section': '#ffffff',
      '--color-bg-card': '#ffffff',
      '--color-bg-ip-box': '#edf2f7',
      '--color-border-ip-box': '#e2e8f0',
      '--color-link': '#2b6cb0',
      '--color-link-hover': '#3182ce',
      '--color-button-text': '#ffffff',
      '--color-button-blue-bg': '#3182ce',
      '--color-button-blue-hover': '#2b6cb0',
      '--color-button-red-bg': '#e53e3e',
      '--color-button-red-hover': '#c53030',
      '--color-button-green-bg': '#38a169',
      '--color-button-green-hover': '#2f855a',
      '--color-button-purple-bg': '#6b46c1',
      '--color-button-purple-hover': '#553c9a',
      '--color-button-yellow-bg': '#d69e2e',
      '--color-button-yellow-hover': '#b7791f',
      '--color-button-orange-bg': '#dd6b20',
      '--color-button-orange-hover': '#c05621',
      '--color-button-indigo-bg': '#5a67d8',
      '--color-button-indigo-hover': '#4c51bf',
      '--color-button-teal-bg': '#319795',
      '--color-button-teal-hover': '#2c7a7b',
      '--color-input-bg': '#edf2f7',
      '--color-input-text': '#2d3748',
      '--color-input-border': '#e2e8f0',
      '--color-placeholder': '#a0aec0',
      '--color-table-th-bg': '#e2e8f0',
      '--color-table-th-text': '#2d3748',
      '--color-table-td-border': '#edf2f7',
      '--color-table-row-even-bg': '#f7fafc',
      '--color-modal-bg': '#ffffff',
      '--color-modal-text': '#2d3748',
      '--color-modal-input-bg': '#edf2f7',
      '--color-message-box-bg-success': '#28a745',
      '--color-message-box-bg-error': '#dc3545',
      '--color-heading-main': '#1F2937',
      '--color-heading-card': '#3B82F6'
    }
  },
];

/**
 * Initializes Firebase instances for the themes module.
 * This function's parameters are now optional, as it attempts to use the globally exported
 * `db`, `auth`, and `appId` from `firebase-init.js` if not explicitly passed.
 * @param {object} [firestoreDb] - The Firestore DB instance (optional).
 * @param {object} [firebaseAuth] - The Firebase Auth instance (optional).
 * @param {string} [appIdentifier] - The application ID (optional).
 */
export function setupThemesFirebase(firestoreDb, firebaseAuth, appIdentifier) {
  // Use passed instances or fall back to globally imported ones
  themesDb = firestoreDb || db;
  themesAuth = firebaseAuth || auth;
  themesAppId = appIdentifier || appId;
  console.log("DEBUG: Themes Firebase setup complete.");
}

/**
 * Fetches custom themes from Firestore for the current user.
 * Themes are stored under /artifacts/{appId}/users/{userId}/custom_themes.
 * @returns {Promise<Array>} A promise that resolves to an array of custom theme objects.
 */
async function fetchCustomThemes() {
  await firebaseReadyPromise; // Ensure Firebase is fully initialized and 'db' is available
  if (!themesDb || !themesAuth || !themesAuth.currentUser) {
    console.log("Themes module: Firebase instances or current user not yet available for fetching custom themes. Returning only default themes.");
    return []; // Return empty array if prerequisites are not met
  }

  const userId = themesAuth.currentUser.uid;
  const customThemesColRef = collection(themesDb, `artifacts/${themesAppId}/users/${userId}/custom_themes`);
  const q = query(customThemesColRef);

  try {
    const querySnapshot = await getDocs(q);
    const customThemes = [];
    querySnapshot.forEach((doc) => {
      customThemes.push({ id: doc.id, ...doc.data() });
    });
    console.log(`DEBUG: Fetched custom themes: ${customThemes.length}`);
    return customThemes;
  } catch (error) {
    console.error("Error fetching custom themes from Firestore:", error);
    showMessageBox("Error loading custom themes.", true);
    return [];
  }
}

/**
 * Retrieves all available themes, including defaults and user-defined custom themes.
 * Uses a cache to avoid redundant Firestore reads.
 * @param {boolean} forceRefresh - If true, bypass the cache and refetch themes.
 * @returns {Promise<Array>} A promise that resolves to an array of all available theme objects.
 */
export async function getAvailableThemes(forceRefresh = false) {
  if (availableThemesCache && !forceRefresh) {
    console.log("DEBUG: Returning themes from cache.");
    return availableThemesCache;
  }

  const customThemes = await fetchCustomThemes();
  const allThemes = [...defaultThemes, ...customThemes];
  availableThemesCache = allThemes; // Update cache
  return allThemes;
}

/**
 * Applies the selected theme by setting CSS custom properties (variables) on the document's root element.
 * @param {string} themeId - The ID of the theme to apply.
 * @param {object} themeProperties - The object containing theme CSS properties.
 */
export function applyTheme(themeId, themeProperties) {
  const root = document.documentElement;
  // Clear any existing custom properties to prevent conflicts
  // This is a safety measure; usually, new properties will overwrite old ones.
  // However, if a theme removes a property, explicitly removing it ensures cleanup.
  // Iterate over all known property names (from default themes or previously loaded custom themes)
  // to ensure proper reset. For simplicity, we'll just apply new ones, which will overwrite.

  // Apply new custom properties
  if (themeProperties && themeProperties.properties) {
    for (const [key, value] of Object.entries(themeProperties.properties)) {
      root.style.setProperty(key, value);
    }
    console.log(`Applied theme: ${themeProperties.name} (${themeId})`);
  } else {
    console.warn(`Theme properties not found for theme ID: ${themeId}. Applying default theme if possible.`);
    // Fallback to dark theme if selected theme properties are invalid
    const defaultTheme = defaultThemes.find(t => t.id === DEFAULT_THEME_NAME);
    if (defaultTheme) {
      for (const [key, value] of Object.entries(defaultTheme.properties)) {
        root.style.setProperty(key, value);
      }
      console.log(`Applied default theme: ${defaultTheme.name} (${defaultTheme.id})`);
    }
  }
  // No need to dynamically link CSS files for themes, as all theme properties are handled via CSS variables.
  // This addresses the "dark:1 Failed to load resource" error if it was caused by themes.js trying to load a CSS file directly.
}


/**
 * Saves a custom theme to Firestore for the current user.
 * @param {string} themeId - The ID of the custom theme.
 * @param {string} themeName - The display name of the custom theme.
 * @param {object} properties - The CSS properties of the custom theme.
 * @returns {Promise<boolean>} A promise that resolves to true if successful, false otherwise.
 */
export async function saveCustomTheme(themeId, themeName, properties) {
  await firebaseReadyPromise;
  if (!themesDb || !themesAuth || !themesAuth.currentUser) {
    showMessageBox("Please log in to save custom themes.", true);
    return false;
  }

  const userId = themesAuth.currentUser.uid;
  const themeDocRef = doc(themesDb, `artifacts/${themesAppId}/users/${userId}/custom_themes`, themeId);

  try {
    await setDoc(themeDocRef, {
      name: themeName,
      properties: properties,
      createdAt: new Date(),
      createdBy: userId
    }, { merge: true });
    availableThemesCache = null; // Invalidate cache
    showMessageBox("Custom theme saved successfully!", false);
    return true;
  } catch (error) {
    console.error("Error saving custom theme:", error);
    showMessageBox(`Error saving theme: ${error.message}`, true);
    return false;
  }
}

/**
 * Deletes a custom theme from Firestore for the current user.
 * @param {string} themeId - The ID of the custom theme to delete.
 * @returns {Promise<boolean>} A promise that resolves to true if successful, false otherwise.
 */
export async function deleteCustomTheme(themeId) { // Exporting deleteCustomTheme
  await firebaseReadyPromise;
  if (!themesDb || !themesAuth || !themesAuth.currentUser) {
    showMessageBox("Please log in to delete custom themes.", true);
    return false;
  }

  const userId = themesAuth.currentUser.uid;
  const themeDocRef = doc(themesDb, `artifacts/${themesAppId}/users/${userId}/custom_themes`, themeId);

  try {
    await deleteDoc(themeDocRef);
    availableThemesCache = null; // Invalidate cache
    showMessageBox("Custom theme deleted successfully!", false);
    return true;
  } catch (error) {
    console.error("Error deleting custom theme:", error);
    showMessageBox(`Error deleting theme: ${error.message}`, true);
    return false;
  }
}
