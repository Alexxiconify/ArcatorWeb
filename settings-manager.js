// settings-manager.js - Handles user settings and preferences
import {appId, auth, db, doc, getDoc, getUserProfileFromFirestore, setDoc, updateDoc} from "./firebase-init.js";
import {storageManager} from "./storage-manager.js";
import {authManager} from "./auth-manager.js";
import {themeManager} from "./theme-manager.js";
import {showMessageBox} from './utils.js';

// Default user settings configuration
const DEFAULT_USER_SETTINGS = {
    preferences: {
        fontSize: '16px',
        fontFamily: 'Inter, sans-serif',
        backgroundPattern: 'none',
        headingSizeMultiplier: '1.6',
        lineHeight: '1.6',
        letterSpacing: '0px',
        backgroundOpacity: '50'
    },
    accessibility: {
        highContrast: false,
        largeCursor: false,
        focusIndicators: true,
        colorblindFriendly: false,
        reducedMotion: false,
        disableAnimations: false,
        keyboardNavigation: true,
        skipLinks: true,
        textToSpeech: false,
        readingGuide: false,
        syntaxHighlighting: true,
        wordSpacing: '0'
    },
    notifications: {
        emailNotifications: true,
        inAppNotifications: true,
        announcementNotifications: true,
        communityNotifications: true,
        securityNotifications: true,
        maintenanceNotifications: true,
        frequency: 'immediate'
    },
    privacy: {
        profileVisibility: true,
        activityVisibility: true,
        analyticsConsent: false,
        dataRetention: '90'
    },
    advanced: {
        lowBandwidthMode: false,
        disableImages: false,
        minimalUi: false,
        debugMode: false,
        showPerformanceMetrics: false,
        enableExperimentalFeatures: false,
        customCSS: '',
        keyboardShortcuts: 'enabled',
        disabledShortcuts: []
    }
};

export class SettingsManager {
    // New: Helper to safely retrieve used heap size
    usedJSHeapSize;
    // New: Helper to safely retrieve total heap size
    totalJSHeapSize;

    constructor() {
        this.currentSettings = null;
        this.isInitialized = false;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.lastFPS = 0;
        this.performanceMetricsInterval = null;
    }

    async init() {
        if (this.isInitialized) return;

        const user = auth.currentUser;
        if (user) {
            await this.loadSettings(user.uid);
        }

        this.isInitialized = true;
        this.setupEventListeners();
    }

    async loadUserProfile(uid) {
        if (!uid) return null;

        try {
            const docRef = doc(db, 'artifacts', appId, 'public/data/user_profiles', uid);
            const snapshot = await getDoc(docRef);
            return snapshot.exists() ? snapshot.data() : null;
        } catch (error) {
            this.handleError(error, 'Load User Profile');
            return null;
        }
    }

    async loadSettings(uid) {
        if (!uid) return null;

        try {
            // Load user profile
            const userProfile = await getUserProfileFromFirestore(uid);
            if (!userProfile) return null;

            // Load additional settings
            const settingsRef = doc(db, 'user_settings', uid);
            const settingsDoc = await getDoc(settingsRef);

            this.currentSettings = {
                ...userProfile,
                ...(settingsDoc.exists() ? settingsDoc.data() : {})
            };

            // Merge with local storage
            const localSettings = storageManager.get(`user_settings_${uid}`);
            this.currentSettings = {
                // FIX: Use the explicitly defined local constant DEFAULT_USER_SETTINGS
                ...DEFAULT_USER_SETTINGS,
                ...userProfile,
                ...localSettings
            };

            // Apply settings to form
            this.applySettingsToForm(this.currentSettings);
            return this.currentSettings;
        } catch (error) {
            this.handleError(error, 'Load Settings');
            return null;
        }
    }

    applySettingsToForm(settings) {
        // Profile settings
        if (settings.displayName) {
            document.getElementById('display-name-input').value = settings.displayName;
        }
        if (settings.handle) {
            document.getElementById('handle-input').value = settings.handle;
        }
        if (settings.email) {
            document.getElementById('email-input').value = settings.email;
        }

        // Notification settings
        document.getElementById('email-notifications').checked = settings.notifications?.emailNotifications ?? true;
        document.getElementById('inapp-notifications').checked = settings.notifications?.inAppNotifications ?? true;
        document.getElementById('announcement-notifications').checked = settings.notifications?.announcementNotifications ?? true;
        document.getElementById('community-notifications').checked = settings.notifications?.communityNotifications ?? true;
        document.getElementById('maintenance-notifications').checked = settings.notifications?.maintenanceNotifications ?? true;

        // Privacy settings
        document.getElementById('profile-visibility').checked = settings.privacy?.profileVisibility ?? true;
        document.getElementById('activity-visibility').checked = settings.privacy?.activityVisibility ?? true;
        document.getElementById('data-retention').value = settings.privacy?.dataRetention ?? '90';

        // Accessibility settings
        document.getElementById('high-contrast').checked = settings.accessibility?.highContrast ?? false;
        document.getElementById('font-size').value = settings.accessibility?.fontSize ?? 'medium';
        document.getElementById('reduced-motion').checked = settings.accessibility?.reducedMotion ?? false;
        document.getElementById('screen-reader').checked = settings.accessibility?.screenReader ?? false;

        // Communication settings
        document.getElementById('dm-permissions').value = settings.communication?.dmPermissions ?? 'everyone';
        document.getElementById('mention-permissions').value = settings.communication?.mentionPermissions ?? 'everyone';

        // Advanced settings
        document.getElementById('low-bandwidth').checked = settings.advanced?.lowBandwidth ?? false;
        document.getElementById('debug-mode').checked = settings.advanced?.debugMode ?? false;
        document.getElementById('keyboard-shortcuts').checked = settings.advanced?.keyboardShortcuts ?? true;
        document.getElementById('experimental-features').checked = settings.advanced?.experimentalFeatures ?? false;
        document.getElementById('custom-css').value = settings.advanced?.customCSS ?? '';
    }

    // New: Getter for default settings
    getDefaultSettings() {
        return DEFAULT_USER_SETTINGS;
    }

    async saveProfile() {
        const user = auth.currentUser;
        if (!user) {
            showMessageBox('You must be logged in to save profile settings.', true);
            return false;
        }

        try {
            const displayName = document.getElementById('display-name-input')?.value?.trim();
            const handle = document.getElementById('handle-input')?.value?.trim();
            const email = document.getElementById('email-input')?.value?.trim();
            const photoURL = document.getElementById('profile-picture-url-input')?.value?.trim();

            if (!displayName) {
                showMessageBox('Display name is required.', true);
                return false;
            }

            const updates = {
                displayName,
                handle,
                email,
                photoURL,
                lastUpdated: new Date().toISOString()
            };

            const docRef = doc(db, 'artifacts', appId, 'public/data/user_profiles', user.uid);
            await updateDoc(docRef, updates);
            showMessageBox('Profile updated successfully!');
            return true;
        } catch (error) {
            this.handleError(error, 'Save Profile');
            return false;
        }
    }

    async savePreferences() {
        const user = auth.currentUser;
        if (!user) {
            showMessageBox('You must be logged in to save preferences.', true);
            return false;
        }

        try {
            const preferences = {
                fontSize: document.getElementById('font-size-select')?.value,
                fontFamily: document.getElementById('font-family-select')?.value,
                backgroundPattern: document.getElementById('background-pattern-select')?.value,
                headingSizeMultiplier: document.getElementById('heading-size-multiplier')?.value,
                lineHeight: document.getElementById('line-height-select')?.value,
                letterSpacing: document.getElementById('letter-spacing-select')?.value,
                backgroundOpacity: document.getElementById('background-opacity-range')?.value
            };

            const docRef = doc(db, 'artifacts', appId, 'public/data/user_profiles', user.uid);
            await updateDoc(docRef, {preferences, lastUpdated: new Date().toISOString()});

            // Cache locally
            storageManager.merge(`user_settings_${user.uid}`, {preferences});
            showMessageBox('Preferences saved successfully!');
            return true;
        } catch (error) {
            this.handleError(error, 'Save Preferences');
            return false;
        }
    }

    async saveNotifications() {
        const user = auth.currentUser;
        if (!user) {
            showMessageBox('You must be logged in to save notification settings.', true);
            return false;
        }

        try {
            const notificationSettings = {
                emailNotifications: document.getElementById('email-notifications-checkbox')?.checked,
                inAppNotifications: document.getElementById('inapp-notifications-checkbox')?.checked,
                announcementNotifications: document.getElementById('announcement-notifications-checkbox')?.checked,
                communityNotifications: document.getElementById('community-notifications-checkbox')?.checked,
                securityNotifications: document.getElementById('security-notifications-checkbox')?.checked,
                maintenanceNotifications: document.getElementById('maintenance-notifications-checkbox')?.checked,
                frequency: document.getElementById('notification-frequency-select')?.value
            };

            const docRef = doc(db, 'artifacts', appId, 'public/data/user_profiles', user.uid);
            await updateDoc(docRef, {notificationSettings, lastUpdated: new Date().toISOString()});

            showMessageBox('Notification settings saved successfully!');
            return true;
        } catch (error) {
            this.handleError(error, 'Save Notifications');
            return false;
        }
    }

    async savePrivacy() {
        const user = auth.currentUser;
        if (!user) {
            showMessageBox('You must be logged in to save privacy settings.', true);
            return false;
        }

        try {
            const privacySettings = {
                profileVisibility: document.getElementById('profile-visibility-checkbox')?.checked,
                activityVisibility: document.getElementById('activity-visibility-checkbox')?.checked,
                analyticsConsent: document.getElementById('analytics-consent-checkbox')?.checked,
                dataRetention: document.getElementById('data-retention-select')?.value
            };

            const docRef = doc(db, 'artifacts', appId, 'public/data/user_profiles', user.uid);
            await updateDoc(docRef, {privacySettings, lastUpdated: new Date().toISOString()});

            showMessageBox('Privacy settings saved successfully!');
            return true;
        } catch (error) {
            this.handleError(error, 'Save Privacy Settings');
            return false;
        }
    }

    async saveAccessibility() {
        const user = auth.currentUser;
        if (!user) {
            showMessageBox('You must be logged in to save accessibility settings.', true);
            return false;
        }

        try {
            const accessibilitySettings = {
                highContrast: document.getElementById('high-contrast-checkbox')?.checked,
                largeCursor: document.getElementById('large-cursor-checkbox')?.checked,
                focusIndicators: document.getElementById('focus-indicators-checkbox')?.checked,
                colorblindFriendly: document.getElementById('colorblind-friendly-checkbox')?.checked,
                reducedMotion: document.getElementById('reduced-motion-checkbox')?.checked,
                disableAnimations: document.getElementById('disable-animations-checkbox')?.checked,
                keyboardNavigation: document.getElementById('keyboard-navigation-checkbox')?.checked,
                skipLinks: document.getElementById('skip-links-checkbox')?.checked,
                textToSpeech: document.getElementById('text-to-speech-checkbox')?.checked,
                readingGuide: document.getElementById('reading-guide-checkbox')?.checked,
                syntaxHighlighting: document.getElementById('syntax-highlighting-checkbox')?.checked,
                wordSpacing: document.getElementById('word-spacing-checkbox')?.checked
            };

            const docRef = doc(db, 'artifacts', appId, 'public/data/user_profiles', user.uid);
            await updateDoc(docRef, {accessibilitySettings, lastUpdated: new Date().toISOString()});

            await this.applyAccessibilitySettings(accessibilitySettings);
            showMessageBox('Accessibility settings saved successfully!');
            return true;
        } catch (error) {
            this.handleError(error, 'Save Accessibility Settings');
            return false;
        }
    }

    async saveAdvanced() {
        const user = auth.currentUser;
        if (!user) {
            showMessageBox('You must be logged in to save advanced settings.', true);
            return false;
        }

        try {
            const advancedSettings = {
                lowBandwidthMode: document.getElementById('low-bandwidth-mode-checkbox')?.checked,
                disableImages: document.getElementById('disable-images-checkbox')?.checked,
                minimalUi: document.getElementById('minimal-ui-checkbox')?.checked,
                debugMode: document.getElementById('debug-mode-checkbox')?.checked,
                showPerformanceMetrics: document.getElementById('show-performance-metrics-checkbox')?.checked,
                enableExperimentalFeatures: document.getElementById('enable-experimental-features-checkbox')?.checked,
                customCSS: document.getElementById('custom-css-textarea')?.value,
                keyboardShortcuts: document.getElementById('keyboard-shortcuts-toggle')?.value,
                disabledShortcuts: Array.from(document.querySelectorAll('.shortcut-disable-btn.disabled'))
                    .map(btn => btn.getAttribute('data-shortcut'))
                    .filter(Boolean)
            };

            const docRef = doc(db, 'artifacts', appId, 'public/data/user_profiles', user.uid);
            await updateDoc(docRef, {advancedSettings, lastUpdated: new Date().toISOString()});

            await this.applyAdvancedSettings(advancedSettings);
            showMessageBox('Advanced settings saved successfully!');
            return true;
        } catch (error) {
            this.handleError(error, 'Save Advanced Settings');
            return false;
        }
    }

    async applyUserSettings(settings) {
        if (!settings) return;

        try {
            // Apply theme
            if (settings.themePreference) {
                await themeManager.applyTheme(settings.themePreference);
            }

            // Apply preferences
            if (settings.preferences) {
                this.applyPreferences(settings.preferences);
            }

            // Apply accessibility settings
            if (settings.accessibilitySettings) {
                await this.applyAccessibilitySettings(settings.accessibilitySettings);
            }

            // Apply advanced settings
            if (settings.advancedSettings) {
                await this.applyAdvancedSettings(settings.advancedSettings);
            }

            this.currentSettings = settings;
            return true;
        } catch (error) {
            this.handleError(error, 'Apply User Settings');
            return false;
        }
    }

    applyPreferences(preferences) {
        if (!preferences) return;

        const root = document.documentElement;

        // Apply font settings
        if (preferences.fontSize) root.style.setProperty('--base-font-size', preferences.fontSize);
        if (preferences.fontFamily) root.style.setProperty('--font-family', preferences.fontFamily);
        if (preferences.letterSpacing) root.style.setProperty('--letter-spacing', preferences.letterSpacing);
        if (preferences.lineHeight) root.style.setProperty('--line-height', preferences.lineHeight);

        // Apply background settings
        if (preferences.backgroundPattern) {
            document.body.style.backgroundImage = preferences.backgroundPattern === 'none'
                ? 'none'
                : `url(assets/patterns/${preferences.backgroundPattern})`;
        }
        if (preferences.backgroundOpacity) {
            root.style.setProperty('--bg-opacity', preferences.backgroundOpacity + '%');
        }

        // Apply heading size multiplier
        if (preferences.headingSizeMultiplier) {
            const multiplier = parseFloat(preferences.headingSizeMultiplier);
            ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach((tag, index) => {
                const size = (1 + (6 - index) * 0.2) * multiplier;
                root.style.setProperty(`--${tag}-size`, `${size}rem`);
            });
        }
    }

    async applyAccessibilitySettings(settings) {
        if (!settings) return;

        const root = document.documentElement;

        // High contrast mode
        root.classList.toggle('high-contrast', settings.highContrast);

        // Large cursor
        root.classList.toggle('large-cursor', settings.largeCursor);

        // Focus indicators
        root.classList.toggle('focus-visible', settings.focusIndicators);

        // Colorblind friendly mode
        root.classList.toggle('colorblind-friendly', settings.colorblindFriendly);

        // Reduced motion
        root.classList.toggle('reduced-motion', settings.reducedMotion);

        // Disable animations
        root.classList.toggle('no-animations', settings.disableAnimations);

        // Skip links
        this.toggleSkipLinks(settings.skipLinks);

        // Text to speech
        this.toggleTextToSpeech(settings.textToSpeech);

        // Reading guide
        this.toggleReadingGuide(settings.readingGuide);

        // Syntax highlighting
        this.toggleSyntaxHighlighting(settings.syntaxHighlighting);

        // Word spacing
        if (settings.wordSpacing) {
            root.style.setProperty('--word-spacing', settings.wordSpacing + 'px');
        }
    }

    async applyAdvancedSettings(settings) {
        if (!settings) return;

        const root = document.documentElement;

        // Apply performance modes
        root.classList.toggle('low-bandwidth-mode', settings.lowBandwidthMode);
        root.classList.toggle('minimal-ui', settings.minimalUi);
        root.classList.toggle('debug-mode', settings.debugMode);

        // Handle image loading
        if (settings.disableImages) {
            document.querySelectorAll('img').forEach(img => {
                img.loading = 'lazy';
                if (!img.hasAttribute('data-src')) {
                    img.setAttribute('data-src', img.src);
                    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                }
            });
        } else {
            document.querySelectorAll('img[data-src]').forEach(img => {
                img.src = img.getAttribute('data-src');
                img.removeAttribute('data-src');
            });
        }

        // Apply custom CSS
        await this.applyCustomCSS(settings.customCSS);

        // Handle performance metrics
        this.togglePerformanceMetrics(settings.showPerformanceMetrics);

        // Apply experimental features
        root.classList.toggle('experimental-features', settings.enableExperimentalFeatures);

        // Handle keyboard shortcuts
        if (settings.disabledShortcuts) {
            settings.disabledShortcuts.forEach(shortcut => {
                const btn = document.querySelector(`[data-shortcut="${shortcut}"]`);
                if (btn) {
                    btn.classList.add('disabled');
                    btn.setAttribute('aria-disabled', 'true');
                }
            });
        }
    }

    // New: Keyboard shortcuts functionality
    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', this.handleKeyboardShortcut);
    }

    disableKeyboardShortcuts() {
        document.removeEventListener('keydown', this.handleKeyboardShortcut);
    }

    handleKeyboardShortcut(event) {
        // Don't handle shortcuts if user is typing in an input
        if (event.target.matches('input, textarea, [contenteditable]')) return;

        const shortcuts = this.getActiveShortcuts();
        const shortcut = shortcuts.find(s => this.matchesShortcut(event, s));

        if (shortcut) {
            event.preventDefault();
            this.executeShortcut(shortcut);
        }
    }

    matchesShortcut(event, shortcut) {
        return shortcut.key === event.key &&
            shortcut.ctrl === event.ctrlKey &&
            shortcut.alt === event.altKey &&
            shortcut.shift === event.shiftKey;
    }

    executeShortcut(shortcut) {
        switch (shortcut.action) {
            case 'toggleTheme':
                themeManager.toggleTheme();
                break;
            case 'toggleSidebar':
                document.documentElement.classList.toggle('sidebar-collapsed');
                break;
            case 'toggleFullscreen':
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else {
                    document.documentElement.requestFullscreen();
                }
                break;
            // Add more shortcut actions as needed
        }
    }

    getActiveShortcuts() {
        const user = authManager.getCurrentUser();
        const settings = user ? storageManager.get(`user_settings_${user.uid}`) : null;

        if (settings?.keyboardShortcuts === 'disabled') {
            return [];
        }

        const defaultShortcuts = [
            {key: 'd', ctrl: true, alt: false, shift: false, action: 'toggleTheme'},
            {key: 'b', ctrl: true, alt: false, shift: false, action: 'toggleSidebar'},
            {key: 'f', ctrl: true, alt: false, shift: false, action: 'toggleFullscreen'}
        ];

        return settings?.disabledShortcuts
            ? defaultShortcuts.filter(s => !settings.disabledShortcuts.includes(s.action))
            : defaultShortcuts;
    }

    async applyCustomCSS(css) {
        if (!css) return;

        const styleId = 'user-custom-css';
        let styleSheet = document.getElementById(styleId);

        if (!styleSheet) {
            styleSheet = document.createElement('style');
            styleSheet.id = styleId;
            document.head.appendChild(styleSheet);
        }

        styleSheet.innerHTML = css;
    }

    toggleSkipLinks(enabled) {
        const skipLink = document.getElementById('skip-to-content-link');
        if (enabled) {
            skipLink.setAttribute('href', '#main-content');
            skipLink.style.display = 'block';
        } else {
            skipLink.removeAttribute('href');
            skipLink.style.display = 'none';
        }
    }

    toggleTextToSpeech(enabled) {
        // Implement text-to-speech toggling
    }

    toggleReadingGuide(enabled) {
        const guide = document.getElementById('reading-guide');
        if (enabled) {
            guide.style.display = 'block';
        } else {
            guide.style.display = 'none';
        }
    }

    toggleSyntaxHighlighting(enabled) {
        const codeBlocks = document.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
            if (enabled) {
                block.classList.add('syntax-highlight');
            } else {
                block.classList.remove('syntax-highlight');
            }
        });
    }

    handleError(error, context) {
        console.error(`Error in ${context}:`, error);
        showMessageBox(`An error occurred: ${error.message}`, true);
    }

    async saveSettings(sectionId, settings) {
        const user = auth.currentUser;
        if (!user) {
            showMessageBox('You must be logged in to save settings', true);
            return false;
        }

        try {
            const settingsRef = doc(db, 'user_settings', user.uid);
            await setDoc(settingsRef, {[sectionId]: settings}, {merge: true});

            showMessageBox('Settings saved successfully!');
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            showMessageBox('Failed to save settings: ' + error.message, true);
            return false;
        }
    }

    setupEventListeners() {
        // Profile settings
        document.getElementById('profile-settings-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const settings = {
                displayName: document.getElementById('display-name-input').value,
                handle: document.getElementById('handle-input').value,
                email: document.getElementById('email-input').value
            };
            await this.saveSettings('profile', settings);
        });

        // Notification settings
        document.getElementById('notification-settings-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const settings = {
                emailNotifications: document.getElementById('email-notifications').checked,
                inAppNotifications: document.getElementById('inapp-notifications').checked,
                announcementNotifications: document.getElementById('announcement-notifications').checked,
                communityNotifications: document.getElementById('community-notifications').checked,
                maintenanceNotifications: document.getElementById('maintenance-notifications').checked
            };
            await this.saveSettings('notifications', settings);
        });

        // Privacy settings
        document.getElementById('privacy-settings-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const settings = {
                profileVisibility: document.getElementById('profile-visibility').checked,
                activityVisibility: document.getElementById('activity-visibility').checked,
                dataRetention: document.getElementById('data-retention').value
            };
            await this.saveSettings('privacy', settings);
        });

        // Accessibility settings
        document.getElementById('accessibility-settings-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const settings = {
                highContrast: document.getElementById('high-contrast').checked,
                fontSize: document.getElementById('font-size').value,
                reducedMotion: document.getElementById('reduced-motion').checked,
                screenReader: document.getElementById('screen-reader').checked
            };
            await this.saveSettings('accessibility', settings);
        });

        // Communication settings
        document.getElementById('communication-settings-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const settings = {
                dmPermissions: document.getElementById('dm-permissions').value,
                mentionPermissions: document.getElementById('mention-permissions').value
            };
            await this.saveSettings('communication', settings);
        });

        // Advanced settings
        document.getElementById('advanced-settings-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const settings = {
                lowBandwidth: document.getElementById('low-bandwidth').checked,
                debugMode: document.getElementById('debug-mode').checked,
                keyboardShortcuts: document.getElementById('keyboard-shortcuts').checked,
                experimentalFeatures: document.getElementById('experimental-features').checked,
                customCSS: document.getElementById('custom-css').value
            };
            await this.saveSettings('advanced', settings);
        });
    }
}

export const settingsManager = new SettingsManager();

// Font scaling system
function applyFontScalingSystem(userProfile) {
    // ...existing code...
}

// Additional accessibility settings
function applyAccessibilitySettings(settings) {
    // ...existing code...
}

// Keyboard shortcuts management
export function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeyboardShortcut);
}

export function disableKeyboardShortcuts() {
    document.removeEventListener('keydown', handleKeyboardShortcut);
}

function handleKeyboardShortcut(event) {
    // Don't handle shortcuts if user is typing in an input
    if (event.target.matches('input, textarea, [contenteditable]')) return;

    const shortcuts = getActiveShortcuts();
    const shortcut = shortcuts.find(s => matchesShortcut(event, s));

    if (shortcut) {
        event.preventDefault();
        executeShortcut(shortcut);
    }
}

function matchesShortcut(event, shortcut) {
    return shortcut.key === event.key &&
        shortcut.ctrl === event.ctrlKey &&
        shortcut.alt === event.altKey &&
        shortcut.shift === event.shiftKey;
}

function executeShortcut(shortcut) {
    switch (shortcut.action) {
        case 'toggleTheme':
            themeManager.toggleTheme();
            break;
        case 'toggleSidebar':
            document.documentElement.classList.toggle('sidebar-collapsed');
            break;
        case 'toggleFullscreen':
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.documentElement.requestFullscreen();
            }
            break;
        // Add more shortcut actions as needed
    }
}

function getActiveShortcuts() {
    const user = authManager.getCurrentUser();
    const settings = user ? storageManager.get(`user_settings_${user.uid}`) : null;

    if (settings?.keyboardShortcuts === 'disabled') {
        return [];
    }

    const defaultShortcuts = [
        {key: 'd', ctrl: true, alt: false, shift: false, action: 'toggleTheme'},
        {key: 'b', ctrl: true, alt: false, shift: false, action: 'toggleSidebar'},
        {key: 'f', ctrl: true, alt: false, shift: false, action: 'toggleFullscreen'}
    ];

    return settings?.disabledShortcuts
        ? defaultShortcuts.filter(s => !settings.disabledShortcuts.includes(s.action))
        : defaultShortcuts;
}