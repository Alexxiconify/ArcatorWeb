// forms.js: Main orchestrator for tabbed navigation and overall page logic.

import { setupFirebaseAndUser, auth, db, appId, getCurrentUser, ADMIN_UIDS } from './firebase-init.js';
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js'; // Global themes, not forum themes
import { loadNavbar } from './navbar.js';
import { showMessageBox, showCustomConfirm, getUserProfileFromFirestore } from './utils.js'; // Import getUserProfileFromFirestore
import { collection, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import collection, doc for modular syntax


// Import all forum related functions
import {
  renderForumThreads,
  unsubscribeForumThreadsListener,
  currentSelectedThemeId,
  handlePostComment,
  handleDeleteThread,
  handleDeleteComment,
  handleEmojiPaletteClick,
  createThread, // Exported for the form submission
  handleReaction as handleForumReaction // Renaming to avoid conflict
} from './forum.js';

// Import all DM related functions
import {
  renderConversationsList,
  unsubscribeConversationsListListener,
  unsubscribeCurrentMessagesListener,
  updateDmUiForNoConversationSelected,
  populateUserHandlesDatalist,
  handleCreateConversation,
  handleSendMessage,
  handleDeleteMessage,
  handleDeleteConversationClick,
  attachDmEventListeners
} from './dms.js';

// Import all Announcement related functions
import {
  renderAnnouncements,
  unsubscribeAnnouncementsListener,
  handlePostAnnouncement,
  handleDeleteAnnouncement,
  attachAnnouncementEventListeners
} from './announcements.js';

// Import Theme API functions
import {
  allThemesCache,
  populateThemeDropdowns,
  displayCurrentThemeInfo,
  openThemeManagementModal,
  closeThemeManagementModal,
  attachThemeModalEventListeners
} from './themes-api.js';


// --- DOM Elements (re-declared for local module access) ---
// Note: messageBox and customConfirmModal are now managed by utils.js directly
// but still good practice to have global refs if other modules might need them.
const messageBox = document.getElementById('message-box');
const customConfirmModal = document.getElementById('custom-confirm-modal');

// Tab Elements
const tabForum = document.getElementById('tab-forum');
const tabDMs = document.getElementById('tab-dms');
const tabAnnouncements = document.getElementById('tab-announcements');

const contentForum = document.getElementById('content-forum');
const contentDMs = document.getElementById('content-dms');
const contentAnnouncements = document.getElementById('content-announcements');

// Forum specific elements
const themeSelect = document.getElementById('theme-select');
const manageThemesBtn = document.getElementById('manage-themes-btn');
const createThreadForm = document.getElementById('create-thread-form');
const createThreadThemeSelect = document.getElementById('create-thread-theme');
const threadTitleInput = document.getElementById('thread-title');
const threadContentInput = document.getElementById('thread-content');

// --- Default Values (consistent with firebase-init.js) ---
const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark'; // For overall site theme


// --- TAB SWITCHING LOGIC ---
let currentActiveTab = 'forum'; // Default active tab

function showTab(tabId) {
  console.log(`Attempting to show tab: ${tabId}`);

  // Unsubscribe all active listeners from other tabs to prevent redundant updates
  unsubscribeForumThreadsListener();
  unsubscribeConversationsListListener();
  unsubscribeCurrentMessagesListener(); // Important for DM tab detail view
  unsubscribeAnnouncementsListener();

  // Deactivate all tab buttons and hide all content sections
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active-tab', 'border-blue-500', 'text-blue-300');
    button.classList.add('border-transparent', 'text-gray-300');
    console.log(`Deactivated button: ${button.id}`);
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
    // Explicitly set display none for robustness
    if (content.style) content.style.display = 'none';
    console.log(`Hid content: ${content.id}`);
  });

  // Activate the selected tab button and show its content section
  const selectedButton = document.getElementById(`tab-${tabId}`);
  const selectedContent = document.getElementById(`content-${tabId}`);

  if (selectedButton && selectedContent) {
    selectedButton.classList.add('active-tab', 'border-blue-500', 'text-blue-300');
    selectedButton.classList.remove('border-transparent', 'text-gray-300');
    console.log(`Activated button: ${selectedButton.id}`);

    selectedContent.classList.remove('hidden');
    // Explicitly set display block or flex for robustness
    if (tabId === 'dms') { // DM tab uses flex for its inner layout
      selectedContent.style.display = 'flex';
    } else {
      selectedContent.style.display = 'block';
    }
    console.log(`Showed content: ${selectedContent.id} with display: ${selectedContent.style.display}`);

    currentActiveTab = tabId; // Update global state for the active tab

    // Render content for the newly active tab
    switch (tabId) {
      case 'forum':
        const storedThemeId = localStorage.getItem('currentSelectedThemeId') || 'all';
        if (themeSelect) themeSelect.value = storedThemeId;
        renderForumThreads(storedThemeId);
        break;
      case 'dms':
        populateUserHandlesDatalist();
        updateDmUiForNoConversationSelected(); // Ensure messages panel is hidden and list is shown initially
        renderConversationsList(); // Then render the list of conversations
        break;
      case 'announcements':
        renderAnnouncements();
        break;
      default:
        console.warn(`Attempted to show unknown tab: ${tabId}`);
    }
  } else {
    console.error(`Could not find button or content for tab: ${tabId}`);
  }
}

// --- INITIALIZATION ---
window.onload = async function() {
  if (customConfirmModal) {
    customConfirmModal.style.display = 'none';
  }
  const themeManagementModal = document.getElementById('theme-management-modal');
  if (themeManagementModal) {
    themeManagementModal.style.display = 'none';
  }

  await setupFirebaseAndUser(); // Ensure Firebase and current user are ready

  // Load navbar and apply user's theme preference
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
  const currentUser = getCurrentUser(); // Get updated currentUser after Firebase init

  // Use getUserProfileFromFirestore from utils.js to fetch user profile
  const userProfileForTheme = currentUser ? await getUserProfileFromFirestore(currentUser.uid) : null;
  const userThemePreference = userProfileForTheme?.themePreference;

  const allGlobalThemes = await getAvailableThemes(); // Global themes from themes.js
  const themeToApply = allGlobalThemes.find(t => t.id === userThemePreference) || allGlobalThemes.find(t => t.id === DEFAULT_THEME_NAME);
  applyTheme(themeToApply.id, themeToApply);
  setupThemesFirebase(db, auth, appId); // Ensure themes.js also has Firebase instances

  // Attach tab switching listeners
  if (tabForum) tabForum.addEventListener('click', () => showTab('forum'));
  if (tabDMs) tabDMs.addEventListener('click', () => showTab('dms'));
  if (tabAnnouncements) tabAnnouncements.addEventListener('click', () => showTab('announcements'));

  // Attach Forum specific event listeners
  if (themeSelect) {
    themeSelect.addEventListener('change', (event) => {
      renderForumThreads(event.target.value);
    });
  }
  if (manageThemesBtn) {
    manageThemesBtn.addEventListener('click', openThemeManagementModal);
  }
  if (createThreadForm) {
    createThreadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const selectedThemeOption = createThreadThemeSelect.options[createThreadThemeSelect.selectedIndex];
      const themeId = selectedThemeOption.value;
      // Ensure theme name is not empty if "Select a Theme" is still there
      const themeName = selectedThemeOption.textContent === '-- Select a Theme --' ? '' : selectedThemeOption.textContent.trim();

      const title = threadTitleInput.value.trim();
      const content = threadContentInput.value.trim();

      await createThread(themeId, themeName, title, content);
    });
  }

  // Attach listeners for dynamic forum elements (delegation)
  document.getElementById('threads-list-container')?.addEventListener('click', async (event) => {
    const target = event.target;

    // Handle delete thread button
    if (target.classList.contains('delete-thread-btn') || target.closest('.delete-thread-btn')) {
      event.preventDefault();
      const button = target.closest('.delete-thread-btn');
      const threadId = button.dataset.id;
      await handleDeleteThread(threadId);
    }
    // Handle delete comment button
    else if (target.classList.contains('delete-comment-btn') || target.closest('.delete-comment-btn')) {
      event.preventDefault();
      const button = target.closest('.delete-comment-btn');
      const threadId = button.dataset.threadId;
      const commentId = button.dataset.commentId;
      await handleDeleteComment(threadId, commentId);
    }
    // Handle post comment button
    else if (target.classList.contains('post-comment-btn') || target.closest('.post-comment-btn')) {
      event.preventDefault();
      const button = target.closest('.post-comment-btn');
      const threadId = button.dataset.threadId;
      const commentInput = document.getElementById(`comment-input-${threadId}`);
      const commentContent = commentInput.value.trim();
      if (commentContent) {
        await handlePostComment(event);
      } else {
        showMessageBox("Comment cannot be empty.", true);
      }
    }
    // Handle emoji palette clicks
    else if (target.classList.contains('emoji-item') || target.closest('.emoji-item')) {
      handleEmojiPaletteClick(event);
    }
    // Handle thread reactions (upvote/downvote)
    else if (target.classList.contains('fa-arrow-up') || target.classList.contains('fa-arrow-down')) {
      event.preventDefault();
      const btn = target;
      const type = btn.dataset.type || 'thread';
      const itemId = btn.dataset.itemId;
      const emoji = btn.dataset.emoji;
      if (type && itemId && emoji) {
        await handleForumReaction(type, itemId, null, emoji);
      }
    }
  });


  // Attach DM specific event listeners (from dms.js)
  attachDmEventListeners();

  // Attach Announcement specific event listeners (from announcements.js)
  attachAnnouncementEventListeners();

  // Attach Theme Modal event listeners (from themes-api.js)
  attachThemeModalEventListeners();

  // Set the current year in the footer.
  document.getElementById('current-year-forms').textContent = new Date().getFullYear();

  // Show the default tab on load
  showTab(currentActiveTab);
};
