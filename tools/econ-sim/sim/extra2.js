const S = require('./sim.js'); const fs = require('fs');
const pn = S.getProjNeed(false);
const r2 = JSON.parse(fs.readFileSync('r2_changes.json', 'utf8'));
const r2old = JSON.parse(JSON.stringify(r2)); delete r2old.upgrade;
const sum = a => a.reduce((s, x) => s + x, 0);
for (const [tag, ch] of [['OLD', r2old], ['NEW', r2]]) {
  const P = S.deepMerge(S.deepMerge(S.deepMerge(S.DEFAULTS, S.SPINE_R1), { trade: { projNeed: pn } }), ch);
  const res = S.run(P, tag);
  for (const [p, rows] of Object.entries(res.refs)) { if (!rows) continue;
    const f = sum(rows.map(r => sum(Object.values(r.f)))), tin = sum(rows.map(r => r.tin)), bi = sum(rows.map(r => r.boardIn)), mi = sum(rows.map(r => r.mktIn));
    console.log(tag, p, 'f', Math.round(f), 'f+tin', Math.round(f + tin), 'f+bi+mi', Math.round(f + bi + mi), 'tin', Math.round(tin), 'bi', Math.round(bi), 'mi', Math.round(mi), 'endBal', Math.round(rows[rows.length-1].bal));
  }
}
