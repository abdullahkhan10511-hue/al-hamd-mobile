'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { StaffUser, StaffRole, AdminRole, PermissionModule } from '@/types/admin';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  getStaffUsers,
  getStaffRoles,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
  toggleStaffStatus,
  resetStaffPassword,
  createStaffRole,
  updateStaffRole,
  deleteStaffRole,
  getAdminAuthHeaders,
} from '@/lib/db/staff';
import {
  ALL_PERMISSIONS,
  PERMISSION_MODULES,
  ROLE_DEFAULT_PERMISSIONS,
  PREDEFINED_ROLES,
} from '@/lib/constants/permissions';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  Trash2,
  Edit3,
  Copy,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Mail,
  Phone,
  User,
  Eye,
  RefreshCw,
  Check,
  Layers,
  Sparkles,
  Settings,
  MoreVertical,
  Sliders,
  Info,
} from 'lucide-react';

export default function StaffManagementPage() {
  const { admin: currentAdmin, isSuperAdmin, hasPermission } = useAdminAuth();

  // Active Tab: 'staff' | 'roles'
  const [activeTab, setActiveTab] = useState<'staff' | 'roles'>('staff');

  // Data state
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [roleList, setRoleList] = useState<StaffRole[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Status feedback message
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [editStaffOpen, setEditStaffOpen] = useState(false);
  const [editStaffTarget, setEditStaffTarget] = useState<StaffUser | null>(null);

  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [permissionsTarget, setPermissionsTarget] = useState<StaffUser | null>(null);

  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<StaffUser | null>(null);

  const [deleteStaffOpen, setDeleteStaffOpen] = useState(false);
  const [deleteStaffTarget, setDeleteStaffTarget] = useState<StaffUser | null>(null);

  const [viewStaffOpen, setViewStaffOpen] = useState(false);
  const [viewStaffTarget, setViewStaffTarget] = useState<StaffUser | null>(null);

  // Custom Role Modals state
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editRoleTarget, setEditRoleTarget] = useState<StaffRole | null>(null);
  const [deleteRoleOpen, setDeleteRoleOpen] = useState(false);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<StaffRole | null>(null);

  // Load & listen
  const loadAllData = () => {
    setStaffList(getStaffUsers());
    setRoleList(getStaffRoles());
    if (typeof window !== 'undefined') {
      fetch('/api/admin/staff', {
        headers: getAdminAuthHeaders(currentAdmin?.email),
        credentials: 'include',
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.success && Array.isArray(data.staff)) {
            const localUsers = getStaffUsers();
            const merged: StaffUser[] = data.staff.map((s: StaffUser) => {
              const local = localUsers.find((l) => l.email.toLowerCase() === s.email.toLowerCase());
              return {
                ...s,
                salt: s.salt || local?.salt,
                passwordHash: s.passwordHash || local?.passwordHash,
              };
            });
            setStaffList(merged);
            try {
              localStorage.setItem('admin_users', JSON.stringify(merged));
              localStorage.setItem('alhamd_store_admin_users', JSON.stringify(merged));
            } catch {}
          }
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    loadAllData();
    const handleUpdate = () => loadAllData();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setStatusFeedback({ type, message });
    setTimeout(() => setStatusFeedback(null), 4000);
  };

  // Staff Counts per Role
  const staffCountsByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    staffList.forEach((s) => {
      const key = s.role.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [staffList]);

  // Filtered staff
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        staff.name.toLowerCase().includes(q) ||
        staff.email.toLowerCase().includes(q) ||
        (staff.phone && staff.phone.includes(q)) ||
        staff.role.toLowerCase().includes(q);

      const matchesRole =
        roleFilter === 'ALL' || staff.role.toLowerCase() === roleFilter.toLowerCase();

      const matchesStatus =
        statusFilter === 'ALL' || staff.status === statusFilter;

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [staffList, searchQuery, roleFilter, statusFilter]);

  // Handlers
  const isCurrentLoggedInAdmin = (staff: StaffUser) => {
    if (!currentAdmin) return false;
    return (
      staff.id === currentAdmin.id ||
      staff.email.toLowerCase() === currentAdmin.email.toLowerCase() ||
      Boolean(staff.isOwner)
    );
  };

  const handleDeactivate = async (staff: StaffUser) => {
    if (isCurrentLoggedInAdmin(staff)) {
      showNotification('error', 'You cannot delete or deactivate the currently logged-in administrator.');
      return;
    }
    const res = await updateStaffUser(staff.id, { status: 'inactive' }, currentAdmin?.email);
    if (res.success) {
      loadAllData();
      showNotification('success', `Staff member "${staff.name}" has been deactivated.`);
    } else {
      showNotification('error', res.error || 'Failed to deactivate staff account.');
    }
  };

  const handleActivate = async (staff: StaffUser) => {
    const res = await updateStaffUser(staff.id, { status: 'active' }, currentAdmin?.email);
    if (res.success) {
      loadAllData();
      showNotification('success', `Staff member "${staff.name}" is now Active.`);
    } else {
      showNotification('error', res.error || 'Failed to activate staff account.');
    }
  };

  const handleDeleteClick = (staff: StaffUser) => {
    if (isCurrentLoggedInAdmin(staff)) {
      showNotification('error', 'You cannot delete or deactivate the currently logged-in administrator.');
      return;
    }
    setDeleteStaffTarget(staff);
    setDeleteStaffOpen(true);
  };

  const handleToggleStatus = async (staff: StaffUser) => {
    if (isCurrentLoggedInAdmin(staff)) {
      showNotification('error', 'You cannot delete or deactivate the currently logged-in administrator.');
      return;
    }
    if (staff.status === 'active') {
      await handleDeactivate(staff);
    } else {
      await handleActivate(staff);
    }
  };

  const handleConfirmDeleteStaff = async () => {
    if (!deleteStaffTarget) return;
    if (isCurrentLoggedInAdmin(deleteStaffTarget)) {
      showNotification('error', 'You cannot delete or deactivate the currently logged-in administrator.');
      setDeleteStaffOpen(false);
      setDeleteStaffTarget(null);
      return;
    }
    const res = await deleteStaffUser(deleteStaffTarget.id, currentAdmin?.email);
    if (res.success) {
      loadAllData();
      setDeleteStaffOpen(false);
      showNotification('success', `Staff account "${deleteStaffTarget.name}" permanently deleted.`);
      setDeleteStaffTarget(null);
    } else {
      showNotification('error', res.error || 'Failed to delete staff account.');
    }
  };

  const handleConfirmDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    const res = await deleteStaffRole(deleteRoleTarget.id, currentAdmin?.email);
    if (res.success) {
      loadAllData();
      setDeleteRoleOpen(false);
      showNotification('success', `Role "${deleteRoleTarget.name}" deleted successfully.`);
      setDeleteRoleTarget(null);
    } else {
      showNotification('error', res.error || 'Failed to delete role.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Staff Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-900 text-white font-mono">
              RBAC Engine
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Manage independent staff accounts, assign granular role permissions, and track active operators.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {activeTab === 'staff' ? (
            <button
              onClick={() => setAddStaffOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff</span>
            </button>
          ) : (
            <button
              onClick={() => setCreateRoleOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
            >
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Create Custom Role</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Feedback Toast */}
      {statusFeedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200 ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusFeedback.message}</span>
          </div>
          <button onClick={() => setStatusFeedback(null)} className="opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex border-b border-neutral-200 text-xs font-semibold gap-6">
        <button
          onClick={() => setActiveTab('staff')}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'staff'
              ? 'border-neutral-900 text-neutral-950 font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Accounts ({staffList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'roles'
              ? 'border-neutral-900 text-neutral-950 font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Roles &amp; Permissions ({roleList.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STAFF ACCOUNTS                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          {/* Filter / Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, email, phone, or role..."
                className="w-full pl-9 pr-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-800 cursor-pointer w-full md:w-auto focus:outline-none"
              >
                <option value="ALL">All Roles ({roleList.length})</option>
                {roleList.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-800 cursor-pointer w-full md:w-auto focus:outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="active">Active Accounts</option>
                <option value="inactive">Inactive Accounts</option>
              </select>

              {(searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setRoleFilter('ALL');
                    setStatusFilter('ALL');
                  }}
                  className="px-3 py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-900 rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Staff Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/80 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Profile</th>
                    <th className="py-3 px-4">Name &amp; Contact</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Permissions</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-400">
                        No staff accounts match your current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((staff) => {
                      const isOwner = staff.isOwner;
                      const isSelf = isCurrentLoggedInAdmin(staff);

                      return (
                        <tr key={staff.id} className="hover:bg-neutral-50/60 transition-colors">
                          {/* Profile Avatar */}
                          <td className="py-3.5 px-4">
                            <div className="w-9 h-9 rounded-full bg-neutral-200 overflow-hidden relative flex-shrink-0 border border-neutral-200">
                              <img
                                src={
                                  staff.avatar ||
                                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'
                                }
                                alt={staff.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </td>

                          {/* Name & Contact */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                              <span>{staff.name}</span>
                              {isOwner && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-neutral-900 text-white font-mono">
                                  Owner
                                </span>
                              )}
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-2 mt-0.5">
                              <span>{staff.email}</span>
                              {staff.phone && <span>• {staff.phone}</span>}
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                staff.role === 'SUPER_ADMIN'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : staff.role.includes('Manager')
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              <ShieldCheck className="w-3 h-3" />
                              {staff.role}
                            </span>
                          </td>

                          {/* Permissions Count Badge */}
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => {
                                setPermissionsTarget(staff);
                                setPermissionsModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-semibold transition-colors cursor-pointer"
                              title="Click to view or edit permissions"
                            >
                              <Sliders className="w-3 h-3 text-neutral-500" />
                              <span>{staff.permissions?.length || 0} permissions</span>
                            </button>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleToggleStatus(staff)}
                              disabled={isOwner || isSelf}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                                staff.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              } ${
                                isOwner || isSelf
                                  ? 'cursor-default opacity-80'
                                  : 'cursor-pointer hover:opacity-80'
                              }`}
                              title={
                                isOwner
                                  ? 'Primary Owner cannot be deactivated'
                                  : isSelf
                                  ? 'Cannot deactivate your own logged-in account'
                                  : 'Click to toggle Active / Inactive'
                              }
                            >
                              {staff.status === 'active' ? 'Active' : 'Inactive'}
                            </button>
                          </td>

                          {/* Last Login */}
                          <td className="py-3.5 px-4 text-neutral-500 whitespace-nowrap text-[11px] font-mono">
                            {staff.lastLogin ? new Date(staff.lastLogin).toLocaleDateString() : 'Never'}
                          </td>

                          {/* Created Date */}
                          <td className="py-3.5 px-4 text-neutral-500 whitespace-nowrap text-[11px]">
                            {new Date(staff.createdAt).toLocaleDateString()}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {/* Edit */}
                              <button
                                onClick={() => {
                                  setEditStaffTarget(staff);
                                  setEditStaffOpen(true);
                                }}
                                title="Edit Staff Member"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>

                              {/* Deactivate (if active) / Activate (if inactive) */}
                              {staff.status === 'active' ? (
                                <button
                                  onClick={() => handleDeactivate(staff)}
                                  disabled={isSelf}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                                    isSelf
                                      ? 'opacity-40 cursor-not-allowed bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer'
                                  }`}
                                  title={
                                    isSelf
                                      ? 'You cannot delete or deactivate the currently logged-in administrator.'
                                      : 'Deactivate this staff member'
                                  }
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>Deactivate</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleActivate(staff)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                                  title="Activate this staff member"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Activate</span>
                                </button>
                              )}

                              {/* Delete Staff (Available on both active and inactive accounts) */}
                              <button
                                onClick={() => handleDeleteClick(staff)}
                                disabled={isSelf}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                                  isSelf
                                    ? 'opacity-40 cursor-not-allowed bg-rose-50 text-rose-500 border border-rose-200'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer'
                                }`}
                                title={
                                  isSelf
                                    ? 'You cannot delete or deactivate the currently logged-in administrator.'
                                    : 'Delete this staff member permanently'
                                }
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>

                              {/* Reset Password */}
                              <button
                                onClick={() => {
                                  setResetPasswordTarget(staff);
                                  setResetPasswordOpen(true);
                                }}
                                title="Reset Password"
                                className="p-1.5 text-neutral-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Key className="w-3.5 h-3.5 text-amber-600" />
                              </button>

                              {/* View */}
                              <button
                                onClick={() => {
                                  setViewStaffTarget(staff);
                                  setViewStaffOpen(true);
                                }}
                                title="View Details"
                                className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ROLES & PERMISSIONS                                                */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-bold">Role-Based Access Control Architecture</p>
              <p className="text-amber-800 mt-0.5 leading-relaxed">
                Roles serve as permission templates. Modifying a role or creating custom roles enables quick assignment to staff members while keeping individual permission overrides flexible.
              </p>
            </div>
          </div>

          {/* Roles Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/80 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Role Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Staff Count</th>
                    <th className="py-3 px-4">Permissions</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs">
                  {roleList.map((role) => {
                    const assignedStaffCount = staffCountsByRole[role.name.toLowerCase()] || 0;

                    return (
                      <tr key={role.id} className="hover:bg-neutral-50/60 transition-colors">
                        {/* Role Name */}
                        <td className="py-3.5 px-4 font-bold text-neutral-900 whitespace-nowrap">
                          {role.name}
                        </td>

                        {/* Type */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {role.isSystemRole ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                              System Preset
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Custom Role
                            </span>
                          )}
                        </td>

                        {/* Description */}
                        <td className="py-3.5 px-4 text-neutral-600 max-w-xs truncate">
                          {role.description}
                        </td>

                        {/* Staff Count */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-semibold text-neutral-900">
                          {assignedStaffCount} staff
                        </td>

                        {/* Permissions Count */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-lg bg-neutral-100 font-mono text-[11px] font-bold text-neutral-800">
                            {role.permissions.length} / {ALL_PERMISSIONS.length}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 justify-end">
                            {/* Edit */}
                            <button
                              onClick={() => {
                                setEditRoleTarget(role);
                                setEditRoleOpen(true);
                              }}
                              title="Edit Role Permissions"
                              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Duplicate */}
                            <button
                              onClick={() => {
                                // Duplicate role into create modal
                                setEditRoleTarget(null);
                                setCreateRoleOpen(true);
                              }}
                              title="Duplicate Role"
                              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete (custom roles only) */}
                            {!role.isSystemRole && (
                              <button
                                onClick={() => {
                                  setDeleteRoleTarget(role);
                                  setDeleteRoleOpen(true);
                                }}
                                title="Delete Custom Role"
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD STAFF ACCOUNT                                                  */}
      {/* ========================================================================= */}
      {addStaffOpen && (
        <AddStaffModal
          roles={roleList}
          onClose={() => setAddStaffOpen(false)}
          onSuccess={(staff) => {
            loadAllData();
            setAddStaffOpen(false);
            showNotification('success', `Staff member "${staff.name}" created successfully.`);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT STAFF ACCOUNT                                                 */}
      {/* ========================================================================= */}
      {editStaffOpen && editStaffTarget && (
        <EditStaffModal
          staff={editStaffTarget}
          roles={roleList}
          onClose={() => {
            setEditStaffOpen(false);
            setEditStaffTarget(null);
          }}
          onSuccess={() => {
            loadAllData();
            setEditStaffOpen(false);
            setEditStaffTarget(null);
            showNotification('success', 'Staff details updated successfully.');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: PERMISSIONS MATRIX (Quick override)                                */}
      {/* ========================================================================= */}
      {permissionsModalOpen && permissionsTarget && (
        <PermissionsMatrixModal
          staff={permissionsTarget}
          onClose={() => {
            setPermissionsModalOpen(false);
            setPermissionsTarget(null);
          }}
          onSuccess={() => {
            loadAllData();
            setPermissionsModalOpen(false);
            setPermissionsTarget(null);
            showNotification('success', 'Staff permissions updated successfully.');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: RESET PASSWORD                                                     */}
      {/* ========================================================================= */}
      {resetPasswordOpen && resetPasswordTarget && (
        <ResetPasswordModal
          staff={resetPasswordTarget}
          onClose={() => {
            setResetPasswordOpen(false);
            setResetPasswordTarget(null);
          }}
          onSuccess={() => {
            loadAllData();
            setResetPasswordOpen(false);
            setResetPasswordTarget(null);
            showNotification('success', `Password reset successfully for ${resetPasswordTarget.email}.`);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW STAFF PROFILE                                                 */}
      {/* ========================================================================= */}
      {viewStaffOpen && viewStaffTarget && (
        <ViewStaffModal
          staff={viewStaffTarget}
          onClose={() => {
            setViewStaffOpen(false);
            setViewStaffTarget(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE STAFF CONFIRMATION                                          */}
      {/* ========================================================================= */}
      {deleteStaffOpen && deleteStaffTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-neutral-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Delete this staff member permanently?</h3>
              <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                Are you sure you want to permanently remove this staff account for{' '}
                <strong className="text-neutral-900">{deleteStaffTarget.name}</strong> ({deleteStaffTarget.email})?
              </p>
              <div className="mt-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-[11px] text-neutral-600 space-y-1">
                <div>• Their credentials and active sessions will be invalidated immediately.</div>
                <div>• Historical orders, POS sales, and inventory logs will be preserved.</div>
                <div>• This account cannot be recovered.</div>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => {
                  setDeleteStaffOpen(false);
                  setDeleteStaffTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-colors cursor-pointer uppercase tracking-wider font-mono"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStaff}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm cursor-pointer uppercase tracking-wider font-mono"
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT CUSTOM ROLE                                          */}
      {/* ========================================================================= */}
      {(createRoleOpen || (editRoleOpen && editRoleTarget)) && (
        <RoleEditorModal
          initialRole={editRoleTarget}
          onClose={() => {
            setCreateRoleOpen(false);
            setEditRoleOpen(false);
            setEditRoleTarget(null);
          }}
          onSuccess={(msg) => {
            loadAllData();
            setCreateRoleOpen(false);
            setEditRoleOpen(false);
            setEditRoleTarget(null);
            showNotification('success', msg);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE ROLE CONFIRMATION                                           */}
      {/* ========================================================================= */}
      {deleteRoleOpen && deleteRoleTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-neutral-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Delete Custom Role?</h3>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                Are you sure you want to delete the role <strong className="text-neutral-900">"{deleteRoleTarget.name}"</strong>?
                This action cannot be undone.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => {
                  setDeleteRoleOpen(false);
                  setDeleteRoleTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRole}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Delete Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// MODAL: ADD STAFF
// ===========================================================================
function AddStaffModal({
  roles,
  onClose,
  onSuccess,
}: {
  roles: StaffRole[];
  onClose: () => void;
  onSuccess: (staff: StaffUser) => void;
}) {
  const { admin: currentAdmin } = useAdminAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [selectedRole, setSelectedRole] = useState<string>('Manager');
  const [permissions, setPermissions] = useState<string[]>(ROLE_DEFAULT_PERMISSIONS['Manager'] || []);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle role change -> auto-prefill role's default permissions
  const handleRoleChange = (newRole: string) => {
    setSelectedRole(newRole);
    const targetRole = roles.find((r) => r.name === newRole);
    if (targetRole) {
      setPermissions(targetRole.permissions);
    } else if (ROLE_DEFAULT_PERMISSIONS[newRole]) {
      setPermissions(ROLE_DEFAULT_PERMISSIONS[newRole]);
    }
  };

  const handleTogglePermission = (key: string) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSelectModuleAll = (module: PermissionModule) => {
    const moduleKeys = ALL_PERMISSIONS.filter((p) => p.module === module).map((p) => p.key);
    setPermissions((prev) => Array.from(new Set([...prev, ...moduleKeys])));
  };

  const handleClearModuleAll = (module: PermissionModule) => {
    const moduleKeys = new Set(ALL_PERMISSIONS.filter((p) => p.module === module).map((p) => p.key));
    setPermissions((prev) => prev.filter((k) => !moduleKeys.has(k)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (password.length < 4) {
      setErrorMessage('Password must be at least 4 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createStaffUser(
        {
          name,
          email,
          password,
          phone,
          avatar,
          status,
          role: selectedRole,
          permissions,
        },
        currentAdmin?.email
      );

      if (!res.success || !res.staff) {
        setErrorMessage(res.error || 'Failed to create staff member.');
        return;
      }

      onSuccess(res.staff);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create staff member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden my-8 max-h-[90vh] flex flex-col border border-neutral-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-neutral-900" />
            <h3 className="font-bold text-neutral-900 text-sm">Add New Staff Account</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Form */}
        <form onSubmit={handleSubmit} noValidate className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="space-y-3">
            <h4 className="text-[11px] uppercase font-bold text-neutral-400 tracking-wider">
              Basic Account Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ali Ahmed"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. ali@alhamd.com"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Phone Number (Optional)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +92 300 1234567"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Profile Image URL (Optional)</label>
                <input
                  type="text"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Role & Status */}
          <div className="space-y-3 pt-2 border-t border-neutral-100">
            <h4 className="text-[11px] uppercase font-bold text-neutral-400 tracking-wider">
              Role &amp; Account Status
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Assigned Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-semibold cursor-pointer focus:outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} {r.isSystemRole ? '' : '(Custom)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Account Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-semibold cursor-pointer focus:outline-none"
                >
                  <option value="active">Active (Can log in)</option>
                  <option value="inactive">Inactive (Login blocked)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Permission Matrix */}
          <div className="space-y-4 pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[11px] uppercase font-bold text-neutral-400 tracking-wider">
                  Role Permissions Matrix ({permissions.length} selected)
                </h4>
                <p className="text-[11px] text-neutral-500">
                  Customizing these checkboxes overrides default role permissions for this staff member.
                </p>
              </div>
            </div>

            <div className="space-y-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80">
              {PERMISSION_MODULES.map((module) => {
                const modulePerms = ALL_PERMISSIONS.filter((p) => p.module === module);
                const allSelected = modulePerms.every((p) => permissions.includes(p.key));

                return (
                  <div key={module} className="bg-white rounded-xl p-3 border border-neutral-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-neutral-100">
                      <span className="font-bold text-neutral-900 text-xs uppercase tracking-tight">
                        {module}
                      </span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => handleSelectModuleAll(module)}
                          className="text-neutral-600 hover:text-neutral-900 font-semibold cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-neutral-300">•</span>
                        <button
                          type="button"
                          onClick={() => handleClearModuleAll(module)}
                          className="text-neutral-400 hover:text-rose-600 font-semibold cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {modulePerms.map((perm) => {
                        const checked = permissions.includes(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                              checked
                                ? 'bg-neutral-900 text-white border-neutral-900'
                                : 'bg-neutral-50/60 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleTogglePermission(perm.key)}
                              className="mt-0.5 rounded accent-neutral-900 cursor-pointer"
                            />
                            <div>
                              <p className="font-semibold leading-tight">{perm.name}</p>
                              <p className={`text-[10px] mt-0.5 ${checked ? 'text-neutral-300' : 'text-neutral-400'}`}>
                                {perm.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-neutral-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Staff Account...' : 'Create Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===========================================================================
// MODAL: EDIT STAFF
// ===========================================================================
function EditStaffModal({
  staff,
  roles,
  onClose,
  onSuccess,
}: {
  staff: StaffUser;
  roles: StaffRole[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { admin: currentAdmin } = useAdminAuth();
  const isSelf = Boolean(
    currentAdmin &&
      (staff.id === currentAdmin.id ||
        staff.email.toLowerCase() === currentAdmin.email.toLowerCase() ||
        staff.isOwner)
  );
  const [name, setName] = useState(staff.name);
  const [email, setEmail] = useState(staff.email);
  const [phone, setPhone] = useState(staff.phone || '');
  const [avatar, setAvatar] = useState(staff.avatar || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(staff.status);
  const [role, setRole] = useState(staff.role);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (isSelf && status === 'inactive') {
      setErrorMessage('You cannot delete or deactivate the currently logged-in administrator.');
      return;
    }

    setIsSubmitting(true);

    const res = await updateStaffUser(
      staff.id,
      {
        name,
        email,
        phone,
        avatar,
        status: isSelf ? 'active' : status,
        role: isSelf ? staff.role : role,
      },
      currentAdmin?.email
    );

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to update staff account.');
      return;
    }

    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-200">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <h3 className="font-bold text-neutral-900 text-sm">Edit Staff Account: {staff.name}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block font-semibold text-neutral-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              disabled={staff.isOwner}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:border-neutral-900 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 mb-1">Profile Image URL</label>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Assigned Role</label>
              <select
                value={role}
                disabled={isSelf}
                title={isSelf ? 'You cannot modify the role of the currently logged-in administrator.' : undefined}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-semibold cursor-pointer disabled:opacity-60"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Account Status</label>
              <select
                value={status}
                disabled={isSelf}
                title={isSelf ? 'You cannot delete or deactivate the currently logged-in administrator.' : undefined}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-semibold cursor-pointer disabled:opacity-60"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===========================================================================
// MODAL: PERMISSIONS MATRIX (Override per user)
// ===========================================================================
function PermissionsMatrixModal({
  staff,
  onClose,
  onSuccess,
}: {
  staff: StaffUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { admin: currentAdmin } = useAdminAuth();
  const [permissions, setPermissions] = useState<string[]>(staff.permissions || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggle = (key: string) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSelectModuleAll = (module: PermissionModule) => {
    const moduleKeys = ALL_PERMISSIONS.filter((p) => p.module === module).map((p) => p.key);
    setPermissions((prev) => Array.from(new Set([...prev, ...moduleKeys])));
  };

  const handleClearModuleAll = (module: PermissionModule) => {
    const moduleKeys = new Set(ALL_PERMISSIONS.filter((p) => p.module === module).map((p) => p.key));
    setPermissions((prev) => prev.filter((k) => !moduleKeys.has(k)));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    await updateStaffUser(staff.id, { permissions }, currentAdmin?.email);
    setIsSubmitting(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden my-8 max-h-[90vh] flex flex-col border border-neutral-200">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-neutral-900 text-sm">
              Manage Permissions: {staff.name}
            </h3>
            <p className="text-[11px] text-neutral-500">
              Role: <strong className="text-neutral-900">{staff.role}</strong> • {permissions.length} active permissions
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {PERMISSION_MODULES.map((module) => {
            const modulePerms = ALL_PERMISSIONS.filter((p) => p.module === module);

            return (
              <div key={module} className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                  <span className="font-bold text-neutral-900 text-xs uppercase tracking-tight">
                    {module}
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleSelectModuleAll(module)}
                      className="text-neutral-700 hover:text-neutral-900 font-semibold cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-neutral-300">•</span>
                    <button
                      type="button"
                      onClick={() => handleClearModuleAll(module)}
                      className="text-neutral-400 hover:text-rose-600 font-semibold cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {modulePerms.map((perm) => {
                    const checked = permissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggle(perm.key)}
                          className="mt-0.5 rounded accent-neutral-900 cursor-pointer"
                        />
                        <div>
                          <p className="font-semibold leading-tight">{perm.name}</p>
                          <p className={`text-[10px] mt-0.5 ${checked ? 'text-neutral-300' : 'text-neutral-400'}`}>
                            {perm.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSave}
            className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Apply Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// MODAL: RESET PASSWORD
// ===========================================================================
function ResetPasswordModal({
  staff,
  onClose,
  onSuccess,
}: {
  staff: StaffUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { admin: currentAdmin } = useAdminAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setIsSubmitting(true);
    const res = await resetStaffPassword(staff.id, newPassword, currentAdmin?.email);
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Failed to reset password.');
      return;
    }

    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-200">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-neutral-900 text-sm">Reset Password</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <p className="text-neutral-600 leading-relaxed">
            Configure a new security password for{' '}
            <strong className="text-neutral-900">{staff.name}</strong> ({staff.email}). The old password will be permanently invalidated.
          </p>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-neutral-700 mb-1">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div className="pt-3 border-t border-neutral-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? 'Updating...' : 'Set New Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===========================================================================
// MODAL: VIEW STAFF PROFILE
// ===========================================================================
function ViewStaffModal({ staff, onClose }: { staff: StaffUser; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-neutral-900 text-sm">Staff Profile Overview</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-neutral-200 overflow-hidden relative shrink-0 border border-neutral-200">
            <img
              src={staff.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
              alt={staff.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h4 className="font-bold text-neutral-900 text-base flex items-center gap-1.5">
              <span>{staff.name}</span>
              {staff.isOwner && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-neutral-900 text-white font-mono uppercase">
                  Owner
                </span>
              )}
            </h4>
            <p className="text-xs text-neutral-500 font-mono">{staff.email}</p>
            {staff.phone && <p className="text-xs text-neutral-500">{staff.phone}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-neutral-100">
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase">Role</span>
            <p className="font-bold text-neutral-900 mt-0.5">{staff.role}</p>
          </div>
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase">Status</span>
            <p
              className={`font-bold mt-0.5 ${
                staff.status === 'active' ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {staff.status === 'active' ? 'Active' : 'Inactive'}
            </p>
          </div>
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase">Created Date</span>
            <p className="font-bold text-neutral-900 mt-0.5">
              {new Date(staff.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase">Last Login</span>
            <p className="font-bold text-neutral-900 mt-0.5">
              {staff.lastLogin ? new Date(staff.lastLogin).toLocaleDateString() : 'Never'}
            </p>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
            Active Permissions ({staff.permissions?.length || 0})
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-neutral-50 rounded-xl border border-neutral-200">
            {staff.permissions?.map((p) => (
              <span
                key={p}
                className="px-2 py-0.5 rounded-md bg-white border border-neutral-200 text-[10px] font-mono text-neutral-800"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// MODAL: CREATE / EDIT CUSTOM ROLE
// ===========================================================================
function RoleEditorModal({
  initialRole,
  onClose,
  onSuccess,
}: {
  initialRole?: StaffRole | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { admin: currentAdmin } = useAdminAuth();
  const isEditing = Boolean(initialRole);
  const [name, setName] = useState(initialRole?.name || '');
  const [description, setDescription] = useState(initialRole?.description || '');
  const [permissions, setPermissions] = useState<string[]>(initialRole?.permissions || []);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggle = (key: string) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSelectModuleAll = (module: PermissionModule) => {
    const moduleKeys = ALL_PERMISSIONS.filter((p) => p.module === module).map((p) => p.key);
    setPermissions((prev) => Array.from(new Set([...prev, ...moduleKeys])));
  };

  const handleClearModuleAll = (module: PermissionModule) => {
    const moduleKeys = new Set(ALL_PERMISSIONS.filter((p) => p.module === module).map((p) => p.key));
    setPermissions((prev) => prev.filter((k) => !moduleKeys.has(k)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Role name is required.');
      return;
    }

    setIsSubmitting(true);

    if (isEditing && initialRole) {
      const res = await updateStaffRole(
        initialRole.id,
        {
          name,
          description,
          permissions,
        },
        currentAdmin?.email
      );
      setIsSubmitting(false);

      if (!res.success) {
        setError(res.error || 'Failed to update role.');
        return;
      }
      onSuccess(`Role "${name}" updated successfully.`);
    } else {
      const res = await createStaffRole(
        {
          name,
          description,
          permissions,
        },
        currentAdmin?.email
      );
      setIsSubmitting(false);

      if (!res.success) {
        setError(res.error || 'Failed to create role.');
        return;
      }
      onSuccess(`Custom role "${name}" created and now available in Role selector.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden my-8 max-h-[90vh] flex flex-col border border-neutral-200">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-neutral-900 text-sm">
              {isEditing ? `Edit Role: ${initialRole?.name}` : 'Create Custom Role'}
            </h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-neutral-700 mb-1">
              Role Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={initialRole?.isSystemRole}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Warehouse Supervisor, Content Manager, Sales Rep"
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:border-neutral-900 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 mb-1">Role Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational responsibilities and scope of this role..."
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] uppercase font-bold text-neutral-400 tracking-wider">
                Select Permissions ({permissions.length} selected)
              </h4>
            </div>

            <div className="space-y-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80">
              {PERMISSION_MODULES.map((module) => {
                const modulePerms = ALL_PERMISSIONS.filter((p) => p.module === module);

                return (
                  <div key={module} className="bg-white rounded-xl p-3 border border-neutral-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-neutral-100">
                      <span className="font-bold text-neutral-900 text-xs uppercase tracking-tight">
                        {module}
                      </span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => handleSelectModuleAll(module)}
                          className="text-neutral-700 hover:text-neutral-900 font-semibold cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-neutral-300">•</span>
                        <button
                          type="button"
                          onClick={() => handleClearModuleAll(module)}
                          className="text-neutral-400 hover:text-rose-600 font-semibold cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {modulePerms.map((perm) => {
                        const checked = permissions.includes(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                              checked
                                ? 'bg-neutral-900 text-white border-neutral-900'
                                : 'bg-neutral-50/60 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggle(perm.key)}
                              className="mt-0.5 rounded accent-neutral-900 cursor-pointer"
                            />
                            <div>
                              <p className="font-semibold leading-tight">{perm.name}</p>
                              <p className={`text-[10px] mt-0.5 ${checked ? 'text-neutral-300' : 'text-neutral-400'}`}>
                                {perm.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Role...' : isEditing ? 'Save Changes' : 'Save Custom Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
