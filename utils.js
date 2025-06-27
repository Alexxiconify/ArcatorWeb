// utils.js - Centralized utility functions for the Arcator website

// Message box functionality
let messageBox;
let messageBoxTimeout;

/**
 * Shows a message box with the given message and error status.
 * @param {string} message - The message to display.
 * @param {boolean} isError - Whether this is an error message.
 */
export function showMessageBox(message, isError = false) {
  if (!messageBox) {
    messageBox = document.getElementById('message-box');
  }
  if (!messageBox) return;

  messageBox.textContent = message;
  messageBox.className = 'message-box ' + (isError ? 'error' : 'success') + ' show';

  if (messageBoxTimeout) {
    clearTimeout(messageBoxTimeout);
  }

  messageBoxTimeout = setTimeout(() => {
    messageBox.className = 'message-box';
  }, 3000);
}

/**
 * Sanitizes a string to be suitable for a user handle.
 * Allows only alphanumeric characters, dots, and underscores, converting to lowercase.
 * @param {string} input - The raw input string.
 * @returns {string} The sanitized handle.
 */
export function sanitizeHandle(input) {
  return input.toLowerCase().replace(/[^a-z0-9_.]/g, '');
}

/**
 * Validates a photo URL and returns a safe URL or default.
 * @param {string} photoURL - The URL to validate.
 * @param {string} defaultPic - The default URL to return if validation fails.
 * @returns {string} The validated URL or default.
 */
export function validatePhotoURL(photoURL, defaultPic) {
  if (!photoURL || photoURL === defaultPic) {
    console.log('[DEBUG] validatePhotoURL: Using default picture');
    return defaultPic;
  }

  console.log('[DEBUG] validatePhotoURL: Validating URL:', photoURL);

  try {
    const url = new URL(photoURL);
    const allowedDomains = [
      'placehold.co',
      'placehold.jp',
      'placehold.com',
      'via.placeholder.com',
      'picsum.photos',
      'lorempixel.com',
      'loremflickr.com',
      'imgur.com',
      'i.imgur.com',
      'ibb.co',
      'i.ibb.co',
      'imgbb.com',
      'i.imgbb.com',
      'cloudinary.com',
      'res.cloudinary.com',
      'uploadcare.com',
      'ucarecdn.com',
      'postimages.org',
      'i.postimg.cc',
      'discordapp.com',
      'cdn.discordapp.com',
      'discord.com',
      'cdn.discord.com'
    ];

    const domain = url.hostname.toLowerCase();
    const isAllowed = allowedDomains.some(allowed => domain === allowed || domain.endsWith('.' + allowed));

    if (isAllowed) {
      console.log('[DEBUG] validatePhotoURL: Domain allowed:', domain);
      return photoURL;
    } else {
      console.log('[DEBUG] validatePhotoURL: Domain not in allowed list:', domain);
      return defaultPic;
    }
  } catch (error) {
    console.error('[DEBUG] validatePhotoURL: Error parsing URL:', error);
    return defaultPic;
  }
}

/**
 * Tests if a URL is accessible and returns a valid image
 * @param {string} url - The URL to test
 * @returns {Promise<boolean>} True if the URL is accessible
 */
export async function testImageURL(url) {
  if (!url) return false;

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors' // This allows testing cross-origin URLs
    });

    // For no-cors requests, we can't check the status, so we'll assume it's valid
    // and let the browser handle the actual image loading
    return true;
  } catch (error) {
    console.warn('[DEBUG] testImageURL: Failed to test URL:', url, error);
    return false;
  }
}

/**
 * Validates and tests a photo URL, falling back to default if it fails
 * @param {string} photoURL - The URL to validate and test
 * @param {string} defaultPic - The default URL to return if validation fails
 * @returns {Promise<string>} The validated URL or default
 */
export async function validateAndTestPhotoURL(photoURL, defaultPic) {
  const validatedURL = validatePhotoURL(photoURL, defaultPic);

  if (validatedURL === defaultPic) {
    return defaultPic;
  }

  // Check if it's a Discord URL and attempt conversion to ImgBB album
  if (validatedURL.includes('discordapp.com') || validatedURL.includes('discord.com')) {
    console.log('[DEBUG] validateAndTestPhotoURL: Discord URL detected, attempting conversion to ImgBB album');

    try {
      const convertedURL = await convertDiscordUrlToReliableCDN(validatedURL);

      if (convertedURL && convertedURL !== validatedURL && !convertedURL.includes('placehold.co')) {
        console.log('[DEBUG] validateAndTestPhotoURL: Successfully converted Discord URL to ImgBB album:', convertedURL);

        // Automatically update the user's profile with the new ImgBB URL
        if (window.currentUser && window.auth && window.auth.currentUser) {
          try {
            const {setUserProfileInFirestore} = await import('./firebase-init.js');
            const success = await setUserProfileInFirestore(window.auth.currentUser.uid, {
              photoURL: convertedURL
            });

            if (success) {
              // Update local user object
              window.currentUser.photoURL = convertedURL;

              // Refresh navbar profile picture
              if (typeof window.refreshNavbarProfilePicture === 'function') {
                await window.refreshNavbarProfilePicture();
              }

              console.log('[DEBUG] validateAndTestPhotoURL: User profile automatically updated with ImgBB URL');

              // Show success message if available
              if (typeof window.showMessageBox === 'function') {
                window.showMessageBox('Discord image automatically converted to ImgBB and profile updated!', false);
              }
            }
          } catch (profileError) {
            console.error('[DEBUG] validateAndTestPhotoURL: Error updating user profile:', profileError);
          }
        }

        return convertedURL;
      } else {
        console.log('[DEBUG] validateAndTestPhotoURL: Discord URL conversion failed or not needed');
      }
    } catch (error) {
      console.error('[DEBUG] validateAndTestPhotoURL: Error converting Discord URL:', error);
    }
  }

  // Handle ImgBB short URLs - convert to direct image URLs
  let finalURL = validatedURL;
  if (validatedURL.includes('ibb.co/') && !validatedURL.includes('i.ibb.co/')) {
    console.log('[DEBUG] validateAndTestPhotoURL: ImgBB short URL detected, attempting to convert to direct URL');

    try {
      // Try to fetch the short URL to get the redirect location
      const response = await fetch(validatedURL, {
        method: 'HEAD',
        redirect: 'follow'
      });

      if (response.ok && response.url !== validatedURL) {
        // Check if the redirect URL is a direct image URL
        if (response.url.includes('i.ibb.co/') || response.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          finalURL = response.url;
          console.log('[DEBUG] validateAndTestPhotoURL: Converted ImgBB short URL to direct URL:', finalURL);
        }
      }
    } catch (error) {
      console.warn('[DEBUG] validateAndTestPhotoURL: Could not convert ImgBB short URL:', error);
    }
  }

  // Test the URL to ensure it's accessible
  try {
    const isAccessible = await testImageURL(finalURL);
    if (isAccessible) {
      return finalURL;
    } else {
      console.warn('[DEBUG] validateAndTestPhotoURL: URL not accessible, using default');
      return defaultPic;
    }
  } catch (error) {
    console.error('[DEBUG] validateAndTestPhotoURL: Error testing URL:', error);
    return defaultPic;
  }
}

// Custom confirmation modal elements
let customConfirmModal;
let confirmMessage;
let confirmSubmessage;
let confirmYesButton;
let confirmNoButton;
let closeButton;
let resolveConfirmPromise;

/**
 * Initializes utility DOM elements.
 */
function initializeUtilityElements() {
  try {
    messageBox = document.getElementById('message-box');
    customConfirmModal = document.getElementById('custom-confirm-modal');
    confirmMessage = document.getElementById('confirm-message');
    confirmSubmessage = document.getElementById('confirm-submessage');
    confirmYesButton = document.getElementById('confirm-yes');
    confirmNoButton = document.getElementById('confirm-no');
    closeButton = document.querySelector('.custom-confirm-modal .close-button');

    if (customConfirmModal && (customConfirmModal.style.display === '' || customConfirmModal.style.display === 'block')) {
      customConfirmModal.style.display = 'none';
    }
  } catch (e) {
    console.error('Error in initializeUtilityElements:', e);
  }
}

/**
 * Displays a custom confirmation modal to the user.
 * @param {string} message - The main message for the confirmation.
 * @param {string} submessage - An optional sub-message for more details.
 * @returns {Promise<boolean>} A promise that resolves to true if 'Yes' is clicked, false otherwise.
 */
export function showCustomConfirm(message, submessage = '') {
  if (!customConfirmModal || !confirmMessage || !confirmYesButton || !confirmNoButton || !closeButton) {
    console.error("Custom confirmation modal elements not found.");
    return Promise.resolve(false);
  }

  confirmMessage.textContent = message;
  confirmSubmessage.textContent = submessage;
  customConfirmModal.style.display = 'flex';

  return new Promise((resolve) => {
    resolveConfirmPromise = resolve;

    confirmYesButton.onclick = () => {
      customConfirmModal.style.display = 'none';
      resolveConfirmPromise(true);
    };

    confirmNoButton.onclick = () => {
      customConfirmModal.style.display = 'none';
      resolveConfirmPromise(false);
    };

    closeButton.onclick = () => {
      customConfirmModal.style.display = 'none';
      resolveConfirmPromise(false);
    };

    customConfirmModal.onclick = (event) => {
      if (event.target === customConfirmModal) {
        customConfirmModal.style.display = 'none';
        resolveConfirmPromise(false);
      }
    };
  });
}

// Initialize elements when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUtilityElements);
} else {
  initializeUtilityElements();
}

// Additional utility functions that are used across multiple files
export function parseEmojis(text) {
  // Basic emoji parsing - can be enhanced
  return text;
}

export function parseMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}

export async function resolveHandlesToUids(handles, db, appId) {
  if (!db || !handles || handles.length === 0) return [];

  const {
    collection,
    query,
    where,
    getDocs
  } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
  const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);

  const uids = [];
  for (const handle of handles) {
    const q = query(usersRef, where('handle', '==', handle));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      uids.push(snapshot.docs[0].id);
    }
  }
  return uids;
}

export async function getUserProfileFromFirestore(uid, db, appId) {
  if (!db || !uid) return null;

  const {doc, getDoc} = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) return docSnap.data();
  } catch (error) {
    console.error("Error fetching user profile:", error);
  }
  return null;
}

/**
 * Converts a Discord CDN URL to ImgBB
 * @param {string} discordURL - The Discord CDN URL to convert
 * @returns {Promise<string>} The converted ImgBB URL or original if conversion fails
 */
export async function convertDiscordUrlToReliableCDN(discordURL) {
  if (!discordURL || !discordURL.includes('discordapp.com')) {
    console.log('[DEBUG] convertDiscordUrlToReliableCDN: Not a Discord URL, returning original');
    return discordURL;
  }

  console.log('[DEBUG] convertDiscordUrlToReliableCDN: Converting Discord URL to ImgBB album:', discordURL);

  try {
    // Automatically upload to the user's ImgBB album
    const albumId = 'fQYJLf'; // User's album ID from https://ibb.co/album/fQYJLf
    const imgbbURL = await uploadImageToImgBB(discordURL, albumId);

    if (imgbbURL && imgbbURL !== discordURL) {
      console.log('[DEBUG] convertDiscordUrlToReliableCDN: Successfully converted to ImgBB album:', imgbbURL);
      console.log('[DEBUG] Image uploaded to album: https://ibb.co/album/fQYJLf');
      return imgbbURL;
    } else {
      console.warn('[DEBUG] convertDiscordUrlToReliableCDN: Failed to convert to ImgBB album, returning original');
      return discordURL;
    }

  } catch (error) {
    console.error('[DEBUG] convertDiscordUrlToReliableCDN: Error converting Discord URL:', error);
    return discordURL;
  }
}

/**
 * Uploads an image to ImgBB using the provided API key
 * @param {string} imageURL - The image URL to upload (can be Discord CDN URL)
 * @param {string} albumId - Optional album ID to upload to
 * @returns {Promise<string>} The ImgBB direct link URL or original URL if upload fails
 */
export async function uploadImageToImgBB(imageURL, albumId = null) {
  if (!imageURL) {
    console.log('[DEBUG] uploadImageToImgBB: No image URL provided');
    return imageURL;
  }

  console.log('[DEBUG] uploadImageToImgBB: Starting upload for:', imageURL);
  if (albumId) {
    console.log('[DEBUG] uploadImageToImgBB: Uploading to album:', albumId);
  }

  try {
    // ImgBB API key
    const API_KEY = 'be3e5a6ea3ef9be8d6da68fbed08d75e';
    const API_URL = 'https://api.imgbb.com/1/upload';

    // Create form data for the upload
    const formData = new FormData();
    formData.append('key', API_KEY);
    formData.append('image', imageURL);

    // Add album ID if provided
    if (albumId) {
      formData.append('album', albumId);
    }

    // Make the API request
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`ImgBB API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success && data.data && data.data.url) {
      console.log('[DEBUG] uploadImageToImgBB: Successfully uploaded to ImgBB:', data.data.url);
      if (albumId) {
        console.log('[DEBUG] uploadImageToImgBB: Image added to album:', albumId);
      }
      return data.data.url; // This is the direct link to the image
    } else {
      console.error('[DEBUG] uploadImageToImgBB: ImgBB API returned error:', data.error?.message || 'Unknown error');
      return imageURL; // Return original URL if upload fails
    }

  } catch (error) {
    console.error('[DEBUG] uploadImageToImgBB: Error uploading to ImgBB:', error);
    return imageURL; // Return original URL if upload fails
  }
}

/**
 * Converts a Discord URL and uploads it to a specific ImgBB album
 * @param {string} discordURL - The Discord CDN URL to convert
 * @param {string} albumId - The ImgBB album ID to upload to
 * @returns {Promise<string>} The converted ImgBB URL or original URL if conversion fails
 */
export async function convertDiscordUrlToImgBBAlbum(discordURL, albumId) {
  if (!discordURL || !discordURL.includes('discordapp.com')) {
    console.log('[DEBUG] convertDiscordUrlToImgBBAlbum: Not a Discord URL, returning original');
    return discordURL;
  }

  if (!albumId) {
    console.error('[DEBUG] convertDiscordUrlToImgBBAlbum: No album ID provided');
    return discordURL;
  }

  console.log('[DEBUG] convertDiscordUrlToImgBBAlbum: Converting Discord URL to ImgBB album:', discordURL, 'Album:', albumId);

  try {
    // Upload the Discord image to the specified ImgBB album
    const imgbbURL = await uploadImageToImgBB(discordURL, albumId);

    if (imgbbURL && imgbbURL !== discordURL) {
      console.log('[DEBUG] convertDiscordUrlToImgBBAlbum: Successfully converted to ImgBB album:', imgbbURL);
      return imgbbURL;
    } else {
      console.warn('[DEBUG] convertDiscordUrlToImgBBAlbum: Failed to convert to ImgBB album, returning original');
      return discordURL;
    }

  } catch (error) {
    console.error('[DEBUG] convertDiscordUrlToImgBBAlbum: Error converting Discord URL:', error);
    return discordURL;
  }
}

/**
 * Provides a list of recommended CDN services for profile pictures
 * @returns {Array} Array of CDN service objects with name, URL, and description
 */
export function getRecommendedCDNServices() {
  return [
    {
      name: 'ImgBB',
      url: 'https://imgbb.com/',
      description: 'Free image hosting with direct links (Recommended)',
      features: ['Free', 'No registration required', 'Direct links', 'Reliable', '32MB limit'],
      recommended: true
    },
    {
      name: 'Imgur',
      url: 'https://imgur.com/',
      description: 'Popular image hosting platform',
      features: ['Free', 'Community features', 'Direct links', 'Stable']
    },
    {
      name: 'Cloudinary',
      url: 'https://cloudinary.com/',
      description: 'Professional image management platform',
      features: ['Free tier available', 'Image transformations', 'CDN', 'Professional']
    },
    {
      name: 'Uploadcare',
      url: 'https://uploadcare.com/',
      description: 'Developer-friendly file upload service',
      features: ['Free tier', 'API access', 'CDN', 'Developer tools']
    },
    {
      name: 'Postimages',
      url: 'https://postimages.org/',
      description: 'Simple image hosting service',
      features: ['Free', 'Simple', 'Direct links', 'No registration']
    }
  ];
}

/**
 * Creates a simple image upload helper for users
 * @param {string} targetElementId - ID of element to show upload options
 */
export function createImageUploadHelper(targetElementId) {
  const targetElement = document.getElementById(targetElementId);
  if (!targetElement) {
    console.error('[DEBUG] createImageUploadHelper: Target element not found:', targetElementId);
    return;
  }

  const helperHTML = `
    <div class="image-upload-helper" style="background: var(--color-bg-card); border: 1px solid var(--color-input-border); border-radius: 0.5rem; padding: 1rem; margin: 1rem 0;">
      <h4 style="margin: 0 0 0.5rem 0; color: var(--color-text-primary);">🔄 Discord Image Conversion</h4>
      <p style="margin: 0 0 1rem 0; color: var(--color-text-secondary); font-size: 0.875rem;">
        Your Discord image link appears to be broken. We recommend converting it to ImgBB for better reliability:
      </p>

      <div style="background: var(--color-button-blue-bg); border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
        <h5 style="margin: 0 0 0.5rem 0; color: white; font-size: 1rem;">🎯 Recommended: ImgBB Conversion</h5>
        <p style="margin: 0 0 1rem 0; color: rgba(255,255,255,0.9); font-size: 0.875rem;">
          ImgBB provides reliable, permanent image hosting that won't expire like Discord CDN links.
        </p>
        <a href="https://imgbb.com/" target="_blank" rel="noopener noreferrer"
           style="background: white; color: var(--color-button-blue-bg); padding: 0.75rem 1.5rem; border-radius: 0.375rem; text-decoration: none; font-weight: 600; display: inline-block;">
          🖼️ Convert to ImgBB
        </a>
      </div>

      <div style="background: var(--color-input-bg); border: 1px solid var(--color-input-border); border-radius: 0.375rem; padding: 0.75rem; margin-bottom: 1rem;">
        <p style="margin: 0 0 0.5rem 0; color: var(--color-text-primary); font-size: 0.875rem; font-weight: 600;">
          Quick Conversion Steps:
        </p>
        <ol style="margin: 0; padding-left: 1.5rem; color: var(--color-text-secondary); font-size: 0.875rem;">
          <li>Click "Convert to ImgBB" above</li>
          <li>Click "Start uploading" on ImgBB</li>
          <li>Upload your Discord image file</li>
          <li>Copy the direct link (ends with .jpg, .png, etc.)</li>
          <li>Paste it in your profile settings below</li>
        </ol>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        <span style="color: var(--color-text-secondary); font-size: 0.875rem; margin-right: 0.5rem;">Other options:</span>
        <a href="https://imgur.com/" target="_blank" rel="noopener noreferrer"
           style="background: var(--color-button-green-bg); color: white; padding: 0.5rem 1rem; border-radius: 0.375rem; text-decoration: none; font-size: 0.875rem;">
          📷 Imgur
        </a>
        <a href="https://postimages.org/" target="_blank" rel="noopener noreferrer"
           style="background: var(--color-button-purple-bg); color: white; padding: 0.5rem 1rem; border-radius: 0.375rem; text-decoration: none; font-size: 0.875rem;">
          ⬆️ Postimages
        </a>
      </div>
    </div>
  `;

  targetElement.innerHTML = helperHTML;
}

// Make functions available globally for browser console access
if (typeof window !== 'undefined') {
  window.convertDiscordUrlToReliableCDN = convertDiscordUrlToReliableCDN;
  window.uploadImageToImgBB = uploadImageToImgBB;
  window.convertDiscordUrlToImgBBAlbum = convertDiscordUrlToImgBBAlbum;
  window.getRecommendedCDNServices = getRecommendedCDNServices;
  window.createImageUploadHelper = createImageUploadHelper;

  /**
   * Converts an ImgBB short URL to a direct image URL
   * Can be called from browser console: window.convertImgBBShortUrl('https://ibb.co/CKwQLThD')
   * @param {string} shortUrl - The ImgBB short URL to convert
   * @returns {Promise<string>} The direct image URL or original if conversion fails
   */
  window.convertImgBBShortUrl = async function (shortUrl) {
    console.log('[DEBUG] convertImgBBShortUrl called with:', shortUrl);

    if (!shortUrl || !shortUrl.includes('ibb.co/')) {
      console.error('[DEBUG] Not an ImgBB URL provided');
      return shortUrl;
    }

    if (shortUrl.includes('i.ibb.co/')) {
      console.log('[DEBUG] Already a direct ImgBB URL');
      return shortUrl;
    }

    try {
      console.log('[DEBUG] Attempting to convert ImgBB short URL to direct URL...');

      // Try to fetch the short URL to get the redirect location
      const response = await fetch(shortUrl, {
        method: 'HEAD',
        redirect: 'follow'
      });

      if (response.ok && response.url !== shortUrl) {
        // Check if the redirect URL is a direct image URL
        if (response.url.includes('i.ibb.co/') || response.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          const directUrl = response.url;
          console.log('[DEBUG] Successfully converted ImgBB short URL to direct URL:', directUrl);
          return directUrl;
        }
      }

      console.warn('[DEBUG] Could not convert ImgBB short URL to direct URL');
      return shortUrl;

    } catch (error) {
      console.error('[DEBUG] Error converting ImgBB short URL:', error);
      return shortUrl;
    }
  };

  /**
   * Converts an ImgBB short URL and updates the user's profile
   * Can be called from browser console: window.convertAndUpdateImgBBUrl('https://ibb.co/CKwQLThD')
   * @param {string} shortUrl - The ImgBB short URL to convert and update
   */
  window.convertAndUpdateImgBBUrl = async function (shortUrl) {
    console.log('[DEBUG] convertAndUpdateImgBBUrl called with:', shortUrl);

    if (!window.currentUser || !window.auth.currentUser) {
      console.error('[DEBUG] No user logged in, cannot update profile');
      return;
    }

    try {
      // Convert the short URL to direct URL
      const directUrl = await window.convertImgBBShortUrl(shortUrl);

      if (directUrl !== shortUrl) {
        console.log('[DEBUG] ImgBB URL converted successfully, updating profile...');

        // Update the user's profile
        const {setUserProfileInFirestore} = await import('./firebase-init.js');
        const success = await setUserProfileInFirestore(window.auth.currentUser.uid, {
          photoURL: directUrl
        });

        if (success) {
          // Update local user object
          window.currentUser.photoURL = directUrl;

          // Refresh navbar profile picture
          if (typeof window.refreshNavbarProfilePicture === 'function') {
            await window.refreshNavbarProfilePicture();
          }

          console.log('[DEBUG] Profile updated successfully with direct ImgBB URL');

          // Show success message if available
          if (typeof window.showMessageBox === 'function') {
            window.showMessageBox('ImgBB URL converted and profile updated successfully!', false);
          }
        } else {
          console.error('[DEBUG] Failed to update profile in Firestore');
        }
      } else {
        console.log('[DEBUG] ImgBB URL conversion not needed or failed');
      }

    } catch (error) {
      console.error('[DEBUG] Error converting and updating ImgBB URL:', error);
    }
  };

  /**
   * Global function to convert Discord URL to ImgBB and update user profile
   * Can be called from browser console: window.convertAndUpdateDiscordProfile(discordURL)
   * @param {string} discordURL - The Discord URL to convert
   */
  window.convertAndUpdateDiscordProfile = async function (discordURL) {
    console.log('[DEBUG] convertAndUpdateDiscordProfile called with:', discordURL);

    if (!discordURL || !discordURL.includes('discordapp.com')) {
      console.error('[DEBUG] Not a Discord URL provided');
      return;
    }

    if (!window.currentUser || !window.auth.currentUser) {
      console.error('[DEBUG] No user logged in, cannot convert Discord URL');
      return;
    }

    try {
      const convertedURL = await convertDiscordUrlToReliableCDN(discordURL);

      if (convertedURL && convertedURL !== discordURL) {
        console.log('[DEBUG] Discord URL converted successfully, updating profile...');

        // Update the user's profile
        const {setUserProfileInFirestore} = await import('./firebase-init.js');
        const success = await setUserProfileInFirestore(window.auth.currentUser.uid, {
          photoURL: convertedURL
        });

        if (success) {
          // Update local user object
          window.currentUser.photoURL = convertedURL;

          // Refresh navbar profile picture
          if (typeof window.refreshNavbarProfilePicture === 'function') {
            await window.refreshNavbarProfilePicture();
          }

          console.log('[DEBUG] Profile updated successfully with ImgBB URL');

          // Show success message if available
          if (typeof window.showMessageBox === 'function') {
            window.showMessageBox('Discord image converted to ImgBB and profile updated!', false);
          }
        } else {
          console.error('[DEBUG] Failed to update profile in Firestore');
        }
      } else {
        console.log('[DEBUG] Discord URL conversion failed or not needed');
      }

    } catch (error) {
      console.error('[DEBUG] Error converting Discord URL:', error);
    }
  };

  /**
   * Specific function to convert the user's Discord image to their ImgBB album
   * Can be called from browser console: window.convertMyDiscordImage()
   */
  window.convertMyDiscordImage = async function () {
    const discordURL = 'https://cdn.discordapp.com/attachments/706576042189651968/1384285596242935910/89748403.png';
    const albumId = 'fQYJLf'; // Extracted from https://ibb.co/album/fQYJLf

    console.log('[DEBUG] Converting your Discord image to ImgBB album...');
    console.log('[DEBUG] Discord URL:', discordURL);
    console.log('[DEBUG] Album ID:', albumId);

    try {
      const convertedURL = await convertDiscordUrlToImgBBAlbum(discordURL, albumId);

      if (convertedURL && convertedURL !== discordURL) {
        console.log('[DEBUG] Successfully converted Discord image to ImgBB album:', convertedURL);

        // Update the user's profile if logged in
        if (window.currentUser && window.auth.currentUser) {
          const {setUserProfileInFirestore} = await import('./firebase-init.js');
          const success = await setUserProfileInFirestore(window.auth.currentUser.uid, {
            photoURL: convertedURL
          });

          if (success) {
            window.currentUser.photoURL = convertedURL;

            if (typeof window.refreshNavbarProfilePicture === 'function') {
              await window.refreshNavbarProfilePicture();
            }

            console.log('[DEBUG] Profile updated with your ImgBB album image!');

            if (typeof window.showMessageBox === 'function') {
              window.showMessageBox('Your Discord image has been converted and profile updated!', false);
            }
          }
        }

        return convertedURL;
      } else {
        console.log('[DEBUG] Discord image conversion failed or not needed');
        return discordURL;
      }

    } catch (error) {
      console.error('[DEBUG] Error converting Discord image:', error);
      return discordURL;
    }
  };
}
