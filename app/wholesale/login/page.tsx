'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Lock, Eye, EyeOff, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
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
    } catch (err: any) {
      setError(err?.message || 'Invalid shop name or password. Please verify your credentials.');
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
            <label className="font-bold text-neutral-800 block mb-1.5">
              Password <span className="text-rose-500 font-bold">*</span>
            </label>
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
