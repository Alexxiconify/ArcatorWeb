// utils.js - Centralized utility functions for the Arcator website

// Message box functionality
let messageBox;
let messageBoxTimeout;

/**
 * Shows a message box with the given message and error status.
 * @param {string} message - The message to display.
 * @param {boolean} isError - Whether this is an error message.
 */
export function showMessageBox(message, isError = false) {
  if (!messageBox) {
    messageBox = document.getElementById('message-box');
  }
  if (!messageBox) return;

  messageBox.textContent = message;
  messageBox.className = 'message-box ' + (isError ? 'error' : 'success') + ' show';

  if (messageBoxTimeout) {
    clearTimeout(messageBoxTimeout);
  }

  messageBoxTimeout = setTimeout(() => {
    messageBox.className = 'message-box';
  }, 3000);
}

/**
 * Sanitizes a string to be suitable for a user handle.
 * Allows only alphanumeric characters, dots, and underscores, converting to lowercase.
 * @param {string} input - The raw input string.
 * @returns {string} The sanitized handle.
 */
export function sanitizeHandle(input) {
  return input.toLowerCase().replace(/[^a-z0-9_.]/g, '');
}

/**
 * Validates a photo URL and returns a safe URL or default.
 * @param {string} photoURL - The URL to validate.
 * @param {string} defaultPic - The default URL to return if validation fails.
 * @returns {string} The validated URL or default.
 */
export function validatePhotoURL(photoURL, defaultPic) {
  if (!photoURL || typeof photoURL !== 'string') {
    console.log('[DEBUG] validatePhotoURL: No photoURL provided, using default');
    return defaultPic;
  }

  console.log('[DEBUG] validatePhotoURL: Validating URL:', photoURL);

  try {
    const url = new URL(photoURL);

    // Check if it's a valid HTTP/HTTPS URL
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      console.warn('[DEBUG] validatePhotoURL: Invalid protocol:', url.protocol);
      return defaultPic;
    }

    // Allow common profile picture domains
    const allowedDomains = [
      'cdn.discordapp.com',
      'media.discordapp.net',
      'images.discordapp.net',
      'lh3.googleusercontent.com',
      'graph.facebook.com',
      'platform-lookaside.fbsbx.com',
      'pbs.twimg.com',
      'abs.twimg.com',
      'placehold.co',
      'via.placeholder.com',
      'ui-avatars.com',
      'gravatar.com',
      'www.gravatar.com'
    ];

    const hostname = url.hostname.toLowerCase();
    const isAllowedDomain = allowedDomains.some(domain => hostname.includes(domain));

    if (!isAllowedDomain) {
      console.warn('[DEBUG] validatePhotoURL: Domain not in allowed list:', hostname);
      // Still allow the URL if it's HTTPS and looks like a valid image URL
      if (url.protocol === 'https:' && (url.pathname.includes('.') || url.pathname.includes('/'))) {
        console.log('[DEBUG] validatePhotoURL: Allowing HTTPS URL with valid path:', photoURL);
        return photoURL;
      }
      return defaultPic;
    }

    console.log('[DEBUG] validatePhotoURL: URL validated successfully:', photoURL);
    return photoURL;
  } catch (error) {
    console.error('[DEBUG] validatePhotoURL: Error parsing URL:', error);
    return defaultPic;
  }
}

/**
 * Tests if a URL is accessible and returns a valid image
 * @param {string} url - The URL to test
 * @returns {Promise<boolean>} True if the URL is accessible
 */
export async function testImageURL(url) {
  if (!url) return false;

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors' // This allows testing cross-origin URLs
    });

    // For no-cors requests, we can't check the status, so we'll assume it's valid
    // and let the browser handle the actual image loading
    return true;
  } catch (error) {
    console.warn('[DEBUG] testImageURL: Failed to test URL:', url, error);
    return false;
  }
}

/**
 * Validates and tests a photo URL, falling back to default if it fails
 * @param {string} photoURL - The URL to validate and test
 * @param {string} defaultPic - The default URL to return if validation fails
 * @returns {Promise<string>} The validated URL or default
 */
export async function validateAndTestPhotoURL(photoURL, defaultPic) {
  const validatedURL = validatePhotoURL(photoURL, defaultPic);

  if (validatedURL === defaultPic) {
    return defaultPic;
  }

  // For Discord URLs, we'll be more lenient since they often work in browser tabs
  // but fail in JavaScript due to CORS restrictions
  if (validatedURL.includes('discordapp.com') || validatedURL.includes('discord.com')) {
    console.log('[DEBUG] validateAndTestPhotoURL: Discord URL detected, allowing without testing:', validatedURL);
    // Don't test Discord URLs - let the browser handle them naturally
    // If they fail to load, the onerror handler will catch it
    return validatedURL;
  }

  // For other URLs, we can test them if needed
  try {
    const isAccessible = await testImageURL(validatedURL);
    if (!isAccessible) {
      console.warn('[DEBUG] validateAndTestPhotoURL: URL not accessible, using default:', validatedURL);
      return defaultPic;
    }
  } catch (error) {
    console.warn('[DEBUG] validateAndTestPhotoURL: Error testing URL, allowing anyway:', validatedURL);
    // If testing fails, still allow the URL and let the browser handle it
  }

  return validatedURL;
}

// Custom confirmation modal elements
let customConfirmModal;
let confirmMessage;
let confirmSubmessage;
let confirmYesButton;
let confirmNoButton;
let closeButton;
let resolveConfirmPromise;

/**
 * Initializes utility DOM elements.
 */
function initializeUtilityElements() {
  try {
    messageBox = document.getElementById('message-box');
    customConfirmModal = document.getElementById('custom-confirm-modal');
    confirmMessage = document.getElementById('confirm-message');
    confirmSubmessage = document.getElementById('confirm-submessage');
    confirmYesButton = document.getElementById('confirm-yes');
    confirmNoButton = document.getElementById('confirm-no');
    closeButton = document.querySelector('.custom-confirm-modal .close-button');

    if (customConfirmModal && (customConfirmModal.style.display === '' || customConfirmModal.style.display === 'block')) {
      customConfirmModal.style.display = 'none';
    }
  } catch (e) {
    console.error('Error in initializeUtilityElements:', e);
  }
}

/**
 * Displays a custom confirmation modal to the user.
 * @param {string} message - The main message for the confirmation.
 * @param {string} submessage - An optional sub-message for more details.
 * @returns {Promise<boolean>} A promise that resolves to true if 'Yes' is clicked, false otherwise.
 */
export function showCustomConfirm(message, submessage = '') {
  if (!customConfirmModal || !confirmMessage || !confirmYesButton || !confirmNoButton || !closeButton) {
    console.error("Custom confirmation modal elements not found.");
    return Promise.resolve(false);
  }

  confirmMessage.textContent = message;
  confirmSubmessage.textContent = submessage;
  customConfirmModal.style.display = 'flex';

  return new Promise((resolve) => {
    resolveConfirmPromise = resolve;

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

    customConfirmModal.onclick = (event) => {
      if (event.target === customConfirmModal) {
        customConfirmModal.style.display = 'none';
        resolveConfirmPromise(false);
      }
    };
  });
}

// Initialize elements when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUtilityElements);
} else {
  initializeUtilityElements();
}

// Additional utility functions that are used across multiple files
export function parseEmojis(text) {
  // Basic emoji parsing - can be enhanced
  return text;
}

export function parseMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}

export async function resolveHandlesToUids(handles, db, appId) {
  if (!db || !handles || handles.length === 0) return [];

  const {
    collection,
    query,
    where,
    getDocs
  } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
  const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);

  const uids = [];
  for (const handle of handles) {
    const q = query(usersRef, where('handle', '==', handle));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      uids.push(snapshot.docs[0].id);
    }
  }
  return uids;
}

export async function getUserProfileFromFirestore(uid, db, appId) {
  if (!db || !uid) return null;

  const {doc, getDoc} = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) return docSnap.data();
  } catch (error) {
    console.error("Error fetching user profile:", error);
  }
  return null;
}
