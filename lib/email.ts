import { CustomerInquiry } from '@/types/admin';
import nodemailer, { type Transporter } from 'nodemailer';

interface SendInquiryNotificationOptions {
  inquiry: CustomerInquiry;
  adminEmail?: string;
}

export interface SendPasswordResetOptions {
  to: string;
  resetUrl: string;
  userName?: string;
  userType?: 'customer' | 'staff';
  expiresInMinutes?: number;
}

export interface EmailDeliveryResult {
  sent: boolean;
  simulated?: boolean;
  messageId?: string;
  devLink?: string;
}

/**
 * Helper to build a reusable nodemailer transporter when SMTP credentials exist.
 */
function getSmtpTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST || process.env.MAIL_HOST;
  const user = process.env.SMTP_USER || process.env.MAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.MAIL_PASS || process.env.MAIL_PASSWORD;
  const port = parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass: pass || '',
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
}

/**
 * Dispatches a secure, beautifully formatted single-use password reset email.
 * Non-blocking, fails safely, and never exposes passwords or secrets.
 */
export async function sendPasswordResetEmail({
  to,
  resetUrl,
  userName = 'Customer',
  userType = 'customer',
  expiresInMinutes = 60,
}: SendPasswordResetOptions): Promise<EmailDeliveryResult> {
  const normalizedEmail = to.trim().toLowerCase();
  const fromAddress =
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    `"AL-HAMD Mobile" <support@alhamd-mobile.com>`;

  const isStaff = userType === 'staff';
  const portalName = isStaff ? 'Staff & Administrator Portal' : 'Customer Account Portal';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - AL-HAMD Mobile</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d0d0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f5f5f5;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d0d0d; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #171717; border-radius: 20px; border: 1px solid #2a2a2a; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <!-- Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center; border-bottom: 1px solid #262626;">
              <div style="display: inline-block; padding: 10px 18px; border-radius: 12px; background-color: #f59e0b; color: #000000; font-weight: 900; font-size: 14px; letter-spacing: 2px;">
                AL-HAMD
              </div>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 18px 0 6px 0; letter-spacing: -0.5px;">
                Password Reset Request
              </h1>
              <p style="color: #a3a3a3; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
                ${portalName}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px;">
              <p style="color: #e5e5e5; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                Hello <strong>${userName}</strong>,
              </p>
              <p style="color: #a3a3a3; font-size: 13px; line-height: 1.6; margin: 0 0 24px 0;">
                We received a request to reset the password for your account associated with <strong style="color: #f5f5f5;">${normalizedEmail}</strong>. Click the secure button below to choose a new password:
              </p>

              <!-- CTA Button -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #f59e0b; color: #000000; text-decoration: none; font-size: 13px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; border-radius: 12px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35);">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <div style="background-color: #212121; border-radius: 12px; padding: 16px; border-left: 4px solid #f59e0b; margin: 24px 0;">
                <p style="color: #d4d4d4; font-size: 11.5px; line-height: 1.5; margin: 0;">
                  <strong>Security notice:</strong> This link is strictly single-use and will expire in <strong>${expiresInMinutes} minutes</strong>. If you did not request this password reset, you can safely ignore this email; your existing password will remain unchanged.
                </p>
              </div>

              <p style="color: #737373; font-size: 11px; line-height: 1.5; margin: 24px 0 0 0; word-break: break-all;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #f59e0b; text-decoration: underline;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #121212; border-top: 1px solid #262626; text-align: center;">
              <p style="color: #525252; font-size: 11px; margin: 0 0 6px 0;">
                AL-HAMD MOBILE ACCESSORIES &bull; Premium Mobile Gear &bull; Pakistan
              </p>
              <p style="color: #404040; font-size: 10px; margin: 0;">
                This is an automated security transmission. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = `
AL-HAMD Mobile - Password Reset Request
=======================================

Hello ${userName},

We received a request to reset the password for your account (${normalizedEmail}).
Please use the following single-use link to choose your new password:

${resetUrl}

This link is valid for ${expiresInMinutes} minutes and can only be used once.
If you did not request a password reset, please disregard this email.

--
AL-HAMD MOBILE ACCESSORIES
support@alhamd-mobile.com
  `.trim();

  try {
    // 1. Check if SMTP transporter is available
    const transporter = getSmtpTransporter();
    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: fromAddress,
          to: normalizedEmail,
          subject: `Reset Your Password - AL-HAMD Mobile`,
          text: textContent,
          html: htmlContent,
        });
        return { sent: true, messageId: info.messageId };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'SMTP transmission error';
        console.warn('[Email SMTP] Delivery attempt failed:', msg);
      }
    }

    // 2. Check if an external webhook dispatcher is configured
    const emailWebhook = process.env.EMAIL_WEBHOOK_URL;
    if (emailWebhook) {
      try {
        await fetch(emailWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'PASSWORD_RESET_REQUESTED',
            email: normalizedEmail,
            userName,
            userType,
            resetUrl,
            expiresInMinutes,
            timestamp: new Date().toISOString(),
          }),
        });
        return { sent: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Webhook transmission error';
        console.warn('[Email Webhook] Delivery attempt failed:', msg);
      }
    }

    // 3. Fallback for Local Development / Missing SMTP configuration
    // Logs the reset link clearly so developers can test without external SMTP
    console.log('\n============================================================');
    console.log('[EMAIL DISPATCHER - LOCAL DEVELOPMENT MODE]');
    console.log(`To: ${normalizedEmail} (${userType})`);
    console.log(`Subject: Reset Your Password - AL-HAMD Mobile`);
    console.log(`Single-Use Reset Link: ${resetUrl}`);
    console.log(`Expires in: ${expiresInMinutes} minutes`);
    console.log('Notice: Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env for live email transmission.');
    console.log('============================================================\n');

    return { sent: false, simulated: true, devLink: resetUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[Email Notification] Password reset email dispatch failed safely:', msg);
    return { sent: false };
  }
}

/**
 * Safe, non-blocking email notification dispatcher for customer inquiries.
 */
export async function sendInquiryEmails({
  inquiry,
  adminEmail = 'support@alhamd-mobile.com',
}: SendInquiryNotificationOptions): Promise<{ adminSent: boolean; customerSent: boolean }> {
  let adminSent = false;
  let customerSent = false;

  try {
    const transporter = getSmtpTransporter();
    const emailWebhook = process.env.EMAIL_WEBHOOK_URL;

    if (!transporter && !emailWebhook) {
      return { adminSent: false, customerSent: false };
    }

    if (transporter) {
      try {
        const fromAddress =
          process.env.SMTP_FROM ||
          process.env.MAIL_FROM ||
          `"AL-HAMD Mobile" <support@alhamd-mobile.com>`;

        await transporter.sendMail({
          from: fromAddress,
          to: adminEmail,
          subject: `[New Inquiry] ${inquiry.subject} (${inquiry.referenceNo})`,
          text: `Inquiry from ${inquiry.name} (${inquiry.email}, ${inquiry.phone}):\n\n${inquiry.message}`,
        });
        adminSent = true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'SMTP delivery error';
        console.warn('[Email SMTP] Inquiry delivery failed:', msg);
      }
    }

    if (emailWebhook) {
      try {
        await fetch(emailWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'CUSTOMER_INQUIRY_CREATED',
            referenceNo: inquiry.referenceNo,
            customerName: inquiry.name,
            customerEmail: inquiry.email,
            customerPhone: inquiry.phone,
            inquiryType: inquiry.inquiryType,
            orderNumber: inquiry.orderNumber,
            subject: inquiry.subject,
            message: inquiry.message,
            adminRecipient: adminEmail,
            timestamp: inquiry.createdAt,
          }),
        });
        adminSent = true;
        customerSent = Boolean(inquiry.email);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Network error';
        console.warn('[Email Webhook] Inquiry notification could not be delivered:', msg);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[Email Notification] Skipped or failed safely:', msg);
  }

  return { adminSent, customerSent };
}
