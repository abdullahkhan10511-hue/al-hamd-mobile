'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Mail,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';
import { useCustomerAuth } from '@/context/CustomerAuthContext';

function WholesaleLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const { customer, isAuthenticated, isWholesale, login } = useCustomerAuth();

  const [shopName, setShopName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot Password Modal State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');

    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), portal: 'wholesale' }),
      });
      const data = await res.json();
      setForgotMessage(
        data.message ||
          'If an account associated with this email exists, password reset instructions have been dispatched.'
      );
    } catch {
      setForgotError('Could not process request. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // If already authenticated as wholesale or super wholesale, redirect
  useEffect(() => {
    if (isAuthenticated && customer) {
      if (isWholesale || customer.customerType === 'SUPER_WHOLESALE') {
        router.replace(redirectUrl);
      }
    }
  }, [isAuthenticated, customer, isWholesale, router, redirectUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanShopName = shopName.trim();
    if (!cleanShopName) {
      setError('Please enter your registered Shop Name.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const authCustomer = await login(cleanShopName, password);
      if (authCustomer.customerType !== 'WHOLESALE' && authCustomer.customerType !== 'SUPER_WHOLESALE') {
        // Logged in with an account that isn't wholesale
        setError('This account does not have wholesale customer privileges.');
        return;
      }
      router.push(redirectUrl);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Invalid shop name or password. Please verify your credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-neutral-950 flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-10 border border-neutral-200/90 shadow-2xl space-y-6">
        {/* Header */}
        <div className="space-y-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-neutral-950 text-white flex items-center justify-center mx-auto shadow-md">
            <Building2 className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-[11px] font-bold uppercase tracking-widest mt-2">
            <ShieldCheck className="w-3.5 h-3.5 text-neutral-900" />
            <span>Wholesale Partner Portal</span>
          </div>
          <h1 className="text-2xl font-black text-neutral-950 tracking-tight">
            Wholesale Customer Login
          </h1>
          <p className="text-xs text-neutral-500 leading-relaxed max-w-sm mx-auto">
            Sign in with your registered shop credentials to access wholesale pricing and rapid B2B ordering.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-neutral-800 block mb-1.5">
              Shop Name <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="wholesale-login-shopname"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Khan Mobile Center"
                className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 transition-all text-xs font-medium"
              />
            </div>
            <p className="text-[10px] text-neutral-400 mt-1">
              Your registered shop name is your wholesale login identifier.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-neutral-800">
                Password <span className="text-rose-500 font-bold">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotMessage('');
                  setForgotError('');
                  setForgotModalOpen(true);
                }}
                className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-950 underline transition-colors cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="wholesale-login-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 transition-all text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="wholesale-login-submit-button"
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-3"
          >
            <span>{isLoading ? 'Verifying Account...' : 'Sign In as Wholesale Customer'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <Link href="/" className="hover:text-neutral-900 font-medium transition-colors">
            ← Return to Store
          </Link>
          <Link href="/login" className="hover:text-neutral-900 font-medium transition-colors">
            Retail Customer Login →
          </Link>
        </div>
      </div>

      {/* Wholesale Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-neutral-200 animate-in fade-in duration-200">
            <button
              onClick={() => setForgotModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-100 border border-neutral-200 text-[10px] font-mono font-bold text-neutral-800 uppercase tracking-widest mb-2">
                  <ShieldCheck className="w-3 h-3 text-neutral-950" />
                  <span>Wholesale Recovery</span>
                </div>
                <h3 className="text-lg font-black tracking-tight text-neutral-950">
                  Reset Wholesale Password
                </h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  Enter the email address registered with your wholesale shop account to receive password reset instructions.
                </p>
              </div>

              {forgotMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span className="leading-relaxed">{forgotMessage}</span>
                </div>
              )}

              {forgotError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              {!forgotMessage && (
                <form onSubmit={handleForgotPassword} className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-neutral-800 block mb-1.5">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="shopowner@example.com"
                        className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3.5 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending Request...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Recovery Link</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {forgotMessage && (
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(false)}
                  className="w-full py-3 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WholesaleLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white text-xs">
          Loading Wholesale Portal...
        </div>
      }
    >
      <WholesaleLoginContent />
    </Suspense>
  );
}
