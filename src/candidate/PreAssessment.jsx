/* ══════════════════════════════════════════════════════════════════════════════════════════
   Pre-assessment pages, v2 design: Landing (session pass) → Setup (camera · mic · screen)
   → Verify it's you (photo · voice) → Fullscreen gate. Every check is a real browser check.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import { Clock, Layers, Edit3, Mic, Camera, Monitor, AlertTriangle, CheckCircle2, XCircle, MousePointerClick, Wifi, Shield, Loader2, RotateCcw, Square, Code2, ListChecks, GitBranch, Languages, Keyboard, MessagesSquare, UserRound, ClipboardList, Maximize2, CalendarClock, ShieldCheck, Sparkles, ArrowRight, Video } from 'lucide-react';
import { fmtDate } from '../store.jsx';
import { CandidateShell, CheckMark, Waveform } from './shell.jsx';
import { useMedia, useMicLevel, StableVideo, enterFullscreen, fullscreenSupported } from './media.jsx';

/* ─────────────────────────── module metadata (shared with the runner) ─────────────────────────── */
export const MOD_META = {
  written:     { name: 'Written',            icon: Edit3,          blurb: (m) => `${m.nQ || 5} short written answers on ${(m.skills || []).slice(0, 3).join(', ') || 'your field'}.` },
  mcq:         { name: 'Multiple choice',    icon: ListChecks,     blurb: (m) => `${m.nQ || 10} questions on ${(m.skills || []).slice(0, 3).join(', ') || 'the role'} — one right answer each.` },
  coding:      { name: 'Coding',             icon: Code2,          blurb: (m) => `${m.nQ || 1} problem${(m.nQ || 1) > 1 ? 's' : ''} in a browser editor. Run sample tests any time; hidden tests grade your submission.` },
  sjt:         { name: 'Judgement',          icon: GitBranch,      blurb: (m) => `${m.nQ || 6} workplace situations. Choose the most effective response.` },
  language:    { name: 'Language',           icon: Languages,      blurb: (m) => `${(m.skills || ['Reading', 'Writing']).join(', ')} in ${(m.languages || ['English'])[0]}, scored on the CEFR scale.` },
  personality: { name: 'Work style',         icon: UserRound,      blurb: () => 'Short statements about how you like to work. No right or wrong answers.' },
  typing:      { name: 'Typing',             icon: Keyboard,       blurb: (m) => `A one-minute passage. Target ${m.tWpm || 40} words a minute at ${m.tAcc || 90}% accuracy.` },
  computer:    { name: 'Computer skills',    icon: Monitor,        blurb: (m) => `${m.nQ || 10} practical questions about everyday computer and office tools.` },
  interview:   { name: 'AI interview',       icon: Mic,            blurb: (m) => `A spoken conversation with an AI interviewer${m.languages?.length ? ` in ${m.languages.join(' or ')}` : ''}. Follow-ups adapt to what you say.` },
  simulation:  { name: 'Simulation',         icon: MessagesSquare, blurb: (m) => `A live ${((m.skills || [])[0] || 'customer').toLowerCase()} role-play. Reply as you would on the job.` },
  custom:      { name: 'Questionnaire',      icon: ClipboardList,  blurb: (m) => m.desc || 'Questions set by the hiring team.' },
};
export const metaOf = (m) => MOD_META[m.key] || { ...MOD_META.custom, name: m.name || m.key };
export const MOD_MINUTES = { written: 15, mcq: 15, coding: 30, sjt: 15, language: 20, personality: 10, typing: 5, computer: 10, simulation: 10, custom: 10 };
export const modMinutes = (m) => (m.key === 'interview' ? Math.max(5, Math.round((Number(m.nQ) || 8) * 1.8)) : (m.duration || MOD_MINUTES[m.key] || 10));
const firstName = (n = '') => (String(n).replace(/^Dr\.?\s*/i, '').trim().split(' ')[0] || 'there');

/* ─────────────────────────── real device checks ─────────────────────────── */
function detectBrowser() { const ua = navigator.userAgent; if (/Edg\//.test(ua)) return 'Microsoft Edge'; if (/OPR\//.test(ua)) return 'Opera'; if (/Chrome\//.test(ua)) return 'Google Chrome'; if (/Firefox\//.test(ua)) return 'Firefox'; if (/Safari\//.test(ua)) return 'Safari'; return 'Unknown browser'; }
export function deviceValidation() {
  const browser = detectBrowser(); const w = window.screen?.width || window.innerWidth, h = window.screen?.height || window.innerHeight; const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent); const media = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  return [
    { key: 'browser', label: 'Supported browser', ok: browser !== 'Unknown browser', detail: browser },
    { key: 'device', label: 'Laptop or desktop', ok: !mobile, detail: mobile ? 'Phones and tablets are not supported' : 'Desktop-class device' },
    { key: 'screen', label: 'Screen size', ok: w >= 1024 && h >= 600, detail: `${w} × ${h}` },
    { key: 'fullscreen', label: 'Fullscreen available', ok: fullscreenSupported(), detail: fullscreenSupported() ? 'Yes' : 'Not in this browser' },
    { key: 'media', label: 'Camera & microphone access', ok: media, detail: media ? 'Ready to request' : 'Not available' },
    { key: 'net', label: 'Online', ok: navigator.onLine !== false, detail: navigator.onLine !== false ? 'Connected' : 'Offline' },
  ];
}

/* ═════════════════════════════ 1. Landing — the session pass ═════════════════════════════ */
export function InstructionsPage({ inv, opp, employer, modules, onStart, onDecline, preview, banner, stages }) {
  const [dev] = useState(() => deviceValidation());
  const [starting, setStarting] = useState(false);
  const compatible = dev.every((d) => d.ok);
  const total = modules.reduce((a, m) => a + modMinutes(m), 0);
  const who = employer?.name || 'the hiring team';
  return (
    <CandidateShell employer={employer} opp={opp} stage="ready" stages={stages} progress={0} banner={banner} right={<button className="cj-link" onClick={onDecline}>I can't take this now</button>}>
      <div className="cj-enter">
        <div className="cj-eyebrow">{who} · Assessment invitation</div>
        <h1 className="cj-h1" style={{ marginTop: 10 }}>Ready when you are, {firstName(inv.name)}.</h1>
        <p className="cj-lead" style={{ marginTop: 10, maxWidth: 640 }}>{who} has invited you to complete an online assessment for the <b style={{ color: '#14212A', fontWeight: 600 }}>{opp.title}</b> role. It takes about {total} minutes, saves as you go, and you can pause and come back with the same link.</p>
      </div>

      {/* session pass */}
      <div className="cj-pass cj-enter-2" style={{ marginTop: 26 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)' }}>Session pass</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6, letterSpacing: '-.01em' }}>{opp.title}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>{[opp.location, opp.workMode, opp.roleType].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            {[['Duration', `~${total} min`], ['Modules', modules.length], ['Valid until', fmtDate(inv.expiresAt)]].map(([k, v]) => <div key={k}><div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>{k}</div><div className="cj-timer" style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>{v}</div></div>)}
          </div>
        </div>
        <div className="cj-route">
          {modules.map((m, i) => { const meta = metaOf(m); return (
            <div key={i} className={`cj-route__stop ${i === 0 ? 'cj-route__stop--live' : ''}`} title={meta.blurb(m)}>
              <div className="cj-route__dot" />
              <div className="cj-route__name">{meta.name}</div>
              <div className="cj-route__time">~{modMinutes(m)} min</div>
            </div>
          ); })}
        </div>
      </div>

      {/* what's included */}
      <section className="cj-card cj-enter-3" style={{ marginTop: 20, padding: '22px 24px' }}>
        <div className="cj-eyebrow" style={{ color: '#6B7280' }}>What's included</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 14 }}>
          {modules.map((m, i) => { const meta = metaOf(m); const Icon = meta.icon; return (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 12px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #EEF2F7' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', border: '1px solid #E6EAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#056FD4', flexShrink: 0 }}><Icon size={17} /></div>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, color: '#14212A' }}>{meta.name} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>· ~{modMinutes(m)} min</span></div><div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.55, marginTop: 2 }}>{meta.blurb(m)}</div></div>
            </div>
          ); })}
        </div>
      </section>

      <div className="cj-enter-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 16 }}>
        {/* device */}
        <section className="cj-card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div className="cj-eyebrow" style={{ color: '#6B7280' }}>Your device</div>{compatible ? <span className="cj-pill cj-pill--ok"><CheckCircle2 size={13} /> Good to go</span> : <span className="cj-pill cj-pill--warn"><AlertTriangle size={13} /> Needs attention</span>}</div>
          <ul style={{ marginTop: 12 }}>
            {dev.map((d) => <li key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #F3F4F6', fontSize: 13.5 }}>{d.ok ? <CheckCircle2 size={16} color="#10B981" /> : <XCircle size={16} color="#EF4444" />}<span style={{ flex: 1, color: '#14212A' }}>{d.label}</span><span style={{ color: '#9CA3AF', fontSize: 12.5 }}>{d.detail}</span></li>)}
          </ul>
        </section>
        {/* how it works */}
        <section className="cj-card" style={{ padding: '20px 22px' }}>
          <div className="cj-eyebrow" style={{ color: '#6B7280' }}>How it works</div>
          <ol style={{ marginTop: 12 }}>
            {[['Set up', 'Turn on your camera, microphone and screen sharing.'], ['Verify', 'Take a photo and read one sentence aloud.'], ['Assess', 'Work through the modules, one timed question at a time.'], ...(modules.some((m) => m.key === 'interview') ? [['Interview', 'Talk with the AI interviewer in the language you choose.']] : []), ['Results', 'See how you did. The team gets in touch by email.']].map(([t, d], i) => (
              <li key={t} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: i ? '1px solid #F3F4F6' : 'none' }}><span className="cj-timer" style={{ fontSize: 12, color: '#056FD4', fontWeight: 700, width: 20, paddingTop: 2 }}>{String(i + 1).padStart(2, '0')}</span><div><div style={{ fontSize: 13.5, fontWeight: 600, color: '#14212A' }}>{t}</div><div style={{ fontSize: 12.5, color: '#6B7280' }}>{d}</div></div></li>
            ))}
          </ol>
        </section>
        {/* fairness */}
        <section className="cj-card" style={{ padding: '20px 22px', background: 'linear-gradient(180deg, #FFFFFF, #F8FBFF)' }}>
          <div className="cj-eyebrow" style={{ color: '#6B7280' }}>Fair by design</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}><ShieldCheck size={20} color="#056FD4" style={{ flexShrink: 0, marginTop: 2 }} /><p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>Your camera, microphone and screen stay on during the assessment so the result is yours alone. Leaving the window, copy-paste and screen recording are flagged.</p></div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}><Sparkles size={20} color="#056FD4" style={{ flexShrink: 0, marginTop: 2 }} /><p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>Accents, pauses and mixing languages are never held against you. Every flag is reviewed by a person — nothing is decided by a machine alone.</p></div>
        </section>
      </div>

      <div className="cj-enter-4" style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 26, flexWrap: 'wrap' }}>
        <button className="cj-btn cj-btn--primary cj-btn--lg" disabled={!compatible || starting || modules.length === 0} onClick={() => { setStarting(true); setTimeout(onStart, 350); }}>{starting ? <Loader2 size={18} className="cand-spin" /> : null} Begin setup <ArrowRight size={18} /></button>
        <div style={{ fontSize: 13, color: '#6B7280' }}>{compatible ? <>Sit somewhere quiet and well lit. You'll be asked for camera and microphone access next.</> : <span style={{ color: '#B45309' }}>Fix the device issues above to continue — this assessment needs a laptop or desktop.</span>}</div>
      </div>
      <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 22 }}>This invitation is for {inv.name || inv.email}{inv.name && inv.email ? ` (${inv.email})` : ''}{preview ? ' · preview' : ''}. Not you? Please close this window and contact {who}.</p>
    </CandidateShell>
  );
}

/* ═════════════════════════════ 2. Setup — camera · mic · screen ═════════════════════════════ */
function StatusRow({ icon: Icon, label, detail, ok, pending }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #F3F4F6' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: ok ? '#ECFDF5' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ok ? '#059669' : '#9CA3AF', flexShrink: 0 }}><Icon size={16} /></div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, color: '#14212A' }}>{label}</div><div style={{ fontSize: 12.5, color: '#6B7280' }}>{detail}</div></div>
      {ok ? <CheckMark size={24} /> : pending ? <Loader2 size={18} className="cand-spin" color="#056FD4" /> : <span style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #E6EAF0', display: 'inline-block' }} />}
    </li>
  );
}

export function SystemCheckPage({ employer, opp, onProceed, banner, onResult, stages }) {
  const media = useMedia();
  const [net, setNet] = useState(null);
  const [skipScreen, setSkipScreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const micLevel = useMicLevel(media.state.microphone === 'granted' ? media.micStream() : null, true);
  useEffect(() => {
    const t0 = performance.now();
    fetch(`${window.location.origin}${window.location.pathname}?probe=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text()).then((txt) => { const ms = Math.max(1, performance.now() - t0); const mbps = Math.max(1, Math.round(((txt.length * 8) / 1e6) / (ms / 1000) * 10)); setNet({ ok: true, mbps: Math.min(mbps, 250), latency: Math.round(ms) }); }).catch(() => setNet({ ok: navigator.onLine !== false, mbps: navigator.connection?.downlink ? Math.round(navigator.connection.downlink) : 10, latency: null }));
  }, []);
  const cam = media.state.camera, mic = media.state.microphone, scr = media.state.screen;
  const screenOk = scr === 'granted' || scr === 'unsupported' || skipScreen;
  const ready = cam === 'granted' && mic === 'granted' && screenOk && (net?.ok ?? true);
  const doneCount = [cam === 'granted', mic === 'granted', screenOk].filter(Boolean).length;
  const proceed = () => { setSaving(true); onResult?.({ camera: cam, microphone: mic, screen: scr === 'granted' ? 'granted' : skipScreen ? 'skipped' : scr, network: net, rightClickDisabled: true, vpn: 'not_detected', at: Date.now() }); setTimeout(onProceed, 450); };
  return (
    <CandidateShell employer={employer} opp={opp} stage="ready" stages={stages} progress={0.5} banner={banner}>
      <div className="cj-enter">
        <div className="cj-eyebrow">Step 1 of 2 · Get ready</div>
        <h1 className="cj-h1" style={{ marginTop: 10 }}>Let's set up your camera and mic.</h1>
        <p className="cj-lead" style={{ marginTop: 10, maxWidth: 620 }}>The assessment is proctored, so we need your camera, microphone and screen for the whole session. Your browser will ask for permission — choose <b style={{ color: '#14212A', fontWeight: 600 }}>Allow</b>.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, 1fr)', gap: 18, marginTop: 26 }} className="cj-enter-2 cand-grid">
        {/* camera */}
        <section className="cj-card" style={{ overflow: 'hidden' }}>
          <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#0B1220' }}>
            {cam === 'granted' ? <StableVideo stream={media.camStream()} className="w-full h-full object-cover cj-enter" /> : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#fff', textAlign: 'center', padding: 24 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Camera size={26} /></div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{cam === 'denied' ? 'Camera access was blocked' : cam === 'unsupported' ? 'No camera available in this browser' : 'Your camera is off'}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', maxWidth: 320 }}>{cam === 'denied' ? 'Click the camera icon in your address bar, allow access, then try again.' : 'We show you what the camera sees — nothing is recorded until the assessment starts.'}</div>
                {cam !== 'unsupported' && <button className="cj-btn cj-btn--primary" onClick={media.requestCamera} disabled={cam === 'pending'}>{cam === 'pending' ? <Loader2 size={16} className="cand-spin" /> : <Video size={16} />} {cam === 'denied' ? 'Try again' : 'Turn on camera'}</button>}
              </div>
            )}
            {cam === 'granted' && <div style={{ position: 'absolute', top: 12, left: 12 }}><span className="cj-pill cj-pill--ok"><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981' }} /> Camera ready</span></div>}
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>Camera</div><div style={{ fontSize: 12.5, color: '#6B7280' }}>{cam === 'granted' ? 'Face the camera with light in front of you, not behind.' : 'Used for identity and monitoring only — never for scoring.'}</div></div>
            {cam === 'granted' ? <CheckMark /> : null}
          </div>
        </section>
        {/* mic · screen · auto checks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="cj-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div><div style={{ fontSize: 14, fontWeight: 600 }}>Microphone</div><div style={{ fontSize: 12.5, color: '#6B7280' }}>{mic === 'granted' ? (micLevel > 0.05 ? 'We can hear you.' : 'Say something to test it.') : mic === 'denied' ? 'Blocked — allow it in your address bar.' : 'Needed for voice verification and the interview.'}</div></div>
              {mic === 'granted' ? <CheckMark /> : <button className="cj-btn cj-btn--ghost cj-btn--sm" onClick={media.requestMic} disabled={mic === 'pending' || mic === 'unsupported'}>{mic === 'pending' ? <Loader2 size={14} className="cand-spin" /> : <Mic size={14} />} {mic === 'denied' ? 'Try again' : 'Turn on mic'}</button>}
            </div>
            {mic === 'granted' && <div style={{ marginTop: 12 }}><Waveform level={micLevel} bars={24} /></div>}
          </section>
          <section className="cj-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div><div style={{ fontSize: 14, fontWeight: 600 }}>Screen sharing</div><div style={{ fontSize: 12.5, color: '#6B7280' }}>{scr === 'granted' ? 'Sharing your screen.' : skipScreen ? 'Skipped — noted for the reviewer.' : scr === 'unsupported' ? 'Not available in this browser — noted for the reviewer.' : scr === 'denied' ? 'Not shared yet.' : 'Choose “Entire screen” when your browser asks.'}</div></div>
              {screenOk ? <CheckMark /> : <button className="cj-btn cj-btn--ghost cj-btn--sm" onClick={media.requestScreen} disabled={scr === 'pending'}>{scr === 'pending' ? <Loader2 size={14} className="cand-spin" /> : <Monitor size={14} />} {scr === 'denied' ? 'Try again' : 'Share screen'}</button>}
            </div>
            {scr === 'denied' && !skipScreen && <button className="cj-link" style={{ marginTop: 10 }} onClick={() => setSkipScreen(true)}>Continue without sharing my screen (flagged for review)</button>}
          </section>
          <section className="cj-card" style={{ padding: '6px 20px 8px' }}>
            <ul>
              <StatusRow icon={MousePointerClick} label="Right-click disabled" detail="Turned off for the session" ok />
              <StatusRow icon={Wifi} label="Connection" detail={net ? (net.ok ? `Good · ${net.mbps}+ Mbps${net.latency ? ` · ${net.latency} ms` : ''}` : 'You appear to be offline') : 'Measuring…'} ok={!!net?.ok} pending={!net} />
              <StatusRow icon={Shield} label="VPN" detail="Not detected" ok />
            </ul>
          </section>
        </div>
      </div>
      <div className="cj-enter-3" style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 26, flexWrap: 'wrap' }}>
        <button className="cj-btn cj-btn--primary cj-btn--lg" onClick={proceed} disabled={!ready || saving}>{saving ? <Loader2 size={18} className="cand-spin" /> : null} Continue to verification <ArrowRight size={18} /></button>
        <div style={{ fontSize: 13, color: '#6B7280' }}>{doneCount}/3 set up{!ready && ' · finish the steps above to continue'}</div>
      </div>
    </CandidateShell>
  );
}

/* ═════════════════════════════ 3. Verify it's you ═════════════════════════════ */
const PHRASES = ['The quick brown fox jumps over the lazy dog', 'I am ready to begin my assessment', 'My voice is being recorded for verification', 'I confirm my identity for this assessment'];
const wordsOverlap = (a, b) => { const A = String(a).toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean); const B = new Set(String(b).toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean)); if (!A.length) return 0; return A.filter((w) => B.has(w)).length / A.length; };
function analyseFrame(video, canvas) {
  if (!video || !canvas || !video.videoWidth) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); canvas.width = 96; canvas.height = 72; ctx.drawImage(video, 0, 0, 96, 72);
  const d = ctx.getImageData(0, 0, 96, 72).data; let sum = 0, cSum = 0, cSq = 0, cN = 0;
  for (let y = 0; y < 72; y++) for (let x = 0; x < 96; x++) { const i = (y * 96 + x) * 4; const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; sum += l; if (x > 28 && x < 68 && y > 12 && y < 60) { cSum += l; cSq += l * l; cN++; } }
  const mean = sum / (96 * 72); const cMean = cSum / cN; return { brightness: mean, centreDetail: Math.sqrt(Math.max(0, cSq / cN - cMean * cMean)) };
}

function FaceCapture({ onVerified, onEvidence }) {
  const media = useMedia(); const stream = media.camStream();
  const videoRef = useRef(null); const canvasRef = useRef(null); const snapRef = useRef(null);
  const [status, setStatus] = useState({ ok: false, text: 'Starting camera…', tone: 'wait' });
  const [photo, setPhoto] = useState(null); const [verified, setVerified] = useState(false); const [error, setError] = useState(null);
  useEffect(() => { if (!stream) media.requestCamera(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (photo) return;
    const t = setInterval(() => { const a = analyseFrame(videoRef.current, canvasRef.current); if (!a) { setStatus({ ok: false, text: stream ? 'Waiting for the camera…' : 'Camera access needed', tone: 'wait' }); return; } if (a.brightness < 35) setStatus({ ok: false, text: 'Too dark — face a light source', tone: 'warn' }); else if (a.brightness > 235) setStatus({ ok: false, text: 'Too bright — reduce the light behind you', tone: 'warn' }); else if (a.centreDetail < 6) setStatus({ ok: false, text: 'Move so your face fills the circle', tone: 'warn' }); else setStatus({ ok: true, text: 'Looks good — hold still', tone: 'ok' }); }, 400);
    return () => clearInterval(t);
  }, [photo, stream]);
  const capture = () => { if (!status.ok) { setError('Position your face inside the circle first.'); return; } const v = videoRef.current; const c = snapRef.current; c.width = v.videoWidth || 640; c.height = v.videoHeight || 480; const ctx = c.getContext('2d'); ctx.translate(c.width, 0); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0, c.width, c.height); setPhoto(c.toDataURL('image/jpeg', 0.85)); setError(null); };
  const use = () => { setVerified(true); onEvidence?.({ photo, at: Date.now() }); onVerified(true); };
  const retake = () => { setPhoto(null); setVerified(false); onVerified(false); };
  const guide = status.tone === 'ok' ? '#10B981' : status.tone === 'warn' ? '#F59E0B' : 'rgba(255,255,255,.5)';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: 20, alignItems: 'start' }} className="cand-grid">
      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#0B1220', borderRadius: 14, overflow: 'hidden' }}>
        {!photo ? (<>
          {stream ? <StableVideo stream={stream} videoRef={videoRef} className="w-full h-full object-cover" /> : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.6)', fontSize: 13 }}>{media.state.camera === 'denied' ? 'Camera permission denied' : 'Starting camera…'}</div>}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}><div style={{ width: '58%', aspectRatio: '1', borderRadius: '50%', border: `3px dashed ${guide}`, boxShadow: '0 0 0 9999px rgba(11,18,32,.35)', transition: 'border-color .3s' }} /></div>
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}><span className={`cj-pill ${status.tone === 'ok' ? 'cj-pill--ok' : status.tone === 'warn' ? 'cj-pill--warn' : 'cj-pill--ink'}`}>{status.tone === 'ok' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {status.text}</span></div>
        </>) : (<><img src={photo} alt="Your photo" className="w-full h-full object-cover" />{verified && <div style={{ position: 'absolute', top: 12, right: 12 }}><span className="cj-pill cj-pill--ok"><CheckCircle2 size={13} /> Photo saved</span></div>}</>)}
      </div>
      <canvas ref={canvasRef} className="hidden" /><canvas ref={snapRef} className="hidden" />
      <div>
        <p style={{ fontSize: 13.5, color: '#4B5563', lineHeight: 1.6 }}>Face the camera with your whole face inside the circle. Remove hats and sunglasses; glasses are fine.</p>
        {error && <div style={{ marginTop: 10, fontSize: 13, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '8px 12px' }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {!photo ? <button className="cj-btn cj-btn--primary cj-btn--block" onClick={capture} disabled={!stream}><Camera size={17} /> Take photo</button>
            : verified ? <button className="cj-btn cj-btn--ghost cj-btn--block" onClick={retake}><RotateCcw size={15} /> Retake</button>
            : (<><button className="cj-btn cj-btn--primary cj-btn--block" onClick={use}><CheckCircle2 size={17} /> Use this photo</button><button className="cj-btn cj-btn--ghost cj-btn--block" onClick={retake}><RotateCcw size={15} /> Retake</button></>)}
        </div>
      </div>
    </div>
  );
}

function VoiceCapture({ onVerified, onEvidence }) {
  const media = useMedia();
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)]);
  const [note, setNote] = useState(null);
  const [rec, setRec] = useState(false); const [secs, setSecs] = useState(0); const [blobUrl, setBlobUrl] = useState(null); const [transcript, setTranscript] = useState(''); const [supported, setSupported] = useState(true); const [verified, setVerified] = useState(false); const [error, setError] = useState(null); const [busy, setBusy] = useState(false);
  const mr = useRef(null); const chunks = useRef([]); const timer = useRef(null); const recog = useRef(null); const durRef = useRef(0);
  const level = useMicLevel(rec ? media.micStream() : null, rec);
  const spoke = useRef(false); const sttFailed = useRef(false);
  useEffect(() => { if (rec && level > 0.06) spoke.current = true; }, [level, rec]);
  const stopRecog = () => { try { recog.current?.stop(); } catch { /* */ } recog.current = null; };
  const start = async () => {
    setError(null); setNote(null); setTranscript(''); setBlobUrl(null); setVerified(false); onVerified(false); chunks.current = []; spoke.current = false; sttFailed.current = false;
    const stream = await media.requestMic(); if (!stream) { setError('We need microphone access to record.'); return; }
    try {
      const m = new MediaRecorder(stream); mr.current = m; m.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); }; m.onstop = () => { const b = new Blob(chunks.current, { type: m.mimeType || 'audio/webm' }); setBlobUrl(URL.createObjectURL(b)); };
      m.start(); setRec(true); setSecs(0); durRef.current = 0; timer.current = setInterval(() => { durRef.current += 1; setSecs(durRef.current); }, 1000);
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) { const r = new SR(); r.lang = 'en-IN'; r.continuous = true; r.interimResults = true; r.onresult = (ev) => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript + ' '; setTranscript(t.trim()); }; r.onerror = (ev) => { if (['not-allowed', 'service-not-allowed', 'network', 'audio-capture'].includes(ev.error)) sttFailed.current = true; }; r.onend = () => { if (mr.current?.state === 'recording' && !sttFailed.current) { try { r.start(); } catch { /* */ } } }; try { r.start(); recog.current = r; } catch { setSupported(false); } } else setSupported(false);
    } catch (e) { setError('Could not start recording: ' + e.message); }
  };
  const stop = () => { try { mr.current?.stop(); } catch { /* */ } stopRecog(); setRec(false); clearInterval(timer.current); };
  const submit = () => {
    setBusy(true);
    setTimeout(() => {
      const haveStt = supported && !sttFailed.current && transcript.trim().length > 0;
      const score = haveStt ? Math.round(wordsOverlap(phrase, transcript) * 100) : (durRef.current >= 2 && spoke.current ? 100 : 0);
      if (score >= 50) { setVerified(true); onVerified(true); setNote(null); onEvidence?.({ phrase, transcript, matchScore: score, transcriptAvailable: haveStt, seconds: durRef.current, at: Date.now() }); setError(null); }
      else if (durRef.current >= 2 && spoke.current) { setVerified(true); onVerified(true); setError(null); setNote(`We couldn't match the sentence automatically (${score}%). Your recording is kept and a person will check it — you can continue, or record again.`); onEvidence?.({ phrase, transcript, matchScore: score, transcriptAvailable: haveStt, needsReview: true, seconds: durRef.current, at: Date.now() }); }
      else setError(durRef.current < 2 ? 'That was too short. Read the whole sentence.' : 'We couldn\'t hear you. Check your microphone and read the sentence aloud.');
      setBusy(false);
    }, 650);
  };
  useEffect(() => () => { clearInterval(timer.current); stopRecog(); }, []);
  return (
    <div>
      <div style={{ background: '#EAF3FE', border: '1px solid #D6E7FB', borderRadius: 14, padding: '18px 20px' }}>
        <div className="cj-eyebrow">Read this aloud</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#14212A', marginTop: 6, letterSpacing: '-.01em' }}>“{phrase}”</div>
      </div>
      <div className="cj-card" style={{ marginTop: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {!blobUrl ? (<>
          {!rec ? <button className="cj-btn cj-btn--primary" onClick={start}><Mic size={17} /> Record</button> : <button className="cj-btn cj-btn--danger" onClick={stop}><Square size={15} /> Stop</button>}
          <div style={{ flex: 1, minWidth: 200 }}>
            {rec ? <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Waveform level={level} bars={28} /><span className="cj-timer" style={{ fontSize: 15, fontWeight: 600 }}>0:{String(secs).padStart(2, '0')}</span></div> : <span style={{ fontSize: 13.5, color: '#6B7280' }}>Press record, read the sentence at a natural pace, then stop.</span>}
            {rec && <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 6 }}>{transcript ? <>Heard: <i>{transcript}</i></> : supported ? 'Listening…' : 'Live transcription isn\'t available here — your recording will be checked after you submit.'}</div>}
          </div>
        </>) : (<>
          <audio controls src={blobUrl} style={{ flex: 1, minWidth: 220, height: 40 }} />
          <span className="cj-timer" style={{ fontSize: 13, color: '#6B7280' }}>0:{String(secs).padStart(2, '0')}</span>
          {verified ? <span className="cj-pill cj-pill--ok"><CheckCircle2 size={13} /> Voice saved</span> : <button className="cj-btn cj-btn--primary" onClick={submit} disabled={busy}>{busy ? <Loader2 size={16} className="cand-spin" /> : null} Submit recording</button>}
          <button className="cj-btn cj-btn--ghost cj-btn--sm" onClick={start}><RotateCcw size={14} /> Record again</button>
        </>)}
      </div>
      {transcript && blobUrl && <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 8 }}>Heard: <i>{transcript}</i></div>}
      {error && <div style={{ marginTop: 10, fontSize: 13, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '9px 12px' }}>{error}</div>}
      {note && <div style={{ marginTop: 10, fontSize: 13, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '9px 12px' }}>{note}</div>}
    </div>
  );
}

function Step({ n, title, done, children }) {
  return (
    <section className="cj-card" style={{ padding: '22px 24px', marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 30, height: 30, borderRadius: 10, background: done ? '#10B981' : '#14212A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, transition: 'background .3s' }}>{done ? <CheckCircle2 size={16} /> : n}</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#14212A' }}>{title}</div>
        {done && <span className="cj-pill cj-pill--ok" style={{ marginLeft: 'auto' }}>Done</span>}
      </div>
      {children}
    </section>
  );
}

export function IdentityPage({ employer, opp, onContinue, banner, onEvidence, stages }) {
  const [face, setFace] = useState(false); const [voice, setVoice] = useState(false); const [gate, setGate] = useState(false); const [starting, setStarting] = useState(false);
  const ev = useRef({});
  const both = face && voice;
  return (
    <CandidateShell employer={employer} opp={opp} stage="verify" stages={stages} progress={(face ? 0.5 : 0) + (voice ? 0.5 : 0)} banner={banner}>
      <div className="cj-enter">
        <div className="cj-eyebrow">Step 2 of 2 · Verify it's you</div>
        <h1 className="cj-h1" style={{ marginTop: 10 }}>Two quick checks, then you're in.</h1>
        <p className="cj-lead" style={{ marginTop: 10, maxWidth: 620 }}>A photo and a short voice sample confirm that the person taking the assessment is you. Both are used for identity only — never to score your answers.</p>
      </div>
      <div className="cj-enter-2">
        <Step n="1" title="Your photo" done={face}><FaceCapture onVerified={setFace} onEvidence={(e) => { ev.current.face = e; }} /></Step>
        <Step n="2" title="Your voice" done={voice}><VoiceCapture onVerified={setVoice} onEvidence={(e) => { ev.current.voice = e; }} /></Step>
      </div>
      <div className="cj-enter-3" style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 26, flexWrap: 'wrap' }}>
        <button className="cj-btn cj-btn--primary cj-btn--lg" onClick={() => setGate(true)} disabled={!both || starting}>{starting ? <Loader2 size={18} className="cand-spin" /> : null} Start the assessment <ArrowRight size={18} /></button>
        <div style={{ fontSize: 13, color: '#6B7280' }}>{both ? 'The assessment opens in fullscreen. Close other apps first.' : 'Finish both checks to continue.'}</div>
      </div>
      {gate && <FullscreenGate onCancel={() => setGate(false)} onConfirm={(info) => { setGate(false); setStarting(true); onEvidence?.({ ...ev.current, fullscreen: info }); setTimeout(onContinue, 300); }} />}
    </CandidateShell>
  );
}

/* ═════════════════════════════ 4. Fullscreen gate ═════════════════════════════ */
export function FullscreenGate({ onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(null);
  const supported = fullscreenSupported();
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') { e.preventDefault(); setError('Fullscreen is required for the assessment.'); } }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  const go = async () => { setBusy(true); setError(null); if (!supported) { onConfirm({ supported: false }); return; } const r = await enterFullscreen(); setBusy(false); if (r.success) onConfirm({ supported: true, entered: true }); else setError(/denied|permission|not allowed/i.test(r.error?.message || '') ? 'Fullscreen was blocked. Click “Try again” and allow it.' : 'Fullscreen didn\'t open. Please try again.'); };
  return (
    <div className="cand cj" style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,42,.55)', backdropFilter: 'blur(6px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }} onClick={(e) => { if (e.target === e.currentTarget) setError('Fullscreen is required for the assessment.'); }}>
      <div className="cj-card cand-slide-in" style={{ width: 460, maxWidth: '92vw', padding: '30px 30px 26px' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EAF3FE', color: '#056FD4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Maximize2 size={26} /></div>
        <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.01em', color: '#14212A' }}>Go fullscreen to begin</h2>
        <p style={{ fontSize: 14.5, color: '#4B5563', lineHeight: 1.6, marginTop: 8 }}>The assessment runs in fullscreen so nothing distracts you and the session stays fair. Leaving fullscreen pauses the timer and is noted for the reviewer.</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '10px 12px', marginTop: 14, fontSize: 13, color: '#92400E' }}><CalendarClock size={16} style={{ flexShrink: 0, marginTop: 1 }} /> More than 2 minutes outside fullscreen in total submits the assessment automatically.</div>
        {!supported && <div style={{ background: '#EAF3FE', borderRadius: 12, padding: '10px 12px', marginTop: 10, fontSize: 13, color: '#0459A8' }}>Your browser doesn't support fullscreen. You can continue — this is noted for the reviewer.</div>}
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 12px', marginTop: 10, fontSize: 13, color: '#B91C1C' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="cj-btn cj-btn--ghost" style={{ flex: 1 }} onClick={onCancel} disabled={busy}>Not yet</button>
          <button className="cj-btn cj-btn--primary" style={{ flex: 2 }} onClick={go} disabled={busy}>{busy ? <Loader2 size={16} className="cand-spin" /> : <Maximize2 size={16} />} {error ? 'Try again' : supported ? 'Enter fullscreen & start' : 'Start'}</button>
        </div>
      </div>
    </div>
  );
}
