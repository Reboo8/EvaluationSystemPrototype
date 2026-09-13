/* Proctoring signals test: reach the first question, fire each browser signal, and check what the runner records,
   what the candidate sees, and what the recruiter side receives. Run: OUT=./tools/shots node tools/proctor-test.mjs */
const OUT = process.env.OUT || new URL('./shots/', import.meta.url).pathname;
const { launch } = await import(OUT + '/cdp.mjs');
const b = await launch();
const log = (...a) => console.log('•', ...a);
const step = async (name, fn) => { try { await fn(); log('ok', name); } catch (e) { log('FAIL', name, '→', e.message); await b.shot('P-ERR-' + name.replace(/[^a-z0-9]+/gi, '_')).catch(() => {}); } };
const invites = async () => JSON.parse(await b.eval('localStorage.getItem("cuba_invites") || "{}"'));
const has = async (t) => new RegExp(t, 'i').test(await b.text('body'));
const waitFor = async (t, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await has(t)) return true; await b.sleep(250); } throw new Error('timeout waiting for: ' + t); };
const flags = async () => (await b.text('body')).match(/(\d+) flags?/)?.[1] || '0';
const modalTitle = async () => (await b.text('body')).match(/(Tab Switch Detected|Window Focus Lost|Copy\/Paste Detected|Right-Click Detected|Fullscreen Exit|Restricted Shortcut|Violation Detected)/)?.[1] || '-';
const countdown = async () => (await b.text('body')).match(/auto-close in\s*(\d+)/)?.[1] || '-';
const dismiss = async () => { await b.eval(`Array.from(document.querySelectorAll('button')).find(b => /Acknowledge|I Understand/.test(b.textContent))?.click()`); await b.sleep(300); };

let tok = null;
await step('issue link', async () => {
  await b.goto('/opportunities/1/send'); await b.type('textarea.input', 'proctor' + Date.now() + '@example.com'); await b.click('Send Assessment', 'button'); await b.sleep(500);
  tok = Object.values(await invites()).filter((i) => i.oppId === '1' && i.status === 'SENT').sort((a, z) => (z.sentAt || 0) - (a.sentAt || 0))[0]?.token; log('  token:', tok); if (!tok) log('  invites:', JSON.stringify(Object.values(await invites()).map((i) => [i.oppId, i.status, i.email, i.source]).slice(-4)));
});
await step('reach question 1', async () => {
  await b.goto('/a/' + tok); await waitFor('Ready when you are'); await b.click('Begin setup', 'button'); await b.sleep(700);
  await waitFor('set up your camera'); await b.click('Turn on camera', 'button'); await b.sleep(900); await b.click('Turn on mic', 'button'); await b.sleep(900); await b.click('Share screen', 'button'); await b.sleep(1200);
  await b.click('Continue to verification', 'button'); await b.sleep(900);
  await waitFor('Two quick checks'); await b.sleep(2500); await b.click('Take photo', 'button'); await b.sleep(500); await b.click('Use this photo', 'button'); await b.sleep(300);
  await b.eval(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Record').click()`); await b.sleep(3200); await b.eval(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Stop').click()`); await b.sleep(600); await b.click('Submit recording', 'button'); await b.sleep(1200);
  await b.click('Start the assessment', 'button'); await b.sleep(500); await b.click('Enter fullscreen', 'button'); await b.sleep(1200);
  if (await has('Try again')) { await b.click('Try again', 'button'); await b.sleep(1000); }
  log('  fullscreen:', await b.eval('!!document.fullscreenElement'));
  await waitFor('Module 1 of'); log('  flags before start (intro phase):', await flags());
});
await step('signal: blur during intro phase (before Start)', async () => {
  await b.eval(`window.dispatchEvent(new Event('blur'))`); await b.sleep(400);
  log('  flags:', await flags(), '| modal:', await modalTitle()); await dismiss();
});
await step('start module', async () => { await b.click('Start Coding', 'button'); await b.sleep(900); await waitFor('Question 1 of'); log('  flags at Q1:', await flags()); });
await step('signal: tab switch (visibilitychange hidden + blur, as a real tab switch fires both)', async () => {
  const before = await flags();
  await b.eval(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur')); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });`);
  await b.sleep(500); await b.shot('P1-tab-switch', false);
  log('  flags:', before, '→', await flags(), '| modal:', await modalTitle());
});
await step('modal auto-close countdown (should reach 0 in ~10s)', async () => {
  const c0 = await countdown(); await b.sleep(4000); const c4 = await countdown(); await b.sleep(4000); const c8 = await countdown();
  log('  countdown t0:', c0, '| t+4s:', c4, '| t+8s:', c8, '| modal still open:', await modalTitle());
  await dismiss();
});
await step('signal: right-click', async () => { const before = await flags(); await b.sleep(1600); await b.eval(`document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))`); await b.sleep(400); log('  flags:', before, '→', await flags(), '| modal:', await modalTitle()); await dismiss(); });
await step('signal: paste', async () => { const before = await flags(); await b.sleep(1600); await b.eval(`document.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }))`); await b.sleep(400); log('  flags:', before, '→', await flags(), '| modal:', await modalTitle()); await dismiss(); });
await step('signal: fullscreen exit', async () => {
  const before = await flags(); await b.sleep(1600);
  await b.eval(`document.exitFullscreen ? document.exitFullscreen().catch(()=>{}) : null`); await b.sleep(900); await b.shot('P2-fullscreen-exit', false);
  const t = await b.text('body');
  log('  flags:', before, '→', await flags(), '| violation modal:', await modalTitle(), '| paused modal:', /Assessment Paused/.test(t), '| both overlap:', /Assessment Paused/.test(t) && (await modalTitle()) !== '-');
  await b.eval(`document.documentElement.requestFullscreen().catch(()=>{})`); await b.sleep(900); await dismiss();
});
await step('what got persisted for the recruiter', async () => {
  const inv = (await invites())[tok];
  const v = inv?.attempt?.violations || [];
  log('  attempt.violations:', v.length, JSON.stringify(v.map((x) => x.violationType || x.type)));
  log('  has any evidence (snapshot/frame/face):', JSON.stringify(v.some((x) => x.metadata && Object.keys(x.metadata).length)));
});
await b.close(); console.log('DONE');
