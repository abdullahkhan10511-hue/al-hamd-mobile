'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Copy,
  Check,
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Smartphone,
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function StaffTwoFactorPage() {
  const { admin, refreshAdmin } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [status, setStatus] = useState<{
    enabled: boolean;
    enrolledAt?: string;
    hasSecret?: boolean;
    recoveryCodesCount?: number;
  } | null>(null);

  // Setup state
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrSvg: string;
    recoveryCodes: string[];
    otpauthUrl: string;
  } | null>(null);

  const [verifyCode, setVerifyCode] = useState('');
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch current 2FA status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/staff/2fa');
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setStatus({
          enabled: data.enabled,
          enrolledAt: data.enrolledAt,
          hasSecret: data.hasSecret,
          recoveryCodesCount: data.recoveryCodesCount,
        });
        if (data.setup) {
          setSetupData(data.setup);
          setIsConfiguring(true);
        }
      }
    } catch {
      setError('Failed to fetch two-factor authentication status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Begin setup
  const handleStartSetup = async () => {
    setError('');
    setSuccessMessage('');
    try {
      setLoading(true);
      const res = await fetch('/api/admin/staff/2fa');
      const data = await res.json().catch(() => null);
      if (res.ok && data?.setup) {
        setSetupData(data.setup);
        setIsConfiguring(true);
      } else {
        setError(data?.error || 'Could not initiate 2FA setup.');
      }
    } catch {
      setError('Network error starting 2FA setup.');
    } finally {
      setLoading(false);
    }
  };

  // Confirm and activate 2FA
  const handleConfirmEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData || !verifyCode.trim()) return;

    setError('');
    setSuccessMessage('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/staff/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enable',
          code: verifyCode.trim(),
          secret: setupData.secret,
          recoveryCodes: setupData.recoveryCodes,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setSuccessMessage('Two-Factor Authentication is now actively protecting your account!');
        setIsConfiguring(false);
        setSetupData(null);
        setVerifyCode('');
        fetchStatus();
        refreshAdmin();
      } else {
        setError(data?.error || 'Verification code failed. Please check the 6 digits and try again.');
      }
    } catch {
      setError('Error verifying 2FA setup. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Disable 2FA
  const handleDisable = async () => {
    const code = prompt('Enter your 6-digit authenticator code or password to confirm disabling 2FA:');
    if (!code) return;

    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/staff/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disable',
          code: code.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setSuccessMessage('Two-Factor Authentication has been disabled.');
        setIsConfiguring(false);
        fetchStatus();
        refreshAdmin();
      } else {
        setError(data?.error || 'Failed to disable 2FA.');
      }
    } catch {
      setError('Network error disabling 2FA.');
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke all sessions
  const handleLogoutAll = async () => {
    if (!confirm('This will invalidate all current sessions and force re-login on all devices. Continue?')) {
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/staff/logout-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        alert('All other devices have been logged out. Your current session will refresh.');
        window.location.reload();
      } else {
        setError(data?.error || 'Could not log out other devices.');
      }
    } catch {
      setError('Failed to revoke sessions.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyRecoveryCodes = () => {
    if (!setupData?.recoveryCodes) return;
    navigator.clipboard.writeText(setupData.recoveryCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const copySecret = () => {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/staff"
              className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              Two-Factor Authentication (2FA)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500">
            Secure your store administration account using Time-based One-Time Passwords (TOTP RFC 6238).
          </p>
        </div>

        <button
          onClick={handleLogoutAll}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-rose-50 text-neutral-700 hover:text-rose-700 font-bold text-xs border border-neutral-200 hover:border-rose-200 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out All Other Devices</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mx-auto mb-2" />
          <p className="text-xs text-neutral-500 font-medium">Checking authentication status...</p>
        </div>
      ) : status?.enabled && !isConfiguring ? (
        /* Status Card - 2FA Active */
        <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-neutral-900">Two-Factor Authentication is Active</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono uppercase">
                    Protected
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Enrolled on {status.enrolledAt ? new Date(status.enrolledAt).toLocaleDateString() : 'Active session'}
                  {status.recoveryCodesCount !== undefined && ` • ${status.recoveryCodesCount} recovery codes available`}
                </p>
              </div>
            </div>

            <button
              onClick={handleDisable}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
            >
              Disable 2FA
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2">
            <p className="text-xs font-bold text-neutral-900">Account Protection Details</p>
            <ul className="text-xs text-neutral-600 space-y-1 list-disc list-inside">
              <li>Requires 6-digit TOTP code on every new device login.</li>
              <li>Encrypted using AES-256-GCM hardware-isolated key.</li>
              <li>Idle sessions timeout automatically after 2 hours.</li>
              <li>Session versioning revokes stale tokens instantly on role or password change.</li>
            </ul>
          </div>
        </div>
      ) : (
        /* Configuration Workflow */
        <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 space-y-8 shadow-xs">
          {!isConfiguring ? (
            <div className="text-center max-w-lg mx-auto py-6 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Enable Two-Factor Authentication</h3>
                <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                  Add an essential layer of security. Whenever you sign in to the store administration console, you will be asked for a verification code generated by your authenticator app.
                </p>
              </div>
              <button
                onClick={handleStartSetup}
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                <span>Begin 2FA Setup</span>
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Step 1: Scan QR */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Scan this QR code in your Authenticator app
                  </h3>
                </div>
                <p className="text-xs text-neutral-500 ml-8">
                  Use Google Authenticator, Microsoft Authenticator, 1Password, or any standard TOTP app.
                </p>

                <div className="ml-8 flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-neutral-50 border border-neutral-200">
                  {setupData?.qrSvg && (
                    <div
                      className="p-3 bg-white rounded-2xl border border-neutral-200 shadow-sm shrink-0"
                      dangerouslySetInnerHTML={{ __html: setupData.qrSvg }}
                    />
                  )}
                  <div className="space-y-3 min-w-0">
                    <div>
                      <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                        Manual Entry Secret Key
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs font-mono font-bold bg-white px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-800 select-all">
                          {setupData?.secret}
                        </code>
                        <button
                          type="button"
                          onClick={copySecret}
                          className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-600 transition-colors"
                          title="Copy Secret"
                        >
                          {copiedSecret ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      If your camera cannot scan the code, enter this key manually into your app.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: Backup Recovery Codes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <h3 className="text-sm font-bold text-neutral-900">
                      Save your Backup Recovery Codes
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={copyRecoveryCodes}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs transition-colors"
                  >
                    {copiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCodes ? 'Copied All' : 'Copy Codes'}</span>
                  </button>
                </div>
                <p className="text-xs text-neutral-500 ml-8">
                  Keep these 10 one-time codes in a safe place. If you ever lose your phone or authenticator app, each code can be used once to access your account.
                </p>

                <div className="ml-8 grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 rounded-2xl bg-neutral-50 border border-neutral-200 font-mono text-xs font-bold text-neutral-800 text-center">
                  {setupData?.recoveryCodes.map((c, i) => (
                    <div key={i} className="p-2 bg-white rounded-lg border border-neutral-200 select-all">
                      {c}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 3: Verify and Activate */}
              <form onSubmit={handleConfirmEnable} className="space-y-4 pt-4 border-t border-neutral-200">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Verify Code and Enable
                  </h3>
                </div>
                <p className="text-xs text-neutral-500 ml-8">
                  Enter the 6-digit code showing in your authenticator app right now to verify everything is working.
                </p>

                <div className="ml-8 flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.trim().replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full sm:w-48 px-4 py-2.5 rounded-xl border border-neutral-300 text-center font-mono text-lg font-bold tracking-widest focus:outline-none focus:border-neutral-900"
                  />
                  <button
                    type="submit"
                    disabled={submitting || verifyCode.length !== 6}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Activate 2FA Protection</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfiguring(false)}
                    className="text-xs text-neutral-500 hover:text-neutral-900 px-3 py-2 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

