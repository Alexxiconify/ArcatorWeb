// utils.js: Provides common utility functions like custom message boxes and confirmation modals.

// Import necessary Firebase variables for getUserProfileFromFirestore
// These must be imported from firebase-init.js to ensure they are initialized
import { db, appId, firebaseReadyPromise } from './firebase-init.js';

// Immediately attempt to hide the custom confirm modal as soon as the script loads
const customConfirmModalOnLoad = document.getElementById('custom-confirm-modal');
if (customConfirmModalOnLoad) {
  customConfirmModalOnLoad.style.display = 'none';
  console.log("DEBUG-INIT: custom-confirm-modal forcibly hidden on script load.");
}

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
  const customConfirmModal = document.getElementById('custom-confirm-modal');
  const confirmMessageElement = document.getElementById('confirm-message');
  const confirmSubMessageElement = document.getElementById('confirm-submessage');
  const confirmYesBtn = document.getElementById('confirm-yes');
  const confirmNoBtn = document.getElementById('confirm-no');

  if (!customConfirmModal || !confirmMessageElement || !confirmYesBtn || !confirmNoBtn) {
    console.error("Confirmation modal elements not found.");
    // Fallback to native confirm if elements are missing (for debugging/critical path)
    return Promise.resolve(window.confirm(message + (subMessage ? `\n\n${subMessage}` : '')));
  }

  confirmMessageElement.textContent = message;
  confirmSubMessageElement.textContent = subMessage;
  customConfirmModal.style.display = 'flex'; // Use flex to center content

  return new Promise(resolve => {
    const cleanup = () => {
      confirmYesBtn.removeEventListener('click', onYes);
      confirmNoBtn.removeEventListener('click', onNo);
      customConfirmModal.removeEventListener('click', onClickOutside);
      customConfirmModal.style.display = 'none';
    };

    const onYes = () => {
      resolve(true);
      cleanup();
    };

    const onNo = () => {
      resolve(false);
      cleanup();
    };

    const onClickOutside = (event) => {
      if (event.target === customConfirmModal) {
        resolve(false); // Treat click outside as a cancellation
        cleanup();
      }
    };

    confirmYesBtn.addEventListener('click', onYes);
    confirmNoBtn.addEventListener('click', onNo);
    customConfirmModal.addEventListener('click', onClickOutside); // Close if clicked outside modal content
  });
}

/**
 * Common Emojis for quick access
 * This can be expanded to include more emojis or even custom ones.
 */
export const COMMON_EMOJIS = {
  like: '👍',
  heart: '❤️',
  laugh: '😂',
  sad: '😢',
  fire: '🔥',
};


/**
 * Parses emoji codes (e.g., :like:) and replaces them with actual emojis.
 * @param {string} text - The text to parse.
 * @returns {string} The text with emoji codes replaced.
 */
export function parseEmojis(text) {
  let parsedText = text;
  for (const key in COMMON_EMOJIS) {
    const emojiCode = `:${key}:`;
    const emojiChar = COMMON_EMOJIS[key];
    parsedText = parsedText.split(emojiCode).join(emojiChar);
  }
  return parsedText;
}

/**
 * Parses mentions (e.g., @userhandle) and attempts to resolve them to display names.
 * This function is async because it might fetch user profiles.
 * @param {string} text - The text containing mentions.
 * @returns {Promise<string>} The text with mentions resolved to display names, or original if not found.
 */
export async function parseMentions(text) {
  const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
  let parsedText = text;
  const matches = [...text.matchAll(mentionRegex)];

  // Create a map of handles to UIDs to avoid redundant Firestore calls
  const handleToUidMap = new Map();
  for (const match of matches) {
    const handle = match[1];
    // This is a simplified approach. In a real app, you'd have a way
    // to map handles to UIDs (e.g., a separate collection or a search function).
    // For now, we'll assume the handle might be a display name or part of one.
    // To resolve to UID, we would need a more robust system or assume the handle IS the UID.
    // For this example, we'll just bold the mention for now.
    // A proper implementation would look up the handle in a 'user_profiles' collection
    // and replace with the user's actual display name.
    // e.g., const resolvedUid = await resolveHandleToUid(handle);
    // if (resolvedUid) { const userProfile = await getUserProfileFromFirestore(resolvedUid); }
  }

  // Since direct handle-to-UID resolution is complex without a dedicated index,
  // we'll simply highlight mentions for now. If getUserProfileFromFirestore
  // can efficiently map a handle to a UID, that logic would go here.

  // Re-process text to add styling to mentions
  parsedText = text.replace(mentionRegex, (match, handle) => {
    // For now, just bold the handle. A more advanced feature would link to profile.
    return `<span class="font-semibold text-link">@${handle}</span>`;
  });

  return parsedText;
}


/**
 * Resolves an array of user handles (display names) to their UIDs.
 * This is a placeholder and would require a more robust user search/lookup
 * mechanism in a real-world application (e.g., searching user_profiles by displayName).
 * For this simplified example, it will return an empty array if no exact matches.
 * @param {string[]} handles - An array of user handles/display names.
 * @returns {Promise<string[]>} A promise that resolves to an array of UIDs.
 */
export async function resolveHandlesToUids(handles) {
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized. Cannot resolve handles to UIDs.");
    return [];
  }

  const resolvedUids = [];
  const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);

  for (const handle of handles) {
    // This is an inefficient query for a large number of users.
    // In a real app, consider a search index (like Algolia) or more specific queries
    // if user handles are unique and indexed.
    const q = query(userProfilesRef, where("displayName", "==", handle), limit(1));
    try {
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        resolvedUids.push(querySnapshot.docs[0].id);
      }
    } catch (error) {
      console.error(`Error resolving handle "${handle}" to UID:`, error);
    }
  }
  return resolvedUids;
}


/**
 * Renders reaction buttons for a given item (thread or comment).
 * @param {'thread'|'comment'} type - The type of item ('thread' or 'comment').
 * @param {string} itemId - The ID of the thread or comment.
 * @param {Object} reactions - An object where keys are emojis and values are objects
 * containing UIDs as keys (e.g., { '👍': { 'uid1': true, 'uid2': true } }).
 * @param {HTMLElement} containerElement - The DOM element to render buttons into.
 * @param {Object|null} currentUser - The current authenticated user object, or null.
 * @param {string} [commentId] - Required if type is 'comment'.
 */
export function renderReactionButtons(type, itemId, reactions, containerElement, currentUser, commentId = null) {
  if (!containerElement) {
    console.error("Reaction buttons container not found.");
    return;
  }
  containerElement.innerHTML = ''; // Clear existing buttons

  // Add a plus button to add more reactions (e.g., opens an emoji picker)
  const addReactionBtn = document.createElement('button');
  addReactionBtn.classList.add(
    'bg-input-bg', 'text-text-primary', 'py-1', 'px-2', 'rounded', 'mr-2', 'reaction-btn',
    'hover:bg-input-border', 'transition-colors', 'duration-200'
  );
  addReactionBtn.innerHTML = `<i class="fas fa-plus"></i>`; // Font Awesome plus icon
  addReactionBtn.title = "Add Reaction";
  addReactionBtn.addEventListener('click', () => {
    // Placeholder for emoji picker logic
    // For now, let's just add a default reaction (e.g., '👍') if not present
    const defaultEmoji = '👍';
    // This requires the toggleReaction function to be accessible (passed or imported)
    // For this design, toggleReaction is in forms.js, so we'll simulate adding it here
    // or assume the button will trigger a higher-level function.
    // This part of the design needs refinement if an actual emoji picker isn't implemented.
    showMessageBox("Emoji picker not implemented yet. Click existing reactions to toggle.", false);
  });
  // containerElement.appendChild(addReactionBtn); // Re-add if a working emoji picker is desired

  for (const emoji of Object.values(COMMON_EMOJIS)) {
    const userUids = reactions[emoji] ? Object.keys(reactions[emoji]) : [];
    const count = userUids.length;
    const hasReacted = currentUser ? userUids.includes(currentUser.uid) : false;

    const button = document.createElement('button');
    button.classList.add(
      'py-1', 'px-3', 'rounded-full', 'reaction-btn',
      'flex', 'items-center', 'space-x-1', 'text-sm'
    );

    if (hasReacted) {
      button.classList.add('reacted'); // Apply active styling
    } else {
      // Apply default styling from forms.css for unreacted buttons
      button.classList.add('bg-input-bg', 'text-text-primary');
    }

    button.innerHTML = `<span>${emoji}</span> <span class="font-bold">${count}</span>`;
    button.dataset.emoji = emoji; // Store emoji for handler
    button.dataset.itemId = itemId;
    button.dataset.type = type;
    if (commentId) button.dataset.commentId = commentId;
    containerElement.appendChild(button);
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
    console.error("DEBUG-INIT: custom-confirm-modal element not found.");
  }
});
