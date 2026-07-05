import { useState } from 'react';
import { Plus, Check, X, UploadCloud } from 'lucide-react';
import { useApp } from '../store.jsx';

const TEMPLATES = [
  ['Software Developer', 'Resume · Coding · Written · AI Interview · Typing'],
  ['Customer Support', 'Resume · Language · Typing · SJT · Simulation · AI Interview'],
  ['Doctor', 'Credential · Medical Knowledge (MCQ) · Clinical Judgement · AI Interview'],
];

function Toggle({ on, onClick }) {
  return <span onClick={onClick} style={{ display: 'inline-block', width: 34, height: 20, borderRadius: 9999, background: on ? '#16A34A' : '#CBD5E1', position: 'relative', cursor: 'pointer', transition: 'background .15s' }}><span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} /></span>;
}

export default function AdminCatalog() {
  const { catalog, toggleCatalogModule, addCatalogModule, publishCatalog, catalogPublishedAt } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState(null);
  const show = (m) => { setToast(m); setTimeout(() => setToast(null), 2000); };
  const enabled = catalog.filter((m) => m.enabled).length;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Module Catalog</div>
          <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>The global library available to every client’s Assessment Builder. {enabled} of {catalog.length} modules enabled.</div>
        </div>
        <button className="btn-primary" onClick={() => { publishCatalog(); show('Published to all clients'); }}><UploadCloud size={15} /> Publish to all</button>
      </div>
      {catalogPublishedAt && <div style={{ fontSize: 12, color: '#16A34A', marginBottom: 12 }}>✓ Catalog published to all clients ({catalogPublishedAt}).</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: 15, fontWeight: 700 }}>Test Modules</div><button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => setShowAdd(true)}><Plus size={14} /> Add module</button></div>
          <table>
            <thead><tr><th>Module</th><th>Scoring</th><th style={{ textAlign: 'right' }}>Enabled</th></tr></thead>
            <tbody>{catalog.map((m) => (
              <tr className="row" key={m.key}><td style={{ fontWeight: 600 }}>{m.name}{m.key.startsWith('cat_') && <span className="badge" style={{ background: '#EDE9FE', color: '#6D28D9', marginLeft: 6 }}>new</span>}</td><td style={{ color: '#6B7280' }}>{m.scoring}</td><td style={{ textAlign: 'right' }}><Toggle on={m.enabled} onClick={() => toggleCatalogModule(m.key)} /></td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Starter Templates</div>
          {TEMPLATES.map(([n, d]) => (
            <div key={n} onClick={() => show(`“${n}” template loaded into Assessment Builder`)} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px', marginBottom: 10, cursor: 'pointer', transition: 'border-color .15s, background .15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#056FD4'; e.currentTarget.style.background = '#F8FBFF'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#fff'; }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{n}</div><div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 3 }}>{d}</div>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>Click a template to pre-load these modules into a client’s Assessment Builder.</div>
        </div>
      </div>

      {showAdd && <AddModuleModal onClose={() => setShowAdd(false)} onCreate={(name, scoring) => { addCatalogModule(name, scoring); setShowAdd(false); show('Module added to catalog'); }} />}
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 80, display: 'flex', alignItems: 'center', gap: 9, background: '#14212A', color: '#fff', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}><Check size={15} color="#34D399" /> {toast}</div>}
    </>
  );
}

function AddModuleModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [scoring, setScoring] = useState('AI rubric');
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 460, maxWidth: '94vw', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16.5, fontWeight: 700, margin: 0 }}>Add catalog module</h2>
          <X size={18} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>
        <label className="field-label">Module name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Roleplay (video)" style={{ marginBottom: 14 }} />
        <label className="field-label">Scoring method</label>
        <select className="input" value={scoring} onChange={(e) => setScoring(e.target.value)} style={{ marginBottom: 18 }}>
          <option>AI rubric</option><option>auto</option><option>test cases</option><option>manual</option><option>model</option>
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => onCreate(name.trim(), scoring)}>Add to catalog</button>
        </div>
      </div>
    </div>
  );
}
