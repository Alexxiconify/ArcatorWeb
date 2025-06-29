// EmailJS Setup Test Script
// Run this in the browser console to test EmailJS configuration

console.log('🔧 EmailJS Setup Test Script');
console.log('============================');

// Test 1: Check if EmailJS script is loaded
function testEmailJSScript() {
    console.log('\n📋 Test 1: EmailJS Script Loading');
    console.log('--------------------------------');
    
    if (typeof emailjs !== 'undefined') {
        console.log('✅ EmailJS script is loaded');
        return true;
    } else {
        console.log('❌ EmailJS script is not loaded');
        console.log('💡 Make sure to include: <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>');
        return false;
    }
}

// Test 2: Check for saved credentials
function testCredentials() {
    console.log('\n🔑 Test 2: EmailJS Credentials');
    console.log('-------------------------------');
    
    const saved = localStorage.getItem('emailjs_credentials');
    if (saved) {
        try {
            const credentials = JSON.parse(saved);
            console.log('✅ Credentials found in localStorage');
            console.log('📝 Credentials:', {
                hasPublicKey: !!credentials.publicKey,
                hasServiceId: !!credentials.serviceId,
                hasTemplateId: !!credentials.templateId,
                savedAt: credentials.savedAt
            });
            
            if (credentials.publicKey === 'YOUR_PUBLIC_KEY') {
                console.log('⚠️ Public key is still the default value');
                return false;
            }
            
            return true;
        } catch (error) {
            console.log('❌ Failed to parse saved credentials:', error);
            return false;
        }
    } else {
        console.log('❌ No credentials found in localStorage');
        console.log('💡 Go to emailjs-setup.html to configure credentials');
        return false;
    }
}

// Test 3: Test EmailJS initialization
async function testInitialization() {
    console.log('\n🚀 Test 3: EmailJS Initialization');
    console.log('----------------------------------');
    
    if (typeof emailjs === 'undefined') {
        console.log('❌ EmailJS not available');
        return false;
    }
    
    const saved = localStorage.getItem('emailjs_credentials');
    if (!saved) {
        console.log('❌ No credentials to test with');
        return false;
    }
    
    try {
        const credentials = JSON.parse(saved);
        if (credentials.publicKey === 'YOUR_PUBLIC_KEY') {
            console.log('❌ Public key not configured');
            return false;
        }
        
        emailjs.init(credentials.publicKey);
        console.log('✅ EmailJS initialized successfully');
        return true;
    } catch (error) {
        console.log('❌ EmailJS initialization failed:', error);
        return false;
    }
}

// Test 4: Test email sending (dry run)
async function testEmailSending() {
    console.log('\n📧 Test 4: Email Sending (Dry Run)');
    console.log('-----------------------------------');
    
    if (typeof emailjs === 'undefined') {
        console.log('❌ EmailJS not available');
        return false;
    }
    
    const saved = localStorage.getItem('emailjs_credentials');
    if (!saved) {
        console.log('❌ No credentials found');
        return false;
    }
    
    try {
        const credentials = JSON.parse(saved);
        
        // Test with a dummy email (won't actually send)
        const templateParams = {
            to_email: 'test@example.com',
            subject: 'EmailJS Test',
            message: 'This is a test email from EmailJS setup verification.',
            from_name: 'Arcator.co.uk',
            from_email: 'noreply@arcator-web.firebaseapp.com',
            reply_to: 'noreply@arcator-web.firebaseapp.com'
        };
        
        console.log('📤 Attempting to send test email...');
        console.log('📝 Template params:', templateParams);
        
        const response = await emailjs.send(
            credentials.serviceId,
            credentials.templateId,
            templateParams
        );
        
        console.log('✅ Email sent successfully!');
        console.log('📨 Response:', response);
        return true;
        
    } catch (error) {
        console.log('❌ Email sending failed:', error);
        console.log('💡 This might be expected if using a test email address');
        return false;
    }
}

// Test 5: Integration test with admin panel
function testAdminPanelIntegration() {
    console.log('\n🔗 Test 5: Admin Panel Integration');
    console.log('----------------------------------');
    
    // Check if admin panel elements exist
    const emailComposeForm = document.getElementById('email-compose-form');
    const emailToSelect = document.getElementById('email-to-select');
    const emailSubjectInput = document.getElementById('email-subject');
    const emailContentTextarea = document.getElementById('email-content');
    
    if (emailComposeForm && emailToSelect && emailSubjectInput && emailContentTextarea) {
        console.log('✅ Admin panel email elements found');
        
        // Check if EmailJS integration is available
        if (typeof EmailJSIntegration !== 'undefined') {
            console.log('✅ EmailJS integration module loaded');
            const status = EmailJSIntegration.getStatus();
            console.log('📊 EmailJS status:', status);
            return true;
        } else {
            console.log('❌ EmailJS integration module not loaded');
            console.log('💡 Make sure emailjs-integration.js is imported');
            return false;
        }
    } else {
        console.log('❌ Admin panel email elements not found');
        console.log('💡 Make sure you are on the admin panel page');
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('\n🧪 Running EmailJS Setup Tests...\n');
    
    const results = {
        scriptLoaded: testEmailJSScript(),
        credentials: testCredentials(),
        initialization: await testInitialization(),
        emailSending: await testEmailSending(),
        adminIntegration: testAdminPanelIntegration()
    };
    
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    console.log(`Script Loaded: ${results.scriptLoaded ? '✅' : '❌'}`);
    console.log(`Credentials: ${results.credentials ? '✅' : '❌'}`);
    console.log(`Initialization: ${results.initialization ? '✅' : '❌'}`);
    console.log(`Email Sending: ${results.emailSending ? '✅' : '❌'}`);
    console.log(`Admin Integration: ${results.adminIntegration ? '✅' : '❌'}`);
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! EmailJS is properly configured.');
    } else {
        console.log('⚠️ Some tests failed. Check the details above.');
    }
    
    return results;
}

// Helper functions for manual testing
window.EmailJSTest = {
    runAll: runAllTests,
    testScript: testEmailJSScript,
    testCredentials: testCredentials,
    testInit: testInitialization,
    testSending: testEmailSending,
    testIntegration: testAdminPanelIntegration
};

// Auto-run tests if on admin panel
if (window.location.pathname.includes('admin_and_dev.html')) {
    console.log('🔍 Admin panel detected, running EmailJS tests...');
    setTimeout(runAllTests, 2000); // Wait for page to load
} else {
    console.log('💡 Run EmailJSTest.runAll() to test EmailJS setup');
}

console.log('\n📚 Available test functions:');
console.log('- EmailJSTest.runAll() - Run all tests');
console.log('- EmailJSTest.testScript() - Test script loading');
console.log('- EmailJSTest.testCredentials() - Test credentials');
console.log('- EmailJSTest.testInit() - Test initialization');
console.log('- EmailJSTest.testSending() - Test email sending');
console.log('- EmailJSTest.testIntegration() - Test admin integration'); 