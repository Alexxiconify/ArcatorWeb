// user-main.js - Main script for the User Account page
// Handles authentication UI, user settings, and interactions.
import {uiManager} from "./ui-manager.js";
import {authManager} from "./auth-manager.js";
import {SettingsManager} from "./settings-manager.js";
import {themeManager} from "./theme-manager.js";
import {sanitizeHandle} from "./utils.js";
import {firebaseReadyPromise} from "./firebase-init.js";

// Initialize managers
async function initializeManagers() {
    try {
        await Promise.all([
            authManager.init(),
            SettingsManager.loadSettings(authManager.getCurrentUser()?.uid),
            themeManager.init()
        ]);
    } catch (error) {
        handleError(error, 'Manager Initialization');
    }
}

// Initialize UI elements
function initializeUI() {
    const sections = {
        signIn: {
            id: 'signin-section',
            title: 'Welcome Back!',
            subtitle: 'Sign in to your account.'
        },
        signUp: {
            id: 'signup-section',
            title: 'Join Arcator.co.uk!',
            subtitle: 'Create your new account.'
        },
        forgotPassword: {
            id: 'forgot-password-section',
            title: 'Forgot Your Password?',
            subtitle: 'Reset it here.'
        },
        settings: {
            id: 'settings-content',
            title: 'User Settings',
            subtitle: 'Personalize your Arcator.co.uk experience.'
        },
        loginRequired: {
            id: 'login-required-message',
            title: 'Access Restricted',
            subtitle: 'Please sign in to continue.'
        }
    };

    // Register sections with UI manager
    Object.entries(sections).forEach(([key, section]) => {
        const element = document.getElementById(section.id);
        if (element) {
            uiManager.registerSection(section.id, element, section.title, section.subtitle);
        }
    });

    // Set loading element
    const loadingSpinner = document.getElementById('loading-spinner');
    if (loadingSpinner) {
        uiManager.setLoadingElement(loadingSpinner);
    }
}

// Event handlers
async function handleLogin(event) {
    event?.preventDefault();

    const email = document.getElementById('signin-email')?.value?.trim();
    const password = document.getElementById('signin-password')?.value;

    if (!email || !password) {
        showMessageBox('Please enter both email and password.', true);
        return;
    }

    uiManager.showLoading();
    try {
        await authManager.signInWithEmailAndPassword(email, password);
        showMessageBox('Successfully signed in!');
    } catch (error) {
        handleError(error, 'Sign In');
    } finally {
        uiManager.hideLoading();
    }
}

async function handleSignup(event) {
    event?.preventDefault();

    const email = document.getElementById('signup-email')?.value?.trim();
    const password = document.getElementById('signup-password')?.value;
    const confirmPassword = document.getElementById('signup-confirm-password')?.value;
    const displayName = document.getElementById('signup-display-name')?.value?.trim();
    const handle = sanitizeHandle(document.getElementById('signup-handle')?.value?.trim());

    if (!email || !password || !confirmPassword) {
        showMessageBox('Please fill in all required fields.', true);
        return;
    }

    if (password !== confirmPassword) {
        showMessageBox('Passwords do not match.', true);
        return;
    }

    uiManager.showLoading();
    try {
        await authManager.createAccount(email, password, displayName, handle);
        showMessageBox('Account created successfully! Please sign in.');
        uiManager.showSection('signin-section');
    } catch (error) {
        handleError(error, 'Sign Up');
    } finally {
        uiManager.hideLoading();
    }
}

async function handlePasswordReset(event) {
    event?.preventDefault();

    const email = document.getElementById('forgot-password-email')?.value?.trim();
    if (!email) {
        showMessageBox('Please enter your email address.', true);
        return;
    }

    uiManager.showLoading();
    try {
        await authManager.resetPassword(email);
        showMessageBox('Password reset email sent! Check your inbox.');
        uiManager.showSection('signin-section');
    } catch (error) {
        handleError(error, 'Password Reset');
    } finally {
        uiManager.hideLoading();
    }
}

// Event listeners setup
function setupEventListeners() {
    // Auth form listeners
    document.getElementById('signin-btn')?.addEventListener('click', handleLogin);
    document.getElementById('signup-btn')?.addEventListener('click', handleSignup);
    document.getElementById('reset-password-btn')?.addEventListener('click', handlePasswordReset);

    // Navigation listeners
    document.getElementById('go-to-signup-link')?.addEventListener('click', () => uiManager.showSection('signup-section'));
    document.getElementById('go-to-forgot-password-link')?.addEventListener('click', () => uiManager.showSection('forgot-password-section'));
    document.getElementById('go-to-signin-link')?.addEventListener('click', () => uiManager.showSection('signin-section'));
    document.getElementById('go-to-signin-from-forgot-link')?.addEventListener('click', () => uiManager.showSection('signin-section'));

    // Settings form listeners
    document.getElementById('save-preferences-btn')?.addEventListener('click', () => SettingsManager.savePreferences());
    document.getElementById('save-notifications-btn')?.addEventListener('click', () => SettingsManager.saveNotifications());
    document.getElementById('save-privacy-btn')?.addEventListener('click', () => SettingsManager.savePrivacy());
    document.getElementById('save-accessibility-btn')?.addEventListener('click', () => SettingsManager.saveAccessibility());
    document.getElementById('save-advanced-btn')?.addEventListener('click', () => SettingsManager.saveAdvanced());
}

// Auth state observer
function setupAuthStateObserver() {
    authManager.onAuthStateChanged(async (user) => {
        uiManager.hideLoading();

        if (user) {
            try {
                const userProfile = await SettingsManager.loadUserProfile(user.uid);
                if (userProfile) {
                    await SettingsManager.applyUserSettings(userProfile);
                }
                uiManager.showSection('settings-content');
            } catch (error) {
                handleError(error, 'Profile Load');
            }
        } else {
            uiManager.showSection('signin-section');
        }
    });
}

// Initialize the page
async function initializePage() {
    uiManager.showLoading();

    try {
        await firebaseReadyPromise;
        await initializeManagers();
        initializeUI();
        setupEventListeners();
        setupAuthStateObserver();
    } catch (error) {
        handleError(error, 'Page Initialization');
    } finally {
        uiManager.hideLoading();
    }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage().catch(error => handleError(error, 'Page Load'));
}