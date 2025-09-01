// email-integration.js: Consolidated email functionality
import { showMessageBox } from "./utils.js";

// ============================================================================
// EMAILJS INTEGRATION
// ============================================================================

let emailJSInitialized = false;
let emailJSPublicKey = null;
let emailJSServiceId = null;
let emailJSTemplateId = null;

/**
 * Checks if EmailJS script is loaded.
 * @returns {boolean} - Whether EmailJS is available.
 */
function checkEmailJSScript() {
  return typeof emailjs !== 'undefined';
}

/**
 * Initializes EmailJS.
 * @param {string} publicKey - The EmailJS public key.
 * @returns {Promise<Object>} - Initialization result.
 */
export async function initializeEmailJS(publicKey = null) {
  try {
    if (!checkEmailJSScript()) {
      return { success: false, error: "EmailJS script not loaded" };
    }

    const key = publicKey || loadCredentials().publicKey;
    if (!key || key === "YOUR_EMAILJS_PUBLIC_KEY") {
      return { success: false, error: "EmailJS public key not configured" };
    }

    emailjs.init(key);
    emailJSInitialized = true;
    emailJSPublicKey = key;
    
    return { success: true };
  } catch (error) {
    console.error("EmailJS initialization error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Loads EmailJS credentials from localStorage.
 * @returns {Object} - The credentials object.
 */
function loadCredentials() {
  try {
    const stored = localStorage.getItem('emailjs_credentials');
    return stored ? JSON.parse(stored) : {
      publicKey: null,
      serviceId: null,
      templateId: null
    };
  } catch (error) {
    console.warn("Failed to load EmailJS credentials:", error);
    return {
      publicKey: null,
      serviceId: null,
      templateId: null
    };
  }
}

/**
 * Saves EmailJS credentials to localStorage.
 * @param {string} publicKey - The public key.
 * @param {string} serviceId - The service ID.
 * @param {string} templateId - The template ID.
 */
export function saveCredentials(publicKey, serviceId, templateId) {
  try {
    const credentials = { publicKey, serviceId, templateId };
    localStorage.setItem('emailjs_credentials', JSON.stringify(credentials));
    emailJSPublicKey = publicKey;
    emailJSServiceId = serviceId;
    emailJSTemplateId = templateId;
  } catch (error) {
    console.warn("Failed to save EmailJS credentials:", error);
  }
}

/**
 * Sends email using EmailJS.
 * @param {string} toEmail - The recipient email.
 * @param {string} subject - The email subject.
 * @param {string} message - The email message.
 * @param {Object} options - Additional options.
 * @returns {Promise<Object>} - Send result.
 */
export async function sendEmailWithEmailJS(toEmail, subject, message, options = {}) {
  try {
    if (!emailJSInitialized) {
      const initResult = await initializeEmailJS();
      if (!initResult.success) {
        return { success: false, error: initResult.error };
      }
    }

    const credentials = loadCredentials();
    const serviceId = options.serviceId || credentials.serviceId || "service_7pm3neh";
    const templateId = options.templateId || credentials.templateId || "template_1gv17ca";

    const templateParams = {
      to_email: toEmail,
      subject: subject,
      message: message,
      from_name: options.fromName || "Arcator.co.uk",
      reply_to: options.replyTo || "noreply@arcator-web.firebaseapp.com",
    };

    const result = await emailjs.send(serviceId, templateId, templateParams);
    return { success: true, messageId: result.text };
  } catch (error) {
    console.error("EmailJS send error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends email using EmailJS template.
 * @param {string} toEmail - The recipient email.
 * @param {string} subject - The email subject.
 * @param {string} message - The email message.
 * @param {string} templateType - The template type.
 * @param {Object} options - Additional options.
 * @returns {Promise<Object>} - Send result.
 */
export async function sendEmailWithTemplate(
  toEmail,
  subject,
  message,
  templateType = "default",
  options = {}
) {
  try {
    if (!emailJSInitialized) {
      const initResult = await initializeEmailJS();
      if (!initResult.success) {
        return { success: false, error: initResult.error };
      }
    }

    const credentials = loadCredentials();
    const serviceId = credentials.serviceId || "service_7pm3neh";
    const templateId = credentials.templateId || "template_1gv17ca";

    const templateParams = {
      to_email: toEmail,
      subject: subject,
      message: message,
      from_name: options.fromName || "Arcator.co.uk",
      reply_to: options.replyTo || "noreply@arcator-web.firebaseapp.com",
      template_type: templateType,
    };

    const result = await emailjs.send(serviceId, templateId, templateParams);
    return { success: true, messageId: result.text, templateUsed: templateType };
  } catch (error) {
    console.error("EmailJS template send error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Tests EmailJS connection.
 * @returns {Promise<Object>} - Test result.
 */
export async function testEmailJSConnection() {
  try {
    if (!checkEmailJSScript()) {
      return { success: false, error: "EmailJS script not loaded" };
    }

    const credentials = loadCredentials();
    if (!credentials.publicKey || credentials.publicKey === "YOUR_EMAILJS_PUBLIC_KEY") {
      return { success: false, error: "EmailJS not configured" };
    }

    const initResult = await initializeEmailJS();
    if (!initResult.success) {
      return { success: false, error: initResult.error };
    }

    return { success: true, message: "EmailJS connection successful" };
  } catch (error) {
    console.error("EmailJS connection test error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets EmailJS status.
 * @returns {Object} - Status information.
 */
export function getEmailJSStatus() {
  const credentials = loadCredentials();
  return {
    scriptLoaded: checkEmailJSScript(),
    initialized: emailJSInitialized,
    publicKey: credentials.publicKey,
    serviceId: credentials.serviceId,
    templateId: credentials.templateId,
    readyToSend: emailJSInitialized && credentials.publicKey && credentials.serviceId && credentials.templateId,
  };
}

/**
 * Clears EmailJS credentials.
 */
export function clearCredentials() {
  try {
    localStorage.removeItem('emailjs_credentials');
    emailJSInitialized = false;
    emailJSPublicKey = null;
    emailJSServiceId = null;
    emailJSTemplateId = null;
  } catch (error) {
    console.warn("Failed to clear EmailJS credentials:", error);
  }
}

// ============================================================================
// SMTP INTEGRATION
// ============================================================================

let smtpConnected = false;
let smtpReady = false;

/**
 * Sends email via SMTP.
 * @param {Object} emailData - The email data.
 * @returns {Promise<Object>} - Send result.
 */
export function sendEmailViaSMTP(emailData) {
  // SMTP integration placeholder - would require backend implementation
  console.warn("SMTP integration not implemented");
  return Promise.resolve({ 
    success: false, 
    error: "SMTP integration not implemented" 
  });
}

/**
 * Tests SMTP server connection.
 * @returns {Promise<Object>} - Test result.
 */
export function testSMTPServerConnection() {
  // SMTP test placeholder
  return Promise.resolve({ 
    success: false, 
    error: "SMTP integration not implemented" 
  });
}

/**
 * Gets SMTP server status.
 * @returns {Object} - Status information.
 */
export function getSMTPServerStatus() {
  return {
    connected: smtpConnected,
    ready: smtpReady,
  };
}

/**
 * Initializes SMTP integration.
 * @returns {Promise<Object>} - Initialization result.
 */
export function initializeSMTPIntegration() {
  // SMTP initialization placeholder
  return Promise.resolve({ 
    success: true, 
    message: "SMTP integration not implemented" 
  });
}

// ============================================================================
// UNIFIED EMAIL FUNCTIONS
// ============================================================================

/**
 * Sends email using the best available method.
 * @param {string} toEmail - The recipient email.
 * @param {string} subject - The email subject.
 * @param {string} message - The email message.
 * @param {Object} options - Additional options.
 * @returns {Promise<Object>} - Send result.
 */
export async function sendEmail(toEmail, subject, message, options = {}) {
  // Try EmailJS first
  const emailjsStatus = getEmailJSStatus();
  if (emailjsStatus.readyToSend) {
    return await sendEmailWithEmailJS(toEmail, subject, message, options);
  }

  // Fallback to SMTP
  const smtpStatus = getSMTPServerStatus();
  if (smtpStatus.connected) {
    return await sendEmailViaSMTP({
      to: toEmail,
      subject: subject,
      content: message,
      isHtml: false,
      from: options.from || "noreply@arcator.co.uk",
    });
  }

  return { 
    success: false, 
    error: "No email service available" 
  };
}

/**
 * Tests email service connection.
 * @returns {Promise<Object>} - Test result.
 */
export async function testEmailConnection() {
  // Try EmailJS first
  const emailjsResult = await testEmailJSConnection();
  if (emailjsResult.success) {
    return { success: true, method: "EmailJS", message: "EmailJS connection successful" };
  }

  // Try SMTP
  const smtpResult = await testSMTPServerConnection();
  if (smtpResult.success) {
    return { success: true, method: "SMTP", message: "SMTP connection successful" };
  }

  return { 
    success: false, 
    error: "No email service available" 
  };
}

/**
 * Gets overall email service status.
 * @returns {Object} - Status information.
 */
export function getEmailServiceStatus() {
  const emailjsStatus = getEmailJSStatus();
  const smtpStatus = getSMTPServerStatus();
  
  return {
    emailjs: emailjsStatus,
    smtp: smtpStatus,
    hasService: emailjsStatus.readyToSend || smtpStatus.connected,
    preferredMethod: emailjsStatus.readyToSend ? "EmailJS" : "SMTP",
  };
} 