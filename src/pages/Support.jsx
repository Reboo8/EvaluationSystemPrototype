import { useState } from 'react';
import { X, ArrowRight, AlertCircle, RotateCcw, Plus, Minus, Lightbulb, User } from 'lucide-react';

/* ── faithful rebuild of the ClientPortal Support page, wired to local state ── */

const CATEGORIES = [
  { value: 'billing', label: 'Billing & Plan' },
  { value: 'technical', label: 'Technical Problem' },
  { value: 'candidates', label: 'Candidates & Pipeline' },
  { value: 'account', label: 'Account & Access' },
  { value: 'other', label: 'Other' },
];
const labelOf = (v) => (CATEGORIES.find((c) => c.value === v) || {}).label || v;
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const STATUS = {
  OPEN: { label: 'Open', bg: '#DBEAFE', fg: '#1E40AF' },
  IN_PROGRESS: { label: 'In Progress', bg: '#FEF3C7', fg: '#92400E' },
  RESOLVED: { label: 'Resolved', bg: '#DCFCE7', fg: '#16A34A' },
  CLOSED: { label: 'Closed', bg: '#F3F4F6', fg: '#6B7280' },
};
const statusOf = (s) => STATUS[s] || { label: s, bg: '#F3F4F6', fg: '#6B7280' };

const HELP_CARDS = [
  { emoji: '💳', title: 'Billing & Plan', desc: 'Invoices, plan limits, upgrades', cat: 'billing' },
  { emoji: '⚙️', title: 'Technical Problem', desc: 'Bugs, errors, unexpected behaviour', cat: 'technical' },
  { emoji: '👥', title: 'Candidates & Pipeline', desc: 'Pipeline issues, cleared candidates', cat: 'candidates' },
];

const FAQS = [
  ['How do I post a new job opportunity?', 'Go to Opportunities → Create New. Fill in the job title, description, required positions, and evaluation criteria. Save as Draft, then click Publish when ready to go live.', 'Set a realistic closing date — candidates need time to complete the evaluation pipeline.'],
  ['Why is a candidate not showing in my cleared list?', 'A candidate only appears in Cleared after passing all stages: Resume Screen, System Check, Identity Verification, Assessment, and Interview. If any stage is pending, they remain in the pipeline.', 'Check the Recruitment Funnel on the opportunity detail page to see exactly which stage a candidate is stuck at.'],
  ['How does billing and the opportunity limit work?', 'Your plan defines the maximum number of simultaneously open opportunities. When you close or fulfil an opportunity, that slot is freed up. Publishing a new opportunity counts against your active limit.', 'Upgrade your plan from the Billing page if you need to run more opportunities simultaneously.'],
  ['What happens when an opportunity is paused?', 'Pausing hides the opportunity from new candidates but keeps the existing pipeline intact. Candidates already in progress continue their evaluation. You can resume at any time.', 'Use Pause instead of Close if you just need to temporarily stop intake — a Closed opportunity cannot be reopened.'],
  ['How do I update my company profile or logo?', 'Go to Profile → Company Information to update your company name, website, and industry. Changes take effect immediately on your public career page.', 'Keep your details current — they are displayed to candidates on the career page.'],
];

const SEED_TICKETS = [
  { id: 't1', ticketNumber: 'TKT-1043', subject: 'How are rank weights calculated?', category: 'candidates', priority: 'Medium', status: 'RESOLVED', createdAt: '24 Jun 2026', updatedAt: '25 Jun 2026',
    messages: [
      { from: 'client', text: 'How exactly is the weighted score column computed on the Rank List?', timestamp: '24 Jun 2026 · 10:12 AM' },
      { from: 'support', text: 'Each parameter weight (e.g. Coding 30%) is multiplied by the candidate’s sub-score for that parameter, summed, and divided by 100. Thresholds gate who clears; weights only decide the order.', timestamp: '24 Jun 2026 · 2:40 PM' },
      { from: 'client', text: 'Got it — that matches what I see now. Thanks!', timestamp: '25 Jun 2026 · 9:02 AM' },
    ] },
  { id: 't2', ticketNumber: 'TKT-1051', subject: 'Candidate stuck on hardware check', category: 'technical', priority: 'High', status: 'IN_PROGRESS', createdAt: '26 Jun 2026', updatedAt: '26 Jun 2026',
    messages: [
      { from: 'client', text: 'A candidate says the system check keeps failing on the microphone step.', timestamp: '26 Jun 2026 · 11:30 AM' },
      { from: 'support', text: 'Thanks for flagging. Could you confirm the browser they are using? We are investigating a Safari permissions edge case.', timestamp: '26 Jun 2026 · 12:05 PM' },
    ] },
  { id: 't3', ticketNumber: 'TKT-1058', subject: 'Add a teammate as Recruiter', category: 'account', priority: 'Low', status: 'OPEN', createdAt: '27 Jun 2026', updatedAt: '27 Jun 2026',
    messages: [
      { from: 'client', text: 'How do I invite a colleague and give them the Recruiter role?', timestamp: '27 Jun 2026 · 4:18 PM' },
    ] },
];

function todayStr() {
  try {
    const d = new Date();
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '28 Jun 2026'; }
}
function nowStr() {
  try {
    const d = new Date();
    return `${todayStr()} · ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
  } catch { return `${todayStr()} · 12:00 PM`; }
}

export default function Support() {
  const [tickets, setTickets] = useState(SEED_TICKETS);
  const [formOpen, setFormOpen] = useState(false);
  const [formCat, setFormCat] = useState('');
  const [detail, setDetail] = useState(null);
  const [expanded, setExpanded] = useState(0);
  let ticketSeq = tickets.length;

  const openForm = (cat = '') => { setFormCat(cat); setFormOpen(true); };
  const addTicket = ({ category, subject, priority, description }) => {
    ticketSeq += 1;
    const t = {
      id: 'n' + Math.random().toString(36).slice(2, 7),
      ticketNumber: 'TKT-' + (1060 + tickets.length),
      subject, category, priority, status: 'OPEN', createdAt: todayStr(), updatedAt: todayStr(),
      messages: [{ from: 'client', text: description, timestamp: nowStr() }],
    };
    setTickets((list) => [t, ...list]);
    setFormOpen(false);
  };
  const sendReply = (ticketId, text) => {
    setTickets((list) => list.map((t) => (t.id === ticketId
      ? { ...t, updatedAt: todayStr(), messages: [...t.messages, { from: 'client', text, timestamp: nowStr() }] }
      : t)));
    setDetail((d) => (d && d.id === ticketId ? { ...d, messages: [...d.messages, { from: 'client', text, timestamp: nowStr() }] } : d));
  };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: '#14212A', margin: '0 0 4px' }}>Support</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Get help with billing, technical issues, and platform questions</p>
        </div>
        <button className="btn-primary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => openForm('')}><Plus size={15} /> Raise a Ticket</button>
      </div>

      {/* quick help cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginBottom: 30 }}>
        {HELP_CARDS.map((c) => (
          <div key={c.cat} onClick={() => openForm(c.cat)} className="card" style={{ textAlign: 'center', padding: '24px 20px', cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#056FD4'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(5,111,212,0.10)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 12px' }}>{c.emoji}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#14212A' }}>{c.title}</div>
            <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, margin: '4px 0 12px' }}>{c.desc}</div>
            <span style={{ fontSize: 13, color: '#056FD4', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Get Help <ArrowRight size={14} /></span>
          </div>
        ))}
      </div>

      {/* my tickets */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', color: '#9CA3AF', marginBottom: 12 }}>MY TICKETS</div>
        {tickets.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#14212A' }}>No tickets yet</div>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>Raise a ticket if you need help with anything</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tickets.map((t) => {
              const st = statusOf(t.status);
              return (
                <div key={t.id} className="card" style={{ padding: '18px 20px', transition: 'border-color .15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#056FD4'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ flexShrink: 0, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, color: '#9CA3AF' }}>{t.ticketNumber}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#14212A' }}>{t.subject}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                        <span style={{ background: '#F4F7FB', color: '#6B7280', fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 6 }}>{labelOf(t.category)}</span>
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>Raised {t.createdAt} · Updated {t.updatedAt}</span>
                      </div>
                    </div>
                    <span className="badge" style={{ flexShrink: 0, background: st.bg, color: st.fg }}>{st.label}</span>
                    <button className="btn-ghost" style={{ flexShrink: 0, padding: '6px 12px', fontSize: 12.5 }} onClick={() => setDetail(t)}>View <ArrowRight size={13} /></button>
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

      {formOpen && <RaiseTicketForm initialCategory={formCat} onClose={() => setFormOpen(false)} onSubmit={addTicket} />}
      {detail && <TicketDetailView ticket={detail} onClose={() => setDetail(null)} onReply={sendReply} />}
    </div>
  );
}

/* ── Raise a Support Ticket (modal) ── */
function RaiseTicketForm({ initialCategory, onClose, onSubmit }) {
  const [category, setCategory] = useState(initialCategory || '');
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [description, setDescription] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasContent = subject.trim() || description.trim() || category !== (initialCategory || '');
  const canSubmit = category && subject.trim() && description.trim() && !busy;

  const onBackdrop = () => { if (hasContent) { setShake(true); setTimeout(() => setShake(false), 450); } else onClose(); };
  const clearForm = () => { setCategory(initialCategory || ''); setSubject(''); setPriority('Medium'); setDescription(''); };
  const submit = () => { if (!canSubmit) return; setBusy(true); setTimeout(() => onSubmit({ category, subject: subject.trim(), priority, description: description.trim() }), 500); };

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
          <div style={{ marginBottom: 16 }}>
            {lbl('Issue Type')}
            <select style={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select issue type</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
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
function TicketDetailView({ ticket, onClose, onReply }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const st = statusOf(ticket.status);

  const send = () => {
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true);
    setReply('');
    setTimeout(() => { onReply(ticket.id, text); setSending(false); }, 350);
  };
  const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); } };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 60 }} />
      <div style={{ position: 'fixed', right: 0, top: 0, height: '100%', width: 580, maxWidth: '94vw', background: '#fff', zIndex: 61, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 16px rgba(0,0,0,0.1)', animation: 'slideIn .25s ease' }}>
        {/* header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#14212A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.ticketNumber} · {ticket.subject}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                <span style={{ background: '#F4F7FB', color: '#6B7280', fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 6 }}>{labelOf(ticket.category)}</span>
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 7 }}>Raised {ticket.createdAt} · Last updated {ticket.updatedAt} · Response time: ~24hrs</div>
            </div>
            <X size={18} color="#94A3B8" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={onClose} />
          </div>
        </div>

        {/* thread */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 22, background: '#F8FAFC' }}>
          {ticket.messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginTop: 40 }}>No messages yet.</div>
          ) : ticket.messages.map((m, i) => {
            const mine = m.from === 'client' || m.from === 'user';
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
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={onKey} rows={3} placeholder="Type your reply…  (⌘/Ctrl + Enter to send)"
            style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 13px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.55 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn-primary" disabled={!reply.trim() || sending} onClick={send}>{sending ? 'Sending…' : <>Send Reply <ArrowRight size={14} /></>}</button>
          </div>
        </div>
      </div>
    </>
  );
}
