// admin_and_dev.js: Handles Admin & Dev page functionality.
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
const logoutBtn = document.getElementById('logout-btn');
const adminUserDisplay = document.getElementById('admin-user-display');


// User Management DOM elements
const loadUsersBtn = document.getElementById('load-users-btn');
const userListTbody = document.getElementById('user-list-tbody');
const editUserModal = document.getElementById('edit-user-modal');
const editUserDisplayNameInput = document.getElementById('edit-user-display-name');
const editUserThemeSelect = document.getElementById('edit-user-theme');
const saveUserChangesBtn = document.getElementById('save-user-changes-btn');
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

/**
 * Renders the list of users in the table.
 */
async function renderUserList() {
  if (!db) {
    console.error("Firestore DB not initialized for renderUserList.");
    userListTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-400">Database not ready.</td></tr>';
    return;
  }
  userListTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">Loading users...</td></tr>';
  // Assuming fetchAllUserProfiles is implemented elsewhere or is a direct Firestore call
  const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
  const querySnapshot = await getDocs(usersRef);
  const users = [];
  querySnapshot.forEach(doc => {
    users.push({ id: doc.id, ...doc.data() });
  });

  userListTbody.innerHTML = '';
  if (users.length === 0) {
    userListTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">No user profiles found.</td></tr>';
    return;
  }

  users.forEach(user => {
    const row = userListTbody.insertRow();
    // Apply theme-aware classes to the table rows/cells for consistency
    row.classList.add('text-text-primary'); // Apply primary text color
    row.innerHTML = `
      <td class="px-4 py-2 break-all border-b border-table-td-border">${user.id}</td>
      <td class="px-4 py-2 border-b border-table-td-border">${user.displayName || 'N/A'}</td>
      <td class="px-4 py-2 border-b border-table-td-border">${user.themePreference || DEFAULT_THEME_NAME}</td>
      <td class="px-4 py-2 border-b border-table-td-border">
        <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm mr-2 edit-user-btn" data-uid="${user.id}" data-displayname="${user.displayName || ''}" data-theme="${user.themePreference || DEFAULT_THEME_NAME}">Edit</button>
        <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm delete-user-btn" data-uid="${user.id}">Delete Profile</button>
      </td>
    `;
  });

  document.querySelectorAll('.edit-user-btn').forEach(button => {
    button.addEventListener('click', (event) => {
      console.log("DEBUG: Edit User button clicked.");
      const uid = event.target.dataset.uid;
      const displayName = event.target.dataset.displayname;
      const theme = event.target.dataset.theme;
      console.log(`DEBUG: Edit User - UID: ${uid}, Display Name: ${displayName}, Theme: ${theme}`);
      openEditUserModal(uid, displayName, theme);
    });
  });

  document.querySelectorAll('.delete-user-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      console.log("DEBUG: Delete User button clicked.");
      const uid = event.target.dataset.uid;
      const confirmed = await showCustomConfirm(`Are you sure you want to delete user profile for UID: ${uid}?`, "This will NOT delete the Firebase Authentication account.");
      if (confirmed) {
        const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
        try {
          await deleteDoc(userDocRef); // Directly use deleteDoc
          showMessageBox(`User profile ${uid} deleted successfully!`, false);
          renderUserList();
        } catch (error) {
          console.error("Error deleting user profile:", error);
          showMessageBox(`Error deleting user profile ${uid}. ${error.message}`, true);
        }
      } else {
        showMessageBox("Deletion cancelled.", false);
      }
    });
  });
}

/**
 * Opens the modal for editing a user's profile.
 * @param {string} uid - The UID of the user to edit.
 * @param {string} displayName - The current display name.
 * @param {string} theme - The current theme preference.
 */
function openEditUserModal(uid, displayName, theme) {
  currentEditingUserUid = uid;
  editUserDisplayNameInput.value = displayName;
  // Populate the theme dropdown in the modal with all available themes
  populateEditUserThemeSelect(theme);
  editUserModal.style.display = 'flex';
  console.log("DEBUG: User Edit Modal opened.");
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
    const newDisplayName = editUserDisplayNameInput.value.trim();
    const newTheme = editUserThemeSelect.value;
    console.log(`DEBUG: Saving User Changes for UID: ${currentEditingUserUid}, Display Name: ${newDisplayName}, Theme: ${newTheme}`);
    // Use the imported updateUserProfileInFirestore
    const success = await updateUserProfileInFirestore(currentEditingUserUid, {
      displayName: newDisplayName,
      themePreference: newTheme
    });
    if (success) {
      showMessageBox("User profile updated successfully!", false);
      editUserModal.style.display = 'none';
      renderUserList();
      // If the admin is editing their own profile, apply the theme immediately
      if (auth.currentUser && auth.currentUser.uid === currentEditingUserUid) {
        const allThemes = await getAvailableThemes();
        const selectedTheme = allThemes.find(t => t.id === newTheme);
        applyTheme(selectedTheme.id, selectedTheme);
        console.log("DEBUG: Admin's own theme updated and applied.");
      }
    } else {
      showMessageBox("Error updating user profile.", true);
    }
  });
}

// Attach listeners to all close buttons for modals
document.querySelectorAll('.close-button').forEach(button => {
  button.addEventListener('click', () => {
    console.log("DEBUG: Close button clicked on a modal.");
    editUserModal.style.display = 'none';
    editTempPageModal.style.display = 'none';
    editTodoModal.style.display = 'none';
    // showCustomConfirm is handled internally by utils.js, so no direct `display = 'none'` needed here for it
  });
});

window.addEventListener('click', (event) => {
  // Only close if click is outside modal content
  if (event.target === editUserModal) {
    editUserModal.style.display = 'none';
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
  loadingSpinner.style.display = 'none'; // Hide spinner once auth state is determined

  if (user) {
    console.log("DEBUG: Authenticated User UID:", user.uid);
    console.log("DEBUG: Authenticated User Email:", user.email);

    let profileLoaded = false;
    // Wait for firebaseCurrentUser to be populated and isAdmin to be set.
    // Give it a short delay to allow firebase-init.js's onAuthStateChanged to run.
    for (let i = 0; i < 10; i++) { // Try up to 10 times with 100ms delay each
      // Ensure firebaseCurrentUser is not null, its UID matches the authenticated user,
      // and isAdmin property is defined (meaning the profile from Firestore has been merged).
      if (firebaseCurrentUser && firebaseCurrentUser.uid === user.uid && typeof firebaseCurrentUser.isAdmin !== 'undefined') {
        profileLoaded = true;
        break;
      }
      console.log("DEBUG: Waiting for firebaseCurrentUser to be fully populated...");
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
    }

    if (!profileLoaded) {
      console.error("ERROR: firebaseCurrentUser did not get fully populated within expected time. Displaying access denied.");
      loginRequiredMessage.style.display = 'block';
      adminContent.style.display = 'none';
      showMessageBox("Could not retrieve admin status. Access denied.", true);
      return;
    }

    console.log("DEBUG: firebaseCurrentUser object (after wait):", firebaseCurrentUser);
    console.log("DEBUG: firebaseCurrentUser.isAdmin (after wait):", firebaseCurrentUser.isAdmin);


    const userProfile = firebaseCurrentUser; // Now firebaseCurrentUser should be the fully loaded profile
    const themePreference = userProfile?.themePreference || DEFAULT_THEME_NAME;
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === themePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    applyTheme(themeToApply.id, themeToApply);

    // Show main admin content div
    adminContent.style.display = 'block';

    if (userProfile.isAdmin) { // Use isAdmin from the now confirmed userProfile
      console.log("DEBUG: User is confirmed as ADMIN via userProfile.isAdmin.");
      loginRequiredMessage.style.display = 'none';
      adminUserDisplay.textContent = userProfile?.displayName || user.displayName || user.email || user.uid;

      // Show admin-specific sections
      if (infrastructureSection) infrastructureSection.style.display = 'block';
      if (devToolsSection) devToolsSection.style.display = 'block';
      if (userManagementSection) userManagementSection.style.display = 'block';
      if (formManagementSection) formManagementSection.style.display = 'block';
      if (tempPagesSection) tempPagesSection.style.display = 'block';
      if (importantLinksSection) importantLinksSection.style.display = 'block';
      if (roadmapSection) roadmapSection.style.display = 'block';

      // Render data for admin-specific sections
      renderUserList();
      renderTempPages();
      renderTodoList();

    } else {
      console.log("DEBUG: User is NOT an admin.");
      loginRequiredMessage.style.display = 'block';
      adminContent.style.display = 'none'; // Hide all admin content if not admin
      showMessageBox("You are logged in, but do not have admin privileges for some sections.", true);

      // Hide admin-specific sections explicitly for non-admins
      if (infrastructureSection) infrastructureSection.style.display = 'none';
      if (devToolsSection) devToolsSection.style.display = 'none';
      if (userManagementSection) userManagementSection.style.display = 'none';
      if (formManagementSection) formManagementSection.style.display = 'none';
      if (tempPagesSection) tempPagesSection.style.display = 'none';
      if (importantLinksSection) importantLinksSection.style.display = 'none';
      if (roadmapSection) roadmapSection.style.display = 'none';
    }

    // Darrion API, Grief Detection, and Onfim Notifications are visible to ALL logged-in users
    if (darrionApiSection) darrionApiSection.style.display = 'block';
    if (griefDetectionSection) griefDetectionSection.style.display = 'block';
    if (onfimNotificationsSection) onfimNotificationsSection.style.display = 'block';

  } else {
    console.log("DEBUG: No user is currently authenticated.");
    loginRequiredMessage.style.display = 'block';
    adminContent.style.display = 'none';
    const allThemes = await getAvailableThemes();
    const defaultThemeObj = allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    applyTheme(defaultThemeObj.id, defaultThemeObj);

    // Hide all sections if not logged in
    if (infrastructureSection) infrastructureSection.style.display = 'none';
    if (devToolsSection) devToolsSection.style.display = 'none';
    if (userManagementSection) userManagementSection.style.display = 'none';
    if (formManagementSection) formManagementSection.style.display = 'none';
    if (tempPagesSection) tempPagesSection.style.display = 'none';
    if (importantLinksSection) importantLinksSection.style.display = 'none';
    if (roadmapSection) roadmapSection.style.display = 'none';
    if (darrionApiSection) darrionApiSection.style.display = 'none';
    if (griefDetectionSection) griefDetectionSection.style.display = 'none';
    if (onfimNotificationsSection) onfimNotificationsSection.style.display = 'none';
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


  // Event Listener for Logout Button
  logoutBtn?.addEventListener('click', async () => {
    showMessageBox("", false);
    try {
      await auth.signOut();
      console.log("DEBUG: User signed out from admin & dev page.");
      window.location.href = 'index.html';
    } catch (error) {
      console.error("ERROR: Logout failed:", error);
      showMessageBox("Logout failed. Please try again. Error: " + (error.message || "Unknown error"), true);
    }
  });

  loadUsersBtn?.addEventListener('click', renderUserList);


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
});
