#!/bin/bash

# SMTP Server Setup Script for Apollo
# This script will set up the SMTP server on apollo.arcator.co.uk

echo "Setting up SMTP server on apollo.arcator.co.uk..."

# Create directory for SMTP server
mkdir -p ~/smtp-server
cd ~/smtp-server

# Create package.json for the SMTP server
cat > package.json << 'EOF'
{
  "name": "arcator-smtp-server",
  "version": "1.0.0",
  "description": "SMTP server for Arcator.co.uk email sending",
  "main": "smtp-server.js",
  "scripts": {
    "start": "node smtp-server.js",
    "dev": "nodemon smtp-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "nodemailer": "^6.9.7",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "keywords": ["smtp", "email", "arcator"],
  "author": "Arcator Team",
  "license": "MIT"
}
EOF

# Create the SMTP server file
cat > smtp-server.js << 'EOF'
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'noreply@arcator.co.uk',
    pass: process.env.SMTP_PASS || ''
  }
};

let transporter = null;

async function initializeTransporter() {
  try {
    transporter = nodemailer.createTransporter(emailConfig);
    await transporter.verify();
    console.log('SMTP transporter initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize SMTP transporter:', error);
    return false;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    smtpConfigured: !!transporter
  });
});

// Send single email
app.post('/send-email', async (req, res) => {
  try {
    const { to, subject, text, html, from } = req.body;
    
    if (!transporter) {
      return res.status(500).json({ error: 'SMTP not configured' });
    }

    const mailOptions = {
      from: from || emailConfig.auth.user,
      to: to,
      subject: subject,
      text: text,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    
    res.json({
      success: true,
      messageId: result.messageId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      error: 'Failed to send email',
      details: error.message
    });
  }
});

// Send bulk emails
app.post('/send-bulk-emails', async (req, res) => {
  try {
    const { emails } = req.body;
    
    if (!transporter) {
      return res.status(500).json({ error: 'SMTP not configured' });
    }

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'No emails provided' });
    }

    const results = [];
    const errors = [];

    for (const emailData of emails) {
      try {
        const mailOptions = {
          from: emailData.from || emailConfig.auth.user,
          to: emailData.to,
          subject: emailData.subject,
          text: emailData.text,
          html: emailData.html
        };

        const result = await transporter.sendMail(mailOptions);
        results.push({
          to: emailData.to,
          messageId: result.messageId,
          success: true
        });
      } catch (error) {
        errors.push({
          to: emailData.to,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      sent: results.length,
      failed: errors.length,
      results: results,
      errors: errors,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending bulk emails:', error);
    res.status(500).json({
      error: 'Failed to send bulk emails',
      details: error.message
    });
  }
});

// Email templates endpoint
app.get('/templates', (req, res) => {
  const templates = {
    welcome: {
      subject: 'Welcome to Arcator.co.uk!',
      html: `
        <h2>Welcome to Arcator.co.uk!</h2>
        <p>Thank you for joining our community. We're excited to have you on board!</p>
        <p>Best regards,<br>The Arcator Team</p>
      `
    },
    announcement: {
      subject: 'Important Announcement from Arcator.co.uk',
      html: `
        <h2>Important Announcement</h2>
        <p>We have an important announcement for our community.</p>
        <p>Best regards,<br>The Arcator Team</p>
      `
    },
    maintenance: {
      subject: 'Scheduled Maintenance Notice - Arcator.co.uk',
      html: `
        <h2>Scheduled Maintenance</h2>
        <p>We will be performing scheduled maintenance to improve our services.</p>
        <p>Best regards,<br>The Arcator Team</p>
      `
    },
    event: {
      subject: 'Event Invitation - Arcator.co.uk',
      html: `
        <h2>You're Invited!</h2>
        <p>We'd like to invite you to an upcoming event in our community.</p>
        <p>Best regards,<br>The Arcator Team</p>
      `
    }
  };
  
  res.json(templates);
});

// Start server
async function startServer() {
  console.log('Starting SMTP server...');
  
  const smtpInitialized = await initializeTransporter();
  if (!smtpInitialized) {
    console.warn('SMTP not configured. Server will start but email sending will be disabled.');
  }
  
  app.listen(PORT, () => {
    console.log(`SMTP server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Email endpoint: http://localhost:${PORT}/send-email`);
  });
}

startServer().catch(console.error);
EOF

# Create environment file template
cat > .env.example << 'EOF'
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@arcator.co.uk
SMTP_PASS=your_smtp_password_here

# Server Configuration
PORT=3001
EOF

# Create systemd service file
sudo tee /etc/systemd/system/arcator-smtp.service > /dev/null << 'EOF'
[Unit]
Description=Arcator SMTP Server
After=network.target

[Service]
Type=simple
User=mcsa
WorkingDirectory=/home/mcsa/smtp-server
ExecStart=/usr/bin/node smtp-server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Set up firewall rules
echo "Setting up firewall rules..."
sudo ufw allow 3001/tcp

# Enable and start the service
echo "Enabling and starting SMTP service..."
sudo systemctl daemon-reload
sudo systemctl enable arcator-smtp
sudo systemctl start arcator-smtp

# Check service status
echo "Checking service status..."
sudo systemctl status arcator-smtp

echo "SMTP server setup complete!"
echo "To configure SMTP credentials, edit the .env file in ~/smtp-server/"
echo "To view logs: sudo journalctl -u arcator-smtp -f"
echo "To restart service: sudo systemctl restart arcator-smtp" 