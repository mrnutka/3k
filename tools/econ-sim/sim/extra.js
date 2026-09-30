// extra figures quoted in the tabs (5.2 splits, turnover mix), old (no D3) vs new (with D3)
const S = require('./sim.js'); const fs = require('fs');
const pn = S.getProjNeed(false);
const r2 = JSON.parse(fs.readFileSync('r2_changes.json', 'utf8'));
const r2old = JSON.parse(JSON.stringify(r2)); delete r2old.upgrade;
const sum = a => a.reduce((s, x) => s + x, 0);
function go(ch, tag, extra) {
  const P = S.deepMerge(S.deepMerge(S.deepMerge(S.DEFAULTS, S.SPINE_R1), { trade: { projNeed: pn } }), S.deepMerge(ch, extra || {}));
  const res = S.run(P, tag);
  const out = {};
  for (const [p, rows] of Object.entries(res.refs)) { if (!rows) continue;
    const K = {}; for (const r of rows) for (const [c, v] of Object.entries(r.k)) K[c] = (K[c] || 0) + v;
    const upg = ['K_ENH','K_TROOP','K_HORSE','K_GEM','K_REROLL','K_SET','K_BREAK'];
    const U = sum(upg.map(c => K[c] || 0)); const UG = U + (K.K_GRANARY || 0);
    out[p] = { enh: (K.K_ENH||0)/U*100, troop:(K.K_TROOP||0)/U*100, horse:(K.K_HORSE||0)/U*100, rest: ((K.K_GEM||0)+(K.K_REROLL||0)+(K.K_SET||0)+(K.K_BREAK||0))/U*100,
      g_enh: ((K.K_ENH||0))/UG*100, g_rest: ((K.K_GEM||0)+(K.K_REROLL||0)+(K.K_SET||0)+(K.K_BREAK||0)+(K.K_GRANARY||0))/UG*100 };
  }
  const T = res.days.reduce((a, x) => { a.m += x.T.market; a.b += x.T.board; return a; }, { m: 0, b: 0 });
  const vel = res.days.filter(x => x.d >= 22).map(x => x.velocity);
  const velAll = res.days.map(x => x.velocity);
  console.log(tag, JSON.stringify(Object.fromEntries(Object.entries(out).map(([p,o])=>[p,Object.fromEntries(Object.entries(o).map(([k,v])=>[k,+v.toFixed(1)]))]))));
  console.log('  board share of turnover', (T.b/(T.m+T.b)*100).toFixed(1)+'%', 'vel d22+ min', (Math.min(...vel)*100).toFixed(1), 'vel d4', (res.days[3].velocity*100).toFixed(1), 'vel max', (Math.max(...velAll)*100).toFixed(1), 'vel d90', (res.days[89].velocity*100).toFixed(1));
  const K90={}; let F=0; for (const x of res.days){F+=x.Ftot; for (const [c,v] of Object.entries(x.K)) K90[c]=(K90[c]||0)+v;}
  console.log('  sinks %F', Object.entries(K90).map(([c,v])=>c+' '+(v/F*100).toFixed(2)).join(' · '));
  const F90={}; for (const x of res.days) for (const [c,v] of Object.entries(x.F)) F90[c]=(F90[c]||0)+v;
  console.log('  faucets %', Object.entries(F90).map(([c,v])=>c+' '+(v/F*100).toFixed(2)).join(' · '));
  const r7e = res.days.slice(0,14).map(x=>x.r7), r7e4 = res.days.slice(3,14).map(x=>x.r7), r7l = res.days.slice(14).map(x=>x.r7);
  console.log('  r7 d1-14 max', Math.max(...r7e).toFixed(2), 'd4-14 max', Math.max(...r7e4).toFixed(2), 'd15+', Math.min(...r7l).toFixed(2)+'–'+Math.max(...r7l).toFixed(2), 'DoI max', Math.max(...res.days.map(x=>x.daysIncome)).toFixed(2));
  return res;
}
const which = process.argv[2] || 'main';
const sens = { main: {}, hold30: { trade: { holdDays: 30 } }, hold7: { trade: { holdDays: 7 } }, deposit30: { spine: { nobInstallShare: 0.3 } }, buffer1: { spine: { nobInstallBufferDays: 1 } }, nos1s2: { spine: { nobInstall: false, prepayPatchTier: false } } };
for (const [k, o] of Object.entries(sens)) { if (which !== 'all' && which !== k) continue; go(r2old, 'OLD_' + k, o); go(r2, 'NEW_' + k, o); }
