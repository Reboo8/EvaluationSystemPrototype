const OUT = process.env.OUT || new URL("./shots/", import.meta.url).pathname;
const { launch } = await import(OUT + '/cdp.mjs');
const b = await launch();
const log = (...a) => console.log('•', ...a);
const step = async (name, fn) => { try { await fn(); log('ok', name); } catch (e) { log('FAIL', name, '→', e.message); await b.shot('ERR-' + name.replace(/[^a-z0-9]+/gi, '_')).catch(() => {}); } };
const invites = async () => JSON.parse(await b.eval('localStorage.getItem("cuba_invites") || "{}"'));
const has = async (t) => new RegExp(t, 'i').test(await b.text('body'));
const waitFor = async (t, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await has(t)) return true; await b.sleep(250); } throw new Error('timeout waiting for: ' + t); };
const errs = () => { if (b.events.length) { log('  console:', b.events.slice(-3).join(' || ').slice(0, 400)); b.events.length = 0; } };

const clickRun = () => b.eval(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Run')?.click()`);
const hasBtn = (label) => b.eval(`!!Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)})`);
let tok = null;
await step('send: issue a link', async () => {
  await b.goto('/opportunities/1/send'); await b.type('textarea.input', 'meera.iyer@example.com, arjun.nair@example.com'); await b.click('Send Assessment', 'button'); await b.sleep(500);
  const list = Object.values(await invites()).filter((i) => i.oppId === '1' && i.source === 'email' && i.status === 'SENT'); tok = list[0]?.token; log('  token:', tok);
});
await step('instructions', async () => { await b.goto('/a/' + tok); await waitFor('Ready when you are'); await b.shot('n01-instructions'); errs(); await b.click('Begin setup', 'button'); await b.sleep(700); });
await step('system check', async () => {
  await waitFor('set up your camera'); await b.shot('n02-syscheck-before', false);
  await b.click('Turn on camera', 'button'); await b.sleep(900);
  await b.click('Turn on mic', 'button'); await b.sleep(900);
  await b.click('Share screen', 'button'); await b.sleep(1200);
  await b.shot('n03-syscheck-after', false); errs();
  await b.click('Continue to verification', 'button'); await b.sleep(900);
});
await step('identity: face + voice', async () => {
  await waitFor('Two quick checks'); await b.sleep(2500); await b.shot('n04-identity');
  log('  face status:', (await b.text('main, body')).match(/(Face detected[^\n]*|Position your face[^\n]*|Too dark[^\n]*|Waiting[^\n]*)/)?.[1]);
  await b.click('Take photo', 'button'); await b.sleep(500); await b.click('Use this photo', 'button'); await b.sleep(300);
  await b.eval(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Record').click()`); await b.sleep(3200); await b.eval(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Stop').click()`); await b.sleep(600); await b.click('Submit recording', 'button'); await b.sleep(1200);
  await b.shot('n05-identity-done'); errs();
  await b.click('Start the assessment', 'button'); await b.sleep(500); await b.shot('n06-fullscreen-gate', false);
  await b.click('Enter fullscreen', 'button'); await b.sleep(1200); log('  fullscreen:', await b.eval('!!document.fullscreenElement'), '| body:', (await b.text('body')).slice(0, 60).replace(/\n/g, ' | '));
  if (await has('Try again')) { log('  fullscreen denied under automation — retrying via gesture'); await b.click('Try again', 'button'); await b.sleep(1000); }
});
await step('assessment: module 1 (coding)', async () => {
  await waitFor('Module 1 of'); await b.shot('n07-module-intro'); await b.click('Start Coding', 'button'); await b.sleep(800); await b.shot('n08-coding');
  await b.type('textarea.cj-timer', 'function solve(nums, target) {\n  for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) if (nums[i] + nums[j] === target) return [i, j];\n  return [];\n}');
  await clickRun(); await b.sleep(1500); await b.shot('n09-coding-ran'); errs();
  for (let k = 0; k < 4; k++) {
    const t = await b.text('body'); log('  tests:', t.match(/\d+\/\d+ tests passed/)?.[0] || 'not run');
    if (await hasBtn('Save & continue')) { await b.click('Save & continue', 'button'); await b.sleep(500); await b.type('textarea.cj-timer', 'function solve(s) {\n  return String(s).split(" ").reverse().join(" ");\n}'); await clickRun(); await b.sleep(1200); continue; }
    await b.click('Submit Coding', 'button'); await b.sleep(400);
    if (await has('Ready to Submit|Confirm Submission')) { await b.shot('n10-submit-modal', false); const which = await b.click('Submit Coding', 'button'); log('  confirm clicked:', which, '| fs:', await b.eval('!!document.fullscreenElement')); await b.sleep(2500); log('  after confirm:', (await b.text('body')).slice(0, 90).replace(/\n/g, ' | ')); errs(); }
    break;
  }
});
await step('assessment: module 2 (written)', async () => {
  await waitFor('Module 2 of'); await b.click('Start Written', 'button'); await b.sleep(400);
  if (await has('Preparing your')) { await b.shot('n11-preparing', false); await waitFor('Write your answer', 20000); }
  await b.shot('n12-written');
  for (let i = 0; i < 6; i++) { await b.type('textarea', `On a payments project I owned the Node.js service that reconciled MongoDB records with the bank feed. I wrote idempotent jobs, added tests, and cut manual effort by 70% within a quarter. Question ${i + 1}.`); await b.sleep(200); const t = await b.text('body'); if (await hasBtn('Save & continue')) { await b.click('Save & continue', 'button'); await b.sleep(400); } else { await b.click('Submit Written', 'button'); await b.sleep(400); await b.click('Submit Written', 'button'); await b.sleep(2500); break; } }
  errs();
});
await step('assessment: module 3 (typing)', async () => {
  await waitFor('Module 3 of'); await b.click('Start Typing', 'button'); await b.sleep(500); await b.shot('n13-typing-start', false);
  const passage = await b.eval(`Array.from(document.querySelectorAll('div.cj-timer')).find(d => d.innerText.length > 120)?.innerText || ''`);
  const part = passage.slice(0, 140); for (let i = 20; i <= part.length; i += 20) { await b.type('textarea', part.slice(0, i)); await b.sleep(120); }
  await b.shot('n14-typing'); await b.click('Submit Typing', 'button'); await b.sleep(400); await b.click('Submit Typing', 'button'); await b.sleep(2500); errs();
});
await step('interview', async () => {
  await waitFor('Start interview', 10000); await b.shot('n15-interview-ready'); await b.click('Start interview', 'button'); await b.sleep(1500); await b.shot('n16-countdown', false);
  await b.sleep(16500); await waitFor('Done answering|Finish', 15000); await b.shot('n17-interview-live');
  const btnLabels = () => b.eval(`Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())`);
  for (let i = 0; i < 14; i++) {
    let labels = []; for (let w = 0; w < 40; w++) { labels = await btnLabels(); if (labels.some((l) => /^Done answering|^Finish/.test(l))) break; await b.sleep(500); }
    const t = await b.text('body'); if (/Scoring your interview|Nicely done/.test(t)) break;
    if (labels.some((l) => /Type instead/.test(l))) { await b.click('Type instead', 'button'); await b.sleep(300); }
    if (await b.eval("!!document.querySelector('textarea')")) { await b.type('textarea', `Answer ${i + 1}: I led the migration of our checkout service to Node.js, coordinating three engineers and measuring p95 latency before and after.`); await b.sleep(200); }
    if (i === 0) { await b.shot('n17b-interview-typing', false); log('  answer shown in panel:', /I led the migration/.test(await b.text('body'))); }
    labels = await btnLabels();
    if (labels.some((l) => /^Finish/.test(l))) { await b.eval(`Array.from(document.querySelectorAll('button')).find(b => /^Finish/.test(b.textContent.trim())).click()`); } else { await b.eval(`Array.from(document.querySelectorAll('button')).find(b => /^Done answering/.test(b.textContent.trim())).click()`); }
    await b.sleep(1200);
  }
  await b.shot('n18-evaluating', false); await waitFor('Nicely done', 30000); await b.sleep(500); await b.shot('n19-results'); errs();
  const inv = (await invites())[tok]; log('  invite:', inv.status, JSON.stringify(inv.outcome?.gates?.map((g) => `${g.module}:${g.score}:${g.band}`)), 'weighted', inv.outcome?.weighted, inv.outcome?.status);
  await b.click('Finish', 'button'); await b.sleep(400); await b.shot('n20-done', false);
});
await step('rank list + report', async () => { await b.goto('/opportunities/1/rank'); await b.shot('n21-rank'); const t = await b.text('body'); log('  new row:', /\bnew\b/.test(t)); });
await b.close(); console.log('DONE');
