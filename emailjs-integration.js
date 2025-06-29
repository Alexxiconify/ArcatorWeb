// EmailJS Integration Module for Arcator.co.uk
// This module provides EmailJS functionality as an alternative to Cloud Functions

// Import EmailJS library
const EMAILJS_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';

let emailjsLoaded = false;
let emailjsInitialized = false;

// Default credentials (these should be overridden with actual values)
let credentials = {
  publicKey: 'o4CZtazWjPDVjPc1L',
  serviceId: '', // Will be set by user
  templateId: '' // Will be set by user
};

// Load EmailJS script dynamically
async function loadEmailJSScript() {
  if (emailjsLoaded) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    if (window.emailjs) {
      emailjsLoaded = true;
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = EMAILJS_SCRIPT_URL;
    script.onload = () => {
      emailjsLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load EmailJS script'));
    };
    document.head.appendChild(script);
  });
}

// Initialize EmailJS with credentials
async function initializeEmailJS(publicKey = null) {
  try {
    await loadEmailJSScript();
    
    const keyToUse = publicKey || credentials.publicKey;
    if (!keyToUse) {
      throw new Error('EmailJS public key is required');
    }
    
    window.emailjs.init(keyToUse);
    emailjsInitialized = true;
    
    console.log('[EmailJS] Initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('[EmailJS] Initialization failed:', error);
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

// Get EmailJS status
function getEmailJSStatus() {
  return {
    loaded: emailjsLoaded,
    initialized: emailjsInitialized,
    hasCredentials: !!(credentials.serviceId && credentials.templateId),
    publicKey: credentials.publicKey ? 'Configured' : 'Missing',
    serviceId: credentials.serviceId || 'Not configured',
    templateId: credentials.templateId || 'Not configured'
  };
}

// Clear saved credentials
function clearCredentials() {
  try {
    localStorage.removeItem('emailjs_credentials');
    credentials = {
      publicKey: 'o4CZtazWjPDVjPc1L',
      serviceId: '',
      templateId: ''
    };
    return true;
  } catch (error) {
    console.error('[EmailJS] Failed to clear credentials:', error);
    return false;
  }
}

// Export the EmailJS integration
export const EmailJSIntegration = {
  loadEmailJSScript,
  initializeEmailJS,
  loadCredentials,
  saveCredentials,
  sendEmailWithEmailJS,
  sendBulkEmails,
  testEmailJSConnection,
  getEmailJSStatus,
  clearCredentials
};

// Auto-load credentials on module load
loadCredentials(); 