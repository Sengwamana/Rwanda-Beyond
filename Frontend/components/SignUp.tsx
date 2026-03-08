import React, { useState } from 'react';
import { Sprout, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useSignUp } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '../types';
import { Language, translations } from '../utils/translations';
import { useAuthStore } from '../store';
import { authService } from '../services/auth';

interface SignUpProps {
  onNavigate: (page: any) => void;
  language?: Language;
}

function getClerkErrorMessage(error: any): string {
  return String(
    error?.errors?.[0]?.longMessage ||
    error?.errors?.[0]?.message ||
    error?.message ||
    ''
  );
}

function isCaptchaFailure(error: any): boolean {
  const code = String(error?.errors?.[0]?.code || '').toLowerCase();
  const message = getClerkErrorMessage(error).toLowerCase();

  return (
    code.includes('captcha') ||
    message.includes('captcha') ||
    message.includes('turnstile') ||
    message.includes('unsupported browser') ||
    message.includes('failed to load')
  );
}

function formatSignUpError(error: any): string {
  const code = String(error?.errors?.[0]?.code || '').toLowerCase();
  const message = getClerkErrorMessage(error);

  if (code.includes('identifier_exists')) {
    return 'An account already exists for this email. Sign in instead or use a different email.';
  }

  if (code.includes('password')) {
    return message || 'Password requirements were not met.';
  }

  return message || 'Failed to create account. Please try again.';
}

export const SignUp: React.FC<SignUpProps> = ({ onNavigate, language = 'en' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<UserRole>('farmer');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isCaptchaError, setIsCaptchaError] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  const { signUp, setActive, isLoaded } = useSignUp();
  const navigate = useNavigate();
  const setAuthLoading = useAuthStore((state) => state.setLoading);
  
  const t = translations[language].signup;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    authService.setPreferredRole(role);
    setIsLoading(true);
    setError('');
    setIsCaptchaError(false);

    try {
      const result = await signUp.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        emailAddress: email.trim(),
        password,
        unsafeMetadata: {
          role,
        },
      });

      // Check if signup is complete (no verification needed)
      if (result.status === 'complete') {
        setAuthLoading(true);
        await setActive({ session: result.createdSessionId });
        navigate('/dashboard');
        return;
      }

      // Check if email verification is needed
      if (result.status === 'missing_requirements') {
        const emailNeedsVerification = result.unverifiedFields?.includes('email_address');
        
        if (emailNeedsVerification) {
          // Send email verification code
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setPendingVerification(true);
        } else {
          // Other requirements - show what's missing
          setError(`Additional verification required: ${result.unverifiedFields?.join(', ') || 'unknown'}`);
        }
      } else {
        // Handle other statuses
        console.log('Sign up status:', result.status);
        setError('Sign up incomplete. Please try again or contact support.');
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      if (isCaptchaFailure(err)) {
        setIsCaptchaError(true);
        setError('CAPTCHA failed to load. Disable privacy/ad-block extensions for this site, then retry. If it still fails, use the Clerk hosted sign-up fallback.');
      } else {
        setError(formatSignUpError(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    setIsLoading(true);
    setError('');
    setIsCaptchaError(false);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      console.log('Verification result:', JSON.stringify(result, null, 2));

      if (result.status === 'complete') {
        setAuthLoading(true);
        await setActive({ session: result.createdSessionId });
        navigate('/dashboard');
      } else if (result.status === 'missing_requirements') {
        // Email verified but other requirements pending
        const missingFields = result.unverifiedFields || [];
        const requiredFields = (result as any).requiredFields || [];
        const optionalFields = (result as any).optionalFields || [];
        
        console.log('Missing fields:', missingFields);
        console.log('Required fields:', requiredFields);
        console.log('Optional fields:', optionalFields);
        
        // Check if phone verification is required
        if (missingFields.includes('phone_number')) {
          setError('Phone number verification is required. Please go to Clerk dashboard and disable phone requirement, or use the built-in sign-up flow at /sign-up');
        } else if (missingFields.length > 0) {
          setError(`Please complete additional verification: ${missingFields.join(', ')}`);
        } else {
          setError('Additional verification required. Please use /sign-up for the complete Clerk sign-up flow, or check your Clerk dashboard settings.');
        }
      } else {
        console.log('Verification status:', result.status);
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(formatSignUpError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!isLoaded || !signUp) return;

    setIsLoading(true);
    setError('');

    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err: any) {
      setError(formatSignUpError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1EA] dark:bg-slate-900 flex animate-fade-in transition-colors duration-300">
       {/* Left: Image / Branding */}
       <div className="hidden lg:flex w-1/2 relative bg-slate-900 text-white flex-col justify-between p-12 overflow-hidden">
        {/* Background Image: Maize Field */}
        <img 
            src="https://images.unsplash.com/photo-1625246333195-f4d9ebe43a7d?q=80&w=2000&auto=format&fit=crop" 
            className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
            alt="Field"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 to-slate-800/80 pointer-events-none"></div>
        
        <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
                <div className="bg-white/10 p-2 rounded-lg backdrop-blur-md">
                    <Sprout size={24} className="text-[#4ade80]" />
                </div>
                <span className="text-xl font-bold tracking-tight">RwandaBeyond</span>
            </div>
            <h1 className="text-5xl font-bold leading-tight mb-4">
                Join the Revolution <br/> in AgTech.
            </h1>
            <p className="text-slate-300 text-lg max-w-md">
                Create an account to access real-time monitoring, AI pest detection, and smart irrigation controls.
            </p>
        </div>
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
            <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{pendingVerification ? 'Verify Your Email' : t.title}</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">{pendingVerification ? 'We sent a verification code to your email' : t.subtitle}</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {isCaptchaError && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-4 py-3 rounded-xl text-sm space-y-3">
                <p>CAPTCHA is blocked in this browser context.</p>
                <button
                  type="button"
                  onClick={() => navigate('/sign-up')}
                  className="font-semibold underline underline-offset-2"
                >
                  Continue with Clerk hosted sign-up
                </button>
              </div>
            )}

            {pendingVerification ? (
              <form onSubmit={handleVerification} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Verification Code</label>
                    <input 
                      type="text" 
                      placeholder="Enter code from email" 
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-center text-2xl tracking-widest" 
                      required
                    />
                </div>

                <button 
                    type="submit"
                    disabled={isLoading || !isLoaded}
                    className="w-full bg-[#2D5A27] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#1a3817] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 mt-2 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : <>Verify Email <ArrowRight size={18} /></>}
                </button>
                <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isLoading || !isLoaded}
                    className="w-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-3 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-70"
                >
                    Resend code
                </button>
              </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{t.firstName}</label>
                        <input type="text" placeholder="Jean" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium" required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{t.lastName}</label>
                        <input type="text" placeholder="Claude" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium" required />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
                        <input type="email" placeholder="jean@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium" required />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{t.role}</label>
                    <div className="grid grid-cols-2 gap-3">
                        <div 
                            onClick={() => setRole('farmer')} 
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 ${role === 'farmer' ? 'border-[#2D5A27] bg-emerald-50 dark:bg-emerald-900/30 text-[#2D5A27] dark:text-emerald-400' : 'border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-300'}`}
                        >
                            <span className="font-bold">{t.farmer}</span>
                        </div>
                         <div 
                            onClick={() => setRole('expert')} 
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 ${role === 'expert' ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-300'}`}
                        >
                            <span className="font-bold">{t.agronomist}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{t.password}</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
                        <input type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium" autoComplete="new-password" required />
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={isLoading || !isLoaded}
                    className="w-full bg-[#2D5A27] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#1a3817] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 mt-2 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : <>{t.create} <ArrowRight size={18} /></>}
                </button>

                <p className="text-center text-slate-500 dark:text-slate-400 text-sm">
                    {t.haveAccount} {' '}
                    <button type="button" onClick={() => onNavigate('login')} className="font-bold text-[#2D5A27] dark:text-emerald-400 hover:underline">
                        {t.signIn}
                    </button>
                </p>
            </form>
            )}
        </div>
      </div>
    </div>
  );
};
