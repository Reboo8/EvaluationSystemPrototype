import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, FileText, ListChecks, Code2, GitBranch, Languages, UserRound,
  Keyboard, Monitor, Mic, MessagesSquare, ClipboardList, Plus, Settings2, Trash2,
  Sparkles, X, ChevronUp, ChevronDown, Check, Puzzle, Loader2, Coins, AlertTriangle, Lock, LayoutTemplate,
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
  const [tplOpen, setTplOpen] = useState(false);
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

  /* the weight that actually ranks candidates lives in `weights` (matched by label) — show that, not the module's stale copy */
  const weightOf = (m) => weights.find((w) => w.label === (WEIGHT_LABEL[m.key] || metaOf(m.key).name))?.w;
  const costLine = modules.filter((m) => m.key !== 'resume' && rateOf(m.key) > 0).map((m) => `${metaOf(m.key).name} ${rateOf(m.key)}`).concat(proctorRate ? [`Proctoring ${proctorRate}`] : []).join(' · ');
  const deltaChip = costDelta !== 0 && <span className="chip" style={{ background: costDelta > 0 ? '#FEF3C7' : '#DCFCE7', color: costDelta > 0 ? '#B45309' : '#15803D' }}>{costDelta > 0 ? '+' : ''}{costDelta} cr vs {opp.assessment?.version || 'v1'}</span>;

  return (
    <>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/opportunities/' + id)}>{opp.title}</span> › Configure Assessment
      </div>

      <div className="ab-head">
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>Configure Assessment</h1>
            <span className="badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>{opp.assessment?.version || 'v1'}</span>
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Pick modules, decide how each is scored, and weight the rank list. Saving creates {nextVersion}.</div>
        </div>
        <div className="ab-actions">
          <span className="chip" style={{ background: '#F8FAFF', color: '#056FD4', border: '1px solid #E0EDFF' }}><Coins size={12} /> {fmtCr(perCandidate)} / candidate{costDelta !== 0 && <b style={{ color: costDelta > 0 ? '#B45309' : '#15803D', marginLeft: 4 }}>{costDelta > 0 ? '+' : ''}{costDelta}</b>}</span>
          <div style={{ position: 'relative' }}>
            <button className="btn-ghost" onClick={() => setTplOpen((v) => !v)}><LayoutTemplate size={14} /> Templates <ChevronDown size={14} style={{ opacity: 0.6 }} /></button>
            {tplOpen && (<>
              <div className="ab-backdrop" onClick={() => setTplOpen(false)} />
              <div className="ab-menu">
                <div className="ab-menu__title">Load a template</div>
                {assessmentTemplates.length === 0 && <div className="ab-menu__empty">No templates yet.</div>}
                {assessmentTemplates.map((t) => (
                  <div key={t.id} className="ab-menu__row" onClick={() => { applyTemplate(t); setTplOpen(false); }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ab-menu__name">{t.name}</div>
                      <div className="ab-menu__meta">{(t.modules || []).length} modules · {(t.weights || []).length} weights{t.createdAt === 'Built-in' ? ' · built-in' : ''}</div>
                    </div>
                    <button className="ab-iconbtn ab-iconbtn--danger" title="Delete template" onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); showToast('Template deleted'); }}><Trash2 size={13} /></button>
                  </div>
                ))}
                <div className="ab-menu__foot" onClick={() => { setTplOpen(false); setShowSaveTpl(true); }}><Sparkles size={13} /> Save the current setup as a template</div>
              </div>
            </>)}
          </div>
          <button className="btn-primary" disabled={!!saveBlock} title={saveBlock || `Saves ${nextVersion}`} onClick={save}><Check size={15} /> Save assessment</button>
        </div>
      </div>

      {acctBlock && (
        <div className="banner danger" style={{ marginBottom: 16 }}>
          <Lock size={17} />
          <div style={{ flex: 1 }}><b>{acctBlock}</b> You can review the configuration; saving a new version is disabled until Cuba Admin reinstates the workspace.</div>
        </div>
      )}

      <div className="ab-grid">
        {/* catalog */}
        <div className="card ab-catalog">
          <div className="ab-card__title">Add a module</div>
          <div className="ab-card__sub" style={{ marginBottom: 10 }}>Tap + to add it to the flow.</div>
          {catalog.filter((c) => availOf(c.key).state !== 'DISABLED').map((c) => {
            const av = availOf(c.key);
            const isPaused = (av.note || '').toLowerCase().includes('paused');
            const already = ['resume', 'interview', 'typing', 'personality'].includes(c.key) && modules.some((m) => m.key === c.key);
            const canAdd = (av.ok || isPaused) && !already;
            const rate = rateOf(c.key);
            const tip = !canAdd ? (already ? 'Already in this assessment — one per assessment' : av.note) : `${c.name} · ${rate ? `${rate} cr ${unitOf(c.key)}` : 'free'}`;
            return (
              <div key={c.key} className={`ab-cat${canAdd ? '' : ' ab-cat--off'}`} title={tip}>
                <div className="ab-cat__icon" style={c.custom ? { background: '#EDE9FE', color: '#6D28D9' } : undefined}><c.icon size={15} /></div>
                <div className="ab-cat__body">
                  <div className="ab-cat__name">
                    <span className="ab-ellipsis">{c.name}</span>
                    {c.custom && <span className="ab-tag ab-tag--purple">Custom</span>}
                    {av.state === 'BETA' && av.ok && !isPaused && <span className="ab-tag ab-tag--purple">Beta</span>}
                    {isPaused && <span className="ab-tag ab-tag--amber">Paused</span>}
                  </div>
                  <div className="ab-cat__meta">{c.time} · {rate ? `${rate} cr` : 'free'}</div>
                </div>
                {canAdd
                  ? <button className="ab-iconbtn ab-iconbtn--add" aria-label={`Add ${c.name}`} onClick={() => addModule(c.key, c.custom ? { rubric: c.rubric || [] } : {})}><Plus size={15} /></button>
                  : <span className="ab-cat__state">{already ? 'Added' : <Lock size={13} />}</span>}
              </div>
            );
          })}
          <button className="ab-link" onClick={() => setShowCreate(true)}><Plus size={14} /> Create a custom module</button>
        </div>

        {/* flow + weights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div className="card" style={{ padding: '18px 20px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
              <div>
                <div className="ab-card__title">Assessment flow</div>
                <div className="ab-card__sub">Candidates run these in order. Configure each module's questions and scoring.</div>
              </div>
              <span className="ab-muted" style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{modules.length} module{modules.length === 1 ? '' : 's'}</span>
            </div>

            {modules.length === 0 ? <div className="ab-empty">No modules yet. Add one from the left.</div> : (
              <div className="ab-list">
                <div className="ab-list__cols"><span>Module</span><span>Weight</span><span>Cost</span><span /></div>
                {modules.map((m, i) => {
                  const c = metaOf(m.key);
                  const av = availOf(m.key);
                  const isPaused = (av.note || '').toLowerCase().includes('paused');
                  const w = weightOf(m);
                  const rate = rateOf(m.key);
                  const parts = [
                    m.skills?.length ? m.skills.slice(0, 4).join(', ') + (m.skills.length > 4 ? ` +${m.skills.length - 4}` : '') : null,
                    m.questions?.length ? `${m.questions.length} question${m.questions.length === 1 ? '' : 's'}` : null,
                    m.rubric?.length ? `${m.rubric.length} rubric dimension${m.rubric.length === 1 ? '' : 's'}` : null,
                  ].filter(Boolean);
                  const detail = m.key === 'typing' ? `${m.tWpm || 40} WPM · ${m.tAcc || 90}% accuracy` : parts.join(' · ') || 'Not configured yet';
                  return (
                    <div key={m.id || i} className="ab-row">
                      <div className="ab-row__order">
                        <button className="ab-order" disabled={i === 0} onClick={() => moveModule(i, -1)} aria-label="Move up"><ChevronUp size={13} /></button>
                        <button className="ab-order" disabled={i === modules.length - 1} onClick={() => moveModule(i, 1)} aria-label="Move down"><ChevronDown size={13} /></button>
                      </div>
                      <div className="ab-row__num">{i + 1}</div>
                      <div className="ab-row__icon"><c.icon size={16} /></div>
                      <div className="ab-row__body">
                        <div className="ab-row__name">
                          <span>{c.name}</span>
                          {m.key === 'resume' && <span className="ab-tag ab-tag--blue">Gate</span>}
                          {av.state === 'BETA' && av.ok && !isPaused && <span className="ab-tag ab-tag--purple">Beta</span>}
                          {isPaused && <span className="ab-tag ab-tag--amber">Paused</span>}
                          {!av.ok && !isPaused && av.note && <span className="ab-tag ab-tag--amber">{av.note}</span>}
                        </div>
                        <div className="ab-row__detail">{detail}</div>
                      </div>
                      <div className="ab-row__val">{m.key === 'resume' ? <span className="ab-muted">gate</span> : w != null ? `${w}%` : <span className="ab-muted">—</span>}</div>
                      <div className="ab-row__val">{rate ? `${rate} cr` : <span className="ab-muted">free</span>}</div>
                      <div className="ab-row__actions">
                        <button className="btn-ghost ab-btn-sm" onClick={() => setEditIdx(i)}><Settings2 size={13} /> Configure</button>
                        <button className="ab-iconbtn ab-iconbtn--danger" title="Remove from the flow" onClick={() => removeModule(i)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {modules.length > 0 && (
              <div className="ab-cost" title="Rates come from the live rate card. Credits are consumed only when a service actually runs.">
                <Coins size={14} color="#056FD4" />
                <span style={{ flex: 1, minWidth: 200 }}><b>{fmtCr(perCandidate)}</b> per fully evaluated candidate <span className="ab-muted">· {costLine || 'no paid modules'}{resumeRate > 0 ? ` · resume gate ${resumeRate} cr per applicant` : ''}</span></span>
                {deltaChip}
              </div>
            )}
          </div>

          {/* weights */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div>
                <div className="ab-card__title">Rank weights</div>
                <div className="ab-card__sub">How much each score counts toward the rank order. Must total 100%. Who clears is decided by the thresholds inside each module.</div>
              </div>
              <button className="copilot" style={{ flexShrink: 0 }} onClick={suggestWeights}><Sparkles size={14} /> Suggest weights</button>
            </div>

            {unmatched.length > 0 && (
              <div className="ab-warn">
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <span><b>{unmatched.map((u) => u.label).join(', ')}</b> {unmatched.length === 1 ? 'has' : 'have'} no sub-score on the {existing.length} candidate{existing.length === 1 ? '' : 's'} already scored, so {unmatched.length === 1 ? 'it counts' : 'they count'} as 0 for them. Remove {unmatched.length === 1 ? 'it' : 'them'}, or keep {unmatched.length === 1 ? 'it' : 'them'} for candidates evaluated from now on.</span>
              </div>
            )}

            <div className="ab-weights">
              {weights.map((p, i) => {
                const ok = known(p.label);
                const pct = Math.max(0, Math.min(100, Number(p.w) || 0));
                return (
                  <div key={p.label + '-' + i} className="ab-weight">
                    <div className="ab-weight__label"><span className="ab-ellipsis">{p.label}</span>{!ok && <span className="ab-tag ab-tag--amber">no sub-score yet</span>}</div>
                    <div className="ab-weight__bar"><div className="ab-weight__fill" style={{ width: pct + '%' }} /></div>
                    <input type="number" min={0} max={100} value={p.w} onChange={(e) => setWeights((w) => w.map((x, j) => (j === i ? { ...x, w: Number(e.target.value) } : x)))} className="ab-weight__input" style={!ok ? { borderColor: '#FDE68A' } : undefined} />
                    <span className="ab-muted">%</span>
                    <button className="ab-iconbtn ab-iconbtn--danger" title="Remove" onClick={() => setWeights((w) => w.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
                  </div>
                );
              })}
              {weights.length === 0 && <div className="ab-empty">No weights yet. Add a parameter or use Suggest weights.</div>}
            </div>

            <div className="ab-weights__foot">
              <select className="input ab-select" value="" title={scoreKeys.length ? 'Only sub-scores this role’s candidates actually carry' : 'Parameters are matched by name when results arrive'}
                onChange={(e) => { const v = e.target.value; if (!v) return; setWeights((w) => [...w, { label: v, w: 0 }]); }}>
                <option value="">Add a parameter…</option>
                {paramOptions.length === 0 && <option value="" disabled>Every known sub-score is already weighted</option>}
                {paramOptions.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <div className={`ab-total ${totalW === 100 ? 'ab-total--ok' : 'ab-total--bad'}`}>Total {totalW}% {totalW === 100 ? <Check size={15} /> : <span className="ab-total__note">must equal 100%</span>}</div>
            </div>
          </div>
        </div>
      </div>

      {editIdx !== null && (
        <ConfigModal
          module={modules[editIdx]}
          name={metaOf(modules[editIdx].key).name}
          icon={metaOf(modules[editIdx].key).icon}
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
function ConfigModal({ module, name, icon: Icon = FileText, roleTitle, roleSkills, onClose, onSave }) {
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

  const blurb = isResume ? 'Screens every applicant before any paid module runs.'
    : isTyping ? 'A timed passage measures speed and accuracy.'
    : isInterview ? 'An adaptive spoken interview. Add the topics to probe and any questions it must ask.'
    : m.key === 'mcq' ? 'Auto-marked questions with one right answer.'
    : isLanguage ? 'CEFR-scored reading, writing, listening and speaking.'
    : 'Set what it tests, the questions, and how answers are scored.';
  let n = 0; const next = () => ++n;

  return (
    <div className="ab-overlay" onClick={onClose}>
      <div className="card ab-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ab-modal__head">
          <div className="ab-row__icon" style={{ width: 38, height: 38 }}><Icon size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 1 }}>{blurb}</div>
          </div>
          <button className="ab-iconbtn" aria-label="Close" onClick={onClose}><X size={17} /></button>
        </div>

        <div className="ab-modal__body">
          {!isTyping && (
            <Section n={next()} title={isResume ? 'Must-have skills' : isInterview ? 'Topics to probe' : 'What it tests'} sub={isResume ? 'Applicants missing one of these can be rejected at the gate.' : 'Questions and scoring are built around these.'}
              action={<button className="ab-ai" onClick={aiSuggestSkills} disabled={skillBusy}>{skillBusy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} Suggest</button>}>
              <div className="input ab-chips">
                {m.skills.map((sk) => <span className="skill-chip" key={sk}>{sk}<X size={11} style={{ cursor: 'pointer' }} onClick={() => setM({ ...m, skills: m.skills.filter((x) => x !== sk) })} /></span>)}
                <input value={skillDraft} onChange={(e) => setSkillDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())} placeholder={m.skills.length ? 'Add another…' : 'Type a skill and press Enter'} className="ab-chips__input" />
              </div>
            </Section>
          )}

          {isQ && <QuestionEditor n={next()} questions={m.questions || []} onChange={(qs) => setM({ ...m, questions: qs })} moduleKey={m.key} moduleName={name} defaultSkill={m.skills[0]} />}

          {isResume && (
            <Section n={next()} title="Resume parameters" sub="Each parameter is scored 0–100 by the analyser, then weighted. The weighted total must cross the pass mark."
              action={<button className="ab-ai" onClick={suggestResumeParams}><Sparkles size={13} /> Suggest</button>}>
              <div className="ab-table">
                <div className="ab-table__cols"><span>Parameter</span><span>Weight %</span><span>Min score</span><span /></div>
                {(m.resumeParams || []).map((p, i) => (
                  <div key={p.id} className="ab-table__row">
                    <input className="input" value={p.label} disabled={p.mandatory} onChange={(e) => setParam(i, 'label', e.target.value)} style={p.mandatory ? { background: '#F8FAFC', color: '#475569' } : undefined} />
                    <input type="number" value={p.weight} onChange={(e) => setParam(i, 'weight', Number(e.target.value))} className="ab-num" />
                    <input type="number" value={p.min} onChange={(e) => setParam(i, 'min', Number(e.target.value))} className="ab-num" title="Per-parameter minimum (optional)" />
                    {p.mandatory ? <span title="Always part of the gate"><Lock size={13} color="#CBD5E1" /></span> : <button className="ab-iconbtn ab-iconbtn--danger" onClick={() => setM({ ...m, resumeParams: m.resumeParams.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 12px' }}>
                {RESUME_PRESETS.filter((l) => !(m.resumeParams || []).some((p) => p.label === l)).map((l) => (
                  <button key={l} className="ab-pillbtn" onClick={() => setM({ ...m, resumeParams: [...m.resumeParams, { id: rid(), label: l, weight: 0, min: 0 }] })}>+ {l}</button>
                ))}
              </div>
              <div className="ab-inline">
                <div className={`ab-total ${rpTotal === 100 ? 'ab-total--ok' : 'ab-total--bad'}`}>Weights {rpTotal}% {rpTotal === 100 ? <Check size={14} /> : <span className="ab-total__note">must equal 100%</span>}</div>
                <div className="ab-inline__field"><span>Pass mark</span><input type="number" value={m.passThreshold} onChange={(e) => setM({ ...m, passThreshold: Number(e.target.value) })} className="ab-num" /><span className="ab-muted">% weighted</span></div>
                <label className="ab-check"><input type="checkbox" checked={m.knockout} onChange={(e) => setM({ ...m, knockout: e.target.checked })} /> Reject if a must-have skill is missing</label>
              </div>
            </Section>
          )}

          {isTyping && (
            <Section n={next()} title="Targets" sub="Candidates type a one-minute passage. Both targets must be met to pass.">
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <div><div style={lbl}>Speed (words per minute)</div><input type="number" value={m.tWpm} onChange={(e) => setM({ ...m, tWpm: Number(e.target.value) })} className="ab-num" style={{ width: 110 }} /></div>
                <div><div style={lbl}>Accuracy (%)</div><input type="number" value={m.tAcc} onChange={(e) => setM({ ...m, tAcc: Number(e.target.value) })} className="ab-num" style={{ width: 110 }} /></div>
              </div>
            </Section>
          )}

          {(isInterview || isLanguage) && (
            <Section n={next()} title="Languages" sub="Candidates pick one of these.">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {(m.languages || []).map((l) => <span className="skill-chip" key={l} style={{ background: '#FFF7ED', color: '#C2410C', borderColor: '#FED7AA' }}>{l}<X size={11} style={{ cursor: 'pointer' }} onClick={() => setM({ ...m, languages: (m.languages || []).filter((x) => x !== l) })} /></span>)}
                {['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Marathi', 'Bengali'].filter((l) => !(m.languages || []).includes(l)).map((l) => (
                  <button key={l} className="ab-pillbtn" onClick={() => setM({ ...m, languages: [...(m.languages || []), l] })}>+ {l}</button>
                ))}
              </div>
            </Section>
          )}

          {isInterview && (
            <Section n={next()} title="Must-ask questions" sub="The interviewer always covers these and adapts around them. Leave empty for a fully adaptive interview."
              action={<div className="ab-sec__actions"><button className="btn-ghost ab-btn-sm" onClick={addMustAsk}><Plus size={13} /> Add</button><button className="ab-ai" onClick={aiMustAsk} disabled={maBusy}>{maBusy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} Suggest</button></div>}>
              {(m.questions || []).map((q, i) => (
                <div key={q.id} className="ab-qline">
                  <span className="ab-row__num">{i + 1}</span>
                  <input className="input" value={q.text} onChange={(e) => setM((st) => ({ ...st, questions: st.questions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))} placeholder="e.g. Walk me through a system you designed end-to-end and the trade-offs." />
                  <button className="ab-iconbtn ab-iconbtn--danger" onClick={() => setM((st) => ({ ...st, questions: st.questions.filter((_, j) => j !== i) }))}><Trash2 size={13} /></button>
                </div>
              ))}
            </Section>
          )}

          {(showRubric || showBands) && (
            <Section n={next()} title="Scoring" sub={showRubric && showBands ? 'Rubric dimensions make up the score. Bands turn the score into an outcome.' : showBands ? 'Bands turn the score into an outcome.' : 'Rubric dimensions make up the score.'}>
              {showRubric && (
                <div style={{ marginBottom: showBands ? 16 : 0 }}>
                  <div className="ab-sub">Rubric <button className="ab-ai" style={{ marginLeft: 'auto' }} onClick={() => setM({ ...m, rubric: Array.from(new Set([...m.rubric, 'Domain knowledge', 'Problem solving', 'Communication'])) })}><Sparkles size={13} /> Suggest</button></div>
                  <div className="input ab-chips">
                    {m.rubric.map((r) => <span className="skill-chip" key={r} style={{ background: '#F0FDF4', color: '#15803D', borderColor: '#BBF7D0' }}>{r}<X size={11} style={{ cursor: 'pointer' }} onClick={() => setM({ ...m, rubric: m.rubric.filter((x) => x !== r) })} /></span>)}
                    <input value={rubricDraft} onChange={(e) => setRubricDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRubric())} placeholder={m.rubric.length ? 'Add a dimension…' : 'e.g. Problem solving — press Enter'} className="ab-chips__input" />
                  </div>
                </div>
              )}
              {showBands && (<>
                <div className="ab-sub">Score bands</div>
                <BandEditor bands={m.bands} onChange={(b) => setM({ ...m, bands: b })} />
              </>)}
            </Section>
          )}
        </div>

        <div className="ab-modal__foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave({ ...m, gate: computeGate() })}>Save module</button>
        </div>
      </div>
    </div>
  );
}

/* numbered section inside the module editor */
function Section({ n, title, sub, action, children }) {
  return (
    <section className="ab-sec">
      <div className="ab-sec__head">
        <div className="ab-sec__n">{n}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ab-sec__title">{title}</div>
          {sub && <div className="ab-sec__sub">{sub}</div>}
        </div>
        {action}
      </div>
      <div className="ab-sec__body">{children}</div>
    </section>
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

const bandTone = (label = '') => (/reject|fail|no/i.test(label) ? '#EF4444' : /review|hold|maybe/i.test(label) ? '#F59E0B' : /advance|pass|clear|yes|hire/i.test(label) ? '#16A34A' : '#056FD4');
function BandEditor({ bands, onChange, max = 100 }) {
  const rows = bands && bands.length ? bands : DEFAULT_BANDS;
  const set = (i, k, v) => onChange(rows.map((b, j) => (j === i ? { ...b, [k]: k === 'label' ? v : (v === '' ? '' : Number(v)) } : b)));
  const add = () => onChange([...rows, { from: (Number(rows[rows.length - 1]?.to) || 0) + 1, to: max, label: 'New band' }]);
  const span = rows.reduce((a, b) => a + Math.max(0, (Number(b.to) || 0) - (Number(b.from) || 0) + 1), 0) || 1;
  return (
    <div>
      <div className="ab-bands" aria-hidden="true">
        {rows.map((b, i) => <div key={i} className="ab-bands__seg" style={{ flex: Math.max(0, (Number(b.to) || 0) - (Number(b.from) || 0) + 1) / span, background: bandTone(b.label) }} title={`${b.label} ${b.from}–${b.to}`} />)}
      </div>
      <div className="ab-table">
        <div className="ab-table__cols ab-table__cols--bands"><span>From</span><span>To</span><span>Outcome</span><span /></div>
        {rows.map((b, i) => (
          <div key={i} className="ab-table__row ab-table__row--bands">
            <input type="number" value={b.from} onChange={(e) => set(i, 'from', e.target.value)} className="ab-num" />
            <input type="number" value={b.to} onChange={(e) => set(i, 'to', e.target.value)} className="ab-num" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="ab-dot" style={{ background: bandTone(b.label) }} /><input className="input" value={b.label} onChange={(e) => set(i, 'label', e.target.value)} placeholder="e.g. Advance" /></div>
            <button className="ab-iconbtn ab-iconbtn--danger" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <button className="ab-link" style={{ marginTop: 6 }} onClick={add}><Plus size={13} /> Add a band</button>
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

function QuestionEditor({ n, questions, onChange, moduleKey, moduleName, defaultSkill }) {
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
    <Section n={n} title={<>Questions <span className="ab-muted" style={{ fontWeight: 500 }}>{questions.length}</span></>} sub="Write your own or draft with AI. Leave empty and AI generates at run time."
      action={<div className="ab-sec__actions"><button className="btn-ghost ab-btn-sm" onClick={add}><Plus size={13} /> Add</button><button className="ab-ai" onClick={genAI} disabled={busy}>{busy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} {busy ? 'Drafting…' : 'Draft with AI'}</button></div>}>
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
    </Section>
  );
}
const lbl = { fontSize: 11.5, fontWeight: 600, color: '#374151', marginBottom: 5 };
