// utils.js: Combined utility functions
import { auth, db, appId } from "./firebase-init.js";
import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Message box functionality
export function showMessageBox(message, isError = false, allowHtml = false) {
  const messageBox = document.getElementById("message-box");
  if (!messageBox) return;

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
  if (!photoURL || photoURL.trim() === "") return defaultPic;
  if (photoURL === defaultPic) return defaultPic;

  try {
    const url = new URL(photoURL);
    if (!["http:", "https:"].includes(url.protocol)) return defaultPic;
    return photoURL;
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
      const usersRef = collection(
        db,
        `artifacts/${appId}/public/data/user_profiles`,
      );
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
    const userDoc = await getDoc(
      doc(db, `artifacts/${appId}/public/data/user_profiles`, uid),
    );
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
    // Load sensitive configuration
    const config = await import('./sensitive/api-keys.js');
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
      return {
        success: false,
        error: result.error?.message || "Upload failed",
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Convert Discord URL to ImgBB album
export async function convertDiscordUrlToImgBBAlbum(discordURL, albumId) {
  if (!discordURL || !discordURL.includes("discord.com")) return discordURL;

  const result = await uploadImageToImgBB(discordURL, albumId);
  return result.success ? result.url : discordURL;
}

// Get recommended CDN services
export function getRecommendedCDNServices() {
  return [
    { name: "ImgBB", url: "https://imgbb.com/", free: true },
    { name: "Cloudinary", url: "https://cloudinary.com/", free: true },
    { name: "Imgur", url: "https://imgur.com/", free: true },
    { name: "GitHub", url: "https://github.com/", free: true },
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

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        targetElement.value = result.url;
        showMessageBox("Image uploaded successfully!", false);
      } else {
        showMessageBox("Upload failed: " + result.error, true);
      }
    } catch (error) {
      showMessageBox("Upload error: " + error.message, true);
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
  if (!text) return "";

  // Convert markdown to HTML first
  let html = text;

  // Handle image markdown: ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="media-content" loading="lazy" onerror="this.style.display='none'">`;
  });

  // Handle video markdown: ![Video](url)
  html = html.replace(/!\[Video\]\(([^)]+)\)/g, (match, url) => {
    const extension = url.split(".").pop()?.toLowerCase();
    const videoTypes = {
      mp4: "video/mp4",
      webm: "video/webm",
      ogg: "video/ogg",
    };

    if (videoTypes[extension]) {
      return `<video controls class="media-content"><source src="${escapeHtml(url)}" type="${videoTypes[extension]}">Your browser does not support the video tag.</video>`;
    }
    return match; // Return original if not a valid video format
  });

  // Handle audio markdown: ![Audio](url)
  html = html.replace(/!\[Audio\]\(([^)]+)\)/g, (match, url) => {
    const extension = url.split(".").pop()?.toLowerCase();
    const audioTypes = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      aac: "audio/aac",
    };

    if (audioTypes[extension]) {
      return `<audio controls class="media-content"><source src="${escapeHtml(url)}" type="${audioTypes[extension]}">Your browser does not support the audio tag.</audio>`;
    }
    return match; // Return original if not a valid audio format
  });

  // Handle YouTube markdown: ![YouTube Video](url)
  html = html.replace(/!\[YouTube Video\]\(([^)]+)\)/g, (match, url) => {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      return `<div class="youtube-embed media-content"><iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe></div>`;
    }
    return match; // Return original if not a valid YouTube URL
  });

  return html;
}

/**
 * Extracts video ID from YouTube URL.
 * @param {string} url - The YouTube URL.
 * @returns {string|null} The video ID or null if invalid.
 */
function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Validates and sanitizes media URLs.
 * @param {string} url - The URL to validate.
 * @returns {boolean} True if the URL is valid and safe.
 */
export function validateMediaUrl(url) {
  try {
    const urlObj = new URL(url);

    // Check protocol
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return false;
    }

    // Check for valid media extensions
    const extension = urlObj.pathname.split(".").pop()?.toLowerCase();
    const validExtensions = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "mp4",
      "webm",
      "ogg",
      "mp3",
      "wav",
      "aac",
    ];

    return validExtensions.includes(extension);
  } catch {
    return false;
  }
}

/**
 * Creates a media preview element.
 * @param {string} url - The media URL.
 * @param {string} type - The media type ('image', 'video', 'audio').
 * @returns {HTMLElement} The preview element.
 */
export function createMediaPreview(url, type) {
  const container = document.createElement("div");
  container.className = "media-preview-container";

  switch (type) {
    case "image":
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Preview";
      img.className = "media-preview";
      img.loading = "lazy";
      img.onerror = () => (img.style.display = "none");
      container.appendChild(img);
      break;

    case "video":
      const video = document.createElement("video");
      video.controls = true;
      video.className = "media-preview";
      const source = document.createElement("source");
      source.src = url;
      source.type = `video/${url.split(".").pop()}`;
      video.appendChild(source);
      video.appendChild(
        document.createTextNode("Your browser does not support the video tag."),
      );
      container.appendChild(video);
      break;

    case "audio":
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.className = "media-preview";
      const audioSource = document.createElement("source");
      audioSource.src = url;
      audioSource.type = `audio/${url.split(".").pop()}`;
      audio.appendChild(audioSource);
      audio.appendChild(
        document.createTextNode("Your browser does not support the audio tag."),
      );
      container.appendChild(audio);
      break;
  }

  return container;
}

/**
 * Processes markdown content and renders media elements.
 * @param {string} content - The markdown content.
 * @param {HTMLElement} targetElement - The element to render into.
 */
export function renderMarkdownWithMedia(content, targetElement) {
  if (!content || !targetElement) return;

  // First, process media content
  let processedContent = renderMediaContent(content);

  // Then convert markdown to HTML
  if (typeof marked !== "undefined") {
    try {
      marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: false,
      });

      processedContent = marked.parse(processedContent);

      // Sanitize the HTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = processedContent;

      // Remove dangerous elements but keep media elements
      const dangerousElements = tempDiv.querySelectorAll(
        'script, iframe:not([src*="youtube.com"]), object, embed, form, input, button, select, textarea',
      );
      dangerousElements.forEach((el) => el.remove());

      // Remove dangerous attributes
      const allElements = tempDiv.querySelectorAll("*");
      allElements.forEach((el) => {
        const attrs = el.attributes;
        for (let i = attrs.length - 1; i >= 0; i--) {
          const attr = attrs[i];
          if (
            attr.name.startsWith("on") ||
            attr.name.startsWith("javascript:")
          ) {
            el.removeAttribute(attr.name);
          }
        }
      });

      targetElement.innerHTML = tempDiv.innerHTML;
    } catch (error) {
      console.error("Error rendering markdown:", error);
      targetElement.innerHTML = escapeHtml(processedContent);
    }
  } else {
    // Fallback if marked is not available
    targetElement.innerHTML = escapeHtml(processedContent);
  }
}

export function setupTabs(tabButtonSelector = '.tab-button', tabContentSelector = '.tab-content') {
  document.querySelectorAll(tabButtonSelector).forEach(button => {
    button.addEventListener('click', function(event) {
      document.querySelectorAll(tabButtonSelector).forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll(tabContentSelector).forEach(tab => tab.classList.remove('active'));
      this.classList.add('active');
      const tabName = this.getAttribute('data-tab') || this.textContent.trim().toLowerCase();
      const tab = document.getElementById(tabName + '-tab');
      if (tab) tab.classList.add('active');
    });
  });
}
