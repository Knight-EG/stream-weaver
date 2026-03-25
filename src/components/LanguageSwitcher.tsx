import { useLanguage } from '@/i18n/LanguageContext';
import { localeNames, type Locale } from '@/i18n/translations';
import { Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const locales: Locale[] = ['en', 'ar', 'tr'];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 text-muted-foreground hover:text-foreground tv-focusable rounded flex items-center gap-1"
        data-focusable="true"
        title="Language"
      >
        <Globe className="w-4 h-4" />
        <span className="text-xs uppercase">{locale}</span>
      </button>
      {open && (
        <div className="absolute top-full mt-1 end-0 bg-popover border border-border rounded-lg shadow-lg z-50 min-w-[120px] overflow-hidden">
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => { setLocale(l); setOpen(false); }}
              className={`w-full px-3 py-2 text-sm text-start hover:bg-secondary transition-colors ${
                locale === l ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
              }`}
            >
              {localeNames[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
