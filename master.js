// master.js: Consolidated JavaScript modules for the Arcator website
// This file consolidates all JavaScript functionality into logical modules

// ============================================================================
// CORE MODULES
// ============================================================================

// Core functionality
export * from './core.js';

// Firebase and authentication
export * from './firebase-init.js';

// Theme management
export * from './themes.js';

// Navigation and UI
export * from './navbar.js';

// ============================================================================
// UTILITY MODULES
// ============================================================================

// Utilities and helpers
export * from './utils.js';

// ============================================================================
// FEATURE MODULES
// ============================================================================

// Page-specific functionality
export * from './admin.js';
export * from './forms.js';
export * from './dms.js';
export * from './user-main.js';
export * from './emoji-picker.js';
export * from './announcements.js';
export * from './app.js';

// Email functionality
export * from './emailjs-integration.js';
export * from './smtp-integration.js';
export * from './smtp-server.js';

// Custom theme management
export * from './custom_theme_modal.js';

// Page initialization
export * from './page-init.js';

// Data management
export * from './update-census-data.js';
export * from './interests.js'; 