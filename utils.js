// utils.js: Combined utility functions
import { auth, db, appId } from './firebase-init.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Message box functionality
export function showMessageBox(message, isError = false, allowHtml = false) {
  const messageBox = document.getElementById('message-box');
  if (!messageBox) return;
  
  messageBox.className = `message-box ${isError ? 'error' : 'success'}`;
  if (allowHtml) {
    messageBox.innerHTML = message;
  } else {
    messageBox.textContent = message;
  }
  
  messageBox.style.display = 'block';
  setTimeout(() => {
    messageBox.style.display = 'none';
  }, 5000);
}

// Custom confirmation dialog
export function showCustomConfirm(message, submessage = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-confirm-modal');
    const messageEl = document.getElementById('confirm-message');
    const submessageEl = document.getElementById('confirm-submessage');
    const yesBtn = document.getElementById('confirm-yes');
    const noBtn = document.getElementById('confirm-no');
    
    if (!modal || !messageEl || !yesBtn || !noBtn) {
      resolve(false);
      return;
    }
    
    messageEl.textContent = message;
    if (submessageEl) submessageEl.textContent = submessage;
    
    const handleYes = () => {
      modal.style.display = 'none';
      yesBtn.removeEventListener('click', handleYes);
      noBtn.removeEventListener('click', handleNo);
      resolve(true);
    };
    
    const handleNo = () => {
      modal.style.display = 'none';
      yesBtn.removeEventListener('click', handleYes);
      noBtn.removeEventListener('click', handleNo);
      resolve(false);
    };
    
    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);
    modal.style.display = 'flex';
  });
}

// HTML escaping
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle sanitization
export function sanitizeHandle(input) {
  return input.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
}

// Photo URL validation
export function validatePhotoURL(photoURL, defaultPic) {
  if (!photoURL || photoURL.trim() === '') return defaultPic;
  if (photoURL === defaultPic) return defaultPic;
  
  try {
    const url = new URL(photoURL);
    if (!['http:', 'https:'].includes(url.protocol)) return defaultPic;
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
      const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
      const q = query(usersRef, where('handle', '==', handle));
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
    console.error('Error getting user profile:', error);
    return null;
  }
}

// Convert Discord URL to reliable CDN
export async function convertDiscordUrlToReliableCDN(discordURL) {
  if (!discordURL || !discordURL.includes('discord.com')) return discordURL;
  
  try {
    const url = new URL(discordURL);
    if (url.hostname === 'cdn.discordapp.com') return discordURL;
    
    const response = await fetch(discordURL, { method: 'HEAD' });
    if (response.ok) {
      const finalURL = response.url;
      if (finalURL.includes('cdn.discordapp.com')) return finalURL;
    }
  } catch (error) {
    console.error('Error converting Discord URL:', error);
  }
  
  return discordURL;
}

// Upload image to ImgBB
export async function uploadImageToImgBB(imageURL, albumId = null) {
  const apiKey = 'YOUR_IMGBB_API_KEY'; // Replace with actual key
  if (!apiKey || apiKey === 'YOUR_IMGBB_API_KEY') {
    console.warn('ImgBB API key not configured');
    return { success: false, error: 'API key not configured' };
  }
  
  try {
    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', imageURL);
    if (albumId) formData.append('album', albumId);
    
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    if (result.success) {
      return { success: true, url: result.data.url };
    } else {
      return { success: false, error: result.error?.message || 'Upload failed' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Convert Discord URL to ImgBB album
export async function convertDiscordUrlToImgBBAlbum(discordURL, albumId) {
  if (!discordURL || !discordURL.includes('discord.com')) return discordURL;
  
  const result = await uploadImageToImgBB(discordURL, albumId);
  return result.success ? result.url : discordURL;
}

// Get recommended CDN services
export function getRecommendedCDNServices() {
  return [
    { name: 'ImgBB', url: 'https://imgbb.com/', free: true },
    { name: 'Cloudinary', url: 'https://cloudinary.com/', free: true },
    { name: 'Imgur', url: 'https://imgur.com/', free: true },
    { name: 'GitHub', url: 'https://github.com/', free: true }
  ];
}

// Create image upload helper
export function createImageUploadHelper(targetElementId) {
  const targetElement = document.getElementById(targetElementId);
  if (!targetElement) return null;
  
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  
  input.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      if (result.success) {
        targetElement.value = result.url;
        showMessageBox('Image uploaded successfully!', false);
      } else {
        showMessageBox('Upload failed: ' + result.error, true);
      }
    } catch (error) {
      showMessageBox('Upload error: ' + error.message, true);
    }
  });
  
  document.body.appendChild(input);
  return input;
}

// Initialize utility elements
function initializeUtilityElements() {
  const messageBox = document.getElementById('message-box');
  if (!messageBox) {
    const box = document.createElement('div');
    box.id = 'message-box';
    box.className = 'message-box';
    box.style.display = 'none';
    document.body.appendChild(box);
  }
  
  const confirmModal = document.getElementById('custom-confirm-modal');
  if (!confirmModal) {
    const modal = document.createElement('div');
    modal.id = 'custom-confirm-modal';
    modal.className = 'custom-confirm-modal';
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
document.addEventListener('DOMContentLoaded', initializeUtilityElements);

// Emoji mapping
const emojiMap = {
  ':smile:': '😊',
  ':heart:': '❤️',
  ':thumbsup:': '👍',
  ':fire:': '🔥',
  ':rocket:': '🚀',
  ':star:': '⭐',
  ':check:': '✅',
  ':x:': '❌',
  ':warning:': '⚠️',
  ':info:': 'ℹ️'
};
