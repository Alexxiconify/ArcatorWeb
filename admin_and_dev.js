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
import { 
  initializeEmailJS, 
  sendEmailWithEmailJS, 
  testEmailJSConnection, 
  getEmailJSStatus, 
  saveCredentials 
} from './emailjs-integration.js';
import { 
  sendEmailViaSMTP, 
  testSMTPServerConnection,
  getSMTPServerStatus,
  initializeSMTPIntegration 
} from './smtp-integration.js';
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

// DM History DOM elements
const dmHistoryTbody = document.getElementById('dm-history-tbody');

// Forms Management DOM elements
const formSubmissionsTbody = document.getElementById('form-submissions-tbody');

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

// Modal close buttons
document.querySelectorAll('.close-button').forEach(button => {
  button.addEventListener('click', () => {
    editUserModal.style.display = 'none';
    editTempPageModal.style.display = 'none';
  });
});

// Close modals when clicking outside
window.addEventListener('click', (event) => {
  if (event.target === editUserModal) {
    editUserModal.style.display = 'none';
  }
  if (event.target === editTempPageModal) {
    editTempPageModal.style.display = 'none';
  }
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

async function renderTempPages(tempPages) {
  const tbody = document.getElementById('temp-pages-tbody');
  if (!tbody) return;
  if (!tempPages || tempPages.length === 0) {
    tbody.innerHTML = '<tr><td class="text-center py-4 text-text-secondary text-xs" colspan="2">No temporary pages found.</td></tr>';
    return;
  }
  tbody.innerHTML = tempPages.map(page => `
    <tr>
      <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(page.title)}</td>
      <td class="px-2 py-1 text-text-secondary text-xs">
        <button onclick="openEditTempPageModal('${page.id}', '${escapeHtml(page.title)}', '${escapeHtml(page.content)}')" class="text-blue-400 hover:text-blue-300 transition-colors">Edit</button>
      </td>
    </tr>
  `).join('');
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
const updateAdminUI = async (user) => {
  if (!user) {
    loadingSpinner.style.display = 'none';
    loginRequiredMessage.style.display = 'block';
    adminContent.style.display = 'none';
    return;
  }

  try {
    loadingSpinner.style.display = 'block';
    loginRequiredMessage.style.display = 'none';
    adminContent.style.display = 'block';

    // Load all admin data
    await Promise.all([
      loadUsers(),
      loadDMHistory(),
      loadFormsData(),
      fetchAllTempPages(),
      populateEmailRecipients(),
      loadEmailHistory(),
      displayEmailJSStatus(),
      displaySMTPServerStatus()
    ]);

    loadingSpinner.style.display = 'none';
  } catch (error) {
    console.error("Error updating admin UI:", error);
    loadingSpinner.style.display = 'none';
    showMessageBox("Error loading admin data: " + error.message, true);
  }
};

// Email functionality - Using only EmailJS template
async function populateEmailRecipients() {
  const select = document.getElementById('email-to-select');
  if (!select) return;
  select.innerHTML = '<option value="" disabled>Select recipients...</option>';
  try {
    const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
    const querySnapshot = await getDocs(usersRef);
    let options = '';
    querySnapshot.forEach(doc => {
      const user = doc.data();
      if (user.email) {
        options += `<option value="${user.email}">${escapeHtml(user.displayName || user.email)} (${escapeHtml(user.email)})</option>`;
      }
    });
    select.innerHTML += options;
  } catch (e) {
    select.innerHTML = '<option value="" disabled>Failed to load users</option>';
  }
}
// Global function for viewing email details
window.viewEmailDetails = function(emailId) {
  // Implementation for viewing email details
  showMessageBox('Email details view not implemented yet.', true);
};

// Main execution logic on window load
document.addEventListener('DOMContentLoaded', async function() {
  // Setup Firebase and user authentication first
  await firebaseReadyPromise; // Wait for Firebase to be ready

  // Initialize themes Firebase integration
  setupThemesFirebase(db, auth, appId);

  // Call the imported loadNavbar function.
  await loadNavbar(auth.currentUser, firebaseCurrentUser, DEFAULT_THEME_NAME);
  
  // After Firebase is set up and page content loaded, update UI based on auth state
  onAuthStateChanged(auth, (user) => {updateAdminUI(user);});

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

  // Email management event listeners
  document.getElementById('email-compose-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await sendEmail();
  });

  document.getElementById('preview-email-btn').addEventListener('click', showEmailPreview);
  document.getElementById('email-template-select').addEventListener('change', handleEmailTemplateChange);
  
  // EmailJS buttons
  document.getElementById('test-emailjs-btn').addEventListener('click', testEmailJSConnectionHandler);
  document.getElementById('configure-emailjs-btn').addEventListener('click', configureEmailJS);
  
  // SMTP server buttons
  document.getElementById('test-smtp-btn').addEventListener('click', testSMTPServerConnectionHandler);
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

// Email Management Functions
async function setupEmailManagement() {
  const recipientTypeSelect = document.getElementById('email-recipient-type');
  const customRecipientsSection = document.getElementById('custom-recipients-section');
  const emailRecipientsList = document.getElementById('email-recipients-list');
  const emailTemplateSelect = document.getElementById('email-template');
  const emailComposeForm = document.getElementById('email-compose-form');
  const previewEmailBtn = document.getElementById('preview-email-btn');
  const saveDraftBtn = document.getElementById('save-draft-btn');

  // Recipient type change handler
  if (recipientTypeSelect) {
    recipientTypeSelect.addEventListener('change', async (e) => {
      const type = e.target.value;
      if (type === 'custom') {
        customRecipientsSection.style.display = 'block';
        await populateCustomRecipients();
      } else {
        customRecipientsSection.style.display = 'none';
      }
    });
  }

  // Email template change handler
  if (emailTemplateSelect) {
    emailTemplateSelect.addEventListener('change', handleEmailTemplateChange);
  }

  // Form submission handler
  if (emailComposeForm) {
    emailComposeForm.addEventListener('submit', sendEmail);
  }

  // Preview button handler
  if (previewEmailBtn) {
    previewEmailBtn.addEventListener('click', showEmailPreview);
  }

  // Save draft button handler
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', saveEmailDraft);
  }

  // Load email history
  await loadEmailHistory();
}

async function populateCustomRecipients() {
  const emailRecipientsList = document.getElementById('email-recipients-list');
  if (!emailRecipientsList || !usersData) return;

  emailRecipientsList.innerHTML = usersData.map(user => `
    <div class="flex items-center space-x-2">
      <input type="checkbox" id="recipient-${user.uid}" value="${user.email}" class="form-checkbox">
      <label for="recipient-${user.uid}" class="text-sm text-text-primary cursor-pointer">
        ${escapeHtml(user.displayName || 'Unknown')} (${escapeHtml(user.email || 'No email')})
      </label>
    </div>
  `).join('');
}

function handleEmailTemplateChange() {
  const templateSelect = document.getElementById('email-template');
  const subjectInput = document.getElementById('email-subject');
  const contentInput = document.getElementById('email-content');
  
  if (!templateSelect || !subjectInput || !contentInput) return;

  const template = templateSelect.value;
  const templates = {
    welcome: {
      subject: 'Welcome to Arcator!',
      content: 'Dear user,\n\nWelcome to Arcator! We\'re excited to have you join our community.\n\nBest regards,\nThe Arcator Team'
    },
    announcement: {
      subject: 'Important Announcement',
      content: 'Dear users,\n\nWe have an important announcement to share with you.\n\nBest regards,\nThe Arcator Team'
    },
    notification: {
      subject: 'System Notification',
      content: 'Dear user,\n\nThis is a system notification.\n\nBest regards,\nThe Arcator Team'
    }
  };

  if (templates[template]) {
    subjectInput.value = templates[template].subject;
    contentInput.value = templates[template].content;
  }
}

async function sendEmail(e) {
  if (e) e.preventDefault();
  const recipientType = document.getElementById('email-recipient-type').value;
  const subject = document.getElementById('email-subject').value.trim();
  const content = document.getElementById('email-content').value.trim();
  if (!subject || !content) return showMessageBox('Please fill in both subject and content.', true);
  let recipients = [];
  if (recipientType === 'users') {
    recipients = usersData.filter(u => u.email).map(u => u.email);
  } else if (recipientType === 'admins') {
    recipients = usersData.filter(u => u.email && u.isAdmin).map(u => u.email);
  } else if (recipientType === 'custom') {
    const checkboxes = document.querySelectorAll('#custom-recipients-section input[type="checkbox"]:checked');
    recipients = Array.from(checkboxes).map(cb => cb.value);
  }
  if (recipients.length === 0) return showMessageBox('No recipients selected.', true);
  try {
    showMessageBox('Sending email...', false);
    const result = await sendEmailViaEmailJS(recipients, subject, content);
    if (result.success) {
      showMessageBox(`Email sent to ${recipients.length} recipients!`, false);
      await logEmailToHistory(recipients, subject, content, 'sent', 'EmailJS');
      document.getElementById('email-compose-form').reset();
      await loadEmailHistory();
    } else {
      showMessageBox(`Failed to send email: ${result.error}`, true);
    }
  } catch (error) {
    showMessageBox(`Error sending email: ${error.message}`, true);
  }
}

async function sendEmailViaEmailJS(recipients, subject, content) {
  try {
    const emailjs = window.emailjs;
    if (!emailjs) throw new Error('EmailJS not loaded');
    const templateParams = {
      to_email: recipients.join(','),
      subject,
      message: content,
      from_name: 'Arcator Admin'
    };
    const result = await emailjs.send('service_7pm3neh', 'template_1gv17ca', templateParams);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function showEmailPreview() {
  const subject = document.getElementById('email-subject').value;
  const content = document.getElementById('email-content').value;
  const recipientType = document.getElementById('email-recipient-type').value;
  let recipientInfo = '';
  if (recipientType === 'users') recipientInfo = 'All users';
  else if (recipientType === 'admins') recipientInfo = 'Admins only';
  else if (recipientType === 'custom') {
    const checkboxes = document.querySelectorAll('#custom-recipients-section input[type="checkbox"]:checked');
    recipientInfo = `${checkboxes.length} selected recipients`;
  }
  const previewContent = `
    <div class="bg-card p-4 rounded-lg border border-input-border">
      <h4 class="text-lg font-semibold text-heading-card mb-2">Email Preview</h4>
      <div class="space-y-2 text-sm">
        <div><strong>To:</strong> ${recipientInfo}</div>
        <div><strong>Subject:</strong> ${escapeHtml(subject)}</div>
        <div><strong>Content:</strong></div>
        <div class="bg-input-bg p-3 rounded border border-input-border whitespace-pre-wrap">${escapeHtml(content)}</div>
      </div>
    </div>
  `;
  showMessageBox(previewContent, false, true);
}

function saveEmailDraft() {
  const subject = document.getElementById('email-subject').value;
  const content = document.getElementById('email-content').value;
  
  if (!subject && !content) {
    showMessageBox('No content to save as draft.', true);
    return;
  }
  
  // Save to localStorage for now
  const draft = { subject, content, timestamp: new Date().toISOString() };
  localStorage.setItem('emailDraft', JSON.stringify(draft));
  
  showMessageBox('Draft saved successfully!', false);
}

// Test EmailJS connection
async function testEmailJSConnectionHandler() {
  try {
    const result = await testEmailJSConnection();
    if (result.success) {
      showMessageBox(`✅ EmailJS connection successful! Credentials are valid.`, false);
      console.log('[EmailJS] Connection test successful:', result);
    } else {
      showMessageBox(`❌ EmailJS connection failed: ${result.error}`, true);
      console.error('[EmailJS] Connection test failed:', result);
    }
    return result;
  } catch (error) {
    showMessageBox(`❌ EmailJS test error: ${error.message}`, true);
    console.error('[EmailJS] Test error:', error);
    return { success: false, error: error.message };
  }
}

// Get and display EmailJS status
function displayEmailJSStatus() {
  const status = getEmailJSStatus();
  const statusDisplay = document.getElementById('emailjs-status-display');
  
  if (statusDisplay) {
    statusDisplay.innerHTML = `
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div>Script Loaded: ${status.scriptLoaded ? '✅ Yes' : '❌ No'}</div>
        <div>Initialized: ${status.initialized ? '✅ Yes' : '❌ No'}</div>
        <div>Public Key: ${status.publicKey}</div>
        <div>Service ID: ${status.serviceId}</div>
        <div>Template ID: ${status.templateId}</div>
        <div>Ready to Send: ${status.readyToSend ? '✅ Yes' : '❌ No'}</div>
      </div>
    `;
  }
}

// Configure EmailJS with user input
async function configureEmailJS() {
  try {
    // Use the new Gmail service and template
    const serviceId = 'service_7pm3neh';
    const templateId = 'template_1gv17ca';
    
    // Save credentials
    saveCredentials('o4CZtazWjPDVjPc1L', serviceId, templateId);
    
    // Initialize EmailJS
    const result = await initializeEmailJS();
    
    if (result.success) {
      showMessageBox('EmailJS configured successfully with Gmail service!', false);
      displayEmailJSStatus();
    } else {
      showMessageBox(`EmailJS configuration failed: ${result.error}`, true);
    }
  } catch (error) {
    showMessageBox(`Configuration error: ${error.message}`, true);
  }
}

// Test SMTP server connection
async function testSMTPServerConnectionHandler() {
  try {
    const result = await testSMTPServerConnection();
    if (result.success) {
      showMessageBox(`✅ SMTP server connection successful!`, false);
      console.log('[SMTP] Connection test successful:', result);
    } else {
      showMessageBox(`❌ SMTP server connection failed: ${result.message}`, true);
      console.error('[SMTP] Connection test failed:', result);
    }
    return result;
  } catch (error) {
    showMessageBox(`❌ SMTP test error: ${error.message}`, true);
    console.error('[SMTP] Test error:', error);
    return { success: false, error: error.message };
  }
}

// Get and display SMTP server status
function displaySMTPServerStatus() {
  const status = getSMTPServerStatus();
  const statusDisplay = document.getElementById('smtp-status-display');
  
  if (statusDisplay) {
    statusDisplay.innerHTML = `
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div>Server Connected: ${status.connected ? '✅ Yes' : '❌ No'}</div>
        <div>Ready to Send: ${status.ready ? '✅ Yes' : '❌ No'}</div>
      </div>
    `;
  }
}

async function loadDMHistory() {
  if (!db) return;
  const tbody = document.getElementById('dm-history-tbody');
  if (!tbody) return;
  try {
    const dmRef = collection(db, `artifacts/${appId}/public/data/direct_messages`);
    const querySnapshot = await getDocs(query(dmRef, orderBy('createdAt', 'desc')));
    const dmData = [];
    querySnapshot.forEach(doc => {
      dmData.push({ id: doc.id, ...doc.data() });
    });
    if (dmData.length === 0) {
      tbody.innerHTML = '<tr><td class="text-center py-4 text-text-secondary text-xs" colspan="6">No DMs found.</td></tr>';
      return;
    }
    tbody.innerHTML = dmData.map(dm => `
      <tr>
        <td class="px-2 py-1 text-text-primary text-xs">${dm.createdAt ? new Date(dm.createdAt.toDate()).toLocaleString() : ''}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(dm.from || '')}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(dm.to || '')}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(dm.subject || '')}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(dm.content || '').slice(0, 50)}</td>
        <td class="px-2 py-1 text-text-primary text-xs"><button class="btn-primary btn-blue text-xs">View</button></td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td class="text-center py-4 text-text-secondary text-xs" colspan="6">Failed to load DMs.</td></tr>';
  }
}

async function loadFormsData() {
  if (!db) return;
  const tbody = document.getElementById('form-submissions-tbody');
  if (!tbody) return;
  try {
    const formsRef = collection(db, `artifacts/${appId}/public/data/form_submissions`);
    const querySnapshot = await getDocs(query(formsRef, orderBy('createdAt', 'desc')));
    const formsData = [];
    querySnapshot.forEach(doc => {
      formsData.push({ id: doc.id, ...doc.data() });
    });
    if (formsData.length === 0) {
      tbody.innerHTML = '<tr><td class="text-center py-4 text-text-secondary text-xs" colspan="5">No forms found.</td></tr>';
      return;
    }
    tbody.innerHTML = formsData.map(form => `
      <tr>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(form.formType || '')}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(form.theme || '')}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${form.comment ? 1 : 0}</td>
        <td class="px-2 py-1 text-text-primary text-xs">1</td>
        <td class="px-2 py-1 text-text-primary text-xs"><button class="btn-primary btn-blue text-xs">View</button></td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td class="text-center py-4 text-text-secondary text-xs" colspan="5">Failed to load forms.</td></tr>';
  }
}

// Initialize the admin panel
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  
  // Listen for auth state changes
  onAuthStateChanged(auth, async (user) => {
    await updateAdminUI(user);
  });
});