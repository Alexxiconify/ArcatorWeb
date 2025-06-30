import {
  applyTheme,
  getAvailableThemes,
  saveCustomTheme,
  deleteCustomTheme,
} from "./themes.js";

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
export function setupCustomThemeManagement(
  db,
  auth,
  appId,
  showMessageBox,
  populateThemeSelect,
  userThemeSelect,
  defaultThemeName,
  currentUser,
  showCustomConfirm,
) {
  let currentCustomThemeId = null;

  // Ensure the modal HTML is added to the DOM if it's not already there
  const customThemeModal =
    document.getElementById("custom-theme-modal") || createCustomThemeModal();

  // Get DOM elements for the modal
  const closeButton = customThemeModal.querySelector(".close-button");
  const customThemeForm = document.getElementById("custom-theme-form");
  const themeNameInput = document.getElementById("custom-theme-name");
  const colorInputsContainer = document.getElementById(
    "custom-theme-color-inputs",
  );
  const backgroundPatternSelect = document.getElementById(
    "custom-theme-background-pattern",
  );
  const saveCustomThemeBtn = document.getElementById("save-custom-theme-btn");
  const customThemeList = document.getElementById("custom-theme-list");

  // Trigger button to open the modal (from settings.html)
  const createCustomThemeBtn = document.getElementById(
    "create-custom-theme-btn",
  );
  if (createCustomThemeBtn) {
    createCustomThemeBtn.addEventListener("click", async () => {
      openCustomThemeModal();
      await renderCustomThemeList(); // Ensure the list is fresh when opening
    });
  }

  // Handle form submission for saving/updating a custom theme
  customThemeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate required fields
    const themeName = themeNameInput.value.trim();
    if (!themeName) {
      showMessageBox(
        "Theme name is required. Please enter a name for your custom theme.",
        true,
      );
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
    inputs.forEach((input) => {
      const varName = `--${input.id}`; // Reconstruct the CSS variable name
      variables[varName] = input.value.trim();
    });

    // Add RGB version of navbar background for proper theming
    if (variables["--color-bg-navbar"]) {
      const hex = variables["--color-bg-navbar"].replace("#", "");
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      variables["--color-bg-navbar-rgb"] = `${r},${g},${b}`;
    }

    // Add font family from the main settings page to the custom theme variables
    if (userThemeSelect && userThemeSelect.value) {
      variables["--font-family-body"] = userThemeSelect.value;
    }

    const newTheme = {
      id: currentCustomThemeId, // Will be null for new themes, or existing ID for updates
      name: themeName,
      variables: variables,
      backgroundPattern: backgroundPatternSelect.value,
      isCustom: true, // Flag this as a custom theme
    };

    try {
      // Show loading state
      const saveBtn = document.getElementById("save-custom-theme-btn");
      const originalText = saveBtn.textContent;
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;

      console.log("DEBUG: Attempting to save custom theme:", newTheme);
      const result = await saveCustomTheme(newTheme);
      console.log("DEBUG: saveCustomTheme result:", result);

      if (result) {
        // result is now the document ID (string) or false
        const savedThemeId = result;
        showMessageBox(`Theme "${newTheme.name}" saved successfully!`, false);
        customThemeModal.style.display = "none"; // Close modal

        // Refresh the theme list
        await renderCustomThemeList();

        // Refresh main theme select and set to new theme
        if (populateThemeSelect) {
          await populateThemeSelect(savedThemeId);
        }

        // Ensure the new theme is selected in the main dropdown
        if (userThemeSelect) {
          userThemeSelect.value = savedThemeId;
        }

        // Get the saved theme data and apply it
        const allThemes = await getAvailableThemes(true); // Force refresh to get the new theme
        const savedTheme = allThemes.find((t) => t.id === savedThemeId);
        if (savedTheme) {
          applyTheme(savedThemeId, savedTheme);
        } else {
          console.error(
            "DEBUG: Could not find saved theme in available themes",
          );
        }

        // Reset form for next use
        customThemeForm.reset();
        currentCustomThemeId = null;
      } else {
        showMessageBox(
          "Failed to save theme. Please check your connection and try again.",
          true,
        );
      }
    } catch (error) {
      console.error("Error saving custom theme:", error);
      showMessageBox(`Error saving theme: ${error.message}`, true);
    } finally {
      // Restore button state
      const saveBtn = document.getElementById("save-custom-theme-btn");
      saveBtn.textContent = "Save Custom Theme";
      saveBtn.disabled = false;
    }
  });

  // Close modal functionality
  closeButton.addEventListener(
    "click",
    () => (customThemeModal.style.display = "none"),
  );
  window.addEventListener("click", (e) => {
    if (e.target == customThemeModal) {
      customThemeModal.style.display = "none";
    }
  });

  /**
   * Dynamically creates and injects the custom theme modal HTML into the DOM.
   * This is done once to ensure the modal elements exist before other JS tries to access them.
   * @returns {HTMLElement} The modal element.
   */
  function createCustomThemeModal() {
    const modalHtml = `
      <div id="custom-theme-modal" class="modal" style="display:none;align-items:center;justify-content:center;">
        <div class="modal-content" style="width:98vw;max-width:900px;padding:1.5rem 1rem;box-sizing:border-box;">
          <span class="close-button">&times;</span>
          <h3 id="custom-theme-modal-title" class="text-2xl font-bold mb-3 text-heading-card">Create Custom Theme</h3>
          <form id="custom-theme-form" class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div class="input-field mb-2 col-span-2">
              <label for="custom-theme-name" class="block mb-1">Theme Name:</label>
              <input id="custom-theme-name" class="form-input w-full" maxlength="32" required />
            </div>
            <div class="input-field">
              <label>Body BG</label>
              <input type="color" id="theme-body-bg" />
            </div>
            <div class="input-field">
              <label>Card BG</label>
              <input type="color" id="theme-card-bg" />
            </div>
            <div class="input-field">
              <label>Navbar BG</label>
              <input type="color" id="theme-navbar-bg" />
            </div>
            <div class="input-field">
              <label>Content Section BG</label>
              <input type="color" id="theme-content-section-bg" />
            </div>
            <div class="input-field">
              <label>Heading Main</label>
              <input type="color" id="theme-heading-main" />
            </div>
            <div class="input-field">
              <label>Heading Card</label>
              <input type="color" id="theme-heading-card" />
            </div>
            <div class="input-field">
              <label>Text Primary</label>
              <input type="color" id="theme-text-primary" />
            </div>
            <div class="input-field">
              <label>Text Secondary</label>
              <input type="color" id="theme-text-secondary" />
            </div>
            <div class="input-field">
              <label>Link</label>
              <input type="color" id="theme-link" />
            </div>
            <div class="input-field">
              <label>Button Blue</label>
              <input type="color" id="theme-button-blue-bg" />
            </div>
            <div class="input-field">
              <label>Button Green</label>
              <input type="color" id="theme-button-green-bg" />
            </div>
            <div class="input-field">
              <label>Button Red</label>
              <input type="color" id="theme-button-red-bg" />
            </div>
            <div class="input-field">
              <label>Button Purple</label>
              <input type="color" id="theme-button-purple-bg" />
            </div>
            <div class="input-field">
              <label>Button Yellow</label>
              <input type="color" id="theme-button-yellow-bg" />
            </div>
            <div class="input-field">
              <label>Button Indigo</label>
              <input type="color" id="theme-button-indigo-bg" />
            </div>
            <div class="input-field">
              <label>Button Text</label>
              <input type="color" id="theme-button-text" />
            </div>
            <div class="input-field">
              <label>Input BG</label>
              <input type="color" id="theme-input-bg" />
            </div>
            <div class="input-field">
              <label>Input Border</label>
              <input type="color" id="theme-input-border" />
            </div>
            <div class="input-field">
              <label>Input Text</label>
              <input type="color" id="theme-input-text" />
            </div>
            <div class="input-field">
              <label>Table TH BG</label>
              <input type="color" id="theme-table-th-bg" />
            </div>
            <div class="input-field">
              <label>Table TH Text</label>
              <input type="color" id="theme-table-th-text" />
            </div>
            <div class="input-field">
              <label>Table TD Border</label>
              <input type="color" id="theme-table-td-border" />
            </div>
            <div class="input-field">
              <label>Table Row Even BG</label>
              <input type="color" id="theme-table-row-even-bg" />
            </div>
            <div class="input-field col-span-2 text-right">
              <button type="submit" class="btn-primary btn-blue">Save Theme</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    const modal = document.getElementById("custom-theme-modal");

    // Set up color picker sync
    const colorInputs = modal.querySelectorAll('input[type="color"]');
    colorInputs.forEach((input) => {
      input.addEventListener("input", function () {
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
      customThemeList.innerHTML =
        "<li>Please log in to manage custom themes.</li>";
      return;
    }

    customThemeList.innerHTML = "<li>Loading custom themes...</li>";
    const availableThemes = await getAvailableThemes();
    const userCustomThemes = availableThemes.filter(
      (theme) => theme.isCustom && theme.id !== defaultThemeName,
    ); // Exclude default themes

    if (userCustomThemes.length === 0) {
      customThemeList.innerHTML = "<li>No custom themes created yet.</li>";
      return;
    }

    customThemeList.innerHTML = ""; // Clear loading message
    userCustomThemes.forEach((theme) => {
      const li = document.createElement("li");
      li.classList.add(
        "flex",
        "flex-col",
        "md:flex-row",
        "md:items-center",
        "justify-between",
        "p-3",
        "rounded-md",
        "mb-2",
      );
      li.style.backgroundColor = "var(--color-bg-card)"; // Apply card background color
      li.style.color = "var(--color-text-primary)"; // Apply primary text color

      // Format creation date
      const createdDate = theme.createdAt
        ? new Date(
            theme.createdAt.toDate ? theme.createdAt.toDate() : theme.createdAt,
          ).toLocaleDateString()
        : "Unknown";
      const authorName =
        theme.authorDisplayName || theme.authorEmail || "Unknown User";

      li.innerHTML = `
        <div class="flex-1">
          <div class="font-semibold text-lg mb-1">${theme.name}</div>
          <div class="text-sm text-gray-400">
            <span>Created by: ${authorName}</span>
            <span class="mx-2">•</span>
            <span>Created: ${createdDate}</span>
            ${theme.updatedAt ? `<span class="mx-2">•</span><span>Updated: ${new Date(theme.updatedAt.toDate ? theme.updatedAt.toDate() : theme.updatedAt).toLocaleDateString()}</span>` : ""}
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
    document.querySelectorAll(".edit-custom-theme-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const themeId = e.target.closest("button").dataset.themeId;
        loadCustomThemeForEditing(themeId);
      });
    });

    document.querySelectorAll(".delete-custom-theme-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const themeId = e.target.closest("button").dataset.themeId;
        console.log("DEBUG: Delete button clicked for theme ID:", themeId);

        // Find the theme in the full list of available themes, not just user custom themes
        const allThemes = await getAvailableThemes();
        console.log(
          "DEBUG: All available themes:",
          allThemes.map((t) => ({
            id: t.id,
            name: t.name,
            isCustom: t.isCustom,
          })),
        );

        const themeToDelete = allThemes.find((t) => t.id === themeId);
        console.log("DEBUG: Theme to delete found:", themeToDelete);

        if (!themeToDelete) {
          console.error(`Theme not found for deletion: ${themeId}`);
          showMessageBox("Error: Theme not found for deletion.", true);
          return;
        }

        const themeName =
          themeToDelete.name || themeToDelete.id || "Unknown Theme";
        console.log("DEBUG: Theme name for confirmation:", themeName);

        console.log(
          "DEBUG: About to show custom confirm for theme:",
          themeName,
        );
        const confirmation = await showCustomConfirm(
          `Are you sure you want to delete theme "${themeName}"?`,
          "This action cannot be undone.",
        );
        console.log("DEBUG: Custom confirm result:", confirmation);

        if (confirmation) {
          console.log(
            "DEBUG: User confirmed deletion, calling deleteCustomTheme",
          );
          if (await deleteCustomTheme(themeId)) {
            showMessageBox("Custom theme deleted successfully!", false);
            // After deletion, revert to default theme if the deleted one was active
            await populateThemeSelect(defaultThemeName); // Re-populate and select default
            userThemeSelect.value = defaultThemeName; // Update main dropdown
            applyTheme(defaultThemeName); // Apply the default theme
            renderCustomThemeList(); // Re-render the list
          } else {
            showMessageBox("Error deleting theme. Please try again.", true);
          }
        } else {
          showMessageBox("Theme deletion cancelled.", false);
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
      themeNameInput.value = "";
      // Populate with default colors for a new custom theme
      colorInputsContainer
        .querySelectorAll('input[type="text"]')
        .forEach((input) => {
          const varName = `--${input.id}`;
          // Get current values from the document's computed style (which reflects the active theme)
          const computedValue = getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
            .trim();
          input.value = computedValue || "#000000"; // Fallback to black if empty
          input.nextElementSibling.value = computedValue || "#000000"; // Also update color picker
        });
      backgroundPatternSelect.value = "none"; // Default to no pattern for new theme
      themeNameInput.focus();
    }
    customThemeModal.style.display = "flex";
  }

  /**
   * Loads the details of a custom theme into the modal for editing.
   * @param {string} themeId - The ID of the custom theme to load.
   */
  async function loadCustomThemeForEditing(themeId) {
    const allThemes = await getAvailableThemes();
    const themeToEdit = allThemes.find(
      (theme) => theme.id === themeId && theme.isCustom,
    );

    if (!themeToEdit) {
      console.error("Custom theme not found for editing:", themeId);
      showMessageBox("Error: Custom theme not found.", true);
      return;
    }

    currentCustomThemeId = themeId;
    themeNameInput.value = themeToEdit.name;
    backgroundPatternSelect.value = themeToEdit.backgroundPattern || "none";

    for (const [key, value] of Object.entries(themeToEdit.variables)) {
      const inputId = key.replace("--", ""); // Convert CSS var name back to input ID
      const textInput = document.getElementById(inputId);
      if (textInput) {
        textInput.value = value;
        textInput.nextElementSibling.value = value; // Update associated color picker
      }
    }
  }
}
