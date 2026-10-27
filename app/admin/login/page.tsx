'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  getAdminLoginSettings,
  getAdminLoginImages,
  AdminLoginSettings,
  AdminLoginImage,
  DEFAULT_ADMIN_LOGIN_SETTINGS,
} from '@/lib/db/adminLoginAppearance';

function getSafeAdminRedirect(target: string | null | undefined): string {
  if (!target) return '/admin/dashboard';
  const clean = target.trim();
  // Prevent protocol-relative URLs (//evil.com), absolute URLs (https://), javascript:, data:, or backslashes
  if (clean.startsWith('//') || clean.includes('://') || clean.includes('\\')) {
    return '/admin/dashboard';
  }
  // Enforce that redirects only navigate to internal /admin routes
  if (!clean.startsWith('/admin')) {
    return '/admin/dashboard';
  }
  // Prevent redirecting back to login itself
  if (clean === '/admin/login' || clean.startsWith('/admin/login?')) {
    return '/admin/dashboard';
  }
  return clean;
}

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams?.get('redirect');
  const safeDestination = getSafeAdminRedirect(redirectParam);
  const errorParam = searchParams?.get('error');

  const { login, admin, isAuthenticated, isLoading } = useAdminAuth();

  // Appearance and images loaded from storage
  const [settings, setSettings] = useState<AdminLoginSettings>(() => getAdminLoginSettings());
  const [images, setImages] = useState<AdminLoginImage[]>(() => getAdminLoginImages());
  const [currentSlide, setCurrentSlide] = useState(0);

  // Form fields - empty by default (no hardcoded credentials)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState(
    errorParam === 'customer_unauthorized'
      ? 'Access Denied: Customer accounts cannot access the Administrator Panel. Please sign in with staff credentials.'
      : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setForgotError('Please enter a valid staff email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), portal: 'staff' }),
      });
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json().catch(() => null) : null;
      setForgotMessage(
        data?.message ||
          'If an account associated with this email exists, password reset instructions have been dispatched.'
      );
    } catch {
      setForgotError('Could not process request. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Load appearance settings and active images
  const loadAppearance = useCallback(() => {
    setSettings(getAdminLoginSettings());
    setImages(getAdminLoginImages());
  }, []);

  useEffect(() => {
    const handleUpdate = () => loadAppearance();
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [loadAppearance]);

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (!isLoading && isAuthenticated && admin) {
      router.replace(safeDestination);
    }
  }, [isLoading, isAuthenticated, admin, router, safeDestination]);

  // Filter only active images for the slider
  const activeImages = useMemo(() => {
    return images.filter((img) => img.isActive);
  }, [images]);

  // Automatic slide rotation
  useEffect(() => {
    if (!settings.autoPlay || activeImages.length <= 1) return;

    const intervalTime = Math.max(settings.slideDuration || 5000, 2000);
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeImages.length);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [settings.autoPlay, settings.slideDuration, activeImages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError('');
    setIsSubmitting(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        window.location.href = safeDestination;
      } else {
        setIsSubmitting(false);
        setError(result.error || 'Invalid email or password. Please verify your credentials and try again.');
      }
    } catch {
      setIsSubmitting(false);
      setError('Invalid email or password. Please verify your credentials and try again.');
    }
  };

  // Transition variants based on appearance setting
  const slideVariants = {
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 1.2, ease: 'easeInOut' as const } },
      exit: { opacity: 0, transition: { duration: 0.8, ease: 'easeInOut' as const } },
    },
    slide: {
      initial: { opacity: 0, x: 60 },
      animate: { opacity: 1, x: 0, transition: { duration: 0.8, ease: 'easeOut' as const } },
      exit: { opacity: 0, x: -60, transition: { duration: 0.6, ease: 'easeIn' as const } },
    },
    zoom: {
      initial: { opacity: 0, scale: 1.15 },
      animate: {
        opacity: 1,
        scale: 1,
        transition: { duration: 1.4, ease: 'easeOut' as const },
      },
      exit: { opacity: 0, scale: 0.95, transition: { duration: 0.8, ease: 'easeIn' as const } },
    },
  };

  const selectedVariant = slideVariants[settings.transition] || slideVariants.zoom;

  // Visual active image
  const currentImg = activeImages[currentSlide] || activeImages[0];

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-10 select-none antialiased"
      style={{
        backgroundColor: settings.backgroundColor || '#0a0a0a',
        color: settings.textColor || '#ffffff',
      }}
    >
      <div
        className="w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 min-h-[640px] border transition-colors duration-300"
        style={{
          borderColor: settings.borderColor || '#262626',
          backgroundColor: settings.cardColor || '#141414',
        }}
      >
        {/* ================================================================= */}
        {/* LEFT COLUMN: ANIMATED VISUAL SHOWCASE (CLEAN IMAGE ONLY)          */}
        {/* ================================================================= */}
        <div className="lg:col-span-6 relative overflow-hidden min-h-[380px] lg:min-h-[640px] bg-neutral-950">
          {/* Background Images with AnimatePresence */}
          {activeImages.length > 0 ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentImg?.id || currentSlide}
                initial={selectedVariant.initial}
                animate={selectedVariant.animate}
                exit={selectedVariant.exit}
                className="absolute inset-0 z-0"
              >
                <img
                  src={currentImg?.imageUrl}
                  alt={currentImg?.caption || 'AL-HAMD Mobile Visual'}
                  className="w-full h-full object-cover object-center"
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            /* Fallback luxury dark background pattern */
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
              <div className="w-96 h-96 rounded-full bg-amber-500/5 blur-3xl" />
              <div className="text-neutral-800 font-mono text-8xl font-black opacity-20 select-none">
                AL-HAMD
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* RIGHT COLUMN: PROFESSIONAL ADMIN AUTHENTICATION CARD             */}
        {/* ================================================================= */}
        <div className="lg:col-span-6 p-8 sm:p-12 lg:p-14 flex flex-col justify-between">
          {/* Top Branding Section */}
          <div className="max-w-md w-full mx-auto space-y-6">
            <div className="text-center sm:text-left space-y-3">
              {/* Logo / Badge */}
              <div className="flex items-center justify-center sm:justify-start gap-3">
                {settings.logo ? (
                  <img
                    src={settings.logo}
                    alt={settings.title || 'Brand Logo'}
                    className="h-9 w-auto max-w-[140px] object-contain"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm tracking-wider text-neutral-950 shadow-md"
                    style={{ backgroundColor: settings.accentColor || '#f59e0b' }}
                  >
                    AL
                  </div>
                )}

                <div>
                  <span
                    className="text-[10px] font-mono uppercase tracking-widest font-extrabold block"
                    style={{ color: settings.accentColor || '#f59e0b' }}
                  >
                    {settings.subtitle || 'Admin Control Panel'}
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-tight text-white block">
                    AL·HAMD·MOBILE
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {settings.title || 'Welcome Back'}
                </h1>
                <p
                  className="text-xs mt-1.5 leading-relaxed"
                  style={{ color: settings.secondaryTextColor || '#a3a3a3' }}
                >
                  {settings.description || 'Sign in to manage your AL-HAMD-MOBILE store.'}
                </p>
              </div>
            </div>

            {/* Error Notification Banner */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-start gap-2.5 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Authentication Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Email Field */}
              <div>
                <label
                  className="font-bold block mb-1.5 text-xs"
                  style={{ color: settings.textColor || '#ffffff' }}
                >
                  {settings.emailLabel || 'Staff Email'}
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: settings.secondaryTextColor || '#a3a3a3' }}
                  />
                  <input
                    type="email"
                    required
                    disabled={isSubmitting}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@alhamdmobile.com"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-neutral-950/80 border text-white focus:outline-none transition-all duration-200 text-xs disabled:opacity-50"
                    style={{
                      borderColor: settings.borderColor || '#262626',
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="font-bold text-xs"
                    style={{ color: settings.textColor || '#ffffff' }}
                  >
                    {settings.passwordLabel || 'Security Password'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotMessage('');
                      setForgotError('');
                      setForgotModalOpen(true);
                    }}
                    className="text-[11px] font-semibold hover:underline transition-colors cursor-pointer"
                    style={{ color: settings.secondaryTextColor || '#a3a3a3' }}
                  >
                    {settings.forgotPasswordText || 'Forgot Password?'}
                  </button>
                </div>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: settings.secondaryTextColor || '#a3a3a3' }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isSubmitting}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-neutral-950/80 border text-white focus:outline-none transition-all duration-200 text-xs disabled:opacity-50"
                    style={{
                      borderColor: settings.borderColor || '#262626',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
                  />
                  <span style={{ color: settings.secondaryTextColor || '#a3a3a3' }}>
                    {settings.rememberMeText || 'Remember administrator session'}
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                style={{
                  backgroundColor: settings.buttonColor || '#ffffff',
                  color: '#0a0a0a',
                }}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                    <span>Verifying Credentials...</span>
                  </div>
                ) : (
                  <>
                    <span>{settings.buttonText || 'Sign In'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer Security Badge */}
          <div className="max-w-md w-full mx-auto pt-6 mt-6 border-t border-neutral-800/80 text-center">
            <div className="inline-flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Protected by SHA-256 Multi-Factor Role-Based Access Control</span>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative text-white animate-in fade-in duration-200">
            <button
              onClick={() => setForgotModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest mb-2">
                  <Shield className="w-3 h-3" />
                  <span>Staff Recovery</span>
                </div>
                <h3 className="text-lg font-black tracking-tight text-white">Reset Staff Password</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Enter your registered staff email address to receive a secure, single-use password reset link.
                </p>
              </div>

              {forgotMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span className="leading-relaxed">{forgotMessage}</span>
                </div>
              )}

              {forgotError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{forgotError}</span>
                </div>
              )}

              {!forgotMessage && (
                <form onSubmit={handleForgotPassword} className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-neutral-300 block mb-1.5">
                      Staff Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="admin@alhamd-mobile.com"
                        className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-neutral-700 bg-neutral-950 text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs tracking-wider uppercase transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending Request...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Recovery Instructions</span>
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
                  className="w-full py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
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

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white text-xs">
          Loading AL-HAMD Admin Portal...
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
