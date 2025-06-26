// utils.js - Provides general utility functions

const messageBox = document.getElementById('message-box');
let messageBoxTimeout;

/**
 * Displays a temporary message box at the bottom center of the screen.
 * @param {string} message - The message to display.
 * @param {boolean} isError - If true, styles the message as an error; otherwise, as success.
 */
export function showMessageBox(message, isError = false) {
  if (!messageBox) {
    console.error("Message box element not found. Cannot show message.");
    return;
  }
  // Clear any existing timeout to allow new messages to display immediately
  if (messageBoxTimeout) {
    clearTimeout(messageBoxTimeout);
  }

  // Set message content and appropriate class for styling
  messageBox.textContent = message;
  messageBox.className = 'message-box'; // Reset classes
  if (isError) {
    messageBox.classList.add('error');
  } else {
    messageBox.classList.add('success');
  }

  // Show the message box
  messageBox.classList.add('show');

  // Hide the message box after 3 seconds
  messageBoxTimeout = setTimeout(() => {
    messageBox.classList.remove('show');
  }, 3000);
}

/**
 * Sanitizes a string to be suitable for a user handle.
 * Allows only alphanumeric characters, dots, and underscores, converting to lowercase.
 * @param {string} input - The raw input string.
 * @returns {string} The sanitized handle.
 */
export function sanitizeHandle(input) {
  // Convert to lowercase and remove any characters that are not alphanumeric, dot, or underscore.
  return input.toLowerCase().replace(/[^a-z0-9_.]/g, '');
}

// Custom confirmation modal elements
const customConfirmModal = document.getElementById('custom-confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmSubmessage = document.getElementById('confirm-submessage');
const confirmYesButton = document.getElementById('confirm-yes');
const confirmNoButton = document.getElementById('confirm-no');
const closeButton = document.querySelector('.custom-confirm-modal .close-button');
let resolveConfirmPromise; // Stores the resolve function for the confirmation promise

/**
 * Displays a custom confirmation modal to the user.
 * @param {string} message - The main message for the confirmation.
 * @param {string} submessage - An optional sub-message for more details.
 * @returns {Promise<boolean>} A promise that resolves to true if 'Yes' is clicked, false otherwise.
 */
export function showCustomConfirm(message, submessage = '') {
  if (!customConfirmModal || !confirmMessage || !confirmYesButton || !confirmNoButton || !closeButton) {
    console.error("Custom confirmation modal elements not found. Cannot show confirm dialog.");
    // Resolve immediately to prevent blocking if elements are missing
    return Promise.resolve(false);
  }

  // Set messages
  confirmMessage.textContent = message;
  confirmSubmessage.textContent = submessage;

  // Show the modal
  customConfirmModal.style.display = 'flex';

  // Return a new promise that resolves when the user interacts with the modal
  return new Promise((resolve) => {
    resolveConfirmPromise = resolve; // Store resolve function for later use

    // Clear previous event listeners to prevent multiple firings
    confirmYesButton.onclick = null;
    confirmNoButton.onclick = null;
    closeButton.onclick = null;
    customConfirmModal.onclick = null; // Clear overlay click listener

    // Set new event listeners
    confirmYesButton.onclick = () => {
      customConfirmModal.style.display = 'none';
      resolveConfirmPromise(true);
    };

    confirmNoButton.onclick = () => {
      customConfirmModal.style.display = 'none';
      resolveConfirmPromise(false);
    };

    closeButton.onclick = () => {
      customConfirmModal.style.display = 'none';
      resolveConfirmPromise(false);
    };

    // Close modal if clicking outside the modal content
    customConfirmModal.onclick = (event) => {
      if (event.target === customConfirmModal) {
        customConfirmModal.style.display = 'none';
        resolveConfirmPromise(false);
      }
    };
  });
}

// Ensure the modal is hidden on initial DOM load if it somehow became visible
document.addEventListener('DOMContentLoaded', () => {
  if (customConfirmModal) {
    console.log("DEBUG-INIT: custom-confirm-modal element found.");
    // Force hide on load to prevent flickering or incorrect display state
    if (customConfirmModal.style.display === '' || customConfirmModal.style.display === 'block') {
      customConfirmModal.style.display = 'none';
      console.log("DEBUG-INIT: custom-confirm-modal forcibly hidden on script load.");
    } else {
      console.log("DEBUG-INIT: custom-confirm-modal is correctly hidden by default.");
    }
  }
});
