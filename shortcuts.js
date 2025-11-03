let keyboardShortcuts = {};
let isRecordingShortcut = false;
let currentRecordingShortcut = null;
let disabledShortcuts = new Set();
let shortcutKeyToName = {};

export {
  initializeKeyboardShortcuts,
  handleKeyboardShortcut,
  getCurrentShortcuts,
  updateGlobalShortcuts,
  toggleShortcutDisabled,
  testShortcutCombination,
  executeShortcut,
  shortcutCategories,
  shortcutDescriptions
};

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

export function handleKeyboardShortcut(event) {
  if (isRecordingShortcut) return;

  const pressedKeys = getPressedKeys(event);
  const shortcutName = shortcutKeyToName[pressedKeys];

  if (shortcutName && !disabledShortcuts.has(shortcutName)) {
    event.preventDefault();
    executeShortcut(shortcutName);
  }
}

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

export function executeShortcut(shortcutKey, showSearchModal, showHelpModal) {
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