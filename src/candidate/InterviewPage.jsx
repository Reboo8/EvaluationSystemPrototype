/* ══════════════════════════════════════════════════════════════════════════════════════════
   AI interview, v2 design: the stage (ink card with the interviewer's orb, your camera, the
   current question), your answer panel, and the question list. Questions are spoken with
   speechSynthesis and answers captured with SpeechRecognition (typed fallback); the next
   question adapts via Groq when a key is set; a separate judge scores the transcript.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Play, Check, Keyboard, Volume2 } from 'lucide-react';
import { CandidateShell, TimerRing, Orb, Waveform } from './shell.jsx';
import { useMedia, useMicLevel, StableVideo, useFullscreen, FullscreenWarningModal } from './media.jsx';
import { nextInterviewQuestion, judgeInterview } from '../ai.js';

const LANG_CODE = { English: 'en-IN', Hindi: 'hi-IN', Tamil: 'ta-IN', Telugu: 'te-IN', Kannada: 'kn-IN', Marathi: 'mr-IN', Bengali: 'bn-IN', Gujarati: 'gu-IN', Malayalam: 'ml-IN', Punjabi: 'pa-IN' };
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const COUNTDOWN = 10;

export function InterviewPage({ m, opp, employer, inv, onFinish, onPersist, fsRequired = true, banner, weakAreas = [], stages }) {
  const media = useMedia();
  const langs = m.languages?.length ? m.languages : ['English'];
  const [lang, setLang] = useState(langs[0]);
  const total = Math.max(1, Number(m.nQ) || 8);
  const mustAsk = (m.questions || []).filter((q) => q.type === 'interview' && q.text).map((q) => q.text);
  const [phase, setPhase] = useState('ready');        // ready | countdown | loading | live | evaluating
  const [countdown, setCountdown] = useState(COUNTDOWN);
  const [evalCount, setEvalCount] = useState(12);
  const [questions, setQuestions] = useState([]);
  const [answerText, setAnswerText] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [secs, setSecs] = useState(0);
  const [endConfirm, setEndConfirm] = useState(false);
  const [sttOk, setSttOk] = useState(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const recog = useRef(null); const answerRef = useRef(''); const timer = useRef(null); const finished = useRef(false); const qRef = useRef([]);
  const budget = Math.round(total * 108); const remaining = Math.max(0, budget - secs);
  const level = useMicLevel(listening ? media.micStream() : null, listening);
  const fs = useFullscreen({ required: fsRequired && phase === 'live', onAutoSubmit: () => endInterview() });
  useEffect(() => { qRef.current = questions; onPersist?.({ questions, lang, secs }); }, [questions, lang, secs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase !== 'countdown') return; if (countdown <= 0) { setPhase('loading'); setTimeout(() => { setPhase('live'); ask(0); }, 900); return; } const t = setTimeout(() => setCountdown((c) => c - 1), 1000); return () => clearTimeout(t); }, [phase, countdown]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase !== 'live') return; timer.current = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(timer.current); }, [phase]);
  useEffect(() => { if (phase === 'live' && remaining <= 0) endInterview(); }, [remaining, phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo({ top: 0 }); if (!media.camStream()) media.requestCamera(); if (!media.micStream()) media.requestMic(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const voicesReady = () => new Promise((res) => { if (!('speechSynthesis' in window)) { res([]); return; } const v = window.speechSynthesis.getVoices(); if (v.length) { res(v); return; } let done = false; const fin = () => { if (!done) { done = true; res(window.speechSynthesis.getVoices()); } }; window.speechSynthesis.onvoiceschanged = fin; setTimeout(fin, 400); });
  const speak = (text) => new Promise(async (resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    const voices = await voicesReady(); if (!voices.length) { resolve(); return; }
    try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = LANG_CODE[lang] || 'en-IN'; u.rate = 0.98; const v = voices.find((x) => x.lang === u.lang) || voices.find((x) => x.lang.startsWith(u.lang.slice(0, 2))); if (v) u.voice = v; let done = false; const fin = () => { if (!done) { done = true; setSpeaking(false); resolve(); } }; u.onend = fin; u.onerror = fin; setSpeaking(true); window.speechSynthesis.speak(u); setTimeout(fin, Math.min(15000, 1500 + text.split(/\s+/).length * 450)); } catch { setSpeaking(false); resolve(); }
  });
  const stopListening = () => { try { recog.current?.stop(); } catch { /* */ } recog.current = null; setListening(false); };
  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR || muted) return;
    try { const r = new SR(); r.lang = LANG_CODE[lang] || 'en-IN'; r.continuous = true; r.interimResults = true; r.onresult = (ev) => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript + ' '; answerRef.current = t.trim(); setAnswerText(t.trim()); }; r.onerror = (e) => { if (['not-allowed', 'service-not-allowed', 'network', 'audio-capture'].includes(e.error)) { setSttOk(false); try { r.stop(); } catch { /* */ } recog.current = null; setListening(false); } }; r.onend = () => { if (recog.current === r) { try { r.start(); } catch { /* */ } } }; r.start(); recog.current = r; setListening(true); } catch { setSttOk(false); }
  };
  const ask = async (index) => {
    const history = qRef.current.filter((x) => x.status === 'done').map((x) => ({ q: x.text, a: x.answer }));
    const text = index < mustAsk.length ? mustAsk[index] : await nextInterviewQuestion({ role: opp.title, skills: (m.skills?.length ? m.skills : opp.skills) || [], lang, history, index, weakAreas });
    setQuestions((qs) => [...qs, { text, status: 'active', answer: '' }]); answerRef.current = ''; setAnswerText('');
    await speak(text); if (!finished.current) startListening();
  };
  const nextQuestion = async () => {
    if (phase !== 'live' || finished.current) return;
    stopListening(); const a = answerRef.current;
    const done = qRef.current.map((x, i) => (i === qRef.current.length - 1 ? { ...x, status: 'done', answer: a } : x)); setQuestions(done); qRef.current = done;
    if (done.length >= total) { endInterview(done); return; }
    await ask(done.length);
  };
  const endInterview = async (finalQs) => {
    if (finished.current) return; finished.current = true;
    stopListening(); try { window.speechSynthesis?.cancel(); } catch { /* */ } clearInterval(timer.current); setEndConfirm(false);
    const qs = (finalQs || qRef.current).map((x, i, arr) => (x.status === 'active' ? { ...x, status: 'done', answer: i === arr.length - 1 ? answerRef.current : x.answer } : x));
    setQuestions(qs); setPhase('evaluating');
    const tick = setInterval(() => setEvalCount((c) => Math.max(0, c - 1)), 1000);
    const transcript = qs.map((x) => ({ q: x.text, a: x.answer }));
    const judged = await judgeInterview({ role: opp.title, rubric: m.rubric?.length ? m.rubric : ['Domain', 'Communication', 'Composure'], transcript, lang });
    setTimeout(() => { clearInterval(tick); onFinish({ ...judged, transcript, asked: qs.length, total, minutes: Math.max(1, Math.round(secs / 60)), lang, seconds: secs }); }, Math.max(1500, evalCount * 300));
  };
  const toggleMute = () => setMuted((mu) => { const next = !mu; if (next) stopListening(); else if (phase === 'live' && !speaking) startListening(); return next; });
  const doneCount = questions.filter((x) => x.status === 'done').length;
  const isLive = phase === 'live'; const current = questions[questions.length - 1];
  const first = (inv.name || '').split(' ')[0] || 'there';

  const right = (<>
    {isLive && <TimerRing seconds={remaining} total={budget} label="interview" />}
    {isLive && <button className="cj-btn cj-btn--ghost cj-btn--sm" onClick={() => setEndConfirm(true)}><PhoneOff size={14} /> End interview</button>}
  </>);

  const speakerYou = isLive && !speaking && level > 0.05;
  const tile = (active) => ({ position: 'relative', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', background: '#0F1B2D', border: `2px solid ${active ? '#3B82F6' : 'rgba(255,255,255,.08)'}`, boxShadow: active ? '0 0 0 4px rgba(59,130,246,.25)' : 'none', transition: 'border-color .25s, box-shadow .25s' });
  return (
    <CandidateShell employer={employer} opp={opp} stage="interview" stages={stages} progress={doneCount / total} banner={banner} wide right={right}>
      {/* the call */}
      <div className="cj-pass cj-enter" style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, position: 'relative', zIndex: 1 }} className="cand-grid">
          {/* you */}
          <div style={tile(speakerYou)}>
            {media.camStream() ? <StableVideo stream={media.camStream()} className="w-full h-full object-cover" /> : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.5)', fontSize: 14 }}>Starting your camera…</div>}
            <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="cj-pill" style={{ background: 'rgba(0,0,0,.55)', color: '#fff' }}>{inv.name ? inv.name.split(' ')[0] : 'You'} · you</span>
              {isLive && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,.55)', borderRadius: 999, padding: '4px 10px' }}>{muted ? <MicOff size={13} color="#FCA5A5" /> : <Mic size={13} color="#fff" />}<Waveform level={muted ? 0 : level} bars={10} active={listening && !muted} maxHeight={14} light /></span>}
            </div>
            {isLive && <span className="cj-pill" style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(239,68,68,.22)', color: '#FCA5A5' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444' }} className="cand-pulse" /> REC <span className="cj-timer">{fmt(secs)}</span></span>}
          </div>
          {/* alex */}
          <div style={{ ...tile(speaking), background: 'radial-gradient(70% 90% at 50% 20%, #17345E, #0F1B2D 75%)' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Orb speaking={speaking} listening={listening && !speaking} size={124} /></div>
            <div style={{ position: 'absolute', left: 12, bottom: 12 }}><span className="cj-pill" style={{ background: 'rgba(0,0,0,.55)', color: '#fff' }}>Alex · AI interviewer</span></div>
            <div style={{ position: 'absolute', top: 12, right: 12 }}><span className="cj-pill" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>{phase === 'ready' ? 'Ready when you are' : speaking ? 'Speaking…' : isLive ? 'Listening' : 'Preparing…'}</span></div>
          </div>
        </div>
        {/* caption */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: 14, minHeight: 64, display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,0,0,.3)', borderRadius: 14, padding: '14px 18px' }}>
          {isLive && current ? (<><span className="cj-pill" style={{ background: '#056FD4', color: '#fff', flexShrink: 0 }}>Q{questions.length} of {total}</span><div key={current.text} className="cj-enter" style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.45, letterSpacing: '-.005em' }}>{current.text}</div></>)
            : <div style={{ fontSize: 15, color: 'rgba(255,255,255,.8)', lineHeight: 1.6 }}>Hi {first}. Alex will ask {total} questions about your experience with {(m.skills?.length ? m.skills : opp.skills?.length ? opp.skills : ['the role']).slice(0, 3).join(', ')}. Check your framing in the left tile, pick your language, then start when you're ready.</div>}
        </div>
        {/* dock */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          {phase === 'ready' && (<>
            {langs.length > 1 && <div style={{ display: 'flex', gap: 6, marginRight: 6 }}>{langs.map((l) => <button key={l} onClick={() => setLang(l)} className="cj-pill" style={{ background: lang === l ? '#fff' : 'rgba(255,255,255,.12)', color: lang === l ? '#14212A' : '#fff', cursor: 'pointer', border: 'none', height: 34, padding: '0 14px' }}>{l}</button>)}</div>}
            <button className="cj-btn cj-btn--primary cj-btn--lg" onClick={() => setPhase('countdown')}><Play size={18} /> Start interview</button>
          </>)}
          {isLive && (<>
            <button onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'} style={{ width: 50, height: 50, borderRadius: '50%', border: 'none', background: muted ? '#EF4444' : 'rgba(255,255,255,.92)', color: muted ? '#fff' : '#14212A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{muted ? <MicOff size={20} /> : <Mic size={20} />}</button>
            {!speaking && <button className="cj-btn cj-btn--primary cj-btn--lg" onClick={nextQuestion}>{questions.length >= total ? 'Finish interview' : 'Done answering'} <Check size={18} /></button>}
            <button onClick={() => setEndConfirm(true)} title="End interview" style={{ width: 50, height: 50, borderRadius: '50%', border: 'none', background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><PhoneOff size={20} /></button>
          </>)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(300px, 1fr)', gap: 18, alignItems: 'start', marginTop: 18 }} className="cand-grid">
        {/* your answer */}
        <div className="cj-card cj-enter-2" style={{ padding: '18px 20px', minHeight: 150 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div className="cj-eyebrow" style={{ color: '#6B7280' }}>{isLive ? 'Your answer' : 'Before you start'}</div>
            {isLive && !speaking && (sttOk ? <button className="cj-link" onClick={() => { stopListening(); setSttOk(false); }}><Keyboard size={12} style={{ verticalAlign: -2 }} /> Type instead</button> : !!(window.SpeechRecognition || window.webkitSpeechRecognition) && <button className="cj-link" onClick={() => { setSttOk(true); startListening(); }}><Mic size={12} style={{ verticalAlign: -2 }} /> Speak instead</button>)}
          </div>
          {isLive ? (speaking ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, color: '#4B5563', fontSize: 14.5 }}><Volume2 size={16} color="#056FD4" /> Alex is asking…</div>
            : sttOk ? <div style={{ marginTop: 12 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Waveform level={level} bars={20} active={listening} /><span style={{ fontSize: 12.5, color: listening ? '#047857' : '#9CA3AF' }}>{muted ? 'Muted' : listening ? 'Listening' : 'Paused'}</span></div><p style={{ marginTop: 10, fontSize: 15.5, lineHeight: 1.6, color: answerText ? '#14212A' : '#9CA3AF' }}>{answerText || 'Speak your answer. When you\'re done, click “Done answering”.'}<span style={{ display: 'inline-block', width: 2, height: 14, background: '#056FD4', marginLeft: 3, verticalAlign: 'middle' }} className="cand-blink" /></p></div>
            : <textarea className="cj-textarea" value={answerText} onChange={(e) => { setAnswerText(e.target.value); answerRef.current = e.target.value; }} rows={4} placeholder="Type your answer…" style={{ marginTop: 12, resize: 'none' }} />)
            : <ul style={{ marginTop: 10, display: 'grid', gap: 6 }}>{['Find a quiet spot and keep your face in the camera.', 'Take a moment before you answer — pauses are fine.', `The interview is in ${lang}. Mixing in English is completely fine.`].map((t) => <li key={t} style={{ display: 'flex', gap: 8, fontSize: 14, color: '#374151' }}><Check size={15} color="#056FD4" style={{ marginTop: 3, flexShrink: 0 }} />{t}</li>)}</ul>}
        </div>
        {/* question list */}
        <aside className="cj-card cj-enter-3" style={{ padding: '16px 18px', maxHeight: 420, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><div className="cj-eyebrow" style={{ color: '#6B7280' }}>Questions</div><span className="cj-timer" style={{ fontSize: 12, color: '#6B7280' }}>{doneCount}/{total}</span></div>
          <div style={{ height: 6, background: '#EEF2F7', borderRadius: 6, marginTop: 10, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.round((doneCount / total) * 100)}%`, background: '#056FD4', borderRadius: 6, transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} /></div>
          {questions.length === 0 ? <p style={{ fontSize: 13.5, color: '#9CA3AF', marginTop: 16 }}>{phase === 'ready' ? 'Questions appear here as Alex asks them.' : 'Connecting…'}</p> : (
            <ol style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              {questions.map((x, i) => (
                <li key={i} className="cj-enter" style={{ borderRadius: 12, border: `1px solid ${x.status === 'active' ? '#056FD4' : '#EEF2F7'}`, background: x.status === 'active' ? '#F5F9FF' : '#fff', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><span className="cj-timer" style={{ width: 24, height: 24, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: x.status === 'done' ? '#ECFDF5' : '#056FD4', color: x.status === 'done' ? '#047857' : '#fff', flexShrink: 0 }}>{x.status === 'done' ? <Check size={12} strokeWidth={3} /> : i + 1}</span><p style={{ fontSize: 13.5, color: x.status === 'active' ? '#14212A' : '#6B7280', lineHeight: 1.5, fontWeight: x.status === 'active' ? 600 : 400 }}>{x.text}</p></div>
                  {x.status === 'done' && <p style={{ marginTop: 6, marginLeft: 34, fontSize: 12.5, color: '#6B7280', lineHeight: 1.5 }}>{x.answer ? `${x.answer.slice(0, 140)}${x.answer.length > 140 ? '…' : ''}` : 'No answer captured'}</p>}
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      {endConfirm && (
        <div className="cand" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,33,42,.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="cj-card cand-slide-in" style={{ width: 420, maxWidth: '92vw', padding: '28px 28px 24px' }} role="dialog" aria-modal="true">
            <h3 style={{ fontSize: 20, fontWeight: 600, color: '#14212A' }}>End the interview?</h3>
            <p style={{ fontSize: 14.5, color: '#4B5563', lineHeight: 1.6, marginTop: 8 }}>Your answers so far are submitted for scoring. Unasked questions won't count against you.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}><button className="cj-btn cj-btn--ghost" style={{ flex: 1 }} onClick={() => setEndConfirm(false)}>Keep going</button><button className="cj-btn cj-btn--danger" style={{ flex: 1 }} onClick={() => endInterview()}>End interview</button></div>
          </div>
        </div>
      )}
      {(phase === 'countdown' || phase === 'loading' || phase === 'evaluating') && (
        <div className="cand" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(246,248,251,.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="cj-card cand-slide-in" style={{ width: 460, maxWidth: '92vw', padding: '40px 40px 34px', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 112, height: 112, margin: '0 auto 22px' }}>
              <svg width="112" height="112" style={{ transform: 'rotate(-90deg)' }}><circle cx="56" cy="56" r="48" fill="none" stroke="#EAF3FE" strokeWidth="8" /><circle cx="56" cy="56" r="48" fill="none" stroke="#056FD4" strokeWidth="8" strokeLinecap="round" strokeDasharray={2 * Math.PI * 48} strokeDashoffset={2 * Math.PI * 48 * (phase === 'countdown' ? countdown / COUNTDOWN : phase === 'evaluating' ? evalCount / 12 : 1)} style={{ transition: 'stroke-dashoffset 1s linear' }} /></svg>
              <div className="cj-timer" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 600, color: '#056FD4' }}>{phase === 'countdown' ? countdown : phase === 'evaluating' ? evalCount : '…'}</div>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#14212A' }}>{phase === 'countdown' ? 'Your interview starts in a moment' : phase === 'loading' ? 'Connecting you with Alex…' : 'Scoring your interview'}</h2>
            <p className="cj-lead" style={{ fontSize: 14.5, marginTop: 8 }}>{phase === 'evaluating' ? 'A separate judge reads the full transcript and scores each dimension. This takes a few seconds.' : 'Get comfortable. Alex speaks first; you answer when the waveform appears.'}</p>
            {phase === 'evaluating' && <ul style={{ textAlign: 'left', marginTop: 18, display: 'grid', gap: 8 }}>{[['Reading your answers', evalCount < 10], ['Weighing domain depth', evalCount < 7], ['Scoring communication', evalCount < 4], ['Writing your summary', evalCount < 2]].map(([l, d]) => <li key={l} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: d ? '#14212A' : '#9CA3AF', fontWeight: d ? 600 : 400 }}><span style={{ width: 20, height: 20, borderRadius: '50%', background: d ? '#056FD4' : '#E6EAF0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'background .4s' }}>{d && <Check size={12} strokeWidth={3} />}</span>{l}</li>)}</ul>}
          </div>
        </div>
      )}
      <FullscreenWarningModal fs={fs} mode="interview" />
    </CandidateShell>
  );
}
