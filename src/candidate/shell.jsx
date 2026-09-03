/* ══════════════════════════════════════════════════════════════════════════════════════════
   Candidate journey shell (v2 design). One frame for every candidate page:
   ink rail with the five journey stages and a living progress thread · quiet top bar
   (employer · role · session controls) · content on a cloud ground with a soft blue glow.
   Also the small motion/visual primitives the pages share: TimerRing, CountUp, Waveform,
   Orb, CheckMark, Notice.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { initials } from '../store.jsx';

export const JOURNEY = [
  { key: 'ready', label: 'Get ready' },
  { key: 'verify', label: "Verify it's you" },
  { key: 'assessment', label: 'Assessment' },
  { key: 'interview', label: 'Interview' },
  { key: 'results', label: 'Results' },
];

export function CandidateShell({ employer, opp, stage, stages = JOURNEY, progress = 0, right, banner, wide = false, children }) {
  const name = employer?.name || 'Cuba';
  const idx = Math.max(0, stages.findIndex((s) => s.key === stage));
  const pct = stages.length > 1 ? Math.min(1, (idx + Math.min(1, Math.max(0, progress))) / (stages.length - 1)) : 1;
  return (
    <div className="cand cj">
      <aside className="cj-rail" aria-label="Your progress">
        <div className="cj-rail__brand" title={name}>{initials(name)}</div>
        <div className="cj-steps">
          <div className="cj-steps__thread"><div className="cj-steps__fill" style={{ height: `${pct * 100}%` }} /></div>
          {stages.map((s, i) => (
            <div key={s.key} className={`cj-step ${i < idx ? 'cj-step--done' : i === idx ? 'cj-step--current' : ''}`}>
              <div className="cj-step__dot">{i < idx ? <Check size={13} strokeWidth={3} /> : i + 1}</div>
              <div className="cj-step__label">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="cj-rail__foot">Powered by<b>Cuba</b></div>
      </aside>
      <div className="cj-main">
        {banner}
        <header className="cj-top">
          <div className="cj-top__who">
            <div className="cj-mono">{initials(name)}</div>
            <div style={{ minWidth: 0 }}><div className="cj-top__title">{name}</div>{opp && <div className="cj-top__sub">{opp.title}{stages[idx] ? ` · ${stages[idx].label}` : ''}</div>}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>{right}</div>
        </header>
        <main className={`cj-content ${wide ? 'cj-content--wide' : 'cj-content--narrow'}`}>{children}</main>
      </div>
    </div>
  );
}

/* ring + mono digits; turns amber under 25% and red under 10% */
export function TimerRing({ seconds, total, size = 44, stroke = 4, label }) {
  const r = size / 2 - stroke; const c = 2 * Math.PI * r; const frac = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const color = frac <= 0.1 ? '#DC2626' : frac <= 0.25 ? '#D97706' : '#056FD4';
  const mm = Math.floor(seconds / 60), ss = seconds % 60;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }} title="Time remaining">
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E6EAF0" strokeWidth={stroke} /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s' }} /></svg>
      </div>
      <div style={{ lineHeight: 1.1 }}>
        <div className="cj-timer" style={{ fontSize: 18, fontWeight: 600, color: frac <= 0.1 ? '#DC2626' : '#14212A' }}>{mm > 0 ? `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${ss}s`}</div>
        {label && <div style={{ fontSize: 11, color: '#6B7280' }}>{label}</div>}
      </div>
    </div>
  );
}

/* animated number */
export function CountUp({ to = 0, duration = 900, suffix = '', decimals = 0 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const target = Number(to) || 0; const t0 = performance.now(); let raf;
    const tick = (t) => { const p = Math.min(1, (t - t0) / duration); const e = 1 - Math.pow(1 - p, 3); setV(target * e); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{decimals ? v.toFixed(decimals) : Math.round(v)}{suffix}</>;
}

/* mic level → bars */
export function Waveform({ level = 0, bars = 16, active = true, maxHeight = 60, light = false }) {
  const seed = useRef(Array.from({ length: bars }, (_, i) => 0.5 + 0.5 * Math.abs(Math.sin(i * 1.7))));
  return (
    <div className="cj-wave" aria-hidden style={{ height: Math.max(28, maxHeight + 8) }}>
      {seed.current.map((k, i) => <i key={i} style={{ height: active ? Math.max(4, Math.round(6 + level * maxHeight * k)) : Math.max(4, Math.round(4 + 6 * k)), opacity: active ? 1 : 0.35, background: light ? '#93C5FD' : undefined }} />)}
    </div>
  );
}

/* the AI interviewer's presence */
export function Orb({ speaking, listening, size = 132 }) {
  return (
    <div className={`cj-orb ${speaking ? 'cj-orb--speaking' : listening ? 'cj-orb--listening' : ''}`} style={{ width: size, height: size }}>
      <div className="cj-orb__core"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v18M7 8v8M17 8v8M4 11v2M20 11v2" strokeLinecap="round" /></svg></div>
    </div>
  );
}

export function CheckMark({ size = 26 }) {
  return <span className="cj-check" style={{ width: size, height: size }}><svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg></span>;
}

const TONES = { ok: ['#ECFDF5', '#059669'], warn: ['#FFFBEB', '#B45309'], muted: ['#F3F4F6', '#6B7280'], info: ['#EAF3FE', '#056FD4'] };
export function Notice({ icon: Icon, tone = 'muted', title, body, foot, children }) {
  const [bg, fg] = TONES[tone] || TONES.muted;
  return (
    <div className="cj-card cj-enter" style={{ padding: '40px 40px 36px', textAlign: 'center', maxWidth: 560, margin: '40px auto 0' }}>
      {Icon && <div style={{ width: 60, height: 60, borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}><Icon size={28} /></div>}
      <h1 className="cj-h1" style={{ fontSize: 26, marginBottom: 10 }}>{title}</h1>
      {body && <p className="cj-lead" style={{ fontSize: 15.5, maxWidth: 440, margin: '0 auto' }}>{body}</p>}
      {children}
      {foot && <div style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 18 }}>{foot}</div>}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</span>{children}{hint && <span style={{ display: 'block', fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>{hint}</span>}</label>;
}
