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
  setUserProfileInFirestore,
} from "./firebase-init.js";

import {
  showMessageBox,
  sanitizeHandle,
  showCustomConfirm,
  validatePhotoURL,
} from "./utils.js";
import {
  setupThemesFirebase,
  applyTheme,
  getAvailableThemes,
  cacheUserTheme,
} from "./themes.js";
import { loadNavbar } from "./navbar.js"; // Ensure loadNavbar is imported

// Import global shortcut functions from app.js
import {
  defaultShortcuts,
  shortcutCategories,
  shortcutDescriptions,
  testShortcutCombination,
  getCurrentShortcuts,
  updateGlobalShortcuts,
  toggleShortcutDisabled,
} from "./app.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  GithubAuthProvider,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc, // Added setDoc for saving preferences
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Toggle password visibility for input fields
 * @param {string} inputId - The ID of the password input field
 * @param {HTMLElement} button - The toggle button element
 */
function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    button.innerHTML = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
      </svg>
    `;
    button.setAttribute("aria-label", "Hide password");
  } else {
    input.type = "password";
    button.innerHTML = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
      </svg>
    `;
    button.setAttribute("aria-label", "Show password");
  }
}

// Make the function globally available
window.togglePasswordVisibility = togglePasswordVisibility;

// Random name and handle generation
const RANDOM_NAMES = [
  "Alex",
  "Jordan",
  "Casey",
  "Riley",
  "Quinn",
  "Avery",
  "Morgan",
  "Taylor",
  "Blake",
  "Cameron",
  "Dakota",
  "Emery",
  "Finley",
  "Gray",
  "Harper",
  "Indigo",
  "Jules",
  "Kai",
  "Lane",
  "Mason",
  "Nova",
  "Ocean",
  "Parker",
  "River",
  "Sage",
  "Teagan",
  "Unity",
  "Vale",
  "Winter",
  "Xander",
  "Yuki",
  "Zara",
  "Atlas",
  "Breeze",
  "Cedar",
  "Dawn",
  "Echo",
  "Flame",
  "Grove",
  "Haven",
  "Iris",
  "Jade",
  "Kestrel",
  "Luna",
  "Moss",
  "Nyx",
  "Orion",
  "Phoenix",
  "Quill",
  "Raven",
  "Storm",
  "Thunder",
  "Vega",
  "Willow",
  "Zen",
  "Aurora",
  "Blaze",
  "Crystal",
  "Dusk",
  "Ember",
  "Frost",
  "Glow",
  "Haze",
  "Ink",
  "Jazz",
  "Karma",
  "Lux",
  "Mist",
  "Nebula",
  "Opal",
  "Prism",
  "Quartz",
  "Radiant",
  "Shadow",
  "Tide",
  "Umbra",
  "Vapor",
  "Whisper",
  "Xenon",
  "Yara",
  "Zephyr",
  "Aero",
  "Bolt",
  "Cipher",
  "Delta",
  "Echo",
  "Flux",
  "Gamma",
  "Helix",
  "Ion",
  "Jet",
  "Kilo",
  "Laser",
  "Mega",
  "Nano",
  "Omega",
  "Pulse",
  "Quantum",
  "Rocket",
  "Sonic",
  "Titan",
  "Ultra",
  "Void",
  "Wave",
  "Xen",
  "Yankee",
  "Zulu",
  "Alpha",
  "Bravo",
  "Charlie",
];

const RANDOM_ADJECTIVES = [
  "Swift",
  "Bright",
  "Clever",
  "Daring",
  "Eager",
  "Fierce",
  "Gentle",
  "Happy",
  "Intense",
  "Joyful",
  "Kind",
  "Lively",
  "Mighty",
  "Noble",
  "Optimistic",
  "Peaceful",
  "Quick",
  "Radiant",
  "Strong",
  "Tender",
  "Unique",
  "Vibrant",
  "Warm",
  "Xenial",
  "Youthful",
  "Zealous",
  "Adventurous",
  "Bold",
  "Creative",
  "Dynamic",
  "Energetic",
  "Fearless",
  "Genuine",
  "Harmonious",
  "Innovative",
  "Jubilant",
  "Knowledgeable",
  "Luminous",
  "Magnificent",
  "Natural",
  "Outstanding",
  "Passionate",
  "Quirky",
  "Resilient",
  "Spirited",
  "Tenacious",
  "Unstoppable",
  "Versatile",
  "Wondrous",
  "Xenodochial",
  "Yearning",
  "Zestful",
  "Ambitious",
  "Brilliant",
  "Charismatic",
  "Dedicated",
  "Enthusiastic",
  "Focused",
  "Grateful",
  "Hopeful",
  "Inspiring",
  "Jovial",
  "Keen",
  "Loving",
  "Motivated",
  "Nurturing",
  "Open",
  "Patient",
  "Qualified",
  "Reliable",
  "Sincere",
  "Trustworthy",
  "Understanding",
  "Valuable",
  "Wise",
  "Xenial",
  "Young",
  "Zealous",
  "Authentic",
  "Balanced",
  "Compassionate",
  "Determined",
  "Empathetic",
  "Faithful",
  "Generous",
  "Honest",
  "Imaginative",
  "Just",
  "Kindhearted",
  "Loyal",
];

/**
 * Generate a random name and handle for new users
 */
function generateRandomNameAndHandle() {
  const randomName =
    RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  const randomAdjective =
    RANDOM_ADJECTIVES[Math.floor(Math.random() * RANDOM_ADJECTIVES.length)];
  const randomNumber = Math.floor(Math.random() * 999) + 1;

  const displayName = `${randomAdjective} ${randomName}`;
  const handle = `${randomAdjective.toLowerCase()}${randomName.toLowerCase()}${randomNumber}`;

  return { displayName, handle };
}

/**
 * Generate a colored profile picture with the first letter
 */
function generateColoredProfilePic(displayName) {
  const firstLetter = displayName.charAt(0).toUpperCase();

  // Generate similar colors for text and background
  const hue = Math.floor(Math.random() * 360);
  const saturation = Math.floor(Math.random() * 30) + 60; // 60-90%
  const lightness = Math.floor(Math.random() * 20) + 30; // 30-50%

  const bgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  const textColor = `hsl(${hue}, ${saturation}%, ${lightness > 40 ? 10 : 90}%)`; // Dark or light text based on background

  const svg = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="${bgColor}" rx="100"/>
      <text x="100" y="120" font-family="Arial, sans-serif" font-size="80" font-weight="bold" 
            text-anchor="middle" fill="${textColor}">${firstLetter}</text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// --- DOM Elements --
// Auth sections
const signInSection = document.getElementById("signin-section");
const signUpSection = document.getElementById("signup-section");
const forgotPasswordSection = document.getElementById(
  "forgot-password-section",
);

// Sign In elements
const signInEmailInput = document.getElementById("signin-email");
const signInPasswordInput = document.getElementById("signin-password");
const signInButton = document.getElementById("signin-btn");
const goToSignUpLink = document.getElementById("go-to-signup-link");
const goToForgotPasswordLink = document.getElementById(
  "go-to-forgot-password-link",
);

// Sign Up elements
const signUpEmailInput = document.getElementById("signup-email");
const signUpPasswordInput = document.getElementById("signup-password");
const signUpConfirmPasswordInput = document.getElementById(
  "signup-confirm-password",
);
const signUpDisplayNameInput = document.getElementById("signup-display-name");
const signUpHandleInput = document.getElementById("signup-handle");
const signUpButton = document.getElementById("signup-btn");
const goToSignInLink = document.getElementById("go-to-signin-link");

// Forgot Password elements
const forgotPasswordEmailInput = document.getElementById(
  "forgot-password-email",
);
const resetPasswordButton = document.getElementById("reset-password-btn");
const goToSignInFromForgotLink = document.getElementById(
  "go-to-signin-from-forgot-link",
);

// Settings elements
const profilePictureDisplay = document.getElementById(
  "profile-picture-display",
);
const displayNameText = document.getElementById("display-name-text");
const handleText = document.getElementById("handle-text");
const emailText = document.getElementById("email-text");
const settingsContent = document.getElementById("settings-content");
const loginRequiredMessage = document.getElementById("login-required-message");
const loadingSpinner = document.getElementById("loading-spinner");
const displayNameInput = document.getElementById("display-name-input");
const handleInput = document.getElementById("handle-input");
const emailInput = document.getElementById("email-input");
const profilePictureUrlInput = document.getElementById(
  "profile-picture-url-input",
);
const saveProfileBtn = document.getElementById("save-profile-btn");
const savePreferencesBtn = document.getElementById("save-preferences-btn");
const fontSizeSelect = document.getElementById("font-size-select");
const fontFamilySelect = document.getElementById("font-family-select");
const backgroundPatternSelect = document.getElementById(
  "background-pattern-select",
);

// New font and typography controls
const headingSizeMultiplierSelect = document.getElementById(
  "heading-size-multiplier",
);
const lineHeightSelect = document.getElementById("line-height-select");
const letterSpacingSelect = document.getElementById("letter-spacing-select");
const backgroundOpacityRange = document.getElementById(
  "background-opacity-range",
);
const backgroundOpacityValue = document.getElementById(
  "background-opacity-value",
);

// Notification settings
const emailNotificationsCheckbox = document.getElementById(
  "email-notifications-checkbox",
);
const inappNotificationsCheckbox = document.getElementById(
  "inapp-notifications-checkbox",
);
const announcementNotificationsCheckbox = document.getElementById(
  "announcement-notifications-checkbox",
);
const communityNotificationsCheckbox = document.getElementById(
  "community-notifications-checkbox",
);
const securityNotificationsCheckbox = document.getElementById(
  "security-notifications-checkbox",
);
const maintenanceNotificationsCheckbox = document.getElementById(
  "maintenance-notifications-checkbox",
);
const notificationFrequencySelect = document.getElementById(
  "notification-frequency-select",
);
const saveNotificationsBtn = document.getElementById("save-notifications-btn");

// Privacy settings
const profileVisibilityCheckbox = document.getElementById(
  "profile-visibility-checkbox",
);
const activityVisibilityCheckbox = document.getElementById(
  "activity-visibility-checkbox",
);
const analyticsConsentCheckbox = document.getElementById(
  "analytics-consent-checkbox",
);
const dataRetentionSelect = document.getElementById("data-retention-select");
const exportDataBtn = document.getElementById("export-data-btn");
const importDataBtn = document.getElementById("import-data-btn");
const savePrivacyBtn = document.getElementById("save-privacy-btn");

// Accessibility settings
const highContrastCheckbox = document.getElementById("high-contrast-checkbox");
const largeCursorCheckbox = document.getElementById("large-cursor-checkbox");
const focusIndicatorsCheckbox = document.getElementById(
  "focus-indicators-checkbox",
);
const colorblindFriendlyCheckbox = document.getElementById(
  "colorblind-friendly-checkbox",
);
const reducedMotionCheckbox = document.getElementById(
  "reduced-motion-checkbox",
);
const disableAnimationsCheckbox = document.getElementById(
  "disable-animations-checkbox",
);
const skipLinksCheckbox = document.getElementById("skip-links-checkbox");
const readingGuideCheckbox = document.getElementById("reading-guide-checkbox");
const syntaxHighlightingCheckbox = document.getElementById(
  "syntax-highlighting-checkbox",
);
const wordSpacingCheckbox = document.getElementById("word-spacing-checkbox");
const saveAccessibilityBtn = document.getElementById("save-accessibility-btn");

// Advanced settings
const lowBandwidthModeCheckbox = document.getElementById(
  "low-bandwidth-mode-checkbox",
);
const disableImagesCheckbox = document.getElementById(
  "disable-images-checkbox",
);
const minimalUiCheckbox = document.getElementById("minimal-ui-checkbox");
const debugModeCheckbox = document.getElementById("debug-mode-checkbox");
const showPerformanceMetricsCheckbox = document.getElementById(
  "show-performance-metrics-checkbox",
);
const enableExperimentalFeaturesCheckbox = document.getElementById(
  "enable-experimental-features-checkbox",
);
const customCssTextarea = document.getElementById("custom-css-textarea");
const keyboardShortcutsToggle = document.getElementById(
  "keyboard-shortcuts-toggle",
);
const saveAdvancedBtn = document.getElementById("save-advanced-btn");
const resetAdvancedBtn = document.getElementById("reset-advanced-btn");

// Social authentication buttons
const googleSignInBtn = document.getElementById("google-signin-btn");
const githubSignInBtn = document.getElementById("github-signin-btn");
const googleSignUpBtn = document.getElementById("google-signup-btn");
const githubSignUpBtn = document.getElementById("github-signup-btn");

/**
 * Shows a specific section and hides others within the main content area.
 * This is a central control for navigation between auth forms and settings.
 * @param {HTMLElement} sectionElement - The DOM element of the section to make visible.
 */
function showSection(sectionElement) {
  // Hide all main content sections first
  const sections = [
    signInSection,
    signUpSection,
    forgotPasswordSection,
    settingsContent,
    loginRequiredMessage,
  ];
  sections.forEach((sec) => {
    if (sec) sec.style.display = "none";
  });

  if (sectionElement) {
    sectionElement.style.display = "block";

    // Update hero banner based on section
    const heroTitle = document.getElementById("hero-title");
    const heroSubtitle = document.getElementById("hero-subtitle");
    if (heroTitle && heroSubtitle) {
      switch (sectionElement.id) {
        case "signin-section":
          heroTitle.textContent = "Welcome Back!";
          heroSubtitle.textContent = "Sign in to your account.";
          break;
        case "signup-section":
          heroTitle.textContent = "Join Arcator.co.uk!";
          heroSubtitle.textContent = "Create your new account.";
          break;
        case "forgot-password-section":
          heroTitle.textContent = "Forgot Your Password?";
          heroSubtitle.textContent = "Reset it here.";
          break;
        case "settings-content":
          heroTitle.textContent = "User Settings";
          heroSubtitle.textContent =
            "Personalize your Arcator.co.uk experience.";
          break;
        case "login-required-message":
          heroTitle.textContent = "Access Restricted";
          heroSubtitle.textContent = "Please sign in to continue.";
          break;
        default:
          heroTitle.textContent = "Welcome";
          heroSubtitle.textContent = "Manage your account or sign in.";
          break;
      }
    }
  }
}

/**
 * Shows the loading spinner and hides all content sections.
 */
function showLoading() {
  if (loadingSpinner) {
    loadingSpinner.style.display = "flex";
  }
  if (signInSection) signInSection.style.display = "none";
  if (signUpSection) signUpSection.style.display = "none";
  if (forgotPasswordSection) forgotPasswordSection.style.display = "none";
  if (settingsContent) settingsContent.style.display = "none";
  if (loginRequiredMessage) loginRequiredMessage.style.display = "none";
}

/**
 * Hides the loading spinner.
 */
function hideLoading() {
  if (loadingSpinner) {
    loadingSpinner.style.display = "none";
  }
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
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    // Success: reload page or redirect
    window.location.reload();
  } catch (error) {
    // Log full error for debugging
    console.error("Sign-in error:", error);
    // Show user-friendly error
    let msg = "Sign-in failed. Please check your email and password.";
    if (error && error.code) {
      if (error.code === "auth/user-not-found")
        msg = "No account found for this email.";
      else if (error.code === "auth/wrong-password")
        msg = "Incorrect password.";
      else if (error.code === "auth/invalid-email")
        msg = "Invalid email address.";
      else if (error.code === "auth/too-many-requests")
        msg = "Too many failed attempts. Try again later.";
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

  if (!email || !password || !confirmPassword) {
    showMessageBox("Please fill in all required fields.", true);
    return;
  }
  if (password.length < 6) {
    showMessageBox("Password should be at least 6 characters.", true);
    return;
  }
  if (password !== confirmPassword) {
    showMessageBox("Passwords do not match.", true);
    return;
  }

  try {
    // Generate random name and handle if not provided
    let finalDisplayName = displayName;
    let finalHandle = handle;
    let profilePicUrl = DEFAULT_PROFILE_PIC;

    if (!finalDisplayName) {
      const randomData = generateRandomNameAndHandle();
      finalDisplayName = randomData.displayName;
      finalHandle = randomData.handle;
      profilePicUrl = generateColoredProfilePic(finalDisplayName);
    } else if (!finalHandle) {
      // If display name is provided but no handle, generate handle from display name
      finalHandle = sanitizeHandle(
        finalDisplayName.toLowerCase().replace(/\s+/g, ""),
      );
      if (finalHandle.length < 3) {
        finalHandle = finalHandle + Math.floor(Math.random() * 999) + 1;
      }
      profilePicUrl = generateColoredProfilePic(finalDisplayName);
    } else {
      // Both provided, generate colored profile pic
      profilePicUrl = generateColoredProfilePic(finalDisplayName);
    }

    if (finalHandle.length < 3) {
      showMessageBox("Handle must be at least 3 characters.", true);
      return;
    }
    if (
      finalHandle !== rawHandle.toLowerCase().replace(/[^a-z0-9_.]/g, "") &&
      rawHandle !== ""
    ) {
      showMessageBox(
        "Handle contains invalid characters. Use only alphanumeric, dots, and underscores.",
        true,
      );
      return;
    }

    console.log("DEBUG: Checking handle uniqueness for:", finalHandle);
    // Check for handle uniqueness before creating user
    const usersRef = collection(
      db,
      `artifacts/${appId}/public/data/user_profiles`,
    );
    const q = query(usersRef, where("handle", "==", finalHandle));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      showMessageBox(
        "This handle is already taken. Please choose another.",
        true,
      );
      return;
    }
    console.log("DEBUG: Handle is unique. Proceeding with user creation.");

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;
    console.log("DEBUG: Firebase user created:", user.uid);

    // Use generated profile picture
    await updateProfile(user, {
      displayName: finalDisplayName,
      photoURL: profilePicUrl,
    });
    console.log("DEBUG: User profile updated in Firebase Auth.");

    const userProfileData = {
      uid: user.uid,
      displayName: finalDisplayName,
      email: email,
      photoURL: profilePicUrl,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      themePreference: DEFAULT_THEME_NAME,
      isAdmin: false, // Default to not admin
      handle: finalHandle, // Store the sanitized handle
    };
    await setUserProfileInFirestore(user.uid, userProfileData);
    console.log("DEBUG: User profile saved to Firestore.");

    showMessageBox("Account created successfully! Please sign in.", false);
    showSection(signInSection); // Redirect to sign-in after successful signup
  } catch (error) {
    console.error("Sign-up error:", error);
    showMessageBox(`Sign-up failed: ${error.message}`, true);
  }
}

/**
 * Handles password reset request
 */
async function handlePasswordReset() {
  const email = forgotPasswordEmailInput.value.trim();
  if (!email) {
    showMessageBox("Please enter your email address.", true);
    return;
  }

  try {
    showLoading();
    await sendPasswordResetEmail(auth, email);
    showMessageBox("Password reset email sent! Check your inbox.");
    showSection(signInSection);
  } catch (error) {
    console.error("Password reset error:", error);
    showMessageBox(
      "Failed to send reset email. Please check your email address.",
      true,
    );
  } finally {
    hideLoading();
  }
}

/**
 * Handles Google sign-in
 */
async function handleGoogleSignIn() {
  try {
    showLoading();
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    // Check if this is a new user
    if (result._tokenResponse?.isNewUser) {
      // Generate random name and handle for new Google user
      const randomData = generateRandomNameAndHandle();
      const displayName = result.user.displayName || randomData.displayName;
      const handle = randomData.handle;
      const profilePicUrl =
        result.user.photoURL || generateColoredProfilePic(displayName);

      // Create user profile for new Google user
      const userProfile = {
        displayName: displayName,
        email: result.user.email || "",
        photoURL: profilePicUrl,
        handle: handle,
        themePreference: DEFAULT_THEME_NAME,
        createdAt: new Date(),
        lastLogin: new Date(),
        provider: "google",
      };

      await setUserProfileInFirestore(result.user.uid, userProfile);
      showMessageBox(
        `Welcome to Arcator.co.uk! Your account has been created with the name "${displayName}" and handle "@${handle}".`,
      );
    } else {
      showMessageBox("Welcome back!");
    }
  } catch (error) {
    console.error("Google sign-in error:", error);
    if (error.code === "auth/popup-closed-by-user") {
      showMessageBox("Sign-in cancelled by user.", true);
    } else {
      showMessageBox("Google sign-in failed. Please try again.", true);
    }
  } finally {
    hideLoading();
  }
}

/**
 * Handles GitHub sign-in
 */
async function handleGitHubSignIn() {
  try {
    showLoading();
    const provider = new GithubAuthProvider();
    const result = await signInWithPopup(auth, provider);

    // Check if this is a new user
    if (result._tokenResponse?.isNewUser) {
      // Generate random name and handle for new GitHub user
      const randomData = generateRandomNameAndHandle();
      const displayName = result.user.displayName || randomData.displayName;
      const handle = randomData.handle;
      const profilePicUrl =
        result.user.photoURL || generateColoredProfilePic(displayName);

      // Create user profile for new GitHub user
      const userProfile = {
        displayName: displayName,
        email: result.user.email || "",
        photoURL: profilePicUrl,
        handle: handle,
        themePreference: DEFAULT_THEME_NAME,
        createdAt: new Date(),
        lastLogin: new Date(),
        provider: "github",
      };

      await setUserProfileInFirestore(result.user.uid, userProfile);
      showMessageBox(
        `Welcome to Arcator.co.uk! Your account has been created with the name "${displayName}" and handle "@${handle}".`,
      );
    } else {
      showMessageBox("Welcome back!");
    }
  } catch (error) {
    console.error("GitHub sign-in error:", error);
    if (error.code === "auth/popup-closed-by-user") {
      showMessageBox("Sign-in cancelled by user.", true);
    } else {
      showMessageBox("GitHub sign-in failed. Please try again.", true);
    }
  } finally {
    hideLoading();
  }
}

// Helper to reload and apply user profile after save
async function reloadAndApplyUserProfile() {
  if (!auth.currentUser) return;
  const userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
  if (!userProfile) return;

  // --- Apply theme preference ---
  const allThemes = await getAvailableThemes();
  const themeId = userProfile.themePreference || DEFAULT_THEME_NAME;
  const themeToApply =
    allThemes.find((t) => t.id === themeId) ||
    allThemes.find((t) => t.id === DEFAULT_THEME_NAME);
  applyTheme(themeToApply.id, themeToApply); // Minimal: always apply user or default theme

  // Populate profile input fields
  if (displayNameInput) displayNameInput.value = userProfile.displayName || "";
  if (handleInput) handleInput.value = userProfile.handle || "";
  if (emailInput) emailInput.value = userProfile.email || "";
  if (profilePictureUrlInput)
    profilePictureUrlInput.value = userProfile.photoURL || "";

  // Update profile display elements
  if (displayNameText)
    displayNameText.textContent = userProfile.displayName || "N/A";
  if (handleText)
    handleText.textContent = userProfile.handle
      ? `@${userProfile.handle}`
      : "N/A";
  if (emailText) emailText.textContent = userProfile.email || "N/A";

  // Update profile picture display
  if (profilePictureDisplay) {
    const photoURL = userProfile.photoURL || DEFAULT_PROFILE_PIC;
    profilePictureDisplay.src = photoURL;
    profilePictureDisplay.alt =
      userProfile.displayName || "User Profile Picture";
  }

  // Use advancedSettings for UI controls and font scaling
  const advSettingsLocal = userProfile.advancedSettings || {};
  if (fontSizeSelect)
    fontSizeSelect.value = advSettingsLocal.fontSize || "16px";
  if (fontFamilySelect)
    fontFamilySelect.value = advSettingsLocal.fontFamily || "Inter, sans-serif";
  if (backgroundPatternSelect)
    backgroundPatternSelect.value =
      advSettingsLocal.backgroundPattern || "none";
  if (headingSizeMultiplierSelect)
    headingSizeMultiplierSelect.value =
      advSettingsLocal.headingSizeMultiplier || "1.6";
  if (lineHeightSelect)
    lineHeightSelect.value = advSettingsLocal.lineHeight || "1.6";
  if (letterSpacingSelect)
    letterSpacingSelect.value = advSettingsLocal.letterSpacing || "0px";
  if (backgroundOpacityRange)
    backgroundOpacityRange.value = advSettingsLocal.backgroundOpacity || "50";
  if (backgroundOpacityValue)
    backgroundOpacityValue.textContent =
      (advSettingsLocal.backgroundOpacity || "50") + "%";

  // Populate theme select
  const themeSelect = document.getElementById("theme-select");
  if (themeSelect) {
    // Clear existing options
    themeSelect.innerHTML = "";

    // Get available themes and populate
    const allThemes = await getAvailableThemes();
    allThemes.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name;
      if (theme.id === userProfile.themePreference) {
        option.selected = true;
      }
      themeSelect.appendChild(option);
    });
  }

  // Apply font scaling system
  applyFontScalingSystem(advSettingsLocal);

  // Load notification settings
  const notificationSettings = userProfile.notificationSettings || {};
  const notificationCheckboxes = [
    "email-notifications-checkbox",
    "inapp-notifications-checkbox",
    "announcement-notifications-checkbox",
    "community-notifications-checkbox",
    "security-notifications-checkbox",
    "maintenance-notifications-checkbox",
  ];

  notificationCheckboxes.forEach((checkboxId) => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace("-checkbox", "");
      checkbox.checked = notificationSettings[settingKey] || false;
    }
  });

  // Add notification frequency
  const notificationFrequencySelect = document.getElementById(
    "notification-frequency-select",
  );
  if (notificationFrequencySelect) {
    notificationFrequencySelect.value =
      notificationSettings.notificationFrequency || "immediate";
  }

  // Load privacy settings
  const privacySettings = userProfile.privacySettings || {};
  const privacyCheckboxes = [
    "profile-visibility-checkbox",
    "activity-visibility-checkbox",
    "analytics-consent-checkbox",
  ];

  privacyCheckboxes.forEach((checkboxId) => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace("-checkbox", "");
      // Set defaults to true for profile visibility and activity status
      if (
        settingKey === "profile-visibility" ||
        settingKey === "activity-visibility"
      ) {
        checkbox.checked =
          privacySettings[settingKey] !== undefined
            ? privacySettings[settingKey]
            : true;
      } else {
        checkbox.checked = privacySettings[settingKey] || false;
      }
    }
  });

  // Add data retention setting
  const dataRetentionSelect = document.getElementById("data-retention-select");
  if (dataRetentionSelect) {
    dataRetentionSelect.value = privacySettings.dataRetention || "90";
  }

  // Load accessibility settings
  const accessibilitySettings = userProfile.accessibilitySettings || {};
  const accessibilityCheckboxes = [
    "high-contrast-checkbox",
    "large-cursor-checkbox",
    "focus-indicators-checkbox",
    "colorblind-friendly-checkbox",
    "reduced-motion-checkbox",
    "disable-animations-checkbox",
    "keyboard-navigation-checkbox",
    "skip-links-checkbox",
    "text-to-speech-checkbox",
    "reading-guide-checkbox",
    "syntax-highlighting-checkbox",
    "word-spacing-checkbox",
  ];

  accessibilityCheckboxes.forEach((checkboxId) => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace("-checkbox", "");
      checkbox.checked = accessibilitySettings[settingKey] || false;
    }
  });

  // Apply accessibility settings to the page
  applyAccessibilitySettings(accessibilitySettings);

  // Load advanced settings
  const advancedSettings = userProfile.advancedSettings || {};
  const advancedCheckboxes = [
    "low-bandwidth-mode-checkbox",
    "disable-images-checkbox",
    "minimal-ui-checkbox",
    "debug-mode-checkbox",
    "show-performance-metrics-checkbox",
    "enable-experimental-features-checkbox",
  ];

  advancedCheckboxes.forEach((checkboxId) => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace("-checkbox", "");
      checkbox.checked = advancedSettings[settingKey] || false;
    }
  });

  // Add custom CSS
  const customCssTextarea = document.getElementById("custom-css-textarea");
  if (customCssTextarea && advancedSettings.customCSS) {
    customCssTextarea.value = advancedSettings.customCSS;
  }

  // Add keyboard shortcuts setting
  const keyboardShortcutsSelect = document.getElementById(
    "keyboard-shortcuts-toggle",
  );
  if (keyboardShortcutsSelect) {
    keyboardShortcutsSelect.value =
      advancedSettings.keyboardShortcuts || "enabled";
  }

  // Apply advanced settings to the page
  applyAdvancedSettings(advancedSettings);
  if (advancedSettings.customCSS) {
    applyCustomCSS(advancedSettings.customCSS);
  }

  // Apply background pattern with opacity
  const backgroundPattern = userProfile.backgroundPattern || "none";
  const backgroundOpacity = userProfile.backgroundOpacity || "50";
  const opacity = backgroundOpacity / 100;

  if (backgroundPattern === "none") {
    document.body.style.backgroundImage = "none";
  } else if (backgroundPattern === "dots") {
    document.body.style.backgroundImage = `linear-gradient(90deg, rgba(0,0,0,${opacity}) 1px, transparent 1px), linear-gradient(rgba(0,0,0,${opacity}) 1px, transparent 1px)`;
    document.body.style.backgroundSize = "20px 20px";
  } else if (backgroundPattern === "grid") {
    document.body.style.backgroundImage = `linear-gradient(to right, rgba(0, 0, 0, ${opacity}) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, ${opacity}) 1px, transparent 1px)`;
    document.body.style.backgroundSize = "40px 40px";
  } else if (backgroundPattern === "diagonal") {
    document.body.style.backgroundImage = `linear-gradient(45deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25%), linear-gradient(-45deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25%)`;
    document.body.style.backgroundSize = "60px 60px";
  } else if (backgroundPattern === "circles") {
    document.body.style.backgroundImage = `radial-gradient(circle, rgba(0, 0, 0, ${opacity}) 1px, transparent 1px)`;
    document.body.style.backgroundSize = "30px 30px";
  } else if (backgroundPattern === "hexagons") {
    document.body.style.backgroundImage = `linear-gradient(60deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25.5%, transparent 75%, rgba(0, 0, 0, ${opacity}) 75%), linear-gradient(120deg, rgba(0, 0, 0, ${opacity}) 25%, transparent 25.5%, transparent 75%, rgba(0, 0, 0, ${opacity}) 75%)`;
    document.body.style.backgroundSize = "40px 40px";
  }

  // Load and apply keyboard shortcuts
  if (advancedSettings.keyboardShortcutsConfig) {
    updateGlobalShortcuts({
      ...defaultShortcuts,
      ...advancedSettings.keyboardShortcutsConfig,
    });
  } else {
    updateGlobalShortcuts({ ...defaultShortcuts });
  }

  // Load disabled shortcuts
  if (advancedSettings.disabledShortcuts) {
    advancedSettings.disabledShortcuts.forEach((shortcutName) => {
      toggleShortcutDisabled(shortcutName, true);
    });
  }

  // Update UI to reflect current shortcuts and disabled state
  updateShortcutUI();
}

// Function to update shortcut UI elements
function updateShortcutUI() {
  const currentShortcuts = getCurrentShortcuts();

  Object.entries(currentShortcuts).forEach(([shortcutName, combo]) => {
    const input = document.getElementById(`shortcut-${shortcutName}`);
    const disableBtn = document.querySelector(
      `[data-shortcut="${shortcutName}"].shortcut-disable-btn`,
    );

    if (input) {
      input.value = combo;
      input.placeholder = combo;
    }

    if (disableBtn) {
      const isDisabled = disableBtn.classList.contains("disabled");
      if (isDisabled) {
        disableBtn.textContent = "Disabled";
        if (input) {
          input.disabled = true;
          input.style.opacity = "0.5";
        }
      } else {
        disableBtn.textContent = "Disable";
        if (input) {
          input.disabled = false;
          input.style.opacity = "1";
        }
      }
    }
  });
}

// Function to save shortcuts to Firebase
async function saveShortcutsToFirebase() {
  // Get current user from Firebase auth
  const currentUser = auth.currentUser;
  if (!currentUser) {
    showMessageBox("You must be logged in to save keyboard shortcuts.", true);
    return;
  }

  const currentShortcuts = getCurrentShortcuts();
  const disabledShortcutsList = Array.from(disabledShortcuts);

  const updates = {
    advancedSettings: {
      keyboardShortcutsConfig: currentShortcuts,
      disabledShortcuts: disabledShortcutsList,
    },
  };

  try {
    await setUserProfileInFirestore(currentUser.uid, updates);
    showMessageBox("Keyboard shortcuts saved successfully!", false);
  } catch (error) {
    console.error("Error saving shortcuts:", error);
    showMessageBox("Error saving keyboard shortcuts.", true);
  }
}

// Comprehensive font scaling system
function applyFontScalingSystem(userProfile) {
  // Handle both direct properties and nested advancedSettings
  const settings = userProfile.advancedSettings || userProfile;

  // Extract font size and remove "px" if present
  let fontSizeValue = settings.fontSize || "16px";
  if (typeof fontSizeValue === "string" && fontSizeValue.includes("px")) {
    fontSizeValue = fontSizeValue.replace("px", "");
  }
  const baseFontSize = parseInt(fontSizeValue) || 16;

  const headingMultiplier = parseFloat(settings.headingSizeMultiplier || "1.6");
  const fontFamily = settings.fontFamily || "Inter, sans-serif";
  const lineHeight = settings.lineHeight || "1.6";
  const letterSpacing = settings.letterSpacing || "0px";

  console.log(
    "DEBUG: Applying font scaling - fontSize:",
    fontSizeValue,
    "baseFontSize:",
    baseFontSize,
  );

  // Set base font properties on body
  document.body.style.fontSize = `${baseFontSize}px`;
  document.body.style.fontFamily = fontFamily;
  document.body.style.lineHeight = lineHeight;
  document.body.style.letterSpacing = letterSpacing;

  // Define font size multipliers for different elements
  const fontMultipliers = {
    // Headings
    h1: baseFontSize * headingMultiplier * 2.5,
    h2: baseFontSize * headingMultiplier * 2.0,
    h3: baseFontSize * headingMultiplier * 1.75,
    h4: baseFontSize * headingMultiplier * 1.5,
    h5: baseFontSize * headingMultiplier * 1.25,
    h6: baseFontSize * headingMultiplier * 1.1,

    // Navigation and UI elements
    ".navbar-link": baseFontSize * 0.875,
    ".navbar-logo": baseFontSize * 1.25,
    ".btn-primary": baseFontSize * 0.875,
    ".btn-secondary": baseFontSize * 0.875,
    ".card-title": baseFontSize * 1.125,
    ".card-subtitle": baseFontSize * 0.875,

    // Form elements
    "input, select, textarea": baseFontSize * 0.875,
    label: baseFontSize * 0.875,
    ".form-label": baseFontSize * 0.875,
    ".form-text": baseFontSize * 0.75,
    ".form-error": baseFontSize * 0.75,

    // Content elements
    p: baseFontSize * 1.0,
    span: baseFontSize * 1.0,
    div: baseFontSize * 1.0,
    a: baseFontSize * 1.0,
    li: baseFontSize * 1.0,
    "td, th": baseFontSize * 0.875,

    // Small text elements
    ".text-sm": baseFontSize * 0.75,
    ".text-xs": baseFontSize * 0.625,
    ".caption": baseFontSize * 0.75,
    ".meta": baseFontSize * 0.75,
    ".timestamp": baseFontSize * 0.75,

    // Large text elements
    ".text-lg": baseFontSize * 1.125,
    ".text-xl": baseFontSize * 1.25,
    ".text-2xl": baseFontSize * 1.5,
    ".text-3xl": baseFontSize * 1.875,
    ".text-4xl": baseFontSize * 2.25,

    // Special elements
    ".hero-title": baseFontSize * headingMultiplier * 3.0,
    ".hero-subtitle": baseFontSize * headingMultiplier * 1.5,
    ".section-title": baseFontSize * headingMultiplier * 1.75,
    ".subsection-title": baseFontSize * headingMultiplier * 1.25,
    ".modal-title": baseFontSize * headingMultiplier * 1.5,
    ".modal-content": baseFontSize * 0.875,

    // Code and technical elements
    code: baseFontSize * 0.875,
    pre: baseFontSize * 0.875,
    ".code-block": baseFontSize * 0.875,
    ".inline-code": baseFontSize * 0.875,

    // Alert and notification elements
    ".alert": baseFontSize * 0.875,
    ".notification": baseFontSize * 0.875,
    ".message-box": baseFontSize * 0.875,
    ".tooltip": baseFontSize * 0.75,

    // Footer and sidebar elements
    footer: baseFontSize * 0.875,
    ".footer-text": baseFontSize * 0.875,
    ".sidebar": baseFontSize * 0.875,
    ".sidebar-title": baseFontSize * 1.0,

    // Utility classes
    ".text-primary": baseFontSize * 1.0,
    ".text-secondary": baseFontSize * 0.875,
    ".text-muted": baseFontSize * 0.75,
    ".text-emphasis": baseFontSize * 1.125,
    ".text-deemphasized": baseFontSize * 0.875,
  };

  // Apply font sizes to all elements
  Object.entries(fontMultipliers).forEach(([selector, fontSize]) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      el.style.fontSize = `${fontSize}px`;
      el.style.fontFamily = fontFamily;
      el.style.lineHeight = lineHeight;
      el.style.letterSpacing = letterSpacing;
    });
  });

  // Apply to specific Tailwind classes that might be used
  const tailwindClasses = {
    ".text-sm": baseFontSize * 0.875,
    ".text-base": baseFontSize * 1.0,
    ".text-lg": baseFontSize * 1.125,
    ".text-xl": baseFontSize * 1.25,
    ".text-2xl": baseFontSize * 1.5,
    ".text-3xl": baseFontSize * 1.875,
    ".text-4xl": baseFontSize * 2.25,
    ".text-5xl": baseFontSize * 3.0,
    ".text-6xl": baseFontSize * 3.75,
    ".text-xs": baseFontSize * 0.75,
  };

  Object.entries(tailwindClasses).forEach(([className, fontSize]) => {
    const elements = document.querySelectorAll(className);
    elements.forEach((el) => {
      el.style.fontSize = `${fontSize}px`;
    });
  });

  // Set CSS custom properties for use in CSS
  document.documentElement.style.setProperty(
    "--base-font-size",
    `${baseFontSize}px`,
  );
  document.documentElement.style.setProperty(
    "--font-size-sm",
    `${baseFontSize * 0.875}px`,
  );
  document.documentElement.style.setProperty(
    "--font-size-base",
    `${baseFontSize}px`,
  );
  document.documentElement.style.setProperty(
    "--font-size-lg",
    `${baseFontSize * 1.125}px`,
  );
  document.documentElement.style.setProperty(
    "--font-size-xl",
    `${baseFontSize * 1.25}px`,
  );
  document.documentElement.style.setProperty(
    "--font-size-2xl",
    `${baseFontSize * 1.5}px`,
  );
  document.documentElement.style.setProperty(
    "--font-size-3xl",
    `${baseFontSize * 1.875}px`,
  );
  document.documentElement.style.setProperty(
    "--font-size-4xl",
    `${baseFontSize * 2.25}px`,
  );
  document.documentElement.style.setProperty(
    "--font-size-5xl",
    `${baseFontSize * 3.0}px`,
  );
  document.documentElement.style.setProperty(
    "--font-size-6xl",
    `${baseFontSize * 3.75}px`,
  );
  document.documentElement.style.setProperty(
    "--font-size-xs",
    `${baseFontSize * 0.75}px`,
  );

  // Set heading-specific custom properties
  document.documentElement.style.setProperty(
    "--heading-1-size",
    `${baseFontSize * headingMultiplier * 2.5}px`,
  );
  document.documentElement.style.setProperty(
    "--heading-2-size",
    `${baseFontSize * headingMultiplier * 2.0}px`,
  );
  document.documentElement.style.setProperty(
    "--heading-3-size",
    `${baseFontSize * headingMultiplier * 1.75}px`,
  );
  document.documentElement.style.setProperty(
    "--heading-4-size",
    `${baseFontSize * headingMultiplier * 1.5}px`,
  );
  document.documentElement.style.setProperty(
    "--heading-5-size",
    `${baseFontSize * headingMultiplier * 1.25}px`,
  );
  document.documentElement.style.setProperty(
    "--heading-6-size",
    `${baseFontSize * headingMultiplier * 1.1}px`,
  );

  // Set other typography properties
  document.documentElement.style.setProperty("--line-height", lineHeight);
  document.documentElement.style.setProperty("--letter-spacing", letterSpacing);
  document.documentElement.style.setProperty("--font-family", fontFamily);
}

// Handler for saving profile information
async function handleSaveProfile() {
  // Get current user from Firebase auth
  const currentUser = auth.currentUser;
  if (!currentUser) {
    showMessageBox("You must be logged in to save profile settings.", true);
    return;
  }

  const displayName = displayNameInput ? displayNameInput.value.trim() : "";
  const handle = handleInput ? handleInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim() : "";
  const photoURL = profilePictureUrlInput
    ? profilePictureUrlInput.value.trim()
    : "";

  if (!displayName) {
    showMessageBox("Display name is required.", true);
    return;
  }

  const updates = {
    displayName: displayName,
    handle: handle,
    email: email,
    photoURL: photoURL,
    lastUpdated: new Date().toISOString(),
  };

  try {
    showMessageBox("Updating profile...", false);
    const success = await setUserProfileInFirestore(currentUser.uid, updates);
    if (success) {
      showMessageBox("Profile updated successfully!");
      // Auto-hide success message after 2 seconds
      setTimeout(() => {
        const messageBox = document.getElementById("message-box");
        if (messageBox) messageBox.style.display = "none";
      }, 2000);

      // Update UI immediately
      if (displayNameText) displayNameText.textContent = displayName;
      if (handleText) handleText.textContent = handle ? `@${handle}` : "";
      if (emailText) emailText.textContent = email || "N/A";
      if (profilePictureDisplay) {
        profilePictureDisplay.src = photoURL || DEFAULT_PROFILE_PIC;
      }
    } else {
      showMessageBox("Failed to update profile. Please try again.", true);
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    showMessageBox("Error updating profile.", true);
  }
}

// Handler for saving preferences
async function handleSavePreferences() {
  // Get current user from Firebase auth
  const currentUser = auth.currentUser;
  if (!currentUser) {
    showMessageBox("You must be logged in to save preferences.", true);
    return;
  }

  const fontSize = fontSizeSelect ? fontSizeSelect.value : "16px";
  const fontFamily = fontFamilySelect
    ? fontFamilySelect.value
    : "Inter, sans-serif";
  const backgroundPattern = backgroundPatternSelect
    ? backgroundPatternSelect.value
    : "none";
  const headingSizeMultiplier = headingSizeMultiplierSelect
    ? headingSizeMultiplierSelect.value
    : "1.6";
  const lineHeight = lineHeightSelect ? lineHeightSelect.value : "1.6";
  const letterSpacing = letterSpacingSelect ? letterSpacingSelect.value : "0px";
  const backgroundOpacity = backgroundOpacityRange
    ? backgroundOpacityRange.value
    : "50";

  const advancedSettings = {
    fontSize: fontSize,
    fontFamily: fontFamily,
    backgroundPattern: backgroundPattern,
    headingSizeMultiplier: headingSizeMultiplier,
    lineHeight: lineHeight,
    letterSpacing: letterSpacing,
    backgroundOpacity: backgroundOpacity,
  };

  const updates = {
    advancedSettings: advancedSettings,
    lastUpdated: new Date().toISOString(),
  };

  try {
    showMessageBox("Saving preferences...", false);
    const success = await setUserProfileInFirestore(currentUser.uid, updates);
    if (success) {
      showMessageBox("Preferences saved successfully!", false);
      // Auto-hide success message after 2 seconds
      setTimeout(() => {
        const messageBox = document.getElementById("message-box");
        if (messageBox) messageBox.style.display = "none";
      }, 2000);
      // Apply settings immediately (use full profile)
      await reloadAndApplyUserProfile();
      // Update background opacity display immediately
      if (backgroundOpacityValue) {
        backgroundOpacityValue.textContent = backgroundOpacity + "%";
      }
    } else {
      showMessageBox("Failed to save preferences. Please try again.", true);
    }
  } catch (error) {
    console.error("Error saving preferences:", error);
    showMessageBox("Error saving preferences.", true);
  }
}

// Handler for saving notification settings
async function handleSaveNotifications() {
  // Get current user from Firebase auth
  const currentUser = auth.currentUser;
  if (!currentUser) {
    showMessageBox(
      "You must be logged in to save notification settings.",
      true,
    );
    return;
  }

  // Get all notification checkboxes
  const notificationCheckboxes = [
    "email-notifications-checkbox",
    "inapp-notifications-checkbox",
    "announcement-notifications-checkbox",
    "community-notifications-checkbox",
    "security-notifications-checkbox",
    "maintenance-notifications-checkbox",
  ];

  const notificationSettings = {};
  notificationCheckboxes.forEach((checkboxId) => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace("-checkbox", "");
      notificationSettings[settingKey] = checkbox.checked;
    }
  });

  // Add notification frequency setting
  const notificationFrequencySelect = document.getElementById(
    "notification-frequency-select",
  );
  if (notificationFrequencySelect) {
    notificationSettings.notificationFrequency =
      notificationFrequencySelect.value;
  }

  const updates = {
    notificationSettings: notificationSettings,
    lastUpdated: new Date().toISOString(),
  };

  try {
    showMessageBox("Saving notification settings...", false);
    const success = await setUserProfileInFirestore(currentUser.uid, updates);
    if (success) {
      showMessageBox("Notification settings saved successfully!", false);
      // Auto-hide success message after 2 seconds
      setTimeout(() => {
        const messageBox = document.getElementById("message-box");
        if (messageBox) messageBox.style.display = "none";
      }, 2000);
    } else {
      showMessageBox(
        "Failed to save notification settings. Please try again.",
        true,
      );
    }
  } catch (error) {
    console.error("Error saving notification settings:", error);
    showMessageBox("Error saving notification settings.", true);
  }
}

// Handler for saving privacy settings
async function handleSavePrivacy() {
  // Get current user from Firebase auth
  const currentUser = auth.currentUser;
  if (!currentUser) {
    showMessageBox("You must be logged in to save privacy settings.", true);
    return;
  }

  // Get all privacy checkboxes
  const privacyCheckboxes = [
    "profile-visibility-checkbox",
    "activity-visibility-checkbox",
    "analytics-consent-checkbox",
  ];

  const privacySettings = {};
  privacyCheckboxes.forEach((checkboxId) => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace("-checkbox", "");
      privacySettings[settingKey] = checkbox.checked;
    }
  });

  // Add data retention setting
  const dataRetentionSelect = document.getElementById("data-retention-select");
  if (dataRetentionSelect) {
    privacySettings.dataRetention = dataRetentionSelect.value;
  }

  const updates = {
    privacySettings: privacySettings,
    lastUpdated: new Date().toISOString(),
  };

  try {
    showMessageBox("Saving privacy settings...", false);
    const success = await setUserProfileInFirestore(currentUser.uid, updates);
    if (success) {
      showMessageBox("Privacy settings saved successfully!", false);
      // Auto-hide success message after 2 seconds
      setTimeout(() => {
        const messageBox = document.getElementById("message-box");
        if (messageBox) messageBox.style.display = "none";
      }, 2000);
    } else {
      showMessageBox(
        "Failed to save privacy settings. Please try again.",
        true,
      );
    }
  } catch (error) {
    console.error("Error saving privacy settings:", error);
    showMessageBox("Error saving privacy settings.", true);
  }
}

// Apply accessibility settings to the page
function applyAccessibilitySettings(settings) {
  const root = document.documentElement;

  // Skip Links - Working implementation
  if (settings.skipLinks) {
    // Create skip links if they don't exist
    if (!document.getElementById("skip-to-main")) {
      const skipLink = document.createElement("a");
      skipLink.id = "skip-to-main";
      skipLink.href = "#main-content";
      skipLink.textContent = "Skip to main content";
      skipLink.className = "skip-link";
      skipLink.style.cssText = `
        position: absolute;
        top: -40px;
        left: 6px;
        background: var(--color-bg-card);
        color: var(--color-text-primary);
        padding: 8px;
        text-decoration: none;
        z-index: 10000;
        border-radius: 4px;
        border: 2px solid var(--color-link);
        font-weight: bold;
      `;
      document.body.insertBefore(skipLink, document.body.firstChild);
    }
    document.getElementById("skip-to-main").style.display = "block";
  } else {
    const skipLink = document.getElementById("skip-to-main");
    if (skipLink) skipLink.style.display = "none";
  }

  // Reading Guide - Working implementation
  if (settings.readingGuide) {
    const style = document.createElement("style");
    style.id = "reading-guide-styles";
    style.textContent = `
      body::after {
        content: '';
        position: fixed;
        top: 0;
        left: 50%;
        width: 2px;
        height: 100vh;
        background: linear-gradient(to bottom, transparent, var(--color-link), transparent);
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
    const existingStyle = document.getElementById("reading-guide-styles");
    if (existingStyle) existingStyle.remove();
  }

  // Syntax Highlighting - Working implementation
  if (settings.syntaxHighlighting) {
    const style = document.createElement("style");
    style.id = "syntax-highlighting-styles";
    style.textContent = `
      code, pre {
        background: var(--color-bg-card) !important;
        color: var(--color-text-primary) !important;
        border: 1px solid var(--color-input-border) !important;
        border-radius: 4px !important;
        padding: 8px !important;
      }
      .keyword { color: var(--color-link) !important; }
      .string { color: var(--color-button-green-bg) !important; }
      .comment { color: var(--color-text-secondary) !important; }
      .function { color: var(--color-button-purple-bg) !important; }
      .number { color: var(--color-button-yellow-bg) !important; }
    `;
    document.head.appendChild(style);
  } else {
    const existingStyle = document.getElementById("syntax-highlighting-styles");
    if (existingStyle) existingStyle.remove();
  }

  // Colorblind Friendly Mode - Theme injection with proper color adjustments
  if (settings.colorblindFriendly) {
    const style = document.createElement("style");
    style.id = "colorblind-friendly-styles";
    style.textContent = `
      /* Colorblind friendly theme adjustments */
      .colorblind-friendly {
        /* Use high contrast colors that work for most colorblind users */
        --color-link: #0066CC !important; /* Blue - distinguishable for most */
        --color-button-blue-bg: #0066CC !important;
        --color-button-blue-hover: #004499 !important;
        --color-button-green-bg: #009900 !important; /* Green - distinguishable */
        --color-button-green-hover: #006600 !important;
        --color-button-red-bg: #CC0000 !important; /* Red - distinguishable */
        --color-button-red-hover: #990000 !important;
        --color-button-yellow-bg: #CC6600 !important; /* Orange instead of yellow */
        --color-button-yellow-hover: #993300 !important;
        --color-button-purple-bg: #660099 !important; /* Purple - distinguishable */
        --color-button-purple-hover: #330066 !important;
        --color-button-orange-bg: #CC3300 !important; /* Dark orange */
        --color-button-orange-hover: #992600 !important;
        --color-button-indigo-bg: #0033CC !important; /* Dark blue */
        --color-button-indigo-hover: #002299 !important;
      }

      /* Add borders to buttons for better distinction */
      .colorblind-friendly button {
        border: 2px solid var(--color-text-primary) !important;
      }

      /* Add underlines to links for better distinction */
      .colorblind-friendly a {
        text-decoration: underline !important;
      }

      /* Enhanced contrast for form elements */
      .colorblind-friendly input, .colorblind-friendly select, .colorblind-friendly textarea {
        border: 2px solid var(--color-text-primary) !important;
      }

      /* Enhanced table borders */
      .colorblind-friendly table th, .colorblind-friendly table td {
        border: 2px solid var(--color-text-primary) !important;
      }

      /* Enhanced focus indicators for colorblind users */
      .colorblind-friendly *:focus {
        outline: 4px solid #000000 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px #FFFFFF !important;
      }
    `;
    document.head.appendChild(style);
    root.classList.add("colorblind-friendly");
  } else {
    const existingStyle = document.getElementById("colorblind-friendly-styles");
    if (existingStyle) existingStyle.remove();
    root.classList.remove("colorblind-friendly");
  }

  // Text-to-Speech - Working implementation using Web Speech API
  if (settings.textToSpeech) {
    if ("speechSynthesis" in window) {
      // Add speak button to all text elements
      const textElements = document.querySelectorAll(
        "p, h1, h2, h3, h4, h5, h6, span, div",
      );
      textElements.forEach((element) => {
        if (!element.hasAttribute("data-speech-added")) {
          element.style.cursor = "pointer";
          element.setAttribute("data-speech-added", "true");
          element.addEventListener("click", () => {
            const utterance = new SpeechSynthesisUtterance(element.textContent);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            speechSynthesis.speak(utterance);
          });
          element.title = "Click to speak this text";
        }
      });
    }
  } else {
    // Remove speech functionality
    const textElements = document.querySelectorAll("[data-speech-added]");
    textElements.forEach((element) => {
      element.style.cursor = "";
      element.removeAttribute("data-speech-added");
      element.removeAttribute("title");
    });
  }
}

// Handler for saving accessibility settings
async function handleSaveAccessibility() {
  // Get current user from Firebase auth
  const currentUser = auth.currentUser;
  if (!currentUser) {
    showMessageBox(
      "You must be logged in to save accessibility settings.",
      true,
    );
    return;
  }

  // Get all accessibility checkboxes
  const accessibilityCheckboxes = [
    "high-contrast-checkbox",
    "large-cursor-checkbox",
    "focus-indicators-checkbox",
    "colorblind-friendly-checkbox",
    "reduced-motion-checkbox",
    "disable-animations-checkbox",
    "keyboard-navigation-checkbox",
    "skip-links-checkbox",
    "text-to-speech-checkbox",
    "reading-guide-checkbox",
    "syntax-highlighting-checkbox",
    "word-spacing-checkbox",
  ];

  const accessibilitySettings = {};
  accessibilityCheckboxes.forEach((checkboxId) => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace("-checkbox", "");
      accessibilitySettings[settingKey] = checkbox.checked;
    }
  });

  const updates = {
    accessibilitySettings: accessibilitySettings,
    lastUpdated: new Date().toISOString(),
  };

  try {
    showMessageBox("Saving accessibility settings...", false);
    const success = await setUserProfileInFirestore(currentUser.uid, updates);
    if (success) {
      showMessageBox("Accessibility settings saved successfully!", false);
      // Auto-hide success message after 2 seconds
      setTimeout(() => {
        const messageBox = document.getElementById("message-box");
        if (messageBox) messageBox.style.display = "none";
      }, 2000);

      // Apply settings immediately
      applyAccessibilitySettings(accessibilitySettings);
    } else {
      showMessageBox(
        "Failed to save accessibility settings. Please try again.",
        true,
      );
    }
  } catch (error) {
    console.error("Error saving accessibility settings:", error);
    showMessageBox("Error saving accessibility settings.", true);
  }
}

// Handler for saving advanced settings
async function handleSaveAdvanced() {
  // Get current user from Firebase auth
  const currentUser = auth.currentUser;
  if (!currentUser) {
    showMessageBox("You must be logged in to save advanced settings.", true);
    return;
  }

  // Get all advanced checkboxes
  const advancedCheckboxes = [
    "low-bandwidth-mode-checkbox",
    "disable-images-checkbox",
    "minimal-ui-checkbox",
    "debug-mode-checkbox",
    "show-performance-metrics-checkbox",
    "enable-experimental-features-checkbox",
  ];

  const advancedSettings = {};
  advancedCheckboxes.forEach((checkboxId) => {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      const settingKey = checkboxId.replace("-checkbox", "");
      advancedSettings[settingKey] = checkbox.checked;
    }
  });

  // Add custom CSS
  const customCssTextarea = document.getElementById("custom-css-textarea");
  if (customCssTextarea) {
    advancedSettings.customCSS = customCssTextarea.value.trim();
  }

  // Add keyboard shortcuts setting
  const keyboardShortcutsSelect = document.getElementById(
    "keyboard-shortcuts-toggle",
  );
  if (keyboardShortcutsSelect) {
    advancedSettings.keyboardShortcuts = keyboardShortcutsSelect.value;
  }

  // Save keyboard shortcuts configuration
  const currentShortcuts = getCurrentShortcuts();
  advancedSettings.keyboardShortcutsConfig = currentShortcuts;

  // Get disabled shortcuts
  const disabledShortcuts = [];
  document.querySelectorAll(".shortcut-disable-btn.disabled").forEach((btn) => {
    const shortcutName = btn.getAttribute("data-shortcut");
    if (shortcutName) {
      disabledShortcuts.push(shortcutName);
    }
  });
  advancedSettings.disabledShortcuts = disabledShortcuts;

  const updates = {
    advancedSettings: advancedSettings,
    lastUpdated: new Date().toISOString(),
  };

  // Apply advanced settings immediately
  applyAdvancedSettings(advancedSettings);
  if (advancedSettings.customCSS) {
    applyCustomCSS(advancedSettings.customCSS);
  }

  try {
    showMessageBox("Saving advanced settings...", false);
    const success = await setUserProfileInFirestore(currentUser.uid, updates);
    if (success) {
      showMessageBox("Advanced settings saved successfully!", false);
      // Auto-hide success message after 2 seconds
      setTimeout(() => {
        const messageBox = document.getElementById("message-box");
        if (messageBox) messageBox.style.display = "none";
      }, 2000);
    } else {
      showMessageBox(
        "Failed to save advanced settings. Please try again.",
        true,
      );
    }
  } catch (error) {
    console.error("Error saving advanced settings:", error);
    showMessageBox("Error saving advanced settings.", true);
  }
}

// Apply custom CSS
function applyCustomCSS(css) {
  let customStyleElement = document.getElementById("custom-user-css");
  if (!customStyleElement) {
    customStyleElement = document.createElement("style");
    customStyleElement.id = "custom-user-css";
    document.head.appendChild(customStyleElement);
  }
  customStyleElement.textContent = css;
}

// Apply advanced settings
function applyAdvancedSettings(settings) {
  if (settings.debugMode) {
    document.body.classList.add("debug-mode");
  } else {
    document.body.classList.remove("debug-mode");
  }

  if (settings.minimalUi) {
    document.body.classList.add("minimal-ui");
  } else {
    document.body.classList.remove("minimal-ui");
  }

  if (settings.lowBandwidthMode) {
    document.body.classList.add("low-bandwidth-mode");
  } else {
    document.body.classList.remove("low-bandwidth-mode");
  }

  if (settings.showPerformanceMetrics) {
    // Add performance metrics display
    const metricsDiv = document.createElement("div");
    metricsDiv.className = "performance-metrics";
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
    const existingMetrics = document.querySelector(".performance-metrics");
    if (existingMetrics) {
      existingMetrics.remove();
    }
  }

  if (settings.disableImages) {
    document.body.classList.add("low-bandwidth-mode");
  } else {
    document.body.classList.remove("low-bandwidth-mode");
  }
}

// Handler for exporting user data
async function handleExportData() {
  // Get current user from Firebase auth
  const currentUser = auth.currentUser;
  if (!currentUser) {
    showMessageBox("You must be logged in to export data.", true);
    return;
  }

  try {
    const userProfile = await getUserProfileFromFirestore(currentUser.uid);
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
          backgroundOpacity: userProfile.backgroundOpacity,
        },
        notifications: userProfile.notificationSettings,
        privacy: userProfile.privacySettings,
        accessibility: userProfile.accessibilitySettings,
        advanced: userProfile.advancedSettings,
      },
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `arcator-user-data-${currentUser.uid}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showMessageBox("Data exported successfully!", false);
  } catch (error) {
    console.error("Error exporting data:", error);
    showMessageBox(`Failed to export data: ${error.message}`, true);
  }
}

// Handler for importing user data
async function handleImportData() {
  // Get current user from Firebase auth
  const currentUser = auth.currentUser;
  if (!currentUser) {
    showMessageBox("You must be logged in to import data.", true);
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (importData.userProfile && importData.settings) {
        // Import settings
        await setDoc(
          doc(
            db,
            `artifacts/${appId}/public/data/user_profiles`,
            currentUser.uid,
          ),
          {
            ...importData.userProfile,
            ...importData.settings,
          },
          { merge: true },
        );

        showMessageBox(
          "Data imported successfully! Please refresh the page to see changes.",
          false,
        );
      } else {
        showMessageBox(
          "Invalid data format. Please use a valid export file.",
          true,
        );
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
    "Reset Advanced Settings",
    "This will reset all advanced settings to their default values. This action cannot be undone.",
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
    customCssTextarea.value = "";

    // Reset select
    keyboardShortcutsToggle.value = "disabled";

    // Remove custom CSS
    const customStyleElement = document.getElementById("custom-user-css");
    if (customStyleElement) {
      customStyleElement.remove();
    }

    // Remove applied classes
    document.body.classList.remove(
      "debug-mode",
      "minimal-ui",
      "low-bandwidth-mode",
    );

    // Save reset settings
    await handleSaveAdvanced();

    showMessageBox("Advanced settings reset to defaults!", false);
  } catch (error) {
    console.error("Error resetting advanced settings:", error);
    showMessageBox(`Failed to reset settings: ${error.message}`, true);
  }
}

// Main execution logic when the window loads
window.onload = async function () {
  showLoading(); // Show spinner initially

  try {
    // Wait for Firebase to be fully initialized and available
    await firebaseReadyPromise;

    // Initialize themes module (connects it to Firebase instances)
    setupThemesFirebase();

    // Apply default theme
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find((t) => t.id === DEFAULT_THEME_NAME);
    applyTheme(themeToApply.id, themeToApply);

    // Setup event listeners
    setupEventListeners();

    // Show settings section by default
    showSection(settingsContent);

    hideLoading(); // Hide spinner
  } catch (error) {
    console.error("Error in user-main.js initialization:", error);
    hideLoading();
  }
};

// Initialize the page when DOM is loaded
document.addEventListener("DOMContentLoaded", async function () {
  try {
    // Wait for Firebase to be ready
    await firebaseReadyPromise;

    // Setup themes
    setupThemesFirebase(db, auth, appId);

    // Global shortcuts are now handled by app.js

    // Setup event listeners
    setupEventListeners();

    // Check authentication state
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        // User is signed in
        const userProfile = await getUserProfileFromFirestore(user.uid);

        // Load and apply user profile
        await reloadAndApplyUserProfile();

        // Show settings content
        showSection(settingsContent);

        // Load navbar
        await loadNavbar(
          user,
          userProfile,
          DEFAULT_PROFILE_PIC,
          DEFAULT_THEME_NAME,
        );
      } else {
        // User is signed out
        showSection(signInSection);

        // Load navbar without user
        await loadNavbar(null, null, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
      }
    });
  } catch (error) {
    console.error("Error during user-main.js initialization:", error);
    showMessageBox(
      "Failed to initialize page. Please refresh and try again.",
      true,
    );
  }
});

// Setup all event listeners
function setupEventListeners() {
  // Sign in form - handle both button click and form submit
  if (signInButton) {
    signInButton.addEventListener("click", handleSignIn);
  }

  // Add form submit event listener for sign-in form
  const signInForm = document.getElementById("signin-form");
  if (signInForm) {
    signInForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSignIn();
    });
  }

  // Sign up form - handle both button click and form submit
  if (signUpButton) {
    signUpButton.addEventListener("click", handleSignUp);
  }

  // Add form submit event listener for sign-up form
  const signUpForm = document.getElementById("signup-form");
  if (signUpForm) {
    signUpForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSignUp();
    });
  }

  // Forgot password form - handle both button click and form submit
  if (resetPasswordButton) {
    resetPasswordButton.addEventListener("click", handlePasswordReset);
  }

  // Add form submit event listener for forgot password form
  const forgotPasswordForm = document.getElementById("forgot-password-form");
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handlePasswordReset();
    });
  }

  // Navigation links - only add if sections exist
  if (goToSignUpLink && signUpSection) {
    goToSignUpLink.addEventListener("click", (e) => {
      e.preventDefault();
      showSection(signUpSection);
    });
  }

  if (goToSignInLink && signInSection) {
    goToSignInLink.addEventListener("click", (e) => {
      e.preventDefault();
      showSection(signInSection);
    });
  }

  if (goToForgotPasswordLink && forgotPasswordSection) {
    goToForgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      showSection(forgotPasswordSection);
    });
  }

  if (goToSignInFromForgotLink && signInSection) {
    goToSignInFromForgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      showSection(signInSection);
    });
  }

  // Profile settings
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", handleSaveProfile);
  }

  if (savePreferencesBtn) {
    savePreferencesBtn.addEventListener("click", handleSavePreferences);
  }

  if (saveNotificationsBtn) {
    saveNotificationsBtn.addEventListener("click", handleSaveNotifications);
  }

  if (savePrivacyBtn) {
    savePrivacyBtn.addEventListener("click", handleSavePrivacy);
  }

  if (saveAccessibilityBtn) {
    saveAccessibilityBtn.addEventListener("click", handleSaveAccessibility);
  }

  if (saveAdvancedBtn) {
    saveAdvancedBtn.addEventListener("click", handleSaveAdvanced);
  }

  if (resetAdvancedBtn) {
    resetAdvancedBtn.addEventListener("click", handleResetAdvanced);
  }

  // Data management
  if (exportDataBtn) {
    exportDataBtn.addEventListener("click", handleExportData);
  }

  if (importDataBtn) {
    importDataBtn.addEventListener("click", handleImportData);
  }

  // Social authentication
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener("click", handleGoogleSignIn);
  }

  if (githubSignInBtn) {
    githubSignInBtn.addEventListener("click", handleGitHubSignIn);
  }

  // Social authentication for sign-up
  if (googleSignUpBtn) {
    googleSignUpBtn.addEventListener("click", handleGoogleSignIn); // Same handler for both sign-in and sign-up
  }

  if (githubSignUpBtn) {
    githubSignUpBtn.addEventListener("click", handleGitHubSignIn); // Same handler for both sign-in and sign-up
  }

  // Background opacity range slider
  if (backgroundOpacityRange) {
    backgroundOpacityRange.addEventListener("input", async (e) => {
      if (backgroundOpacityValue) {
        backgroundOpacityValue.textContent = e.target.value + "%";
      }

      // Apply immediately
      if (auth.currentUser) {
        const userProfile = await getUserProfileFromFirestore(
          auth.currentUser.uid,
        );
        if (userProfile) {
          const advSettings = userProfile.advancedSettings || {};
          advSettings.backgroundOpacity = e.target.value;
          applyFontScalingSystem({
            ...userProfile,
            advancedSettings: advSettings,
          });

          // Save to Firebase in background
          try {
            await setUserProfileInFirestore(auth.currentUser.uid, {
              ...userProfile,
              advancedSettings: advSettings,
            });
          } catch (error) {
            console.error("Error saving background opacity:", error);
          }
        }
      }
    });
  }

  // Typography settings - update immediately when changed
  const typographySelects = [
    "font-size-select",
    "font-family-select",
    "line-height-select",
    "letter-spacing-select",
    "heading-size-multiplier",
    "background-pattern-select",
    "theme-select",
  ];

  typographySelects.forEach((selectId) => {
    const select = document.getElementById(selectId);
    if (select) {
      select.addEventListener("change", async () => {
        // Get current user profile
        if (!auth.currentUser) return;
        const userProfile = await getUserProfileFromFirestore(
          auth.currentUser.uid,
        );
        if (!userProfile) return;

        // Update the specific setting that changed
        const advSettings = userProfile.advancedSettings || {};

        switch (selectId) {
          case "font-size-select":
            advSettings.fontSize = select.value;
            break;
          case "font-family-select":
            advSettings.fontFamily = select.value;
            break;
          case "line-height-select":
            advSettings.lineHeight = select.value;
            break;
          case "letter-spacing-select":
            advSettings.letterSpacing = select.value;
            break;
          case "heading-size-multiplier":
            advSettings.headingSizeMultiplier = select.value;
            break;
          case "background-pattern-select":
            advSettings.backgroundPattern = select.value;
            break;
          case "theme-select":
            userProfile.themePreference = select.value;
            break;
        }

        // Apply the updated settings immediately
        if (selectId === "theme-select") {
          // Apply theme immediately
          const allThemes = await getAvailableThemes();
          const selectedTheme = allThemes.find((t) => t.id === select.value);
          if (selectedTheme) {
            applyTheme(selectedTheme.id, selectedTheme);
            // Cache the theme preference for future page loads
            cacheUserTheme(selectedTheme.id, auth.currentUser.uid);
          }
        } else {
          // Apply typography settings immediately
          applyFontScalingSystem({
            ...userProfile,
            advancedSettings: advSettings,
          });
        }

        // Save to Firebase in background
        try {
          if (selectId === "theme-select") {
            await setUserProfileInFirestore(auth.currentUser.uid, userProfile);
          } else {
            await setUserProfileInFirestore(auth.currentUser.uid, {
              ...userProfile,
              advancedSettings: advSettings,
            });
          }
        } catch (error) {
          console.error("Error saving typography setting:", error);
        }
      });
    }
  });

  // Keyboard shortcuts recording
  const shortcutInputs = document.querySelectorAll('[id^="shortcut-"]');
  shortcutInputs.forEach((input) => {
    let isRecording = false;
    let currentRecordingShortcut = null;

    input.addEventListener("click", function () {
      if (isRecording) return;

      isRecording = true;
      currentRecordingShortcut = this.dataset.shortcut;
      this.value = "Press keys...";
      this.style.backgroundColor = "var(--color-button-yellow-bg)";
      this.style.color = "var(--color-button-text)";
    });

    input.addEventListener("keydown", function (e) {
      if (!isRecording) return;

      e.preventDefault();
      const keys = [];
      if (e.altKey) keys.push("Alt");
      if (e.ctrlKey) keys.push("Ctrl");
      if (e.shiftKey) keys.push("Shift");
      if (e.metaKey) keys.push("Meta");
      if (e.key && !["Alt", "Ctrl", "Shift", "Meta"].includes(e.key)) {
        keys.push(e.key.toUpperCase());
      }

      const combo = keys.join("+");
      if (combo) {
        this.value = combo;
        this.style.backgroundColor = "";
        this.style.color = "";
        isRecording = false;

        // Update the shortcut in memory
        const currentShortcuts = getCurrentShortcuts();
        currentShortcuts[currentRecordingShortcut] = combo;
        updateGlobalShortcuts(currentShortcuts);
      }
    });

    input.addEventListener("blur", function () {
      if (isRecording) {
        isRecording = false;
        this.style.backgroundColor = "";
        this.style.color = "";
        // Restore previous value
        const currentShortcuts = getCurrentShortcuts();
        this.value = currentShortcuts[currentRecordingShortcut] || "";
      }
    });
  });

  // Shortcut disable buttons
  const disableButtons = document.querySelectorAll(".shortcut-disable-btn");
  disableButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const shortcutName = this.dataset.shortcut;
      const isDisabled = this.classList.contains("disabled");

      if (isDisabled) {
        this.classList.remove("disabled");
        this.textContent = "Disable";
        toggleShortcutDisabled(shortcutName, false);
        const input = document.getElementById(`shortcut-${shortcutName}`);
        if (input) input.disabled = false;
      } else {
        this.classList.add("disabled");
        this.textContent = "Disabled";
        toggleShortcutDisabled(shortcutName, true);
        const input = document.getElementById(`shortcut-${shortcutName}`);
        if (input) input.disabled = true;
      }
    });
  });
}

// Helper function to get pressed keys (imported from app.js logic)
function getPressedKeys(event) {
  const keys = [];
  if (event.altKey) keys.push("Alt");
  if (event.ctrlKey) keys.push("Ctrl");
  if (event.shiftKey) keys.push("Shift");
  if (event.metaKey) keys.push("Meta");
  if (event.key && !["Alt", "Ctrl", "Shift", "Meta"].includes(event.key)) {
    const keyMap = {
      " ": "Space",
      Enter: "Enter",
      Escape: "Escape",
      Tab: "Tab",
      Backspace: "Backspace",
      Delete: "Delete",
      ArrowUp: "Up",
      ArrowDown: "Down",
      ArrowLeft: "Left",
      ArrowRight: "Right",
      Home: "Home",
      End: "End",
      PageUp: "PageUp",
      PageDown: "PageDown",
      Insert: "Insert",
      F1: "F1",
      F2: "F2",
      F3: "F3",
      F4: "F4",
      F5: "F5",
      F6: "F6",
      F7: "F7",
      F8: "F8",
      F9: "F9",
      F10: "F10",
      F11: "F11",
      F12: "F12",
    };
    keys.push(keyMap[event.key] || event.key.toUpperCase());
  }
  return keys.join("+");
}
