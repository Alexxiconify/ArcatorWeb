// Load full emoji map from emojibase
let EMOJI_MAP = {};
fetch('https://cdn.jsdelivr.net/npm/emojibase-data/en/data.json')
  .then(res => res.json())
  .then(data => {
    EMOJI_MAP = {};
    data.forEach(e => {
      if (e.shortcodes) {
        e.shortcodes.forEach(code => {
          EMOJI_MAP[code] = e.emoji;
        });
      }
    });
  });

/**
 * Replaces :emoji_name: with Unicode emoji in text.
 * @param {string} text
 * @returns {string}
 */
export function replaceEmojis(text) {
  return text.replace(/:([a-z0-9_+-]+):/gi, (match, name) => {
    if (EMOJI_MAP[name]) return EMOJI_MAP[name];
    return match;
  });
}
