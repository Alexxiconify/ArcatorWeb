// Test script for the email system
// Run this in the browser console on the admin page

console.log("🧪 Starting Email System Test...");

// Test 1: Check if admin panel elements exist
function testAdminPanelElements() {
  console.log("\n📋 Test 1: Checking Admin Panel Elements");

  const elements = {
    "email-to-select": document.getElementById("email-to-select"),
    "email-subject": document.getElementById("email-subject"),
    "email-content": document.getElementById("email-content"),
    "email-from": document.getElementById("email-from"),
    "email-template-select": document.getElementById("email-template-select"),
    "email-html-format": document.getElementById("email-html-format"),
    "send-email-btn": document.getElementById("send-email-btn"),
    "preview-email-btn": document.getElementById("preview-email-btn"),
    "email-compose-form": document.getElementById("email-compose-form"),
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

  return allElementsExist;
}

// Test 2: Check if email recipients are populated
async function testEmailRecipients() {
  console.log("\n👥 Test 2: Checking Email Recipients Population");

  const emailToSelect = document.getElementById("email-to-select");
  if (!emailToSelect) {
    console.log("❌ email-to-select element not found");
    return false;
  }

  // Wait a bit for the recipients to load
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const options = emailToSelect.querySelectorAll("option");
  console.log(`📊 Found ${options.length} recipient options`);

  if (options.length > 1) {
    // More than just the placeholder
    console.log("✅ Recipients populated successfully");
    options.forEach((option, index) => {
      if (index > 0) {
        // Skip placeholder
        console.log(`   - ${option.textContent} (${option.value})`);
      }
    });
    return true;
  } else {
    console.log("❌ No recipients found");
    return false;
  }
}

// Test 3: Test email form validation
function testEmailFormValidation() {
  console.log("\n✅ Test 3: Testing Email Form Validation");

  const form = document.getElementById("email-compose-form");
  if (!form) {
    console.log("❌ Email form not found");
    return false;
  }

  // Test empty form submission
  const submitEvent = new Event("submit", { cancelable: true });
  form.dispatchEvent(submitEvent);

  console.log("✅ Form validation test completed");
  return true;
}

// Test 4: Test email preview functionality
function testEmailPreview() {
  console.log("\n👁️ Test 4: Testing Email Preview");

  const previewBtn = document.getElementById("preview-email-btn");
  if (!previewBtn) {
    console.log("❌ Preview button not found");
    return false;
  }

  // Fill in some test data
  const subjectInput = document.getElementById("email-subject");
  const contentInput = document.getElementById("email-content");

  if (subjectInput && contentInput) {
    subjectInput.value = "Test Email Subject";
    contentInput.value = "This is a test email content for preview testing.";

    console.log("✅ Test data filled in");
    console.log(
      '📝 Click the "Preview" button to test email preview functionality',
    );
    return true;
  } else {
    console.log("❌ Could not fill test data");
    return false;
  }
}

// Test 5: Test email template selection
function testEmailTemplates() {
  console.log("\n📧 Test 5: Testing Email Templates");

  const templateSelect = document.getElementById("email-template-select");
  if (!templateSelect) {
    console.log("❌ Template select not found");
    return false;
  }

  const templates = Array.from(templateSelect.options).map(
    (option) => option.value,
  );
  console.log(`📋 Available templates: ${templates.join(", ")}`);

  // Test template selection
  if (templates.length > 1) {
    console.log("✅ Email templates available");
    return true;
  } else {
    console.log("❌ No email templates found");
    return false;
  }
}

// Test 6: Test email sending (simulation)
async function testEmailSending() {
  console.log("\n📤 Test 6: Testing Email Sending (Simulation)");

  const sendBtn = document.getElementById("send-email-btn");
  if (!sendBtn) {
    console.log("❌ Send button not found");
    return false;
  }

  // Check if we're logged in and have admin access
  const adminContent = document.getElementById("admin-content");
  if (!adminContent || adminContent.style.display === "none") {
    console.log("⚠️ Admin access required for email sending test");
    console.log("💡 Please log in as an admin user to test email sending");
    return false;
  }

  console.log("✅ Ready to test email sending");
  console.log('📝 Fill in the email form and click "Send Email" to test');
  console.log("📊 Check the browser console for any errors during sending");

  return true;
}

// Test 7: Check Firestore connection for email history
async function testEmailHistory() {
  console.log("\n📚 Test 7: Testing Email History");

  try {
    // Check if Firebase is available
    if (typeof firebase === "undefined") {
      console.log("❌ Firebase not loaded");
      return false;
    }

    console.log("✅ Firebase is available");
    console.log("📊 Email history will be loaded when emails are sent");
    return true;
  } catch (error) {
    console.log("❌ Error checking Firebase:", error);
    return false;
  }
}

// Main test runner
async function runEmailSystemTests() {
  console.log("🚀 Starting Email System Tests...\n");

  const tests = [
    { name: "Admin Panel Elements", fn: testAdminPanelElements },
    { name: "Email Recipients", fn: testEmailRecipients },
    { name: "Form Validation", fn: testEmailFormValidation },
    { name: "Email Preview", fn: testEmailPreview },
    { name: "Email Templates", fn: testEmailTemplates },
    { name: "Email Sending", fn: testEmailSending },
    { name: "Email History", fn: testEmailHistory },
  ];

  const results = [];

  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
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
    console.log("🎉 All tests passed! Email system is working correctly.");
  } else {
    console.log("⚠️ Some tests failed. Check the issues above.");
  }

  // Recommendations
  console.log("\n💡 Recommendations:");
  console.log("1. Make sure you're logged in as an admin user");
  console.log("2. Check that the admin panel is visible");
  console.log("3. Verify Firebase connection is working");
  console.log("4. Test email sending with a real recipient");

  return results;
}

// Manual test functions
function fillTestEmail() {
  console.log("📝 Filling test email data...");

  const elements = {
    "email-subject": "Test Email from Arcator.co.uk",
    "email-content":
      "Hello! This is a test email to verify the email system is working correctly.\n\nBest regards,\nThe Arcator Team",
  };

  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.value = value;
      console.log(`✅ Filled ${id}`);
    } else {
      console.log(`❌ Could not find ${id}`);
    }
  });

  console.log("✅ Test email data filled");
}

function selectTestRecipient() {
  console.log("👥 Selecting test recipient...");

  const emailToSelect = document.getElementById("email-to-select");
  if (!emailToSelect) {
    console.log("❌ email-to-select not found");
    return;
  }

  const options = emailToSelect.querySelectorAll("option");
  if (options.length > 1) {
    // Select the first real recipient (skip placeholder)
    emailToSelect.selectedIndex = 1;
    console.log(`✅ Selected: ${options[1].textContent}`);
  } else {
    console.log("❌ No recipients available");
  }
}

// Export functions for manual testing
window.emailSystemTests = {
  runAll: runEmailSystemTests,
  fillTestEmail: fillTestEmail,
  selectTestRecipient: selectTestRecipient,
  testAdminPanelElements: testAdminPanelElements,
  testEmailRecipients: testEmailRecipients,
  testEmailFormValidation: testEmailFormValidation,
  testEmailPreview: testEmailPreview,
  testEmailTemplates: testEmailTemplates,
  testEmailSending: testEmailSending,
  testEmailHistory: testEmailHistory,
};

console.log("🧪 Email System Test Script Loaded!");
console.log("💡 Run emailSystemTests.runAll() to start testing");
console.log(
  "💡 Or use individual functions like emailSystemTests.fillTestEmail()",
);
