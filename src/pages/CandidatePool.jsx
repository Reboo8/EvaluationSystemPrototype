import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertTriangle, Wallet, ExternalLink, FileText, Copy } from 'lucide-react';
import { useApp, fmtCr, fmtDate, inviteStatusOf, inviteUrl, INVITE_SOURCE } from '../store.jsx';
import { useToast, PendingChip } from '../components/admin/ui.jsx';
import OppTabs from '../components/OppTabs.jsx';

const PALETTE = [['#DBEAFE', '#1E40AF'], ['#DCFCE7', '#15803D'], ['#EDE9FE', '#6D28D9'], ['#FFEDD5', '#C2410C'], ['#FCE7F3', '#BE185D']];
const ini = (n) => String(n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/* One line per person: where they are in the funnel right now */
const OUTCOME = {
  CLEARED:     { label: 'Cleared',      bg: '#DCFCE7', fg: '#15803D' },
  REVIEW:      { label: 'Needs review', bg: '#FEF3C7', fg: '#B45309' },
  NOT_CLEARED: { label: 'Not cleared',  bg: '#FEE2E2', fg: '#B91C1C' },
};
function stageOf(row, inv) {
  if (!row.pass) return { key: 'rejected', label: 'Rejected at resume gate', bg: '#FEF2F2', fg: '#DC2626' };
  if (!inv) return { key: 'gate', label: 'Cleared resume gate', bg: '#DCFCE7', fg: '#15803D' };
  const st = inviteStatusOf(inv);
  if (st === 'SUBMITTED') { const o = OUTCOME[inv.outcome?.status] || { label: 'Submitted', bg: '#DCFCE7', fg: '#15803D' }; return { key: 'submitted', ...o, score: inv.outcome?.weighted }; }
  if (st === 'SENT') return { key: 'active', label: 'Link sent', bg: '#DBEAFE', fg: '#1E40AF', sub: `expires ${fmtDate(inv.expiresAt)}` };
  if (st === 'OPENED') return { key: 'active', label: 'Opened the link', bg: '#EDE9FE', fg: '#6D28D9' };
  if (st === 'IN_PROGRESS') return { key: 'active', label: 'Assessment in progress', bg: '#FEF3C7', fg: '#B45309' };
  if (st === 'EXPIRED') return { key: 'closed', label: 'Link expired', bg: '#F3F4F6', fg: '#6B7280' };
  if (st === 'ABANDONED') return { key: 'closed', label: 'Withdrew', bg: '#FEE2E2', fg: '#B91C1C' };
  if (st === 'DECLINED') return { key: 'closed', label: 'Declined', bg: '#F3F4F6', fg: '#6B7280' };
  return { key: 'active', label: st, bg: '#F3F4F6', fg: '#6B7280' };
}

const FILTERS = [['all', 'Everyone'], ['submitted', 'Submitted'], ['active', 'In assessment'], ['rejected', 'Rejected'], ['closed', 'Closed']];

export default function CandidatePool() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getOpportunity, getPool, getInvite, getCandidates, rescue, rateOf, clientCanStart, clientWallet } = useApp();
  const [show, toastNode] = useToast();
  const [filter, setFilter] = useState('all');
  const opp = getOpportunity(id);

  if (!opp) return <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Opportunity not found.</div>;

  const ranked = getCandidates(id);
  const rows = getPool(id).map((c) => {
    const inv = c.inviteToken ? getInvite(c.inviteToken) : null;
    const stage = stageOf(c, inv);
    const report = inv ? ranked.find((r) => r.inviteToken === inv.token) : null;
    return { ...c, inv, stage, report };
  });

  /* A rescue pushes a soft-rejected candidate into the PAID part of the funnel.
     Cost per candidate = every non-resume module on this opportunity + proctoring
     (the resume gate itself was already billed when the assessment was sent). */
  const paidModules = (opp.assessment?.modules || []).filter((m) => m.key !== 'resume');
  const perCandidate = paidModules.reduce((a, m) => a + rateOf(m.key), 0) + rateOf('proctoring');
  const gate = clientCanStart(perCandidate);

  const count = (k) => rows.filter((r) => r.stage.key === k).length;
  const visible = filter === 'all' ? rows : rows.filter((r) => r.stage.key === filter);

  const doRescue = (c) => {
    const inv = rescue(id, c.id);
    show(`${c.name} rescued — assessment link sent${inv?.email ? ' to ' + inv.email : ''}. No credits charged yet; ~${fmtCr(perCandidate)} is reserved when they start.`);
  };
  const copyLink = async (inv) => { try { await navigator.clipboard.writeText(inviteUrl(inv.token)); show('Link copied'); } catch { show(inviteUrl(inv.token)); } };

  return (
    <>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/opportunities')}>Opportunities</span> › {opp.title}
      </div>
      <OppTabs id={id} active="pool" />

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>
            Candidate Pool <span style={{ color: '#9CA3AF', fontWeight: 600 }}>— {rows.length} in the funnel · {count('submitted')} submitted · {count('active')} in assessment · {count('rejected')} rejected</span>
          </div>
          <div style={{ fontSize: 12.5, color: '#6B7280', margin: '2px 0 0' }}>Everyone who entered this role, from resume gate to result. Rejected candidates keep their reason — rescue anyone the analyser knocked out by mistake.</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(([k, label]) => {
            const n = k === 'all' ? rows.length : count(k);
            return <button key={k} className="btn-ghost" onClick={() => setFilter(k)} style={{ padding: '5px 11px', fontSize: 12, ...(filter === k ? { background: '#14212A', color: '#fff', borderColor: '#14212A' } : {}) }}>{label} <span style={{ opacity: 0.6 }}>{n}</span></button>;
          })}
        </div>
      </div>
      <div style={{ height: 16 }} />

      {!gate.ok && (
        <div className="banner danger"><AlertTriangle size={17} />
          <div style={{ flex: 1 }}><b>Rescues are paused.</b> {gate.reason} Candidates already running are unaffected. <span style={{ color: '#056FD4', fontWeight: 700, cursor: 'pointer' }} onClick={() => nav('/billing')}>Top up →</span></div>
        </div>
      )}

      <div className="banner info"><Wallet size={17} />
        <div style={{ flex: 1 }}>
          A rescue only sends the assessment link — <b>no credits move now</b>. About <b>{fmtCr(perCandidate)} per candidate</b><PendingChip /> is reserved the moment they <i>start</i> the assessment ({paidModules.length} module{paidModules.length === 1 ? '' : 's'} + proctoring) and settled against what actually ran. Available now: <b>{fmtCr(clientWallet.available)}</b>.
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No candidates have entered the resume gate yet. Use “Send Assessment” to add some.</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Nobody here yet.</div>
        ) : (
          <table>
            <thead><tr><th>Candidate</th><th>Fit</th><th>Resume gate</th><th>Assessment</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
            <tbody>
              {visible.map((c, i) => {
                const [bg, fg] = PALETTE[i % PALETTE.length];
                const { inv, stage, report } = c;
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ width: 32, height: 32, background: bg, color: fg, fontSize: 11 }}>{ini(c.name)}</div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{[c.email, INVITE_SOURCE[c.source] || null, c.appliedAt].filter(Boolean).join(' · ') || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: c.fit >= 60 ? '#059669' : '#D97706' }}>{c.fit}</td>
                    <td>
                      {c.pass
                        ? <span className="badge" style={{ background: c.rescued ? '#EDE9FE' : '#DCFCE7', color: c.rescued ? '#6D28D9' : '#15803D' }}>{c.rescued ? 'Rescued' : 'Passed'}</span>
                        : <span className="badge" style={{ background: '#FEF2F2', color: '#DC2626' }}>Rejected</span>}
                      {c.reason && <div style={{ marginTop: 5 }}><span style={{ display: 'inline-flex', alignItems: 'center', background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 600 }}>{c.reason}</span></div>}
                    </td>
                    <td>
                      {stage.key === 'rejected' ? <span style={{ color: '#9CA3AF', fontSize: 12.5 }}>—</span> : (
                        <div>
                          <span className="badge" style={{ background: stage.bg, color: stage.fg }}>{stage.label}{stage.score != null ? ` · ${stage.score}` : ''}</span>
                          {stage.sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{stage.sub}</div>}
                          {stage.key === 'submitted' && inv?.submittedAt && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>submitted {fmtDate(inv.submittedAt)}{inv.outcome?.flags ? ` · ${inv.outcome.flags} integrity flag${inv.outcome.flags === 1 ? '' : 's'}` : ''}</div>}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {stage.key === 'rejected' ? (gate.ok ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11.5, color: '#9CA3AF', whiteSpace: 'nowrap' }}>~{fmtCr(perCandidate)} when they run</span>
                          <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => doRescue(c)}><Send size={13} /> Rescue / send link</button>
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                          <button className="btn-ghost" disabled title={gate.reason} style={{ padding: '6px 12px', fontSize: 12.5, opacity: 0.5, cursor: 'not-allowed' }}><Send size={13} /> Rescue / send link</button>
                          <span style={{ fontSize: 12, color: '#056FD4', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => nav('/billing')}>Top up →</span>
                        </div>
                      )) : report ? (
                        <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => nav(`/opportunities/${id}/candidate/${report.id}`)}><FileText size={13} /> View report</button>
                      ) : stage.key === 'active' && inv ? (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => copyLink(inv)}><Copy size={12} /> Copy link</button>
                          <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => nav('/a/' + inv.token)}><ExternalLink size={12} /> Open</button>
                        </span>
                      ) : stage.key === 'submitted' ? (
                        <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>Not on the rank list</span>
                      ) : inv ? (
                        <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => nav(`/opportunities/${id}/invites`)}>Manage link</button>
                      ) : <span style={{ color: '#E2E8F0' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 10 }}>
        Where the charge happens: the resume gate was billed when the assessment was sent · assessment modules <b>reserve</b> credits when a candidate starts and <b>settle</b> on what actually ran · an abandoned attempt releases the hold · a technical failure is never a candidate failure and its credits are reversible.
      </div>
      {toastNode}
    </>
  );
}
