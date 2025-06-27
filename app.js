// Load full emoji map from emojibase
let EMOJI_MAP = {};
let EMOJI_MAP_LOADED = false;

fetch('./emojii.json')
  .then(res => res.json())
  .then(data => {
    EMOJI_MAP = {};
    data.forEach(e => {
      if (e.emoji) {
        // Use the emoji field directly
        EMOJI_MAP[e.emoji] = e.emoji;
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
