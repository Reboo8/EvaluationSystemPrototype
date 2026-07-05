import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Globe, Mail, Upload, Send, Check } from 'lucide-react';
import { useApp } from '../store.jsx';

export default function SendAssessment() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getOpportunity, sendAssessment } = useApp();
  const opp = getOpportunity(id);

  const [careerPage, setCareerPage] = useState(true);
  const [emails, setEmails] = useState('');
  const [uploaded, setUploaded] = useState(0);
  const [done, setDone] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  if (!opp) return <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Opportunity not found.</div>;

  const emailCount = emails.split(/[\n,]/).map((e) => e.trim()).filter((e) => e.includes('@')).length;
  const total = emailCount + uploaded;

  const send = () => {
    // career-page-only send still seeds a demo batch of inbound applicants so the funnel moves
    const added = total || (careerPage ? 12 : 0);
    sendAssessment(id, added);
    setSentCount(added);
    setDone(true);
  };

  if (done) return (
    <div style={{ maxWidth: 560, margin: '40px auto' }}>
      <div className="card" style={{ padding: 36, textAlign: 'center' }}>
        <div className="avatar" style={{ width: 60, height: 60, background: '#DCFCE7', color: '#16A34A', margin: '0 auto 14px' }}><Check size={30} /></div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Assessment sent 🎉</h2>
        <p style={{ fontSize: 13.5, color: '#6B7280', margin: '0 0 18px' }}>
          {careerPage && 'Listed on your careers page. '}
          {sentCount > 0 ? `${sentCount} candidate${sentCount > 1 ? 's' : ''} entered the resume gate — those who clear get the assessment link automatically.` : 'Candidates who apply will pass through the resume gate.'}
        </p>
        <button className="btn-primary" onClick={() => nav('/opportunities/' + id)}>Back to opportunity</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/opportunities/' + id)}>{opp.title}</span> › Send Assessment
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Send Assessment</div>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Everyone here passes through the <b>resume gate</b> first — only those who clear are auto-sent the assessment link.</div>

      {/* career page */}
      <div className="card" style={{ padding: '18px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="icon-box"><Globe size={20} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Public careers page (pull)</div>
          <div style={{ fontSize: 12.5, color: '#6B7280' }}>List the role so candidates can apply themselves.</div>
        </div>
        <div onClick={() => setCareerPage((v) => !v)} style={{ width: 44, height: 26, borderRadius: 9999, background: careerPage ? '#16A34A' : '#CBD5E1', position: 'relative', cursor: 'pointer', transition: 'background .15s' }}>
          <span style={{ position: 'absolute', top: 3, left: careerPage ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
        </div>
      </div>

      {/* invite emails */}
      <div className="card" style={{ padding: '18px 20px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div className="icon-box"><Mail size={20} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>Invite by email (push)</div><div style={{ fontSize: 12.5, color: '#6B7280' }}>Paste candidate emails — one per line or comma-separated.</div></div>
          {emailCount > 0 && <span className="chip" style={{ background: '#EFF6FF', color: '#056FD4' }}>{emailCount} email{emailCount > 1 ? 's' : ''}</span>}
        </div>
        <textarea className="input" style={{ minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="priya@example.com, arjun@example.com&#10;sneha@example.com" />
      </div>

      {/* upload */}
      <div className="card" style={{ padding: '18px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="icon-box"><Upload size={20} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Upload sourced resumes</div>
          <div style={{ fontSize: 12.5, color: '#6B7280' }}>{uploaded > 0 ? `${uploaded} resumes added (demo)` : 'PDF / DOCX — the analyser scans them against this role.'}</div>
        </div>
        <button className="btn-ghost" onClick={() => setUploaded((u) => u + 40)}>+ Add 40 (demo)</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>{total > 0 ? `${total} candidates will hit the resume gate` : 'Career-page applicants will be screened on apply'}</span>
        <button className="btn-primary" onClick={send}><Send size={15} /> Send Assessment</button>
      </div>
    </div>
  );
}
