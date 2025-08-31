// sensitive/config.js
// Combined sensitive configuration for all environments
// DO NOT commit this file to version control

// Firebase configuration (ES6 export for browser compatibility)
export const firebaseConfig = {
    apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
    authDomain: "arcator-web.firebaseapp.com",
    databaseURL: "https://arcator-web-default-rtdb.firebaseio.com",
    projectId: "arcator-web",
    storageBucket: "arcator-web.firebasestorage.app",
    messagingSenderId: "1033082068049",
    appId: "1:1033082068049:web:dd154b8b188bde1930ec70",
    measurementId: "G-DJXNT1L7CM"
};

// ImgBB API key for image uploads
export const IMGBB_API_KEY = "YOUR_IMGBB_API_KEY"; // Replace with actual key

// Giphy API key for GIF search
export const GIPHY_API_KEY = "dc6zaTOxFJmzC"; // Giphy public beta key

// EmailJS configuration
export const EMAILJS_CONFIG = {
    publicKey: "YOUR_EMAILJS_PUBLIC_KEY",
    serviceId: "YOUR_EMAILJS_SERVICE_ID",
    templateId: "YOUR_EMAILJS_TEMPLATE_ID"
};

// SMTP Server configuration
export const SMTP_SERVER_URL = "https://apollo.arcator.co.uk:3001";
export const SMTP_SERVER_CONFIG = {
    host: "smtp.gmail.com",
    port: 587,
    user: "no-reply.aractor@gmail.com",
    pass: "ArcatorAppS3rver!2024",
};

// Test email configuration
export const TEST_EMAIL = {
    to: "taylorallred04@gmail.com",
    from: "no-reply.aractor@gmail.com",
};

// Other sensitive configuration
export const FIREBASE_PROJECT_ID = "arcator-web";
export const FIREBASE_REGION = "us-central1";

// Legacy Node.js style export for backward compatibility
export default {
    firebaseConfig,
    IMGBB_API_KEY,
    GIPHY_API_KEY,
    EMAILJS_CONFIG,
    SMTP_SERVER_URL,
    SMTP_SERVER_CONFIG,
    TEST_EMAIL,
    FIREBASE_PROJECT_ID,
    FIREBASE_REGION
};