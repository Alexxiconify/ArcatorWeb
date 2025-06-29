// admin_and_dev.js: Handles Admin page functionality.
/* global EasyMDE */ // Declare EasyMDE as a global variable

// Import Firebase instances and user functions from the centralized init file
import {
  auth,
  db,
  appId,
  firebaseReadyPromise,
  DEFAULT_THEME_NAME,
  updateUserProfileInFirestore,
  currentUser as firebaseCurrentUser,
  onAuthStateChanged
} from './firebase-init.js';
import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';
import { EmailJSIntegration } from './emailjs-integration.js';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp // Ensure serverTimestamp is imported for Firestore operations
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showMessageBox, showCustomConfirm } from './utils.js'; // Import message box and confirm utility

// DOM elements - Initialize immediately after declaration
const loadingSpinner = document.getElementById('loading-spinner');
const loginRequiredMessage = document.getElementById('login-required-message');
const adminContent = document.getElementById('admin-content');

// User Management DOM elements
const loadUsersBtn = document.getElementById('load-users-btn');
const userListTbody = document.getElementById('user-list-tbody');
const editUserModal = document.getElementById('edit-user-modal');
const editUserDisplayNameInput = document.getElementById('edit-user-display-name');
const editUserHandleInput = document.getElementById('edit-user-handle');
const editUserEmailInput = document.getElementById('edit-user-email');
const editUserPhotoUrlInput = document.getElementById('edit-user-photo-url');
const editUserDiscordUrlInput = document.getElementById('edit-user-discord-url');
const editUserGithubUrlInput = document.getElementById('edit-user-github-url');
const editUserThemeSelect = document.getElementById('edit-user-theme');
const editUserFontScalingSelect = document.getElementById('edit-user-font-scaling');
const editUserNotificationFrequencySelect = document.getElementById('edit-user-notification-frequency');
const editUserEmailNotificationsCheckbox = document.getElementById('edit-user-email-notifications');
const editUserDiscordNotificationsCheckbox = document.getElementById('edit-user-discord-notifications');
const editUserPushNotificationsCheckbox = document.getElementById('edit-user-push-notifications');
const editUserDataRetentionSelect = document.getElementById('edit-user-data-retention');
const editUserProfileVisibleCheckbox = document.getElementById('edit-user-profile-visible');
const editUserActivityTrackingCheckbox = document.getElementById('edit-user-activity-tracking');
const editUserThirdPartySharingCheckbox = document.getElementById('edit-user-third-party-sharing');
const editUserHighContrastCheckbox = document.getElementById('edit-user-high-contrast');
const editUserReducedMotionCheckbox = document.getElementById('edit-user-reduced-motion');
const editUserScreenReaderCheckbox = document.getElementById('edit-user-screen-reader');
const editUserFocusIndicatorsCheckbox = document.getElementById('edit-user-focus-indicators');
const editUserKeyboardShortcutsSelect = document.getElementById('edit-user-keyboard-shortcuts');
const editUserDebugModeCheckbox = document.getElementById('edit-user-debug-mode');
const editUserCustomCssTextarea = document.getElementById('edit-user-custom-css');
const saveUserChangesBtn = document.getElementById('save-user-changes-btn');
const cancelUserChangesBtn = document.getElementById('cancel-user-changes-btn');
let currentEditingUserUid = null;

// Temporary Pages DOM elements
const createTempPageForm = document.getElementById('create-temp-page-form');
const tempPageTitleInput = document.getElementById('temp-page-title');
const tempPageContentInput = document.getElementById('temp-page-content');
const tempPageList = document.getElementById('temp-page-list');
const editTempPageModal = document.getElementById('edit-temp-page-modal');
const editTempPageTitleInput = document.getElementById('edit-temp-page-title');
const editTempPageContentInput = document.getElementById('edit-temp-page-content');
const saveTempPageChangesBtn = document.getElementById('save-temp-page-changes-btn');
let currentEditingTempPageId = null;

// Todo List DOM elements
const addTodoForm = document.getElementById('add-todo-form');
const todoTaskInput = document.getElementById('todo-task');
const todoWorkerInput = document.getElementById('todo-worker');
const todoPrioritySelect = document.getElementById('todo-priority');
const todoEtaInput = document.getElementById('todo-eta');
const todoNotesInput = document.getElementById('todo-notes');
const roadmapTodoListTbody = document.getElementById('roadmap-todo-list-tbody');
const editTodoModal = document.getElementById('edit-todo-modal');
const editTodoTaskInput = document.getElementById('edit-todo-task');
const editTodoWorkerInput = document.getElementById('edit-todo-worker');
const editTodoPrioritySelect = document.getElementById('edit-todo-priority');
const editTodoEtaInput = document.getElementById('edit-todo-eta');
const editTodoNotesInput = document.getElementById('edit-todo-notes');
const saveTodoChangesBtn = document.getElementById('save-todo-changes-btn');
let currentEditingTodoId = null;

// Collapsible section parent elements (used for showing/hiding entire sections based on login/admin status)
const infrastructureSection = document.getElementById('infrastructure-section');
const devToolsSection = document.getElementById('dev-tools-section');
const userManagementSection = document.getElementById('user-management-section');
const formManagementSection = document.getElementById('form-management-section');
const tempPagesSection = document.getElementById('temp-pages-section');
const importantLinksSection = document.getElementById('important-links-section');
const roadmapSection = document.getElementById('roadmap-section');
const darrionApiSection = document.getElementById('darrion-api-section');
const griefDetectionSection = document.getElementById('grief-detection-section');
const onfimNotificationsSection = document.getElementById('onfim-notifications-section');


// Collapsible section header and content elements (used for toggling content visibility)
const infrastructureHeader = document.getElementById('infrastructure-header');
const infrastructureContent = document.getElementById('infrastructure-content');
const devToolsHeader = document.getElementById('dev-tools-header');
const devToolsContent = document.getElementById('dev-tools-content');
const userManagementHeader = document.getElementById('user-management-header');
const userManagementContent = document.getElementById('user-management-content');
const formManagementHeader = document.getElementById('form-management-header');
const formManagementContent = document.getElementById('form-management-content');
const tempPagesHeader = document.getElementById('temp-pages-header');
const tempPagesContent = document.getElementById('temp-pages-content');
const importantLinksHeader = document.getElementById('important-links-header');
const importantLinksContent = document.getElementById('important-links-content');
const roadmapHeader = document.getElementById('roadmap-header');
const roadmapContent = document.getElementById('roadmap-content');
const darrionApiHeader = document.getElementById('darrion-api-header');
const darrionApiContent = document.getElementById('darrion-api-content');
const griefDetectionHeader = document.getElementById('grief-detection-header');
const griefDetectionContent = document.getElementById('grief-detection-content');
const onfimNotificationsHeader = document.getElementById('onfim-notifications-header');
const onfimNotificationsContent = document.getElementById('onfim-notifications-content');

// Email Management DOM elements
const emailToSelect = document.getElementById('email-to-select');
const emailTemplateSelect = document.getElementById('email-template-select');
const emailSubjectInput = document.getElementById('email-subject');
const emailContentTextarea = document.getElementById('email-content');
const emailHtmlFormatCheckbox = document.getElementById('email-html-format');
const emailComposeForm = document.getElementById('email-compose-form');
const previewEmailBtn = document.getElementById('preview-email-btn');
const emailHistoryTbody = document.getElementById('email-history-tbody');

// EasyMDE instances (No longer using EasyMDE for temporary pages - it will be HTML editor)
// let easyMDECreate;
// let easyMDEEdit;


/**
 * Toggles the visibility of a collapsible section.
 * @param {HTMLElement} headerElement - The header element of the section.
 * @param {HTMLElement} contentElement - The content element of the section.
 */
function toggleSection(headerElement, contentElement) {
  const isHidden = contentElement.classList.contains('hidden');
  if (isHidden) {
    contentElement.classList.remove('hidden');
    // Rotate the arrow icon if it exists
    headerElement.querySelector('svg')?.classList.remove('rotate-90');
  } else {
    contentElement.classList.add('hidden');
    // Rotate the arrow icon if it exists
    headerElement.querySelector('svg')?.classList.add('rotate-90');
  }
}

// Global variables for user management
let usersData = [];
let currentEditingUser = null;

async function loadUsers() {
  if (!db) {
    console.error("Firestore DB not initialized for loadUsers.");
    showMessageBox("Database not ready.", true);
    return;
  }

  try {
    const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
    const querySnapshot = await getDocs(usersRef);
    usersData = [];
    querySnapshot.forEach(doc => {
      usersData.push({ uid: doc.id, ...doc.data() });
    });

    await renderUserList();
    showMessageBox(`Loaded ${usersData.length} users successfully!`, false);
  } catch (error) {
    console.error("Error loading users:", error);
    showMessageBox("Error loading users: " + error.message, true);
  }
}

/**
 * Renders the list of users in the table.
 */
async function renderUserList() {
  const tbody = document.getElementById('user-list-tbody');
  
  if (!usersData || usersData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="text-center py-4 text-text-secondary text-xs" colspan="5">No users found.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = usersData.map(user => {
    const displayName = user.displayName || 'N/A';
    const email = user.email || 'N/A';
    const theme = user.themePreference || 'dark';
    const handle = user.handle || 'N/A';
    
    return `
      <tr class="hover:bg-table-row-even-bg transition-colors">
        <td class="px-2 py-1 text-text-primary text-xs font-mono">${user.uid.substring(0, 8)}...</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(displayName)}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${escapeHtml(email)}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${escapeHtml(theme)}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">
          <div class="flex space-x-1">
            <button 
              onclick="openEditUserModal('${user.uid}', ${JSON.stringify(user).replace(/"/g, '&quot;')})"
              class="text-blue-400 hover:text-blue-300 transition-colors"
              title="Edit User"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <button 
              onclick="deleteUserProfile('${user.uid}', '${escapeHtml(displayName)}')"
              class="text-red-400 hover:text-red-300 transition-colors"
              title="Delete Profile"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Opens the modal for editing a user's profile.
 * @param {string} uid - The UID of the user to edit.
 * @param {Object} userData - The complete user profile data.
 */
function openEditUserModal(uid, userData) {
  console.log("DEBUG: Opening edit modal for user:", uid, userData);
  
  // Store the current user being edited
  currentEditingUser = { uid, ...userData };
  
  // Populate form fields
  document.getElementById('edit-user-display-name').value = userData.displayName || '';
  document.getElementById('edit-user-handle').value = userData.handle || '';
  document.getElementById('edit-user-email').value = userData.email || '';
  document.getElementById('edit-user-photo-url').value = userData.photoURL || '';
  document.getElementById('edit-user-discord-url').value = userData.discordURL || '';
  document.getElementById('edit-user-github-url').value = userData.githubURL || '';
  
  // Populate theme select
  populateEditUserThemeSelect(userData.themePreference);
  
  // Populate other fields
  document.getElementById('edit-user-font-scaling').value = userData.fontScaling || 'normal';
  document.getElementById('edit-user-notification-frequency').value = userData.notificationFrequency || 'immediate';
  document.getElementById('edit-user-email-notifications').checked = userData.emailNotifications || false;
  document.getElementById('edit-user-discord-notifications').checked = userData.discordNotifications || false;
  document.getElementById('edit-user-push-notifications').checked = userData.pushNotifications || false;
  document.getElementById('edit-user-data-retention').value = userData.dataRetention || '365';
  document.getElementById('edit-user-profile-visible').checked = userData.profileVisible !== false;
  document.getElementById('edit-user-activity-tracking').checked = userData.activityTracking !== false;
  document.getElementById('edit-user-third-party-sharing').checked = userData.thirdPartySharing || false;
  document.getElementById('edit-user-high-contrast').checked = userData.highContrast || false;
  document.getElementById('edit-user-reduced-motion').checked = userData.reducedMotion || false;
  document.getElementById('edit-user-screen-reader').checked = userData.screenReader || false;
  document.getElementById('edit-user-focus-indicators').checked = userData.focusIndicators || false;
  document.getElementById('edit-user-keyboard-shortcuts').value = userData.keyboardShortcuts || 'enabled';
  document.getElementById('edit-user-debug-mode').checked = userData.debugMode || false;
  document.getElementById('edit-user-custom-css').value = userData.customCSS || '';
  
  // Show the modal
  const modal = document.getElementById('edit-user-modal');
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
}

/**
 * Populates the theme selection dropdown in the edit user modal.
 * @param {string} selectedThemeId - The currently selected theme ID for the user.
 */
async function populateEditUserThemeSelect(selectedThemeId) {
  editUserThemeSelect.innerHTML = ''; // Clear existing options
  const availableThemes = await getAvailableThemes(); // From themes.js
  availableThemes.forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    editUserThemeSelect.appendChild(option);
  });
  editUserThemeSelect.value = selectedThemeId; // Set the current theme
  console.log(`DEBUG: Edit User Theme Select populated with selected theme: ${selectedThemeId}`);
}


if (saveUserChangesBtn) {
  saveUserChangesBtn.addEventListener('click', async () => {
    console.log("DEBUG: Save User Changes button clicked.");
    if (!currentEditingUserUid) {
      console.error("ERROR: currentEditingUserUid is null. Cannot save changes.");
      return;
    }
    
    // Collect all form data
    const updatedProfile = {
      displayName: editUserDisplayNameInput.value.trim(),
      handle: editUserHandleInput.value.trim(),
      email: editUserEmailInput.value.trim(),
      photoURL: editUserPhotoUrlInput.value.trim(),
      discordURL: editUserDiscordUrlInput.value.trim(),
      githubURL: editUserGithubUrlInput.value.trim(),
      themePreference: editUserThemeSelect.value,
      fontScaling: editUserFontScalingSelect.value,
      
      // Notification Settings
      notificationSettings: {
        notificationFrequency: editUserNotificationFrequencySelect.value,
        emailNotifications: editUserEmailNotificationsCheckbox.checked,
        discordNotifications: editUserDiscordNotificationsCheckbox.checked,
        pushNotifications: editUserPushNotificationsCheckbox.checked
      },
      
      // Privacy Settings
      privacySettings: {
        dataRetention: parseInt(editUserDataRetentionSelect.value),
        profileVisible: editUserProfileVisibleCheckbox.checked,
        activityTracking: editUserActivityTrackingCheckbox.checked,
        thirdPartySharing: editUserThirdPartySharingCheckbox.checked
      },
      
      // Accessibility Settings
      accessibilitySettings: {
        highContrast: editUserHighContrastCheckbox.checked,
        reducedMotion: editUserReducedMotionCheckbox.checked,
        screenReader: editUserScreenReaderCheckbox.checked,
        focusIndicators: editUserFocusIndicatorsCheckbox.checked
      },
      
      // Advanced Settings
      keyboardShortcuts: editUserKeyboardShortcutsSelect.value,
      debugMode: editUserDebugModeCheckbox.checked,
      customCSS: editUserCustomCssTextarea.value.trim()
    };

    try {
      const userRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, currentEditingUserUid);
      await updateDoc(userRef, updatedProfile);
      
      showMessageBox("User profile updated successfully!");
      editUserModal.style.display = 'none';
      currentEditingUserUid = null;
      
      // Refresh the user list
      renderUserList();
    } catch (error) {
      console.error("Error updating user profile:", error);
      showMessageBox("Failed to update user profile", true);
    }
  });
}

if (cancelUserChangesBtn) {
  cancelUserChangesBtn.addEventListener('click', () => {
    editUserModal.style.display = 'none';
    currentEditingUserUid = null;
  });
}

// Attach listeners to all close buttons for modals
document.querySelectorAll('.close-button').forEach(button => {
  button.addEventListener('click', () => {
    console.log("DEBUG: Close button clicked on a modal.");
    editUserModal.style.display = 'none';
    editTempPageModal.style.display = 'none';
    editTodoModal.style.display = 'none';
    currentEditingUserUid = null; // Clear the current editing user
    // showCustomConfirm is handled internally by utils.js, so no direct `display = 'none'` needed here for it
  });
});

window.addEventListener('click', (event) => {
  // Only close if click is outside modal content
  if (event.target === editUserModal) {
    editUserModal.style.display = 'none';
    currentEditingUserUid = null; // Clear the current editing user
    console.log("DEBUG: User Edit Modal closed by clicking outside.");
  }
  if (event.target === editTempPageModal) {
    editTempPageModal.style.display = 'none';
    console.log("DEBUG: Temp Page Edit Modal closed by clicking outside.");
  }
  if (event.target === editTodoModal) {
    editTodoModal.style.display = 'none';
    console.log("DEBUG: Todo Edit Modal closed by clicking outside.");
  }
  // The custom confirm modal closing is managed by utils.js
});


// Temporary Pages Functions
async function createTempPage(title, content) {
  if (!db) {
    showMessageBox("Database not initialized. Cannot create page.", true);
    return;
  }
  const tempPagesCol = collection(db, `artifacts/${appId}/public/data/temp_pages`);
  try {
    const docRef = await addDoc(tempPagesCol, {
      title: title,
      content: content,
      createdAt: serverTimestamp(), // Use serverTimestamp
      updatedAt: serverTimestamp(), // Use serverTimestamp
      authorUid: auth.currentUser ? auth.currentUser.uid : 'anonymous'
    });
    showMessageBox("Temporary page created successfully!", false);
    tempPageTitleInput.value = '';
    tempPageContentInput.value = ''; // Clear content input
    renderTempPages();
    console.log("DEBUG: Temporary page created:", docRef.id);
  } catch (error) {
    console.error("ERROR: Error creating temporary page:", error);
    showMessageBox(`Error creating page: ${error.message}`, true);
  }
}

async function fetchAllTempPages() {
  if (!db) {
    console.error("Firestore DB not initialized for fetchAllTempPages.");
    return [];
  }
  const tempPagesCol = collection(db, `artifacts/${appId}/public/data/temp_pages`);
  try {
    const querySnapshot = await getDocs(tempPagesCol); // Directly use tempPagesCol for getDocs
    const pages = [];
    querySnapshot.forEach((doc) => {
      pages.push({ id: doc.id, ...doc.data() });
    });
    console.log("DEBUG: Fetched temporary pages:", pages.length);
    return pages;
  } catch (error) {
    console.error("ERROR: Error fetching temporary pages:", error);
    showMessageBox(`Error loading temporary pages: ${error.message}`, true);
    return [];
  }
}

async function renderTempPages() {
  if (!tempPageList) return;
  tempPageList.innerHTML = '<li>Loading temporary pages...</li>';
  const pages = await fetchAllTempPages();
  tempPageList.innerHTML = '';
  if (pages.length === 0) {
    tempPageList.innerHTML = '<li>No temporary pages created yet.</li>';
    return;
  }

  pages.forEach(page => {
    const li = document.createElement('li');
    // Apply theme-aware classes to list items for consistency
    li.classList.add('flex', 'flex-col', 'md:flex-row', 'md:items-center', 'justify-between', 'p-3', 'rounded-md', 'mb-2');
    li.style.backgroundColor = 'var(--color-bg-card)'; /* Apply card background color */
    li.style.color = 'var(--color-text-primary)'; /* Apply primary text color */

    li.innerHTML = `
      <span class="font-semibold break-all md:w-3/5">${page.title}</span>
      <div class="mt-2 md:mt-0 md:w-2/5 md:text-right">
        <a href="temp-page-viewer.html?id=${page.id}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline text-sm mr-2 view-temp-page">View</a>
        <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm mr-2 edit-temp-page-btn" data-id="${page.id}" data-title="${encodeURIComponent(page.title)}" data-content="${encodeURIComponent(page.content)}">Edit</button>
        <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm delete-temp-page-btn" data-id="${page.id}">Delete</button>
      </div>
    `;
    tempPageList.appendChild(li);
  });

  // No longer need separate click listeners for view-temp-page as it's a direct link
  document.querySelectorAll('.edit-temp-page-btn').forEach(button => {
    button.addEventListener('click', (event) => {
      console.log("DEBUG: Edit Temporary Page button clicked.");
      const id = event.target.dataset.id;
      const title = decodeURIComponent(event.target.dataset.title);
      const content = decodeURIComponent(event.target.dataset.content);
      console.log(`DEBUG: Edit Temp Page - ID: ${id}, Title: ${title}`);
      openEditTempPageModal(id, title, content);
    });
  });
  document.querySelectorAll('.delete-temp-page-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      console.log("DEBUG: Delete Temporary Page button clicked.");
      const id = event.target.dataset.id;
      await deleteTempPage(id);
    });
  });
}

function openEditTempPageModal(id, title, content) {
  currentEditingTempPageId = id;
  editTempPageTitleInput.value = title;
  editTempPageContentInput.value = content; // Set raw HTML content
  editTempPageModal.style.display = 'flex';
  console.log("DEBUG: Temporary Page Edit Modal opened.");
}

if (saveTempPageChangesBtn) {
  saveTempPageChangesBtn.addEventListener('click', async () => {
    console.log("DEBUG: Save Temp Page Changes button clicked.");
    if (!currentEditingTempPageId) {
      console.error("ERROR: currentEditingTempPageId is null. Cannot save changes.");
      return;
    }
    const newTitle = editTempPageTitleInput.value.trim();
    const newContent = editTempPageContentInput.value.trim(); // Get raw HTML content
    if (!newTitle || !newContent) {
      showMessageBox("Title and Content cannot be empty.", true);
      return;
    }
    console.log(`DEBUG: Saving Temp Page Changes for ID: ${currentEditingTempPageId}, New Title: ${newTitle}`);
    const tempPageDocRef = doc(db, `artifacts/${appId}/public/data/temp_pages`, currentEditingTempPageId);
    try {
      await updateDoc(tempPageDocRef, {
        title: newTitle,
        content: newContent,
        updatedAt: serverTimestamp() // Use serverTimestamp
      });
      showMessageBox("Temporary page updated successfully!", false);
      editTempPageModal.style.display = 'none';
      renderTempPages();
      console.log("DEBUG: Temporary page updated successfully in Firestore.");
    } catch (error) {
      console.error("ERROR: Error updating temporary page:", error);
      showMessageBox(`Error updating page: ${error.message}`, true);
    }
  });
}

async function deleteTempPage(id) {
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete page.", true);
    return;
  }
  const confirmation = await showCustomConfirm("Are you sure you want to delete this temporary page?", "This action cannot be undone.");

  if (!confirmation) {
    showMessageBox("Deletion cancelled.", false);
    return;
  }

  const tempPageDocRef = doc(db, `artifacts/${appId}/public/data/temp_pages`, id);
  try {
    await deleteDoc(tempPageDocRef);
    showMessageBox("Temporary page deleted successfully!", false);
    renderTempPages();
    console.log("DEBUG: Temporary page deleted:", id);
  } catch (error) {
    console.error("ERROR: Error deleting temporary page:", error);
    showMessageBox(`Error deleting page: ${error.message}`, true);
  }
}

/**
 * Updates the UI based on the user's authentication and admin status.
 * This function now explicitly waits for firebaseCurrentUser to be populated with isAdmin.
 * @param {Object|null} user - The Firebase User object or null.
 */
const updateAdminUI = async (user) => { // Changed to const arrow function
  console.log("DEBUG: updateAdminUI called with user:", user);
  const adminContent = document.getElementById('admin-content');
  const loginRequiredMessage = document.getElementById('login-required-message');
  const loadingSpinner = document.getElementById('loading-spinner');

  if (loadingSpinner) {
    loadingSpinner.style.display = 'none';
  }

  if (user) {
    const isAdmin = user.isAdmin === true;
    if (loginRequiredMessage) loginRequiredMessage.style.display = 'none';
    if (adminContent) adminContent.style.display = 'block';

    // Section IDs
    const allSections = [
      'infrastructure-section',
      'dev-tools-section',
      'user-management-section',
      'form-management-section',
      'temp-pages-section',
      'important-links-section',
      'roadmap-section',
      'darrion-api-section',
      'grief-detection-section',
      'onfim-notifications-section',
      'email-management-section'
    ];

    allSections.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) section.style.display = 'none';
    });

    if (isAdmin) {
      // Show all admin sections
      allSections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) section.style.display = 'block';
      });
    } else {
      // Only show email management for non-admins
      const emailSection = document.getElementById('email-management-section');
      if (emailSection) emailSection.style.display = 'block';
    }

    setupCollapsibleSections();
    setupEventListeners();
    const userManagementHeader = document.getElementById('user-management-header');
    if (userManagementHeader) {
      userManagementHeader.addEventListener('click', async function() {
        const content = this.nextElementSibling;
        if (content.classList.contains('hidden') && usersData.length === 0) {
          await loadUsers();
        }
      });
    }
  } else {
    if (adminContent) adminContent.style.display = 'none';
    if (loginRequiredMessage) loginRequiredMessage.style.display = 'block';
  }
};

// Todo List Functions
async function addTodoItem(task, worker, priority, eta, notes) {
  if (!db) {
    showMessageBox("Database not initialized. Cannot add task.", true);
    return;
  }
  const todosCol = collection(db, `artifacts/${appId}/public/data/roadmap_todos`);
  try {
    const docRef = await addDoc(todosCol, {
      task: task,
      worker: worker,
      priority: priority,
      eta: eta,
      notes: notes,
      createdAt: serverTimestamp() // Use serverTimestamp
    });
    showMessageBox("Task added successfully!", false);
    todoTaskInput.value = '';
    todoWorkerInput.value = '';
    todoPrioritySelect.value = 'Low';
    todoEtaInput.value = '';
    todoNotesInput.value = '';
    renderTodoList();
    console.log("DEBUG: Todo item added:", docRef.id);
  } catch (error) {
    console.error("Error adding todo item:", error);
    showMessageBox(`Error adding task: ${error.message}`, true);
  }
}

async function fetchAllTodoItems() {
  if (!db) {
    console.error("Firestore DB not initialized for fetchAllTodoItems.");
    return [];
  }
  const todosCol = collection(db, `artifacts/${appId}/public/data/roadmap_todos`);
  const q = query(todosCol, orderBy("createdAt", "asc"));
  try {
    const querySnapshot = await getDocs(q);
    const todos = [];
    querySnapshot.forEach((doc) => {
      todos.push({ id: doc.id, ...doc.data() });
    });
    console.log("DEBUG: Fetched todo items:", todos.length);
    return todos;
  }
  catch (error) {
    console.error("ERROR: Error fetching todo items:", error);
    showMessageBox(`Error loading tasks: ${error.message}`, true);
    return [];
  }
}

async function renderTodoList() {
  if (!roadmapTodoListTbody) return;
  roadmapTodoListTbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-400">Loading roadmap tasks...</td></tr>';
  const todos = await fetchAllTodoItems();
  roadmapTodoListTbody.innerHTML = '';
  if (todos.length === 0) {
    roadmapTodoListTbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-400">No roadmap tasks found. Add a new task above.</td></tr>';
    return;
  }

  todos.forEach(todo => {
    const row = roadmapTodoListTbody.insertRow();
    // Apply theme-aware classes to the table rows/cells for consistency
    row.classList.add('text-text-primary'); // Apply primary text color
    if (roadmapTodoListTbody.rows.length % 2 === 0) { // Check if it's an even row
      row.style.backgroundColor = 'var(--color-table-row-even-bg)';
    }
    row.innerHTML = `
      <td class="px-4 py-2 border-b border-table-td-border">${todo.task || 'N/A'}</td>
      <td class="px-4 py-2 border-b border-table-td-border">${todo.worker || 'N/A'}</td>
      <td class="px-4 py-2 border-b border-table-td-border">${todo.priority || 'N/A'}</td>
      <td class="px-4 py-2 break-all border-b border-table-td-border">${todo.notes || 'N/A'}</td>
      <td class="px-4 py-2 border-b border-table-td-border">
        <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm mr-2 edit-todo-btn"
                data-id="${todo.id}" data-task="${encodeURIComponent(todo.task || '')}" data-worker="${encodeURIComponent(todo.worker || '')}"
                data-priority="${encodeURIComponent(todo.priority || '')}" data-eta="${encodeURIComponent(todo.eta || '')}" data-notes="${encodeURIComponent(todo.notes || '')}">Edit</button>
        <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm delete-todo-btn" data-id="${todo.id}">Delete</button>
      </td>
    `;
  });

  document.querySelectorAll('.edit-todo-btn').forEach(button => {
    button.addEventListener('click', (event) => {
      console.log("DEBUG: Edit Todo button clicked.");
      const { id, task, worker, priority, eta, notes } = event.target.dataset;
      openEditTodoModal(id, decodeURIComponent(task), decodeURIComponent(worker), decodeURIComponent(priority), decodeURIComponent(eta), decodeURIComponent(notes));
    });
  });

  document.querySelectorAll('.delete-todo-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      console.log("DEBUG: Delete Todo button clicked.");
      const id = event.target.dataset.id;
      await deleteTodoItem(id);
    });
  });
}

function openEditTodoModal(id, task, worker, priority, eta, notes) {
  currentEditingTodoId = id;
  editTodoTaskInput.value = task;
  editTodoWorkerInput.value = worker;
  editTodoPrioritySelect.value = priority;
  editTodoEtaInput.value = eta;
  editTodoNotesInput.value = notes;
  editTodoModal.style.display = 'flex';
  console.log("DEBUG: Todo Edit Modal opened.");
}

async function updateTodoItem(id, task, worker, priority, eta, notes) {
  if (!db) {
    showMessageBox("Database not initialized. Cannot save changes.", true);
    return;
  }
  const todoDocRef = doc(db, `artifacts/${appId}/public/data/roadmap_todos`, id);
  try {
    await updateDoc(todoDocRef, {
      task: task,
      worker: worker,
      priority: priority,
      eta: eta,
      notes: notes,
      updatedAt: serverTimestamp() // Use serverTimestamp
    });
    showMessageBox("Task updated successfully!", false);
    editTodoModal.style.display = 'none';
    renderTodoList();
    console.log("DEBUG: Todo item updated successfully in Firestore.");
  } catch (error) {
    console.error("ERROR: Error updating todo item:", error);
    showMessageBox(`Error updating task: ${error.message}`, true);
  }
}

async function deleteTodoItem(id) {
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete task.", true);
    return;
  }
  const confirmation = await showCustomConfirm("Are you sure you want to delete this roadmap task?", "This action cannot be undone.");
  if (!confirmation) {
    showMessageBox("Deletion cancelled.", false);
    return;
  }

  const todoDocRef = doc(db, `artifacts/${appId}/public/data/roadmap_todos`, id);
  try {
    await deleteDoc(todoDocRef);
    showMessageBox("Task deleted successfully!", false);
    renderTodoList();
    console.log("DEBUG: Todo item deleted:", id);
  } catch (error) {
    console.error("ERROR: Error deleting todo item:", error);
    showMessageBox(`Error deleting task: ${error.message}`, true);
  }
}

// Email templates
const emailTemplates = {
  welcome: {
    subject: 'Welcome to Arcator.co.uk!',
    content: `Hello {{displayName}},

Welcome to Arcator.co.uk! We're excited to have you join our Minecraft community.

Here are some things you can do to get started:
- Join our Discord server: https://discord.gg/GwArgw2
- Check out our servers at arcator.co.uk
- Explore the community features on our website

If you have any questions, feel free to reach out to our staff.

Best regards,
The Arcator Team`
  },
  announcement: {
    subject: 'Important Announcement from Arcator',
    content: `Hello {{displayName}},

We have an important announcement to share with our community.

{{announcementContent}}

Thank you for being part of our community!

Best regards,
The Arcator Team`
  },
  maintenance: {
    subject: 'Scheduled Maintenance Notice',
    content: `Hello {{displayName}},

We wanted to let you know about upcoming scheduled maintenance.

{{maintenanceDetails}}

We apologize for any inconvenience and appreciate your patience.

Best regards,
The Arcator Team`
  },
  event: {
    subject: 'You\'re Invited: Arcator Community Event',
    content: `Hello {{displayName}},

You're invited to join us for a special community event!

{{eventDetails}}

We hope to see you there!

Best regards,
The Arcator Team`
  }
};

// Email functionality
async function populateEmailRecipients() {
  if (!db) {
    console.error("Firestore DB not initialized for populateEmailRecipients.");
    return;
  }

  try {
    const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
    const querySnapshot = await getDocs(usersRef);
    
    const emailToSelect = document.getElementById('email-to-select');
    emailToSelect.innerHTML = '<option value="" disabled>Select recipients...</option>';
    
    querySnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.email && userData.displayName) {
        const option = document.createElement('option');
        option.value = userData.email; // Use email as value instead of user ID
        option.textContent = `${userData.displayName} (${userData.email})`;
        emailToSelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error("Error populating email recipients:", error);
    showMessageBox("Failed to load email recipients", true);
  }
}

async function handleEmailTemplateChange() {
  const template = emailTemplateSelect.value;
  if (template && emailTemplates[template]) {
    emailSubjectInput.value = emailTemplates[template].subject;
    emailContentTextarea.value = emailTemplates[template].content;
  }
}

// Create email preview modal
function createEmailPreviewModal() {
  const modal = document.createElement('div');
  modal.id = 'email-preview-modal';
  modal.className = 'modal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold text-heading-card">Email Preview</h3>
        <button class="close-button text-2xl font-bold text-text-secondary hover:text-text-primary transition-colors">&times;</button>
      </div>
      <div id="email-preview-content" class="bg-card p-4 rounded-lg border border-input-border">
        <div class="mb-4">
          <strong class="text-text-primary">From:</strong>
          <span id="preview-sender" class="text-text-secondary ml-2">noreply@arcator-web.firebaseapp.com</span>
        </div>
        <div class="mb-4">
          <strong class="text-text-primary">To:</strong>
          <span id="preview-recipients" class="text-text-secondary ml-2"></span>
        </div>
        <div class="mb-4">
          <strong class="text-text-primary">Subject:</strong>
          <span id="preview-subject" class="text-text-secondary ml-2"></span>
        </div>
        <div class="mb-4">
          <strong class="text-text-primary">Content:</strong>
          <div id="preview-content" class="mt-2 p-3 bg-input-bg rounded border border-input-border text-input-text whitespace-pre-wrap"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Add event listeners
  const closeBtn = modal.querySelector('.close-button');
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  return modal;
}

function showEmailPreview() {
  const recipients = Array.from(emailToSelect.selectedOptions).map(option => option.textContent);
  const subject = emailSubjectInput.value.trim();
  const content = emailContentTextarea.value.trim();
  const isHtml = emailHtmlFormatCheckbox.checked;
  const sender = 'noreply@arcator-web.firebaseapp.com';
  
  if (!subject || !content) {
    showMessageBox("Please fill in both subject and content to preview", true);
    return;
  }
  
  if (recipients.length === 0) {
    showMessageBox("Please select at least one recipient", true);
    return;
  }
  
  // Create modal if it doesn't exist
  let modal = document.getElementById('email-preview-modal');
  if (!modal) {
    modal = createEmailPreviewModal();
  }
  
  // Populate preview content
  document.getElementById('preview-sender').textContent = sender;
  document.getElementById('preview-recipients').textContent = recipients.join(', ');
  document.getElementById('preview-subject').textContent = subject;
  
  const previewContent = document.getElementById('preview-content');
  if (isHtml) {
    previewContent.innerHTML = content;
  } else {
    previewContent.textContent = content;
  }
  
  modal.style.display = 'flex';
}

async function sendEmail() {
  if (!db) {
    console.error("Firestore DB not initialized for sendEmail.");
    showMessageBox("Database not initialized", true);
    return;
  }

  const form = document.getElementById('email-compose-form');
  const formData = new FormData(form);
  
  // Get selected recipients and filter out empty values explicitly
  const selectedOptions = document.getElementById('email-to-select').selectedOptions;
  const recipients = Array.from(selectedOptions)
    .map(option => option.value)
    .filter(email => email && email.trim() !== ''); // Explicitly filter out empty values
    
  const subject = document.getElementById('email-subject').value.trim();
  const content = document.getElementById('email-content').value.trim();
  const isHtml = document.getElementById('email-html-format').checked;
  const template = document.getElementById('email-template-select').value;

  // Validation
  if (!recipients.length) {
    showMessageBox("Please select at least one recipient", true);
    return;
  }
  if (!subject) {
    showMessageBox("Please enter a subject", true);
    return;
  }
  if (!content) {
    showMessageBox("Please enter message content", true);
    return;
  }

  try {
    showMessageBox("Sending email...", false);
    
    // Process each recipient individually (Cloud Function expects single recipient)
    let successCount = 0;
    let errorCount = 0;
    
    for (const recipientEmail of recipients) {
      try {
        // Create the document structure that the Cloud Function expects
        const emailData = {
          to: recipientEmail,
          from: 'noreply@arcator-web.firebaseapp.com', // Required sender address
          subject: subject,
          content: content,
          isHtml: isHtml,
          sentAt: serverTimestamp(),
          status: 'pending',
          template: template || 'custom'
        };
        
        // Add to Firestore - this will trigger the Cloud Function
        const emailRef = await addDoc(collection(db, `artifacts/${appId}/public/data/email_history`), emailData);
        
        console.log(`Email queued for ${recipientEmail}: ${subject} (ID: ${emailRef.id})`);
        successCount++;
        
      } catch (error) {
        console.error(`Error queuing email for ${recipientEmail}:`, error);
        errorCount++;
      }
    }
    
    if (errorCount === 0) {
      showMessageBox(`Email queued successfully for ${successCount} recipient(s)! Check email history for status.`, false);
    } else if (successCount > 0) {
      showMessageBox(`Email queued for ${successCount} recipient(s), ${errorCount} failed. Check email history for status.`, true);
    } else {
      showMessageBox("Failed to queue email for any recipients", true);
    }
    
    // Clear form
    form.reset();
    
    // Refresh email history
    loadEmailHistory();
    
  } catch (error) {
    console.error("Error sending email:", error);
    showMessageBox("Failed to send email: " + error.message, true);
  }
}

async function loadEmailHistory() {
  if (!db) {
    console.error("Firestore DB not initialized for loadEmailHistory.");
    return;
  }

  try {
    const emailHistoryRef = collection(db, `artifacts/${appId}/public/data/email_history`);
    const q = query(emailHistoryRef, orderBy("sentAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    emailHistoryTbody.innerHTML = '';
    
    if (querySnapshot.empty) {
      emailHistoryTbody.innerHTML = '<tr><td class="text-center py-4 text-text-secondary" colspan="5">No emails sent yet.</td></tr>';
      return;
    }

    querySnapshot.forEach(doc => {
      const emailData = doc.data();
      const sentDate = emailData.sentAt?.toDate?.()?.toLocaleDateString() || 'Unknown';
      const status = emailData.status || 'unknown';
      const statusClass = status === 'sent' ? 'bg-green-100 text-green-800' : 
                         status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                         status === 'failed' ? 'bg-red-100 text-red-800' :
                         'bg-gray-100 text-gray-800';
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="px-4 py-2 text-text-primary">${sentDate}</td>
        <td class="px-4 py-2 text-text-primary">${escapeHtml(emailData.subject)}</td>
        <td class="px-4 py-2 text-text-primary">${emailData.recipients?.length || 0} recipients</td>
        <td class="px-4 py-2 text-text-primary">
          <span class="px-2 py-1 rounded text-xs ${statusClass}">
            ${status}${emailData.sentCount ? ` (${emailData.sentCount}/${emailData.recipients?.length})` : ''}
          </span>
        </td>
        <td class="px-4 py-2 text-text-primary">
          <button class="text-link hover:underline" onclick="viewEmailDetails('${doc.id}')">View</button>
        </td>
      `;
      emailHistoryTbody.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading email history:", error);
    showMessageBox("Failed to load email history", true);
  }
}

// Global function for viewing email details
window.viewEmailDetails = async function(emailId) {
  try {
    const emailDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/email_history`, emailId));
    if (!emailDoc.exists()) {
      showMessageBox("Email not found", true);
      return;
    }
    
    const emailData = emailDoc.data();
    
    // Create or get modal
    let modal = document.getElementById('email-details-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'email-details-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-heading-card">Email Details</h3>
            <button class="close-button text-2xl font-bold text-text-secondary hover:text-text-primary transition-colors">&times;</button>
          </div>
          <div id="email-details-content" class="space-y-4">
            <!-- Content will be populated here -->
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      // Add event listeners
      const closeBtn = modal.querySelector('.close-button');
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
      
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          modal.style.display = 'none';
        }
      });
    }
    
    const content = document.getElementById('email-details-content');
    content.innerHTML = `
      <div class="bg-card p-4 rounded-lg border border-input-border">
        <div class="mb-3">
          <strong class="text-text-primary">Subject:</strong>
          <span class="text-text-secondary ml-2">${escapeHtml(emailData.subject)}</span>
        </div>
        <div class="mb-3">
          <strong class="text-text-primary">Recipients:</strong>
          <span class="text-text-secondary ml-2">${emailData.recipientEmails?.join(', ') || 'N/A'}</span>
        </div>
        <div class="mb-3">
          <strong class="text-text-primary">Status:</strong>
          <span class="text-text-secondary ml-2">${emailData.status || 'unknown'}</span>
        </div>
        <div class="mb-3">
          <strong class="text-text-primary">Sent:</strong>
          <span class="text-text-secondary ml-2">${emailData.sentAt?.toDate?.()?.toLocaleString() || 'Unknown'}</span>
        </div>
        <div class="mb-3">
          <strong class="text-text-primary">Content:</strong>
          <div class="mt-2 p-3 bg-input-bg rounded border border-input-border text-input-text whitespace-pre-wrap">${emailData.isHtml ? emailData.content : escapeHtml(emailData.content)}</div>
        </div>
      </div>
    `;
    
    modal.style.display = 'flex';
  } catch (error) {
    console.error("Error viewing email details:", error);
    showMessageBox("Failed to load email details", true);
  }
};

// Main execution logic on window load
document.addEventListener('DOMContentLoaded', async function() {
  // Setup Firebase and user authentication first
  await firebaseReadyPromise; // Wait for Firebase to be ready

  // Initialize themes Firebase integration
  setupThemesFirebase(db, auth, appId);

  // Call the imported loadNavbar function.
  await loadNavbar(auth.currentUser, firebaseCurrentUser, DEFAULT_THEME_NAME);

  // Fix: Target the correct element ID for the current year in admin_and_dev.html footer
  const currentYearElement = document.getElementById('current-year-admin-dev');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear();
  } else {
    console.warn("Element with ID 'current-year-admin-dev' not found in admin_and_dev.html.");
  }

  // No longer initializing EasyMDE for new temp page creation form
  // if (tempPageContentInput) {
  //   easyMDECreate = new EasyMDE({
  //     element: tempPageContentInput,
  //     spellChecker: false,
  //     forceSync: true,
  //     minHeight: "200px",
  //     toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "guide"]
  //   });
  //   console.log("DEBUG: easyMDECreate initialized.");
  // }


  // After Firebase is set up and page content loaded, update UI based on auth state
  onAuthStateChanged(auth, (user) => {
    updateAdminUI(user);
  });

  // Create Temp Page form event listener
  createTempPageForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = tempPageTitleInput.value.trim();
    const content = tempPageContentInput.value.trim(); // Get raw HTML content
    if (!title || !content) {
      showMessageBox("Please enter both title and content for the temporary page.", true);
      return;
    }
    await createTempPage(title, content);
  });


  addTodoForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const task = todoTaskInput.value.trim();
    const worker = todoWorkerInput.value.trim();
    const priority = todoPrioritySelect.value;
    const eta = todoEtaInput.value.trim();
    const notes = todoNotesInput.value.trim();

    if (!task) {
      showMessageBox("Task description is required.", true);
      return;
    }
    await addTodoItem(task, worker, priority, eta, notes);
  });


  saveTodoChangesBtn?.addEventListener('click', async () => {
    if (!currentEditingTodoId) return;
    const task = editTodoTaskInput.value.trim();
    const worker = editTodoWorkerInput.value.trim();
    const priority = editTodoPrioritySelect.value;
    const eta = editTodoEtaInput.value.trim();
    const notes = editTodoNotesInput.value.trim();

    if (!task) {
      showMessageBox("Task description is required.", true);
      return;
    }
    await updateTodoItem(currentEditingTodoId, task, worker, priority, eta, notes);
  });

  // Attach event listeners for collapsible sections
  infrastructureHeader?.addEventListener('click', () => toggleSection(infrastructureHeader, infrastructureContent));
  devToolsHeader?.addEventListener('click', () => toggleSection(devToolsHeader, devToolsContent));
  userManagementHeader?.addEventListener('click', () => toggleSection(userManagementHeader, userManagementContent));
  formManagementHeader?.addEventListener('click', () => toggleSection(formManagementHeader, formManagementContent));
  tempPagesHeader?.addEventListener('click', () => toggleSection(tempPagesHeader, tempPagesContent));
  importantLinksHeader?.addEventListener('click', () => toggleSection(importantLinksHeader, importantLinksContent));
  roadmapHeader?.addEventListener('click', () => toggleSection(roadmapHeader, roadmapContent));
  darrionApiHeader?.addEventListener('click', () => toggleSection(darrionApiHeader, darrionApiContent));
  griefDetectionHeader?.addEventListener('click', () => toggleSection(griefDetectionHeader, griefDetectionContent));
  onfimNotificationsHeader?.addEventListener('click', () => toggleSection(onfimNotificationsHeader, onfimNotificationsContent));

  // Initialize all content sections as collapsed by default to save vertical space
  // Note: These now only add the 'hidden' class, their parent sections are controlled by updateAdminUI's display property.
  if (infrastructureContent) infrastructureContent.classList.add('hidden');
  if (devToolsContent) devToolsContent.classList.add('hidden');
  if (userManagementContent) userManagementContent.classList.add('hidden');
  if (formManagementContent) formManagementContent.classList.add('hidden');
  if (tempPagesContent) tempPagesContent.classList.add('hidden');
  if (importantLinksContent) importantLinksContent.classList.add('hidden');
  if (roadmapContent) roadmapContent.classList.add('hidden');
  if (darrionApiContent) darrionApiContent.classList.add('hidden');
  if (griefDetectionContent) griefDetectionContent.classList.add('hidden');
  if (onfimNotificationsContent) onfimNotificationsContent.classList.add('hidden');

  // Event listeners for email management
  if (emailTemplateSelect) {
    emailTemplateSelect.addEventListener('change', handleEmailTemplateChange);
  }

  if (previewEmailBtn) {
    previewEmailBtn.addEventListener('click', showEmailPreview);
  }

  if (emailComposeForm) {
    emailComposeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await sendEmail();
    });
  }

  // Load email recipients when email management section is opened
  document.addEventListener('DOMContentLoaded', () => {
    const emailManagementHeader = document.getElementById('email-management-header');
    if (emailManagementHeader) {
      emailManagementHeader.addEventListener('click', () => {
        const content = document.getElementById('email-management-content');
        if (content && !content.classList.contains('hidden')) {
          populateEmailRecipients();
          loadEmailHistory();
        }
      });
    }
  });

  // Setup modal event listeners
  const modal = document.getElementById('edit-user-modal');
  const closeButton = modal?.querySelector('.close-button');
  const saveButton = document.getElementById('save-user-changes-btn');
  const cancelButton = document.getElementById('cancel-user-changes-btn');
  const editForm = document.getElementById('edit-user-form');

  // Close modal when clicking the X button
  closeButton?.addEventListener('click', function() {
    modal.style.display = 'none';
    currentEditingUser = null;
  });

  // Close modal when clicking outside the modal content
  modal?.addEventListener('click', function(event) {
    if (event.target === modal) {
      modal.style.display = 'none';
      currentEditingUser = null;
    }
  });

  // Handle form submission
  editForm?.addEventListener('submit', async function(event) {
    event.preventDefault();
    await saveUserChanges();
  });

  // Cancel button
  cancelButton?.addEventListener('click', function() {
    modal.style.display = 'none';
    currentEditingUser = null;
  });
});

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Global function for delete user profile
window.deleteUserProfile = async function(uid, displayName) {
  console.log("DEBUG: Delete User button clicked for:", uid);
  
  // Show confirmation dialog with more details
  const confirmed = await showCustomConfirm(
    `Are you sure you want to delete the user profile for ${displayName}?`,
    "This action will permanently delete the user's profile data including all settings, preferences, and customizations. This will NOT delete the Firebase Authentication account. This action cannot be undone."
  );
  
  if (confirmed) {
    const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
    try {
      await deleteDoc(userDocRef);
      showMessageBox(`User profile ${displayName} deleted successfully!`, false);
      await loadUsers(); // Reload the user list
    } catch (error) {
      console.error("Error deleting user profile:", error);
      showMessageBox(`Error deleting user profile ${displayName}. ${error.message}`, true);
    }
  } else {
    showMessageBox("Deletion cancelled.", false);
  }
};

// Global function for opening edit modal
window.openEditUserModal = function(uid, userData) {
  openEditUserModal(uid, userData);
};

// Setup collapsible sections
function setupCollapsibleSections() {
  const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
  
  collapsibleHeaders.forEach(header => {
    header.addEventListener('click', function() {
      const content = this.nextElementSibling;
      const arrow = this.querySelector('svg');
      
      if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.classList.add('rotate-90');
        
        // Auto-load users when user management section is expanded
        if (this.id === 'user-management-header' && usersData.length === 0) {
          loadUsers();
        }
      } else {
        content.classList.add('hidden');
        arrow.classList.remove('rotate-90');
      }
    });
  });
}

// Save user changes function
async function saveUserChanges() {
  if (!currentEditingUser) {
    showMessageBox("No user selected for editing.", true);
    return;
  }

  try {
    const updatedData = {
      displayName: document.getElementById('edit-user-display-name').value,
      handle: document.getElementById('edit-user-handle').value,
      email: document.getElementById('edit-user-email').value,
      photoURL: document.getElementById('edit-user-photo-url').value,
      discordURL: document.getElementById('edit-user-discord-url').value,
      githubURL: document.getElementById('edit-user-github-url').value,
      themePreference: document.getElementById('edit-user-theme').value,
      fontScaling: document.getElementById('edit-user-font-scaling').value,
      notificationFrequency: document.getElementById('edit-user-notification-frequency').value,
      emailNotifications: document.getElementById('edit-user-email-notifications').checked,
      discordNotifications: document.getElementById('edit-user-discord-notifications').checked,
      pushNotifications: document.getElementById('edit-user-push-notifications').checked,
      dataRetention: document.getElementById('edit-user-data-retention').value,
      profileVisible: document.getElementById('edit-user-profile-visible').checked,
      activityTracking: document.getElementById('edit-user-activity-tracking').checked,
      thirdPartySharing: document.getElementById('edit-user-third-party-sharing').checked,
      highContrast: document.getElementById('edit-user-high-contrast').checked,
      reducedMotion: document.getElementById('edit-user-reduced-motion').checked,
      screenReader: document.getElementById('edit-user-screen-reader').checked,
      focusIndicators: document.getElementById('edit-user-focus-indicators').checked,
      keyboardShortcuts: document.getElementById('edit-user-keyboard-shortcuts').value,
      debugMode: document.getElementById('edit-user-debug-mode').checked,
      customCSS: document.getElementById('edit-user-custom-css').value,
      lastUpdated: new Date().toISOString()
    };

    const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, currentEditingUser.uid);
    await updateDoc(userDocRef, updatedData);

    showMessageBox("User profile updated successfully!", false);
    modal.style.display = 'none';
    currentEditingUser = null;
    
    // Reload the user list to show updated data
    await loadUsers();
  } catch (error) {
    console.error("Error updating user profile:", error);
    showMessageBox("Error updating user profile: " + error.message, true);
  }
}

// Setup event listeners for other admin functionality
function setupEventListeners() {
  // Load initial data for admin sections
  try {
    Promise.all([
      fetchAllTempPages(),
      fetchAllTodoItems(),
      loadEmailHistory(),
      populateEmailRecipients()
    ]);
  } catch (error) {
    console.error("Error loading initial admin data:", error);
    showMessageBox("Some data failed to load. Please refresh the page.", true);
  }
}
