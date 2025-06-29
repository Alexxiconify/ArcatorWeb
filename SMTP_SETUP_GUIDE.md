# SMTP Server Setup Guide for Arcator.co.uk

This guide will help you set up a local SMTP server on your server to handle email sending for your website.

## Overview

The SMTP server provides:
- Local email sending without external dependencies
- Email templates for common use cases
- Bulk email support
- REST API endpoints for integration
- Health monitoring and testing

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager
- Access to your server's command line
- Email credentials (username/password)

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure SMTP Settings

Edit `smtp-server.js` and update the `SMTP_CONFIG` object:

```javascript
const SMTP_CONFIG = {
  host: 'your-smtp-server.com', // Your SMTP server hostname
  port: 587, // SMTP port (587 for TLS, 465 for SSL)
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'your-email@arcator.co.uk', // Your email username
    pass: 'your-secure-password' // Your email password
  },
  tls: {
    rejectUnauthorized: false // Set to true for production
  }
};
```

### 3. Common SMTP Providers

#### Gmail
```javascript
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password' // Use App Password, not regular password
  }
};
```

#### Outlook/Hotmail
```javascript
const SMTP_CONFIG = {
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@outlook.com',
    pass: 'your-password'
  }
};
```

#### Custom Domain (cPanel)
```javascript
const SMTP_CONFIG = {
  host: 'mail.yourdomain.com',
  port: 587,
  secure: false,
  auth: {
    user: 'noreply@yourdomain.com',
    pass: 'your-email-password'
  }
};
```

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Testing
```bash
npm test
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and SMTP connection status.

### Send Single Email
```
POST /send-email
Content-Type: application/json

{
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "content": "Email content",
  "template": "custom",
  "isHtml": false,
  "from": "noreply@arcator.co.uk"
}
```

### Send Bulk Emails
```
POST /send-bulk-emails
Content-Type: application/json

{
  "emails": [
    {
      "to": "user1@example.com",
      "subject": "Subject 1",
      "content": "Content 1"
    },
    {
      "to": "user2@example.com",
      "subject": "Subject 2",
      "content": "Content 2"
    }
  ]
}
```

### Test Connection
```
POST /test-connection
```
Tests SMTP server connection.

## Email Templates

The server includes built-in templates:

### Welcome Template
```javascript
{
  subject: 'Welcome to Arcator.co.uk!',
  html: '...' // HTML template with {{name}} and {{content}} placeholders
}
```

### Announcement Template
```javascript
{
  subject: 'Arcator.co.uk - {{subject}}',
  html: '...' // HTML template with {{content}} placeholder
}
```

### Maintenance Template
```javascript
{
  subject: 'Arcator.co.uk - Maintenance Notice',
  html: '...' // HTML template with {{content}} placeholder
}
```

### Event Template
```javascript
{
  subject: 'Arcator.co.uk - Event Invitation',
  html: '...' // HTML template with {{content}} placeholder
}
```

## Integration with Website

### 1. Update Admin Panel

Import the SMTP integration in `admin_and_dev.js`:

```javascript
import { 
  sendEmailViaSMTP, 
  testSMTPServerConnection,
  getSMTPServerStatus 
} from './smtp-integration.js';
```

### 2. Update Email Sending Function

Replace the EmailJS sending with SMTP:

```javascript
async function sendEmail() {
  // ... existing validation code ...
  
  try {
    const emailData = {
      to: recipients.join(','),
      subject: subject,
      content: content,
      template: template || 'custom',
      isHtml: isHtml,
      from: 'noreply@arcator.co.uk'
    };
    
    const result = await sendEmailViaSMTP(emailData);
    
    if (result.success) {
      await logEmailToHistory(recipients, subject, content, 'sent', 'SMTP');
      showMessageBox('Email sent successfully!', false);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Email sending failed:', error);
    showMessageBox(`Failed to send email: ${error.message}`, true);
  }
}
```

### 3. Add SMTP Status Display

```javascript
function displaySMTPStatus() {
  const status = getSMTPServerStatus();
  const statusDisplay = document.getElementById('smtp-status-display');
  
  if (statusDisplay) {
    statusDisplay.innerHTML = `
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div>Server Connected: ${status.connected ? '✅ Yes' : '❌ No'}</div>
        <div>Server URL: ${status.serverUrl}</div>
        <div>Ready to Send: ${status.ready ? '✅ Yes' : '❌ No'}</div>
      </div>
    `;
  }
}
```

## Security Considerations

### 1. Environment Variables
Store sensitive data in environment variables:

```javascript
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};
```

### 2. Rate Limiting
Add rate limiting to prevent abuse:

```javascript
const rateLimit = require('express-rate-limit');

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/send-email', emailLimiter);
app.use('/send-bulk-emails', emailLimiter);
```

### 3. CORS Configuration
Restrict CORS to your domain:

```javascript
app.use(cors({
  origin: ['https://arcator.co.uk', 'https://www.arcator.co.uk'],
  credentials: true
}));
```

## Monitoring and Logging

### 1. Add Logging
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'smtp-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'smtp-combined.log' })
  ]
});
```

### 2. Health Monitoring
Set up monitoring for the health endpoint:

```bash
# Check server health every 5 minutes
*/5 * * * * curl -f http://localhost:3001/health || echo "SMTP server down"
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check username/password
   - Enable "Less secure app access" (Gmail)
   - Use App Passwords (Gmail)

2. **Connection Timeout**
   - Check firewall settings
   - Verify SMTP host and port
   - Test with telnet: `telnet smtp.gmail.com 587`

3. **TLS/SSL Issues**
   - Set `secure: false` for port 587
   - Set `secure: true` for port 465
   - Check certificate validity

### Debug Mode
Enable debug logging:

```javascript
const SMTP_CONFIG = {
  // ... other config
  debug: true, // Enable debug output
  logger: true // Enable built-in logger
};
```

## Production Deployment

### 1. Process Manager
Use PM2 for production:

```bash
npm install -g pm2
pm2 start smtp-server.js --name "arcator-smtp"
pm2 save
pm2 startup
```

### 2. Reverse Proxy
Configure Nginx as reverse proxy:

```nginx
server {
    listen 80;
    server_name smtp.arcator.co.uk;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. SSL Certificate
Add SSL for secure communication:

```bash
# Using Let's Encrypt
sudo certbot --nginx -d smtp.arcator.co.uk
```

## Testing

Run the test suite:

```bash
npm test
```

Or test individual components:

```bash
node test-smtp.js
```

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs
3. Test SMTP connection manually
4. Contact the development team

---

**Note**: This SMTP server is designed for internal use. For high-volume email sending, consider using dedicated email services like SendGrid, Mailgun, or AWS SES. 