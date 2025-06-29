// EmailJS Setup Test Script
// Run this in the browser console to test EmailJS configuration

console.log("🔧 EmailJS Setup Test Script");
console.log("============================");

// Test 1: Check EmailJS script loading
function testEmailJSScript() {
  console.log("\n📜 Test 1: EmailJS Script Loading");
  console.log("----------------------------------");

  if (typeof emailjs !== "undefined") {
    console.log("✅ EmailJS script loaded successfully");
    console.log("   Version:", emailjs.version || "Unknown");
    return true;
  } else {
    console.log("❌ EmailJS script not loaded");
    console.log("💡 Make sure the EmailJS CDN script is included in the page");
    return false;
  }
}

// Test 2: Check for saved credentials
function testCredentials() {
  console.log("\n🔑 Test 2: EmailJS Credentials");
  console.log("-------------------------------");

  try {
    const saved = localStorage.getItem("emailjs_credentials");
    if (saved) {
      const creds = JSON.parse(saved);
      console.log("✅ Credentials found in localStorage:");
      console.log(
        "   Public Key:",
        creds.publicKey ? "✅ Configured" : "❌ Missing",
      );
      console.log("   Service ID:", creds.serviceId || "❌ Not configured");
      console.log("   Template ID:", creds.templateId || "❌ Not configured");
      return creds;
    } else {
      console.log("❌ No credentials found in localStorage");
      console.log('💡 Use the "Configure EmailJS" button in the admin panel');
      return null;
    }
  } catch (error) {
    console.log("❌ Error reading credentials:", error.message);
    return null;
  }
}

// Test 3: Test EmailJS initialization
async function testInitialization() {
  console.log("\n🚀 Test 3: EmailJS Initialization");
  console.log("----------------------------------");

  try {
    // Import the EmailJS integration
    const { initializeEmailJS, getEmailJSStatus, testEmailJSConnection } =
      await import("./emailjs-integration.js");

    const status = getEmailJSStatus();
    console.log("📊 EmailJS Status:");
    console.log("   Script Loaded:", status.scriptLoaded ? "✅ Yes" : "❌ No");
    console.log("   Initialized:", status.initialized ? "✅ Yes" : "❌ No");
    console.log("   Public Key:", status.publicKey);
    console.log("   Service ID:", status.serviceId);
    console.log("   Template ID:", status.templateId);
    console.log("   Ready to Send:", status.readyToSend ? "✅ Yes" : "❌ No");

    if (status.readyToSend) {
      const testResult = await testEmailJSConnection();
      console.log(
        "🔗 Connection Test:",
        testResult.success ? "✅ Success" : "❌ Failed",
      );
      if (!testResult.success) {
        console.log("   Error:", testResult.error);
      }
    }

    return status;
  } catch (error) {
    console.log("❌ Error testing initialization:", error.message);
    return null;
  }
}

// Test 4: Test email sending (simulation)
async function testEmailSending() {
  console.log("\n📧 Test 4: Email Sending Test");
  console.log("-----------------------------");

  try {
    const { sendEmailWithEmailJS, getEmailJSStatus } = await import(
      "./emailjs-integration.js"
    );

    const status = getEmailJSStatus();
    if (!status.readyToSend) {
      console.log("❌ EmailJS not ready to send");
      console.log("💡 Configure EmailJS first using the admin panel");
      return false;
    }

    console.log("✅ EmailJS is ready to send emails");
    console.log("📝 To test actual sending:");
    console.log("   1. Go to the admin panel");
    console.log("   2. Select a recipient from the dropdown");
    console.log("   3. Fill in subject and message");
    console.log('   4. Click "Send Email"');
    console.log("   5. Check the console for results");

    return true;
  } catch (error) {
    console.log("❌ Error testing email sending:", error.message);
    return false;
  }
}

// Test 5: Check admin panel integration
function testAdminPanelIntegration() {
  console.log("\n⚙️ Test 5: Admin Panel Integration");
  console.log("----------------------------------");

  const elements = {
    "email-to-select": document.getElementById("email-to-select"),
    "email-subject": document.getElementById("email-subject"),
    "email-content": document.getElementById("email-content"),
    "send-email-btn": document.getElementById("send-email-btn"),
    "test-emailjs-btn": document.getElementById("test-emailjs-btn"),
    "configure-emailjs-btn": document.getElementById("configure-emailjs-btn"),
  };

  let allElementsExist = true;
  Object.entries(elements).forEach(([name, element]) => {
    if (element) {
      console.log(`✅ ${name}: Found`);
    } else {
      console.log(`❌ ${name}: Missing`);
      allElementsExist = false;
    }
  });

  if (allElementsExist) {
    console.log("✅ Admin panel email elements are ready");
  } else {
    console.log("❌ Some admin panel elements are missing");
    console.log("💡 Make sure you're on the admin panel page");
  }

  return allElementsExist;
}

// Main test runner
async function runAllTests() {
  console.log("🚀 Starting EmailJS Tests...\n");

  const tests = [
    { name: "EmailJS Script", fn: testEmailJSScript },
    { name: "Credentials", fn: testCredentials },
    { name: "Initialization", fn: testInitialization },
    { name: "Email Sending", fn: testEmailSending },
    { name: "Admin Panel", fn: testAdminPanelIntegration },
  ];

  const results = [];

  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: !!result });
    } catch (error) {
      console.log(`❌ Error in ${test.name}:`, error);
      results.push({ name: test.name, passed: false, error: error.message });
    }
  }

  // Summary
  console.log("\n📊 Test Results Summary:");
  console.log("========================");

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const status = result.passed ? "✅" : "❌";
    console.log(`${status} ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("🎉 All tests passed! EmailJS is properly configured.");
  } else {
    console.log("⚠️ Some tests failed. Check the issues above.");
  }

  return results;
}

// Export functions for manual testing
window.EmailJSTest = {
  runAll: runAllTests,
  testScript: testEmailJSScript,
  testCredentials: testCredentials,
  testInitialization: testInitialization,
  testEmailSending: testEmailSending,
  testAdminPanel: testAdminPanelIntegration,
};

console.log("🧪 EmailJS Test Script Loaded!");
console.log("💡 Run EmailJSTest.runAll() to start testing");
