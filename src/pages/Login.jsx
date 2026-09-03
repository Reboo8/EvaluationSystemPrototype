import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('hr@northstargroup.com');
  const [pw, setPw] = useState('demo');

  return (
    <div style={{ minHeight: '100vh', background: '#056FD4', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -80, left: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ position: 'absolute', bottom: -100, right: -40, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ position: 'relative', width: 400, maxWidth: '92vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>Cuba</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>Client portal · by Reboo8</div>
        </div>
        <div className="card" style={{ padding: '28px 30px' }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 4px' }}>Welcome back</h1>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Sign in to your client portal</div>
          <form onSubmit={(e) => { e.preventDefault(); nav('/'); }}>
            <label className="field-label">Work email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 14 }} />
            <label className="field-label">Password</label>
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ marginBottom: 8 }} />
            <div style={{ textAlign: 'right', marginBottom: 16 }}><span style={{ fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/')}>Forgot password?</span></div>
            <button className="btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }}>Sign in</button>
          </form>
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>
          Cuba operator? <span style={{ fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => nav('/admin')}>Admin sign-in</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
          <b style={{ color: 'rgba(255,255,255,0.8)' }}>Sales-led access.</b> No self-serve signup — organizations are created by Cuba after a commercial agreement; your owner invite activates the workspace.
        </div>
      </div>
    </div>
  );
}
