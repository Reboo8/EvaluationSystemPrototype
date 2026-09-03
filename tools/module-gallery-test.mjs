/* Walks one opportunity's candidate flow and screenshots every module intro + first question of each type. OPP=1|2|3 */
const OUT = process.env.OUT || new URL("./shots/", import.meta.url).pathname; const OPP = process.env.OPP || '2'; const TAG = `g${OPP}`;
const { launch } = await import(OUT + '/cdp.mjs'); const b = await launch();
const log = (...a) => console.log('•', ...a);
const has = async (t) => new RegExp(t, 'i').test(await b.text('body'));
const waitFor = async (t, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await has(t)) return true; await b.sleep(250); } throw new Error('timeout: ' + t); };
const labels = () => b.eval(`Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent).map(b => b.textContent.trim())`);
const clickLabel = (re) => b.eval(`(() => { const bs = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent && ${re}.test(b.textContent.trim())); const el = bs[bs.length - 1]; if (!el) return false; el.click(); return el.textContent.trim(); })()`);
try {
  if (process.env.ADDALL) {
    await b.goto(`/opportunities/${OPP}/assessment`); await b.sleep(700);
    const n = await b.eval("(() => { const bs = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim() === '+ Add' && !b.disabled); bs.forEach(b => b.click()); return bs.length; })()");
    await b.sleep(500); await b.shot('g-addall-builder');
    const blocked = await b.eval("(() => { const s = Array.from(document.querySelectorAll('button')).find(b => /Save assessment/.test(b.textContent)); return s ? (s.disabled ? s.title : '') : 'no save button'; })()");
    log('added modules:', n, blocked ? '| save blocked: ' + blocked : '| saving'); await b.click('Save assessment', 'button'); await b.sleep(900);
  }
  await b.goto(`/opportunities/${OPP}/send`); await b.type('textarea.input', `gallery${OPP}@example.com`); await b.click('Send Assessment', 'button'); await b.sleep(500);
  const inv = JSON.parse(await b.eval('localStorage.getItem("cuba_invites")||"{}"')); const tok = Object.values(inv).filter((i) => i.oppId === OPP && i.status === 'SENT').pop()?.token;
  if (!tok) { log('no invite (resume gate rejected) — retrying with another email'); await b.goto(`/opportunities/${OPP}/send`); await b.type('textarea.input', `gallery${OPP}b@example.com, gallery${OPP}c@example.com`); await b.click('Send Assessment', 'button'); await b.sleep(500); }
  const inv2 = JSON.parse(await b.eval('localStorage.getItem("cuba_invites")||"{}"')); const token = Object.values(inv2).filter((i) => i.oppId === OPP && i.status === 'SENT').pop()?.token; if (!token) throw new Error('no invite');
  await b.goto('/a/' + token); await waitFor('Ready when you are'); await b.shot(`${TAG}-01-landing`);
  await b.click('Begin setup', 'button'); await waitFor('set up your camera'); await b.click('Turn on camera', 'button'); await b.sleep(800); await b.click('Turn on mic', 'button'); await b.sleep(800); await b.click('Share screen', 'button'); await b.sleep(1000); await b.click('Continue to verification', 'button');
  await waitFor('Two quick checks'); await b.sleep(2200); await b.click('Take photo', 'button'); await b.sleep(400); await b.click('Use this photo', 'button'); await b.sleep(300);
  await clickLabel('/^Record$/'); await b.sleep(3000); await clickLabel('/^Stop$/'); await b.sleep(600); await b.click('Submit recording', 'button'); await b.sleep(1100);
  await b.click('Start the assessment', 'button'); await b.sleep(400); await b.click('Enter fullscreen', 'button'); await b.sleep(1200);
  for (let m = 0; m < 20; m++) {
    if (await has('Start interview|Nicely done')) break;
    await waitFor('Module \\d+ of', 15000); const intro = (await b.text('body')).match(/Module (\d+) of (\d+)[\s\S]{0,60}/)?.[0].replace(/\n/g, ' ');
    await b.shot(`${TAG}-m${m + 1}-intro`, false); log('  intro:', intro);
    await clickLabel('/^Start /'); await b.sleep(600);
    if (await has('Preparing your')) { await waitFor('Save & continue|Submit ', 25000); }
    for (let k = 0; k < 12; k++) {
      await b.sleep(500); await b.shot(`${TAG}-m${m + 1}-q${k + 1}`, false);
      const t = await b.text('body'); const ls = await labels(); log('   ', t.match(/Q\d+ \/ \d+[^\n]*/)?.[0] || '', '|', (t.match(/(Multiple choice|Situation|Reading|Writing|Listening|Speaking|Statement|Simulation|Typing|Coding|Video|File)/) || [])[1]);
      if (k === 0 && /Send/.test(ls.join('|'))) { await b.type('textarea.cj-textarea', 'I am sorry about the delay. I can see the order left our warehouse on Monday; let me get the courier update and share it in the next five minutes.'); await clickLabel('/^Send$/'); await b.sleep(2500); await b.shot(`${TAG}-m${m + 1}-q${k + 1}-chat`, false); }
      if (ls.some((l) => /^Save & continue/.test(l)) && !ls.some((l) => /^Submit /.test(l))) { await clickLabel('/^Save & continue/'); continue; }
      await clickLabel('/^Submit /'); await b.sleep(500); await clickLabel('/^Submit /'); await b.sleep(2500); break;
    }
  }
  if (await has('Start interview')) { await b.shot(`${TAG}-interview-ready`, false); await b.click('Start interview', 'button'); await b.sleep(12500); await waitFor('Done answering|Finish', 20000); await b.shot(`${TAG}-interview-live`, false); await b.click('End interview', 'button'); await b.sleep(400); await clickLabel('/^End interview$/'); await waitFor('Nicely done', 30000); }
  await b.sleep(600); await b.shot(`${TAG}-results`); log('done', TAG);
} catch (e) { log('FAIL', e.message); await b.shot(`${TAG}-ERR`).catch(() => {}); }
console.log('events:', b.events.slice(0, 3)); await b.close();
