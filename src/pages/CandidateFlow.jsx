import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Check, Mic, Bot, Wifi, Camera, ScanFace, Wand2, Keyboard, Code2, FileText, ListChecks,
  Languages, MessagesSquare, GitBranch, Play, Loader2, X, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import { useApp } from '../store.jsx';

const MODNAME = { resume: 'Resume / JD Screen', written: 'Written', mcq: 'MCQ / Objective', coding: 'Coding', sjt: 'Situational Judgement', language: 'Language / CEFR', personality: 'Personality', typing: 'Typing', computer: 'Computer Literacy', interview: 'AI Interview', simulation: 'Simulation', custom: 'Custom' };
const MODICON = { written: FileText, mcq: ListChecks, coding: Code2, sjt: GitBranch, language: Languages, typing: Keyboard, simulation: MessagesSquare, personality: FileText, computer: Keyboard };
const KEY_LABEL = { coding: 'Coding', mcq: 'MCQ', written: 'Written', sjt: 'SJT', language: 'Language', typing: 'Typing', simulation: 'Simulation', interview: 'AI Interview', personality: 'Personality', computer: 'Computer Literacy' };
const DEFAULT_RP = [{ label: 'Skills match', weight: 50 }, { label: 'Work experience', weight: 50 }];

const hashNum = (str) => { let h = 0; for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) >>> 0; return h; };
const pseudo = (seed, lo = 74, hi = 93) => lo + (hashNum(seed) % (hi - lo + 1));

export default function CandidateFlow() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getOpportunity } = useApp();
  const opp = getOpportunity(id);
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState({});
  const [outcome, setOutcome] = useState(null); // null | 'rejected'

  if (!opp) return <div style={{ padding: 40, textAlign: 'center' }}>Opportunity not found.</div>;

  const allModules = opp.assessment?.modules || [];
  const resumeModule = allModules.find((m) => m.key === 'resume');
  const testModules = allModules.filter((m) => m.key !== 'resume');
  const stages = [
    { kind: 'apply' }, { kind: 'checks' },
    ...(resumeModule ? [{ kind: 'resume', m: resumeModule }] : []),
    ...testModules.map((m) => ({ kind: m.key === 'interview' ? 'interview' : 'module', m })),
    { kind: 'result' },
  ];
  const cur = stages[Math.min(step, stages.length - 1)];
  const next = () => setStep((s) => Math.min(s + 1, stages.length - 1));
  const advance = (label, score) => { if (label != null && score != null) setScores((s) => ({ ...s, [label]: score })); next(); };

  const wide = cur.kind === 'interview' || (cur.kind === 'module' && cur.m.key === 'coding');

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB' }}>
      <div style={{ height: 60, background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#056FD4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>R8</div>
          <b>Reboo8</b> <span style={{ color: '#9CA3AF', fontSize: 13 }}>· {opp.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, color: '#9CA3AF' }}>{outcome ? 'Screening' : `Step ${step + 1} of ${stages.length}`}</span>
          <span style={{ fontSize: 13, color: '#9CA3AF', cursor: 'pointer' }} onClick={() => nav('/opportunities/' + id)}>Quit</span>
        </div>
      </div>

      <div style={{ maxWidth: wide ? 920 : 680, margin: '40px auto', padding: '0 20px' }}>
        {outcome === 'rejected' ? <Rejected onExit={() => nav('/opportunities/' + id)} />
          : cur.kind === 'apply' ? <Apply opp={opp} onNext={next} />
          : cur.kind === 'checks' ? <Checks onNext={next} />
          : cur.kind === 'resume' ? <ResumeGate opp={opp} m={cur.m} onPass={(w) => advance('Resume-fit', w)} onReject={() => setOutcome('rejected')} />
          : cur.kind === 'interview' ? <Interview m={cur.m} onNext={(sc) => advance('AI Interview', sc)} />
          : cur.kind === 'module' ? <ModuleStage key={step} m={cur.m} opp={opp} onNext={(sc) => advance(KEY_LABEL[cur.m.key] || MODNAME[cur.m.key] || cur.m.key, sc)} />
          : <Result opp={opp} scores={scores} onExit={() => nav('/opportunities/' + id)} />}
      </div>
    </div>
  );
}

const Card = ({ children, style }) => <div className="card" style={{ padding: '32px 36px', ...style }}>{children}</div>;
const Cta = ({ children, onClick, disabled }) => <button className="btn-primary" disabled={disabled} style={{ width: '100%', justifyContent: 'center', padding: '13px 0', borderRadius: 9999, fontSize: 15, marginTop: 22 }} onClick={onClick}>{children}</button>;
const Bar = ({ pct, color = '#056FD4' }) => <div className="progress-track"><div style={{ width: Math.min(100, pct) + '%', height: '100%', background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: 10 }} /></div>;

function Apply({ opp, onNext }) {
  const needs = [[Wifi, 'A stable internet connection'], [Mic, 'A working microphone'], [Camera, 'A webcam (laptop or phone)'], [Keyboard, 'A computer with a keyboard']];
  return (
    <Card>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#056FD4' }}>You're invited to apply</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 4px' }}>{opp.title}</h1>
      <div style={{ fontSize: 13.5, color: '#6B7280', marginBottom: 22 }}>Comprehensive AI assessment · about 45 minutes</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>What you'll need</div>
      {needs.map(([Icon, t]) => <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid #F3F4F6', fontSize: 14, color: '#374151' }}><Icon size={18} color="#056FD4" /> {t}</div>)}
      <Cta onClick={onNext}>Start assessment →</Cta>
      <div style={{ textAlign: 'center', fontSize: 11.5, color: '#9CA3AF', marginTop: 12 }}>Your link is valid for 7 days · you can save &amp; resume</div>
    </Card>
  );
}

function Checks({ onNext }) {
  const ok = (label) => <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #F3F4F6', fontSize: 14 }}>{label}<span style={{ color: '#16A34A', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={16} /> Ready</span></div>;
  return (
    <Card>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 14px' }}>System &amp; identity check</h2>
      {ok(<span><Mic size={15} style={{ verticalAlign: -3 }} /> Microphone</span>)}
      {ok(<span><Camera size={15} style={{ verticalAlign: -3 }} /> Camera</span>)}
      {ok(<span><Wifi size={15} style={{ verticalAlign: -3 }} /> Internet</span>)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '16px 0' }}>
        <div style={{ width: 110, height: 80, borderRadius: 10, background: '#0B1220', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ScanFace size={28} color="#3B82F6" /></div>
        <span style={{ color: '#16A34A', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={16} /> Identity verified (face + voice)</span>
      </div>
      <div style={{ background: '#F8FAFF', border: '1px solid #EEF2F7', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: '#475569' }}>
        <b style={{ color: '#14212A' }}>Honor code:</b> alone in a quiet room · no other apps/devices/AI tools · no copying. Reboo8 monitors camera, audio &amp; screen.
      </div>
      <Cta onClick={onNext}>I agree — continue →</Cta>
    </Card>
  );
}

/* ── resume gate: real weighted scoring vs the configured parameters + threshold ── */
function ResumeGate({ opp, m, onPass, onReject }) {
  const params = (m.resumeParams && m.resumeParams.length ? m.resumeParams : DEFAULT_RP);
  const pass = m.passThreshold ?? 80;
  const scored = params.map((p) => ({ ...p, score: pseudo(opp.id + p.label, 62, 96) }));
  const totalW = scored.reduce((a, b) => a + (Number(b.weight) || 0), 0) || 100;
  const weighted = Math.round(scored.reduce((a, b) => a + (Number(b.weight) || 0) * b.score, 0) / totalW);
  const cleared = weighted >= pass;
  const [done, setDone] = useState(false);

  if (!done) return (
    <Card>
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><Loader2 size={26} color="#056FD4" className="spin" /></div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>Analysing your resume…</h2>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 18 }}>Matching against the job description &amp; must-have skills for {opp.title}.</div>
        <button className="btn-primary" style={{ borderRadius: 9999, padding: '11px 28px' }} onClick={() => setDone(true)}>See result</button>
      </div>
    </Card>
  );

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}><ShieldCheck size={18} color="#056FD4" /><h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Resume screen</h2></div>
      <div style={{ fontSize: 12.5, color: '#9CA3AF', marginBottom: 18 }}>Each parameter scored 0–100, then weighted. You clear at ≥ {pass}%.</div>
      {scored.map((p) => (
        <div key={p.label} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span style={{ color: '#374151' }}>{p.label} <span style={{ color: '#9CA3AF' }}>· {p.weight}%</span></span><b>{p.score}</b></div>
          <Bar pct={p.score} />
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid #F3F4F6' }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Weighted fit score</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: cleared ? '#16A34A' : '#DC2626' }}>{weighted}%</span>
      </div>
      <div style={{ background: cleared ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${cleared ? '#BBF7D0' : '#FCA5A5'}`, borderRadius: 10, padding: '12px 14px', marginTop: 12, fontSize: 13, color: cleared ? '#15803D' : '#991B1B' }}>
        {cleared ? <><Check size={15} style={{ verticalAlign: -3 }} /> Cleared the resume gate ({weighted}% ≥ {pass}%) — continue to the assessment.</> : <><AlertTriangle size={15} style={{ verticalAlign: -3 }} /> Below the {pass}% threshold — added to the Candidate Pool for review.</>}
      </div>
      {cleared ? <Cta onClick={() => onPass(weighted)}>Continue to assessment →</Cta>
        : <Cta onClick={onReject}>See what this means →</Cta>}
    </Card>
  );
}

/* ── dispatch a module to its proper run-time UI ── */
function ModuleStage({ m, opp, onNext }) {
  if (m.key === 'coding') return <CodingStage m={m} onNext={onNext} />;
  if (m.key === 'mcq') return <MCQStage m={m} onNext={onNext} />;
  if (m.key === 'typing') return <TypingStage m={m} onNext={onNext} />;
  if (m.key === 'language') return <LanguageStage m={m} onNext={onNext} />;
  return <WrittenStage m={m} opp={opp} onNext={onNext} />;
}

const StageHead = ({ m, sub }) => {
  const Icon = MODICON[m.key] || FileText;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="icon-box" style={{ width: 36, height: 36, borderRadius: 8 }}><Icon size={18} /></div><h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{MODNAME[m.key] || m.key}</h2></div>
        <span className="chip" style={{ background: '#ECFDF5', color: '#16A34A' }}><Camera size={13} /> Proctoring on</span>
      </div>
      {sub && <div style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

/* ── Coding: LeetCode-style problem + editor + run/submit ── */
function CodingStage({ m, onNext }) {
  const q = (m.questions || []).find((x) => x.type === 'coding') || {};
  const title = q.text || 'Two Sum';
  const description = q.description || 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.';
  const examples = q.examples?.length ? q.examples : [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] == 9.' }];
  const constraints = q.constraints?.length ? q.constraints.filter(Boolean) : ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9'];
  const [code, setCode] = useState(q.starter || 'def solve(nums, target):\n    # your code here\n    pass');
  const [ran, setRan] = useState(null); // null | {passed,total}
  const [running, setRunning] = useState(false);
  const total = 3;
  const run = () => { setRunning(true); setRan(null); setTimeout(() => { setRunning(false); setRan({ passed: Math.min(total, Math.max(1, Math.round(code.length / 40))), total }); }, 700); };
  const submit = () => { const passed = ran ? ran.passed : 2; onNext(Math.round((passed / total) * 100)); };

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 460 }}>
        {/* problem */}
        <div style={{ padding: '24px 26px', borderRight: '1px solid #E2E8F0', overflow: 'auto', maxHeight: '72vh' }}>
          <StageHead m={m} />
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '4px 0 6px' }}>{title}</h3>
          <span className="badge" style={{ background: '#DCFCE7', color: '#15803D' }}>{(q.difficulty || 'Medium')}</span>
          <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7, marginTop: 12 }}>{description}</p>
          {examples.map((ex, i) => (
            <div key={i} style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Example {i + 1}:</div>
              <div style={{ background: '#F8FAFC', borderLeft: '3px solid #E2E8F0', borderRadius: 6, padding: '10px 12px', fontSize: 12.5, fontFamily: 'ui-monospace, Menlo, monospace', color: '#334155', lineHeight: 1.7 }}>
                <div><b>Input:</b> {ex.input}</div><div><b>Output:</b> {ex.output}</div>{ex.explanation && <div><b>Explanation:</b> {ex.explanation}</div>}
              </div>
            </div>
          ))}
          {constraints.length > 0 && (<>
            <div style={{ fontSize: 13, fontWeight: 700, margin: '16px 0 6px' }}>Constraints:</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{constraints.map((c, i) => <li key={i} style={{ fontSize: 12.5, color: '#475569', fontFamily: 'ui-monospace, Menlo, monospace', marginBottom: 4 }}>{c}</li>)}</ul>
          </>)}
        </div>
        {/* editor */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Code2 size={14} /> {q.language || 'Python'}</span>
            <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={run} disabled={running}>{running ? <Loader2 size={13} className="spin" /> : <Play size={13} />} Run</button>
          </div>
          <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', background: '#0B1220', color: '#9CDCFE', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, padding: '16px 18px', lineHeight: 1.6, minHeight: 240 }} />
          <div style={{ borderTop: '1px solid #E2E8F0', padding: '12px 16px', minHeight: 70, background: '#fff' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 6 }}>Test result</div>
            {running ? <span style={{ fontSize: 12.5, color: '#6B7280' }}><Loader2 size={13} className="spin" style={{ verticalAlign: -2 }} /> Running hidden tests…</span>
              : ran ? <span style={{ fontSize: 13, fontWeight: 600, color: ran.passed === ran.total ? '#16A34A' : '#D97706' }}>{ran.passed === ran.total ? <Check size={14} style={{ verticalAlign: -2 }} /> : <AlertTriangle size={14} style={{ verticalAlign: -2 }} />} {ran.passed}/{ran.total} tests passed</span>
                : <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>Run your code to see results.</span>}
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', borderRadius: 9999, marginTop: 12 }} onClick={submit}>Submit &amp; continue →</button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── MCQ: real questions + options, scored from answers ── */
function MCQStage({ m, onNext }) {
  const seeded = (m.questions || []).filter((q) => q.type === 'mcq' && (q.options || []).some(Boolean));
  const qs = seeded.length ? seeded : [
    { id: 'd1', text: `Which best describes a core concept of ${m.skills?.[0] || 'this domain'}?`, options: ['Option A', 'Option B (correct)', 'Option C', 'Option D'], correct: 1 },
    { id: 'd2', text: 'Pick the most appropriate practice in this scenario.', options: ['Ignore it', 'Escalate appropriately', 'Guess', 'Do nothing'], correct: 1 },
    { id: 'd3', text: 'Which statement is true?', options: ['False one', 'Another false', 'The true statement', 'Also false'], correct: 2 },
  ];
  const [ans, setAns] = useState({});
  const allAnswered = qs.every((q) => ans[q.id] != null);
  const submit = () => { const correct = qs.filter((q) => ans[q.id] === q.correct).length; onNext(Math.round((correct / qs.length) * 100)); };
  return (
    <Card>
      <StageHead m={m} sub={`${qs.length} questions · auto-graded`} />
      {qs.map((q, i) => (
        <div key={q.id} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{i + 1}. {q.text}</div>
          {(q.options || []).filter(Boolean).map((opt, oi) => (
            <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: `1.5px solid ${ans[q.id] === oi ? '#056FD4' : '#E2E8F0'}`, background: ans[q.id] === oi ? '#F8FBFF' : '#fff', borderRadius: 9, marginBottom: 7, cursor: 'pointer', fontSize: 13.5 }}>
              <input type="radio" checked={ans[q.id] === oi} onChange={() => setAns((a) => ({ ...a, [q.id]: oi }))} /> {opt}
            </label>
          ))}
        </div>
      ))}
      <Cta onClick={submit} disabled={!allAnswered}>{allAnswered ? 'Submit & continue →' : 'Answer all to continue'}</Cta>
    </Card>
  );
}

/* ── Written / SJT / custom / personality ── */
function WrittenStage({ m, opp, onNext }) {
  const seeded = (m.questions || []).filter((q) => q.text);
  const qs = seeded.length ? seeded : [{ id: 'w1', text: `Describe your experience with ${m.skills?.[0] || opp.title}. Include a concrete example and the outcome.` }];
  const [vals, setVals] = useState({});
  const answered = qs.every((q) => (vals[q.id] || '').trim().length > 10);
  return (
    <Card>
      <StageHead m={m} sub={`Tests: ${m.skills?.length ? m.skills.join(', ') : 'general'} · scored on ${m.rubric?.length || 3} dimensions`} />
      {qs.map((q, i) => (
        <div key={q.id} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>{i + 1}. {q.text}</div>
          <textarea className="input" style={{ minHeight: 120, resize: 'vertical' }} placeholder="Type your answer…" value={vals[q.id] || ''} onChange={(e) => setVals((v) => ({ ...v, [q.id]: e.target.value }))} />
        </div>
      ))}
      <Cta onClick={() => onNext(pseudo(opp.id + m.key, 72, 90))} disabled={!answered}>{answered ? 'Submit & continue →' : 'Write a fuller answer to continue'}</Cta>
    </Card>
  );
}

/* ── Typing: real-ish WPM/accuracy measure ── */
function TypingStage({ m, onNext }) {
  const passage = 'The quick brown fox jumps over the lazy dog while the team ships reliable software every single day.';
  const [typed, setTyped] = useState('');
  const target = m.tWpm || 40;
  const correct = typed.split('').filter((c, i) => c === passage[i]).length;
  const acc = typed.length ? Math.round((correct / typed.length) * 100) : 100;
  const done = typed.length >= passage.length * 0.6;
  return (
    <Card>
      <StageHead m={m} sub={`Target: ${target} WPM · ${m.tAcc || 90}% accuracy`} />
      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: '#475569', lineHeight: 1.7, marginBottom: 10 }}>{passage}</div>
      <textarea className="input" style={{ minHeight: 90, resize: 'none', fontFamily: 'ui-monospace, Menlo, monospace' }} placeholder="Start typing the passage above…" value={typed} onChange={(e) => setTyped(e.target.value)} />
      <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 8 }}>Accuracy so far: <b style={{ color: acc >= (m.tAcc || 90) ? '#16A34A' : '#D97706' }}>{acc}%</b></div>
      <Cta onClick={() => onNext(Math.round((acc + Math.min(100, target * 2)) / 2))} disabled={!done}>{done ? 'Submit & continue →' : 'Keep typing to continue'}</Cta>
    </Card>
  );
}

/* ── Language: pick language + short spoken/written prompt ── */
function LanguageStage({ m, onNext }) {
  const langs = m.languages?.length ? m.languages : ['English'];
  const [lang, setLang] = useState(langs[0]);
  return (
    <Card>
      <StageHead m={m} sub="CEFR-scored across reading, writing, speaking, listening" />
      {langs.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>Language:</span>
          {langs.map((l) => <span key={l} className="chip" onClick={() => setLang(l)} style={{ cursor: 'pointer', background: lang === l ? '#056FD4' : '#fff', color: lang === l ? '#fff' : '#6B7280', border: lang === l ? 'none' : '1px solid #E2E8F0' }}>{l}</span>)}
        </div>
      )}
      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>In {lang}, write a short reply to a customer who is frustrated about a delayed order.</div>
      <textarea className="input" style={{ minHeight: 120, resize: 'vertical' }} placeholder={`Type your reply in ${lang}…`} />
      <Cta onClick={() => onNext(pseudo(lang + m.key, 74, 92))}>Submit &amp; continue →</Cta>
    </Card>
  );
}

function Interview({ m, onNext }) {
  const langs = m.languages?.length ? m.languages : ['English'];
  const [lang, setLang] = useState(langs[0]);
  return (
    <Card>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'linear-gradient(135deg,#056FD4,#0B3C82)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Bot size={54} /></div>
        <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 10 }}>Alex · AI Interviewer</div>
        {langs.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Interview language:</span>
            {langs.map((l) => <span key={l} className="chip" onClick={() => setLang(l)} style={{ cursor: 'pointer', background: lang === l ? '#056FD4' : '#fff', color: lang === l ? '#fff' : '#6B7280', border: lang === l ? 'none' : '1px solid #E2E8F0' }}>{l}</span>)}
          </div>
        )}
        <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.5, marginBottom: 6 }}>“You mentioned {m.skills?.[0] || 'your experience'} — walk me through a hard problem you solved and the trade-offs you weighed.”</div>
        <div style={{ fontSize: 12, color: '#6D28D9', marginBottom: 4 }}><Wand2 size={13} style={{ verticalAlign: -2 }} /> adaptive follow-up based on your earlier answers</div>
        <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 22 }}>Conducted in {lang}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #056FD4' }}><Mic size={26} color="#056FD4" /></div>
          <div style={{ fontSize: 12.5, color: '#6B7280' }}>Listening… speak your answer in {lang}</div>
        </div>
        <Cta onClick={() => onNext(pseudo(lang + (m.skills?.[0] || 'int'), 76, 92))}>Finish interview →</Cta>
      </div>
    </Card>
  );
}

function Rejected({ onExit }) {
  return (
    <Card>
      <div style={{ textAlign: 'center' }}>
        <div className="avatar" style={{ width: 64, height: 64, background: '#FEF3C7', color: '#B45309', margin: '0 auto 16px' }}><AlertTriangle size={30} /></div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Thanks for applying</h1>
        <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 18 }}>Your resume didn’t clear the screening threshold for this role right now — you’ve been added to the <b>Candidate Pool</b>, and the recruiter can still review or rescue your profile.</div>
        <Cta onClick={onExit}>Done</Cta>
      </div>
    </Card>
  );
}

/* ── Result: weighted score from the modules the candidate actually did, vs threshold ── */
function Result({ opp, scores, onExit }) {
  const weights = opp.assessment?.weights || [];
  const synth = (label) => label === 'Integrity' ? 94 : label.includes('Interview') ? (scores['AI Interview'] ?? 82) : 80;
  const rows = weights.map((w) => ({ label: w.label, w: w.w, score: scores[w.label] ?? synth(w.label) }));
  const totalW = rows.reduce((a, b) => a + (Number(b.w) || 0), 0) || 100;
  const weighted = Math.round(rows.reduce((a, b) => a + (Number(b.w) || 0) * b.score, 0) / totalW);
  const passMark = opp.criteria?.minAssessmentScore || 60;
  const cleared = weighted >= passMark;
  return (
    <Card>
      <div style={{ textAlign: 'center' }}>
        <div className="avatar" style={{ width: 64, height: 64, background: cleared ? '#DCFCE7' : '#FEF3C7', color: cleared ? '#16A34A' : '#B45309', margin: '0 auto 16px' }}><Check size={32} /></div>
        <h1 style={{ fontSize: 23, fontWeight: 700, margin: '0 0 6px' }}>Assessment submitted 🎉</h1>
        <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 20 }}>Here’s how your responses scored.</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Weighted score</span>
        <span style={{ fontSize: 24, fontWeight: 800, color: cleared ? '#16A34A' : '#D97706' }}>{weighted}<span style={{ fontSize: 13, color: '#9CA3AF' }}> / 100</span></span>
      </div>
      {rows.map((r) => (
        <div key={r.label} style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}><span style={{ color: '#374151' }}>{r.label} <span style={{ color: '#9CA3AF' }}>· {r.w}%</span></span><b>{r.score}</b></div>
          <Bar pct={r.score} />
        </div>
      ))}
      <div style={{ background: cleared ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${cleared ? '#BBF7D0' : '#FDE68A'}`, borderRadius: 10, padding: '12px 14px', marginTop: 12, fontSize: 13, color: cleared ? '#15803D' : '#92400E' }}>
        {cleared ? <><Check size={15} style={{ verticalAlign: -3 }} /> Cleared — {weighted}% is above the {passMark}% bar. You’ll appear on the recruiter’s Rank List.</> : <>{weighted}% is below the {passMark}% bar for this role. The recruiter may still review your profile.</>}
      </div>
      <Cta onClick={onExit}>Done</Cta>
    </Card>
  );
}
