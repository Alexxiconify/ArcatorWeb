// SMTP Integration via Firebase Cloud Functions
// This module handles email sending through Firebase Cloud Functions that connect to the SMTP server

import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, appId, app } from "./firebase-init.js";

// Firebase Cloud Functions base URL (will be replaced with actual URL after deployment)
let FIREBASE_FUNCTIONS_BASE_URL = null;

// Initialize Firebase Functions URL
async function initializeFirebaseFunctionsURL() {
  try {
    // Get the current Firebase project ID
    const projectId = app.options.projectId;
    FIREBASE_FUNCTIONS_BASE_URL = `https://us-central1-${projectId}.cloudfunctions.net`;
    console.log(
      "[SMTP] Firebase Functions URL initialized:",
      FIREBASE_FUNCTIONS_BASE_URL,
    );
    return true;
  } catch (error) {
    console.error("[SMTP] Error initializing Firebase Functions URL:", error);
    return false;
  }
}

// Test SMTP server connection via Firebase Cloud Functions
async function testSMTPServerConnection() {
  try {
    if (!FIREBASE_FUNCTIONS_BASE_URL) {
      await initializeFirebaseFunctionsURL();
    }

    const response = await fetch(
      `${FIREBASE_FUNCTIONS_BASE_URL}/getSMTPStatus`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        message: "SMTP server is healthy and ready",
        status: result.status,
      };
    } else {
      return {
        success: false,
        message: result.error || "SMTP server health check failed",
      };
    }
  } catch (error) {
    console.error("[SMTP] Connection test error:", error);
    return {
      success: false,
      message: `Connection error: ${error.message}`,
    };
  }
}

// Send email via Firebase Cloud Functions
async function sendEmailViaSMTP(emailData) {
  try {
    if (!FIREBASE_FUNCTIONS_BASE_URL) {
      await initializeFirebaseFunctionsURL();
    }

    // Add email to Firestore to trigger the Cloud Function
    const emailHistoryRef = collection(
      db,
      `artifacts/${appId}/public/data/email_history`,
    );

    const emailDoc = {
      to: emailData.to,
      from: emailData.from || "no-reply.aractor@gmail.com",
      subject: emailData.subject,
      content: emailData.content || emailData.html || emailData.text || "",
      isHtml: !!emailData.isHtml || !!emailData.html,
      status: "pending",
      method: "smtp",
      createdAt: serverTimestamp(),
      completedAt: null,
      errorMessage: null,
    };

    const docRef = await addDoc(emailHistoryRef, emailDoc);

    console.log(
      "[SMTP] Email queued for sending via Firebase Cloud Functions:",
      docRef.id,
    );

    return {
      success: true,
      messageId: docRef.id,
      message: "Email queued for sending via SMTP server",
    };
  } catch (error) {
    console.error("[SMTP] Error sending email:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Send bulk emails via Firebase Cloud Functions
async function sendBulkEmailsViaSMTP(emails) {
  try {
    if (!FIREBASE_FUNCTIONS_BASE_URL) {
      await initializeFirebaseFunctionsURL();
    }

    const response = await fetch(
      `${FIREBASE_FUNCTIONS_BASE_URL}/sendBulkEmails`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emails }),
      },
    );

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        message: "Bulk emails sent successfully via SMTP server",
        result: result.result,
      };
    } else {
      return {
        success: false,
        error: result.error || "Failed to send bulk emails",
      };
    }
  } catch (error) {
    console.error("[SMTP] Bulk email error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Get SMTP server status
function getSMTPServerStatus() {
  return {
    connected: FIREBASE_FUNCTIONS_BASE_URL !== null,
    ready: FIREBASE_FUNCTIONS_BASE_URL !== null,
  };
}

// Initialize SMTP integration
async function initializeSMTPIntegration() {
  try {
    const initialized = await initializeFirebaseFunctionsURL();
    if (initialized) {
      console.log("[SMTP] Integration initialized successfully");
      return { success: true };
    } else {
      return {
        success: false,
        error: "Failed to initialize Firebase Functions URL",
      };
    }
  } catch (error) {
    console.error("[SMTP] Initialization error:", error);
    return { success: false, error: error.message };
  }
}

// Export functions
export {
  testSMTPServerConnection,
  sendEmailViaSMTP,
  sendBulkEmailsViaSMTP,
  getSMTPServerStatus,
  initializeSMTPIntegration,
};
