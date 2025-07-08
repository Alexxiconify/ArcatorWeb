// utils.js: Utility functions for the Arcator website
import {
  auth,
  db,
  appId,
  firebaseReadyPromise,
} from "./firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ============================================================================
// UI UTILITIES
// ============================================================================

/**
 * Shows a message box with the given message.
 * @param {string} message - The message to display.
 * @param {boolean} isError - Whether this is an error message.
 * @param {boolean} allowHtml - Whether to allow HTML in the message.
 */
export function showMessageBox(message, isError = false, allowHtml = false) {
  const messageBox = document.getElementById("message-box");
  if (!messageBox) {
    console.warn("Message box element not found");
    return;
  }

  messageBox.textContent = "";
  messageBox.className = `message-box ${isError ? "error" : "success"}`;
  
  if (allowHtml) {
    messageBox.innerHTML = message;
  } else {
    messageBox.textContent = message;
  }

  messageBox.style.display = "block";
  setTimeout(() => {
    messageBox.style.display = "none";
  }, 5000);
}

/**
 * Shows a custom confirmation dialog.
 * @param {string} message - The main message.
 * @param {string} submessage - The submessage.
 * @returns {Promise<boolean>} - Whether the user confirmed.
 */
export function showCustomConfirm(message, submessage = "") {
  return new Promise((resolve) => {
    const modal = document.getElementById("custom-confirm-modal");
    if (!modal) {
      console.warn("Custom confirm modal not found");
      resolve(false);
      return;
    }

    const messageEl = document.getElementById("confirm-message");
    const submessageEl = document.getElementById("confirm-submessage");
    const yesBtn = document.getElementById("confirm-yes");
    const noBtn = document.getElementById("confirm-no");

    if (messageEl) messageEl.textContent = message;
    if (submessageEl) submessageEl.textContent = submessage;

    const handleYes = () => {
      modal.style.display = "none";
      resolve(true);
    };

    const handleNo = () => {
      modal.style.display = "none";
      resolve(false);
    };

    yesBtn.onclick = handleYes;
    noBtn.onclick = handleNo;

    modal.style.display = "flex";
  });
}

/**
 * Escapes HTML special characters.
 * @param {string} text - The text to escape.
 * @returns {string} - The escaped text.
 */
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// USER UTILITIES
// ============================================================================

/**
 * Sanitizes a handle for use in the system.
 * @param {string} input - The input handle.
 * @returns {string} - The sanitized handle.
 */
export function sanitizeHandle(input) {
  return input.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}

/**
 * Validates a photo URL and returns a default if invalid.
 * @param {string} photoURL - The photo URL to validate.
 * @param {string} defaultPic - The default picture URL.
 * @returns {string} - The validated photo URL.
 */
export function validatePhotoURL(photoURL, defaultPic) {
  if (!photoURL || photoURL.trim() === "") {
    return defaultPic;
  }
  return photoURL.trim();
}

/**
 * Tests if an image URL is accessible.
 * @param {string} url - The URL to test.
 * @returns {Promise<boolean>} - Whether the image is accessible.
 */
export async function testImageURL(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    console.warn("Failed to test image URL:", url, error);
    return false;
  }
}

/**
 * Validates and tests a photo URL.
 * @param {string} photoURL - The photo URL to validate.
 * @param {string} defaultPic - The default picture URL.
 * @returns {Promise<string>} - The validated photo URL.
 */
export async function validateAndTestPhotoURL(photoURL, defaultPic) {
  const validatedURL = validatePhotoURL(photoURL, defaultPic);
  if (validatedURL === defaultPic) return validatedURL;
  
  const isAccessible = await testImageURL(validatedURL);
  return isAccessible ? validatedURL : defaultPic;
}

// ============================================================================
// TEXT PROCESSING
// ============================================================================

/**
 * Parses emojis in text.
 * @param {string} text - The text to parse.
 * @returns {string} - The text with emojis parsed.
 */
export function parseEmojis(text) {
  // Basic emoji parsing - can be enhanced
  return text.replace(/:\w+:/g, (match) => {
    // Convert emoji codes to actual emojis
    const emojiMap = {
      ":smile:": "😊",
      ":heart:": "❤️",
      ":thumbsup:": "👍",
      ":fire:": "🔥",
    };
    return emojiMap[match] || match;
  });
}

/**
 * Parses mentions in text.
 * @param {string} text - The text to parse.
 * @returns {string} - The text with mentions parsed.
 */
export function parseMentions(text) {
  return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
}

// ============================================================================
// FIREBASE UTILITIES
// ============================================================================

/**
 * Resolves handles to UIDs.
 * @param {string[]} handles - The handles to resolve.
 * @param {Object} db - The Firestore database instance.
 * @param {string} appId - The app ID.
 * @returns {Promise<Object>} - Mapping of handles to UIDs.
 */
export async function resolveHandlesToUids(handles, db, appId) {
  const handleToUid = {};
  
  try {
    const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
    const querySnapshot = await getDocs(usersRef);
    
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.handle && handles.includes(userData.handle)) {
        handleToUid[userData.handle] = doc.id;
      }
    });
  } catch (error) {
    console.error("Error resolving handles to UIDs:", error);
  }
  
  return handleToUid;
}

/**
 * Gets a user profile from Firestore.
 * @param {string} uid - The user UID.
 * @param {Object} db - The Firestore database instance.
 * @param {string} appId - The app ID.
 * @returns {Promise<Object|null>} - The user profile or null.
 */
export async function getUserProfileFromFirestore(uid, db, appId) {
  try {
    const userDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

// ============================================================================
// MEDIA UTILITIES
// ============================================================================

/**
 * Converts Discord URL to reliable CDN.
 * @param {string} discordURL - The Discord URL.
 * @returns {Promise<string>} - The converted URL.
 */
export async function convertDiscordUrlToReliableCDN(discordURL) {
  if (!discordURL || !discordURL.includes('discord.com')) {
    return discordURL;
  }

  try {
    // Convert Discord CDN URL to a more reliable format
    const url = new URL(discordURL);
    if (url.hostname === 'cdn.discordapp.com' || url.hostname === 'media.discordapp.net') {
      // Add size parameter for better performance
      url.searchParams.set('size', '1024');
      return url.toString();
    }
    return discordURL;
  } catch (error) {
    console.warn("Failed to convert Discord URL:", error);
    return discordURL;
  }
}

/**
 * Uploads image to ImgBB.
 * @param {string} imageURL - The image URL.
 * @param {string} albumId - The album ID.
 * @returns {Promise<string>} - The uploaded image URL.
 */
export async function uploadImageToImgBB(imageURL, albumId = null) {
  // This would require ImgBB API key and implementation
  // For now, return the original URL
  console.warn("ImgBB upload not implemented");
  return imageURL;
}

/**
 * Converts Discord URL to ImgBB album.
 * @param {string} discordURL - The Discord URL.
 * @param {string} albumId - The album ID.
 * @returns {Promise<string>} - The converted URL.
 */
export async function convertDiscordUrlToImgBBAlbum(discordURL, albumId) {
  const convertedURL = await convertDiscordUrlToReliableCDN(discordURL);
  return await uploadImageToImgBB(convertedURL, albumId);
}

/**
 * Gets recommended CDN services.
 * @returns {Array} - List of recommended CDN services.
 */
export function getRecommendedCDNServices() {
  return [
    { name: "ImgBB", url: "https://imgbb.com/" },
    { name: "Cloudinary", url: "https://cloudinary.com/" },
    { name: "Imgur", url: "https://imgur.com/" },
  ];
}

/**
 * Creates an image upload helper.
 * @param {string} targetElementId - The target element ID.
 * @returns {Object} - The upload helper object.
 */
export function createImageUploadHelper(targetElementId) {
  return {
    targetElement: document.getElementById(targetElementId),
    
    showUploadDialog() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          this.handleFileUpload(file);
        }
      };
      input.click();
    },
    
    async handleFileUpload(file) {
      // Implementation would depend on your upload service
      console.log("File upload not implemented:", file.name);
    },
    
    setImageUrl(url) {
      if (this.targetElement) {
        this.targetElement.value = url;
        this.targetElement.dispatchEvent(new Event('change'));
      }
    }
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes utility elements.
 */
function initializeUtilityElements() {
  // Create message box if it doesn't exist
  if (!document.getElementById("message-box")) {
    const messageBox = document.createElement("div");
    messageBox.id = "message-box";
    messageBox.className = "message-box";
    messageBox.style.display = "none";
    document.body.appendChild(messageBox);
  }

  // Create custom confirm modal if it doesn't exist
  if (!document.getElementById("custom-confirm-modal")) {
    const modal = document.createElement("div");
    modal.id = "custom-confirm-modal";
    modal.className = "custom-confirm-modal";
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close-button">&times;</span>
        <p class="mb-4 text-lg" id="confirm-message"></p>
        <p class="mb-6 text-sm text-text-secondary" id="confirm-submessage"></p>
        <button id="confirm-yes" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full mr-4">
          Yes
        </button>
        <button id="confirm-no" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full">
          Cancel
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

// Initialize utilities when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUtilityElements);
} else {
  initializeUtilityElements();
}

// ============================================================================
// MEDIA RENDERING
// ============================================================================

/**
 * Renders media content in text.
 * @param {string} text - The text containing media.
 * @returns {string} - The rendered HTML.
 */
export function renderMediaContent(text) {
  if (!text) return '';
  
  // YouTube video embedding
  const youtubeRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+))/g;
  text = text.replace(youtubeRegex, (match, url, videoId) => {
    return `<div class="youtube-embed"><iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
  });
  
  // Image embedding
  const imageRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;
  text = text.replace(imageRegex, (match, url) => {
    return `<img src="${url}" alt="Embedded image" class="embedded-image" style="max-width: 100%; height: auto;">`;
  });
  
  return text;
}

/**
 * Validates media URL.
 * @param {string} url - The URL to validate.
 * @returns {boolean} - Whether the URL is valid.
 */
export function validateMediaUrl(url) {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const validProtocols = ['http:', 'https:'];
    const validDomains = ['youtube.com', 'youtu.be', 'imgur.com', 'imgbb.com', 'cloudinary.com'];
    
    return validProtocols.includes(urlObj.protocol) && 
           (validDomains.some(domain => urlObj.hostname.includes(domain)) ||
            url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i));
  } catch {
    return false;
  }
}

/**
 * Creates media preview.
 * @param {string} url - The media URL.
 * @param {string} type - The media type.
 * @returns {string} - The preview HTML.
 */
export function createMediaPreview(url, type) {
  if (type === 'youtube') {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/)?.[1];
    if (videoId) {
      return `<iframe width="320" height="180" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
    }
  } else if (type === 'image') {
    return `<img src="${url}" alt="Preview" style="max-width: 320px; max-height: 180px; object-fit: cover;">`;
  }
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
}

/**
 * Renders markdown with media support.
 * @param {string} content - The markdown content.
 * @param {HTMLElement} targetElement - The target element.
 */
export function renderMarkdownWithMedia(content, targetElement) {
  if (!targetElement) return;
  
  // Basic markdown to HTML conversion
  let html = content
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/`(.*)`/gim, '<code>$1</code>')
    .replace(/\n/gim, '<br>');
  
  // Add media rendering
  html = renderMediaContent(html);
  
  targetElement.innerHTML = html;
}

// ============================================================================
// TAB UTILITIES
// ============================================================================

/**
 * Sets up tab functionality.
 * @param {string} tabButtonSelector - The tab button selector.
 * @param {string} tabContentSelector - The tab content selector.
 */
export function setupTabs(tabButtonSelector = '.tab-button', tabContentSelector = '.tab-content') {
  const tabButtons = document.querySelectorAll(tabButtonSelector);
  const tabContents = document.querySelectorAll(tabContentSelector);

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      const targetContent = document.querySelector(`${tabContentSelector}[data-tab="${targetTab}"]`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}
