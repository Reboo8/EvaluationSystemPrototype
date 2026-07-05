/* Lightweight Markdown-ish renderer for job descriptions etc.
   Handles: # / ## / ### headings, plain title-case heading lines, - * • bullets,
   1. / 1) numbered lists, **bold** inline, and paragraphs separated by blank lines. */

function parseInline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) => (/^\*\*[^*]+\*\*$/.test(p) ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
}

// a short, capitalised, punctuation-free line is treated as a section heading
const looksLikeHeading = (t) =>
  t.length <= 44 && /^[A-Z0-9]/.test(t) && !/[.:;,!?]$/.test(t) && t.split(/\s+/).length <= 6 && !/^[-*•]/.test(t) && !/^\d+[.)]/.test(t);

export default function RichText({ text, style, compact }) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { flush(); continue; }
    const bullet = t.match(/^[-*•]\s+(.*)$/);
    const num = t.match(/^\d+[.)]\s+(.*)$/);
    if (bullet) { if (!list || list.type !== 'ul') { flush(); list = { type: 'ul', items: [] }; } list.items.push(bullet[1]); continue; }
    if (num) { if (!list || list.type !== 'ol') { flush(); list = { type: 'ol', items: [] }; } list.items.push(num[1]); continue; }
    flush();
    if (/^#{1,6}\s/.test(t)) { blocks.push({ type: 'h', level: Math.min(3, t.match(/^#+/)[0].length), text: t.replace(/^#+\s/, '') }); continue; }
    if (looksLikeHeading(t)) { blocks.push({ type: 'h', level: 3, text: t }); continue; }
    blocks.push({ type: 'p', text: t });
  }
  flush();

  const liStyle = { fontSize: 13, color: '#374151', lineHeight: 1.6 };
  const listStyle = { margin: '0 0 10px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 };

  return (
    <div style={style}>
      {blocks.map((b, i) => {
        if (b.type === 'h') return <div key={i} style={{ fontSize: b.level <= 2 ? 14.5 : 13.5, fontWeight: 700, color: '#14212A', margin: i === 0 ? '0 0 6px' : '14px 0 6px' }}>{parseInline(b.text)}</div>;
        if (b.type === 'ul') return <ul key={i} style={listStyle}>{b.items.map((it, j) => <li key={j} style={liStyle}>{parseInline(it)}</li>)}</ul>;
        if (b.type === 'ol') return <ol key={i} style={listStyle}>{b.items.map((it, j) => <li key={j} style={liStyle}>{parseInline(it)}</li>)}</ol>;
        return <p key={i} style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, margin: compact ? '0 0 6px' : '0 0 10px' }}>{parseInline(b.text)}</p>;
      })}
    </div>
  );
}
