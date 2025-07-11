// admin.js: Handles Admin page functionality.
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
  onAuthStateChanged,
} from "./firebase-init.js";
import {
  setupThemesFirebase,
  applyTheme,
  getAvailableThemes,
} from "./themes.js";
import { loadNavbar } from "./core.js";
import {
  initializeEmailJS,
  sendEmailWithEmailJS,
  testEmailJSConnection,
  getEmailJSStatus,
  saveCredentials,
  sendEmailViaSMTP,
  testSMTPServerConnection,
  getSMTPServerStatus,
  initializeSMTPIntegration,
} from "./email-integration.js";
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
  serverTimestamp, // Ensure serverTimestamp is imported for Firestore operations
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showMessageBox, showCustomConfirm, escapeHtml } from "./utils.js"; // Import message box and confirm utility

// DOM elements - Initialize immediately after declaration
const loadingSpinner = document.getElementById("loading-spinner");
const loginRequiredMessage = document.getElementById("login-required-message");
const adminContent = document.getElementById("admin-content");

// User Management DOM elements
const editUserModal = document.getElementById("edit-user-modal");
const editUserDisplayNameInput = document.getElementById(
  "edit-user-display-name",
);
const editUserHandleInput = document.getElementById("edit-user-handle");
const editUserEmailInput = document.getElementById("edit-user-email");
const editUserPhotoUrlInput = document.getElementById("edit-user-photo-url");
const editUserDiscordUrlInput = document.getElementById(
  "edit-user-discord-url",
);
const editUserGithubUrlInput = document.getElementById("edit-user-github-url");
const editUserThemeSelect = document.getElementById("edit-user-theme");
const editUserFontScalingSelect = document.getElementById(
  "edit-user-font-scaling",
);
const editUserNotificationFrequencySelect = document.getElementById(
  "edit-user-notification-frequency",
);
const editUserEmailNotificationsCheckbox = document.getElementById(
  "edit-user-email-notifications",
);
const editUserDiscordNotificationsCheckbox = document.getElementById(
  "edit-user-discord-notifications",
);
const editUserPushNotificationsCheckbox = document.getElementById(
  "edit-user-push-notifications",
);
const editUserDataRetentionSelect = document.getElementById(
  "edit-user-data-retention",
);
const editUserProfileVisibleCheckbox = document.getElementById(
  "edit-user-profile-visible",
);
const editUserActivityTrackingCheckbox = document.getElementById(
  "edit-user-activity-tracking",
);
const editUserThirdPartySharingCheckbox = document.getElementById(
  "edit-user-third-party-sharing",
);
const editUserHighContrastCheckbox = document.getElementById(
  "edit-user-high-contrast",
);
const editUserReducedMotionCheckbox = document.getElementById(
  "edit-user-reduced-motion",
);
const editUserScreenReaderCheckbox = document.getElementById(
  "edit-user-screen-reader",
);
const editUserFocusIndicatorsCheckbox = document.getElementById(
  "edit-user-focus-indicators",
);
const editUserKeyboardShortcutsSelect = document.getElementById(
  "edit-user-keyboard-shortcuts",
);
const editUserDebugModeCheckbox = document.getElementById(
  "edit-user-debug-mode",
);
const editUserCustomCssTextarea = document.getElementById(
  "edit-user-custom-css",
);
const saveUserChangesBtn = document.getElementById("save-user-changes-btn");
const cancelUserChangesBtn = document.getElementById("cancel-user-changes-btn");
let currentEditingUserUid = null;

// Temporary Pages DOM elements
const createTempPageForm = document.getElementById("create-temp-page-form");
const tempPageTitleInput = document.getElementById("temp-page-title");
const tempPageList = document.getElementById("temp-page-list");
const editTempPageModal = document.getElementById("edit-temp-page-modal");
const editTempPageTitleInput = document.getElementById("edit-temp-page-title");
const saveTempPageChangesBtn = document.getElementById(
  "save-temp-page-changes-btn",
);
let currentEditingTempPageId = null;

// DM History DOM elements
const dmHistoryTbody = document.getElementById("dm-history-tbody");

// Forms Management DOM elements
const formSubmissionsTbody = document.getElementById("form-submissions-tbody");

// Email Management DOM elements
const emailRecipientTypeSelect = document.getElementById(
  "email-recipient-type",
);
const emailTemplateSelect = document.getElementById("email-template-select");
const emailSubjectInput = document.getElementById("email-subject");
const emailContentTextarea = document.getElementById("email-content");
const emailComposeForm = document.getElementById("email-compose-form");
const previewEmailBtn = document.getElementById("preview-email-btn");
const saveDraftBtn = document.getElementById("save-draft-btn");
const emailHistoryTbody = document.getElementById("email-history-tbody");

// Email test buttons (these may not exist in the HTML, so we'll check for them)
const testEmailJSBtn = document.getElementById("test-emailjs-btn");
const configureEmailJSBtn = document.getElementById("configure-emailjs-btn");
const testSmtpBtn = document.getElementById("test-smtp-btn");

// EasyMDE instances (No longer using EasyMDE for temporary pages - it will be HTML editor)
// let easyMDECreate;
// let easyMDEEdit;

/**
 * Toggles the visibility of a collapsible section.
 * @param {HTMLElement} headerElement - The header element of the section.
 * @param {HTMLElement} contentElement - The content element of the section.
 */
function toggleSection(headerElement, contentElement) {
  const isHidden = contentElement.classList.contains("hidden");
  if (isHidden) {
    contentElement.classList.remove("hidden");
    // Rotate the arrow icon if it exists
    headerElement.querySelector("svg")?.classList.remove("rotate-90");
  } else {
    contentElement.classList.add("hidden");
    // Rotate the arrow icon if it exists
    headerElement.querySelector("svg")?.classList.add("rotate-90");
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
    const usersRef = collection(
      db,
      `artifacts/${appId}/public/data/user_profiles`,
    );
    const querySnapshot = await getDocs(usersRef);
    usersData = [];
    querySnapshot.forEach((doc) => {
      usersData.push({ uid: doc.id, ...doc.data() });
    });

    await renderUserList();
  } catch (error) {
    console.error("Error loading users:", error);
    showMessageBox("Error loading users: " + error.message, true);
  }
}

/**
 * Renders the list of users in the table.
 */
async function renderUserList() {
  const tbody = document.getElementById("user-list-tbody");

  if (!usersData || usersData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="text-center py-4 text-text-secondary text-xs" colspan="5">No users found.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = usersData
    .map((user) => {
      const displayName = user.displayName || "N/A";
      const email = user.email || "N/A";
      const theme = user.themePreference || "dark";
      const handle = user.handle || "N/A";

      return `
      <tr class="hover:bg-table-row-even-bg transition-colors">
        <td class="px-2 py-1 text-text-primary text-xs font-mono">${user.uid.substring(0, 8)}...</td>
        <td class="px-2 py-1 text-text-primary text-xs">${displayName}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${email}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${theme}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">
          <div class="flex space-x-1">
            <button 
              onclick="openEditUserModal('${user.uid}', ${JSON.stringify(user).replace(/"/g, "&quot;")})"
              class="text-link hover:text-link transition-colors admin-action-btn"
              title="Edit User"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <button 
              onclick="deleteUserProfile('${user.uid}', '${displayName}')"
              class="text-red-400 hover:text-red-300 transition-colors admin-action-btn"
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
    })
    .join("");
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
  document.getElementById("edit-user-display-name").value =
    userData.displayName || "";
  document.getElementById("edit-user-handle").value = userData.handle || "";
  document.getElementById("edit-user-email").value = userData.email || "";
  document.getElementById("edit-user-photo-url").value =
    userData.photoURL || "";
  document.getElementById("edit-user-discord-url").value =
    userData.discordURL || "";
  document.getElementById("edit-user-github-url").value =
    userData.githubURL || "";

  // Populate theme select
  populateEditUserThemeSelect(userData.themePreference);

  // Populate other fields
  document.getElementById("edit-user-font-scaling").value =
    userData.fontScaling || "normal";
  document.getElementById("edit-user-notification-frequency").value =
    userData.notificationFrequency || "immediate";
  document.getElementById("edit-user-email-notifications").checked =
    userData.emailNotifications || false;
  document.getElementById("edit-user-discord-notifications").checked =
    userData.discordNotifications || false;
  document.getElementById("edit-user-push-notifications").checked =
    userData.pushNotifications || false;
  document.getElementById("edit-user-data-retention").value =
    userData.dataRetention || "365";
  document.getElementById("edit-user-profile-visible").checked =
    userData.profileVisible !== false;
  document.getElementById("edit-user-activity-tracking").checked =
    userData.activityTracking !== false;
  document.getElementById("edit-user-third-party-sharing").checked =
    userData.thirdPartySharing || false;
  document.getElementById("edit-user-high-contrast").checked =
    userData.highContrast || false;
  document.getElementById("edit-user-reduced-motion").checked =
    userData.reducedMotion || false;
  document.getElementById("edit-user-screen-reader").checked =
    userData.screenReader || false;
  document.getElementById("edit-user-focus-indicators").checked =
    userData.focusIndicators || false;
  document.getElementById("edit-user-keyboard-shortcuts").value =
    userData.keyboardShortcuts || "enabled";
  document.getElementById("edit-user-debug-mode").checked =
    userData.debugMode || false;
  document.getElementById("edit-user-custom-css").value =
    userData.customCSS || "";

  // Show the modal
  const modal = document.getElementById("edit-user-modal");
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
}

/**
 * Populates the theme selection dropdown in the edit user modal.
 * @param {string} selectedThemeId - The currently selected theme ID for the user.
 */
async function populateEditUserThemeSelect(selectedThemeId) {
  editUserThemeSelect.innerHTML = ""; // Clear existing options
  const availableThemes = await getAvailableThemes(); // From themes.js
  availableThemes.forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;
    editUserThemeSelect.appendChild(option);
  });
  editUserThemeSelect.value = selectedThemeId; // Set the current theme
  console.log(
    `DEBUG: Edit User Theme Select populated with selected theme: ${selectedThemeId}`,
  );
}

if (saveUserChangesBtn) {
  saveUserChangesBtn.addEventListener("click", async () => {
    console.log("DEBUG: Save User Changes button clicked.");
    if (!currentEditingUserUid) {
      console.error(
        "ERROR: currentEditingUserUid is null. Cannot save changes.",
      );
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
        pushNotifications: editUserPushNotificationsCheckbox.checked,
      },

      // Privacy Settings
      privacySettings: {
        dataRetention: parseInt(editUserDataRetentionSelect.value),
        profileVisible: editUserProfileVisibleCheckbox.checked,
        activityTracking: editUserActivityTrackingCheckbox.checked,
        thirdPartySharing: editUserThirdPartySharingCheckbox.checked,
      },

      // Accessibility Settings
      accessibilitySettings: {
        highContrast: editUserHighContrastCheckbox.checked,
        reducedMotion: editUserReducedMotionCheckbox.checked,
        screenReader: editUserScreenReaderCheckbox.checked,
        focusIndicators: editUserFocusIndicatorsCheckbox.checked,
      },

      // Advanced Settings
      keyboardShortcuts: editUserKeyboardShortcutsSelect.value,
      debugMode: editUserDebugModeCheckbox.checked,
      customCSS: editUserCustomCssTextarea.value.trim(),
    };

    try {
      const userRef = doc(
        db,
        `artifacts/${appId}/public/data/user_profiles`,
        currentEditingUserUid,
      );
      await updateDoc(userRef, updatedProfile);

      showMessageBox("User profile updated successfully!");
      editUserModal.style.display = "none";
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
  cancelUserChangesBtn.addEventListener("click", () => {
    editUserModal.style.display = "none";
    currentEditingUserUid = null;
  });
}

// Modal close buttons
document.querySelectorAll(".close-button").forEach((button) => {
  button.addEventListener("click", () => {
    editUserModal.style.display = "none";
    editTempPageModal.style.display = "none";
    document.getElementById("edit-dm-modal").style.display = "none";
    document.getElementById("edit-form-modal").style.display = "none";
  });
});

// Close modals when clicking outside
window.addEventListener("click", (event) => {
  if (event.target === editUserModal) {
    editUserModal.style.display = "none";
  }
  if (event.target === editTempPageModal) {
    editTempPageModal.style.display = "none";
  }
});

// Temporary Pages Functions
async function createTempPage(title, content) {
  if (!db) {
    showMessageBox("Database not initialized. Cannot create page.", true);
    return;
  }
  const tempPagesCol = collection(
    db,
    `artifacts/${appId}/public/data/temp_pages`,
  );
  try {
    const docRef = await addDoc(tempPagesCol, {
      title: title,
      content: content,
      createdAt: serverTimestamp(), // Use serverTimestamp
      updatedAt: serverTimestamp(), // Use serverTimestamp
      authorUid: auth.currentUser ? auth.currentUser.uid : "anonymous",
    });
    showMessageBox("Temporary page created successfully!", false);
    tempPageTitleInput.value = "";
    document.getElementById("temp-page-content").value = ""; // Clear content input
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
  const tempPagesCol = collection(
    db,
    `artifacts/${appId}/public/data/temp_pages`,
  );
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
  tempPageList.innerHTML = "<li>Loading temporary pages...</li>";
  const pages = await fetchAllTempPages();
  tempPageList.innerHTML = "";
  if (pages.length === 0) {
    tempPageList.innerHTML =
      '<li class="text-text-secondary text-xs">No temporary pages found.</li>';
    return;
  }
  pages.forEach((page) => {
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
    li.style.backgroundColor = "var(--color-bg-card)";
    li.style.color = "var(--color-text-primary)";
    li.innerHTML = `
      <span class="font-semibold break-all md:w-3/5">${escapeHtml(page.title)}</span>
      <div class="mt-2 md:mt-0 md:w-2/5 md:text-right flex space-x-1 justify-end">
        <a href="pages.html?id=${page.id}" target="_blank" rel="noopener noreferrer" class="text-link hover:underline text-sm mr-2 view-temp-page">View</a>
        <button class="text-link hover:text-link transition-colors admin-action-btn edit-temp-page-btn" data-id="${page.id}" data-title="${encodeURIComponent(page.title)}" data-content="${encodeURIComponent(page.content)}" title="Edit Temp Page">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
        </button>
        <button class="text-red-400 hover:text-red-300 transition-colors admin-action-btn delete-temp-page-btn" data-id="${page.id}" title="Delete Temp Page">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `;
    tempPageList.appendChild(li);
  });
  document.querySelectorAll(".edit-temp-page-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const id = event.target.dataset.id;
      const title = decodeURIComponent(event.target.dataset.title);
      const content = decodeURIComponent(event.target.dataset.content);
      openEditTempPageModal(id, title, content);
    });
  });
  document.querySelectorAll(".delete-temp-page-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const id = event.target.dataset.id;
      await deleteTempPage(id);
    });
  });
  
  // Also update the table
  await renderTempPagesTable();
}

function openEditTempPageModal(id, title, content) {
  currentEditingTempPageId = id;
  editTempPageTitleInput.value = title;
  document.getElementById("edit-temp-page-content").value = content; // Set raw HTML content
  editTempPageModal.style.display = "flex";
  console.log("DEBUG: Temporary Page Edit Modal opened.");
}

if (saveTempPageChangesBtn) {
  saveTempPageChangesBtn.addEventListener("click", async () => {
    console.log("DEBUG: Save Temp Page Changes button clicked.");
    if (!currentEditingTempPageId) {
      console.error(
        "ERROR: currentEditingTempPageId is null. Cannot save changes.",
      );
      return;
    }
    const newTitle = editTempPageTitleInput.value.trim();
    const newContent = document.getElementById("edit-temp-page-content").value.trim(); // Get raw HTML content
    if (!newTitle || !newContent) {
      showMessageBox("Title and Content cannot be empty.", true);
      return;
    }
    console.log(
      `DEBUG: Saving Temp Page Changes for ID: ${currentEditingTempPageId}, New Title: ${newTitle}`,
    );
    const tempPageDocRef = doc(
      db,
      `artifacts/${appId}/public/data/temp_pages`,
      currentEditingTempPageId,
    );
    try {
      await updateDoc(tempPageDocRef, {
        title: newTitle,
        content: newContent,
        updatedAt: serverTimestamp(), // Use serverTimestamp
      });
      showMessageBox("Temporary page updated successfully!", false);
      editTempPageModal.style.display = "none";
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
  const confirmation = await showCustomConfirm(
    "Are you sure you want to delete this temporary page?",
    "This action cannot be undone.",
  );

  if (!confirmation) {
    showMessageBox("Deletion cancelled.", false);
    return;
  }

  const tempPageDocRef = doc(
    db,
    `artifacts/${appId}/public/data/temp_pages`,
    id,
  );
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
    if (loadingSpinner) loadingSpinner.style.display = "none";
    if (loginRequiredMessage) loginRequiredMessage.style.display = "block";
    if (adminContent) adminContent.style.display = "none";
    return;
  }

  try {
    if (loadingSpinner) loadingSpinner.style.display = "block";
    if (loginRequiredMessage) loginRequiredMessage.style.display = "none";
    if (adminContent) adminContent.style.display = "block";

    // Load all admin data
    await Promise.all([
      loadUsers(),
      loadDMHistory(),
      loadFormsData(),
      renderTempPagesTable(),
      populateEmailRecipients(),
      loadEmailHistory(),
      displayEmailJSStatus(),
      displaySMTPServerStatus(),
    ]);

    if (loadingSpinner) loadingSpinner.style.display = "none";
  } catch (error) {
    console.error("Error updating admin UI:", error);
    if (loadingSpinner) loadingSpinner.style.display = "none";
    showMessageBox("Error loading admin data: " + error.message, true);
  }
};

// Email functionality - Using only EmailJS template
async function populateEmailRecipients() {
  if (!db) {
    console.error("Firestore DB not initialized for populateEmailRecipients.");
    return;
  }

  try {
    const usersRef = collection(
      db,
      `artifacts/${appId}/public/data/user_profiles`,
    );
    const querySnapshot = await getDocs(usersRef);

    // Populate recipient type select
    if (emailRecipientTypeSelect) {
      emailRecipientTypeSelect.innerHTML = `
                <option value="all">All Users</option>
                <option value="admins">Admins Only</option>
                <option value="custom">Custom Selection</option>
            `;
    }

    // Populate email template select
    if (emailTemplateSelect) {
      emailTemplateSelect.innerHTML = `
                <option value="default">Default Template</option>
                <option value="announcement">Announcement</option>
                <option value="newsletter">Newsletter</option>
                <option value="custom">Custom</option>
            `;
    }

    // Store user data for custom recipient selection
    window.adminUserData = [];
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.email && userData.displayName) {
        window.adminUserData.push({
          uid: doc.id,
          email: userData.email,
          displayName: userData.displayName,
          handle: userData.handle || "",
        });
      }
    });
  } catch (error) {
    console.error("Error populating email recipients:", error);
    showMessageBox("Failed to load email recipients", true);
  }
}

// Remove template change handler since we're only using EmailJS template
async function handleEmailTemplateChange() {
  // No longer needed - using only EmailJS template
  console.log("[EmailJS] Using EmailJS template: template_1gv17ca");
}

// Create email preview modal
function createEmailPreviewModal() {
  const modal = document.createElement("div");
  modal.id = "email-preview-modal";
  modal.className = "modal";
  modal.style.display = "none";
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
  const closeBtn = modal.querySelector(".close-button");
  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });

  return modal;
}

function showEmailPreview() {
  const recipientType = emailRecipientTypeSelect
    ? emailRecipientTypeSelect.value
    : "all";
  const subject = emailSubjectInput ? emailSubjectInput.value.trim() : "";
  const content = emailContentTextarea ? emailContentTextarea.value.trim() : "";
  const sender = "noreply@arcator-web.firebaseapp.com";

  if (!subject || !content) {
    showMessageBox("Please fill in both subject and content to preview", true);
    return;
  }

  // Create modal if it doesn't exist
  let modal = document.getElementById("email-preview-modal");
  if (!modal) {
    modal = createEmailPreviewModal();
  }

  // Populate preview content
  document.getElementById("preview-sender").textContent = sender;
  document.getElementById("preview-recipients").textContent =
    `Recipient Type: ${recipientType}`;
  document.getElementById("preview-subject").textContent = subject;
  document.getElementById("preview-content").textContent = content;

  modal.style.display = "flex";
}

// Send email using EmailJS templates
async function sendEmail() {
  const recipientType = emailRecipientTypeSelect
    ? emailRecipientTypeSelect.value
    : "all";
  const subject = emailSubjectInput ? emailSubjectInput.value.trim() : "";
  const content = emailContentTextarea ? emailContentTextarea.value.trim() : "";
  const templateType = emailTemplateSelect
    ? emailTemplateSelect.value
    : "default";

  if (!subject || !content) {
    showMessageBox("Please fill in both subject and message.", true);
    return;
  }

  // Show loading state
  const sendButton = document.querySelector(
    '#email-compose-form button[type="submit"]',
  );
  const originalText = sendButton ? sendButton.textContent : "Send Email";
  if (sendButton) {
    sendButton.textContent = "Sending...";
    sendButton.disabled = true;
  }

  // Use EmailJS templates
  let result = null;
  let method = "EmailJS";

  try {
    // Check EmailJS status first (prioritize EmailJS since it's working)
    const emailjsStatus = getEmailJSStatus();
    console.log("[EmailJS] Status:", emailjsStatus);

    if (emailjsStatus.readyToSend) {
      // Send via EmailJS (preferred method)
      method = "EmailJS";
      console.log(
        `[EmailJS] Attempting to send email via ${templateType} template`,
      );

      // Import the new EmailJS functions
      const { sendEmailWithTemplate } = await import(
        "./emailjs-integration.js"
      );

      // Get recipients based on type
      let recipients = [];
      if (recipientType === "all" && window.adminUserData) {
        recipients = window.adminUserData.map((user) => user.email);
      } else if (recipientType === "admins" && window.adminUserData) {
        // For now, send to all users (you can add admin logic later)
        recipients = window.adminUserData.map((user) => user.email);
      } else if (recipientType === "custom" && window.adminUserData) {
        // For custom, you can implement a recipient selection UI
        recipients = window.adminUserData.map((user) => user.email);
      }

      if (recipients.length === 0) {
        throw new Error("No recipients found for the selected type");
      }

      for (const recipient of recipients) {
        const emailResult = await sendEmailWithTemplate(
          recipient, // toEmail
          subject, // subject
          content, // message
          templateType, // templateType
          {
            // options
            fromName: "Arcator.co.uk",
            replyTo: "noreply@arcator-web.firebaseapp.com",
          },
        );

        if (emailResult.success) {
          console.log(
            `[EmailJS] Email sent successfully to ${recipient} using ${templateType} template`,
          );
        } else {
          console.error(
            "[EmailJS] Failed to send email to:",
            recipient,
            emailResult.error,
          );
          throw new Error(
            `Failed to send email to ${recipient}: ${emailResult.error}`,
          );
        }
      }

      result = { success: true, method: "EmailJS", templateUsed: templateType };
    } else {
      // Fallback to SMTP if EmailJS is not available
      console.log("[EmailJS] Not ready, trying SMTP fallback");
      const smtpStatus = getSMTPServerStatus();
      console.log("[SMTP] Server status:", smtpStatus);

      if (smtpStatus.connected) {
        // Send via SMTP
        method = "SMTP";
        const emailData = {
          to: recipients.join(","),
          subject: subject,
          content: content,
          isHtml: false,
          from: "noreply@arcator.co.uk",
        };

        console.log("[SMTP] Attempting to send email:", emailData);
        result = await sendEmailViaSMTP(emailData);
        if (result.success) {
          console.log(
            "[SMTP] Email queued for sending via Firebase Cloud Functions:",
            result.messageId,
          );
        } else {
          throw new Error(`SMTP failed: ${result.error}`);
        }
      } else {
        throw new Error("Neither EmailJS nor SMTP server is available");
      }
    }

    // Only log to history if email was actually sent successfully
    if (result && result.success) {
      await logEmailToHistory(recipients, subject, content, "sent", method);

      // Show success message
      const templateInfo = result.templateUsed
        ? ` using ${result.templateUsed} template`
        : "";
      showMessageBox(
        `Email sent successfully via ${method}${templateInfo}!`,
        false,
      );

      // Clear form
      if (emailComposeForm) emailComposeForm.reset();
    }
  } catch (error) {
    console.error("Email sending failed:", error);
    showMessageBox(`Failed to send email: ${error.message}`, true);
  } finally {
    // Reset button state
    if (sendButton) {
      sendButton.textContent = originalText;
      sendButton.disabled = false;
    }
  }
}

// Log email to Firestore history
async function logEmailToHistory(recipients, subject, content, status, method) {
  try {
    const emailRecord = {
      recipients: recipients,
      subject: subject,
      content: content,
      status: status,
      method: method,
      sentAt: serverTimestamp(),
      sentBy: currentUser?.uid || "unknown",
      appId: appId,
    };

    await addDoc(
      collection(db, `artifacts/${appId}/public/data/email_history`),
      emailRecord,
    );
    console.log("[Email] Logged to history:", emailRecord);
  } catch (error) {
    console.error("[Email] Failed to log to history:", error);
  }
}

// Load email history from Firestore
async function loadEmailHistory() {
  try {
    const emailHistoryQuery = query(
      collection(db, `artifacts/${appId}/public/data/email_history`),
      orderBy("sentAt", "desc"),
    );
    const querySnapshot = await getDocs(emailHistoryQuery);
    const tbody = emailHistoryTbody;
    if (!tbody) {
      console.warn("Email history tbody element not found");
      return;
    }
    if (querySnapshot.empty) {
      tbody.innerHTML =
        '<tr><td class="text-center py-4 text-text-secondary" colspan="6">No emails sent yet.</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    querySnapshot.forEach((doc) => {
      const emailData = doc.data();
      const sentAt = emailData.sentAt?.toDate() || new Date();
      const recipients = Array.isArray(emailData.recipients)
        ? emailData.recipients.join(", ")
        : emailData.recipients || "Unknown";
      const row = document.createElement("tr");
      row.className = "hover:bg-table-row-even-bg";
      row.innerHTML = `
        <td class="px-2 py-1 text-text-secondary text-xs">${sentAt.toLocaleString()}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(emailData.subject || "No subject")}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${escapeHtml(recipients)}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            emailData.status === "sent"
              ? "bg-green-100 text-green-800"
              : emailData.status === "partial"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800"
          }">
            ${emailData.status || "unknown"}
          </span>
        </td>
        <td class="px-2 py-1 text-text-secondary text-xs">${emailData.method || "Unknown"}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">
          <button class="btn-primary btn-blue text-xs px-3 py-1 rounded admin-action-btn" onclick="viewEmailDetails('${doc.id}')">View</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("[Email] Failed to load email history:", error);
    if (emailHistoryTbody) {
      emailHistoryTbody.innerHTML =
        '<tr><td class="text-center py-4 text-red-400" colspan="6">Failed to load email history.</td></tr>';
    }
  }
}

// Global function for viewing email details
window.viewEmailDetails = async function (emailId) {
  try {
    const emailDoc = await getDoc(
      doc(db, `artifacts/${appId}/public/data/email_history`, emailId),
    );
    if (!emailDoc.exists()) {
      showMessageBox("Email not found", true);
      return;
    }

    const emailData = emailDoc.data();

    // Create or get modal
    let modal = document.getElementById("email-details-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "email-details-modal";
      modal.className = "modal";
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
      const closeBtn = modal.querySelector(".close-button");
      closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
      });

      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          modal.style.display = "none";
        }
      });
    }

    const content = document.getElementById("email-details-content");
    content.innerHTML = `
      <div class="bg-card p-4 rounded-lg border border-input-border">
        <div class="mb-3">
          <strong class="text-text-primary">Subject:</strong>
          <span class="text-text-secondary ml-2">${escapeHtml(emailData.subject)}</span>
        </div>
        <div class="mb-3">
          <strong class="text-text-primary">Recipients:</strong>
          <span class="text-text-secondary ml-2">${emailData.recipientEmails?.join(", ") || "N/A"}</span>
        </div>
        <div class="mb-3">
          <strong class="text-text-primary">Status:</strong>
          <span class="text-text-secondary ml-2">${emailData.status || "unknown"}</span>
        </div>
        <div class="mb-3">
          <strong class="text-text-primary">Sent:</strong>
          <span class="text-text-secondary ml-2">${emailData.sentAt?.toDate?.()?.toLocaleString() || "Unknown"}</span>
        </div>
        <div class="mb-3">
          <strong class="text-text-primary">Content:</strong>
          <div class="mt-2 p-3 bg-input-bg rounded border border-input-border text-input-text whitespace-pre-wrap">${emailData.isHtml ? emailData.content : escapeHtml(emailData.content)}</div>
        </div>
      </div>
    `;

    modal.style.display = "flex";
  } catch (error) {
    console.error("Error viewing email details:", error);
    showMessageBox("Failed to load email details", true);
  }
};

// Main execution logic on window load
document.addEventListener("DOMContentLoaded", async function () {
  // Setup Firebase and user authentication first
  await firebaseReadyPromise; // Wait for Firebase to be ready

  // Initialize themes Firebase integration
  setupThemesFirebase(db, auth, appId);

  // Call the imported loadNavbar function.
  await loadNavbar(auth.currentUser, firebaseCurrentUser, DEFAULT_THEME_NAME);

  // After Firebase is set up and page content loaded, update UI based on auth state
  onAuthStateChanged(auth, (user) => {
    updateAdminUI(user);
  });

  // Create Temp Page form event listener
  createTempPageForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = tempPageTitleInput.value.trim();
    const content = document.getElementById("temp-page-content").value.trim(); // Get raw HTML content
    if (!title || !content) {
      showMessageBox(
        "Please enter both title and content for the temporary page.",
        true,
      );
      return;
    }
    await createTempPage(title, content);
  });

  // Event listeners for email management
  if (emailTemplateSelect) {
    emailTemplateSelect.addEventListener("change", handleEmailTemplateChange);
  }

  if (previewEmailBtn) {
    previewEmailBtn.addEventListener("click", showEmailPreview);
  }

  if (emailComposeForm) {
    emailComposeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await sendEmail();
    });
  }

  // Load email recipients when email management section is opened
  document.addEventListener("DOMContentLoaded", () => {
    const emailManagementHeader = document.getElementById(
      "email-management-header",
    );
    if (emailManagementHeader) {
      emailManagementHeader.addEventListener("click", () => {
        const content = document.getElementById("email-management-content");
        if (content && !content.classList.contains("hidden")) {
          populateEmailRecipients();
          loadEmailHistory();
        }
      });
    }
  });

  // Setup modal event listeners
  const modal = document.getElementById("edit-user-modal");
  const closeButton = modal?.querySelector(".close-button");
  const saveButton = document.getElementById("save-user-changes-btn");
  const cancelButton = document.getElementById("cancel-user-changes-btn");
  const editForm = document.getElementById("edit-user-form");

  // Close modal when clicking the X button
  closeButton?.addEventListener("click", function () {
    modal.style.display = "none";
    currentEditingUser = null;
  });

  // Close modal when clicking outside the modal content
  modal?.addEventListener("click", function (event) {
    if (event.target === modal) {
      modal.style.display = "none";
      currentEditingUser = null;
    }
  });

  // Handle form submission
  editForm?.addEventListener("submit", async function (event) {
    event.preventDefault();
    await saveUserChanges();
  });

  // Cancel button
  cancelButton?.addEventListener("click", function () {
    modal.style.display = "none";
    currentEditingUser = null;
  });

  // EmailJS buttons
  if (testEmailJSBtn) {
    testEmailJSBtn.addEventListener("click", testEmailJSConnectionHandler);
  }
  if (configureEmailJSBtn) {
    configureEmailJSBtn.addEventListener("click", configureEmailJS);
  }

  // SMTP server buttons
  if (testSmtpBtn) {
    testSmtpBtn.addEventListener("click", testSMTPServerConnectionHandler);
  }
});

// Global function for delete user profile
window.deleteUserProfile = async function (uid, displayName) {
  console.log("DEBUG: Delete User button clicked for:", uid);

  // Show confirmation dialog with more details
  const confirmed = await showCustomConfirm(
    `Are you sure you want to delete the user profile for ${displayName}?`,
    "This action will permanently delete the user's profile data including all settings, preferences, and customizations. This will NOT delete the Firebase Authentication account. This action cannot be undone.",
  );

  if (confirmed) {
    const userDocRef = doc(
      db,
      `artifacts/${appId}/public/data/user_profiles`,
      uid,
    );
    try {
      await deleteDoc(userDocRef);
      showMessageBox(
        `User profile ${displayName} deleted successfully!`,
        false,
      );
      await loadUsers(); // Reload the user list
    } catch (error) {
      console.error("Error deleting user profile:", error);
      showMessageBox(
        `Error deleting user profile ${displayName}. ${error.message}`,
        true,
      );
    }
  } else {
    showMessageBox("Deletion cancelled.", false);
  }
};

// Global function for opening edit modal
window.openEditUserModal = function (uid, userData) {
  openEditUserModal(uid, userData);
};

// Setup collapsible sections
function setupCollapsibleSections() {
  const collapsibleHeaders = document.querySelectorAll(".collapsible-header");

  collapsibleHeaders.forEach((header) => {
    header.addEventListener("click", function () {
      const content = this.nextElementSibling;
      const arrow = this.querySelector("svg");

      if (content.classList.contains("hidden")) {
        content.classList.remove("hidden");
        arrow.classList.add("rotate-90");

        // Auto-load users when user management section is expanded
        if (this.id === "user-management-header" && usersData.length === 0) {
          loadUsers();
        }
      } else {
        content.classList.add("hidden");
        arrow.classList.remove("rotate-90");
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
      displayName: document.getElementById("edit-user-display-name").value,
      handle: document.getElementById("edit-user-handle").value,
      email: document.getElementById("edit-user-email").value,
      photoURL: document.getElementById("edit-user-photo-url").value,
      discordURL: document.getElementById("edit-user-discord-url").value,
      githubURL: document.getElementById("edit-user-github-url").value,
      themePreference: document.getElementById("edit-user-theme").value,
      fontScaling: document.getElementById("edit-user-font-scaling").value,
      notificationFrequency: document.getElementById(
        "edit-user-notification-frequency",
      ).value,
      emailNotifications: document.getElementById(
        "edit-user-email-notifications",
      ).checked,
      discordNotifications: document.getElementById(
        "edit-user-discord-notifications",
      ).checked,
      pushNotifications: document.getElementById("edit-user-push-notifications")
        .checked,
      dataRetention: document.getElementById("edit-user-data-retention").value,
      profileVisible: document.getElementById("edit-user-profile-visible")
        .checked,
      activityTracking: document.getElementById("edit-user-activity-tracking")
        .checked,
      thirdPartySharing: document.getElementById(
        "edit-user-third-party-sharing",
      ).checked,
      highContrast: document.getElementById("edit-user-high-contrast").checked,
      reducedMotion: document.getElementById("edit-user-reduced-motion")
        .checked,
      screenReader: document.getElementById("edit-user-screen-reader").checked,
      focusIndicators: document.getElementById("edit-user-focus-indicators")
        .checked,
      keyboardShortcuts: document.getElementById("edit-user-keyboard-shortcuts")
        .value,
      debugMode: document.getElementById("edit-user-debug-mode").checked,
      customCSS: document.getElementById("edit-user-custom-css").value,
      lastUpdated: new Date().toISOString(),
    };

    const userDocRef = doc(
      db,
      `artifacts/${appId}/public/data/user_profiles`,
      currentEditingUser.uid,
    );
    await updateDoc(userDocRef, updatedData);

    showMessageBox("User profile updated successfully!", false);
    modal.style.display = "none";
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
  // Initialize EmailJS and SMTP
  initializeEmailJS().then((result) => {
    if (result.success) {
      console.log("[EmailJS] Initialized successfully");
    } else {
      console.warn("[EmailJS] Initialization failed:", result.error);
    }
  });

  initializeSMTPIntegration().then((result) => {
    if (result.success) {
      console.log("[SMTP] Initialized successfully");
    } else {
      console.warn("[SMTP] Initialization failed:", result.error);
    }
  });

  // Email management event listeners
  if (testEmailJSBtn) {
    testEmailJSBtn.addEventListener("click", testEmailJSConnectionHandler);
  }
  if (configureEmailJSBtn) {
    configureEmailJSBtn.addEventListener("click", configureEmailJS);
  }
  if (testSmtpBtn) {
    testSmtpBtn.addEventListener("click", testSMTPServerConnectionHandler);
  }
  if (emailComposeForm) {
    emailComposeForm.addEventListener("submit", sendEmail);
  }
  if (previewEmailBtn) {
    previewEmailBtn.addEventListener("click", showEmailPreview);
  }
  if (emailTemplateSelect) {
    emailTemplateSelect.addEventListener("change", handleEmailTemplateChange);
  }

  // Temporary pages event listeners
  if (createTempPageForm) {
    createTempPageForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = tempPageTitleInput.value.trim();
      const content = document.getElementById("temp-page-content").value.trim();
      if (title && content) {
        await createTempPage(title, content);
        tempPageTitleInput.value = "";
        document.getElementById("temp-page-content").value = "";
      }
    });
  }

  // User management event listeners
  if (saveUserChangesBtn) {
    saveUserChangesBtn.addEventListener("click", saveUserChanges);
  }
  if (cancelUserChangesBtn) {
    cancelUserChangesBtn.addEventListener("click", () => {
      editUserModal.style.display = "none";
      currentEditingUserUid = null;
    });
  }

  // Modal close buttons
  document.querySelectorAll(".close-button").forEach((button) => {
    button.addEventListener("click", () => {
      editUserModal.style.display = "none";
      editTempPageModal.style.display = "none";
      document.getElementById("edit-dm-modal").style.display = "none";
      document.getElementById("edit-form-modal").style.display = "none";
    });
  });

  // Edit DM form submission
  const editDMForm = document.getElementById("edit-dm-form");
  if (editDMForm) {
    editDMForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const modal = document.getElementById("edit-dm-modal");
      const dmId = modal.dataset.dmId;

      if (!dmId) {
        showMessageBox("No DM ID found", true);
        return;
      }

      try {
        const from = document.getElementById("edit-dm-from").value;
        const to = document.getElementById("edit-dm-to").value;
        const subject = document.getElementById("edit-dm-subject").value;
        const content = document.getElementById("edit-dm-content").value;

        await updateDoc(
          doc(db, `artifacts/${appId}/public/data/direct_messages`, dmId),
          {
            from: from,
            to: to,
            subject: subject,
            content: content,
            updatedAt: serverTimestamp(),
          },
        );

        showMessageBox("DM updated successfully", false);
        modal.style.display = "none";
        loadDMHistory(); // Reload the list
      } catch (error) {
        console.error("Error updating DM:", error);
        showMessageBox("Failed to update DM: " + error.message, true);
      }
    });
  }

  // Edit form form submission
  const editFormForm = document.getElementById("edit-form-form");
  if (editFormForm) {
    editFormForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const modal = document.getElementById("edit-form-modal");
      const formId = modal.dataset.formId;

      if (!formId) {
        showMessageBox("No form ID found", true);
        return;
      }

      try {
        const themaName = document.getElementById("edit-form-thema-name").value;
        const themaDescription = document.getElementById(
          "edit-form-thema-description",
        ).value;

        await updateDoc(
          doc(db, `artifacts/${appId}/public/data/thematas`, formId),
          {
            name: themaName,
            description: themaDescription,
            updatedAt: serverTimestamp(),
          },
        );

        showMessageBox("Form updated successfully", false);
        modal.style.display = "none";
        loadFormsData(); // Reload the list
      } catch (error) {
        console.error("Error updating form:", error);
        showMessageBox("Failed to update form: " + error.message, true);
      }
    });
  }

  // Cancel buttons for edit modals
  const cancelEditDMBtn = document.getElementById("cancel-edit-dm-btn");
  if (cancelEditDMBtn) {
    cancelEditDMBtn.addEventListener("click", () => {
      document.getElementById("edit-dm-modal").style.display = "none";
    });
  }

  const cancelEditFormBtn = document.getElementById("cancel-edit-form-btn");
  if (cancelEditFormBtn) {
    cancelEditFormBtn.addEventListener("click", () => {
      document.getElementById("edit-form-modal").style.display = "none";
    });
  }
}

// Test EmailJS connection
async function testEmailJSConnectionHandler() {
  try {
    const result = await testEmailJSConnection();
    if (result.success) {
      showMessageBox(
        `✅ EmailJS connection successful! Credentials are valid.`,
        false,
      );
      console.log("[EmailJS] Connection test successful:", result);
    } else {
      showMessageBox(`❌ EmailJS connection failed: ${result.error}`, true);
      console.error("[EmailJS] Connection test failed:", result);
    }
    return result;
  } catch (error) {
    showMessageBox(`❌ EmailJS test error: ${error.message}`, true);
    console.error("[EmailJS] Test error:", error);
    return { success: false, error: error.message };
  }
}

// Get and display EmailJS status
function displayEmailJSStatus() {
  const status = getEmailJSStatus();
  const statusDisplay = document.getElementById("emailjs-status-display");

  if (statusDisplay) {
    statusDisplay.innerHTML = `
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div>Script Loaded: ${status.scriptLoaded ? "✅ Yes" : "❌ No"}</div>
        <div>Initialized: ${status.initialized ? "✅ Yes" : "❌ No"}</div>
        <div>Public Key: ${status.publicKey}</div>
        <div>Service ID: ${status.serviceId}</div>
        <div>Template ID: ${status.templateId}</div>
        <div>Ready to Send: ${status.readyToSend ? "✅ Yes" : "❌ No"}</div>
      </div>
    `;
  }
}

// Configure EmailJS with user input
async function configureEmailJS() {
  try {
    // Use the new Gmail service and template
    const serviceId = "service_7pm3neh";
    const templateId = "template_1gv17ca";

    // Save credentials
    saveCredentials("o4CZtazWjPDVjPc1L", serviceId, templateId);

    // Initialize EmailJS
    const result = await initializeEmailJS();

    if (result.success) {
      showMessageBox(
        "EmailJS configured successfully with Gmail service!",
        false,
      );
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
      console.log("[SMTP] Connection test successful:", result);
    } else {
      showMessageBox(
        `❌ SMTP server connection failed: ${result.message}`,
        true,
      );
      console.error("[SMTP] Connection test failed:", result);
    }
    return result;
  } catch (error) {
    showMessageBox(`❌ SMTP test error: ${error.message}`, true);
    console.error("[SMTP] Test error:", error);
    return { success: false, error: error.message };
  }
}

// Get and display SMTP server status
function displaySMTPServerStatus() {
  const status = getSMTPServerStatus();
  const statusDisplay = document.getElementById("smtp-status-display");

  if (statusDisplay) {
    statusDisplay.innerHTML = `
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div>Server Connected: ${status.connected ? "✅ Yes" : "❌ No"}</div>
        <div>Ready to Send: ${status.ready ? "✅ Yes" : "❌ No"}</div>
      </div>
    `;
  }
}

async function loadDMHistory() {
  if (!db) {
    console.error("Firestore DB not initialized for loadDMHistory.");
    return;
  }

  try {
    const dmRef = collection(
      db,
      `artifacts/${appId}/public/data/direct_messages`,
    );
    const querySnapshot = await getDocs(
      query(dmRef, orderBy("createdAt", "desc")),
    );
    const dmData = [];
    querySnapshot.forEach((doc) => {
      dmData.push({ id: doc.id, ...doc.data() });
    });

    await renderDMHistory(dmData);
  } catch (error) {
    console.error("Error loading DM history:", error);
  }
}

async function renderDMHistory(dmData) {
  if (!dmHistoryTbody) {
    console.warn("DM history tbody element not found");
    return;
  }

  if (!dmData || dmData.length === 0) {
    dmHistoryTbody.innerHTML = `
      <tr>
        <td class="text-center py-4 text-text-secondary text-xs" colspan="6">No DMs found.</td>
      </tr>
    `;
    return;
  }

  dmHistoryTbody.innerHTML = dmData
    .map((dm) => {
      const from = dm.from || "Unknown";
      const to = dm.to || "Unknown";
      const subject = dm.subject || "No subject";
      const content = dm.content || "No content";
      const date = dm.createdAt
        ? new Date(dm.createdAt.toDate()).toLocaleString()
        : "Unknown";
      return `
      <tr class="hover:bg-table-row-even-bg transition-colors">
        <td class="px-2 py-1 text-text-secondary text-xs">${date}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(from)}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(to)}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${escapeHtml(subject)}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${escapeHtml(content.substring(0, 50))}${content.length > 50 ? "..." : ""}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">
          <div class="flex space-x-1">
            <button onclick="openEditDMModal('${dm.id}', '${escapeHtml(from)}', '${escapeHtml(to)}', '${escapeHtml(subject)}', '${escapeHtml(content)}')"
                    class="text-link hover:text-link transition-colors admin-action-btn" title="Edit DM">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <button onclick="deleteDM('${dm.id}')"
                    class="text-red-400 hover:text-red-300 transition-colors admin-action-btn" title="Delete DM">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

async function loadFormsData() {
  if (!db) {
    console.error("Firestore DB not initialized for loadFormsData.");
    return;
  }

  try {
    const thematasRef = collection(
      db,
      `artifacts/${appId}/public/data/thematas`,
    );
    const querySnapshot = await getDocs(thematasRef);
    const formsData = [];

    for (const themaDoc of querySnapshot.docs) {
      if (themaDoc.id === "temp-page-SQ1f81es7k4PMdS4f1pr") continue; // Hide this temp page
      const themaData = { id: themaDoc.id, ...themaDoc.data() };

      // Get thread count for this thema
      const threadsRef = collection(
        db,
        `artifacts/${appId}/public/data/thematas/${themaDoc.id}/threads`,
      );
      const threadsSnapshot = await getDocs(threadsRef);
      let totalComments = 0;

      // Count comments across all threads
      for (const threadDoc of threadsSnapshot.docs) {
        const commentsRef = collection(
          db,
          `artifacts/${appId}/public/data/thematas/${themaDoc.id}/threads/${threadDoc.id}/comments`,
        );
        const commentsSnapshot = await getDocs(commentsRef);
        totalComments += commentsSnapshot.size;
      }

      formsData.push({
        id: themaDoc.id,
        name: themaData.name || "No name",
        description: themaData.description || "No description",
        theme: themaData.theme || "default",
        threads: threadsSnapshot.size,
        comments: totalComments,
        createdAt: themaData.createdAt,
        createdBy: themaData.createdBy,
      });
    }

    await renderFormsData(formsData);
  } catch (error) {
    console.error("Error loading forms data:", error);
  }
}

async function renderFormsData(formsData) {
  if (!formSubmissionsTbody) {
    console.warn("Forms tbody element not found");
    return;
  }

  if (!formsData || formsData.length === 0) {
    formSubmissionsTbody.innerHTML = `
      <tr>
        <td class="text-center py-4 text-text-secondary text-xs" colspan="5">No forms found.</td>
      </tr>
    `;
    return;
  }

  formSubmissionsTbody.innerHTML = formsData
    .map((form) => {
      const themaName = form.name || "No name";
      const themaDescription = form.description || "No description";
      const threads = form.threads || 0;
      const comments = form.comments || 0;
      const date = form.createdAt?.toDate
        ? form.createdAt.toDate().toLocaleString()
        : "Unknown";

      return `
      <tr class="hover:bg-table-row-even-bg transition-colors">
        <td class="px-2 py-1 text-text-primary text-xs font-medium">${escapeHtml(themaName)}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${escapeHtml(themaDescription)}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${threads}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${comments}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">
          <div class="flex space-x-1">
            <button onclick="openEditFormModal('${form.id}', '${escapeHtml(themaName)}', '${escapeHtml(themaDescription)}', ${threads}, ${comments})" 
                    class="text-link hover:text-link transition-colors admin-action-btn" title="Edit Form">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <button onclick="deleteForm('${form.id}')" 
                    class="text-red-400 hover:text-red-300 transition-colors admin-action-btn" title="Delete Form">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

// Global functions for DM and form editing
window.openEditDMModal = function (dmId, from, to, subject, content) {
  const modal = document.getElementById("edit-dm-modal");
  if (!modal) {
    console.error("Edit DM modal not found");
    return;
  }

  // Populate form fields
  document.getElementById("edit-dm-from").value = from;
  document.getElementById("edit-dm-to").value = to;
  document.getElementById("edit-dm-subject").value = subject;
  document.getElementById("edit-dm-content").value = content;

  // Store DM ID for saving
  modal.dataset.dmId = dmId;
  modal.style.display = "flex";
};

window.deleteDM = function (dmId) {
  showCustomConfirm(
    "Are you sure you want to delete this DM?",
    "This action cannot be undone.",
  ).then(async (confirmed) => {
    if (confirmed) {
      try {
        await deleteDoc(
          doc(db, `artifacts/${appId}/public/data/direct_messages`, dmId),
        );
        showMessageBox("DM deleted successfully", false);
        loadDMHistory(); // Reload the list
      } catch (error) {
        console.error("Error deleting DM:", error);
        showMessageBox("Failed to delete DM: " + error.message, true);
      }
    }
  });
};

window.openEditFormModal = function (
  formId,
  themaName,
  themaDescription,
  threads,
  comments,
) {
  const modal = document.getElementById("edit-form-modal");
  if (!modal) {
    console.error("Edit form modal not found");
    return;
  }

  // Populate form fields
  document.getElementById("edit-form-thema-name").value = themaName;
  document.getElementById("edit-form-thema-description").value =
    themaDescription;

  // Store form ID for saving
  modal.dataset.formId = formId;
  modal.style.display = "flex";
};

window.deleteForm = function (formId) {
  showCustomConfirm(
    "Are you sure you want to delete this form?",
    "This will delete the thema and all associated threads and comments.",
  ).then(async (confirmed) => {
    if (confirmed) {
      try {
        await deleteDoc(
          doc(db, `artifacts/${appId}/public/data/thematas`, formId),
        );
        showMessageBox("Form deleted successfully", false);
        loadFormsData(); // Reload the list
      } catch (error) {
        console.error("Error deleting form:", error);
        showMessageBox("Failed to delete form: " + error.message, true);
      }
    }
  });
};

async function renderTempPagesTable() {
  const tbody = document.getElementById("temp-pages-tbody");
  if (!tbody) return;

  const pages = await fetchAllTempPages();
  
  if (pages.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="text-center py-4 text-text-secondary text-xs" colspan="2">No temporary pages found.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pages
    .map((page) => {
      return `
      <tr class="hover:bg-table-row-even-bg transition-colors">
        <td class="px-2 py-1 text-text-primary text-xs font-medium">${escapeHtml(page.title)}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">
          <div class="flex space-x-1">
            <a href="pages.html?id=${page.id}" target="_blank" rel="noopener noreferrer" 
               class="text-link hover:text-link transition-colors admin-action-btn" title="View Page">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
            </a>
            <button onclick="openEditTempPageModal('${page.id}', '${escapeHtml(page.title)}', '${escapeHtml(page.content)}')"
                    class="text-link hover:text-link transition-colors admin-action-btn" title="Edit Page">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <button onclick="deleteTempPage('${page.id}')"
                    class="text-red-400 hover:text-red-300 transition-colors admin-action-btn" title="Delete Page">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

// Export the initialization function for external use
export async function initializeAdminPanel() {
  try {
    // Wait for Firebase to be ready
    await firebaseReadyPromise;

    // Setup themes
    setupThemesFirebase(db, auth, appId);

    // Apply cached theme
    const { applyCachedTheme } = await import("./themes.js");
    await applyCachedTheme();

    // Setup event listeners
    setupEventListeners();

    // Setup collapsible sections
    setupCollapsibleSections();

    // Listen for auth state changes
    auth.onAuthStateChanged(async (user) => {
      await updateAdminUI(user);
    });

    console.log("Admin panel initialized successfully");
  } catch (error) {
    console.error("Error initializing admin panel:", error);
    showMessageBox("Failed to initialize admin panel: " + error.message, true);
  }
}
