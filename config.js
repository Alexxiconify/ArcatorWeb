// sensitive/config.js
// Combined sensitive configuration for all environments (Node.js style)
// DO NOT commit this file to version control

module.exports = {
    // Firebase configuration (for Node.js/server)
    FIREBASE_CONFIG: {
    apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
    authDomain: "arcator-web.firebaseapp.com",
    databaseURL: "https://arcator-web-default-rtdb.firebaseio.com",
    projectId: "arcator-web",
    storageBucket: "arcator-web.firebasestorage.app",
    messagingSenderId: "1033082068049",
        appId: "1:1033082068049:web:dd154c8b188bde1930ec70",
    measurementId: "G-DJXNT1L7CM"
    },

    // ImgBB API key for image uploads
    IMGBB_API_KEY: "YOUR_IMGBB_API_KEY", // Replace with actual key

    // Giphy API key for GIF search
    GIPHY_API_KEY: "dc6zaTOxFJmzC", // Giphy public beta key

    // EmailJS configuration
    EMAILJS_CONFIG: {
    publicKey: "YOUR_EMAILJS_PUBLIC_KEY",
    serviceId: "YOUR_EMAILJS_SERVICE_ID",
    templateId: "YOUR_EMAILJS_TEMPLATE_ID"
    },

    // SMTP Server configuration
    SMTP_SERVER_URL: "https://apollo.arcator.co.uk:3001",
    SMTP_SERVER_CONFIG: {
    host: "smtp.gmail.com",
    port: 587,
    user: "no-reply.aractor@gmail.com",
    pass: "ArcatorAppS3rver!2024",
    },

    // Test email configuration
    TEST_EMAIL: {
    to: "taylorallred04@gmail.com",
    from: "no-reply.aractor@gmail.com",
    },

    // Other sensitive configuration
    FIREBASE_PROJECT_ID: "arcator-web",
    FIREBASE_REGION: "us-central1",
};