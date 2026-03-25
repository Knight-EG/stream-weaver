import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, Loader2, Mail, Lock, User } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

interface AuthFormProps {
  mode: 'login' | 'signup';
  onSubmit: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  onForgotPassword?: () => void;
}

export function AuthForm({ mode, onSubmit, onForgotPassword }: AuthFormProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    const result = await onSubmit(email, password, mode === 'signup' ? name : undefined);
    setLoading(false);
    if (result.error) setError(result.error);
    else if (mode === 'signup') setSuccess(t('authCheckEmail'));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-end"><LanguageSwitcher /></div>
        <div className="text-center space-y-3">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto">
            <Radio className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-gradient">{t('appName')}</h1>
          <p className="text-muted-foreground">
            {mode === 'login' ? t('authLoginSubtitle') : t('authSignupSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('authDisplayName')}</label>
              <div className="relative">
                <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder={t('name')} value={name} onChange={e => setName(e.target.value)} className="w-full ps-10 pe-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable" data-focusable="true" />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('email')}</label>
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="w-full ps-10 pe-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable" data-focusable="true" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('password')}</label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="w-full ps-10 pe-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tv-focusable" data-focusable="true" />
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
          {success && <p className="text-success text-sm">{success}</p>}

          <button type="submit" disabled={loading} className="w-full py-3 rounded-lg gradient-primary text-primary-foreground font-semibold tv-focusable disabled:opacity-50 flex items-center justify-center gap-2" data-focusable="true">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {mode === 'login' ? t('signIn') : t('authCreateAccount')}
          </button>
        </form>

        <div className="text-center space-y-2">
          {mode === 'login' && onForgotPassword && (
            <button onClick={onForgotPassword} className="text-sm text-primary hover:underline" data-focusable="true">{t('authForgotPassword')}</button>
          )}
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? t('authNoAccount') : t('authHasAccount')}
            <Link to={mode === 'login' ? '/signup' : '/login'} className="text-primary hover:underline">
              {mode === 'login' ? t('signUp') : t('signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
