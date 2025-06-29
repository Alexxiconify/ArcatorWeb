// navbar.js - Modern, self-contained navbar component with embedded CSS and HTML
// Combines navbar.css, navbar.html, and navbar.js into a single file

import { auth, db, appId, getUserProfileFromFirestore, firebaseReadyPromise, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, onAuthStateChanged, currentUser } from './firebase-init.js';
import { applyTheme, getAvailableThemes } from './themes.js';
import {validatePhotoURL} from './utils.js';

// Utility function to convert hex color to RGB
function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse the hex values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Check if parsing was successful
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return null;
  }
  
  return { r, g, b };
}

// Modern embedded CSS styles with glassmorphism and contemporary design
const navbarStyles = `
/* Modern navbar styling with glassmorphism and contemporary design */
.navbar-bg {
  background: rgba(var(--color-bg-navbar-rgb, 17, 24, 39), 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: clamp(0.75rem, 1vw, 0.95rem);
  padding-left: 0.25rem;
  padding-right: 0.25rem;
}

.navbar-bg.scrolled {
  background: rgba(var(--color-bg-navbar-rgb, 17, 24, 39), 0.98);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.navbar-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 48px;
  padding: 0 0.5rem;
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
  min-height: 48px;
}

.navbar-logo, .navbar-link, .navbar-user {
  min-height: 40px;
  line-height: 40px;
  align-items: center;
  display: flex;
}

.navbar-logo {
  display: flex;
  align-items: center;
  gap: clamp(0.15rem, 0.3vw, 0.3rem);
  font-size: clamp(0.7rem, 1vw, 0.85rem);
  font-weight: 800;
  color: var(--color-text-primary, #E5E7EB);
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0.15rem 0.15rem;
  border-radius: 0.75rem;
  position: relative;
  overflow: hidden;
}

.navbar-logo::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.5s ease;
}

.navbar-logo:hover::before {
  left: 100%;
}

.navbar-logo:hover {
  color: var(--color-link, #60A5FA);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.2);
}

.navbar-logo svg {
  height: 1.1em;
  width: 1.1em;
  min-width: 1.1em;
  min-height: 1.1em;
  vertical-align: middle;
  display: inline-block;
  flex-shrink: 0;
  margin-right: 0.3em;
}

.navbar-logo:hover svg {
  transform: scale(1.1) rotate(5deg);
}

.navbar-links {
  display: flex;
  align-items: center;
  gap: 0.01rem;
  overflow-x: auto;
  scrollbar-width: thin;
  -ms-overflow-style: none;
  padding: 0.25rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  flex-wrap: nowrap;
  max-width: 100vw;
}

.navbar-links::-webkit-scrollbar {
  height: 6px;
}

.navbar-link {
  height: 40px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0.05rem 0.18rem;
  font-size: clamp(0.35rem, 0.45vw, 0.6rem);
  font-weight: 600;
  color: var(--color-text-primary, #E5E7EB);
  text-decoration: none;
  border-radius: 0.75rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
  background: transparent;
  border: 1px solid transparent;
  margin: 0 0.01rem;
  min-width: 0;
  max-width: 100vw;
}

.navbar-link::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, var(--color-link, #60A5FA), var(--color-button-purple-bg, #9333EA));
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 0.75rem;
  z-index: -1;
}

.navbar-link:hover::before {
  opacity: 0.1;
}

.navbar-link:hover {
  color: var(--color-link, #60A5FA);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(96, 165, 250, 0.15);
  border-color: rgba(96, 165, 250, 0.2);
}

.navbar-link svg {
  height: 1.1em;
  width: 1.1em;
  min-width: 1.1em;
  min-height: 1.1em;
  vertical-align: middle;
  display: inline-block;
  flex-shrink: 0;
  margin-right: 0.3em;
}

.navbar-link:hover svg {
  transform: scale(1.1);
}

.navbar-user {
  display: flex;
  align-items: center;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0;
}

.navbar-user .navbar-link {
  height: 40px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem 0.375rem 0.5rem;
  background: linear-gradient(135deg, var(--color-button-blue-bg, #3B82F6), var(--color-button-indigo-bg, #6366F1));
  color: var(--color-button-text, #FFFFFF);
  border: none;
  font-weight: 600;
  font-size: 0.8125rem;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  min-width: 0;
}

.navbar-user .profile-pic-small {
  height: 28px;
  width: 28px;
  min-width: 28px;
  min-height: 28px;
  border-radius: 50%;
  object-fit: cover;
  align-self: center;
}

.navbar-user-name {
  font-size: clamp(0.45rem, 0.6vw, 0.65rem);
  font-weight: 500;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  align-self: center;
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

/* Mobile menu button */
.mobile-menu-btn {
  display: none;
  flex-direction: column;
  justify-content: space-around;
  width: 30px;
  height: 30px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 10;
}

.mobile-menu-btn span {
  width: 100%;
  height: 3px;
  background: var(--color-text-primary, #E5E7EB);
  border-radius: 2px;
  transition: all 0.3s ease;
  transform-origin: center;
}

.mobile-menu-btn.active span:nth-child(1) {
  transform: rotate(45deg) translate(6px, 6px);
}

.mobile-menu-btn.active span:nth-child(2) {
  opacity: 0;
}

.mobile-menu-btn.active span:nth-child(3) {
  transform: rotate(-45deg) translate(6px, -6px);
}

/* Large screen responsive design (2K, 4K) */
@media (min-width: 1920px) {
  .navbar-container {
    height: 64px;
    min-height: 64px;
    padding: 0 1rem;
  }

  .navbar-logo, .navbar-link, .navbar-user {
    min-height: 56px;
    line-height: 56px;
  }

  .navbar-logo {
    font-size: clamp(1rem, 1.2vw, 1.2rem);
    gap: clamp(0.25rem, 0.4vw, 0.5rem);
    padding: 0.25rem 0.25rem;
  }

  .navbar-logo svg {
    height: 1.2em;
    width: 1.2em;
    min-width: 1.2em;
    min-height: 1.2em;
  }

  .navbar-links {
    gap: 0.125rem;
    padding: 0.375rem;
  }

  .navbar-link {
    height: 56px;
    padding: 0.125rem 0.25rem;
    font-size: clamp(0.6rem, 0.7vw, 0.85rem);
    margin: 0 0.125rem;
  }

  .navbar-link svg {
    height: 1.1em;
    width: 1.1em;
    min-width: 1.1em;
    min-height: 1.1em;
    margin-right: clamp(0.125rem, 0.25vw, 0.25rem);
  }

  .navbar-user .navbar-link {
    height: 56px;
    padding: 0.5rem 1rem 0.5rem 0.75rem;
    font-size: 1rem;
    gap: 0.75rem;
  }

  .navbar-user .profile-pic-small {
    height: 40px;
    width: 40px;
    min-width: 40px;
    min-height: 40px;
  }

  .navbar-user-name {
    font-size: clamp(0.7rem, 0.8vw, 0.9rem);
    max-width: 120px;
  }

  .mobile-menu-btn {
    width: 40px;
    height: 40px;
  }

  .mobile-menu-btn span {
    height: 4px;
  }
}

@media (min-width: 2560px) {
  .navbar-container {
    height: 80px;
    min-height: 80px;
    padding: 0 1.5rem;
  }

  .navbar-logo, .navbar-link, .navbar-user {
    min-height: 72px;
    line-height: 72px;
  }

  .navbar-logo {
    font-size: clamp(1.2rem, 1.4vw, 1.5rem);
    gap: clamp(0.375rem, 0.5vw, 0.625rem);
    padding: 0.375rem 0.375rem;
  }

  .navbar-logo svg {
    height: 1.4em;
    width: 1.4em;
    min-width: 1.4em;
    min-height: 1.4em;
  }

  .navbar-links {
    gap: 0.25rem;
    padding: 0.5rem;
  }

  .navbar-link {
    height: 72px;
    padding: 0.25rem 0.375rem;
    font-size: clamp(0.8rem, 0.9vw, 1.1rem);
    margin: 0 0.25rem;
  }

  .navbar-link svg {
    height: 1.3em;
    width: 1.3em;
    min-width: 1.3em;
    min-height: 1.3em;
    margin-right: clamp(0.25rem, 0.375vw, 0.375rem);
  }

  .navbar-user .navbar-link {
    height: 72px;
    padding: 0.75rem 1.25rem 0.75rem 1rem;
    font-size: 1.2rem;
    gap: 1rem;
  }

  .navbar-user .profile-pic-small {
    height: 52px;
    width: 52px;
    min-width: 52px;
    min-height: 52px;
  }

  .navbar-user-name {
    font-size: clamp(0.9rem, 1vw, 1.1rem);
    max-width: 150px;
  }

  .mobile-menu-btn {
    width: 50px;
    height: 50px;
  }

  .mobile-menu-btn span {
    height: 5px;
  }
}

/* Medium screen responsive design */
@media (max-width: 1024px) {
  .navbar-container {
    padding: 0 1rem;
  }

  .navbar-links {
    gap: 0.125rem;
  }

  .navbar-link {
    padding: 0.625rem 0.875rem;
    font-size: 0.8125rem;
  }
}

@media (max-width: 768px) {
  .navbar-container {
  }

  .navbar-links {
    position: fixed;
    top: 64px;
    left: 0;
    right: 0;
    background: rgba(var(--color-bg-navbar-rgb, 17, 24, 39), 0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    flex-direction: column;
    opacity: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .navbar-links.mobile-open {
    transform: translateY(0);
    opacity: 1;
    visibility: visible;
  }

  .navbar-link {
    width: 100%;
    justify-content: flex-start;
    padding: 1rem 1.25rem;
    font-size: 1rem;
    border-radius: 0.75rem;
    margin-bottom: 0.25rem;
  }

  .navbar-link span {
    display: inline;
  }

  .navbar-link svg {
    margin-right: 0.75rem;
  }

  .mobile-menu-btn {
    display: flex;
  }

  .navbar-user {
    margin-left: auto;
  }
}

@media (max-width: 480px) {
  .navbar-container {
    padding: 0 0.5rem;
  }

  .navbar-logo {
    font-size: 1.125rem;
  }

  .navbar-logo svg {
    height: 1.25rem;
    width: 1.25rem;
  }

  .profile-pic-small {
    width: 28px;
    height: 28px;
  }
}

@media (max-width: 600px) {
  .navbar-container {
    flex-direction: column;
    align-items: stretch;
    height: auto;
  }
  .navbar-links {
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 0.05rem;
    padding: 0.1rem 0;
  }
  .navbar-link {
    font-size: clamp(0.5rem, 0.7vw, 0.8rem);
    min-width: 0;
    max-width:90vw;
  }
  .navbar-logo {
    font-size: 0.9rem;
    gap: 0.25rem;
  }
  .navbar-logo svg {
    height: 1rem;
    width: 1rem;
  }
  .profile-pic-small {
    width: 10px;
    height: 10px;
  }
}

`;

// Modern embedded HTML template with contemporary icons
const navbarTemplate = `
<nav class="navbar-bg">
  <div class="navbar-container">
    <a class="navbar-logo" href="index.html">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1v-3m0 0l-1-1h-4l-1 1m0 0h-4a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H9.75z"></path>
      </svg>
      <span>Arcator</span>
    </a>

    <div class="navbar-links" id="navbar-links">
      <a class="navbar-link" href="about.html">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>About</span>
      </a>
      <a class="navbar-link" href="servers-and-games.html">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
        </svg>
        <span>Games</span>
      </a>
      <a class="navbar-link" href="forms.html">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path>
        </svg>
        <span>Forum</span>
      </a>
      <a class="navbar-link" href="admin_and_dev.html">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>Admin</span>
      </a>
    </div>

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

    <!-- Mobile menu button -->
    <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle mobile menu">
      <span></span>
      <span></span>
      <span></span>
    </button>
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
 * Updates navbar styles to respond to theme changes
 * This function forces the navbar to re-evaluate CSS variables
 */
function updateNavbarForTheme() {
  const navbar = document.querySelector('.navbar-bg');
  if (!navbar) return;

  // Get the current navbar background color from CSS variables
  const navbarColor = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-navbar').trim();
  const navbarRgb = hexToRgb(navbarColor);

  if (navbarRgb) {
    // Check if we're using a custom theme
    const isCustomTheme = document.body.classList.contains('custom-theme') || 
                         document.documentElement.classList.contains('custom-theme') ||
                         document.documentElement.style.getPropertyValue('--color-body-bg');

    if (isCustomTheme) {
      // Apply custom theme background with transparency
      const rgbaValue = `rgba(${navbarRgb.r}, ${navbarRgb.g}, ${navbarRgb.b}, 0.95)`;
      navbar.style.backgroundColor = rgbaValue;
      
      // Also update mobile background
      const mobileRgbaValue = `rgba(${navbarRgb.r}, ${navbarRgb.g}, ${navbarRgb.b}, 0.98)`;
      navbar.style.setProperty('--mobile-navbar-bg', mobileRgbaValue);
    } else {
      // Remove inline background for built-in themes
      navbar.style.backgroundColor = '';
      navbar.style.removeProperty('--mobile-navbar-bg');
    }
  }
}

/**
 * Handles scroll effects for the navbar
 */
function setupScrollEffects() {
  const navbar = document.querySelector('.navbar-bg');
  if (!navbar) return;

  let lastScrollTop = 0;

  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // Add scrolled class for background opacity
    if (scrollTop > 10) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    lastScrollTop = scrollTop;
  });
}

/**
 * Sets up mobile menu functionality
 */
function setupMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navbarLinks = document.getElementById('navbar-links');

  if (!mobileMenuBtn || !navbarLinks) return;

  mobileMenuBtn.addEventListener('click', () => {
    mobileMenuBtn.classList.toggle('active');
    navbarLinks.classList.toggle('mobile-open');

    // Prevent body scroll when menu is open
    if (navbarLinks.classList.contains('mobile-open')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });

  // Close mobile menu when clicking on a link
  navbarLinks.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      mobileMenuBtn.classList.remove('active');
      navbarLinks.classList.remove('mobile-open');
      document.body.style.overflow = '';
    }
  });

  // Close mobile menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!mobileMenuBtn.contains(e.target) && !navbarLinks.contains(e.target)) {
      mobileMenuBtn.classList.remove('active');
      navbarLinks.classList.remove('mobile-open');
      document.body.style.overflow = '';
    }
  });
}

/**
 * Refreshes the navbar profile picture with current user data
 * This can be called when user profile is updated
 */
export function refreshNavbarProfilePicture(userProfile) {
  const userProfilePic = document.getElementById('navbar-user-profile-pic');
  const userSettingsLink = document.getElementById('navbar-user-settings-link');
  if (!userProfilePic || !userSettingsLink) return;
  if (!userProfile) return;
  const profilePicURL = getSafePhotoURL(userProfile.photoURL, DEFAULT_PROFILE_PIC);
  userProfilePic.src = profilePicURL;
  userProfilePic.onload = function () {
    // Success, do nothing
  };
  userProfilePic.onerror = function () {
    this.src = DEFAULT_PROFILE_PIC;
    this.onerror = null;
  };
  const displayName = userProfile.displayName || userProfile.handle || 'User';
  const displayNameSpan = document.getElementById('navbar-user-display-name');
  if (displayNameSpan) displayNameSpan.textContent = displayName;
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

  // Check if user is logged in (including anonymous users)
  const isLoggedIn = authUser && !authUser.isAnonymous;
  const isAnonymous = authUser && authUser.isAnonymous;

  if (isLoggedIn && userProfile) {
    // User is logged in with a profile
    if (userSettingsLink) {
      userSettingsLink.classList.remove('hidden');
    }
    if (signinLink) {
      signinLink.classList.add('hidden');
    }

    // Update profile picture with enhanced validation
    if (userProfilePic) {
      try {
        const profilePicURL = getSafePhotoURL(userProfile && userProfile.photoURL, defaultProfilePic);
        userProfilePic.src = profilePicURL;

        // Add error handling for image loading
        userProfilePic.onerror = function () {
          const failedURL = this.src;
          if (failedURL.includes('discordapp.com') || failedURL.includes('discord.com')) {
            provideDiscordUrlGuidance(failedURL);
          }

          this.src = defaultProfilePic;
          this.onerror = null; // Prevent infinite loop
        };

        userProfilePic.onload = function () {
          // Success, do nothing
        };

      } catch (error) {
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
  } else if (isAnonymous) {
    // Anonymous user - show sign in
    if (userSettingsLink) {
      userSettingsLink.classList.add('hidden');
    }
    if (signinLink) {
      signinLink.classList.remove('hidden');
    }
    if (userProfilePic) {
      userProfilePic.src = defaultProfilePic;
    }
  } else {
    // User is not logged in at all
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
    return;
  }

  try {
    // Inject navbar styles
    injectNavbarStyles();

    // Insert navbar HTML
    navbarPlaceholder.innerHTML = navbarTemplate;

    // Setup mobile menu functionality
    setupMobileMenu();

    // Setup scroll effects
    setupScrollEffects();

    // Update navbar state based on authentication
    await updateNavbarState(authUser, userProfile, defaultProfilePic);

    // Update navbar with current theme (in case theme is already applied)
    setTimeout(() => {
      updateNavbarForTheme();
    }, 100); // Small delay to ensure DOM is ready

    // Listen for theme changes and update navbar
    document.addEventListener('themeChanged', () => {
      updateNavbarForTheme();
    });

    styleNavbarItemsUniformly();

  } catch (error) {
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
    {href: 'privacy.html', text: 'Legal'},
    {href: 'temp-page-viewer.html', text: 'Pages'},
    {href: 'https://wiki.arcator.co.uk/', text: 'Wiki', external: true},
    {href: 'https://ssmp.arcator.co.uk/', text: 'SSMP', external: true},
    {href: 'https://hub.arcator.co.uk/#creative', text: 'Hub', external: true}
  ];

  // Merge default links with additional links
  const allLinks = [...defaultLinks, ...additionalLinks];

  // Generate footer HTML
  const footerHTML = `
    <footer class="bg-navbar-footer py-8 text-center text-text-secondary rounded-t-lg shadow-inner mt-8">
      <div class="container mx-auto px-4">
        <p>© 2010 - <span id="${yearElementId || 'current-year'}">${new Date().getFullYear()}</span> Arcator.co.uk. All rights reserved.</p>
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
  // Set up auth state listener
  auth.onAuthStateChanged(async (user) => {
    let userProfile = null;
    if (user && !user.isAnonymous) {
      try {
        userProfile = await getUserProfileFromFirestore(user.uid);
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    }

    // Check if navbar is already loaded
    const navbarPlaceholder = document.getElementById('navbar-placeholder');
    if (navbarPlaceholder && navbarPlaceholder.innerHTML.trim() !== '') {
      // Navbar is already loaded, just update the state
      updateNavbarState(user, userProfile, DEFAULT_PROFILE_PIC);
    } else {
      // Navbar not loaded yet, load it completely
      loadNavbar(user, userProfile, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
    }

    // Load footer if not already loaded
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder && footerPlaceholder.innerHTML.trim() === '') {
      loadFooter('current-year-...');
    }
  });

  // Add page visibility change listener to refresh navbar state when user returns to tab
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      setTimeout(async () => {
        if (typeof window.forceRefreshNavbarState === 'function') {
          await window.forceRefreshNavbarState();
        }
      }, 100);
    }
  });

  // Add window focus listener as additional safeguard
  window.addEventListener('focus', async () => {
    setTimeout(async () => {
      if (typeof window.forceRefreshNavbarState === 'function') {
        await window.forceRefreshNavbarState();
      }
    }, 100);
  });
});

/**
 * Force refresh the navbar authentication state
 * This can be called when you need to manually update the navbar
 */
export async function forceRefreshNavbarState() {
  const currentUser = auth.currentUser;
  let userProfile = null;

  if (currentUser && !currentUser.isAnonymous) {
    try {
      userProfile = await getUserProfileFromFirestore(currentUser.uid);
    } catch (error) {
      console.error('Error loading user profile for force refresh:', error);
    }
  }

  await updateNavbarState(currentUser, userProfile, DEFAULT_PROFILE_PIC);
}

// Make function available globally
window.refreshNavbarProfilePicture = refreshNavbarProfilePicture;
window.forceRefreshNavbarState = forceRefreshNavbarState;

/**
 * Test function to manually set a profile picture URL
 * This can be called from browser console for testing
 * @param {string} photoURL - The photo URL to test
 */
export async function testProfilePicture(photoURL) {
  if (!window.currentUser) {
    return;
  }

  try {
    // Use the enhanced validation function
    const {validateAndTestPhotoURL} = await import('./utils.js');
    const safePhotoURL = await validateAndTestPhotoURL(photoURL, window.DEFAULT_PROFILE_PIC);

    // Temporarily update the current user's photoURL
    const originalPhotoURL = window.currentUser.photoURL;
    window.currentUser.photoURL = photoURL;

    // Refresh the navbar
    await refreshNavbarProfilePicture(window.currentUser);

    // Restore original after 5 seconds
    setTimeout(async () => {
      window.currentUser.photoURL = originalPhotoURL;
      await refreshNavbarProfilePicture(window.currentUser);
    }, 5000);

  } catch (error) {
    console.error('Error testing profile picture:', error);
  }
}

// Make test function available globally
window.testProfilePicture = testProfilePicture;

/**
 * Provides guidance for Discord CDN URL issues
 * @param {string} discordURL - The Discord URL that's failing
 */
export function provideDiscordUrlGuidance(discordURL) {
  console.log('Discord URL Guidance:');
  console.log('URL:', discordURL);
  console.log('This is a common issue with Discord CDN URLs.');
  console.log('🎯 RECOMMENDED SOLUTION: Convert to ImgBB');
  console.log('1. Visit: https://imgbb.com/');
  console.log('2. Click "Start uploading"');
  console.log('3. Upload your Discord image file');
  console.log('4. Copy the direct link (ends with .jpg, .png, etc.)');
  console.log('5. Use window.updateProfilePicture(newURL) to update your profile');
  console.log('');
  console.log('Why Discord URLs break:');
  console.log('- Discord CDN URLs can expire over time');
  console.log('- CORS restrictions prevent loading in JavaScript');
  console.log('- URLs work in browser tabs but fail in JavaScript');
  console.log('');
  console.log('Quick fix commands:');
  console.log('- window.convertAndUpdateDiscordUrl("' + discordURL + '")');
  console.log('- window.updateProfilePicture("your-new-imgbb-url")');
  console.log('');
  console.log('Alternative services: Imgur, Cloudinary, Uploadcare, Postimages');
}

/**
 * Updates the current user's profile picture URL
 * This can be called from browser console to fix broken Discord URLs
 * @param {string} newPhotoURL - The new photo URL to set
 */
export async function updateProfilePicture(newPhotoURL) {
  if (!window.currentUser || !window.auth.currentUser) {
    return;
  }

  if (!newPhotoURL) {
    return;
  }

  try {
    // Update the user profile in Firestore
    const {setUserProfileInFirestore} = await import('./firebase-init.js');
    const success = await setUserProfileInFirestore(window.auth.currentUser.uid, {
      photoURL: newPhotoURL
    });

    if (success) {
      // Update the local currentUser object
      window.currentUser.photoURL = newPhotoURL;

      // Refresh the navbar
      await refreshNavbarProfilePicture(window.currentUser);

      // Show success message
      if (typeof window.showMessageBox === 'function') {
        window.showMessageBox('Profile picture updated successfully!', false);
      }
    } else {
      console.error('Failed to update profile picture in Firestore');
    }
  } catch (error) {
    console.error('Error updating profile picture:', error);
  }
}

/**
 * Converts a broken Discord URL to ImgBB and updates the user's profile
 * @param {string} discordURL - The broken Discord URL to convert
 */
export async function convertAndUpdateDiscordUrl(discordURL) {
  if (!window.currentUser || !window.auth.currentUser) {
    return;
  }

  if (!discordURL || !discordURL.includes('discordapp.com')) {
    return;
  }

  try {
    // Import the conversion function
    const {convertDiscordUrlToReliableCDN, createImageUploadHelper} = await import('./utils.js');

    // Try to convert the Discord URL to ImgBB
    const convertedURL = await convertDiscordUrlToReliableCDN(discordURL);

    if (convertedURL === discordURL) {
      console.log('Discord URL conversion not needed or failed');
      console.log('Showing manual conversion options...');
    } else {
      console.log('Discord URL converted successfully:', convertedURL);

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

function getSafePhotoURL(photoURL, defaultProfilePic = null) {
  const fallback = defaultProfilePic || window.DEFAULT_PROFILE_PIC || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
  if (!photoURL || photoURL === '' || photoURL === 'undefined' || typeof photoURL !== 'string') {
    return fallback;
  }
  return photoURL;
}

// PATCH: Uniform navbar item sizing
function styleNavbarItemsUniformly() {
  const navItems = document.querySelectorAll('.navbar-link, .navbar-logo, .navbar-profile');
  navItems.forEach(item => {
    item.style.height = '2.5rem';
    item.style.minWidth = '2.5rem';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'center';
    item.style.fontSize = '1rem';
    item.style.fontWeight = '500';
    item.style.borderRadius = '1.25rem';
    item.style.padding = '0 0.75rem';
  });
}
