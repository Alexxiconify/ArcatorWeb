# Sensitive Files

This folder contains sensitive configuration files, API keys, and credentials that should NEVER be committed to version
control.

## Files Overview

### `config.js`

Combined sensitive configuration for all environments (Node.js style):

- Firebase project configuration
- ImgBB API key for image uploads
- Giphy API key for GIF search
- EmailJS configuration
- SMTP server configuration
- Test email configuration
- Other sensitive project settings

### `firebase-config.js`

Contains Firebase project configuration for browser/ESM usage:

- Firebase API key
- Project ID and domain settings
- Storage bucket configuration
- Messaging sender ID
- App ID and measurement ID

## Security Notes

⚠️ **IMPORTANT**: These files contain real credentials and API keys. Never commit them to version control or share them
publicly.

- This folder is excluded from version control via `.gitignore`.
- Keep these files secure and update them only as needed.

## File Structure

```
sensitive/
├── README.md           # This file
├── config.js           # Combined sensitive configuration
└── firebase-config.js  # Firebase project configuration
```

## Usage in Code

Files in this folder are imported by:

- `functions/index.js` - Uses `functions-config.js`
- `utils.js` - Uses `api-keys.js` for ImgBB API
- `emoji-picker.js` - Uses `api-keys.js` for Giphy API
- `firebase-init.js` - Uses `firebase-config.js` for Firebase config
- `core.js` - Uses `firebase-config.js` for Firebase config
