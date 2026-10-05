import { CustomerInquiry } from '@/types/admin';

interface SendInquiryNotificationOptions {
  inquiry: CustomerInquiry;
  adminEmail?: string;
}

/**
 * Safe, non-blocking email notification dispatcher.
 * Database persistence is NEVER dependent on email delivery.
 * Catches all errors and never exposes credentials or causes user-facing failures.
 */
export async function sendInquiryEmails({
  inquiry,
  adminEmail = 'support@alhamd-mobile.com',
}: SendInquiryNotificationOptions): Promise<{ adminSent: boolean; customerSent: boolean }> {
  let adminSent = false;
  let customerSent = false;

  try {
    // 1. Check if email transport / webhook environment variables are provided
    const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST;
    const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER;
    const emailWebhook = process.env.EMAIL_WEBHOOK_URL;

    if (!smtpHost && !smtpUser && !emailWebhook) {
      // No external email credentials configured in environment.
      // Admin panel and internal notifications are the primary source of truth.
      return { adminSent: false, customerSent: false };
    }

    // If an external webhook is provided, dispatch asynchronously
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
      } catch (err: any) {
        console.warn('[Email Webhook] Notification could not be delivered:', err?.message || 'Network error');
      }
    }
  } catch (err: any) {
    // Fail safely: never throw from email dispatcher
    console.warn('[Email Notification] Skipped or failed safely:', err?.message || 'Unknown error');
  }

  return { adminSent, customerSent };
}
