// SMTP combined module: server and integration
// --- Server-side (Node.js/Express) ---
const nodemailer = require("nodemailer");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs").promises;
const path = require("path");
const SMTP_CONFIG = {
  host: "localhost",
  port: 587,
  secure: false,
  auth: { user: "noreply@arcator.co.uk", pass: "your-secure-password" },
  tls: { rejectUnauthorized: false },
};
const EMAIL_TEMPLATES = {
  welcome: { subject: "Welcome to Arcator.co.uk!", html: `<div>...</div>` },
  announcement: { subject: "Arcator.co.uk - {{subject}}", html: `<div>...</div>` },
  maintenance: { subject: "Arcator.co.uk - Maintenance Notice", html: `<div>...</div>` },
  event: { subject: "Arcator.co.uk - Event Invitation", html: `<div>...</div>` },
};
let transporter = null;
async function initializeTransporter() {
  try {
    transporter = nodemailer.createTransport(SMTP_CONFIG);
    await transporter.verify();
    return true;
  } catch (error) { return false; }
}
async function sendEmail(emailData) {
  if (!transporter) throw new Error("SMTP transporter not initialized");
  const { to, subject, content, template = "custom", isHtml = false, from = "noreply@arcator.co.uk" } = emailData;
  let emailSubject = subject, emailContent = content;
  if (template !== "custom" && EMAIL_TEMPLATES[template]) {
    const templateData = EMAIL_TEMPLATES[template];
    emailSubject = templateData.subject.replace("{{subject}}", subject);
    emailContent = templateData.html.replace("{{content}}", content).replace("{{name}}", to.split("@")[0]);
  }
  const mailOptions = { from, to, subject: emailSubject, text: isHtml ? null : emailContent, html: isHtml ? emailContent : null };
  const result = await transporter.sendMail(mailOptions);
  return { success: true, messageId: result.messageId, response: result.response };
}
async function sendBulkEmails(emails) {
  const results = [];
  for (const email of emails) {
    try { results.push({ ...(await sendEmail(email)), email: email.to }); }
    catch (error) { results.push({ success: false, error: error.message, email: email.to }); }
  }
  return results;
}
const app = express();
const PORT = process.env.SMTP_PORT || 3001;
app.use(cors());
app.use(bodyParser.json());
app.get("/health", (req, res) => {
  res.json({ status: "ok", smtp: transporter ? "connected" : "disconnected", timestamp: new Date().toISOString() });
});
app.post("/send-email", async (req, res) => {
  try { res.json(await sendEmail(req.body)); }
  catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.post("/send-bulk-emails", async (req, res) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails)) return res.status(400).json({ success: false, error: "emails must be an array" });
    res.json({ success: true, results: await sendBulkEmails(emails) });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.post("/test-connection", async (req, res) => {
  try {
    const isConnected = await initializeTransporter();
    res.json({ success: isConnected, message: isConnected ? "SMTP connection successful" : "SMTP connection failed" });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
async function startServer() {
  try {
    await initializeTransporter();
    app.listen(PORT, () => {
      console.log(`SMTP server running on port ${PORT}`);
    });
  } catch (error) { process.exit(1); }
}
if (require.main === module) { startServer(); }
// --- Client-side (browser/Firebase Cloud Functions) ---
// (ESM/Browser compatible)
// Only export if running in browser/ESM
export async function initializeFirebaseFunctionsURL(app) {
  try {
    const projectId = app.options.projectId;
    return `https://us-central1-${projectId}.cloudfunctions.net`;
  } catch (error) { return null; }
}
export async function testSMTPServerConnection(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/getSMTPStatus`, { method: "GET", headers: { "Content-Type": "application/json" } });
    const result = await response.json();
    return result.success ? { success: true, message: "SMTP server is healthy and ready", status: result.status } : { success: false, message: result.error || "SMTP server health check failed" };
  } catch (error) { return { success: false, message: `Connection error: ${error.message}` }; }
}
export async function sendEmailViaSMTP(baseUrl, db, appId, emailData) {
  try {
    const emailHistoryRef = collection(db, `artifacts/${appId}/public/data/email_history`);
    const emailDoc = { to: emailData.to, from: emailData.from || "no-reply.aractor@gmail.com", subject: emailData.subject, content: emailData.content || emailData.html || emailData.text || "", isHtml: !!emailData.isHtml || !!emailData.html, status: "pending", method: "smtp", createdAt: serverTimestamp(), completedAt: null, errorMessage: null };
    const docRef = await addDoc(emailHistoryRef, emailDoc);
    return { success: true, messageId: docRef.id, message: "Email queued for sending via SMTP server" };
  } catch (error) { return { success: false, error: error.message }; }
}
export async function sendBulkEmailsViaSMTP(baseUrl, emails) {
  try {
    const response = await fetch(`${baseUrl}/sendBulkEmails`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails }) });
    const result = await response.json();
    return result.success ? { success: true, message: "Bulk emails sent successfully via SMTP server", result: result.result } : { success: false, error: result.error || "Failed to send bulk emails" };
  } catch (error) { return { success: false, error: error.message }; }
}
export function getSMTPServerStatus(baseUrl) {
  return { connected: !!baseUrl, ready: !!baseUrl };
}
export async function initializeSMTPIntegration(app) {
  const baseUrl = await initializeFirebaseFunctionsURL(app);
  return baseUrl ? { success: true, baseUrl } : { success: false, error: "Failed to initialize Firebase Functions URL" };
}
module.exports = { sendEmail, sendBulkEmails, initializeTransporter, EMAIL_TEMPLATES, startServer };
