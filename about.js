// about.js - About page functionality
import {showMessageBox} from './utils.js';

export async function initializeAboutPage() {
    try {
        console.log("About page functionality initialized");

        // Add any about page specific functionality here
        // For now, just a placeholder

    } catch (error) {
        console.error("Error initializing about page:", error);
        showMessageBox("Failed to initialize about page functionality", true);
    }
}