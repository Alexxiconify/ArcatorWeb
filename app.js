// Load full emoji map from emojibase
let EMOJI_MAP = {};
let EMOJI_MAP_LOADED = false;

fetch('./emojii.json')
  .then(res => res.json())
  .then(data => {
    EMOJI_MAP = {};
    // Use the 'name' field as the key for shortcode lookup
    data.forEach(e => {
      if (e.emoji && e.name) {
        EMOJI_MAP[e.name] = e.emoji;
      }
    });
    EMOJI_MAP_LOADED = true;
    console.log('Emoji map loaded with', Object.keys(EMOJI_MAP).length, 'emojis');
  })
  .catch(error => {
    console.error('Failed to load emoji map:', error);
    EMOJI_MAP_LOADED = true; // Mark as loaded even on error to prevent infinite waiting
  });

/**
 * Replaces :emoji_name: with Unicode emoji in text.
 * @param {string} text
 * @returns {string}
 */
export function replaceEmojis(text) {
  // Manual patch for :joy: and :smile:
  text = text.replace(/:joy:/gi, '😂');
  text = text.replace(/:smile:/gi, '😄');
  if (!EMOJI_MAP_LOADED) {
    // If emoji map isn't loaded yet, return patched text
    return text;
  }
  return text.replace(/:([a-z0-9_+-]+):/gi, (match, name) => {
    if (EMOJI_MAP[name]) return EMOJI_MAP[name];
    return match;
  });
}

/**
 * Force re-render of content when emoji map loads
 */
export function triggerEmojiRerender() {
  if (EMOJI_MAP_LOADED) {
    // Trigger a re-render of visible content
    const event = new CustomEvent('emojiMapLoaded');
    document.dispatchEvent(event);
  }
}

// Twemoji render helper
export function triggerTwemojiRender() {
  if (window.twemoji) {
    console.log('[Twemoji] Parsing document.body for emoji SVGs');
    window.twemoji.parse(document.body, {folder: 'svg', ext: '.svg'});
  }
}
// Call after emoji/text updates

// --- GLOBAL KEYBOARD SHORTCUTS & USER EXPERIENCE SETTINGS ---

// Import Firebase and settings helpers if available (assume global for browser)
import {
  getUserProfileFromFirestore,
  firebaseReadyPromise,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME
} from './firebase-init.js';
import {applyTheme, getAvailableThemes} from './themes.js';

// --- GLOBAL SHORTCUTS ---
let keyboardShortcuts = {};
let isRecordingShortcut = false;
let currentRecordingShortcut = null;
let disabledShortcuts = new Set();
let shortcutKeyToName = {};
const defaultShortcuts = {
  'home': 'Alt+Shift+H',
  'about': 'Alt+Shift+A',
  'servers': 'Alt+Shift+S',
  'community': 'Alt+Shift+C',
  'interests': 'Alt+Shift+I',
  'games': 'Alt+Shift+G',
  'forms': 'Alt+Shift+F',
  'dms': 'Alt+Shift+D',
  'new-dm': 'Alt+Shift+N',
  'settings': 'Alt+Shift+U',
  'search': 'Alt+Shift+K',
  'help': 'F1',
  'logout': 'Alt+Shift+L'
};
const pageUrls = {
  'home': 'index.html',
  'about': 'about.html',
  'servers': 'servers.html',
  'community': 'community.html',
  'interests': 'interests.html',
  'games': 'games.html',
  'forms': 'forms.html',
  'dms': 'forms.html#dms',
  'new-dm': 'forms.html#dms',
  'settings': 'users.html',
  'search': '#',
  'help': '#',
  'logout': '#'
};

function initializeKeyboardShortcuts() {
  shortcutKeyToName = {};
  Object.entries(keyboardShortcuts).forEach(([name, combo]) => {
    shortcutKeyToName[combo] = name;
  });
  document.removeEventListener('keydown', handleKeyboardShortcut);
  document.addEventListener('keydown', handleKeyboardShortcut);
}

function getPressedKeys(event) {
  const keys = [];
  if (event.altKey) keys.push('Alt');
  if (event.ctrlKey) keys.push('Ctrl');
  if (event.shiftKey) keys.push('Shift');
  if (event.metaKey) keys.push('Meta');
  if (event.key && !['Alt', 'Ctrl', 'Shift', 'Meta'].includes(event.key)) {
    const keyMap = {
      ' ': 'Space',
      'Enter': 'Enter',
      'Escape': 'Escape',
      'Tab': 'Tab',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
      'Home': 'Home',
      'End': 'End',
      'PageUp': 'PageUp',
      'PageDown': 'PageDown',
      'Insert': 'Insert',
      'F1': 'F1',
      'F2': 'F2',
      'F3': 'F3',
      'F4': 'F4',
      'F5': 'F5',
      'F6': 'F6',
      'F7': 'F7',
      'F8': 'F8',
      'F9': 'F9',
      'F10': 'F10',
      'F11': 'F11',
      'F12': 'F12'
    };
    keys.push(keyMap[event.key] || event.key.toUpperCase());
  }
  return keys.join('+');
}

function handleKeyboardShortcut(event) {
  if (isRecordingShortcut) return;
  const pressedKeys = getPressedKeys(event);
  const shortcutName = shortcutKeyToName[pressedKeys];
  if (pressedKeys === 'F1') {
    event.preventDefault();
    showHelpModal();
    return;
  }
  if (shortcutName) {
    event.preventDefault();
    executeShortcut(shortcutName);
  }
}

function executeShortcut(shortcutKey) {
  if (disabledShortcuts.has(shortcutKey)) return;
  const currentShortcuts = JSON.parse(localStorage.getItem('customShortcuts')) || defaultShortcuts;
  const shortcut = currentShortcuts[shortcutKey];
  if (!shortcut) return;
  switch (shortcutKey) {
    case 'home':
      window.location.href = 'index.html';
      break;
    case 'about':
      window.location.href = 'about.html';
      break;
    case 'servers':
      window.location.href = 'servers.html';
      break;
    case 'community':
      window.location.href = 'community.html';
      break;
    case 'interests':
      window.location.href = 'interests.html';
      break;
    case 'games':
      window.location.href = 'games.html';
      break;
    case 'forms':
      window.location.href = 'forms.html';
      break;
    case 'dms':
      window.location.href = 'forms.html#dms';
      break;
    case 'new-dm':
      window.location.href = 'forms.html#new-dm';
      break;
    case 'settings':
      window.location.href = 'users.html';
      break;
    case 'search':
      showSearchModal();
      break;
    case 'help':
      showHelpModal();
      break;
    case 'logout':
      if (window.auth && window.auth.currentUser) {
        window.auth.signOut().then(() => window.location.reload());
      }
      break;
    default:
      break;
  }
}

// --- GLOBAL USER EXPERIENCE SETTINGS ---
function applyFontScalingSystem(userProfile) {
  const baseFontSize = parseInt(userProfile.fontSize || '16px');
  const headingMultiplier = parseFloat(userProfile.headingSizeMultiplier || '1.6');
  const fontFamily = userProfile.fontFamily || 'Inter, sans-serif';
  const lineHeight = userProfile.lineHeight || '1.6';
  const letterSpacing = userProfile.letterSpacing || '0px';
  document.body.style.fontSize = `${baseFontSize}px`;
  document.body.style.fontFamily = fontFamily;
  document.body.style.lineHeight = lineHeight;
  document.body.style.letterSpacing = letterSpacing;
  document.documentElement.style.setProperty('--base-font-size', `${baseFontSize}px`);
  document.documentElement.style.setProperty('--font-family', fontFamily);
  document.documentElement.style.setProperty('--line-height', lineHeight);
  document.documentElement.style.setProperty('--letter-spacing', letterSpacing);
}

function applyAccessibilitySettings(settings) {
  const root = document.documentElement;
  if (settings.highContrast) root.classList.add('high-contrast-mode'); else root.classList.remove('high-contrast-mode');
  if (settings.colorblindFriendly) root.classList.add('colorblind-friendly'); else root.classList.remove('colorblind-friendly');
  if (settings.minimalUi) document.body.classList.add('minimal-ui'); else document.body.classList.remove('minimal-ui');
  if (settings.lowBandwidthMode) document.body.classList.add('low-bandwidth-mode'); else document.body.classList.remove('low-bandwidth-mode');
}

function applyAdvancedSettings(settings) {
  applyAccessibilitySettings(settings);
}

function applyCustomCSS(css) {
  let customStyleElement = document.getElementById('custom-user-css');
  if (!customStyleElement) {
    customStyleElement = document.createElement('style');
    customStyleElement.id = 'custom-user-css';
    document.head.appendChild(customStyleElement);
  }
  customStyleElement.textContent = css;
}

// --- GLOBAL SETTINGS LOADER ---
async function loadAndApplyGlobalUserSettings() {
  await firebaseReadyPromise;
  let userProfile = null;
  if (window.auth && window.auth.currentUser) {
    userProfile = await getUserProfileFromFirestore(window.auth.currentUser.uid);
  }
  if (userProfile) {
    applyFontScalingSystem(userProfile);
    if (userProfile.advancedSettings) {
      applyAdvancedSettings(userProfile.advancedSettings);
      if (userProfile.advancedSettings.customCSS) applyCustomCSS(userProfile.advancedSettings.customCSS);
      if (userProfile.advancedSettings.keyboardShortcutsConfig) keyboardShortcuts = {...defaultShortcuts, ...userProfile.advancedSettings.keyboardShortcutsConfig};
      else keyboardShortcuts = {...defaultShortcuts};
    } else {
      keyboardShortcuts = {...defaultShortcuts};
    }
  } else {
    keyboardShortcuts = {...defaultShortcuts};
  }
  initializeKeyboardShortcuts();
}

// --- GLOBAL SEARCH MODAL (search all fields/inputs/labels) ---
function showSearchModal() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
  modal.innerHTML = `<div style="background:var(--color-bg-card);padding:2rem;border-radius:0.5rem;min-width:500px;max-width:600px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;"><h3 style="color:var(--color-text-primary);margin:0;">Search</h3><button id="close-search-modal-btn" style="background:var(--color-button-blue-bg);color:white;padding:0.25rem 0.75rem;border:none;border-radius:0.25rem;cursor:pointer;">Close</button></div><div style="margin-bottom:1rem;"><input type="text" id="search-input-field" placeholder="Enter search term..." style="width:100%;padding:0.75rem;background:var(--color-input-bg);color:var(--color-input-text);border:1px solid var(--color-input-border);border-radius:0.25rem;font-size:1rem;"></div><div style="display:flex;gap:0.5rem;margin-bottom:1rem;"><button id="find-btn" style="background:var(--color-button-blue-bg);color:white;padding:0.5rem 1rem;border:none;border-radius:0.25rem;cursor:pointer;font-weight:600;">Find</button><button id="find-next-btn" style="background:var(--color-button-green-bg);color:white;padding:0.5rem 1rem;border:none;border-radius:0.25rem;cursor:pointer;font-weight:600;">Find Next</button><button id="find-prev-btn" style="background:var(--color-button-purple-bg);color:white;padding:0.5rem 1rem;border:none;border-radius:0.25rem;cursor:pointer;font-weight:600;">Find Previous</button></div><div style="display:flex;gap:0.5rem;margin-bottom:1rem;"><label style="display:flex;align-items:center;gap:0.25rem;color:var(--color-text-primary);"><input type="checkbox" id="case-sensitive-checkbox" style="margin:0;">Case sensitive</label><label style="display:flex;align-items:center;gap:0.25rem;color:var(--color-text-primary);"><input type="checkbox" id="whole-word-checkbox" style="margin:0;">Whole word</label></div><div id="search-results" style="color:var(--color-text-secondary);font-size:0.875rem;min-height:1.5rem;">Enter a search term to begin</div></div>`;
  document.body.appendChild(modal);
  const searchInput = modal.querySelector('#search-input-field');
  const findBtn = modal.querySelector('#find-btn');
  const findNextBtn = modal.querySelector('#find-next-btn');
  const findPrevBtn = modal.querySelector('#find-prev-btn');
  const closeBtn = modal.querySelector('#close-search-modal-btn');
  const caseSensitiveCheckbox = modal.querySelector('#case-sensitive-checkbox');
  const wholeWordCheckbox = modal.querySelector('#whole-word-checkbox');
  const resultsDiv = modal.querySelector('#search-results');
  let currentMatches = [];
  let currentMatchIndex = -1;
  let lastSearchTerm = '';

  function clearHighlights() {
    const highlights = document.querySelectorAll('.search-highlight');
    highlights.forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  }

  function highlightMatches(searchTerm, caseSensitive, wholeWord) {
    clearHighlights();
    if (!searchTerm.trim()) {
      currentMatches = [];
      currentMatchIndex = -1;
      resultsDiv.textContent = 'Enter a search term to begin';
      return;
    }
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = wholeWord ? new RegExp(`\\b${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, flags) : new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    currentMatches = [];
    // Search in all visible fields/inputs/labels/textareas
    const searchNodes = Array.from(document.querySelectorAll('input, textarea, select, label, [contenteditable], button, a, span, p, h1, h2, h3, h4, h5, h6, div'));
    searchNodes.forEach(node => {
      if (node.offsetParent === null) return; // skip hidden
      if (node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        let match;
        while ((match = regex.exec(text)) !== null) {
          currentMatches.push({node, start: match.index, end: match.index + match[0].length, text: match[0]});
        }
      }
    });
    // Highlight matches
    currentMatches.forEach((match, index) => {
      const node = match.node;
      const text = node.textContent;
      const before = text.substring(0, match.start);
      const after = text.substring(match.end);
      const highlighted = text.substring(match.start, match.end);
      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'search-highlight';
      highlightSpan.textContent = highlighted;
      highlightSpan.style.cssText = `background:${index === currentMatchIndex ? 'var(--color-button-blue-bg)' : 'var(--color-button-yellow-bg)'};color:${index === currentMatchIndex ? 'white' : 'black'};padding:2px 4px;border-radius:2px;font-weight:bold;`;
      const fragment = document.createDocumentFragment();
      if (before) fragment.appendChild(document.createTextNode(before));
      fragment.appendChild(highlightSpan);
      if (after) fragment.appendChild(document.createTextNode(after));
      node.innerHTML = '';
      node.appendChild(fragment);
    });
    if (currentMatches.length > 0) {
      resultsDiv.textContent = `Found ${currentMatches.length} match${currentMatches.length > 1 ? 'es' : ''}`;
      if (currentMatchIndex >= 0) resultsDiv.textContent += ` (${currentMatchIndex + 1} of ${currentMatches.length})`;
    } else {
      resultsDiv.textContent = 'No matches found';
    }
  }

  function scrollToCurrentMatch() {
    if (currentMatchIndex >= 0 && currentMatchIndex < currentMatches.length) {
      const highlights = document.querySelectorAll('.search-highlight');
      if (highlights[currentMatchIndex]) highlights[currentMatchIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }

  function performFind() {
    const searchTerm = searchInput.value;
    const caseSensitive = caseSensitiveCheckbox.checked;
    const wholeWord = wholeWordCheckbox.checked;
    if (searchTerm !== lastSearchTerm) {
      currentMatchIndex = -1;
      lastSearchTerm = searchTerm;
    }
    highlightMatches(searchTerm, caseSensitive, wholeWord);
    if (currentMatches.length > 0) {
      currentMatchIndex = 0;
      highlightMatches(searchTerm, caseSensitive, wholeWord);
      scrollToCurrentMatch();
    }
  }

  function findNext() {
    if (currentMatches.length === 0) {
      performFind();
      return;
    }
    currentMatchIndex = (currentMatchIndex + 1) % currentMatches.length;
    const searchTerm = searchInput.value;
    const caseSensitive = caseSensitiveCheckbox.checked;
    const wholeWord = wholeWordCheckbox.checked;
    highlightMatches(searchTerm, caseSensitive, wholeWord);
    scrollToCurrentMatch();
  }

  function findPrev() {
    if (currentMatches.length === 0) {
      performFind();
      return;
    }
    currentMatchIndex = currentMatchIndex <= 0 ? currentMatches.length - 1 : currentMatchIndex - 1;
    const searchTerm = searchInput.value;
    const caseSensitive = caseSensitiveCheckbox.checked;
    const wholeWord = wholeWordCheckbox.checked;
    highlightMatches(searchTerm, caseSensitive, wholeWord);
    scrollToCurrentMatch();
  }

  findBtn.addEventListener('click', performFind);
  findNextBtn.addEventListener('click', findNext);
  findPrevBtn.addEventListener('click', findPrev);
  closeBtn.addEventListener('click', () => {
    clearHighlights();
    modal.remove();
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) findPrev(); else findNext();
    } else if (e.key === 'Escape') {
      clearHighlights();
      modal.remove();
    }
  });
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (searchInput.value.trim()) performFind(); else {
        clearHighlights();
        resultsDiv.textContent = 'Enter a search term to begin';
      }
    }, 300);
  });
  searchInput.focus();
  searchInput.select();
}

// --- GLOBAL HELP MODAL (minimal) ---
let helpModalInstance = null;

function showHelpModal() {
  if (helpModalInstance) {
    helpModalInstance.remove();
    helpModalInstance = null;
    return;
  }
  const modal = document.createElement('div');
  helpModalInstance = modal;
  modal.tabIndex = -1;
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
  modal.innerHTML = `<div style="background:var(--color-bg-card);padding:2rem;border-radius:0.5rem;max-width:600px;max-height:80vh;overflow-y:auto;position:relative;"><button id="close-help-modal-btn" style="position:absolute;top:1rem;right:1rem;background:var(--color-button-blue-bg);color:white;padding:0.25rem 0.75rem;border:none;border-radius:0.25rem;cursor:pointer;">Close</button><h3 style="margin-bottom:1rem;color:var(--color-text-primary);">Keyboard Shortcuts Help</h3><div style="color:var(--color-text-secondary);line-height:1.6;"><p><strong>Navigation:</strong></p><ul><li>Alt+Shift+H - Home Page</li><li>Alt+Shift+A - About Page</li><li>Alt+Shift+S - Servers Page</li><li>Alt+Shift+C - Community Page</li><li>Alt+Shift+I - Interests Page</li><li>Alt+Shift+G - Games Page</li><li>Alt+Shift+F - Forms Page</li></ul><p><strong>Communication:</strong></p><ul><li>Alt+Shift+D - Direct Messages</li><li>Alt+Shift+N - New DM</li></ul><p><strong>Settings:</strong></p><ul><li>Alt+Shift+U - User Settings</li></ul><p><strong>Utilities:</strong></p><ul><li>Alt+Shift+K - Search</li><li>F1 - Help (this dialog)</li><li>Alt+Shift+L - Logout</li></ul><p><strong>Note:</strong> You can customize these shortcuts in the Advanced Settings section.</p></div></div>`;
  document.body.appendChild(modal);
  modal.focus();
  modal.querySelector('#close-help-modal-btn').onclick = () => {
    modal.remove();
    helpModalInstance = null;
  };
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'F1') {
      modal.remove();
      helpModalInstance = null;
    }
  });
  modal.addEventListener('focusout', (e) => {
    if (!modal.contains(e.relatedTarget)) {
      setTimeout(() => modal.focus(), 0);
    }
  });
}

// --- INIT ---
if (typeof window !== 'undefined') {
  firebaseReadyPromise.then(loadAndApplyGlobalUserSettings);
}
