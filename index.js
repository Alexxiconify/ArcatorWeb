const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

// Load sensitive configuration
const config = require("./sensitive/functions-config");

// Initialize Firebase Admin
admin.initializeApp();

/**
 * Cloud Function that triggers when a new document is added to email_history collection
 * Sends the email using the SMTP server via REST API and updates the status
 */
exports.sendEmail = functions.firestore
  .document("artifacts/{appId}/public/data/email_history/{emailId}")
  .onCreate(async (snap, context) => {
    const emailData = snap.data();
    const emailId = snap.id;
    const appId = context.params.appId;

    console.log(`Processing email ${emailId} for app ${appId}:`, emailData);

    try {
      // Validate required fields
      if (!emailData.to || !emailData.subject || !emailData.content) {
        console.error("Missing required email fields:", emailData);
        await updateEmailStatus(
          emailId,
          appId,
          "failed",
          "Missing required fields",
        );
        return;
      }

      // Prepare email data for SMTP server
      const smtpEmailData = {
        to: emailData.to,
        from: emailData.from || config.SMTP_SERVER_CONFIG.user,
        subject: emailData.subject,
        text: emailData.isHtml ? null : emailData.content,
        html: emailData.isHtml ? emailData.content : null,
      };

      console.log("Sending email via SMTP server:", smtpEmailData);

      // Send email using SMTP server REST API
      const response = await axios.post(
        `${config.SMTP_SERVER_URL}/send-email`,
        smtpEmailData,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 second timeout
        },
      );

      console.log("Email sent successfully via SMTP server:", response.data);

      // Update email status to sent
      await updateEmailStatus(
        emailId,
        appId,
        "sent",
        "Email sent successfully via SMTP server",
      );
    } catch (error) {
      console.error("Error sending email via SMTP server:", error);

      // Extract error message
      let errorMessage = error.message;
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      }

      // Update email status to failed
      await updateEmailStatus(emailId, appId, "failed", errorMessage);
    }
  });

/**
 * Helper function to update email status in Firestore
 */
async function updateEmailStatus(emailId, appId, status, message) {
  try {
    const emailRef = admin
      .firestore()
      .collection("artifacts")
      .doc(appId)
      .collection("public")
      .doc("data")
      .collection("email_history")
      .doc(emailId);

    await emailRef.update({
      status: status,
      errorMessage: message,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Email ${emailId} status updated to: ${status}`);
  } catch (error) {
    console.error("Error updating email status:", error);
  }
}

/**
 * Test function to verify SMTP server configuration
 */
exports.testSMTP = functions.https.onRequest(async (req, res) => {
  try {
    // First check if SMTP server is healthy
    const healthResponse = await axios.get(`${config.SMTP_SERVER_URL}/health`, {
      timeout: 10000,
    });

    console.log("SMTP server health check:", healthResponse.data);

    // Send test email
    const testEmailData = {
      to: config.TEST_EMAIL.to,
      from: config.TEST_EMAIL.from,
      subject: "SMTP Server Test Email",
      text: "This is a test email to verify SMTP server configuration.",
      html: "<p>This is a test email to verify SMTP server configuration.</p>",
    };

    const emailResponse = await axios.post(
      `${config.SMTP_SERVER_URL}/send-email`,
      testEmailData,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
    );

    res.json({
      success: true,
      message: "Test email sent successfully via SMTP server",
      health: healthResponse.data,
      email: emailResponse.data,
    });
  } catch (error) {
    console.error("SMTP server test failed:", error);

    let errorMessage = error.message;
    if (error.response && error.response.data && error.response.data.error) {
      errorMessage = error.response.data.error;
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      smtpServerUrl: config.SMTP_SERVER_URL,
    });
  }
});

/**
 * Function to send bulk emails via SMTP server
 */
exports.sendBulkEmails = functions.https.onRequest(async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No emails provided or invalid format",
      });
    }

    console.log(`Sending ${emails.length} bulk emails via SMTP server`);

    // Send bulk emails using SMTP server REST API
    const response = await axios.post(
      `${config.SMTP_SERVER_URL}/send-bulk-emails`,
      { emails },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 60000, // 60 second timeout for bulk emails
      },
    );

    console.log("Bulk emails sent successfully:", response.data);

    res.json({
      success: true,
      message: "Bulk emails sent successfully via SMTP server",
      result: response.data,
    });
  } catch (error) {
    console.error("Error sending bulk emails via SMTP server:", error);

    let errorMessage = error.message;
    if (error.response && error.response.data && error.response.data.error) {
      errorMessage = error.response.data.error;
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * Function to get SMTP server status
 */
exports.getSMTPStatus = functions.https.onRequest(async (req, res) => {
  try {
    const response = await axios.get(`${config.SMTP_SERVER_URL}/health`, {
      timeout: 10000,
    });

    res.json({
      success: true,
      smtpServerUrl: config.SMTP_SERVER_URL,
      status: response.data,
    });
  } catch (error) {
    console.error("Error getting SMTP server status:", error);

    res.status(500).json({
      success: false,
      error: error.message,
      smtpServerUrl: config.SMTP_SERVER_URL,
    });
  }
});
