import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithCustomToken,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  addDoc,
  updateDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app",
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM"
};

const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : null;
const appId = canvasAppId || firebaseConfig.projectId || 'default-app-id';

let app;
let auth;
let db;
let firebaseReadyPromise; // Promise to ensure Firebase is fully initialized and authenticated
let isFirebaseInitialized = false;

// DOM elements - Initialize immediately after declaration
const loadingSpinner = document.getElementById('loading-spinner');
const loginRequiredMessage = document.getElementById('login-required-message');
const adminContent = document.getElementById('admin-content');
const logoutBtn = document.getElementById('logout-btn');
const adminUserDisplay = document.getElementById('admin-user-display');
const messageBox = document.getElementById('message-box');
const customConfirmModal = document.getElementById('custom-confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmSubmessage = document.getElementById('confirm-submessage');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');


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


// EasyMDE instances
let easyMDECreate;
let easyMDEEdit;

const DEFAULT_THEME = 'dark';
const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV'; // Default placeholder

/**
 * Displays a custom message box for user feedback.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True for error, false for success.
 */
function showMessageBox(message, isError) {
  if (!messageBox) {
    console.error("MessageBox element not found. Message:", message);
    return;
  }
  messageBox.textContent = message;
  messageBox.className = 'message-box';
  if (isError) {
    messageBox.classList.add('error');
  } else {
    messageBox.classList.add('success');
  }
  messageBox.style.display = 'block';
  setTimeout(() => {
    messageBox.style.display = 'none';
  }, 5000);
}

/**
 * Shows a custom confirmation modal.
 * @param {string} message - The main confirmation message.
 * @param {string} [subMessage=''] - An optional sub-message.
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled.
 */
function showCustomConfirm(message, subMessage = '') {
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
 * Fetches user profile data from Firestore.
 * @param {string} uid - The user's UID.
 * @returns {Promise<Object|null>} - User profile data or null if not found.
 */
async function getUserProfileFromFirestore(uid) {
  // Wait for Firebase to be ready before attempting Firestore operations
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore.");
    return null;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("ERROR: Error fetching user profile from Firestore:", error);
    showMessageBox(`Error fetching user profile: ${error.message}`, true);
  }
  return null;
}

/**
 * Updates user profile data in Firestore.
 * @param {string} uid - The user's UID.
 * @param {Object} profileData - The data to update (themePreference, displayName, photoURL).
 */
async function updateUserProfileInFirestore(uid, profileData) {
  await firebaseReadyPromise;
  if (!db) {
    showMessageBox("Database not initialized. Cannot save profile.", true);
    return false;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    showMessageBox("User profile updated successfully!", false);
    return true;
  } catch (error) {
    console.error("ERROR: Error updating user profile in Firestore:", error);
    showMessageBox(`Error saving profile: ${error.message}`, true);
    return false;
  }
}

/**
 * Deletes a user's profile from Firestore (does not delete Auth account).
 * @param {string} uid - The user's UID.
 */
async function deleteUserProfileFromFirestore(uid) {
  await firebaseReadyPromise;
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete profile.", true);
    return;
  }
  const confirmation = await showCustomConfirm(`Are you sure you want to delete user profile for UID: ${uid}?`, "This will NOT delete the Firebase Authentication account.");
  if (!confirmation) {
    showMessageBox("Deletion cancelled.", false);
    return;
  }

  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await deleteDoc(userDocRef);
    showMessageBox(`User profile ${uid} deleted successfully!`, false);
    renderUserList();
  } catch (error) {
    console.error("ERROR: Error deleting user profile:", error);
    showMessageBox(`Error deleting user profile: ${error.message}`, true);
  }
}

/**
 * Fetches all user profiles from Firestore.
 * @returns {Promise<Array>} - Array of user profile objects with their UIDs.
 */
async function fetchAllUserProfiles() {
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for fetchAllUserProfiles.");
    return [];
  }
  const userProfilesCol = collection(db, `artifacts/${appId}/public/data/user_profiles`);
  try {
    const querySnapshot = await getDocs(userProfilesCol);
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    return users;
  } catch (error) {
    console.error("ERROR: Error fetching all user profiles:", error);
    showMessageBox(`Error loading users: ${error.message}`, true);
    return [];
  }
}

/**
 * Renders the list of users in the table.
 */
async function renderUserList() {
  userListTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">Loading users...</td></tr>';
  const users = await fetchAllUserProfiles();
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
      <td class="px-4 py-2 border-b border-table-td-border">${user.themePreference || DEFAULT_THEME}</td>
      <td class="px-4 py-2 border-b border-table-td-border">
        <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm mr-2 edit-user-btn" data-uid="${user.id}" data-displayname="${user.displayName || ''}" data-theme="${user.themePreference || DEFAULT_THEME}">Edit</button>
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
    button.addEventListener('click', (event) => {
      console.log("DEBUG: Delete User button clicked.");
      const uid = event.target.dataset.uid;
      deleteUserProfileFromFirestore(uid);
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
    const success = await updateUserProfileInFirestore(currentEditingUserUid, {
      displayName: newDisplayName,
      themePreference: newTheme
    });
    if (success) {
      editUserModal.style.display = 'none';
      renderUserList();
      // If the admin is editing their own profile, apply the theme immediately
      if (auth.currentUser && auth.currentUser.uid === currentEditingUserUid) {
        const allThemes = await getAvailableThemes();
        const selectedTheme = allThemes.find(t => t.id === newTheme);
        applyTheme(selectedTheme.id, selectedTheme);
        console.log("DEBUG: Admin's own theme updated and applied.");
      }
    }
  });
}

document.querySelectorAll('.close-button').forEach(button => {
  button.addEventListener('click', () => {
    console.log("DEBUG: Close button clicked on a modal.");
    editUserModal.style.display = 'none';
    editTempPageModal.style.display = 'none';
    editTodoModal.style.display = 'none';
    customConfirmModal.style.display = 'none'; // Ensure custom confirm modal also closes
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
  if (event.target === customConfirmModal) {
    customConfirmModal.style.display = 'none';
    console.log("DEBUG: Custom Confirm Modal closed by clicking outside.");
  }
});


// Temporary Pages Functions
async function createTempPage(title, content) {
  await firebaseReadyPromise;
  if (!db) {
    showMessageBox("Database not initialized. Cannot create page.", true);
    return;
  }
  const tempPagesCol = collection(db, `artifacts/${appId}/public/data/temp_pages`);
  try {
    const docRef = await addDoc(tempPagesCol, {
      title: title,
      content: content,
      createdAt: new Date(),
      updatedAt: new Date(),
      authorUid: auth.currentUser ? auth.currentUser.uid : 'anonymous'
    });
    showMessageBox("Temporary page created successfully!", false);
    tempPageTitleInput.value = '';
    easyMDECreate.value('');
    renderTempPages();
    console.log("DEBUG: Temporary page created:", docRef.id);
  } catch (error) {
    console.error("ERROR: Error creating temporary page:", error);
    showMessageBox(`Error creating page: ${error.message}`, true);
  }
}

async function fetchAllTempPages() {
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized for fetchAllTempPages.");
    return [];
  }
  const tempPagesCol = collection(db, `artifacts/${appId}/public/data/temp_pages`);
  try {
    const querySnapshot = await getDocs(tempPagesCol);
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
        <a href="#" class="text-blue-400 hover:underline text-sm mr-2 view-temp-page" data-id="${page.id}">View</a>
        <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm mr-2 edit-temp-page-btn" data-id="${page.id}" data-title="${encodeURIComponent(page.title)}" data-content="${encodeURIComponent(page.content)}">Edit</button>
        <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm delete-temp-page-btn" data-id="${page.id}">Delete</button>
      </div>
    `;
    tempPageList.appendChild(li);
  });

  document.querySelectorAll('.view-temp-page').forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const pageId = event.target.dataset.id;
      window.open(`temp-page-viewer.html?id=${pageId}`, '_blank');
    });
  });
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
    button.addEventListener('click', (event) => {
      console.log("DEBUG: Delete Temporary Page button clicked.");
      const id = event.target.dataset.id;
      deleteTempPage(id);
    });
  });
}

function openEditTempPageModal(id, title, content) {
  currentEditingTempPageId = id;
  editTempPageTitleInput.value = title;

  if (!easyMDEEdit) {
    easyMDEEdit = new EasyMDE({
      element: document.getElementById('edit-temp-page-content'),
      spellChecker: false,
      forceSync: true,
      minHeight: "200px",
      toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "guide"]
    });
    console.log("DEBUG: easyMDEEdit initialized.");
  }
  easyMDEEdit.value(content);
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
    const newContent = easyMDEEdit.value().trim();
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
        updatedAt: new Date()
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
  await firebaseReadyPromise;
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
 * This function now ensures Firebase is ready before proceeding with Firestore checks.
 * @param {Object|null} user - The Firebase User object or null.
 */
async function updateAdminUI(user) {
  loadingSpinner.style.display = 'none'; // Hide spinner once auth state is determined
  await firebaseReadyPromise; // Ensure Firebase is initialized and auth state is settled

  if (user) {
    console.log("DEBUG: Authenticated User UID:", user.uid);
    console.log("DEBUG: Authenticated User Email:", user.email);

    const userProfile = await getUserProfileFromFirestore(user.uid);
    const themePreference = userProfile?.themePreference || DEFAULT_THEME;
    const allThemes = await getAvailableThemes(); // Get all themes from themes.js
    const themeToApply = allThemes.find(t => t.id === themePreference) || allThemes.find(t => t.id === DEFAULT_THEME);
    applyTheme(themeToApply.id, themeToApply); // Apply the theme using the imported function

    const adminDocRef = doc(db, `artifacts/${appId}/public/data/whitelisted_admins`, user.uid);
    try {
      const adminDocSnap = await getDoc(adminDocRef);
      if (adminDocSnap.exists()) {
        console.log("DEBUG: User is confirmed as ADMIN in Firestore.");
        loginRequiredMessage.style.display = 'none';
        adminContent.style.display = 'block';
        adminUserDisplay.textContent = userProfile?.displayName || user.displayName || user.email || user.uid;
        renderUserList();
        renderTempPages();
        renderTodoList();
      } else {
        console.log("DEBUG: User is NOT in whitelisted_admins collection.");
        loginRequiredMessage.style.display = 'block';
        adminContent.style.display = 'none';
        showMessageBox("You are logged in, but do not have admin privileges.", true);
      }
    } catch (error) {
      console.error("ERROR: Error checking admin whitelist:", error);
      loginRequiredMessage.style.display = 'block';
      adminContent.style.display = 'none';
      showMessageBox("Error checking admin status. Please try again.", true);
    }
  } else {
    console.log("DEBUG: No user is currently authenticated.");
    loginRequiredMessage.style.display = 'block';
    adminContent.style.display = 'none';
    const allThemes = await getAvailableThemes(); // Get all themes from themes.js
    const defaultThemeObj = allThemes.find(t => t.id === DEFAULT_THEME);
    applyTheme(defaultThemeObj.id, defaultThemeObj); // Apply default theme using the imported function
  }
}

// Todo List Functions
async function addTodoItem(task, worker, priority, eta, notes) {
  await firebaseReadyPromise;
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
      createdAt: new Date()
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
  await firebaseReadyPromise;
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
  } catch (error) {
    console.error("ERROR: Error fetching todo items:", error);
    showMessageBox(`Error loading tasks: ${error.message}`, true);
    return [];
  }
}

async function renderTodoList() {
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
      <td class="px-4 py-2 border-b border-table-td-border">${todo.eta || 'N/A'}</td>
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
    button.addEventListener('click', (event) => {
      console.log("DEBUG: Delete Todo button clicked.");
      const id = event.target.dataset.id;
      deleteTodoItem(id);
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
  await firebaseReadyPromise;
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
      updatedAt: new Date()
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
  await firebaseReadyPromise;
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

// Initialize Firebase and setup firebaseReadyPromise
firebaseReadyPromise = new Promise((resolve) => {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseInitialized = true;
    console.log("Firebase initialized successfully.");
    setupThemesFirebase(db, auth, appId); // Initialize themes.js with Firebase instances

    // Critical: Ensure auth state is settled before resolving
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("onAuthStateChanged triggered during initialization. User:", user ? user.uid : "none");
      unsubscribe(); // Unsubscribe after the first call
      // Perform initial sign-in if in Canvas and no user is already authenticated
      if (typeof __initial_auth_token !== 'undefined' && !user) {
        signInWithCustomToken(auth, __initial_auth_token)
          .then(() => console.log("DEBUG: Signed in with custom token from Canvas (admin_dev page) during init."))
          .catch((error) => {
            console.error("ERROR: Error signing in with custom token (admin_dev page) during init:", error);
            signInAnonymously(auth)
              .then(() => console.log("DEBUG: Signed in anonymously (admin_dev page) after custom token failure during init."))
              .catch((anonError) => console.error("ERROR: Error signing in anonymously on admin_dev page during init:", anonError));
          })
          .finally(() => resolve()); // Resolve promise after token attempt
      } else if (!user && typeof __initial_auth_token === 'undefined') {
        signInAnonymously(auth)
          .then(() => console.log("DEBUG: Signed in anonymously (no custom token) on admin_dev page during init."))
          .catch((anonError) => console.error("ERROR: Error signing in anonymously on admin_dev page during init:", anonError))
          .finally(() => resolve()); // Resolve after anonymous attempt
      } else {
        resolve(); // Resolve immediately if user is already authenticated or no token to use
      }
    });
  } catch (e) {
    console.error("Error initializing Firebase (initial block):", e);
    showMessageBox("Error initializing Firebase. Cannot perform authentication.", true);
    // Resolve immediately on error to prevent infinite loading
    resolve();
  }
});


// Load navbar first, then setup auth listener and initialize Firebase
window.onload = function() {
  // Call the imported loadNavbar function with necessary parameters
  loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME);
  document.getElementById('current-year-admin-dev').textContent = new Date().getFullYear();

  easyMDECreate = new EasyMDE({
    element: document.getElementById('temp-page-content'),
    spellChecker: false,
    forceSync: true,
    minHeight: "200px",
    toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "guide"]
  });
  console.log("DEBUG: easyMDECreate initialized.");


  // After the page content is loaded, wait for firebaseReadyPromise, then update UI based on auth state
  firebaseReadyPromise.then(() => {
    onAuthStateChanged(auth, (user) => {
      updateAdminUI(user);
    });
  });
};

// Event Listener for Logout Button
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    showMessageBox("", false);
    try {
      await signOut(auth);
      console.log("DEBUG: User signed out.");
      showMessageBox("You have been signed out.", false);
    } catch (error) {
      console.error("ERROR: Logout failed:", error);
      showMessageBox("Logout failed. Please try again. Error: " + (error.message || "Unknown error"), true);
    }
  });
}

if (loadUsersBtn) {
  loadUsersBtn.addEventListener('click', renderUserList);
}

if (createTempPageForm) {
  createTempPageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = tempPageTitleInput.value.trim();
    const content = easyMDECreate.value().trim();
    if (!title || !content) {
      showMessageBox("Please enter both title and content for the temporary page.", true);
      return;
    }
    await createTempPage(title, content);
  });
}

if (addTodoForm) {
  addTodoForm.addEventListener('submit', async (event) => {
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
}

if (saveTodoChangesBtn) {
  saveTodoChangesBtn.addEventListener('click', async () => {
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
}
