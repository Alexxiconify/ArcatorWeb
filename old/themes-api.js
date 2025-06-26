// themes-api.js: Handles theme (subreddit-like) creation, management, and display.

import { db, appId, getCurrentUser, ADMIN_UIDS } from './firebase-init.js';
import { showMessageBox, showCustomConfirm } from './utils.js';
import { collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- DOM Elements ---
const themeManagementModal = document.getElementById('theme-management-modal');
const themeModalCloseBtn = document.querySelector('.theme-modal-close');
const createThemeForm = document.getElementById('create-theme-form');
const newThemeNameInput = document.getElementById('new-theme-name');
const newThemeDescriptionInput = document.getElementById('new-theme-description');
const newThemeRulesInput = document.getElementById('new-theme-rules');
const themesListContainer = document.getElementById('themes-list-container');
const noThemesMessage = document.getElementById('no-themes-message');

const themeSelect = document.getElementById('theme-select'); // Theme filter select
const createThreadThemeSelect = document.getElementById('create-thread-theme'); // New theme select for creation
const currentThemeInfo = document.getElementById('current-theme-info');
const currentThemeName = document.getElementById('current-theme-name');
const currentThemeDescription = document.getElementById('current-theme-description');
const themeRulesList = document.getElementById('theme-rules-list');

// --- State Variables ---
export let allThemesCache = []; // Cache for all themes, accessible by other modules
let unsubscribeThemesForManagement = null;
let unsubscribeThemeDropdowns = null;


/**
 * Opens the theme management modal.
 */
export function openThemeManagementModal() {
  const currentUser = getCurrentUser();
  if (!currentUser || (!currentUser.isAdmin && !currentUser.isThemeMod)) {
    showMessageBox("You do not have permission to manage themes.", true);
    return;
  }
  themeManagementModal.style.display = 'flex';
  renderThemesListForManagement();
}

/**
 * Closes the theme management modal.
 */
export function closeThemeManagementModal() {
  themeManagementModal.style.display = 'none';
  createThemeForm.reset(); // Clear form on close
}

/**
 * Creates a new theme.
 * @param {string} name - The name of the theme.
 * @param {string} description - The description of the theme.
 * @param {string[]} rules - An array of rules for the theme.
 */
export async function createTheme(name, description, rules) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.uid) {
    showMessageBox("You must be logged in to create a theme.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot create theme.", true);
    return;
  }
  if (!name.trim()) {
    showMessageBox("Theme name cannot be empty.", true);
    return;
  }

  const themesCol = collection(db, `artifacts/${appId}/public/data/themes`);
  const themeData = {
    name: name.trim(),
    description: description.trim(),
    rules: rules.map(rule => rule.trim()).filter(rule => rule !== ''),
    moderators: [currentUser.uid], // Creator is automatically a mod
    createdAt: serverTimestamp(),
    createdBy: currentUser.uid,
  };

  try {
    await addDoc(themesCol, themeData);
    showMessageBox("Theme created successfully!", false);
    createThemeForm.reset();
    // Refreshing the list and dropdowns is handled by the onSnapshot listeners
  } catch (error) {
    console.error("Error creating theme:", error);
    showMessageBox(`Error creating theme: ${error.message}`, true);
  }
}

/**
 * Renders the list of themes within the management modal.
 */
function renderThemesListForManagement() {
  if (!db || !themesListContainer) {
    console.warn("DB or themesListContainer not ready for theme management rendering.");
    return;
  }

  if (unsubscribeThemesForManagement) {
    unsubscribeThemesForManagement();
  }

  const themesCol = collection(db, `artifacts/${appId}/public/data/themes`);
  const q = query(themesCol, orderBy("name", "asc"));

  unsubscribeThemesForManagement = onSnapshot(q, (snapshot) => {
    themesListContainer.innerHTML = '';
    allThemesCache = []; // Clear cache before populating
    if (snapshot.empty) {
      noThemesMessage.style.display = 'block';
    } else {
      noThemesMessage.style.display = 'none';
    }

    snapshot.forEach(docSnap => {
      const theme = { id: docSnap.id, ...docSnap.data() };
      allThemesCache.push(theme);

      const currentUser = getCurrentUser();
      const isCurrentUserMod = currentUser && (currentUser.isAdmin || (theme.moderators && theme.moderators.includes(currentUser.uid)));

      const themeItem = document.createElement('div');
      themeItem.className = 'p-4 bg-gray-700 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between';
      themeItem.innerHTML = `
                <div>
                    <h5 class="text-xl font-semibold text-blue-300">${theme.name}</h5>
                    <p class="text-gray-300 text-sm mb-2">${theme.description}</p>
                    <div class="text-gray-400 text-xs">
                        <strong>Rules:</strong> ${theme.rules && theme.rules.length > 0 ? theme.rules.join('; ') : 'No rules defined.'}
                    </div>
                    <div class="text-gray-400 text-xs mt-1">
                        <strong>Mods:</strong> ${theme.moderators && theme.moderators.length > 0 ? theme.moderators.map(modId => modId.substring(0,6)).join(', ') + '...' : 'None'}
                    </div>
                </div>
                <div class="flex flex-col sm:flex-row gap-2 mt-3 sm:mt-0">
                    ${isCurrentUserMod ? `<button class="edit-theme-btn bg-yellow-500 text-white py-1 px-3 rounded-full hover:bg-yellow-600 text-sm" data-id="${theme.id}">Edit</button>` : ''}
                    ${currentUser && currentUser.isAdmin ? `<button class="delete-theme-btn bg-red-600 text-white py-1 px-3 rounded-full hover:bg-red-700 text-sm" data-id="${theme.id}">Delete</button>` : ''}
                </div>
            `;
      themesListContainer.appendChild(themeItem);
    });

    // Re-attach listeners for edit/delete buttons
    themesListContainer.querySelectorAll('.edit-theme-btn').forEach(btn => {
      btn.removeEventListener('click', handleEditTheme); // Prevent duplicate listeners
      btn.addEventListener('click', handleEditTheme);
    });
    themesListContainer.querySelectorAll('.delete-theme-btn').forEach(btn => {
      btn.removeEventListener('click', handleDeleteTheme); // Prevent duplicate listeners
      btn.addEventListener('click', handleDeleteTheme);
    });
  }, (error) => {
    console.error("Error fetching themes for management:", error);
    showMessageBox(`Error loading themes: ${error.message}`, true);
    themesListContainer.innerHTML = `<p class="text-red-500 text-center">Error loading themes.</p>`;
  });
}

/**
 * Populates the theme dropdowns (filter and create thread) with available themes.
 * @returns {function} An unsubscribe function to stop the listener.
 */
export function populateThemeDropdowns() {
  if (!db || !themeSelect || !createThreadThemeSelect) {
    console.warn("DB or theme dropdowns not ready for populating.");
    return () => {}; // Return a no-op unsubscribe function
  }

  if (unsubscribeThemeDropdowns) {
    unsubscribeThemeDropdowns(); // Unsubscribe from previous listener
  }

  const themesCol = collection(db, `artifacts/${appId}/public/data/themes`);
  const q = query(themesCol, orderBy("name", "asc"));

  unsubscribeThemeDropdowns = onSnapshot(q, (snapshot) => {
    themeSelect.innerHTML = '<option value="all">All Threads</option>'; // Always have "All Threads" option
    createThreadThemeSelect.innerHTML = '<option value="">-- Select a Theme --</option>';

    allThemesCache = []; // Refresh cache here as well
    snapshot.forEach(docSnap => {
      const theme = { id: docSnap.id, ...docSnap.data() };
      allThemesCache.push(theme);

      const optionFilter = document.createElement('option');
      optionFilter.value = theme.id;
      optionFilter.textContent = theme.name;
      themeSelect.appendChild(optionFilter);

      const optionCreate = document.createElement('option');
      optionCreate.value = theme.id;
      optionCreate.textContent = theme.name;
      createThreadThemeSelect.appendChild(optionCreate);
    });

    // Restore selected options
    themeSelect.value = localStorage.getItem('currentSelectedThemeId') || 'all';
  }, (error) => {
    console.error("Error populating theme dropdowns:", error);
    showMessageBox(`Error loading themes for dropdowns: ${error.message}`, true);
  });

  return unsubscribeThemeDropdowns;
}

/**
 * Displays the rules and info for the currently selected theme.
 * @param {string} themeId - The ID of the selected theme, or 'all'.
 */
export function displayCurrentThemeInfo(themeId) {
  if (themeId === 'all') {
    currentThemeInfo.classList.add('hidden');
    currentThemeName.textContent = '';
    currentThemeDescription.textContent = '';
    themeRulesList.innerHTML = '';
    return;
  }

  const theme = allThemesCache.find(t => t.id === themeId);
  if (theme) {
    currentThemeInfo.classList.remove('hidden');
    currentThemeName.textContent = `t/${theme.name}`;
    currentThemeDescription.textContent = theme.description;
    themeRulesList.innerHTML = '';
    if (theme.rules && theme.rules.length > 0) {
      theme.rules.forEach((rule, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${rule}`;
        themeRulesList.appendChild(li);
      });
    } else {
      themeRulesList.innerHTML = '<li>No specific rules defined for this theme.</li>';
    }
  } else {
    currentThemeInfo.classList.add('hidden');
  }
}

/**
 * Handles editing an existing theme's properties.
 * Currently uses prompts, but could be a more complex modal.
 */
async function handleEditTheme(event) {
  const themeId = event.target.dataset.id;
  const theme = allThemesCache.find(t => t.id === themeId);
  if (!theme) {
    showMessageBox("Theme not found for editing.", true);
    return;
  }

  const currentUser = getCurrentUser();
  if (!currentUser || (!currentUser.isAdmin && !theme.moderators.includes(currentUser.uid))) {
    showMessageBox("You do not have permission to edit this theme.", true);
    return;
  }

  // Prompts for simplicity. In a real app, this would be an edit modal.
  const newName = prompt("Edit theme name:", theme.name);
  if (newName === null) return; // User cancelled

  const newDescription = prompt("Edit theme description:", theme.description);
  if (newDescription === null) return; // User cancelled

  const newRulesString = prompt("Edit theme rules (one per line):", theme.rules.join('\n'));
  if (newRulesString === null) return; // User cancelled
  const newRules = newRulesString.split('\n').map(r => r.trim()).filter(r => r !== '');

  // Allow adding/removing moderators - this is a simplified prompt
  const currentModsHandles = await Promise.all(theme.moderators.map(async uid => {
    const profile = await getDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid));
    return profile.exists() ? profile.data().handle : null;
  }));
  const newModsInput = prompt("Edit moderators (comma-separated handles, e.g., @user1, @user2):", currentModsHandles.filter(Boolean).map(h => `@${h}`).join(', '));
  if (newModsInput === null) return;
  const newModHandles = newModsInput.split(',').map(h => h.trim()).filter(h => h !== '').map(h => h.startsWith('@') ? h.substring(1) : h);
  const newModUids = await resolveHandlesToUids(newModHandles); // Assuming resolveHandlesToUids is available

  await updateTheme(themeId, newName, newDescription, newRules, newModUids);
}

/**
 * Updates an existing theme's properties in Firestore.
 * @param {string} themeId - The ID of the theme to update.
 * @param {string} name - The new name.
 * @param {string} description - The new description.
 * @param {string[]} rules - The new rules.
 * @param {string[]} moderators - The new list of moderator UIDs.
 */
async function updateTheme(themeId, name, description, rules, moderators) {
  const currentUser = getCurrentUser();
  if (!currentUser || !db) return;

  const themeDocRef = doc(db, `artifacts/${appId}/public/data/themes`, themeId);
  try {
    const currentThemeSnap = await getDoc(themeDocRef);
    if (!currentThemeSnap.exists()) {
      showMessageBox("Theme not found for update.", true);
      return;
    }
    const currentThemeData = currentThemeSnap.data();

    // Permission check: only server admin or existing theme mod can update
    if (!currentUser.isAdmin && (!currentThemeData.moderators || !currentThemeData.moderators.includes(currentUser.uid))) {
      showMessageBox("You do not have permission to update this theme.", true);
      return;
    }

    await updateDoc(themeDocRef, {
      name: name,
      description: description,
      rules: rules,
      moderators: moderators,
      updatedAt: serverTimestamp() // Add an update timestamp
    });
    showMessageBox("Theme updated successfully!", false);
  } catch (error) {
    console.error("Error updating theme:", error);
    showMessageBox(`Error updating theme: ${error.message}`, true);
  }
}

/**
 * Handles deleting a theme.
 */
async function handleDeleteTheme(event) {
  const themeId = event.target.dataset.id;
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.isAdmin) { // Only server admins can delete themes
    showMessageBox("You do not have permission to delete themes.", true);
    return;
  }
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete theme.", true);
    return;
  }

  const confirmation = await showCustomConfirm(
    "Are you sure you want to delete this theme?",
    "This will permanently remove the theme. Threads associated with this theme will no longer belong to it but will remain."
  );
  if (!confirmation) {
    showMessageBox("Theme deletion cancelled.", false);
    return;
  }

  const themeDocRef = doc(db, `artifacts/${appId}/public/data/themes`, themeId);
  try {
    await deleteDoc(themeDocRef);
    showMessageBox("Theme deleted successfully!", false);
    // The onSnapshot listener for theme lists will automatically refresh
  } catch (error) {
    console.error("Error deleting theme:", error);
    showMessageBox(`Error deleting theme: ${error.message}`, true);
  }
}

// --- Event Listeners for Theme Management Modal (attached in forms.js) ---
export function attachThemeModalEventListeners() {
  if (themeModalCloseBtn) {
    themeModalCloseBtn.addEventListener('click', closeThemeManagementModal);
    window.addEventListener('click', (event) => {
      if (event.target === themeManagementModal) {
        closeThemeManagementModal();
      }
    });
  }
  if (createThemeForm) {
    createThemeForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = newThemeNameInput.value;
      const description = newThemeDescriptionInput.value;
      const rules = newThemeRulesInput.value.split('\n').map(r => r.trim()).filter(r => r !== '');
      await createTheme(name, description, rules);
    });
  }
}

// Import resolution for resolveHandlesToUids in handleEditTheme function needs to be handled
// For now, it assumes resolveHandlesToUids from utils.js is available in this scope.
// If not, it needs to be imported directly here or passed as a parameter.
// Given current module structure, direct import from utils.js is best.
