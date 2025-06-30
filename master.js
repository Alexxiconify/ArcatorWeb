// master.js - Consolidated JavaScript for the entire project
// This file organizes all JavaScript functionality into logical modules

// ============================================================================
// CORE MODULES
// ============================================================================

// Firebase Core - Centralized Firebase initialization and exports
export * from './firebase-init.js';

// Theme Management - All theme-related functionality
export * from './themes.js';

// Navigation and Layout - Navbar, footer, and page initialization
export * from './navbar.js';
export * from './page-init.js';

// ============================================================================
// UTILITY MODULES
// ============================================================================

// General utilities - Message boxes, HTML escaping, validation
export * from './utils.js';

// App-wide functionality - Keyboard shortcuts, global settings
export * from './app.js';

// ============================================================================
// FEATURE MODULES
// ============================================================================

// User Management - Authentication, profiles, settings
export * from './user-main.js';

// Admin Panel - Admin-specific functionality
export * from './admin.js';

// Direct Messages - DM system functionality
export * from './dms.js';

// Forms - Community forms and discussions
export * from './forms.js';

// Announcements - Announcement system
export * from './announcements.js';

// Interests - Community interests and census data
export * from './interests.js';

// ============================================================================
// INTEGRATION MODULES
// ============================================================================

// EmailJS Integration - EmailJS functionality
export * from './emailjs-integration.js';

// SMTP Integration - SMTP server functionality
export * from './smtp-integration.js';

// Emoji and Media - Emoji picker and media handling
export * from './emoji-picker.js';

// Custom Theme Modal - Theme customization
export * from './custom_theme_modal.js';

// ============================================================================
// PAGE-SPECIFIC MODULES
// ============================================================================

// Page-specific functionality
export * from './404.js';
export * from './about.js';
export * from './terms.js';
export * from './infrastructure.js';
export * from './update-census-data.js';

// ============================================================================
// TEST MODULES (Development only)
// ============================================================================

// Test files - Only include in development
export * from './test-email-browser.js';
export * from './test-email-direct.js';
export * from './test-email-system.js';
export * from './test-emailjs-setup.js';
export * from './test-firebase-smtp.js';
export * from './test-smtp-status.js';
export * from './test-smtp.js';

// ============================================================================
// LEGACY SUPPORT
// ============================================================================

// Legacy Firebase consolidated file (for backward compatibility)
export * from './firebase-consolidated.js';

// EmailJS setup (legacy)
export * from './emailjs-setup.js';

// SMTP server (legacy)
export * from './smtp-server.js'; 