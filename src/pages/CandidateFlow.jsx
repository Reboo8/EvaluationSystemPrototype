import { Component } from 'react';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, Loader2, CalendarClock, Link2, Mail, Save, ArrowRight, Eye } from 'lucide-react';
import { CandidateShell, Notice as ShellNotice, JOURNEY } from '../candidate/shell.jsx';
import { useApp, initials, fmtDate, isInviteExpired, hashNum } from '../store.jsx';
import { MediaProvider, useMedia } from '../candidate/media.jsx';
import { InstructionsPage, SystemCheckPage, IdentityPage } from '../candidate/PreAssessment.jsx';
import { AssessmentRunner } from '../candidate/AssessmentRunner.jsx';
import { InterviewPage } from '../candidate/InterviewPage.jsx';
import { ResultsPage } from '../candidate/ResultsPage.jsx';

/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   Candidate run-time. Entry is ALWAYS an assessment link (/a/:token) issued after the resume gate:
   careers-page apply · email invite · sourced resume · pool rescue · retake · recruiter preview.
   The link is time-bound and resumable; progress is saved on every step.
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */

const MODNAME = { resume: 'Resume / JD Screen', written: 'Written', mcq: 'MCQ / Objective', coding: 'Coding', sjt: 'Situational Judgement', language: 'Language / CEFR', personality: 'Personality', typing: 'Typing', computer: 'Computer Literacy', interview: 'AI Interview', simulation: 'Simulation', custom: 'Custom' };
/* rank-weight label per module key (must agree with AssessmentBuilder WEIGHT_LABEL) */
const KEY_LABEL = { coding: 'Coding', mcq: 'MCQ', written: 'Written', sjt: 'SJT', language: 'Language', typing: 'Typing', simulation: 'Simulation', interview: 'AI Interview', personality: 'Personality', computer: 'Computer Literacy' };
const DEFAULT_BANDS = [{ from: 0, to: 59, label: 'Reject' }, { from: 60, to: 69, label: 'Review' }, { from: 70, to: 100, label: 'Advance' }];
const bandOf = (m, score) => { const bands = m.bands && m.bands.length ? m.bands : DEFAULT_BANDS; const b = bands.find((x) => score >= Number(x.from) && score <= Number(x.to)); return b ? b.label : (score >= 60 ? 'Advance' : 'Reject'); };
const firstName = (n = '') => (String(n).replace(/^Dr\.?\s*/i, '').trim().split(' ')[0] || 'there');

/* ── the recruiter's "Preview candidate flow": issue a throw-away preview link and land on it, like a candidate would ── */
export function PreviewCandidate() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getOpportunity, createInvite, currentClient } = useApp();
  const made = useRef(false);
  useEffect(() => {
    if (made.current) return; made.current = true;
    const opp = getOpportunity(id);
    if (!opp) { nav('/opportunities', { replace: true }); return; }
    const inv = createInvite(id, { name: currentClient?.owner?.name || 'Preview candidate', email: currentClient?.owner?.email || 'preview@example.com', source: 'preview', validDays: 1 });
    nav('/a/' + inv.token, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}><Loader2 size={18} className="spin" style={{ verticalAlign: -4 }} /> Opening preview…</div>;
}

/* ── /a/:token — resolve the link first: invalid · used · declined · expired · replaced · live ── */
export default function CandidateFlow() {
  const { token } = useParams();
  const nav = useNavigate();
  const { getInvite, getOpportunity, getClient, renewInvite, settings } = useApp();
  const [renewed, setRenewed] = useState(null);
  /* once a live run has started on this mount it keeps the screen — submitting or withdrawing must show the
     run's own closure, not the "already completed" notice meant for someone re-opening the link later */
  const entered = useRef(null);
  const inv = getInvite(token);
  const opp = inv ? getOpportunity(inv.oppId) : null;
  const employer = opp ? getClient(opp.clientId || 'cl1') : null;
  const support = settings?.general?.supportEmail || 'support@cuba.reboo8.com';
  const who = employer?.name || 'the employer';
  const terminal = !inv || !opp || ['SUBMITTED', 'DECLINED', 'ABANDONED', 'RENEWED', 'EXPIRED'].includes(inv.status) || isInviteExpired(inv);
  if (!terminal && entered.current !== token) entered.current = token;
  if (entered.current === token && inv && opp) return <Run key={token} inv={inv} opp={opp} employer={employer} />;

  if (!inv || !opp) return (
    <Frame employer={employer} opp={opp}>
      <Notice icon={Link2} tone="muted" title="This link isn't valid" body="Check the link in your email, or ask the recruiter who invited you for a new one." foot={`Need help? ${support}`} />
    </Frame>
  );
  if (inv.status === 'SUBMITTED') return (
    <Frame employer={employer} opp={opp} stage="results" progress={1}>
      <Notice icon={Check} tone="ok" title="You've already completed this assessment" body={`Submitted on ${fmtDate(inv.submittedAt)}. ${who} will review your results and get back to you at ${inv.email}.`} foot="You can close this window." />
    </Frame>
  );
  if (inv.status === 'DECLINED' || inv.status === 'ABANDONED') return (
    <Frame employer={employer} opp={opp}>
      <Notice icon={Check} tone="muted" title={inv.status === 'DECLINED' ? 'You chose not to take this assessment' : 'This attempt was closed'} body={`We've let ${who} know. If you've changed your mind, contact them for a new invitation.`} foot={`Need help? ${support}`} />
    </Frame>
  );
  if (renewed) return (
    <Frame employer={employer} opp={opp}>
      <Notice icon={Mail} tone="ok" title="A new link is on its way" body={`We've sent a fresh assessment link to ${inv.email}. It's valid until ${fmtDate(renewed.expiresAt)}.`}>
        <Cta onClick={() => { setRenewed(null); nav('/a/' + renewed.token, { replace: true }); }}>Open the new link</Cta>
      </Notice>
    </Frame>
  );
  if (inv.status === 'RENEWED') return (
    <Frame employer={employer} opp={opp}>
      <Notice icon={Mail} tone="muted" title="This link was replaced by a newer one" body={`We sent a fresh link to ${inv.email}. Please use the latest email.`}>
        {inv.renewedTo && <Cta onClick={() => nav('/a/' + inv.renewedTo, { replace: true })}>Open the latest link</Cta>}
      </Notice>
    </Frame>
  );
  if (isInviteExpired(inv) || inv.status === 'EXPIRED') return (
    <Frame employer={employer} opp={opp}>
      <Notice icon={CalendarClock} tone="warn" title="This link has expired" body={`Your link for ${opp.title} was valid until ${fmtDate(inv.expiresAt)}. An expired link isn't a rejection — request a new one and pick up where you left off.`}>
        <Cta onClick={() => setRenewed(renewInvite(token))}>Request a new link</Cta>
      </Notice>
    </Frame>
  );
  return <Run key={inv.token} inv={inv} opp={opp} employer={employer} />;
}

/* ── the live run: instructions → system check → identity → proctored modules → AI interview → results ── */
function Run(props) { return <Guard><MediaProvider><RunInner {...props} /></MediaProvider></Guard>; }

/* Last line of defence: progress is persisted after every step, so a reload always resumes. */
class Guard extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('[candidate] render failed', err, info?.componentStack); }
  render() {
    if (!this.state.err) return this.props.children;
    const msg = String(this.state.err?.message || this.state.err).slice(0, 160);
    return (
      <div className="cand" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F6F8FB', padding: 24 }}>
        <div className="cj-card cj-enter" style={{ maxWidth: 460, padding: '32px 32px 28px', textAlign: 'center' }}>
          <div className="cj-eyebrow">Something went wrong</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#14212A', letterSpacing: '-0.02em', margin: '10px 0 8px' }}>This page hit a snag.</h1>
          <p style={{ color: '#475569', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 20px' }}>Your progress is saved. Reload to pick up where you left off. If it happens again, open the same link later or contact the employer.</p>
          <button className="cj-btn cj-btn--primary" onClick={() => window.location.reload()}>Reload</button>
          <div style={{ marginTop: 16, fontSize: 11.5, color: '#9CA3AF', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{msg}</div>
        </div>
      </div>
    );
  }
}

function RunInner({ inv, opp, employer }) {
  const nav = useNavigate();
  const app = useApp();
  const media = useMedia();
  const api = useRef(null); api.current = app;
  const token = inv.token;
  const preview = inv.source === 'preview';
  const noBill = preview || inv.source === 'retake';
  const clientId = opp.clientId || app.currentClientId;
  const allModules = (opp.assessment?.modules || []).filter((m) => m.key !== 'resume');
  const testModules = allModules.filter((m) => m.key !== 'interview');
  const interviewModule = allModules.find((m) => m.key === 'interview') || null;
  const saved = inv.attempt || null;
  const STAGES = ['instructions', 'syscheck', 'identity', ...(testModules.length ? ['assessment'] : []), ...(interviewModule ? ['interview'] : []), 'results'];
  const journey = JOURNEY.filter((j) => (j.key !== 'assessment' || testModules.length) && (j.key !== 'interview' || interviewModule));
  const [stage, setStage] = useState(() => (STAGES.includes(saved?.stage) ? saved.stage : 'instructions'));
  const [resumePrompt, setResumePrompt] = useState(() => !!saved && saved.stage && saved.stage !== 'instructions');
  const [modal, setModal] = useState(null);
  const [ended, setEnded] = useState(null);
  const [tick, setTick] = useState(0);
  const data = useRef({ syscheck: saved?.syscheck || null, identity: saved?.identity || null, runner: saved?.runner || null, interview: saved?.interview || null, results: saved?.results || [], violations: saved?.violations || [] });
  const [interviewResult, setInterviewResult] = useState(() => saved?.interviewResult || null);
  const [moduleResults, setModuleResults] = useState(() => saved?.results || []);
  const queue = useRef([]);
  const fired = useRef(new Set(saved?.fired || []));
  const held = useRef(saved?.held || null);
  const decided = useRef(false);

  const svc = (key) => (app.rateCard || []).find((r) => r.key === key) || {};
  const svcName = (key) => svc(key).name || MODNAME[key] || key;
  const svcRate = (key) => `${app.rateOf(key)} cr / ${(svc(key).unit || 'per unit').replace('per ', '')}`;
  const trace = (key, usage) => ({ oppId: opp.id, oppTitle: opp.title, candidate: inv.name || inv.email, module: svcName(key), usage, rate: svcRate(key) });
  const persist = (extra = {}) => { if (preview) return; api.current.saveAttempt(token, { stage, held: held.current, fired: Array.from(fired.current), syscheck: data.current.syscheck, identity: data.current.identity, runner: data.current.runner, interview: data.current.interview, results: moduleResults, interviewResult, violations: data.current.violations, ...extra }); };
  const push = (key, job) => { if (fired.current.has(key)) return; fired.current.add(key); queue.current.push(job); setTick((t) => t + 1); };
  const flush = () => { const q = queue.current; queue.current = []; q.forEach((j) => j()); };
  useEffect(() => { if (!queue.current.length) return; queue.current.shift()(); persist(); if (queue.current.length) setTick((t) => t + 1); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.current.openInvite(token); }, [token]);
  useEffect(() => { if (stage !== 'instructions') persist({ stage }); }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── billing (invisible to the candidate): proctoring once per run, a hold per paid module, settled on completion ── */
  const proctorOnce = () => { if (noBill) return; push('proctor', () => { const r = api.current.rateOf('proctoring'); if (r > 0) api.current.consumeCredits(clientId, r, trace('proctoring', '1 session')); api.current.recordUsage(clientId, { proctoringSessions: 1 }); }); };
  const holdFor = (m, idx) => { if (noBill) return; proctorOnce(); push('hold:' + m.key + idx, () => { const r = api.current.rateOf(m.key); if (m.key !== 'interview') api.current.recordUsage(clientId, { assessmentAttempts: 1 }); held.current = r > 0 ? { id: api.current.reserveCredits(clientId, { ...trace(m.key, 'hold before start'), hold: r }), hold: r, key: m.key, stage: m.key + idx } : null; }); };
  const settleFor = (m, idx, meta = {}) => { if (noBill) return; const isInt = m.key === 'interview'; push('settle:' + m.key + idx, () => { if (isInt) api.current.recordUsage(clientId, { interviews: 1, interviewMinutes: Number(meta.minutes) || 0 }); else api.current.recordUsage(clientId, { assessmentCompletions: 1 }); const h = held.current; if (!h || h.stage !== m.key + idx) return; const actual = isInt ? Math.max(1, Math.round((h.hold * (Number(meta.asked) || 1)) / (Number(meta.total) || 1))) : h.hold; api.current.settleReserve(clientId, h.id, actual, { ...trace(m.key, isInt ? `1 interview · ${meta.minutes || 0} min` : '1 attempt'), hold: h.hold }); held.current = null; }); };

  /* ── decision: per-module bands gate, client weights rank, then record ── */
  const decide = (results, iv) => {
    if (decided.current) return; decided.current = true;
    const scores = {};
    results.forEach((r) => { scores[KEY_LABEL[r.key] || r.label] = r.score; });
    if (iv) scores['AI Interview'] = iv.score;
    if (inv.fit?.fit != null) scores['Resume-fit'] = inv.fit.fit;
    const flags = data.current.violations.filter((v) => v.violationType).length;
    scores.Integrity = Math.max(40, 100 - flags * 5);
    /* client-named weight labels (e.g. "Medical Knowledge") map to modules in order when no module emits that label */
    const weights = opp.assessment?.weights || [];
    const unmatched = weights.filter((w) => scores[w.label] == null);
    const spare = [...results.filter((r) => !weights.some((w) => w.label === (KEY_LABEL[r.key] || r.label)))];
    unmatched.forEach((w) => { const r = spare.shift(); if (r) scores[w.label] = r.score; });
    const present = weights.filter((w) => scores[w.label] != null);
    const totalW = present.reduce((a, w) => a + (Number(w.w) || 0), 0) || 1;
    const weighted = Math.round(present.reduce((a, w) => a + (Number(w.w) || 0) * scores[w.label], 0) / totalW);
    const gates = results.map((r) => ({ module: r.label, key: r.key, score: r.score, band: bandOf(testModules[r.mi] || {}, r.score) }));
    if (iv && interviewModule) gates.push({ module: 'AI Interview', key: 'interview', score: iv.score, band: bandOf(interviewModule, iv.score) });
    const typing = results.find((r) => r.typing)?.typing;
    if (typing) { const tm = testModules.find((m) => m.key === 'typing'); gates.push({ module: 'Typing gate', key: 'typing-gate', score: typing.wpm, band: typing.wpm >= (tm?.tWpm || 40) && typing.acc >= (tm?.tAcc || 90) ? 'Advance' : 'Reject', detail: `${typing.wpm} WPM · ${typing.acc}%` }); }
    const passMark = opp.criteria?.minAssessmentScore || 60;
    const anyReject = gates.some((g) => /reject|fail/i.test(g.band)); const anyReview = gates.some((g) => /review/i.test(g.band));
    const status = anyReject ? 'NOT_CLEARED' : anyReview ? 'REVIEW' : weighted >= passMark ? 'CLEARED' : 'NOT_CLEARED';
    const cefr = iv?.cefr || (scores.Language != null ? (scores.Language >= 80 ? 'C1' : scores.Language >= 60 ? 'B2' : 'B1') : 'B2');
    const outcome = { status, cleared: status === 'CLEARED', weighted, scores, gates, passMark, cefr, wpm: typing?.wpm || 0, flags };
    push('record', () => {
      if (preview) return;
      api.current.submitInvite(token, outcome);
      api.current.recordUsage(clientId, { evaluations: 1 });
      if (status !== 'NOT_CLEARED') api.current.recordCandidateResult(opp.id, { name: inv.name || inv.email, email: inv.email, inviteToken: token, source: inv.source, scores, cefr, wpm: typing?.wpm || 0, exp: `${1 + (hashNum(inv.email || inv.name) % 5)} yrs`, minutes: iv?.minutes || 0, status, gates });
    });
  };

  const saveExit = () => { flush(); persist(); setModal(null); setEnded('saved'); };
  const withdraw = () => { flush(); const h = held.current; if (h && !noBill) { api.current.releaseReserve(clientId, h.id, { ...trace(h.key, 'hold released — candidate withdrew'), hold: h.hold }); held.current = null; } if (!preview) { if (stage === 'instructions') api.current.declineInvite(token); else api.current.abandonInvite(token); } media.stopAll(); setModal(null); setEnded('withdrawn'); };
  const exitPreview = () => { media.stopAll(); nav('/opportunities/' + opp.id); };
  const go = (next) => setStage(next);
  const afterIdentity = () => go(testModules.length ? 'assessment' : interviewModule ? 'interview' : 'results');
  const banner = preview ? <PreviewBanner onExit={exitPreview} /> : null;

  if (ended === 'saved') return <Frame employer={employer} opp={opp} stage={({ instructions: 'ready', syscheck: 'ready', identity: 'verify' })[stage] || stage} stages={journey}><Notice icon={Save} tone="ok" title="Your progress is saved" body={`Open the same link any time before ${fmtDate(inv.expiresAt)} and you'll continue from where you stopped.`} foot={`We've also emailed the link to ${inv.email}. You can close this window.`} /></Frame>;
  if (ended === 'withdrawn') return <Frame employer={employer} opp={opp} stages={journey}><Notice icon={Check} tone="muted" title="Thanks for letting us know" body={`We've told ${employer?.name || 'the employer'} that you won't be taking this assessment. You can close this window.`}>{preview && <Cta onClick={exitPreview}>Exit preview</Cta>}</Notice></Frame>;
  if (ended === 'done') return <Frame employer={employer} opp={opp} stage="results" stages={journey} progress={1}><Notice icon={Check} tone="ok" title={`All done, ${firstName(inv.name)}`} body={`Thanks for completing the assessment for ${opp.title}. ${employer?.name || 'The team'} will review your results and get back to you at ${inv.email}.`} foot="You can close this window.">{preview && <Cta onClick={exitPreview}>Back to {opp.title}</Cta>}</Notice></Frame>;
  if (resumePrompt) return <Frame employer={employer} opp={opp} stage={({ instructions: 'ready', syscheck: 'ready', identity: 'verify' })[stage] || stage} stages={journey}><Notice icon={ArrowRight} tone="ok" title={`Welcome back, ${firstName(inv.name)}`} body={`You were on ${({ syscheck: 'the system check', identity: 'identity verification', assessment: 'the assessment', interview: 'the AI interview', results: 'your results' })[stage] || 'the assessment'}. Your earlier progress is saved — pick up right where you left off.`}><Cta onClick={() => setResumePrompt(false)}>Resume assessment</Cta></Notice></Frame>;

  const modals = (<>
    {modal === 'save' && <Confirm title="Save and exit?" okLabel="Save & exit" onOk={saveExit} onCancel={() => setModal(null)} body={`Everything so far is saved. Come back with the same link before ${fmtDate(inv.expiresAt)} and you'll continue from where you stopped.`} extra={<button onClick={() => setModal('withdraw')} style={LINKISH}>I want to withdraw from this assessment instead</button>} />}
    {modal === 'withdraw' && <Confirm danger title={stage === 'instructions' ? 'Skip this assessment?' : 'Withdraw from this assessment?'} okLabel={stage === 'instructions' ? "Yes, I don't want to take it" : 'Yes, withdraw'} onOk={withdraw} onCancel={() => setModal(null)} body={`${employer?.name || 'The employer'} will be told you didn't take the assessment. You'd need a new invitation to try again.`} />}
  </>);

  if (stage === 'instructions') return <><InstructionsPage inv={inv} opp={opp} employer={employer} modules={allModules} preview={preview} banner={banner} stages={journey} onStart={() => go('syscheck')} onDecline={() => setModal('withdraw')} />{modals}</>;
  if (stage === 'syscheck') return <><SystemCheckPage employer={employer} opp={opp} stages={journey} banner={banner} onResult={(r) => { data.current.syscheck = r; }} onProceed={() => go('identity')} />{modals}</>;
  if (stage === 'identity') return <><IdentityPage employer={employer} opp={opp} stages={journey} banner={banner} onEvidence={(e) => { data.current.identity = e; }} onContinue={afterIdentity} />{modals}</>;
  if (stage === 'assessment') return (<>
    <AssessmentRunner inv={inv} opp={opp} employer={employer} modules={testModules} saved={data.current.runner} banner={banner} fsRequired={!preview} stages={journey}
      onPersist={(st) => { data.current.runner = st; persist(); }}
      onModuleStart={(m, i) => holdFor(m, i)}
      onModuleResult={(r) => { settleFor(testModules[r.mi], r.mi); setModuleResults((l) => { const next = [...l.filter((x) => x.mi !== r.mi), r]; data.current.results = next; return next; }); }}
      onViolationLog={(v) => { data.current.violations = [...data.current.violations, { ...v, stage: 'assessment' }]; }}
      onSaveExit={() => setModal('save')}
      onComplete={(results) => { data.current.results = results; setModuleResults(results); if (interviewModule) go('interview'); else { decide(results, null); go('results'); } }} />
    {modals}
  </>);
  if (stage === 'interview') return (<>
    <InterviewStage key="iv" m={interviewModule} opp={opp} employer={employer} inv={inv} banner={banner} fsRequired={!preview} moduleResults={moduleResults} stages={journey}
      onStarted={() => holdFor(interviewModule, 'iv')}
      onPersist={(st) => { data.current.interview = st; }}
      onFinish={(res) => { settleFor(interviewModule, 'iv', res); setInterviewResult(res); decide(moduleResults, res); go('results'); }} />
    {modals}
  </>);
  return <ResultsPage inv={inv} opp={opp} employer={employer} stages={journey} results={moduleResults} interview={interviewResult} integrity={{ violations: data.current.violations }} identity={data.current.identity} preview={preview} onDone={() => { media.stopAll(); if (preview) exitPreview(); else setEnded('done'); }} />;
}

/* the interview charges when it actually starts (candidate clicks Start), not when the page opens */
function InterviewStage({ onStarted, moduleResults, ...rest }) {
  const started = useRef(false);
  const weak = (moduleResults || []).filter((r) => r.score < 65).map((r) => r.label);
  return <InterviewPage {...rest} weakAreas={weak} onPersist={(st) => { if (!started.current && st.questions?.length) { started.current = true; onStarted?.(); } rest.onPersist?.(st); }} />;
}

/* ═══════════════════════════ shell-based notices + dialogs (v2 design) ═══════════════════════════ */
const LINKISH = { background: 'none', border: 'none', color: '#6B7280', fontSize: 13, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', padding: 0, fontFamily: 'inherit' };

function Frame({ employer, opp, banner, stage, stages, progress, children }) {
  return <CandidateShell employer={employer} opp={opp} stage={stage} stages={stages} progress={progress} banner={banner}>{children}</CandidateShell>;
}

const PreviewBanner = ({ onExit }) => (
  <div style={{ background: '#14212A', color: '#fff', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 28px', fontSize: 12.5, position: 'relative', zIndex: 21 }}>
    <Eye size={15} /><span style={{ flex: 1 }}><b>Preview</b> — this is exactly what a candidate sees. Nothing is saved, charged or ranked.</span>
    <button onClick={onExit} className="cj-btn cj-btn--sm" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>Exit preview</button>
  </div>
);

const Cta = ({ children, onClick, disabled }) => <button className="cj-btn cj-btn--primary cj-btn--lg" disabled={disabled} style={{ marginTop: 22, minWidth: 260 }} onClick={onClick}>{children}</button>;
const Notice = ShellNotice;

function Confirm({ title, body, okLabel, onOk, onCancel, danger, extra }) {
  return (
    <div className="cand" onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,42,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="cj-card cand-slide-in" style={{ width: 440, maxWidth: '94vw', padding: '26px 28px 22px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#14212A', letterSpacing: '-.01em' }}>{title}</h2>
        <p style={{ fontSize: 14.5, color: '#4B5563', lineHeight: 1.6, marginTop: 8 }}>{body}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="cj-btn cj-btn--ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button className={`cj-btn ${danger ? 'cj-btn--danger' : 'cj-btn--primary'}`} style={{ flex: 1 }} onClick={onOk}>{okLabel}</button>
        </div>
        {extra && <div style={{ textAlign: 'center', marginTop: 14 }}>{extra}</div>}
      </div>
    </div>
  );
}
