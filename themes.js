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
  where,
  addDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables for Firebase instances
// These are not strictly necessary if using direct imports from firebase-init.js
// but are kept for consistency with the pattern if other parts of themes.js rely on them.
let themesDb = db; // Assign global db instance
let themesAuth = auth; // Assign global auth instance
let themesAppId = appId; // Assign global appId instance

// Cache for available themes
let availableThemesCache = null;

const defaultThemes = [
  {
    id: 'dark',
    name: 'Dark Theme',
    description: 'Default dark theme with blue accents',
    colors: {
      '--color-body-bg': '#1F2937',
      '--color-text-primary': '#E5E7EB',
      '--color-text-secondary': '#9CA3AF',
      '--color-bg-navbar': '#111827',
      '--color-bg-card': '#2D3748',
      '--color-bg-content-section': '#374151',
      '--color-bg-ip-box': '#1F2937',
      '--color-border-ip-box': '#4B5563',
      '--color-input-bg': '#374151',
      '--color-input-text': '#E5E7EB',
      '--color-input-border': '#4B5563',
      '--color-placeholder': '#9CA3AF',
      '--color-link': '#60A5FA',
      '--color-heading-main': '#F9FAFB',
      '--color-heading-card': '#E5E7EB',
      '--color-button-blue-bg': '#3B82F6',
      '--color-button-blue-hover': '#2563EB',
      '--color-button-green-bg': '#10B981',
      '--color-button-green-hover': '#059669',
      '--color-button-red-bg': '#EF4444',
      '--color-button-red-hover': '#DC2626',
      '--color-button-purple-bg': '#8B5CF6',
      '--color-button-purple-hover': '#7C3AED',
      '--color-button-yellow-bg': '#F59E0B',
      '--color-button-yellow-hover': '#D97706',
      '--color-button-indigo-bg': '#6366F1',
      '--color-button-indigo-hover': '#4F46E5',
      '--color-button-text': '#FFFFFF',
      '--color-table-th-bg': '#374151',
      '--color-table-th-text': '#F9FAFB',
      '--color-table-td-border': '#4B5563',
      '--color-table-row-even-bg': '#2D3748',
      '--color-modal-bg': '#374151',
      '--color-modal-text': '#E5E7EB',
      '--color-modal-input-bg': '#4B5563',
      '--color-modal-input-text': '#E5E7EB',
      '--color-message-box-bg-success': '#10B981',
      '--color-message-box-bg-error': '#EF4444',
      '--color-settings-card-bg': '#2D3748',
      '--color-settings-card-border': '#4B5563',
      '--color-table-col-even': '#374151',
      '--color-table-col-odd': '#2D3748'
    }
  },
  {
    id: 'light',
    name: 'Light Theme',
    description: 'Clean light theme with dark text',
    colors: {
      '--color-body-bg': '#F3F4F6',
      '--color-text-primary': '#1F2937',
      '--color-text-secondary': '#6B7280',
      '--color-bg-navbar': '#FFFFFF',
      '--color-bg-card': '#FFFFFF',
      '--color-bg-content-section': '#F9FAFB',
      '--color-bg-ip-box': '#F3F4F6',
      '--color-border-ip-box': '#D1D5DB',
      '--color-input-bg': '#FFFFFF',
      '--color-input-text': '#1F2937',
      '--color-input-border': '#D1D5DB',
      '--color-placeholder': '#6B7280',
      '--color-link': '#3B82F6',
      '--color-heading-main': '#111827',
      '--color-heading-card': '#1F2937',
      '--color-button-blue-bg': '#3B82F6',
      '--color-button-blue-hover': '#2563EB',
      '--color-button-green-bg': '#10B981',
      '--color-button-green-hover': '#059669',
      '--color-button-red-bg': '#EF4444',
      '--color-button-red-hover': '#DC2626',
      '--color-button-purple-bg': '#8B5CF6',
      '--color-button-purple-hover': '#7C3AED',
      '--color-button-yellow-bg': '#F59E0B',
      '--color-button-yellow-hover': '#D97706',
      '--color-button-indigo-bg': '#6366F1',
      '--color-button-indigo-hover': '#4F46E5',
      '--color-button-text': '#FFFFFF',
      '--color-table-th-bg': '#F3F4F6',
      '--color-table-th-text': '#374151',
      '--color-table-td-border': '#E5E7EB',
      '--color-table-row-even-bg': '#F9FAFB',
      '--color-modal-bg': '#FFFFFF',
      '--color-modal-text': '#1F2937',
      '--color-modal-input-bg': '#F9FAFB',
      '--color-modal-input-text': '#1F2937',
      '--color-message-box-bg-success': '#10B981',
      '--color-message-box-bg-error': '#EF4444',
      '--color-settings-card-bg': '#FFFFFF',
      '--color-settings-card-border': '#E5E7EB',
      '--color-table-col-even': '#F3F4F6',
      '--color-table-col-odd': '#F9FAFB'
    }
  },
  {
    id: 'arcator-green',
    name: 'Arcator Green',
    description: 'Arcator brand theme with green accents',
    colors: {
      '--color-body-bg': '#1a202c',
      '--color-text-primary': '#E2E8F0',
      '--color-text-secondary': '#94A3B8',
      '--color-bg-navbar': '#0f1419',
      '--color-bg-card': '#2b3b55',
      '--color-bg-content-section': '#374151',
      '--color-bg-ip-box': '#1a202c',
      '--color-border-ip-box': '#4B5563',
      '--color-input-bg': '#3b4d6b',
      '--color-input-text': '#E2E8F0',
      '--color-input-border': '#5a6e8f',
      '--color-placeholder': '#94A3B8',
      '--color-link': '#48BB78',
      '--color-heading-main': '#F9FAFB',
      '--color-heading-card': '#E2E8F0',
      '--color-button-blue-bg': '#48BB78',
      '--color-button-blue-hover': '#38A169',
      '--color-button-green-bg': '#48BB78',
      '--color-button-green-hover': '#38A169',
      '--color-button-red-bg': '#F56565',
      '--color-button-red-hover': '#E53E3E',
      '--color-button-purple-bg': '#9F7AEA',
      '--color-button-purple-hover': '#805AD5',
      '--color-button-yellow-bg': '#ED8936',
      '--color-button-yellow-hover': '#DD6B20',
      '--color-button-indigo-bg': '#667EEA',
      '--color-button-indigo-hover': '#5A67D8',
      '--color-button-text': '#FFFFFF',
      '--color-table-th-bg': '#374151',
      '--color-table-th-text': '#F9FAFB',
      '--color-table-td-border': '#4B5563',
      '--color-table-row-even-bg': '#2b3b55',
      '--color-modal-bg': '#374151',
      '--color-modal-text': '#E2E8F0',
      '--color-modal-input-bg': '#3b4d6b',
      '--color-modal-input-text': '#E2E8F0',
      '--color-message-box-bg-success': '#48BB78',
      '--color-message-box-bg-error': '#F56565',
      '--color-settings-card-bg': '#2b3b55',
      '--color-settings-card-border': '#4B5563',
      '--color-table-col-even': '#374151',
      '--color-table-col-odd': '#2b3b55'
    }
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    description: 'Deep ocean theme with blue gradients',
    colors: {
      '--color-body-bg': '#0f172a',
      '--color-text-primary': '#E2E8F0',
      '--color-text-secondary': '#94A3B8',
      '--color-bg-navbar': '#020617',
      '--color-bg-card': '#1e293b',
      '--color-bg-content-section': '#334155',
      '--color-bg-ip-box': '#0f172a',
      '--color-border-ip-box': '#475569',
      '--color-input-bg': '#334155',
      '--color-input-text': '#E2E8F0',
      '--color-input-border': '#475569',
      '--color-placeholder': '#94A3B8',
      '--color-link': '#60A5FA',
      '--color-heading-main': '#F9FAFB',
      '--color-heading-card': '#E2E8F0',
      '--color-button-blue-bg': '#3B82F6',
      '--color-button-blue-hover': '#2563EB',
      '--color-button-green-bg': '#10B981',
      '--color-button-green-hover': '#059669',
      '--color-button-red-bg': '#EF4444',
      '--color-button-red-hover': '#DC2626',
      '--color-button-purple-bg': '#8B5CF6',
      '--color-button-purple-hover': '#7C3AED',
      '--color-button-yellow-bg': '#F59E0B',
      '--color-button-yellow-hover': '#D97706',
      '--color-button-indigo-bg': '#6366F1',
      '--color-button-indigo-hover': '#4F46E5',
      '--color-button-text': '#FFFFFF',
      '--color-table-th-bg': '#334155',
      '--color-table-th-text': '#F9FAFB',
      '--color-table-td-border': '#475569',
      '--color-table-row-even-bg': '#1e293b',
      '--color-modal-bg': '#334155',
      '--color-modal-text': '#E2E8F0',
      '--color-modal-input-bg': '#475569',
      '--color-modal-input-text': '#E2E8F0',
      '--color-message-box-bg-success': '#10B981',
      '--color-message-box-bg-error': '#EF4444',
      '--color-settings-card-bg': '#1e293b',
      '--color-settings-card-border': '#475569',
      '--color-table-col-even': '#334155',
      '--color-table-col-odd': '#1e293b'
    }
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'High contrast theme for accessibility',
    colors: {
      '--color-body-bg': '#000000',
      '--color-text-primary': '#FFFFFF',
      '--color-text-secondary': '#CCCCCC',
      '--color-bg-navbar': '#000000',
      '--color-bg-card': '#1a1a1a',
      '--color-bg-content-section': '#2a2a2a',
      '--color-bg-ip-box': '#000000',
      '--color-border-ip-box': '#FFFFFF',
      '--color-input-bg': '#1a1a1a',
      '--color-input-text': '#FFFFFF',
      '--color-input-border': '#FFFFFF',
      '--color-placeholder': '#CCCCCC',
      '--color-link': '#FFFF00',
      '--color-heading-main': '#FFFFFF',
      '--color-heading-card': '#FFFFFF',
      '--color-button-blue-bg': '#FFFF00',
      '--color-button-blue-hover': '#FFFF00',
      '--color-button-green-bg': '#00FF00',
      '--color-button-green-hover': '#00FF00',
      '--color-button-red-bg': '#FF0000',
      '--color-button-red-hover': '#FF0000',
      '--color-button-purple-bg': '#FF00FF',
      '--color-button-purple-hover': '#FF00FF',
      '--color-button-yellow-bg': '#FFFF00',
      '--color-button-yellow-hover': '#FFFF00',
      '--color-button-indigo-bg': '#00FFFF',
      '--color-button-indigo-hover': '#00FFFF',
      '--color-button-text': '#000000',
      '--color-table-th-bg': '#2a2a2a',
      '--color-table-th-text': '#FFFFFF',
      '--color-table-td-border': '#FFFFFF',
      '--color-table-row-even-bg': '#1a1a1a',
      '--color-modal-bg': '#2a2a2a',
      '--color-modal-text': '#FFFFFF',
      '--color-modal-input-bg': '#1a1a1a',
      '--color-modal-input-text': '#FFFFFF',
      '--color-message-box-bg-success': '#00FF00',
      '--color-message-box-bg-error': '#FF0000',
      '--color-settings-card-bg': '#1a1a1a',
      '--color-settings-card-border': '#FFFFFF',
      '--color-table-col-even': '#2a2a2a',
      '--color-table-col-odd': '#1a1a1a'
    }
  }
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
 * Fetches custom themes from Firestore.
 * @returns {Promise<Array>} Array of custom theme objects.
 */
async function fetchCustomThemes() {
  // Use the proper Firebase instances - fall back to global ones if themesDb/themesAuth not set
  const firestoreDb = themesDb || db;
  const appIdentifier = themesAppId || appId;

  if (!firestoreDb) {
    console.error("Firestore DB not initialized for fetchCustomThemes.");
    return [];
  }
  const customThemesCol = collection(firestoreDb, `artifacts/${appIdentifier}/public/data/custom_themes`);
  try {
    const querySnapshot = await getDocs(customThemesCol);
    const customThemes = [];
    querySnapshot.forEach((doc) => {
      const themeData = {id: doc.id, ...doc.data()};
      console.log(`DEBUG: Fetched theme - ID: ${themeData.id}, Name: ${themeData.name}, isCustom: ${themeData.isCustom}`);

      // Filter out themes with null or invalid IDs
      if (!themeData.id || themeData.id === 'null' || themeData.id === null) {
        console.error(`DEBUG: Theme with invalid ID found - Name: ${themeData.name}, ID: ${themeData.id}`);
        return; // Skip this theme
      }

      // Ensure the theme has required fields
      if (!themeData.name || !themeData.isCustom) {
        console.warn(`DEBUG: Theme missing required fields - ID: ${themeData.id}, Name: ${themeData.name}, isCustom: ${themeData.isCustom}`);
      }

      customThemes.push(themeData);
    });
    console.log("DEBUG: Fetched custom themes:", customThemes.length);
    return customThemes;
  } catch (error) {
    console.error("Error fetching custom themes:", error);
    return [];
  }
}

/**
 * Returns all available themes (default + custom).
 * @param {boolean} [forceRefresh=false] - Force refresh the cache.
 * @returns {Promise<Array>} Array of all available theme objects.
 */
export async function getAvailableThemes(forceRefresh = false) {
  console.log(`DEBUG: getAvailableThemes called with forceRefresh=${forceRefresh}, cache exists=${!!availableThemesCache}`);

  if (availableThemesCache && !forceRefresh) {
    console.log(`DEBUG: Returning cached themes (${availableThemesCache.length} total)`);
    console.log("DEBUG: Cached themes details:", availableThemesCache.map(t => ({
      id: t.id,
      name: t.name,
      isCustom: t.isCustom
    })));
    return availableThemesCache;
  }

  console.log(`DEBUG: Fetching fresh themes...`);
  const customThemes = await fetchCustomThemes();
  console.log(`DEBUG: Fetched ${customThemes.length} custom themes`);

  console.log("DEBUG: Default themes:", defaultThemes.map(t => ({id: t.id, name: t.name, isCustom: t.isCustom})));
  console.log("DEBUG: Custom themes before combining:", customThemes.map(t => ({
    id: t.id,
    name: t.name,
    isCustom: t.isCustom
  })));

  // Filter out any themes with null or invalid IDs
  const validCustomThemes = customThemes.filter(theme => {
    if (!theme.id || theme.id === 'null' || theme.id === null) {
      console.error(`DEBUG: Filtering out theme with invalid ID: ${theme.name} (ID: ${theme.id})`);
      return false;
    }
    return true;
  });

  console.log(`DEBUG: Valid custom themes after filtering: ${validCustomThemes.length}`);

  availableThemesCache = [...defaultThemes, ...validCustomThemes];
  console.log(`DEBUG: Updated cache with ${availableThemesCache.length} total themes`);
  console.log("DEBUG: Final themes details:", availableThemesCache.map(t => ({
    id: t.id,
    name: t.name,
    isCustom: t.isCustom
  })));

  return availableThemesCache;
}

/**
 * Applies a theme to the document.
 * @param {string} themeId - The ID of the theme to apply.
 * @param {object} [themeProperties] - Optional theme properties object.
 */
export function applyTheme(themeId, themeProperties) {
  const root = document.documentElement;

  // Remove existing theme classes
  root.classList.remove('theme-dark', 'theme-light', 'theme-arcator-green', 'theme-ocean-blue', 'theme-high-contrast');

  // Only add theme class for built-in themes (not custom themes)
  if (themeProperties && themeProperties.isCustom) {
    // For custom themes, don't add a CSS class since they don't have predefined CSS
    console.log(`Applying custom theme: ${themeId}`);
  } else {
    // Add new theme class for built-in themes
    root.classList.add(`theme-${themeId}`);
    console.log(`Applying built-in theme: ${themeId}`);
  }

  // Apply CSS variables if theme properties are provided
  if (themeProperties && themeProperties.variables) {
    Object.entries(themeProperties.variables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
    console.log(`Applied ${Object.keys(themeProperties.variables).length} CSS variables for theme: ${themeId}`);
  }

  // Apply CSS variables if theme properties are provided (legacy format)
  if (themeProperties && themeProperties.colors) {
    Object.entries(themeProperties.colors).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
    console.log(`Applied ${Object.keys(themeProperties.colors).length} legacy color variables for theme: ${themeId}`);
  }

  // Apply background pattern if specified
  if (themeProperties && themeProperties.backgroundPattern) {
    if (themeProperties.backgroundPattern === 'none') {
      document.body.style.backgroundImage = 'none';
    } else if (themeProperties.backgroundPattern === 'dots') {
      document.body.style.backgroundImage = 'linear-gradient(45deg, rgba(0,0,0,0.1) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 75%, transparent 75%, transparent)';
      document.body.style.backgroundSize = '20px 20px';
      document.body.style.backgroundAttachment = 'fixed';
    } else if (themeProperties.backgroundPattern === 'grid') {
      document.body.style.backgroundImage = 'linear-gradient(to right, rgba(0, 0, 0, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px)';
      document.body.style.backgroundSize = '40px 40px';
      document.body.style.backgroundAttachment = 'fixed';
    }
    console.log(`Applied background pattern: ${themeProperties.backgroundPattern}`);
  }

  // Apply font family if specified
  if (themeProperties && themeProperties.variables && themeProperties.variables['--font-family-body']) {
    document.body.style.fontFamily = themeProperties.variables['--font-family-body'];
    console.log(`Applied font family: ${themeProperties.variables['--font-family-body']}`);
  }

  // Dispatch theme change event for components that need to update
  const themeChangeEvent = new CustomEvent('themeChanged', {
    detail: {
      themeId: themeId,
      themeProperties: themeProperties
    }
  });
  document.dispatchEvent(themeChangeEvent);

  console.log(`Theme applied successfully: ${themeId}`);
}

/**
 * Saves a custom theme to Firestore.
 * @param {object} themeData - The theme data to save.
 * @returns {Promise<string|boolean>} Document ID on success, false on failure.
 */
export async function saveCustomTheme(themeData) {
  console.log('DEBUG: saveCustomTheme called with:', themeData);

  // Use the proper Firebase instances - fall back to global ones if themesDb/themesAuth not set
  const firestoreDb = themesDb || db;
  const firebaseAuth = themesAuth || auth;
  const appIdentifier = themesAppId || appId;

  console.log('DEBUG: Firebase instances - firestoreDb:', !!firestoreDb, 'firebaseAuth:', !!firebaseAuth, 'appIdentifier:', appIdentifier);

  if (!firestoreDb || !firebaseAuth.currentUser) {
    console.error("Not authenticated or database not ready for saveCustomTheme.");
    console.error("firestoreDb:", !!firestoreDb, "firebaseAuth.currentUser:", !!firebaseAuth.currentUser);
    return false;
  }

  // Validate theme name is required
  if (!themeData.name || themeData.name.trim() === '') {
    console.error("Theme name is required for saveCustomTheme.");
    return false;
  }

  const customThemesCol = collection(firestoreDb, `artifacts/${appIdentifier}/public/data/custom_themes`);

  // Define all required color variables with their default values
  const colorVariables = {
    '--color-body-bg': '#1F2937',
    '--color-text-primary': '#E5E7EB',
    '--color-text-secondary': '#9CA3AF',
    '--color-bg-navbar': '#111827',
    '--color-bg-content-section': '#374151',
    '--color-bg-card': '#2D3748',
    '--color-input-bg': '#374151',
    '--color-input-text': '#E5E7EB',
    '--color-input-border': '#4B5563',
    '--color-placeholder': '#9CA3AF',
    '--color-link': '#60A5FA',
    '--color-heading-main': '#F9FAFB',
    '--color-heading-card': '#E5E7EB',
    '--color-button-blue-bg': '#3B82F6',
    '--color-button-blue-hover': '#2563EB',
    '--color-button-red-bg': '#EF4444',
    '--color-button-red-hover': '#DC2626',
    '--color-button-green-bg': '#10B981',
    '--color-button-green-hover': '#059669',
    '--color-button-purple-bg': '#8B5CF6',
    '--color-button-purple-hover': '#7C3AED',
    '--color-button-yellow-bg': '#F59E0B',
    '--color-button-yellow-hover': '#D97706',
    '--color-button-indigo-bg': '#6366F1',
    '--color-button-indigo-hover': '#4F46E5',
    '--color-button-text': '#FFFFFF',
    '--color-modal-bg': '#374151',
    '--color-modal-text': '#E5E7EB',
    '--color-modal-input-bg': '#4B5563',
    '--color-modal-input-text': '#E5E7EB',
    '--color-table-th-bg': '#374151',
    '--color-table-th-text': '#F9FAFB',
    '--color-table-td-border': '#4B5563',
    '--color-table-row-even-bg': '#2D3748',
    '--color-message-box-bg-success': '#10B981',
    '--color-message-box-bg-error': '#EF4444'
  };

  // Extract color variables from themeData - handle both direct and nested formats
  const sourceColors = themeData.variables || themeData;

  // Build theme data with validation - use provided values or defaults
  const validatedColors = {};
  Object.keys(colorVariables).forEach(key => {
    const value = sourceColors[key];
    if (value !== undefined && value !== null && value !== '') {
      validatedColors[key] = value;
    } else {
      validatedColors[key] = colorVariables[key];
      console.warn(`DEBUG: Using default value for ${key}: ${colorVariables[key]}`);
    }
  });

  console.log('DEBUG: Validated colors:', validatedColors);

  // Prepare theme data for saving
  const themeToSave = {
    name: themeData.name.trim(),
    isCustom: true,
    authorId: firebaseAuth.currentUser.uid,
    authorEmail: firebaseAuth.currentUser.email,
    authorDisplayName: firebaseAuth.currentUser.displayName || firebaseAuth.currentUser.email,
    authorHandle: firebaseAuth.currentUser.handle || firebaseAuth.currentUser.email?.split('@')[0] || 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...validatedColors // Spread the validated colors
  };

  try {
    let docRef;

    if (themeData.id && themeData.id !== 'null' && themeData.id !== null) {
      // Update existing theme
      console.log(`DEBUG: Updating existing theme with ID: ${themeData.id}`);
      docRef = doc(customThemesCol, themeData.id);
      await setDoc(docRef, {
        ...themeToSave,
        updatedAt: new Date()
      }, {merge: true});
      console.log(`Updated custom theme: ${themeData.id}`);

      // Clear cache to force refresh
      availableThemesCache = null;
      return themeData.id; // Return existing ID
    } else {
      // Create new theme with auto-generated ID
      console.log(`DEBUG: Creating new theme with auto-generated ID`);
      docRef = await addDoc(customThemesCol, themeToSave);
      console.log(`Created new custom theme: ${docRef.id}`);

      // Clear cache to force refresh
      availableThemesCache = null;
      return docRef.id; // Return new document ID
    }
  } catch (error) {
    console.error("Error saving custom theme:", error);
    return false;
  }
}

/**
 * Deletes a custom theme from Firestore.
 * @param {string} themeId - The ID of the theme to delete.
 * @returns {Promise<boolean>} Success status.
 */
export async function deleteCustomTheme(themeId) {
  // Use the proper Firebase instances - fall back to global ones if themesDb/themesAuth not set
  const firestoreDb = themesDb || db;
  const firebaseAuth = themesAuth || auth;
  const appIdentifier = themesAppId || appId;

  if (!firestoreDb || !firebaseAuth.currentUser) {
    console.error("Not authenticated or database not ready for deleteCustomTheme.");
    return false;
  }

  const themeDocRef = doc(firestoreDb, `artifacts/${appIdentifier}/public/data/custom_themes`, themeId);
  try {
    await deleteDoc(themeDocRef);
    availableThemesCache = null; // Clear cache
    console.log(`Deleted custom theme: ${themeId}`);
    return true;
  } catch (error) {
    console.error("Error deleting custom theme:", error);
    return false;
  }
}

/**
 * Initialize themes globally for all pages
 */
export async function initializeGlobalThemes() {
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
