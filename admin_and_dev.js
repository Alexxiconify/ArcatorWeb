/* global __app_id, __initial_auth_token */

// admin_and_dev.js: This script handles the initial Firebase setup and loads the navbar.
// All forum-specific functionality has been moved to forum.js and utilities to utils.js.

console.log("admin_and_dev.js - Script parsing initiated.");

// --- Firebase and Utility Imports ---
import { setupFirebaseAndUser, auth, db, appId, getCurrentUser } from './firebase-init.js';
import { applyTheme, getAvailableThemes, setupThemesFirebase } from './themes.js';
import { loadNavbar } from './navbar.js';
import { getUserProfileFromFirestore } from './utils.js'; // Needed to fetch user theme preference

// --- Default Values (consistent with firebase-init.js) ---
const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
const DEFAULT_THEME_NAME = 'dark';


// Main execution logic that runs once the window is loaded.
window.onload = async function() {
  // Hide custom confirm modal initially (if it exists on this page)
  const customConfirmModal = document.getElementById('custom-confirm-modal');
  if (customConfirmModal) {
    customConfirmModal.style.display = 'none';
  }

  // Initialize Firebase and authenticate user
  await setupFirebaseAndUser();
  const currentUser = getCurrentUser(); // Get the current user after setup

  // Load navbar with Firebase instances
  await loadNavbar({ auth, db, appId }, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

  // Apply user's theme preference
  let userThemePreference = null;
  if (currentUser) {
    const userProfile = await getUserProfileFromFirestore(currentUser.uid); // Use utils's function
    userThemePreference = userProfile?.themePreference;
  }
  const allThemes = await getAvailableThemes();
  const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
  applyTheme(themeToApply.id, themeToApply);
  setupThemesFirebase(db, auth, appId); // Ensure themes.js has Firebase instances


  // Set the current year in the footer.
  const currentYearElement = document.getElementById('current-year-forms'); // Assuming it's the same ID as forms.html
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear();
  }
  // No other logic here, as all forum/DM/announcement logic moved to respective modules.
};
