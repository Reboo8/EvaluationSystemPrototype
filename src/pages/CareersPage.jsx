import { useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Briefcase, Clock, Upload, Check, ArrowRight, Loader2, FileText, Eye, CalendarClock, Building2, X, Sparkles } from 'lucide-react';
import { useApp, initials, fmtDate } from '../store.jsx';
import RichText from '../components/RichText.jsx';

/* ══════════════════════════════════════════════════════════════════════════════════════════
   Public careers page (v2 design) — the "pull" entry. Apply with a resume → instant screen →
   cleared: a personal assessment link is issued · not cleared: an honest, soft exit.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
const STEPS = ['Reading your resume', 'Matching your skills to the role', 'Checking experience and education', 'Preparing your result'];
const firstName = (n = '') => (String(n).trim().split(' ')[0] || 'there');
const niceDate = (d) => { try { const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; } };
const softReason = (reason = '') => { const must = /Missing must-have:\s*(.+)/i.exec(reason); if (must) return `This role needs hands-on experience with ${must[1]}, and we couldn't find it in your resume.`; if (/below minimum/i.test(reason)) return 'One of the role\'s requirements isn\'t met closely enough by your resume right now.'; return 'Your background doesn\'t closely match what this role needs right now.'; };

export default function CareersPage() {
  const { oppId } = useParams(); const nav = useNavigate(); const [sp] = useSearchParams();
  const preview = sp.get('preview') === '1';
  const { getOpportunity, getClient, applyToOpportunity } = useApp();
  const opp = getOpportunity(oppId); const employer = getClient(opp?.clientId || 'cl1');
  const [form, setForm] = useState({ name: '', email: '', phone: '', resumeName: '', resumeText: '' });
  const [phase, setPhase] = useState('view'); const [stepI, setStepI] = useState(0); const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const who = employer?.name || 'this employer';
  if (!opp) return <Shell employer={employer}><div className="cj-card" style={{ maxWidth: 520, margin: '60px auto', padding: 32, textAlign: 'center' }}><h1 className="cj-h1" style={{ fontSize: 24 }}>This role isn't available</h1><p className="cj-lead" style={{ marginTop: 8 }}>The link may be old, or the role has been filled.</p></div></Shell>;
  const open = opp.status === 'OPEN';
  const valid = form.name.trim().length > 1 && /\S+@\S+\.\S+/.test(form.email) && !!form.resumeName;
  const modules = (opp.assessment?.modules || []).filter((m) => m.key !== 'resume');
  const onFile = (f) => { if (!f) return; const isText = /\.(txt|md)$/i.test(f.name) || (f.type || '').startsWith('text/'); if (isText) { const rd = new FileReader(); rd.onload = () => setForm((x) => ({ ...x, resumeName: f.name, resumeText: String(rd.result || '') })); rd.readAsText(f); } else setForm((x) => ({ ...x, resumeName: f.name, resumeText: '' })); };
  const submit = (e) => { e.preventDefault(); if (!valid || !open) return; setPhase('screening'); setStepI(0); STEPS.forEach((_, i) => setTimeout(() => setStepI(i + 1), 650 * (i + 1))); setTimeout(() => { setResult(applyToOpportunity(oppId, { ...form, preview })); setPhase('done'); }, 650 * STEPS.length + 350); };

  return (
    <Shell employer={employer} banner={preview ? <PreviewBanner onExit={() => nav('/opportunities/' + oppId)} /> : null}>
      {/* hero */}
      <div style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FB 100%)', borderBottom: '1px solid #E6EAF0' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px 32px' }} className="cj-enter">
          <div className="cj-eyebrow">{who} · We're hiring</div>
          <h1 className="cj-h1" style={{ fontSize: 40, marginTop: 10 }}>{opp.title}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {opp.location && <span className="cj-pill" style={{ background: '#fff', border: '1px solid #E6EAF0', color: '#374151' }}><MapPin size={13} /> {opp.location}{opp.workMode ? ` · ${opp.workMode}` : ''}</span>}
            {opp.roleType && <span className="cj-pill" style={{ background: '#fff', border: '1px solid #E6EAF0', color: '#374151' }}><Briefcase size={13} /> {opp.roleType}</span>}
            {opp.department && <span className="cj-pill" style={{ background: '#fff', border: '1px solid #E6EAF0', color: '#374151' }}><Building2 size={13} /> {opp.department}</span>}
            {opp.closingDate && <span className="cj-pill" style={{ background: '#fff', border: '1px solid #E6EAF0', color: '#374151' }}><Clock size={13} /> Apply by {niceDate(opp.closingDate)}</span>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px 60px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: 24, alignItems: 'start' }} className="cand-grid">
        <div style={{ display: 'grid', gap: 16 }} className="cj-enter-2">
          <section className="cj-card" style={{ padding: '24px 26px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#14212A', marginBottom: 10 }}>About the role</h2>
            <RichText text={opp.jobDescription || 'No description provided.'} />
            {(opp.skills || []).length > 0 && <><h3 style={{ fontSize: 14, fontWeight: 600, color: '#14212A', margin: '18px 0 8px' }}>Skills we're looking for</h3><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{opp.skills.map((s) => <span key={s} className="cj-pill cj-pill--sky">{s}</span>)}</div></>}
            {(opp.languages || []).length > 0 && <><h3 style={{ fontSize: 14, fontWeight: 600, color: '#14212A', margin: '18px 0 8px' }}>Languages</h3><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{opp.languages.map((l) => <span key={l} className="cj-pill" style={{ background: '#F3F4F6', color: '#374151' }}>{l}</span>)}</div></>}
          </section>
          <section className="cj-card" style={{ padding: '24px 26px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#14212A', marginBottom: 6 }}>How we hire</h2>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 14 }}>Four steps, all online, at your own pace.</p>
            <ol style={{ display: 'grid', gap: 12 }}>
              {[['Apply', 'Your name, email and resume. Two minutes.'], ['Instant screen', 'We match your resume to the role and tell you straight away.'], ['Assessment', modules.length ? `${modules.length} short module${modules.length === 1 ? '' : 's'}${modules.some((m) => m.key === 'interview') ? ', including a spoken AI interview' : ''} — about ${modules.reduce((a, m) => a + (m.key === 'interview' ? Math.max(5, Math.round((m.nQ || 8) * 1.8)) : ({ written: 15, mcq: 15, coding: 30, sjt: 15, language: 20, personality: 10, typing: 5, computer: 10, simulation: 10 }[m.key] || 10)), 0)} minutes.` : 'A short online assessment.'], ['Hear back', `${who} reviews every completed assessment and replies either way.`]].map(([t, d], i) => (
                <li key={t} style={{ display: 'flex', gap: 14 }}><span className="cj-timer" style={{ width: 28, height: 28, borderRadius: 9, background: '#14212A', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span><div><div style={{ fontSize: 14.5, fontWeight: 600, color: '#14212A' }}>{t}</div><div style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.55 }}>{d}</div></div></li>
              ))}
            </ol>
          </section>
          <section className="cj-card" style={{ padding: '20px 24px', display: 'flex', gap: 14, alignItems: 'flex-start' }}><Sparkles size={20} color="#056FD4" style={{ flexShrink: 0, marginTop: 2 }} /><p style={{ fontSize: 13.5, color: '#4B5563', lineHeight: 1.6 }}>About {who}: {employer?.industry ? `we work in ${employer.industry.toLowerCase()}` : 'a growing team'}{employer?.website ? `, based in India (${employer.website})` : ''}. Every application is screened against the role's stated requirements only — never against who already works here.</p></section>
        </div>

        <aside className="cj-card cj-enter-3" style={{ padding: '24px 26px', position: 'sticky', top: 20 }}>
          {!open ? (<><h2 style={{ fontSize: 18, fontWeight: 600, color: '#14212A' }}>Not taking applications right now</h2><p className="cj-lead" style={{ fontSize: 14, marginTop: 8 }}>This role is {opp.status === 'CLOSED' ? 'closed' : 'paused'}. Check back soon or explore other roles at {who}.</p></>)
          : phase === 'view' ? (
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              <div><h2 style={{ fontSize: 20, fontWeight: 600, color: '#14212A', letterSpacing: '-.01em' }}>Apply in two minutes</h2><p style={{ fontSize: 13.5, color: '#6B7280', marginTop: 4 }}>You'll see your resume result immediately.</p></div>
              <label><span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Full name</span><input className="cj-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="As on your ID" /></label>
              <label><span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email</span><input className="cj-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
              <label><span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Phone <span style={{ color: '#9CA3AF', fontWeight: 400 }}>· optional</span></span><input className="cj-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91" /></label>
              <div><span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Resume</span>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
                {form.resumeName ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #A7F3D0', background: '#ECFDF5', borderRadius: 12, padding: '11px 14px' }}><FileText size={16} color="#047857" /><span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#047857', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.resumeName}</span><button type="button" onClick={() => setForm({ ...form, resumeName: '', resumeText: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><X size={15} /></button></div>
                  : <div onClick={() => fileRef.current?.click()} style={{ border: '1.5px dashed #CBD5E1', borderRadius: 12, padding: '22px 14px', textAlign: 'center', cursor: 'pointer', background: '#FAFBFC' }}><Upload size={18} color="#056FD4" style={{ margin: '0 auto 6px' }} /><div style={{ fontSize: 13.5, fontWeight: 600, color: '#14212A' }}>Upload your resume</div><div style={{ fontSize: 12, color: '#9CA3AF' }}>PDF, DOC, DOCX or TXT · up to 5 MB</div></div>}
              </div>
              <button type="submit" className="cj-btn cj-btn--primary cj-btn--lg cj-btn--block" disabled={!valid}>Apply now <ArrowRight size={16} /></button>
              <p style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6, textAlign: 'center' }}>By applying you agree to {who}'s candidate privacy notice. Your resume is used only to assess you for this role.</p>
            </form>
          ) : phase === 'screening' ? (
            <div><div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Loader2 size={26} color="#056FD4" className="cand-spin" /></div><h2 style={{ fontSize: 18, fontWeight: 600, color: '#14212A', textAlign: 'center' }}>Reviewing your application</h2><p style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 4 }}>A few seconds.</p>
              <ul style={{ marginTop: 16, display: 'grid', gap: 8 }}>{STEPS.map((s, i) => <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: i < stepI ? '#047857' : i === stepI ? '#14212A' : '#9CA3AF' }}>{i < stepI ? <Check size={16} color="#10B981" /> : i === stepI ? <Loader2 size={16} className="cand-spin" color="#056FD4" /> : <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid #E6EAF0', display: 'inline-block' }} />}{s}</li>)}</ul></div>
          ) : result?.screen?.pass ? (
            <div style={{ textAlign: 'center' }} className="cj-enter">
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><Check size={26} /></div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: '#14212A' }}>You're through, {firstName(form.name)}.</h2>
              <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6, marginTop: 8 }}>Your resume matches this role. We've emailed your personal assessment link to <b style={{ color: '#14212A' }}>{form.email}</b>.</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', fontSize: 12.5, color: '#0459A8', background: '#EAF3FE', borderRadius: 10, padding: '9px 12px', marginTop: 14 }}><CalendarClock size={14} /> Valid until <b>{fmtDate(result.invite?.expiresAt)}</b> · save and resume any time</div>
              <button className="cj-btn cj-btn--primary cj-btn--lg cj-btn--block" style={{ marginTop: 14 }} onClick={() => nav('/a/' + result.invite.token)}>Start the assessment now <ArrowRight size={16} /></button>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 10 }}>Or open it later from the email.</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }} className="cj-enter">
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F3F4F6', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><FileText size={24} /></div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: '#14212A' }}>Thanks for applying, {firstName(form.name)}.</h2>
              <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6, marginTop: 8 }}>We won't be moving to an assessment right now. {softReason(result?.screen?.reason)}</p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginTop: 10 }}>Your application stays with {who}'s recruiting team, who may still get in touch.</p>
            </div>
          )}
        </aside>
      </div>
    </Shell>
  );
}

const PreviewBanner = ({ onExit }) => (
  <div style={{ background: '#14212A', color: '#fff', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 24px', fontSize: 12.5 }}><Eye size={15} /><span style={{ flex: 1 }}><b>Preview</b> — this is your public careers page as applicants see it. Applications made here are not recorded or charged.</span><button onClick={onExit} className="cj-btn cj-btn--sm" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>Exit preview</button></div>
);
function Shell({ employer, banner, children }) {
  const name = employer?.name || 'Employer';
  return (
    <div className="cand cj" style={{ display: 'block', minHeight: '100vh', background: '#F6F8FB' }}>
      {banner}
      <header style={{ height: 60, background: '#fff', borderBottom: '1px solid #E6EAF0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="cj-mono">{initials(name)}</div><div><div style={{ fontSize: 14, fontWeight: 600, color: '#14212A' }}>{name}</div><div style={{ fontSize: 12, color: '#6B7280' }}>Careers</div></div></div>
        <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>Hiring powered by <b style={{ color: '#6B7280' }}>Cuba</b></span>
      </header>
      {children}
    </div>
  );
}
