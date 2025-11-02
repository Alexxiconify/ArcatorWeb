// app.js - Main application functionality (v2)
let EMOJI_MAP = {};
let EMOJI_MAP_LOADED = false;
let EMOJI_LOAD_PROMISE = null;

function loadEmojiMap() {
    if (EMOJI_LOAD_PROMISE) return EMOJI_LOAD_PROMISE;
    EMOJI_LOAD_PROMISE = fetch("./emoji.json").then((res) => res.json()).then((data) => {
    EMOJI_MAP = {};
        data.forEach((e) => {
            if (e.emoji && e.name) EMOJI_MAP[e.name] = e.emoji;
        });
    EMOJI_MAP_LOADED = true;
    }).catch((error) => {
    console.error("Failed to load emoji map:", error);
    EMOJI_MAP_LOADED = true;
  });
    return EMOJI_LOAD_PROMISE;
}
export function replaceEmojis(text) {
  text = text.replace(/:joy:/gi, "😂");
  text = text.replace(/:smile:/gi, "😄");
  if (!EMOJI_MAP_LOADED) return text;
    return text.replace(/:([a-z0-9_+-]+):/gi, (match, name) => EMOJI_MAP[name] || match);
}

export async function replaceEmojisAsync(text) {
    if (!EMOJI_MAP_LOADED) await loadEmojiMap();
    return replaceEmojis(text);
}
export function triggerEmojiRerender() {
    if (EMOJI_MAP_LOADED) document.dispatchEvent(new CustomEvent("emojiMapLoaded"));
}
export function triggerTwemojiRender() {
    if (window.twemoji) window.twemoji.parse(document.body, {folder: "svg", ext: ".svg"});
}

import {firebaseReadyPromise, getUserProfileFromFirestore} from "./firebase-init.js";
import {
    getCurrentShortcuts,
    handleKeyboardShortcut,
    initializeKeyboardShortcuts,
    shortcutCategories,
    shortcutDescriptions,
    updateGlobalShortcuts
} from "./shortcuts.js";
import {loadAndApplyGlobalUserSettings} from "./user-settings.js";

function createModal(content) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
    modal.innerHTML = `<div class="modal-content"><span class="close-button">&times;</span>${content}</div>`;
  document.body.appendChild(modal);
  const closeButton = modal.querySelector('.close-button');
  closeButton.onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
  return modal;
}
function showSearchModal() {
    const modal = createModal(`<h2>Search</h2><input type="text" id="search-input" placeholder="Search..." class="input-field"><div id="search-results"></div>`);
  const searchInput = modal.querySelector('#search-input');
  searchInput.focus();
}
function showHelpModal() {
    const shortcuts = getCurrentShortcuts();
    createModal(`<h2>Keyboard Shortcuts</h2><div class="shortcut-help">${Object.entries(shortcutCategories).map(([category, categoryShortcuts]) => `<div class="shortcut-category"><h3>${category}</h3>${categoryShortcuts.map(shortcut => `<div class="shortcut-item"><kbd>${shortcuts[shortcut] || 'Not set'}</kbd><span>${shortcutDescriptions[shortcut]}</span></div>`).join('')}</div>`).join('')}</div>`);
}

function defer(fn) {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(fn, {timeout: 2000});
    } else {
        setTimeout(fn, 1);
    }
}
document.addEventListener('DOMContentLoaded', () => {
  initializeKeyboardShortcuts();
  document.addEventListener('keydown', handleKeyboardShortcut);
    defer(() => {
        loadEmojiMap();
        loadAndApplyGlobalUserSettings(firebaseReadyPromise, getUserProfileFromFirestore, updateGlobalShortcuts);
    });
});