// SMTP Integration Module for Arcator.co.uk
// This module provides client-side integration with the local SMTP server

const SMTP_SERVER_URL = 'http://localhost:3001'; // Your SMTP server URL

let smtpServerConnected = false;

// Test SMTP server connection
async function testSMTPServerConnection() {
  try {
    const response = await fetch(`${SMTP_SERVER_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      smtpServerConnected = data.smtp === 'connected';
      return {
        success: smtpServerConnected,
        status: data.smtp,
        message: smtpServerConnected ? 'SMTP server connected' : 'SMTP server disconnected'
      };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('[SMTP] Connection test failed:', error);
    return {
      success: false,
      error: error.message,
      message: 'SMTP server unreachable'
    };
  }
}

// Send email via SMTP server
async function sendEmailViaSMTP(emailData) {
  if (!smtpServerConnected) {
    const connectionTest = await testSMTPServerConnection();
    if (!connectionTest.success) {
      throw new Error('SMTP server not connected');
    }
  }

  try {
    const response = await fetch(`${SMTP_SERVER_URL}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('[SMTP] Email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('[SMTP] Email sending failed:', error);
    throw error;
  }
}

// Send bulk emails via SMTP server
async function sendBulkEmailsViaSMTP(emails) {
  if (!smtpServerConnected) {
    const connectionTest = await testSMTPServerConnection();
    if (!connectionTest.success) {
      throw new Error('SMTP server not connected');
    }
  }

  try {
    const response = await fetch(`${SMTP_SERVER_URL}/send-bulk-emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emails })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('[SMTP] Bulk emails sent:', result);
    return result;
  } catch (error) {
    console.error('[SMTP] Bulk email sending failed:', error);
    throw error;
  }
}

// Get SMTP server status
function getSMTPServerStatus() {
  return {
    connected: smtpServerConnected,
    serverUrl: SMTP_SERVER_URL,
    ready: smtpServerConnected
  };
}

// Initialize SMTP integration
async function initializeSMTPIntegration() {
  try {
    const connectionTest = await testSMTPServerConnection();
    if (connectionTest.success) {
      console.log('[SMTP] Integration initialized successfully');
      return { success: true, message: 'SMTP server connected' };
    } else {
      console.warn('[SMTP] Integration failed:', connectionTest.message);
      return { success: false, error: connectionTest.message };
    }
  } catch (error) {
    console.error('[SMTP] Integration error:', error);
    return { success: false, error: error.message };
  }
}

// Export functions for use in other modules
export {
  testSMTPServerConnection,
  sendEmailViaSMTP,
  sendBulkEmailsViaSMTP,
  getSMTPServerStatus,
  initializeSMTPIntegration
}; 