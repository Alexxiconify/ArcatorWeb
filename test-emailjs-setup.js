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
    
    try {
        const saved = localStorage.getItem('emailjs_credentials');
        if (saved) {
            const creds = JSON.parse(saved);
            console.log('✅ Credentials found in localStorage:');
            console.log('   Public Key:', creds.publicKey ? '✅ Configured' : '❌ Missing');
            console.log('   Service ID:', creds.serviceId || '❌ Not configured');
            console.log('   Template ID:', creds.templateId || '❌ Not configured');
            return creds;
        } else {
            console.log('❌ No credentials found in localStorage');
            console.log('💡 Use the "Configure EmailJS" button in the admin panel');
            return null;
        }
    } catch (error) {
        console.log('❌ Error reading credentials:', error.message);
        return null;
    }
}

// Test 3: Test EmailJS initialization
async function testInitialization() {
    console.log('\n🚀 Test 3: EmailJS Initialization');
    console.log('----------------------------------');
    
    try {
        // Import the EmailJS integration
        const { EmailJSIntegration } = await import('./emailjs-integration.js');
        
        const status = EmailJSIntegration.getEmailJSStatus();
        console.log('📊 EmailJS Status:');
        console.log('   Script Loaded:', status.loaded ? '✅ Yes' : '❌ No');
        console.log('   Initialized:', status.initialized ? '✅ Yes' : '❌ No');
        console.log('   Has Credentials:', status.hasCredentials ? '✅ Yes' : '❌ No');
        console.log('   Public Key:', status.publicKey);
        console.log('   Service ID:', status.serviceId);
        console.log('   Template ID:', status.templateId);
        
        if (status.hasCredentials) {
            const testResult = await EmailJSIntegration.testEmailJSConnection();
            console.log('🔗 Connection Test:', testResult.success ? '✅ Success' : '❌ Failed');
            if (!testResult.success) {
                console.log('   Error:', testResult.error);
            }
        }
        
        return status;
    } catch (error) {
        console.log('❌ Error testing initialization:', error.message);
        return null;
    }
}

// Test 4: Test email sending (simulation)
async function testEmailSending() {
    console.log('\n📧 Test 4: Email Sending Simulation');
    console.log('------------------------------------');
    
    try {
        const { EmailJSIntegration } = await import('./emailjs-integration.js');
        
        const status = EmailJSIntegration.getEmailJSStatus();
        if (!status.hasCredentials) {
            console.log('❌ Cannot test email sending - credentials not configured');
            return false;
        }
        
        console.log('✅ Credentials configured, ready for email sending');
        console.log('💡 To send a test email, use the admin panel email form');
        
        return true;
    } catch (error) {
        console.log('❌ Error testing email sending:', error.message);
        return false;
    }
}

// Test 5: Check admin panel integration
function testAdminPanelIntegration() {
    console.log('\n⚙️ Test 5: Admin Panel Integration');
    console.log('-----------------------------------');
    
    const testBtn = document.getElementById('test-emailjs-btn');
    const configBtn = document.getElementById('configure-emailjs-btn');
    const statusDisplay = document.getElementById('emailjs-status-display');
    
    if (testBtn) {
        console.log('✅ Test EmailJS button found');
    } else {
        console.log('❌ Test EmailJS button not found');
    }
    
    if (configBtn) {
        console.log('✅ Configure EmailJS button found');
    } else {
        console.log('❌ Configure EmailJS button not found');
    }
    
    if (statusDisplay) {
        console.log('✅ EmailJS status display found');
    } else {
        console.log('❌ EmailJS status display not found');
    }
    
    return !!(testBtn && configBtn && statusDisplay);
}

// Run all tests
async function runAllTests() {
    console.log('🧪 Running all EmailJS tests...\n');
    
    const results = {
        script: testEmailJSScript(),
        credentials: testCredentials(),
        initialization: await testInitialization(),
        emailSending: await testEmailSending(),
        adminPanel: testAdminPanelIntegration()
    };
    
    console.log('\n📊 Test Summary');
    console.log('===============');
    console.log('Script Loading:', results.script ? '✅ Pass' : '❌ Fail');
    console.log('Credentials:', results.credentials ? '✅ Pass' : '❌ Fail');
    console.log('Initialization:', results.initialization?.hasCredentials ? '✅ Pass' : '❌ Fail');
    console.log('Email Sending:', results.emailSending ? '✅ Pass' : '❌ Fail');
    console.log('Admin Panel:', results.adminPanel ? '✅ Pass' : '❌ Fail');
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 EmailJS is fully configured and ready to use!');
    } else {
        console.log('⚠️ Some tests failed. Check the configuration.');
    }
    
    return results;
}

// Make functions available globally
window.testEmailJSSetup = {
    testEmailJSScript,
    testCredentials,
    testInitialization,
    testEmailSending,
    testAdminPanelIntegration,
    runAllTests
};

console.log('💡 Run testEmailJSSetup.runAllTests() to test everything'); 