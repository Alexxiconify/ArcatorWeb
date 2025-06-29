# EmailJS Setup Guide for Arcator.co.uk

This guide will help you set up EmailJS as an alternative to Cloud Functions for sending emails from your website.

## Overview

EmailJS allows you to send emails directly from the browser without needing server-side code or Cloud Functions. This is particularly useful when:
- Your Firebase project is on the free Spark plan (which doesn't support Cloud Functions)
- You want a simpler email solution
- You need to send emails without server infrastructure

## Prerequisites

- A free EmailJS account at [EmailJS.com](https://www.emailjs.com/)
- An email service (Gmail, Outlook, etc.)
- Access to your website's admin panel

## Step-by-Step Setup

### 1. Create EmailJS Account

1. Go to [EmailJS.com](https://www.emailjs.com/) and sign up for a free account
2. Verify your email address
3. Complete your profile setup

### 2. Add Email Service

1. In your EmailJS dashboard, go to **Email Services**
2. Click **Add New Service**
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the authentication steps for your chosen provider
5. Note down the **Service ID** (you'll need this later)

### 3. Create Email Template

1. Go to **Email Templates** in your EmailJS dashboard
2. Click **Create New Template**
3. Design your email template with these variables:
   ```
   To: {{to_email}}
   Subject: {{subject}}
   Message: {{message}}
   From Name: {{from_name}}
   From Email: {{from_email}}
   Reply To: {{reply_to}}
   ```
4. Save the template and note down the **Template ID**

### 4. Get API Credentials

1. Go to **Account** → **API Keys** in your EmailJS dashboard
2. Copy your **Public Key**
3. You should now have:
   - Public Key
   - Service ID (from step 2)
   - Template ID (from step 3)

### 5. Configure on Your Website

#### Option A: Use the Setup Page (Recommended)

1. Open `emailjs-setup.html` in your browser
2. Enter your credentials:
   - Public Key
   - Service ID
   - Template ID
3. Click **Save Credentials**
4. Test the connection by sending a test email
5. If successful, the credentials are saved and ready to use

#### Option B: Manual Configuration

1. Open your browser's developer console
2. Run this code to save credentials:
   ```javascript
   const credentials = {
       publicKey: 'YOUR_PUBLIC_KEY',
       serviceId: 'YOUR_SERVICE_ID',
       templateId: 'YOUR_TEMPLATE_ID',
       savedAt: new Date().toISOString()
   };
   localStorage.setItem('emailjs_credentials', JSON.stringify(credentials));
   ```

### 6. Test the Integration

1. Open your admin panel (`admin.html`)
2. Open the browser console
3. Run the test script:
   ```javascript
   // Load the test script
   const script = document.createElement('script');
   script.src = 'test-emailjs-setup.js';
   document.head.appendChild(script);
   
   // Run tests after script loads
   setTimeout(() => EmailJSTest.runAll(), 1000);
   ```

## How It Works

### Automatic Fallback System

The admin panel now includes an intelligent email sending system that:

1. **Checks EmailJS first**: If EmailJS is configured and working, it uses EmailJS
2. **Falls back to Cloud Functions**: If EmailJS is not available, it uses the original Cloud Functions method
3. **Provides clear feedback**: Shows which method is being used and any errors

### Email Sending Process

1. User composes email in admin panel
2. System checks EmailJS availability
3. If available, sends directly via EmailJS
4. If not available, queues email via Cloud Functions
5. Shows success/error messages to user

## Troubleshooting

### Common Issues

#### "EmailJS not initialized"
- **Cause**: Credentials not saved or invalid
- **Solution**: Re-run the setup process and verify credentials

#### "Email sending failed"
- **Cause**: Template variables don't match
- **Solution**: Check your EmailJS template uses the correct variable names

#### "No email sending method available"
- **Cause**: Neither EmailJS nor Cloud Functions are configured
- **Solution**: Configure EmailJS or ensure Cloud Functions are deployed

### Testing Commands

Run these in the browser console to diagnose issues:

```javascript
// Check EmailJS status
EmailJSIntegration.getStatus()

// Test connection
EmailJSIntegration.testConnection()

// Check saved credentials
localStorage.getItem('emailjs_credentials')

// Clear credentials (if needed)
EmailJSIntegration.clearCredentials()
```

## Security Considerations

### What's Stored Locally
- EmailJS credentials are stored in browser localStorage
- These are public keys and service IDs (not private keys)
- They can be viewed by anyone with access to the browser

### Best Practices
- Use a dedicated email account for sending
- Set up proper email service authentication
- Monitor your EmailJS usage (free tier has limits)
- Consider using environment variables for production

## EmailJS Free Tier Limits

- 200 emails per month
- 2 email services
- 5 email templates
- Basic support

For higher limits, consider upgrading to a paid plan.

## Integration with Admin Panel

The EmailJS integration is automatically available in the admin panel:

1. **Email Management Section**: Shows EmailJS status
2. **Automatic Method Selection**: Chooses best available method
3. **Unified Interface**: Same email form works with both methods
4. **Status Indicators**: Shows which method is being used

## Files Modified

- `emailjs-setup.html` - Setup and configuration page
- `emailjs-integration.js` - Core EmailJS integration module
- `admin_and_dev.js` - Updated to support EmailJS
- `test-emailjs-setup.js` - Testing and verification script

## Next Steps

1. Configure EmailJS using the setup page
2. Test the integration
3. Monitor email sending in the admin panel
4. Consider upgrading EmailJS plan if needed

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Run the test script to diagnose problems
3. Verify your EmailJS credentials are correct
4. Check your email service configuration
5. Review EmailJS documentation for advanced features

---

**Note**: This EmailJS integration provides a reliable alternative to Cloud Functions and works well for most email sending needs. The automatic fallback system ensures your email functionality remains available even if one method fails. 