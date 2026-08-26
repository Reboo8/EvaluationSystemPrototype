import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, FileText, ListChecks, Code2, GitBranch, Languages, UserRound,
  Keyboard, Monitor, Mic, MessagesSquare, ClipboardList, Plus, Settings2, Trash2,
  Sparkles, X, ChevronUp, ChevronDown, Check, Puzzle, Loader2, Coins, AlertTriangle, Lock,
} from 'lucide-react';
import { useApp, fmtCr, CLIENT_STATUS } from '../store.jsx';
import { generateQuestions, suggestSkills } from '../ai.js';

const CATALOG = [
  { key: 'resume', name: 'Resume / JD Screen', icon: ShieldCheck, time: 'instant' },
  { key: 'written', name: 'Written', icon: FileText, time: '15 min' },
  { key: 'mcq', name: 'MCQ / Objective', icon: ListChecks, time: '15 min' },
  { key: 'coding', name: 'Coding', icon: Code2, time: '30 min' },
  { key: 'sjt', name: 'Situational Judgement', icon: GitBranch, time: '15 min' },
  { key: 'language', name: 'Language / CEFR', icon: Languages, time: '10–60 min' },
  { key: 'personality', name: 'Personality', icon: UserRound, time: '10 min' },
  { key: 'typing', name: 'Typing', icon: Keyboard, time: '5 min' },
  { key: 'computer', name: 'Computer Literacy', icon: Monitor, time: '10 min' },
  { key: 'interview', name: 'AI Interview', icon: Mic, time: '15 min' },
  { key: 'simulation', name: 'Simulation', icon: MessagesSquare, time: '10 min' },
  { key: 'custom', name: 'Custom Questionnaire', icon: ClipboardList, time: 'varies' },
];
const META = Object.fromEntries(CATALOG.map((c) => [c.key, c]));
/* rank-parameter label per module key — weightedScore() matches a weight to a candidate sub-score BY NAME, so these must agree */
const WEIGHT_LABEL = { resume: 'Resume-fit', written: 'Written', mcq: 'MCQ', coding: 'Coding', sjt: 'SJT', language: 'Language', personality: 'Personality', typing: 'Typing', computer: 'Computer Literacy', interview: 'AI Interview', simulation: 'Simulation' };

export default function AssessmentBuilder() {
  const { id } = useParams();
  const nav = useNavigate();
  const {
    getOpportunity, updateAssessment, customModules, addCustomModule, assessmentTemplates, saveTemplate, deleteTemplate,
    availableCatalogFor, currentClientId, currentClient, rateCard, rateOf, getCandidates, addAudit,
  } = useApp();
  const opp = getOpportunity(id);
  const catalog = [...CATALOG, ...customModules.map((c) => ({ ...c, icon: Puzzle }))];
  const metaOf = (key) => catalog.find((c) => c.key === key) || { name: key, icon: FileText };

  // module availability for this client (spec §10 boundary: Admin controls what's offered, client controls how it's used)
  const availList = availableCatalogFor(currentClientId);
  const availByKey = Object.fromEntries(availList.map((mm) => [mm.key, { ok: mm.availability.ok, note: mm.availability.note || '', state: mm.state, paused: mm.paused }]));
  const availOf = (key) => availByKey[key] || { ok: true, note: '', state: 'ACTIVE', paused: false };

  const [modules, setModules] = useState(() => (opp?.assessment?.modules || []).map((m) => ({ ...m })));
  const [weights, setWeights] = useState(() => (opp?.assessment?.weights || []).map((w) => ({ ...w })));
  const [editIdx, setEditIdx] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSaveTpl, setShowSaveTpl] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  if (!opp) return <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Opportunity not found.</div>;

  const totalW = weights.reduce((a, b) => a + (Number(b.w) || 0), 0);

  /* ── credits: this screen IS the pricing decision (spec §04/§05 — rates are live, Cuba Admin can change them) ── */
  const unitOf = (key) => (rateCard || []).find((r) => r.key === key)?.unit || 'per attempt';
  const proctorRate = rateOf('proctoring');
  const resumeRate = modules.some((m) => m.key === 'resume') ? rateOf('resume') : 0;
  /* matches estimateFunding(): everything except the resume gate, plus one proctoring session */
  const perCandidate = modules.filter((m) => m.key !== 'resume').reduce((a, m) => a + rateOf(m.key), 0) + proctorRate;
  const prevModules = opp.assessment?.modules || [];
  const prevPerCandidate = prevModules.filter((m) => m.key !== 'resume').reduce((a, m) => a + rateOf(m.key), 0) + proctorRate;
  const costDelta = perCandidate - prevPerCandidate;

  /* ── weight integrity: a weight label only scores if a candidate actually has that sub-score (store.weightedScore keys by label) ── */
  const existing = getCandidates(id);
  const scoreKeys = Array.from(new Set(existing.flatMap((c) => Object.keys(c.scores || {}))));
  const unmatched = scoreKeys.length ? weights.filter((w) => !scoreKeys.includes(w.label)) : [];
  const known = (label) => !scoreKeys.length || scoreKeys.includes(label);

  /* ── §03: an account-status reason restricts new activity; a wallet reason never blocks configuration ── */
  const acctBlock = currentClient?.status && currentClient.status !== 'ACTIVE'
    ? `Account is ${CLIENT_STATUS[currentClient.status]?.label || currentClient.status} — assessment changes are restricted.`
    : currentClient?.paused ? 'Usage is temporarily paused by Cuba Admin — assessment changes are restricted.' : '';
  const saveBlock = acctBlock || (totalW !== 100 ? `Rank weights total ${totalW}% — they must equal 100% before saving.` : '');
  const nextVersion = 'v' + ((parseInt((opp.assessment?.version || 'v1').slice(1), 10) || 1) + 1);
  const addModule = (key, defaults = {}) => setModules((m) => [...m, { id: 'm' + Math.random().toString(36).slice(2, 7), key, skills: [], nQ: 3, rubric: [], gate: 'Advance ≥ 60', weight: 0, ...defaults }]);
  const removeModule = (i) => setModules((m) => m.filter((_, x) => x !== i));
  const moveModule = (i, dir) => setModules((m) => {
    const j = i + dir;
    if (j < 0 || j >= m.length) return m;
    const next = [...m]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const save = () => {
    if (saveBlock) { showToast(saveBlock); return; }
    const prevW = opp.assessment?.weights || [];
    const diffs = [];
    weights.forEach((w) => { const q = prevW.find((x) => x.label === w.label); if (!q) diffs.push(`${w.label} +${w.w}%`); else if (Number(q.w) !== Number(w.w)) diffs.push(`${w.label} ${q.w}→${w.w}`); });
    prevW.forEach((q) => { if (!weights.some((w) => w.label === q.label)) diffs.push(`${q.label} removed`); });
    const prevKeys = prevModules.map((m) => m.key);
    const nowKeys = modules.map((m) => m.key);
    nowKeys.filter((k) => !prevKeys.includes(k)).forEach((k) => diffs.push(`+${metaOf(k).name}`));
    prevKeys.filter((k) => !nowKeys.includes(k)).forEach((k) => diffs.push(`−${metaOf(k).name}`));
    if (costDelta) diffs.push(`${costDelta > 0 ? '+' : ''}${costDelta} cr per candidate`);
    updateAssessment(id, { modules, weights });
    addAudit('Assessment config', `Assessment updated ${opp.assessment?.version || 'v1'} → ${nextVersion}`, opp.title, {
      clientId: currentClientId, actor: `${currentClient?.name || 'Client'} · Recruiter`, role: 'client',
      reason: diffs.length ? diffs.join(', ') : 'No effective change',
    });
    nav('/opportunities/' + id);
  };
  const applyTemplate = (t) => { setModules((t.modules || []).map((m) => ({ ...m }))); setWeights((t.weights || []).map((w) => ({ ...w }))); showToast('Loaded “' + t.name + '”'); };
  // role/module-aware weight suggestion — derived from the modules actually in the assessment (never injects Coding for a non-coding role)
  const suggestWeights = () => {
    const LABEL = WEIGHT_LABEL;
    const BASE = { coding: 30, interview: 30, mcq: 30, written: 20, sjt: 20, simulation: 20, language: 25, personality: 10, typing: 5, computer: 15 };
    const entries = [];
    modules.forEach((m) => { if (m.key === 'resume') return; entries.push({ label: LABEL[m.key] || metaOf(m.key).name, w: BASE[m.key] ?? 15 }); });
    if (modules.some((m) => m.key === 'resume')) entries.push({ label: 'Resume-fit', w: 5 });
    entries.push({ label: 'Integrity', w: 10 });
    /* a label that no scored candidate has drags every weighted score down (it counts as 0) — never suggest one */
    const dropped = scoreKeys.length ? entries.filter((e) => !scoreKeys.includes(e.label)).map((e) => e.label) : [];
    const usable = scoreKeys.length ? entries.filter((e) => scoreKeys.includes(e.label)) : entries;
    if (!usable.length) { showToast('No rank parameter matches an existing sub-score — add modules first'); return; }
    const total = usable.reduce((a, b) => a + b.w, 0) || 1;
    const scaled = usable.map((e) => ({ ...e, w: Math.round(e.w / total * 100) }));
    const drift = 100 - scaled.reduce((a, b) => a + b.w, 0);
    if (drift && scaled.length) { let mi = 0; scaled.forEach((x, i) => { if (x.w > scaled[mi].w) mi = i; }); scaled[mi] = { ...scaled[mi], w: scaled[mi].w + drift }; }
    setWeights(scaled);
    showToast(dropped.length ? `Weights suggested — left out ${dropped.join(', ')} (no candidate has that sub-score yet)` : 'Weights suggested from your modules');
  };
  /* add a rank parameter by picking a real sub-score key, not a free-text label */
  const paramOptions = Array.from(new Set([
    ...scoreKeys,
    ...modules.map((m) => WEIGHT_LABEL[m.key] || metaOf(m.key).name),
    'Integrity',
  ])).filter((k) => !weights.some((w) => w.label === k));

  return (
    <>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/opportunities/' + id)}>{opp.title}</span> › Configure Assessment
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}>
            Configure Assessment
            <span className="badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>Version {opp.assessment?.version || 'v1'}</span>
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Compose modules, set per-module rubrics &amp; thresholds, and the rank weights. Saving creates a new version.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="chip" style={{ background: totalW === 100 ? '#ECFDF5' : '#FEF2F2', color: totalW === 100 ? '#16A34A' : '#DC2626' }}>{modules.length} modules · weights {totalW}%</span>
          <span className="chip" style={{ background: '#F8FAFF', color: '#056FD4', border: '1px solid #E0EDFF' }}><Coins size={12} /> {fmtCr(perCandidate)} / candidate{costDelta !== 0 && <b style={{ color: costDelta > 0 ? '#B45309' : '#15803D', marginLeft: 4 }}>{costDelta > 0 ? '+' : ''}{costDelta}</b>}</span>
          <button className="btn-ghost" onClick={() => setShowSaveTpl(true)}><Sparkles size={14} /> Save as Template</button>
          <button className="btn-primary" disabled={!!saveBlock} title={saveBlock || `Saves ${nextVersion}`} onClick={save}><Check size={15} /> Save assessment</button>
        </div>
      </div>

      {acctBlock && (
        <div className="banner danger" style={{ marginBottom: 16 }}>
          <Lock size={17} />
          <div style={{ flex: 1 }}><b>{acctBlock}</b> You can review the configuration; saving a new version is disabled until Cuba Admin reinstates the workspace.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* catalog */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Module Catalog</div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 6 }}>Add what this role needs</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 12 }}>Cuba Admin controls which modules are offered; you decide how they're used here.</div>
          {catalog.filter((c) => availOf(c.key).state !== 'DISABLED').map((c) => {
            const av = availOf(c.key);
            const isPaused = (av.note || '').toLowerCase().includes('paused');
            const canAdd = av.ok || isPaused;
            const greyed = !canAdd;
            return (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: '1px solid #E2E8F0', borderRadius: 10, marginBottom: 8, opacity: greyed ? 0.5 : 1 }}>
              <div className="icon-box" style={{ width: 32, height: 32, borderRadius: 8, background: c.custom ? '#EDE9FE' : '#E0EDFF', color: c.custom ? '#6D28D9' : '#056FD4' }}><c.icon size={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {c.name}
                  {c.custom && <span className="badge" style={{ background: '#EDE9FE', color: '#6D28D9' }}>custom</span>}
                  {av.state === 'BETA' && av.ok && !isPaused && <span className="badge" style={{ background: '#EDE9FE', color: '#6D28D9' }}>Beta</span>}
                  {isPaused && <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>New attempts paused</span>}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{c.time}{rateOf(c.key) > 0 ? <> · <b style={{ color: '#056FD4' }}>{rateOf(c.key)} cr</b> {unitOf(c.key)}</> : <> · <span style={{ color: '#15803D' }}>free</span></>}</div>
                {greyed && av.note && <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 2 }}>{av.note}</div>}
              </div>
              <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} disabled={!canAdd} title={!canAdd ? av.note : undefined} onClick={() => canAdd && addModule(c.key, c.custom ? { rubric: c.rubric || [] } : {})}>+ Add</button>
            </div>
            );
          })}
          <div onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 10px', border: '1.5px dashed #C7B8F5', borderRadius: 10, color: '#6D28D9', background: '#FAF8FF', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} /> Create custom module
          </div>
        </div>

        {/* saved templates */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Saved Templates</div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 12 }}>Reusable module + weight bundles · click Use to load</div>
          {assessmentTemplates.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 0' }}>None yet — use “Save as Template” above.</div>}
          {assessmentTemplates.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', border: '1px solid #E2E8F0', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{(t.modules || []).length} modules · {(t.weights || []).length} params{t.createdAt === 'Built-in' ? ' · built-in' : ''}</div>
              </div>
              <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => applyTemplate(t)}>Use</button>
              <Trash2 size={14} color="#EF4444" style={{ cursor: 'pointer' }} onClick={() => { deleteTemplate(t.id); showToast('Template deleted'); }} />
            </div>
          ))}
        </div>
        </div>

        {/* assessment + weights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Your Assessment <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>(candidate runs these in order)</span></div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>Each module tests selected skills. Configure questions, rubric, threshold &amp; weight.</div>
            {modules.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No modules yet — add from the catalog.</div>}
            {modules.map((m, i) => {
              const c = metaOf(m.key);
              const av = availOf(m.key);
              const isPaused = (av.note || '').toLowerCase().includes('paused');
              return (
                <div key={m.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '1px solid #E2E8F0', borderRadius: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <ChevronUp size={15} color={i === 0 ? '#E2E8F0' : '#94A3B8'} style={{ cursor: i === 0 ? 'default' : 'pointer' }} onClick={() => i > 0 && moveModule(i, -1)} />
                    <ChevronDown size={15} color={i === modules.length - 1 ? '#E2E8F0' : '#94A3B8'} style={{ cursor: i === modules.length - 1 ? 'default' : 'pointer' }} onClick={() => i < modules.length - 1 && moveModule(i, 1)} />
                  </div>
                  <div className="icon-box" style={{ width: 36, height: 36, borderRadius: 8 }}><c.icon size={18} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {i + 1}. {c.name}
                      {m.key === 'resume' && <span className="badge" style={{ background: '#EFF6FF', color: '#056FD4' }}>gate</span>}
                      {av.state === 'BETA' && av.ok && !isPaused && <span className="badge" style={{ background: '#EDE9FE', color: '#6D28D9' }}>Beta</span>}
                      {isPaused && <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>New attempts paused</span>}
                      {!av.ok && !isPaused && av.note && <span className="badge" style={{ background: '#FFEDD5', color: '#C2410C' }}>{av.note}</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>tests: {m.skills?.length ? m.skills.join(', ') : '—'}{m.rubric?.length ? ` · ${m.rubric.length} rubric dims` : ''}{m.questions?.length ? ` · ${m.questions.length} Qs` : ''} · weight {m.weight || 0}% · <b style={{ color: rateOf(m.key) ? '#056FD4' : '#15803D' }}>{rateOf(m.key) ? `${rateOf(m.key)} cr ${unitOf(m.key)}` : 'free'}</b></div>
                  </div>
                  <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => setEditIdx(i)}><Settings2 size={14} /> Configure</button>
                  <Trash2 size={16} color="#EF4444" style={{ cursor: 'pointer' }} onClick={() => removeModule(i)} />
                </div>
              );
            })}

            {/* the price of this composition — the number this screen actually decides (spec §04) */}
            {modules.length > 0 && (
              <div style={{ marginTop: 4, padding: '12px 16px', border: '1px solid #E0EDFF', background: '#F8FBFF', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Coins size={15} color="#056FD4" />
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>This assessment costs <span style={{ color: '#056FD4' }}>{fmtCr(perCandidate)}</span> per fully-evaluated candidate</div>
                    <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>
                      {modules.filter((m) => m.key !== 'resume' && rateOf(m.key) > 0).map((m) => `${metaOf(m.key).name} ${rateOf(m.key)}`).concat(proctorRate ? [`Proctoring ${proctorRate}`] : []).join(' + ') || 'no paid modules'} cr
                      {resumeRate > 0 && <> · resume gate adds <b>{resumeRate} cr</b> per applicant screened</>}
                    </div>
                  </div>
                  {costDelta !== 0 && (
                    <span className="chip" style={{ background: costDelta > 0 ? '#FEF3C7' : '#DCFCE7', color: costDelta > 0 ? '#B45309' : '#15803D' }}>
                      {opp.assessment?.version || 'v1'} → {nextVersion}: {costDelta > 0 ? '+' : ''}{costDelta} cr / candidate
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>Rates come from the live Cuba rate card — if Cuba changes a rate, this figure moves. Credits are consumed only when a service actually runs.</div>
              </div>
            )}
          </div>

          {/* weights */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Scoring weights &amp; thresholds</div>
              <button className="copilot" onClick={suggestWeights}><Sparkles size={14} /> AI: suggest weights</button>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>Thresholds = the <b>gate</b> (who clears). Weights = the <b>order</b> (rank). Must total 100%. Each parameter is matched to a candidate sub-score <b>by name</b>.</div>

            {unmatched.length > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '9px 12px', marginBottom: 12 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <span><b>{unmatched.map((u) => u.label).join(', ')}</b> {unmatched.length === 1 ? 'has' : 'have'} no sub-score on any of the {existing.length} already-scored candidate{existing.length === 1 ? '' : 's'} — {unmatched.length === 1 ? 'it counts' : 'they count'} as 0 and would lower every weighted score at once. Remove {unmatched.length === 1 ? 'it' : 'them'}, or keep {unmatched.length === 1 ? 'it' : 'them'} only for candidates evaluated from now on.</span>
              </div>
            )}

            {weights.map((p, i) => {
              const ok = known(p.label);
              return (
                <div key={p.label + '-' + i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    {p.label}
                    {!ok && <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>no sub-score</span>}
                  </div>
                  <input type="number" value={p.w} onChange={(e) => setWeights((w) => w.map((x, j) => (j === i ? { ...x, w: Number(e.target.value) } : x)))}
                    style={{ width: 64, padding: '7px 8px', border: `1px solid ${ok ? '#E2E8F0' : '#FDE68A'}`, borderRadius: 8, fontSize: 13, textAlign: 'center', fontFamily: 'inherit' }} />
                  <span style={{ fontSize: 13, color: '#9CA3AF' }}>%</span>
                  <Trash2 size={15} color="#EF4444" style={{ cursor: 'pointer' }} onClick={() => setWeights((w) => w.filter((_, j) => j !== i))} />
                </div>
              );
            })}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <select className="input" value="" style={{ width: 'auto', minWidth: 200, padding: '7px 10px', fontSize: 12.5 }}
                onChange={(e) => { const v = e.target.value; if (!v) return; setWeights((w) => [...w, { label: v, w: 0 }]); }}>
                <option value="">+ Add parameter…</option>
                {paramOptions.length === 0 && <option value="" disabled>Every known sub-score is already weighted</option>}
                {paramOptions.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>{scoreKeys.length ? 'Only sub-scores this role’s candidates actually carry.' : 'No scored candidates yet — parameters are matched by name when results arrive.'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid #F3F4F6', fontSize: 14, fontWeight: 700 }}>
              <span>Total</span><span style={{ color: totalW === 100 ? '#16A34A' : '#DC2626' }}>{totalW}% {totalW === 100 ? '✓' : '— must equal 100%'}</span>
            </div>
            {saveBlock && <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 8 }}>{saveBlock}</div>}
          </div>
        </div>
      </div>

      {editIdx !== null && (
        <ConfigModal
          module={modules[editIdx]}
          name={metaOf(modules[editIdx].key).name}
          roleTitle={opp.title}
          roleSkills={opp.skills}
          onClose={() => setEditIdx(null)}
          onSave={(m) => { setModules((arr) => arr.map((x, i) => (i === editIdx ? m : x))); setEditIdx(null); }}
        />
      )}

      {showCreate && (
        <CreateModuleModal
          onClose={() => setShowCreate(false)}
          onCreate={(def) => { const key = addCustomModule(def); addModule(key, { rubric: def.rubric || [] }); setShowCreate(false); }}
        />
      )}

      {showSaveTpl && (
        <SaveTemplateModal
          defaultName={(opp.title || 'Assessment') + ' template'}
          onClose={() => setShowSaveTpl(false)}
          onSave={(name) => { saveTemplate(name, modules, weights); setShowSaveTpl(false); showToast('Saved “' + name + '” to templates'); }}
        />
      )}

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 80, display: 'flex', alignItems: 'center', gap: 9, background: '#14212A', color: '#fff', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}><Check size={15} color="#34D399" /> {toast}</div>}
    </>
  );
}

/* ── name + save the current modules/weights as a reusable template ── */
function SaveTemplateModal({ defaultName, onClose, onSave }) {
  const [name, setName] = useState(defaultName || '');
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 440, maxWidth: '94vw', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16.5, fontWeight: 700, margin: 0 }}>Save as Template</h2>
          <X size={18} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>
        <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 12 }}>Saves the current modules + rank weights as a reusable template. Find it under <b>Saved Templates</b> on any opportunity’s Configure Assessment screen.</div>
        <label className="field-label">Template name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Backend Engineer — standard" style={{ marginBottom: 18 }} autoFocus />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save template</button>
        </div>
      </div>
    </div>
  );
}

/* ── create a custom module type (client-defined) ── */
function CreateModuleModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [format, setFormat] = useState('Free-text answer');
  const [scoring, setScoring] = useState('AI rubric');
  const [rubric, setRubric] = useState([]);
  const [rd, setRd] = useState('');
  const addR = () => { const v = rd.trim(); if (v && !rubric.includes(v)) setRubric([...rubric, v]); setRd(''); };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ width: 560, maxWidth: '92vw', maxHeight: '88vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Create a custom module</div>
          <X size={20} color="#6B7280" style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>
        <div style={{ padding: 22 }}>
          <label className="field-label">Module name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Pitch (video)" style={{ marginBottom: 14 }} />
          <label className="field-label">What it measures</label>
          <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Persuasion, clarity, product knowledge" style={{ marginBottom: 14 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div><label className="field-label">Response format</label>
              <select className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option>Free-text answer</option><option>Multiple choice (MCQ)</option><option>Code editor</option><option>Scenario response</option><option>Audio response</option><option>Video response</option><option>File upload</option>
              </select></div>
            <div><label className="field-label">Scoring method</label>
              <select className="input" value={scoring} onChange={(e) => setScoring(e.target.value)}>
                <option>AI rubric</option><option>Auto-marked</option><option>Manual review</option>
              </select></div>
          </div>
          <label className="field-label">Default rubric dimensions</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
            {rubric.map((r) => <span className="skill-chip" key={r} style={{ background: '#F0FDF4', color: '#15803D', borderColor: '#BBF7D0' }}>{r}<X size={11} style={{ cursor: 'pointer' }} onClick={() => setRubric(rubric.filter((x) => x !== r))} /></span>)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={rd} onChange={(e) => setRd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addR())} placeholder="e.g. Clarity" />
            <button className="btn-ghost" onClick={addR}>Add</button>
            <button className="copilot" onClick={() => setRubric(Array.from(new Set([...rubric, 'Relevance', 'Clarity', 'Depth'])))}><Sparkles size={14} /> AI</button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: '1px solid #E2E8F0' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => onCreate({ name: name.trim(), desc, format, scoring, rubric })}>Create &amp; add</button>
        </div>
      </div>
    </div>
  );
}

/* ── per-module config (skills, questions, RUBRIC, thresholds, weight) ── */
function ConfigModal({ module, name, roleTitle, roleSkills, onClose, onSave }) {
  const [m, setM] = useState({ skills: [], rubric: [], nQ: 3, gate: '', weight: 0, questions: [], bands: DEFAULT_BANDS, minFit: 50, knockout: true, tWpm: 40, tAcc: 90, resumeParams: DEFAULT_RESUME_PARAMS, passThreshold: 80, ...module });
  const [skillDraft, setSkillDraft] = useState('');
  const [rubricDraft, setRubricDraft] = useState('');

  const addSkill = () => { const v = skillDraft.trim(); if (v && !m.skills.includes(v)) setM({ ...m, skills: [...m.skills, v] }); setSkillDraft(''); };
  const addRubric = () => { const v = rubricDraft.trim(); if (v && !m.rubric.includes(v)) setM({ ...m, rubric: [...m.rubric, v] }); setRubricDraft(''); };

  // each module type gets only the fields that make sense for it
  const isQ = ['written', 'mcq', 'coding', 'sjt'].includes(m.key) || (m.key || '').startsWith('custom');
  const isResume = m.key === 'resume';
  const isTyping = m.key === 'typing';
  const isInterview = m.key === 'interview';
  const isLanguage = m.key === 'language';
  const showRubric = !isResume && !isTyping && m.key !== 'mcq';
  const showBands = !isResume && !isTyping;
  const num = { padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' };
  const computeGate = () => (isResume ? `Pass ≥ ${m.passThreshold}% weighted${m.knockout ? ' · knockout if must-have missing' : ''}` : isTyping ? `${m.tWpm} WPM · ${m.tAcc}% accuracy` : bandsToText(m.bands));
  const setParam = (i, k, v) => setM((s) => ({ ...s, resumeParams: s.resumeParams.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  const rpTotal = (m.resumeParams || []).reduce((a, b) => a + (Number(b.weight) || 0), 0);
  const suggestResumeParams = () => setM((s) => ({ ...s, resumeParams: [
    { id: 'rp_skills', label: 'Skills match', weight: 45, min: 60, mandatory: true },
    { id: 'rp_exp', label: 'Work experience', weight: 30, min: 0, mandatory: true },
    { id: rid(), label: 'Education', weight: 10, min: 0 },
    { id: rid(), label: 'Projects', weight: 15, min: 0 },
  ], passThreshold: 80 }));

  // AI: suggest skills/topics for any module + must-ask interview questions
  const [skillBusy, setSkillBusy] = useState(false);
  const [maBusy, setMaBusy] = useState(false);
  const aiSuggestSkills = async () => {
    setSkillBusy(true);
    try { const arr = await suggestSkills({ title: roleTitle || name, jd: '' }); setM((s) => ({ ...s, skills: Array.from(new Set([...(s.skills || []), ...(roleSkills || []), ...arr])).slice(0, 12) })); }
    catch (e) { alert('AI failed: ' + e.message); } finally { setSkillBusy(false); }
  };
  const addMustAsk = () => setM((s) => ({ ...s, questions: [...(s.questions || []), { id: 'q' + Math.random().toString(36).slice(2, 7), type: 'interview', text: '' }] }));
  const aiMustAsk = async () => {
    setMaBusy(true);
    try { const arr = await generateQuestions({ skill: m.skills[0] || roleTitle || name, n: 3 }); setM((s) => ({ ...s, questions: [...(s.questions || []), ...arr.map((t) => ({ id: 'q' + Math.random().toString(36).slice(2, 7), type: 'interview', text: t }))] })); }
    catch (e) { alert('AI failed: ' + e.message); } finally { setMaBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ width: 640, maxWidth: '92vw', maxHeight: '88vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Configure: {name}</div>
          <X size={20} color="#6B7280" style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>
        <div style={{ padding: 22 }}>
          {/* skills — label adapts to module type; hidden for typing */}
          {!isTyping && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="field-label" style={{ margin: 0 }}>{isResume ? 'Must-have skills (knockout if missing)' : isInterview ? 'Skills / topics to probe' : 'Skills this module tests'}</label>
              <button className="copilot" onClick={aiSuggestSkills} disabled={skillBusy}>{skillBusy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} AI: suggest</button>
            </div>
            <div className="input" style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', marginBottom: 6 }}>
              {m.skills.map((s) => <span className="skill-chip" key={s}>{s}<X size={11} style={{ cursor: 'pointer' }} onClick={() => setM({ ...m, skills: m.skills.filter((x) => x !== s) })} /></span>)}
              <input value={skillDraft} onChange={(e) => setSkillDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())} placeholder="add skill + Enter" style={{ flex: 1, minWidth: 110, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', fontFamily: 'inherit' }} />
            </div>
          </>)}

          {/* QUESTIONS — only for question-based modules (written / mcq / coding / sjt / custom) */}
          {isQ && (
            <div style={{ margin: '16px 0' }}>
              <QuestionEditor questions={m.questions || []} onChange={(qs) => setM({ ...m, questions: qs })} moduleKey={m.key} moduleName={name} defaultSkill={m.skills[0]} />
            </div>
          )}

          {/* RESUME — a weighted, multi-parameter gate (no questions) */}
          {isResume && (
            <div style={{ margin: '16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="field-label" style={{ margin: 0 }}>Resume parameters <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(each scored 0–100 by the analyser, then weighted)</span></label>
                <button className="copilot" onClick={suggestResumeParams}><Sparkles size={14} /> AI: suggest</button>
              </div>
              <div className="hint" style={{ marginTop: 2, marginBottom: 10 }}>The weighted total must cross the pass threshold to clear the gate. <b>Skills</b> &amp; <b>Work experience</b> are mandatory; add more as needed.</div>
              <div style={{ display: 'flex', gap: 8, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 6 }}>
                <span style={{ flex: 1 }}>Parameter</span><span style={{ width: 70, textAlign: 'center' }}>Weight %</span><span style={{ width: 70, textAlign: 'center' }}>Min</span><span style={{ width: 18 }} />
              </div>
              {(m.resumeParams || []).map((p, i) => (
                <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input className="input" value={p.label} disabled={p.mandatory} onChange={(e) => setParam(i, 'label', e.target.value)} style={{ flex: 1, ...(p.mandatory ? { background: '#F8FAFC', color: '#475569' } : {}) }} />
                  <input type="number" value={p.weight} onChange={(e) => setParam(i, 'weight', Number(e.target.value))} style={{ ...num, width: 70, textAlign: 'center' }} />
                  <input type="number" value={p.min} onChange={(e) => setParam(i, 'min', Number(e.target.value))} style={{ ...num, width: 70, textAlign: 'center' }} title="Per-parameter minimum (optional)" />
                  {p.mandatory ? <span style={{ width: 18 }} /> : <Trash2 size={15} color="#EF4444" style={{ cursor: 'pointer' }} onClick={() => setM({ ...m, resumeParams: m.resumeParams.filter((_, j) => j !== i) })} />}
                </div>
              ))}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, margin: '4px 0 10px' }}>
                {RESUME_PRESETS.filter((l) => !(m.resumeParams || []).some((p) => p.label === l)).map((l) => (
                  <button key={l} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setM({ ...m, resumeParams: [...m.resumeParams, { id: rid(), label: l, weight: 0, min: 0 }] })}>+ {l}</button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #F3F4F6', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
                <span>Parameter weights total</span><span style={{ color: rpTotal === 100 ? '#16A34A' : '#DC2626' }}>{rpTotal}% {rpTotal === 100 ? '✓' : '— must equal 100%'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Pass threshold</span>
                <input type="number" value={m.passThreshold} onChange={(e) => setM({ ...m, passThreshold: Number(e.target.value) })} style={{ ...num, width: 80, textAlign: 'center' }} /><span style={{ fontSize: 12, color: '#9CA3AF' }}>% weighted score to clear the gate</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={m.knockout} onChange={(e) => setM({ ...m, knockout: e.target.checked })} /> Auto-reject candidates missing a must-have skill
              </label>
              <div className="hint" style={{ marginTop: 10 }}>Example: Skills 50% · Work experience 50% — a candidate scoring 90 &amp; 90 → <b>90%</b> weighted, above a {m.passThreshold}% threshold → <b>passes</b>.</div>
            </div>
          )}

          {/* TYPING — speed + accuracy targets, not questions */}
          {isTyping && (
            <div style={{ margin: '0 0 16px' }}>
              <label className="field-label">Typing targets</label>
              <div className="hint" style={{ marginTop: -2, marginBottom: 10 }}>A timed passage measures speed + accuracy — no questions to author.</div>
              <div style={{ display: 'flex', gap: 18 }}>
                <div><div style={lbl}>Target speed (WPM)</div><input type="number" value={m.tWpm} onChange={(e) => setM({ ...m, tWpm: Number(e.target.value) })} style={{ ...num, width: 100 }} /></div>
                <div><div style={lbl}>Min accuracy (%)</div><input type="number" value={m.tAcc} onChange={(e) => setM({ ...m, tAcc: Number(e.target.value) })} style={{ ...num, width: 100 }} /></div>
              </div>
            </div>
          )}

          {/* RUBRIC — for AI/human-graded modules (not resume, typing, mcq) */}
          {showRubric && (<>
            <label className="field-label">Rubric — scoring dimensions <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(what the score is made of)</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
              {m.rubric.map((r) => <span className="skill-chip" key={r} style={{ background: '#F0FDF4', color: '#15803D', borderColor: '#BBF7D0' }}>{r}<X size={11} style={{ cursor: 'pointer' }} onClick={() => setM({ ...m, rubric: m.rubric.filter((x) => x !== r) })} /></span>)}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input className="input" value={rubricDraft} onChange={(e) => setRubricDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRubric())} placeholder="e.g. Problem solving" />
              <button className="btn-ghost" onClick={addRubric}>Add</button>
              <button className="copilot" onClick={() => setM({ ...m, rubric: Array.from(new Set([...m.rubric, 'Domain knowledge', 'Problem solving', 'Communication'])) })}><Sparkles size={14} /> AI</button>
            </div>
            <div className="hint" style={{ marginBottom: 14 }}>Reference answers + partial-credit are attached per dimension (AI can draft them).</div>
          </>)}

          {/* languages — multilingual (interview / language modules) */}
          {(isInterview || isLanguage) && (
            <>
              <label className="field-label">Languages offered <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(multilingual — candidate picks one)</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
                {(m.languages || []).map((l) => <span className="skill-chip" key={l} style={{ background: '#FFF7ED', color: '#C2410C', borderColor: '#FED7AA' }}>{l}<X size={11} style={{ cursor: 'pointer' }} onClick={() => setM({ ...m, languages: (m.languages || []).filter((x) => x !== l) })} /></span>)}
                {(m.languages || []).length === 0 && <span style={{ fontSize: 12, color: '#9CA3AF' }}>None yet — add below.</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
                {['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Marathi', 'Bengali'].filter((l) => !(m.languages || []).includes(l)).map((l) => (
                  <button key={l} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setM({ ...m, languages: [...(m.languages || []), l] })}>+ {l}</button>
                ))}
              </div>

              {/* HR's must-ask questions — the AI interviewer always asks these (interview stays adaptive around them) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="field-label" style={{ margin: 0 }}>Must-ask questions <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(the AI interviewer always asks these)</span></label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" style={{ padding: '5px 11px', fontSize: 12 }} onClick={addMustAsk}><Plus size={13} /> Add</button>
                  <button className="copilot" onClick={aiMustAsk} disabled={maBusy}>{maBusy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} AI: suggest</button>
                </div>
              </div>
              {(m.questions || []).length === 0 && <div className="hint" style={{ marginBottom: 14 }}>None yet — the interview stays fully adaptive. Add questions the interviewer must always cover.</div>}
              <div style={{ marginBottom: 14 }}>
                {(m.questions || []).map((q, i) => (
                  <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF' }}>{i + 1}</span>
                    <input className="input" value={q.text} onChange={(e) => setM((s) => ({ ...s, questions: s.questions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))} placeholder="e.g. Walk me through a system you designed end-to-end and the trade-offs." style={{ flex: 1 }} />
                    <Trash2 size={15} color="#EF4444" style={{ cursor: 'pointer' }} onClick={() => setM((s) => ({ ...s, questions: s.questions.filter((_, j) => j !== i) }))} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* thresholds — Hallo-style score bands (not for resume/typing which have their own gate) */}
          {showBands && (<>
            <label className="field-label">Thresholds — score bands (the gate)</label>
            <div className="hint" style={{ marginTop: -2, marginBottom: 8 }}>One band per outcome: <b>From–To</b> score → <b>Label</b> (e.g. Reject / Review / Advance). Candidates are gated by these.</div>
            <BandEditor bands={m.bands} onChange={(b) => setM({ ...m, bands: b })} />
          </>)}

          {/* weight */}
          <label className="field-label">Rank weight (toward the final order)</label>
          <input type="number" value={m.weight} onChange={(e) => setM({ ...m, weight: Number(e.target.value) })} style={{ ...num, width: 110 }} /> <span style={{ fontSize: 12, color: '#9CA3AF' }}>% of final rank</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: '1px solid #E2E8F0' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave({ ...m, gate: computeGate() })}>Save module</button>
        </div>
      </div>
    </div>
  );
}

/* ── threshold score-bands editor (Hallo-style From / To / Label) ── */
const DEFAULT_BANDS = [{ from: 0, to: 59, label: 'Reject' }, { from: 60, to: 69, label: 'Review' }, { from: 70, to: 100, label: 'Advance' }];
const bandsToText = (bands) => (bands && bands.length ? bands : DEFAULT_BANDS).map((b) => `${b.label} ${b.from}–${b.to}`).join(' · ');

/* resume gate = several weighted parameters (each scored 0–100); weighted total must cross the pass threshold */
const rid = () => 'rp' + Math.random().toString(36).slice(2, 7);
const DEFAULT_RESUME_PARAMS = [
  { id: 'rp_skills', label: 'Skills match', weight: 50, min: 0, mandatory: true },
  { id: 'rp_exp', label: 'Work experience', weight: 50, min: 0, mandatory: true },
];
const RESUME_PRESETS = ['Education', 'Positions of responsibility', 'Certifications', 'Projects', 'Domain relevance', 'Communication'];

function BandEditor({ bands, onChange, max = 100 }) {
  const rows = bands && bands.length ? bands : DEFAULT_BANDS;
  const num = { width: 68, padding: '7px 8px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', textAlign: 'center' };
  const set = (i, k, v) => onChange(rows.map((b, j) => (j === i ? { ...b, [k]: k === 'label' ? v : (v === '' ? '' : Number(v)) } : b)));
  const add = () => onChange([...rows, { from: (Number(rows[rows.length - 1]?.to) || 0) + 1, to: max, label: 'New' }]);
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 6 }}>
        <span style={{ width: 68 }}>From</span><span style={{ width: 68 }}>To</span><span style={{ flex: 1 }}>Label</span><span style={{ width: 18 }} />
      </div>
      {rows.map((b, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input type="number" value={b.from} onChange={(e) => set(i, 'from', e.target.value)} style={num} />
          <input type="number" value={b.to} onChange={(e) => set(i, 'to', e.target.value)} style={num} />
          <input className="input" value={b.label} onChange={(e) => set(i, 'label', e.target.value)} placeholder="e.g. Pass" style={{ flex: 1 }} />
          <Trash2 size={15} color="#EF4444" style={{ cursor: 'pointer' }} onClick={() => onChange(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 11px', marginTop: 2 }} onClick={add}><Plus size={13} /> Add threshold</button>
    </div>
  );
}

/* ── type-aware question editor: each module type gets its proper structure ── */
const Q_TYPES = [['mcq', 'Multiple choice'], ['short', 'Short answer'], ['coding', 'Coding'], ['scenario', 'Scenario'], ['video', 'Video response'], ['file', 'File upload']];
const CODE_LANGS = ['Python', 'JavaScript', 'Java', 'C++', 'C#', 'Go', 'SQL'];
const STARTER = { Python: 'class Solution:\n    def solve(self, ):\n        pass', JavaScript: 'function solve() {\n  // your code\n}', Java: 'class Solution {\n    // your code\n}', 'C++': 'class Solution {\npublic:\n    // your code\n};', 'C#': 'public class Solution {\n    // your code\n}', Go: 'func solve() {\n    // your code\n}', SQL: '-- write your query' };
const newQ = (type = 'short') => {
  const base = { id: 'q' + Math.random().toString(36).slice(2, 7), type, text: '', difficulty: 'Medium', marks: type === 'coding' ? 20 : 5 };
  if (type === 'mcq') return { ...base, options: ['', '', '', ''], correct: 0 };
  if (type === 'coding') return { ...base, description: '', examples: [{ input: '', output: '', explanation: '' }], constraints: [''], testcases: '', starter: STARTER.Python, language: 'Python' };
  return { ...base, answer: '' };
};

function QuestionEditor({ questions, onChange, moduleKey, moduleName, defaultSkill }) {
  const [busy, setBusy] = useState(false);
  const sel = { padding: '5px 8px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', background: '#fff' };
  const ta = { width: '100%', minHeight: 50, border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 };
  const mono = { ...ta, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 };
  const setQ = (id, patch) => onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const defType = moduleKey === 'mcq' ? 'mcq' : moduleKey === 'coding' ? 'coding' : (moduleKey === 'sjt' ? 'mcq' : 'short');
  const add = () => onChange([...questions, newQ(defType)]);
  const genAI = async () => {
    setBusy(true);
    try {
      const arr = await generateQuestions({ skill: defaultSkill || moduleName, n: 3 });
      onChange([...questions, ...arr.map((text) => (defType === 'coding' ? { ...newQ('coding'), text } : { ...newQ(defType), text }))]);
    } catch (e) { alert('AI failed: ' + e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label className="field-label" style={{ margin: 0 }}>Questions <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({questions.length}) — write your own or generate, then edit</span></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ padding: '5px 11px', fontSize: 12 }} onClick={add}><Plus size={13} /> Add question</button>
          <button className="copilot" onClick={genAI} disabled={busy}>{busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {busy ? 'Generating…' : 'AI: generate'}</button>
        </div>
      </div>
      {questions.length === 0 && <div className="hint" style={{ marginBottom: 12 }}>No questions yet — add your own (any type) or let AI draft a few. Leave empty to let AI generate at run-time.</div>}
      {questions.map((q, i) => {
        const set = (patch) => setQ(q.id, patch);
        return (
          <div key={q.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF' }}>Q{i + 1}</span>
              <select value={q.type} onChange={(e) => set({ ...newQ(e.target.value), id: q.id, text: q.text, difficulty: q.difficulty, marks: q.marks })} style={sel}>
                {Q_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={q.difficulty} onChange={(e) => set({ difficulty: e.target.value })} style={sel}><option>Easy</option><option>Medium</option><option>Hard</option></select>
              <input type="number" value={q.marks} onChange={(e) => set({ marks: Number(e.target.value) })} style={{ ...sel, width: 52, textAlign: 'center' }} title="Marks" />
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>marks</span>
              <div style={{ flex: 1 }} />
              <Trash2 size={15} color="#EF4444" style={{ cursor: 'pointer' }} onClick={() => onChange(questions.filter((x) => x.id !== q.id))} />
            </div>

            <textarea value={q.text} onChange={(e) => set({ text: e.target.value })} placeholder={q.type === 'coding' ? 'Problem title (e.g. Two Sum)' : 'Write the question prompt…'} style={ta} />

            {(q.type === 'mcq' || q.type === 'scenario_mcq') && (
              <div style={{ marginTop: 8 }}>
                {(q.options || []).map((opt, oi) => (
                  <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input type="radio" checked={q.correct === oi} onChange={() => set({ correct: oi })} title="Mark as correct answer" />
                    <input className="input" value={opt} onChange={(e) => set({ options: q.options.map((o, j) => (j === oi ? e.target.value : o)) })} placeholder={'Option ' + (oi + 1)} style={{ flex: 1 }} />
                    <X size={14} color="#9CA3AF" style={{ cursor: 'pointer' }} onClick={() => { const wasCorrect = q.correct === oi; const nc = q.correct > oi ? q.correct - 1 : q.correct; set({ options: q.options.filter((_, j) => j !== oi), correct: wasCorrect ? -1 : nc }); }} />
                  </div>
                ))}
                <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => set({ options: [...(q.options || []), ''] })}>+ Option</button>
                <span style={{ fontSize: 11, color: q.correct < 0 ? '#DC2626' : '#9CA3AF', marginLeft: 8 }}>{q.correct < 0 ? 'Pick the correct option.' : 'Tick the radio for the correct option.'}</span>
              </div>
            )}

            {q.type === 'coding' && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><div style={lbl}>Description</div><textarea value={q.description || ''} onChange={(e) => set({ description: e.target.value })} placeholder="Describe the problem the candidate must solve…" style={{ ...ta, minHeight: 64 }} /></div>
                <div>
                  <div style={lbl}>Examples</div>
                  {(q.examples || []).map((ex, ei) => (
                    <div key={ei} style={{ border: '1px solid #F1F5F9', borderRadius: 8, padding: 10, marginBottom: 8, background: '#FAFBFC' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Example {ei + 1}</span><X size={13} color="#9CA3AF" style={{ cursor: 'pointer' }} onClick={() => set({ examples: q.examples.filter((_, j) => j !== ei) })} /></div>
                      <input className="input" value={ex.input} onChange={(e) => set({ examples: q.examples.map((x, j) => (j === ei ? { ...x, input: e.target.value } : x)) })} placeholder="Input — e.g. nums = [2,7,11,15], target = 9" style={{ marginBottom: 6 }} />
                      <input className="input" value={ex.output} onChange={(e) => set({ examples: q.examples.map((x, j) => (j === ei ? { ...x, output: e.target.value } : x)) })} placeholder="Output — e.g. [0,1]" style={{ marginBottom: 6 }} />
                      <input className="input" value={ex.explanation} onChange={(e) => set({ examples: q.examples.map((x, j) => (j === ei ? { ...x, explanation: e.target.value } : x)) })} placeholder="Explanation (optional)" />
                    </div>
                  ))}
                  <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => set({ examples: [...(q.examples || []), { input: '', output: '', explanation: '' }] })}>+ Example</button>
                </div>
                <div>
                  <div style={lbl}>Constraints</div>
                  {(q.constraints || []).map((c, ci) => (
                    <div key={ci} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <input className="input" value={c} onChange={(e) => set({ constraints: q.constraints.map((x, j) => (j === ci ? e.target.value : x)) })} placeholder="e.g. 2 <= nums.length <= 10^4" style={{ flex: 1 }} />
                      <X size={14} color="#9CA3AF" style={{ cursor: 'pointer' }} onClick={() => set({ constraints: q.constraints.filter((_, j) => j !== ci) })} />
                    </div>
                  ))}
                  <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => set({ constraints: [...(q.constraints || []), ''] })}>+ Constraint</button>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}><div style={lbl}>Starter code</div><div style={{ display: 'flex', gap: 8, marginBottom: 6 }}><select value={q.language || 'Python'} onChange={(e) => set({ language: e.target.value, starter: STARTER[e.target.value] || '' })} style={sel}>{CODE_LANGS.map((l) => <option key={l}>{l}</option>)}</select></div><textarea value={q.starter || ''} onChange={(e) => set({ starter: e.target.value })} placeholder="Starter code the candidate sees" style={mono} /></div>
                </div>
                <div><div style={lbl}>Hidden test cases <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(used to auto-grade — not shown to candidate)</span></div><textarea value={q.testcases || ''} onChange={(e) => set({ testcases: e.target.value })} placeholder={'e.g.\nassert solve([2,7,11,15], 9) == [0,1]\nassert solve([3,2,4], 6) == [1,2]'} style={mono} /></div>
              </div>
            )}

            {(q.type === 'short' || q.type === 'scenario') && <textarea value={q.answer || ''} onChange={(e) => set({ answer: e.target.value })} placeholder="Reference answer / model points the AI grades against (optional)" style={{ ...ta, marginTop: 8 }} />}
            {(q.type === 'video' || q.type === 'file') && <div className="hint" style={{ marginTop: 6 }}>{q.type === 'video' ? 'Candidate records a video response; AI + rubric score it.' : 'Candidate uploads a file (e.g. portfolio, report); reviewed against the rubric.'}</div>}
          </div>
        );
      })}
    </>
  );
}
const lbl = { fontSize: 11.5, fontWeight: 600, color: '#374151', marginBottom: 5 };
