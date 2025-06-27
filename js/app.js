// Minimal emoji replacement utility for :emoji_name: syntax
// Only a small subset for demo; extend as needed
const EMOJI_MAP = {
  smile: '\u{1F604}', // 😄
  wink: '\u{1F609}', // 😉
  heart: '\u{2764}\u{FE0F}', // ❤️
  thumbsup: '\u{1F44D}', // 👍
  cry: '\u{1F622}', // 😢
  laugh: '\u{1F606}', // 😆
  clap: '\u{1F44F}', // 👏
  fire: '\u{1F525}', // 🔥
  party: '\u{1F389}', // 🎉
  angry: '\u{1F620}', // 😠
  surprised: '\u{1F62E}', // 😮
  cool: '\u{1F60E}', // 😎
  star: '\u{2B50}', // ⭐
  poop: '\u{1F4A9}', // 💩
  grin: '\u{1F601}', // 😁
  blush: '\u{1F60A}', // 😊
  sob: '\u{1F62D}', // 😭
  scream: '\u{1F631}', // 😱
  kiss: '\u{1F618}', // 😘
  eyes: '\u{1F440}', // 👀
};

/**
 * Replaces :emoji_name: with Unicode emoji in text.
 * @param {string} text
 * @returns {string}
 */
export function replaceEmojis(text) {
  return text.replace(/:([a-z0-9_]+):/gi, (match, name) => {
    if (EMOJI_MAP[name]) return EMOJI_MAP[name];
    return match;
  });
}
