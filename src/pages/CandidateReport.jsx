import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronRight, Mail, MapPin, Calendar, Clipboard, Mic, Activity, FileText, Download,
  Check, RotateCcw, Columns2, ChevronDown, Languages, ListChecks, X,
} from 'lucide-react';
import { useApp, weightedScore } from '../store.jsx';

const PALETTE = [['#E0EDFF', '#056FD4'], ['#EDE9FE', '#7C3AED'], ['#DCFCE7', '#059669'], ['#FFEDD5', '#D97706']];
const ini = (n) => n.replace(/^Dr\.?\s*/, '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const emailOf = (n) => n.replace(/^Dr\.?\s*/, '').toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.') + '@email.com';
const CEFR_NUM = { A1: 4, A2: 5, B1: 6.5, B2: 7.5, C1: 8.7, C2: 9.6 };
const CEFR_BADGE = { A1: ['#F1F5F9', '#64748B'], A2: ['#E0F2FE', '#0369A1'], B1: ['#DBEAFE', '#1D4ED8'], B2: ['#EDE9FE', '#6D28D9'], C1: ['#D1FAE5', '#065F46'], C2: ['#DCFCE7', '#15803D'] };
const REC = { 'Strong Hire': ['#D1FAE5', '#059669'], Hire: ['#DBEAFE', '#2563EB'], 'Conditional Hire': ['#FEF3C7', '#D97706'], 'Not Recommended': ['#FEE2E2', '#DC2626'] };
const STATUSES = ['Cleared', 'Shortlisted', 'Pending Review', 'Rejected'];
const ringColor = (s) => (s >= 70 ? '#10B981' : s >= 50 ? '#F59E0B' : '#EF4444');

const Card = ({ children }) => <div className="card" style={{ overflow: 'hidden', breakInside: 'avoid', WebkitColumnBreakInside: 'avoid', marginBottom: 16 }}>{children}</div>;
const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CardHead = ({ icon: Icon, color = '#056FD4', title, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 20px 12px', borderBottom: '1px solid #F3F4F6' }}>
    <Icon size={15} strokeWidth={2} color={color} /><h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#14212A', margin: 0, flex: 1 }}>{title}</h3>{right}
  </div>
);
const Body = ({ children }) => <div style={{ padding: '16px 20px' }}>{children}</div>;
const Bar = ({ pct, color = '#056FD4' }) => <div className="progress-track" style={{ marginBottom: 14 }}><div style={{ width: Math.min(100, pct) + '%', height: '100%', background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: 10 }} /></div>;
const CefrBadge = ({ level }) => { const [bg, fg] = CEFR_BADGE[level] || CEFR_BADGE.A1; return level ? <span className="badge" style={{ background: bg, color: fg }}>{level}</span> : <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>; };
const Pill = ({ children, bg, fg, bd }) => <span style={{ background: bg, color: fg, border: `1px solid ${bd}`, fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 9999 }}>{children}</span>;
const Row = ({ k, v, last }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: last ? 'none' : '1px solid #F9FAFB' }}><span style={{ fontSize: 12.5, color: '#6B7280', minWidth: 120 }}>{k}</span><span style={{ fontSize: 13, fontWeight: 500, color: '#14212A', textAlign: 'right' }}>{v}</span></div>;
const AISummary = ({ label = 'AI Summary', text }) => (
  <div style={{ marginTop: 14 }}>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 6 }}>{label}</div>
    <div style={{ background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 8, padding: '12px 14px', fontSize: 12.5, color: '#374151', lineHeight: 1.65, fontStyle: 'italic' }}>“{text}”</div>
  </div>
);

export default function CandidateReport() {
  const { id, cid } = useParams();
  const nav = useNavigate();
  const { getOpportunity, getCandidates, getPool } = useApp();
  const opp = getOpportunity(id);
  const cand = getCandidates(id).find((c) => c.id === cid);
  const [status, setStatus] = useState('Cleared');
  const [stOpen, setStOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [notes, setNotes] = useState('');
  const show = (m) => { setToast(m); setTimeout(() => setToast(null), 2000); };

  if (!opp || !cand) return <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Candidate not found. <span style={{ color: '#056FD4', cursor: 'pointer' }} onClick={() => nav('/opportunities/' + id + '/rank')}>Back to Rank List</span></div>;

  const weights = opp.assessment?.weights || [];
  const ranked = [...getCandidates(id)].sort((a, b) => weightedScore(b, weights) - weightedScore(a, weights));
  const rank = ranked.findIndex((c) => c.id === cid) + 1;
  const score = weightedScore(cand, weights);
  const [avb, avf] = PALETTE[(rank - 1) % PALETTE.length];
  const interviewScore = cand.scores?.['AI Interview'] ?? cand.scores?.['Portfolio & Interview'] ?? Math.round(score);
  const fit = getPool(id).find((p) => p.name === cand.name)?.fit ?? cand.scores?.['Resume-fit'] ?? Math.min(98, Math.round(score) + 6);

  // synthesized-but-consistent analysis from the real sub-scores
  const sorted = Object.entries(cand.scores || {}).filter(([k]) => k !== 'Integrity' && k !== 'Resume-fit').sort((a, b) => b[1] - a[1]);
  const positives = sorted.slice(0, 2).map(([k]) => `Strong ${k}`);
  const watch = sorted.length ? [`Could improve ${sorted[sorted.length - 1][0]}`] : [];
  const rec = score >= 82 ? 'Strong Hire' : score >= 72 ? 'Hire' : score >= 62 ? 'Conditional Hire' : 'Not Recommended';
  const sentiment = interviewScore >= 75 ? 'Positive' : interviewScore >= 60 ? 'Neutral' : 'Mixed';
  const topSkill = (opp.skills || [])[0] || 'the core skills';
  const summary = `${cand.name.split(' ')[0]} scored ${score}/100 weighted across the assessment, with particular strength in ${sorted[0]?.[0] || 'the role areas'}. A solid, well-rounded fit for the ${opp.title} role.`;
  const intSummary = `Communicated clearly and stayed composed throughout the ${sentiment.toLowerCase()} interview, demonstrating sound judgement on ${topSkill}.`;
  const [recBg, recFg] = REC[rec];

  const journey = [['Resume Screen', 'DONE', '#DCFCE7', '#15803D'], ['System Check', 'PASSED', '#DCFCE7', '#15803D'], ['Identity Verification', 'VERIFIED', '#DBEAFE', '#1E40AF'], ['Assessment', 'COMPLETED', '#EDE9FE', '#6D28D9'], ['Interview', 'CLEARED', '#056FD4', '#fff']];

  const downloadReport = () => {
    const rows = [['Candidate', cand.name], ['Opportunity', opp.title], ['Rank', '#' + rank], ['Weighted score', score], ['CEFR', cand.cefr], ['Recommendation', rec], [], ['Parameter', 'Score', 'Weight%']];
    weights.forEach((w) => rows.push([w.label, cand.scores?.[w.label] ?? '—', w.w]));
    const csv = rows.map((r) => r.join(',')).join('\n');
    try { const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = cand.name.replace(/\s+/g, '_') + '_report.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); show('Report downloaded'); } catch { show('Report generated'); }
  };

  const langSubskills = ['Reading', 'Listening', 'Speaking', 'Writing'];
  const showCefr = !!cand.cefr;

  // requirement match vs the role's eligibility criteria
  const cr = opp.criteria || {};
  const expNum = parseInt(cand.exp, 10) || 0;
  const reqRows = [];
  if (cr.minExperienceYears) reqRows.push({ label: 'Experience', req: `≥ ${cr.minExperienceYears} yrs`, val: cand.exp || '—', ok: expNum >= cr.minExperienceYears });
  if (cr.minCefrLevel) reqRows.push({ label: 'CEFR level', req: `≥ ${cr.minCefrLevel}`, val: cand.cefr || '—', ok: CEFR_ORDER.indexOf(cand.cefr) >= CEFR_ORDER.indexOf(cr.minCefrLevel) });
  if (cr.minAssessmentScore) reqRows.push({ label: 'Assessment', req: `≥ ${cr.minAssessmentScore}`, val: String(score), ok: score >= cr.minAssessmentScore });
  if (cr.minInterviewScore) reqRows.push({ label: 'Interview', req: `≥ ${cr.minInterviewScore}`, val: String(interviewScore), ok: interviewScore >= cr.minInterviewScore });
  if (cr.minTypingWpm) reqRows.push({ label: 'Typing', req: `≥ ${cr.minTypingWpm} WPM`, val: cand.wpm ? `${cand.wpm} WPM` : '—', ok: (cand.wpm || 0) >= cr.minTypingWpm });

  return (
    <>
      {/* banner */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 18, minWidth: 0 }}>
            <div className="avatar" style={{ width: 64, height: 64, background: avb, color: avf, fontSize: 22, fontWeight: 800, flexShrink: 0 }}>{ini(cand.name)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                <span style={{ color: '#056FD4', fontWeight: 500, cursor: 'pointer' }} onClick={() => nav('/opportunities')}>Opportunities</span>
                <ChevronRight size={14} color="#D1D5DB" />
                <span style={{ color: '#056FD4', fontWeight: 500, cursor: 'pointer' }} onClick={() => nav('/opportunities/' + id + '/rank')}>{opp.title}</span>
                <ChevronRight size={14} color="#D1D5DB" /><span style={{ color: '#14212A', fontWeight: 600 }}>{cand.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 4px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: '#14212A', letterSpacing: '-0.4px', margin: 0 }}>{cand.name}</h1>
                <span className="badge" style={{ background: '#DCFCE7', color: '#15803D' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#15803D' }} /> CLEARED</span>
                {rank > 0 && <span className="badge" style={{ background: '#fff', color: '#056FD4', border: '1.5px solid #056FD4' }}>RANK #{rank}</span>}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12.5, color: '#6B7280', flexWrap: 'wrap' }}>
                <span><Mail size={13} style={{ verticalAlign: -2 }} /> {emailOf(cand.name)}</span>
                <span><MapPin size={13} style={{ verticalAlign: -2 }} /> {opp.location || 'India'}</span>
                <span><Calendar size={13} style={{ verticalAlign: -2 }} /> Completed {cand.clearedAt}</span>
              </div>
            </div>
          </div>
          {/* score ring */}
          <div style={{ width: 82, height: 82, borderRadius: '50%', border: `5px solid ${ringColor(score)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#14212A', letterSpacing: '-1px', lineHeight: 1 }}>{score || '—'}</div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#9CA3AF', marginTop: 2 }}>Score</div>
          </div>
        </div>
        {/* actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button className="btn-ghost" onClick={() => setStOpen((v) => !v)}><span style={{ width: 7, height: 7, borderRadius: '50%', background: status === 'Rejected' ? '#DC2626' : status === 'Pending Review' ? '#D97706' : '#16A34A' }} /> {status} <ChevronDown size={14} /></button>
            {stOpen && (<><div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setStOpen(false)} />
              <div className="card" style={{ position: 'absolute', top: 40, left: 0, zIndex: 41, width: 180, padding: 4 }}>
                {STATUSES.map((s) => <div key={s} onClick={() => { setStatus(s); setStOpen(false); show('Marked ' + s); }} style={{ padding: '8px 12px', fontSize: 13, borderRadius: 7, cursor: 'pointer', fontWeight: s === status ? 700 : 500, color: s === status ? '#056FD4' : '#374151' }}>{s}</div>)}
              </div></>)}
          </div>
          <button className="btn-ghost" onClick={downloadReport}><Download size={15} /> Download report</button>
          <button className="btn-ghost" onClick={() => show('Retake invite sent to ' + emailOf(cand.name))}><RotateCcw size={15} /> Invite to retake</button>
          <button className="btn-ghost" onClick={() => nav('/opportunities/' + id + '/compare?ids=' + cid)}><Columns2 size={15} /> Compare</button>
        </div>
      </div>

      {/* balanced masonry — cards auto-distribute across two columns, no dead whitespace */}
      <div style={{ columns: 2, columnGap: 16 }}>
          <Card>
            <CardHead icon={Activity} title="Personal Details" />
            <Body>
              <Row k="Current City" v={opp.location || '—'} />
              <Row k="Total Experience" v={cand.exp || '—'} />
              <Row k="Department" v={opp.department || '—'} />
              <Row k="CEFR Level" v={<CefrBadge level={cand.cefr} />} />
              <Row k="Typing" v={cand.wpm ? `${cand.wpm} WPM` : '—'} last />
              {(opp.languages || []).length > 0 && (<>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9CA3AF', margin: '14px 0 8px' }}>Languages</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{opp.languages.map((l) => <Pill key={l} bg="#F0F9FF" fg="#0369A1" bd="#BAE6FD">{l}</Pill>)}</div>
              </>)}
              {(opp.skills || []).length > 0 && (<>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9CA3AF', margin: '14px 0 8px' }}>Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{opp.skills.map((s) => <Pill key={s} bg="#EFF6FF" fg="#1E40AF" bd="#BFDBFE">{s}</Pill>)}</div>
              </>)}
            </Body>
          </Card>

          <Card>
            <CardHead icon={FileText} color="#7C3AED" title="Resume Analysis" />
            <Body>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 6 }}>Fit Score</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{fit} <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>/ 100</span></div>
              <Bar pct={fit} />
              <div style={{ fontSize: 12.5, color: '#374151', fontStyle: 'italic', lineHeight: 1.6 }}>“Resume matched the must-have skills for {opp.title}; relevant experience detected.”</div>
              <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => show('Resume download started')}><Download size={15} /> Download Resume</button>
            </Body>
          </Card>

          <Card>
            <CardHead icon={ListChecks} color="#0369A1" title="Meets requirements" />
            <Body>
              {reqRows.length === 0 ? <div style={{ fontSize: 12.5, color: '#9CA3AF' }}>No eligibility criteria set for this role.</div> :
                reqRows.map((r, i) => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < reqRows.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                    <span style={{ fontSize: 12.5, color: '#6B7280' }}>{r.label}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ color: '#9CA3AF' }}>req {r.req}</span>
                      <span style={{ fontWeight: 700, color: r.ok ? '#16A34A' : '#DC2626' }}>{r.val}</span>
                      {r.ok ? <Check size={15} color="#16A34A" /> : <X size={15} color="#DC2626" />}
                    </span>
                  </div>
                ))}
            </Body>
          </Card>

          <Card>
            <CardHead icon={Activity} title="Process Journey" />
            <Body>
              {journey.map(([label, st, bg, fg], i) => (
                <div key={label} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={11} color="#fff" /></div>
                    {i < journey.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 14, background: '#DCFCE7' }} />}
                  </div>
                  <div style={{ paddingBottom: i < journey.length - 1 ? 12 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 13.5, fontWeight: 600, color: '#14212A' }}>{label}</span><span className="badge" style={{ background: bg, color: fg }}>{st}</span></div>
                  </div>
                </div>
              ))}
            </Body>
          </Card>

          <Card>
            <CardHead icon={Clipboard} title="Assessment Result" />
            <Body>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>Weighted Score</span>
                <span><b style={{ fontSize: 22 }}>{score}</b> <span style={{ fontSize: 13, color: '#9CA3AF' }}>/ 100</span></span>
              </div>
              <Bar pct={score} />
              {/* per-parameter breakdown — uses the real sub-scores */}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9CA3AF', margin: '4px 0 8px' }}>Score breakdown</div>
              {weights.map((w) => { const v = cand.scores?.[w.label]; return (
                <div key={w.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}><span style={{ color: '#374151' }}>{w.label} <span style={{ color: '#9CA3AF' }}>· {w.w}%</span></span><span style={{ fontWeight: 700, color: '#14212A' }}>{v ?? '—'}</span></div>
                  <div className="progress-track"><div style={{ width: (Number(v) || 0) + '%', height: '100%', background: 'linear-gradient(90deg,#60A5FA,#056FD4)', borderRadius: 10 }} /></div>
                </div>
              ); })}
              <AISummary text={summary} />
            </Body>
          </Card>

          {showCefr && (
            <Card>
              <CardHead icon={Languages} color="#0369A1" title="Language / CEFR" right={<CefrBadge level={cand.cefr} />} />
              <Body>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><span style={{ fontSize: 12.5, color: '#6B7280' }}>Overall CEFR ({(opp.languages || ['English'])[0]})</span><span style={{ fontSize: 16, fontWeight: 800 }}>{cand.cefr} <span style={{ fontSize: 12, color: '#9CA3AF' }}>({CEFR_NUM[cand.cefr] ?? '—'})</span></span></div>
                {langSubskills.map((sub, i) => { const base = CEFR_NUM[cand.cefr] ?? 7; const n = Math.max(4, Math.min(10, +(base + [0.3, -0.2, -0.4, 0.1][i]).toFixed(1))); return (
                  <div key={sub} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 3 ? '1px solid #F9FAFB' : 'none' }}>
                    <span style={{ fontSize: 13, color: '#374151' }}>{(opp.languages || ['English'])[0]} — {sub}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}><CefrBadge level={cand.cefr} /> <span style={{ color: '#9CA3AF', marginLeft: 6 }}>({n})</span></span>
                  </div>
                ); })}
              </Body>
            </Card>
          )}

          <Card>
            <CardHead icon={Mic} color="#16A34A" title="Interview Analysis" />
            <Body>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px' }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#16A34A' }}>Interview Score</div><div style={{ fontSize: 28, fontWeight: 800 }}>{interviewScore} <span style={{ fontSize: 12, color: '#9CA3AF' }}>/ 100</span></div></div>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px' }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#16A34A' }}>Sentiment</div><div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#16A34A', marginRight: 6 }} />{sentiment}</div></div>
              </div>
              <Bar pct={interviewScore} color="#7C3AED" />
              <AISummary label="AI Performance Summary" text={intSummary} />
              {positives.length > 0 && (<>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#16A34A', margin: '14px 0 8px' }}>Positive Signals</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{positives.map((p) => <Pill key={p} bg="#DCFCE7" fg="#15803D" bd="#86EFAC">{p}</Pill>)}</div>
              </>)}
              {watch.length > 0 && (<>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#F59E0B', margin: '14px 0 8px' }}>Areas to Watch</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{watch.map((p) => <Pill key={p} bg="#FEF3C7" fg="#B45309" bd="#FDE68A">{p}</Pill>)}</div>
              </>)}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
                <span style={{ fontSize: 12.5, color: '#6B7280' }}>AI Recommendation</span>
                <span className="badge" style={{ background: recBg, color: recFg }}>{rec}</span>
              </div>
            </Body>
          </Card>

          <Card>
            <CardHead icon={FileText} title="Recruiter notes" />
            <Body>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a private note about this candidate…" style={{ width: '100%', minHeight: 84, border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }} />
              <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => show('Note saved')}>Save note</button>
            </Body>
          </Card>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 80, display: 'flex', alignItems: 'center', gap: 9, background: '#14212A', color: '#fff', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}><Check size={15} color="#34D399" /> {toast}</div>}
    </>
  );
}
