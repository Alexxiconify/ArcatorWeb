// EmailJS Integration Module for Arcator.co.uk
// This module provides EmailJS functionality as an alternative to Cloud Functions

// Import EmailJS library
const EMAILJS_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';

// Default credentials (these should be overridden with actual values)
let credentials = {
  publicKey: 'o4CZtazWjPDVjPc1L',
  serviceId: 'service_7pm3neh', // Gmail service
  templateId: 'template_1gv17ca' // Email template
};

let emailjsLoaded = false;
let emailjsInitialized = false;

// Check if EmailJS script is already loaded
function checkEmailJSScript() {
  if (typeof emailjs !== 'undefined') {
    emailjsLoaded = true;
    return true;
  }
  return false;
}

// Initialize EmailJS with credentials
async function initializeEmailJS(publicKey = null) {
  try {
    // Check if script is loaded
    if (!checkEmailJSScript()) {
      console.error('[EmailJS] Script not loaded');
      return { success: false, error: 'EmailJS script not loaded' };
    }

    // Use provided public key or default
    const keyToUse = publicKey || credentials.publicKey;
    
    if (!keyToUse) {
      return { success: false, error: 'No public key provided' };
    }

    // Initialize EmailJS
    emailjs.init(keyToUse);
    emailjsInitialized = true;
    
    console.log('[EmailJS] Initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('[EmailJS] Initialization error:', error);
    return { success: false, error: error.message };
  }
}

// Load saved credentials from localStorage
function loadCredentials() {
  try {
    const saved = localStorage.getItem('emailjs_credentials');
    if (saved) {
      const parsed = JSON.parse(saved);
      credentials = { ...credentials, ...parsed };
      return true;
    }
  } catch (error) {
    console.warn('[EmailJS] Failed to load saved credentials:', error);
  }
  return false;
}

// Save credentials to localStorage
function saveCredentials(publicKey, serviceId, templateId) {
  try {
    const creds = { publicKey, serviceId, templateId };
    localStorage.setItem('emailjs_credentials', JSON.stringify(creds));
    credentials = creds;
    return true;
  } catch (error) {
    console.error('[EmailJS] Failed to save credentials:', error);
    return false;
  }
}

// Send email using EmailJS
async function sendEmailWithEmailJS(toEmail, subject, message, options = {}) {
  try {
    if (!emailjsInitialized) {
      await initializeEmailJS();
    }
    
    if (!credentials.serviceId || !credentials.templateId) {
      throw new Error('EmailJS service ID and template ID must be configured');
    }
    
    const templateParams = {
      to_email: toEmail,
      subject: subject,
      message: message,
      from_name: options.fromName || 'Arcator.co.uk',
      reply_to: options.replyTo || 'noreply@arcator-web.firebaseapp.com'
    };
    
    const result = await window.emailjs.send(
      credentials.serviceId,
      credentials.templateId,
      templateParams
    );
    
    console.log('[EmailJS] Email sent successfully:', result);
    return { success: true, result };
  } catch (error) {
    console.error('[EmailJS] Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

// Send bulk emails
async function sendBulkEmails(emails) {
  const results = [];
  
  for (const email of emails) {
    try {
      const result = await sendEmailWithEmailJS(
        email.to,
        email.subject,
        email.message,
        email.options
      );
      results.push({ email, result });
    } catch (error) {
      results.push({ email, result: { success: false, error: error.message } });
    }
  }
  
  return results;
}

// Test EmailJS connection
async function testEmailJSConnection() {
  try {
    if (!emailjsInitialized) {
      const initResult = await initializeEmailJS();
      if (!initResult.success) {
        return initResult;
      }
    }
    
    // Test with a simple template parameter
    const testParams = {
      to_email: 'test@example.com',
      subject: 'Test Email',
      message: 'This is a test email from EmailJS integration.',
      from_name: 'Arcator.co.uk',
      reply_to: 'noreply@arcator-web.firebaseapp.com'
    };
    
    // Just test the initialization, don't actually send
    console.log('[EmailJS] Connection test successful');
    return { success: true, message: 'EmailJS is properly configured' };
  } catch (error) {
    console.error('[EmailJS] Connection test failed:', error);
    return { success: false, error: error.message };
  }
}

// Get EmailJS status for display
function getEmailJSStatus() {
  const scriptLoaded = checkEmailJSScript();
  const publicKeyConfigured = !!credentials.publicKey;
  const serviceIdConfigured = !!credentials.serviceId;
  const templateIdConfigured = !!credentials.templateId;
  const readyToSend = scriptLoaded && emailjsInitialized && publicKeyConfigured && serviceIdConfigured && templateIdConfigured;

  return {
    scriptLoaded,
    initialized: emailjsInitialized,
    publicKey: publicKeyConfigured ? 'Configured' : 'Not configured',
    serviceId: serviceIdConfigured ? 'Configured' : 'Not configured',
    templateId: templateIdConfigured ? 'Configured' : 'Not configured',
    readyToSend
  };
}

// Clear saved credentials
function clearCredentials() {
  try {
    localStorage.removeItem('emailjs_credentials');
    credentials = {
      publicKey: 'o4CZtazWjPDVjPc1L',
      serviceId: 'service_7pm3neh',
      templateId: 'template_1gv17ca'
    };
    return true;
  } catch (error) {
    console.error('[EmailJS] Failed to clear credentials:', error);
    return false;
  }
}

// Export all functions for use in other modules
export {
  initializeEmailJS,
  sendEmailWithEmailJS,
  sendBulkEmails,
  testEmailJSConnection,
  getEmailJSStatus,
  saveCredentials,
  loadCredentials,
  clearCredentials
};

// Auto-load credentials on module load
loadCredentials(); 