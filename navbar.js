// navbar.js - Modern navbar component
import {auth, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, getUserProfileFromFirestore,} from "./firebase-init.js";
import {applyTheme, getAvailableThemes} from "./themes.js";

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
}

const navbarStyles = `
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
  font-size: 0.875rem;
  padding: 0;
}

.navbar-bg.scrolled {
  background: rgba(var(--color-bg-navbar-rgb, 17, 24, 39), 0.98);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.navbar-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 56px;
  padding: 0 1rem;
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
}

.navbar-logo, .navbar-link, .navbar-user {
  min-height: 44px;
  line-height: 44px;
  align-items: center;
  display: flex;
}

.navbar-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--color-text-primary, #E5E7EB);
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0.5rem;
  border-radius: 0.5rem;
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
  height: 1.4em;
  width: 1.4em;
  min-width: 1.4em;
  min-height: 1.4em;
  vertical-align: middle;
  display: inline-block;
  flex-shrink: 0;
}

.navbar-logo:hover svg {
  transform: scale(1.1) rotate(5deg);
}

.navbar-links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  overflow-x: auto;
  scrollbar-width: thin;
  -ms-overflow-style: none;
  padding: 0.25rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  flex-wrap: nowrap;
}

.navbar-links::-webkit-scrollbar {
  height: 4px;
}

.navbar-links::-webkit-scrollbar-track {
  background: transparent;
}

.navbar-links::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.navbar-link {
  height: 44px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary, #E5E7EB);
  text-decoration: none;
  border-radius: 0.5rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
  background: transparent;
  border: 1px solid transparent;
  margin: 0 0.125rem;
  min-width: 0;
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
  border-radius: 0.5rem;
  z-index: -1;
}

.navbar-link:hover::before {
  opacity: 0.1;
}

.navbar-link:hover {
  color: var(--color-link, #60A5FA);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.15);
  border-color: rgba(96, 165, 250, 0.2);
}

.navbar-link svg {
  height: 1.2em;
  width: 1.2em;
  min-width: 1.2em;
  min-height: 1.2em;
  margin-right: 0.5rem;
  vertical-align: middle;
  display: inline-block;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.navbar-link:hover svg {
  transform: scale(1.1);
}

.navbar-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  position: relative;
}

.navbar-user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  cursor: pointer;
}

.navbar-user-avatar:hover {
  border-color: var(--color-link, #60A5FA);
  transform: scale(1.1);
}

.navbar-user-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--color-bg-card, #2D3748);
  border: 1px solid var(--color-input-border, #4B5563);
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  min-width: 200px;
  z-index: 1001;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.3s ease;
  margin-top: 0.5rem;
}

.navbar-user-menu.show {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.navbar-user-menu-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  color: var(--color-text-primary, #E5E7EB);
  text-decoration: none;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid var(--color-input-border, #4B5563);
}

.navbar-user-menu-item:last-child {
  border-bottom: none;
}

.navbar-user-menu-item:hover {
  background: var(--color-bg-content-section, #374151);
}

.navbar-user-menu-item svg {
  width: 1.2em;
  height: 1.2em;
  margin-right: 0.5rem;
}

.navbar-auth-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.navbar-auth-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
}

.navbar-auth-btn.primary {
  background: var(--color-button-blue-bg, #3B82F6);
  color: white;
}

.navbar-auth-btn.primary:hover {
  background: var(--color-button-blue-hover, #2563EB);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.navbar-auth-btn.secondary {
  background: transparent;
  color: var(--color-text-primary, #E5E7EB);
  border: 1px solid var(--color-input-border, #4B5563);
}

.navbar-auth-btn.secondary:hover {
  background: var(--color-bg-content-section, #374151);
  border-color: var(--color-link, #60A5FA);
  transform: translateY(-1px);
}

.navbar-mobile-menu {
  display: none;
  flex-direction: column;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--color-bg-navbar, #111827);
  border-top: 1px solid var(--color-input-border, #4B5563);
  padding: 1rem;
  z-index: 1001;
}

.navbar-mobile-menu.show {
  display: flex;
}

.navbar-mobile-link {
  padding: 0.75rem 0;
  color: var(--color-text-primary, #E5E7EB);
  text-decoration: none;
  border-bottom: 1px solid var(--color-input-border, #4B5563);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.navbar-mobile-link:last-child {
  border-bottom: none;
}

.navbar-mobile-link:hover {
  color: var(--color-link, #60A5FA);
}

.navbar-mobile-toggle {
  display: none;
  background: none;
  border: none;
  color: var(--color-text-primary, #E5E7EB);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.25rem;
  transition: background-color 0.2s ease;
}

.navbar-mobile-toggle:hover {
  background: var(--color-bg-content-section, #374151);
}

@media (max-width: 768px) {
  /* Show navbar links always, scale down for small screens */
  .navbar-links {
    display: flex;
    gap: 0.1rem;
    padding: 0.1rem;
    font-size: 0.8rem;
    flex-wrap: wrap;
  }
  .navbar-link {
    padding: 0 0.4rem;
    font-size: 0.8rem;
    height: 36px;
  }
  .navbar-mobile-toggle {
    display: block;
  }
  .navbar-user {
    gap: 0.5rem;
  }
  .navbar-auth-buttons {
    gap: 0.25rem;
  }
  .navbar-auth-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }
  .navbar-mobile-menu {
    display: none;
    flex-direction: column;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--color-bg-navbar, #111827);
    border-top: 1px solid var(--color-input-border, #4B5563);
    padding: 1rem;
    z-index: 1001;
  }
  .navbar-mobile-menu.show {
    display: flex;
  }
}

@media (max-width: 480px) {
  .navbar-container {
    padding: 0 0.5rem;
  }

  .navbar-logo {
    font-size: 1rem;
  }

  .navbar-user-avatar {
    width: 32px;
    height: 32px;
  }
}
`;

function injectNavbarStyles() {
  if (!document.getElementById('navbar-styles')) {
    const style = document.createElement('style');
    style.id = 'navbar-styles';
    style.textContent = navbarStyles;
    document.head.appendChild(style);
  }
}

function updateNavbarForTheme() {
  const navbarBg = document.querySelector('.navbar-bg');
  if (!navbarBg) return;

  const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-navbar');
  if (bgColor) {
    const rgb = hexToRgb(bgColor.trim());
    if (rgb) {
      document.documentElement.style.setProperty('--color-bg-navbar-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }
  }
}

function setupScrollEffects() {
  const navbar = document.querySelector('.navbar-bg');
  if (!navbar) return;

  let lastScrollTop = 0;
  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    lastScrollTop = scrollTop;
  });
}

function setupMobileMenu() {
  // Only run if both .navbar and .navbar-mobile-menu exist
  const navbar = document.querySelector('.navbar');
  const mobileMenu = document.querySelector('.navbar-mobile-menu');
  if (!navbar || !mobileMenu) return;

  // Remove old hamburger/X logic
  let menuBtn = document.querySelector('.navbar-mobile-menu-btn');
  if (!menuBtn) {
    menuBtn = document.createElement('button');
    menuBtn.className = 'navbar-mobile-menu-btn';
    menuBtn.innerHTML = '&#9776;'; // ≡
    menuBtn.setAttribute('aria-label', 'Open menu');
    menuBtn.style.position = 'absolute';
    menuBtn.style.left = '50%';
    menuBtn.style.transform = 'translateX(-50%)';
    menuBtn.style.top = '0.75rem';
    menuBtn.style.fontSize = '2rem';
    menuBtn.style.background = 'none';
    menuBtn.style.border = 'none';
    menuBtn.style.color = 'var(--color-text-primary)';
    menuBtn.style.zIndex = '1002';
    menuBtn.style.cursor = 'pointer';
    document.querySelector('.navbar').appendChild(menuBtn);
  }

  function toggleMenu() {
    if (mobileMenu.classList.contains('show')) {
      mobileMenu.classList.remove('show');
    } else {
      mobileMenu.classList.add('show');
    }
  }

  menuBtn.onclick = toggleMenu;

  // Hide menu on link click (dropdown style)
  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.onclick = () => mobileMenu.classList.remove('show');
  });
}

export function refreshNavbarProfilePicture(userProfile) {
  const avatar = document.querySelector('.navbar-user-avatar');
  if (!avatar) return;

  const photoURL = userProfile?.photoURL || DEFAULT_PROFILE_PIC;
  avatar.src = photoURL;
  avatar.alt = userProfile?.displayName || 'User Avatar';
}

async function updateNavbarState(authUser, userProfile, defaultProfilePic) {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');
  if (!navbarPlaceholder) return;

  const isLoggedIn = !!authUser;
  const displayName = userProfile?.displayName || authUser?.displayName || 'Anonymous';
  const photoURL = userProfile?.photoURL || authUser?.photoURL || defaultProfilePic;
  const isAdmin = userProfile?.isAdmin || false;

  const navbarHTML = `
    <nav class="navbar-bg">
      <div class="navbar-container">
        <a href="index.html" class="navbar-logo">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Arcator
        </a>

        <div class="navbar-links">
          <a href="about.html" class="navbar-link">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            About
          </a>
          <a href="servers-and-games.html" class="navbar-link">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 10 19.5 10s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
            Games
          </a>
          <a href="forms.html" class="navbar-link">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            </svg>
            Forum
          </a>
          <a href="admin.html" class="navbar-link">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
            </svg>
            Admin
          </a>
        </div>

        <div class="navbar-user">
          ${isLoggedIn ? `
            <a href="users.html"><img src="${photoURL}" alt="${displayName}" class="navbar-user-avatar" /></a>
          ` : `
            <a href="users.html" class="navbar-auth-btn primary">Sign In/Up</a>
          `}
        </div>
      </div>
    </nav>
  `;

  navbarPlaceholder.innerHTML = navbarHTML;

  injectNavbarStyles();
  updateNavbarForTheme();
  setupScrollEffects();
  setupMobileMenu();
}

async function applyUserTheme(userThemePreference, defaultThemeName) {
  try {
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) ||
                        allThemes.find(t => t.id === defaultThemeName);

    if (themeToApply) {
      applyTheme(themeToApply.id, themeToApply);
      updateNavbarForTheme();
    }
  } catch (error) {
    console.error('Error applying user theme:', error);
  }
}

export async function loadNavbar(authUser, userProfile, defaultProfilePic, defaultThemeName) {
  try {
    await updateNavbarState(authUser, userProfile, defaultProfilePic);
    await applyUserTheme(userProfile?.themePreference, defaultThemeName);

    // Set up auth state listener for automatic navbar updates
    auth.onAuthStateChanged(async (user) => {
      let profile = null;
      if (user) {
        profile = await getUserProfileFromFirestore(user.uid);
      }
      await updateNavbarState(user, profile, defaultProfilePic);
    });
  } catch (error) {
    console.error('Error loading navbar:', error);
  }
}

export async function loadFooter(yearElementId = null, additionalLinks = []) {
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (!footerPlaceholder) return;

  const currentYear = new Date().getFullYear();
  const yearText = yearElementId ?
    `<span id="${yearElementId}">${currentYear}</span>` :
    currentYear;

  const footerHTML = `
    <footer class="bg-navbar-footer text-text-secondary py-6 border-t border-input-border text-center">
      <div class="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-2">
        <span class="text-sm">&copy; ${yearText} Arcator.co.uk</span>
        <div class="flex items-center gap-4 text-sm">
          <a href="temp-page-viewer.html" class="text-link hover:underline flex items-center gap-1">
            <svg class="inline w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h16v16H4V4zm4 4h8v8H8V8z"/></svg>
            Pages
          </a>
          <a href="privacy.html" class="text-link hover:underline flex items-center gap-1">
            <svg class="inline w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Legal
          </a>
          <a href="https://wiki.arcator.co.uk/" class="text-link hover:underline flex items-center gap-1" target="_blank" rel="noopener">
            <svg class="inline w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Wiki
          </a>
          <a href="https://ssmp.arcator.co.uk/" class="text-link hover:underline flex items-center gap-1" target="_blank" rel="noopener">
            <svg class="inline w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/></svg>
            SSMP
          </a>
          <a href="https://hub.arcator.co.uk/#creative" class="text-link hover:underline flex items-center gap-1" target="_blank" rel="noopener">
            <svg class="inline w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="2" fill="none"/></svg>
            Hub
          </a>
        </div>
      </div>
    </footer>
  `;

  footerPlaceholder.innerHTML = footerHTML;
}

export async function forceRefreshNavbarState() {
  try {
    const user = auth.currentUser;
    let userProfile = null;

    if (user) {
      userProfile = await getUserProfileFromFirestore(user.uid);
    }

    await updateNavbarState(user, userProfile, DEFAULT_PROFILE_PIC);

    // Also update theme if user has a preference
    if (userProfile?.themePreference) {
      await applyUserTheme(userProfile.themePreference, DEFAULT_THEME_NAME);
    }
  } catch (error) {
    console.error('Error refreshing navbar state:', error);
  }
}

function renderMobileFooterNavbar() {
  if (window.innerWidth > 768) return;
  if (document.getElementById('mobile-footer-navbar')) return;
  const footer = document.createElement('nav');
  footer.id = 'mobile-footer-navbar';
  footer.style = `position:fixed;bottom:0;left:0;width:100vw;z-index:1000;background:var(--color-bg-navbar);box-shadow:0 -2px 8px rgba(0,0,0,0.1);display:flex;justify-content:space-around;align-items:center;padding:0.5rem 0;`;
  footer.innerHTML = `
    <a href="index.html" class="footer-link">Home</a>
    <a href="about.html" class="footer-link">About</a>
    <a href="servers-and-games.html" class="footer-link">Servers</a>
    <a href="users.html" class="footer-link">Users</a>
  `;
  document.body.appendChild(footer);
}

window.addEventListener('DOMContentLoaded', renderMobileFooterNavbar);
window.addEventListener('resize', () => {
  const el = document.getElementById('mobile-footer-navbar');
  if (window.innerWidth <= 768) {
    if (!el) renderMobileFooterNavbar();
  } else {
    if (el) el.remove();
  }
});
