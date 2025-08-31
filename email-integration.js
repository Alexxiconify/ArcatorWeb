// email-integration.js: Unified email integration system

// ============================================================================
// EMAILJS INTEGRATION
// ============================================================================

let emailjsInitialized = false;
let emailjsPublicKey = null;
let emailjsServiceId = null;
let emailjsTemplateId = null;

/**
 * Check if EmailJS script is loaded
 */
function checkEmailJSScript() {
    return typeof window.emailjs !== 'undefined';
}

/**
 * Initialize EmailJS
 */
export async function initializeEmailJS(publicKey = null) {
  try {
    if (!checkEmailJSScript()) {
      return { success: false, error: "EmailJS script not loaded" };
    }

      const credentials = loadCredentials();
      if (publicKey) {
          emailjsPublicKey = publicKey;
      } else if (credentials.publicKey) {
          emailjsPublicKey = credentials.publicKey;
      } else {
          return {success: false, error: "No EmailJS public key provided"};
    }

      window.emailjs.init(emailjsPublicKey);
      emailjsServiceId = credentials.serviceId || "service_7pm3neh";
      emailjsTemplateId = credentials.templateId || "template_1gv17ca";
      emailjsInitialized = true;

    return { success: true };
  } catch (error) {
      console.error("EmailJS initialization failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Load saved credentials
 */
function loadCredentials() {
  try {
      const saved = localStorage.getItem('emailjs_credentials');
      return saved ? JSON.parse(saved) : {};
  } catch {
      return {};
  }
}

/**
 * Save credentials
 */
export function saveCredentials(publicKey, serviceId, templateId) {
  try {
    const credentials = { publicKey, serviceId, templateId };
    localStorage.setItem('emailjs_credentials', JSON.stringify(credentials));
      emailjsPublicKey = publicKey;
      emailjsServiceId = serviceId;
      emailjsTemplateId = templateId;
      return true;
  } catch (error) {
      console.error("Failed to save credentials:", error);
      return false;
  }
}

/**
 * Send email via EmailJS
 */
export async function sendEmailWithEmailJS(toEmail, subject, message, options = {}) {
  try {
      if (!emailjsInitialized) {
      const initResult = await initializeEmailJS();
      if (!initResult.success) {
          throw new Error(initResult.error);
      }
    }

    const templateParams = {
      to_email: toEmail,
      subject: subject,
      message: message,
      from_name: options.fromName || "Arcator.co.uk",
        reply_to: options.replyTo || "noreply@arcator-web.firebaseapp.com"
    };

      const result = await window.emailjs.send(
          emailjsServiceId,
          emailjsTemplateId,
          templateParams
      );

    return { success: true, messageId: result.text };
  } catch (error) {
      console.error("EmailJS send failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send email with template
 */
export async function sendEmailWithTemplate(
  toEmail,
  subject,
  message,
  templateType = "default",
  options = {}
) {
  try {
      if (!emailjsInitialized) {
      const initResult = await initializeEmailJS();
      if (!initResult.success) {
          throw new Error(initResult.error);
      }
    }

      // Template-specific parameters
    const templateParams = {
      to_email: toEmail,
      subject: subject,
      message: message,
      from_name: options.fromName || "Arcator.co.uk",
        reply_to: options.replyTo || "noreply@arcator-web.firebaseapp.com"
    };

      // Add template-specific customizations
      if (templateType === "announcement") {
          templateParams.template_type = "announcement";
      } else if (templateType === "newsletter") {
          templateParams.template_type = "newsletter";
      }

      const result = await window.emailjs.send(
          emailjsServiceId,
          emailjsTemplateId,
          templateParams
      );

    return { success: true, messageId: result.text, templateUsed: templateType };
  } catch (error) {
      console.error("EmailJS template send failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Test EmailJS connection
 */
export async function testEmailJSConnection() {
  try {
      if (!emailjsInitialized) {
          const initResult = await initializeEmailJS();
          if (!initResult.success) {
              return {success: false, error: initResult.error};
          }
    }

      // Send test email
      const testResult = await sendEmailWithEmailJS(
          "test@example.com",
          "Test Email",
          "This is a test email from Arcator.co.uk",
          {fromName: "Test System"}
      );

      return testResult;
  } catch (error) {
      console.error("EmailJS connection test failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get EmailJS status
 */
export function getEmailJSStatus() {
  return {
    scriptLoaded: checkEmailJSScript(),
      initialized: emailjsInitialized,
      publicKey: emailjsPublicKey,
      serviceId: emailjsServiceId,
      templateId: emailjsTemplateId,
      readyToSend: emailjsInitialized && emailjsPublicKey && emailjsServiceId && emailjsTemplateId
  };
}

/**
 * Clear credentials
 */
export function clearCredentials() {
  try {
    localStorage.removeItem('emailjs_credentials');
      emailjsPublicKey = null;
      emailjsServiceId = null;
      emailjsTemplateId = null;
      emailjsInitialized = false;
      return true;
  } catch (error) {
      console.error("Failed to clear credentials:", error);
      return false;
  }
}

// ============================================================================
// SMTP INTEGRATION (PLACEHOLDER)
// ============================================================================

let smtpConnected = false;
let smtpReady = false;

/**
 * Send email via SMTP (placeholder)
 */
export function sendEmailViaSMTP(emailData) {
  console.warn("SMTP integration not implemented");
    return Promise.resolve({
        success: false,
        error: "SMTP integration not implemented"
  });
}

/**
 * Test SMTP connection (placeholder)
 */
export function testSMTPServerConnection() {
    console.warn("SMTP integration not implemented");
    return Promise.resolve({
        success: false,
        error: "SMTP integration not implemented"
  });
}

/**
 * Get SMTP status
 */
export function getSMTPServerStatus() {
  return {
    connected: smtpConnected,
      ready: smtpReady
  };
}

/**
 * Initialize SMTP integration (placeholder)
 */
export function initializeSMTPIntegration() {
    console.warn("SMTP integration not implemented");
    return Promise.resolve({
        success: false,
        error: "SMTP integration not implemented"
  });
}

// ============================================================================
// UNIFIED EMAIL FUNCTIONS
// ============================================================================

/**
 * Send email using best available method
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
 * Test email connection
 */
export async function testEmailConnection() {
  // Try EmailJS first
  const emailjsResult = await testEmailJSConnection();
  if (emailjsResult.success) {
      return {success: true, method: "EmailJS"};
  }

  // Try SMTP
  const smtpResult = await testSMTPServerConnection();
  if (smtpResult.success) {
      return {success: true, method: "SMTP"};
  }

    return {
        success: false,
        error: "No email service available"
  };
}

/**
 * Get overall email service status
 */
export function getEmailServiceStatus() {
  const emailjsStatus = getEmailJSStatus();
  const smtpStatus = getSMTPServerStatus();

  return {
    emailjs: emailjsStatus,
    smtp: smtpStatus,
      hasService: emailjsStatus.readyToSend || smtpStatus.connected
  };
}