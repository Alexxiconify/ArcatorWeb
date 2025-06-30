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

import {
  getUserProfileFromFirestore,
  firebaseReadyPromise,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME,
} from "./firebase-init.js";
import { applyTheme, getAvailableThemes } from "./themes.js";

let keyboardShortcuts = {};
let isRecordingShortcut = false;
let currentRecordingShortcut = null;
let disabledShortcuts = new Set();
let shortcutKeyToName = {};

export const defaultShortcuts = {
  home: "Alt+Shift+H",
  about: "Alt+Shift+A",
  servers: "Alt+Shift+S",
  community: "Alt+Shift+C",
  interests: "Alt+Shift+I",
  games: "Alt+Shift+G",
  forms: "Alt+Shift+F",
  dms: "Alt+Shift+D",
  "new-dm": "Alt+Shift+N",
  settings: "Alt+Shift+U",
  search: "Alt+Shift+K",
  help: "F1",
  logout: "Alt+Shift+L",
};

export const shortcutCategories = {
  Navigation: ["home", "about", "servers", "community", "interests", "games", "forms"],
  Communication: ["dms", "new-dm"],
  Utilities: ["settings", "search", "help", "logout"],
};

export const shortcutDescriptions = {
  home: "Go to Home Page",
  about: "Go to About Page",
  servers: "Go to Servers Page",
  community: "Go to Community Page",
  interests: "Go to Interests Page",
  games: "Go to Games Page",
  forms: "Go to Forms Page",
  dms: "Open Direct Messages",
  "new-dm": "Create New DM",
  settings: "Open User Settings",
  search: "Open Search Dialog",
  help: "Show This Help Dialog",
  logout: "Logout User",
};

const pageUrls = {
  home: "index.html",
  about: "about.html",
  servers: "games.html",
  community: null,
  interests: null,
  games: "games.html",
  forms: "forms.html",
  dms: "forms.html#dms",
  "new-dm": "forms.html#dms",
  settings: "users.html",
  search: "#",
  help: "#",
  logout: "#",
};

const browserShortcuts = new Set([
  "Ctrl+C", "Ctrl+V", "Ctrl+X", "Ctrl+A", "Ctrl+Z", "Ctrl+Y", "Ctrl+F", "Ctrl+P", "Ctrl+S",
  "F5", "F11", "F12", "Ctrl+R", "Ctrl+Shift+R", "Ctrl+Shift+I", "Ctrl+Shift+J", "Ctrl+Shift+C",
  "Alt+F4", "Alt+Tab", "Alt+Shift+Tab", "Ctrl+Tab", "Ctrl+Shift+Tab", "Ctrl+W", "Ctrl+T",
  "Ctrl+N", "Ctrl+Shift+N", "Ctrl+Shift+P", "Ctrl+Shift+O", "Ctrl+Shift+E", "Ctrl+Shift+M",
]);

export function testShortcutCombination(combo) {
  if (!combo || typeof combo !== "string") return { valid: false, reason: "Invalid format" };

  const parts = combo.split("+");
  if (parts.length < 2) return { valid: false, reason: "Must include at least one modifier key" };

  if (browserShortcuts.has(combo)) {
    return { valid: false, reason: "Conflicts with browser shortcut" };
  }

  const currentShortcuts = Object.values(keyboardShortcuts);
  if (currentShortcuts.includes(combo)) {
    return { valid: false, reason: "Shortcut already assigned" };
  }

  return { valid: true };
}

export function getCurrentShortcuts() {
  return { ...keyboardShortcuts };
}

export function updateGlobalShortcuts(newShortcuts) {
  keyboardShortcuts = { ...newShortcuts };
  shortcutKeyToName = {};
  Object.entries(keyboardShortcuts).forEach(([name, key]) => {
    shortcutKeyToName[key] = name;
  });
}

export function toggleShortcutDisabled(shortcutName, disabled) {
  if (disabled) {
    disabledShortcuts.add(shortcutName);
  } else {
    disabledShortcuts.delete(shortcutName);
  }
}

function initializeKeyboardShortcuts() {
  keyboardShortcuts = { ...defaultShortcuts };
  Object.entries(keyboardShortcuts).forEach(([name, key]) => {
    shortcutKeyToName[key] = name;
  });
}

function getPressedKeys(event) {
  const keys = [];

  if (event.ctrlKey) keys.push("Ctrl");
  if (event.altKey) keys.push("Alt");
  if (event.shiftKey) keys.push("Shift");
  if (event.metaKey) keys.push("Meta");

  if (event.key && event.key !== "Control" && event.key !== "Alt" && event.key !== "Shift" && event.key !== "Meta") {
    keys.push(event.key.toUpperCase());
  }

  return keys.join("+");
}

function handleKeyboardShortcut(event) {
  if (isRecordingShortcut) return;

  const pressedKeys = getPressedKeys(event);
  const shortcutName = shortcutKeyToName[pressedKeys];

  if (shortcutName && !disabledShortcuts.has(shortcutName)) {
    event.preventDefault();
    executeShortcut(shortcutName);
  }
}

function executeShortcut(shortcutKey) {
  const url = pageUrls[shortcutKey];

  if (url && url !== "#") {
    if (url.startsWith("http")) {
      window.open(url, "_blank");
    } else {
      window.location.href = url;
    }
  } else {
    switch (shortcutKey) {
      case "search":
        showSearchModal();
        break;
      case "help":
        showHelpModal();
        break;
      case "logout":
        if (window.auth && window.auth.currentUser) {
          window.auth.signOut().then(() => {
            window.location.reload();
          });
        }
        break;
    }
  }
}

function applyFontScalingSystem(userProfile) {
  const fontScale = userProfile?.fontScale || 1;
  const root = document.documentElement;
  root.style.fontSize = `${fontScale * 16}px`;

  if (userProfile?.highContrast) {
    root.style.setProperty('--color-text-primary', '#FFFFFF');
    root.style.setProperty('--color-bg-card', '#000000');
  }
}

function applyAccessibilitySettings(settings) {
  if (settings?.reducedMotion) {
    document.documentElement.style.setProperty('--transition-duration', '0s');
  }
}

function applyAdvancedSettings(settings) {
  if (settings?.customCSS) {
    applyCustomCSS(settings.customCSS);
  }
}

function applyCustomCSS(css) {
  let styleElement = document.getElementById('custom-user-css');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'custom-user-css';
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = css;
}

async function loadAndApplyGlobalUserSettings() {
  try {
    await firebaseReadyPromise;

    if (window.auth && window.auth.currentUser) {
      const userProfile = await getUserProfileFromFirestore(window.auth.currentUser.uid);

      if (userProfile) {
        applyFontScalingSystem(userProfile);
        applyAccessibilitySettings(userProfile.accessibility);
        applyAdvancedSettings(userProfile.advanced);

        if (userProfile.keyboardShortcuts) {
          updateGlobalShortcuts(userProfile.keyboardShortcuts);
        }
      }
    }
  } catch (error) {
    console.error("Error loading user settings:", error);
  }
}

function showSearchModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-button">&times;</span>
      <h2>Search</h2>
      <input type="text" id="search-input" placeholder="Search..." class="input-field">
      <div id="search-results"></div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeButton = modal.querySelector('.close-button');
  const searchInput = modal.querySelector('#search-input');

  closeButton.onclick = () => modal.remove();
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  searchInput.focus();
}

function showHelpModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-button">&times;</span>
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
    </div>
  `;

  document.body.appendChild(modal);

  const closeButton = modal.querySelector('.close-button');
  closeButton.onclick = () => modal.remove();
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initializeKeyboardShortcuts();
  document.addEventListener('keydown', handleKeyboardShortcut);
  loadAndApplyGlobalUserSettings();
});
