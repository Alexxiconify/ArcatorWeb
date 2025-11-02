// utils.js: Utility functions for the Arcator website
import {collection, getDocs} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// UI UTILITIES
export function showMessageBox(message, isError = false, allowHtml = false) {
  const messageBox = document.getElementById("message-box");
  if (!messageBox) {
    console.warn("Message box element not found");
    return;
  }
  messageBox.textContent = "";
  messageBox.className = `message-box ${isError ? "error" : "success"}`;
    if (allowHtml) messageBox.innerHTML = message;
    else messageBox.textContent = message;
  messageBox.style.display = "block";
    setTimeout(() => {
        messageBox.style.display = "none";
    }, 5000);
}
export function showCustomConfirm(message, submessage = "") {
  return new Promise((resolve) => {
    const modal = document.getElementById("custom-confirm-modal");
    if (!modal) {
      console.warn("Custom confirm modal not found");
      resolve(false);
      return;
    }
    modal.style.display = "none";
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
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// USER UTILITIES
export function sanitizeHandle(input) {
  return input.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}
export function validatePhotoURL(photoURL, defaultPic) {
    if (!photoURL || photoURL.trim() === "") return defaultPic;
  return photoURL.trim();
}
export async function testImageURL(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    console.warn("Failed to test image URL:", url, error);
    return false;
  }
}
export async function validateAndTestPhotoURL(photoURL, defaultPic) {
  const validatedURL = validatePhotoURL(photoURL, defaultPic);
  if (validatedURL === defaultPic) return validatedURL;
  const isAccessible = await testImageURL(validatedURL);
  return isAccessible ? validatedURL : defaultPic;
}

// TEXT PROCESSING
export function parseEmojis(text) {
  return text.replace(/:\w+:/g, (match) => {
      const emojiMap = {":smile:": "😊", ":heart:": "❤️", ":thumbsup:": "👍", ":fire:": "🔥"};
    return emojiMap[match] || match;
  });
}
export function parseMentions(text) {
  return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
}

// FIREBASE UTILITIES
export async function resolveHandlesToUids(handles, db, appId) {
  const handleToUid = {};
  try {
    const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
    const querySnapshot = await getDocs(usersRef);
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
        if (userData.handle && handles.includes(userData.handle)) handleToUid[userData.handle] = doc.id;
    });
  } catch (error) {
    console.error("Error resolving handles to UIDs:", error);
  }
  return handleToUid;
}

// MEDIA UTILITIES
export async function convertDiscordUrlToReliableCDN(discordURL) {
    if (!discordURL || !discordURL.includes('discord.com')) return discordURL;
  try {
    const url = new URL(discordURL);
    if (url.hostname === 'cdn.discordapp.com' || url.hostname === 'media.discordapp.net') {
      url.searchParams.set('size', '1024');
      return url.toString();
    }
    return discordURL;
  } catch (error) {
    console.warn("Failed to convert Discord URL:", error);
    return discordURL;
  }
}
export function getRecommendedCDNServices() {
  return [
    { name: "ImgBB", url: "https://imgbb.com/" },
    { name: "Cloudinary", url: "https://cloudinary.com/" },
    { name: "Imgur", url: "https://imgur.com/" },
  ];
}

// INITIALIZATION
function initializeUtilityElements() {
  if (!document.getElementById("message-box")) {
    const messageBox = document.createElement("div");
    messageBox.id = "message-box";
    messageBox.className = "message-box";
    messageBox.style.display = "none";
    document.body.appendChild(messageBox);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeUtilityElements);
else initializeUtilityElements();

// MEDIA RENDERING
export function renderMediaContent(text) {
  if (!text) return '';
  const youtubeRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+))/g;
  text = text.replace(youtubeRegex, (match, url, videoId) => {
    return `<div class="youtube-embed"><iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
  });
  const imageRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;
  text = text.replace(imageRegex, (match, url) => {
    return `<img src="${url}" alt="Embedded image" class="embedded-image" style="max-width: 100%; height: auto;">`;
  });
  return text;
}
export function validateMediaUrl(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    const validProtocols = ['http:', 'https:'];
    const validDomains = ['youtube.com', 'youtu.be', 'imgur.com', 'imgbb.com', 'cloudinary.com'];
      return validProtocols.includes(urlObj.protocol) && (validDomains.some(domain => urlObj.hostname.includes(domain)) || url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i));
  } catch {
    return false;
  }
}
export function createMediaPreview(url, type) {
  if (type === 'youtube') {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/)?.[1];
      if (videoId) return `<iframe width="320" height="180" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
  } else if (type === 'image') {
    return `<img src="${url}" alt="Preview" style="max-width: 320px; max-height: 180px; object-fit: cover;">`;
  }
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
}
export function renderMarkdownWithMedia(content, targetElement) {
  if (!targetElement) return;
  let html = content
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/`(.*)`/gim, '<code>$1</code>')
    .replace(/\n/gim, '<br>');
  html = renderMediaContent(html);
  targetElement.innerHTML = html;
}

// TAB UTILITIES
export function setupTabs(tabButtonSelector = '.tab-button', tabContentSelector = '.tab-content') {
  const tabButtons = document.querySelectorAll(tabButtonSelector);
  const tabContents = document.querySelectorAll(tabContentSelector);
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      button.classList.add('active');
      const targetContent = document.querySelector(`${tabContentSelector}[data-tab="${targetTab}"]`);
        if (targetContent) targetContent.classList.add('active');
    });
  });
}