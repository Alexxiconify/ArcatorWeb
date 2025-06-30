# Production Deployment Checklist

The following files and folders should be present on a production server:

## Root Directory

- 404.html
- about.html
- admin.html
- admin.js
- announcements.js
- app.js
- census-data.json
- core.js
- custom_theme_modal.js
- dms.js
- emoji-picker.js
- emojii.json
- favicon.png
- firebase-init.js
- firebase.json
- firestore.indexes.json
- firestore.rules
- forms.css
- forms.html
- forms.js
- icon.png
- icon.svg
- index.html
- master.css
- master.js
- navbar.js
- page-specific.css
- privacy.html
- robots.txt
- servers-and-games.html
- site.webmanifest
- smtp-integration.js
- smtp-server.js
- temp-page-viewer.html
- theme_variables.css
- themes.js
- user-main.js
- users.html
- utils.js

## Folders

- node_modules/ (if using server-side Node.js)
- sensitive/ (with only firebase-config.js for browser, if needed)

---

# Development Files

This folder contains development files, tools, and documentation that are not needed for the production website.

## Files Overview

### Setup Scripts

- **deploy-smtp-apollo.ps1** - PowerShell script to deploy SMTP server to apollo.arcator.co.uk
- **setup-smtp-apollo.sh** - Bash script to set up SMTP server on the server

### Configuration Files

- **apollo_key** - SSH private key for server access
- **pglite-debug.log** - Debug log file

## Usage

These files are for development and setup purposes only. They should not be deployed to production.

### Running Setup Scripts

1. **Deploy SMTP Server:**
   ```bash
   # On Windows
   .\deploy-smtp-apollo.ps1

   # On Linux/Mac
   chmod +x setup-smtp-apollo.sh
   ./setup-smtp-apollo.sh
   ```

## Security Notes

- The `apollo_key` file contains sensitive SSH credentials
- These files are excluded from version control via `.gitignore`
- Keep these files secure and do not share them publicly

## Maintenance

- Update setup guides when configuration changes
- Keep deployment scripts current with server configurations
