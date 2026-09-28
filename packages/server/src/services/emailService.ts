import nodemailer from "nodemailer";
import { env } from "@/config/env";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.email.user,
    pass: env.email.appPassword,
  },
});

export async function sendLoginCodeEmail(
  to: string,
  code: string
) {
  await transporter.sendMail({
    from: `"Wavelength" <${env.email.user}>`,
    to,
    subject: "Your Wavelength login code",

    text: `Your Wavelength login code is: ${code}

This code expires in 10 minutes.

If you didn't request this code, you can safely ignore this email.`,

    html: `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 420px;
        margin: 0 auto;
        padding: 24px;
      ">
        <h2 style="color: #111;">
          Your Wavelength login code
        </h2>

        <p style="color: #555;">
          Use the following code to sign in:
        </p>

        <div style="
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 8px;
          color: #10b981;
          margin: 24px 0;
        ">
          ${code}
        </div>

        <p style="color: #666; font-size: 14px;">
          This code expires in 10 minutes.
        </p>

        <p style="color: #666; font-size: 14px;">
          If you didn't request this code, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

async function sendSecurityEmail(to: string, subject: string, title: string, actionUrl: string, actionLabel: string, expiry: string) {
  await transporter.sendMail({
    from: `"Wavelength" <${env.email.user}>`,
    to,
    subject,
    text: `${title}\n\nOpen this link to continue: ${actionUrl}\n\nThis link expires in ${expiry}. If you didn't request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222"><h2>${title}</h2><p>Use the button below to continue.</p><p><a href="${actionUrl}" style="display:inline-block;padding:12px 18px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px">${actionLabel}</a></p><p>This link expires in ${expiry}. If you didn't request this, you can ignore this email.</p></div>`,
  });
}

export function sendPasswordResetEmail(to: string, token: string) {
  const actionUrl = `${env.webAppUrl}/reset-password#token=${encodeURIComponent(token)}`;
  return sendSecurityEmail(to, "Reset your Wavelength password", "Reset your password", actionUrl, "Choose a new password", "30 minutes");
}

export function sendEmailChangeVerification(to: string, token: string) {
  const actionUrl = `${env.webAppUrl}/verify-email-change#token=${encodeURIComponent(token)}`;
  return sendSecurityEmail(to, "Confirm your Wavelength email", "Confirm your new email address", actionUrl, "Confirm email address", "30 minutes");
}
