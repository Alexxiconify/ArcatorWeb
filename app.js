// app.js - Main application functionality
let EMOJI_MAP = {};
let EMOJI_MAP_LOADED = false;

fetch("./emoji.json")
  .then((res) => res.json())
  .then((data) => {
    EMOJI_MAP = {};
    data.forEach((e) => {
      if (e.emoji && e.name) {
        EMOJI_MAP[e.name] = e.emoji;
      }
    });
    EMOJI_MAP_LOADED = true;
  })
  .catch((error) => {
    console.error("Failed to load emoji map:", error);
    EMOJI_MAP_LOADED = true;
  });

export function replaceEmojis(text) {
  text = text.replace(/:joy:/gi, "😂");
  text = text.replace(/:smile:/gi, "😄");
  if (!EMOJI_MAP_LOADED) return text;

  return text.replace(/:([a-z0-9_+-]+):/gi, (match, name) => {
    return EMOJI_MAP[name] || match;
  });
}

export function triggerEmojiRerender() {
  if (EMOJI_MAP_LOADED) {
    document.dispatchEvent(new CustomEvent("emojiMapLoaded"));
  }
}

export function triggerTwemojiRender() {
  if (window.twemoji) {
    window.twemoji.parse(document.body, { folder: "svg", ext: ".svg" });
  }
}

import { firebaseReadyPromise, getUserProfileFromFirestore } from "./firebase-init.js";
import { initializeKeyboardShortcuts, handleKeyboardShortcut, getCurrentShortcuts, updateGlobalShortcuts, toggleShortcutDisabled, testShortcutCombination, executeShortcut, getPressedKeys } from "./shortcuts.js";
import { loadAndApplyGlobalUserSettings } from "./user-settings.js";

function createModal(content) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-button">&times;</span>
      ${content}
    </div>
  `;

  document.body.appendChild(modal);

  const closeButton = modal.querySelector('.close-button');
  closeButton.onclick = () => modal.remove();
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  return modal;
}

function showSearchModal() {
  const modal = createModal(`
      <h2>Search</h2>
      <input type="text" id="search-input" placeholder="Search..." class="input-field">
      <div id="search-results"></div>
  `);

  const searchInput = modal.querySelector('#search-input');
  searchInput.focus();
}

function showHelpModal() {
  createModal(`
      <h2>Keyboard Shortcuts</h2>
      <div class="shortcut-help">
        ${Object.entries(shortcutCategories).map(([category, shortcuts]) => `
          <div class="shortcut-category">
            <h3>${category}</h3>
            ${shortcuts.map(shortcut => `
              <div class="shortcut-item">
                <kbd>${keyboardShortcuts[shortcut] || 'Not set'}</kbd>
                <span>${shortcutDescriptions[shortcut]}</span>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
  `);
}

document.addEventListener('DOMContentLoaded', () => {
  initializeKeyboardShortcuts();
  document.addEventListener('keydown', handleKeyboardShortcut);
  loadAndApplyGlobalUserSettings(firebaseReadyPromise, getUserProfileFromFirestore, updateGlobalShortcuts);
});