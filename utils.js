// utils.js - Utility functions
import { auth, db, appId } from "./firebase-init.js";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Message box functionality
export function showMessageBox(message, isError = false, allowHtml = false) {
  const messageBox = document.getElementById("message-box");
  if (!messageBox) return;

  messageBox.className = `message-box ${isError ? "error" : "success"}`;
  messageBox[allowHtml ? 'innerHTML' : 'textContent'] = message;
  messageBox.style.display = "block";
  
  setTimeout(() => {
    messageBox.style.display = "none";
  }, 5000);
}

// Custom confirmation dialog
export function showCustomConfirm(message, submessage = "") {
  return new Promise((resolve) => {
    const modal = document.getElementById("custom-confirm-modal");
    const messageEl = document.getElementById("confirm-message");
    const submessageEl = document.getElementById("confirm-submessage");
    const yesBtn = document.getElementById("confirm-yes");
    const noBtn = document.getElementById("confirm-no");

    if (!modal || !messageEl || !yesBtn || !noBtn) {
      resolve(false);
      return;
    }

    messageEl.textContent = message;
    if (submessageEl) submessageEl.textContent = submessage;

    const handleYes = () => {
      modal.style.display = "none";
      yesBtn.removeEventListener("click", handleYes);
      noBtn.removeEventListener("click", handleNo);
      resolve(true);
    };

    const handleNo = () => {
      modal.style.display = "none";
      yesBtn.removeEventListener("click", handleYes);
      noBtn.removeEventListener("click", handleNo);
      resolve(false);
    };

    yesBtn.addEventListener("click", handleYes);
    noBtn.addEventListener("click", handleNo);
    modal.style.display = "flex";
  });
}

// HTML escaping
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Handle sanitization
export function sanitizeHandle(input) {
  return input.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
}

// Photo URL validation
export function validatePhotoURL(photoURL, defaultPic) {
  if (!photoURL || photoURL.trim() === "" || photoURL === defaultPic) return defaultPic;

  try {
    const url = new URL(photoURL);
    return ["http:", "https:"].includes(url.protocol) ? photoURL : defaultPic;
  } catch {
    return defaultPic;
  }
}

// Test image URL
export async function testImageURL(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

// Validate and test photo URL
export async function validateAndTestPhotoURL(photoURL, defaultPic) {
  const validatedURL = validatePhotoURL(photoURL, defaultPic);
  if (validatedURL === defaultPic) return { valid: true, url: defaultPic };

  const isValid = await testImageURL(validatedURL);
  return { valid: isValid, url: isValid ? validatedURL : defaultPic };
}

// Parse emojis in text
export function parseEmojis(text) {
  return text.replace(/:\w+:/g, (match) => {
    const emoji = emojiMap[match];
    return emoji || match;
  });
}

// Parse mentions in text
export function parseMentions(text) {
  return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
}

// Resolve handles to UIDs
export async function resolveHandlesToUids(handles, db, appId) {
  const uids = [];
  for (const handle of handles) {
    try {
      const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
      const q = query(usersRef, where("handle", "==", handle));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        uids.push(snapshot.docs[0].id);
      }
    } catch (error) {
      console.error(`Error resolving handle ${handle}:`, error);
    }
  }
  return uids;
}

// Get user profile from Firestore
export async function getUserProfileFromFirestore(uid, db, appId) {
  try {
    const userDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

// Convert Discord URL to reliable CDN
export async function convertDiscordUrlToReliableCDN(discordURL) {
  if (!discordURL || !discordURL.includes("discord.com")) return discordURL;

  try {
    const url = new URL(discordURL);
    if (url.hostname === "cdn.discordapp.com") return discordURL;

    const response = await fetch(discordURL, { method: "HEAD" });
    if (response.ok) {
      const finalURL = response.url;
      if (finalURL.includes("cdn.discordapp.com")) return finalURL;
    }
  } catch (error) {
    console.error("Error converting Discord URL:", error);
  }

  return discordURL;
}

// Upload image to ImgBB
export async function uploadImageToImgBB(imageURL, albumId = null) {
  try {
    const config = await import('./sensitive/config.js');
    const apiKey = config.default.IMGBB_API_KEY;
    
    if (!apiKey || apiKey === "YOUR_IMGBB_API_KEY") {
      console.warn("ImgBB API key not configured");
      return { success: false, error: "API key not configured" };
    }

    const formData = new FormData();
    formData.append("image", imageURL);
    formData.append("key", apiKey);
    if (albumId) formData.append("album", albumId);

    const response = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (result.success) {
      return { success: true, url: result.data.url };
    } else {
      return { success: false, error: result.error?.message || "Upload failed" };
    }
  } catch (error) {
    console.error("Error uploading to ImgBB:", error);
    return { success: false, error: error.message };
  }
}

// Convert Discord URL to ImgBB album
export async function convertDiscordUrlToImgBBAlbum(discordURL, albumId) {
  const uploadResult = await uploadImageToImgBB(discordURL, albumId);
  return uploadResult.success ? uploadResult.url : discordURL;
}

// Get recommended CDN services
export function getRecommendedCDNServices() {
  return [
    { name: "ImgBB", url: "https://imgbb.com/", description: "Free image hosting" },
    { name: "Cloudinary", url: "https://cloudinary.com/", description: "Professional image management" },
    { name: "Imgur", url: "https://imgur.com/", description: "Popular image sharing" },
  ];
}

// Create image upload helper
export function createImageUploadHelper(targetElementId) {
  const targetElement = document.getElementById(targetElementId);
  if (!targetElement) return null;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";

  input.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("image", file);

      const config = await import('./sensitive/config.js');
      const apiKey = config.default.IMGBB_API_KEY;
      
      if (!apiKey || apiKey === "YOUR_IMGBB_API_KEY") {
        showMessageBox("Image upload not configured", true);
        return;
      }

      formData.append("key", apiKey);

      const response = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        targetElement.value = result.data.url;
        showMessageBox("Image uploaded successfully!");
      } else {
        showMessageBox("Upload failed: " + (result.error?.message || "Unknown error"), true);
      }
    } catch (error) {
      console.error("Upload error:", error);
      showMessageBox("Upload failed: " + error.message, true);
    }
  });

  document.body.appendChild(input);
  return input;
}

// Initialize utility elements
function initializeUtilityElements() {
  const messageBox = document.getElementById("message-box");
  if (!messageBox) {
    const box = document.createElement("div");
    box.id = "message-box";
    box.className = "message-box";
    box.style.display = "none";
    document.body.appendChild(box);
  }

  const confirmModal = document.getElementById("custom-confirm-modal");
  if (!confirmModal) {
    const modal = document.createElement("div");
    modal.id = "custom-confirm-modal";
    modal.className = "custom-confirm-modal";
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close-button">&times;</span>
        <p class="mb-4 text-lg" id="confirm-message"></p>
        <p class="mb-6 text-sm text-text-secondary" id="confirm-submessage"></p>
        <button id="confirm-yes" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full mr-4">Yes</button>
        <button id="confirm-no" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full">Cancel</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", initializeUtilityElements);

// Emoji mapping
const emojiMap = {
  ":smile:": "😊",
  ":heart:": "❤️",
  ":thumbsup:": "👍",
  ":fire:": "🔥",
  ":rocket:": "🚀",
  ":star:": "⭐",
  ":check:": "✅",
  ":x:": "❌",
  ":warning:": "⚠️",
  ":info:": "ℹ️",
};

/**
 * Renders media content from markdown text with proper sanitization and display.
 * @param {string} text - The text containing media markdown.
 * @returns {string} The rendered HTML with media elements.
 */
export function renderMediaContent(text) {
  if (!text) return text;

  return text
    .replace(/(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/gi, '<img src="$1" alt="Image" class="max-w-full h-auto rounded" loading="lazy">')
    .replace(/(https?:\/\/[^\s]+\.(mp4|webm|ogg))/gi, '<video src="$1" controls class="max-w-full h-auto rounded" preload="metadata"></video>')
    .replace(/(https?:\/\/[^\s]+\.(mp3|wav|ogg))/gi, '<audio src="$1" controls class="w-full" preload="metadata"></audio>')
    .replace(/(https?:\/\/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+))/gi, '<iframe src="https://www.youtube.com/embed/$2" frameborder="0" allowfullscreen class="w-full h-64 rounded"></iframe>')
    .replace(/(https?:\/\/youtu\.be\/([a-zA-Z0-9_-]+))/gi, '<iframe src="https://www.youtube.com/embed/$2" frameborder="0" allowfullscreen class="w-full h-64 rounded"></iframe>');
}

/**
 * Extracts video ID from YouTube URL.
 * @param {string} url - The YouTube URL.
 * @returns {string|null} The video ID or null if invalid.
 */
function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Validates and sanitizes media URLs.
 * @param {string} url - The URL to validate.
 * @returns {boolean} True if the URL is valid and safe.
 */
export function validateMediaUrl(url) {
  if (!url) return { valid: false, type: null };

  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
  const videoExtensions = /\.(mp4|webm|ogg|mov|avi)$/i;
  const audioExtensions = /\.(mp3|wav|ogg|flac)$/i;
  const youtubePattern = /(youtube\.com|youtu\.be)/i;

  if (youtubePattern.test(url)) {
    return { valid: true, type: 'youtube' };
  } else if (imageExtensions.test(url)) {
    return { valid: true, type: 'image' };
  } else if (videoExtensions.test(url)) {
    return { valid: true, type: 'video' };
  } else if (audioExtensions.test(url)) {
    return { valid: true, type: 'audio' };
  }

  return { valid: false, type: null };
}

/**
 * Creates a media preview element.
 * @param {string} url - The media URL.
 * @param {string} type - The media type ('image', 'video', 'audio').
 * @returns {HTMLElement} The preview element.
 */
export function createMediaPreview(url, type) {
  switch (type) {
    case 'image':
      return `<img src="${url}" alt="Preview" class="max-w-full h-auto rounded" loading="lazy">`;
    case 'video':
      return `<video src="${url}" controls class="max-w-full h-auto rounded" preload="metadata"></video>`;
    case 'audio':
      return `<audio src="${url}" controls class="w-full" preload="metadata"></audio>`;
    case 'youtube':
      const videoId = extractYouTubeVideoId(url);
      return videoId ? `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen class="w-full h-64 rounded"></iframe>` : '';
    default:
      return '';
  }
}

/**
 * Processes markdown content and renders media elements.
 * @param {string} content - The markdown content.
 * @param {HTMLElement} targetElement - The element to render into.
 */
export function renderMarkdownWithMedia(content, targetElement) {
  if (!content || !targetElement) return;

  let processedContent = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');

  processedContent = renderMediaContent(processedContent);
  targetElement.innerHTML = processedContent;
}

export function setupTabs(tabButtonSelector = '.tab-button', tabContentSelector = '.tab-content') {
  const tabButtons = document.querySelectorAll(tabButtonSelector);
  const tabContents = document.querySelectorAll(tabContentSelector);

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-tab') || button.textContent.toLowerCase();
      
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const targetContent = document.querySelector(`${tabContentSelector}[data-tab="${targetId}"]`) ||
                           document.getElementById(`${targetId}-tab`);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}
