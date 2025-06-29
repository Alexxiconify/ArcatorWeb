// SMTP Server for Arcator.co.uk
// This provides a local email server for sending emails from the website

const nodemailer = require('nodemailer');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const SMTP_CONFIG = {
  host: 'localhost', // Your server's IP or domain
  port: 587, // Standard SMTP port
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'noreply@arcator.co.uk', // Your email username
    pass: 'your-secure-password' // Your email password
  },
  tls: {
    rejectUnauthorized: false // For self-signed certificates
  }
};

// Email templates
const EMAIL_TEMPLATES = {
  welcome: {
    subject: 'Welcome to Arcator.co.uk!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Welcome to Arcator.co.uk!</h2>
        <p>Hello {{name}},</p>
        <p>Welcome to our community! We're excited to have you join us.</p>
        <p>Here are some things you can do to get started:</p>
        <ul>
          <li>Join our Discord server</li>
          <li>Check out our Minecraft servers</li>
          <li>Explore our community forums</li>
        </ul>
        <p>Best regards,<br>The Arcator Team</p>
      </div>
    `
  },
  announcement: {
    subject: 'Arcator.co.uk - {{subject}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Arcator.co.uk Announcement</h2>
        <p>{{content}}</p>
        <p>Best regards,<br>The Arcator Team</p>
      </div>
    `
  },
  maintenance: {
    subject: 'Arcator.co.uk - Maintenance Notice',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #F59E0B;">Maintenance Notice</h2>
        <p>{{content}}</p>
        <p>We apologize for any inconvenience.</p>
        <p>Best regards,<br>The Arcator Team</p>
      </div>
    `
  },
  event: {
    subject: 'Arcator.co.uk - Event Invitation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">Event Invitation</h2>
        <p>{{content}}</p>
        <p>We hope to see you there!</p>
        <p>Best regards,<br>The Arcator Team</p>
      </div>
    `
  }
};

// Create transporter
let transporter = null;

async function initializeTransporter() {
  try {
    transporter = nodemailer.createTransporter(SMTP_CONFIG);
    
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP server connection verified');
    
    return true;
  } catch (error) {
    console.error('❌ SMTP server connection failed:', error);
    return false;
  }
}

// Email sending function
async function sendEmail(emailData) {
  if (!transporter) {
    throw new Error('SMTP transporter not initialized');
  }

  const {
    to,
    subject,
    content,
    template = 'custom',
    isHtml = false,
    from = 'noreply@arcator.co.uk'
  } = emailData;

  try {
    let emailSubject = subject;
    let emailContent = content;

    // Apply template if specified
    if (template !== 'custom' && EMAIL_TEMPLATES[template]) {
      const templateData = EMAIL_TEMPLATES[template];
      emailSubject = templateData.subject.replace('{{subject}}', subject);
      emailContent = templateData.html
        .replace('{{content}}', content)
        .replace('{{name}}', to.split('@')[0]); // Simple name extraction
    }

    const mailOptions = {
      from: from,
      to: to,
      subject: emailSubject,
      text: isHtml ? null : emailContent,
      html: isHtml ? emailContent : null
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', result.messageId);
    
    return {
      success: true,
      messageId: result.messageId,
      response: result.response
    };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw error;
  }
}

// Bulk email sending
async function sendBulkEmails(emails) {
  const results = [];
  
  for (const email of emails) {
    try {
      const result = await sendEmail(email);
      results.push({ ...result, email: email.to });
    } catch (error) {
      results.push({ 
        success: false, 
        error: error.message, 
        email: email.to 
      });
    }
  }
  
  return results;
}

// Express server setup
const app = express();
const PORT = process.env.SMTP_PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    smtp: transporter ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Send single email endpoint
app.post('/send-email', async (req, res) => {
  try {
    const result = await sendEmail(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Send bulk emails endpoint
app.post('/send-bulk-emails', async (req, res) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails)) {
      return res.status(400).json({ 
        success: false, 
        error: 'emails must be an array' 
      });
    }
    
    const results = await sendBulkEmails(emails);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test connection endpoint
app.post('/test-connection', async (req, res) => {
  try {
    const isConnected = await initializeTransporter();
    res.json({ 
      success: isConnected, 
      message: isConnected ? 'SMTP connection successful' : 'SMTP connection failed' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start server
async function startServer() {
  try {
    // Initialize SMTP transporter
    await initializeTransporter();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 SMTP server running on port ${PORT}`);
      console.log(`📧 Health check: http://localhost:${PORT}/health`);
      console.log(`📤 Send email: POST http://localhost:${PORT}/send-email`);
    });
  } catch (error) {
    console.error('❌ Failed to start SMTP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down SMTP server...');
  if (transporter) {
    transporter.close();
  }
  process.exit(0);
});

// Export functions for use in other modules
module.exports = {
  sendEmail,
  sendBulkEmails,
  initializeTransporter,
  EMAIL_TEMPLATES
};

// Start server if this file is run directly
if (require.main === module) {
  startServer();
} 