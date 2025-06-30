// core.js - Essential functionality consolidated into a single module
// This file combines Firebase, themes, navigation, and utilities to reduce imports

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
  authDomain: "arcator-web.firebaseapp.com",
  projectId: "arcator-web",
  storageBucket: "arcator-web.firebasestorage.app",
  messagingSenderId: "1033082068049",
  appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
  measurementId: "G-DJXNT1L7CM",
};

// Determine appId for Firestore paths
const canvasAppId = typeof __app_id !== "undefined" ? __app_id : null;
export const appId = canvasAppId || firebaseConfig.projectId || "default-app-id";

// Firebase instances
export let app;
export let auth;
export let db;
export let firebaseReadyPromise;

// Constants
export const DEFAULT_PROFILE_PIC = "https://placehold.co/32x32/1F2937/E5E7EB?text=AV";
export const DEFAULT_THEME_NAME = "dark";

// Initialize Firebase
async function setupFirebaseCore() {
  if (getApps().length === 0) {
    let finalFirebaseConfig = firebaseConfig;
    
    if (typeof __firebase_config !== "undefined" && __firebase_config !== null) {
      if (typeof __firebase_config === "string") {
        try {
          finalFirebaseConfig = JSON.parse(__firebase_config);
        } catch (e) {
          console.error("Failed to parse __firebase_config, using hardcoded config");
          finalFirebaseConfig = firebaseConfig;
        }
      } else if (typeof __firebase_config === "object") {
        finalFirebaseConfig = __firebase_config;
      }
    }
    
    app = initializeApp(finalFirebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    console.log("Firebase initialized successfully");
  } else {
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  }
}

// Initialize Firebase immediately
firebaseReadyPromise = setupFirebaseCore();

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

// Theme storage and management
const THEME_STORAGE_KEY = "arcator-theme";
const THEME_CACHE_KEY = "arcator-theme-cache";

// Default themes
const defaultThemes = [
  {
    id: "dark",
    name: "Dark",
    colors: {
      "--color-bg-navbar": "#111827",
      "--color-bg-content-section": "#1f2937",
      "--color-bg-card": "#374151",
      "--color-heading-main": "#f9fafb",
      "--color-heading-card": "#e5e7eb",
      "--color-text-primary": "#f9fafb",
      "--color-text-secondary": "#d1d5db",
      "--color-link": "#3b82f6",
      "--color-table-th-bg": "#374151",
      "--color-table-th-text": "#e5e7eb",
      "--color-table-td-border": "#4b5563",
      "--color-table-row-even-bg": "#4b5563",
      "--color-button-blue-bg": "#3b82f6",
      "--color-button-blue-hover": "#2563eb",
      "--color-button-green-bg": "#10b981",
      "--color-button-green-hover": "#059669",
      "--color-button-red-bg": "#ef4444",
      "--color-button-red-hover": "#dc2626",
      "--color-button-purple-bg": "#8b5cf6",
      "--color-button-purple-hover": "#7c3aed",
      "--color-button-yellow-bg": "#f59e0b",
      "--color-button-yellow-hover": "#d97706",
      "--color-button-indigo-bg": "#6366f1",
      "--color-button-indigo-hover": "#4f46e5",
      "--color-button-text": "#ffffff",
      "--color-input-bg": "#374151",
      "--color-input-text": "#f9fafb",
      "--color-input-border": "#4b5563",
    }
  },
  {
    id: "light",
    name: "Light",
    colors: {
      "--color-bg-navbar": "#f3f4f6",
      "--color-bg-content-section": "#ffffff",
      "--color-bg-card": "#f9fafb",
      "--color-heading-main": "#111827",
      "--color-heading-card": "#374151",
      "--color-text-primary": "#111827",
      "--color-text-secondary": "#6b7280",
      "--color-link": "#3b82f6",
      "--color-table-th-bg": "#f3f4f6",
      "--color-table-th-text": "#374151",
      "--color-table-td-border": "#e5e7eb",
      "--color-table-row-even-bg": "#f9fafb",
      "--color-button-blue-bg": "#3b82f6",
      "--color-button-blue-hover": "#2563eb",
      "--color-button-green-bg": "#10b981",
      "--color-button-green-hover": "#059669",
      "--color-button-red-bg": "#ef4444",
      "--color-button-red-hover": "#dc2626",
      "--color-button-purple-bg": "#8b5cf6",
      "--color-button-purple-hover": "#7c3aed",
      "--color-button-yellow-bg": "#f59e0b",
      "--color-button-yellow-hover": "#d97706",
      "--color-button-indigo-bg": "#6366f1",
      "--color-button-indigo-hover": "#4f46e5",
      "--color-button-text": "#ffffff",
      "--color-input-bg": "#ffffff",
      "--color-input-text": "#111827",
      "--color-input-border": "#d1d5db",
    }
  }
];

// Theme management functions
export function applyTheme(themeId, themeData = null) {
  const theme = themeData || defaultThemes.find(t => t.id === themeId);
  if (!theme) return false;
  
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
  
  localStorage.setItem(THEME_STORAGE_KEY, themeId);
  localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(theme));
  
  return true;
}

export function applyCachedTheme() {
  const cachedTheme = localStorage.getItem(THEME_CACHE_KEY);
  if (cachedTheme) {
    try {
      const theme = JSON.parse(cachedTheme);
      applyTheme(theme.id, theme);
      return true;
    } catch (e) {
      console.error("Failed to apply cached theme:", e);
    }
  }
  return false;
}

export function getAvailableThemes() {
  return Promise.resolve(defaultThemes);
}

export function getCurrentTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_NAME;
}

// ============================================================================
// NAVIGATION AND LAYOUT
// ============================================================================

// Navbar and footer loading
export async function loadNavbar(user, userProfile, defaultProfilePic, defaultTheme) {
  const navbarPlaceholder = document.getElementById("navbar-placeholder");
  if (!navbarPlaceholder) return;
  
  // Simple navbar template
  const navbarHTML = `
    <nav class="bg-navbar-footer text-text-primary shadow-lg fixed top-0 left-0 right-0 z-50">
      <div class="container mx-auto px-4">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center space-x-8">
            <a href="index.html" class="text-xl font-bold text-heading-main">Arcator.co.uk</a>
            <div class="hidden md:flex space-x-6">
              <a href="about.html" class="text-text-secondary hover:text-text-primary transition-colors">About</a>
              <a href="servers-and-games.html" class="text-text-secondary hover:text-text-primary transition-colors">Servers & Games</a>
              <a href="forms.html" class="text-text-secondary hover:text-text-primary transition-colors">Community</a>
              <a href="users.html" class="text-text-secondary hover:text-text-primary transition-colors">Account</a>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            ${user ? `
              <img src="${userProfile?.photoURL || defaultProfilePic}" alt="Profile" class="w-8 h-8 rounded-full">
              <span class="text-text-secondary">${userProfile?.displayName || user.email}</span>
            ` : `
              <a href="users.html" class="btn-primary btn-blue">Login</a>
            `}
          </div>
        </div>
      </div>
    </nav>
  `;
  
  navbarPlaceholder.innerHTML = navbarHTML;
}

export function loadFooter(yearElementId) {
  const footerPlaceholder = document.getElementById("footer-placeholder");
  if (!footerPlaceholder) return;
  
  const currentYear = new Date().getFullYear();
  const footerHTML = `
    <footer class="bg-navbar-footer text-text-secondary py-8 mt-16">
      <div class="container mx-auto px-4 text-center">
        <p>&copy; ${currentYear} Arcator.co.uk. All rights reserved.</p>
        <div class="mt-4 space-x-4">
          <a href="privacy.html" class="text-link hover:underline">Privacy Policy</a>
          <a href="https://discord.gg/GwArgw2" target="_blank" rel="noopener noreferrer" class="text-link hover:underline">Discord</a>
        </div>
      </div>
    </footer>
  `;
  
  footerPlaceholder.innerHTML = footerHTML;
}

// ============================================================================
// UTILITIES
// ============================================================================

// Message box functionality
export function showMessageBox(message, isError = false, allowHtml = false) {
  const messageBox = document.getElementById("message-box");
  if (!messageBox) return;
  
  messageBox.className = `message-box ${isError ? "error" : "success"}`;
  if (allowHtml) {
    messageBox.innerHTML = message;
  } else {
    messageBox.textContent = message;
  }
  
  messageBox.style.display = "block";
  setTimeout(() => {
    messageBox.style.display = "none";
  }, 5000);
}

// Custom confirmation dialog
export function showCustomConfirm(message, submessage = "") {
  return new Promise((resolve) => {
    const modal = document.getElementById("custom-confirm-modal");
    if (!modal) {
      resolve(false);
      return;
    }
    
    const messageEl = document.getElementById("confirm-message");
    const submessageEl = document.getElementById("confirm-submessage");
    const yesBtn = document.getElementById("confirm-yes");
    const noBtn = document.getElementById("confirm-no");
    
    if (messageEl) messageEl.textContent = message;
    if (submessageEl) submessageEl.textContent = submessage;
    
    const handleYes = () => {
      modal.style.display = "none";
      yesBtn.removeEventListener("click", handleYes);
      noBtn.removeEventListener("click", handleNo);
      resolve(true);
    };
    
    const handleNo = () => {
      modal.style.display = "none";
      yesBtn.removeEventListener("click", handleYes);
      noBtn.removeEventListener("click", handleNo);
      resolve(false);
    };
    
    yesBtn.addEventListener("click", handleYes);
    noBtn.addEventListener("click", handleNo);
    modal.style.display = "flex";
  });
}

// HTML escaping
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// User profile management
export async function getUserProfileFromFirestore(uid) {
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized");
    return null;
  }
  
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
  }
  return null;
}

export async function setUserProfileInFirestore(uid, profileData) {
  await firebaseReadyPromise;
  if (!db) {
    console.error("Firestore DB not initialized");
    return false;
  }
  
  const userDocRef = doc(db, `artifacts/${appId}/public/data/user_profiles`, uid);
  try {
    await setDoc(userDocRef, profileData, { merge: true });
    return true;
  } catch (error) {
    console.error("Error setting user profile:", error);
    return false;
  }
}

// ============================================================================
// PAGE INITIALIZATION
// ============================================================================

export async function initializePage(pageName, yearElementId = null, useWindowLoad = false) {
  const initFunction = async () => {
    try {
      await firebaseReadyPromise;
      
      // Apply cached theme immediately
      applyCachedTheme();
      
      // Listen for auth state changes
      onAuthStateChanged(auth, async (user) => {
        let userProfile = null;
        if (user) {
          userProfile = await getUserProfileFromFirestore(user.uid);
        }
        
        // Load navbar and footer
        await loadNavbar(user, userProfile, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
        loadFooter(yearElementId || `current-year-${pageName.toLowerCase()}`);
        
        // Apply user's theme preference
        const userThemePreference = userProfile?.themePreference;
        const allThemes = await getAvailableThemes();
        const themeToApply = allThemes.find(t => t.id === userThemePreference) || 
                           allThemes.find(t => t.id === DEFAULT_THEME_NAME);
        
        if (themeToApply) {
          applyTheme(themeToApply.id, themeToApply);
        }
      });
      
      console.log(`${pageName} page initialized successfully`);
    } catch (error) {
      console.error(`Error initializing ${pageName} page:`, error);
    }
  };
  
  if (useWindowLoad) {
    window.onload = initFunction;
  } else {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initFunction);
    } else {
      initFunction();
    }
  }
}

// ============================================================================
// TAB FUNCTIONALITY
// ============================================================================

export function setupTabs(tabButtonSelector = '.tab-button', tabContentSelector = '.tab-content') {
  document.querySelectorAll(tabButtonSelector).forEach(button => {
    button.addEventListener('click', function(event) {
      document.querySelectorAll(tabButtonSelector).forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll(tabContentSelector).forEach(tab => tab.classList.remove('active'));
      
      this.classList.add('active');
      const tabName = this.getAttribute('data-tab') || this.textContent.trim().toLowerCase();
      const tab = document.getElementById(tabName + '-tab');
      if (tab) tab.classList.add('active');
    });
  });
}
