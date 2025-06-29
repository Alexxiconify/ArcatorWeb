// Shared Emoji Picker Module
// This module provides emoji picker functionality that can be used across all pages

let emojiData = [];
let filteredEmojis = [];

/**
 * Loads emoji data from the JSON file.
 */
export async function loadEmojiData() {
  try {
    const response = await fetch('./emojii.json');
    emojiData = await response.json();
    console.log('Emoji data loaded:', emojiData.length, 'emojis');
    return emojiData;
  } catch (error) {
    console.error('Failed to load emoji data:', error);
    emojiData = [];
    return [];
  }
}

/**
 * Toggles the emoji picker visibility.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
export function toggleEmojiPicker(pickerId = 'emoji-picker') {
  const picker = document.getElementById(pickerId);
  if (picker.classList.contains('hidden')) {
    showEmojiPicker(pickerId);
  } else {
    hideEmojiPicker(pickerId);
  }
}

/**
 * Shows the emoji picker and loads emojis.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
export function showEmojiPicker(pickerId = 'emoji-picker') {
  const picker = document.getElementById(pickerId);
  const emojiList = document.getElementById('emoji-list');
  
  if (!picker) {
    console.error('Emoji picker element not found:', pickerId);
    return;
  }
  
  picker.classList.remove('hidden');
  
  // Load emojis if not already loaded
  if (emojiData.length === 0) {
    loadEmojiData().then(() => {
      renderEmojis(emojiData, pickerId);
      positionEmojiPicker(pickerId);
    });
  } else {
    renderEmojis(emojiData, pickerId);
    positionEmojiPicker(pickerId);
  }
  
  // Focus on search input
  setTimeout(() => {
    const searchInput = document.getElementById('emoji-search');
    if (searchInput) {
      searchInput.focus();
    }
  }, 100);
}

/**
 * Positions the emoji picker to ensure it stays within viewport bounds.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
function positionEmojiPicker(pickerId = 'emoji-picker') {
  const picker = document.getElementById(pickerId);
  const container = picker?.closest('.emoji-input-container');
  
  if (!picker || !container) return;
  
  // Reset positioning classes
  picker.classList.remove('position-above', 'position-left', 'position-right');
  
  // Get viewport and element dimensions
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const containerRect = container.getBoundingClientRect();
  
  // Temporarily show picker to get its dimensions
  const wasHidden = picker.classList.contains('hidden');
  if (wasHidden) {
    picker.classList.remove('hidden');
    picker.style.visibility = 'hidden';
  }
  
  const pickerRect = picker.getBoundingClientRect();
  const pickerHeight = pickerRect.height;
  const pickerWidth = pickerRect.width;
  
  // Hide picker again if it was hidden
  if (wasHidden) {
    picker.classList.add('hidden');
    picker.style.visibility = '';
  }
  
  // Check vertical positioning
  const spaceBelow = viewportHeight - containerRect.bottom;
  const spaceAbove = containerRect.top;
  
  // If not enough space below but enough space above, position above
  if (spaceBelow < pickerHeight && spaceAbove > pickerHeight) {
    picker.classList.add('position-above');
  }
  
  // Check horizontal positioning
  // If picker would overflow right side, align to right
  if (containerRect.left + pickerWidth > viewportWidth) {
    picker.classList.add('position-right');
  }
  // If picker would overflow left side, align to left
  else if (containerRect.right - pickerWidth < 0) {
    picker.classList.add('position-left');
  }
}

/**
 * Hides the emoji picker.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
export function hideEmojiPicker(pickerId = 'emoji-picker') {
  const picker = document.getElementById(pickerId);
  if (picker) {
    picker.classList.add('hidden');
  }
}

/**
 * Renders emojis in the picker.
 * @param {Array} emojis - Array of emoji objects.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
export function renderEmojis(emojis, pickerId = 'emoji-picker') {
  const picker = document.getElementById(pickerId);
  const emojiList = picker?.querySelector('.emoji-list');
  
  if (!emojiList) {
    console.error('Emoji list element not found in picker:', pickerId);
    return;
  }
  
  emojiList.innerHTML = '';
  
  emojis.forEach(emoji => {
    const emojiElement = document.createElement('div');
    emojiElement.className = 'emoji-item';
    emojiElement.textContent = emoji.emoji;
    emojiElement.title = emoji.name;
    emojiElement.onclick = () => insertEmoji(`:${emoji.name}:`, pickerId);
    emojiList.appendChild(emojiElement);
  });
}

/**
 * Inserts an emoji into the target input/textarea.
 * @param {string} emojiCode - The emoji code to insert (e.g., ":smile:").
 * @param {string} pickerId - The ID of the emoji picker element.
 * @param {string} targetId - The ID of the target input/textarea element.
 */
export function insertEmoji(emojiCode, pickerId = 'emoji-picker', targetId = null) {
  // Find the target input/textarea
  let targetElement = null;
  
  if (targetId) {
    targetElement = document.getElementById(targetId);
  } else {
    // Try to find the input/textarea in the same container as the picker
    const picker = document.getElementById(pickerId);
    if (picker) {
      const container = picker.closest('.emoji-input-container');
      if (container) {
        targetElement = container.querySelector('textarea, input[type="text"]');
      }
    }
  }
  
  if (!targetElement) {
    console.error('Target input/textarea not found for emoji insertion');
    return;
  }
  
  const start = targetElement.selectionStart;
  const end = targetElement.selectionEnd;
  const text = targetElement.value;
  
  // Insert the emoji code at cursor position
  const newText = text.substring(0, start) + emojiCode + text.substring(end);
  targetElement.value = newText;
  
  // Set cursor position after the inserted emoji
  const newCursorPos = start + emojiCode.length;
  targetElement.setSelectionRange(newCursorPos, newCursorPos);
  
  // Focus back on input/textarea
  targetElement.focus();
  
  // Trigger input event to notify any listeners
  targetElement.dispatchEvent(new Event('input', { bubbles: true }));
  
  // Hide emoji picker
  hideEmojiPicker(pickerId);
}

/**
 * Filters emojis based on search term.
 * @param {string} searchTerm - The search term.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
export function filterEmojis(searchTerm, pickerId = 'emoji-picker') {
  if (!searchTerm.trim()) {
    filteredEmojis = emojiData;
  } else {
    filteredEmojis = emojiData.filter(emoji => 
      emoji.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  renderEmojis(filteredEmojis, pickerId);
}

/**
 * Creates an emoji picker HTML structure.
 * @param {string} pickerId - The ID for the emoji picker element.
 * @returns {string} The HTML string for the emoji picker.
 */
export function createEmojiPickerHTML(pickerId = 'emoji-picker') {
  return `
    <div id="${pickerId}" class="emoji-picker hidden">
      <div class="emoji-picker-header">
        <input type="text" id="emoji-search" placeholder="Search emojis..." class="emoji-search">
      </div>
      <div id="emoji-list" class="emoji-list">
        <!-- Emojis will be loaded here -->
      </div>
    </div>
  `;
}

/**
 * Creates an emoji input container with picker button.
 * @param {string} inputId - The ID of the input/textarea element.
 * @param {string} pickerId - The ID for the emoji picker element.
 * @param {string} inputType - The type of input ('textarea' or 'text').
 * @param {string} placeholder - Placeholder text for the input.
 * @param {string} className - Additional CSS classes for the input.
 * @returns {string} The HTML string for the emoji input container.
 */
export function createEmojiInputContainer(inputId, pickerId = 'emoji-picker', inputType = 'textarea', placeholder = '', className = '') {
  const inputTag = inputType === 'textarea' ? 'textarea' : 'input';
  const inputAttributes = inputType === 'textarea' ? 'rows="4"' : 'type="text"';
  
  return `
    <div class="emoji-input-container">
      <${inputTag} 
        id="${inputId}" 
        ${inputAttributes}
        placeholder="${placeholder}"
        class="${className}"
        required
      ></${inputTag}>
      <button type="button" class="emoji-picker-btn" onclick="toggleEmojiPicker('${pickerId}')" title="Add emoji">
        😊
      </button>
      ${createEmojiPickerHTML(pickerId)}
    </div>
  `;
}

/**
 * Initializes emoji picker functionality for a page.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
export function initEmojiPicker(pickerId = 'emoji-picker') {
  // Setup emoji search functionality
  const emojiSearch = document.getElementById('emoji-search');
  if (emojiSearch) {
    emojiSearch.addEventListener('input', (e) => {
      filterEmojis(e.target.value, pickerId);
    });
  }

  // Close emoji picker when clicking outside
  document.addEventListener('click', (e) => {
    const picker = document.getElementById(pickerId);
    const pickerBtn = document.querySelector('.emoji-picker-btn');
    
    if (picker && !picker.classList.contains('hidden') && 
        !picker.contains(e.target) && 
        !pickerBtn?.contains(e.target)) {
      hideEmojiPicker(pickerId);
    }
  });

  // Reposition picker on window resize
  window.addEventListener('resize', () => {
    const picker = document.getElementById(pickerId);
    if (picker && !picker.classList.contains('hidden')) {
      positionEmojiPicker(pickerId);
    }
  });

  // Reposition picker on scroll
  window.addEventListener('scroll', () => {
    const picker = document.getElementById(pickerId);
    if (picker && !picker.classList.contains('hidden')) {
      positionEmojiPicker(pickerId);
    }
  }, { passive: true });

  // Load emoji data
  loadEmojiData();
}

/**
 * Converts markdown text to HTML safely with emoji support.
 * @param {string} markdown - The markdown text to convert.
 * @param {Function} replaceEmojis - Function to replace emoji codes with actual emojis.
 * @returns {string} The converted HTML.
 */
export function markdownToHtml(markdown, replaceEmojis = null) {
  if (!markdown) return '';
  
  try {
    // First, replace emojis in the text if function is provided
    let processedText = markdown;
    if (replaceEmojis && typeof replaceEmojis === 'function') {
      processedText = replaceEmojis(markdown);
    }
    
    // Configure marked for safe rendering
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true, // Convert line breaks to <br>
        gfm: true, // GitHub Flavored Markdown
        sanitize: false, // We'll handle sanitization ourselves
        smartLists: true,
        smartypants: true
      });

      // Convert markdown to HTML
      const html = marked.parse(processedText);
      
      // Basic sanitization to prevent XSS
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Remove any script tags and other potentially dangerous elements
      const scripts = tempDiv.querySelectorAll('script, iframe, object, embed, form, input, button, select, textarea');
      scripts.forEach(el => el.remove());
      
      // Remove any onclick, onload, etc. attributes
      const allElements = tempDiv.querySelectorAll('*');
      allElements.forEach(el => {
        const attrs = el.attributes;
        for (let i = attrs.length - 1; i >= 0; i--) {
          const attr = attrs[i];
          if (attr.name.startsWith('on') || attr.name.startsWith('javascript:')) {
            el.removeAttribute(attr.name);
          }
        }
      });
      
      return tempDiv.innerHTML;
    } else {
      // Fallback if marked is not available
      return processedText.replace(/[&<>"']/g, function(match) {
        const escape = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };
        return escape[match];
      });
    }
  } catch (error) {
    console.error('Error converting markdown to HTML:', error);
    // Return escaped HTML if conversion fails
    return markdown.replace(/[&<>"']/g, function(match) {
      const escape = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return escape[match];
    });
  }
}

// Make functions globally available for backward compatibility
window.toggleEmojiPicker = toggleEmojiPicker;
window.insertEmoji = insertEmoji;
window.filterEmojis = filterEmojis;
window.createEmojiPickerHTML = createEmojiPickerHTML;
window.createEmojiInputContainer = createEmojiInputContainer;
window.initEmojiPicker = initEmojiPicker;
window.markdownToHtml = markdownToHtml;