// Browser console test script for email sending
// Copy and paste this into your browser console on admin.html

async function testEmailSending() {
  try {
    console.log("Starting email test...");

    // Check if Firebase is available
    if (typeof db === "undefined") {
      console.error("Firebase not initialized. Make sure you're on admin.html");
      return;
    }

    // Check if user is authenticated
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.error("No authenticated user found. Please log in first.");
      return;
    }

    console.log("Current user:", currentUser.displayName);

    // Test email data
    const testEmailData = {
      to: "taylorallred04@gmail.com",
      from: "noreply@arcator-web.firebaseapp.com",
      subject: "Test Email from Arcator.co.uk",
      content: `Hello Taylor,

This is a test email from your Arcator.co.uk website to verify that the email sending functionality is working correctly.

Email Details:
- Sent from: noreply@arcator-web.firebaseapp.com
- Sent to: taylorallred04@gmail.com
- Time: ${new Date().toLocaleString()}
- User: ${currentUser.displayName} (${currentUser.uid})

If you receive this email, the Firebase Cloud Function email system is working properly!

Best regards,
Arcator.co.uk Team`,
      html: false,
      status: "pending",
      createdAt: new Date(),
      createdBy: currentUser.uid,
    };

    console.log("Creating email record in Firestore...");
    console.log("Email data:", testEmailData);

    // Add to email_history collection
    const emailHistoryRef = collection(
      db,
      `artifacts/${appId}/public/data/email_history`,
    );
    const docRef = await addDoc(emailHistoryRef, testEmailData);

    console.log("✅ Email record created successfully!");
    console.log("Document ID:", docRef.id);
    console.log("Email should be sent automatically by the Cloud Function.");
    console.log("Check your email at taylorallred04@gmail.com");

    return docRef.id;
  } catch (error) {
    console.error("❌ Error testing email sending:", error);
    console.error("Error details:", {
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
    return null;
  }
}

// Auto-run the test
console.log("Running email test...");
testEmailSending().then((docId) => {
  if (docId) {
    console.log("🎉 Email test completed successfully!");
  } else {
    console.log("💥 Email test failed!");
  }
});
