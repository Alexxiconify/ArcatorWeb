// utils.js: Provides common utility functions like custom message boxes and confirmation modals.

// Import necessary Firebase variables for getUserProfileFromFirestore
// These must be imported from firebase-init.js to ensure they are initialized
import { db, appId, firebaseReadyPromise } from './firebase-init.js';

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
      // Remove all event listeners to prevent memory leaks and duplicate triggers
      confirmYesBtn.removeEventListener('click', onConfirm);
      confirmNoBtn.removeEventListener('click', onCancel);
      window.removeEventListener('click', closeOnOutsideClick);
      const closeButton = customConfirmModal.querySelector('.close-button');
      if (closeButton && closeButton._onCloseButtonClick) {
        closeButton.removeEventListener('click', closeButton._onCloseButtonClick);
        closeButton._onCloseButtonClick = null;
      }
      resolve(true);
    };

    const onCancel = () => {
      console.log("DEBUG: Custom confirm - Cancel clicked or closed by other means. Hiding modal.");
      customConfirmModal.style.display = 'none';
      // Remove all event listeners
      confirmYesBtn.removeEventListener('click', onConfirm);
      confirmNoBtn.removeEventListener('click', onCancel);
      window.removeEventListener('click', closeOnOutsideClick);
      const closeButton = customConfirmModal.querySelector('.close-button');
      if (closeButton && closeButton._onCloseButtonClick) {
        closeButton.removeEventListener('click', closeButton._onCloseButtonClick);
        closeButton._onCloseButtonClick = null;
      }
      resolve(false);
    };

    // Defensive removal of old listeners before adding new ones
    confirmYesBtn.removeEventListener('click', onConfirm);
    confirmNoBtn.removeEventListener('click', onCancel);
    window.removeEventListener('click', closeOnOutsideClick); // If previously attached

    confirmYesBtn.addEventListener('click', onConfirm);
    confirmNoBtn.addEventListener('click', onCancel);

    // Also close if click outside the modal content, but not on the content itself
    const closeOnOutsideClick = (event) => {
      if (event.target === customConfirmModal) {
        console.log("DEBUG: Custom confirm - Clicked outside modal background. Calling onCancel().");
        onCancel(); // Treat outside click as a cancel
      }
    };
    window.addEventListener('click', closeOnOutsideClick);

    // Add a listener to the close button within the modal
    const closeButton = customConfirmModal.querySelector('.close-button');
    if (closeButton) {
      // Store a reference to the handler to remove it later
      const onCloseButtonClick = () => {
        console.log("DEBUG: Custom confirm - Close button clicked. Calling onCancel().");
        onCancel(); // Treat close button click as a cancel
      };
      // Remove existing listener if present
      if (closeButton._onCloseButtonClick) {
        closeButton.removeEventListener('click', closeButton._onCloseButtonClick);
      }
      closeButton.addEventListener('click', onCloseButtonClick);
      closeButton._onCloseButtonClick = onCloseButtonClick; // Store reference
    }
  });
}

// --- EMOJI & MENTION CONFIGURATION ---
// IMPORTANT: COMMON_EMOJIS must be exported for other modules (like forms.js) to use it.
export const COMMON_EMOJIS = ['👍', '👎', '😂', '❤️', '🔥', '🎉', '💡', '🤔'];
const EMOJI_MAP = {
  ':smile:': '😄', ':laugh:': '😆', ':love:': '❤️', ':thumbsup:': '👍',
  ':thumbsdown:': '👎', ':fire:': '🔥', ':party:': '🎉', ':bulb:': '💡',
  ':thinking:': '🤔', ':star:': '⭐', ':rocket:': '🚀', ':clap:': '👏', // Added clap emoji
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

/**
 * Parses mentions in a given text and formats them as clickable links, resolving handles to display names.
 * This function now correctly uses the imported `db` and `appId` after Firebase is ready.
 * @param {string} text - The input text containing potential mentions (e.g., @username).
 * @returns {Promise<string>} The text with mentions converted to HTML links.
 */
export async function parseMentions(text) {
  await firebaseReadyPromise; // Ensure Firebase is ready before using `db` or `appId`
  if (!db) {
    console.error("Firestore DB not initialized for parseMentions in utils.js.");
    return text;
  }

  // Regex to find @mentions. Example: @username, @user-name, @user_name, @user.name
  const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
  let processedText = text;
  const matches = [...text.matchAll(mentionRegex)];

  for (const match of matches) {
    const fullMatch = match[0]; // e.g., @username
    const handle = match[1];     // e.g., username

    let userDisplayName = handle; // Default to handle if not found
    let userUid = handleUidCache[handle]; // Check cache first

    if (!userUid) {
      // If UID not in cache, try to find user by handle in Firestore
      // Query 'user_profiles' collection to find a document with a matching 'handle' field
      try {
        const userProfilesCol = db.collection(`artifacts/${appId}/public/data/user_profiles`);
        const q = userProfilesCol.where('handle', '==', handle).limit(1);
        const querySnapshot = await q.get();

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          userDisplayName = userData.displayName || handle;
          userUid = userDoc.id; // Store the UID
          userHandleCache[userUid] = handle; // Populate cache
          handleUidCache[handle] = userUid; // Populate cache
          console.log(`DEBUG: Resolved mention @${handle} to display name ${userDisplayName} (UID: ${userUid})`);
        } else {
          console.log(`DEBUG: Mention @${handle} not found in user profiles.`);
        }
      } catch (error) {
        console.error(`ERROR: Error resolving mention @${handle}:`, error);
      }
    } else {
      // If UID found in cache, retrieve display name from cache (or refetch if needed)
      // For simplicity, we'll just use the handle as display name if only UID is cached for now
      // In a real app, you might fetch the full user profile using userUid to get display name
      try {
        const userData = await getUserProfileFromFirestore(userUid); // Use the imported function
        userDisplayName = userData?.displayName || handle;
      } catch (e) {
        console.warn(`Could not fetch display name for cached handle ${handle} (UID: ${userUid}). Using handle as fallback.`);
      }
    }

    // Replace mention with a link. Link to a profile page, or just make it clickable.
    // For now, it's a simple span, but can be a link to a user profile page.
    processedText = processedText.replace(
      fullMatch,
      `<span class="text-blue-400 hover:underline cursor-pointer" data-uid="${userUid || ''}">@${userDisplayName}</span>`
    );
  }
  return processedText;
}


/**
 * Fetches a user's profile data from the 'user_profiles' collection in Firestore.
 * This is a helper function used in other modules.
 * @param {string} uid - The User ID (UID) to fetch the profile for.
 * @returns {Promise<Object|null>} A Promise that resolves with the user's profile data, or `null` if not found or an error occurs.
 */
// This function will now explicitly rely on the imported 'db' and 'appId' from firebase-init.js
// No need to pass dbInstance, appIdValue as arguments
export async function getUserProfileFromFirestore(uid) {
  await firebaseReadyPromise; // Ensure Firebase is ready
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore in utils.js.");
    return null;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
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
 * @param {function} getCurrentUserFunc - Function to get the current authenticated user.
 * @param {string | null} commentId - Optional: The ID of the comment if `type` is 'comment'.
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
