import { NextRequest, NextResponse } from 'next/server';
import { createPasswordResetToken } from '@/lib/db/repositories/passwordReset';
import { sendPasswordResetEmail } from '@/lib/email';
import { getServerCustomers } from '@/lib/db/customers-server';
import { getServerStaffUsers } from '@/lib/db/staff-server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getCustomerByEmailFromDb } from '@/lib/db/repositories/customers';
import { getStaffByEmailFromDb } from '@/lib/db/repositories/staff';

const GENERIC_SUCCESS_MESSAGE =
  'If an account associated with this email address exists, you will receive password reset instructions shortly.';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
    const portal = body.portal === 'staff' ? 'staff' : 'customer';

    if (!rawEmail || !rawEmail.includes('@') || rawEmail.length < 5) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const normalizedEmail = rawEmail.toLowerCase();
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;

    // Look up whether account exists in customer or staff records
    let userFound: { id: string; email: string; name: string; userType: 'customer' | 'staff' } | null = null;

    if (portal === 'staff') {
      if (isDbConfigured()) {
        const staff = await getStaffByEmailFromDb(normalizedEmail);
        if (staff && staff.status === 'active') {
          userFound = { id: staff.id, email: staff.email, name: staff.name, userType: 'staff' };
        }
      } else {
        const staffList = await getServerStaffUsers();
        const staff = staffList.find(
          (s) => s.email.toLowerCase() === normalizedEmail && s.status === 'active'
        );
        if (staff) {
          userFound = { id: staff.id, email: staff.email, name: staff.name, userType: 'staff' };
        }
      }
    } else {
      // Check customer accounts first
      if (isDbConfigured()) {
        const cust = await getCustomerByEmailFromDb(normalizedEmail);
        if (cust && cust.status === 'active') {
          userFound = {
            id: cust.id,
            email: cust.email || normalizedEmail,
            name: cust.fullName || cust.firstName || 'Customer',
            userType: 'customer',
          };
        }
      } else {
        const customers = await getServerCustomers();
        const cust = customers.find(
          (c) => c.email && c.email.toLowerCase() === normalizedEmail && c.status === 'active'
        );
        if (cust) {
          userFound = {
            id: cust.id,
            email: cust.email || normalizedEmail,
            name: cust.fullName || cust.firstName || 'Customer',
            userType: 'customer',
          };
        }
      }

      // If not found in customers, also check if this was a staff user logging in from unified login
      if (!userFound) {
        if (isDbConfigured()) {
          const staff = await getStaffByEmailFromDb(normalizedEmail);
          if (staff && staff.status === 'active') {
            userFound = { id: staff.id, email: staff.email, name: staff.name, userType: 'staff' };
          }
        } else {
          const staffList = await getServerStaffUsers();
          const staff = staffList.find(
            (s) => s.email.toLowerCase() === normalizedEmail && s.status === 'active'
          );
          if (staff) {
            userFound = { id: staff.id, email: staff.email, name: staff.name, userType: 'staff' };
          }
        }
      }
    }

    // If an account exists, generate a cryptographic token and dispatch email
    if (userFound) {
      const tokenRes = await createPasswordResetToken({
        email: userFound.email,
        userType: userFound.userType,
        userId: userFound.id,
        ipAddress,
        userAgent,
        expiresInMinutes: 60,
      });

      if (tokenRes.success && tokenRes.rawToken) {
        // Build reset link
        const hostHeader = request.headers.get('host') || 'localhost:3000';
        const proto = request.headers.get('x-forwarded-proto') || 'http';
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${hostHeader}`;
        const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${tokenRes.rawToken}`;

        // Non-blocking email dispatch
        sendPasswordResetEmail({
          to: userFound.email,
          resetUrl,
          userName: userFound.name,
          userType: userFound.userType,
          expiresInMinutes: 60,
        }).catch((err) => {
          console.warn('[ForgotPassword API] Background email dispatch caught error:', err);
        });
      }
    } else {
      // Artificial delay to prevent timing analysis attacks
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    // Always return constant-time generic success message
    return NextResponse.json({
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
    });
  } catch (err: unknown) {
    console.error('[ForgotPassword API] Unexpected failure:', err);
    // Even in error, return a safe user message
    return NextResponse.json(
      { success: true, message: GENERIC_SUCCESS_MESSAGE },
      { status: 200 }
    );
  }
}
