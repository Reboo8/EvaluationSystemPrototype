/* ══════════════════════════════════════════════════════════════════════════════════════════
   Results, v2 design: a warm close, then what you did module by module (counted-up scores,
   dimension bars, expandable question breakdown). The hiring decision stays with the employer.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import { ChevronDown, ChevronUp, Keyboard, Languages, Mic, ShieldCheck, CheckCircle2, Mail, Clock, Layers } from 'lucide-react';
import { fmtDate } from '../store.jsx';
import { CandidateShell, CountUp } from './shell.jsx';

const color = (s) => (s == null ? '#9CA3AF' : s >= 75 ? '#059669' : s >= 55 ? '#D97706' : '#DC2626');
const labelOf = (s) => (s == null ? 'Pending' : s >= 85 ? 'Excellent' : s >= 70 ? 'Strong' : s >= 55 ? 'Developing' : 'Needs work');
const Bar = ({ value = 0, height = 6 }) => <div style={{ width: '100%', background: '#EEF2F7', borderRadius: 6, overflow: 'hidden', height }}><div className="cj-grow" style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color(value), borderRadius: 6 }} /></div>;
const fmtAnswer = (q) => { const a = q.answer; if (!a) return null; if (a.text) return a.text; if (a.choice != null) return `Option ${String.fromCharCode(65 + a.choice)}`; if (a.code) return a.code; if (a.typed) return a.typed; if (a.transcript) return a.transcript; if (a.history) return a.history.filter((h) => h.agent).map((h) => `You: ${h.agent}`).join('\n'); if (a.value) return ['', 'Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'][a.value]; if (a.name) return a.name; return null; };

function Breakdown({ questions }) {
  const [open, setOpen] = useState(null);
  if (!questions?.length) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <div className="cj-eyebrow" style={{ color: '#6B7280', marginBottom: 8 }}>Question by question</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {questions.map((q, i) => { const s = q.result?.skipped ? null : q.result?.score; const ans = fmtAnswer(q); const spoken = q.type === 'spoken'; const likert = q.type === 'likert'; return (
          <div key={q.id} style={{ border: '1px solid #EEF2F7', borderRadius: 12, overflow: 'hidden' }}>
            <button onClick={() => setOpen(open === i ? null : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textAlign: 'left', background: open === i ? '#F8FAFC' : '#fff' }}>
              <span className="cj-timer" style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', width: 26 }}>Q{i + 1}</span>
              <span style={{ fontSize: 13.5, color: '#374151', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.text}</span>
              {!spoken && !likert && <span style={{ width: 90 }}><Bar value={s ?? 0} height={4} /></span>}
              <span className="cj-timer" style={{ fontSize: 12.5, fontWeight: 600, width: 64, textAlign: 'right', color: spoken || likert ? '#9CA3AF' : color(s) }}>{likert ? '—' : spoken ? (ans ? '—' : 'no answer') : s == null ? 'skipped' : `${s}/100`}</span>
              {open === i ? <ChevronUp size={15} color="#9CA3AF" /> : <ChevronDown size={15} color="#9CA3AF" />}
            </button>
            {open === i && (
              <div style={{ padding: '4px 14px 14px', display: 'grid', gap: 10 }}>
                <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px' }}><div className="cj-eyebrow" style={{ color: '#9CA3AF', fontSize: 10 }}>Question</div><p style={{ fontSize: 13.5, color: '#374151', marginTop: 4, whiteSpace: 'pre-wrap' }}>{q.text}</p></div>
                {ans && <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px' }}><div className="cj-eyebrow" style={{ color: '#9CA3AF', fontSize: 10 }}>Your answer</div><p style={{ fontSize: 13.5, color: '#374151', marginTop: 4, whiteSpace: 'pre-wrap' }}>{ans}</p></div>}
                {q.result && (q.result.strengths?.length > 0 || q.result.improvements?.length > 0 || q.result.wpm != null || q.result.passed != null) && (
                  <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px' }}><div className="cj-eyebrow" style={{ color: '#9CA3AF', fontSize: 10 }}>Feedback</div>
                    {q.result.wpm != null && <p style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{q.result.wpm} words a minute · {q.result.acc}% accuracy</p>}
                    {q.result.passed != null && <p style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{q.result.passed} of {q.result.total} hidden tests passed</p>}
                    {q.result.strengths?.map((t, k) => <p key={k} style={{ fontSize: 13, color: '#047857', marginTop: 4 }}>✓ {t}</p>)}
                    {q.result.improvements?.map((t, k) => <p key={k} style={{ fontSize: 13, color: '#B45309', marginTop: 4 }}>△ {t}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
        ); })}
      </div>
    </div>
  );
}

function ModuleCard({ r, delay = 0 }) {
  const dims = Object.entries(r.dimensions || {}); const personality = r.key === 'personality';
  return (
    <section className="cj-card cj-enter" style={{ padding: '22px 24px', animationDelay: `${delay}ms` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div><div className="cj-eyebrow" style={{ color: '#6B7280' }}>{r.label}</div><div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}><span className="cj-timer" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1, color: personality ? '#6B7280' : color(r.score) }}>{personality ? '—' : <CountUp to={r.score} />}</span>{!personality && <span style={{ fontSize: 14, color: '#9CA3AF' }}>/100</span>}</div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4, color: personality ? '#6B7280' : color(r.score) }}>{personality ? 'Profile recorded' : labelOf(r.score)}</div></div>
        <div style={{ textAlign: 'right' }}>{r.typing?.wpm != null && <span className="cj-pill cj-pill--sky cj-timer">{r.typing.wpm} wpm · {r.typing.acc}%</span>}<div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>{r.answered}/{r.total} answered</div></div>
      </div>
      {dims.length > 0 && <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>{dims.map(([k, v]) => <div key={k}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}><span style={{ color: '#374151' }}>{k}</span><span className="cj-timer" style={{ fontWeight: 600, color: color(v) }}>{v}</span></div><Bar value={v} /></div>)}</div>}
      <Breakdown questions={r.questions} />
    </section>
  );
}

export function ResultsPage({ inv, opp, employer, results = [], interview, integrity, identity, onDone, preview, stages }) {
  const typing = results.find((r) => r.typing)?.typing;
  const violations = integrity?.violations || [];
  const byType = violations.reduce((a, v) => { if (v.violationType) a[v.violationType] = (a[v.violationType] || 0) + 1; return a; }, {});
  const flags = Object.values(byType).reduce((a, b) => a + b, 0);
  const answered = results.reduce((a, r) => a + r.answered, 0) + (interview?.asked || 0);
  const minutes = Math.round(results.length * 0) + (interview?.minutes || 0);
  const first = (inv.name || '').split(' ')[0] || 'there';
  const who = employer?.name || 'The hiring team';
  return (
    <CandidateShell employer={employer} opp={opp} stage="results" stages={stages} progress={1} right={<button className="cj-btn cj-btn--ink cj-btn--sm" onClick={onDone}>{preview ? 'Exit preview' : 'Finish'}</button>}>
      <div className="cj-enter">
        <div className="cj-eyebrow">Assessment complete</div>
        <h1 className="cj-h1" style={{ marginTop: 10 }}>Nicely done, {first}.</h1>
        <p className="cj-lead" style={{ marginTop: 10, maxWidth: 640 }}>Your {opp.title} assessment for {who} is submitted. Here's what you completed and how each part scored. The team reviews every result and will email you at <b style={{ color: '#14212A', fontWeight: 600 }}>{inv.email}</b>.</p>
      </div>
      <div className="cj-enter-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 24 }}>
        {[[Layers, results.length + (interview ? 1 : 0), 'modules completed'], [CheckCircle2, answered, 'answers submitted'], ...(typing?.wpm != null ? [[Keyboard, `${typing.wpm}`, 'words a minute']] : []), ...(interview?.cefr ? [[Languages, `CEFR ${interview.cefr}`, 'spoken language']] : []), [ShieldCheck, flags === 0 ? 'Clean' : `${flags} flag${flags > 1 ? 's' : ''}`, 'session integrity']].map(([Icon, v, l]) => (
          <div key={l} className="cj-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 38, height: 38, borderRadius: 11, background: '#EAF3FE', color: '#056FD4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={17} /></div><div><div className="cj-timer" style={{ fontSize: 20, fontWeight: 600, color: '#14212A', lineHeight: 1 }}>{typeof v === 'number' ? <CountUp to={v} /> : v}</div><div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{l}</div></div></div>
        ))}
      </div>
      <div style={{ columns: '2 340px', columnGap: 16, marginTop: 20 }} className="cj-masonry">
        {results.map((r, i) => <ModuleCard key={r.key + r.mi} r={r} delay={80 * i} />)}
        {interview && (
          <section className="cj-card cj-enter" style={{ padding: '22px 24px', animationDelay: `${80 * results.length}ms` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div><div className="cj-eyebrow" style={{ color: '#6B7280' }}><Mic size={11} style={{ verticalAlign: -1 }} /> AI interview</div><div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}><span className="cj-timer" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1, color: color(interview.score) }}><CountUp to={interview.score} /></span><span style={{ fontSize: 14, color: '#9CA3AF' }}>/100</span></div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4, color: color(interview.score) }}>{labelOf(interview.score)}</div></div>
              <div style={{ textAlign: 'right' }}>{interview.cefr && <span className="cj-pill cj-pill--sky">CEFR {interview.cefr}</span>}<div className="cj-timer" style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>{interview.asked} questions · {interview.minutes} min · {interview.lang}</div></div>
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>{Object.entries(interview.dimensions || {}).map(([k, v]) => <div key={k}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}><span style={{ color: '#374151' }}>{k}</span><span className="cj-timer" style={{ fontWeight: 600, color: color(v) }}>{v}</span></div><Bar value={v} /></div>)}</div>
            {interview.summary && <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', marginTop: 16 }}><div className="cj-eyebrow" style={{ color: '#9CA3AF', fontSize: 10 }}>Interviewer's note</div><p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginTop: 4, fontStyle: 'italic' }}>“{interview.summary}”</p></div>}
            <Breakdown questions={(interview.transcript || []).map((t, i) => ({ id: 'iv' + i, type: 'spoken', text: t.q, answer: { text: t.a || '' }, result: null }))} />
          </section>
        )}
        <section className="cj-card cj-enter" style={{ padding: '22px 24px', animationDelay: `${80 * (results.length + 1)}ms` }}>
          <div className="cj-eyebrow" style={{ color: '#6B7280' }}>Session integrity</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 12 }}><div style={{ width: 44, height: 44, borderRadius: 12, background: flags ? '#FFFBEB' : '#ECFDF5', color: flags ? '#B45309' : '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ShieldCheck size={20} /></div><div><div style={{ fontSize: 16, fontWeight: 600, color: '#14212A' }}>{flags === 0 ? 'No integrity flags' : `${flags} flag${flags > 1 ? 's' : ''} recorded`}</div><p style={{ fontSize: 13.5, color: '#4B5563', lineHeight: 1.6, marginTop: 4 }}>{flags === 0 ? 'Your session ran cleanly from start to finish.' : 'Flags are reviewed by a person and never decide the outcome on their own.'}</p>{flags > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>{Object.entries(byType).map(([k, n]) => <span key={k} className="cj-pill cj-pill--warn">{k.replace(/_/g, ' ').toLowerCase()} × {n}</span>)}</div>}</div></div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #F3F4F6', fontSize: 13, color: '#4B5563' }}>{identity?.face?.photo && <img src={identity.face.photo} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />}<div><b style={{ color: '#14212A' }}>Identity verified</b> · photo and voice sample on file<br /><span style={{ color: '#9CA3AF' }}>Completed {fmtDate(Date.now())}</span></div></div>
        </section>
        <section className="cj-pass cj-enter" style={{ padding: '24px 26px', animationDelay: `${80 * (results.length + 2)}ms` }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)' }}>What happens next</div>
            <ol style={{ marginTop: 14, display: 'grid', gap: 12 }}>
              {[[Mail, `${who} reviews your full result, including anything a person needs to look at.`], [Clock, 'Most teams reply within a week. Watch your inbox — and your spam folder.'], [CheckCircle2, 'You can close this window. Your session is saved and can\'t be changed.']].map(([Icon, t], i) => <li key={i} style={{ display: 'flex', gap: 12, fontSize: 14.5, lineHeight: 1.55, color: 'rgba(255,255,255,.9)' }}><Icon size={18} style={{ flexShrink: 0, marginTop: 2, color: '#7CB8F5' }} />{t}</li>)}
            </ol>
            <button className="cj-btn cj-btn--lg" style={{ marginTop: 22, background: '#fff', color: '#14212A' }} onClick={onDone}>{preview ? 'Exit preview' : 'Finish'}</button>
          </div>
        </section>
      </div>
      <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 28, textAlign: 'center' }}>Assessment for {inv.name || inv.email} · {opp.title} · powered by Cuba</p>
      <span style={{ display: 'none' }}>{minutes}</span>
    </CandidateShell>
  );
}
