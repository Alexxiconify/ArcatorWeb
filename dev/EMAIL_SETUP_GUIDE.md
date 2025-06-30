# Email Sending Setup Guide for Arcator.co.uk

This guide will help you set up automatic email sending from your Firebase project using SendGrid.

## Prerequisites

1. **Firebase Project**: Your existing `arcator-web` project
2. **SendGrid Account**: Free account at [sendgrid.com](https://sendgrid.com)
3. **Firebase CLI**: Install with `npm install -g firebase-tools`

## Step 1: Set Up SendGrid

### 1.1 Create SendGrid Account

- Go to [SendGrid](https://sendgrid.com/) and sign up for a free account
- Verify your email address

### 1.2 Get API Key

- In SendGrid dashboard, go to **Settings > API Keys**
- Click **Create API Key**
- Name it "Arcator Email Sending"
- Select **Full Access** or **Mail Send** permissions
- Copy the API key (you'll need it for Firebase)

### 1.3 Verify Sender Domain

- In SendGrid, go to **Settings > Sender Authentication**
- Add and verify `noreply@arcator-web.firebaseapp.com` as a sender
- Follow the DNS verification steps if needed

## Step 2: Set Up Firebase Functions

### 2.1 Initialize Functions (if not already done)

```bash
cd "C:\Users\taylo\Documents\projects\arcator website"
firebase init functions
```

- Choose JavaScript
- Use ESLint: No
- Install dependencies: Yes

### 2.2 Install Dependencies

```bash
cd functions
npm install @sendgrid/mail
```

### 2.3 Set SendGrid API Key

```bash
firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY_HERE"
```

### 2.4 Deploy Functions

```bash
firebase deploy --only functions
```

## Step 3: Test Email Sending

### 3.1 Browser Console Test

1. Go to `admin.html` in your browser
2. Open browser console (F12)
3. Copy and paste the content from `test-email-browser.js`
4. Press Enter to run the test

### 3.2 Check Results

- Check browser console for success/error messages
- Check Firebase Functions logs: `firebase functions:log`
- Check your email at `taylorallred04@gmail.com`

## Step 4: Verify Everything Works

### 4.1 Check Firestore

- Go to Firebase Console > Firestore
- Navigate to `artifacts/arcator-web/public/data/email_history`
- You should see the test email record with status updates

### 4.2 Check Functions Logs

```bash
firebase functions:log --only sendEmail
```

### 4.3 Test SendGrid Directly

```bash
firebase functions:config:get
```

Then visit: `https://us-central1-arcator-web.cloudfunctions.net/testSendGrid`

## Troubleshooting

### Common Issues

1. **"Missing required fields" error**
   - Check that email data has `to`, `subject`, and `content` fields

2. **SendGrid authentication error**
   - Verify API key is set correctly: `firebase functions:config:get`
   - Check SendGrid account status

3. **Domain verification error**
   - Ensure `noreply@arcator-web.firebaseapp.com` is verified in SendGrid

4. **Function not triggering**
   - Check Firestore rules allow admin access to `email_history`
   - Verify function is deployed: `firebase functions:list`

### Debug Commands

```bash
# Check function status
firebase functions:list

# View recent logs
firebase functions:log --only sendEmail --limit 10

# Test function locally
firebase emulators:start --only functions

# Update function config
firebase functions:config:set sendgrid.key="NEW_API_KEY"
```

## Email Templates

Your system supports these email templates:

- **Welcome Email**: For new users
- **Announcement**: For community updates
- **Maintenance**: For scheduled maintenance
- **Event**: For community events

## Security Notes

- API keys are stored securely in Firebase Functions config
- Only admin users can create email records (per Firestore rules)
- Email content is validated before sending
- Failed emails are logged with error messages

## Next Steps

Once email sending is working:

1. **Customize email templates** in `admin_and_dev.js`
2. **Add email notifications** for user actions (DMs, mentions, etc.)
3. **Set up email preferences** for users
4. **Monitor email delivery** through SendGrid dashboard

## Support

If you encounter issues:

1. Check Firebase Functions logs
2. Verify SendGrid account status
3. Test with the browser console script
4. Check Firestore rules and permissions

### 5. Configure on Your Website

#### Option A: Use the Setup Page (Recommended)

1. Open `admin.html` in your browser
