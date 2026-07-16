/**
 * Email service — placeholder transport.
 * Swap the console.log for nodemailer/SendGrid/Resend once SMTP creds
 * are set in .env. Kept isolated here so authController never talks to
 * a mail provider directly.
 */
const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_HOST) {
    console.log('--- [EduKnight] Email (dev mode, not actually sent) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(html);
    console.log('--------------------------------------------------------');
    return;
  }

  // Example real implementation with nodemailer, once SMTP_* env vars are set:
  //
  // const nodemailer = require('nodemailer');
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST,
  //   port: process.env.SMTP_PORT,
  //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // });
  // await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
};

const sendVerificationEmail = (user, code) =>
  sendEmail({
    to: user.email,
    subject: 'Verify your EduKnight account',
    html: `<p>Hi ${user.name},</p><p>Your verification code is <strong>${code}</strong>. It expires in 30 minutes.</p>`,
  });

const sendPasswordResetEmail = (user, resetUrl) =>
  sendEmail({
    to: user.email,
    subject: 'Reset your EduKnight password',
    html: `<p>Hi ${user.name},</p><p>Reset your password using this link (valid for 15 minutes):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail };