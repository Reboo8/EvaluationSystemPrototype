import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, ArrowRight, AlertCircle, AlertTriangle, CreditCard, Lock, Info, RotateCcw, Plus, Minus, Lightbulb, User, Check, ChevronRight, Bug, Coins, ShieldCheck } from 'lucide-react';
import { useApp, CASE_TYPES, TICKET_FLOW, TICKET_STATUS, JOB_KINDS, caseLabel, fmtCr } from '../store.jsx';
import { TicketStatusBadge, PriorityBadge, useToast, PageHeader, Mono } from '../components/admin/ui.jsx';

/* ═══════════ Client Support — spec §09 (Candidate → Client Support → Cuba Admin), shared `tickets` store ═══════════ */

const GROUPS = [
  ['candidate', 'Candidate issue'],
  ['billing', 'Credits & billing'],
  ['account', 'Account & access'],
  ['other', 'Other'],
];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
/* failed-job kind → the support case type it belongs to (spec §09) */
const JOB_CASE = { RESUME_PARSE_FAILED: 'resume_stuck', STUCK_ASSESSMENT: 'assessment_crash', STUCK_INTERVIEW: 'interview_failed', AI_PROVIDER_FAILURE: 'interview_failed', PENDING_SCORE: 'result_missing', NOTIFICATION_FAILURE: 'invite_expired' };
const JOB_PRIORITY = { AI_PROVIDER_FAILURE: 'Urgent', STUCK_INTERVIEW: 'High', STUCK_ASSESSMENT: 'High', PENDING_SCORE: 'High', RESUME_PARSE_FAILED: 'Medium', NOTIFICATION_FAILURE: 'Medium' };
const EMPTY_PREFILL = { caseType: '', subject: '', description: '', oppTitle: '', candidate: '', priority: 'Medium' };

const HELP_CARDS = [
  { group: 'candidate', icon: AlertTriangle, title: 'Candidate issue', desc: 'Assessment crash, interview didn’t start, false proctoring flag, stuck resume, missing result, identity failure, expired invite.', flow: true },
  { group: 'billing', icon: CreditCard, title: 'Credits & billing', desc: 'Payment succeeded but credits missing, wrong credit deduction dispute.' },
  { group: 'account', icon: Lock, title: 'Account & access', desc: 'Team invites, roles & permissions, login and profile issues.' },
];

const FAQS = [
  ['How do credits work?',
    'Cuba runs on a credit wallet, not subscription plans. Every paid step — resume analysis, assessment modules, AI interview, proctoring — consumes credits per candidate at the rates on your rate card. You purchase or receive credits, and every movement is logged as an immutable entry in Billing → Ledger.',
    'Top up ahead of a big hiring push — credits fund evaluations as they run, they are not a pre-charge per opportunity.'],
  ['Why isn’t a candidate showing in my Cleared list?',
    'A candidate only reaches Cleared after passing every gated stage — resume fit, assessment modules, and AI interview — at or above the thresholds you set. If any stage is still pending or below threshold, they stay in the pipeline.',
    'Open the opportunity’s Recruitment Funnel to see exactly which stage a candidate is stuck at.'],
  ['What happens when my balance reaches zero or goes negative?',
    'At zero balance you stay fully active — running evaluations are never interrupted, only new paid evaluations pause until you top up. If your balance goes negative, Cuba covers the shortfall (up to your overdraft limit) so evaluations already in progress can finish; new evaluations stay paused until the outstanding balance clears.',
    'Your wallet state — Healthy, Low balance, Zero balance, Overdraft — is shown separately from your account status on Billing.'],
  ['What does "reserved" credits mean?',
    'When a paid module like the AI Interview starts for a candidate, Cuba reserves the estimated credits so that candidate’s evaluation is guaranteed to finish. Once the module completes, a Settlement entry consumes the actual usage and releases any unused reserve back to your available balance.',
    'Available balance = balance − reserved. That is the number Cuba checks before letting a new evaluation start.'],
  ['How do I dispute a credit deduction?',
    'Raise a ticket under Credits & billing → “Wrong credit deduction dispute”, quoting the ledger transaction ID (e.g. LX-10256) and the candidate/opportunity involved. We review the entry against actual usage — the original charge is never edited, a Refund / reversal entry is posted if the dispute is upheld.',
    'Every transaction ID is on Billing → Ledger, next to its amount and date.'],
];

export default function Support() {
  const { clientTickets, clientOpportunities: opportunities, raiseTicket, replyTicket, failedJobs, currentClientId } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const [show, toastNode] = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState(EMPTY_PREFILL);
  const [detailId, setDetailId] = useState(null);
  const [expanded, setExpanded] = useState(0);

  /* the client's OWN stuck / failed evaluations — hop 1 of the locked path made visible (spec §09) */
  const clientFailedJobs = useMemo(
    () => (failedJobs || []).filter((j) => j.clientId === currentClientId && j.status === 'OPEN'),
    [failedJobs, currentClientId]
  );
  const heldTotal = clientFailedJobs.reduce((a, j) => a + (j.creditsHeld || 0), 0);
  const jobPrefill = (j) => ({
    caseType: JOB_CASE[j.kind] || 'other',
    subject: `${JOB_KINDS[j.kind]?.label || j.kind} — ${j.candidate}`,
    description: `Cuba flagged ${j.id} on ${j.oppTitle} for ${j.candidate} (${j.module}).\n\nWhat Cuba reported: ${j.detail || '—'}\nSince: ${j.since}${j.creditsHeld ? `\nCredits held: ${j.creditsHeld} cr` : ''}\n\nPlease confirm this is treated as a technical failure and not a candidate result.`,
    oppTitle: j.oppTitle || '',
    candidate: j.candidate || '',
    priority: JOB_PRIORITY[j.kind] || 'High',
  });

  /* deep link from the opportunity page: /support?case=…&job=…&candidate=…&opp=… opens the form pre-filled */
  useEffect(() => {
    const p = new URLSearchParams(loc.search);
    if (!p.get('case') && !p.get('job')) return;
    const j = (failedJobs || []).find((x) => x.id === p.get('job') && x.clientId === currentClientId);
    setPrefill(j ? jobPrefill(j) : {
      ...EMPTY_PREFILL,
      caseType: p.get('case') || '',
      candidate: p.get('candidate') || '',
      oppTitle: p.get('opp') || '',
      subject: p.get('candidate') ? `Issue with ${p.get('candidate')}` : '',
    });
    setFormOpen(true);
    nav('/support', { replace: true });
  }, [loc.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const ticket = useMemo(() => clientTickets.find((t) => t.id === detailId) || null, [clientTickets, detailId]);
  const sortedTickets = useMemo(() => {
    const waiting = clientTickets.filter((t) => t.status === 'WAITING_ON_CLIENT');
    const rest = clientTickets.filter((t) => t.status !== 'WAITING_ON_CLIENT');
    return [...waiting, ...rest];
  }, [clientTickets]);

  const openForm = (caseType = '') => { setPrefill({ ...EMPTY_PREFILL, caseType }); setFormOpen(true); };
  const openJobForm = (j) => { setPrefill(jobPrefill(j)); setFormOpen(true); };
  const submitTicket = (data) => { const id = raiseTicket(data); setFormOpen(false); show(`Ticket ${id} raised — support will respond soon`); };
  const sendReply = (id, text) => {
    const wasWaiting = clientTickets.find((t) => t.id === id)?.status === 'WAITING_ON_CLIENT';
    replyTicket(id, 'client', text);
    show(wasWaiting ? 'Reply sent — status updates when support responds' : 'Reply sent');
  };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {toastNode}
      <PageHeader
        title="Support"
        sub="Get help with candidate issues, credits and access — Candidate → you → Cuba Admin"
        right={<button className="btn-primary" onClick={() => openForm('')}><Plus size={15} /> Raise a Ticket</button>}
      />

      {/* quick help cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginBottom: 30 }}>
        {HELP_CARDS.map((c) => {
          const Icon = c.icon;
          const first = CASE_TYPES.find((x) => x.group === c.group)?.value || '';
          return (
            <div key={c.group} onClick={() => openForm(first)} className="card" style={{ textAlign: 'center', padding: '24px 20px', cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#056FD4'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(5,111,212,0.10)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><Icon size={22} color="#056FD4" /></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#14212A' }}>{c.title}</div>
              <div style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.55, margin: '4px 0 12px' }}>{c.desc}</div>
              {c.flow && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: '#9CA3AF', marginBottom: 12 }}>
                  <span className="chip" style={{ background: '#F3F4F6', padding: '2px 8px' }}>Candidate</span><ArrowRight size={10} /><span className="chip" style={{ background: '#EFF6FF', color: '#1E40AF', padding: '2px 8px' }}>You</span><ArrowRight size={10} /><span className="chip" style={{ background: '#14212A', color: '#fff', padding: '2px 8px' }}>Cuba</span>
                </div>
              )}
              <span style={{ fontSize: 13, color: '#056FD4', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Get Help <ArrowRight size={14} /></span>
            </div>
          );
        })}
      </div>

      {/* evaluations needing attention — the client's own live failures (spec §09) */}
      {clientFailedJobs.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 30, borderColor: '#FDE68A' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #FDE68A', background: '#FFFBEB', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Bug size={16} color="#B45309" />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#92400E' }}>Evaluations needing attention <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>{clientFailedJobs.length}</span></div>
              <div style={{ fontSize: 12.5, color: '#92400E', marginTop: 2 }}>Cuba detected these itself. A technical failure is never a candidate failure — the attempts below are excluded from your ranking until they are recovered.</div>
            </div>
            {heldTotal > 0 && <span className="chip" style={{ background: '#FEF3C7', color: '#B45309' }}><Coins size={12} /> {fmtCr(heldTotal)} held · not charged</span>}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>What went wrong</th><th>Candidate</th><th>Opportunity · stage</th><th style={{ textAlign: 'right' }}>Credits held</th><th></th></tr></thead>
              <tbody>
                {clientFailedJobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>{JOB_KINDS[j.kind]?.label || j.kind}</span>
                        <Mono>{j.id}</Mono>
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, maxWidth: 380 }}>{j.detail || 'Cuba is recovering this attempt.'}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{j.candidate}<div style={{ fontSize: 11.5, color: '#15803D', fontWeight: 500 }}>not counted against them</div></td>
                    <td style={{ fontSize: 12.5 }}>{j.oppTitle}<div style={{ color: '#9CA3AF' }}>{j.module} · since {j.since}</div></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: j.creditsHeld ? '#B45309' : '#9CA3AF' }}>{j.creditsHeld ? fmtCr(j.creditsHeld) : '—'}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => openJobForm(j)}>Report an issue <ArrowRight size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 20px', borderTop: '1px solid #F3F4F6', fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 7 }}>
            <ShieldCheck size={13} color="#15803D" /> Held credits are reversible: if Cuba cannot recover the attempt, a Refund / reversal entry is posted to your ledger.
          </div>
        </div>
      )}

      {/* my tickets */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', color: '#9CA3AF', marginBottom: 12 }}>MY TICKETS</div>
        {sortedTickets.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#14212A' }}>No tickets yet</div>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>Raise a ticket if you need help with anything</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedTickets.map((t) => {
              const waiting = t.status === 'WAITING_ON_CLIENT';
              return (
                <div key={t.id} onClick={() => setDetailId(t.id)} className="card" style={{ padding: '16px 20px', cursor: 'pointer', transition: 'border-color .15s', borderColor: waiting ? '#FDE68A' : undefined }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#056FD4'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = waiting ? '#FDE68A' : '#E2E8F0'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <Mono>{t.id}</Mono>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#14212A' }}>{t.subject}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                        <span className="chip" style={{ background: '#F4F7FB', color: '#6B7280', fontSize: 11 }}>{caseLabel(t.caseType)}</span>
                        {(t.candidate || t.oppTitle) && <span style={{ fontSize: 12, color: '#6B7280' }}>{[t.candidate, t.oppTitle].filter(Boolean).join(' · ')}</span>}
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>Raised {t.createdAt} · Updated {t.updated}</span>
                      </div>
                    </div>
                    {waiting && <span className="chip" style={{ background: '#FEF3C7', color: '#B45309', flexShrink: 0 }}><AlertCircle size={11} /> Your reply needed</span>}
                    <TicketStatusBadge status={t.status} />
                    <button className="btn-ghost" style={{ flexShrink: 0, padding: '6px 12px', fontSize: 12.5 }} onClick={(e) => { e.stopPropagation(); setDetailId(t.id); }}>View <ArrowRight size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* faq */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', color: '#9CA3AF', marginBottom: 12 }}>FREQUENTLY ASKED</div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {FAQS.map(([q, a, tip], i) => {
            const open = expanded === i;
            return (
              <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid #E2E8F0' : 'none' }}>
                <button onClick={() => setExpanded(open ? null : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'none', border: 'none', padding: '15px 22px', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: open ? '#056FD4' : '#14212A' }}>{q}</span>
                  {open ? <Minus size={16} color="#056FD4" style={{ flexShrink: 0 }} /> : <Plus size={16} color="#6B7280" style={{ flexShrink: 0 }} />}
                </button>
                {open && (
                  <div style={{ borderLeft: '3px solid #056FD4', background: '#FAFBFC', padding: '14px 22px' }}>
                    <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.65, margin: '0 0 12px' }}>{a}</p>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#FFF7ED', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                      <Lightbulb size={15} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12.5, color: '#92400E', lineHeight: 1.55 }}><b>Tip: </b>{tip}</span>
                    </div>
                    <span onClick={() => openForm('')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }}>Still need help? Raise a ticket <ArrowRight size={13} /></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {formOpen && <RaiseTicketForm key={prefill.subject + prefill.caseType} initial={prefill} opportunities={opportunities} onClose={() => setFormOpen(false)} onSubmit={submitTicket} />}
      {ticket && <TicketDrawer ticket={ticket} onClose={() => setDetailId(null)} onReply={sendReply} />}
    </div>
  );
}

/* ── Raise a Support Ticket (modal) ── */
function RaiseTicketForm({ initial = {}, opportunities, onClose, onSubmit }) {
  const initialCaseType = initial.caseType || '';
  const [caseType, setCaseType] = useState(initialCaseType);
  const [subject, setSubject] = useState(initial.subject || '');
  const [priority, setPriority] = useState(initial.priority || 'Medium');
  const [description, setDescription] = useState(initial.description || '');
  const [oppTitle, setOppTitle] = useState(initial.oppTitle || '');
  const [candidate, setCandidate] = useState(initial.candidate || '');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const prefilled = !!(initial.subject || initial.description);

  const meta = CASE_TYPES.find((c) => c.value === caseType);
  const isCandidateIssue = meta?.group === 'candidate';

  const hasContent = caseType !== initialCaseType || subject.trim() || description.trim() || oppTitle || candidate.trim();
  const canSubmit = caseType && subject.trim() && description.trim() && (!isCandidateIssue || (oppTitle && candidate.trim())) && !busy;

  const onBackdrop = () => { if (hasContent) { setShake(true); setTimeout(() => setShake(false), 450); } else onClose(); };
  const clearForm = () => { setCaseType(initialCaseType); setSubject(''); setPriority(initial.priority || 'Medium'); setDescription(''); setOppTitle(''); setCandidate(''); };
  const submit = () => {
    if (!canSubmit) return;
    setBusy(true);
    setTimeout(() => onSubmit({
      subject: subject.trim(), caseType, priority, description: description.trim(),
      oppTitle: isCandidateIssue ? oppTitle : undefined, candidate: isCandidateIssue ? candidate.trim() : undefined,
    }), 500);
  };

  const inputCls = { width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 13px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' };
  const lbl = (t) => <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t} <span style={{ color: '#DC2626' }}>*</span></label>;

  return (
    <div onClick={onBackdrop} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 12, animation: shake ? 'shake .4s' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <h2 style={{ fontSize: 16.5, fontWeight: 700, margin: 0 }}>Raise a Support Ticket</h2>
            {shake && <div style={{ fontSize: 12, color: '#B45309', marginTop: 3 }}>You have unsaved content — use Cancel to discard.</div>}
          </div>
          <X size={18} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>

        <div style={{ padding: 22, overflowY: 'auto' }}>
          <div style={{ marginBottom: isCandidateIssue ? 12 : 16 }}>
            {lbl('Case type')}
            <select style={inputCls} value={caseType} onChange={(e) => setCaseType(e.target.value)}>
              <option value="">Select case type</option>
              {GROUPS.map(([g, label]) => {
                const items = CASE_TYPES.filter((c) => c.group === g);
                if (!items.length) return null;
                return <optgroup key={g} label={label}>{items.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</optgroup>;
              })}
            </select>
          </div>

          {isCandidateIssue && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#EFF6FF', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
                <Info size={15} color="#1E40AF" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.5 }}>Candidates contact you; you raise it with Cuba — we never contact candidates directly by default.{prefilled && <> This ticket is pre-filled from an evaluation Cuba already flagged — the candidate is not penalised and held credits stay reversible.</>}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  {lbl('Opportunity')}
                  <select style={inputCls} value={oppTitle} onChange={(e) => setOppTitle(e.target.value)}>
                    <option value="">Select opportunity</option>
                    {oppTitle && !opportunities.some((o) => o.title === oppTitle) && <option value={oppTitle}>{oppTitle}</option>}
                    {opportunities.map((o) => <option key={o.id} value={o.title}>{o.title}</option>)}
                  </select>
                </div>
                <div>
                  {lbl('Candidate name')}
                  <input style={inputCls} value={candidate} placeholder="e.g. Arjun Mehta" onChange={(e) => setCandidate(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div style={{ marginBottom: 16 }}>
            {lbl('Subject')}
            <input style={inputCls} value={subject} maxLength={100} placeholder="Brief description of your issue" onChange={(e) => setSubject(e.target.value)} />
            <div style={{ textAlign: 'right', fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{subject.length}/100</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Priority</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PRIORITIES.map((p) => {
                const on = priority === p;
                return <button key={p} onClick={() => setPriority(p)} style={{ flex: 1, padding: '8px 0', borderRadius: 9999, border: 'none', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: on ? '#056FD4' : '#F4F7FB', color: on ? '#fff' : '#6B7280' }}>{p}</button>;
              })}
            </div>
          </div>
          <div>
            {lbl('Description')}
            <textarea style={{ ...inputCls, minHeight: 96, resize: 'vertical', lineHeight: 1.55 }} rows={4} value={description} placeholder="Please describe your issue in detail. Include relevant opportunity names, dates, or steps to reproduce." onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderTop: '1px solid #E2E8F0' }}>
          <button onClick={clearForm} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', fontSize: 12.5, fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}><RotateCcw size={13} /> Clear form</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={!canSubmit} onClick={submit}>{busy ? 'Submitting…' : <>Submit Ticket <ArrowRight size={14} /></>}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Ticket Detail (right slide-in drawer) ── */
function TicketDrawer({ ticket, onClose, onReply }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const idx = TICKET_FLOW.indexOf(ticket.status);
  const closed = ticket.status === 'CLOSED';

  const send = () => {
    const text = reply.trim();
    if (!text || sending || closed) return;
    setSending(true);
    setReply('');
    setTimeout(() => { onReply(ticket.id, text); setSending(false); }, 350);
  };
  const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); } };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,42,0.25)', zIndex: 60 }} />
      <div style={{ position: 'fixed', right: 0, top: 0, height: '100%', width: 580, maxWidth: '94vw', background: '#fff', zIndex: 61, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 16px rgba(0,0,0,0.1)', animation: 'slideIn .25s ease' }}>
        {/* header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Mono>{ticket.id}</Mono><PriorityBadge priority={ticket.priority} /><TicketStatusBadge status={ticket.status} />
                <span className="chip" style={{ background: '#F4F7FB', color: '#475569', fontSize: 11 }}>{caseLabel(ticket.caseType)}</span>
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: '#14212A', marginTop: 8, lineHeight: 1.3 }}>{ticket.subject}</div>
              {(ticket.candidate || ticket.oppTitle) && (
                <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 7 }}>
                  {ticket.candidate && <><span style={{ color: '#9CA3AF' }}>Candidate</span> <b style={{ color: '#14212A' }}>{ticket.candidate}</b></>}
                  {ticket.candidate && ticket.oppTitle && ' · '}
                  {ticket.oppTitle && <><span style={{ color: '#9CA3AF' }}>Opportunity</span> <b style={{ color: '#14212A' }}>{ticket.oppTitle}</b></>}
                </div>
              )}
              <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 6 }}>Raised {ticket.createdAt} · Last updated {ticket.updated} · Response time ~24 hrs</div>
            </div>
            <X size={18} color="#94A3B8" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={onClose} />
          </div>
        </div>

        {/* lifecycle strip */}
        <div style={{ padding: '12px 22px', borderBottom: '1px solid #E2E8F0', background: '#FAFBFC' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Lifecycle</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            {TICKET_FLOW.map((s, i) => {
              const st = TICKET_STATUS[s]; const cur = i === idx; const done = i < idx;
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: cur ? st.bg : done ? '#DCFCE7' : '#F3F4F6', color: cur ? st.fg : done ? '#15803D' : '#9CA3AF', border: `1.5px solid ${cur ? st.fg : 'transparent'}` }}>{done && <Check size={10} />}{st.label}</span>
                  {i < TICKET_FLOW.length - 1 && <ChevronRight size={12} color="#CBD5E1" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* thread */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 22, background: '#F8FAFC' }}>
          {ticket.messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginTop: 40 }}>No messages yet.</div>
          ) : ticket.messages.map((m, i) => {
            const mine = m.from === 'client';
            return mine ? (
              <div key={i} style={{ marginBottom: 16, textAlign: 'right' }}>
                <div style={{ display: 'inline-block', maxWidth: '80%', background: '#DBEAFE', color: '#14212A', borderRadius: 12, padding: '10px 13px', fontSize: 13, lineHeight: 1.55, textAlign: 'left' }}>{m.text}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{m.timestamp}</div>
              </div>
            ) : (
              <div key={i} style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
                <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: '#056FD4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={16} /></div>
                <div style={{ maxWidth: '80%' }}>
                  <div style={{ background: '#fff', border: '1px solid #E2E8F0', color: '#14212A', borderRadius: 12, padding: '10px 13px', fontSize: 13, lineHeight: 1.55 }}>{m.text}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{m.timestamp}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* reply */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #E2E8F0' }}>
          {closed ? (
            <div style={{ fontSize: 12.5, color: '#9CA3AF', textAlign: 'center', padding: '6px 0' }}>This ticket is closed. Raise a new ticket if you need further help.</div>
          ) : (
            <>
              {ticket.status === 'WAITING_ON_CLIENT' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#B45309', marginBottom: 8 }}><AlertCircle size={13} /> Support is waiting on your reply.</div>
              )}
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={onKey} rows={3} placeholder="Type your reply…  (⌘/Ctrl + Enter to send)"
                style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 13px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.55 }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="btn-primary" disabled={!reply.trim() || sending} onClick={send}>{sending ? 'Sending…' : <>Send Reply <ArrowRight size={14} /></>}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
