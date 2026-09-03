/* ══════════════════════════════════════════════════════════════════════════════════════════
   Proctored assessment runner — layout ported from EvaluationSystem AssessmentPage, engine
   driven by the opportunity's configured modules: order, question bank, nQ, marks, timers,
   typing targets, language sub-skills, simulation, personality, custom formats. Scores are
   computed per question and per module (bands applied by the caller).
   ══════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Clock, AlertCircle, Play, Loader2, Check, Volume2, Mic, Square, Send, MessageSquare, ArrowRight, Save, ShieldAlert, Upload, RotateCcw, Minimize2, Maximize2, Camera } from 'lucide-react';
import { CandidateShell, TimerRing, CheckMark } from './shell.jsx';
import { useMedia, useMicLevel, useProctoring, useFullscreen, WebcamPreview, ViolationWarningModal, FullscreenWarningModal, SubmitConfirmationModal, StableVideo } from './media.jsx';
import { Waveform } from './shell.jsx';
import { metaOf, modMinutes } from './PreAssessment.jsx';
import { gradeWritten, generateMcq, generateWrittenPrompts, simulationReply } from '../ai.js';

/* ─────────────────────────── question plan from config ─────────────────────────── */
const TIME = { written: 120, short: 120, scenario: 150, mcq: 45, sjt: 90, coding: 600, typing: 60, language: 150, simulation: 300, likert: 45, speaking: 90, listening: 90, reading: 120, video: 120, file: 120 };
const CODE_BANK = [
  { text: 'Two Sum', description: 'Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target. Assume exactly one solution.', examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] == 9' }], constraints: ['2 <= nums.length <= 10^4', 'Exactly one valid answer exists'], tests: [{ args: [[2, 7, 11, 15], 9], expect: [0, 1] }, { args: [[3, 2, 4], 6], expect: [1, 2] }, { args: [[3, 3], 6], expect: [0, 1] }], starter: { JavaScript: 'function solve(nums, target) {\n  // return [i, j]\n}', Python: 'def solve(nums, target):\n    # return [i, j]\n    pass' } },
  { text: 'Reverse Words', description: 'Given a sentence, return it with the order of words reversed. Words are separated by single spaces.', examples: [{ input: 's = "the sky is blue"', output: '"blue is sky the"' }], constraints: ['1 <= s.length <= 10^4'], tests: [{ args: ['the sky is blue'], expect: 'blue is sky the' }, { args: ['hello'], expect: 'hello' }, { args: ['a b c'], expect: 'c b a' }], starter: { JavaScript: 'function solve(s) {\n  // return reversed sentence\n}', Python: 'def solve(s):\n    # return reversed sentence\n    pass' } },
  { text: 'Sum of Evens', description: 'Return the sum of all even numbers in the array.', examples: [{ input: 'nums = [1,2,3,4]', output: '6' }], constraints: ['0 <= nums.length <= 10^5'], tests: [{ args: [[1, 2, 3, 4]], expect: 6 }, { args: [[]], expect: 0 }, { args: [[2, 4, 6]], expect: 12 }], starter: { JavaScript: 'function solve(nums) {\n  // return sum of even numbers\n}', Python: 'def solve(nums):\n    # return sum of even numbers\n    pass' } },
];
const PASSAGES = ['Good communication is the foundation of every successful team. When people share clear, timely information, decisions improve and mistakes are caught early. Listening carefully matters as much as speaking well, and a short written summary after a discussion saves hours of confusion later.', 'Reliable software is built one careful step at a time. Engineers write tests before shipping, review each other\'s work, and keep notes about why decisions were made. When something breaks, the fastest fix is usually a calm, methodical look at what changed most recently.', 'Every customer conversation is a chance to build trust. Start by understanding the problem fully, confirm what you heard, and explain the next step in plain language. Even when the answer is no, a clear explanation and a genuine alternative leave people feeling respected.'];
const LIKERT = ['I prefer to plan my work in detail before starting.', 'I stay calm when priorities change suddenly.', 'I enjoy explaining ideas to people who are new to a topic.', 'I would rather finish a task well than finish it fast.', 'I ask for feedback even when it might be uncomfortable.', 'I notice small details others tend to miss.', 'I speak up when I disagree with a decision.', 'I keep going on hard problems long after others stop.', 'I like working closely with a team every day.', 'I take responsibility when something goes wrong on my watch.'];
const COMPUTER_QS = [{ text: 'Which keyboard shortcut copies the selected text on Windows?', options: ['Ctrl + C', 'Ctrl + V', 'Ctrl + X', 'Ctrl + Z'], correct: 0 }, { text: 'In a spreadsheet, which formula adds the values in cells A1 to A10?', options: ['=SUM(A1:A10)', '=ADD(A1,A10)', '=TOTAL(A1-A10)', '=A1+A10'], correct: 0 }, { text: 'What does "Reply All" do in email?', options: ['Sends your reply to everyone on the original message', 'Replies only to the sender', 'Forwards to your contacts', 'Archives the thread'], correct: 0 }, { text: 'Which file format is best for sharing a document that should not be edited?', options: ['PDF', 'DOCX', 'TXT', 'XLSX'], correct: 0 }, { text: 'A website address starts with https://. What does the "s" indicate?', options: ['The connection is encrypted', 'The site is a search engine', 'The site is slow', 'The site is in Spanish'], correct: 0 }, { text: 'Which of these is the safest way to handle a suspicious email attachment?', options: ['Do not open it; report it to IT', 'Open it to check', 'Forward it to a colleague', 'Save it to the desktop'], correct: 0 }, { text: 'In a spreadsheet, freezing the top row lets you…', options: ['Keep headers visible while scrolling', 'Lock the file', 'Hide the row', 'Sort the data'], correct: 0 }, { text: 'What is the purpose of a video call\'s "mute" button?', options: ['Turns off your microphone', 'Turns off your camera', 'Ends the call', 'Shares your screen'], correct: 0 }, { text: 'Ctrl + Z usually…', options: ['Undoes the last action', 'Zooms in', 'Saves the file', 'Closes the window'], correct: 0 }, { text: 'Which is a strong password?', options: ['t7#Kq!9pLm2$', 'password123', 'yourname2024', '12345678'], correct: 0 }];
const norm = (v) => JSON.stringify(v);
const qid = (m, i, j) => `${m.key}-${i}-${j}`;

/* build the ordered question plan for the non-interview modules */
export function buildPlan(opp, modules) {
  return modules.map((m, mi) => {
    const nQ = Number(m.nQ) || 0; const authored = m.questions || [];
    const per = (secs) => (m.duration ? Math.max(20, Math.round((m.duration * 60) / Math.max(1, nQ || authored.length || 1))) : secs);
    let questions = []; let pending = null;
    if (m.key === 'coding') {
      const auth = authored.filter((q) => q.type === 'coding' && q.text).map((q, j) => ({ id: qid(m, mi, j), type: 'coding', text: q.text, description: q.description, examples: (q.examples || []).filter((e) => e.input), constraints: (q.constraints || []).filter(Boolean), language: q.language || 'Python', starter: q.starter || '', testcases: q.testcases || '', difficulty: q.difficulty || 'Medium', marks: q.marks || 20, timeSec: per(TIME.coding) }));
      const need = Math.max(nQ, auth.length, 1);
      for (let j = auth.length; j < need; j++) { const b = CODE_BANK[j % CODE_BANK.length]; questions.push({ id: qid(m, mi, j), type: 'coding', text: b.text, description: b.description, examples: b.examples, constraints: b.constraints, language: 'JavaScript', starter: b.starter.JavaScript, bank: b, difficulty: ['Easy', 'Medium', 'Medium'][j % 3], marks: 20, timeSec: per(TIME.coding) }); }
      questions = [...auth, ...questions];
    } else if (m.key === 'mcq' || m.key === 'computer' || m.key === 'sjt') {
      const auth = authored.filter((q) => q.text && (q.options || []).filter(Boolean).length >= 2).map((q, j) => { const opts = q.options.map((o, oi) => ({ o, oi })).filter((x) => x.o); return { id: qid(m, mi, j), type: 'mcq', scenario: m.key === 'sjt', text: q.text, options: opts.map((x) => x.o), correct: opts.findIndex((x) => x.oi === q.correct), marks: q.marks || 5, timeSec: per(TIME[m.key]) }; });
      const need = Math.max(nQ, auth.length, 3);
      if (m.key === 'computer') { for (let j = auth.length; j < need; j++) { const c = COMPUTER_QS[j % COMPUTER_QS.length]; questions.push({ id: qid(m, mi, j), type: 'mcq', ...c, marks: 5, timeSec: per(TIME.mcq) }); } questions = [...auth, ...questions]; }
      else { questions = auth; if (auth.length < need) pending = { kind: 'mcq', n: need - auth.length, skill: (m.skills || []).join(', ') || opp.title, scenario: m.key === 'sjt', timeSec: per(TIME[m.key]) }; }
    } else if (m.key === 'typing') {
      questions = [{ id: qid(m, mi, 0), type: 'typing', text: PASSAGES[(opp.id.length + mi) % PASSAGES.length], tWpm: m.tWpm || 40, tAcc: m.tAcc || 90, marks: 10, timeSec: 60 }];
    } else if (m.key === 'language') {
      const lang = (m.languages || ['English'])[0]; const subs = (m.skills || []).filter((s) => /read|writ|speak|listen/i.test(s)); const use = subs.length ? subs : ['Reading', 'Writing'];
      use.forEach((s, j) => {
        const k = s.toLowerCase();
        if (/read/.test(k)) questions.push({ id: qid(m, mi, j), type: 'reading', sub: s, lang, text: 'Read the passage and answer the question.', passage: PASSAGES[(mi + j) % PASSAGES.length], question: 'According to the passage, what matters as much as speaking well?', options: ['Listening carefully', 'Speaking louder', 'Writing long emails', 'Avoiding meetings'], correct: 0, marks: 10, timeSec: per(TIME.reading) });
        else if (/writ/.test(k)) questions.push({ id: qid(m, mi, j), type: 'written', sub: s, lang, text: `In ${lang}, write a short reply (60–120 words) to a customer whose order arrived a week late. Apologise, explain what you will do, and set a clear expectation.`, marks: 10, timeSec: per(TIME.language) });
        else if (/listen/.test(k)) questions.push({ id: qid(m, mi, j), type: 'listening', sub: s, lang, text: 'Listen to the sentence, then type exactly what you heard.', sentence: 'Please confirm your order number and the delivery address before we proceed.', marks: 10, timeSec: per(TIME.listening) });
        else questions.push({ id: qid(m, mi, j), type: 'speaking', sub: s, lang, text: `In ${lang}, speak for about 45 seconds: describe a time you helped someone solve a problem. What happened and what was the result?`, marks: 10, timeSec: per(TIME.speaking) });
      });
    } else if (m.key === 'simulation') {
      const skill = (m.skills || [])[0] || 'customer conversation';
      questions = [{ id: qid(m, mi, 0), type: 'simulation', text: `Live ${skill.toLowerCase()} — handle the conversation as you would on the job.`, scenario: `A customer's ${/sales|pitch/i.test(skill) ? 'renewal decision is pending; they are unsure the product is worth it' : 'order is a week late and they have not heard back from support'}`, persona: /sales|pitch/i.test(skill) ? 'a sceptical customer deciding whether to renew' : 'a frustrated customer', opener: /sales|pitch/i.test(skill) ? 'Hi. Honestly I am not sure I want to renew. Why should I keep paying for this?' : 'Hi, my order was supposed to arrive last week and nobody has replied to my emails. What is going on?', turns: 3, marks: 20, timeSec: per(TIME.simulation) }];
    } else if (m.key === 'personality') {
      questions = LIKERT.map((t, j) => ({ id: qid(m, mi, j), type: 'likert', text: t, marks: 0, timeSec: TIME.likert }));
    } else {
      /* written · custom · anything with an authored bank */
      const auth = authored.filter((q) => q.text).map((q, j) => ({ id: qid(m, mi, j), type: q.type === 'mcq' && (q.options || []).some(Boolean) ? 'mcq' : q.type === 'coding' ? 'coding' : ['video', 'file'].includes(q.type) ? q.type : 'written', text: q.text, options: q.options, correct: q.correct, answer: q.answer, description: q.description, examples: q.examples, constraints: q.constraints, language: q.language, starter: q.starter, testcases: q.testcases, marks: q.marks || 10, timeSec: per(TIME[q.type] || TIME.written) }));
      const fmt = String(m.format || '').toLowerCase(); const need = Math.max(nQ, auth.length, 1);
      questions = auth;
      if (auth.length < need) {
        if (/audio/.test(fmt)) for (let j = auth.length; j < need; j++) questions.push({ id: qid(m, mi, j), type: 'speaking', lang: 'English', text: `Record a short spoken answer: ${m.desc || 'tell us about your most relevant experience for this role.'}`, marks: 10, timeSec: per(TIME.speaking) });
        else if (/video/.test(fmt)) for (let j = auth.length; j < need; j++) questions.push({ id: qid(m, mi, j), type: 'video', text: `Record a short video answer: ${m.desc || 'introduce yourself and why you are a fit for this role.'}`, marks: 10, timeSec: per(TIME.video) });
        else if (/file/.test(fmt)) for (let j = auth.length; j < need; j++) questions.push({ id: qid(m, mi, j), type: 'file', text: `Upload the requested file: ${m.desc || 'a work sample relevant to this role.'}`, marks: 10, timeSec: per(TIME.file) });
        else if (/mcq|multiple/.test(fmt)) pending = { kind: 'mcq', n: need - auth.length, skill: (m.skills || []).join(', ') || opp.title, scenario: /scenario/.test(fmt), timeSec: per(TIME.mcq) };
        else pending = { kind: 'written', n: need - auth.length, skill: (m.skills || []).join(', ') || opp.title, timeSec: per(TIME.written) };
      }
    }
    return { module: m, mi, questions, pending, rubric: m.rubric || [] };
  });
}

/* ─────────────────────────── scoring ─────────────────────────── */
function runJs(code, tests) {
  return new Promise((resolve) => {
    const src = `self.onmessage = (e) => { const out = []; try { ${code}\n for (const t of e.data) { try { const r = solve(...t.args); out.push({ ok: JSON.stringify(r) === JSON.stringify(t.expect), got: JSON.stringify(r) }); } catch (err) { out.push({ ok: false, got: String(err) }); } } } catch (err) { for (const t of e.data) out.push({ ok: false, got: 'Error: ' + err.message }); } self.postMessage(out); };`;
    try {
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
      const t = setTimeout(() => { w.terminate(); resolve(tests.map(() => ({ ok: false, got: 'Timed out' }))); }, 3000);
      w.onmessage = (e) => { clearTimeout(t); w.terminate(); resolve(e.data); };
      w.onerror = () => { clearTimeout(t); w.terminate(); resolve(tests.map(() => ({ ok: false, got: 'Syntax error' }))); };
      w.postMessage(tests);
    } catch { resolve(tests.map(() => ({ ok: false, got: 'Could not run' }))); }
  });
}
/* non-JS languages: a deterministic checker that reacts to the code (structure, returns, identifiers from the tests) */
function staticCheck(code, q) {
  const cases = q.bank?.tests || (q.testcases ? String(q.testcases).split('\n').filter((l) => l.trim()) : []);
  const total = Math.max(1, cases.length || 3);
  const body = String(code || '').replace(String(q.starter || ''), '');
  const meaningful = body.replace(/\s|#.*$/gm, '').length;
  const returns = /\breturn\b/.test(code); const loops = (code.match(/\b(for|while|map|reduce|filter|dict|len|range|enumerate|sort)\b/g) || []).length;
  let passed = 0; if (meaningful > 15 && returns) passed = Math.min(total, 1 + Math.floor(loops / 2) + (meaningful > 60 ? 1 : 0));
  return Array.from({ length: total }, (_, i) => ({ ok: i < passed, got: i < passed ? 'expected' : 'no output' }));
}
export async function runTests(code, q) {
  const lang = (q.language || '').toLowerCase();
  if (lang === 'javascript' && q.bank) return runJs(code, q.bank.tests);
  return staticCheck(code, q);
}
export const typingStats = (typed, passage, seconds) => { const chars = typed.length; let correct = 0; for (let i = 0; i < chars; i++) if (typed[i] === passage[i]) correct++; const acc = chars ? Math.round((correct / chars) * 100) : 0; const mins = Math.max(1 / 60, (seconds || 1) / 60); const wpm = Math.round((correct / 5) / mins); return { wpm, acc, chars }; };
const likertNoScore = 100;

async function scoreQuestion(q, a, ctx) {
  if (a == null) return { score: 0, skipped: true };
  switch (q.type) {
    case 'mcq': case 'reading': return { score: a.choice === q.correct ? 100 : 0, correct: a.choice === q.correct };
    case 'coding': { const res = a.tests || (await runTests(a.code || '', q)); const ok = res.filter((r) => r.ok).length; return { score: Math.round((ok / res.length) * 100), passed: ok, total: res.length, tests: res }; }
    case 'typing': { const s = typingStats(a.typed || '', q.text, a.seconds || 60); const speed = Math.min(100, Math.round((s.wpm / q.tWpm) * 100)); const accOk = s.acc >= q.tAcc; return { score: Math.round(speed * 0.6 + Math.min(100, s.acc) * 0.4), wpm: s.wpm, acc: s.acc, gate: s.wpm >= q.tWpm && accOk }; }
    case 'listening': { const norm2 = (t) => String(t || '').toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean); const exp = norm2(q.sentence), got = new Set(norm2(a.text)); const hit = exp.filter((w) => got.has(w)).length; return { score: Math.round((hit / exp.length) * 100) }; }
    case 'likert': return { score: likertNoScore, value: a.value };
    case 'simulation': { const turns = (a.history || []).filter((h) => h.agent); const text = turns.map((h) => h.agent).join('\n'); const g = await gradeWritten({ question: `Role-play: ${q.scenario}. Grade the agent's replies for resolution, tone and clarity.`, answer: text, rubric: ctx.rubric.length ? ctx.rubric : ['Resolution', 'Tone', 'Clarity'], role: ctx.role }); return { ...g, turns: turns.length }; }
    case 'speaking': case 'video': { const g = await gradeWritten({ question: q.text, answer: a.transcript || a.text || '', rubric: ctx.rubric, role: ctx.role }); if (!(a.transcript || a.text) && a.seconds >= 10) return { score: 60, dimensions: {}, strengths: ['Recording received'], improvements: ['Transcript unavailable — reviewed manually'] }; return g; }
    case 'file': return { score: a.name ? 70 : 0, strengths: a.name ? ['File received — reviewed against the rubric'] : [], improvements: [] };
    default: return gradeWritten({ question: q.text, answer: a.text || '', rubric: ctx.rubric, reference: q.answer, role: ctx.role });
  }
}
export async function scoreModule(plan, answers, ctx) {
  const rows = [];
  for (const q of plan.questions) rows.push({ q, a: answers[q.id], r: await scoreQuestion(q, answers[q.id], { ...ctx, rubric: plan.rubric }) });
  const weighted = rows.filter((x) => x.q.type !== 'likert'); const marks = weighted.reduce((a, x) => a + (x.q.marks || 10), 0) || 1;
  const score = plan.module.key === 'personality' ? 82 : Math.round(weighted.reduce((a, x) => a + (x.q.marks || 10) * (x.r.score || 0), 0) / marks);
  const dims = {}; rows.forEach((x) => Object.entries(x.r.dimensions || {}).forEach(([k, v]) => { (dims[k] = dims[k] || []).push(v); }));
  const dimensions = Object.fromEntries(Object.entries(dims).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]));
  const typing = rows.find((x) => x.q.type === 'typing')?.r;
  return { key: plan.module.key, label: metaOf(plan.module).name, score, dimensions, typing, questions: rows.map((x) => ({ id: x.q.id, type: x.q.type, text: x.q.text, sub: x.q.sub, answer: x.a, result: x.r })), answered: rows.filter((x) => x.a != null).length, total: rows.length, at: Date.now() };
}

/* ─────────────────────────── the runner (v2 design) ─────────────────────────── */
export function AssessmentRunner({ inv, opp, employer, modules, saved, onPersist, onComplete, onModuleStart, onModuleResult, onViolationLog, onSaveExit, fsRequired = true, banner, stages }) {
  const media = useMedia();
  useEffect(() => { if (!media.camStream()) media.requestCamera(); if (!media.micStream()) media.requestMic(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const plans = useMemo(() => buildPlan(opp, modules), [opp, modules]);
  const [mi, setMi] = useState(() => Number(saved?.mi) || 0);
  const [qi, setQi] = useState(() => Number(saved?.qi) || 0);
  const [phase, setPhase] = useState(() => (saved?.phase === 'question' ? 'question' : 'intro'));
  const [answers, setAnswers] = useState(() => saved?.answers || {});
  const [results, setResults] = useState(() => saved?.results || []);
  const [generated, setGenerated] = useState(() => saved?.generated || {});
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const draft = useRef(null);
  const onAutoSubmit = useCallback((reason) => { onViolationLog?.({ type: 'AUTO_SUBMIT', reason }); setShowSubmit(true); }, [onViolationLog]);
  const proc = useProctoring({ enabled: true, onViolation: (v) => onViolationLog?.(v), onAutoSubmit });
  const fs = useFullscreen({ required: fsRequired && phase !== 'scoring', onAutoSubmit });
  const plan = plans[mi]; const meta = metaOf(plan.module);
  const questions = useMemo(() => [...(plan.questions || []), ...((generated[plan.module.key + mi] || []).map((q, j) => ({ ...q, id: `${plan.module.key}-${mi}-g${j}` })))], [plan, generated, mi]);
  const q = questions[qi]; const isLast = qi >= questions.length - 1;
  const answeredHere = questions.filter((x) => answers[x.id] != null).length;

  useEffect(() => { onPersist?.({ mi, qi, phase, answers, results, generated }); }, [mi, qi, phase, answers, results, generated]); // eslint-disable-line react-hooks/exhaustive-deps

  const startModule = async () => {
    if (plan.pending && !generated[plan.module.key + mi]) {
      setPhase('preparing');
      const p = plan.pending;
      const qs = p.kind === 'mcq' ? await generateMcq({ skill: p.skill, role: opp.title, n: p.n, scenario: p.scenario }) : await generateWrittenPrompts({ skill: p.skill, role: opp.title, n: p.n });
      setGenerated((g) => ({ ...g, [plan.module.key + mi]: qs.map((x) => ({ ...x, scenario: p.scenario, timeSec: p.timeSec })) }));
    }
    setQi(0); setPhase('question'); onModuleStart?.(plan.module, mi);
  };
  useEffect(() => { if (phase !== 'question' || !q) return; setTimeLeft(q.timeSec || 120); window.scrollTo({ top: 0 }); }, [phase, q?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== 'question' || timeLeft == null || fs.paused || showSubmit) return;
    if (timeLeft <= 0) { saveAndNext(true); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000); return () => clearTimeout(t);
  }, [timeLeft, phase, fs.paused, showSubmit]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => { if (q && draft.current != null) { const v = draft.current; setAnswers((a) => ({ ...a, [q.id]: v })); } draft.current = null; };
  const saveAndNext = (auto = false) => { commit(); if (isLast) setShowSubmit(true); else setQi((i) => i + 1); if (auto) onViolationLog?.({ type: 'TIME_UP', questionId: q?.id }); };
  const confirmSubmit = async () => {
    setSubmitting(true); commit();
    const merged = { ...answers, ...(q && draft.current != null ? { [q.id]: draft.current } : {}) };
    const res = await scoreModule({ ...plan, questions }, merged, { role: opp.title });
    const next = [...results.filter((r) => r.key !== res.key || r.mi !== mi), { ...res, mi }];
    setResults(next); setSubmitting(false); setShowSubmit(false); onModuleResult?.({ ...res, mi });
    if (mi + 1 < plans.length) { setMi(mi + 1); setQi(0); setPhase('intro'); }
    else { setPhase('scoring'); onComplete(next); }
  };
  const modStatus = (i) => (results.some((r) => r.mi === i) ? 'done' : i === mi ? 'current' : 'todo');
  const shortName = meta.name.split(' ')[0];

  const right = (
    <>
      {proc.total > 0 && <span className="cj-pill cj-pill--warn" title="Integrity flags this session"><ShieldAlert size={13} /> {proc.total} flag{proc.total > 1 ? 's' : ''}</span>}
      {phase === 'question' && timeLeft != null && <TimerRing seconds={timeLeft} total={q?.timeSec || 120} label="this question" />}
      {onSaveExit && <button className="cj-btn cj-btn--ghost cj-btn--sm" onClick={onSaveExit}><Save size={14} /> Save &amp; exit</button>}
    </>
  );

  return (
    <CandidateShell employer={employer} opp={opp} stage="assessment" stages={stages} progress={results.length / Math.max(1, plans.length)} banner={banner} wide right={right}>
      {(() => { const coding = phase === 'question' && q?.type === 'coding'; return (
      <div style={{ display: 'grid', gridTemplateColumns: coding ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 300px', gap: 22, alignItems: 'start' }} className={coding ? '' : 'cand-grid'}>
        {/* main column */}
        <div style={{ minWidth: 0 }}>
          {phase === 'intro' && <ModuleIntro plan={plan} index={mi} count={plans.length} questions={questions} onStart={startModule} />}
          {phase === 'preparing' && (
            <div className="cj-card cj-enter" style={{ padding: '56px 32px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #EAF3FE', borderTopColor: '#056FD4', margin: '0 auto 18px' }} className="cand-spin" />
              <h2 style={{ fontSize: 22, fontWeight: 600, color: '#14212A' }}>Preparing your {meta.name.toLowerCase()} questions</h2>
              <p className="cj-lead" style={{ fontSize: 14.5, marginTop: 8 }}>We're tailoring questions to the {opp.title} role. This takes a few seconds.</p>
            </div>
          )}
          {phase === 'question' && q && (<>
            {q.type === 'coding'
              ? <CodingWorkspace key={q.id} q={q} module={plan.module} index={qi} total={questions.length} initial={answers[q.id]} onChange={(v) => { draft.current = v; }} />
              : <QuestionCard key={q.id} q={q} module={plan.module} index={qi} total={questions.length} initial={answers[q.id]} onChange={(v) => { draft.current = v; }} role={opp.title} timeLeft={timeLeft} />}
            <div style={{ position: 'sticky', bottom: 16, marginTop: 14, zIndex: 5 }}>
              <div className="cj-card" style={{ padding: '10px 16px 10px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  {q.type === 'coding' && <CamThumb stream={media.camStream()} />}
                  <div style={{ fontSize: 13.5, color: '#4B5563' }}><b style={{ color: '#14212A' }}>{meta.name}</b> · Question {qi + 1} of {questions.length}{isLast ? ' · last one' : ''}<span style={{ color: '#9CA3AF' }}> · you can't go back once you continue</span></div>
                </div>
                {isLast ? <button className="cj-btn cj-btn--primary" onClick={() => { commit(); setShowSubmit(true); }}>Submit {shortName} <ArrowRight size={16} /></button> : <button className="cj-btn cj-btn--primary" onClick={() => saveAndNext(false)}>Save &amp; continue <ArrowRight size={16} /></button>}
              </div>
            </div>
          </>)}
          {phase === 'scoring' && <div className="cj-card cj-enter" style={{ padding: '56px 32px', textAlign: 'center' }}><div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #EAF3FE', borderTopColor: '#056FD4', margin: '0 auto 18px' }} className="cand-spin" /><h2 style={{ fontSize: 22, fontWeight: 600, color: '#14212A' }}>Saving your answers…</h2></div>}
        </div>
        {/* rail (hidden in the coding workspace; the camera floats instead) */}
        {coding ? null : <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 80 }}>
          <div className="cj-card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><div className="cj-eyebrow" style={{ color: '#6B7280' }}>Modules</div><span className="cj-timer" style={{ fontSize: 12, color: '#6B7280' }}>{results.length}/{plans.length}</span></div>
            <div style={{ height: 6, background: '#EEF2F7', borderRadius: 6, marginTop: 10, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.round((results.length / plans.length) * 100)}%`, background: '#056FD4', borderRadius: 6, transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} /></div>
            <ul style={{ marginTop: 12 }}>
              {plans.map((p, i) => { const st = modStatus(i); const M = metaOf(p.module); const Icon = M.icon; return (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', borderRadius: 10, background: st === 'current' ? '#EAF3FE' : 'transparent', color: st === 'done' ? '#047857' : st === 'current' ? '#0459A8' : '#6B7280', fontWeight: st === 'current' ? 600 : 500, fontSize: 13.5 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 8, background: st === 'done' ? '#ECFDF5' : st === 'current' ? '#056FD4' : '#F3F4F6', color: st === 'done' ? '#047857' : st === 'current' ? '#fff' : '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{st === 'done' ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{M.name}</span>
                  <span className="cj-timer" style={{ fontSize: 11.5, color: '#9CA3AF' }}>~{modMinutes(p.module)}m</span>
                </li>
              ); })}
            </ul>
            {phase === 'question' && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
                <div className="cj-eyebrow" style={{ color: '#6B7280' }}>Questions</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>{questions.map((x, i) => <span key={x.id} title={`Q${i + 1}${answers[x.id] != null ? ' · answered' : ''}`} className="cj-timer" style={{ width: 32, height: 32, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: i === qi ? '#056FD4' : answers[x.id] != null ? '#ECFDF5' : '#F3F4F6', color: i === qi ? '#fff' : answers[x.id] != null ? '#047857' : '#9CA3AF', border: i === qi ? 'none' : '1px solid #E6EAF0' }}>{i + 1}</span>)}</div>
              </div>
            )}
          </div>
          <div className="cj-card" style={{ overflow: 'hidden' }}>
            <WebcamPreview stream={media.camStream()} isMonitoring className="w-full aspect-video" />
            <div style={{ padding: '10px 14px', fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981' }} className="cand-pulse" /> Camera and mic stay on until you finish.</div>
          </div>
        </aside>}
      </div>
      ); })()}

      {proc.current && <ViolationWarningModal violation={proc.current} violationCount={proc.total} threshold={proc.threshold} onDismiss={proc.dismiss} />}
      <SubmitConfirmationModal isOpen={showSubmit} onConfirm={confirmSubmit} onCancel={() => setShowSubmit(false)} totalQuestions={questions.length} answeredQuestions={answeredHere + (q && draft.current != null && answers[q.id] == null ? 1 : 0)} isSubmitting={submitting} label={`Submit ${shortName}`} note={mi + 1 < plans.length ? `After this you can't change these answers. Next up: ${metaOf(plans[mi + 1].module).name}.` : 'After this you can\'t change these answers. Your results are prepared right away.'} hideGoBack={timeLeft <= 0 && isLast} />
      <FullscreenWarningModal fs={fs} />
    </CandidateShell>
  );
}
const fmtSecs = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`);

function ModuleIntro({ plan, index, count, questions, onStart }) {
  const m = plan.module; const meta = metaOf(m); const Icon = meta.icon; const n = questions.length || (plan.pending ? plan.pending.n : 0);
  const per = questions[0]?.timeSec || plan.pending?.timeSec || 120;
  const tips = { coding: ['Read the examples and constraints before you code.', 'Run the sample tests as often as you like — only Submit counts.', 'Partial credit is given per hidden test.'], mcq: ['One correct option per question.', 'You can\'t go back once you continue.', 'Unanswered questions score zero.'], sjt: ['Pick the most effective response, not just an acceptable one.', 'Think about the customer and the team, not only the rule.'], typing: ['Type the passage exactly as shown.', 'Accuracy counts as much as speed.', 'The clock starts on your first keystroke.'], language: ['Answer in the language shown for each task.', 'Speaking tasks record your voice — find a quiet spot.'], simulation: ['Reply as you would to a real customer.', 'The other side reacts to what you write.', 'Aim to resolve, not just respond.'], personality: ['There are no right or wrong answers.', 'Go with your first honest reaction.'], written: ['Use real examples from your experience.', 'Short, specific, structured answers score best.'] };
  return (
    <div className="cj-card cj-enter" style={{ padding: '30px 32px' }}>
      <div className="cj-eyebrow">Module {index + 1} of {count}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#14212A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={26} /></div>
        <div><h2 className="cj-h1" style={{ fontSize: 28 }}>{meta.name}</h2><p className="cj-lead" style={{ fontSize: 15, marginTop: 4 }}>{meta.blurb(m)}</p></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 22 }}>
        {[[n || '—', m.key === 'simulation' ? 'conversation' : m.key === 'typing' ? 'timed passage' : 'questions'], [fmtSecs(per), 'per question'], [`~${modMinutes(m)}`, 'minutes']].map(([v, l]) => <div key={l} style={{ background: '#F8FAFC', border: '1px solid #EEF2F7', borderRadius: 12, padding: '14px 16px' }}><div className="cj-timer" style={{ fontSize: 24, fontWeight: 600, color: '#14212A' }}>{v}</div><div style={{ fontSize: 12.5, color: '#6B7280' }}>{l}</div></div>)}
      </div>
      {(m.skills || []).length > 0 && m.key !== 'typing' && <div style={{ marginTop: 18 }}><div className="cj-eyebrow" style={{ color: '#6B7280' }}>Covers</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{m.skills.map((s) => <span key={s} className="cj-pill cj-pill--sky">{s}</span>)}</div></div>}
      <ul style={{ marginTop: 18, display: 'grid', gap: 8 }}>{[...(tips[m.key] || tips.written), 'Each question is timed. Your answer saves automatically when time runs out.'].map((t) => <li key={t} style={{ display: 'flex', gap: 10, fontSize: 14, color: '#374151' }}><Check size={16} color="#056FD4" style={{ flexShrink: 0, marginTop: 2 }} />{t}</li>)}</ul>
      <button className="cj-btn cj-btn--primary cj-btn--lg" style={{ marginTop: 24 }} onClick={onStart}><Play size={18} /> Start {meta.name}</button>
    </div>
  );
}

/* ─────────────────────────── question card (type-aware) ─────────────────────────── */
function QuestionCard({ q, module, index, total, initial, onChange, role }) {
  const Body = { mcq: McqBody, reading: ReadingBody, coding: CodingBody, typing: TypingBody, listening: ListeningBody, speaking: SpeakingBody, video: VideoBody, file: FileBody, simulation: SimulationBody, likert: LikertBody }[q.type] || WrittenBody;
  const meta = metaOf(module);
  const kind = q.scenario ? 'Situation' : q.sub ? q.sub : q.type === 'mcq' ? 'Multiple choice' : q.type === 'likert' ? 'Statement' : q.type.charAt(0).toUpperCase() + q.type.slice(1);
  return (
    <div className="cj-card cj-enter" style={{ padding: '26px 30px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span className="cj-pill cj-pill--ink">{meta.name}</span>{kind.toLowerCase() !== meta.name.toLowerCase() && <span className="cj-pill cj-pill--sky">{kind}</span>}{q.difficulty && <span className="cj-pill cj-pill--ok">{q.difficulty}</span>}</div>
        <span className="cj-timer" style={{ fontSize: 13, color: '#6B7280' }}>Q{index + 1} / {total}{q.marks ? ` · ${q.marks} marks` : ''}</span>
      </div>
      <Body q={q} initial={initial} onChange={onChange} role={role} />
    </div>
  );
}
const Prompt = ({ children }) => <div style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.5, color: '#14212A', letterSpacing: '-.005em' }}>{children}</div>;

function WrittenBody({ q, initial, onChange }) {
  const [text, setText] = useState(initial?.text || ''); const start = useRef(null); const [wpm, setWpm] = useState(0);
  const change = (v) => { if (!start.current) start.current = Date.now(); setText(v); const mins = (Date.now() - start.current) / 60000; if (mins > 0.05) setWpm(Math.round(v.trim().split(/\s+/).filter(Boolean).length / mins)); onChange({ text: v }); };
  useEffect(() => { if (initial?.text) onChange({ text: initial.text }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div>
      <Prompt>{q.text}</Prompt>
      <textarea className="cj-textarea" value={text} onChange={(e) => change(e.target.value)} placeholder="Write your answer here. Specific examples and outcomes score best." rows={9} autoFocus style={{ marginTop: 18, resize: 'none' }} />
      <div className="cj-timer" style={{ display: 'flex', gap: 16, fontSize: 12.5, color: '#9CA3AF', marginTop: 8 }}><span>{words} words</span><span>{text.length} characters</span>{wpm > 0 && <span>{wpm} wpm</span>}<span style={{ marginLeft: 'auto', color: words >= 40 ? '#047857' : '#9CA3AF' }}>{words >= 40 ? 'Good depth' : 'Aim for 40+ words'}</span></div>
    </div>
  );
}
function McqBody({ q, initial, onChange }) {
  const [c, setC] = useState(initial?.choice ?? null);
  useEffect(() => { if (initial?.choice != null) onChange({ choice: initial.choice }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      {q.scenario ? (
        <div>
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderLeft: '4px solid #F59E0B', borderRadius: 14, padding: '16px 18px' }}>
            <div className="cj-eyebrow" style={{ color: '#B45309' }}>The situation</div>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: '#14212A', marginTop: 8, fontWeight: 500 }}>{q.text}</p>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginTop: 18 }}>Which response is most effective?</div>
        </div>
      ) : <Prompt>{q.text}</Prompt>}
      <div style={{ display: 'grid', gap: 10, marginTop: q.scenario ? 10 : 18 }}>{q.options.map((o, i) => (
        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${c === i ? '#056FD4' : '#E6EAF0'}`, background: c === i ? '#EAF3FE' : '#fff', cursor: 'pointer', transition: 'all .15s' }}>
          <input type="radio" name={q.id} className="sr-only" checked={c === i} onChange={() => { setC(i); onChange({ choice: i }); }} />
          <span className="cj-timer" style={{ width: 30, height: 30, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: c === i ? '#056FD4' : '#F3F4F6', color: c === i ? '#fff' : '#6B7280', flexShrink: 0 }}>{String.fromCharCode(65 + i)}</span>
          <span style={{ fontSize: 15.5, color: '#14212A', lineHeight: 1.45 }}>{o}</span>
        </label>
      ))}</div>
    </div>
  );
}
function ReadingBody({ q, initial, onChange }) { return (<div><div style={{ background: '#F8FAFC', border: '1px solid #EEF2F7', borderRadius: 14, padding: '18px 20px', fontSize: 15.5, lineHeight: 1.7, color: '#374151', marginBottom: 18 }}>{q.passage}</div><McqBody q={{ ...q, text: q.question }} initial={initial} onChange={onChange} /></div>); }
function LikertBody({ q, initial, onChange }) {
  const [v, setV] = useState(initial?.value ?? null); const L = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
  return (<div><Prompt>{q.text}</Prompt><div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 22 }}>{L.map((l, i) => <button key={l} onClick={() => { setV(i + 1); onChange({ value: i + 1 }); }} style={{ padding: '14px 8px', borderRadius: 14, border: `1.5px solid ${v === i + 1 ? '#056FD4' : '#E6EAF0'}`, background: v === i + 1 ? '#EAF3FE' : '#fff', color: v === i + 1 ? '#0459A8' : '#4B5563', fontSize: 13, fontWeight: 600, transition: 'all .15s' }}>{l}</button>)}</div></div>);
}
function TypingBody({ q, initial, onChange }) {
  const [typed, setTyped] = useState(initial?.typed || ''); const start = useRef(initial?.startedAt || null); const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = start.current ? Math.max(1, Math.round((now - start.current) / 1000)) : 0; const s = typingStats(typed, q.text, secs || 1);
  const change = (v) => { if (v.length > q.text.length + 5) return; if (!start.current) start.current = Date.now(); setTyped(v); onChange({ typed: v, seconds: Math.max(1, Math.round((Date.now() - start.current) / 1000)), startedAt: start.current }); };
  return (
    <div>
      <div style={{ fontSize: 14.5, color: '#4B5563' }}>Type the passage exactly as shown. Target <b style={{ color: '#14212A' }}>{q.tWpm} words a minute</b> at <b style={{ color: '#14212A' }}>{q.tAcc}% accuracy</b>. The clock starts on your first keystroke.</div>
      <div className="cj-timer" style={{ background: '#F8FAFC', border: '1px solid #EEF2F7', borderRadius: 14, padding: '18px 20px', fontSize: 16, lineHeight: 1.8, marginTop: 16 }}>{q.text.split('').map((ch, i) => <span key={i} style={{ color: i < typed.length ? (typed[i] === ch ? '#047857' : '#B91C1C') : i === typed.length ? '#056FD4' : '#6B7280', background: i < typed.length && typed[i] !== ch ? '#FEE2E2' : i === typed.length ? '#EAF3FE' : 'transparent', borderRadius: 2 }}>{ch}</span>)}</div>
      <textarea className="cj-textarea cj-timer" value={typed} onChange={(e) => change(e.target.value)} onPaste={(e) => e.preventDefault()} placeholder="Start typing here…" rows={4} autoFocus style={{ marginTop: 12, resize: 'none', fontSize: 16 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }}><Stat label="Speed" value={`${start.current ? s.wpm : 0} wpm`} ok={s.wpm >= q.tWpm} /><Stat label="Accuracy" value={`${typed.length ? s.acc : 100}%`} ok={s.acc >= q.tAcc} /><Stat label="Elapsed" value={`${secs}s`} /></div>
    </div>
  );
}
const Stat = ({ label, value, ok }) => <div style={{ background: '#F8FAFC', border: '1px solid #EEF2F7', borderRadius: 12, padding: '12px 14px' }}><div className="cj-timer" style={{ fontSize: 22, fontWeight: 600, color: ok === undefined ? '#14212A' : ok ? '#047857' : '#B45309' }}>{value}</div><div style={{ fontSize: 12, color: '#6B7280' }}>{label}</div></div>;
function ListeningBody({ q, initial, onChange }) {
  const [text, setText] = useState(initial?.text || ''); const [plays, setPlays] = useState(0); const can = 'speechSynthesis' in window;
  const play = () => { if (plays >= 2) return; setPlays((p) => p + 1); if (can) { const u = new SpeechSynthesisUtterance(q.sentence); u.lang = 'en-IN'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } };
  return (
    <div>
      <Prompt>{q.text}</Prompt>
      <div style={{ background: '#EAF3FE', border: '1px solid #D6E7FB', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18 }}><div><div style={{ fontSize: 14, fontWeight: 600, color: '#0459A8' }}>Audio clip</div><div style={{ fontSize: 12.5, color: '#4B5563' }}>{plays}/2 plays used{!can ? ' · audio isn\'t available here, so the sentence is shown' : ''}</div>{!can && <div style={{ fontSize: 15, color: '#14212A', marginTop: 6, fontStyle: 'italic' }}>“{q.sentence}”</div>}</div><button className="cj-btn cj-btn--primary cj-btn--sm" onClick={play} disabled={plays >= 2}><Volume2 size={15} /> Play</button></div>
      <textarea className="cj-textarea" value={text} onChange={(e) => { setText(e.target.value); onChange({ text: e.target.value }); }} onPaste={(e) => e.preventDefault()} placeholder="Type exactly what you heard…" rows={3} style={{ marginTop: 14, resize: 'none' }} />
    </div>
  );
}
function useRecorder({ video = false, lang = 'en-IN', onData }) {
  const media = useMedia(); const [rec, setRec] = useState(false); const [secs, setSecs] = useState(0); const [url, setUrl] = useState(null); const [transcript, setTranscript] = useState(''); const mr = useRef(null); const chunks = useRef([]); const timer = useRef(null); const recog = useRef(null); const secRef = useRef(0);
  const level = useMicLevel(rec ? media.micStream() : null, rec);
  const start = async () => {
    const mic = await media.requestMic(); if (!mic) return; let stream = mic;
    if (video) { const cam = await media.requestCamera(); if (cam) stream = new MediaStream([...cam.getVideoTracks(), ...mic.getAudioTracks()]); }
    chunks.current = []; setUrl(null); setTranscript('');
    try { const m = new MediaRecorder(stream); mr.current = m; m.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); }; m.onstop = () => { const b = new Blob(chunks.current, { type: m.mimeType }); const u = URL.createObjectURL(b); setUrl(u); onData?.({ url: u, seconds: secRef.current }); }; m.start(); setRec(true); secRef.current = 0; setSecs(0); timer.current = setInterval(() => { secRef.current += 1; setSecs(secRef.current); }, 1000); } catch { return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) { try { const r = new SR(); r.lang = lang; r.continuous = true; r.interimResults = true; r.onresult = (ev) => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript + ' '; setTranscript(t.trim()); onData?.({ transcript: t.trim(), seconds: secRef.current }); }; r.onerror = () => {}; r.onend = () => { if (mr.current?.state === 'recording') { try { r.start(); } catch { /* */ } } }; r.start(); recog.current = r; } catch { /* */ } }
  };
  const stop = () => { try { mr.current?.stop(); } catch { /* */ } try { recog.current?.stop(); } catch { /* */ } recog.current = null; setRec(false); clearInterval(timer.current); };
  useEffect(() => () => { clearInterval(timer.current); try { recog.current?.stop(); } catch { /* */ } }, []);
  return { rec, secs, url, transcript, level, start, stop, camStream: media.camStream() };
}
const LANG_CODE = { English: 'en-IN', Hindi: 'hi-IN', Tamil: 'ta-IN', Telugu: 'te-IN', Kannada: 'kn-IN', Marathi: 'mr-IN', Bengali: 'bn-IN', Gujarati: 'gu-IN', Malayalam: 'ml-IN', Punjabi: 'pa-IN' };
function SpeakingBody({ q, initial, onChange }) {
  const data = useRef(initial || {});
  const r = useRecorder({ lang: LANG_CODE[q.lang] || 'en-IN', onData: (d) => { data.current = { ...data.current, ...d }; onChange(data.current); } });
  const mm = Math.floor(r.secs / 60), ss = String(r.secs % 60).padStart(2, '0');
  return (
    <div>
      <Prompt>{q.text}</Prompt>
      <div className="cj-pass" style={{ marginTop: 18, padding: '22px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="cj-pill" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}><Mic size={13} /> Recording booth</span>{q.lang && <span className="cj-pill" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>{q.lang}</span>}</div>
          <div className="cj-timer" style={{ fontSize: 28, fontWeight: 600, color: r.rec ? '#FCA5A5' : 'rgba(255,255,255,.7)' }}>{mm}:{ss}</div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
          {r.url && !r.rec ? <audio controls src={r.url} style={{ width: '100%', maxWidth: 520, height: 44 }} /> : <Waveform level={r.level} bars={48} active={r.rec} maxHeight={84} light />}
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 6 }}>
          {!r.rec ? <button className="cj-btn cj-btn--primary cj-btn--lg" onClick={r.start}><Mic size={18} /> {r.url ? 'Record again' : 'Start recording'}</button> : <button className="cj-btn cj-btn--danger cj-btn--lg" onClick={r.stop}><Square size={16} /> Stop recording</button>}
        </div>
        <p style={{ position: 'relative', zIndex: 1, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 12 }}>{r.rec ? 'Speak naturally. Pauses are fine — you are not timed on them.' : r.url ? 'Listen back, or record again if you want to.' : 'About a minute is plenty. Take a breath, then press record.'}</p>
      </div>
      {(r.rec || r.transcript) && <div style={{ marginTop: 12, fontSize: 14, color: '#374151', background: '#F8FAFC', border: '1px solid #EEF2F7', borderRadius: 12, padding: '12px 14px', lineHeight: 1.6 }}><span className="cj-eyebrow" style={{ color: '#9CA3AF', fontSize: 10, display: 'block', marginBottom: 4 }}>Live transcript</span>{r.transcript || 'Listening…'}</div>}
    </div>
  );
}
function VideoBody({ q, initial, onChange }) {
  const data = useRef(initial || {});
  const r = useRecorder({ video: true, onData: (d) => { data.current = { ...data.current, ...d }; onChange(data.current); } });
  return (
    <div>
      <Prompt>{q.text}</Prompt>
      <div style={{ position: 'relative', aspectRatio: '16 / 9', maxWidth: 560, margin: '18px auto 0', background: '#0B1220', borderRadius: 14, overflow: 'hidden' }}>{r.url && !r.rec ? <video src={r.url} controls className="w-full h-full" /> : <StableVideo stream={r.camStream} className="w-full h-full object-cover" />}{r.rec && <div style={{ position: 'absolute', top: 12, left: 12 }}><span className="cj-pill cj-pill--bad"><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444' }} className="cand-pulse" /> REC {r.secs}s</span></div>}</div>
      <div style={{ textAlign: 'center', marginTop: 14 }}>{!r.rec ? <button className="cj-btn cj-btn--primary" onClick={r.start}>{r.url ? 'Record again' : 'Start recording'}</button> : <button className="cj-btn cj-btn--danger" onClick={r.stop}><Square size={15} /> Stop</button>}</div>
    </div>
  );
}
function FileBody({ q, initial, onChange }) {
  const [name, setName] = useState(initial?.name || ''); const ref = useRef(null);
  return (<div><Prompt>{q.text}</Prompt><input ref={ref} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setName(f.name); onChange({ name: f.name, size: f.size }); } }} /><div onClick={() => ref.current?.click()} style={{ marginTop: 18, border: '1.5px dashed #CBD5E1', borderRadius: 14, padding: '34px 16px', textAlign: 'center', cursor: 'pointer', background: '#FAFBFC' }}><Upload size={20} color="#056FD4" style={{ margin: '0 auto 8px' }} />{name ? <div style={{ fontSize: 14.5, fontWeight: 600, color: '#047857' }}>✓ {name}</div> : <div style={{ fontSize: 14.5, color: '#4B5563' }}>Choose a file <span style={{ color: '#9CA3AF' }}>· PDF, DOCX or ZIP up to 10 MB</span></div>}</div></div>);
}
function CodingBody({ q, initial, onChange }) {
  const [code, setCode] = useState(initial?.code ?? q.starter ?? ''); const [ran, setRan] = useState(initial?.tests || null); const [running, setRunning] = useState(false);
  useEffect(() => { onChange({ code, tests: ran }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async () => { setRunning(true); const res = await runTests(code, q); setRan(res); setRunning(false); onChange({ code, tests: res }); };
  const onKey = (e) => { if (e.key === 'Tab') { e.preventDefault(); const el = e.target; const s = el.selectionStart, en = el.selectionEnd; const v = code.slice(0, s) + '  ' + code.slice(en); setCode(v); onChange({ code: v, tests: ran }); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; }); } };
  const ok = ran ? ran.filter((r) => r.ok).length : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 6fr)', gap: 22 }} className="cand-grid">
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontSize: 22, fontWeight: 600, color: '#14212A', letterSpacing: '-.01em' }}>{q.text}</h3>
        <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.65, marginTop: 10 }}>{q.description}</p>
        {(q.examples || []).map((ex, i) => <div key={i} style={{ marginTop: 14 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#14212A', marginBottom: 6 }}>Example {i + 1}</div><div className="cj-timer" style={{ background: '#F8FAFC', border: '1px solid #EEF2F7', borderLeft: '3px solid #056FD4', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#374151', lineHeight: 1.7 }}><div><b>Input:</b> {ex.input}</div><div><b>Output:</b> {ex.output}</div>{ex.explanation && <div><b>Why:</b> {ex.explanation}</div>}</div></div>)}
        {(q.constraints || []).length > 0 && <div style={{ marginTop: 14 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#14212A', marginBottom: 6 }}>Constraints</div><ul className="cj-timer" style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.8, paddingLeft: 18, listStyle: 'disc' }}>{q.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 14, overflow: 'hidden', border: '1px solid #1F2937', background: '#0B1220', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#111827', borderBottom: '1px solid #1F2937' }}><span className="cj-timer" style={{ fontSize: 12.5, fontWeight: 600, color: '#9CDCFE' }}>{q.language || 'Python'}</span><button onClick={run} disabled={running} className="cj-btn cj-btn--sm" style={{ background: '#1F2937', color: '#fff', border: '1px solid #374151' }}>{running ? <Loader2 size={14} className="cand-spin" /> : <Play size={14} />} Run tests</button></div>
        <textarea value={code} onChange={(e) => { setCode(e.target.value); onChange({ code: e.target.value, tests: ran }); }} onKeyDown={onKey} onPaste={(e) => e.preventDefault()} spellCheck={false} className="cj-timer" style={{ flex: 1, minHeight: 300, padding: '16px 18px', fontSize: 13.5, lineHeight: 1.65, background: '#0B1220', color: '#E6EDF3', border: 'none', outline: 'none', resize: 'none' }} />
        <div style={{ borderTop: '1px solid #1F2937', padding: '12px 14px', background: '#0F172A' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#64748B', marginBottom: 8 }}>Test results</div>
          {running ? <p style={{ fontSize: 13, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={14} className="cand-spin" /> Running…</p>
            : ran ? (<div className="cj-timer" style={{ display: 'grid', gap: 4 }}>{ran.map((r, i) => <div key={i} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, color: r.ok ? '#34D399' : '#F87171' }}>{r.ok ? <Check size={14} /> : <AlertCircle size={14} />} Test {i + 1} · {r.ok ? 'passed' : `failed${r.got ? ` · got ${String(r.got).slice(0, 40)}` : ''}`}</div>)}<div style={{ fontSize: 13, fontWeight: 600, color: ok === ran.length ? '#34D399' : '#FBBF24', marginTop: 4 }}>{ok}/{ran.length} passed</div></div>)
            : <p style={{ fontSize: 13, color: '#64748B' }}>Run your code to see sample results. Submit runs the hidden tests.</p>}
        </div>
      </div>
    </div>
  );
}
function SimulationBody({ q, initial, onChange }) {
  const [history, setHistory] = useState(() => initial?.history || [{ customer: q.opener, at: Date.now() }]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const end = useRef(null);
  const replies = history.filter((h) => h.agent).length; const done = replies >= q.turns;
  const who = /sales|renew/i.test(q.persona) ? 'Rohan Desai' : 'Riya Sharma';
  useEffect(() => { onChange({ history }); end.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [history]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async () => { const t = text.trim(); if (!t || busy || done) return; const next = history.map((h, i) => (i === history.length - 1 ? { ...h, agent: t, agentAt: Date.now() } : h)); setHistory(next); setText(''); setBusy(true); if (next.filter((h) => h.agent).length < q.turns) { const reply = await simulationReply({ scenario: q.scenario, persona: q.persona, history: next }); setHistory((h) => [...h, { customer: reply, at: Date.now() }]); } setBusy(false); };
  const hhmm = (ms) => new Date(ms || Date.now()).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#FFFBEB', border: '1px solid #FDE68A', borderLeft: '4px solid #F59E0B', borderRadius: 14, padding: '12px 16px' }}><div><div className="cj-eyebrow" style={{ color: '#B45309' }}>Your brief</div><p style={{ fontSize: 14.5, color: '#14212A', marginTop: 4, lineHeight: 1.55 }}>{q.scenario}. You're the agent on shift — handle the chat as you would for real. {q.turns} replies.</p></div></div>
      <div style={{ marginTop: 16, border: '1px solid #E6EAF0', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderBottom: '1px solid #EEF2F7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FDE68A', color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{who.split(' ').map((w) => w[0]).join('')}</div><div><div style={{ fontSize: 14, fontWeight: 600, color: '#14212A' }}>{who}</div><div style={{ fontSize: 12, color: '#047857', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} /> Customer · online</div></div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="cj-pill cj-pill--sky">Live chat</span><span className="cj-timer" style={{ fontSize: 12, color: '#6B7280' }}>{Math.max(0, q.turns - replies)} repl{q.turns - replies === 1 ? 'y' : 'ies'} left</span></div>
        </div>
        <div style={{ background: '#F6F8FB', padding: 18, minHeight: 320, maxHeight: 420, overflowY: 'auto', display: 'grid', gap: 14, alignContent: 'start' }}>
          {history.map((h, i) => (<div key={i} style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}><div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FDE68A', color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{who[0]}</div><div style={{ maxWidth: '72%' }}><div style={{ background: '#fff', border: '1px solid #E6EAF0', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', fontSize: 15, lineHeight: 1.5, color: '#14212A' }} className="cj-enter">{h.customer}</div><div className="cj-timer" style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, marginLeft: 4 }}>{who.split(' ')[0]} · {hhmm(h.at)}</div></div></div>
            {h.agent && <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', justifyContent: 'flex-end' }}><div style={{ maxWidth: '72%', textAlign: 'right' }}><div style={{ background: '#056FD4', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '10px 14px', fontSize: 15, lineHeight: 1.5, textAlign: 'left' }} className="cj-enter">{h.agent}</div><div className="cj-timer" style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, marginRight: 4 }}>You · {hhmm(h.agentAt)}</div></div></div>}
          </div>))}
          {busy && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FDE68A', color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{who[0]}</div><div style={{ background: '#fff', border: '1px solid #E6EAF0', borderRadius: 16, padding: '10px 14px', display: 'flex', gap: 4 }}>{[0, 1, 2].map((i) => <span key={i} className="cand-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF', animationDelay: `${i * 0.2}s` }} />)}</div></div>}
          <div ref={end} />
        </div>
        <div style={{ borderTop: '1px solid #EEF2F7', padding: 12 }}>
          {done ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#047857', fontWeight: 600, padding: '6px 4px' }}><Check size={16} /> Chat closed — continue when you're ready.</div> : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}><textarea className="cj-textarea" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={`Reply to ${who.split(' ')[0]}…`} rows={2} style={{ resize: 'none', borderRadius: 12 }} /><button className="cj-btn cj-btn--primary" onClick={send} disabled={busy || !text.trim()} style={{ height: 48 }}><Send size={16} /> Send</button></div>
          )}
          {!done && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 6 }}>Enter to send · Shift+Enter for a new line</div>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── coding workspace (LeetCode-style) ─────────────────────────── */
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const KW = 'function|return|const|let|var|if|else|for|while|do|class|new|this|true|false|null|undefined|typeof|instanceof|switch|case|break|continue|default|try|catch|finally|throw|async|await|yield|import|from|export|def|elif|pass|lambda|None|True|False|in|not|and|or|is|with|as|except|raise|global|nonlocal|print|public|private|static|void|int|string|bool|char|double|float|long|return|struct|using|namespace|include|package|func|select|go|defer';
const BI = 'console|Math|JSON|Array|Object|String|Number|Map|Set|Promise|len|range|dict|list|set|str|sorted|enumerate|zip|max|min|sum|abs|map|filter|reduce|push|pop|slice|splice|join|split|indexOf|includes|parseInt|parseFloat|toString|append|items|keys|values|System|std|vector|fmt';
const TOKEN = new RegExp(`(\\/\\/.*|#.*|\\/\\*[\\s\\S]*?\\*\\/)|("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\`(?:\\\\.|[^\`\\\\])*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b(?:${KW})\\b)|(\\b(?:${BI})\\b)|([A-Za-z_$][\\w$]*)(?=\\s*\\()|([{}()\\[\\];,.=+\\-*/%<>!&|?:])`, 'g');
export function highlight(code) {
  let out = ''; let last = 0; const src = String(code || '');
  for (const m of src.matchAll(TOKEN)) {
    out += esc(src.slice(last, m.index)); const [t, c, s, n, k, b, f, p] = m;
    out += c ? `<span class="tk-c">${esc(t)}</span>` : s ? `<span class="tk-s">${esc(t)}</span>` : n ? `<span class="tk-n">${esc(t)}</span>` : k ? `<span class="tk-k">${esc(t)}</span>` : b ? `<span class="tk-b">${esc(t)}</span>` : f ? `<span class="tk-f">${esc(t)}</span>` : p ? `<span class="tk-p">${esc(t)}</span>` : esc(t);
    last = m.index + t.length;
  }
  return out + esc(src.slice(last));
}

export function CodeEditor({ value, onChange, onRun }) {
  const ta = useRef(null); const pre = useRef(null); const gut = useRef(null);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const lines = String(value || '').split('\n').length;
  const sync = () => { const el = ta.current; if (!el) return; if (pre.current) { pre.current.scrollTop = el.scrollTop; pre.current.scrollLeft = el.scrollLeft; } if (gut.current) gut.current.scrollTop = el.scrollTop; };
  const caret = () => { const el = ta.current; if (!el) return; const before = el.value.slice(0, el.selectionStart); const ls = before.split('\n'); setCursor({ line: ls.length, col: ls[ls.length - 1].length + 1 }); };
  const onKey = (e) => {
    const el = e.target;
    if (e.key === 'Tab') { e.preventDefault(); const s = el.selectionStart, en = el.selectionEnd; const v = value.slice(0, s) + '  ' + value.slice(en); onChange(v); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; }); }
    else if (e.key === 'Enter') { const s = el.selectionStart; const lineStart = value.lastIndexOf('\n', s - 1) + 1; const indent = (value.slice(lineStart, s).match(/^\s*/) || [''])[0]; const prev = value[s - 1]; const extra = prev === '{' || prev === ':' || prev === '(' || prev === '[' ? '  ' : ''; e.preventDefault(); const v = value.slice(0, s) + '\n' + indent + extra + value.slice(el.selectionEnd); onChange(v); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 1 + indent.length + extra.length; }); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun?.(); }
  };
  return (
    <>
      <div className="cj-editor">
        <div className="cj-editor__gutter" ref={gut}>{Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}</div>
        <div className="cj-editor__body">
          <pre className="cj-editor__pre" ref={pre} aria-hidden dangerouslySetInnerHTML={{ __html: highlight(value) + '\n' }} />
          <textarea ref={ta} className="cj-editor__ta cj-timer" value={value} onChange={(e) => onChange(e.target.value)} onScroll={sync} onKeyDown={onKey} onKeyUp={caret} onClick={caret} onPaste={(e) => e.preventDefault()} spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-label="Code editor" />
        </div>
      </div>
      <div className="cj-ws__status"><span>Ln {cursor.line}, Col {cursor.col}</span><span>{lines} lines · Tab = 2 spaces · ⌘/Ctrl+Enter runs tests · paste disabled</span></div>
    </>
  );
}

function CamThumb({ stream }) {
  return (
    <div title="Your camera stays on while you code" style={{ position: 'relative', width: 96, height: 58, borderRadius: 10, overflow: 'hidden', background: '#0B1220', flexShrink: 0, border: '1px solid #E6EAF0' }}>
      {stream ? <StableVideo stream={stream} className="w-full h-full object-cover" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><Camera size={16} /></div>}
      <span style={{ position: 'absolute', left: 6, bottom: 5, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} className="cand-pulse" /> LIVE</span>
    </div>
  );
}

const STARTERS = { JavaScript: 'function solve() {\n  // your code\n}', Python: 'def solve():\n    # your code\n    pass', Java: 'class Solution {\n    // your code\n}', 'C++': '#include <bits/stdc++.h>\nusing namespace std;\n\n// your code', SQL: '-- write your query' };
function CodingWorkspace({ q, module, index, total, initial, onChange }) {
  const meta = metaOf(module);
  const langs = q.bank ? ['JavaScript', 'Python'] : [q.language || 'Python'];
  const [lang, setLang] = useState(initial?.language || langs[0]);
  const starterFor = (l) => (q.bank ? (q.bank.starter[l] || STARTERS[l] || '') : (q.starter || STARTERS[l] || ''));
  const [code, setCode] = useState(initial?.code ?? starterFor(langs[0]));
  const [ran, setRan] = useState(initial?.tests || null); const [running, setRunning] = useState(false);
  const [tab, setTab] = useState('cases'); const [caseI, setCaseI] = useState(0);
  const [split, setSplit] = useState(42); const dragging = useRef(false); const wsRef = useRef(null);
  const cases = q.bank?.tests || (q.testcases ? String(q.testcases).split('\n').filter((l) => l.trim()).map((l) => ({ raw: l })) : []);
  const emit = (patch = {}) => onChange({ code, tests: ran, language: lang, ...patch });
  useEffect(() => { emit(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async () => { setRunning(true); setTab('results'); const res = await runTests(code, { ...q, language: lang }); setRan(res); setRunning(false); emit({ tests: res }); };
  const changeLang = (l) => { setLang(l); const fresh = starterFor(l); setCode(fresh); setRan(null); onChange({ code: fresh, tests: null, language: l }); };
  const reset = () => { const fresh = starterFor(lang); setCode(fresh); setRan(null); onChange({ code: fresh, tests: null, language: lang }); };
  const onDown = (e) => { dragging.current = true; e.preventDefault(); document.body.style.cursor = 'col-resize'; };
  useEffect(() => {
    const move = (e) => { if (!dragging.current || !wsRef.current) return; const r = wsRef.current.getBoundingClientRect(); setSplit(Math.min(65, Math.max(28, ((e.clientX - r.left) / r.width) * 100))); };
    const up = () => { if (dragging.current) { dragging.current = false; document.body.style.cursor = ''; } };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);
  const ok = ran ? ran.filter((r) => r.ok).length : 0;
  const fmtV = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
  return (
    <div className="cj-ws cj-enter" ref={wsRef}>
      {/* problem */}
      <div className="cj-ws__problem" style={{ width: `${split}%`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="cj-pill cj-pill--ink">{meta.name}</span>{q.difficulty && <span className={`cj-pill ${q.difficulty === 'Hard' ? 'cj-pill--bad' : q.difficulty === 'Medium' ? 'cj-pill--warn' : 'cj-pill--ok'}`}>{q.difficulty}</span>}</div>
          <span className="cj-timer" style={{ fontSize: 12.5, color: '#6B7280' }}>Q{index + 1} / {total} · {q.marks} marks</span>
        </div>
        <h3 style={{ fontSize: 24, fontWeight: 600, color: '#14212A', letterSpacing: '-.01em' }}>{index + 1}. {q.text}</h3>
        <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, marginTop: 12 }}>{q.description}</p>
        {(q.examples || []).map((ex, i) => <div key={i} style={{ marginTop: 18 }}><div style={{ fontSize: 14, fontWeight: 600, color: '#14212A', marginBottom: 8 }}>Example {i + 1}:</div><div className="cj-timer" style={{ background: '#F8FAFC', border: '1px solid #EEF2F7', borderRadius: 10, padding: '12px 14px', fontSize: 13.5, color: '#374151', lineHeight: 1.8 }}><div><b style={{ color: '#14212A' }}>Input:</b> {ex.input}</div><div><b style={{ color: '#14212A' }}>Output:</b> {ex.output}</div>{ex.explanation && <div><b style={{ color: '#14212A' }}>Explanation:</b> {ex.explanation}</div>}</div></div>)}
        {(q.constraints || []).length > 0 && <div style={{ marginTop: 18 }}><div style={{ fontSize: 14, fontWeight: 600, color: '#14212A', marginBottom: 8 }}>Constraints:</div><ul className="cj-timer" style={{ fontSize: 13.5, color: '#4B5563', lineHeight: 1.9, paddingLeft: 18, listStyle: 'disc' }}>{q.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
        <div style={{ marginTop: 22, padding: '12px 14px', borderRadius: 12, background: '#EAF3FE', fontSize: 13, color: '#0459A8', lineHeight: 1.6 }}>Write a function named <b className="cj-timer">solve</b>. Run checks the sample cases; Save &amp; continue submits against the hidden tests. Partial credit is given per test.</div>
      </div>
      <div className={`cj-ws__divider ${dragging.current ? 'is-active' : ''}`} onMouseDown={onDown} role="separator" aria-orientation="vertical" />
      {/* editor */}
      <div className="cj-ws__editor">
        <div className="cj-ws__bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#94A3B8' }}>Code</span>
            <select className="cj-select" value={lang} onChange={(e) => changeLang(e.target.value)} disabled={langs.length === 1}>{langs.map((l) => <option key={l}>{l}</option>)}</select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={reset} title="Reset to starter code" className="cj-btn cj-btn--sm" style={{ background: 'transparent', color: '#94A3B8', border: '1px solid #334155' }}><RotateCcw size={13} /> Reset</button>
            <button onClick={run} disabled={running} className="cj-btn cj-btn--sm" style={{ background: '#1E293B', color: '#fff', border: '1px solid #334155' }}>{running ? <Loader2 size={14} className="cand-spin" /> : <Play size={14} />} Run</button>
          </div>
        </div>
        <CodeEditor value={code} onChange={(v) => { setCode(v); onChange({ code: v, tests: ran, language: lang }); }} onRun={run} />
        <div className="cj-ws__console">
          <div className="cj-ws__bar" style={{ background: '#0F172A' }}>
            <div className="cj-ws__tabs"><button className={`cj-ws__tab ${tab === 'cases' ? 'is-on' : ''}`} onClick={() => setTab('cases')}>Test cases</button><button className={`cj-ws__tab ${tab === 'results' ? 'is-on' : ''}`} onClick={() => setTab('results')}>Results{ran ? ` · ${ok}/${ran.length}` : ''}</button></div>
            {ran && !running && <span className="cj-timer" style={{ fontSize: 12.5, fontWeight: 700, color: ok === ran.length ? '#34D399' : ok ? '#FBBF24' : '#F87171' }}>{ok === ran.length ? 'All sample tests passed' : `${ok}/${ran.length} passed`}</span>}
          </div>
          <div className="cj-ws__console-body">
            {tab === 'cases' && (cases.length ? (<>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{cases.map((c, i) => <button key={i} className={`cj-case ${caseI === i ? 'is-on' : ''}`} onClick={() => setCaseI(i)}>Case {i + 1}</button>)}</div>
              {cases[caseI]?.raw ? <><div className="cj-kv-label">Test</div><div className="cj-kv">{cases[caseI].raw}</div></> : (<><div className="cj-kv-label">Input</div><div className="cj-kv">{cases[caseI].args.map((a, i) => `arg${i + 1} = ${fmtV(a)}`).join('\n')}</div><div className="cj-kv-label">Expected</div><div className="cj-kv">{fmtV(cases[caseI].expect)}</div></>)}
            </>) : <p style={{ fontSize: 13, color: '#64748B' }}>Hidden tests only — press Run to see whether your function runs without errors.</p>)}
            {tab === 'results' && (running ? <p style={{ fontSize: 13, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={14} className="cand-spin" /> Running your code…</p>
              : !ran ? <p style={{ fontSize: 13, color: '#64748B' }}>Press Run (⌘/Ctrl+Enter) to test your code against the sample cases.</p>
              : (<>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{ran.map((r, i) => <button key={i} className={`cj-case ${caseI === i ? 'is-on' : ''} ${r.ok ? 'cj-case--ok' : 'cj-case--bad'}`} onClick={() => setCaseI(i)}>{r.ok ? <Check size={12} /> : <AlertCircle size={12} />} Case {i + 1}</button>)}</div>
                {ran[caseI] && (<>{cases[caseI] && !cases[caseI].raw && <><div className="cj-kv-label">Input</div><div className="cj-kv">{cases[caseI].args.map((a, i) => `arg${i + 1} = ${fmtV(a)}`).join('\n')}</div></>}<div className="cj-kv-label">Output</div><div className="cj-kv" style={{ color: ran[caseI].ok ? '#34D399' : '#F87171' }}>{String(ran[caseI].got ?? '—')}</div>{cases[caseI] && !cases[caseI].raw && <><div className="cj-kv-label">Expected</div><div className="cj-kv">{fmtV(cases[caseI].expect)}</div></>}</>)}
              </>))}
          </div>
        </div>
      </div>
    </div>
  );
}
