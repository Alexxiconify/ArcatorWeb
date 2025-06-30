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

// Import Firebase configuration from sensitive folder
import { firebaseConfig } from "./sensitive/firebase-config.js";

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
// THEME MANAGEMENT REMOVED
// All theme logic is handled by themes.js. Do not define or use applyTheme, applyCachedTheme, getAvailableThemes, or getCurrentTheme here.
// ============================================================================

// ============================================================================
// NAVIGATION & LAYOUT
// ============================================================================

export async function loadNavbar(user, userProfile, defaultProfilePic, defaultTheme) {
  const navbarPlaceholder = document.getElementById("navbar-placeholder");
  if (!navbarPlaceholder) return;

  // Import navbar functionality dynamically to avoid circular dependencies
  const { loadNavbar: loadNavbarFunction } = await import("./navbar.js");
  await loadNavbarFunction(user, userProfile, defaultProfilePic, defaultTheme);
}

export function loadFooter(yearElementId) {
  const footerPlaceholder = document.getElementById("footer-placeholder");
  if (!footerPlaceholder) return;

  const currentYear = new Date().getFullYear();
  
  footerPlaceholder.innerHTML = `
    <footer class="bg-navbar-footer text-text-secondary py-8 mt-16">
      <div class="container mx-auto px-4">
        <div class="text-center">
          <p>&copy; ${yearElementId ? currentYear : "2024"} Arcator.co.uk. All rights reserved.</p>
          <div class="mt-4 space-x-4">
            <a href="privacy.html" class="text-link hover:underline">Privacy Policy</a>
            <a href="about.html" class="text-link hover:underline">About</a>
            <a href="https://discord.gg/GwArgw2" target="_blank" rel="noopener noreferrer" class="text-link hover:underline">Discord</a>
          </div>
        </div>
      </div>
    </footer>
  `;
}

// ============================================================================
// FIREBASE UTILITIES
// ============================================================================

export async function getUserProfileFromFirestore(uid) {
  try {
    const userDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

export async function setUserProfileInFirestore(uid, profileData) {
  try {
    await setDoc(doc(db, `artifacts/${appId}/public/data/user_profiles`, uid), {
      ...profileData,
      updatedAt: serverTimestamp(),
    });
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
    console.log(`${pageName}: Initialization started.`);

    // Wait for Firebase to be ready
    await firebaseReadyPromise;
    console.log(`${pageName}: Firebase ready.`);

    // Load navbar
    let userProfile = null;
    if (auth.currentUser) {
      userProfile = await getUserProfileFromFirestore(auth.currentUser.uid);
    }
    await loadNavbar(auth.currentUser, userProfile, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
    console.log(`${pageName}: Navbar loaded.`);

    // Set current year for footer
    if (yearElementId) {
      const currentYearElement = document.getElementById(yearElementId);
      if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
        console.log(`${pageName}: Current year set for footer.`);
      }
    }

    // Apply theme
    onAuthStateChanged(auth, async (user) => {
      let userThemePreference = null;
      if (user) {
        const userProfile = await getUserProfileFromFirestore(user.uid);
        userThemePreference = userProfile?.themePreference;
      }
      const allThemes = getAvailableThemes();
      const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
      applyTheme(themeToApply.id, themeToApply);
    });

    console.log(`${pageName}: Page initialization complete.`);
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
// UTILITY FUNCTIONS
// ============================================================================

export function setupTabs(tabButtonSelector = '.tab-button', tabContentSelector = '.tab-content') {
  const tabButtons = document.querySelectorAll(tabButtonSelector);
  const tabContents = document.querySelectorAll(tabContentSelector);

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      const targetContent = document.querySelector(`${tabContentSelector}[data-tab="${targetTab}"]`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}
