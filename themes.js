import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment
const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfigString = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const firebaseConfig = JSON.parse(firebaseConfigString);
const appId = canvasAppId; // Use the provided __app_id

let app;
let auth;
let db;
let isFirebaseInitialized = false;

// Initialize Firebase
try {
  // Only initialize if firebaseConfig is not empty
  if (Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseInitialized = true;
    console.log("Firebase initialized in themes.js.");
  } else {
    console.warn("Firebase configuration is empty in themes.js. Theme features requiring Firestore will be disabled.");
  }
} catch (e) {
  console.error("Error initializing Firebase in themes.js:", e);
  isFirebaseInitialized = false;
}

// Predefined themes
const PREDEFINED_THEMES = {
  'dark': {
    id: 'dark',
    name: 'Dark',
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
      inputBorder: '#4B5563',
      placeholder: '#9CA3AF',
      tableThBg: '#374151',
      tableThText: '#F87171',
      tableTdBorder: '#374151',
      tableRowEvenBg: '#2F3B4E',
      link: '#60A5FA',
      buttonText: 'white',
      buttonBlueBg: '#2563EB',
      buttonBlueHover: '#1D4ED8',
      buttonRedBg: '#DC2626',
      buttonRedHover: '#B91C1C',
      buttonGreenBg: '#16A34A',
      buttonGreenHover: '#15803D',
      buttonYellowBg: '#D97706',
      buttonYellowHover: '#B45309',
      buttonPurpleBg: '#9333EA',
      buttonPurpleHover: '#7E22CE',
      buttonIndigoBg: '#4F46E5',
      buttonIndigoHover: '#4338CA',
      buttonTealBg: '#0D9488',
      buttonTealHover: '#0F766E',
      messageBoxBgSuccess: '#4CAF50',
      messageBoxBgError: '#F44336',
      modalBg: '#2D3748',
      modalText: '#E5E7EB',
      modalInputBg: '#374151',
      modalInputText: '#E5E7EB'
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
      headingMain: '#DC2626',
      headingCard: '#2563EB',
      bgNavbar: '#E5E7EB',
      bgContentSection: '#F9FAFB',
      bgCard: '#FFFFFF',
      bgIpBox: '#E2E8F0',
      borderIpBox: '#CBD5E0',
      inputBg: '#FFFFFF',
      inputText: '#1F2937',
      inputBorder: '#D1D5DB',
      placeholder: '#6B7280',
      tableThBg: '#E0E0E0',
      tableThText: '#4B5563',
      tableTdBorder: '#E0E0E0',
      tableRowEvenBg: '#F0F0F0',
      link: '#2563EB',
      buttonText: 'white',
      buttonBlueBg: '#2563EB',
      buttonBlueHover: '#1D4ED8',
      buttonRedBg: '#DC2626',
      buttonRedHover: '#B91C1C',
      buttonGreenBg: '#16A34A',
      buttonGreenHover: '#15803D',
      buttonYellowBg: '#D97706',
      buttonYellowHover: '#B45309',
      buttonPurpleBg: '#9333EA',
      buttonPurpleHover: '#7E22CE',
      buttonIndigoBg: '#4F46E5',
      buttonIndigoHover: '#4338CA',
      buttonTealBg: '#0D9488',
      buttonTealHover: '#0F766E',
      messageBoxBgSuccess: '#4CAF50',
      messageBoxBgError: '#F44336',
      modalBg: '#FFFFFF',
      modalText: '#1F2937',
      modalInputBg: '#FFFFFF',
      modalInputText: '#1F2937'
    }
  },
  'arcator-blue': {
    id: 'arcator-blue',
    name: 'Arcator Blue',
    isCustom: false,
    properties: {
      bodyBg: '#1a202c',
      textPrimary: '#E2E8F0',
      textSecondary: '#CBD5E0',
      headingMain: '#FC8181',
      headingCard: '#63B3ED',
      bgNavbar: '#111827',
      bgContentSection: '#1a202c',
      bgCard: '#2b3b55',
      bgIpBox: '#1A253A',
      borderIpBox: '#3B82F6',
      inputBg: '#3b4d6b',
      inputText: '#E2E8F0',
      inputBorder: '#5a6e8f',
      placeholder: '#94A3B8',
      tableThBg: '#3b4d6b',
      tableThText: '#90CDF4',
      tableTdBorder: '#374151',
      tableRowEvenBg: '#2F3B4E',
      link: '#63B3ED',
      buttonText: 'white',
      buttonBlueBg: '#4299E1',
      buttonBlueHover: '#3182CE',
      buttonRedBg: '#FC8181',
      buttonRedHover: '#E53E3E',
      buttonGreenBg: '#48BB78',
      buttonGreenHover: '#38A169',
      buttonYellowBg: '#ECC94B',
      buttonYellowHover: '#D69E2E',
      buttonPurpleBg: '#9F7AEA',
      buttonPurpleHover: '#805AD5',
      buttonIndigoBg: '#667EEA',
      buttonIndigoHover: '#5A67D8',
      buttonTealBg: '#38B2AC',
      buttonTealHover: '#319795',
      messageBoxBgSuccess: '#4CAF50',
      messageBoxBgError: '#F44336',
      modalBg: '#2b3b55',
      modalText: '#E2E8F0',
      modalInputBg: '#3b4d6b',
      modalInputText: '#E2E8F0'
    }
  }
};

let customThemes = {}; // Stores fetched custom themes

/**
 * Fetches custom themes from Firestore.
 * @returns {Promise<Object>} A dictionary of custom themes.
 */
async function fetchCustomThemes() {
  if (!isFirebaseInitialized || !db) {
    console.warn("Firebase not initialized or DB is null. Cannot fetch custom themes.");
    return {};
  }
  const themesCollectionRef = collection(db, `artifacts/${appId}/public/data/custom_themes`);
  const fetchedThemes = {};
  try {
    const querySnapshot = await getDocs(themesCollectionRef);
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      fetchedThemes[docSnap.id] = {
        id: docSnap.id,
        name: data.name || docSnap.id,
        isCustom: true,
        properties: data.properties || {}
      };
    });
    console.log("Custom themes fetched:", fetchedThemes);
  } catch (error) {
    console.error("Error fetching custom themes:", error);
  }
  return fetchedThemes;
}

/**
 * Applies a given theme to the document by setting CSS variables.
 * @param {string} themeId The ID of the theme to apply (e.g., 'dark', 'my-custom-theme').
 * @param {object} [themeData=null] Optional. The theme object itself. If not provided,
 * it will attempt to find the theme in PREDEFINED_THEMES or customThemes.
 */
window.applyTheme = function(themeId, themeData = null) {
  let activeTheme = themeData;

  if (!activeTheme) {
    activeTheme = PREDEFINED_THEMES[themeId];
    if (!activeTheme) {
      // Fetch from custom themes if not found in predefined
      activeTheme = customThemes[themeId];
    }
  }

  if (activeTheme && activeTheme.properties) {
    console.log(`Applying theme: ${activeTheme.name || themeId}`);
    for (const key in activeTheme.properties) {
      if (activeTheme.properties.hasOwnProperty(key)) {
        document.documentElement.style.setProperty(`--color-${camelToKebab(key)}`, activeTheme.properties[key]);
      }
    }
    // Add or remove theme-specific body classes for any special background-image logic
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-arcator-blue');
    if (activeTheme.id === 'dark') {
      document.body.classList.add('theme-dark');
    } else if (activeTheme.id === 'light') {
      document.body.classList.add('theme-light');
    } else if (activeTheme.id === 'arcator-blue') {
      document.body.classList.add('theme-arcator-blue');
    }
  } else {
    console.error(`Theme "${themeId}" not found or has no properties. Falling back to default dark.`);
    if (PREDEFINED_THEMES['dark']) {
      window.applyTheme('dark', PREDEFINED_THEMES['dark']);
    }
  }
};

/**
 * Converts camelCase to kebab-case (for CSS variables).
 * @param {string} camelCaseString
 * @returns {string} kebab-case string
 */
function camelToKebab(camelCaseString) {
  return camelCaseString.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Returns a combined list of predefined and custom themes.
 * @returns {Promise<Array<Object>>} An array of theme objects.
 */
window.getAvailableThemes = async function() {
  if (isFirebaseInitialized) {
    customThemes = await fetchCustomThemes();
  } else {
    console.warn("Firebase not initialized, cannot fetch custom themes for getAvailableThemes.");
    customThemes = {};
  }
  return [
    ...Object.values(PREDEFINED_THEMES),
    ...Object.values(customThemes)
  ];
};

// Auto-apply user's saved theme on page load using Firebase Auth
document.addEventListener('DOMContentLoaded', async () => {
  if (isFirebaseInitialized) {
    onAuthStateChanged(auth, async (user) => {
      let userThemePreference = null;
      if (user) {
        const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, user.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            userThemePreference = data.themePreference;
          }
        } catch (error) {
          console.error("Error fetching user profile for theme:", error);
        }
      }

      if (!userThemePreference && (!user || initialAuthToken)) {
        if (initialAuthToken) {
          try {
            await signInAnonymously(auth);
            console.log("Signed in anonymously for initial theme load (from themes.js).");
          } catch (error) {
            console.error("Anonymous sign-in failed during theme load (themes.js):", error);
          }
        }
      }

      await window.getAvailableThemes();
      window.applyTheme(userThemePreference || 'dark');
    });
  } else {
    window.applyTheme('dark');
  }
});

// Provide default properties for new custom themes (using dark theme as template)
window.DEFAULT_CUSTOM_THEME_PROPERTIES = PREDEFINED_THEMES['dark'].properties;
