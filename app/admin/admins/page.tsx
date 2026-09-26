'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StaffManagementPage from '../staff/page';

/**
 * Legacy admin users route.
 * Renders the new Staff Management system and automatically transitions route to /admin/staff.
 * All legacy "Invite Admin User" buttons, modals, and endpoints have been completely replaced.
 */
export default function AdminUsersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/staff');
  }, [router]);

  return <StaffManagementPage />;
}
