import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LifeBuoy, AlertTriangle, ArrowRight, ChevronRight, Check, X, User, Send, Wallet, Search, Link2, Flame, RefreshCw, Mail, Clock, RotateCcw, Repeat, Play, Undo2, Megaphone, Info, CheckCircle2, ShieldCheck, MessageSquare, Bug, Lock, Hourglass, Coins } from 'lucide-react';
import { useApp, TICKET_STATUS, TICKET_FLOW, CASE_TYPES, caseLabel, JOB_KINDS, RECOVERY_ACTIONS, walletOf, fmtCr, roleName } from '../store.jsx';
import { ClientStatusBadge, WalletStateBadge, TicketStatusBadge, PriorityBadge, LedgerTypeBadge, PendingChip, Credits, useToast, Modal, useReasonGate, PermButton, useTab, Tabs, PageHeader, Kpi, EmptyRow, Mono } from '../components/admin/ui.jsx';

/* ═══════════ Support & Operations (spec §09) — tickets desk + Needs Attention / Failed Jobs queue ═══════════ */

const TABS = [{ key: 'tickets', label: 'Tickets' }, { key: 'jobs', label: 'Needs Attention / Failed Jobs' }, { key: 'running', label: 'Running / holds' }];
const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];
const ACTIVE = (t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED';
const ACTION_ICON = { retry: RefreshCw, resend: Mail, extend: Clock, reset: RotateCcw, retake: Repeat, resume: Play, reverse: Undo2, escalate: Megaphone };
const JOB_STATUS = { OPEN: ['#FEF3C7', '#B45309', 'Open'], RECOVERED: ['#DCFCE7', '#15803D', 'Recovered'], ESCALATED: ['#FEE2E2', '#B91C1C', 'Escalated'] };
const CASE_GROUPS = [['candidate', 'Candidate issues (reach Cuba via the client)'], ['billing', 'Billing'], ['account', 'Account'], ['other', 'Other']];
const shortDate = (s = '') => { const m = String(s).match(/^(\d{1,2}\s+[A-Za-z]{3})/); return m ? m[1] : s; };

export default function AdminSupport() {
  const loc = useLocation();
  const nav = useNavigate();
  const { tickets, failedJobs, clients, can, currentAdmin, ledger, nameOf } = useApp();
  const initialTab = new URLSearchParams(loc.search).get('job') ? 'jobs' : 'tickets';
  const [tab, , params] = useTab(TABS, initialTab);
  const [show, toastNode] = useToast();

  const setParam = (k, v) => { const p = new URLSearchParams(loc.search); if (v == null || v === '') p.delete(k); else p.set(k, v); nav({ pathname: loc.pathname, search: '?' + p.toString() }, { replace: true }); };
  const changeTab = (k) => { const p = new URLSearchParams(loc.search); p.set('tab', k); p.delete('ticket'); p.delete('job'); nav({ pathname: loc.pathname, search: '?' + p.toString() }, { replace: true }); };

  const activeTickets = tickets.filter(ACTIVE).length;
  const openJobs = failedJobs.filter((j) => j.status === 'OPEN').length;

  /* in-flight work is real state, not a constant: a RESERVE with no settlement is an evaluation running right now (spec §05/§13) */
  const settledRefs = new Set(ledger.filter((e) => e.reserveRef).map((e) => e.reserveRef));
  const openHolds = ledger.filter((e) => e.type === 'RESERVE' && !settledRefs.has(e.id));

  const tabs = TABS.map((t) => ({ ...t, count: t.key === 'tickets' ? activeTickets : t.key === 'jobs' ? openJobs : openHolds.length }));
  const openTicketId = tab === 'tickets' ? params.get('ticket') : null;
  const highlightJob = tab === 'jobs' ? params.get('job') : null;
  const readOnly = tab === 'tickets' ? !can('ticket.manage') : tab === 'jobs' ? !can('job.recover') : false;

  return (
    <>
      <PageHeader title="Support & Operations" sub="Locked support path: Candidate → Client Support → Cuba Admin. A technical failure is never a candidate failure." />
      <Tabs tabs={tabs} active={tab} onChange={changeTab} />

      {readOnly && (
        <div className="banner info" style={{ marginBottom: 16 }}>
          <Lock size={15} style={{ flexShrink: 0 }} />
          <div><b>Read-only.</b> Your role ({roleName(currentAdmin.role)}) can view this queue but cannot {tab === 'tickets' ? 'change tickets or reply' : 'run recovery actions'} — controls are shown disabled.</div>
        </div>
      )}

      {tab === 'tickets'
        ? <TicketsTab tickets={tickets} clients={clients} failedJobs={failedJobs} nav={nav} show={show} openId={openTicketId} setOpenId={(id) => setParam('ticket', id)} />
        : tab === 'jobs'
        ? <JobsTab failedJobs={failedJobs} clients={clients} nav={nav} show={show} highlight={highlightJob} />
        : <RunningTab holds={openHolds} failedJobs={failedJobs} nameOf={nameOf} nav={nav} />}

      {toastNode}
    </>
  );
}

/* ═══════════════════════════════ TICKETS ═══════════════════════════════ */
function TicketsTab({ tickets, clients, failedJobs, nav, show, openId, setOpenId }) {
  const [status, setStatus] = useState('all');
  const [prio, setPrio] = useState('all');
  const [caseType, setCaseType] = useState('all');
  const [client, setClient] = useState('all');
  const [q, setQ] = useState('');
  const nameOf = (id) => clients.find((c) => c.id === id)?.name || '—';

  const kpi = {
    open: tickets.filter((t) => t.status === 'OPEN').length,
    inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
    waiting: tickets.filter((t) => t.status === 'WAITING_ON_CLIENT').length,
    urgent: tickets.filter((t) => t.priority === 'Urgent' && ACTIVE(t)).length,
  };
  const countByStatus = (s) => tickets.filter((t) => t.status === s).length;
  const needle = q.trim().toLowerCase();
  const list = tickets.filter((t) =>
    (status === 'all' || t.status === status) &&
    (prio === 'all' || t.priority === prio) &&
    (caseType === 'all' || t.caseType === caseType) &&
    (client === 'all' || t.clientId === client) &&
    (!needle || [t.id, t.subject, t.candidate, t.oppTitle, nameOf(t.clientId)].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))));
  const open = openId ? tickets.find((t) => t.id === openId) : null;
  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name));
  const selectStyle = { width: 'auto', minWidth: 150, padding: '7px 10px', fontSize: 12.5 };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
        <Kpi label="Open" value={kpi.open} sub="new · unassigned" color="#056FD4" bar="#056FD4" />
        <Kpi label="In progress" value={kpi.inProgress} sub="support is working" color="#B45309" bar="#F59E0B" />
        <Kpi label="Waiting on client" value={kpi.waiting} sub="needs client reply" color="#6D28D9" bar="#8B5CF6" />
        <Kpi label="Urgent" value={kpi.urgent} sub="active urgent tickets" color={kpi.urgent ? '#B91C1C' : '#14212A'} bar="#EF4444" />
      </div>

      {/* filters */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className={'filter-btn' + (status === 'all' ? ' active' : '')} onClick={() => setStatus('all')}>All <span style={{ opacity: .7 }}>{tickets.length}</span></button>
          {TICKET_FLOW.map((s) => <button key={s} className={'filter-btn' + (status === s ? ' active' : '')} onClick={() => setStatus(s)}>{TICKET_STATUS[s].label} <span style={{ opacity: .7 }}>{countByStatus(s)}</span></button>)}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="input" style={selectStyle} value={prio} onChange={(e) => setPrio(e.target.value)}>
            <option value="all">All priorities</option>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input" style={selectStyle} value={caseType} onChange={(e) => setCaseType(e.target.value)}>
            <option value="all">All case types</option>{CASE_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select className="input" style={selectStyle} value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="all">All clients</option>{sortedClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input className="input" style={{ paddingLeft: 32, padding: '7px 10px 7px 32px', fontSize: 12.5 }} placeholder="Search ticket, subject, candidate, client…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {(status !== 'all' || prio !== 'all' || caseType !== 'all' || client !== 'all' || q) && <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => { setStatus('all'); setPrio('all'); setCaseType('all'); setClient('all'); setQ(''); }}><X size={13} /> Clear</button>}
        </div>
      </div>

      {/* table */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Ticket</th><th>Client</th><th>Subject</th><th>Case type</th><th>Priority</th><th>Status</th><th>Updated</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
            <tbody>
              {list.length === 0 ? <EmptyRow cols={8} text="No tickets match these filters." /> : list.map((t) => {
                const cl = clients.find((c) => c.id === t.clientId);
                return (
                  <tr className="row" key={t.id} onClick={() => setOpenId(t.id)} style={t.id === openId ? { background: '#F8FAFF' } : undefined}>
                    <td><Mono>{t.id}</Mono></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => cl && nav('/admin/clients/' + cl.id)}>{nameOf(t.clientId)}</span>
                      {cl && <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}><ClientStatusBadge status={cl.status} /><WalletStateBadge state={walletOf(cl).state} /></div>}
                    </td>
                    <td style={{ fontWeight: 500, minWidth: 220 }}>
                      {t.subject}
                      {(t.candidate || t.oppTitle) && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>{[t.candidate, t.oppTitle].filter(Boolean).join(' · ')}</div>}
                    </td>
                    <td style={{ fontSize: 12.5, color: '#475569', whiteSpace: 'nowrap' }}>{caseLabel(t.caseType)}</td>
                    <td><PriorityBadge priority={t.priority} /></td>
                    <td><TicketStatusBadge status={t.status} /></td>
                    <td style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{t.updated}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={(e) => { e.stopPropagation(); setOpenId(t.id); }}>Open <ChevronRight size={13} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CasesReference tickets={tickets} />

      {open && <TicketDrawer key={open.id} ticket={open} clients={clients} failedJobs={failedJobs} nav={nav} show={show} onClose={() => setOpenId(null)} />}
    </>
  );
}

/* typical support cases (spec §09) — compact reference with live active counts */
function CasesReference({ tickets }) {
  const activeCount = (v) => tickets.filter((t) => t.caseType === v && ACTIVE(t)).length;
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><LifeBuoy size={16} color="#056FD4" /> Typical support cases</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Reference from the product spec · counts show active tickets per case type.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#475569', flexWrap: 'wrap' }}>
          <span className="chip" style={{ background: '#F3F4F6' }}>Candidate</span><ArrowRight size={12} color="#9CA3AF" />
          <span className="chip" style={{ background: '#EFF6FF', color: '#1E40AF' }}>Client Support</span><ArrowRight size={12} color="#9CA3AF" />
          <span className="chip" style={{ background: '#14212A', color: '#fff' }}>Cuba Admin</span>
          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>locked support path</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {CASE_GROUPS.map(([g, title]) => {
          const items = CASE_TYPES.filter((c) => c.group === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>{title}</div>
              {items.map((c) => { const n = activeCount(c.value); return (
                <div key={c.value} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #F3F4F6', fontSize: 12.5, color: '#374151' }}>
                  <span>{c.label}</span>
                  <span className="badge" style={{ background: n ? '#EFF6FF' : '#F3F4F6', color: n ? '#056FD4' : '#9CA3AF' }}>{n}</span>
                </div>
              ); })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── ticket drawer (right slide-in) ── */
function TicketDrawer({ ticket, clients, failedJobs, nav, show, onClose }) {
  const { can, setTicketStatus, setTicketPriority, replyTicket, addAudit } = useApp();
  const [reply, setReply] = useState('');
  const endRef = useRef(null);
  const manage = can('ticket.manage');
  const cl = clients.find((c) => c.id === ticket.clientId);
  const idx = TICKET_FLOW.indexOf(ticket.status);
  const next = idx >= 0 ? TICKET_FLOW[idx + 1] : null;
  const related = ticket.candidate ? failedJobs.find((j) => j.candidate === ticket.candidate) : null;

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [ticket.messages.length]);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const send = () => { const text = reply.trim(); if (!text || !manage) return; replyTicket(ticket.id, 'support', text); setReply(''); show(`Reply sent on ${ticket.id}${ticket.status === 'OPEN' ? ' — moved to In progress' : ''}`); };
  const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); } };
  const moveTo = (s) => { if (!s || s === ticket.status) return; setTicketStatus(ticket.id, s); show(`${ticket.id} → ${TICKET_STATUS[s]?.label || s}`); };
  const changePriority = (p) => { if (p === ticket.priority) return; setTicketPriority(ticket.id, p); addAudit('Support', `Ticket priority → ${p}`, ticket.id, { clientId: ticket.clientId }); show(`${ticket.id} priority set to ${p}`); };
  const escalate = () => { setTicketPriority(ticket.id, 'Urgent'); addAudit('Support', 'Escalated ticket → Urgent', ticket.id, { clientId: ticket.clientId }); show(`${ticket.id} escalated — priority set to Urgent`); };
  const smallBtn = { padding: '6px 11px', fontSize: 12 };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,42,0.25)', zIndex: 60 }} />
      <div style={{ position: 'fixed', right: 0, top: 0, height: '100%', width: 600, maxWidth: '94vw', background: '#fff', zIndex: 61, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 16px rgba(0,0,0,0.1)', animation: 'slideIn .25s ease' }}>
        {/* header */}
        <div style={{ padding: '16px 22px 14px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Mono>{ticket.id}</Mono><PriorityBadge priority={ticket.priority} /><TicketStatusBadge status={ticket.status} /><span className="chip" style={{ background: '#F4F7FB', color: '#475569', fontSize: 11 }}>{caseLabel(ticket.caseType)}</span></div>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: '#14212A', marginTop: 8, lineHeight: 1.3 }}>{ticket.subject}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap', fontSize: 12.5 }}>
                <span style={{ color: '#6B7280' }}>Client</span>
                <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => cl && nav('/admin/clients/' + cl.id)}>{cl?.name || '—'}</span>
                {cl && <><ClientStatusBadge status={cl.status} /><WalletStateBadge state={walletOf(cl).state} /></>}
              </div>
              {(ticket.candidate || ticket.oppTitle) && (
                <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 5 }}>
                  {ticket.candidate && <><span style={{ color: '#9CA3AF' }}>Candidate</span> <b style={{ color: '#14212A' }}>{ticket.candidate}</b></>}
                  {ticket.candidate && ticket.oppTitle && ' · '}
                  {ticket.oppTitle && <><span style={{ color: '#9CA3AF' }}>Opportunity</span> <b style={{ color: '#14212A' }}>{ticket.oppTitle}</b></>}
                </div>
              )}
              <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 5 }}>Raised {ticket.createdAt} by {ticket.raisedBy || 'client'} · Last updated {ticket.updated}</div>
            </div>
            <X size={18} color="#94A3B8" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={onClose} />
          </div>
        </div>

        {/* lifecycle + controls */}
        <div style={{ padding: '12px 22px', borderBottom: '1px solid #E2E8F0', background: '#FAFBFC' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Lifecycle</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            {TICKET_FLOW.map((s, i) => { const st = TICKET_STATUS[s]; const cur = i === idx; const done = i < idx; return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: cur ? st.bg : done ? '#DCFCE7' : '#F3F4F6', color: cur ? st.fg : done ? '#15803D' : '#9CA3AF', border: `1.5px solid ${cur ? st.fg : 'transparent'}` }}>{done && <Check size={10} />}{st.label}</span>
                {i < TICKET_FLOW.length - 1 && <ChevronRight size={12} color="#CBD5E1" />}
              </div>
            ); })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <PermButton action="ticket.manage" className="btn-primary" style={smallBtn} disabled={!next} title={next ? `Move to ${TICKET_STATUS[next].label}` : 'Ticket is closed'} onClick={() => moveTo(next)}>Move to next{next && <> · {TICKET_STATUS[next].label}</>} <ArrowRight size={12} /></PermButton>
            <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={ticket.status} disabled={!manage} onChange={(e) => moveTo(e.target.value)}>
              {TICKET_FLOW.map((s) => <option key={s} value={s}>{TICKET_STATUS[s].label}</option>)}
            </select>
            <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 'auto' }}>Priority</span>
            <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={ticket.priority} disabled={!manage} onChange={(e) => changePriority(e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button className="btn-ghost" style={smallBtn} onClick={() => nav(`/admin/clients/${ticket.clientId}?tab=ledger`)}><Wallet size={13} /> View client wallet</button>
            {related && <button className="btn-ghost" style={smallBtn} onClick={() => nav(`/admin/support?tab=jobs&job=${related.id}`)}><Link2 size={13} /> Find related failed job <Mono>{related.id}</Mono></button>}
            <PermButton action="ticket.manage" className="btn-ghost" style={{ ...smallBtn, color: ticket.priority === 'Urgent' ? undefined : '#B91C1C' }} disabled={ticket.priority === 'Urgent'} title={ticket.priority === 'Urgent' ? 'Already Urgent' : 'Set priority to Urgent'} onClick={escalate}><Flame size={13} /> {ticket.priority === 'Urgent' ? 'Escalated' : 'Escalate'}</PermButton>
          </div>
        </div>

        {/* thread */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 22, background: '#F8FAFC' }}>
          {ticket.messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginTop: 40 }}><MessageSquare size={22} color="#CBD5E1" /><div style={{ marginTop: 6 }}>No messages yet.</div></div>
          ) : ticket.messages.map((m, i) => {
            const fromClient = m.from === 'client' || m.from === 'user';
            return fromClient ? (
              <div key={i} style={{ marginBottom: 16, textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 3 }}>{cl?.name || 'Client'}</div>
                <div style={{ display: 'inline-block', maxWidth: '80%', background: '#DBEAFE', color: '#14212A', borderRadius: 12, padding: '10px 13px', fontSize: 13, lineHeight: 1.55, textAlign: 'left' }}>{m.text}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{m.timestamp}</div>
              </div>
            ) : (
              <div key={i} style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
                <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: '#056FD4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={16} /></div>
                <div style={{ maxWidth: '80%' }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 3 }}>Cuba Support</div>
                  <div style={{ background: '#fff', border: '1px solid #E2E8F0', color: '#14212A', borderRadius: 12, padding: '10px 13px', fontSize: 13, lineHeight: 1.55 }}>{m.text}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{m.timestamp}</div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* reply */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #E2E8F0' }}>
          <textarea className="input" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={onKey} rows={3} disabled={!manage} placeholder={manage ? 'Reply as Cuba Support…  (⌘/Ctrl + Enter to send)' : 'Your role cannot reply to tickets.'} style={{ resize: 'vertical', lineHeight: 1.55 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10 }}>
            <span style={{ fontSize: 11.5, color: '#9CA3AF' }}><span className="kbd">⌘</span>/<span className="kbd">Ctrl</span> + <span className="kbd">Enter</span> to send{ticket.status === 'OPEN' && ' · first reply moves the ticket to In progress'}</span>
            <PermButton action="ticket.manage" className="btn-primary" disabled={!reply.trim()} onClick={send}><Send size={14} /> Send reply</PermButton>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════ FAILED JOBS ═══════════════════════════════ */
function JobsTab({ failedJobs, clients, nav, show, highlight }) {
  const { recoverJob } = useApp();
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [client, setClient] = useState('all');
  const [askReason, reasonNode] = useReasonGate();
  const [askNote, noteNode] = useNoteGate();
  const nameOf = (id) => clients.find((c) => c.id === id)?.name || '—';

  const kpi = {
    open: failedJobs.filter((j) => j.status === 'OPEN').length,
    recovered: failedJobs.filter((j) => j.status === 'RECOVERED').length,
    escalated: failedJobs.filter((j) => j.status === 'ESCALATED').length,
    held: failedJobs.filter((j) => j.status === 'OPEN').reduce((a, j) => a + (Number(j.creditsHeld) || 0), 0),
  };
  const list = failedJobs.filter((j) => (kind === 'all' || j.kind === kind) && (status === 'all' || j.status === status) && (client === 'all' || j.clientId === client));
  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name));

  const run = (job, a) => {
    const done = (reason) => {
      recoverJob(job.id, a.key, reason);
      if (a.key === 'reverse') show(job.creditsHeld > 0 ? `Credits reversed (+${job.creditsHeld}) — technical failure, not candidate failure` : `${job.id} marked recovered — no credits were on hold`);
      else if (a.key === 'escalate') show(`${job.id} escalated — ${job.candidate} stays on hold, not failed`);
      else show(`${a.label} → ${job.id} recovered · ${job.candidate}`);
    };
    if (a.key === 'reverse') askReason({ action: 'job.reverseCredits', title: `Reverse credits on ${job.id}`, confirmLabel: 'Reverse credits', body: <>Refund <b>{fmtCr(job.creditsHeld)}</b> to <b>{nameOf(job.clientId)}</b> for {job.candidate} · {job.module}. Posts a REFUND entry referencing {job.id}; the original ledger lines stay immutable.</> }, done);
    else if (a.key === 'escalate') askNote({ title: `Escalate ${job.id}`, confirmLabel: 'Escalate', body: `${JOB_KINDS[job.kind]?.label || job.kind} · ${job.candidate} · ${nameOf(job.clientId)}. Engineering will pick this up; the candidate's attempt stays on hold and is never marked as failed.` }, done);
    else done('');
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
        <Kpi label="Open" value={kpi.open} sub="needs a recovery action" color={kpi.open ? '#B45309' : '#14212A'} bar="#F59E0B" />
        <Kpi label="Recovered" value={kpi.recovered} sub="attempt restored" color="#15803D" bar="#22C55E" />
        <Kpi label="Escalated" value={kpi.escalated} sub="with engineering" color={kpi.escalated ? '#B91C1C' : '#14212A'} bar="#EF4444" />
        <Kpi label="Credits on hold" value={fmtCr(kpi.held)} size={22} sub={<>open jobs · rate card <PendingChip /></>} color="#056FD4" bar="#056FD4" />
      </div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className={'filter-btn' + (kind === 'all' ? ' active' : '')} onClick={() => setKind('all')}>All kinds</button>
          {Object.entries(JOB_KINDS).map(([k, v]) => <button key={k} className={'filter-btn' + (kind === k ? ' active' : '')} onClick={() => setKind(k)}><span style={{ width: 7, height: 7, borderRadius: '50%', background: kind === k ? '#fff' : v.color, display: 'inline-block' }} />{v.label}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className={'filter-btn' + (status === 'all' ? ' active' : '')} onClick={() => setStatus('all')}>All</button>
            {Object.entries(JOB_STATUS).map(([k, [, , l]]) => <button key={k} className={'filter-btn' + (status === k ? ' active' : '')} onClick={() => setStatus(k)}>{l} <span style={{ opacity: .7 }}>{failedJobs.filter((j) => j.status === k).length}</span></button>)}
          </div>
          <select className="input" style={{ width: 'auto', minWidth: 150, padding: '7px 10px', fontSize: 12.5, marginLeft: 'auto' }} value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="all">All clients</option>{sortedClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.length === 0 ? (
            <div className="card" style={{ padding: 36, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}><CheckCircle2 size={26} color="#22C55E" /><div style={{ marginTop: 8, fontWeight: 600, color: '#374151' }}>Queue clear</div>Nothing needs attention for these filters.</div>
          ) : list.map((j) => <JobCard key={j.id} job={j} client={clients.find((c) => c.id === j.clientId)} highlighted={j.id === highlight} nav={nav} onAction={(a) => run(j, a)} />)}
        </div>
        <JobsExplainer />
      </div>

      {reasonNode}{noteNode}
    </>
  );
}

function JobCard({ job, client, highlighted, nav, onAction }) {
  const ref = useRef(null);
  const kindMeta = JOB_KINDS[job.kind] || { label: job.kind, color: '#6B7280' };
  const [sb, sf, sl] = JOB_STATUS[job.status] || JOB_STATUS.OPEN;
  useEffect(() => { if (highlighted) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [highlighted]);
  const meta = (k, v) => <span style={{ fontSize: 12.5, color: '#475569' }}><span style={{ color: '#9CA3AF' }}>{k}</span> <b style={{ color: '#14212A', fontWeight: 600 }}>{v}</b></span>;

  return (
    <div ref={ref} className={'card' + (highlighted ? ' fade-in' : '')} style={{ padding: '14px 18px', border: highlighted ? '2px solid #056FD4' : undefined, boxShadow: highlighted ? '0 0 0 4px rgba(5,111,212,0.12)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: kindMeta.color, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#14212A' }}>{kindMeta.label}</span>
          <Mono>{job.id}</Mono>
          <span className="badge" style={{ background: sb, color: sf }}>{sl}</span>
          {highlighted && <span className="chip" style={{ background: '#EFF6FF', color: '#056FD4', fontSize: 11 }}><Link2 size={11} /> from link</span>}
        </div>
        <span style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}><Clock size={12} style={{ verticalAlign: -2 }} /> since {job.since}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
        <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>Client</span>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer', fontSize: 13 }} onClick={() => client && nav('/admin/clients/' + client.id)}>{client?.name || '—'}</span>
        {client && <><ClientStatusBadge status={client.status} /><WalletStateBadge state={walletOf(client).state} /></>}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
        {meta('Opportunity', job.oppTitle)}{meta('Candidate', job.candidate)}{meta('Module', job.module)}
      </div>
      <div style={{ fontSize: 13, color: '#374151', marginTop: 8, padding: '8px 11px', background: '#F8FAFC', borderRadius: 8, borderLeft: `3px solid ${kindMeta.color}` }}><Bug size={12} style={{ verticalAlign: -2, marginRight: 5, color: kindMeta.color }} />{job.detail}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <span style={{ fontSize: 12.5, color: '#6B7280' }}>Credits held: {job.creditsHeld > 0 ? <Credits n={-job.creditsHeld} /> : <span style={{ color: '#9CA3AF' }}>—</span>}</span>
        {job.actions.length > 0 && <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 6 }}>History</span>}
        {job.actions.map((a, i) => <span key={i} className="chip" style={{ background: '#F3F4F6', color: '#475569', fontSize: 11 }} title={a.reason || undefined}>{a.key} · {shortDate(a.when)} by {a.by}</span>)}
      </div>

      {job.status === 'OPEN' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
          {RECOVERY_ACTIONS.map((a) => {
            const Icon = ACTION_ICON[a.key] || RefreshCw;
            const reverse = a.key === 'reverse';
            const noHold = reverse && !(job.creditsHeld > 0);
            const danger = a.key === 'escalate';
            return (
              <PermButton key={a.key} action={a.perm || 'job.recover'} className="btn-ghost" style={{ padding: '6px 11px', fontSize: 12, color: danger ? '#B91C1C' : reverse ? '#15803D' : undefined }} disabled={noHold} title={noHold ? 'No credits are held on this job' : reverse ? 'High-risk: reason required, audited' : a.label} onClick={() => onAction(a)}><Icon size={13} /> {a.label}{reverse && job.creditsHeld > 0 && <> (+{job.creditsHeld})</>}</PermButton>
            );
          })}
        </div>
      )}
    </div>
  );
}

function JobsExplainer() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="banner info" style={{ margin: 0, alignItems: 'flex-start' }}>
        <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, lineHeight: 1.5 }}><b>Locked principle.</b> A technical failure must not be interpreted as a candidate performance failure. Recovery restores the attempt; held credits are reversed as a REFUND ledger entry, never by editing history.</div>
      </div>
      <div className="card" style={{ padding: '14px 18px' }}>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={15} color="#B45309" /> What lands in this queue</div>
        {Object.entries(JOB_KINDS).map(([k, v], i, arr) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none', fontSize: 12.5, color: '#374151' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, flexShrink: 0 }} />{v.label}
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: '14px 18px' }}>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Info size={15} color="#056FD4" /> Recovery actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {RECOVERY_ACTIONS.map((a) => { const Icon = ACTION_ICON[a.key] || RefreshCw; return (
            <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#374151' }}>
              <Icon size={13} color={a.key === 'reverse' ? '#15803D' : a.key === 'escalate' ? '#B91C1C' : '#6B7280'} /><span style={{ flex: 1 }}>{a.label}</span>
              {a.perm && <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>reason + audit</span>}
            </div>
          ); })}
        </div>
        <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 10, lineHeight: 1.5 }}>Retry · Resend · Extend · Reset · Retake · Resume mark the job <b>Recovered</b>. Reverse credits posts a refund and marks it Recovered. Escalate hands it to engineering and keeps the hold.</div>
      </div>
    </div>
  );
}

/* ── local note gate: like useReasonGate but for non-high-risk actions that still deserve a note (escalate) ── */
function useNoteGate() {
  const [req, setReq] = useState(null);
  const [note, setNote] = useState('');
  const ask = (opts, onConfirm) => { setNote(''); setReq({ ...opts, onConfirm }); };
  const ok = req && note.trim().length >= 4;
  const node = req ? (
    <Modal title={req.title || 'Add a note'} onClose={() => setReq(null)} width={460}
      footer={<><button className="btn-ghost" onClick={() => setReq(null)}>Cancel</button><button className="btn-primary" disabled={!ok} onClick={() => { const fn = req.onConfirm; const n = note.trim(); setReq(null); fn(n); }}>{req.confirmLabel || 'Confirm'}</button></>}>
      {req.body && <div style={{ fontSize: 13, color: '#374151', marginBottom: 12, lineHeight: 1.5 }}>{req.body}</div>}
      <label className="field-label">Note for engineering <span style={{ color: '#DC2626' }}>*</span></label>
      <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you observe and what should engineering check? (min 4 characters)" style={{ resize: 'vertical' }} />
      <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 8 }}>Recorded on the job's action history and in the audit log.</div>
    </Modal>
  ) : null;
  return [ask, node];
}

/* ═══════════════════════════════ RUNNING / HOLDS ═══════════════════════════════ */
/* What is executing right now — the destination the dashboard's "Running jobs" KPI deep-links to. */
function RunningTab({ holds, failedJobs, nameOf, nav }) {
  const heldTotal = holds.reduce((a, e) => a + (e.hold || 0), 0);
  const stuck = failedJobs.filter((j) => j.status === 'OPEN' && (j.kind === 'PENDING_SCORE' || String(j.kind).startsWith('STUCK_')));
  const jobFor = (e) => failedJobs.find((j) => j.status === 'OPEN' && j.candidate === e.candidate && j.oppId === e.oppId);

  return (
    <>
      <div className="banner info">
        <Hourglass size={16} style={{ flexShrink: 0 }} />
        <span><b>A hold is an evaluation in flight.</b> RESERVE protects the credits before a paid module starts; SETTLEMENT then consumes the actual usage and releases the rest. Billing may block the NEXT evaluation — it never interrupts one on this list.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        <Kpi label="Running now" value={holds.length} sub="open holds · no settlement yet" size={24} bar="#056FD4" />
        <Kpi label="Credits held" value={fmtCr(heldTotal)} sub="protected, not yet consumed" size={24} bar="#B45309" color={heldTotal ? '#B45309' : undefined} />
        <Kpi label="Queued" value={stuck.length} sub="pending score / stuck — waiting on a worker" size={24} bar="#6D28D9" color={stuck.length ? '#B45309' : undefined} />
        <Kpi label="Clients affected" value={new Set(holds.map((h) => h.clientId)).size} sub="tenants with work in flight" size={24} />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 15, fontWeight: 700 }}>Evaluations in flight</div><div style={{ fontSize: 12, color: '#9CA3AF' }}>Client → Opportunity → Candidate → Module, with the credits held against each.</div></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Hold</th><th>Client</th><th>Opportunity → Candidate → Module</th><th>Started</th><th style={{ textAlign: 'right' }}>Held</th><th>State</th></tr></thead>
            <tbody>
              {holds.length === 0 ? <EmptyRow cols={6} text="Nothing running — no open holds. Start one from Usage → a candidate → Simulate an evaluation." /> : holds.map((e) => {
                const j = jobFor(e);
                return (
                  <tr key={e.id}>
                    <td><Mono>{e.id}</Mono><div style={{ marginTop: 3 }}><LedgerTypeBadge type={e.type} /></div></td>
                    <td style={{ fontWeight: 600 }}>{nameOf(e.clientId)}</td>
                    <td style={{ fontSize: 12.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600 }}>{e.oppTitle}</span><ArrowRight size={11} color="#9CA3AF" /><span>{e.candidate}</span><ArrowRight size={11} color="#9CA3AF" /><span>{e.module}</span>
                      </div>
                      <div style={{ color: '#9CA3AF' }}>{e.rate || '—'}</div>
                    </td>
                    <td style={{ color: '#6B7280', whiteSpace: 'nowrap', fontSize: 12.5 }}>{e.when}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: '#B45309' }}><Coins size={12} style={{ verticalAlign: -2 }} /> {fmtCr(e.hold)}</td>
                    <td>
                      {j
                        ? <span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C', cursor: 'pointer' }} onClick={() => nav(`/admin/support?tab=jobs&job=${j.id}`)}><Bug size={11} /> {JOB_KINDS[j.kind]?.label || 'in recovery'}</span>
                        : <span className="badge" style={{ background: '#DBEAFE', color: '#1E40AF' }}>Running</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 18px', borderTop: '1px solid #F3F4F6', fontSize: 11.5, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 7 }}>
          <ShieldCheck size={13} color="#15803D" /> Locked rule: a running evaluation is never stopped for billing — if the wallet cannot cover the settlement it posts as OVERDRAFT instead.
        </div>
      </div>
    </>
  );
}
