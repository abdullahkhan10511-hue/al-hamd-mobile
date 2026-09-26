'use client';

import AdminDashboardPage from '../page';

/**
 * /admin/dashboard route
 * Re-exports the primary Admin Dashboard so that both /admin and /admin/dashboard
 * load the administration control center seamlessly without 404 or access rejection.
 */
export default function AdminDashboardRoute() {
  return <AdminDashboardPage />;
}
