import { useParams, useNavigate } from 'react-router-dom';
import { Globe, Copy, ExternalLink, RefreshCw, FileText, Send } from 'lucide-react';
import { useApp, fmtDate, fmtDateTime, inviteUrl, careersUrl, INVITE_STATUS, INVITE_SOURCE, inviteStatusOf } from '../store.jsx';
import { useToast } from '../components/admin/ui.jsx';
import OppTabs from '../components/OppTabs.jsx';

/* Every assessment link for this opportunity — who has it, whether they opened it, where they are, when it expires. */
export default function OpportunityInvites() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getOpportunity, invitesFor, renewInvite, getCandidates } = useApp();
  const [show, toastNode] = useToast();
  const opp = getOpportunity(id);
  if (!opp) return <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Opportunity not found.</div>;

  const list = invitesFor(id);
  const cands = getCandidates(id);
  const counts = list.reduce((a, i) => { const s = inviteStatusOf(i); a[s] = (a[s] || 0) + 1; return a; }, {});
  const copy = (text, what = 'Link') => { try { navigator.clipboard.writeText(text); show(`${what} copied`); } catch { show('Copy failed'); } };
  const progress = (inv) => {
    const s = inviteStatusOf(inv);
    if (s === 'SUBMITTED') return inv.outcome ? (inv.outcome.cleared ? `Cleared · ${inv.outcome.weighted}` : `Not cleared · ${inv.outcome.weighted}`) : 'Submitted';
    if (s === 'IN_PROGRESS') return inv.attempt?.stage ? `On ${inv.attempt.stage}` : 'Started';
    if (s === 'OPENED') return `Opened ${fmtDateTime(inv.openedAt)}`;
    if (s === 'EXPIRED') return `Expired ${fmtDate(inv.expiresAt)}`;
    return '—';
  };
  const reportFor = (inv) => cands.find((c) => c.inviteToken === inv.token);

  return (
    <>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/opportunities')}>Opportunities</span> › {opp.title}
      </div>
      <OppTabs id={id} active="invites" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Assessment links <span style={{ color: '#9CA3AF', fontWeight: 600 }}>— {list.length} issued</span></div>
          <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>One personal, time-bound, resumable link per candidate who cleared the resume gate.</div>
        </div>
        <button className="btn-primary" onClick={() => nav(`/opportunities/${id}/send`)}><Send size={15} /> Send Assessment</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.entries(INVITE_STATUS).filter(([k]) => counts[k]).map(([k, s]) => <span key={k} className="chip" style={{ background: s.bg, color: s.fg }}>{s.label} · {counts[k]}</span>)}
        {list.length === 0 && <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>No links yet.</span>}
      </div>

      <div className="card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div className="icon-box" style={{ width: 36, height: 36, borderRadius: 8 }}><Globe size={17} /></div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Public careers page {opp.careersPublished ? <span className="badge" style={{ background: '#DCFCE7', color: '#15803D', marginLeft: 6 }}>Listed</span> : <span className="badge" style={{ background: '#F3F4F6', color: '#6B7280', marginLeft: 6 }}>Not listed</span>}</div>
          <div className="mono" style={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-all' }}>{careersUrl(id)}</div>
        </div>
        <button className="btn-ghost" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => copy(careersUrl(id), 'Careers page link')}><Copy size={14} /> Copy</button>
        <button className="btn-ghost" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => nav(`/careers/${id}?preview=1`)}><ExternalLink size={14} /> Preview</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {list.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No assessment links issued yet. Use <b>Send Assessment</b>, or share the careers page.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Candidate</th><th>Source</th><th>Sent</th><th>Valid until</th><th>Status</th><th>Progress</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {list.map((inv) => {
                  const s = inviteStatusOf(inv); const st = INVITE_STATUS[s] || INVITE_STATUS.SENT; const rep = reportFor(inv);
                  return (
                    <tr key={inv.token}>
                      <td><div style={{ fontWeight: 600 }}>{inv.name || '—'}</div><div style={{ fontSize: 12, color: '#6B7280' }}>{inv.email}</div></td>
                      <td style={{ fontSize: 12.5, color: '#6B7280', whiteSpace: 'nowrap' }}>{INVITE_SOURCE[inv.source] || inv.source}{inv.attemptNo > 1 ? ` · attempt ${inv.attemptNo}` : ''}</td>
                      <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{fmtDate(inv.createdAt)}</td>
                      <td style={{ fontSize: 12.5, whiteSpace: 'nowrap', color: s === 'EXPIRED' ? '#B91C1C' : '#14212A' }}>{fmtDate(inv.expiresAt)}</td>
                      <td><span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span></td>
                      <td style={{ fontSize: 12.5, color: '#475569' }}>{progress(inv)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {rep && <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, marginRight: 6 }} onClick={() => nav(`/opportunities/${id}/candidate/${rep.id}`)}><FileText size={13} /> Report</button>}
                        {(s === 'EXPIRED' || s === 'RENEWED') && s !== 'RENEWED' && <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, marginRight: 6 }} onClick={() => { renewInvite(inv.token); show(`New link sent to ${inv.email}`); }}><RefreshCw size={13} /> New link</button>}
                        {['SENT', 'OPENED', 'IN_PROGRESS'].includes(s) && (<>
                          <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, marginRight: 6 }} onClick={() => copy(inviteUrl(inv.token))}><Copy size={13} /> Copy</button>
                          <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => nav('/a/' + inv.token)}><ExternalLink size={13} /> Open</button>
                        </>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 10 }}>Links go out by email. An expired link is never a rejection — the candidate can request a new one from the link itself, or you can issue one here.</div>
      {toastNode}
    </>
  );
}
