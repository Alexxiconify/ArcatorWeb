// navbar.js - Modern, self-contained navbar component with embedded CSS and HTML
// Combines navbar.css, navbar.html, and navbar.js into a single file

import { auth, db, appId, getUserProfileFromFirestore, firebaseReadyPromise, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, onAuthStateChanged, currentUser } from './firebase-init.js';
import { applyTheme, getAvailableThemes } from './themes.js';
import {validatePhotoURL} from './utils.js';

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
  height: 1em;
  width: 1em;
  min-width: 1em;
  min-height: 1em;
  color: var(--color-link, #60A5FA);
}

.navbar-logo:hover svg {
  transform: scale(1.1) rotate(5deg);
}

.navbar-links {
  display: flex;
  align-items: center;
  gap: 0.05rem;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 0.5rem;
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
  display: flex;
  align-items: center;
  padding: 0.15rem 0.25rem;
  font-size: clamp(0.4rem, 0.5vw, 0.65rem);
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
  margin: 0 0.05rem;
  min-width: 0;
  max-width: 80vw;
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
  height: 1em;
  width: 1em;
  min-width: 1em;
  min-height: 1em;
  margin-right: clamp(0.08rem, 0.2vw, 0.15rem);
  transition: all 0.3s ease;
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
  margin-right: 0.5rem;
  margin-left: 0;
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

/* Mobile responsive design */
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
      <a class="navbar-link" href="servers.html">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
        </svg>
        <span>Servers</span>
      </a>
      <a class="navbar-link" href="https://ssmp.arcator.co.uk/" target="_blank" rel="noopener noreferrer">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
        </svg>
        <span>SSMP</span>
      </a>
      <a class="navbar-link" href="https://hub.arcator.co.uk/#creative" target="_blank" rel="noopener noreferrer">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
        </svg>
        <span>Hub</span>
      </a>
      <a class="navbar-link" href="community.html">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
        </svg>
        <span>Community</span>
      </a>
      <a class="navbar-link" href="interests.html">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
        </svg>
        <span>Interests</span>
      </a>
      <a class="navbar-link" href="games.html">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>Games</span>
      </a>
      <a class="navbar-link" href="forms.html">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
        </svg>
        <span>Forms</span>
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
  console.log('DEBUG: updateNavbarForTheme called');

  const navbar = document.querySelector('.navbar-bg');
  if (navbar) {
    console.log('DEBUG: Found navbar element, updating...');

    // Get the current theme's navbar color
    const computedStyle = getComputedStyle(document.documentElement);
    const navbarColor = computedStyle.getPropertyValue('--color-bg-navbar').trim();
    const navbarRgb = computedStyle.getPropertyValue('--color-bg-navbar-rgb').trim();

    console.log('DEBUG: Navbar color:', navbarColor);
    console.log('DEBUG: Navbar RGB value:', navbarRgb);

    // Force a reflow to ensure CSS variables are updated
    navbar.style.transition = 'none';
    navbar.offsetHeight; // Trigger reflow
    navbar.style.transition = '';

    // Check if this is a custom theme by looking for custom theme indicators
    const hasInlineVariables = document.documentElement.style.cssText.length > 0;
    const currentThemeClasses = Array.from(document.documentElement.classList).filter(cls => cls.startsWith('theme-'));
    const isCustomTheme = document.body.classList.contains('custom-theme') ||
      document.documentElement.classList.contains('custom-theme') ||
      navbarColor.includes('custom') ||
      !navbarRgb || navbarRgb === '' ||
      hasInlineVariables;

    console.log('DEBUG: Is custom theme:', isCustomTheme);
    console.log('DEBUG: Body has custom-theme class:', document.body.classList.contains('custom-theme'));
    console.log('DEBUG: Document has custom-theme class:', document.documentElement.classList.contains('custom-theme'));
    console.log('DEBUG: Has inline variables:', hasInlineVariables);
    console.log('DEBUG: Current theme classes:', currentThemeClasses);
    console.log('DEBUG: Navbar RGB value:', navbarRgb);

    if (isCustomTheme && navbarRgb && navbarRgb !== '') {
      // For custom themes, apply direct background color
      const rgbaValue = `rgba(${navbarRgb}, 0.95)`;
      navbar.style.background = rgbaValue;
      console.log('DEBUG: Applied custom theme background:', rgbaValue);
    } else {
      // For built-in themes, remove inline styles to use CSS variables
      navbar.style.removeProperty('background');
      console.log('DEBUG: Removed inline background, using CSS variables for built-in theme');
    }

    // Update mobile menu background if open
    const navbarLinks = document.getElementById('navbar-links');
    if (navbarLinks && navbarLinks.classList.contains('mobile-open')) {
      navbarLinks.style.transition = 'none';
      navbarLinks.offsetHeight; // Trigger reflow
      navbarLinks.style.transition = '';

      if (isCustomTheme && navbarRgb && navbarRgb !== '') {
        // For custom themes, apply direct background color
        const mobileRgbaValue = `rgba(${navbarRgb}, 0.98)`;
        navbarLinks.style.background = mobileRgbaValue;
        console.log('DEBUG: Applied custom theme mobile background:', mobileRgbaValue);
      } else {
        // For built-in themes, remove inline styles
        navbarLinks.style.removeProperty('background');
        console.log('DEBUG: Removed inline mobile background, using CSS variables');
      }
    }

    // Force update of all navbar elements that use CSS variables
    const navbarElements = navbar.querySelectorAll('*');
    navbarElements.forEach(element => {
      if (element.style.transition) {
        const originalTransition = element.style.transition;
        element.style.transition = 'none';
        element.offsetHeight; // Trigger reflow
        element.style.transition = originalTransition;
      }
    });

    console.log('DEBUG: Navbar theme update completed');
  } else {
    console.warn('DEBUG: Navbar element not found for theme update');
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
        const profilePicURL = getSafePhotoURL(userProfile && userProfile.photoURL, defaultProfilePic);
        console.log('[DEBUG] About to set userProfilePic.src to:', profilePicURL);
        userProfilePic.src = profilePicURL;

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
      console.log('Navbar: Theme changed, updating styles...');
      updateNavbarForTheme();
    });

    console.log('Modern navbar loaded successfully');

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
    {href: 'privacy.html', text: 'Legal'},
    {href: 'https://wiki.arcator.co.uk/', text: 'Wiki', external: true},
    {href: 'https://ssmp.arcator.co.uk/', text: 'SSMP', external: true},
    {href: 'https://hub.arcator.co.uk/#creative', text: 'Hub', external: true},
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
  auth.onAuthStateChanged(async (user) => {
    let userProfile = null;
    if (user) {
      userProfile = await getUserProfileFromFirestore(user.uid);
    }
    await loadNavbar(user, userProfile, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
    loadFooter('current-year-...');
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
    await refreshNavbarProfilePicture(window.currentUser);

    // Restore original after 5 seconds
    setTimeout(async () => {
      window.currentUser.photoURL = originalPhotoURL;
      await refreshNavbarProfilePicture(window.currentUser);
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
      await refreshNavbarProfilePicture(window.currentUser);

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

function getSafePhotoURL(photoURL, defaultProfilePic = null) {
  const fallback = defaultProfilePic || window.DEFAULT_PROFILE_PIC || 'https://placehold.co/32x32/1F2937/E5E7EB?text=AV';
  if (!photoURL || photoURL === '' || photoURL === 'undefined' || typeof photoURL !== 'string') {
    return fallback;
  }
  return photoURL;
}
