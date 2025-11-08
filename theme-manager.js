// theme-manager.js - Theme management functionality
import {appId, auth, db, doc, getDoc, setDoc} from './firebase-init.js';
import {showMessageBox} from './utils.js';

const DEFAULT_THEME = {
    id: 'oled-dark',
    name: 'OLED Dark',
    variables: {
        '--color-bg': '#000000',
        '--color-surface': '#0A0A0A',
        '--color-surface-2': '#111111',
        '--color-surface-3': '#1A1A1A',
        '--color-text': '#FFFFFF',
        '--color-text-2': '#A0AEC0',
        '--color-text-3': '#718096',
        '--color-accent': '#1a4b91',
        '--color-accent-light': '#2563eb',
        '--color-accent-dark': '#1e3a8a',
        '--color-error': '#DC2626',
        '--color-success': '#059669',
        '--color-warning': '#D97706'
    }
};

class ThemeManager {
    constructor() {
        this.currentTheme = DEFAULT_THEME;
        this.isInitialized = false;
        this.root = document.documentElement;
    }

    async init() {
        if (this.isInitialized) return;

        try {
            this.applyTheme(DEFAULT_THEME);
            await this.loadUserTheme();
            this.isInitialized = true;
        } catch (error) {
            console.error('Theme initialization error:', error);
            this.applyTheme(DEFAULT_THEME);
        }
    }

    async loadUserTheme() {
        if (!auth.currentUser) return;

        try {
            const userDoc = await getDoc(
                doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid)
            );

            if (!userDoc.exists()) return;

            const themeId = userDoc.data()?.themePreference;
            if (!themeId) return;

            const themeDoc = await getDoc(
                doc(db, `artifacts/${appId}/public/data/themes`, themeId)
            );

            if (themeDoc.exists()) {
                this.applyTheme({id: themeDoc.id, ...themeDoc.data()});
            }
        } catch (error) {
            console.error('Error loading user theme:', error);
        }
    }

    applyTheme(theme) {
        try {
            Object.entries(DEFAULT_THEME.variables).forEach(([key, value]) => {
                this.root.style.setProperty(key, value);
            });

            if (theme?.variables) {
                Object.entries(theme.variables).forEach(([key, value]) => {
                    this.root.style.setProperty(key, value);
                });
            }

            this.currentTheme = theme;
            this.saveThemePreference(theme.id);
            return true;
        } catch (error) {
            console.error('Error applying theme:', error);
            showMessageBox('Failed to apply theme', true);
            return false;
        }
    }

    async saveThemePreference(themeId) {
        if (!auth.currentUser) return;

        try {
            await setDoc(
                doc(db, `artifacts/${appId}/public/data/user_profiles`, auth.currentUser.uid),
                {
                    themePreference: themeId,
                    lastUpdated: new Date()
                },
                {merge: true}
            );
        } catch (error) {
            console.error('Error saving theme preference:', error);
        }
    }

    getCurrentTheme() {
        return this.currentTheme || DEFAULT_THEME;
    }
}

export const themeManager = new ThemeManager();