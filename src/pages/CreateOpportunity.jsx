import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, X, Sparkles, Loader2, Code2, Headphones, Stethoscope, PenTool, TrendingUp, Calculator, Info, AlertTriangle, Lock } from 'lucide-react';
import { useApp, ROLE_CATALOG, fmtCr, CLIENT_STATUS } from '../store.jsx';
import { PendingChip } from '../components/admin/ui.jsx';
import { draftJD, suggestSkills, designAssessment } from '../ai.js';
import RichText from '../components/RichText.jsx';

const STEPS = ['Basic Info', 'Evaluation Criteria', 'Skills & Languages', 'Job Description', 'Assessment', 'Review'];
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CAT_ICON = { it: Code2, cx: Headphones, health: Stethoscope, design: PenTool, sales: TrendingUp, finops: Calculator };
const MODNAME = { resume: 'Resume / JD Screen', written: 'Written', mcq: 'MCQ / Objective', coding: 'Coding', sjt: 'Situational Judgement', language: 'Language / CEFR', personality: 'Personality', typing: 'Typing', computer: 'Computer Literacy', interview: 'AI Interview', simulation: 'Simulation', custom: 'Custom' };
const STORAGE_KEY = 'reboo8_new_opp_draft';
const num = (n) => (Number(n) || 0).toLocaleString('en-IN');
const DEFAULT_FORM = {
  title: '', location: '', workMode: 'Remote', roleType: '', shiftTime: '',
  requiredPositions: '', closingDate: '', department: '', jobDescription: '',
  minExperienceYears: '', minEducation: '', minCefrLevel: '',
  minTypingWpm: '', minTypingAccuracy: '', minAssessmentScore: '', minInterviewScore: '',
  requiredSkills: [], requiredLanguages: [],
};
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; } };

function TagInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = (t) => { const v = t.trim().replace(/,$/, ''); if (v && !value.includes(v)) onChange([...value, v]); setDraft(''); };
  return (
    <div className="input" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 46, alignItems: 'center' }}>
      {value.map((t) => (
        <span className="skill-chip" key={t}>{t}<X size={12} style={{ cursor: 'pointer' }} onClick={() => onChange(value.filter((x) => x !== t))} /></span>
      ))}
      <input value={draft} placeholder={value.length ? '' : placeholder}
        onChange={(e) => { if (e.target.value.endsWith(',')) add(e.target.value); else setDraft(e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }}
        onBlur={() => add(draft)}
        style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', fontSize: 13.5, fontFamily: 'inherit', background: 'transparent' }} />
    </div>
  );
}

const Label = ({ children, req }) => <label className="field-label">{children}{req && <span className="req"> *</span>}</label>;

export default function CreateOpportunity() {
  const nav = useNavigate();
  const { addOpportunity, clientEstimate, clientCanStart, clientWallet, currentClient, currentClientId, addAudit } = useApp();
  const [step, setStep] = useState(() => loadDraft()?.step || 1);
  const [f, setF] = useState(() => ({ ...DEFAULT_FORM, ...(loadDraft()?.f || {}) }));
  const [restored, setRestored] = useState(() => !!loadDraft());
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const clearDraft = () => { try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } };

  // role-template picker (category → role)
  const [cat, setCat] = useState(() => loadDraft()?.cat || ROLE_CATALOG[0].id);
  const [tpl, setTpl] = useState(() => loadDraft()?.tpl || null);
  const activeCat = ROLE_CATALOG.find((c) => c.id === cat);
  const applyRole = (role, catName) => {
    setF((s) => ({ ...s, title: role.title, department: role.department || s.department, roleType: s.roleType || 'Full-time', requiredSkills: role.skills || [], requiredLanguages: role.languages || [], jobDescription: role.jd || s.jobDescription, assessment: role.assessment, minCefrLevel: role.minCefrLevel || s.minCefrLevel }));
    setTpl({ role: role.title, cat: catName });
  };
  const clearTemplate = () => { setF((s) => ({ ...s, title: '', requiredSkills: [], requiredLanguages: [], jobDescription: '', assessment: undefined })); setTpl(null); };

  // autosave the in-progress form so a refresh doesn't lose it
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ f, step, tpl, cat })); } catch { /* ignore */ } }, [f, step, tpl, cat]);
  const discardDraft = () => { setF(DEFAULT_FORM); setStep(1); setTpl(null); setCat(ROLE_CATALOG[0].id); setRestored(false); clearDraft(); };

  const [aiBusy, setAiBusy] = useState('');
  const doDraftJD = async () => {
    setAiBusy('jd');
    try {
      set('jobDescription', await draftJD({
        title: f.title, skills: f.requiredSkills, languages: f.requiredLanguages, roleType: f.roleType, location: f.location, workMode: f.workMode, department: f.department,
        minExperienceYears: f.minExperienceYears, minEducation: f.minEducation, minCefrLevel: f.minCefrLevel,
      }));
    }
    catch (e) { alert('AI failed: ' + e.message); }
    finally { setAiBusy(''); }
  };
  const doSuggestSkills = async () => {
    setAiBusy('skills');
    try { const arr = await suggestSkills({ title: f.title, jd: f.jobDescription }); set('requiredSkills', Array.from(new Set([...f.requiredSkills, ...arr]))); }
    catch (e) { alert('AI failed: ' + e.message); }
    finally { setAiBusy(''); }
  };

  const totalAW = (f.assessment?.weights || []).reduce((a, b) => a + (Number(b.w) || 0), 0);
  const genAssessment = async () => {
    setAiBusy('assess');
    try { set('assessment', await designAssessment({ title: f.title, skills: f.requiredSkills, languages: f.requiredLanguages, jd: f.jobDescription })); setTpl(null); }
    catch (e) { alert('AI failed: ' + e.message); }
    finally { setAiBusy(''); }
  };
  const setWeight = (i, val) => setF((s) => ({ ...s, assessment: { ...s.assessment, weights: s.assessment.weights.map((x, j) => (j === i ? { ...x, w: Number(val) || 0 } : x)) } }));
  const genStarted = useRef(false);
  useEffect(() => {
    if (step === 5 && !f.assessment && !genStarted.current) { genStarted.current = true; genAssessment().finally(() => { genStarted.current = false; }); }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [step]);

  const canNext = step === 1 ? (f.title.trim() && f.requiredPositions && f.closingDate)
    : step === 5 ? ((f.assessment?.weights?.length || 0) > 0 && totalAW === 100)
    : true;

  /* §03: SUSPENDED / OFFBOARDING restrict NEW activity — a wallet reason does not (a 0-credit ACTIVE client may still publish). */
  const acctBlock = currentClient?.status && currentClient.status !== 'ACTIVE'
    ? `Account is ${CLIENT_STATUS[currentClient.status]?.label || currentClient.status} — new opportunities cannot be created.`
    : currentClient?.paused ? 'Usage is temporarily paused by Cuba Admin — new opportunities cannot be created.' : '';

  const create = (status) => {
    if (acctBlock) return;
    const id = addOpportunity({ ...f, ...(status ? { status } : {}), requiredPositions: Number(f.requiredPositions) || 0 });
    addAudit('Opportunity', `Created opportunity${status === 'DRAFT' ? ' (draft)' : ''}`, f.title || 'Untitled opportunity', {
      clientId: currentClientId, actor: `${currentClient?.name || 'Client'} · Recruiter`, role: 'client',
      reason: `${Number(f.requiredPositions) || 0} positions · ${(f.assessment?.weights || []).map((w) => `${w.label} ${w.w}%`).join(', ') || 'default weights'}`,
    });
    clearDraft();
    nav('/opportunities/' + id);
  };
  const publish = () => create(null);

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {acctBlock && (
        <div className="banner danger" style={{ margin: 0 }}>
          <Lock size={17} />
          <div style={{ flex: 1 }}><b>{acctBlock}</b> Existing opportunities stay readable and running evaluations finish safely. <span style={{ color: '#056FD4', fontWeight: 700, cursor: 'pointer' }} onClick={() => nav('/support')}>Contact support →</span></div>
        </div>
      )}
      {restored && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ fontSize: 12.5, color: '#1E40AF' }}>↩ Restored your unsaved draft — pick up where you left off.</span>
          <button className="btn-ghost" style={{ padding: '5px 11px', fontSize: 12 }} onClick={discardDraft}>Discard &amp; start fresh</button>
        </div>
      )}
      {/* stepper */}
      <div className="card" style={{ padding: '22px 32px', display: 'flex' }}>
        {STEPS.map((s, i) => {
          const n = i + 1; const state = n < step ? 'done' : n === step ? 'active' : '';
          return (
            <div key={s} style={{ display: 'contents' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 90 }}>
                <div className={'step-circle ' + state}>{n < step ? <Check size={15} /> : n}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, textAlign: 'center', color: n < step ? '#059669' : n === step ? '#056FD4' : '#9CA3AF' }}>{s}</div>
              </div>
              {n < STEPS.length && <div className={'step-conn ' + (n < step ? 'done' : '')} />}
            </div>
          );
        })}
      </div>

      {/* panels */}
      <div className="card" style={{ padding: '26px 30px' }}>
        {step === 1 && (
          <>
            {/* category → role template picker */}
            <div style={{ marginBottom: 22, border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 18px', background: '#F8FBFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Start from a role template <span style={{ color: '#9CA3AF', fontWeight: 500 }}>(optional)</span></div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Pick a category, then a role — we prefill the JD, skills, languages &amp; a tailored assessment. Edit anything after.</div>
                </div>
                {tpl && <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }} onClick={clearTemplate}>Start from scratch</button>}
              </div>
              {/* categories */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {ROLE_CATALOG.map((c) => { const Icon = CAT_ICON[c.id] || Sparkles; const on = cat === c.id; return (
                  <button key={c.id} onClick={() => setCat(c.id)} className={on ? 'btn-primary' : 'btn-ghost'} style={{ padding: '7px 12px', fontSize: 12.5 }}><Icon size={14} /> {c.name}</button>
                ); })}
              </div>
              {/* roles in category */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                {activeCat.roles.map((r) => { const on = tpl?.role === r.title; return (
                  <div key={r.id} onClick={() => applyRole(r, activeCat.name)} style={{ border: `1.5px solid ${on ? '#056FD4' : '#E2E8F0'}`, background: on ? '#EFF6FF' : '#fff', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' }}
                    onMouseEnter={(e) => { if (!on) e.currentTarget.style.borderColor = '#93C5FD'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.borderColor = '#E2E8F0'; }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.title}</div>
                      {on && <Check size={15} color="#056FD4" />}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 3 }}>{r.skills.slice(0, 3).join(' · ')}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{r.assessment.weights.length} ranked params · {r.assessment.modules.length} modules</div>
                  </div>
                ); })}
              </div>
            </div>

            {tpl && <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '9px 12px', marginBottom: 18, fontSize: 12.5, color: '#15803D' }}><Check size={14} /> Prefilled from <b>{tpl.role}</b> · {tpl.cat} — edit anything below; the assessment is preconfigured.</div>}

            <H title="Basic Info" sub="Set up the core details for this opportunity" />
            <div style={{ marginBottom: 16 }}><Label req>Opportunity Title</Label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Software Developer" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 16 }}>
              <div><Label req>Location</Label><input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Delhi, Remote" /></div>
              <div><Label req>Work Mode</Label>
                <div style={{ display: 'flex', gap: 8 }}>{['Remote', 'Hybrid', 'On-site'].map((m) => (
                  <div key={m} className={'radio-card' + (f.workMode === m ? ' active' : '')} onClick={() => set('workMode', m)}>{m}</div>))}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 16 }}>
              <div><Label req>Role Type</Label><select className="input" value={f.roleType} onChange={(e) => set('roleType', e.target.value)}><option value="">Select type</option><option>Full-time</option><option>Part-time</option><option>Contract</option></select></div>
              <div><Label>Shift Time</Label><select className="input" value={f.shiftTime} onChange={(e) => set('shiftTime', e.target.value)}><option value="">Select shift</option><option>Morning (6 AM – 2 PM)</option><option>General</option><option>Night</option></select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 16 }}>
              <div><Label req>Vacancy</Label><input className="input" type="number" value={f.requiredPositions} onChange={(e) => set('requiredPositions', e.target.value)} placeholder="0" /></div>
              <div><Label req>Closing Date</Label><input className="input" type="date" value={f.closingDate} onChange={(e) => set('closingDate', e.target.value)} /></div>
            </div>
            <div style={{ maxWidth: '48%' }}><Label>Department</Label><select className="input" value={f.department} onChange={(e) => set('department', e.target.value)}><option value="">Select department</option><option>SaaS / Tech</option><option>Operations</option><option>Sales</option><option>Healthcare</option>{f.department && !['SaaS / Tech', 'Operations', 'Sales', 'Healthcare'].includes(f.department) && <option>{f.department}</option>}</select></div>
          </>
        )}

        {step === 4 && (
          <>
            <H title="Job Description" sub="Describe the role, responsibilities, and the ideal candidate" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Label req>Description</Label>
              <button className="copilot" disabled={!f.title.trim() || aiBusy === 'jd'} onClick={doDraftJD} title={!f.title.trim() ? 'Add a title first (Step 1)' : 'Draft this with AI'}>
                {aiBusy === 'jd' ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {aiBusy === 'jd' ? 'Drafting…' : 'AI: Draft JD'}
              </button>
            </div>
            <textarea className="input" style={{ minHeight: 220, lineHeight: 1.7, resize: 'vertical' }} value={f.jobDescription} onChange={(e) => set('jobDescription', e.target.value)} placeholder="Describe the role, key responsibilities, and ideal candidate profile." />
            <div className="hint">Tip: use headings, short paragraphs and bullet points — it renders formatted (and reads better to candidates).</div>
            {f.jobDescription && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>Preview</div>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px 18px' }}><RichText text={f.jobDescription} /></div>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <H title="Evaluation Criteria" sub="Minimum thresholds candidates must meet to qualify" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div><Label>Min. Experience (years)</Label><input className="input" type="number" value={f.minExperienceYears} onChange={(e) => set('minExperienceYears', e.target.value)} placeholder="0" /></div>
              <div><Label>Min. Education</Label><select className="input" value={f.minEducation} onChange={(e) => set('minEducation', e.target.value)}><option value="">Any</option><option>Graduate (Bachelor's)</option><option>Post-Graduate</option></select></div>
              <div><Label>Min. CEFR Level</Label><select className="input" value={f.minCefrLevel} onChange={(e) => set('minCefrLevel', e.target.value)}><option value="">No minimum</option>{CEFR.map((l) => <option key={l}>{l}</option>)}</select></div>
              <div /><div><Label>Min. Typing Speed (WPM)</Label><input className="input" type="number" value={f.minTypingWpm} onChange={(e) => set('minTypingWpm', e.target.value)} placeholder="0" /></div>
              <div><Label>Min. Typing Accuracy (%)</Label><input className="input" type="number" value={f.minTypingAccuracy} onChange={(e) => set('minTypingAccuracy', e.target.value)} placeholder="0" /></div>
              <div><Label>Min. Assessment Score (/100)</Label><input className="input" type="number" value={f.minAssessmentScore} onChange={(e) => set('minAssessmentScore', e.target.value)} placeholder="0" /></div>
              <div><Label>Min. Interview Score (/100)</Label><input className="input" type="number" value={f.minInterviewScore} onChange={(e) => set('minInterviewScore', e.target.value)} placeholder="0" /></div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <H title="Skills & Languages" sub="Define the skills and languages candidates must have" />
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Label>Required Skills</Label>
                <button className="copilot" disabled={!f.title.trim() || aiBusy === 'skills'} onClick={doSuggestSkills} title={!f.title.trim() ? 'Add a title first (Step 1)' : 'Suggest skills with AI'}>
                  {aiBusy === 'skills' ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {aiBusy === 'skills' ? 'Thinking…' : 'AI: Suggest skills'}
                </button>
              </div>
              <TagInput value={f.requiredSkills} onChange={(v) => set('requiredSkills', v)} placeholder="Type a skill, press Enter…" />
            </div>
            <div><Label>Required Languages</Label><TagInput value={f.requiredLanguages} onChange={(v) => set('requiredLanguages', v)} placeholder="Type a language, press Enter…" /></div>
          </>
        )}

        {step === 5 && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <H title="Assessment" sub="AI designs a role-specific assessment from everything above. Tweak the rank weights here; fine-tune modules, questions, rubrics & thresholds in Configure Assessment after publishing." />
              <button className="copilot" disabled={aiBusy === 'assess'} onClick={genAssessment} style={{ flexShrink: 0, marginTop: 4 }}>{aiBusy === 'assess' ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {aiBusy === 'assess' ? 'Designing…' : (f.assessment ? 'Regenerate' : 'Design with AI')}</button>
            </div>
            {aiBusy === 'assess' && !f.assessment && <div style={{ padding: 30, textAlign: 'center', color: '#6B7280', fontSize: 13 }}><Loader2 size={16} className="spin" style={{ verticalAlign: -3 }} /> AI is designing the assessment for “{f.title || 'this role'}”…</div>}
            {f.assessment && (
              <>
                {tpl && <div className="hint" style={{ marginBottom: 12 }}>Based on the {tpl.role} template — click Regenerate to let AI redesign from your inputs.</div>}
                <div className="field-label" style={{ marginTop: 4 }}>Modules <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(candidate runs in order)</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                  {f.assessment.modules.map((m, i) => (
                    <span key={i} className="chip" style={{ background: '#F8FAFF', color: '#056FD4', border: '1px solid #E0EDFF' }}>{i + 1}. {MODNAME[m.key] || m.key}{m.weight ? ` · ${m.weight}%` : ''}{m.languages?.length ? ` · ${m.languages.length} lang` : ''}</span>
                  ))}
                </div>
                <div className="field-label">Rank weights <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(the order — editable, must total 100%)</span></div>
                {f.assessment.weights.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.label}</span>
                    <input type="number" value={p.w} onChange={(e) => setWeight(i, e.target.value)} style={{ width: 64, padding: '7px 8px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, textAlign: 'center', fontFamily: 'inherit' }} />
                    <span style={{ fontSize: 13, color: '#9CA3AF' }}>%</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #F3F4F6', fontSize: 14, fontWeight: 700 }}>
                  <span>Total</span><span style={{ color: totalAW === 100 ? '#16A34A' : '#DC2626' }}>{totalAW}% {totalAW === 100 ? '✓' : '— adjust to 100%'}</span>
                </div>
                <div className="hint" style={{ marginTop: 14 }}>After publishing, open <b>Configure Assessment</b> on the opportunity to add your own questions and edit rubrics & thresholds.</div>
              </>
            )}
          </>
        )}

        {step === 6 && (
          <>
            <H title="Review & Publish" sub="Confirm all details before publishing this opportunity" />
            <Rev label="Title" v={f.title} />
            <Rev label="Department" v={f.department} />
            <Rev label="Location / Work mode" v={[f.location, f.workMode].filter(Boolean).join(' · ')} />
            <Rev label="Role type / Shift" v={[f.roleType, f.shiftTime].filter(Boolean).join(' · ')} />
            <Rev label="Vacancy" v={f.requiredPositions ? `${f.requiredPositions} positions` : ''} />
            <Rev label="Closing Date" v={f.closingDate} />
            <Rev label="Min. Experience" v={f.minExperienceYears ? `${f.minExperienceYears} years` : ''} />
            <Rev label="Min. Education" v={f.minEducation} />
            <Rev label="Min. CEFR Level" v={f.minCefrLevel} />
            <Rev label="Typing (WPM / Accuracy)" v={(f.minTypingWpm || f.minTypingAccuracy) ? `${f.minTypingWpm || '—'} WPM / ${f.minTypingAccuracy || '—'}%` : ''} />
            <Rev label="Min. Assessment / Interview" v={(f.minAssessmentScore || f.minInterviewScore) ? `${f.minAssessmentScore || '—'} / ${f.minInterviewScore || '—'}` : ''} />
            <Rev label="Assessment" v={f.assessment?.weights?.length ? `${tpl ? tpl.role + ' template · ' : ''}${f.assessment.weights.map((w) => w.label).join(' · ')}` : 'Default (Written · AI Interview · Integrity)'} />
            <ChipRow label="Skills" items={f.requiredSkills} />
            <ChipRow label="Languages" items={f.requiredLanguages} tone="orange" />
            <FundingCard
              estimate={clientEstimate({ requiredPositions: f.requiredPositions, assessment: f.assessment || { modules: [], weights: [] } })}
              wallet={clientWallet}
              start={clientCanStart()}
              acctBlock={acctBlock}
              onTopUp={() => nav('/billing')}
            />
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Job Description</div>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px 18px' }}>
                {f.jobDescription ? <RichText text={f.jobDescription} /> : <span style={{ fontSize: 13, color: '#9CA3AF' }}>No description added yet — add one in the Job Description step.</span>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* nav */}
      <div className="card" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="btn-ghost" disabled={step === 1} onClick={() => setStep((s) => s - 1)}><ChevronLeft size={15} /> Back</button>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>Step {step} of {STEPS.length}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" disabled={!!acctBlock} title={acctBlock || 'Save without publishing'} onClick={() => create('DRAFT')}>Save as Draft</button>
          {step < STEPS.length
            ? <button className="btn-primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Next <ChevronRight size={15} /></button>
            : <button className="btn-success" disabled={!!acctBlock} title={acctBlock || 'Publish this opportunity'} onClick={publish}><Check size={15} /> Publish Opportunity</button>}
        </div>
      </div>
    </div>
  );
}

const H = ({ title, sub }) => (<><div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{title}</div><div style={{ fontSize: 13, color: '#6B7280', marginBottom: 22 }}>{sub}</div></>);
const Rev = ({ label, v }) => (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}><span style={{ color: '#9CA3AF' }}>{label}</span><span style={{ fontWeight: 600 }}>{v || '—'}</span></div>);
const ChipRow = ({ label, items, tone }) => (
  <div style={{ display: 'flex', gap: 16, padding: '11px 0', borderBottom: '1px solid #F3F4F6' }}>
    <span style={{ fontSize: 13, color: '#9CA3AF', minWidth: 120, flexShrink: 0 }}>{label}</span>
    <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-end' }}>
      {items && items.length
        ? items.map((s) => <span key={s} className="skill-chip" style={tone === 'orange' ? { background: '#FFF7ED', color: '#C2410C', borderColor: '#FED7AA' } : undefined}>{s}</span>)
        : <span style={{ fontSize: 13, fontWeight: 600 }}>—</span>}
    </div>
  </div>
);

/* ── funding guidance (spec §04): a safety requirement, not a pre-charge ── */
function FundingCard({ estimate: est, wallet, start, acctBlock, onTopUp }) {
  const funded = est.total <= wallet.available;
  return (
    <div className="card" style={{ padding: '18px 20px', marginTop: 20, background: '#F8FBFF', border: '1px solid #E0EDFF' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Calculator size={15} color="#056FD4" /> Funding guidance</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>Recommended credits to safely run this opportunity end-to-end, based on your hiring target.</div>
        </div>
        <span className="badge" style={{ background: funded ? '#DCFCE7' : '#FEF3C7', color: funded ? '#15803D' : '#B45309' }}>
          {funded ? 'Funded' : `Underfunded by ${fmtCr(Math.max(0, est.total - wallet.available))}`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        <FGStat label="Hiring target" value={num(est.target)} sub="positions to fill" />
        <FGStat label={<>Resume-gate capacity<PendingChip /></>} value={`${num(est.resumeCap)} cand.`} sub={`target × 50 → ${num(est.resumeCredits)} cr`} />
        <FGStat label={<>Full-evaluation capacity<PendingChip /></>} value={`${num(est.fullCap)} cand.`} sub={`target × 10 → ${num(est.fullCredits)} cr`} />
        <FGStat label="Per fully-evaluated candidate" value={`${num(est.perCandidate)} cr`} />
        <FGStat label="Recommended funding" value={fmtCr(est.total)} tone={funded ? 'ok' : 'warn'} sub={`vs ${fmtCr(wallet.available)} available`} />
      </div>
      {!funded && (
        <div style={{ fontSize: 12.5, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '9px 12px', marginTop: 12 }}>
          Underfunded by {fmtCr(Math.max(0, est.total - wallet.available))} — you can still publish; new evaluations pause when credits run out.
        </div>
      )}
      {acctBlock ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#991B1B', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '9px 12px', marginTop: 10 }}>
          <Lock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{acctBlock} Unlike a low wallet, an account-status restriction also blocks publishing — including as a draft.</span>
        </div>
      ) : !start.ok && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#991B1B', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '9px 12px', marginTop: 10 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{start.reason} Evaluations cannot start until this is resolved — <span style={{ color: '#056FD4', fontWeight: 700, cursor: 'pointer' }} onClick={onTopUp}>top up →</span>. This is a wallet reason, so publishing (as a draft or live) is still allowed.</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: '#9CA3AF', marginTop: 12, lineHeight: 1.5 }}>
        <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Safety requirement, not a pre-charge — credits are consumed only when services actually run.</span>
      </div>
    </div>
  );
}
function FGStat({ label, value, sub, tone }) {
  const col = tone === 'ok' ? '#15803D' : tone === 'warn' ? '#B45309' : '#14212A';
  return (
    <div style={{ minWidth: 118 }}>
      <div className="eyebrow">{label}</div>
      <div className="tnum" style={{ fontSize: 15, fontWeight: 700, color: col, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
