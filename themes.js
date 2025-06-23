// themes.js: Handles theme management, including default themes and custom user themes stored in Firestore.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let dbInstance;
let authInstance;
let appIdValue;
let firebaseInitialized = false;

// Cache for themes to avoid repeated Firestore reads
let themeCache = null;

// Define default themes with their CSS variables
const DEFAULT_THEMES = [
  {
    id: 'dark',
    name: 'Dark Theme',
    variables: {
      '--color-body-bg': '#1F2937',
      '--color-text-primary': '#E5E7EB',
      '--color-text-secondary': '#9CA3AF',
      '--color-link': '#60A5FA',
      '--color-link-hover': '#3B82F6',
      '--color-bg-navbar': '#111827',
      '--color-bg-content-section': '#1F2937',
      '--color-bg-card': '#2D3748',
      '--color-heading-main': '#F9FAFB',
      '--color-heading-card': '#93C5FD',
      '--color-input-bg': '#374151',
      '--color-input-text': '#E5E7EB',
      '--color-input-border': '#4B5563',
      '--color-placeholder': '#9CA3AF',
      '--color-button-text': '#FFFFFF',
      '--color-button-blue-bg': '#3B82F6',
      '--color-button-blue-hover': '#2563EB',
      '--color-button-green-bg': '#10B981',
      '--color-button-green-hover': '#059669',
      '--color-button-red-bg': '#EF4444',
      '--color-button-red-hover': '#DC2626',
      '--color-button-purple-bg': '#9333EA',
      '--color-button-purple-hover': '#7E22CE',
      '--color-button-yellow-bg': '#FBBF24',
      '--color-button-yellow-hover': '#D97706',
      '--color-button-orange-bg': '#F97316',
      '--color-button-orange-hover': '#EA580C',
      '--color-button-indigo-bg': '#6366F1',
      '--color-button-indigo-hover': '#4F46E5',
      '--color-table-th-bg': '#1F2937',
      '--color-table-th-text': '#E5E7EB',
      '--color-table-td-border': '#4B5563',
      '--color-table-row-even-bg': '#374151',
      '--color-modal-bg': '#2D3748',
      '--color-modal-text': '#E5E7EB',
      '--color-modal-input-bg': '#374151',
      '--color-modal-input-text': '#E5E7EB',
      '--color-message-box-bg-success': '#4CAF50',
      '--color-message-box-bg-error': '#F44336',
      '--font-family-body': 'Inter, sans-serif' // Default font family
    },
    isCustom: false
  },
  {
    id: 'light',
    name: 'Light Theme',
    variables: {
      '--color-body-bg': '#F3F4F6',
      '--color-text-primary': '#1F2937',
      '--color-text-secondary': '#6B7280',
      '--color-link': '#2563EB',
      '--color-link-hover': '#1D4ED8',
      '--color-bg-navbar': '#E5E7EB',
      '--color-bg-content-section': '#F3F4F6',
      '--color-bg-card': '#FFFFFF',
      '--color-heading-main': '#111827',
      '--color-heading-card': '#3B82F6',
      '--color-input-bg': '#FFFFFF',
      '--color-input-text': '#1F2937',
      '--color-input-border': '#D1D5DB',
      '--color-placeholder': '#9CA3AF',
      '--color-button-text': '#FFFFFF',
      '--color-button-blue-bg': '#3B82F6',
      '--color-button-blue-hover': '#2563EB',
      '--color-button-green-bg': '#10B981',
      '--color-button-green-hover': '#059669',
      '--color-button-red-bg': '#EF4444',
      '--color-button-red-hover': '#DC2626',
      '--color-button-purple-bg': '#9333EA',
      '--color-button-purple-hover': '#7E22CE',
      '--color-button-yellow-bg': '#FBBF24',
      '--color-button-yellow-hover': '#D97706',
      '--color-button-orange-bg': '#F97316',
      '--color-button-orange-hover': '#EA580C',
      '--color-button-indigo-bg': '#6366F1',
      '--color-button-indigo-hover': '#4F46E5',
      '--color-table-th-bg': '#E5E7EB',
      '--color-table-th-text': '#111827',
      '--color-table-td-border': '#D1D5DB',
      '--color-table-row-even-bg': '#F9FAFB',
      '--color-modal-bg': '#FFFFFF',
      '--color-modal-text': '#1F2937',
      '--color-modal-input-bg': '#F3F4F6',
      '--color-modal-input-text': '#1F2937',
      '--color-message-box-bg-success': '#4CAF50',
      '--color-message-box-bg-error': '#F44336',
      '--font-family-body': 'Inter, sans-serif'
    },
    isCustom: false
  },
  {
    id: 'arcator-green',
    name: 'Arcator Green',
    variables: {
      '--color-body-bg': '#1A3E2F', /* Dark Green */
      '--color-text-primary': '#EBFBEB', /* Light Off-White */
      '--color-text-secondary': '#A3C7B5', /* Muted Green */
      '--color-link': '#34D399', /* Green Link */
      '--color-link-hover': '#10B981', /* Darker Green Link Hover */
      '--color-bg-navbar': '#0D2F22', /* Very Dark Green Navbar */
      '--color-bg-content-section': '#1A3E2F', /* Dark Green Content */
      '--color-bg-card': '#254D3D', /* Slightly Lighter Dark Green Card */
      '--color-heading-main': '#DCFCE7', /* Very Light Green Heading */
      '--color-heading-card': '#6EE7B7', /* Light Green Heading */
      '--color-input-bg': '#305C4D', /* Greenish Input Background */
      '--color-input-text': '#EBFBEB', /* Light Input Text */
      '--color-input-border': '#4C7C6D', /* Muted Green Border */
      '--color-placeholder': '#7CA090', /* Even More Muted Green Placeholder */
      '--color-button-text': '#FFFFFF',
      '--color-button-blue-bg': '#34D399', /* Matches link green */
      '--color-button-blue-hover': '#10B981',
      '--color-button-green-bg': '#059669', /* Darker green */
      '--color-button-green-hover': '#047857',
      '--color-button-red-bg': '#F87171', /* Softer red */
      '--color-button-red-hover': '#EF4444',
      '--color-button-purple-bg': '#A78BFA',
      '--color-button-purple-hover': '#8B5CF6',
      '--color-button-yellow-bg': '#FBBF24',
      '--color-button-yellow-hover': '#D97706',
      '--color-button-orange-bg': '#F97316',
      '--color-button-orange-hover': '#EA580C',
      '--color-button-indigo-bg': '#6366F1',
      '--color-button-indigo-hover': '#4F46E5',
      '--color-table-th-bg': '#1A3E2F',
      '--color-table-th-text': '#EBFBEB',
      '--color-table-td-border': '#4C7C6D',
      '--color-table-row-even-bg': '#2C5242', /* Slightly different green for even rows */
      '--color-modal-bg': '#254D3D',
      '--color-modal-text': '#EBFBEB',
      '--color-modal-input-bg': '#305C4D',
      '--color-modal-input-text': '#EBFBEB',
      '--color-message-box-bg-success': '#34D399',
      '--color-message-box-bg-error': '#F87171',
      '--font-family-body': 'Inter, sans-serif'
    },
    isCustom: false
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    variables: {
      '--color-body-bg': '#0A192F', /* Deep Blue */
      '--color-text-primary': '#E0F2F7', /* Light Blue/Cyan */
      '--color-text-secondary': '#7ABACD', /* Muted Cyan */
      '--color-link': '#29B6F6', /* Bright Blue Link */
      '--color-link-hover': '#03A9F4', /* Darker Blue Link Hover */
      '--color-bg-navbar': '#061325', /* Very Dark Blue Navbar */
      '--color-bg-content-section': '#0A192F', /* Deep Blue Content */
      '--color-bg-card': '#1A2F4B', /* Slightly Lighter Deep Blue Card */
      '--color-heading-main': '#ADD8E6', /* Light Blue Heading */
      '--color-heading-card': '#81D4FA', /* Sky Blue Heading */
      '--color-input-bg': '#203E5F', /* Blueish Input Background */
      '--color-input-text': '#E0F2F7', /* Light Input Text */
      '--color-input-border': '#3A5F8A', /* Muted Blue Border */
      '--color-placeholder': '#608BA0', /* Even More Muted Blue Placeholder */
      '--color-button-text': '#FFFFFF',
      '--color-button-blue-bg': '#29B6F6', /* Matches link blue */
      '--color-button-blue-hover': '#03A9F4',
      '--color-button-green-bg': '#4CAF50', /* Standard green */
      '--color-button-green-hover': '#43A047',
      '--color-button-red-bg': '#EF5350', /* Standard red */
      '--color-button-red-hover': '#E53935',
      '--color-button-purple-bg': '#7E57C2',
      '--color-button-purple-hover': '#673AB7',
      '--color-button-yellow-bg': '#FFD54F',
      '--color-button-yellow-hover': '#FFC107',
      '--color-button-orange-bg': '#FF8A65',
      '--color-button-orange-hover': '#FF7043',
      '--color-button-indigo-bg': '#4F46E5',
      '--color-button-indigo-hover': '#4338CA',
      '--color-table-th-bg': '#0A192F',
      '--color-table-th-text': '#E0F2F7',
      '--color-table-td-border': '#3A5F8A',
      '--color-table-row-even-bg': '#142B47', /* Slightly different blue for even rows */
      '--color-modal-bg': '#1A2F4B',
      '--color-modal-text': '#E0F2F7',
      '--color-modal-input-bg': '#203E5F',
      '--color-modal-input-text': '#E0F2F7',
      '--color-message-box-bg-success': '#29B6F6',
      '--color-message-box-bg-error': '#EF5350',
      '--font-family-body': 'Inter, sans-serif' /* Default to Inter */
    },
    isCustom: false
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    variables: {
      '--color-body-bg': '#000000',
      '--color-text-primary': '#FFFFFF',
      '--color-text-secondary': '#F5F5F5',
      '--color-link': '#FFFF00', /* Yellow */
      '--color-link-hover': '#FFD700', /* Gold */
      '--color-bg-navbar': '#000000',
      '--color-bg-content-section': '#111111',
      '--color-bg-card': '#333333',
      '--color-heading-main': '#FFFFFF',
      '--color-heading-card': '#FFFFFF',
      '--color-input-bg': '#333333',
      '--color-input-text': '#FFFFFF',
      '--color-input-border': '#FFFF00', /* Yellow border */
      '--color-placeholder': '#CCCCCC',
      '--color-button-text': '#000000', /* Black text on bright buttons */
      '--color-button-blue-bg': '#FFFF00',
      '--color-button-blue-hover': '#FFD700',
      '--color-button-green-bg': '#00FF00',
      '--color-button-green-hover': '#00CC00',
      '--color-button-red-bg': '#FF0000',
      '--color-button-red-hover': '#CC0000',
      '--color-button-purple-bg': '#FF00FF',
      '--color-button-purple-hover': '#CC00CC',
      '--color-button-yellow-bg': '#FFFF00',
      '--color-button-yellow-hover': '#FFD700',
      '--color-button-orange-bg': '#FFA500',
      '--color-button-orange-hover': '#CC8400',
      '--color-button-indigo-bg': '#4B0082', /* Dark Indigo */
      '--color-button-indigo-hover': '#3A0066', /* Darker Indigo */
      '--color-table-th-bg': '#000000',
      '--color-table-th-text': '#FFFFFF',
      '--color-table-td-border': '#FFFFFF',
      '--color-table-row-even-bg': '#111111',
      '--color-modal-bg': '#333333',
      '--color-modal-text': '#FFFFFF',
      '--color-modal-input-bg': '#111111',
      '--color-modal-input-text': '#FFFFFF',
      '--color-message-box-bg-success': '#00FF00',
      '--color-message-box-bg-error': '#FF0000',
      '--font-family-body': 'Inter, sans-serif' /* Default to Inter */
    },
    isCustom: false
  }
];

const CUSTOM_THEMES_COLLECTION = 'custom_themes';

/**
 * Initializes the Firebase instances for themes.js.
 * Must be called once Firebase is initialized in your main script.
 * @param {Firestore} db - The Firestore instance.
 * @param {Auth} auth - The Firebase Auth instance.
 * @param {string} appId - The application ID.
 */
export function setupThemesFirebase(db, auth, appId) {
  dbInstance = db;
  authInstance = auth;
  appIdValue = appId;
  firebaseInitialized = true;
  console.log("DEBUG: Themes Firebase setup complete.");
}

/**
 * Fetches all available themes, including default and user-defined custom themes.
 * Results are cached for performance.
 * @returns {Promise<Array>} A promise that resolves with an array of theme objects.
 */
export async function getAvailableThemes() {
  if (themeCache) {
    console.log("DEBUG: Returning themes from cache.");
    return themeCache;
  }

  let customThemes = [];
  // Ensure firebaseInitialized is true, and dbInstance/authInstance are set
  // This check is crucial for modules that might call getAvailableThemes early
  if (firebaseInitialized && dbInstance && authInstance) {
    try {
      // Only fetch custom themes if a user is logged in
      const userId = authInstance.currentUser?.uid;
      if (userId) {
        const customThemesRef = collection(dbInstance, `artifacts/${appIdValue}/users/${userId}/${CUSTOM_THEMES_COLLECTION}`);
        const querySnapshot = await getDocs(customThemesRef);
        querySnapshot.forEach(doc => {
          customThemes.push({ id: doc.id, ...doc.data(), isCustom: true });
        });
        console.log("DEBUG: Fetched custom themes:", customThemes.length);
      }
    } catch (error) {
      console.error("Error fetching custom themes:", error);
      // Do not block if custom themes fail, proceed with default themes
    }
  } else {
    console.warn("Themes module: Firebase instances not yet available for fetching custom themes. Returning only default themes.");
  }

  themeCache = [...DEFAULT_THEMES, ...customThemes];
  return themeCache;
}

/**
 * Applies the specified theme to the document's root element by setting CSS variables.
 * @param {string} themeId - The ID of the theme to apply.
 * @param {object} [themeObject=null] - Optional. The full theme object if already available.
 */
export async function applyTheme(themeId, themeObject = null) {
  const root = document.documentElement;
  let themeToApply;

  if (themeObject) {
    themeToApply = themeObject;
  } else {
    const allThemes = await getAvailableThemes();
    themeToApply = allThemes.find(theme => theme.id === themeId);

    // Fallback to default theme if the requested theme is not found
    if (!themeToApply) {
      // DEFAULT_THEME_NAME is ideally imported from firebase-init.js in the main script
      // For robustness, find 'dark' theme as a hardcoded fallback if DEFAULT_THEME_NAME fails too.
      themeToApply = allThemes.find(theme => theme.id === 'dark') || DEFAULT_THEMES[0];
      console.warn(`Theme '${themeId}' not found, applying fallback default theme: ${themeToApply.name}.`);
    }
  }

  // Apply CSS variables
  for (const [key, value] of Object.entries(themeToApply.variables)) {
    root.style.setProperty(key, value);
  }

  // Apply font family directly to body if it changes
  const currentFontFamily = getComputedStyle(document.body).fontFamily;
  if (currentFontFamily !== themeToApply.variables['--font-family-body']) {
    document.body.style.fontFamily = themeToApply.variables['--font-family-body'];
  }


  // Update body class for theme-specific CSS rules (e.g., background patterns, general styles)
  // Remove all existing theme- and pattern- classes first
  // Ensure we don't remove essential system classes
  const bodyClasses = Array.from(document.body.classList);
  bodyClasses.forEach(cls => {
    if (cls.startsWith('theme-') || cls.startsWith('pattern-')) {
      document.body.classList.remove(cls);
    }
  });
  // Add the new theme class
  document.body.classList.add(`theme-${themeToApply.id}`);

  // Apply background pattern if specified
  const backgroundPattern = themeToApply.backgroundPattern;
  if (backgroundPattern && backgroundPattern !== 'none') {
    document.body.classList.add(`pattern-${backgroundPattern}`);
  }
  console.log(`Applied theme: ${themeToApply.name} (${themeToApply.id})`);
}

/**
 * Saves a custom theme to Firestore for the current user.
 * @param {object} themeData - The theme object to save. Must include name and variables.
 * @returns {Promise<boolean>} True if saved successfully, false otherwise.
 */
export async function saveCustomTheme(themeData) {
  if (!firebaseInitialized || !dbInstance || !authInstance.currentUser) {
    console.error("Firebase not initialized or user not logged in. Cannot save custom theme.");
    return false;
  }
  const userId = authInstance.currentUser.uid;
  const customThemesRef = collection(dbInstance, `artifacts/${appIdValue}/users/${userId}/${CUSTOM_THEMES_COLLECTION}`);

  try {
    if (themeData.id) {
      // Update existing theme
      const docRef = doc(dbInstance, `artifacts/${appIdValue}/users/${userId}/${CUSTOM_THEMES_COLLECTION}`, themeData.id);
      await setDoc(docRef, themeData, { merge: true }); // Use merge to avoid overwriting other fields
      console.log("Updated custom theme:", themeData.id);
    } else {
      // Add new theme
      const newDocRef = await addDoc(customThemesRef, themeData);
      themeData.id = newDocRef.id; // Assign the new ID back to the object
      console.log("Added new custom theme:", newDocRef.id);
    }
    themeCache = null; // Invalidate cache to force reload
    await getAvailableThemes(); // Re-populate cache with new data
    return true;
  } catch (error) {
    console.error("Error saving custom theme:", error);
    return false;
  }
}

/**
 * Deletes a custom theme from Firestore for the current user.
 * @param {string} themeId - The ID of the theme to delete.
 * @returns {Promise<boolean>} True if deleted successfully, false otherwise.
 */
export async function deleteCustomTheme(themeId) {
  if (!firebaseInitialized || !dbInstance || !authInstance.currentUser) {
    console.error("Firebase not initialized or user not logged in. Cannot delete custom theme.");
    return false;
  }
  const userId = authInstance.currentUser.uid;
  const docRef = doc(dbInstance, `artifacts/${appIdValue}/users/${userId}/${CUSTOM_THEMES_COLLECTION}`, themeId);

  try {
    await deleteDoc(docRef);
    console.log("Deleted custom theme:", themeId);
    themeCache = null; // Invalidate cache
    await getAvailableThemes(); // Re-populate cache
    return true;
  } catch (error) {
    console.error("Error deleting custom theme:", error);
    return false;
  }
}
