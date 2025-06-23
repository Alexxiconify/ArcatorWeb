<!DOCTYPE html>
<html lang="en">
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In / Register - Arcator.co.uk</title>
<!-- Tailwind CSS CDN -->
<script src="https://cdn.tailwindcss.com"></script>
<!-- Google Fonts - Inter -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <!-- Link to theme_variables.css for centralized CSS variables -->
  <link rel="stylesheet" href="theme_variables.css">
    <!-- Link to sign.css for page-specific styling -->
    <link rel="stylesheet" href="sign.css">
    </head>
    <body class="bg-gray-900 text-gray-100 flex items-center justify-center min-h-screen antialiased">

    <!-- Loading Spinner -->
    <div id="loading-spinner" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 hidden">
      <div class="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-100"></div>
    </div>

    <div class="flex flex-col items-center justify-center w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-xl relative mx-4">
      <h1 class="text-4xl font-extrabold text-white mb-8 text-center">Welcome</h1>

      <!-- Message Box Container -->
      <div id="message-box" class="w-full mb-4 p-3 rounded-md text-sm font-medium text-center hidden"></div>

      <!-- Sign In Section -->
      <div id="signin-section" class="w-full">
        <h2 class="text-2xl font-bold text-white mb-6 text-center">Sign In</h2>
        <div class="mb-4">
          <label for="signin-email" class="block text-gray-300 text-sm font-bold mb-2">Email</label>
          <input type="email" id="signin-email" placeholder="email@example.com"
                 class="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 border-gray-600 focus:border-transparent transition duration-200">
        </div>
        <div class="mb-6">
          <label for="signin-password" class="block text-gray-300 text-sm font-bold mb-2">Password</label>
          <input type="password" id="signin-password" placeholder="********"
                 class="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 border-gray-600 focus:border-transparent transition duration-200">
        </div>
        <div class="flex items-center justify-between mb-4">
          <button id="signin-btn"
                  class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full focus:outline-none focus:shadow-outline transition duration-200 flex-grow mr-2">
            Sign In
          </button>
          <a href="#" id="go-to-forgot-password" class="inline-block align-baseline font-bold text-sm text-blue-400 hover:text-blue-200 transition duration-200">
            Forgot Password?
          </a>
        </div>
        <p class="text-center text-gray-400 text-sm">
          Don't have an account? <a href="#" id="go-to-signup" class="text-blue-400 hover:text-blue-200 font-bold transition duration-200">Sign Up</a>
        </p>
      </div>

      <!-- Sign Up Section -->
      <div id="signup-section" class="w-full hidden">
        <h2 class="text-2xl font-bold text-white mb-6 text-center">Register</h2>
        <div class="mb-4">
          <label for="signup-display-name" class="block text-gray-300 text-sm font-bold mb-2">Display Name</label>
          <input type="text" id="signup-display-name" placeholder="Your Unique Name"
                 class="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-700 border-gray-600 focus:border-transparent transition duration-200">
        </div>
        <div class="mb-4">
          <label for="signup-email" class="block text-gray-300 text-sm font-bold mb-2">Email</label>
          <input type="email" id="signup-email" placeholder="email@example.com"
                 class="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-700 border-gray-600 focus:border-transparent transition duration-200">
        </div>
        <div class="mb-4">
          <label for="signup-password" class="block text-gray-300 text-sm font-bold mb-2">Password</label>
          <input type="password" id="signup-password" placeholder="********"
                 class="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-700 border-gray-600 focus:border-transparent transition duration-200">
        </div>
        <div class="mb-6">
          <label for="signup-confirm-password" class="block text-gray-300 text-sm font-bold mb-2">Confirm Password</label>
          <input type="password" id="signup-confirm-password" placeholder="********"
                 class="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-700 border-gray-600 focus:border-transparent transition duration-200">
        </div>
        <div class="flex items-center justify-center mb-4">
          <button id="signup-btn"
                  class="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-full focus:outline-none focus:shadow-outline transition duration-200">
            Register
          </button>
        </div>
        <p class="text-center text-gray-400 text-sm">
          Already have an account? <a href="#" id="go-to-signin" class="text-blue-400 hover:text-blue-200 font-bold transition duration-200">Sign In</a>
        </p>
      </div>

      <!-- Forgot Password Section -->
      <div id="forgot-password-section" class="w-full hidden">
        <h2 class="text-2xl font-bold text-white mb-6 text-center">Reset Password</h2>
        <div class="mb-4">
          <label for="forgot-email" class="block text-gray-300 text-sm font-bold mb-2">Email</label>
          <input type="email" id="forgot-email" placeholder="email@example.com"
                 class="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-100 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-700 border-gray-600 focus:border-transparent transition duration-200">
        </div>
        <div class="flex items-center justify-center mb-4">
          <button id="reset-password-btn"
                  class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full focus:outline-none focus:shadow-outline transition duration-200">
            Send Reset Email
          </button>
        </div>
        <p class="text-center text-gray-400 text-sm">
          Remembered your password? <a href="#" id="go-to-signin-from-forgot" class="text-blue-400 hover:text-blue-200 font-bold transition duration-200">Sign In</a>
        </p>
      </div>

      <!-- Custom Confirm Modal (Hidden by default) -->
      <div id="custom-confirm-modal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 hidden">
        <div class="bg-gray-800 rounded-lg p-8 shadow-xl max-w-sm w-full mx-4">
          <h3 id="confirm-title" class="text-lg font-bold text-white mb-4"></h3>
          <p id="confirm-message" class="text-gray-300 mb-6"></p>
          <div class="flex justify-end">
            <button id="confirm-yes" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full mr-4 transition duration-200">Yes</button>
            <button id="confirm-no" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition duration-200">Cancel</button>
          </div>
        </div>
      </div>

    </div>

    <!-- Your main JavaScript file -->
    <script type="module" src="./sign.js?v=2"></script>
    <script type="module" src="./utils.js"></script>

    </body>
  </html>
