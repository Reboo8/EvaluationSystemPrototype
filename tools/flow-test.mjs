const OUT = process.env.OUT || new URL("./shots/", import.meta.url).pathname;
const { launch } = await import(OUT + '/cdp.mjs');
const b = await launch();
const log = (...a) => console.log('•', ...a);
const step = async (name, fn) => { try { await fn(); log('ok', name); } catch (e) { log('FAIL', name, '→', e.message); } };
const invites = async () => JSON.parse(await b.eval('localStorage.getItem("cuba_invites") || "{}"'));

await step('send: issue links', async () => {
  await b.goto('/opportunities/1/send');
  await b.type('textarea.input', 'priya.verma@example.com, arjun.mehta@example.com\nsneha.reddy@example.com\nkaran.singh@example.com\nrohit.k@example.com');
  await b.click('Send Assessment', 'button');
  await b.sleep(600);
  await b.shot('01-send-done');
  const inv = Object.values(await invites()).filter((i) => i.oppId === '1' && i.source === 'email');
  log('  email invites issued:', inv.length, inv.map((i) => `${i.name}<${i.email}>`).join(', '));
});
const list = Object.values(await invites()).filter((i) => i.oppId === '1' && i.source === 'email' && i.status === 'SENT');
const A = list[0], B = list[1], C = list[2];
if (!A) { log('no invites — abort'); await b.close(); process.exit(1); }

await step('link A: welcome → start → checks → coding → save & exit', async () => {
  await b.goto('/a/' + A.token); await b.shot('02-welcome');
  await b.click('Start assessment', 'button'); await b.shot('03-checks');
  await b.click('I agree', 'button'); await b.sleep(400); await b.shot('04-coding');
  await b.click('Save & exit', 'button'); await b.shot('05-save-modal');
  await b.click('Save & exit', 'button'); await b.sleep(400); await b.shot('06-saved');
  const i = (await invites())[A.token]; log('  A status:', i.status, 'stage:', i.attempt?.stage, 'held:', JSON.stringify(i.attempt?.held));
});
await step('link A: reload → welcome back → resume', async () => {
  await b.reload(); await b.shot('07-welcome-back');
  await b.click('Resume assessment', 'button'); await b.sleep(400); await b.shot('08-resumed');
  const t = await b.text('header'); log('  header:', t.replace(/\n/g, ' | '));
});
await step('link A: withdraw', async () => {
  await b.click('Save & exit', 'button'); await b.click('withdraw from this assessment instead'); await b.shot('09-withdraw-modal');
  await b.click('Yes, withdraw', 'button'); await b.sleep(300); await b.shot('10-withdrawn');
  await b.reload(); await b.shot('11-closed-link');
  log('  A status:', (await invites())[A.token].status);
});
await step('link B: expire → request new → open new', async () => {
  await b.goto('/a/' + B.token); await b.sleep(300);
  await b.eval(`(() => { const s = JSON.parse(localStorage.cuba_invites); s[${JSON.stringify(B.token)}].expiresAt = Date.now() - 1000; localStorage.cuba_invites = JSON.stringify(s); return true; })()`);
  await b.reload(); await b.shot('12-expired');
  await b.click('Request a new link', 'button'); await b.shot('13-renewed');
  await b.click('Open the new link', 'button'); await b.sleep(400); await b.shot('14-new-link-welcome');
  const s = await invites(); log('  B status:', s[B.token].status, '→', s[B.token].renewedTo && s[s[B.token].renewedTo].status);
});
await step('invites tab', async () => { await b.goto('/opportunities/1/invites'); await b.shot('15-invites-tab'); });
let careersToken = null;
await step('careers: apply with resume', async () => {
  await b.goto('/careers/1');
  await b.type('input[placeholder="As on your ID"]', 'Priya Verma');
  await b.type('input[type=email]', 'priya.verma2@example.com');
  await b.setFile('input[type=file]', OUT + '/resume.txt');
  await b.sleep(300); await b.shot('16-careers-filled', false);
  await b.click('Apply now', 'button'); await b.sleep(900); await b.shot('17-careers-screening', false);
  await b.sleep(3000); await b.shot('18-careers-result', false);
  const t = await b.text('body'); log('  result:', /through to the next step/.test(t) ? 'PASS → link issued' : 'soft reject');
  const inv = Object.values(await invites()).find((i) => i.email === 'priya.verma2@example.com');
  careersToken = inv?.token; log('  careers invite:', inv ? `${inv.status} exp ${new Date(inv.expiresAt).toDateString()}` : 'none');
  if (/Start the assessment now/.test(t)) { await b.click('Start the assessment now', 'button'); await b.sleep(400); await b.shot('19-careers-to-assessment'); }
});
await step('full run to result (careers link or C)', async () => {
  const tok = careersToken || C.token;
  await b.goto('/a/' + tok);
  await b.click('Start assessment', 'button'); await b.click('I agree', 'button'); await b.sleep(300);
  await b.click('Submit & continue', 'button'); await b.sleep(300);
  await b.type('textarea.input', 'I built and maintained Node.js services with MongoDB for three years, including a payments reconciliation job that cut manual effort by 70%.');
  await b.click('Submit & continue', 'button'); await b.sleep(300);
  for (let i = 0; i < 20; i++) { const t = await b.text('main'); if (/Finish interview/.test(t)) { await b.click('Finish interview', 'button'); break; } await b.click('Answer & next question', 'button'); }
  await b.sleep(300);
  await b.type('textarea.input', 'The quick brown fox jumps over the lazy dog while the team ships reliable software every');
  await b.click('Submit & continue', 'button'); await b.sleep(500); await b.shot('20-result');
  await b.click('Finish', 'button'); await b.sleep(300); await b.shot('21-done');
  const i = (await invites())[tok]; log('  status:', i.status, 'outcome:', JSON.stringify(i.outcome));
  await b.goto('/opportunities/1/rank'); await b.shot('22-rank');
  const t = await b.text('body'); log('  rank has new row:', /\bnew\b/.test(t) ? 'yes' : 'no');
  await b.goto('/a/' + tok); await b.shot('23-already-done');
});
await step('rescue from pool → link', async () => {
  await b.goto('/opportunities/1/pool');
  await b.click('Rescue / send link', 'button'); await b.sleep(300); await b.shot('24-pool-rescued');
});
await b.close();
console.log('DONE');
