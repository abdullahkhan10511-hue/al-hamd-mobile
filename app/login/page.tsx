'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { requestCustomerPasswordReset } from '@/lib/db/customers';
import CustomerLoginView from '@/components/login/CustomerLoginView';
import {
  getLoginPageSettings,
  fetchLoginPageSettings,
  getLoginPageMedia,
  fetchLoginPageMedia,
  LoginPageSettings,
  LoginPageMediaItem,
  DEFAULT_LOGIN_PAGE_SETTINGS,
} from '@/lib/db/loginPage';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
  const redirectUrl = searchParams.get('redirect') || '/account';

  const { customer, isAuthenticated, login, register } = useCustomerAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);

  // Dynamic Login Page Settings and Media
  const [settings, setSettings] = useState<LoginPageSettings>(DEFAULT_LOGIN_PAGE_SETTINGS);
  const [mediaItems, setMediaItems] = useState<LoginPageMediaItem[]>([]);

  const loadData = useCallback(async () => {
    // 1. Initial fast local load
    setSettings(getLoginPageSettings());
    setMediaItems(getLoginPageMedia());

    // 2. Network sync from server disk
    try {
      const [serverSettings, serverMedia] = await Promise.all([
        fetchLoginPageSettings(),
        fetchLoginPageMedia(),
      ]);
      setSettings(serverSettings);
      setMediaItems(serverMedia);
    } catch (err) {
      console.warn('Network sync for login appearance failed:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleUpdate = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      const LOGIN_KEYS = ['login_page_settings', 'login_page_media', 'store_settings'];
      if (key && !LOGIN_KEYS.includes(key)) return;
      loadData();
    };
    window.addEventListener('alhamd:data-updated', handleUpdate);
    return () => window.removeEventListener('alhamd:data-updated', handleUpdate);
  }, [loadData]);

  // Sync tab with URL query parameter if it changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'register') setActiveTab('register');
    else if (tab === 'login') setActiveTab('login');
  }, [searchParams]);

  // If already authenticated, redirect to /account
  useEffect(() => {
    if (isAuthenticated && customer) {
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, customer, router, redirectUrl]);

  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register Form States
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Forgot Password Modal State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const identifier = loginEmail.trim();
    if (!identifier || !loginPassword) {
      setLoginError('Please enter both your email address or shop name and password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      await login(identifier, loginPassword);
      router.push(redirectUrl);
    } catch (err: any) {
      // Seamlessly recognize and authenticate Administrator / Staff credentials if format matches email
      if (identifier.includes('@')) {
        try {
          const adminRes = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: identifier, password: loginPassword }),
          });
          const adminData = await adminRes.json();
          if (adminRes.ok && adminData.success) {
            try {
              localStorage.setItem('alhamd_current_admin', JSON.stringify(adminData.user));
            } catch {}
            window.location.href = '/admin/dashboard';
            return;
          }
        } catch {}
      }

      setLoginError(err?.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    const fullName = regFullName.trim();
    const email = regEmail.trim();
    const phone = regPhone.trim();

    if (!fullName) {
      setRegError('Please enter your full name.');
      return;
    }

    if (!email || !email.includes('@')) {
      setRegError('Please enter a valid email address.');
      return;
    }

    if (!phone) {
      setRegError('Please enter your phone number.');
      return;
    }

    if (!regPassword || regPassword.length < 6) {
      setRegError('Password must be at least 6 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match.');
      return;
    }

    setIsRegistering(true);
    try {
      await register({
        fullName,
        email,
        phone,
        password: regPassword,
      });
      router.push(redirectUrl);
    } catch (err: any) {
      setRegError(err?.message || 'Failed to create customer account. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

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
      const res = await requestCustomerPasswordReset(forgotEmail);
      setForgotMessage(res.message);
    } catch (err: any) {
      setForgotError('Could not process request. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-80px)] flex items-center justify-center p-3 sm:p-6 lg:p-10 transition-colors duration-200"
      style={{ backgroundColor: settings.pageBgColor || '#0a0a0a' }}
    >
      {/* Customer Login Unified View */}
      <CustomerLoginView
        settings={settings}
        mediaItems={mediaItems}
        isPreview={false}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setLoginError('');
          setRegError('');
        }}
        loginIdentifier={loginEmail}
        onLoginIdentifierChange={setLoginEmail}
        loginPassword={loginPassword}
        onLoginPasswordChange={setLoginPassword}
        rememberMe={rememberMe}
        onRememberMeChange={setRememberMe}
        loginError={loginError}
        isLoggingIn={isLoggingIn}
        onLoginSubmit={handleLoginSubmit}
        onForgotPasswordClick={() => {
          setForgotEmail(loginEmail);
          setForgotMessage('');
          setForgotError('');
          setForgotModalOpen(true);
        }}
        regFullName={regFullName}
        onRegFullNameChange={setRegFullName}
        regEmail={regEmail}
        onRegEmailChange={setRegEmail}
        regPhone={regPhone}
        onRegPhoneChange={setRegPhone}
        regPassword={regPassword}
        onRegPasswordChange={setRegPassword}
        regConfirmPassword={regConfirmPassword}
        onRegConfirmPasswordChange={setRegConfirmPassword}
        regError={regError}
        isRegistering={isRegistering}
        onRegisterSubmit={handleRegisterSubmit}
      />

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-neutral-200 animate-in fade-in duration-200">
            <button
              onClick={() => setForgotModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Reset Your Password</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Enter the email address registered with your customer account and we will send password recovery instructions.
                </p>
              </div>

              {forgotMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{forgotMessage}</span>
                </div>
              )}

              {forgotError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              {!forgotMessage && (
                <form onSubmit={handleForgotPassword} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-neutral-800 block mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-950 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? 'Processing...' : 'Send Reset Instructions'}
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white text-xs">
          Loading AL-HAMD Customer Portal...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
