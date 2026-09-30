'use client';

import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { LoginPageSettings, LoginPageMediaItem } from '@/lib/db/loginPage';
import LoginMediaShowcase from '@/components/login/LoginMediaShowcase';

export interface CustomerLoginViewProps {
  settings: LoginPageSettings;
  mediaItems: LoginPageMediaItem[];
  isPreview?: boolean;

  // Tab State
  activeTab?: 'login' | 'register';
  onTabChange?: (tab: 'login' | 'register') => void;

  // Login Form Handlers & State
  loginIdentifier?: string;
  onLoginIdentifierChange?: (val: string) => void;
  loginPassword?: string;
  onLoginPasswordChange?: (val: string) => void;
  rememberMe?: boolean;
  onRememberMeChange?: (val: boolean) => void;
  loginError?: string;
  isLoggingIn?: boolean;
  onLoginSubmit?: (e: React.FormEvent) => void;
  onForgotPasswordClick?: () => void;

  // Register Form Handlers & State
  regFullName?: string;
  onRegFullNameChange?: (val: string) => void;
  regEmail?: string;
  onRegEmailChange?: (val: string) => void;
  regPhone?: string;
  onRegPhoneChange?: (val: string) => void;
  regPassword?: string;
  onRegPasswordChange?: (val: string) => void;
  regConfirmPassword?: string;
  onRegConfirmPasswordChange?: (val: string) => void;
  regError?: string;
  isRegistering?: boolean;
  onRegisterSubmit?: (e: React.FormEvent) => void;
}

export default function CustomerLoginView({
  settings,
  mediaItems,
  isPreview = false,
  activeTab: controlledActiveTab,
  onTabChange,
  loginIdentifier = '',
  onLoginIdentifierChange,
  loginPassword = '',
  onLoginPasswordChange,
  rememberMe = true,
  onRememberMeChange,
  loginError = '',
  isLoggingIn = false,
  onLoginSubmit,
  onForgotPasswordClick,
  regFullName = '',
  onRegFullNameChange,
  regEmail = '',
  onRegEmailChange,
  regPhone = '',
  onRegPhoneChange,
  regPassword = '',
  onRegPasswordChange,
  regConfirmPassword = '',
  onRegConfirmPasswordChange,
  regError = '',
  isRegistering = false,
  onRegisterSubmit,
}: CustomerLoginViewProps) {
  // Internal tab state if uncontrolled (e.g. inside preview)
  const [internalTab, setInternalTab] = useState<'login' | 'register'>('login');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Local demo form values for preview interactivity
  const [demoIdentifier, setDemoIdentifier] = useState(loginIdentifier || '');
  const [demoPassword, setDemoPassword] = useState(loginPassword || '');
  const [demoFullName, setDemoFullName] = useState(regFullName || '');
  const [demoEmail, setDemoEmail] = useState(regEmail || '');
  const [demoPhone, setDemoPhone] = useState(regPhone || '');
  const [demoRegPass, setDemoRegPass] = useState(regPassword || '');
  const [demoRegConfirm, setDemoRegConfirm] = useState(regConfirmPassword || '');

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalTab;

  const handleTabClick = (tab: 'login' | 'register') => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const showMedia = settings.showMediaSection;
  const isMediaRight = settings.mediaPosition === 'right';

  // Resolved dynamic colors & styles
  const pageBg = settings.pageBgColor || '#0a0a0a';
  const cardBg = settings.cardBgColor || '#ffffff';
  const headingColor = settings.headingColor || '#0a0a0a';
  const textColor = settings.textColor || '#737373';
  const buttonBg = settings.buttonBgColor || '#0a0a0a';
  const buttonText = settings.buttonTextColor || '#ffffff';
  const inputBg = settings.inputBgColor || '#fafafa';
  const inputBorder = settings.inputBorderColor || '#e5e5e5';

  // Radius mapping
  const radiusMap: Record<string, string> = {
    none: 'rounded-none',
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
    '2xl': 'rounded-3xl',
    '3xl': 'rounded-[2rem]',
  };
  const cardRadiusClass = radiusMap[settings.borderRadius || '2xl'] || 'rounded-3xl';
  const inputRadiusClass =
    settings.borderRadius === 'none'
      ? 'rounded-none'
      : settings.borderRadius === 'sm'
      ? 'rounded-md'
      : 'rounded-xl';
  const buttonRadiusClass =
    settings.borderRadius === 'none'
      ? 'rounded-none'
      : settings.borderRadius === 'sm'
      ? 'rounded-md'
      : 'rounded-xl';

  // Logo sizing
  const logoHeightClass =
    settings.logoSize === 'sm' ? 'h-6' : settings.logoSize === 'lg' ? 'h-12' : 'h-8';

  return (
    <div
      className="w-full flex items-center justify-center p-3 sm:p-6 lg:p-8 transition-colors duration-200"
      style={{ backgroundColor: pageBg }}
    >
      <div
        className={`w-full ${
          showMedia ? 'max-w-6xl' : 'max-w-lg'
        } ${cardRadiusClass} overflow-hidden shadow-2xl border border-neutral-800/80 transition-all duration-300 min-h-[580px] ${
          showMedia ? 'grid grid-cols-1 lg:grid-cols-12' : 'flex items-center justify-center'
        }`}
        style={{ backgroundColor: cardBg }}
      >
        {/* MEDIA SHOWCASE AREA */}
        {showMedia && (
          <div
            className={`lg:col-span-5 relative border-neutral-800/80 overflow-hidden ${
              isMediaRight
                ? 'order-2 border-t lg:border-t-0 lg:border-l'
                : 'order-1 border-b lg:border-b-0 lg:border-r'
            }`}
          >
            <LoginMediaShowcase settings={settings} mediaItems={mediaItems} isPreview={isPreview} />
          </div>
        )}

        {/* AUTHENTICATION FORM CARD */}
        <div
          className={`${
            showMedia ? 'lg:col-span-7' : 'w-full'
          } ${
            isMediaRight ? 'order-1' : 'order-2'
          } p-6 sm:p-10 lg:p-12 flex flex-col justify-center transition-colors duration-200`}
          style={{ backgroundColor: cardBg }}
        >
          <div className="max-w-md w-full mx-auto space-y-6">
            {/* Optional Top Branding Bar */}
            {(settings.showLogo || settings.brandName) && (
              <div className="flex items-center gap-3 pb-2 border-b border-neutral-100">
                {settings.showLogo && settings.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt={settings.brandName || 'Brand Logo'}
                    className={`${logoHeightClass} w-auto object-contain`}
                  />
                ) : settings.showLogo ? (
                  <div className="w-8 h-8 rounded-lg bg-neutral-950 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                ) : null}

                {settings.brandName && (
                  <div>
                    <span className="font-extrabold text-sm tracking-tight block" style={{ color: headingColor }}>
                      {settings.brandName}
                    </span>
                    {settings.tagline && (
                      <span className="text-[10px] text-neutral-400 block -mt-0.5">
                        {settings.tagline}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab Switcher */}
            <div className={`p-1 bg-neutral-100/90 ${inputRadiusClass} flex items-center select-none`}>
              <button
                type="button"
                id="customer-login-tab"
                onClick={() => handleTabClick('login')}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider ${inputRadiusClass} transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                id="customer-register-tab"
                onClick={() => handleTabClick('register')}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider ${inputRadiusClass} transition-all cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* TAB 1: LOGIN */}
            {activeTab === 'login' && (
              <div className="space-y-5">
                <div>
                  <h2
                    className="text-2xl font-black tracking-tight"
                    style={{ color: headingColor }}
                  >
                    {settings.mainHeading || 'Welcome to AL-HAMD'}
                  </h2>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: textColor }}>
                    {settings.subtitle ||
                      'Sign in to track orders, manage your wishlist, and submit verified reviews.'}
                  </p>
                </div>

                {loginError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    if (isPreview) {
                      e.preventDefault();
                      return;
                    }
                    if (onLoginSubmit) onLoginSubmit(e);
                  }}
                  className="space-y-4 text-xs"
                >
                  {/* Identifier Input */}
                  <div>
                    <label className="font-bold block mb-1.5" style={{ color: headingColor }}>
                      {settings.identifierLabel || 'Email Address or Shop Name'}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        id="customer-login-identifier"
                        required={!isPreview}
                        autoComplete="username"
                        value={isPreview ? demoIdentifier : loginIdentifier}
                        onChange={(e) => {
                          if (isPreview) {
                            setDemoIdentifier(e.target.value);
                          } else if (onLoginIdentifierChange) {
                            onLoginIdentifierChange(e.target.value);
                          }
                        }}
                        placeholder={
                          settings.identifierPlaceholder || 'you@example.com or Shop Name'
                        }
                        className={`w-full pl-10 pr-3.5 py-3 ${inputRadiusClass} border text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 transition-all text-xs`}
                        style={{
                          backgroundColor: inputBg,
                          borderColor: inputBorder,
                        }}
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-bold" style={{ color: headingColor }}>
                        {settings.passwordLabel || 'Password'}
                      </label>
                      <button
                        type="button"
                        id="customer-forgot-password-link"
                        onClick={() => {
                          if (!isPreview && onForgotPasswordClick) {
                            onForgotPasswordClick();
                          }
                        }}
                        className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-950 underline transition-colors cursor-pointer"
                      >
                        {settings.forgotPasswordText || 'Forgot Password?'}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        id="customer-login-password"
                        required={!isPreview}
                        value={isPreview ? demoPassword : loginPassword}
                        onChange={(e) => {
                          if (isPreview) {
                            setDemoPassword(e.target.value);
                          } else if (onLoginPasswordChange) {
                            onLoginPasswordChange(e.target.value);
                          }
                        }}
                        placeholder="••••••••"
                        className={`w-full pl-10 pr-10 py-3 ${inputRadiusClass} border text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 transition-all text-xs`}
                        style={{
                          backgroundColor: inputBg,
                          borderColor: inputBorder,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                        title={showLoginPassword ? 'Hide password' : 'Show password'}
                      >
                        {showLoginPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-neutral-600">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => {
                          if (onRememberMeChange) onRememberMeChange(e.target.checked);
                        }}
                        className="w-4 h-4 rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950"
                      />
                      <span>Remember my session</span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    id="customer-login-submit-button"
                    disabled={isLoggingIn}
                    className={`w-full py-3.5 px-6 ${buttonRadiusClass} font-bold text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2`}
                    style={{
                      backgroundColor: buttonBg,
                      color: buttonText,
                    }}
                  >
                    <span>
                      {isLoggingIn ? 'Verifying...' : settings.buttonText || 'Sign In'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="text-center pt-3 border-t border-neutral-100 text-xs text-neutral-500">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleTabClick('register')}
                    className="font-bold text-neutral-950 hover:underline cursor-pointer"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: CREATE ACCOUNT */}
            {activeTab === 'register' && (
              <div className="space-y-4">
                <div>
                  <h2
                    className="text-2xl font-black tracking-tight"
                    style={{ color: headingColor }}
                  >
                    {settings.createAccountHeading || 'Create Customer Account'}
                  </h2>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: textColor }}>
                    {settings.createAccountSubtitle ||
                      'Join AL-HAMD for seamless ordering, cart preservation, and priority support.'}
                  </p>
                </div>

                {regError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    if (isPreview) {
                      e.preventDefault();
                      return;
                    }
                    if (onRegisterSubmit) onRegisterSubmit(e);
                  }}
                  className="space-y-3 text-xs"
                >
                  {/* Full Name */}
                  <div>
                    <label className="font-bold block mb-1" style={{ color: headingColor }}>
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        id="customer-register-fullname"
                        required={!isPreview}
                        value={isPreview ? demoFullName : regFullName}
                        onChange={(e) => {
                          if (isPreview) {
                            setDemoFullName(e.target.value);
                          } else if (onRegFullNameChange) {
                            onRegFullNameChange(e.target.value);
                          }
                        }}
                        placeholder="e.g. Hamza Khan"
                        className={`w-full pl-10 pr-3.5 py-2.5 ${inputRadiusClass} border text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 transition-all text-xs`}
                        style={{
                          backgroundColor: inputBg,
                          borderColor: inputBorder,
                        }}
                      />
                    </div>
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold block mb-1" style={{ color: headingColor }}>
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          id="customer-register-email"
                          required={!isPreview}
                          value={isPreview ? demoEmail : regEmail}
                          onChange={(e) => {
                            if (isPreview) {
                              setDemoEmail(e.target.value);
                            } else if (onRegEmailChange) {
                              onRegEmailChange(e.target.value);
                            }
                          }}
                          placeholder="you@domain.com"
                          className={`w-full pl-10 pr-3.5 py-2.5 ${inputRadiusClass} border text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 transition-all text-xs`}
                          style={{
                            backgroundColor: inputBg,
                            borderColor: inputBorder,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold block mb-1" style={{ color: headingColor }}>
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          id="customer-register-phone"
                          required={!isPreview}
                          value={isPreview ? demoPhone : regPhone}
                          onChange={(e) => {
                            if (isPreview) {
                              setDemoPhone(e.target.value);
                            } else if (onRegPhoneChange) {
                              onRegPhoneChange(e.target.value);
                            }
                          }}
                          placeholder="+92 300 1234567"
                          className={`w-full pl-10 pr-3.5 py-2.5 ${inputRadiusClass} border text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 transition-all text-xs`}
                          style={{
                            backgroundColor: inputBg,
                            borderColor: inputBorder,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Password Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold block mb-1" style={{ color: headingColor }}>
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          id="customer-register-password"
                          required={!isPreview}
                          value={isPreview ? demoRegPass : regPassword}
                          onChange={(e) => {
                            if (isPreview) {
                              setDemoRegPass(e.target.value);
                            } else if (onRegPasswordChange) {
                              onRegPasswordChange(e.target.value);
                            }
                          }}
                          placeholder="Min. 6 chars"
                          className={`w-full pl-10 pr-9 py-2.5 ${inputRadiusClass} border text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 transition-all text-xs`}
                          style={{
                            backgroundColor: inputBg,
                            borderColor: inputBorder,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                        >
                          {showRegPassword ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold block mb-1" style={{ color: headingColor }}>
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showRegConfirmPassword ? 'text' : 'password'}
                          id="customer-register-confirm-password"
                          required={!isPreview}
                          value={isPreview ? demoRegConfirm : regConfirmPassword}
                          onChange={(e) => {
                            if (isPreview) {
                              setDemoRegConfirm(e.target.value);
                            } else if (onRegConfirmPasswordChange) {
                              onRegConfirmPasswordChange(e.target.value);
                            }
                          }}
                          placeholder="Repeat password"
                          className={`w-full pl-10 pr-9 py-2.5 ${inputRadiusClass} border text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950/20 transition-all text-xs`}
                          style={{
                            backgroundColor: inputBg,
                            borderColor: inputBorder,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                        >
                          {showRegConfirmPassword ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Register Submit Button */}
                  <button
                    type="submit"
                    id="customer-register-submit-button"
                    disabled={isRegistering}
                    className={`w-full py-3.5 px-6 ${buttonRadiusClass} font-bold text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2`}
                    style={{
                      backgroundColor: buttonBg,
                      color: buttonText,
                    }}
                  >
                    <span>
                      {isRegistering
                        ? 'Creating Account...'
                        : settings.createAccountButtonText || 'Create Account'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="text-center pt-2 border-t border-neutral-100 text-xs text-neutral-500">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => handleTabClick('login')}
                    className="font-bold text-neutral-950 hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            )}

            {/* Footer Trust Notice */}
            {settings.footerNotice && (
              <p
                className="text-[11px] text-center pt-2 border-t border-neutral-100 font-medium"
                style={{ color: textColor }}
              >
                {settings.footerNotice}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
