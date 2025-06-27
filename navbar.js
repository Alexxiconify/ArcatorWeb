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
      <a class="navbar-link" href="https://wiki.arcator.co.uk/" rel="noopener noreferrer" target="_blank">
        <span>Wiki</span>
      </a>
      <a class="navbar-link" href="forms.html">
        <span>Forms</span>
      </a>
      <a class="navbar-link" href="donations.html">
        <span>Support</span>
      </a>

      <!-- User profile section -->
      <div class="navbar-user">
        <!-- User settings link (hidden by default, shown when logged in) -->
        <a class="navbar-link hidden" href="users.html" id="navbar-user-settings-link">
          <img alt="Profile" class="profile-pic-small"
               id="navbar-user-profile-pic" src="https://placehold.co/32x32/1F2937/E5E7EB?text=AV">
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
 * Updates navbar UI based on user authentication state
 * @param {Object|null} authUser - Firebase User object
 * @param {Object|null} userProfile - User profile from Firestore
 * @param {string} defaultProfilePic - Default profile picture URL
 */
function updateNavbarState(authUser, userProfile, defaultProfilePic) {
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

    // Update profile picture
    if (userProfilePic) {
      const safePhotoURL = validatePhotoURL(userProfile.photoURL, defaultProfilePic);
      userProfilePic.src = safePhotoURL;
      userProfilePic.alt = userProfile.displayName || 'User Profile';
    }
  } else {
    // User is not logged in
    if (userSettingsLink) {
      userSettingsLink.classList.add('hidden');
    }
    if (signinLink) {
      signinLink.classList.remove('hidden');
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
    updateNavbarState(authUser, userProfile, defaultProfilePic);

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
