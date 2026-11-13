import { NextRequest, NextResponse } from 'next/server';
import { createInquiryInDb } from '@/lib/db/repositories/inquiries';
import { addNotification } from '@/lib/db/notifications';
import { sendInquiryEmails } from '@/lib/email';
import { InquiryType } from '@/types/admin';
import { checkRateLimit, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';

// In-memory rate limiting map for basic spam / double-click protection:
// Tracks client IP or phone + timestamp
// Submission rate limiting now managed centrally via lib/rateLimit

const VALID_INQUIRY_TYPES: InquiryType[] = [
  'General Question',
  'Product Inquiry',
  'Order Issue',
  'Delivery Issue',
  'Return / Replacement',
  'Warranty',
  'Complaint',
  'Payment Issue',
  'Other',
];

function sanitizeString(str: any): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '') // Strip < and > to prevent HTML/script injection
    .trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request payload.' },
        { status: 400 }
      );
    }

    // Honeypot check: reject bots silently if honeypot fields are populated
    if (body.website || body.company || body.hp || body.url) {
      return NextResponse.json({
        success: true,
        referenceNumber: 'INQ-ACKNOWLEDGED',
        message: 'Thank you for reaching out. Your inquiry has been received.',
      });
    }

    // Rate Limiting: 5 per hour per IP, 3 per hour per phone/email
    const clientIp = getClientIp(request);
    const ipCheck = await checkRateLimit(`contact_ip_${clientIp}`, 5, 3600000);
    if (!ipCheck.allowed) {
      return createRateLimitResponse(ipCheck.retryAfterSeconds, 'Too many inquiries from this network.');
    }

    const contactId = (body.email || body.phone || '').trim().toLowerCase();
    if (contactId) {
      const idCheck = await checkRateLimit(`contact_id_${contactId}`, 3, 3600000);
      if (!idCheck.allowed) {
        return createRateLimitResponse(idCheck.retryAfterSeconds, 'Too many inquiries submitted for this contact.');
      }
    }

    // Input Sanitization & Validation
    const name = sanitizeString(body.name);
    const email = body.email ? String(body.email).trim() : '';
    const phone = sanitizeString(body.phone);
    const rawInquiryType = String(body.inquiryType || '').trim();
    const orderNumber = sanitizeString(body.orderNumber);
    const subject = sanitizeString(body.subject);
    const message = sanitizeString(body.message);

    // 1. Name validation
    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Full Name is required (minimum 2 characters).' },
        { status: 400 }
      );
    }
    if (name.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Full Name cannot exceed 100 characters.' },
        { status: 400 }
      );
    }

    // 2. Email validation (Optional, but if provided must be valid)
    if (email) {
      if (email.length > 200 || !isValidEmail(email)) {
        return NextResponse.json(
          { success: false, error: 'Please enter a valid email address.' },
          { status: 400 }
        );
      }
    }

    // 3. Phone validation (Required)
    if (!phone || phone.length < 7) {
      return NextResponse.json(
        { success: false, error: 'Valid Phone Number is required (minimum 7 characters).' },
        { status: 400 }
      );
    }
    if (phone.length > 30) {
      return NextResponse.json(
        { success: false, error: 'Phone Number cannot exceed 30 characters.' },
        { status: 400 }
      );
    }

    // 4. Inquiry Type validation
    if (!rawInquiryType || !VALID_INQUIRY_TYPES.includes(rawInquiryType as InquiryType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Please select a valid Inquiry Type. Supported options: ${VALID_INQUIRY_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }
    const inquiryType = rawInquiryType as InquiryType;

    // 5. Order Number validation (Optional)
    if (orderNumber && orderNumber.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Order Number cannot exceed 100 characters.' },
        { status: 400 }
      );
    }

    // 6. Subject validation
    if (!subject || subject.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Subject is required (minimum 3 characters).' },
        { status: 400 }
      );
    }
    if (subject.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Subject cannot exceed 200 characters.' },
        { status: 400 }
      );
    }

    // 7. Message validation
    if (!message || message.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Message is required (minimum 10 characters).' },
        { status: 400 }
      );
    }
    if (message.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Message cannot exceed 2,000 characters.' },
        { status: 400 }
      );
    }

    // Determine initial priority:
    // Complaints and Order Issues default to HIGH for urgent support response
    const priority =
      inquiryType === 'Complaint' || inquiryType === 'Payment Issue'
        ? 'HIGH'
        : 'NORMAL';

    // Step 1: PERSIST INQUIRY TO DATABASE FIRST
    const inquiry = await createInquiryInDb({
      name,
      email: email || null,
      phone,
      inquiryType,
      orderNumber: orderNumber || null,
      subject,
      message,
      priority,
    });



    // Step 2: Push Admin Notification (Non-blocking)
    try {
      await addNotification({
        title: `Inquiry: ${inquiry.inquiryType}`,
        message: `${inquiry.name} (${inquiry.referenceNo}): ${inquiry.subject}`,
        type: 'system',
        link: '/admin/inquiries',
      });
    } catch (notifErr) {
      console.warn('Admin notification failed safely:', notifErr);
    }

    // Step 3: Attempt Email Dispatch (Non-blocking, never fails submission)
    sendInquiryEmails({ inquiry }).catch((err) => {
      console.warn('Email dispatch failed safely:', err);
    });

    // Step 4: Return success with reference number
    return NextResponse.json(
      {
        success: true,
        referenceNumber: inquiry.referenceNo,
        message:
          'Your inquiry has been submitted successfully. Our support team will review your message and get back to you as soon as possible.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    // Critical: Do NOT expose internal database errors or stack traces to customers
    console.error('Unhandled error during customer inquiry submission:', err);
    return NextResponse.json(
      {
        success: false,
        error:
          'An unexpected error occurred while submitting your inquiry. Please try again or reach our support team via telephone or WhatsApp.',
      },
      { status: 500 }
    );
  }
}
