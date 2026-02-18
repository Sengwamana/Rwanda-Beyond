import React from 'react';
import { Language, translations } from '../utils/translations';

interface LegalProps {
    type: 'privacy' | 'terms';
    language?: Language;
}

export const Legal: React.FC<LegalProps> = ({ type, language = 'en' }) => {
    const t = translations[language].legal;
    const title = type === 'privacy' ? t.privacyTitle : t.termsTitle;

    return (
        <div className="bg-slate-50 min-h-screen pt-24 pb-20 animate-fade-in">
            <div className="max-w-4xl mx-auto px-6">
                <div className="bg-white rounded-[3rem] p-10 md:p-16 border border-slate-100 shadow-sm">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{title}</h1>
                    <p className="text-sm font-bold text-slate-400 mb-12 uppercase tracking-wider">{t.lastUpdated}</p>

                    <div className="prose prose-slate prose-lg max-w-none text-slate-600">
                        {type === 'privacy' ? (
                            <>
                                <h3>1. Information We Collect</h3>
                                <p>We collect information about your farm location, soil data, and crop types to provide accurate insights. This data is encrypted and stored securely.</p>
                                <h3>2. Data Usage</h3>
                                <p>Your data is used solely to improve crop yield predictions and pest detection algorithms. We do not sell your personal data to third parties.</p>
                                <h3>3. User Rights</h3>
                                <p>You have the right to request deletion of your data at any time by contacting our support team.</p>
                            </>
                        ) : (
                            <>
                                <h3>1. Acceptance of Terms</h3>
                                <p>By accessing and using RwandaBeyond, you accept and agree to be bound by the terms and provision of this agreement.</p>
                                <h3>2. Service Usage</h3>
                                <p>You agree to use our IoT and AI services only for lawful agricultural purposes. Any misuse of the API or hardware is strictly prohibited.</p>
                                <h3>3. Subscription Fees</h3>
                                <p>Fees for the Pro and Enterprise plans are billed monthly. Cancellation requires a 30-day notice period.</p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};