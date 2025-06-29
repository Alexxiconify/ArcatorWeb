const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

// Initialize Firebase Admin
admin.initializeApp();

// Set SendGrid API key
sgMail.setApiKey(functions.config().sendgrid.key);

/**
 * Cloud Function that triggers when a new document is added to email_history collection
 * Sends the email using SendGrid and updates the status
 */
exports.sendEmail = functions.firestore
  .document('artifacts/{appId}/public/data/email_history/{emailId}')
  .onCreate(async (snap, context) => {
    const emailData = snap.data();
    const emailId = snap.id;
    
    console.log(`Processing email ${emailId}:`, emailData);
    
    try {
      // Validate required fields
      if (!emailData.to || !emailData.subject || !emailData.content) {
        console.error('Missing required email fields:', emailData);
        await updateEmailStatus(emailId, 'failed', 'Missing required fields');
        return;
      }
      
      // Prepare email message
      const msg = {
        to: emailData.to,
        from: emailData.from || 'noreply@arcator-web.firebaseapp.com',
        subject: emailData.subject,
        text: emailData.isHtml ? null : emailData.content,
        html: emailData.isHtml ? emailData.content : null,
      };
      
      console.log('Sending email with SendGrid:', msg);
      
      // Send email using SendGrid
      const response = await sgMail.send(msg);
      
      console.log('Email sent successfully:', response);
      
      // Update email status to sent
      await updateEmailStatus(emailId, 'sent', 'Email sent successfully');
      
    } catch (error) {
      console.error('Error sending email:', error);
      
      // Update email status to failed
      await updateEmailStatus(emailId, 'failed', error.message);
    }
  });

/**
 * Helper function to update email status in Firestore
 */
async function updateEmailStatus(emailId, status, message) {
  try {
    const emailRef = admin.firestore()
      .collection('artifacts')
      .doc('arcator-web')
      .collection('public')
      .doc('data')
      .collection('email_history')
      .doc(emailId);
    
    await emailRef.update({
      status: status,
      errorMessage: message,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Email ${emailId} status updated to: ${status}`);
  } catch (error) {
    console.error('Error updating email status:', error);
  }
}

/**
 * Test function to verify SendGrid configuration
 */
exports.testSendGrid = functions.https.onRequest(async (req, res) => {
  try {
    const msg = {
      to: 'taylorallred04@gmail.com',
      from: 'noreply@arcator-web.firebaseapp.com',
      subject: 'SendGrid Test Email',
      text: 'This is a test email to verify SendGrid configuration.',
      html: '<p>This is a test email to verify SendGrid configuration.</p>',
    };
    
    const response = await sgMail.send(msg);
    
    res.json({
      success: true,
      message: 'Test email sent successfully',
      response: response
    });
  } catch (error) {
    console.error('SendGrid test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}); 