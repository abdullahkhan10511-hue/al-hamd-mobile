'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  KeyRound,
} from 'lucide-react';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [userType, setUserType] = useState<'customer' | 'staff'>('customer');

  // Form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Token verification on load
  useEffect(() => {
    let isMounted = true;

    async function verify() {
      if (!token) {
        if (isMounted) {
          setIsVerifying(false);
          setTokenValid(false);
          setTokenError('No password reset token was provided in the link.');
        }
        return;
      }

      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (isMounted) {
          setIsVerifying(false);
          if (res.ok && data.valid) {
            setTokenValid(true);
            setMaskedEmail(data.email || '');
            setUserType(data.userType || 'customer');
          } else {
            setTokenValid(false);
            setTokenError(data.error || 'This reset link is invalid or has expired.');
          }
        }
      } catch {
        if (isMounted) {
          setIsVerifying(false);
          setTokenValid(false);
          setTokenError('Network error verifying your reset link. Please try again.');
        }
      }
    }

    verify();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Submit new password
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!newPassword || newPassword.length < 8) {
      setSubmitError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsSuccess(true);
      } else {
        setSubmitError(data.error || 'Failed to update password. Please request a new reset link.');
      }
    } catch {
      setSubmitError('Network error while saving your new password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, text: '', color: 'bg-neutral-800' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, text: 'Weak', color: 'bg-rose-500' };
      case 2:
        return { score: 2, text: 'Fair', color: 'bg-amber-500' };
      case 3:
        return { score: 3, text: 'Good', color: 'bg-blue-500' };
      case 4:
        return { score: 4, text: 'Strong', color: 'bg-emerald-500' };
      default:
        return { score: 0, text: '', color: 'bg-neutral-800' };
    }
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="max-w-md w-full bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* Decorative Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center space-y-2 mb-8 relative">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500 text-neutral-950 font-black text-sm tracking-wider shadow-lg mb-2">
            AL
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800/80 border border-neutral-700/60 text-[10px] font-mono font-bold tracking-widest uppercase text-amber-400 block mx-auto w-fit">
            <KeyRound className="w-3 h-3" />
            <span>AL-HAMD Security Portal</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Choose a New Password
          </h1>
          <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
            Protect your AL-HAMD account with a strong, secure passphrase.
          </p>
        </div>

        {/* 1. Verifying Token State */}
        {isVerifying && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-xs text-neutral-400 font-medium">
              Verifying your single-use reset security link...
            </p>
          </div>
        )}

        {/* 2. Invalid or Expired Token State */}
        {!isVerifying && !tokenValid && !isSuccess && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block text-rose-200">Unable to Proceed</span>
                <p className="text-rose-300/90 leading-relaxed">{tokenError}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-800/40 border border-neutral-800 text-xs text-neutral-400 space-y-2">
              <p className="font-semibold text-neutral-300">Why might this happen?</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Password reset links expire 60 minutes after being issued.</li>
                <li>Links are single-use and become invalid once password is reset.</li>
                <li>A newer reset link may have been requested.</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/login"
                className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs tracking-wider uppercase transition-all text-center block shadow-md"
              >
                Request a New Reset Link
              </Link>
              <Link
                href="/"
                className="w-full py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase tracking-wider transition-all text-center block"
              >
                Return to Storefront
              </Link>
            </div>
          </div>
        )}

        {/* 3. Password Reset Form (Token Valid) */}
        {!isVerifying && tokenValid && !isSuccess && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Account Info Pill */}
            <div className="p-3.5 rounded-2xl bg-neutral-800/60 border border-neutral-700/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-neutral-400">Account:</span>
                <span className="font-mono text-neutral-200 font-bold">{maskedEmail}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-700 text-amber-300">
                {userType === 'staff' ? 'Staff' : 'Customer'}
              </span>
            </div>

            {submitError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* New Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300 block">
                New Password <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-neutral-950 border border-neutral-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white placeholder:text-neutral-600 text-xs transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 cursor-pointer"
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px] text-neutral-400 font-semibold">
                    <span>Strength: {strength.text}</span>
                    <span>{strength.score}/4</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 h-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`rounded-full transition-all duration-300 ${
                          strength.score >= step ? strength.color : 'bg-neutral-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300 block">
                Confirm New Password <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-neutral-950 border border-neutral-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white placeholder:text-neutral-600 text-xs transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !newPassword || !confirmPassword}
              className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs tracking-wider uppercase transition-all shadow-lg hover:shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Securing Account...</span>
                </>
              ) : (
                <>
                  <span>Save New Password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* 4. Success State */}
        {isSuccess && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-white tracking-tight">
                Password Reset Complete!
              </h2>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                Your password has been updated securely. You can now log into your account using your new credentials.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href={userType === 'staff' ? '/admin/login' : '/login'}
                className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs tracking-wider uppercase transition-all shadow-md text-center block"
              >
                {userType === 'staff' ? 'Sign In to Admin Panel →' : 'Sign In to Customer Account →'}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-xs text-neutral-400">
          Loading Password Recovery Portal...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
