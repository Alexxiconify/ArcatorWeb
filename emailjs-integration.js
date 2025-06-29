// EmailJS Integration Module for Arcator.co.uk
// This module provides EmailJS functionality as an alternative to Cloud Functions

// Import EmailJS library
const EMAILJS_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';

let emailjsLoaded = false;
let emailjsInitialized = false;
let credentials = null;

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
async function initializeEmailJS(publicKey) {
    if (!publicKey || publicKey === 'YOUR_PUBLIC_KEY') {
        throw new Error('Invalid EmailJS public key');
    }
    
    try {
        await loadEmailJSScript();
        emailjs.init(publicKey);
        emailjsInitialized = true;
        console.log('[EmailJS] Initialized successfully');
        return true;
    } catch (error) {
        console.error('[EmailJS] Initialization failed:', error);
        throw error;
    }
}

// Load credentials from localStorage
function loadCredentials() {
    try {
        const saved = localStorage.getItem('emailjs_credentials');
        if (saved) {
            credentials = JSON.parse(saved);
            return credentials;
        }
    } catch (error) {
        console.error('[EmailJS] Failed to load credentials:', error);
    }
    return null;
}

// Save credentials to localStorage
function saveCredentials(publicKey, serviceId, templateId) {
    if (!publicKey || !serviceId || !templateId) {
        throw new Error('All credentials are required');
    }
    
    credentials = {
        publicKey: publicKey,
        serviceId: serviceId,
        templateId: templateId,
        savedAt: new Date().toISOString()
    };
    
    localStorage.setItem('emailjs_credentials', JSON.stringify(credentials));
    return credentials;
}

// Send email using EmailJS
async function sendEmailWithEmailJS(toEmail, subject, message, options = {}) {
    if (!emailjsInitialized) {
        // Try to initialize with saved credentials
        const savedCreds = loadCredentials();
        if (savedCreds) {
            await initializeEmailJS(savedCreds.publicKey);
        } else {
            throw new Error('EmailJS not initialized. Please configure credentials first.');
        }
    }
    
    if (!credentials) {
        throw new Error('EmailJS credentials not found');
    }
    
    const templateParams = {
        to_email: toEmail,
        subject: subject,
        message: message,
        from_name: options.fromName || 'Arcator.co.uk',
        from_email: options.fromEmail || 'noreply@arcator-web.firebaseapp.com',
        reply_to: options.replyTo || 'noreply@arcator-web.firebaseapp.com'
    };
    
    try {
        const response = await emailjs.send(
            credentials.serviceId,
            credentials.templateId,
            templateParams
        );
        
        console.log('[EmailJS] Email sent successfully:', response);
        return {
            success: true,
            messageId: response.text,
            status: 'sent'
        };
    } catch (error) {
        console.error('[EmailJS] Email sending failed:', error);
        throw new Error(`Email sending failed: ${error.text || error.message}`);
    }
}

// Send multiple emails
async function sendBulkEmails(emails) {
    if (!Array.isArray(emails) || emails.length === 0) {
        throw new Error('No emails provided');
    }
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const email of emails) {
        try {
            const result = await sendEmailWithEmailJS(
                email.to,
                email.subject,
                email.message,
                email.options
            );
            results.push({ ...result, email: email.to });
            successCount++;
        } catch (error) {
            results.push({
                success: false,
                error: error.message,
                email: email.to
            });
            errorCount++;
        }
    }
    
    return {
        results,
        summary: {
            total: emails.length,
            success: successCount,
            failed: errorCount
        }
    };
}

// Test EmailJS connection
async function testEmailJSConnection() {
    try {
        const savedCreds = loadCredentials();
        if (!savedCreds) {
            return {
                success: false,
                error: 'No credentials found'
            };
        }
        
        await initializeEmailJS(savedCreds.publicKey);
        
        return {
            success: true,
            message: 'EmailJS connection successful',
            credentials: {
                hasPublicKey: !!savedCreds.publicKey,
                hasServiceId: !!savedCreds.serviceId,
                hasTemplateId: !!savedCreds.templateId
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Get EmailJS status
function getEmailJSStatus() {
    return {
        scriptLoaded: emailjsLoaded,
        initialized: emailjsInitialized,
        hasCredentials: !!credentials,
        credentials: credentials ? {
            hasPublicKey: !!credentials.publicKey,
            hasServiceId: !!credentials.serviceId,
            hasTemplateId: !!credentials.templateId,
            savedAt: credentials.savedAt
        } : null
    };
}

// Clear EmailJS credentials
function clearCredentials() {
    localStorage.removeItem('emailjs_credentials');
    credentials = null;
    emailjsInitialized = false;
    console.log('[EmailJS] Credentials cleared');
}

// Export the EmailJS integration functions
export const EmailJSIntegration = {
    // Core functions
    initialize: initializeEmailJS,
    sendEmail: sendEmailWithEmailJS,
    sendBulkEmails: sendBulkEmails,
    
    // Credential management
    loadCredentials: loadCredentials,
    saveCredentials: saveCredentials,
    clearCredentials: clearCredentials,
    
    // Status and testing
    getStatus: getEmailJSStatus,
    testConnection: testEmailJSConnection,
    
    // Utility functions
    loadScript: loadEmailJSScript
};

// Auto-initialize if credentials are available
document.addEventListener('DOMContentLoaded', async () => {
    const savedCreds = loadCredentials();
    if (savedCreds && savedCreds.publicKey) {
        try {
            await initializeEmailJS(savedCreds.publicKey);
            console.log('[EmailJS] Auto-initialized with saved credentials');
        } catch (error) {
            console.warn('[EmailJS] Auto-initialization failed:', error);
        }
    }
});

// Make available globally for backward compatibility
window.EmailJSIntegration = EmailJSIntegration; 