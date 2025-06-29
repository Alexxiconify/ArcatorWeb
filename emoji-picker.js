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
      
      <!-- Media Picker Section -->
      <div class="media-picker">
        <div class="media-picker-tabs">
          <button class="media-tab active" data-tab="gif">🎬 GIF</button>
          <button class="media-tab" data-tab="url">🔗 URL</button>
          <button class="media-tab" data-tab="youtube">📺 YouTube</button>
        </div>
        
        <!-- GIF Tab -->
        <div id="gif-tab" class="media-tab-content active">
          <div class="gif-search-container">
            <input type="text" class="gif-search-input" placeholder="Search GIFs..." id="gif-search-input">
          </div>
          <div class="gif-results" id="gif-results">
            <div class="media-loading">Search for GIFs...</div>
          </div>
        </div>
        
        <!-- URL Tab -->
        <div id="url-tab" class="media-tab-content">
          <div class="url-input-container">
            <input type="url" class="url-input" placeholder="Enter media URL (image, video, audio)..." id="media-url-input">
            <div class="url-preview" id="url-preview"></div>
            <div class="media-preview" id="media-preview"></div>
          </div>
          <button class="media-insert-btn" id="insert-media-btn" disabled>Insert Media</button>
        </div>
        
        <!-- YouTube Tab -->
        <div id="youtube-tab" class="media-tab-content">
          <div class="url-input-container">
            <input type="url" class="url-input" placeholder="Enter YouTube URL..." id="youtube-url-input">
            <div class="url-preview" id="youtube-preview"></div>
            <div class="youtube-preview" id="youtube-embed-preview"></div>
          </div>
          <button class="media-insert-btn" id="insert-youtube-btn" disabled>Insert YouTube Video</button>
        </div>
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
 * Initializes the emoji picker with all functionality.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
export function initEmojiPicker(pickerId = 'emoji-picker') {
  const picker = document.getElementById(pickerId);
  if (!picker) return;

  // Initialize emoji functionality
  loadEmojiData();
  
  // Initialize media picker functionality
  initMediaPicker(pickerId);
  
  // Setup event listeners
  setupEmojiPickerEventListeners(pickerId);
  setupMediaPickerEventListeners(pickerId);
  
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
 * Initializes the media picker functionality.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
function initMediaPicker(pickerId) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;

  // Initialize GIF search
  initGifSearch(pickerId);
  
  // Initialize URL validation
  initUrlValidation(pickerId);
  
  // Initialize YouTube validation
  initYouTubeValidation(pickerId);
}

/**
 * Initializes GIF search functionality.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
function initGifSearch(pickerId) {
  const gifSearchInput = document.querySelector(`#${pickerId} #gif-search-input`);
  const gifResults = document.querySelector(`#${pickerId} #gif-results`);
  
  if (!gifSearchInput || !gifResults) return;

  let searchTimeout;
  
  gifSearchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
      gifResults.innerHTML = '<div class="media-loading">Search for GIFs...</div>';
      return;
    }
    
    gifResults.innerHTML = '<div class="media-loading">Searching...</div>';
    
    searchTimeout = setTimeout(() => {
      searchGifs(query, pickerId);
    }, 500);
  });
}

/**
 * Searches for GIFs using GIPHY API.
 * @param {string} query - Search query.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
async function searchGifs(query, pickerId) {
  const gifResults = document.querySelector(`#${pickerId} #gif-results`);
  
  try {
    // Using GIPHY API (you'll need to get an API key)
    const apiKey = 'dc6zaTOxFJmzC'; // Public beta key (limited)
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=12&rating=g`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch GIFs');
    }
    
    const data = await response.json();
    
    if (data.data.length === 0) {
      gifResults.innerHTML = '<div class="media-error">No GIFs found</div>';
      return;
    }
    
    gifResults.innerHTML = data.data.map(gif => `
      <div class="gif-item" onclick="insertGif('${gif.images.fixed_height.url}', '${pickerId}')">
        <img src="${gif.images.fixed_height_small.url}" alt="${gif.title}" loading="lazy">
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error searching GIFs:', error);
    gifResults.innerHTML = '<div class="media-error">Failed to load GIFs</div>';
  }
}

/**
 * Inserts a GIF into the target input.
 * @param {string} gifUrl - The GIF URL to insert.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
window.insertGif = function(gifUrl, pickerId) {
  const container = document.querySelector(`#${pickerId}`).closest('.emoji-input-container');
  const targetInput = container.querySelector('textarea, input');
  
  if (targetInput) {
    const markdown = `![GIF](${gifUrl})`;
    insertAtCursor(targetInput, markdown);
    hideEmojiPicker(pickerId);
  }
};

/**
 * Initializes URL validation for media input.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
function initUrlValidation(pickerId) {
  const urlInput = document.querySelector(`#${pickerId} #media-url-input`);
  const urlPreview = document.querySelector(`#${pickerId} #url-preview`);
  const mediaPreview = document.querySelector(`#${pickerId} #media-preview`);
  const insertBtn = document.querySelector(`#${pickerId} #insert-media-btn`);
  
  if (!urlInput || !urlPreview || !mediaPreview || !insertBtn) return;

  let validationTimeout;
  
  urlInput.addEventListener('input', (e) => {
    clearTimeout(validationTimeout);
    const url = e.target.value.trim();
    
    if (!url) {
      urlPreview.innerHTML = '';
      mediaPreview.innerHTML = '';
      insertBtn.disabled = true;
      return;
    }
    
    urlPreview.innerHTML = 'Validating...';
    mediaPreview.innerHTML = '';
    insertBtn.disabled = true;
    
    validationTimeout = setTimeout(() => {
      validateMediaUrl(url, pickerId);
    }, 500);
  });
  
  insertBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) {
      insertMediaUrl(url, pickerId);
    }
  });
}

/**
 * Validates a media URL and shows preview.
 * @param {string} url - The URL to validate.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
async function validateMediaUrl(url, pickerId) {
  const urlPreview = document.querySelector(`#${pickerId} #url-preview`);
  const mediaPreview = document.querySelector(`#${pickerId} #media-preview`);
  const insertBtn = document.querySelector(`#${pickerId} #insert-media-btn`);
  
  try {
    // Basic URL validation
    const urlObj = new URL(url);
    const extension = urlObj.pathname.split('.').pop()?.toLowerCase();
    
    // Check if it's a valid media file
    const mediaExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'webm', 'ogg', 'mp3', 'wav', 'aac'];
    
    if (!mediaExtensions.includes(extension)) {
      urlPreview.innerHTML = 'Invalid media file format';
      urlPreview.className = 'url-preview error';
      insertBtn.disabled = true;
      return;
    }
    
    // Test if the URL is accessible
    const response = await fetch(url, { method: 'HEAD' });
    
    if (!response.ok) {
      throw new Error('URL not accessible');
    }
    
    urlPreview.innerHTML = 'Valid media URL';
    urlPreview.className = 'url-preview success';
    insertBtn.disabled = false;
    
    // Show preview
    showMediaPreview(url, extension, pickerId);
    
  } catch (error) {
    urlPreview.innerHTML = 'Invalid or inaccessible URL';
    urlPreview.className = 'url-preview error';
    insertBtn.disabled = true;
  }
}

/**
 * Shows a preview of the media.
 * @param {string} url - The media URL.
 * @param {string} extension - The file extension.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
function showMediaPreview(url, extension, pickerId) {
  const mediaPreview = document.querySelector(`#${pickerId} #media-preview`);
  
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const videoExtensions = ['mp4', 'webm', 'ogg'];
  const audioExtensions = ['mp3', 'wav', 'aac'];
  
  if (imageExtensions.includes(extension)) {
    mediaPreview.innerHTML = `<img src="${url}" alt="Preview" onerror="this.style.display='none'">`;
  } else if (videoExtensions.includes(extension)) {
    mediaPreview.innerHTML = `<video controls><source src="${url}" type="video/${extension}">Your browser does not support the video tag.</video>`;
  } else if (audioExtensions.includes(extension)) {
    mediaPreview.innerHTML = `<audio controls><source src="${url}" type="audio/${extension}">Your browser does not support the audio tag.</audio>`;
  }
}

/**
 * Inserts a media URL into the target input.
 * @param {string} url - The media URL to insert.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
function insertMediaUrl(url, pickerId) {
  const container = document.querySelector(`#${pickerId}`).closest('.emoji-input-container');
  const targetInput = container.querySelector('textarea, input');
  
  if (targetInput) {
    const extension = url.split('.').pop()?.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const videoExtensions = ['mp4', 'webm', 'ogg'];
    const audioExtensions = ['mp3', 'wav', 'aac'];
    
    let markdown;
    if (imageExtensions.includes(extension)) {
      markdown = `![Image](${url})`;
    } else if (videoExtensions.includes(extension)) {
      markdown = `![Video](${url})`;
    } else if (audioExtensions.includes(extension)) {
      markdown = `![Audio](${url})`;
    } else {
      markdown = url;
    }
    
    insertAtCursor(targetInput, markdown);
    hideEmojiPicker(pickerId);
  }
}

/**
 * Initializes YouTube URL validation.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
function initYouTubeValidation(pickerId) {
  const urlInput = document.querySelector(`#${pickerId} #youtube-url-input`);
  const urlPreview = document.querySelector(`#${pickerId} #youtube-preview`);
  const embedPreview = document.querySelector(`#${pickerId} #youtube-embed-preview`);
  const insertBtn = document.querySelector(`#${pickerId} #insert-youtube-btn`);
  
  if (!urlInput || !urlPreview || !embedPreview || !insertBtn) return;

  let validationTimeout;
  
  urlInput.addEventListener('input', (e) => {
    clearTimeout(validationTimeout);
    const url = e.target.value.trim();
    
    if (!url) {
      urlPreview.innerHTML = '';
      embedPreview.innerHTML = '';
      insertBtn.disabled = true;
      return;
    }
    
    urlPreview.innerHTML = 'Validating...';
    embedPreview.innerHTML = '';
    insertBtn.disabled = true;
    
    validationTimeout = setTimeout(() => {
      validateYouTubeUrl(url, pickerId);
    }, 500);
  });
  
  insertBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) {
      insertYouTubeUrl(url, pickerId);
    }
  });
}

/**
 * Validates a YouTube URL and shows preview.
 * @param {string} url - The YouTube URL to validate.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
function validateYouTubeUrl(url, pickerId) {
  const urlPreview = document.querySelector(`#${pickerId} #youtube-preview`);
  const embedPreview = document.querySelector(`#${pickerId} #youtube-embed-preview`);
  const insertBtn = document.querySelector(`#${pickerId} #insert-youtube-btn`);
  
  try {
    const videoId = extractYouTubeVideoId(url);
    
    if (!videoId) {
      urlPreview.innerHTML = 'Invalid YouTube URL';
      urlPreview.className = 'url-preview error';
      insertBtn.disabled = true;
      return;
    }
    
    urlPreview.innerHTML = 'Valid YouTube URL';
    urlPreview.className = 'url-preview success';
    insertBtn.disabled = false;
    
    // Show embed preview
    embedPreview.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
    
  } catch (error) {
    urlPreview.innerHTML = 'Invalid YouTube URL';
    urlPreview.className = 'url-preview error';
    insertBtn.disabled = true;
  }
}

/**
 * Extracts video ID from YouTube URL.
 * @param {string} url - The YouTube URL.
 * @returns {string|null} The video ID or null if invalid.
 */
function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Inserts a YouTube URL into the target input.
 * @param {string} url - The YouTube URL to insert.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
function insertYouTubeUrl(url, pickerId) {
  const container = document.querySelector(`#${pickerId}`).closest('.emoji-input-container');
  const targetInput = container.querySelector('textarea, input');
  
  if (targetInput) {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      const markdown = `![YouTube Video](https://www.youtube.com/watch?v=${videoId})`;
      insertAtCursor(targetInput, markdown);
      hideEmojiPicker(pickerId);
    }
  }
}

/**
 * Sets up media picker event listeners.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
function setupMediaPickerEventListeners(pickerId) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;

  // Tab switching
  const tabs = picker.querySelectorAll('.media-tab');
  const tabContents = picker.querySelectorAll('.media-tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${targetTab}-tab`) {
          content.classList.add('active');
        }
      });
    });
  });
}

/**
 * Inserts text at the current cursor position.
 * @param {HTMLElement} input - The input element.
 * @param {string} text - The text to insert.
 */
function insertAtCursor(input, text) {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const value = input.value;
  
  input.value = value.substring(0, start) + text + value.substring(end);
  input.selectionStart = input.selectionEnd = start + text.length;
  
  // Trigger input event
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Sets up emoji picker event listeners.
 * @param {string} pickerId - The ID of the emoji picker element.
 */
function setupEmojiPickerEventListeners(pickerId) {
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