import { appId, auth, currentUser as firebaseCurrentUser, db, DEFAULT_THEME_NAME, firebaseReadyPromise, onAuthStateChanged } from "./firebase-init.js";
import { getAvailableThemes, setupThemesFirebase } from "./themes.js";
import { loadNavbar } from "./core.js";
import { getEmailJSStatus, getSMTPServerStatus, initializeEmailJS, initializeSMTPIntegration, saveCredentials, sendEmailViaSMTP, testEmailJSConnection, testSMTPServerConnection } from "./email-integration.js";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, escapeHtml, showCustomConfirm, showMessageBox, loadUsers, openEditUserModal, deleteUserProfile, saveUserChanges } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM elements - Initialize immediately after declaration
const loadingSpinner = document.getElementById("loading-spinner");
const loginRequiredMessage = document.getElementById("login-required-message");
const adminContent = document.getElementById("admin-content");

// Modal close buttons
document.querySelectorAll(".close-button").forEach((button) => {
    button.addEventListener("click", () => {
        document.getElementById("edit-temp-page-modal").style.display = "none";
        document.getElementById("edit-dm-modal").style.display = "none";
        document.getElementById("edit-form-modal").style.display = "none";
        document.getElementById("edit-user-modal").style.display = "none";
    });
});

// Close modals when clicking outside
window.addEventListener("click", (event) => {
    if (event.target === document.getElementById("edit-user-modal")) {
        document.getElementById("edit-user-modal").style.display = "none";
    }
    if (event.target === document.getElementById("edit-temp-page-modal")) {
        document.getElementById("edit-temp-page-modal").style.display = "none";
    }
});