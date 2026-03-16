import React, { useState } from 'react';
import { Sprout, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useClerk, useSignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Language, translations } from '../utils/translations';
import { useAuthStore } from '../store';
import { authService } from '../services/auth';

interface LoginProps {
  onNavigate: (page: any) => void;
  language?: Language;
}

function getClerkErrorCode(error: any): string {
  return String(error?.errors?.[0]?.code || '').toLowerCase();
}

function getClerkErrorMessage(error: any): string {
  return String(
    error?.errors?.[0]?.longMessage ||
    error?.errors?.[0]?.message ||
    error?.message ||
    ''
  );
}

function isClerkConfigurationError(error: any): boolean {
  const code = getClerkErrorCode(error);
  const message = getClerkErrorMessage(error).toLowerCase();

  return (
    code.includes('strategy') ||
    code.includes('identifier_not_found') ||
    code.includes('password') ||
    message.includes('password authentication') ||
    message.includes('strategy') ||
    message.includes('sign-in is not allowed') ||
    message.includes('this identifier is not valid')
  );
}

function formatLoginError(error: any): string {
  const code = getClerkErrorCode(error);
  const message = getClerkErrorMessage(error);

  if (code.includes('form_password_incorrect')) {
    return 'Incorrect email or password.';
  }

  if (code.includes('form_identifier_not_found')) {
    return 'No account exists for this email in the current Clerk instance.';
  }

  if (code.includes('strategy') || code.includes('password')) {
    return 'Clerk rejected email/password sign-in. Enable Password sign-in in Clerk or continue with the hosted sign-in flow.';
  }

  return message || 'Failed to sign in. Please check your credentials.';
}

function getPendingSignInMessage(status: string | null | undefined): string {
  switch (status) {
    case 'needs_first_factor':
      return 'Additional sign-in steps are required. Continue in the hosted Clerk sign-in flow.';
    case 'needs_second_factor':
      return 'Two-factor authentication is required. Continue in the hosted Clerk sign-in flow.';
    case 'needs_new_password':
      return 'A password reset is required before you can continue. Open the hosted Clerk sign-in flow.';
    default:
      return 'Additional verification required. Continue in the hosted Clerk sign-in flow.';
  }
}

export const Login: React.FC<LoginProps> = ({ onNavigate, language = 'en' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showHostedFallback, setShowHostedFallback] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const { signIn, setActive, isLoaded } = useSignIn();
  const clerk = useClerk();
  const navigate = useNavigate();
  const setAuthLoading = useAuthStore((state) => state.setLoading);

  const t = translations[language].login;

  const handleHostedSignIn = async () => {
    await clerk.redirectToSignIn({
      signInFallbackRedirectUrl: '/dashboard',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    authService.clearPreferredRole();
    setIsLoading(true);
    setError('');
    setInfo('');
    setShowHostedFallback(false);

    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === 'complete') {
        setAuthLoading(true);
        await setActive({ session: result.createdSessionId });
        navigate('/dashboard');
      } else {
        setShowHostedFallback(true);
        setError(getPendingSignInMessage(result.status));
      }
    } catch (err: any) {
      setShowHostedFallback(isClerkConfigurationError(err));
      setError(formatLoginError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!isLoaded || !signIn) return;

    if (!email.trim()) {
      setError('Enter your email first, then use forgot password.');
      return;
    }

    authService.clearPreferredRole();
    setIsResettingPassword(true);
    setError('');
    setInfo('');
    setShowHostedFallback(false);

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      } as any);
      setInfo('Password reset code sent. Continue in the hosted sign-in screen.');
      navigate('/sign-in');
    } catch (err: any) {
      setShowHostedFallback(true);
      setError(formatLoginError(err));
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1EA] dark:bg-slate-900 flex animate-fade-in transition-colors duration-300">
      <div className="hidden lg:flex w-1/2 relative bg-[#2D5A27] text-white flex-col justify-between p-12 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1598512752271-33f913a5af13?q=80&w=2000&auto=format&fit=crop"
          className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay"
          alt="Farming"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/50 to-[#2D5A27]/50 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="bg-white/10 p-2 rounded-lg backdrop-blur-md">
              <Sprout size={24} className="text-[#4ade80]" />
            </div>
            <span className="text-xl font-bold tracking-tight">RwandaBeyond</span>
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-4">
            Cultivating Intelligence. <br /> Harvesting Success.
          </h1>
          <p className="text-emerald-100 text-lg max-w-md">
            Join 1,200+ farmers in Rwamagana using data to increase yields by up to 40%.
          </p>
        </div>

        <div className="relative z-10 flex gap-4 text-sm font-medium text-emerald-200/80">
          <span>Copyright 2024 RwandaBeyond</span>
          <span>Privacy Policy</span>
          <span>Terms</span>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{t.welcome}</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">{t.subtitle}</p>
          </div>

          <div className="relative flex items-center gap-4 py-2">
            <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
            <span className="text-xs font-bold text-slate-400 uppercase">{t.secure}</span>
            <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}
          {showHostedFallback && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-200 px-4 py-3 rounded-xl text-sm space-y-3">
              <p>If the browser console shows `400` for Clerk, use the hosted flow to see the exact Clerk validation state.</p>
              <button
                type="button"
                onClick={() => void handleHostedSignIn()}
                className="font-semibold underline underline-offset-2"
              >
                Continue with hosted Clerk sign-in
              </button>
            </div>
          )}
          {info && (
            <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-xl text-sm">
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.email}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input
                  type="email"
                  placeholder="e.g. jean@farm.rw"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition-all"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.password}</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResettingPassword || !isLoaded}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-70"
                >
                  {isResettingPassword ? 'Sending reset code...' : t.forgot}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition-all"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isLoaded}
              className="w-full bg-[#2D5A27] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#1a3817] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {t.signIn} <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm">
            {t.noAccount}{' '}
            <button onClick={() => onNavigate('signup')} className="font-bold text-[#2D5A27] dark:text-emerald-400 hover:underline">
              {t.create}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

