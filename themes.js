// themes.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Internal variables to hold Firebase instances
let _db = null;
let _auth = null;
let _appId = null;

// Predefined themes (assuming these are constant and do not come from Firestore)
// These should match the default properties used in custom_theme_modal.js
const PREDEFINED_THEMES = {
  'dark': {
    id: 'dark',
    name: 'Dark (Default)',
    isCustom: false,
    properties: {
      bodyBg: '#1F2937',
      textPrimary: '#E5E7EB',
      textSecondary: '#CBD5E0',
      headingMain: '#F87171',
      headingCard: '#60A5FA',
      bgNavbar: '#111827',
      bgContentSection: '#1F2937',
      bgCard: '#2D3748',
      bgIpBox: '#1A202C',
      borderIpBox: '#4A5568',
      inputBg: '#374151',
      inputText: '#E5E7EB',
      InputBorder: '#4B5563',
      placeholder: '#9CA3AF',
      tableThBg: '#374151',
      tableThText: '#F87171',
      tableTdBorder: '#4A5568',
      tableRowEvenBg: '#2D3748',
      link: '#60A5FA',
      buttonText: '#FFFFFF',
      buttonBlueBg: '#3B82F6',
      buttonBlueHover: '#2563EB',
      buttonRedBg: '#EF4444',
      buttonRedHover: '#DC2626',
      buttonGreenBg: '#22C55E',
      buttonGreenHover: '#16A34A',
      buttonYellowBg: '#F59E0B',
      buttonYellowHover: '#D97706',
      buttonPurpleBg: '#8B5CF6',
      buttonPurpleHover: '#7C3AED',
      buttonIndigoBg: '#6366F1',
      buttonIndigoHover: '#4F46E5',
      buttonTealBg: '#14B8A6',
      buttonTealHover: '#0D9488',
      messageBoxBgSuccess: '#10B981', // green-500
      messageBoxBgError: '#EF4444', // red-500
      modalBg: '#2D3748', // Similar to card background
      modalText: '#E5E7EB',
      modalInputBg: '#374151',
      modalInputText: '#E5E7EB',
    }
  },
  'light': {
    id: 'light',
    name: 'Light',
    isCustom: false,
    properties: {
      bodyBg: '#F3F4F6',
      textPrimary: '#1F2937',
      textSecondary: '#4B5563',
      headingMain: '#EF4444',
      headingCard: '#2563EB',
      bgNavbar: '#FFFFFF',
      bgContentSection: '#F3F4F6',
      bgCard: '#FFFFFF',
      bgIpBox: '#E5E7EB',
      borderIpBox: '#D1D5DB',
      inputBg: '#FFFFFF',
      inputText: '#1F2937',
      InputBorder: '#D1D5DB',
      placeholder: '#9CA3AF',
      tableThBg: '#E5E7EB',
      tableThText: '#EF4444',
      tableTdBorder: '#D1D5DB',
      tableRowEvenBg: '#F9FAFB',
      link: '#2563EB',
      buttonText: '#FFFFFF',
      buttonBlueBg: '#3B82F6',
      buttonBlueHover: '#2563EB',
      buttonRedBg: '#EF4444',
      buttonRedHover: '#DC2626',
      buttonGreenBg: '#22C55E',
      buttonGreenHover: '#16A34A',
      buttonYellowBg: '#F59E0B',
      buttonYellowHover: '#D97706',
      buttonPurpleBg: '#8B5CF6',
      buttonPurpleHover: '#7C3AED',
      buttonIndigoBg: '#6366F1',
      buttonIndigoHover: '#4F46E5',
      buttonTealBg: '#14B8A6',
      buttonTealHover: '#0D9488',
      messageBoxBgSuccess: '#10B981', // green-500
      messageBoxBgError: '#EF4444', // red-500
      modalBg: '#FFFFFF',
      modalText: '#1F2937',
      modalInputBg: '#FFFFFF',
      modalInputText: '#1F2937',
    }
  }
  // Add more predefined themes as needed
};

// Provide default properties for new custom themes (using dark theme as template)
window.DEFAULT_CUSTOM_THEME_PROPERTIES = PREDEFINED_THEMES['dark'].properties;


/**
 * Sets up the Firebase instances for themes.js.
 * This should be called from settings.html after Firebase is initialized.
 * @param {Firestore} dbInstance
 * @param {Auth} authInstance
 * @param {string} appIdValue
 */
export function setupThemesFirebase(dbInstance, authInstance, appIdValue) {
  _db = dbInstance;
  _auth = authInstance; // Initialize _auth here
  _appId = appIdValue;
  console.log("Firebase DB and App ID set up in themes.js");
}

/**
 * Applies the specified theme to the document body by setting CSS variables.
 * @param {string} themeId - The ID of the theme to apply.
 * @param {object} [themeObject] - The full theme object (optional, will be fetched if not provided).
 */
window.applyTheme = async function(themeId, themeObject = null) {
  let themeToApply = themeObject;

  // If themeObject not provided, try to find it in predefined or custom themes
  if (!themeToApply) {
    const allThemes = await window.getAvailableThemes();
    themeToApply = allThemes.find(theme => theme.id === themeId);
  }

  // Fallback to dark theme if the requested theme is not found
  if (!themeToApply) {
    console.warn(`Theme '${themeId}' not found. Applying default dark theme.`);
    themeToApply = PREDEFINED_THEMES['dark'];
  }

  const body = document.body;
  // Clear existing theme classes
  body.className = '';
  // Add the new theme class
  body.classList.add(`theme-${themeToApply.id}`);

  // Apply CSS variables from the theme properties
  for (const prop in themeToApply.properties) {
    if (themeToApply.properties.hasOwnProperty(prop)) {
      // Convert camelCase to kebab-case for CSS variables
      const cssVarName = `--color-${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      body.style.setProperty(cssVarName, themeToApply.properties[prop]);
    }
  }
  console.log(`Applying theme: ${themeToApply.name || themeToApply.id}`);
};

/**
 * Fetches all available themes, including predefined and custom themes from Firestore.
 * @returns {Promise<Array>} A promise that resolves to an array of theme objects.
 */
window.getAvailableThemes = async function() {
  let allThemes = Object.values(PREDEFINED_THEMES); // Start with predefined themes

  if (_db && _appId) {
    console.log("DEBUG themes.js: _db value before calling collection:", _db);
    const themesCollectionRef = collection(_db, `artifacts/${_appId}/public/data/custom_themes`);
    try {
      const querySnapshot = await getDocs(themesCollectionRef);
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        allThemes.push({
          id: docSnap.id,
          name: data.name || docSnap.id,
          isCustom: true,
          properties: data.properties || {}
        });
      });
    } catch (error) {
      console.error("Error fetching custom themes:", error);
    }
  } else {
    console.warn("Firestore DB or App ID not available in themes.js. Cannot fetch custom themes.");
  }
  return allThemes;
};
