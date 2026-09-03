const OUT = process.env.OUT; const { launch } = await import(OUT + '/cdp.mjs'); const b = await launch();
const tag = process.env.TAG || 'p';
await b.goto('/'); await b.sleep(600);
const inv = JSON.parse(await b.eval('localStorage.getItem("cuba_invites")||"{}"'));
const done = Object.values(inv).find((i) => i.status === 'SUBMITTED' && i.oppId === '1');
const routes = [['home', '/'], ['opps', '/opportunities'], ['opp', '/opportunities/1'], ['send', '/opportunities/1/send'], ['invites', '/opportunities/1/invites'], ['pool', '/opportunities/1/pool'], ['rank', '/opportunities/1/rank'], ['report', '/opportunities/1/candidate/c1'], ['builder', '/opportunities/1/assessment'], ['careers', '/careers/1'], ['careers2', '/careers/2'], ['linkdone', done ? '/a/' + done.token : '/a/none'], ['billing', '/billing'], ['admin', '/admin']];
for (const [n, r] of routes) { await b.goto(r); await b.sleep(700); await b.shot(`${tag}-${n}`, false); }
console.log('done', tag, 'events:', b.events.slice(0, 3));
await b.close();
