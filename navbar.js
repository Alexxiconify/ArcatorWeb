// navbar.js - Self-contained navbar component with embedded CSS and HTML
// Combines navbar.css, navbar.html, and navbar.js into a single file

import { auth, db, appId, getUserProfileFromFirestore, firebaseReadyPromise, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, onAuthStateChanged, currentUser } from './firebase-init.js';
import { applyTheme, getAvailableThemes } from './themes.js';
import {validatePhotoURL} from './utils.js';

// Embedded CSS styles
const navbarStyles = `
/* navbar.css - Clean, modern navbar styling */
.navbar-bg {
  background-color: var(--color-bg-navbar, #111827);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}

.navbar-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 48px;
  padding: 0 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.navbar-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-primary, #E5E7EB);
  text-decoration: none;
  transition: color 0.2s ease;
}

.navbar-logo:hover {
  color: var(--color-link, #60A5FA);
}

.navbar-logo svg {
  height: 1.25rem;
  width: 1.25rem;
  color: var(--color-link, #60A5FA);
}

.navbar-links {
  display: flex;
  align-items: center;
  gap: 1rem;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.navbar-links::-webkit-scrollbar {
  display: none;
}

.navbar-link {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary, #E5E7EB);
  text-decoration: none;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.navbar-link:hover {
  color: var(--color-link, #60A5FA);
  background-color: rgba(255, 255, 255, 0.1);
}

.navbar-link svg {
  height: 1.25rem;
  width: 1.25rem;
  margin-right: 0.25rem;
}

.navbar-user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.profile-pic-small {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid transparent;
  transition: border-color 0.2s ease;
}

.profile-pic-small:hover {
  border-color: var(--color-link, #60A5FA);
}

.hidden {
  display: none !important;
}

.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

@media (max-width: 768px) {
  .navbar-container {
    padding: 0 0.5rem;
  }

  .navbar-links {
    gap: 0.5rem;
  }

  .navbar-link {
    padding: 0.375rem 0.5rem;
    font-size: 0.75rem;
  }

  .navbar-link span {
    display: none;
  }

  .navbar-link svg {
    margin-right: 0;
  }
}
`;

// Embedded HTML template
const navbarTemplate = `
<nav class="navbar-bg">
  <div class="navbar-container">
    <!-- Logo and site title -->
    <a class="navbar-logo" href="index.html">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1v-3m0 0l-1-1h-4l-1 1m0 0h-4a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H9.75z"></path>
      </svg>
      <span>Arcator.co.uk</span>
    </a>

    <!-- Navigation links -->
    <div class="navbar-links">
      <a class="navbar-link" href="about.html">
        <span>About</span>
      </a>
      <a class="navbar-link" href="servers.html">
        <span>Servers</span>
      </a>
      <a class="navbar-link" href="community.html">
        <span>Community</span>
      </a>
      <a class="navbar-link" href="interests.html">
        <span>Interests</span>
      </a>
      <a class="navbar-link" href="games.html">
        <span>Games</span>
      </a>
      <a class="navbar-link" href="forms.html">
        <span>Forms</span>
      </a>
      <a class="navbar-link" href="donations.html">
        <span>Discord</span>
      </a>

      <!-- User profile section -->
      <div class="navbar-user">
        <!-- User settings link (hidden by default, shown when logged in) -->
        <a class="navbar-link hidden" href="users.html" id="navbar-user-settings-link">
          <img alt="Profile" class="profile-pic-small"
               id="navbar-user-profile-pic" src="https://placehold.co/32x32/1F2937/E5E7EB?text=AV">
          <span id="navbar-user-display-name">User</span>
        </a>

        <!-- Sign in link (visible by default, hidden when logged in) -->
        <a class="navbar-link" href="users.html" id="navbar-signin-link">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round"
                  stroke-width="2"></path>
          </svg>
          <span>Sign In</span>
        </a>
      </div>
    </div>
  </div>
</nav>
`;

/**
 * Injects navbar styles into the document head
 */
function injectNavbarStyles() {
  if (!document.getElementById('navbar-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'navbar-styles';
    styleElement.textContent = navbarStyles;
    document.head.appendChild(styleElement);
  }
}

/**
 * Refreshes the navbar profile picture with current user data
 * This can be called when user profile is updated
 */
export async function refreshNavbarProfilePicture() {
  const userProfilePic = document.getElementById('navbar-user-profile-pic');
  const userSettingsLink = document.getElementById('navbar-user-settings-link');

  if (!userProfilePic || !userSettingsLink) {
    console.warn('[DEBUG] Navbar profile picture elements not found');
    return;
  }

  // Check if user is logged in and has profile
  if (window.auth && window.auth.currentUser && window.currentUser) {
    console.log('[DEBUG] Refreshing navbar profile picture for user:', window.currentUser.displayName);

    try {
      // Use the enhanced validation function
      const {validateAndTestPhotoURL} = await import('./utils.js');
      const profilePicURL = window.currentUser.photoURL || window.DEFAULT_PROFILE_PIC;
      const safePhotoURL = await validateAndTestPhotoURL(profilePicURL, window.DEFAULT_PROFILE_PIC);

      console.log('[DEBUG] refreshNavbarProfilePicture: Safe photoURL:', safePhotoURL);

      userProfilePic.src = safePhotoURL;

      // Add error handling for image loading
      userProfilePic.onerror = function () {
        const failedURL = this.src;
        console.warn('[DEBUG] refreshNavbarProfilePicture: Profile picture failed to load:', failedURL);

        // Special handling for Discord URLs
        if (failedURL.includes('discordapp.com') || failedURL.includes('discord.com')) {
          console.log('[DEBUG] refreshNavbarProfilePicture: Discord CDN URL failed - this is common due to CORS restrictions');
          console.log('[DEBUG] refreshNavbarProfilePicture: The URL may work in browser tabs but fail in JavaScript');
          provideDiscordUrlGuidance(failedURL);
        }

        this.src = window.DEFAULT_PROFILE_PIC;
        this.onerror = null; // Prevent infinite loop
      };

      userProfilePic.onload = function () {
        console.log('[DEBUG] refreshNavbarProfilePicture: Profile picture loaded successfully:', this.src);
      };

      // Update user display name
      const displayName = window.currentUser.displayName || window.currentUser.handle || 'User';
      const displayNameSpan = document.getElementById('navbar-user-display-name');
      if (displayNameSpan) {
        displayNameSpan.textContent = displayName;
      }

    } catch (error) {
      console.error('[DEBUG] refreshNavbarProfilePicture: Error refreshing profile picture:', error);
      userProfilePic.src = window.DEFAULT_PROFILE_PIC;
    }
  } else {
    // User not logged in, use default
    userProfilePic.src = window.DEFAULT_PROFILE_PIC;
    const displayNameSpan = document.getElementById('navbar-user-display-name');
    if (displayNameSpan) {
      displayNameSpan.textContent = 'Sign In';
    }
  }
}

/**
 * Updates navbar UI based on user authentication state
 * @param {Object|null} authUser - Firebase User object
 * @param {Object|null} userProfile - User profile from Firestore
 * @param {string} defaultProfilePic - Default profile picture URL
 */
async function updateNavbarState(authUser, userProfile, defaultProfilePic) {
  const userSettingsLink = document.getElementById('navbar-user-settings-link');
  const userProfilePic = document.getElementById('navbar-user-profile-pic');
  const signinLink = document.getElementById('navbar-signin-link');

  if (authUser && userProfile) {
    // User is logged in
    if (userSettingsLink) {
      userSettingsLink.classList.remove('hidden');
    }
    if (signinLink) {
      signinLink.classList.add('hidden');
    }

    // Update profile picture with enhanced validation
    if (userProfilePic) {
      try {
        console.log('[DEBUG] updateNavbarState: Setting profile picture for user:', userProfile.displayName);
        console.log('[DEBUG] updateNavbarState: Raw photoURL:', userProfile.photoURL);

        // Use the enhanced validation function
        const {validateAndTestPhotoURL} = await import('./utils.js');
        const safePhotoURL = await validateAndTestPhotoURL(userProfile.photoURL, defaultProfilePic);

        console.log('[DEBUG] updateNavbarState: Safe photoURL:', safePhotoURL);

        userProfilePic.src = safePhotoURL;

        // Add error handling for image loading
        userProfilePic.onerror = function () {
          const failedURL = this.src;
          console.warn('[DEBUG] updateNavbarState: Profile picture failed to load:', failedURL);

          // Special handling for Discord URLs
          if (failedURL.includes('discordapp.com') || failedURL.includes('discord.com')) {
            console.log('[DEBUG] updateNavbarState: Discord CDN URL failed - this is common due to CORS restrictions');
            console.log('[DEBUG] updateNavbarState: The URL may work in browser tabs but fail in JavaScript');
            provideDiscordUrlGuidance(failedURL);
          }

          this.src = defaultProfilePic;
          this.onerror = null; // Prevent infinite loop
        };

        userProfilePic.onload = function () {
          console.log('[DEBUG] updateNavbarState: Profile picture loaded successfully:', this.src);
        };

      } catch (error) {
        console.error('[DEBUG] updateNavbarState: Error setting profile picture:', error);
        userProfilePic.src = defaultProfilePic;
      }
    }

    // Update user display name
    if (userSettingsLink) {
      const displayName = userProfile.displayName || userProfile.handle || 'User';
      const displayNameSpan = document.getElementById('navbar-user-display-name');
      if (displayNameSpan) {
        displayNameSpan.textContent = displayName;
      }
    }
  } else {
    // User is not logged in
    if (userSettingsLink) {
      userSettingsLink.classList.add('hidden');
    }
    if (signinLink) {
      signinLink.classList.remove('hidden');
    }
    if (userProfilePic) {
      userProfilePic.src = defaultProfilePic;
    }
  }
}

/**
 * Applies user theme after navbar is loaded
 * @param {string} userThemePreference - User's theme preference
 * @param {string} defaultThemeName - Default theme name
 */
async function applyUserTheme(userThemePreference, defaultThemeName) {
  try {
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) ||
      allThemes.find(t => t.id === defaultThemeName);

    if (themeToApply) {
      applyTheme(themeToApply.id, themeToApply);
    }
  } catch (error) {
    console.error('Failed to apply user theme:', error);
  }
}

/**
 * Loads and renders the navigation bar
 * @param {Object|null} authUser - Firebase User object or null
 * @param {Object|null} userProfile - Enriched user profile from Firestore
 * @param {string} defaultProfilePic - Default profile picture URL
 * @param {string} defaultThemeName - Default theme name
 */
export async function loadNavbar(authUser, userProfile, defaultProfilePic, defaultThemeName) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');

  if (!navbarPlaceholder) {
    console.error('Navbar placeholder element not found');
    return;
  }

  try {
    // Inject navbar styles
    injectNavbarStyles();

    // Insert navbar HTML
    navbarPlaceholder.innerHTML = navbarTemplate;

    // Update navbar state based on authentication
    await updateNavbarState(authUser, userProfile, defaultProfilePic);

    console.log('Navbar loaded successfully');

  } catch (error) {
    console.error('Failed to load navbar:', error);
    // Fallback to simple navbar if loading fails
    navbarPlaceholder.innerHTML = `
      <nav style="background: var(--color-bg-navbar, #111827); padding: 1rem; position: fixed; top: 0; left: 0; right: 0; z-index: 1000;">
        <a href="index.html" style="color: var(--color-text-primary, #E5E7EB); text-decoration: none; font-weight: bold;">Arcator.co.uk</a>
        <a href="users.html" style="color: var(--color-text-primary, #E5E7EB); text-decoration: none; margin-left: 1rem;">Sign In</a>
      </nav>
    `;
  }
}

/**
 * Loads the footer component into the page.
 * @param {string} yearElementId - The ID for the current year element (e.g., 'current-year-about')
 * @param {Array} additionalLinks - Optional array of additional link objects with href and text properties
 */
export async function loadFooter(yearElementId = null, additionalLinks = []) {
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (!footerPlaceholder) {
    console.warn('Footer placeholder not found. Add <div id="footer-placeholder"></div> to your page.');
    return;
  }

  // Default footer links
  const defaultLinks = [
    {href: 'privacy.html', text: 'Privacy Policy'},
    {href: 'terms.html', text: 'Terms of Service'},
    {href: 'https://wiki.arcator.co.uk/', text: 'Wiki', external: true},
    {href: 'infrastructure.html', text: 'Infrastructure'},
    {href: 'admin_and_dev.html', text: 'Admin & Dev'}
  ];

  // Merge default links with additional links
  const allLinks = [...defaultLinks, ...additionalLinks];

  // Generate footer HTML
  const footerHTML = `
    <footer class="bg-navbar-footer py-8 text-center text-text-secondary rounded-t-lg shadow-inner mt-8">
      <div class="container mx-auto px-4">
        <p>© 2012 - <span id="${yearElementId || 'current-year'}">${new Date().getFullYear()}</span> Arcator.co.uk. All rights reserved.</p>
        <p class="mt-2">Made with ❤️ for the Minecraft Community.</p>
        <div class="flex flex-wrap justify-center space-x-6 mt-4">
          ${allLinks.map(link => {
    const externalAttrs = link.external ? 'target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${link.href}" ${externalAttrs} class="hover:text-link transition duration-300 ease-in-out">${link.text}</a>`;
  }).join('')}
        </div>
      </div>
    </footer>
  `;

  footerPlaceholder.innerHTML = footerHTML;
}

// Initialize navbar when Firebase is ready
firebaseReadyPromise.then(() => {
  onAuthStateChanged(auth, async (user) => {
    // Get the user profile from Firestore if user is authenticated
    let userProfile = null;
    if (user) {
      userProfile = await getUserProfileFromFirestore(user.uid);
    }

    // Load navbar with current user state
    await loadNavbar(user, userProfile, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

    // Apply user theme
    const userThemePreference = userProfile?.themePreference || DEFAULT_THEME_NAME;
    await applyUserTheme(userThemePreference, DEFAULT_THEME_NAME);
  });
});

// Make function available globally
window.refreshNavbarProfilePicture = refreshNavbarProfilePicture;

/**
 * Test function to manually set a profile picture URL
 * This can be called from browser console for testing
 * @param {string} photoURL - The photo URL to test
 */
export async function testProfilePicture(photoURL) {
  console.log('[DEBUG] Testing profile picture URL:', photoURL);

  if (!window.currentUser) {
    console.error('[DEBUG] No user logged in, cannot test profile picture');
    return;
  }

  try {
    // Use the enhanced validation function
    const {validateAndTestPhotoURL} = await import('./utils.js');
    const safePhotoURL = await validateAndTestPhotoURL(photoURL, window.DEFAULT_PROFILE_PIC);

    console.log('[DEBUG] testProfilePicture: Validated URL:', safePhotoURL);

    // Temporarily update the current user's photoURL
    const originalPhotoURL = window.currentUser.photoURL;
    window.currentUser.photoURL = photoURL;

    // Refresh the navbar
    await refreshNavbarProfilePicture();

    // Restore original after 5 seconds
    setTimeout(async () => {
      window.currentUser.photoURL = originalPhotoURL;
      await refreshNavbarProfilePicture();
      console.log('[DEBUG] testProfilePicture: Restored original profile picture');
    }, 5000);

    console.log('[DEBUG] testProfilePicture: Profile picture test completed. Will restore in 5 seconds.');

  } catch (error) {
    console.error('[DEBUG] testProfilePicture: Error testing profile picture:', error);
  }
}

// Make test function available globally
window.testProfilePicture = testProfilePicture;

/**
 * Provides guidance for Discord CDN URL issues
 * @param {string} discordURL - The Discord URL that's failing
 */
export function provideDiscordUrlGuidance(discordURL) {
  console.log('[DEBUG] Discord URL Guidance:');
  console.log('[DEBUG] URL:', discordURL);
  console.log('[DEBUG] This is a common issue with Discord CDN URLs.');
  console.log('[DEBUG]');
  console.log('[DEBUG] 🎯 RECOMMENDED SOLUTION: Convert to ImgBB');
  console.log('[DEBUG] 1. Visit: https://imgbb.com/');
  console.log('[DEBUG] 2. Click "Start uploading"');
  console.log('[DEBUG] 3. Upload your Discord image file');
  console.log('[DEBUG] 4. Copy the direct link (ends with .jpg, .png, etc.)');
  console.log('[DEBUG] 5. Use window.updateProfilePicture(newURL) to update your profile');
  console.log('[DEBUG]');
  console.log('[DEBUG] Why Discord URLs break:');
  console.log('[DEBUG] - Discord CDN URLs can expire over time');
  console.log('[DEBUG] - CORS restrictions prevent loading in JavaScript');
  console.log('[DEBUG] - URLs work in browser tabs but fail in JavaScript');
  console.log('[DEBUG]');
  console.log('[DEBUG] Quick fix commands:');
  console.log('[DEBUG] - window.convertAndUpdateDiscordUrl("' + discordURL + '")');
  console.log('[DEBUG] - window.updateProfilePicture("your-new-imgbb-url")');
  console.log('[DEBUG]');
  console.log('[DEBUG] Alternative services: Imgur, Cloudinary, Uploadcare, Postimages');
}

/**
 * Updates the current user's profile picture URL
 * This can be called from browser console to fix broken Discord URLs
 * @param {string} newPhotoURL - The new photo URL to set
 */
export async function updateProfilePicture(newPhotoURL) {
  console.log('[DEBUG] updateProfilePicture called with:', newPhotoURL);

  if (!window.currentUser || !window.auth.currentUser) {
    console.error('[DEBUG] No user logged in, cannot update profile picture');
    return;
  }

  if (!newPhotoURL) {
    console.error('[DEBUG] No photo URL provided');
    return;
  }

  try {
    // Update the user profile in Firestore
    const {setUserProfileInFirestore} = await import('./firebase-init.js');
    const success = await setUserProfileInFirestore(window.auth.currentUser.uid, {
      photoURL: newPhotoURL
    });

    if (success) {
      console.log('[DEBUG] Profile picture updated successfully');

      // Update the local currentUser object
      window.currentUser.photoURL = newPhotoURL;

      // Refresh the navbar
      await refreshNavbarProfilePicture();

      // Show success message
      if (typeof window.showMessageBox === 'function') {
        window.showMessageBox('Profile picture updated successfully!', false);
      } else {
        console.log('[DEBUG] Profile picture updated successfully!');
      }
    } else {
      console.error('[DEBUG] Failed to update profile picture in Firestore');
    }
  } catch (error) {
    console.error('[DEBUG] Error updating profile picture:', error);
  }
}

/**
 * Converts a broken Discord URL to ImgBB and updates the user's profile
 * @param {string} discordURL - The broken Discord URL to convert
 */
export async function convertAndUpdateDiscordUrl(discordURL) {
  console.log('[DEBUG] convertAndUpdateDiscordUrl called with:', discordURL);

  if (!window.currentUser || !window.auth.currentUser) {
    console.error('[DEBUG] No user logged in, cannot convert Discord URL');
    return;
  }

  if (!discordURL || !discordURL.includes('discordapp.com')) {
    console.error('[DEBUG] Not a Discord URL provided');
    return;
  }

  try {
    // Import the conversion function
    const {convertDiscordUrlToReliableCDN, createImageUploadHelper} = await import('./utils.js');

    console.log('[DEBUG] Attempting to convert Discord URL to ImgBB...');

    // Try to convert the Discord URL to ImgBB
    const convertedURL = await convertDiscordUrlToReliableCDN(discordURL);

    if (convertedURL === discordURL) {
      console.log('[DEBUG] Discord URL conversion not needed or failed');
      console.log('[DEBUG] Showing manual conversion options...');
    } else {
      console.log('[DEBUG] Discord URL converted successfully:', convertedURL);

      // Automatically update the user's profile with the converted URL
      await updateProfilePicture(convertedURL);
      console.log('[DEBUG] Profile picture updated with converted ImgBB URL');
      return;
    }

    // Show the user the conversion options
    console.log('[DEBUG] Showing Discord URL conversion helper...');

    // Create a modal or helper to guide the user
    const helperId = 'discord-url-converter-helper';
    let helperElement = document.getElementById(helperId);

    if (!helperElement) {
      helperElement = document.createElement('div');
      helperElement.id = helperId;
      helperElement.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10000;
        background: var(--color-bg-card);
        border: 2px solid var(--color-input-border);
        border-radius: 0.75rem;
        padding: 1.5rem;
        max-width: 600px;
        width: 90%;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        max-height: 80vh;
        overflow-y: auto;
      `;
      document.body.appendChild(helperElement);
    }

    // Create the helper content with ImgBB emphasis
    createImageUploadHelper(helperId);

    // Add a close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: none;
      border: none;
      font-size: 1.5rem;
      color: var(--color-text-secondary);
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.25rem;
    `;
    closeButton.onclick = () => helperElement.remove();
    helperElement.appendChild(closeButton);

    // Add a manual URL input option
    const manualInput = document.createElement('div');
    manualInput.style.cssText = `
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--color-input-border);
    `;
    manualInput.innerHTML = `
      <p style="margin: 0 0 0.5rem 0; color: var(--color-text-primary); font-size: 0.875rem; font-weight: 600;">
        Or paste your new ImgBB URL directly:
      </p>
      <div style="display: flex; gap: 0.5rem;">
        <input type="url" id="manual-url-input" placeholder="https://i.ibb.co/example/image.jpg"
               style="flex: 1; padding: 0.5rem; border: 1px solid var(--color-input-border); border-radius: 0.375rem; background: var(--color-input-bg); color: var(--color-text-primary);">
        <button id="update-url-btn"
                style="background: var(--color-button-green-bg); color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; cursor: pointer;">
          Update Profile
        </button>
      </div>
      <p style="margin: 0.5rem 0 0 0; color: var(--color-text-secondary); font-size: 0.75rem;">
        Tip: ImgBB URLs typically start with "https://i.ibb.co/"
      </p>
    `;
    helperElement.appendChild(manualInput);

    // Add event listener for manual URL update
    document.getElementById('update-url-btn').onclick = async () => {
      const newURL = document.getElementById('manual-url-input').value.trim();
      if (newURL) {
        await updateProfilePicture(newURL);
        helperElement.remove();
      }
    };

    // Add event listener for Enter key
    document.getElementById('manual-url-input').onkeypress = async (e) => {
      if (e.key === 'Enter') {
        const newURL = e.target.value.trim();
        if (newURL) {
          await updateProfilePicture(newURL);
          helperElement.remove();
        }
      }
    };

  } catch (error) {
    console.error('[DEBUG] Error converting Discord URL:', error);
  }
}

// Make function available globally
window.provideDiscordUrlGuidance = provideDiscordUrlGuidance;
window.updateProfilePicture = updateProfilePicture;
window.convertAndUpdateDiscordUrl = convertAndUpdateDiscordUrl;
