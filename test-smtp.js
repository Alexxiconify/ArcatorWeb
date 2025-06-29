// SMTP Server Test Script
// Run this to test the SMTP server functionality

const {
  sendEmail,
  sendBulkEmails,
  initializeTransporter,
} = require("./smtp-server.js");

async function testSMTPConnection() {
  console.log("🔧 Testing SMTP Server Connection");
  console.log("================================");

  try {
    const isConnected = await initializeTransporter();
    if (isConnected) {
      console.log("✅ SMTP connection successful");
      return true;
    } else {
      console.log("❌ SMTP connection failed");
      return false;
    }
  } catch (error) {
    console.log("❌ SMTP connection error:", error.message);
    return false;
  }
}

async function testSingleEmail() {
  console.log("\n📧 Testing Single Email Sending");
  console.log("===============================");

  try {
    const emailData = {
      to: "test@example.com", // Replace with your test email
      subject: "SMTP Server Test",
      content: "This is a test email from the Arcator.co.uk SMTP server.",
      template: "custom",
      isHtml: false,
      from: "noreply@arcator.co.uk",
    };

    const result = await sendEmail(emailData);
    console.log("✅ Single email sent successfully");
    console.log("Message ID:", result.messageId);
    return true;
  } catch (error) {
    console.log("❌ Single email failed:", error.message);
    return false;
  }
}

async function testTemplateEmail() {
  console.log("\n📧 Testing Template Email Sending");
  console.log("==================================");

  try {
    const emailData = {
      to: "test@example.com", // Replace with your test email
      subject: "Welcome to Arcator",
      content: "Welcome to our community!",
      template: "welcome",
      isHtml: true,
      from: "noreply@arcator.co.uk",
    };

    const result = await sendEmail(emailData);
    console.log("✅ Template email sent successfully");
    console.log("Message ID:", result.messageId);
    return true;
  } catch (error) {
    console.log("❌ Template email failed:", error.message);
    return false;
  }
}

async function testBulkEmails() {
  console.log("\n📧 Testing Bulk Email Sending");
  console.log("=============================");

  try {
    const emails = [
      {
        to: "test1@example.com", // Replace with test emails
        subject: "Bulk Test 1",
        content: "This is bulk test email 1.",
        template: "custom",
        isHtml: false,
      },
      {
        to: "test2@example.com", // Replace with test emails
        subject: "Bulk Test 2",
        content: "This is bulk test email 2.",
        template: "announcement",
        isHtml: true,
      },
    ];

    const results = await sendBulkEmails(emails);
    console.log("✅ Bulk emails sent");
    console.log("Results:", results);
    return true;
  } catch (error) {
    console.log("❌ Bulk emails failed:", error.message);
    return false;
  }
}

async function testServerEndpoints() {
  console.log("\n🌐 Testing Server Endpoints");
  console.log("===========================");

  const baseUrl = "http://localhost:3001";

  try {
    // Test health endpoint
    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthData = await healthResponse.json();
    console.log("✅ Health endpoint:", healthData);

    // Test connection endpoint
    const connectionResponse = await fetch(`${baseUrl}/test-connection`, {
      method: "POST",
    });
    const connectionData = await connectionResponse.json();
    console.log("✅ Connection test:", connectionData);

    return true;
  } catch (error) {
    console.log("❌ Server endpoints failed:", error.message);
    return false;
  }
}

async function runAllTests() {
  console.log("🚀 Starting SMTP Server Tests");
  console.log("=============================\n");

  const tests = [
    { name: "SMTP Connection", fn: testSMTPConnection },
    { name: "Single Email", fn: testSingleEmail },
    { name: "Template Email", fn: testTemplateEmail },
    { name: "Bulk Emails", fn: testBulkEmails },
    { name: "Server Endpoints", fn: testServerEndpoints },
  ];

  const results = [];

  for (const test of tests) {
    console.log(`\n🧪 Running: ${test.name}`);
    console.log("─".repeat(50));

    try {
      const result = await test.fn();
      results.push({ name: test.name, success: result });
    } catch (error) {
      console.log(`❌ Test error: ${error.message}`);
      results.push({ name: test.name, success: false, error: error.message });
    }
  }

  // Summary
  console.log("\n📊 Test Results Summary");
  console.log("=======================");

  const passed = results.filter((r) => r.success).length;
  const total = results.length;

  results.forEach((result) => {
    const status = result.success ? "✅" : "❌";
    console.log(`${status} ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n📈 Overall: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("🎉 All tests passed! SMTP server is working correctly.");
  } else {
    console.log(
      "⚠️  Some tests failed. Check the configuration and try again.",
    );
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testSMTPConnection,
  testSingleEmail,
  testTemplateEmail,
  testBulkEmails,
  testServerEndpoints,
  runAllTests,
};
