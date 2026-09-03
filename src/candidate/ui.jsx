/* ══════════════════════════════════════════════════════════════════════════════════════════
   Candidate-facing UI primitives — ported from EvaluationSystem/frontend design-system:
   Reboo8Logo · Button · LeftBrandingPanel (+ SlidingQuotes) · ProctoringLayout · Spinner
   ══════════════════════════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import logoLight from '../assets/logo.svg';
import logoDark from '../assets/logo-dark.svg';
import quoteIcon from '../assets/quote-icon.svg';

export function Reboo8Logo({ variant = 'light', size = 'default', className = '' }) {
  const h = { small: 'h-5', default: 'h-6', large: 'h-8' }[size] || 'h-6';
  return <img src={variant === 'light' ? logoLight : logoDark} alt="Reboo8" className={`${h} w-auto ${className}`} />;
}

export function Button({ variant = 'primary', size = 'medium', fullWidth = false, isLoading = false, disabled, className = '', children, ...rest }) {
  const cls = ['ds-button', `ds-button--${variant}`, size !== 'medium' && `ds-button--${size}`, fullWidth && 'ds-button--full-width', isLoading && 'ds-button--loading', className].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={disabled || isLoading} {...rest}>
      {children}
      {isLoading && <span className="ds-button__spinner"><Loader2 size={20} /></span>}
    </button>
  );
}

export const Spinner = ({ size = 48, className = '' }) => <div className={`rounded-full border-b-2 border-blue-500 cand-spin ${className}`} style={{ width: size, height: size, borderBottomWidth: 2, borderColor: 'transparent', borderBottomColor: '#056FD4' }} />;

const QUOTES = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Success is not final, failure is not fatal: It is the courage to continue that counts.', author: 'Winston Churchill' },
  { text: 'Opportunities don\'t happen. You create them.', author: 'Chris Grosser' },
  { text: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt' },
  { text: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela' },
  { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
  { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
  { text: 'Talent wins games, but teamwork and intelligence win championships.', author: 'Michael Jordan' },
];

export function SlidingQuotes() {
  const [i, setI] = useState(0);
  const [fade, setFade] = useState(false);
  const go = (n) => { setFade(true); setTimeout(() => { setI(n); setFade(false); }, 350); };
  useEffect(() => { const t = setInterval(() => go((i + 1) % QUOTES.length), 6000); return () => clearInterval(t); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = QUOTES[i];
  return (
    <div className="sliding-quotes">
      <div className={`sliding-quotes__container${fade ? ' sliding-quotes__container--fade' : ''}`}>
        <blockquote className="sliding-quotes__text">{q.text}</blockquote>
        <cite className="sliding-quotes__author">— {q.author}</cite>
      </div>
      <div className="sliding-quotes__dots">
        {QUOTES.map((_, n) => <button key={n} type="button" aria-label={`Go to quote ${n + 1}`} className={`sliding-quotes__dot${n === i ? ' sliding-quotes__dot--active' : ''}`} onClick={() => go(n)} />)}
      </div>
    </div>
  );
}

/* Blue branding panel (auth / pre-assessment pages). `employer` adds the hiring company next to the logo. */
export function LeftBrandingPanel({ title = 'Welcome!', subtitle = "Let's get started!", employer, showQuotes = true, children }) {
  return (
    <div className="left-branding-panel">
      <img src={quoteIcon} alt="" className="left-branding-panel__quote-mark" />
      <div className="left-branding-panel__circles"><div className="left-branding-panel__circle left-branding-panel__circle--top" /><div className="left-branding-panel__circle left-branding-panel__circle--bottom" /></div>
      <div className="left-branding-panel__logo">
        <Reboo8Logo variant="light" size="large" />
        {employer && <><span className="text-white/40 text-lg font-light">|</span><span className="text-white/90 text-base font-medium tracking-wide">{employer}</span></>}
      </div>
      {showQuotes && <SlidingQuotes />}
      <div className="left-branding-panel__content">
        {children || (<><h1 className="left-branding-panel__title">{title}</h1><p className="left-branding-panel__subtitle">{subtitle}</p></>)}
      </div>
    </div>
  );
}

/* Pre-assessment page frame: blue panel on the left, scrolling white content on the right. */
export function ProctoringLayout({ title, description, employer, banner, children, right }) {
  return (
    <div className="cand proctoring-layout">
      <LeftBrandingPanel title={title} subtitle={description} employer={employer} />
      <div className="proctoring-layout__content">
        {banner}
        {right && <div className="flex justify-end px-8 pt-6 -mb-6">{right}</div>}
        <div className="proctoring-layout__inner">{children}</div>
      </div>
    </div>
  );
}

/* Full-screen overlay used for countdown / processing / errors (interview page style) */
export function Overlay({ children, tone = 'light' }) {
  return (
    <div className="cand fixed inset-0 z-[100] flex items-center justify-center" style={{ background: tone === 'dark' ? 'rgba(0,0,0,0.75)' : '#f0f4ff' }}>{children}</div>
  );
}

/* Circular countdown ring (interview countdown / evaluation modal) */
export function Ring({ value, total, size = 120, stroke = 8, color = '#056fd4', label }) {
  const r = size / 2 - stroke; const c = 2 * Math.PI * r; const pct = total > 0 ? (total - value) / total : 0;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center"><span className="font-bold" style={{ fontSize: size * 0.33, color }}>{label ?? value}</span></div>
    </div>
  );
}
