// utils.js: Provides common utility functions like custom message boxes and confirmation modals.

// Import necessary Firebase variables from firebase-init.js for any Firebase-related utils
// NOTE: `db` and `appId` are needed if utils functions directly interact with Firestore.
// If not, these imports can be removed from here to keep utils more independent.
// For now, including them to align with a broader app structure where utils might grow to need them.
import { db, appId, firebaseReadyPromise } from './firebase-init.js'; // Ensure these are correctly exported from firebase-init.js


// Immediately attempt to hide the custom confirm modal as soon as the script loads
const customConfirmModalOnLoad = document.getElementById('custom-confirm-modal');
if (customConfirmModalOnLoad) {
  customConfirmModalOnLoad.style.display = 'none';
  console.log("DEBUG-INIT: custom-confirm-modal forcibly hidden on script load.");
}

let messageBoxTimeout;

/**
 * Displays a custom message box for user feedback.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True for error message (red background), false for success message (green background).
 */
export function showMessageBox(message, isError) {
  const messageBox = document.getElementById('message-box');
  if (!messageBox) {
    console.error("MessageBox element not found. Message:", message);
    return;
  }
  // Clear any existing timeout to prevent previous messages from being hidden prematurely
  clearTimeout(messageBoxTimeout);

  messageBox.textContent = message;
  messageBox.className = 'message-box'; // Reset classes
  if (isError) {
    messageBox.classList.add('error');
  } else {
    messageBox.classList.add('success');
  }
  messageBox.style.opacity = '0'; // Start with opacity 0 for fade-in
  messageBox.style.display = 'block';

  // Force reflow to ensure transition works
  void messageBox.offsetWidth;

  messageBox.style.opacity = '1'; // Fade in

  // Hide the message box after 5 seconds
  messageBoxTimeout = setTimeout(() => {
    messageBox.style.opacity = '0'; // Fade out
    messageBox.addEventListener('transitionend', function handler() {
      messageBox.style.display = 'none';
      messageBox.removeEventListener('transitionend', handler);
    }, { once: true });
  }, 5000);
}

/**
 * Shows a custom confirmation modal and returns a Promise that resolves to true (Yes) or false (Cancel).
 * @param {string} message - The main message to display in the confirmation modal.
 * @param {string} subMessage - An optional secondary message.
 * @returns {Promise<boolean>} A promise that resolves to true if 'Yes' is clicked, false otherwise.
 */
export function showCustomConfirm(message, subMessage = '') {
  console.log("DEBUG: showCustomConfirm called with message:", message);
  const customConfirmModal = document.getElementById('custom-confirm-modal');
  const confirmMessageElement = document.getElementById('confirm-message');
  const confirmSubMessageElement = document.getElementById('confirm-submessage');
  const confirmYesBtn = document.getElementById('confirm-yes');
  const confirmNoBtn = document.getElementById('confirm-no');
  const closeButton = customConfirmModal ? customConfirmModal.querySelector('.close-button') : null;


  if (!customConfirmModal || !confirmMessageElement || !confirmYesBtn || !confirmNoBtn || !closeButton) {
    console.error("Confirmation modal elements not found. Falling back to browser's confirm.");
    // Fallback to browser's native confirm if custom elements are missing
    return Promise.resolve(window.confirm(message + (subMessage ? `\n\n${subMessage}` : '')));
  }

  confirmMessageElement.textContent = message;
  confirmSubMessageElement.textContent = subMessage;
  customConfirmModal.style.display = 'flex'; // Make the modal visible

  return new Promise(resolve => {
    const cleanup = () => {
      confirmYesBtn.removeEventListener('click', onYes);
      confirmNoBtn.removeEventListener('click', onNo);
      closeButton.removeEventListener('click', onNo);
      customConfirmModal.removeEventListener('click', onClickOutside);
      customConfirmModal.style.display = 'none'; // Hide modal after resolution
    };

    const onYes = () => { resolve(true); cleanup(); };
    const onNo = () => { resolve(false); cleanup(); };
    const onClickOutside = (event) => {
      if (event.target === customConfirmModal) { // Check if click was on the overlay, not the content
        resolve(false);
        cleanup();
      }
    };

    confirmYesBtn.addEventListener('click', onYes);
    confirmNoBtn.addEventListener('click', onNo);
    closeButton.addEventListener('click', onNo); // Allow closing with the 'x' button
    customConfirmModal.addEventListener('click', onClickOutside); // Close if clicking outside the modal content
  });
}

/**
 * Sanitizes a string to be suitable for a user handle.
 * Converts to lowercase and removes any characters not allowed (alphanumeric, underscore, dot, hyphen).
 * @param {string} input - The raw string to sanitize.
 * @returns {string} The sanitized handle string.
 */
export function sanitizeHandle(input) {
  return input.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}

// --- DEBUGGING INITIAL MODAL STATE --
document.addEventListener('DOMContentLoaded', () => {
  const customConfirmModal = document.getElementById('custom-confirm-modal');
  if (customConfirmModal) {
    console.log("DEBUG-INIT: custom-confirm-modal element found.");
    const currentDisplay = window.getComputedStyle(customConfirmModal).display;
    if (currentDisplay !== 'none') {
      console.log(`DEBUG-INIT: custom-confirm-modal is VISIBLE by default! Current display: ${currentDisplay}. Forcibly hiding it.`);
      customConfirmModal.style.display = 'none'; // Attempt to hide it forcefully if it's visible by default
    } else {
      console.log("DEBUG-INIT: custom-confirm-modal is correctly hidden by default.");
    }
  } else {
    console.error("DEBUG-INIT: custom-confirm-modal element not found.");
  }
});
