import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// These variables will be set by the setup function from settings.html
let _db;
let _auth;
let _appId;
let _showMessageBox;
let _populateThemeSelectCallback;
let _userThemeSelect; // Added to update dropdown value after save/delete
let _defaultThemeName; // Added for fallback theme after delete
let _currentUser; // To manage current user for theme saving

// DOM Elements - These will be globally accessible within this module
const customThemeModal = document.getElementById('custom-theme-modal');
const customThemeModalTitle = document.getElementById('custom-theme-modal-title');
const customThemeNameInput = document.getElementById('custom-theme-name');
const saveCustomThemeBtn = document.getElementById('save-custom-theme-btn');
const customConfirmModal = document.getElementById('custom-confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmSubmessage = document.getElementById('confirm-submessage');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');
const customThemeListTbody = document.getElementById('custom-theme-list-tbody');
const createCustomThemeBtn = document.getElementById('create-custom-theme-btn'); // For event listener attachment

let currentEditingCustomThemeId = null; // To store the ID of the theme being edited

/**
 * Initializes the custom theme management module with necessary Firebase and DOM references.
 * This function should be called once from settings.html after Firebase is initialized.
 * @param {Firestore} dbInstance
 * @param {Auth} authInstance
 * @param {string} appIdValue
 * @param {function(string, boolean)} showMessageBoxFunc - Reference to settings.html's showMessageBox
 * @param {function()} populateThemeSelectFunc - Reference to settings.html's populateThemeSelect
 * @param {HTMLSelectElement} userThemeSelectElement - Reference to the main theme select dropdown
 * @param {string} defaultThemeName - Default theme name
 * @param {User} currentUser - Current authenticated user
 */
export function setupCustomThemeManagement(dbInstance, authInstance, appIdValue, showMessageBoxFunc, populateThemeSelectFunc, userThemeSelectElement, defaultThemeName, currentUser) {
  _db = dbInstance;
  _auth = authInstance;
  _appId = appIdValue;
  _showMessageBox = showMessageBoxFunc;
  _populateThemeSelectCallback = populateThemeSelectFunc;
  _userThemeSelect = userThemeSelectElement;
  _defaultThemeName = defaultThemeName;
  _currentUser = currentUser;

  // Set up event listeners for custom theme actions
  if (createCustomThemeBtn) {
    createCustomThemeBtn.addEventListener('click', () => openCustomThemeModal());
  }

  if (saveCustomThemeBtn) {
    saveCustomThemeBtn.addEventListener('click', async () => {
      const themeName = customThemeNameInput.value.trim();
      if (!themeName) {
        _showMessageBox("Theme name cannot be empty.", true);
        return;
      }

      const themeProperties = getThemePropertiesFromInputs();
      const themeData = {
        name: themeName,
        isCustom: true,
        properties: themeProperties
      };

      const success = await saveCustomTheme(currentEditingCustomThemeId, themeData);
      if (success) {
        customThemeModal.style.display = 'none';
        _populateThemeSelectCallback(); // Re-populate dropdown in settings.html
        renderCustomThemeList();

        // After saving, find the theme (newly created or updated) and apply it if user is logged in
        if (_auth.currentUser) {
          // Re-fetch themes to ensure `window.getAvailableThemes` is updated with the new custom theme
          await window.getAvailableThemes();
          const savedTheme = (await window.getAvailableThemes()).find(t => t.name === themeName && t.isCustom);
          if (savedTheme) {
            // Call updateUserProfileInFirestore from settings.html
            if (window.updateUserProfileInFirestore) { // Check if function is globally available
              await window.updateUserProfileInFirestore(_auth.currentUser.uid, { themePreference: savedTheme.id });
            }
            _userThemeSelect.value = savedTheme.id; // Update main settings dropdown
            window.applyTheme(savedTheme.id, savedTheme); // Apply immediately
          } else {
            // Fallback if saved theme not found (should be rare)
            const userProfile = await window.getUserProfileFromFirestore(_auth.currentUser.uid);
            window.applyTheme(userProfile?.themePreference || _defaultThemeName);
          }
        }
      }
    });
  }

  // Close modal buttons
  document.querySelectorAll('.modal .close-button').forEach(button => {
    button.addEventListener('click', (e) => {
      e.target.closest('.modal').style.display = 'none';
    });
  });

  // Close modal when clicking outside content
  window.addEventListener('click', (event) => {
    if (event.target === customThemeModal) {
      customThemeModal.style.display = 'none';
    }
    if (event.target === customConfirmModal) {
      customConfirmModal.style.display = 'none';
    }
  });
}

/**
 * Shows a custom confirmation modal.
 * @param {string} message - The main confirmation message.
 * @param {string} [subMessage=''] - An optional sub-message.
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled.
 */
async function showCustomConfirm(message, subMessage = '') {
  return new Promise(resolve => {
    confirmMessage.textContent = message;
    confirmSubmessage.textContent = subMessage;
    customConfirmModal.style.display = 'flex';

    const onConfirm = () => {
      customConfirmModal.style.display = 'none';
      confirmYesBtn.removeEventListener('click', onConfirm);
      confirmNoBtn.removeEventListener('click', onCancel);
      resolve(true);
    };

    const onCancel = () => {
      customConfirmModal.style.display = 'none';
      confirmYesBtn.removeEventListener('click', onConfirm);
      confirmNoBtn.removeEventListener('click', onCancel);
      resolve(false);
    };

    confirmYesBtn.addEventListener('click', onConfirm);
    confirmNoBtn.addEventListener('click', onCancel);
  });
}

/**
 * Saves a new or updates an existing custom theme in Firestore.
 * @param {string|null} themeId The ID of the theme to update, or null for new theme.
 * @param {object} themeData The theme data including name and properties.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function saveCustomTheme(themeId, themeData) {
  if (!_db) {
    _showMessageBox("Database not initialized. Cannot save custom theme.", true);
    return false;
  }
  try {
    if (themeId) {
      const themeDocRef = doc(_db, `artifacts/${_appId}/public/data/custom_themes`, themeId);
      await setDoc(themeDocRef, themeData, { merge: true });
      _showMessageBox("Custom theme updated successfully!", false);
    } else {
      const themesCollectionRef = collection(_db, `artifacts/${_appId}/public/data/custom_themes`);
      // Before adding, check if a theme with the same name already exists
      const existingThemes = await getDocs(themesCollectionRef);
      const nameExists = existingThemes.docs.some(doc => doc.data().name.toLowerCase() === themeData.name.toLowerCase());

      if (nameExists) {
        _showMessageBox(`A custom theme named "${themeData.name}" already exists. Please choose a different name or edit the existing one.`, true);
        return false;
      }

      await addDoc(themesCollectionRef, themeData);
      _showMessageBox("Custom theme created successfully!", false);
    }
    return true;
  } catch (error) {
    console.error("Error saving custom theme:", error);
    _showMessageBox(`Error saving custom theme: ${error.message}`, true);
    return false;
  }
}

/**
 * Deletes a custom theme from Firestore.
 * @param {string} themeId The ID of the theme to delete.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function deleteCustomTheme(themeId) {
  if (!_db) {
    _showMessageBox("Database not initialized. Cannot delete custom theme.", true);
    return false;
  }

  const confirmation = await showCustomConfirm(`Are you sure you want to delete this custom theme?`, "This action cannot be undone.");
  if (!confirmation) {
    _showMessageBox("Deletion cancelled.", false);
    return false;
  }

  const themeDocRef = doc(_db, `artifacts/${_appId}/public/data/custom_themes`, themeId);
  try {
    await deleteDoc(themeDocRef);
    _showMessageBox("Custom theme deleted successfully!", false);
    return true;
  } catch (error) {
    console.error("Error deleting custom theme:", error);
    _showMessageBox(`Error deleting custom theme: ${error.message}`, true);
    return false;
  }
}

/**
 * Renders the list of custom themes in the table.
 */
export async function renderCustomThemeList() {
  customThemeListTbody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-secondary">Loading custom themes...</td></tr>';
  const allThemes = await window.getAvailableThemes();
  const customThemes = allThemes.filter(theme => theme.isCustom);
  customThemeListTbody.innerHTML = '';

  if (customThemes.length === 0) {
    customThemeListTbody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-secondary">No custom themes created yet.</td></tr>';
    return;
  }

  customThemes.forEach(theme => {
    const row = customThemeListTbody.insertRow();
    row.innerHTML = `
                  <td class="px-4 py-2 text-primary">${theme.name}</td>
                  <td class="px-4 py-2">
                      <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm mr-2 edit-custom-theme-btn" data-theme-id="${theme.id}">Edit</button>
                      <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm delete-custom-theme-btn" data-theme-id="${theme.id}">Delete</button>
                  </td>
              `;
  });

  // Add event listeners for edit and delete buttons
  document.querySelectorAll('.edit-custom-theme-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      const themeId = event.target.dataset.themeId;
      const allThemes = await window.getAvailableThemes();
      const themeToEdit = allThemes.find(t => t.id === themeId);
      if (themeToEdit) {
        openCustomThemeModal(themeToEdit);
      } else {
        _showMessageBox("Theme not found for editing.", true);
      }
    });
  });

  document.querySelectorAll('.delete-custom-theme-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      const themeId = event.target.dataset.themeId;
      const success = await deleteCustomTheme(themeId);
      if (success) {
        _populateThemeSelectCallback(); // Re-populate dropdown in settings.html
        renderCustomThemeList(); // Re-render list
        // After deletion, if the deleted theme was selected, revert to default
        if (_userThemeSelect.value === themeId) {
          _userThemeSelect.value = _defaultThemeName;
          window.applyTheme(_defaultThemeName);
          if (_auth.currentUser) {
            // Call updateUserProfileInFirestore from settings.html
            if (window.updateUserProfileInFirestore) {
              await window.updateUserProfileInFirestore(_auth.currentUser.uid, { themePreference: _defaultThemeName });
            }
          }
        }
      }
    });
  });
}

/**
 * Opens the custom theme creation/editing modal.
 * @param {object|null} themeData Optional. The theme object to populate for editing.
 */
export function openCustomThemeModal(themeData = null) {
  // Get all color input elements in the modal
  const colorInputs = document.querySelectorAll('#custom-theme-modal input[type="color"]');

  if (themeData) {
    customThemeModalTitle.textContent = 'Edit Custom Theme';
    customThemeNameInput.value = themeData.name;
    currentEditingCustomThemeId = themeData.id;
    // Populate color inputs from themeData.properties
    colorInputs.forEach(input => {
      // Convert id like 'theme-body-bg' to 'bodyBg'
      const propertyName = input.id.replace('theme-', '').replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      if (themeData.properties.hasOwnProperty(propertyName)) {
        input.value = themeData.properties[propertyName];
      } else {
        // Fallback to default if property is missing in existing theme
        input.value = window.DEFAULT_CUSTOM_THEME_PROPERTIES[propertyName] || '#000000';
      }
    });
  } else {
    customThemeModalTitle.textContent = 'Create Custom Theme';
    customThemeNameInput.value = '';
    currentEditingCustomThemeId = null;
    // Set default colors from themes.js for new theme
    const defaultProps = window.DEFAULT_CUSTOM_THEME_PROPERTIES;
    colorInputs.forEach(input => {
      const propertyName = input.id.replace('theme-', '').replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      if (defaultProps.hasOwnProperty(propertyName)) {
        input.value = defaultProps[propertyName];
      } else {
        input.value = '#000000'; // Fallback for any truly missing default
      }
    });
  }
  customThemeModal.style.display = 'flex';
}

// Function to extract theme properties from modal inputs (local to this module)
function getThemePropertiesFromInputs() {
  const properties = {};
  const colorInputs = document.querySelectorAll('#custom-theme-modal input[type="color"]');
  colorInputs.forEach(input => {
    // Convert id like 'theme-body-bg' to 'bodyBg'
    const propertyName = input.id.replace('theme-', '').replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    properties[propertyName] = input.value;
  });
  return properties;
}
