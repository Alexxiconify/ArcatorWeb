export function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function (char) {
        return map[char];
    });
}

export function sanitizeHandle(input) {
    if (typeof input !== 'string') {
        return '';
    }
    return input.toLowerCase().replace(/[^a-z0-9_-]/g, '');

}

// A simple map for translating custom emoji names to unicode characters
const emojiMap = {
    'smile': '😊',
    'happy': '😄',
    'joy': '😂',
    'laugh': '🤣',
    'thumbsup': '👍',
    'thumbsdown': '👎',
    'heart': '❤️',
    'fire': '🔥',
    'thinking': '🤔',
    'clap': '👏',
    'rocket': '🚀'
};

export function parseMentions(text) {
    // Regex: Finds an '@' followed by one or more alphanumeric characters or underscores.
    // The parentheses capture the username ($1 in the replace function).
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;

    return text.replace(mentionRegex, (match, username) => {
        // Class 'mention' would be defined in a separate CSS file in a real application.
        return `<a href="/user/${username}" class="mention" title="View ${username}'s profile">@${username}</a>`;
    });
}

export function parseEmojis(text) {
    // Regex: Finds a ':' followed by one or more alphanumeric characters or underscores, and then another ':'.
    // The parentheses capture the emoji name ($1 in the replace function).
    const emojiRegex = /:([a-zA-Z0-9_]+):/g;

    return text.replace(emojiRegex, (match, emojiName) => {
        const unicodeEmoji = emojiMap[emojiName.toLowerCase()];

        if (unicodeEmoji) {
            // Class 'custom-emoji' would be defined in a separate CSS file in a real application.
            return `<span class="custom-emoji" role="img" aria-label="${emojiName}">${unicodeEmoji}</span>`;
        } else {
            // If the emoji name is not found in the map, return the original text (e.g., :unknown:)
            return match;
        }
    });
}