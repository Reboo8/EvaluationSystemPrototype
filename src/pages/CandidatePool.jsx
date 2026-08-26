import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertTriangle, Wallet } from 'lucide-react';
import { useApp, fmtCr } from '../store.jsx';
import { useToast, PendingChip } from '../components/admin/ui.jsx';
import OppTabs from '../components/OppTabs.jsx';

const PALETTE = [['#DBEAFE', '#1E40AF'], ['#DCFCE7', '#15803D'], ['#EDE9FE', '#6D28D9'], ['#FFEDD5', '#C2410C'], ['#FCE7F3', '#BE185D']];
const ini = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function CandidatePool() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getOpportunity, getPool, rescue, rateOf, clientCanStart, clientWallet } = useApp();
  const [show, toastNode] = useToast();
  const opp = getOpportunity(id);
  const pool = getPool(id);

  if (!opp) return <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Opportunity not found.</div>;

  /* A rescue pushes a soft-rejected candidate into the PAID part of the funnel.
     Cost per candidate = every non-resume module on this opportunity + proctoring
     (the resume gate itself was already billed when the assessment was sent). */
  const paidModules = (opp.assessment?.modules || []).filter((m) => m.key !== 'resume');
  const perCandidate = paidModules.reduce((a, m) => a + rateOf(m.key), 0) + rateOf('proctoring');
  const gate = clientCanStart(perCandidate);

  const rejected = pool.filter((c) => !c.pass);
  const rescued = pool.filter((c) => c.rescued);

  const doRescue = (c) => {
    rescue(id, c.id);
    show(`${c.name} rescued — assessment link sent. No credits charged yet; ~${fmtCr(perCandidate)} is reserved when they start.`);
  };

  return (
    <>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/opportunities')}>Opportunities</span> › {opp.title}
      </div>
      <OppTabs id={id} active="pool" />

      <div style={{ fontSize: 17, fontWeight: 700 }}>
        Candidate Pool <span style={{ color: '#9CA3AF', fontWeight: 600 }}>— {pool.length} scanned · {rejected.length} soft-rejected{rescued.length > 0 ? ` · ${rescued.length} rescued` : ''}</span>
      </div>
      <div style={{ fontSize: 12.5, color: '#6B7280', margin: '2px 0 16px' }}>Resume-gate results. Rejected candidates stay here with the reason — rescue anyone the analyser knocked out by mistake.</div>

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
        {pool.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No candidates have entered the resume gate yet. Use “Send Assessment” to add some.</div>
        ) : (
          <table>
            <thead><tr><th>Candidate</th><th>Fit</th><th>Status</th><th>Why the analyser rejected them</th><th style={{ textAlign: 'right' }}>Rescue</th></tr></thead>
            <tbody>
              {pool.map((c, i) => {
                const [bg, fg] = PALETTE[i % PALETTE.length];
                return (
                  <tr key={c.id}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="avatar" style={{ width: 32, height: 32, background: bg, color: fg, fontSize: 11 }}>{ini(c.name)}</div><span style={{ fontWeight: 600 }}>{c.name}</span></div></td>
                    <td style={{ fontWeight: 700, color: c.fit >= 60 ? '#059669' : '#D97706' }}>{c.fit}</td>
                    <td>{c.pass
                      ? <span className="badge" style={{ background: '#DCFCE7', color: '#15803D' }}>{c.rescued ? 'Rescued → assessment' : 'Passed → assessment'}</span>
                      : <span className="badge" style={{ background: '#FEF2F2', color: '#DC2626' }}>Rejected</span>}</td>
                    <td>
                      {c.reason
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', borderRadius: 6, padding: '4px 9px', fontSize: 12, fontWeight: 600 }}>{c.reason}</span>
                        : <span style={{ color: '#9CA3AF', fontSize: 12.5 }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!c.pass ? (gate.ok ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11.5, color: '#9CA3AF', whiteSpace: 'nowrap' }}>~{fmtCr(perCandidate)} when they run</span>
                          <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => doRescue(c)}><Send size={13} /> Rescue / send link</button>
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                          <button className="btn-ghost" disabled title={gate.reason} style={{ padding: '6px 12px', fontSize: 12.5, opacity: 0.5, cursor: 'not-allowed' }}><Send size={13} /> Rescue / send link</button>
                          <span style={{ fontSize: 12, color: '#056FD4', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => nav('/billing')}>Top up →</span>
                        </div>
                      )) : c.rescued
                        ? <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>Link sent · charged when they start</span>
                        : <span style={{ color: '#E2E8F0' }}>—</span>}
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
