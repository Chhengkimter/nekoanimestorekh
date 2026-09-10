const nodemailer = require('nodemailer');
const { SMTP_USER, SMTP_PASS, FRONTEND_URL } = require('../config/env');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

class EmailService {
  static async sendVerificationEmail(email, firstName, token) {
    const link = `${FRONTEND_URL}/pages/verify-email.html?token=${token}`;
    const subject = 'Verify your email — Neko Animestore';

    const html = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #82659D; padding: 20px; text-align: center;">
          <h1 style="color: #fff; margin: 0;">Neko Animestore</h1>
        </div>
        <div style="padding: 20px;">
          <p>Hi ${firstName},</p>
          <p>Welcome to Neko Animestore! Please click the button below to verify your email address.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" style="background-color: #82659D; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${link}" style="color: #B99CC8;">${link}</a></p>
          <p style="font-size: 12px; color: #777;">This link expires in 24 hours.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 10px; text-align: center; font-size: 12px; color: #777;">
          <p>&copy; ${new Date().getFullYear()} Neko Animestore. All rights reserved.</p>
        </div>
      </div>
    `;

    const text = `Hi ${firstName},\n\nWelcome to Neko Animestore! Please verify your email by clicking the link below:\n\n${link}\n\nThis link expires in 24 hours.`;

    await transporter.sendMail({
      from: `Neko Animestore <${SMTP_USER}>`,
      to: email,
      subject,
      text,
      html,
    });
  }

  static async sendPasswordResetEmail(email, firstName, token) {
    const link = `${FRONTEND_URL}/pages/reset-password.html?token=${token}`;
    const subject = 'Reset your password — Neko Animestore';

    const html = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #82659D; padding: 20px; text-align: center;">
          <h1 style="color: #fff; margin: 0;">Neko Animestore</h1>
        </div>
        <div style="padding: 20px;">
          <p>Hi ${firstName},</p>
          <p>We received a request to reset your password for your Neko Animestore account. Click the button below to choose a new password.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" style="background-color: #82659D; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${link}" style="color: #B99CC8;">${link}</a></p>
          <p style="font-size: 12px; color: #777;">This link expires in 20 minutes. If you did not request a password reset, please ignore this email.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 10px; text-align: center; font-size: 12px; color: #777;">
          <p>&copy; ${new Date().getFullYear()} Neko Animestore. All rights reserved.</p>
        </div>
      </div>
    `;

    const text = `Hi ${firstName},\n\nWe received a request to reset your password. Click the link below to choose a new password:\n\n${link}\n\nThis link expires in 20 minutes.`;

    await transporter.sendMail({
      from: `Neko Animestore <${SMTP_USER}>`,
      to: email,
      subject,
      text,
      html,
    });
  }
}

module.exports = EmailService;
