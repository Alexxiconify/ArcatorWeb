// admin_and_dev.js: Admin panel functionality
import {
  auth, db, appId, firebaseReadyPromise, DEFAULT_THEME_NAME,
  updateUserProfileInFirestore, currentUser as firebaseCurrentUser, onAuthStateChanged
} from './firebase-init.js';
import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js';
import { 
  initializeEmailJS, sendEmailWithEmailJS, testEmailJSConnection, 
  getEmailJSStatus, saveCredentials 
} from './emailjs-integration.js';
import { 
  sendEmailViaSMTP, testSMTPServerConnection, getSMTPServerStatus, 
  initializeSMTPIntegration 
} from './smtp-integration.js';
import {
  doc, getDoc, setDoc, collection, getDocs, deleteDoc, addDoc, updateDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showMessageBox, showCustomConfirm } from './utils.js';

// DOM elements
const loadingSpinner = document.getElementById('loading-spinner');
const loginRequiredMessage = document.getElementById('login-required-message');
const adminContent = document.getElementById('admin-content');

// User Management
const userListTbody = document.getElementById('user-list-tbody');
const editUserModal = document.getElementById('edit-user-modal');
let currentEditingUserUid = null;

// Temporary Pages
const createTempPageForm = document.getElementById('create-temp-page-form');
const tempPageTitleInput = document.getElementById('temp-page-title');
const tempPageContentInput = document.getElementById('temp-page-content');
const editTempPageModal = document.getElementById('edit-temp-page-modal');
const editTempPageTitleInput = document.getElementById('edit-temp-page-title');
const editTempPageContentInput = document.getElementById('edit-temp-page-content');
const saveTempPageChangesBtn = document.getElementById('save-temp-page-changes-btn');
let currentEditingTempPageId = null;

// Global variables
let usersData = [];
let currentEditingUser = null;

// Toggle collapsible sections
function toggleSection(headerElement, contentElement) {
  const isHidden = contentElement.classList.contains('hidden');
  if (isHidden) {
    contentElement.classList.remove('hidden');
    headerElement.querySelector('svg')?.classList.remove('rotate-90');
  } else {
    contentElement.classList.add('hidden');
    headerElement.querySelector('svg')?.classList.add('rotate-90');
  }
}

// Load users from Firestore
async function loadUsers() {
  if (!db) {
    console.error("Firestore DB not initialized for loadUsers.");
    showMessageBox("Database not ready.", true);
    return;
  }
  try {
    const usersRef = collection(db, `artifacts/arcator-web/public/data/user_profiles`);
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

// Render user list
async function renderUserList() {
  const tbody = document.getElementById('user-list-tbody');
  if (!usersData || usersData.length === 0) {
    tbody.innerHTML = '<tr><td class="text-center py-4 text-text-secondary text-xs" colspan="5">No users found.</td></tr>';
    return;
  }
  tbody.innerHTML = usersData.map(user => {
    const displayName = user.displayName || 'N/A';
    const email = user.email || 'N/A';
    const theme = user.themePreference || 'dark';
    return `
      <tr class="hover:bg-table-row-even-bg transition-colors">
        <td class="px-2 py-1 text-text-primary text-xs font-mono">${user.uid.substring(0, 8)}...</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(displayName)}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${escapeHtml(email)}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">${escapeHtml(theme)}</td>
        <td class="px-2 py-1 text-text-secondary text-xs">
          <div class="flex space-x-1">
            <button onclick="openEditUserModal('${user.uid}', ${JSON.stringify(user).replace(/"/g, '&quot;')})"
                    class="text-blue-400 hover:text-blue-300 transition-colors" title="Edit User">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <button onclick="deleteUserProfile('${user.uid}', '${escapeHtml(displayName)}')"
                    class="text-red-400 hover:text-red-300 transition-colors" title="Delete Profile">
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

// Open edit user modal
function openEditUserModal(uid, userData) {
  currentEditingUser = { uid, ...userData };
  currentEditingUserUid = uid;
  
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
  
  // Show modal
  editUserModal.style.display = 'flex';
  editUserModal.style.justifyContent = 'center';
  editUserModal.style.alignItems = 'center';
}

// Populate theme select
async function populateEditUserThemeSelect(selectedThemeId) {
  const editUserThemeSelect = document.getElementById('edit-user-theme');
  editUserThemeSelect.innerHTML = '';
  const availableThemes = await getAvailableThemes();
  availableThemes.forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    editUserThemeSelect.appendChild(option);
  });
  editUserThemeSelect.value = selectedThemeId;
}

// Save user changes
async function saveUserChanges() {
  if (!currentEditingUserUid) {
    console.error("ERROR: currentEditingUserUid is null. Cannot save changes.");
    return;
  }
  
  const updatedProfile = {
    displayName: document.getElementById('edit-user-display-name').value.trim(),
    handle: document.getElementById('edit-user-handle').value.trim(),
    email: document.getElementById('edit-user-email').value.trim(),
    photoURL: document.getElementById('edit-user-photo-url').value.trim(),
    discordURL: document.getElementById('edit-user-discord-url').value.trim(),
    githubURL: document.getElementById('edit-user-github-url').value.trim(),
    themePreference: document.getElementById('edit-user-theme').value,
    fontScaling: document.getElementById('edit-user-font-scaling').value,
    notificationSettings: {
      notificationFrequency: document.getElementById('edit-user-notification-frequency').value,
      emailNotifications: document.getElementById('edit-user-email-notifications').checked,
      discordNotifications: document.getElementById('edit-user-discord-notifications').checked,
      pushNotifications: document.getElementById('edit-user-push-notifications').checked
    },
    privacySettings: {
      dataRetention: parseInt(document.getElementById('edit-user-data-retention').value),
      profileVisible: document.getElementById('edit-user-profile-visible').checked,
      activityTracking: document.getElementById('edit-user-activity-tracking').checked,
      thirdPartySharing: document.getElementById('edit-user-third-party-sharing').checked
    },
    accessibilitySettings: {
      highContrast: document.getElementById('edit-user-high-contrast').checked,
      reducedMotion: document.getElementById('edit-user-reduced-motion').checked,
      screenReader: document.getElementById('edit-user-screen-reader').checked,
      focusIndicators: document.getElementById('edit-user-focus-indicators').checked
    },
    keyboardShortcuts: document.getElementById('edit-user-keyboard-shortcuts').value,
    debugMode: document.getElementById('edit-user-debug-mode').checked,
    customCSS: document.getElementById('edit-user-custom-css').value.trim()
  };

  try {
    const userRef = doc(db, `artifacts/arcator-web/public/data/user_profiles`, currentEditingUserUid);
    await updateDoc(userRef, updatedProfile);
    showMessageBox("User profile updated successfully!");
    editUserModal.style.display = 'none';
    currentEditingUserUid = null;
    renderUserList();
  } catch (error) {
    console.error("Error updating user profile:", error);
    showMessageBox("Failed to update user profile", true);
  }
}

// Temporary Pages Functions
async function createTempPage(title, content) {
  if (!db) {
    showMessageBox("Database not initialized. Cannot create page.", true);
    return;
  }
  const tempPagesCol = collection(db, `artifacts/arcator-web/public/data/temp_pages`);
  try {
    await addDoc(tempPagesCol, {
      title: title,
      content: content,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      authorUid: auth.currentUser ? auth.currentUser.uid : 'anonymous'
    });
    showMessageBox("Temporary page created successfully!", false);
    tempPageTitleInput.value = '';
    tempPageContentInput.value = '';
    await loadTempPagesList();
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
  const tempPagesCol = collection(db, `artifacts/arcator-web/public/data/temp_pages`);
  try {
    const querySnapshot = await getDocs(tempPagesCol);
    const pages = [];
    querySnapshot.forEach((doc) => {
      pages.push({ id: doc.id, ...doc.data() });
    });
    console.log(`[DEBUG] Fetched ${pages.length} temporary pages from Firestore`);
    return pages;
  } catch (error) {
    console.error("ERROR: Error fetching temporary pages:", error);
    showMessageBox(`Error loading temporary pages: ${error.message}`, true);
    return [];
  }
}

async function loadTempPagesList() {
  try {
    const tempPages = await fetchAllTempPages();
    await renderTempPages(tempPages);
  } catch (error) {
    console.error("ERROR: Error loading temp pages list:", error);
    showMessageBox("Failed to load temporary pages list", true);
  }
}

async function renderTempPages(tempPages) {
  const tbody = document.getElementById('temp-pages-tbody');
  if (!tbody) {
    console.error("ERROR: temp-pages-tbody element not found");
    return;
  }
  
  if (!tempPages || tempPages.length === 0) {
    tbody.innerHTML = '<tr><td class="text-center py-4 text-text-secondary text-xs" colspan="2">No temporary pages found.</td></tr>';
    return;
  }
  
  tbody.innerHTML = tempPages.map(page => `
    <tr class="hover:bg-table-row-even-bg transition-colors">
      <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(page.title)}</td>
      <td class="px-2 py-1 text-text-secondary text-xs">
        <div class="flex space-x-1">
          <button onclick="openEditTempPageModal('${page.id}', '${escapeHtml(page.title)}', '${escapeHtml(page.content)}')" 
                  class="text-blue-400 hover:text-blue-300 transition-colors" title="Edit Page">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button onclick="deleteTempPage('${page.id}', '${escapeHtml(page.title)}')" 
                  class="text-red-400 hover:text-red-300 transition-colors" title="Delete Page">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openEditTempPageModal(id, title, content) {
  currentEditingTempPageId = id;
  editTempPageTitleInput.value = title;
  editTempPageContentInput.value = content;
  editTempPageModal.style.display = 'flex';
  editTempPageModal.style.justifyContent = 'center';
  editTempPageModal.style.alignItems = 'center';
}

async function deleteTempPage(id, title) {
  if (!db) {
    showMessageBox("Database not initialized. Cannot delete page.", true);
    return;
  }
  const confirmation = await showCustomConfirm(
    `Are you sure you want to delete the temporary page "${title}"?`, 
    "This action cannot be undone."
  );
  if (!confirmation) {
    showMessageBox("Deletion cancelled.", false);
    return;
  }
  const tempPageDocRef = doc(db, `artifacts/arcator-web/public/data/temp_pages`, id);
  try {
    await deleteDoc(tempPageDocRef);
    showMessageBox(`Temporary page "${title}" deleted successfully!`, false);
    await loadTempPagesList();
  } catch (error) {
    console.error("ERROR: Error deleting temporary page:", error);
    showMessageBox(`Error deleting page: ${error.message}`, true);
  }
}

// Email Management Functions
async function populateEmailRecipientTypes() {
  const recipientTypeSelect = document.getElementById('email-recipient-type');
  if (!recipientTypeSelect) return;
  
  recipientTypeSelect.innerHTML = `
    <option value="">Select recipient type...</option>
    <option value="users">All Users</option>
    <option value="admins">Admins Only</option>
    <option value="custom">Custom Selection</option>
  `;
}

async function populateEmailTemplates() {
  const emailTemplateSelect = document.getElementById('email-template');
  if (!emailTemplateSelect) return;
  
  emailTemplateSelect.innerHTML = `
    <option value="">Select template...</option>
    <option value="welcome">Welcome Email</option>
    <option value="announcement">Announcement</option>
    <option value="notification">System Notification</option>
    <option value="custom">Custom</option>
  `;
}

async function populateCustomRecipients() {
  const emailRecipientsList = document.getElementById('email-recipients-list');
  if (!emailRecipientsList || !usersData) return;
  emailRecipientsList.innerHTML = usersData.filter(u => u.email).map(user => `
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
  const draft = { subject, content, timestamp: new Date().toISOString() };
  localStorage.setItem('emailDraft', JSON.stringify(draft));
  showMessageBox('Draft saved successfully!', false);
}

async function logEmailToHistory(recipients, subject, content, status, method) {
  try {
    const emailRecord = {
      recipients: recipients,
      subject: subject,
      content: content,
      status: status,
      method: method,
      sentAt: serverTimestamp(),
      sentBy: currentUser?.uid || 'unknown',
      appId: 'arcator-web'
    };
    await addDoc(collection(db, `artifacts/arcator-web/public/data/email_history`), emailRecord);
  } catch (error) {
    console.error('[Email] Failed to log to history:', error);
  }
}

async function loadEmailHistory() {
  if (!db) return;
  const tbody = document.getElementById('email-history-tbody');
  if (!tbody) return;
  try {
    const emailRef = collection(db, `artifacts/arcator-web/public/data/email_history`);
    const querySnapshot = await getDocs(query(emailRef, orderBy('sentAt', 'desc')));
    const emails = [];
    querySnapshot.forEach(doc => {
      emails.push({ id: doc.id, ...doc.data() });
    });
    if (emails.length === 0) {
      tbody.innerHTML = '<tr><td class="text-center py-4 text-text-secondary text-xs" colspan="6">No emails sent yet.</td></tr>';
      return;
    }
    tbody.innerHTML = emails.map(email => `
      <tr>
        <td class="px-2 py-1 text-text-primary text-xs">${email.sentAt ? new Date(email.sentAt.toDate()).toLocaleString() : ''}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(email.recipients?.join(', ') || '')}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(email.subject || '')}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(email.status || '')}</td>
        <td class="px-2 py-1 text-text-primary text-xs">${escapeHtml(email.method || '')}</td>
        <td class="px-2 py-1 text-text-primary text-xs"><button class="btn-primary btn-blue text-xs">View</button></td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td class="text-center py-4 text-text-secondary text-xs" colspan="6">Failed to load emails.</td></tr>';
  }
}

async function loadDMHistory() {
  if (!db) return;
  const tbody = document.getElementById('dm-history-tbody');
  if (!tbody) return;
  try {
    const dmRef = collection(db, `artifacts/arcator-web/public/data/direct_messages`);
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
    const formsRef = collection(db, `artifacts/arcator-web/public/data/form_submissions`);
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

// Update admin UI based on auth state
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
    await Promise.all([
      loadUsers(),
      loadDMHistory(),
      loadFormsData(),
      loadTempPagesList(),
      loadEmailHistory()
    ]);
    
    // Populate email management selects
    await Promise.all([
      populateEmailRecipientTypes(),
      populateEmailTemplates()
    ]);
    
    loadingSpinner.style.display = 'none';
  } catch (error) {
    console.error("Error updating admin UI:", error);
    loadingSpinner.style.display = 'none';
    showMessageBox("Error loading admin data: " + error.message, true);
  }
};

// Setup event listeners
function setupEventListeners() {
  // Create temp page form
  createTempPageForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = tempPageTitleInput.value.trim();
    const content = tempPageContentInput.value.trim();
    if (!title || !content) {
      showMessageBox("Please enter both title and content for the temporary page.", true);
      return;
    }
    await createTempPage(title, content);
  });

  // Save temp page changes
  saveTempPageChangesBtn?.addEventListener('click', async () => {
    if (!currentEditingTempPageId) {
      console.error("ERROR: currentEditingTempPageId is null. Cannot save changes.");
      return;
    }
    const newTitle = editTempPageTitleInput.value.trim();
    const newContent = editTempPageContentInput.value.trim();
    if (!newTitle || !newContent) {
      showMessageBox("Title and Content cannot be empty.", true);
      return;
    }
    const tempPageDocRef = doc(db, `artifacts/arcator-web/public/data/temp_pages`, currentEditingTempPageId);
    try {
      await updateDoc(tempPageDocRef, {
        title: newTitle,
        content: newContent,
        updatedAt: serverTimestamp()
      });
      showMessageBox("Temporary page updated successfully!", false);
      editTempPageModal.style.display = 'none';
      await loadTempPagesList();
    } catch (error) {
      console.error("ERROR: Error updating temporary page:", error);
      showMessageBox(`Error updating page: ${error.message}`, true);
    }
  });

  // Email management
  const recipientTypeSelect = document.getElementById('email-recipient-type');
  const customRecipientsSection = document.getElementById('custom-recipients-section');
  const emailTemplateSelect = document.getElementById('email-template');
  const emailComposeForm = document.getElementById('email-compose-form');
  const previewEmailBtn = document.getElementById('preview-email-btn');
  const saveDraftBtn = document.getElementById('save-draft-btn');

  recipientTypeSelect?.addEventListener('change', async (e) => {
    const type = e.target.value;
    if (type === 'custom') {
      customRecipientsSection.style.display = 'block';
      await populateCustomRecipients();
    } else {
      customRecipientsSection.style.display = 'none';
    }
  });

  emailTemplateSelect?.addEventListener('change', handleEmailTemplateChange);
  emailComposeForm?.addEventListener('submit', sendEmail);
  previewEmailBtn?.addEventListener('click', showEmailPreview);
  saveDraftBtn?.addEventListener('click', saveEmailDraft);

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

  // User edit form
  const saveUserChangesBtn = document.getElementById('save-user-changes-btn');
  const cancelUserChangesBtn = document.getElementById('cancel-user-changes-btn');
  const editForm = document.getElementById('edit-user-form');

  saveUserChangesBtn?.addEventListener('click', saveUserChanges);
  cancelUserChangesBtn?.addEventListener('click', () => {
    editUserModal.style.display = 'none';
    currentEditingUserUid = null;
  });

  editForm?.addEventListener('submit', async function(event) {
    event.preventDefault();
    await saveUserChanges();
  });
}

// Utility function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Global functions
window.deleteUserProfile = async function(uid, displayName) {
  const confirmed = await showCustomConfirm(
    `Are you sure you want to delete the user profile for ${displayName}?`,
    "This action will permanently delete the user's profile data including all settings, preferences, and customizations. This will NOT delete the Firebase Authentication account. This action cannot be undone."
  );
  if (confirmed) {
    const userDocRef = doc(db, `artifacts/arcator-web/public/data/user_profiles`, uid);
    try {
      await deleteDoc(userDocRef);
      showMessageBox(`User profile ${displayName} deleted successfully!`, false);
      await loadUsers();
    } catch (error) {
      console.error("Error deleting user profile:", error);
      showMessageBox(`Error deleting user profile ${displayName}. ${error.message}`, true);
    }
  } else {
    showMessageBox("Deletion cancelled.", false);
  }
};

window.openEditUserModal = function(uid, userData) {
  openEditUserModal(uid, userData);
};

window.openEditTempPageModal = function(id, title, content) {
  openEditTempPageModal(id, title, content);
};

window.deleteTempPage = function(id, title) {
  deleteTempPage(id, title);
};

window.viewEmailDetails = function(emailId) {
  showMessageBox('Email details view not implemented yet.', true);
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async function() {
  await firebaseReadyPromise;
  setupThemesFirebase(db, auth, appId);
  await loadNavbar(auth.currentUser, firebaseCurrentUser, DEFAULT_THEME_NAME);
  onAuthStateChanged(auth, (user) => {updateAdminUI(user);});
  setupEventListeners();
});