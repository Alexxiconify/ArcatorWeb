import {
  applyTheme,
  getAvailableThemes,
  saveCustomTheme,
  deleteCustomTheme
} from './themes.min.js';
export function setupCustomThemeManagement(db, auth, appId, showMessageBox, populateThemeSelect, userThemeSelect, defaultThemeName, currentUser) {
  let currentCustomThemeId = null;
  const customThemeModal = document.getElementById('custom-theme-modal') || createCustomThemeModal();
  const closeButton = customThemeModal.querySelector('.close-button');
  const customThemeForm = document.getElementById('custom-theme-form');
  const themeNameInput = document.getElementById('custom-theme-name');
  const colorInputsContainer = document.getElementById('custom-theme-color-inputs');
  const backgroundPatternSelect = document.getElementById('custom-theme-background-pattern');
  const saveCustomThemeBtn = document.getElementById('save-custom-theme-btn');
  const customThemeList = document.getElementById('custom-theme-list');
  const createCustomThemeBtn = document.getElementById('create-custom-theme-btn');
  if (createCustomThemeBtn) {
    createCustomThemeBtn.addEventListener('click', async () => {
      openCustomThemeModal();
      await renderCustomThemeList();
    });
  }
  customThemeForm.addEventListener('submit', async e => {
    e.preventDefault();
    const newTheme = {
      id: currentCustomThemeId,
      name: themeNameInput.value.trim(),
      variables: {},
      backgroundPattern: backgroundPatternSelect.value,
      isCustom: true
    };
    const inputs = colorInputsContainer.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
      const varName = `--${input.id}`;
      newTheme.variables[varName] = input.value
    });
    newTheme.variables['--font-family-body'] = userThemeSelect.value;
    if (await saveCustomTheme(newTheme)) {
      showMessageBox(`Theme "${newTheme.name}" saved successfully!`, false);
      customThemeModal.style.display = 'none';
      populateThemeSelect(newTheme.id);
      userThemeSelect.value = newTheme.id;
      applyTheme(newTheme.id, newTheme);
    }
  });
  closeButton.addEventListener('click', () => customThemeModal.style.display = 'none');
  window.addEventListener('click', e => {
    if (e.target == customThemeModal) {
      customThemeModal.style.display = 'none'
    }
  });

  function createCustomThemeModal() {
    const modalHtml = ` <div id="custom-theme-modal" class="modal"> <div class="modal-content"> <span class="close-button">&times;</span> <h3 class="text-2xl font-bold text-blue-300 mb-6 text-center">Manage Custom Themes</h3> <form id="custom-theme-form"> <div class="input-field mb-4"> <label for="custom-theme-name" class="block text-gray-300 text-sm font-bold mb-2">Theme Name:</label> <input type="text" id="custom-theme-name" placeholder="My Custom Theme" required class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"> </div> <div class="input-field mb-4"> <label for="custom-theme-background-pattern" class="block text-gray-300 text-sm font-bold mb-2">Background Pattern:</label> <select id="custom-theme-background-pattern" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"> <option value="none">None</option> <option value="dots">Dots</option> <option value="grid">Grid</option> </select> </div> <div id="custom-theme-color-inputs" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"> <div class="color-input-group"> <label for="color-body-bg">Body Background:</label> <div> <input type="text" id="color-body-bg" value="#1F2937"> <input type="color" data-target="color-body-bg"> </div> </div> <div class="color-input-group"> <label for="color-text-primary">Primary Text:</label> <div> <input type="text" id="color-text-primary" value="#E5E7EB"> <input type="color" data-target="color-text-primary"> </div> </div> <div class="color-input-group"> <label for="color-text-secondary">Secondary Text:</label> <div> <input type="text" id="color-text-secondary" value="#9CA3AF"> <input type="color" data-target="color-text-secondary"> </div> </div> <div class="color-input-group"> <label for="color-link">Link Color:</label> <div> <input type="text" id="color-link" value="#60A5FA"> <input type="color" data-target="color-link"> </div> </div> <div class="color-input-group"> <label for="color-bg-navbar">Navbar Background:</label> <div> <input type="text" id="color-bg-navbar" value="#111827"> <input type="color" data-target="color-bg-navbar"> </div> </div> <div class="color-input-group"> <label for="color-bg-content-section">Content Section BG:</label> <div> <input type="text" id="color-bg-content-section" value="#1F2937"> <input type="color" data-target="color-bg-content-section"> </div> </div> <div class="color-input-group"> <label for="color-bg-card">Card Background:</label> <div> <input type="text" id="color-bg-card" value="#2D3748"> <input type="color" data-target="color-bg-card"> </div> </div> <div class="color-input-group"> <label for="color-heading-main">Main Heading Color:</label> <div> <input type="text" id="color-heading-main" value="#F9FAFB"> <input type="color" data-target="color-heading-main"> </div> </div> <div class="color-input-group"> <label for="color-heading-card">Card Heading Color:</label> <div> <input type="text" id="color-heading-card" value="#93C5FD"> <input type="color" data-target="color-heading-card"> </div> </div> <div class="color-input-group"> <label for="color-input-bg">Input Background:</label> <div> <input type="text" id="color-input-bg" value="#374151"> <input type="color" data-target="color-input-bg"> </div> </div> <div class="color-input-group"> <label for="color-input-text">Input Text:</label> <div> <input type="text" id="color-input-text" value="#E5E7EB"> <input type="color" data-target="color-input-text"> </div> </div> <div class="color-input-group"> <label for="color-input-border">Input Border:</label> <div> <input type="text" id="color-input-border" value="#4B5563"> <input type="color" data-target="color-input-border"> </div> </div> <div class="color-input-group"> <label for="color-placeholder">Placeholder Text:</label> <div> <input type="text" id="color-placeholder" value="#9CA3AF"> <input type="color" data-target="color-placeholder"> </div> </div> <div class="color-input-group"> <label for="color-button-text">Button Text:</label> <div> <input type="text" id="color-button-text" value="#FFFFFF"> <input type="color" data-target="color-button-text"> </div> </div> <div class="color-input-group"> <label for="color-button-blue-bg">Blue Button BG:</label> <div> <input type="text" id="color-button-blue-bg" value="#3B82F6"> <input type="color" data-target="color-button-blue-bg"> </div> </div> <div class="color-input-group"> <label for="color-button-blue-hover">Blue Button Hover:</label> <div> <input type="text" id="color-button-blue-hover" value="#2563EB"> <input type="color" data-target="color-button-blue-hover"> </div> </div> <div class="color-input-group"> <label for="color-button-green-bg">Green Button BG:</label> <div> <input type="text" id="color-button-green-bg" value="#10B981"> <input type="color" data-target="color-button-green-bg"> </div> </div> <div class="color-input-group"> <label for="color-button-green-hover">Green Button Hover:</label> <div> <input type="text" id="color-button-green-hover" value="#059669"> <input type="color" data-target="color-button-green-hover"> </div> </div> <div class="color-input-group"> <label for="color-button-red-bg">Red Button BG:</label> <div> <input type="text" id="color-button-red-bg" value="#EF4444"> <input type="color" data-target="color-button-red-bg"> </div> </div> <div class="color-input-group"> <label for="color-button-red-hover">Red Button Hover:</label> <div> <input type="text" id="color-button-red-hover" value="#DC2626"> <input type="color" data-target="color-button-red-hover"> </div> </div> <div class="color-input-group"> <label for="color-button-purple-bg">Purple Button BG:</label> <div> <input type="text" id="color-button-purple-bg" value="#9333EA"> <input type="color" data-target="color-button-purple-bg"> </div> </div> <div class="color-input-group"> <label for="color-button-purple-hover">Purple Button Hover:</label> <div> <input type="text" id="color-button-purple-hover" value="#7E22CE"> <input type="color" data-target="color-button-purple-hover"> </div> </div> <div class="color-input-group"> <label for="color-button-yellow-bg">Yellow Button BG:</label> <div> <input type="text" id="color-button-yellow-bg" value="#FBBF24"> <input type="color" data-target="color-button-yellow-bg"> </div> </div> <div class="color-input-group"> <label for="color-button-yellow-hover">Yellow Button Hover:</label> <div> <input type="text" id="color-button-yellow-hover" value="#D97706"> <input type="color" data-target="color-button-yellow-hover"> </div> </div> <div class="color-input-group"> <label for="color-button-orange-bg">Orange Button BG:</label> <div> <input type="text" id="color-button-orange-bg" value="#F97316"> <input type="color" data-target="color-button-orange-bg"> </div> </div> <div class="color-input-group"> <label for="color-button-orange-hover">Orange Button Hover:</label> <div> <input type="text" id="color-button-orange-hover" value="#EA580C"> <input type="color" data-target="color-button-orange-hover"> </div> </div> <div class="color-input-group"> <label for="color-button-indigo-bg">Indigo Button BG:</label> <div> <input type="text" id="color-button-indigo-bg" value="#6366F1"> <input type="color" data-target="color-button-indigo-bg"> </div> </div> <div class="color-input-group"> <label for="color-button-indigo-hover">Indigo Button Hover:</label> <div> <input type="text" id="color-button-indigo-hover" value="#4F46E5"> <input type="color" data-target="color-button-indigo-hover"> </div> </div> <div class="color-input-group"> <label for="color-table-th-bg">Table Header BG:</label> <div> <input type="text" id="color-table-th-bg" value="#1F2937"> <input type="color" data-target="color-table-th-bg"> </div> </div> <div class="color-input-group"> <label for="color-table-th-text">Table Header Text:</label> <div> <input type="text" id="color-table-th-text" value="#E5E7EB"> <input type="color" data-target="color-table-th-text"> </div> </div> <div class="color-input-group"> <label for="color-table-td-border">Table Cell Border:</label> <div> <input type="text" id="color-table-td-border" value="#4B5563"> <input type="color" data-target="color-table-td-border"> </div> </div> <div class="color-input-group"> <label for="color-table-row-even-bg">Table Even Row BG:</label> <div> <input type="text" id="color-table-row-even-bg" value="#374151"> <input type="color" data-target="color-table-row-even-bg"> </div> </div> <div class="color-input-group"> <label for="color-modal-bg">Modal Background:</label> <div> <input type="text" id="color-modal-bg" value="#2D3748"> <input type="color" data-target="color-modal-bg"> </div> </div> <div class="color-input-group"> <label for="color-modal-text">Modal Text:</label> <div> <input type="text" id="color-modal-text" value="#E5E7EB"> <input type="color" data-target="color-modal-text"> </div> </div> <div class="color-input-group"> <label for="color-modal-input-bg">Modal Input BG:</label> <div> <input type="text" id="color-modal-input-bg" value="#374151"> <input type="color" data-target="color-modal-input-bg"> </div> </div> <div class="color-input-group"> <label for="color-modal-input-text">Modal Input Text:</label> <div> <input type="text" id="color-modal-input-text" value="#E5E7EB"> <input type="color" data-target="color-modal-input-text"> </div> </div> <div class="color-input-group"> <label for="color-message-box-bg-success">Message Success BG:</label> <div> <input type="text" id="color-message-box-bg-success" value="#4CAF50"> <input type="color" data-target="color-message-box-bg-success"> </div> </div> <div class="color-input-group"> <label for="color-message-box-bg-error">Message Error BG:</label> <div> <input type="text" id="color-message-box-bg-error" value="#F44336"> <input type="color" data-target="color-message-box-bg-error"> </div> </div> </div> <button type="submit" id="save-custom-theme-btn" class="btn-primary btn-blue mt-4">Save Custom Theme</button> </form> <h4 class="text-xl font-semibold text-gray-200 mt-6 mb-3">Your Custom Themes:</h4> <ul id="custom-theme-list" class="list-disc list-inside text-gray-300 space-y-2"> <li>No custom themes yet.</li> </ul> </div> </div> `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const colorInputs = customThemeModal.querySelectorAll('input[type="color"]');
    colorInputs.forEach(input => {
      input.addEventListener('input', function() {
        const targetId = this.dataset.target;
        const textInput = document.getElementById(targetId);
        if (textInput) {
          textInput.value = this.value
        }
      })
    });
    return document.getElementById('custom-theme-modal')
  }
  async function renderCustomThemeList() {
    if (!auth.currentUser) {
      customThemeList.innerHTML = '<li>Please log in to manage custom themes.</li>';
      return
    }
    customThemeList.innerHTML = '<li>Loading custom themes...</li>';
    const availableThemes = await getAvailableThemes();
    const userCustomThemes = availableThemes.filter(theme => theme.isCustom);
    if (userCustomThemes.length === 0) {
      customThemeList.innerHTML = '<li>No custom themes created yet.</li>';
      return
    }
    customThemeList.innerHTML = '';
    userCustomThemes.forEach(theme => {
      const li = document.createElement('li');
      li.classList.add('flex', 'flex-col', 'md:flex-row', 'md:items-center', 'justify-between', 'p-3', 'rounded-md', 'mb-2');
      li.style.backgroundColor = 'var(--color-bg-card)';
      li.style.color = 'var(--color-text-primary)';
      li.innerHTML = ` <span class="font-semibold break-all md:w-3/5">${theme.name}</span> <div class="mt-2 md:mt-0 md:w-2/5 md:text-right"> <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm mr-2 edit-custom-theme-btn" data-theme-id="${theme.id}">Edit</button> <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm delete-custom-theme-btn" data-theme-id="${theme.id}">Delete</button> </div> `;
      customThemeList.appendChild(li);
    });
    document.querySelectorAll('.edit-custom-theme-btn').forEach(button => {
      button.addEventListener('click', e => {
        const themeId = e.target.dataset.themeId;
        loadCustomThemeForEditing(themeId)
      });
    });
    document.querySelectorAll('.delete-custom-theme-btn').forEach(button => {
      button.addEventListener('click', async e => {
        const themeId = e.target.dataset.themeId;
        const confirmation = await window.showCustomConfirm(`Are you sure you want to delete theme "${userCustomThemes.find(t=>t.id===themeId)?.name||themeId}"?`, "This action cannot be undone.");
        if (confirmation) {
          if (await deleteCustomTheme(themeId)) {
            showMessageBox('Custom theme deleted successfully!', false);
            await populateThemeSelect(defaultThemeName);
            userThemeSelect.value = defaultThemeName;
            applyTheme(defaultThemeName);
            renderCustomThemeList();
          }
        } else {
          showMessageBox('Theme deletion cancelled.', false);
        }
      });
    });
  }
  async function openCustomThemeModal(themeId = null) {
    currentCustomThemeId = themeId;
    if (themeId) {
      await loadCustomThemeForEditing(themeId);
      themeNameInput.focus();
    } else {
      customThemeForm.reset();
      themeNameInput.value = '';
      colorInputsContainer.querySelectorAll('input[type="text"]').forEach(input => {
        const varName = `--${input.id}`;
        const defaultTheme = DEFAULT_THEMES.find(t => t.id === defaultThemeName);
        if (defaultTheme && defaultTheme.variables[varName]) {
          input.value = defaultTheme.variables[varName];
          input.nextElementSibling.value = defaultTheme.variables[varName];
        }
      });
      backgroundPatternSelect.value = 'none';
      themeNameInput.focus();
    }
    customThemeModal.style.display = 'flex'
  }
  async function loadCustomThemeForEditing(themeId) {
    const allThemes = await getAvailableThemes();
    const themeToEdit = allThemes.find(theme => theme.id === themeId && theme.isCustom);
    if (!themeToEdit) {
      console.error('Custom theme not found for editing:', themeId);
      showMessageBox('Error: Custom theme not found.', true);
      return
    }
    currentCustomThemeId = themeId;
    themeNameInput.value = themeToEdit.name;
    backgroundPatternSelect.value = themeToEdit.backgroundPattern || 'none';
    for (const [key, value] of Object.entries(themeToEdit.variables)) {
      const inputId = key.replace('--', '');
      const textInput = document.getElementById(inputId);
      if (textInput) {
        textInput.value = value;
        textInput.nextElementSibling.value = value
      }
    }
  }
