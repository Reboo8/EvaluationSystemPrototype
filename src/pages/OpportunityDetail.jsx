import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, Calendar, MapPin, Clock, Settings2, Send, Rocket, Pause, Play, Check, AlertTriangle, Calculator, Bug, LifeBuoy, Lock, Coins, ArrowRight } from 'lucide-react';
import { useApp, weightedScore, ranked, fmtCr, CLIENT_STATUS, JOB_KINDS } from '../store.jsx';
import { PendingChip, Mono } from '../components/admin/ui.jsx';
import OppTabs from '../components/OppTabs.jsx';
import RichText from '../components/RichText.jsx';

const PALETTE = [['#DBEAFE', '#1E40AF'], ['#DCFCE7', '#15803D'], ['#EDE9FE', '#6D28D9'], ['#FFEDD5', '#C2410C'], ['#FCE7F3', '#BE185D']];
const ini = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const STATUS = (s) => s === 'OPEN' ? ['#DCFCE7', '#15803D'] : s === 'DRAFT' ? ['#F3F4F6', '#6B7280'] : s === 'PAUSED' ? ['#FEF3C7', '#B45309'] : ['#DBEAFE', '#1E40AF'];
const MODNAME = { resume: 'Resume / JD Screen', written: 'Written', mcq: 'MCQ', coding: 'Coding', sjt: 'SJT', language: 'Language', personality: 'Personality', typing: 'Typing', computer: 'Computer Literacy', interview: 'AI Interview', simulation: 'Simulation', custom: 'Custom' };
/* failed-job kind → the client-facing support case type it should pre-fill (spec §09) */
const JOB_CASE = { RESUME_PARSE_FAILED: 'resume_stuck', STUCK_ASSESSMENT: 'assessment_crash', STUCK_INTERVIEW: 'interview_failed', AI_PROVIDER_FAILURE: 'interview_failed', PENDING_SCORE: 'result_missing', NOTIFICATION_FAILURE: 'invite_expired' };
const num = (n) => (Number(n) || 0).toLocaleString('en-IN');

const niceDate = (d) => { try { const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; } };

export default function OpportunityDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getOpportunity, getCandidates, setOppStatus, clientEstimate, clientCanStart, clientWallet, currentClient, currentClientId, clientLedger, failedJobs, moduleAvailableFor, addAudit } = useApp();
  const [toast, setToast] = useState(null);
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 2000); };
  const opp = getOpportunity(id);

  if (!opp) return <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Opportunity not found. <span style={{ color: '#056FD4', cursor: 'pointer' }} onClick={() => nav('/opportunities')}>Back to list</span></div>;

  const weights = opp.assessment?.weights || [];
  const agents = ranked(getCandidates(id), weights);
  const fn = opp.funnel || { applied: 0, screening: 0, assessment: 0, interview: 0, cleared: 0 };
  const [sbg, sfg] = STATUS(opp.status);
  const pct = opp.requiredPositions ? Math.round((opp.cleared / opp.requiredPositions) * 100) : 0;
  const stillNeeded = Math.max(0, opp.requiredPositions - opp.cleared);
  const c = opp.criteria || {};
  const est = clientEstimate(opp);
  const funded = est.total <= clientWallet.available;
  const start = clientCanStart();

  /* §03: an account-status reason restricts NEW ACTIVITY (config + sending); a wallet reason only pauses the next paid evaluation. */
  const acctBlock = currentClient?.status && currentClient.status !== 'ACTIVE'
    ? `Account is ${CLIENT_STATUS[currentClient.status]?.label || currentClient.status} — new activity is restricted.`
    : currentClient?.paused ? 'Usage is temporarily paused by Cuba Admin — new activity is restricted.' : '';
  const gated = (title) => (acctBlock ? { disabled: true, title: acctBlock } : { title });
  const changeStatus = (next, msg) => {
    if (acctBlock) return;
    setOppStatus(id, next);
    addAudit('Opportunity', `Opportunity status → ${next}`, opp.title, { clientId: currentClientId, actor: `${currentClient?.name || 'Client'} · Recruiter`, role: 'client' });
    showToast(msg);
  };

  /* §10 boundary: Cuba Admin controls WHAT is offered — surface it on the running role, not only in the builder. */
  const modAvail = (opp.assessment?.modules || []).map((m) => ({ m, av: moduleAvailableFor(m.key, currentClientId) }));
  const blockedMods = modAvail.filter((x) => !x.av.ok);
  const availOf = (key) => modAvail.find((x) => x.m.key === key)?.av || { ok: true, note: '' };

  /* §09: the client's own stuck / failed evaluations — a technical failure is never a candidate failure. */
  const oppJobs = (failedJobs || []).filter((j) => j.clientId === currentClientId && j.oppId === id && j.status === 'OPEN');
  const heldByJobs = oppJobs.reduce((a, j) => a + (j.creditsHeld || 0), 0);
  const ticketLink = (j) => `/support?case=${JOB_CASE[j.kind] || 'other'}&job=${encodeURIComponent(j.id)}&candidate=${encodeURIComponent(j.candidate || '')}&opp=${encodeURIComponent(j.oppTitle || opp.title)}`;

  /* §05: what this role has ACTUALLY cost, read straight off the immutable ledger (not an estimate). */
  const spendRows = (clientLedger || []).filter((e) => e.oppId === id && ['CONSUMPTION', 'SETTLEMENT', 'OVERDRAFT', 'REFUND'].includes(e.type));
  const spent = Math.max(0, spendRows.reduce((a, e) => a - (e.credits || 0), 0));
  const spendByModule = Object.entries(spendRows.reduce((acc, e) => { const k = e.module || 'Other'; acc[k] = (acc[k] || 0) - (e.credits || 0); return acc; }, {})).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const perCleared = opp.cleared > 0 && spent > 0 ? Math.round(spent / opp.cleared) : null;
  const runway = est.perCandidate > 0 ? Math.floor(clientWallet.available / est.perCandidate) : null;

  return (
    <>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/opportunities')}>Opportunities</span> › {opp.title}
      </div>

      {acctBlock && (
        <div className="banner danger"><Lock size={17} />
          <div style={{ flex: 1 }}><b>{acctBlock}</b> Publishing, pausing and sending are disabled for this workspace. Evaluations already running finish safely. <span style={{ color: '#056FD4', fontWeight: 700, cursor: 'pointer' }} onClick={() => nav('/support')}>Contact support →</span></div>
        </div>
      )}

      {!acctBlock && !start.ok && (
        <div className="banner warn"><AlertTriangle size={17} />
          <div style={{ flex: 1 }}><b>{start.reason}</b> Running evaluations continue; new ones wait. <span style={{ color: '#056FD4', fontWeight: 700, cursor: 'pointer' }} onClick={() => nav('/billing')}>Top up →</span></div>
        </div>
      )}

      {blockedMods.length > 0 && (
        <div className="banner warn"><Pause size={17} />
          <div style={{ flex: 1 }}>
            <b>{blockedMods.map((x) => MODNAME[x.m.key] || x.m.key).join(', ')} {blockedMods.length === 1 ? 'is' : 'are'} not available right now — {blockedMods[0].av.note || 'changed by Cuba Admin'}.</b>{' '}
            Candidates will hold at that stage; interviews already running finish. This role carries {blockedMods.reduce((a, x) => a + (x.m.weight || 0), 0)}% of its rank weight on {blockedMods.length === 1 ? 'it' : 'them'}.
          </div>
        </div>
      )}

      {oppJobs.length > 0 && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: 18, borderColor: '#FDE68A', background: '#FFFBEB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
            <Bug size={16} color="#B45309" />
            <h2 style={{ fontSize: 15.5, fontWeight: 700, margin: 0, color: '#92400E' }}>Evaluations needing attention <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>{oppJobs.length}</span></h2>
            {heldByJobs > 0 && <span style={{ marginLeft: 'auto', fontSize: 12.5, color: '#92400E' }}><b>{fmtCr(heldByJobs)}</b> held — reversible, you have not been charged</span>}
          </div>
          <div style={{ fontSize: 12.5, color: '#92400E', marginBottom: 12 }}>A technical failure is never a candidate failure — these attempts are excluded from the ranking while Cuba recovers them.</div>
          {oppJobs.map((j) => (
            <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#fff', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
              <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>{JOB_KINDS[j.kind]?.label || j.kind}</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{j.candidate} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>· {j.module}</span></div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{j.detail || 'Cuba is recovering this attempt.'} · since {j.since}</div>
              </div>
              {j.creditsHeld > 0 && <span className="chip" style={{ background: '#FEF3C7', color: '#B45309' }}><Coins size={11} /> {fmtCr(j.creditsHeld)} held</span>}
              <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => nav(ticketLink(j))}><LifeBuoy size={13} /> Report an issue</button>
            </div>
          ))}
        </div>
      )}

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div style={{ minWidth: 280, flex: '1 1 320px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{opp.title}</h1>
            <span className="badge" style={{ background: sbg, color: sfg }}>{opp.status === 'OPEN' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: sfg }} />} {opp.status}</span>
          </div>
          <div style={{ display: 'flex', gap: 18, rowGap: 6, flexWrap: 'wrap', fontSize: 13, color: '#6B7280', marginTop: 8 }}>
            {opp.openedDate && <span style={{ whiteSpace: 'nowrap' }}><Calendar size={14} style={{ verticalAlign: -2 }} /> Opened {niceDate(opp.openedDate)}</span>}
            {opp.location && <span style={{ whiteSpace: 'nowrap' }}><MapPin size={14} style={{ verticalAlign: -2 }} /> {opp.location}</span>}
            {opp.closingDate && <span style={{ whiteSpace: 'nowrap' }}><Clock size={14} style={{ verticalAlign: -2 }} /> Closes {niceDate(opp.closingDate)}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {opp.status === 'DRAFT' && <button className="btn-success" {...gated('Publish this opportunity')} onClick={() => changeStatus('OPEN', 'Opportunity published — now live')}><Rocket size={15} /> Publish</button>}
          {opp.status === 'OPEN' && <button className="btn-ghost" {...gated('Pause this opportunity')} onClick={() => changeStatus('PAUSED', 'Opportunity paused')}><Pause size={15} /> Pause</button>}
          {(opp.status === 'PAUSED' || opp.status === 'CLOSED') && <button className="btn-success" {...gated('Reopen this opportunity')} onClick={() => changeStatus('OPEN', 'Opportunity reopened')}><Play size={15} /> {opp.status === 'CLOSED' ? 'Reopen' : 'Resume'}</button>}
          <button className="btn-ghost" onClick={() => nav('/opportunities/' + id + '/assessment')}><Settings2 size={15} /> Configure Assessment</button>
          <button className="btn-ghost" onClick={() => nav('/careers/' + id + '?preview=1')}><Eye size={15} /> Careers page</button>
          <button className="btn-ghost" onClick={() => nav('/candidate/' + id)}><Eye size={15} /> Preview candidate flow</button>
          <button className="btn-primary" {...gated('Send the assessment link')} onClick={() => nav('/opportunities/' + id + '/send')}><Send size={15} /> Send Assessment</button>
        </div>
      </div>

      <OppTabs id={id} active="overview" />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <div className="kpi">
          <div className="eyebrow">Recruitment Progress</div>
          <div className="num" style={{ fontSize: 30 }}>{opp.cleared} <span style={{ fontSize: 16, color: '#9CA3AF', fontWeight: 600 }}>/ {opp.requiredPositions} Roles</span></div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>{pct}% of target cleared</div>
          <div className="progress-track"><div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg,#22C55E,#16A34A)', borderRadius: 10 }} /></div>
        </div>
        <div className="kpi"><div className="eyebrow">Cleared</div><div className="num" style={{ color: '#059669' }}>{opp.cleared}</div><div style={{ fontSize: 12, color: '#6B7280' }}>Passed all stages</div></div>
        <div className="kpi"><div className="eyebrow">Still Needed</div><div className="num" style={{ color: '#D97706' }}>{stillNeeded}</div><div style={{ fontSize: 12, color: '#6B7280' }}>To fulfill this role</div></div>
        <div className="kpi"><div className="eyebrow">In Pipeline</div><div className="num" style={{ color: '#056FD4' }}>{opp.inPipeline}</div><div style={{ fontSize: 12, color: '#6B7280' }}>Active screening</div></div>
      </div>

      {/* funnel */}
      <div className="card" style={{ padding: '22px 24px', marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 16px' }}>Recruitment Funnel Breakdown</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[['APPLIED', fn.applied, 'Total applicants'], ['SCREENING', fn.screening, 'Resume + Sys check'], ['ASSESSMENT', fn.assessment, 'Written + Typing'], ['INTERVIEW', fn.interview, 'Final round'], ['CLEARED', fn.cleared, 'All stages passed']].map(([t, v, d], i, arr) => (
            <div key={t} style={{ display: 'contents' }}>
              <div className={'funnel-step' + (i === arr.length - 1 ? ' last' : '')}>
                <div style={{ fontSize: 24, fontWeight: 700, color: i === arr.length - 1 ? '#fff' : '#056FD4' }}>{v}</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{t}</div>
                <div style={{ fontSize: 10.5, color: i === arr.length - 1 ? 'rgba(255,255,255,0.7)' : '#9CA3AF' }}>{d}</div>
              </div>
              {i < arr.length - 1 && <span style={{ color: '#CBD5E1' }}>›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* cleared agents / rank */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '18px 20px' }}><h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Cleared Agents <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>— ranked by weighted score</span></h2></div>
        {agents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No candidates have cleared all stages yet.</div>
        ) : (
          <table>
            <thead><tr><th>Rank</th><th>Candidate</th><th>Weighted</th><th>CEFR</th><th>Typing</th><th>Experience</th><th>Cleared</th></tr></thead>
            <tbody>
              {agents.map((a, i) => {
                const [bg, fg] = PALETTE[i % PALETTE.length];
                return (
                  <tr className="row" key={a.id} style={{ cursor: 'pointer' }} onClick={() => nav('/opportunities/' + id + '/candidate/' + a.id)}>
                    <td style={{ fontWeight: 700, color: '#056FD4' }}>#{i + 1}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="avatar" style={{ width: 32, height: 32, background: bg, color: fg, fontSize: 11 }}>{ini(a.name)}</div><span style={{ fontWeight: 600 }}>{a.name}</span></div></td>
                    <td style={{ fontWeight: 700, color: '#059669' }}>{weightedScore(a, weights)}</td>
                    <td><span className="badge" style={{ background: '#EFF6FF', color: '#1E40AF' }}>{a.cefr}</span></td>
                    <td>{a.wpm} WPM</td><td>{a.exp}</td><td style={{ color: '#6B7280' }}>{a.clearedAt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* assessment config summary */}
      {opp.assessment && (
        <div className="card" style={{ padding: '22px 24px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              Assessment <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>— what candidates run</span>
              <span className="chip" style={{ background: '#F3F4F6', color: '#374151' }}><Mono>{opp.assessment.version || 'v1'}</Mono></span>
            </h2>
            <span style={{ fontSize: 13, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/opportunities/' + id + '/assessment')}>Configure →</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {opp.assessment.modules.map((m, i) => {
              const av = availOf(m.key);
              return (
                <span key={i} className="chip" title={av.ok ? undefined : av.note}
                  style={av.ok ? { background: '#F8FAFF', color: '#056FD4', border: '1px solid #E0EDFF' } : { background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}>
                  {!av.ok && <Pause size={11} />}{i + 1}. {MODNAME[m.key] || m.key}{m.weight ? ` · ${m.weight}%` : ''}{!av.ok && ' · paused by Cuba'}
                </span>
              );
            })}
          </div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Rank weights (the order)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {opp.assessment.weights.map((w, i) => (
              <span key={i} style={{ fontSize: 13 }}><b>{w.w}%</b> <span style={{ color: '#6B7280' }}>{w.label}</span></span>
            ))}
          </div>
        </div>
      )}

      {/* funding guidance (spec §04) */}
      <div className="card" style={{ padding: '22px 24px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Calculator size={16} color="#056FD4" /> Funding</h2>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Safety requirement, not a pre-charge — credits are consumed only when services run.</div>
          </div>
          <span className="badge" style={{ background: funded ? '#DCFCE7' : '#FEF3C7', color: funded ? '#15803D' : '#B45309' }}>
            {funded ? 'Funded' : `Underfunded by ${fmtCr(Math.max(0, est.total - clientWallet.available))}`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">Recommended funding<PendingChip /></div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{fmtCr(est.total)}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>target {est.target} × 50 screens + × 10 full evals</div>
          </div>
          <div>
            <div className="eyebrow">Available</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: funded ? '#15803D' : '#B45309' }}>{fmtCr(clientWallet.available)}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>on your wallet now</div>
          </div>
          <div>
            <div className="eyebrow">Per fully-evaluated candidate</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{fmtCr(est.perCandidate)}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>modules + proctoring</div>
          </div>
        </div>

        {/* what this role has actually cost — read from the immutable ledger, not estimated (spec §05) */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F3F4F6' }}>
          <div className="eyebrow" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Coins size={12} /> Spent on this opportunity</div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <div>
              <div className="eyebrow">Spent to date</div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{fmtCr(spent)}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{spendRows.length} ledger {spendRows.length === 1 ? 'entry' : 'entries'} · actual usage</div>
            </div>
            <div>
              <div className="eyebrow">Cost per cleared candidate</div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: perCleared ? '#14212A' : '#9CA3AF' }}>{perCleared ? fmtCr(perCleared) : '—'}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{perCleared ? `${fmtCr(spent)} ÷ ${opp.cleared} cleared` : 'no spend recorded yet'}</div>
            </div>
            <div>
              <div className="eyebrow">Remaining runway</div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: runway != null && runway < est.target ? '#B45309' : '#14212A' }}>{runway != null ? `${num(runway)} cand.` : '—'}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>full evaluations at today&rsquo;s rates</div>
            </div>
          </div>
          {spendByModule.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {spendByModule.map(([m, v]) => <span key={m} className="chip" style={{ background: '#F4F7FB', color: '#374151' }}>{m} <b style={{ marginLeft: 4 }}>{fmtCr(v)}</b></span>)}
            </div>
          )}
          {heldByJobs > 0 && <div style={{ fontSize: 12, color: '#B45309', marginTop: 10 }}>{fmtCr(heldByJobs)} of your reserved credits are held against {oppJobs.length} evaluation{oppJobs.length === 1 ? '' : 's'} Cuba is recovering — reversible, not consumed.</div>}
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/billing')}>Top up →</span>
          <span style={{ fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => nav('/billing')}>Full ledger <ArrowRight size={12} /></span>
        </div>
      </div>

      {/* requirement details */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 16px' }}>Requirement Details</h2>
        {opp.skills?.length > 0 && (<>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Technical Skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>{opp.skills.map((s) => <span className="skill-chip" key={s}>{s}</span>)}</div>
        </>)}
        <div className="eyebrow" style={{ marginBottom: 10 }}>Eligibility Criteria</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0 40px' }}>
          {[['Min. Experience', c.minExperienceYears ? `${c.minExperienceYears} Years` : '—'], ['Min. CEFR Level', c.minCefrLevel || '—'], ['Min. Education', c.minEducation || '—'], ['Min. Assessment Score', c.minAssessmentScore ? `${c.minAssessmentScore} / 100` : '—'], ['Min. Interview Score', c.minInterviewScore ? `${c.minInterviewScore} / 100` : '—'], ['Min. Typing Speed', c.minTypingWpm ? `${c.minTypingWpm} WPM` : '—']].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #F3F4F6' }}><span style={{ fontSize: 13, color: '#6B7280' }}>{k}</span><span style={{ fontSize: 13, fontWeight: 700 }}>{v}</span></div>
          ))}
        </div>
        {opp.jobDescription && (<><div className="eyebrow" style={{ margin: '20px 0 8px' }}>Role Description</div><RichText text={opp.jobDescription} /></>)}
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 80, display: 'flex', alignItems: 'center', gap: 9, background: '#14212A', color: '#fff', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}><Check size={15} color="#34D399" /> {toast}</div>}
    </>
  );
}
