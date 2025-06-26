// forms.js: Handles dynamic behavior and Firebase integration for the forms page.

// Import necessary Firebase SDK functions and shared utilities
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import shared Firebase instances and utilities from firebase-init.js
import { auth, db, appId, firebaseReadyPromise, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME, getUserProfileFromFirestore } from './firebase-init.js';
import { showMessageBox, showCustomConfirm } from './utils.js';
import { loadNavbar } from './navbar.js';
import { applyTheme, getAvailableThemes } from './themes.js';


// --- DOM Elements ---
const loadingSpinner = document.getElementById('loading-spinner');
const formsContent = document.getElementById('forms-content');

// Forms
const contactForm = document.getElementById('contact-form');
const bugReportForm = document.getElementById('bug-report-form');
const featureRequestForm = document.getElementById('feature-request-form');


// --- Helper Functions ---

/**
 * Shows the loading spinner and hides content.
 */
function showLoading() {
  console.log("DEBUG: showLoading called. Hiding forms content.");
  if (loadingSpinner) loadingSpinner.style.display = 'flex';
  if (formsContent) formsContent.style.display = 'none';
}

/**
 * Hides the loading spinner and shows content.
 */
function hideLoading() {
  console.log("DEBUG: hideLoading called. Showing forms content.");
  if (loadingSpinner) loadingSpinner.style.display = 'none';
  if (formsContent) formsContent.style.display = 'block';
}

/**
 * Handles the submission of the Contact Us form.
 * @param {Event} event - The form submission event.
 */
async function handleContactFormSubmit(event) {
  event.preventDefault();
  showLoading();

  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to submit a contact form.", true);
    hideLoading();
    return;
  }

  const name = document.getElementById('contact-name').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const subject = document.getElementById('contact-subject').value.trim();
  const message = document.getElementById('contact-message').value.trim();

  if (!name || !email || !subject || !message) {
    showMessageBox("Please fill in all fields for the contact form.", true);
    hideLoading();
    return;
  }

  try {
    const contactData = {
      userId: user.uid,
      userName: user.displayName || name,
      userEmail: user.email || email,
      subject: subject,
      message: message,
      timestamp: new Date(),
      status: 'new'
    };

    // Store in Firestore under a 'public/data/contact_forms' collection
    const formsCollectionRef = collection(db, `artifacts/${appId}/public/data/contact_forms`);
    await addDoc(formsCollectionRef, contactData);

    showMessageBox("Contact form submitted successfully! We'll get back to you soon.", false);
    contactForm.reset(); // Clear the form
  } catch (error) {
    console.error("Error submitting contact form:", error);
    showMessageBox(`Failed to submit contact form: ${error.message}`, true);
  } finally {
    hideLoading();
  }
}

/**
 * Handles the submission of the Bug Report form.
 * @param {Event} event - The form submission event.
 */
async function handleBugReportFormSubmit(event) {
  event.preventDefault();
  showLoading();

  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to submit a bug report.", true);
    hideLoading();
    return;
  }

  const title = document.getElementById('bug-title').value.trim();
  const description = document.getElementById('bug-description').value.trim();
  const severity = document.getElementById('bug-severity').value;
  // File handling for attachments is more complex, typically involves Firebase Storage.
  // For this example, we'll just log that attachments would be handled.
  const attachments = document.getElementById('bug-attachments').files;

  if (!title || !description || !severity) {
    showMessageBox("Please fill in all required fields for the bug report.", true);
    hideLoading();
    return;
  }

  try {
    const bugData = {
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      bugTitle: title,
      bugDescription: description,
      severity: severity,
      timestamp: new Date(),
      status: 'open',
      // attachmentCount: attachments.length // Placeholder, actual upload would go here
    };

    // Store in Firestore under a 'public/data/bug_reports' collection
    const formsCollectionRef = collection(db, `artifacts/${appId}/public/data/bug_reports`);
    await addDoc(formsCollectionRef, bugData);

    showMessageBox("Bug report submitted successfully! Thank you for helping us improve.", false);
    bugReportForm.reset(); // Clear the form
  } catch (error) {
    console.error("Error submitting bug report:", error);
    showMessageBox(`Failed to submit bug report: ${error.message}`, true);
  } finally {
    hideLoading();
  }
}

/**
 * Handles the submission of the Feature Request form.
 * @param {Event} event - The form submission event.
 */
async function handleFeatureRequestFormSubmit(event) {
  event.preventDefault();
  showLoading();

  const user = auth.currentUser;
  if (!user) {
    showMessageBox("You must be logged in to submit a feature request.", true);
    hideLoading();
    return;
  }

  const title = document.getElementById('feature-title').value.trim();
  const description = document.getElementById('feature-description').value.trim();
  const category = document.getElementById('feature-category').value;

  if (!title || !description || !category) {
    showMessageBox("Please fill in all required fields for the feature request.", true);
    hideLoading();
    return;
  }

  try {
    const featureData = {
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      featureTitle: title,
      featureDescription: description,
      category: category,
      timestamp: new Date(),
      status: 'pending review'
    };

    // Store in Firestore under a 'public/data/feature_requests' collection
    const formsCollectionRef = collection(db, `artifacts/${appId}/public/data/feature_requests`);
    await addDoc(formsCollectionRef, featureData);

    showMessageBox("Feature request submitted successfully! We appreciate your ideas.", false);
    featureRequestForm.reset(); // Clear the form
  } catch (error) {
    console.error("Error submitting feature request:", error);
    showMessageBox(`Failed to submit feature request: ${error.message}`, true);
  } finally {
    hideLoading();
  }
}


// --- Main Event Listener ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log("forms.js - DOMContentLoaded event fired.");

  showLoading(); // Show loading spinner initially

  // Initialize Firebase and ensure readiness
  // This will also set up the primary onAuthStateChanged listener within firebase-init.js
  await firebaseReadyPromise; // Wait for firebase-init.js to fully initialize Firebase and authentication

  // After Firebase is ready, load the navbar.
  // The 'auth' object will be properly initialized here.
  if (auth) {
    await loadNavbar(auth.currentUser, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME);
  } else {
    console.error("ERROR: Firebase Auth not initialized, cannot load navbar with user info.");
    await loadNavbar(null, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME); // Load without user info
  }


  // Apply the user's theme once authentication state is determined and Firebase is ready.
  onAuthStateChanged(auth, async (user) => {
    let userThemePreference = null;
    if (user) {
      const userProfile = await getUserProfileFromFirestore(user.uid);
      userThemePreference = userProfile?.themePreference;
    }
    const allThemes = await getAvailableThemes();
    const themeToApply = allThemes.find(t => t.id === userThemePreference) || allThemes.find(t => t.id === DEFAULT_THEME_NAME);
    await applyTheme(themeToApply.id, userThemePreference); // Pass userProfile.themePreference directly for applyTheme

    hideLoading(); // Hide loading spinner once theme is applied and auth state is checked
  });


  // Attach form submission event listeners
  if (contactForm) {
    contactForm.addEventListener('submit', handleContactFormSubmit);
  } else {
    console.error("Contact form element not found.");
  }

  if (bugReportForm) {
    bugReportForm.addEventListener('submit', handleBugReportFormSubmit);
  } else {
    console.error("Bug report form element not found.");
  }

  if (featureRequestForm) {
    featureRequestForm.addEventListener('submit', handleFeatureRequestFormSubmit);
  } else {
    console.error("Feature request form element not found.");
  }

  // Set current year for footer
  const currentYearElement = document.getElementById('current-year-forms');
  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear().toString();
  }
  console.log("forms.js - DOMContentLoaded event listener finished.");
});
