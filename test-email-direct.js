// Test script to send emails directly using SendGrid API
// Note: This requires a SendGrid API key and should only be used for testing

const SENDGRID_API_KEY = 'YOUR_SENDGRID_API_KEY_HERE'; // Replace with your actual API key

async function testDirectEmailSending() {
  const emailData = {
    to: 'taylorallred04@gmail.com',
    from: 'noreply@arcator-web.firebaseapp.com',
    subject: 'Test Email from Arcator.co.uk',
    content: 'Hello! This is a test email to verify the email system is working.',
    isHtml: false
  };

  try {
    console.log('Sending test email...');
    
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: emailData.to }]
        }],
        from: { email: emailData.from },
        subject: emailData.subject,
        content: [{
          type: emailData.isHtml ? 'text/html' : 'text/plain',
          value: emailData.content
        }]
      })
    });

    if (response.ok) {
      console.log('✅ Email sent successfully!');
      console.log('Response status:', response.status);
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to send email');
      console.error('Status:', response.status);
      console.error('Error:', errorText);
    }
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
}

// Instructions for setting up SendGrid:
console.log(`
📧 EMAIL SETUP INSTRUCTIONS:

1. SIGN UP FOR SENDGRID:
   - Go to https://sendgrid.com/
   - Create a free account (allows 100 emails/day)

2. VERIFY YOUR SENDER DOMAIN:
   - In SendGrid dashboard, go to Settings > Sender Authentication
   - Add and verify your domain (arcator-web.firebaseapp.com)

3. GET YOUR API KEY:
   - Go to Settings > API Keys
   - Create a new API key with "Mail Send" permissions
   - Copy the API key

4. UPDATE THIS SCRIPT:
   - Replace 'YOUR_SENDGRID_API_KEY_HERE' with your actual API key

5. RUN THE TEST:
   - Open browser console on any page
   - Paste and run this script
   - Check if email is received

6. UPGRADE FIREBASE PROJECT (for Cloud Functions):
   - Go to https://console.firebase.google.com/project/arcator-web/usage/details
   - Upgrade to Blaze plan (pay-as-you-go)
   - Then run: firebase deploy --only functions

7. CONFIGURE CLOUD FUNCTION:
   - Set SendGrid API key: firebase functions:config:set sendgrid.key="YOUR_API_KEY"
   - Deploy functions: firebase deploy --only functions

ALTERNATIVE: Use a different email service like:
- EmailJS (client-side)
- AWS SES
- Mailgun
- Postmark
`);

// Uncomment the line below to test (after adding your API key):
// testDirectEmailSending(); 