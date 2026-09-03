import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Globe, Mail, Upload, Send, Check, AlertTriangle, Copy, ExternalLink, Users } from 'lucide-react';
import { useApp, fmtCr, fmtDate, inviteUrl, careersUrl, INVITE_SOURCE } from '../store.jsx';
import { PendingChip, useToast } from '../components/admin/ui.jsx';

/* Send Assessment = distribution. Every applicant hits the resume gate now; those who clear get a
   time-bound, resumable link (by email in production — here you can also open or copy it). */
export default function SendAssessment() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getOpportunity, sendAssessment, clientCanStart, clientEstimate, clientWallet, rateCard } = useApp();
  const [show, toastNode] = useToast();
  const opp = getOpportunity(id);

  const [careerPage, setCareerPage] = useState(true);
  const [emails, setEmails] = useState('');
  const [uploaded, setUploaded] = useState(0);
  const [done, setDone] = useState(null);   // { invites, rows, passed, rejected, careerPage }

  if (!opp) return <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Opportunity not found.</div>;

  const emailList = Array.from(new Set(emails.split(/[\n,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => /\S+@\S+\.\S+/.test(e))));
  const total = emailList.length + uploaded;
  const resumeRate = (rateCard || []).find((r) => r.key === 'resume')?.credits || 0;
  const cost = (total || 12) * resumeRate;
  const gate = clientCanStart(cost);
  const est = clientEstimate(opp);
  const underfunded = gate.ok && clientWallet.available < est.total;
  const copy = (text, what = 'Link') => { try { navigator.clipboard.writeText(text); show(`${what} copied`); } catch { show('Copy failed — select and copy manually'); } };

  const send = () => {
    /* a careers-page-only send still seeds a small batch of inbound applicants so the funnel moves */
    const sourced = uploaded + (total === 0 && careerPage ? 12 : 0);
    const res = sendAssessment(id, { emails: emailList, sourced, careerPage });
    setDone({ ...res, careerPage });
  };

  if (done) {
    const n = done.rows.length;
    return (
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div className="card" style={{ padding: '28px 30px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="avatar" style={{ width: 52, height: 52, background: '#DCFCE7', color: '#16A34A' }}><Check size={26} /></div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Assessment sent</h2>
              <div style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.6 }}>
                {n > 0 ? <>{n} candidate{n > 1 ? 's' : ''} went through the resume gate — <b style={{ color: '#15803D' }}>{done.passed} cleared</b> and received a link, <b style={{ color: '#B45309' }}>{done.rejected}</b> went to the <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav(`/opportunities/${id}/pool`)}>Candidate Pool</span> with a reason.</> : 'Candidates who apply on your careers page are screened on apply and receive their link automatically.'}
                {done.careerPage && ' The role is listed on your careers page.'}
              </div>
              {n > 0 && resumeRate > 0 && <div style={{ fontSize: 12, color: '#6B7280', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 12px', marginTop: 12, display: 'inline-block' }}>Ledger: <b style={{ color: '#B91C1C' }}>−{fmtCr(n * resumeRate)}</b> · Resume Analyser · {n} candidate{n > 1 ? 's' : ''}</div>}
            </div>
          </div>
        </div>

        {done.careerPage && (
          <div className="card" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div className="icon-box"><Globe size={20} /></div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Public careers page</div>
              <div className="mono" style={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-all' }}>{careersUrl(id)}</div>
            </div>
            <button className="btn-ghost" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => copy(careersUrl(id), 'Careers page link')}><Copy size={14} /> Copy</button>
            <button className="btn-ghost" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => nav(`/careers/${id}`)}><ExternalLink size={14} /> Open</button>
          </div>
        )}

        {done.invites.length > 0 && (
          <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Links issued <span style={{ color: '#9CA3AF', fontWeight: 600 }}>· {done.invites.length}</span></div>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Each link is personal, valid until the date shown, and resumable.</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Candidate</th><th>Source</th><th>Valid until</th><th style={{ textAlign: 'right' }}>Link</th></tr></thead>
                <tbody>
                  {done.invites.map((inv) => (
                    <tr key={inv.token}>
                      <td><div style={{ fontWeight: 600 }}>{inv.name}</div><div style={{ fontSize: 12, color: '#6B7280' }}>{inv.email}</div></td>
                      <td style={{ fontSize: 12.5, color: '#6B7280' }}>{INVITE_SOURCE[inv.source] || inv.source}</td>
                      <td style={{ fontSize: 12.5 }}>{fmtDate(inv.expiresAt)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => copy(inviteUrl(inv.token))}><Copy size={13} /> Copy</button>{' '}
                        <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => nav('/a/' + inv.token)}><ExternalLink size={13} /> Open</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={() => nav('/opportunities/' + id)}>Back to opportunity</button>
          <button className="btn-primary" onClick={() => nav(`/opportunities/${id}/invites`)}><Users size={15} /> Track all invites</button>
        </div>
        {toastNode}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/opportunities/' + id)}>{opp.title}</span> › Send Assessment
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Send Assessment</div>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Everyone passes through the <b>resume gate</b> first. Those who clear get a personal, time-bound assessment link; the rest land in the Candidate Pool with a reason.</div>

      {!gate.ok && (
        <div className="banner danger"><AlertTriangle size={17} />
          <div style={{ flex: 1 }}><b>Sending is paused.</b> {gate.reason} <span style={{ color: '#056FD4', fontWeight: 700, cursor: 'pointer' }} onClick={() => nav('/billing')}>Top up →</span></div>
        </div>
      )}
      {gate.ok && underfunded && (
        <div className="banner warn"><AlertTriangle size={17} />
          <div style={{ flex: 1 }}>Underfunded vs guidance ({fmtCr(est.total)} recommended, {fmtCr(clientWallet.available)} available) — you can send; evaluations pause automatically if credits run out.</div>
        </div>
      )}

      <div className="card" style={{ padding: '18px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="icon-box"><Globe size={20} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Public careers page (pull)</div>
          <div style={{ fontSize: 12.5, color: '#6B7280' }}>List the role so candidates can apply themselves — screened on apply, link sent automatically.</div>
        </div>
        <div onClick={() => setCareerPage((v) => !v)} style={{ width: 44, height: 26, borderRadius: 9999, background: careerPage ? '#16A34A' : '#CBD5E1', position: 'relative', cursor: 'pointer', transition: 'background .15s' }}>
          <span style={{ position: 'absolute', top: 3, left: careerPage ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
        </div>
      </div>

      <div className="card" style={{ padding: '18px 20px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div className="icon-box"><Mail size={20} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>Invite by email (push)</div><div style={{ fontSize: 12.5, color: '#6B7280' }}>Paste candidate emails — one per line or comma-separated.</div></div>
          {emailList.length > 0 && <span className="chip" style={{ background: '#EFF6FF', color: '#056FD4' }}>{emailList.length} email{emailList.length > 1 ? 's' : ''}</span>}
        </div>
        <textarea className="input" style={{ minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="priya.sharma@example.com, arjun.mehta@example.com&#10;sneha.reddy@example.com" />
      </div>

      <div className="card" style={{ padding: '18px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="icon-box"><Upload size={20} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Upload sourced resumes</div>
          <div style={{ fontSize: 12.5, color: '#6B7280' }}>{uploaded > 0 ? `${uploaded} resumes added` : 'PDF / DOCX — the analyser screens them against this role.'}</div>
        </div>
        <button className="btn-ghost" onClick={() => setUploaded((u) => u + 40)}>+ Add 40</button>
      </div>

      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
        This send will consume ~{fmtCr(cost)} (resume gate)<PendingChip /> — charged only as candidates are screened.
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>{total > 0 ? `${total} candidates will hit the resume gate now` : careerPage ? 'Career-page applicants are screened when they apply' : 'Add emails or resumes, or turn on the careers page'}</span>
        {gate.ok
          ? <button className="btn-primary" disabled={total === 0 && !careerPage} onClick={send}><Send size={15} /> Send Assessment</button>
          : <button className="btn-primary" disabled title={gate.reason} style={{ opacity: 0.5, cursor: 'not-allowed' }}>Sending paused — top up to continue</button>}
      </div>
      {toastNode}
    </div>
  );
}
