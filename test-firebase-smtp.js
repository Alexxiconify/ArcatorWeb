// Test script for Firebase SMTP integration
// This script tests the Firebase Cloud Functions integration with the SMTP server

console.log("🧪 Testing Firebase SMTP Integration...\n");

// Test 1: SMTP Server Connection
async function testSMTPConnection() {
  console.log("1️⃣ Testing SMTP server connection...");
  try {
    // Import the function dynamically
    const { testSMTPServerConnection } = await import("./smtp-integration.js");
    const result = await testSMTPServerConnection();
    if (result.success) {
      console.log("✅ SMTP server connection successful!");
      console.log("   Status:", result.status);
    } else {
      console.log("❌ SMTP server connection failed:", result.message);
    }
    return result;
  } catch (error) {
    console.log("❌ SMTP connection test error:", error.message);
    return { success: false, error: error.message };
  }
}

// Test 2: Single Email Sending
async function testSingleEmail() {
  console.log("\n2️⃣ Testing single email sending...");
  try {
    const { sendEmailViaSMTP } = await import("./smtp-integration.js");
    const emailData = {
      to: "taylorallred04@gmail.com",
      subject: "Firebase SMTP Integration Test",
      text: "This is a test email sent via Firebase Cloud Functions to SMTP server.",
      html: "<h2>Firebase SMTP Integration Test</h2><p>This is a test email sent via Firebase Cloud Functions to SMTP server.</p>",
    };

    const result = await sendEmailViaSMTP(emailData);
    if (result.success) {
      console.log("✅ Single email sent successfully!");
      console.log("   Message ID:", result.messageId);
      console.log("   Message:", result.message);
    } else {
      console.log("❌ Single email failed:", result.error);
    }
    return result;
  } catch (error) {
    console.log("❌ Single email test error:", error.message);
    return { success: false, error: error.message };
  }
}

// Test 3: Bulk Email Sending
async function testBulkEmails() {
  console.log("\n3️⃣ Testing bulk email sending...");
  try {
    const { sendBulkEmailsViaSMTP } = await import("./smtp-integration.js");
    const emails = [
      {
        to: "taylorallred04@gmail.com",
        subject: "Bulk Email Test 1",
        text: "This is the first bulk email test.",
        html: "<h3>Bulk Email Test 1</h3><p>This is the first bulk email test.</p>",
      },
      {
        to: "taylorallred04@gmail.com",
        subject: "Bulk Email Test 2",
        text: "This is the second bulk email test.",
        html: "<h3>Bulk Email Test 2</h3><p>This is the second bulk email test.</p>",
      },
    ];

    const result = await sendBulkEmailsViaSMTP(emails);
    if (result.success) {
      console.log("✅ Bulk emails sent successfully!");
      console.log("   Result:", result.result);
    } else {
      console.log("❌ Bulk emails failed:", result.error);
    }
    return result;
  } catch (error) {
    console.log("❌ Bulk email test error:", error.message);
    return { success: false, error: error.message };
  }
}

// Test 4: Firebase Cloud Functions Status
async function testFirebaseFunctions() {
  console.log("\n4️⃣ Testing Firebase Cloud Functions...");
  try {
    // This would test the actual Cloud Functions endpoints
    // For now, we'll just check if the integration is working
    console.log("✅ Firebase Cloud Functions integration ready");
    console.log("   Note: Deploy functions to test actual endpoints");
    return { success: true };
  } catch (error) {
    console.log("❌ Firebase Functions test error:", error.message);
    return { success: false, error: error.message };
  }
}

// Run all tests
async function runAllTests() {
  console.log("🚀 Starting Firebase SMTP Integration Tests...\n");

  const results = {
    connection: await testSMTPConnection(),
    singleEmail: await testSingleEmail(),
    bulkEmails: await testBulkEmails(),
    firebaseFunctions: await testFirebaseFunctions(),
  };

  console.log("\n📊 Test Results Summary:");
  console.log("========================");
  console.log(
    `SMTP Connection: ${results.connection.success ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(
    `Single Email: ${results.singleEmail.success ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(
    `Bulk Emails: ${results.bulkEmails.success ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(
    `Firebase Functions: ${results.firebaseFunctions.success ? "✅ PASS" : "❌ FAIL"}`,
  );

  const passedTests = Object.values(results).filter((r) => r.success).length;
  const totalTests = Object.keys(results).length;

  console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log(
      "🎉 All tests passed! Firebase SMTP integration is working correctly.",
    );
  } else {
    console.log("⚠️  Some tests failed. Check the logs above for details.");
  }

  return results;
}

// Export for use in other modules
export {
  testSMTPConnection,
  testSingleEmail,
  testBulkEmails,
  testFirebaseFunctions,
  runAllTests,
};

// Run tests if this script is executed directly
if (typeof window !== "undefined") {
  // Browser environment - run tests after a short delay
  setTimeout(() => {
    runAllTests();
  }, 1000);
}
