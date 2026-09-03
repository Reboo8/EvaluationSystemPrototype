/* Minimal Chrome DevTools Protocol driver (no deps): launch headless Chrome, run steps, take screenshots. */
import { spawn } from 'child_process';
import fs from 'fs';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const OUT = process.env.OUT || '.';
const BASE0 = process.env.BASE || 'http://localhost:4173/#';
const VW = Number(process.env.VW) || 1280, VH = Number(process.env.VH) || 1000;
/* cache-bust the app shell on every launch so a rebuilt bundle is always picked up */
const BASE = BASE0.includes('#') ? BASE0.replace('#', `?v=${Date.now()}#`) : BASE0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--auto-select-desktop-capture-source=Entire', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, `--window-size=${VW},${VH}`, '--user-data-dir=' + OUT + '/chrome-profile', 'about:blank'], { stdio: 'ignore' });
  let targets = null;
  for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch(`http://localhost:${PORT}/json`)).json(); } catch { /* not up yet */ } }
  if (!targets) throw new Error('chrome did not start');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  const events = [];
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') events.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) events.push(m.params.type.toUpperCase() + ' ' + m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300)); };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: false, screenWidth: Math.max(VW, 1440), screenHeight: Math.max(VH, 900) });
  const evalJs = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails))); return r.result.value; };
  const api = {
    events,
    async goto(hash) { await send('Page.navigate', { url: BASE + hash }); await sleep(900); },
    async reload() { await send('Page.reload'); await sleep(900); },
    eval: evalJs,
    async click(text, tag = 'button, [role=button], span, div, a') {
      const ok = await evalJs(`(() => { const t = ${JSON.stringify(text)}; const els = Array.from(document.querySelectorAll(${JSON.stringify(tag)})); const el = els.reverse().find((e) => e.children.length < 6 && (e.textContent || '').trim().replace(/\\s+/g,' ').includes(t) && e.offsetParent !== null); if (!el) return false; el.click(); return (el.tagName + ':' + (el.textContent||'').trim().slice(0,40)); })()`);
      if (!ok) throw new Error('click: not found: ' + text);
      await sleep(500); return ok;
    },
    async type(selector, value) {
      const ok = await evalJs(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      if (!ok) throw new Error('type: not found: ' + selector);
      await sleep(150);
    },
    async setFile(selector, path) {
      const { root } = await send('DOM.getDocument', { depth: -1 });
      const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector });
      if (!nodeId) throw new Error('setFile: not found ' + selector);
      await send('DOM.setFileInputFiles', { nodeId, files: [path] });
      await sleep(300);
    },
    async text(selector = 'body') { return evalJs(`(document.querySelector(${JSON.stringify(selector)})||{}).innerText || ''`); },
    async shot(name, full = true) {
      if (full) { const h = await evalJs(`Math.max(document.documentElement.scrollHeight, ...Array.from(document.querySelectorAll('div')).filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight).map((e) => e.scrollHeight + e.getBoundingClientRect().top + window.scrollY))`); await send('Emulation.setDeviceMetricsOverride', { width: VW, height: Math.min(2400, Math.max(700, h)), deviceScaleFactor: 1, mobile: false, screenWidth: Math.max(VW, 1440), screenHeight: Math.max(VH, 900) }); await sleep(150); }
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
      await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: false, screenWidth: Math.max(VW, 1440), screenHeight: Math.max(VH, 900) });
      if (full) { await sleep(120); const vp = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}-vp.png`, Buffer.from(vp.data, 'base64')); }
      return name;
    },
    async url() { return evalJs('location.href'); },
    sleep,
    async close() { try { ws.close(); } catch { /* */ } proc.kill(); },
  };
  return api;
}
