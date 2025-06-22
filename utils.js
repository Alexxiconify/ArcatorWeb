// utils.js: Contains common utility functions.

import { db, appId, getCurrentUser, ADMIN_UIDS } from './firebase-init.js';
import { collection, doc, getDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- DOM Elements (imported by forms.js, but referenced here for direct DOM manipulation) ---
const messageBox = document.getElementById('message-box');
const customConfirmModal = document.getElementById('custom-confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmSubmessage = document.getElementById('confirm-submessage');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');

// --- Caches for performance ---
export const userHandleCache = {}; // UID -> handle
export const handleUidCache = {};   // handle -> UID

// --- EMOJI & MENTION CONFIGURATION ---
export const COMMON_EMOJIS = ['👍', '👎', '😂', '❤️', '🔥', '🎉', '💡', '🤔'];
const EMOJI_MAP = {
  ':smile:': '😄', ':laugh:': '😆', ':love:': '❤️', ':thumbsup:': '👍',
  ':thumbsdown:': '👎', ':fire:': '🔥', ':party:': '🎉', ':bulb:': '💡',
  ':thinking:': '🤔', ':star:': '⭐', ':rocket:': '🚀', ':clap:': '👏',
  ':cry:': '😢', ':sleepy:': '😴'
};
const DEFAULT_PROFILE_PIC = 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';


/**
 * Displays a custom message box for user feedback (success or error).
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if it's an error message, false for success.
 */
export function showMessageBox(message, isError) {
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
 * Shows a custom confirmation modal to the user.
 * @param {string} message - The main confirmation question or statement.
 * @param {string} [subMessage=''] - An optional secondary message for more detail.
 * @returns {Promise<boolean>} A Promise that resolves to `true` if the user confirms, `false` if cancelled.
 */
export function showCustomConfirm(message, subMessage = '') {
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
 * Sanitizes a string to be suitable for a user handle.
 * Converts to lowercase and removes any characters not allowed (alphanumeric, underscore, dot, hyphen).
 * @param {string} input - The raw string to sanitize.
 * @returns {string} The sanitized handle string.
 */
export function sanitizeHandle(input) {
  return input.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}

/**
 * Resolves an array of user handles to their corresponding UIDs.
 * Caches results for future use.
 * @param {string[]} handles - An array of user handles (e.g., ['@user1', 'user2']).
 * @returns {Promise<string[]>} A Promise that resolves to an array of user UIDs.
 */
export async function resolveHandlesToUids(handles) {
  const uids = [];
  const handlesToFetch = [];

  for (const handle of handles) {
    const sanitizedHandle = sanitizeHandle(handle.startsWith('@') ? handle.substring(1) : handle);
    if (handleUidCache[sanitizedHandle]) {
      uids.push(handleUidCache[sanitizedHandle]);
    } else {
      handlesToFetch.push(sanitizedHandle);
    }
  }

  if (handlesToFetch.length > 0) {
    const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
    // Firestore 'in' query supports up to 10 items
    const q = query(userProfilesRef, where("handle", "in", handlesToFetch));
    try {
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(docSnap => {
        const profile = docSnap.data();
        const uid = docSnap.id;
        if (profile.handle) {
          userHandleCache[uid] = profile.handle;
          handleUidCache[profile.handle] = uid;
          uids.push(uid);
        }
      });
    } catch (error) {
      console.error("Error resolving handles from Firestore:", error);
      showMessageBox("Error resolving some user handles.", true);
    }
  }
  return uids;
}

/**
 * Fetches user profile data from the 'user_profiles' collection in Firestore.
 * Caches results for future use.
 * @param {string} uid - The User ID (UID) to fetch the profile for.
 * @returns {Promise<Object|null>} A Promise that resolves with the user's profile data, or `null` if not found or an error occurs.
 */
export async function getUserProfileFromFirestore(uid) {
  if (!db) {
    console.error("Firestore DB not initialized for getUserProfileFromFirestore.");
    return null;
  }
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const profile = docSnap.data();
      userHandleCache[uid] = profile.handle;
      if (profile.handle) handleUidCache[profile.handle] = uid;
      return profile;
    }
  } catch (error) {
    console.error("Error fetching user profile from Firestore:", error);
  }
  return null;
}

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
 * Parses a given text for user mentions (e.g., @username) and converts them into clickable links.
 * It looks up the mentioned handles in Firestore (or cache) to get their UIDs for the link.
 * @param {string} text - The input text containing potential user mentions.
 * @returns {Promise<string>} A Promise that resolves with the text, with mentions converted to HTML links.
 */
export async function parseMentions(text) {
  let processedText = text;
  const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
  let match;
  const mentionsToResolve = new Map();

  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionedHandle = match[1];
    if (!mentionsToResolve.has(mentionedHandle)) {
      mentionsToResolve.set(mentionedHandle, null);
    }
  }

  for (const [mentionedHandle, _] of mentionsToResolve) {
    let resolvedUid = handleUidCache[mentionedHandle];

    if (!resolvedUid) {
      const userProfilesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
      const q = query(userProfilesRef, where("handle", "==", mentionedHandle));
      try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          querySnapshot.forEach(docSnap => {
            resolvedUid = docSnap.id;
            userHandleCache[resolvedUid] = mentionedHandle;
            handleUidCache[mentionedHandle] = resolvedUid;
          });
        }
      } catch (error) {
        console.error("Error resolving mentioned handle from Firestore:", error);
      }
    }
    mentionsToResolve.set(mentionedHandle, resolvedUid);
  }

  processedText = text.replace(mentionRegex, (fullMatch, mentionedHandle) => {
    const resolvedUid = mentionsToResolve.get(mentionedHandle);
    if (resolvedUid) {
      return `<a href="settings.html?uid=${resolvedUid}" class="text-blue-400 hover:underline">@${mentionedHandle}</a>`;
    } else {
      return fullMatch;
    }
  });

  return processedText;
}

/**
 * Renders the emoji reaction buttons (and their counts) for a given item (thread or comment).
 * @param {'thread'|'comment'} type - The type of item being reacted to.
 * @param {string} itemId - The ID of the thread or parent thread.
 * @param {Object} reactions - The reactions object from Firestore for this item.
 * @param {HTMLElement} containerElement - The DOM element where the reaction buttons should be appended.
 * @param {string | null} commentId - Optional: The ID of the comment if `type` is 'comment'.
 */
export function renderReactionButtons(type, itemId, reactions, containerElement, commentId = null) {
  containerElement.innerHTML = '';
  const currentUser = getCurrentUser(); // Get current user from firebase-init

  COMMON_EMOJIS.forEach(emoji => {
    const count = reactions[emoji] ? Object.keys(reactions[emoji]).length : 0;
    const hasUserReacted = currentUser && reactions[emoji] && reactions[emoji][currentUser.uid];
    const buttonClass = hasUserReacted ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700';

    const button = document.createElement('button');
    button.className = `reaction-btn px-2 py-1 rounded-full text-sm mr-1 mb-1 transition-colors duration-200 ${buttonClass}`;
    button.innerHTML = `${emoji} <span class="font-bold">${count}</span>`;
    button.addEventListener('click', () => {
      // This relies on the calling module to provide the handleReaction function
      // which will need to be passed down or accessed via a global event bus if strict modularity is enforced.
      // For now, we'll assume the event listener will be attached directly by the calling module (e.g., forum.js)
      // or that handleReaction is exposed globally if simpler.
      // To avoid tight coupling, a better pattern might be:
      // button.dataset.type = type; button.dataset.itemId = itemId; button.dataset.commentId = commentId; button.dataset.emoji = emoji;
      // Then an outer event listener on the parent container (e.g., threadsList) handles clicks.
      // For this refactor, let's keep event attachment here and assume `handleReaction` is provided by the calling module's scope.
      // Or, better, pass it as a parameter:
      // renderReactionButtons(..., handleReactionFunc)
      console.warn("Reaction button click not directly handled in utils.js. Ensure calling module provides handler.");
    });
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
      button.addEventListener('click', () => {
        console.warn("Reaction button click for non-common emoji not directly handled in utils.js. Ensure calling module provides handler.");
      });
      containerElement.appendChild(button);
    }
  }
}
