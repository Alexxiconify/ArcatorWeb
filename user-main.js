// user-main.js - Main script for the User Account page
// Handles authentication UI, user settings, and interactions.

// Import necessary functions and variables from other modules
import {
  auth,
  db,
  appId,
  firebaseReadyPromise,
  DEFAULT_PROFILE_PIC,
  DEFAULT_THEME_NAME,
  getUserProfileFromFirestore,
  setUserProfileInFirestore
} from './firebase-init.js';

import {showMessageBox, sanitizeHandle, showCustomConfirm, validatePhotoURL} from './utils.js';
import { setupThemesFirebase, applyTheme, getAvailableThemes } from './themes.js';
import { loadNavbar } from './navbar.js'; // Ensure loadNavbar is imported
import {setupCustomThemeManagement} from './custom_theme_modal.js'; // Import custom theme management

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  getAuth
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc // Added setDoc for saving preferences
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- DOM Elements --
// Auth sections
const signInSection = document.getElementById('signin-section');
const signUpSection = document.getElementById('signup-section');
const forgotPasswordSection = document.getElementById('forgot-password-section');

// Sign In elements
const signInEmailInput = document.getElementById('signin-email');
const signInPasswordInput = document.getElementById('signin-password');
const signInButton = document.getElementById('signin-btn');
const goToSignUpLink = document.getElementById('go-to-signup-link');
const goToForgotPasswordLink = document.getElementById('go-to-forgot-password-link');

// Sign Up elements
const signUpEmailInput = document.getElementById('signup-email');
const signUpPasswordInput = document.getElementById('signup-password');
const signUpConfirmPasswordInput = document.getElementById('signup-confirm-password');
const signUpDisplayNameInput = document.getElementById('signup-display-name');
const signUpHandleInput = document.getElementById('signup-handle');
const signUpButton = document.getElementById('signup-btn');
const goToSignInLink = document.getElementById('go-to-signin-link');

// Forgot Password elements
const forgotPasswordEmailInput = document.getElementById('forgot-password-email');
const resetPasswordButton = document.getElementById('reset-password-btn');
const goToSignInFromForgotLink = document.getElementById('go-to-signin-from-forgot-link');

// Settings elements
const profilePictureDisplay = document.getElementById('profile-picture-display');
const displayNameText = document.getElementById('display-name-text');
const handleText = document.getElementById('handle-text');
const emailText = document.getElementById('email-text');
const settingsContent = document.getElementById('settings-content');
const loginRequiredMessage = document.getElementById('login-required-message');
const loadingSpinner = document.getElementById('loading-spinner');
const displayNameInput = document.getElementById('display-name-input');
const handleInput = document.getElementById('handle-input');
const profilePictureUrlInput = document.getElementById('profile-picture-url-input');
const saveProfileBtn = document.getElementById('save-profile-btn');
const savePreferencesBtn = document.getElementById('save-preferences-btn');
const fontSizeSelect = document.getElementById('font-size-select');
const fontFamilySelect = document.getElementById('font-family-select');
const backgroundPatternSelect = document.getElementById('background-pattern-select');

// New font and typography controls
const headingSizeMultiplierSelect = document.getElementById('heading-size-multiplier');
const lineHeightSelect = document.getElementById('line-height-select');
const letterSpacingSelect = document.getElementById('letter-spacing-select');
const backgroundOpacityRange = document.getElementById('background-opacity-range');
const backgroundOpacityValue = document.getElementById('background-opacity-value');

// Notification settings
const emailNotificationsCheckbox = document.getElementById('email-notifications-checkbox');
const inappNotificationsCheckbox = document.getElementById('inapp-notifications-checkbox');
const announcementNotificationsCheckbox = document.getElementById('announcement-notifications-checkbox');
const communityNotificationsCheckbox = document.getElementById('community-notifications-checkbox');
const securityNotificationsCheckbox = document.getElementById('security-notifications-checkbox');
const maintenanceNotificationsCheckbox = document.getElementById('maintenance-notifications-checkbox');
const notificationFrequencySelect = document.getElementById('notification-frequency-select');
const saveNotificationsBtn = document.getElementById('save-notifications-btn');

// Privacy settings
const profileVisibilityCheckbox = document.getElementById('profile-visibility-checkbox');
const activityVisibilityCheckbox = document.getElementById('activity-visibility-checkbox');
const analyticsConsentCheckbox = document.getElementById('analytics-consent-checkbox');
const dataRetentionSelect = document.getElementById('data-retention-select');
const exportDataBtn = document.getElementById('export-data-btn');
const importDataBtn = document.getElementById('import-data-btn');
const savePrivacyBtn = document.getElementById('save-privacy-btn');

// Accessibility settings
const highContrastCheckbox = document.getElementById('high-contrast-checkbox');
const largeCursorCheckbox = document.getElementById('large-cursor-checkbox');
const focusIndicatorsCheckbox = document.getElementById('focus-indicators-checkbox');
const colorblindFriendlyCheckbox = document.getElementById('colorblind-friendly-checkbox');
const reducedMotionCheckbox = document.getElementById('reduced-motion-checkbox');
const disableAnimationsCheckbox = document.getElementById('disable-animations-checkbox');
const keyboardNavigationCheckbox = document.getElementById('keyboard-navigation-checkbox');
const skipLinksCheckbox = document.getElementById('skip-links-checkbox');
const textToSpeechCheckbox = document.getElementById('text-to-speech-checkbox');
const readingGuideCheckbox = document.getElementById('reading-guide-checkbox');
const syntaxHighlightingCheckbox = document.getElementById('syntax-highlighting-checkbox');
const wordSpacingCheckbox = document.getElementById('word-spacing-checkbox');
const saveAccessibilityBtn = document.getElementById('save-accessibility-btn');

// Advanced settings
const lowBandwidthModeCheckbox = document.getElementById('low-bandwidth-mode-checkbox');
const disableImagesCheckbox = document.getElementById('disable-images-checkbox');
const minimalUiCheckbox = document.getElementById('minimal-ui-checkbox');
const debugModeCheckbox = document.getElementById('debug-mode-checkbox');
const showPerformanceMetricsCheckbox = document.getElementById('show-performance-metrics-checkbox');
const enableExperimentalFeaturesCheckbox = document.getElementById('enable-experimental-features-checkbox');
const customCssTextarea = document.getElementById('custom-css-textarea');
const keyboardShortcutsToggle = document.getElementById('keyboard-shortcuts-toggle');
const saveAdvancedBtn = document.getElementById('save-advanced-btn');
const resetAdvancedBtn = document.getElementById('reset-advanced-btn');

/**
 * Shows a specific section and hides others within the main content area.
 * This is a central control for navigation between auth forms and settings.
 * @param {HTMLElement} sectionElement - The DOM element of the section to make visible.
 */
function showSection(sectionElement) {
  console.log(`DEBUG: showSection called with element: ${sectionElement ? sectionElement.id : 'null'}`);
  // Hide all main content sections first
  const sections = [signInSection, signUpSection, forgotPasswordSection, settingsContent, loginRequiredMessage];
  sections.forEach(sec => {
    if (sec) sec.style.display = 'none';
  });

  if (sectionElement) {
    sectionElement.style.display = 'block';
    console.log(`DEBUG: Displayed section: ${sectionElement.id}`);

    // Update hero banner based on section
    const heroTitle = document.getElementById('hero-title');
    const heroSubtitle = document.getElementById('hero-subtitle');
    if (heroTitle && heroSubtitle) {
      switch (sectionElement.id) {
        case 'signin-section':
          heroTitle.textContent = 'Welcome Back!';
          heroSubtitle.textContent = 'Sign in to your account.';
          break;
        case 'signup-section':
          heroTitle.textContent = 'Join Arcator.co.uk!';
          heroSubtitle.textContent = 'Create your new account.';
          break;
        case 'forgot-password-section':
          heroTitle.textContent = 'Forgot Your Password?';
          heroSubtitle.textContent = 'Reset it here.';
          break;
        case 'settings-content':
          heroTitle.textContent = 'User Settings';
          heroSubtitle.textContent = 'Personalize your Arcator.co.uk experience.';
          break;
        case 'login-required-message':
          heroTitle.textContent = 'Access Restricted';
          heroSubtitle.textContent = 'Please sign in to continue.';
          break;
        default:
          heroTitle.textContent = 'Welcome';
          heroSubtitle.textContent = 'Manage your account or sign in.';
          break;
      }
    }
  } else {
    console.warn(`Attempted to show null section element.`);
  }
  hideLoading(); // Always hide loading once a section is displayed
}

/**
 * Shows the loading spinner and hides all content sections.
 */
function showLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'flex';
  // Hide all known content sections
  const sections = [signInSection, signUpSection, forgotPasswordSection, settingsContent, loginRequiredMessage];
  sections.forEach(sec => {
    if (sec) sec.style.display = 'none';
  });
  console.log("DEBUG: showLoading - Spinner visible, content hidden.");
}

/**
 * Hides the loading spinner.
 */
function hideLoading() {
  if (loadingSpinner) loadingSpinner.style.display = 'none';
  console.log("DEBUG: hideLoading - Spinner hidden.");
}

// Handler for user sign-in
async function handleSignIn() {
  const email = signInEmailInput.value.trim();
  const password = signInPasswordInput.value;
  if (!email || !password) {
    showMessageBox("Please enter both email and password.", true);
    return;
  }
  showLoading();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Success: reload page or redirect
    window.location.reload();
  } catch (error) {
    // Log full error for debugging
    console.error("Sign-in error:", error);
    // Show user-friendly error
    let msg = "Sign-in failed. Please check your email and password.";
    if (error && error.code) {
      if (error.code === 'auth/user-not-found') msg = "No account found for this email.";
      else if (error.code === 'auth/wrong-password') msg = "Incorrect password.";
      else if (error.code === 'auth/invalid-email') msg = "Invalid email address.";
      else if (error.code === 'auth/too-many-requests') msg = "Too many failed attempts. Try again later.";
      else if (error.message) msg = error.message;
    }
    showMessageBox(msg, true);
  } finally {
    hideLoading();
  }
}

// Handler for user sign-up
async function handleSignUp() {
  const email = signUpEmailInput.value;
  const password = signUpPasswordInput.value;
  const confirmPassword = signUpConfirmPasswordInput.value;
  const displayName = signUpDisplayNameInput.value.trim();
  const rawHandle = signUpHandleInput.value.trim();
  const handle = sanitizeHandle(rawHandle); // Sanitize the handle

  if (!email || !password || !confirmPassword || !displayName || !rawHandle) {
    showMessageBox('Please fill in all fields.', true);
    return;
  }
  if (password.length < 6) {
    showMessageBox('Password should be at least 6 characters.', true);
    return;
  }
  if (password !== confirmPassword) {
    showMessageBox('Passwords do not match.', true);
    return;
  }
  if (handle.length < 3) {
    showMessageBox('Handle must be at least 3 characters.', true);
    return;
  }
  if (handle !== rawHandle.toLowerCase().replace(/[^a-z0-9_.]/g, '') && rawHandle !== '') {
    showMessageBox('Handle contains invalid characters. Use only alphanumeric, dots, and underscores.', true);
    return;
  }

  try {
    console.log("DEBUG: Checking handle uniqueness for:", handle);
    // Check for handle uniqueness before creating user
    const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
    const q = query(usersRef, where('handle', '==', handle));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      showMessageBox('This handle is already taken. Please choose another.', true);
      return;
    }
    console.log("DEBUG: Handle is unique. Proceeding with user creation.");

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log("DEBUG: Firebase user created:", user.uid);

    // Ensure photoURL is DEFAULT_PROFILE_PIC on signup
    await updateProfile(user, {
      displayName: displayName,
      photoURL: DEFAULT_PROFILE_PIC // Always use default on signup
    });
    console.log("DEBUG: User profile updated in Firebase Auth.");

    const userProfileData = {
      uid: user.uid,
      displayName: displayName,
      email: email,
      photoURL: DEFAULT_PROFILE_PIC, // Ensure photoURL is DEFAULT_PROFILE_PIC in Firestore data
      createdAt: new Date(),
      lastLoginAt: new Date(),
      themePreference: DEFAULT_THEME_NAME,
      isAdmin: false, // Default to not admin
      handle: handle // Store the sanitized handle
    };
    await setUserProfileInFirestore(user.uid, userProfileData);
    console.log("DEBUG: User profile saved to Firestore.");

    showMessageBox('Account created successfully! Please sign in.', false);
    showSection(signInSection); // Redirect to sign-in after successful signup
  } catch (error) {
    console.error('Sign-up error:', error);
    showMessageBox(`Sign-up failed: ${error.message}`, true);
  }
}

// Handler for password reset
async function handlePasswordReset() {
  const email = forgotPasswordEmailInput.value;
  if (!email) {
    showMessageBox('Please enter your email address.', true);
    return;
  }
  try {
    console.log("DEBUG: Sending password reset email to:", email);
    await sendPasswordResetEmail(auth, email);
    showMessageBox('Password reset email sent! Check your inbox.', false);
    showSection(signInSection); // Redirect to sign-in after sending reset email
  } catch (error) {
    console.error('Password reset error:', error);
    showMessageBox(`Password reset failed: ${error.message}`, true);
  }
}

// Helper to reload and apply user profile after save
async function reloadAndApplyUserProfile() {
  if (!auth.currentUser) return;
  const userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
  if (!userProfile) return;

  console.log('DEBUG: reloadAndApplyUserProfile - userProfile:', userProfile);

  // Apply all settings to UI controls
  if (fontSizeSelect) fontSizeSelect.value = userProfile.fontSize || '16px';
  if (fontFamilySelect) fontFamilySelect.value = userProfile.fontFamily || 'Inter, sans-serif';
  if (backgroundPatternSelect) backgroundPatternSelect.value = userProfile.backgroundPattern || 'none';
  if (headingSizeMultiplierSelect) headingSizeMultiplierSelect.value = userProfile.headingSizeMultiplier || '1.6';
  if (lineHeightSelect) lineHeightSelect.value = userProfile.lineHeight || '1.6';
  if (letterSpacingSelect) letterSpacingSelect.value = userProfile.letterSpacing || '0px';
  if (backgroundOpacityRange) backgroundOpacityRange.value = userProfile.backgroundOpacity || '50';
  if (backgroundOpacityValue) backgroundOpacityValue.textContent = (userProfile.backgroundOpacity || '50') + '%';

  // Apply font scaling system
  applyFontScalingSystem(userProfile);

  // Load notification settings
  const notificationSettings = userProfile.notificationSettings || {};
  const notificationCheckboxes = [
    'email-notifications-checkbox',
    'inapp-notifications-checkbox',
    'announcement-notifications-checkbox',
    'community-notifications-checkbox',
    'security-notifications-checkbox',
    'maintenance-notifications-checkbox'
  ];

  notificationCheckboxes.forEach(checkboxId => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace('-checkbox', '');
      checkbox.checked = notificationSettings[settingKey] || false;
    }
  });

  // Add notification frequency
  const notificationFrequencySelect = document.getElementById('notification-frequency-select');
  if (notificationFrequencySelect) {
    notificationFrequencySelect.value = notificationSettings.notificationFrequency || 'immediate';
  }

  // Load privacy settings
  const privacySettings = userProfile.privacySettings || {};
  const privacyCheckboxes = [
    'profile-visibility-checkbox',
    'activity-visibility-checkbox',
    'analytics-consent-checkbox'
  ];

  privacyCheckboxes.forEach(checkboxId => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace('-checkbox', '');
      // Set defaults to true for profile visibility and activity status
      if (settingKey === 'profile-visibility' || settingKey === 'activity-visibility') {
        checkbox.checked = privacySettings[settingKey] !== undefined ? privacySettings[settingKey] : true;
      } else {
        checkbox.checked = privacySettings[settingKey] || false;
      }
    }
  });

  // Add data retention setting
  const dataRetentionSelect = document.getElementById('data-retention-select');
  if (dataRetentionSelect) {
    dataRetentionSelect.value = privacySettings.dataRetention || '90';
  }

  // Load accessibility settings
  const accessibilitySettings = userProfile.accessibilitySettings || {};
  const accessibilityCheckboxes = [
    'high-contrast-checkbox',
    'large-cursor-checkbox',
    'focus-indicators-checkbox',
    'colorblind-friendly-checkbox',
    'reduced-motion-checkbox',
    'disable-animations-checkbox',
    'keyboard-navigation-checkbox',
    'skip-links-checkbox',
    'text-to-speech-checkbox',
    'reading-guide-checkbox',
    'syntax-highlighting-checkbox',
    'word-spacing-checkbox'
  ];

  accessibilityCheckboxes.forEach(checkboxId => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace('-checkbox', '');
      checkbox.checked = accessibilitySettings[settingKey] || false;
    }
  });

  // Apply accessibility settings to the page
  applyAccessibilitySettings(accessibilitySettings);

  // Load advanced settings
  const advancedSettings = userProfile.advancedSettings || {};
  const advancedCheckboxes = [
    'low-bandwidth-mode-checkbox',
    'disable-images-checkbox',
    'minimal-ui-checkbox',
    'debug-mode-checkbox',
    'show-performance-metrics-checkbox',
    'enable-experimental-features-checkbox'
  ];

  advancedCheckboxes.forEach(checkboxId => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace('-checkbox', '');
      checkbox.checked = advancedSettings[settingKey] || false;
    }
  });

  // Add custom CSS
  const customCssTextarea = document.getElementById('custom-css-textarea');
  if (customCssTextarea && advancedSettings.customCSS) {
    customCssTextarea.value = advancedSettings.customCSS;
  }

  // Add keyboard shortcuts setting
  const keyboardShortcutsSelect = document.getElementById('keyboard-shortcuts-toggle');
  if (keyboardShortcutsSelect) {
    keyboardShortcutsSelect.value = advancedSettings.keyboardShortcuts || 'enabled';
  }

  // Apply advanced settings to the page
  applyAdvancedSettings(advancedSettings);
  if (advancedSettings.customCSS) {
    applyCustomCSS(advancedSettings.customCSS);
  }

  // Apply background pattern with opacity
  const backgroundPattern = userProfile.backgroundPattern || 'none';
  const backgroundOpacity = userProfile.backgroundOpacity || '50';
  const opacity = backgroundOpacity / 100;

  if (backgroundPattern === 'none') {
    document.body.style.backgroundImage = 'none';
  } else if (backgroundPattern === 'dots') {
    document.body.style.backgroundImage = `linear-gradient(90deg, rgba(0,0,0,${opacity}) 1px, transparent 1px), linear-gradient(rgba(0,0,0,${opacity}) 1px, transparent 1px)`;
    document.body.style.backgroundSize = '20px 20px';
  } else if (backgroundPattern === 'grid') {
    document.body.style.backgroundImage = `linear-gradient(rgba(0,0,0,${opacity}) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,${opacity}) 1px, transparent 1px)`;
    document.body.style.backgroundSize = '20px 20px';
  } else if (backgroundPattern === 'diagonal') {
    document.body.style.backgroundImage = `linear-gradient(45deg, rgba(0,0,0,${opacity}) 25%, transparent 25%, transparent 75%, rgba(0,0,0,${opacity}) 75%)`;
    document.body.style.backgroundSize = '20px 20px';
  } else if (backgroundPattern === 'circles') {
    document.body.style.backgroundImage = `radial-gradient(circle, rgba(0,0,0,${opacity}) 1px, transparent 1px)`;
    document.body.style.backgroundSize = '20px 20px';
  } else if (backgroundPattern === 'hexagons') {
    document.body.style.backgroundImage = `linear-gradient(60deg, rgba(0,0,0,${opacity}) 25%, transparent 25.5%, transparent 75%, rgba(0,0,0,${opacity}) 75%), linear-gradient(120deg, rgba(0,0,0,${opacity}) 25%, transparent 25.5%, transparent 75%, rgba(0,0,0,${opacity}) 75%)`;
    document.body.style.backgroundSize = '20px 20px';
  }

  // Load and apply keyboard shortcuts
  if (advancedSettings.keyboardShortcutsConfig) {
    keyboardShortcuts = {...defaultShortcuts, ...advancedSettings.keyboardShortcutsConfig};
  } else {
    keyboardShortcuts = {...defaultShortcuts};
  }

  // Initialize keyboard shortcuts system
  initializeKeyboardShortcuts();

  console.log('DEBUG: All settings loaded and applied successfully');
}

// Comprehensive font scaling system
function applyFontScalingSystem(userProfile) {
  const baseFontSize = parseInt(userProfile.fontSize || '16px');
  const headingMultiplier = parseFloat(userProfile.headingSizeMultiplier || '1.6');
  const fontFamily = userProfile.fontFamily || 'Inter, sans-serif';
  const lineHeight = userProfile.lineHeight || '1.6';
  const letterSpacing = userProfile.letterSpacing || '0px';

  // Set base font properties on body
  document.body.style.fontSize = `${baseFontSize}px`;
  document.body.style.fontFamily = fontFamily;
  document.body.style.lineHeight = lineHeight;
  document.body.style.letterSpacing = letterSpacing;

  // Define font size multipliers for different elements
  const fontMultipliers = {
    // Headings
    'h1': baseFontSize * headingMultiplier * 2.5,
    'h2': baseFontSize * headingMultiplier * 2.0,
    'h3': baseFontSize * headingMultiplier * 1.75,
    'h4': baseFontSize * headingMultiplier * 1.5,
    'h5': baseFontSize * headingMultiplier * 1.25,
    'h6': baseFontSize * headingMultiplier * 1.1,

    // Navigation and UI elements
    '.navbar-link': baseFontSize * 0.875,
    '.navbar-logo': baseFontSize * 1.25,
    '.btn-primary': baseFontSize * 0.875,
    '.btn-secondary': baseFontSize * 0.875,
    '.card-title': baseFontSize * 1.125,
    '.card-subtitle': baseFontSize * 0.875,

    // Form elements
    'input, select, textarea': baseFontSize * 0.875,
    'label': baseFontSize * 0.875,
    '.form-label': baseFontSize * 0.875,
    '.form-text': baseFontSize * 0.75,
    '.form-error': baseFontSize * 0.75,

    // Content elements
    'p': baseFontSize * 1.0,
    'span': baseFontSize * 1.0,
    'div': baseFontSize * 1.0,
    'a': baseFontSize * 1.0,
    'li': baseFontSize * 1.0,
    'td, th': baseFontSize * 0.875,

    // Small text elements
    '.text-sm': baseFontSize * 0.75,
    '.text-xs': baseFontSize * 0.625,
    '.caption': baseFontSize * 0.75,
    '.meta': baseFontSize * 0.75,
    '.timestamp': baseFontSize * 0.75,

    // Large text elements
    '.text-lg': baseFontSize * 1.125,
    '.text-xl': baseFontSize * 1.25,
    '.text-2xl': baseFontSize * 1.5,
    '.text-3xl': baseFontSize * 1.875,
    '.text-4xl': baseFontSize * 2.25,

    // Special elements
    '.hero-title': baseFontSize * headingMultiplier * 3.0,
    '.hero-subtitle': baseFontSize * headingMultiplier * 1.5,
    '.section-title': baseFontSize * headingMultiplier * 1.75,
    '.subsection-title': baseFontSize * headingMultiplier * 1.25,
    '.modal-title': baseFontSize * headingMultiplier * 1.5,
    '.modal-content': baseFontSize * 0.875,

    // Code and technical elements
    'code': baseFontSize * 0.875,
    'pre': baseFontSize * 0.875,
    '.code-block': baseFontSize * 0.875,
    '.inline-code': baseFontSize * 0.875,

    // Alert and notification elements
    '.alert': baseFontSize * 0.875,
    '.notification': baseFontSize * 0.875,
    '.message-box': baseFontSize * 0.875,
    '.tooltip': baseFontSize * 0.75,

    // Footer and sidebar elements
    'footer': baseFontSize * 0.875,
    '.footer-text': baseFontSize * 0.875,
    '.sidebar': baseFontSize * 0.875,
    '.sidebar-title': baseFontSize * 1.0,

    // Utility classes
    '.text-primary': baseFontSize * 1.0,
    '.text-secondary': baseFontSize * 0.875,
    '.text-muted': baseFontSize * 0.75,
    '.text-emphasis': baseFontSize * 1.125,
    '.text-deemphasized': baseFontSize * 0.875
  };

  // Apply font sizes to all elements
  Object.entries(fontMultipliers).forEach(([selector, fontSize]) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      el.style.fontSize = `${fontSize}px`;
      el.style.fontFamily = fontFamily;
      el.style.lineHeight = lineHeight;
      el.style.letterSpacing = letterSpacing;
    });
  });

  // Apply to specific Tailwind classes that might be used
  const tailwindClasses = {
    '.text-sm': baseFontSize * 0.875,
    '.text-base': baseFontSize * 1.0,
    '.text-lg': baseFontSize * 1.125,
    '.text-xl': baseFontSize * 1.25,
    '.text-2xl': baseFontSize * 1.5,
    '.text-3xl': baseFontSize * 1.875,
    '.text-4xl': baseFontSize * 2.25,
    '.text-5xl': baseFontSize * 3.0,
    '.text-6xl': baseFontSize * 3.75,
    '.text-xs': baseFontSize * 0.75
  };

  Object.entries(tailwindClasses).forEach(([className, fontSize]) => {
    const elements = document.querySelectorAll(className);
    elements.forEach(el => {
      el.style.fontSize = `${fontSize}px`;
    });
  });

  // Set CSS custom properties for use in CSS
  document.documentElement.style.setProperty('--base-font-size', `${baseFontSize}px`);
  document.documentElement.style.setProperty('--font-size-sm', `${baseFontSize * 0.875}px`);
  document.documentElement.style.setProperty('--font-size-base', `${baseFontSize}px`);
  document.documentElement.style.setProperty('--font-size-lg', `${baseFontSize * 1.125}px`);
  document.documentElement.style.setProperty('--font-size-xl', `${baseFontSize * 1.25}px`);
  document.documentElement.style.setProperty('--font-size-2xl', `${baseFontSize * 1.5}px`);
  document.documentElement.style.setProperty('--font-size-3xl', `${baseFontSize * 1.875}px`);
  document.documentElement.style.setProperty('--font-size-4xl', `${baseFontSize * 2.25}px`);
  document.documentElement.style.setProperty('--font-size-5xl', `${baseFontSize * 3.0}px`);
  document.documentElement.style.setProperty('--font-size-6xl', `${baseFontSize * 3.75}px`);
  document.documentElement.style.setProperty('--font-size-xs', `${baseFontSize * 0.75}px`);

  // Set heading-specific custom properties
  document.documentElement.style.setProperty('--heading-1-size', `${baseFontSize * headingMultiplier * 2.5}px`);
  document.documentElement.style.setProperty('--heading-2-size', `${baseFontSize * headingMultiplier * 2.0}px`);
  document.documentElement.style.setProperty('--heading-3-size', `${baseFontSize * headingMultiplier * 1.75}px`);
  document.documentElement.style.setProperty('--heading-4-size', `${baseFontSize * headingMultiplier * 1.5}px`);
  document.documentElement.style.setProperty('--heading-5-size', `${baseFontSize * headingMultiplier * 1.25}px`);
  document.documentElement.style.setProperty('--heading-6-size', `${baseFontSize * headingMultiplier * 1.1}px`);

  // Set other typography properties
  document.documentElement.style.setProperty('--line-height', lineHeight);
  document.documentElement.style.setProperty('--letter-spacing', letterSpacing);
  document.documentElement.style.setProperty('--font-family', fontFamily);
}

// Handler for saving profile changes
async function handleSaveProfile() {
  const newDisplayName = displayNameInput.value.trim();
  const newPhotoURL = profilePictureUrlInput.value.trim(); // Get raw input from field
  const rawNewHandle = handleInput.value.trim();
  const newHandle = sanitizeHandle(rawNewHandle);

  if (newHandle.length < 3) {
    showMessageBox('Handle must be at least 3 characters.', true);
    return;
  }
  if (newHandle !== rawNewHandle.toLowerCase().replace(/[^a-z0-9_.]/g, '') && rawNewHandle !== '') {
    showMessageBox('Handle contains invalid characters. Use only alphanumeric, dots, and underscores.', true);
    return;
  }

  if (auth.currentUser) {
    try {
      console.log("DEBUG: Preparing to save profile for UID:", auth.currentUser.uid);
      // Check for handle uniqueness if changing
      if (newHandle && newHandle !== (auth.currentUser.handle || '')) {
        const usersRef = collection(db, `artifacts/${appId}/public/data/user_profiles`);
        const q = query(usersRef, where('handle', '==', newHandle));
        const querySnapshot = await getDocs(q);
        // Ensure the found handle is not for the current user
        if (!querySnapshot.empty && querySnapshot.docs[0].id !== auth.currentUser.uid) {
          showMessageBox('This handle is already taken. Please choose another.', true);
          return;
        }
        console.log("DEBUG: New handle is unique or belongs to current user.");
      }

      const updates = {};
      // Compare with current user data to avoid unnecessary updates
      const currentProfile = await getUserProfileFromFirestore(auth.currentUser.uid);

      if (newDisplayName !== (currentProfile?.displayName || auth.currentUser.displayName)) {
        updates.displayName = newDisplayName;
      }

      // Determine the effective photo URL: use newPhotoURL if provided and valid, else fallback to current or default
      const effectivePhotoURL = newPhotoURL.startsWith('http') || newPhotoURL.startsWith('https') ? newPhotoURL : DEFAULT_PROFILE_PIC;
      if (effectivePhotoURL !== (currentProfile?.photoURL || auth.currentUser.photoURL || DEFAULT_PROFILE_PIC)) {
        updates.photoURL = effectivePhotoURL;
      }

      if (newHandle !== (currentProfile?.handle || auth.currentUser.uid.substring(0,6))) { // Compare with Firestore handle or default UID handle
        updates.handle = newHandle;
      }

      if (Object.keys(updates).length > 0) {
        console.log("DEBUG: Detected profile updates:", updates);
        // Update Firebase Auth profile (display name and photo URL)
        await updateProfile(auth.currentUser, {
          displayName: updates.displayName !== undefined ? updates.displayName : auth.currentUser.displayName,
          photoURL: updates.photoURL !== undefined ? updates.photoURL : auth.currentUser.photoURL
        });
        console.log("DEBUG: Firebase Auth profile updated.");

        // Update Firestore user profile (all fields including handle)
        await setUserProfileInFirestore(auth.currentUser.uid, updates);
        console.log("DEBUG: Firestore user profile updated.");

        // Immediately update UI elements
        if (profilePictureDisplay) {
          try {
            // Use the enhanced validation function
            const {validateAndTestPhotoURL} = await import('./utils.js');
            const finalPhotoURL = await validateAndTestPhotoURL(updates.photoURL || effectivePhotoURL, DEFAULT_PROFILE_PIC);
            console.log("DEBUG: Final photo URL:", finalPhotoURL);
            profilePictureDisplay.src = finalPhotoURL;

            // Add error handling for image loading
            profilePictureDisplay.onerror = function () {
              console.log("DEBUG: Image failed to load, falling back to default");
              this.src = DEFAULT_PROFILE_PIC;

              // Show helpful message if it's a Discord URL
              const failedURL = this.src;
              if (failedURL.includes('discordapp.com') || failedURL.includes('discord.com')) {
                showMessageBox("Your Discord profile picture URL appears to be broken. Consider uploading a new image or using a different hosting service.", true);
              }
            };

            profilePictureDisplay.onload = function () {
              console.log("DEBUG: Image loaded successfully");
            };
          } catch (error) {
            console.error("DEBUG: Error setting profile picture:", error);
            profilePictureDisplay.src = DEFAULT_PROFILE_PIC;
          }
        } else {
          console.error("DEBUG: profilePictureDisplay element not found!");
        }
        if (displayNameText) displayNameText.textContent = updates.displayName || 'N/A';
        if (handleText) handleText.textContent = updates.handle ? `@${updates.handle}` : '';

        // Refresh navbar profile picture
        if (typeof window.refreshNavbarProfilePicture === 'function') {
          try {
            await window.refreshNavbarProfilePicture();
          } catch (error) {
            console.error("DEBUG: Error refreshing navbar profile picture:", error);
          }
        }

        showMessageBox('Profile updated successfully!', false);
      } else {
        showMessageBox('No profile changes detected.', false);
        console.log("DEBUG: No profile changes detected.");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      showMessageBox(`Failed to update profile: ${error.message}`, true);
    }
  }
}

// Handler for saving preferences
async function handleSavePreferences() {
  if (!auth.currentUser) return;

  const fontSize = fontSizeSelect ? fontSizeSelect.value : '16px';
  const fontFamily = fontFamilySelect ? fontFamilySelect.value : 'Inter, sans-serif';
  const backgroundPattern = backgroundPatternSelect ? backgroundPatternSelect.value : 'none';
  const headingSizeMultiplier = headingSizeMultiplierSelect ? headingSizeMultiplierSelect.value : '1.6';
  const lineHeight = lineHeightSelect ? lineHeightSelect.value : '1.6';
  const letterSpacing = letterSpacingSelect ? letterSpacingSelect.value : '0px';
  const backgroundOpacity = backgroundOpacityRange ? backgroundOpacityRange.value : '50';

  const updates = {
    fontSize: fontSize,
    fontFamily: fontFamily,
    backgroundPattern: backgroundPattern,
    headingSizeMultiplier: headingSizeMultiplier,
    lineHeight: lineHeight,
    letterSpacing: letterSpacing,
    backgroundOpacity: backgroundOpacity
  };

  // Apply font scaling system immediately
  const userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
  const updatedProfile = {...userProfile, ...updates};
  applyFontScalingSystem(updatedProfile);

  // Apply background pattern with opacity immediately
  const opacity = (backgroundOpacity || 50) / 100;
  if (backgroundPattern === 'none') {
    document.body.style.backgroundImage = 'none';
  } else if (backgroundPattern === 'dots') {
    document.body.style.backgroundImage = `linear-gradient(90deg, rgba(0,0,0,${opacity}) 1px, transparent 1px), linear-gradient(rgba(0,0,0,${opacity}) 1px, transparent 1px)`;
    document.body.style.backgroundSize = '20px 20px';
  } else if (backgroundPattern === 'grid') {
    document.body.style.backgroundImage = `linear-gradient(to right, rgba(0, 0, 0, ${opacity}) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, ${opacity}) 1px, transparent 1px)`;
    document.body.style.backgroundSize = '40px 40px';
  } else if (backgroundPattern === 'diagonal') {
    document.body.style.backgroundImage = `linear-gradient(45deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25%), linear-gradient(-45deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25%)`;
    document.body.style.backgroundSize = '60px 60px';
  } else if (backgroundPattern === 'circles') {
    document.body.style.backgroundImage = `radial-gradient(circle, rgba(0, 0, 0, ${opacity}) 1px, transparent 1px)`;
    document.body.style.backgroundSize = '30px 30px';
  } else if (backgroundPattern === 'hexagons') {
    document.body.style.backgroundImage = `linear-gradient(60deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25.5%, transparent 75%, rgba(0, 0, 0, ${opacity}) 75%), linear-gradient(120deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25.5%, transparent 75%, rgba(0, 0, 0, ${opacity}) 75%)`;
    document.body.style.backgroundSize = '40px 40px';
  }

  try {
    const success = await setUserProfileInFirestore(auth.currentUser.uid, updates);
    if (success) {
      showMessageBox('Preferences saved successfully!', false);
      await reloadAndApplyUserProfile();
    }
  } catch (error) {
    console.error('Error saving preferences:', error);
    showMessageBox('Error saving preferences.', true);
  }
}

// Handler for saving notification settings
async function handleSaveNotifications() {
  if (!auth.currentUser) return;

  // Get all notification checkboxes
  const notificationCheckboxes = [
    'email-notifications-checkbox',
    'inapp-notifications-checkbox',
    'announcement-notifications-checkbox',
    'community-notifications-checkbox',
    'security-notifications-checkbox',
    'maintenance-notifications-checkbox'
  ];

  const notificationSettings = {};
  notificationCheckboxes.forEach(checkboxId => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace('-checkbox', '');
      notificationSettings[settingKey] = checkbox.checked;
      console.log(`DEBUG: Saving ${settingKey}:`, checkbox.checked);
    }
  });

  // Add notification frequency
  const notificationFrequencySelect = document.getElementById('notification-frequency-select');
  if (notificationFrequencySelect) {
    notificationSettings.notificationFrequency = notificationFrequencySelect.value;
  }

  console.log('DEBUG: Saving notificationSettings to Firebase:', notificationSettings);

  const updates = {
    notificationSettings: notificationSettings
  };

  try {
    const success = await setUserProfileInFirestore(auth.currentUser.uid, updates);
    if (success) {
      showMessageBox('Notification settings saved successfully!', false);
      await reloadAndApplyUserProfile();
    }
  } catch (error) {
    console.error('Error saving notification settings:', error);
    showMessageBox('Error saving notification settings.', true);
  }
}

// Handler for saving privacy settings
async function handleSavePrivacy() {
  if (!auth.currentUser) return;

  // Get all privacy checkboxes
  const privacyCheckboxes = [
    'profile-visibility-checkbox',
    'activity-visibility-checkbox',
    'analytics-consent-checkbox'
  ];

  const privacySettings = {};
  privacyCheckboxes.forEach(checkboxId => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace('-checkbox', '');
      privacySettings[settingKey] = checkbox.checked;
    }
  });

  // Add data retention setting
  const dataRetentionSelect = document.getElementById('data-retention-select');
  if (dataRetentionSelect) {
    privacySettings.dataRetention = dataRetentionSelect.value;
  }

  const updates = {
    privacySettings: privacySettings
  };

  try {
    const success = await setUserProfileInFirestore(auth.currentUser.uid, updates);
    if (success) {
      showMessageBox('Privacy settings saved successfully!', false);
      await reloadAndApplyUserProfile();
    }
  } catch (error) {
    console.error('Error saving privacy settings:', error);
    showMessageBox('Error saving privacy settings.', true);
  }
}

// Apply accessibility settings to the page
function applyAccessibilitySettings(settings) {
  const root = document.documentElement;

  // High Contrast Mode - Working implementation
  if (settings.highContrast) {
    root.classList.add('high-contrast-mode');
    // Apply high contrast styles
    const style = document.createElement('style');
    style.id = 'high-contrast-styles';
    style.textContent = `
      .high-contrast-mode {
        --color-text-primary: #FFFFFF !important;
        --color-text-secondary: #E5E7EB !important;
        --color-bg-card: #000000 !important;
        --color-bg-content-section: #1A1A1A !important;
        --color-bg-navbar: #000000 !important;
        --color-input-border: #FFFFFF !important;
        --color-link: #FFFF00 !important;
      }
      .high-contrast-mode * {
        border-color: #FFFFFF !important;
      }
      .high-contrast-mode input, .high-contrast-mode select, .high-contrast-mode textarea {
        background: #000000 !important;
        color: #FFFFFF !important;
        border: 2px solid #FFFFFF !important;
      }
    `;
    document.head.appendChild(style);
  } else {
    root.classList.remove('high-contrast-mode');
    const existingStyle = document.getElementById('high-contrast-styles');
    if (existingStyle) existingStyle.remove();
  }

  // Large Cursor - Working implementation
  if (settings.largeCursor) {
    root.style.setProperty('--cursor-size', '24px');
    const style = document.createElement('style');
    style.id = 'large-cursor-styles';
    style.textContent = `
      [style*="--cursor-size: 24px"] * {
        cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2"><path d="M0 0 L8 8 L6 10 L2 6 Z"/></svg>') 0 0, auto !important;
      }
    `;
    document.head.appendChild(style);
  } else {
    root.style.removeProperty('--cursor-size');
    const existingStyle = document.getElementById('large-cursor-styles');
    if (existingStyle) existingStyle.remove();
  }

  // Focus Indicators - Working implementation
  if (settings.focusIndicators) {
    root.classList.add('focus-indicators-enabled');
    const style = document.createElement('style');
    style.id = 'focus-indicators-styles';
    style.textContent = `
      .focus-indicators-enabled *:focus {
        outline: 3px solid #FFFF00 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 3px rgba(255, 255, 0, 0.5) !important;
      }
      button:focus, a:focus, input:focus, select:focus, textarea:focus {
        outline: 4px solid #FFFF00 !important;
        outline-offset: 3px !important;
      }
    `;
    document.head.appendChild(style);
  } else {
    const existingStyle = document.getElementById('focus-indicators-styles');
    if (existingStyle) existingStyle.remove();
  }

  // Skip Links - Working implementation
  if (settings.skipLinks) {
    // Create skip links if they don't exist
    if (!document.getElementById('skip-to-main')) {
      const skipLink = document.createElement('a');
      skipLink.id = 'skip-to-main';
      skipLink.href = '#main-content';
      skipLink.textContent = 'Skip to main content';
      skipLink.className = 'skip-link';
      skipLink.style.cssText = `
        position: absolute;
        top: -40px;
        left: 6px;
        background: #000000;
        color: #FFFFFF;
        padding: 8px;
        text-decoration: none;
        z-index: 10000;
        border-radius: 4px;
      `;
      document.body.insertBefore(skipLink, document.body.firstChild);
    }
    document.getElementById('skip-to-main').style.display = 'block';
  } else {
    const skipLink = document.getElementById('skip-to-main');
    if (skipLink) skipLink.style.display = 'none';
  }

  // Reading Guide - Working implementation
  if (settings.readingGuide) {
    const style = document.createElement('style');
    style.id = 'reading-guide-styles';
    style.textContent = `
      body::after {
        content: '';
        position: fixed;
        top: 0;
        left: 50%;
        width: 2px;
        height: 100vh;
        background: linear-gradient(to bottom, transparent, #FF0000, transparent);
        z-index: 9999;
        pointer-events: none;
        animation: reading-guide 2s ease-in-out infinite;
      }
      @keyframes reading-guide {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.8; }
      }
    `;
    document.head.appendChild(style);
  } else {
    const existingStyle = document.getElementById('reading-guide-styles');
    if (existingStyle) existingStyle.remove();
  }

  // Syntax Highlighting - Working implementation
  if (settings.syntaxHighlighting) {
    const style = document.createElement('style');
    style.id = 'syntax-highlighting-styles';
    style.textContent = `
      code, pre {
        background: #1E1E1E !important;
        color: #D4D4D4 !important;
        border: 1px solid #3E3E3E !important;
        border-radius: 4px !important;
        padding: 8px !important;
      }
      .keyword { color: #569CD6 !important; }
      .string { color: #CE9178 !important; }
      .comment { color: #6A9955 !important; }
      .function { color: #DCDCAA !important; }
      .number { color: #B5CEA8 !important; }
    `;
    document.head.appendChild(style);
  } else {
    const existingStyle = document.getElementById('syntax-highlighting-styles');
    if (existingStyle) existingStyle.remove();
  }

  // Colorblind Friendly - Working implementation
  if (settings.colorblindFriendly) {
    const style = document.createElement('style');
    style.id = 'colorblind-friendly-styles';
    style.textContent = `
      /* Deuteranopia (red-green color blindness) friendly colors */
      .colorblind-friendly {
        --color-link: #0066CC !important;
        --color-button-blue-bg: #0066CC !important;
        --color-button-green-bg: #009900 !important;
        --color-button-red-bg: #CC0000 !important;
        --color-button-yellow-bg: #CC6600 !important;
      }
      .colorblind-friendly button {
        border: 2px solid #000000 !important;
      }
      .colorblind-friendly a {
        text-decoration: underline !important;
      }
    `;
    document.head.appendChild(style);
    root.classList.add('colorblind-friendly');
  } else {
    const existingStyle = document.getElementById('colorblind-friendly-styles');
    if (existingStyle) existingStyle.remove();
    root.classList.remove('colorblind-friendly');
  }

  // Text-to-Speech - Working implementation using Web Speech API
  if (settings.textToSpeech) {
    if ('speechSynthesis' in window) {
      // Add speak button to all text elements
      const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div');
      textElements.forEach(element => {
        if (!element.hasAttribute('data-speech-added')) {
          element.style.cursor = 'pointer';
          element.setAttribute('data-speech-added', 'true');
          element.addEventListener('click', () => {
            const utterance = new SpeechSynthesisUtterance(element.textContent);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            speechSynthesis.speak(utterance);
          });
          element.title = 'Click to speak this text';
        }
      });
    }
  } else {
    // Remove speech functionality
    const textElements = document.querySelectorAll('[data-speech-added]');
    textElements.forEach(element => {
      element.style.cursor = '';
      element.removeAttribute('data-speech-added');
      element.removeAttribute('title');
    });
  }
}

// Handler for saving accessibility settings
async function handleSaveAccessibility() {
  if (!auth.currentUser) return;

  // Get all accessibility checkboxes
  const accessibilityCheckboxes = [
    'high-contrast-checkbox',
    'large-cursor-checkbox',
    'focus-indicators-checkbox',
    'colorblind-friendly-checkbox',
    'reduced-motion-checkbox',
    'disable-animations-checkbox',
    'keyboard-navigation-checkbox',
    'skip-links-checkbox',
    'text-to-speech-checkbox',
    'reading-guide-checkbox',
    'syntax-highlighting-checkbox',
    'word-spacing-checkbox'
  ];

  const accessibilitySettings = {};
  accessibilityCheckboxes.forEach(checkboxId => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace('-checkbox', '');
      accessibilitySettings[settingKey] = checkbox.checked;
    }
  });

  const updates = {
    accessibilitySettings: accessibilitySettings
  };

  // Apply accessibility settings immediately
  applyAccessibilitySettings(accessibilitySettings);

  try {
    const success = await setUserProfileInFirestore(auth.currentUser.uid, updates);
    if (success) {
      showMessageBox('Accessibility settings saved successfully!', false);
      await reloadAndApplyUserProfile();
    }
  } catch (error) {
    console.error('Error saving accessibility settings:', error);
    showMessageBox('Error saving accessibility settings.', true);
  }
}

// Handler for saving advanced settings
async function handleSaveAdvanced() {
  if (!auth.currentUser) return;

  // Get all advanced checkboxes
  const advancedCheckboxes = [
    'low-bandwidth-mode-checkbox',
    'disable-images-checkbox',
    'minimal-ui-checkbox',
    'debug-mode-checkbox',
    'show-performance-metrics-checkbox',
    'enable-experimental-features-checkbox'
  ];

  const advancedSettings = {};
  advancedCheckboxes.forEach(checkboxId => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace('-checkbox', '');
      advancedSettings[settingKey] = checkbox.checked;
    }
  });

  // Add custom CSS
  const customCssTextarea = document.getElementById('custom-css-textarea');
  if (customCssTextarea) {
    advancedSettings.customCSS = customCssTextarea.value;
  }

  // Add keyboard shortcuts setting
  const keyboardShortcutsSelect = document.getElementById('keyboard-shortcuts-toggle');
  if (keyboardShortcutsSelect) {
    advancedSettings.keyboardShortcuts = keyboardShortcutsSelect.value;
  }

  // Add keyboard shortcuts configuration
  advancedSettings.keyboardShortcutsConfig = keyboardShortcuts;

  const updates = {
    advancedSettings: advancedSettings
  };

  // Apply advanced settings immediately
  applyAdvancedSettings(advancedSettings);
  if (advancedSettings.customCSS) {
    applyCustomCSS(advancedSettings.customCSS);
  }

  try {
    const success = await setUserProfileInFirestore(auth.currentUser.uid, updates);
    if (success) {
      showMessageBox('Advanced settings saved successfully!', false);
      await reloadAndApplyUserProfile();
    }
  } catch (error) {
    console.error('Error saving advanced settings:', error);
    showMessageBox('Error saving advanced settings.', true);
  }
}

// Apply custom CSS
function applyCustomCSS(css) {
  let customStyleElement = document.getElementById('custom-user-css');
  if (!customStyleElement) {
    customStyleElement = document.createElement('style');
    customStyleElement.id = 'custom-user-css';
    document.head.appendChild(customStyleElement);
  }
  customStyleElement.textContent = css;
}

// Apply advanced settings
function applyAdvancedSettings(settings) {
  if (settings.debugMode) {
    document.body.classList.add('debug-mode');
  } else {
    document.body.classList.remove('debug-mode');
  }

  if (settings.minimalUi) {
    document.body.classList.add('minimal-ui');
  } else {
    document.body.classList.remove('minimal-ui');
  }

  if (settings.lowBandwidthMode) {
    document.body.classList.add('low-bandwidth-mode');
  } else {
    document.body.classList.remove('low-bandwidth-mode');
  }

  if (settings.showPerformanceMetrics) {
    // Add performance metrics display
    const metricsDiv = document.createElement('div');
    metricsDiv.className = 'performance-metrics';
    metricsDiv.innerHTML = `
      <div class="metric">
        <span>Load Time: ${performance.now().toFixed(2)}ms</span>
      </div>
      <div class="metric">
        <span>Memory: ${(performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB</span>
      </div>
    `;
    document.body.appendChild(metricsDiv);
  } else {
    const existingMetrics = document.querySelector('.performance-metrics');
    if (existingMetrics) {
      existingMetrics.remove();
    }
  }

  if (settings.disableImages) {
    document.body.classList.add('low-bandwidth-mode');
  } else {
    document.body.classList.remove('low-bandwidth-mode');
  }
}

// Handler for exporting user data
async function handleExportData() {
  if (!auth.currentUser) return;

  try {
    const userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
    const exportData = {
      exportDate: new Date().toISOString(),
      userProfile: userProfile,
      settings: {
        preferences: {
          fontSize: userProfile.fontSize,
          fontFamily: userProfile.fontFamily,
          lineHeight: userProfile.lineHeight,
          letterSpacing: userProfile.letterSpacing,
          backgroundPattern: userProfile.backgroundPattern,
          backgroundOpacity: userProfile.backgroundOpacity
        },
        notifications: userProfile.notificationSettings,
        privacy: userProfile.privacySettings,
        accessibility: userProfile.accessibilitySettings,
        advanced: userProfile.advancedSettings
      }
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `arcator-user-data-${auth.currentUser.uid}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showMessageBox('Data exported successfully!', false);
  } catch (error) {
    console.error("Error exporting data:", error);
    showMessageBox(`Failed to export data: ${error.message}`, true);
  }
}

// Handler for importing user data
async function handleImportData() {
  if (!auth.currentUser) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (importData.userProfile && importData.settings) {
        // Import settings
        await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid), {
          ...importData.userProfile,
          ...importData.settings
        }, {merge: true});

        showMessageBox('Data imported successfully! Please refresh the page to see changes.', false);
      } else {
        showMessageBox('Invalid data format. Please use a valid export file.', true);
      }
    } catch (error) {
      console.error("Error importing data:", error);
      showMessageBox(`Failed to import data: ${error.message}`, true);
    }
  };
  input.click();
}

// Handler for resetting advanced settings
async function handleResetAdvanced() {
  const confirmed = await showCustomConfirm(
    'Reset Advanced Settings',
    'This will reset all advanced settings to their default values. This action cannot be undone.'
  );

  if (!confirmed) return;

  try {
    // Reset checkboxes
    lowBandwidthModeCheckbox.checked = false;
    disableImagesCheckbox.checked = false;
    minimalUiCheckbox.checked = false;
    debugModeCheckbox.checked = false;
    showPerformanceMetricsCheckbox.checked = false;
    enableExperimentalFeaturesCheckbox.checked = false;

    // Reset textarea
    customCssTextarea.value = '';

    // Reset select
    keyboardShortcutsToggle.value = 'disabled';

    // Remove custom CSS
    const customStyleElement = document.getElementById('custom-user-css');
    if (customStyleElement) {
      customStyleElement.remove();
    }

    // Remove applied classes
    document.body.classList.remove('debug-mode', 'minimal-ui', 'low-bandwidth-mode');

    // Save reset settings
    await handleSaveAdvanced();

    showMessageBox('Advanced settings reset to defaults!', false);
  } catch (error) {
    console.error("Error resetting advanced settings:", error);
    showMessageBox(`Failed to reset settings: ${error.message}`, true);
  }
}

// Main execution logic when the window loads
window.onload = async function() {
  console.log("user-main.js: window.onload fired.");
  showLoading(); // Show spinner initially

  try {
    // Wait for Firebase to be fully initialized and available
    await firebaseReadyPromise;
    console.log("user-main.js: Firebase is ready. Proceeding with auth state check.");

    // Initialize themes module (connects it to Firebase instances)
    setupThemesFirebase();
    console.log("DEBUG: Themes module initialized.");

    // Listen for authentication state changes
    onAuthStateChanged(auth, async (user) => {
      console.log("user-main.js: onAuthStateChanged triggered. User:", user ? user.uid : "none", "User email:", user ? user.email : "none");
      console.log("DEBUG: Starting onAuthStateChanged processing block.");

      let userProfile = null; // Initialize userProfile here, moved to higher scope
      let userThemePreference = null; // Initialize here, moved to higher scope

      if (user && !user.isAnonymous) {
        console.log("DEBUG: User is authenticated and not anonymous. Attempting to fetch user profile.");
        // User is signed in and not anonymous. Fetch user profile.
        userProfile = await getUserProfileFromFirestore(user.uid);
        console.log("user-main.js: User Profile fetched for settings:", userProfile);

        // Load navbar with *both* the basic user object and the fetched userProfile.
        // This ensures navbar has full data to render correctly.
        await loadNavbar(user, userProfile, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
        console.log("DEBUG: Navbar loaded.");

        if (userProfile) {
          console.log("DEBUG: User profile found. Populating settings UI.");
          userThemePreference = userProfile.themePreference; // Assign value here

          // Update profile display elements
          console.log("DEBUG: Setting profile picture. userProfile.photoURL:", userProfile.photoURL, "user.photoURL:", user.photoURL);
          console.log("DEBUG: profilePictureDisplay element:", profilePictureDisplay);
          if (profilePictureDisplay) {
            const finalPhotoURL = validatePhotoURL(userProfile.photoURL || user.photoURL, DEFAULT_PROFILE_PIC);
            console.log("DEBUG: Final photo URL:", finalPhotoURL);
            profilePictureDisplay.src = finalPhotoURL;

            // Add error handling for image loading
            profilePictureDisplay.onerror = function () {
              console.log("DEBUG: Image failed to load, falling back to default");
              this.src = DEFAULT_PROFILE_PIC;

              // Show helpful message if it's a Discord URL
              const failedURL = this.src;
              if (failedURL.includes('discordapp.com') || failedURL.includes('discord.com')) {
                showMessageBox("Your Discord profile picture URL appears to be broken. Consider uploading a new image or using a different hosting service.", true);
              }
            };

            profilePictureDisplay.onload = function () {
              console.log("DEBUG: Image loaded successfully");
            };
          } else {
            console.error("DEBUG: profilePictureDisplay element not found!");
          }
          if (displayNameText) displayNameText.textContent = userProfile.displayName || 'N/A';
          if (handleText) handleText.textContent = userProfile.handle ? `@${userProfile.handle}` : '';
          if (emailText) emailText.textContent = userProfile.email || user.email || 'N/A';

          // Populate settings input fields
          if (displayNameInput) displayNameInput.value = userProfile.displayName || '';
          if (handleInput) handleInput.value = userProfile.handle || '';
          // Ensure profilePictureUrlInput is correctly populated or left empty for user input
          if (profilePictureUrlInput) {
            profilePictureUrlInput.value = userProfile.photoURL && userProfile.photoURL !== DEFAULT_PROFILE_PIC ? userProfile.photoURL : '';
          }

          // Populate session information
          if (document.getElementById('last-login-time') && userProfile.lastLoginAt) {
            const lastLoginDate = userProfile.lastLoginAt.toDate ? userProfile.lastLoginAt.toDate() : new Date(userProfile.lastLoginAt);
            document.getElementById('last-login-time').textContent = `Last Login: ${lastLoginDate.toLocaleString()}`;
          }
          if (document.getElementById('account-creation-time') && userProfile.createdAt) {
            const creationDate = userProfile.createdAt.toDate ? userProfile.createdAt.toDate() : new Date(userProfile.createdAt);
            document.getElementById('account-creation-time').textContent = `Account Created: ${creationDate.toLocaleString()}`;
          }

          // Use the centralized reloadAndApplyUserProfile function to load all settings consistently
          await reloadAndApplyUserProfile();

          showSection(settingsContent); // Display the settings section
        } else {
          console.warn("user-main.js: User profile not found in Firestore for UID:", user.uid, ". Displaying login required message.");
          showSection(loginRequiredMessage); // Fallback to login required
        }

        console.log("DEBUG: Attempting to apply theme after user profile processed.");
        // Apply the theme: user's preference, or the default theme.
        const allThemes = await getAvailableThemes();
        const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
        applyTheme(themeToApply.id, themeToApply);
        console.log("DEBUG: Theme applied.");

        // Populate theme select (moved inside the authenticated user block)
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
          themeSelect.innerHTML = '';
          allThemes.forEach(theme => {
            const opt = document.createElement('option');
            opt.value = theme.id;
            opt.textContent = theme.name;
            themeSelect.appendChild(opt);
          });
          // Set current theme as selected
          if (userProfile && userProfile.themePreference) {
            themeSelect.value = userProfile.themePreference;
          } else {
            themeSelect.value = DEFAULT_THEME_NAME;
          }
          // Change event
          themeSelect.onchange = async function () {
            const selectedThemeId = themeSelect.value;
            console.log(`DEBUG: Theme selection changed to: ${selectedThemeId}`);

            const themes = await getAvailableThemes();
            const selectedTheme = themes.find(t => t.id === selectedThemeId);

            if (selectedTheme) {
              console.log(`DEBUG: Found theme data:`, selectedTheme);
              await applyTheme(selectedTheme.id, selectedTheme);

              // Save theme preference to user profile
              if (auth.currentUser) {
                try {
                  await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid), {
                    themePreference: selectedThemeId
                  }, {merge: true});
                  console.log("Theme preference saved to user profile.");
                } catch (error) {
                  console.error("Error saving theme preference:", error);
                }
              }
            } else {
              console.error(`DEBUG: Theme not found for ID: ${selectedThemeId}`);
              console.log(`DEBUG: Available themes:`, themes.map(t => ({
                id: t.id,
                name: t.name,
                isCustom: t.isCustom
              })));
            }
          };

          // Setup custom theme management
          const populateThemeSelect = async (selectedThemeId = null) => {
            const themes = await getAvailableThemes();
            themeSelect.innerHTML = '';
            themes.forEach(theme => {
              const opt = document.createElement('option');
              opt.value = theme.id;
              opt.textContent = theme.name;
              themeSelect.appendChild(opt);
            });
            if (selectedThemeId) {
              themeSelect.value = selectedThemeId;
            }
          };

          setupCustomThemeManagement(
            db,
            auth,
            appId,
            showMessageBox,
            populateThemeSelect,
            themeSelect,
            DEFAULT_THEME_NAME,
            user,
            showCustomConfirm
          );
        }

      } else {
        // User is signed out or anonymous. Display the sign-in form.
        console.log("user-main.js: User logged out or anonymous. Showing sign-in section.");
        // Load navbar for logged-out state
        await loadNavbar(user, null, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
        console.log("DEBUG: Navbar loaded for logged-out user.");
        showSection(signInSection);
        console.log("DEBUG: Sign-in section displayed.");

        // Apply default theme for logged-out users
        console.log("DEBUG: Applying default theme for logged-out user.");
        const allThemes = await getAvailableThemes();
        const themeToApply = allThemes.find(t => t.id === DEFAULT_THEME_NAME);
        applyTheme(themeToApply.id, themeToApply);
        console.log("DEBUG: Default theme applied.");
      }
    });

    // --- Event Listeners for Authentication Navigation ---
    if (goToSignUpLink) goToSignUpLink.addEventListener('click', (e) => { e.preventDefault(); showSection(signUpSection); });
    if (goToSignInLink) goToSignInLink.addEventListener('click', (e) => { e.preventDefault(); showSection(signInSection); });
    if (goToForgotPasswordLink) goToForgotPasswordLink.addEventListener('click', (e) => { e.preventDefault(); showSection(forgotPasswordSection); });
    if (goToSignInFromForgotLink) goToSignInFromForgotLink.addEventListener('click', (e) => { e.preventDefault(); showSection(signInSection); });
    if (document.getElementById('link-to-signin')) document.getElementById('link-to-signin').addEventListener('click', (e) => { e.preventDefault(); showSection(signInSection); });

    // --- Event Listeners for Authentication Actions ---
    if (signInButton) signInButton.addEventListener('click', handleSignIn);
    if (signUpButton) signUpButton.addEventListener('click', handleSignUp);
    if (resetPasswordButton) resetPasswordButton.addEventListener('click', handlePasswordReset);

    // --- Event listeners for profile/preferences saving ---
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', handleSaveProfile);
    if (savePreferencesBtn) savePreferencesBtn.addEventListener('click', handleSavePreferences);

    // --- Placeholder Event Listeners for Future Features ---
    const changePasswordBtn = document.getElementById('change-password-btn');
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', () => showMessageBox('Change Password functionality coming soon!', false));

    const saveNotificationsBtn = document.getElementById('save-notifications-btn');
    if (saveNotificationsBtn) saveNotificationsBtn.addEventListener('click', handleSaveNotifications);

    const saveAccessibilityBtn = document.getElementById('save-accessibility-btn');
    if (saveAccessibilityBtn) saveAccessibilityBtn.addEventListener('click', handleSaveAccessibility);

    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', () => showMessageBox('Delete account functionality coming soon! Be careful with this one!', true));

    // New event listeners for enhanced settings
    if (savePrivacyBtn) savePrivacyBtn.addEventListener('click', handleSavePrivacy);
    if (exportDataBtn) exportDataBtn.addEventListener('click', handleExportData);
    if (importDataBtn) importDataBtn.addEventListener('click', handleImportData);
    if (saveAdvancedBtn) saveAdvancedBtn.addEventListener('click', handleSaveAdvanced);
    if (resetAdvancedBtn) resetAdvancedBtn.addEventListener('click', handleResetAdvanced);

    // Background opacity range slider
    if (backgroundOpacityRange && backgroundOpacityValue) {
      backgroundOpacityRange.addEventListener('input', function () {
        backgroundOpacityValue.textContent = this.value + '%';
      });
    }

    // Custom theme management
    const createCustomThemeBtn = document.getElementById('create-custom-theme-btn');
    if (createCustomThemeBtn) {
      createCustomThemeBtn.addEventListener('click', () => {
        setupCustomThemeManagement(db, auth, appId, showMessageBox, populateThemeSelect, themeSelect, DEFAULT_THEME_NAME, userProfile, showCustomConfirm);
      });
    }

    // Initialize keyboard shortcuts when page loads
    initializeKeyboardShortcuts();

  } catch (error) {
    console.error("user-main.js: Error during window.onload execution:", error);
    showMessageBox("An unexpected error occurred during page load.", true);
  } finally {
    // The hideLoading() is now consistently called within showSection()
    // which is invoked once the appropriate UI section is determined.
  }
};

// Keyboard shortcuts system
let keyboardShortcuts = {};
let isRecordingShortcut = false;
let currentRecordingShortcut = null;

// Set of disabled shortcut names
let disabledShortcuts = new Set();

// Reverse mapping: key combination => shortcut name
let shortcutKeyToName = {};

// Default keyboard shortcuts - Updated to avoid browser/OS conflicts
// Based on comprehensive browser shortcut analysis from https://dmcritchie.mvps.org/firefox/keyboard.htm
const defaultShortcuts = {
  'home': 'Alt+Shift+H',
  'about': 'Alt+Shift+A',
  'servers': 'Alt+Shift+S',
  'community': 'Alt+Shift+C',
  'interests': 'Alt+Shift+I',
  'games': 'Alt+Shift+G',
  'forms': 'Alt+Shift+F',
  'dms': 'Alt+Shift+D',
  'new-dm': 'Alt+Shift+N',
  'settings': 'Alt+Shift+U',
  'search': 'Alt+Shift+K',
  'help': 'F1',
  'logout': 'Alt+Shift+L'
};

// Page URL mappings
const pageUrls = {
  'home': 'index.html',
  'about': 'about.html',
  'servers': 'servers.html',
  'community': 'community.html',
  'interests': 'interests.html',
  'games': 'games.html',
  'forms': 'forms.html',
  'dms': 'forms.html#dms',
  'new-dm': 'forms.html#dms',
  'settings': 'users.html',
  'search': '#',
  'help': '#',
  'logout': '#'
};

// Initialize keyboard shortcuts
function initializeKeyboardShortcuts() {
  // Build the reverse mapping: key combination => shortcut name
  shortcutKeyToName = {};
  Object.entries(keyboardShortcuts).forEach(([name, combo]) => {
    shortcutKeyToName[combo] = name;
  });
  applyKeyboardShortcuts();
}

// Apply keyboard shortcuts to the page
function applyKeyboardShortcuts() {
  // Remove existing listeners
  document.removeEventListener('keydown', handleKeyboardShortcut);
  // Add new listener
  document.addEventListener('keydown', handleKeyboardShortcut);
}

// Handle keyboard shortcut events
function handleKeyboardShortcut(event) {
  if (isRecordingShortcut) return;
  const pressedKeys = getPressedKeys(event);
  const shortcutName = shortcutKeyToName[pressedKeys];
  // Toggle help modal on F1
  if (pressedKeys === 'F1') {
    event.preventDefault();
    showHelpModal();
    return;
  }
  if (shortcutName) {
    event.preventDefault();
    executeShortcut(shortcutName);
  }
}

// Get pressed keys as a string
function getPressedKeys(event) {
  const keys = [];

  // Check modifier keys
  if (event.altKey) keys.push('Alt');
  if (event.ctrlKey) keys.push('Ctrl');
  if (event.shiftKey) keys.push('Shift');
  if (event.metaKey) keys.push('Meta'); // Command key on Mac

  // Add the main key
  if (event.key && event.key !== 'Alt' && event.key !== 'Ctrl' && event.key !== 'Shift' && event.key !== 'Meta') {
    // Handle special keys
    const keyMap = {
      ' ': 'Space',
      'Enter': 'Enter',
      'Escape': 'Escape',
      'Tab': 'Tab',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
      'Home': 'Home',
      'End': 'End',
      'PageUp': 'PageUp',
      'PageDown': 'PageDown',
      'Insert': 'Insert',
      'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4', 'F5': 'F5', 'F6': 'F6',
      'F7': 'F7', 'F8': 'F8', 'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12'
    };

    const key = keyMap[event.key] || event.key.toUpperCase();
    keys.push(key);
  }

  return keys.join('+');
}

// Execute a shortcut action
function executeShortcut(shortcutKey) {
  console.log('Executing shortcut:', shortcutKey);

  // Check if shortcut is disabled
  if (disabledShortcuts.has(shortcutKey)) {
    console.log('Shortcut is disabled:', shortcutKey);
    return;
  }

  // Get the current shortcut mapping
  const currentShortcuts = JSON.parse(localStorage.getItem('customShortcuts')) || defaultShortcuts;
  const shortcut = currentShortcuts[shortcutKey];

  if (!shortcut) {
    console.log('No shortcut found for:', shortcutKey);
    return;
  }

  // Execute the appropriate action
  switch (shortcutKey) {
    case 'home':
      window.location.href = 'index.html';
      break;
    case 'about':
      window.location.href = 'about.html';
      break;
    case 'servers':
      window.location.href = 'servers.html';
      break;
    case 'community':
      window.location.href = 'community.html';
      break;
    case 'interests':
      window.location.href = 'interests.html';
      break;
    case 'games':
      window.location.href = 'games.html';
      break;
    case 'forms':
      window.location.href = 'forms.html';
      break;
    case 'dms':
      // Navigate to forms.html and open DMs tab
      window.location.href = 'forms.html#dms';
      break;
    case 'new-dm':
      // Navigate to forms.html and open new DM dialog
      window.location.href = 'forms.html#new-dm';
      break;
    case 'settings':
      window.location.href = 'users.html';
      break;
    case 'search':
      // Focus search if available, otherwise show search modal
      const searchInput = document.querySelector('input[type="search"], #search-input, .search-input');
      if (searchInput) {
        searchInput.focus();
      } else {
        // Create a simple search modal
        showSearchModal();
      }
      break;
    case 'help':
      // Show help modal or navigate to help page
      showHelpModal();
      break;
    case 'logout':
      // Handle logout
      if (window.auth && window.auth.currentUser) {
        window.auth.signOut().then(() => {
          window.location.reload();
        });
      }
      break;
    default:
      console.log('Unknown shortcut:', shortcutKey);
  }
}

// Helper function to show search modal
function showSearchModal() {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div style="background: var(--color-bg-card); padding: 2rem; border-radius: 0.5rem; min-width: 500px; max-width: 600px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="color: var(--color-text-primary); margin: 0;">Search</h3>
        <button id="close-search-modal-btn" style="background: var(--color-button-blue-bg); color: white; padding: 0.25rem 0.75rem; border: none; border-radius: 0.25rem; cursor: pointer;">Close</button>
      </div>

      <div style="margin-bottom: 1rem;">
        <input type="text" id="search-input-field" placeholder="Enter search term..." style="width: 100%; padding: 0.75rem; background: var(--color-input-bg); color: var(--color-input-text); border: 1px solid var(--color-input-border); border-radius: 0.25rem; font-size: 1rem;">
      </div>

      <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <button id="find-btn" style="background: var(--color-button-blue-bg); color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer; font-weight: 600;">Find</button>
        <button id="find-next-btn" style="background: var(--color-button-green-bg); color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer; font-weight: 600;">Find Next</button>
        <button id="find-prev-btn" style="background: var(--color-button-purple-bg); color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer; font-weight: 600;">Find Previous</button>
      </div>

      <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <label style="display: flex; align-items: center; gap: 0.25rem; color: var(--color-text-primary);">
          <input type="checkbox" id="case-sensitive-checkbox" style="margin: 0;">
          Case sensitive
        </label>
        <label style="display: flex; align-items: center; gap: 0.25rem; color: var(--color-text-primary);">
          <input type="checkbox" id="whole-word-checkbox" style="margin: 0;">
          Whole word
        </label>
      </div>

      <div id="search-results" style="color: var(--color-text-secondary); font-size: 0.875rem; min-height: 1.5rem;">
        Enter a search term to begin
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Get elements
  const searchInput = modal.querySelector('#search-input-field');
  const findBtn = modal.querySelector('#find-btn');
  const findNextBtn = modal.querySelector('#find-next-btn');
  const findPrevBtn = modal.querySelector('#find-prev-btn');
  const closeBtn = modal.querySelector('#close-search-modal-btn');
  const caseSensitiveCheckbox = modal.querySelector('#case-sensitive-checkbox');
  const wholeWordCheckbox = modal.querySelector('#whole-word-checkbox');
  const resultsDiv = modal.querySelector('#search-results');

  // Search state
  let currentMatches = [];
  let currentMatchIndex = -1;
  let lastSearchTerm = '';

  // Remove previous highlights
  function clearHighlights() {
    const highlights = document.querySelectorAll('.search-highlight');
    highlights.forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  }

  // Highlight matches
  function highlightMatches(searchTerm, caseSensitive, wholeWord) {
    clearHighlights();

    if (!searchTerm.trim()) {
      currentMatches = [];
      currentMatchIndex = -1;
      resultsDiv.textContent = 'Enter a search term to begin';
      return;
    }

    const flags = caseSensitive ? 'g' : 'gi';
    const regex = wholeWord ? new RegExp(`\\b${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, flags) : new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

    currentMatches = [];

    // Search in text nodes
    function searchInNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        let match;
        while ((match = regex.exec(text)) !== null) {
          currentMatches.push({
            node: node,
            start: match.index,
            end: match.index + match[0].length,
            text: match[0]
          });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip script and style tags
        if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE' && !node.closest('#search-modal')) {
          for (let child of node.childNodes) {
            searchInNode(child);
          }
        }
      }
    }

    // Search in body content
    const bodyContent = document.querySelector('body');
    searchInNode(bodyContent);

    // Highlight matches
    currentMatches.forEach((match, index) => {
      const node = match.node;
      const text = node.textContent;
      const before = text.substring(0, match.start);
      const after = text.substring(match.end);
      const highlighted = text.substring(match.start, match.end);

      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'search-highlight';
      highlightSpan.textContent = highlighted;
      highlightSpan.style.cssText = `
        background: ${index === currentMatchIndex ? 'var(--color-button-blue-bg)' : 'var(--color-button-yellow-bg)'};
        color: ${index === currentMatchIndex ? 'white' : 'black'};
        padding: 2px 4px;
        border-radius: 2px;
        font-weight: bold;
      `;

      const fragment = document.createDocumentFragment();
      if (before) fragment.appendChild(document.createTextNode(before));
      fragment.appendChild(highlightSpan);
      if (after) fragment.appendChild(document.createTextNode(after));

      node.parentNode.replaceChild(fragment, node);
    });

    // Update results
    if (currentMatches.length > 0) {
      resultsDiv.textContent = `Found ${currentMatches.length} match${currentMatches.length > 1 ? 'es' : ''}`;
      if (currentMatchIndex >= 0) {
        resultsDiv.textContent += ` (${currentMatchIndex + 1} of ${currentMatches.length})`;
      }
    } else {
      resultsDiv.textContent = 'No matches found';
    }
  }

  // Scroll to current match
  function scrollToCurrentMatch() {
    if (currentMatchIndex >= 0 && currentMatchIndex < currentMatches.length) {
      const highlights = document.querySelectorAll('.search-highlight');
      if (highlights[currentMatchIndex]) {
        highlights[currentMatchIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }

  // Find function
  function performFind() {
    const searchTerm = searchInput.value;
    const caseSensitive = caseSensitiveCheckbox.checked;
    const wholeWord = wholeWordCheckbox.checked;

    if (searchTerm !== lastSearchTerm) {
      currentMatchIndex = -1;
      lastSearchTerm = searchTerm;
    }

    highlightMatches(searchTerm, caseSensitive, wholeWord);

    if (currentMatches.length > 0) {
      currentMatchIndex = 0;
      highlightMatches(searchTerm, caseSensitive, wholeWord); // Re-highlight with current match
      scrollToCurrentMatch();
    }
  }

  // Find next function
  function findNext() {
    if (currentMatches.length === 0) {
      performFind();
      return;
    }

    currentMatchIndex = (currentMatchIndex + 1) % currentMatches.length;
    const searchTerm = searchInput.value;
    const caseSensitive = caseSensitiveCheckbox.checked;
    const wholeWord = wholeWordCheckbox.checked;
    highlightMatches(searchTerm, caseSensitive, wholeWord);
    scrollToCurrentMatch();
  }

  // Find previous function
  function findPrev() {
    if (currentMatches.length === 0) {
      performFind();
      return;
    }

    currentMatchIndex = currentMatchIndex <= 0 ? currentMatches.length - 1 : currentMatchIndex - 1;
    const searchTerm = searchInput.value;
    const caseSensitive = caseSensitiveCheckbox.checked;
    const wholeWord = wholeWordCheckbox.checked;
    highlightMatches(searchTerm, caseSensitive, wholeWord);
    scrollToCurrentMatch();
  }

  // Event listeners
  findBtn.addEventListener('click', performFind);
  findNextBtn.addEventListener('click', findNext);
  findPrevBtn.addEventListener('click', findPrev);

  closeBtn.addEventListener('click', () => {
    clearHighlights();
    modal.remove();
  });

  // Keyboard shortcuts
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        findPrev();
      } else {
        findNext();
      }
    } else if (e.key === 'Escape') {
      clearHighlights();
      modal.remove();
    }
  });

  // Auto-search on input change
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (searchInput.value.trim()) {
        performFind();
      } else {
        clearHighlights();
        resultsDiv.textContent = 'Enter a search term to begin';
      }
    }, 300);
  });

  // Focus the search input
  searchInput.focus();
  searchInput.select();
}

// Helper function to show help modal (toggle)
let helpModalInstance = null;
function showHelpModal() {
  // If modal is already open, close it and return
  if (helpModalInstance) {
    helpModalInstance.remove();
    helpModalInstance = null;
    return;
  }
  const modal = document.createElement('div');
  helpModalInstance = modal;
  modal.tabIndex = -1;
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  modal.innerHTML = `
    <div style="background: var(--color-bg-card); padding: 2rem; border-radius: 0.5rem; max-width: 600px; max-height: 80vh; overflow-y: auto; position: relative;">
      <button id="close-help-modal-btn" style="position: absolute; top: 1rem; right: 1rem; background: var(--color-button-blue-bg); color: white; padding: 0.25rem 0.75rem; border: none; border-radius: 0.25rem; cursor: pointer;">Close</button>
      <h3 style="margin-bottom: 1rem; color: var(--color-text-primary);">Keyboard Shortcuts Help</h3>
      <div style="color: var(--color-text-secondary); line-height: 1.6;">
        <p><strong>Navigation:</strong></p>
        <ul>
          <li>Alt+Shift+H - Home Page</li>
          <li>Alt+Shift+A - About Page</li>
          <li>Alt+Shift+S - Servers Page</li>
          <li>Alt+Shift+C - Community Page</li>
          <li>Alt+Shift+I - Interests Page</li>
          <li>Alt+Shift+G - Games Page</li>
          <li>Alt+Shift+F - Forms Page</li>
        </ul>
        <p><strong>Communication:</strong></p>
        <ul>
          <li>Alt+Shift+D - Direct Messages</li>
          <li>Alt+Shift+N - New DM</li>
        </ul>
        <p><strong>Settings:</strong></p>
        <ul>
          <li>Alt+Shift+U - User Settings</li>
          <li>Alt+Shift+T - Theme Settings</li>
        </ul>
        <p><strong>Utilities:</strong></p>
        <ul>
          <li>Alt+Shift+K - Search</li>
          <li>F1 - Help (this dialog)</li>
          <li>Alt+Shift+L - Logout</li>
        </ul>
        <p><strong>Note:</strong> You can customize these shortcuts in the Advanced Settings section.</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Focus for accessibility
  modal.focus();
  // Close on close button
  modal.querySelector('#close-help-modal-btn').onclick = () => {
    modal.remove();
    helpModalInstance = null;
  };
  // Close on Escape
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'F1') {
      modal.remove();
      helpModalInstance = null;
    }
  });
  // Trap focus inside modal
  modal.addEventListener('focusout', (e) => {
    if (!modal.contains(e.relatedTarget)) {
      setTimeout(() => modal.focus(), 0);
    }
  });
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', async function () {
  console.log('DEBUG: user-main.js DOMContentLoaded event fired');

  try {
    // Wait for Firebase to be ready
    await firebaseReadyPromise;
    console.log('DEBUG: Firebase is ready');

    // Setup themes
    setupThemesFirebase(db, auth, appId);

    // Setup custom theme management
    setupCustomThemeManagement(db, auth, appId, showMessageBox, populateThemeSelect, null, DEFAULT_THEME_NAME, auth.currentUser, showCustomConfirm);

    // Initialize keyboard shortcuts
    initializeKeyboardShortcuts();

    // Setup event listeners
    setupEventListeners();

    // Check authentication state
    auth.onAuthStateChanged(async (user) => {
      console.log('DEBUG: Auth state changed:', user ? 'User logged in' : 'No user');

      if (user) {
        // User is signed in
        console.log('DEBUG: User is signed in, loading profile...');
        const userProfile = await getUserProfileFromFirestore(user.uid);
        console.log('DEBUG: User profile loaded:', userProfile);

        // Load and apply user profile
        await reloadAndApplyUserProfile();

        // Show settings content
        showSection(settingsContent);

        // Load navbar
        await loadNavbar(user, userProfile, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);

      } else {
        // User is signed out
        console.log('DEBUG: User is signed out, showing sign in form');
        showSection(signInSection);

        // Load navbar without user
        await loadNavbar(null, null, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
      }
    });

    console.log('DEBUG: user-main.js initialization completed');

  } catch (error) {
    console.error('DEBUG: Error during user-main.js initialization:', error);
    showMessageBox('Failed to initialize page. Please refresh and try again.', true);
  }
});

// Setup all event listeners
function setupEventListeners() {
  console.log('DEBUG: Setting up event listeners');

  // Sign in form
  if (signInButton) {
    signInButton.addEventListener('click', handleSignIn);
  }

  // Sign up form
  if (signUpButton) {
    signUpButton.addEventListener('click', handleSignUp);
  }

  // Forgot password form
  if (resetPasswordButton) {
    resetPasswordButton.addEventListener('click', handlePasswordReset);
  }

  // Navigation links
  if (goToSignUpLink) {
    goToSignUpLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(signUpSection);
    });
  }

  if (goToSignInLink) {
    goToSignInLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(signInSection);
    });
  }

  if (goToForgotPasswordLink) {
    goToForgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(forgotPasswordSection);
    });
  }

  if (goToSignInFromForgotLink) {
    goToSignInFromForgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(signInSection);
    });
  }

  // Profile settings
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', handleSaveProfile);
  }

  if (savePreferencesBtn) {
    savePreferencesBtn.addEventListener('click', handleSavePreferences);
  }

  if (saveNotificationsBtn) {
    saveNotificationsBtn.addEventListener('click', handleSaveNotifications);
  }

  if (savePrivacyBtn) {
    savePrivacyBtn.addEventListener('click', handleSavePrivacy);
  }

  if (saveAccessibilityBtn) {
    saveAccessibilityBtn.addEventListener('click', handleSaveAccessibility);
  }

  if (saveAdvancedBtn) {
    saveAdvancedBtn.addEventListener('click', handleSaveAdvanced);
  }

  if (resetAdvancedBtn) {
    resetAdvancedBtn.addEventListener('click', handleResetAdvanced);
  }

  // Data management
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', handleExportData);
  }

  if (importDataBtn) {
    importDataBtn.addEventListener('click', handleImportData);
  }

  // Password change
  const changePasswordForm = document.getElementById('change-password-form');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Handle password change
      console.log('Password change form submitted');
    });
  }

  // Account deletion
  const deleteAccountForm = document.getElementById('delete-account-form');
  if (deleteAccountForm) {
    deleteAccountForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Handle account deletion
      console.log('Account deletion form submitted');
    });
  }

  // Background opacity range
  if (backgroundOpacityRange && backgroundOpacityValue) {
    backgroundOpacityRange.addEventListener('input', (e) => {
      backgroundOpacityValue.textContent = `${e.target.value}%`;
    });
  }

  // Profile picture URL preview
  if (profilePictureUrlInput) {
    profilePictureUrlInput.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      const previewMessage = document.getElementById('url-preview-message');

      if (url && previewMessage) {
        previewMessage.style.display = 'block';
      } else if (previewMessage) {
        previewMessage.style.display = 'none';
      }
    });
  }

  // Custom theme button
  const createCustomThemeBtn = document.getElementById('create-custom-theme-btn');
  if (createCustomThemeBtn) {
    createCustomThemeBtn.addEventListener('click', () => {
      // This will be handled by custom_theme_modal.js
      console.log('Create custom theme button clicked');
    });
  }

  // Keyboard shortcut buttons
  document.querySelectorAll('.shortcut-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const shortcutKey = e.target.dataset.shortcut;
      const input = document.getElementById(`shortcut-${shortcutKey}`);
      if (input) {
        input.classList.add('recording');
        input.placeholder = 'Press keys...';
        input.focus();

        // Handle key recording
        const handleKeyDown = (event) => {
          event.preventDefault();
          const keys = getPressedKeys(event);
          input.value = keys;
          input.classList.remove('recording');
          input.placeholder = keys;
          document.removeEventListener('keydown', handleKeyDown);
        };

        document.addEventListener('keydown', handleKeyDown);
      }
    });
  });

  document.querySelectorAll('.shortcut-disable-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const shortcutKey = e.target.dataset.shortcut;
      const input = document.getElementById(`shortcut-${shortcutKey}`);
      if (input) {
        if (e.target.classList.contains('disabled')) {
          e.target.classList.remove('disabled');
          e.target.textContent = 'Disable';
          input.disabled = false;
          input.style.opacity = '1';
          disabledShortcuts.delete(shortcutKey);
        } else {
          e.target.classList.add('disabled');
          e.target.textContent = 'Disabled';
          input.disabled = true;
          input.style.opacity = '0.5';
          disabledShortcuts.add(shortcutKey);
        }
      }
    });
  });

  console.log('DEBUG: Event listeners setup completed');
}
