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
  const email = signInEmailInput.value;
  const password = signInPasswordInput.value;
  if (!email || !password) {
    showMessageBox('Please enter both email and password.', true);
    return;
  }
  try {
    console.log("DEBUG: Attempting sign-in for:", email);
    await signInWithEmailAndPassword(auth, email, password);
    showMessageBox('Signed in successfully! Redirecting...', false);
    // UI will update via onAuthStateChanged listener
  } catch (error) {
    console.error('Sign-in error:', error);
    showMessageBox(`Sign-in failed: ${error.message}`, true);
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
  const selectedFontSize = fontSizeSelect.value;
  const selectedHeadingMultiplier = headingSizeMultiplierSelect.value;
  const selectedFontFamily = fontFamilySelect.value;
  const selectedLineHeight = lineHeightSelect.value;
  const selectedLetterSpacing = letterSpacingSelect.value;
  const selectedBackgroundPattern = backgroundPatternSelect.value;
  const selectedBackgroundOpacity = backgroundOpacityRange.value;

  // Apply font size and family to body
  document.body.style.fontSize = selectedFontSize;
  document.body.style.fontFamily = selectedFontFamily;
  document.body.style.lineHeight = selectedLineHeight;
  document.body.style.letterSpacing = selectedLetterSpacing;

  // Apply heading size multiplier as CSS custom property
  document.documentElement.style.setProperty('--heading-size-multiplier', selectedHeadingMultiplier);

  // Apply background pattern with opacity
  const opacity = selectedBackgroundOpacity / 100;
  if (selectedBackgroundPattern === 'none') {
    document.body.style.backgroundImage = 'none';
  } else if (selectedBackgroundPattern === 'dots') {
    document.body.style.backgroundImage = `linear-gradient(90deg, rgba(0,0,0,${opacity}) 1px, transparent 1px), linear-gradient(rgba(0,0,0,${opacity}) 1px, transparent 1px)`;
    document.body.style.backgroundSize = '20px 20px';
  } else if (selectedBackgroundPattern === 'grid') {
    document.body.style.backgroundImage = `linear-gradient(to right, rgba(0, 0, 0, ${opacity}) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, ${opacity}) 1px, transparent 1px)`;
    document.body.style.backgroundSize = '40px 40px';
  } else if (selectedBackgroundPattern === 'diagonal') {
    document.body.style.backgroundImage = `linear-gradient(45deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25%), linear-gradient(-45deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25%)`;
    document.body.style.backgroundSize = '60px 60px';
  } else if (selectedBackgroundPattern === 'circles') {
    document.body.style.backgroundImage = `radial-gradient(circle, rgba(0, 0, 0, ${opacity}) 1px, transparent 1px)`;
    document.body.style.backgroundSize = '30px 30px';
  } else if (selectedBackgroundPattern === 'hexagons') {
    document.body.style.backgroundImage = `linear-gradient(60deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25.5%, transparent 75%, rgba(0, 0, 0, ${opacity}) 75%), linear-gradient(120deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25.5%, transparent 75%, rgba(0, 0, 0, ${opacity}) 75%)`;
    document.body.style.backgroundSize = '40px 40px';
  }

  // Save to Firestore
  if (auth.currentUser) {
    try {
      console.log("DEBUG: Saving preferences for UID:", auth.currentUser.uid);
      const updates = {
        fontSize: selectedFontSize,
        headingSizeMultiplier: selectedHeadingMultiplier,
        fontFamily: selectedFontFamily,
        lineHeight: selectedLineHeight,
        letterSpacing: selectedLetterSpacing,
        backgroundPattern: selectedBackgroundPattern,
        backgroundOpacity: selectedBackgroundOpacity
      };
      await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid), updates, { merge: true });
      showMessageBox('Preferences saved successfully!', false);
      console.log("DEBUG: Preferences saved to Firestore.");
    } catch (error) {
      console.error("Error saving preferences:", error);
      showMessageBox(`Failed to save preferences: ${error.message}`, true);
    }
  }
}

// Handler for saving notification settings
async function handleSaveNotifications() {
  if (!auth.currentUser) return;

  try {
    const notificationSettings = {
      emailNotifications: emailNotificationsCheckbox.checked,
      inappNotifications: inappNotificationsCheckbox.checked,
      announcementNotifications: announcementNotificationsCheckbox.checked,
      communityNotifications: communityNotificationsCheckbox.checked,
      securityNotifications: securityNotificationsCheckbox.checked,
      maintenanceNotifications: maintenanceNotificationsCheckbox.checked,
      notificationFrequency: notificationFrequencySelect.value
    };

    await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid), {
      notificationSettings: notificationSettings
    }, {merge: true});

    showMessageBox('Notification settings saved successfully!', false);
  } catch (error) {
    console.error("Error saving notification settings:", error);
    showMessageBox(`Failed to save notification settings: ${error.message}`, true);
  }
}

// Handler for saving privacy settings
async function handleSavePrivacy() {
  if (!auth.currentUser) return;

  try {
    const privacySettings = {
      profileVisibility: profileVisibilityCheckbox.checked,
      activityVisibility: activityVisibilityCheckbox.checked,
      analyticsConsent: analyticsConsentCheckbox.checked,
      dataRetention: dataRetentionSelect.value
    };

    await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid), {
      privacySettings: privacySettings
    }, {merge: true});

    showMessageBox('Privacy settings saved successfully!', false);
  } catch (error) {
    console.error("Error saving privacy settings:", error);
    showMessageBox(`Failed to save privacy settings: ${error.message}`, true);
  }
}

// Handler for saving accessibility settings
async function handleSaveAccessibility() {
  if (!auth.currentUser) return;

  try {
    const accessibilitySettings = {
      highContrast: highContrastCheckbox.checked,
      largeCursor: largeCursorCheckbox.checked,
      focusIndicators: focusIndicatorsCheckbox.checked,
      colorblindFriendly: colorblindFriendlyCheckbox.checked,
      reducedMotion: reducedMotionCheckbox.checked,
      disableAnimations: disableAnimationsCheckbox.checked,
      keyboardNavigation: keyboardNavigationCheckbox.checked,
      skipLinks: skipLinksCheckbox.checked,
      textToSpeech: textToSpeechCheckbox.checked,
      readingGuide: readingGuideCheckbox.checked,
      syntaxHighlighting: syntaxHighlightingCheckbox.checked,
      wordSpacing: wordSpacingCheckbox.checked
    };

    // Apply accessibility settings immediately
    applyAccessibilitySettings(accessibilitySettings);

    await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid), {
      accessibilitySettings: accessibilitySettings
    }, {merge: true});

    showMessageBox('Accessibility settings saved successfully!', false);
  } catch (error) {
    console.error("Error saving accessibility settings:", error);
    showMessageBox(`Failed to save accessibility settings: ${error.message}`, true);
  }
}

// Apply accessibility settings to the page
function applyAccessibilitySettings(settings) {
  const root = document.documentElement;

  if (settings.highContrast) {
    root.classList.add('high-contrast-mode');
  } else {
    root.classList.remove('high-contrast-mode');
  }

  if (settings.reducedMotion || settings.disableAnimations) {
    root.style.setProperty('--animation-duration', '0.01ms');
    root.style.setProperty('--transition-duration', '0.01ms');
  } else {
    root.style.removeProperty('--animation-duration');
    root.style.removeProperty('--transition-duration');
  }

  if (settings.largeCursor) {
    root.style.setProperty('--cursor-size', '24px');
  } else {
    root.style.removeProperty('--cursor-size');
  }

  if (settings.wordSpacing) {
    root.style.setProperty('--word-spacing', '0.2em');
  } else {
    root.style.removeProperty('--word-spacing');
  }
}

// Handler for saving advanced settings
async function handleSaveAdvanced() {
  if (!auth.currentUser) return;

  try {
    const advancedSettings = {
      lowBandwidthMode: lowBandwidthModeCheckbox.checked,
      disableImages: disableImagesCheckbox.checked,
      minimalUi: minimalUiCheckbox.checked,
      debugMode: debugModeCheckbox.checked,
      showPerformanceMetrics: showPerformanceMetricsCheckbox.checked,
      enableExperimentalFeatures: enableExperimentalFeaturesCheckbox.checked,
      customCss: customCssTextarea.value,
      keyboardShortcuts: keyboardShortcutsToggle.value
    };

    // Apply custom CSS if provided
    if (advancedSettings.customCss) {
      applyCustomCSS(advancedSettings.customCss);
    }

    // Apply advanced settings
    applyAdvancedSettings(advancedSettings);

    await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid), {
      advancedSettings: advancedSettings
    }, {merge: true});

    showMessageBox('Advanced settings saved successfully!', false);
  } catch (error) {
    console.error("Error saving advanced settings:", error);
    showMessageBox(`Failed to save advanced settings: ${error.message}`, true);
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

          // Load existing preferences for dropdowns
          if (fontSizeSelect) fontSizeSelect.value = userProfile.fontSize || '16px';
          if (fontFamilySelect) fontFamilySelect.value = userProfile.fontFamily || 'Inter, sans-serif';
          if (backgroundPatternSelect) backgroundPatternSelect.value = userProfile.backgroundPattern || 'none';

          // Load new font and typography settings
          if (headingSizeMultiplierSelect) headingSizeMultiplierSelect.value = userProfile.headingSizeMultiplier || '1.6';
          if (lineHeightSelect) lineHeightSelect.value = userProfile.lineHeight || '1.6';
          if (letterSpacingSelect) letterSpacingSelect.value = userProfile.letterSpacing || '0px';
          if (backgroundOpacityRange) backgroundOpacityRange.value = userProfile.backgroundOpacity || '10';
          if (backgroundOpacityValue) backgroundOpacityValue.textContent = (userProfile.backgroundOpacity || '10') + '%';

          // Load notification settings
          if (userProfile.notificationSettings) {
            const notif = userProfile.notificationSettings;
            if (emailNotificationsCheckbox) emailNotificationsCheckbox.checked = notif.emailNotifications || false;
            if (inappNotificationsCheckbox) inappNotificationsCheckbox.checked = notif.inappNotifications || false;
            if (announcementNotificationsCheckbox) announcementNotificationsCheckbox.checked = notif.announcementNotifications || false;
            if (communityNotificationsCheckbox) communityNotificationsCheckbox.checked = notif.communityNotifications || false;
            if (securityNotificationsCheckbox) securityNotificationsCheckbox.checked = notif.securityNotifications || false;
            if (maintenanceNotificationsCheckbox) maintenanceNotificationsCheckbox.checked = notif.maintenanceNotifications || false;
            if (notificationFrequencySelect) notificationFrequencySelect.value = notif.notificationFrequency || 'daily';
          }

          // Load privacy settings
          if (userProfile.privacySettings) {
            const privacy = userProfile.privacySettings;
            if (profileVisibilityCheckbox) profileVisibilityCheckbox.checked = privacy.profileVisibility || false;
            if (activityVisibilityCheckbox) activityVisibilityCheckbox.checked = privacy.activityVisibility || false;
            if (analyticsConsentCheckbox) analyticsConsentCheckbox.checked = privacy.analyticsConsent || false;
            if (dataRetentionSelect) dataRetentionSelect.value = privacy.dataRetention || '365';
          }

          // Load accessibility settings
          if (userProfile.accessibilitySettings) {
            const accessibility = userProfile.accessibilitySettings;
            if (highContrastCheckbox) highContrastCheckbox.checked = accessibility.highContrast || false;
            if (largeCursorCheckbox) largeCursorCheckbox.checked = accessibility.largeCursor || false;
            if (focusIndicatorsCheckbox) focusIndicatorsCheckbox.checked = accessibility.focusIndicators || false;
            if (colorblindFriendlyCheckbox) colorblindFriendlyCheckbox.checked = accessibility.colorblindFriendly || false;
            if (reducedMotionCheckbox) reducedMotionCheckbox.checked = accessibility.reducedMotion || false;
            if (disableAnimationsCheckbox) disableAnimationsCheckbox.checked = accessibility.disableAnimations || false;
            if (keyboardNavigationCheckbox) keyboardNavigationCheckbox.checked = accessibility.keyboardNavigation || false;
            if (skipLinksCheckbox) skipLinksCheckbox.checked = accessibility.skipLinks || false;
            if (textToSpeechCheckbox) textToSpeechCheckbox.checked = accessibility.textToSpeech || false;
            if (readingGuideCheckbox) readingGuideCheckbox.checked = accessibility.readingGuide || false;
            if (syntaxHighlightingCheckbox) syntaxHighlightingCheckbox.checked = accessibility.syntaxHighlighting || false;
            if (wordSpacingCheckbox) wordSpacingCheckbox.checked = accessibility.wordSpacing || false;

            // Apply accessibility settings immediately
            applyAccessibilitySettings(accessibility);
          }

          // Load advanced settings
          if (userProfile.advancedSettings) {
            const advanced = userProfile.advancedSettings;
            if (lowBandwidthModeCheckbox) lowBandwidthModeCheckbox.checked = advanced.lowBandwidthMode || false;
            if (disableImagesCheckbox) disableImagesCheckbox.checked = advanced.disableImages || false;
            if (minimalUiCheckbox) minimalUiCheckbox.checked = advanced.minimalUi || false;
            if (debugModeCheckbox) debugModeCheckbox.checked = advanced.debugMode || false;
            if (showPerformanceMetricsCheckbox) showPerformanceMetricsCheckbox.checked = advanced.showPerformanceMetrics || false;
            if (enableExperimentalFeaturesCheckbox) enableExperimentalFeaturesCheckbox.checked = advanced.enableExperimentalFeatures || false;
            if (customCssTextarea) customCssTextarea.value = advanced.customCss || '';
            if (keyboardShortcutsToggle) keyboardShortcutsToggle.value = advanced.keyboardShortcuts || 'disabled';

            // Apply advanced settings immediately
            applyAdvancedSettings(advanced);
            if (advanced.customCss) {
              applyCustomCSS(advanced.customCss);
            }
          }

          // Apply loaded preferences immediately to the body
          document.body.style.fontSize = userProfile.fontSize || '16px';
          document.body.style.fontFamily = userProfile.fontFamily || 'Inter, sans-serif';
          document.body.style.lineHeight = userProfile.lineHeight || '1.6';
          document.body.style.letterSpacing = userProfile.letterSpacing || '0px';

          // Apply heading size multiplier
          document.documentElement.style.setProperty('--heading-size-multiplier', userProfile.headingSizeMultiplier || '1.6');

          // Apply background pattern with opacity
          const opacity = (userProfile.backgroundOpacity || 10) / 100;
          if (userProfile.backgroundPattern === 'none') {
            document.body.style.backgroundImage = 'none';
          } else if (userProfile.backgroundPattern === 'dots') {
            document.body.style.backgroundImage = `linear-gradient(90deg, rgba(0,0,0,${opacity}) 1px, transparent 1px), linear-gradient(rgba(0,0,0,${opacity}) 1px, transparent 1px)`;
            document.body.style.backgroundSize = '20px 20px';
          } else if (userProfile.backgroundPattern === 'grid') {
            document.body.style.backgroundImage = `linear-gradient(to right, rgba(0, 0, 0, ${opacity}) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, ${opacity}) 1px, transparent 1px)`;
            document.body.style.backgroundSize = '40px 40px';
          } else if (userProfile.backgroundPattern === 'diagonal') {
            document.body.style.backgroundImage = `linear-gradient(45deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25%), linear-gradient(-45deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25%)`;
            document.body.style.backgroundSize = '60px 60px';
          } else if (userProfile.backgroundPattern === 'circles') {
            document.body.style.backgroundImage = `radial-gradient(circle, rgba(0, 0, 0, ${opacity}) 1px, transparent 1px)`;
            document.body.style.backgroundSize = '30px 30px';
          } else if (userProfile.backgroundPattern === 'hexagons') {
            document.body.style.backgroundImage = `linear-gradient(60deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25.5%, transparent 75%, rgba(0, 0, 0, ${opacity}) 75%), linear-gradient(120deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25.5%, transparent 75%, rgba(0, 0, 0, ${opacity}) 75%)`;
            document.body.style.backgroundSize = '40px 40px';
          }

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

  } catch (error) {
    console.error("user-main.js: Error during window.onload execution:", error);
    showMessageBox("An unexpected error occurred during page load.", true);
  } finally {
    // The hideLoading() is now consistently called within showSection()
    // which is invoked once the appropriate UI section is determined.
  }
};
