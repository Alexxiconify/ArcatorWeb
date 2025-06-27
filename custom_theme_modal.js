import { applyTheme, getAvailableThemes, saveCustomTheme, deleteCustomTheme } from './themes.js';

/**
 * Sets up the functionality for managing custom themes.
 * @param {Firestore} db - The Firestore instance.
 * @param {Auth} auth - The Firebase Auth instance.
 * @param {string} appId - The application ID.
 * @param {function} showMessageBox - Function to display messages.
 * @param {function} populateThemeSelect - Function to refresh the theme select dropdown in settings.js.
 * @param {HTMLElement} userThemeSelect - The main theme select element from settings.html.
 * @param {string} defaultThemeName - The ID of the default theme.
 * @param {User} currentUser - The currently authenticated Firebase user.
 * @param {function} showCustomConfirm - Function to show custom confirmation dialogs.
 */
export function setupCustomThemeManagement(db, auth, appId, showMessageBox, populateThemeSelect, userThemeSelect, defaultThemeName, currentUser, showCustomConfirm) {
  let currentCustomThemeId = null;

  // Ensure the modal HTML is added to the DOM if it's not already there
  const customThemeModal = document.getElementById('custom-theme-modal') || createCustomThemeModal();

  // Get DOM elements for the modal
  const closeButton = customThemeModal.querySelector('.close-button');
  const customThemeForm = document.getElementById('custom-theme-form');
  const themeNameInput = document.getElementById('custom-theme-name');
  const colorInputsContainer = document.getElementById('custom-theme-color-inputs');
  const backgroundPatternSelect = document.getElementById('custom-theme-background-pattern');
  const saveCustomThemeBtn = document.getElementById('save-custom-theme-btn');
  const customThemeList = document.getElementById('custom-theme-list');

  // Trigger button to open the modal (from settings.html)
  const createCustomThemeBtn = document.getElementById('create-custom-theme-btn');
  if (createCustomThemeBtn) {
    createCustomThemeBtn.addEventListener('click', async () => {
      openCustomThemeModal();
      await renderCustomThemeList(); // Ensure the list is fresh when opening
    });
  }

  // Handle form submission for saving/updating a custom theme
  customThemeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate required fields
    const themeName = themeNameInput.value.trim();
    if (!themeName) {
      showMessageBox("Theme name is required. Please enter a name for your custom theme.", true);
      themeNameInput.focus();
      return;
    }

    // Validate theme name length
    if (themeName.length < 3) {
      showMessageBox("Theme name must be at least 3 characters long.", true);
      themeNameInput.focus();
      return;
    }

    if (themeName.length > 50) {
      showMessageBox("Theme name must be less than 50 characters long.", true);
      themeNameInput.focus();
      return;
    }

    // Collect all color variable values
    const variables = {};
    const inputs = colorInputsContainer.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
      const varName = `--${input.id}`; // Reconstruct the CSS variable name
      variables[varName] = input.value.trim();
    });

    // Add RGB version of navbar background for proper theming
    if (variables['--color-bg-navbar']) {
      const hex = variables['--color-bg-navbar'].replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      variables['--color-bg-navbar-rgb'] = `${r},${g},${b}`;
    }

    // Add font family from the main settings page to the custom theme variables
    if (userThemeSelect && userThemeSelect.value) {
      variables['--font-family-body'] = userThemeSelect.value;
    }

    const newTheme = {
      id: currentCustomThemeId, // Will be null for new themes, or existing ID for updates
      name: themeName,
      variables: variables,
      backgroundPattern: backgroundPatternSelect.value,
      isCustom: true // Flag this as a custom theme
    };

    try {
      // Show loading state
      const saveBtn = document.getElementById('save-custom-theme-btn');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      console.log('DEBUG: Attempting to save custom theme:', newTheme);
      const success = await saveCustomTheme(newTheme);
      console.log('DEBUG: saveCustomTheme result:', success);

      if (success) {
        showMessageBox(`Theme "${newTheme.name}" saved successfully!`, false);
        customThemeModal.style.display = 'none'; // Close modal

        // Refresh the theme list
        await renderCustomThemeList();

        // Refresh main theme select and set to new theme
        if (populateThemeSelect) {
          await populateThemeSelect(newTheme.id || 'custom-theme');
        }

        // Ensure the new theme is selected in the main dropdown
        if (userThemeSelect) {
          userThemeSelect.value = newTheme.id || 'custom-theme';
        }

        // Apply the newly saved/updated theme
        applyTheme(newTheme.id || 'custom-theme', newTheme);

        // Reset form for next use
        customThemeForm.reset();
        currentCustomThemeId = null;
      } else {
        showMessageBox("Failed to save theme. Please check your connection and try again.", true);
      }
    } catch (error) {
      console.error("Error saving custom theme:", error);
      showMessageBox(`Error saving theme: ${error.message}`, true);
    } finally {
      // Restore button state
      const saveBtn = document.getElementById('save-custom-theme-btn');
      saveBtn.textContent = 'Save Custom Theme';
      saveBtn.disabled = false;
    }
  });

  // Close modal functionality
  closeButton.addEventListener('click', () => customThemeModal.style.display = 'none');
  window.addEventListener('click', (e) => {
    if (e.target == customThemeModal) {
      customThemeModal.style.display = 'none';
    }
  });

  /**
   * Dynamically creates and injects the custom theme modal HTML into the DOM.
   * This is done once to ensure the modal elements exist before other JS tries to access them.
   * @returns {HTMLElement} The modal element.
   */
  function createCustomThemeModal() {
    const modalHtml = `
      <div id="custom-theme-modal" class="modal">
        <div class="modal-content">
          <span class="close-button">&times;</span>
          <h3 class="text-2xl font-bold text-blue-300 mb-6 text-center">Manage Custom Themes</h3>
          <form id="custom-theme-form">
            <div class="input-field mb-6">
              <label for="custom-theme-name" class="block text-gray-300 text-sm font-bold mb-2">
                <span style="color: #EF4444;">*</span> Theme Name: <span class="text-gray-400 text-xs">(Required)</span>
              </label>
              <input type="text" id="custom-theme-name" placeholder="Enter a unique name for your theme..." required 
                     class="shadow appearance-none border rounded w-full py-3 px-4 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500" 
                     style="background: var(--color-input-bg); color: var(--color-input-text); border-color: var(--color-input-border); font-size: 1.1rem;">
              <p class="text-gray-400 text-xs mt-1">Choose a descriptive name that helps you identify this theme (3-50 characters)</p>
            </div>

            <div class="input-field mb-4">
              <label for="custom-theme-background-pattern" class="block text-gray-300 text-sm font-bold mb-2">Background Pattern:</label>
              <select id="custom-theme-background-pattern" class="shadow appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow-outline" style="background: var(--color-input-bg); color: var(--color-input-text);">
                <option value="none">None</option>
                <option value="dots">Dots</option>
                <option value="grid">Grid</option>
              </select>
            </div>

            <div id="custom-theme-color-inputs" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div class="color-input-group">
                <label for="color-body-bg">Body Background:</label>
                <div>
                  <input type="text" id="color-body-bg" value="#1F2937" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-body-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-text-primary">Primary Text:</label>
                <div>
                  <input type="text" id="color-text-primary" value="#E5E7EB" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-text-primary" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-text-secondary">Secondary Text:</label>
                <div>
                  <input type="text" id="color-text-secondary" value="#9CA3AF" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-text-secondary" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-link">Link Color:</label>
                <div>
                  <input type="text" id="color-link" value="#60A5FA" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-link" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-bg-navbar">Navbar Background:</label>
                <div>
                  <input type="text" id="color-bg-navbar" value="#111827" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-bg-navbar" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-bg-content-section">Content Section BG:</label>
                <div>
                  <input type="text" id="color-bg-content-section" value="#1F2937" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-bg-content-section" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-bg-card">Card Background:</label>
                <div>
                  <input type="text" id="color-bg-card" value="#2D3748" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-bg-card" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-heading-main">Main Heading Color:</label>
                <div>
                  <input type="text" id="color-heading-main" value="#F9FAFB" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-heading-main" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-heading-card">Card Heading Color:</label>
                <div>
                  <input type="text" id="color-heading-card" value="#93C5FD" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-heading-card" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-input-bg">Input Background:</label>
                <div>
                  <input type="text" id="color-input-bg" value="#374151" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-input-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-input-text">Input Text:</label>
                <div>
                  <input type="text" id="color-input-text" value="#E5E7EB" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-input-text" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-input-border">Input Border:</label>
                <div>
                  <input type="text" id="color-input-border" value="#4B5563" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-input-border" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-placeholder">Placeholder Text:</label>
                <div>
                  <input type="text" id="color-placeholder" value="#9CA3AF" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-placeholder" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-text">Button Text:</label>
                <div>
                  <input type="text" id="color-button-text" value="#FFFFFF" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-text" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-blue-bg">Blue Button BG:</label>
                <div>
                  <input type="text" id="color-button-blue-bg" value="#3B82F6" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-blue-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-blue-hover">Blue Button Hover:</label>
                <div>
                  <input type="text" id="color-button-blue-hover" value="#2563EB" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-blue-hover" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-green-bg">Green Button BG:</label>
                <div>
                  <input type="text" id="color-button-green-bg" value="#10B981" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-green-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-green-hover">Green Button Hover:</label>
                <div>
                  <input type="text" id="color-button-green-hover" value="#059669" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-green-hover" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-red-bg">Red Button BG:</label>
                <div>
                  <input type="text" id="color-button-red-bg" value="#EF4444" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-red-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-red-hover">Red Button Hover:</label>
                <div>
                  <input type="text" id="color-button-red-hover" value="#DC2626" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-red-hover" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-purple-bg">Purple Button BG:</label>
                <div>
                  <input type="text" id="color-button-purple-bg" value="#9333EA" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-purple-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-purple-hover">Purple Button Hover:</label>
                <div>
                  <input type="text" id="color-button-purple-hover" value="#7E22CE" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-purple-hover" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-yellow-bg">Yellow Button BG:</label>
                <div>
                  <input type="text" id="color-button-yellow-bg" value="#FBBF24" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-yellow-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-yellow-hover">Yellow Button Hover:</label>
                <div>
                  <input type="text" id="color-button-yellow-hover" value="#D97706" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-yellow-hover" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-orange-bg">Orange Button BG:</label>
                <div>
                  <input type="text" id="color-button-orange-bg" value="#F97316" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-orange-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-orange-hover">Orange Button Hover:</label>
                <div>
                  <input type="text" id="color-button-orange-hover" value="#EA580C" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-orange-hover" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-indigo-bg">Indigo Button BG:</label>
                <div>
                  <input type="text" id="color-button-indigo-bg" value="#6366F1" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-indigo-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-button-indigo-hover">Indigo Button Hover:</label>
                <div>
                  <input type="text" id="color-button-indigo-hover" value="#4F46E5" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-button-indigo-hover" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-table-th-bg">Table Header BG:</label>
                <div>
                  <input type="text" id="color-table-th-bg" value="#1F2937" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-table-th-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-table-th-text">Table Header Text:</label>
                <div>
                  <input type="text" id="color-table-th-text" value="#E5E7EB" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-table-th-text" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-table-td-border">Table Cell Border:</label>
                <div>
                  <input type="text" id="color-table-td-border" value="#4B5563" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-table-td-border" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-table-row-even-bg">Table Even Row BG:</label>
                <div>
                  <input type="text" id="color-table-row-even-bg" value="#374151" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-table-row-even-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-modal-bg">Modal Background:</label>
                <div>
                  <input type="text" id="color-modal-bg" value="#2D3748" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-modal-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-modal-text">Modal Text:</label>
                <div>
                  <input type="text" id="color-modal-text" value="#E5E7EB" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-modal-text" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-modal-input-bg">Modal Input BG:</label>
                <div>
                  <input type="text" id="color-modal-input-bg" value="#374151" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-modal-input-bg" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-modal-input-text">Modal Input Text:</label>
                <div>
                  <input type="text" id="color-modal-input-text" value="#E5E7EB" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-modal-input-text" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-message-box-bg-success">Message Success BG:</label>
                <div>
                  <input type="text" id="color-message-box-bg-success" value="#4CAF50" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-message-box-bg-success" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
              <div class="color-input-group">
                <label for="color-message-box-bg-error">Message Error BG:</label>
                <div>
                  <input type="text" id="color-message-box-bg-error" value="#F44336" style="background: var(--color-input-bg); color: var(--color-input-text);">
                  <input type="color" data-target="color-message-box-bg-error" style="background: var(--color-input-bg); color: var(--color-input-text);">
                </div>
              </div>
            </div>
            <button type="submit" id="save-custom-theme-btn" class="btn-primary btn-blue mt-4">Save Custom Theme</button>
          </form>

          <h4 class="text-xl font-semibold text-gray-200 mt-6 mb-3">Your Custom Themes:</h4>
          <ul id="custom-theme-list" class="list-disc list-inside text-gray-300 space-y-2">
            <li>No custom themes yet.</li>
          </ul>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('custom-theme-modal');

    // Set up color picker sync
    const colorInputs = modal.querySelectorAll('input[type="color"]');
    colorInputs.forEach(input => {
      input.addEventListener('input', function() {
        const targetId = this.dataset.target;
        const textInput = document.getElementById(targetId);
        if (textInput) {
          textInput.value = this.value;
        }
      });
    });

    return modal;
  }

  /**
   * Renders the list of custom themes.
   */
  async function renderCustomThemeList() {
    if (!auth.currentUser) {
      customThemeList.innerHTML = '<li>Please log in to manage custom themes.</li>';
      return;
    }

    customThemeList.innerHTML = '<li>Loading custom themes...</li>';
    const availableThemes = await getAvailableThemes();
    const userCustomThemes = availableThemes.filter(theme => theme.isCustom && theme.id !== defaultThemeName); // Exclude default themes

    if (userCustomThemes.length === 0) {
      customThemeList.innerHTML = '<li>No custom themes created yet.</li>';
      return;
    }

    customThemeList.innerHTML = ''; // Clear loading message
    userCustomThemes.forEach(theme => {
      const li = document.createElement('li');
      li.classList.add('flex', 'flex-col', 'md:flex-row', 'md:items-center', 'justify-between', 'p-3', 'rounded-md', 'mb-2');
      li.style.backgroundColor = 'var(--color-bg-card)'; // Apply card background color
      li.style.color = 'var(--color-text-primary)'; // Apply primary text color

      // Format creation date
      const createdDate = theme.createdAt ? new Date(theme.createdAt.toDate ? theme.createdAt.toDate() : theme.createdAt).toLocaleDateString() : 'Unknown';
      const authorName = theme.authorDisplayName || theme.authorEmail || 'Unknown User';

      li.innerHTML = `
        <div class="flex-1">
          <div class="font-semibold text-lg mb-1">${theme.name}</div>
          <div class="text-sm text-gray-400">
            <span>Created by: ${authorName}</span>
            <span class="mx-2">•</span>
            <span>Created: ${createdDate}</span>
            ${theme.updatedAt ? `<span class="mx-2">•</span><span>Updated: ${new Date(theme.updatedAt.toDate ? theme.updatedAt.toDate() : theme.updatedAt).toLocaleDateString()}</span>` : ''}
          </div>
        </div>
        <div class="mt-2 md:mt-0 md:ml-4 flex gap-2">
          <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm edit-custom-theme-btn" data-theme-id="${theme.id}">
            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
            Edit
          </button>
          <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm delete-custom-theme-btn" data-theme-id="${theme.id}">
            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            Delete
          </button>
        </div>
      `;
      customThemeList.appendChild(li);
    });

    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.edit-custom-theme-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const themeId = e.target.closest('button').dataset.themeId;
        loadCustomThemeForEditing(themeId);
      });
    });

    document.querySelectorAll('.delete-custom-theme-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        const themeId = e.target.closest('button').dataset.themeId;
        const themeToDelete = userCustomThemes.find(t => t.id === themeId);
        const themeName = themeToDelete?.name || themeId;

        const confirmation = await showCustomConfirm(
          `Are you sure you want to delete theme "${themeName}"?`,
          "This action cannot be undone."
        );

        if (confirmation) {
          if (await deleteCustomTheme(themeId)) {
            showMessageBox('Custom theme deleted successfully!', false);
            // After deletion, revert to default theme if the deleted one was active
            await populateThemeSelect(defaultThemeName); // Re-populate and select default
            userThemeSelect.value = defaultThemeName; // Update main dropdown
            applyTheme(defaultThemeName); // Apply the default theme
            renderCustomThemeList(); // Re-render the list
          }
        } else {
          showMessageBox('Theme deletion cancelled.', false);
        }
      });
    });
  }

  /**
   * Opens the custom theme modal, optionally loading a theme for editing.
   * @param {string|null} themeId - The ID of the theme to edit, or null for a new theme.
   */
  async function openCustomThemeModal(themeId = null) {
    currentCustomThemeId = themeId;
    if (themeId) {
      await loadCustomThemeForEditing(themeId);
      themeNameInput.focus(); // Focus on name input for convenience
    } else {
      // Reset form for a new theme
      customThemeForm.reset();
      themeNameInput.value = '';
      // Populate with default colors for a new custom theme
      colorInputsContainer.querySelectorAll('input[type="text"]').forEach(input => {
        const varName = `--${input.id}`;
        // Get current values from the document's computed style (which reflects the active theme)
        const computedValue = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        input.value = computedValue || '#000000'; // Fallback to black if empty
        input.nextElementSibling.value = computedValue || '#000000'; // Also update color picker
      });
      backgroundPatternSelect.value = 'none'; // Default to no pattern for new theme
      themeNameInput.focus();
    }
    customThemeModal.style.display = 'flex';
  }

  /**
   * Loads the details of a custom theme into the modal for editing.
   * @param {string} themeId - The ID of the custom theme to load.
   */
  async function loadCustomThemeForEditing(themeId) {
    const allThemes = await getAvailableThemes();
    const themeToEdit = allThemes.find(theme => theme.id === themeId && theme.isCustom);

    if (!themeToEdit) {
      console.error('Custom theme not found for editing:', themeId);
      showMessageBox('Error: Custom theme not found.', true);
      return;
    }

    currentCustomThemeId = themeId;
    themeNameInput.value = themeToEdit.name;
    backgroundPatternSelect.value = themeToEdit.backgroundPattern || 'none';

    for (const [key, value] of Object.entries(themeToEdit.variables)) {
      const inputId = key.replace('--', ''); // Convert CSS var name back to input ID
      const textInput = document.getElementById(inputId);
      if (textInput) {
        textInput.value = value;
        textInput.nextElementSibling.value = value; // Update associated color picker
      }
    }
  }
}
