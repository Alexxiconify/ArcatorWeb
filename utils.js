// utils.js: Utility functions for the Arcator website
import {appId, db} from "./firebase-init.js";
import {collection, doc, getDoc, getDocs} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// MESSAGE BOX SYSTEM
export function showMessageBox(message, isError = false, allowHtml = false) {
  const messageBox = document.getElementById("message-box") || createMessageBox();
  messageBox.className = `message-box ${isError ? "error" : "success"}`;
  messageBox.innerHTML = allowHtml ? message : escapeHtml(message);
  messageBox.style.display = "block";
  setTimeout(() => {
    messageBox.style.display = "none";
  }, 5000);
}

export function showCustomConfirm(message, submessage = "") {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.display = "flex";
    modal.innerHTML = `
      <div class="modal-content">
        <h3>${escapeHtml(message)}</h3>
        ${submessage ? `<p>${escapeHtml(submessage)}</p>` : ""}
        <div class="flex gap-2 mt-4">
          <button class="btn-primary btn-blue confirm-yes">Yes</button>
          <button class="btn-primary btn-red confirm-no">No</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const handleYes = () => {
      modal.style.display = "none";
      resolve(true);
    };
    const handleNo = () => {
      modal.style.display = "none";
      resolve(false);
    };

    modal.querySelector(".confirm-yes").addEventListener("click", handleYes);
    modal.querySelector(".confirm-no").addEventListener("click", handleNo);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) handleNo();
    });
  });
}

export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// CSV PARSING UTILITIES
export function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(val => val.replace(/^"|"$/g, ''));
}

export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= 2) {
      const row = {interest: values[0] || '', members: values[1] || '0', category: 'Gaming', description: ``};
      const players = [];
      for (let j = 2; j < values.length; j++) {
        if (values[j] && values[j].trim() !== '') {
          players.push(headers[j] || `Player ${j}`);
        }
      }
      if (players.length > 0) {
        row.description += `Users: ${players.join(', ')}`;
      }
      if (row.interest && row.interest.trim() !== '') {
        data.push(row);
      }
    }
  }
  return data;
}

export function parseDonationsCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    data.push({
      expense: row['expense'] || row['expenses'] || '',
      cost: row['cost'] || '',
      description: row['description'] || '',
      donor: row['donor'] || row['donation'] || row['donations'] || ''
    });
  }
  return data;
}

export function parseMachinesCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    data.push({
      name: row['name'] || '',
      owner: row['owner'] || '',
      location: row['location'] || '',
      purpose: row['purpose'] || '',
      internalId: row['internal id'] || row['internalid'] || '',
      notes: row['notes'] || ''
    });
  }
  return data;
}

// URL AND MEDIA UTILITIES
export function convertDiscordUrlToReliableCDN(url) {
  if (!url) return null;
  return url.replace(/^https:\/\/cdn\.discordapp\.com/, 'https://media.discordapp.net');
}

export async function uploadImageToImgBB(imageFile, apiKey) {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('key', apiKey);

  try {
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    return data.success ? data.data.url : null;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
}

export function validatePhotoURL(url) {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function testImageURL(url, timeout = 5000) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = img.onerror = null;
      resolve(false);
    }, timeout);

    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };

    img.src = url;
  });
}

export function renderMediaContent(url, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !url) return;

  const extension = url.split('.').pop().toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension);
  const isVideo = ['mp4', 'webm', 'ogg'].includes(extension);
  const isAudio = ['mp3', 'wav', 'ogg'].includes(extension);

  if (isImage) {
    container.innerHTML = `<img src="${url}" alt="Media content" style="max-width: 100%; height: auto;">`;
  } else if (isVideo) {
    container.innerHTML = `<video controls style="max-width: 100%;"><source src="${url}" type="video/${extension}"></video>`;
  } else if (isAudio) {
    container.innerHTML = `<audio controls><source src="${url}" type="audio/${extension}"></audio>`;
  } else {
    container.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer">View Media</a>`;
  }
}

export function validateMediaUrl(url) {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function createMediaPreview(url, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="media-preview">
      <img src="${url}" alt="Preview" style="max-width: 100px; max-height: 100px; object-fit: cover;">
      <span>${url}</span>
    </div>
  `;
}

// YOUTUBE UTILITIES
export function extractYouTubeVideoId(url) {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/watch\?.*&v=([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// USER PROFILE UTILITIES
export async function resolveHandlesToUids(handles) {
  if (!db || !handles || handles.length === 0) return {};

  const result = {};
  const handlesRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);

  try {
    const querySnapshot = await getDocs(handlesRef);
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.handle && handles.includes(data.handle)) {
        result[data.handle] = doc.id;
      }
    });
  } catch (error) {
    console.error('Error resolving handles:', error);
  }

  return result;
}

export async function getUserProfileFromFirestore(uid) {
  if (!db || !uid) return null;

  try {
    const userDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid));
    return userDoc.exists() ? {uid, ...userDoc.data()} : null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export function sanitizeHandle(handle) {
  if (!handle) return '';
  return handle.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
}

export function generateRandomNameAndHandle() {
  const adjectives = ['Swift', 'Bright', 'Clever', 'Brave', 'Wise', 'Kind', 'Calm', 'Bold'];
  const nouns = ['Wolf', 'Eagle', 'Lion', 'Bear', 'Fox', 'Hawk', 'Tiger', 'Dragon'];
  const numbers = Math.floor(Math.random() * 999) + 1;

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const displayName = `${adjective}${noun}`;
  const handle = `${displayName.toLowerCase()}${numbers}`;

  return {displayName, handle};
}

export function generateColoredProfilePic(displayName) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  const color = colors[displayName.length % colors.length];
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color.slice(1)}&color=fff&size=128&bold=true`;
}

// UI UTILITIES
export function setupTabs(tabButtonSelector = '.tab-button', tabContentSelector = '.tab-content') {
  const tabButtons = document.querySelectorAll(tabButtonSelector);
  const tabContents = document.querySelectorAll(tabContentSelector);

  function activateTab(tabName, updateHash = false) {
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    tabContents.forEach(content => {
      content.classList.toggle('active', content.getAttribute('data-tab') === tabName);
    });

    if (updateHash) {
      window.location.hash = tabName;
    }
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      activateTab(tabName, true);
    });
  });

  const hash = window.location.hash.slice(1);
  if (hash) {
    activateTab(hash);
  }
}

export function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    button.innerHTML = '<i class="fas fa-eye-slash"></i>';
  } else {
    input.type = 'password';
    button.innerHTML = '<i class="fas fa-eye"></i>';
  }
}

// MESSAGE BOX CREATION
function createMessageBox() {
  const messageBox = document.createElement('div');
  messageBox.id = 'message-box';
  messageBox.className = 'message-box';
  messageBox.style.display = 'none';
  document.body.appendChild(messageBox);
  return messageBox;
}