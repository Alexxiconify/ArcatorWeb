// Test SMTP Server Status
const https = require('https');
const http = require('http');

const SMTP_SERVER_URL = 'http://apollo.arcator.co.uk:3001';

async function testSMTPConnection() {
  console.log('🔍 Testing SMTP Server Connection');
  console.log('================================');
  console.log(`Server URL: ${SMTP_SERVER_URL}`);
  console.log('');

  try {
    // Test basic connectivity
    console.log('1. Testing basic connectivity...');
    const response = await fetch(`${SMTP_SERVER_URL}/health`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ SMTP server is running!');
      console.log('Status:', data);
    } else {
      console.log('❌ SMTP server responded with error:', response.status);
    }
  } catch (error) {
    console.log('❌ SMTP server is not accessible');
    console.log('Error:', error.message);
    console.log('');
    
    // Provide troubleshooting steps
    console.log('🔧 Troubleshooting Steps:');
    console.log('1. Check if the SMTP server is running on Apollo');
    console.log('2. Verify firewall settings allow port 3001');
    console.log('3. Check if the service is started: systemctl status arcator-smtp');
    console.log('4. Check logs: journalctl -u arcator-smtp -f');
    console.log('5. Restart the service: sudo systemctl restart arcator-smtp');
    console.log('');
    console.log('📧 Alternative: Use EmailJS as fallback');
  }
}

// Run the test
testSMTPConnection().catch(console.error); 