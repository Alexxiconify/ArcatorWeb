// utils.js: Provides common utility functions like custom message boxes and confirmation modals.

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
  messageBox.textContent = message;
  messageBox.className = 'message-box'; // Reset classes
  if (isError) {
    messageBox.classList.add('error');
  } else {
    messageBox.classList.add('success');
  }
  messageBox.style.display = 'block';
  // Hide the message box after 5 seconds
  setTimeout(() => {
    messageBox.style.display = 'none';
  }, 5000);
}

/**
 * Shows a custom confirmation modal.
 * @param {string} message - The main confirmation message.
 * @param {string} [subMessage=''] - An optional sub-message for more details.
 * @returns {Promise<boolean>} Resolves to true if confirmed (Yes), false if cancelled (No).
 */
export function showCustomConfirm(message, subMessage = '') {
  console.log("DEBUG: showCustomConfirm called with message:", message);
  return new Promise(resolve => {
    const customConfirmModal = document.getElementById('custom-confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmSubmessage = document.getElementById('confirm-submessage');
    const confirmYesBtn = document.getElementById('confirm-yes');
    const confirmNoBtn = document.getElementById('confirm-no');

    if (!customConfirmModal || !confirmMessage || !confirmYesBtn || !confirmNoBtn) {
      console.error("ERROR: Custom confirmation modal elements not found.");
      // Fallback to true if essential elements are missing, to avoid blocking flow indefinitely
      resolve(true);
      return;
    }

    confirmMessage.textContent = message;
    confirmSubmessage.textContent = subMessage;
    customConfirmModal.style.display = 'flex'; // Use flex to center
    console.log("DEBUG: Custom confirm modal display set to flex.");

    // Event listeners for Yes/No buttons
    const onConfirm = () => {
      console.log("DEBUG: Custom confirm - Yes clicked. Hiding modal.");
      customConfirmModal.style.display = 'none';
      confirmYesBtn.removeEventListener('click', onConfirm);
      confirmNoBtn.removeEventListener('click', onCancel);
      window.removeEventListener('click', closeOnOutsideClick); // Ensure all listeners are removed
      resolve(true);
    };

    const onCancel = () => {
      console.log("DEBUG: Custom confirm - Cancel clicked or closed by other means. Hiding modal.");
      customConfirmModal.style.display = 'none';
      confirmYesBtn.removeEventListener('click', onConfirm);
      confirmNoBtn.removeEventListener('click', onCancel);
      window.removeEventListener('click', closeOnOutsideClick); // Ensure all listeners are removed
      resolve(false);
    };

    // Remove any previous listeners to prevent duplicates
    confirmYesBtn.removeEventListener('click', onConfirm); // Defensive removal
    confirmNoBtn.removeEventListener('click', onCancel);   // Defensive removal
    window.removeEventListener('click', closeOnOutsideClick); // Defensive removal

    confirmYesBtn.addEventListener('click', onConfirm);
    confirmNoBtn.addEventListener('click', onCancel);

    // Also close if click outside the modal content, but not on the content itself
    const closeOnOutsideClick = (event) => {
      // Check if the click was on the modal background itself, not a child element
      if (event.target === customConfirmModal) {
        console.log("DEBUG: Custom confirm - Clicked outside modal background. Calling onCancel().");
        onCancel(); // Treat outside click as a cancel
      }
    };
    window.addEventListener('click', closeOnOutsideClick);

    // Add a listener to the close button within the modal
    const closeButton = customConfirmModal.querySelector('.close-button');
    if (closeButton) {
      // Defensive removal before adding to prevent duplicates
      const existingOnCloseButtonClick = closeButton._onCloseButtonClick; // Store reference if exists
      if (existingOnCloseButtonClick) {
        closeButton.removeEventListener('click', existingOnCloseButtonClick);
      }

      const onCloseButtonClick = () => {
        console.log("DEBUG: Custom confirm - Close button clicked. Calling onCancel().");
        onCancel(); // Treat close button click as a cancel
        closeButton.removeEventListener('click', onCloseButtonClick);
        closeButton._onCloseButtonClick = null; // Clear reference
      };
      closeButton.addEventListener('click', onCloseButtonClick);
      closeButton._onCloseButtonClick = onCloseButtonClick; // Store reference for removal
    }
  });
}

// --- EMOJI & MENTION CONFIGURATION ---
// IMPORTANT: COMMON_EMOJIS must be exported for other modules (like forms.js) to use it.
export const COMMON_EMOJIS = ['👍', '👎', '😂', '❤️', '🔥', '🎉', '💡', '🤔'];
const EMOJI_MAP = {
  ':smile:': '😄', ':laugh:': '😆', ':love:': '❤️', ':thumbsup:': '👍',
  ':thumbsdown:': '👎', ':fire:': '🔥', ':party:': '🎉', ':bulb:': '💡',
  ':thinking:': '🤔', ':star:': '⭐', ':rocket:': '🚀', ':clap:': '�',
  ':cry:': '😢', ':sleepy:': '😴'
};
// These caches are now correctly exported for use in modules like forms.js
export const userHandleCache = {}; // UID -> handle
export const handleUidCache = {};   // handle -> UID

/**
 * Replaces emoji shortcodes (e.g., :smile:) in a given text with their corresponding emoji characters.
 * @param {string} text - The input text containing potential emoji shortcodes.
 * @returns {string} The text with shortcodes replaced by emojis.
 */
export function parseEmojis(text) {
  let processedText = text;
  for (const shortcode in EMOJI_MAP) {
    const emoji = EMOJI_MAP[shortcode];
    processedText = processedText.split(shortcode).join(emoji);
  }
  return processedText;
}

// Placeholder for parseMentions, which typically relies on Firebase
// and user data. This should be in forms.js or a dedicated data-fetching module.
// Keeping a stub here for now to avoid breaking imports, but full implementation
// relies on Firebase.
export async function parseMentions(text) {
  // This function typically needs access to `db` and `appId` to resolve handles.
  // The full implementation is in forms.js, which imports this stub.
  // So, this effectively becomes a pass-through if forms.js handles the actual parsing.
  return text; // Return original text if not fully implemented here
}


/**
 * Fetches user profile data from Firestore.
 * This is a helper function used in other modules.
 * @param {string} uid - The User ID (UID) to fetch the profile for.
 * @returns {Promise<Object|null>} A Promise that resolves with the user's profile data, or `null` if not found or an error occurs.
 */
// This function relies on `db` and `appId` which are passed via firebase-init.js or imported directly.
// For `utils.js` to be truly independent of Firebase, `db` and `appId` would need to be passed as arguments
// if `getUserProfileFromFirestore` were a top-level function here.
// However, it's currently imported by modules that already have `db` and `appId` (like forms.js).
// So, we will keep it simple here and assume `db` and `appId` are available in the calling context where this is used.
export async function getUserProfileFromFirestore(dbInstance, appIdValue, uid) {
  if (!dbInstance) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore in utils.js.");
    return null;
  }
  const userDocRef = dbInstance.collection(`artifacts/${appIdValue}/public/data/user_profiles`).doc(uid);
  try {
    const docSnap = await userDocRef.get();
    if (docSnap.exists) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("Error fetching user profile from Firestore in utils.js:", error);
  }
  return null;
}


/**
 * Renders the emoji reaction buttons (and their counts) for a given item (thread or comment).
 * This function expects to be called with necessary data and a handler for clicks.
 * @param {'thread'|'comment'} type - The type of item being reacted to.
 * @param {string} itemId - The ID of the thread or parent thread.
 * @param {Object} reactions - The reactions object from Firestore for this item.
 * @param {HTMLElement} containerElement - The DOM element where the reaction buttons should be appended.
 * @param {string | null} commentId - Optional: The ID of the comment if `type` is 'comment'.
 * @param {function} getCurrentUserFunc - Function to get the current authenticated user.
 */
export function renderReactionButtons(type, itemId, reactions, containerElement, getCurrentUserFunc, commentId = null) {
  containerElement.innerHTML = '';
  const currentUser = getCurrentUserFunc(); // Get current user using the passed function

  COMMON_EMOJIS.forEach(emoji => {
    const count = reactions[emoji] ? Object.keys(reactions[emoji]).length : 0;
    const hasUserReacted = currentUser && reactions[emoji] && reactions[emoji][currentUser.uid];
    const buttonClass = hasUserReacted ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700';

    const button = document.createElement('button');
    button.className = `reaction-btn px-2 py-1 rounded-full text-sm mr-1 mb-1 transition-colors duration-200 ${buttonClass}`;
    button.innerHTML = `${emoji} <span class="font-bold">${count}</span>`;
    // The event listener is attached by the calling module (forms.js)
    // to avoid coupling utils.js directly to the toggleReaction function.
    button.dataset.emoji = emoji; // Store emoji for handler
    button.dataset.itemId = itemId;
    button.dataset.type = type;
    if (commentId) button.dataset.commentId = commentId;

    containerElement.appendChild(button);
  });

  // Render any other emojis that might exist but aren't in COMMON_EMOJIS
  for (const emoji in reactions) {
    if (!COMMON_EMOJIS.includes(emoji)) {
      const count = Object.keys(reactions[emoji]).length;
      const hasUserReacted = currentUser && reactions[emoji] && reactions[emoji][currentUser.uid];
      const buttonClass = hasUserReacted ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700';

      const button = document.createElement('button');
      button.className = `reaction-btn px-2 py-1 rounded-full text-sm mr-1 mb-1 transition-colors duration-200 ${buttonClass}`;
      button.innerHTML = `${emoji} <span class="font-bold">${count}</span>`;
      button.dataset.emoji = emoji; // Store emoji for handler
      button.dataset.itemId = itemId;
      button.dataset.type = type;
      if (commentId) button.dataset.commentId = commentId;
      containerElement.appendChild(button);
    }
  }
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


// --- DEBUGGING INITIAL MODAL STATE ---
document.addEventListener('DOMContentLoaded', () => {
  const customConfirmModal = document.getElementById('custom-confirm-modal');
  if (customConfirmModal) {
    console.log("DEBUG-INIT: custom-confirm-modal element found.");
    const currentDisplay = window.getComputedStyle(customConfirmModal).display;
    if (currentDisplay !== 'none') {
      console.log(`DEBUG-INIT: custom-confirm-modal is VISIBLE by default! Current display: ${currentDisplay}. Forcibly hiding it.`);
      // Attempt to hide it forcefully if it's visible by default
      customConfirmModal.style.display = 'none';
    } else {
      console.log("DEBUG-INIT: custom-confirm-modal is correctly hidden by default.");
    }
  } else {
    console.error("DEBUG-INIT: custom-confirm-modal element NOT found in DOM.");
  }
});
