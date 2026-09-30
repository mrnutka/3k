// Extracts the numbers used in balance_r2.md from out/*.json (run `node sim.js` first). Writes out/r2_report_data.md
const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, 'out');
const load = n => JSON.parse(fs.readFileSync(path.join(OUT, n + '.json'), 'utf8'));
const fmt = x => (x === null || x === undefined || Number.isNaN(x) ? '—' : Math.round(x).toLocaleString('en-US'));
const f2 = x => (x === null || x === undefined || Number.isNaN(x) ? '—' : (Math.round(x * 100) / 100).toFixed(2));
const pc = (x, d = 1) => (x === null || x === undefined ? '—' : (x * 100).toFixed(d) + '%');
const sum = a => a.reduce((s, x) => s + x, 0);
const L = [];
const SC = ['r2_design_70_22_8', 'r2_design_70_25_5', 'r2_spine_literal_70_22_8', 'r2_design_myopic_70_22_8', 'r2_changes_70_22_8', 'r2_changes_70_25_5',
  'r2_changes_myopic_70_22_8', 'r2_changes_hold7_70_22_8', 'r2_changes_hold30_70_22_8', 'r2_changes_deposit30_70_22_8', 'r2_changes_buffer1_70_22_8', 'r2_changes_nos1s2_70_22_8'];
const R = {}; for (const s of SC) R[s] = load(s);
// ---- KPI matrix
const ids = ['fs7_early', 'fs7', 'fs30', 'days_income', 'board_N', 'board_N7', 'board_fill', 'paid_gold_sold', 'price_index', 'price_index_S9', 'gini', 'top1', 'velocity', 'turnover_S10', 'velocity_S8', 'offline_share', 'upgrade_share', 'basics', 'poverty', 'whale_gap', 'i_fs7_d4', 'i_idx_yellow'];
L.push('## KPI matrix'); L.push('');
L.push('| KPI | ' + SC.map(s => s.replace('_70_', ' ').replace('r2_', '')).join(' | ') + ' |'); L.push('|---|' + SC.map(() => '---').join('|') + '|');
for (const id of ids) {
  const row = SC.map(s => { const k = R[s].kpi.find(x => x.id === id); return k ? `${k.value}${k.ok ? '' : ' ✗'}` : '—'; });
  const k0 = R[SC[0]].kpi.find(x => x.id === id); L.push(`| ${id} (${k0 ? k0.target : ''}) | ${row.join(' | ')} |`);
}
L.push(''); L.push('| scenario | cum F/K | day-90 M | fails as written | fails with S7/S9/S10 |'); L.push('|---|---|---|---|---|');
const summ = JSON.parse(fs.readFileSync(path.join(OUT, 'summary_r2.json'), 'utf8'));
for (const s of summ) L.push(`| ${s.scenario} | ${s.cumRatio} | ${fmt(R[s.scenario].days[89].M)} | ${s.failsAsWritten.join(', ')} | ${s.failsWithProposals.join(', ') || 'none'} |`);
// ---- daily series for primary and design
for (const s of ['r2_changes_70_22_8', 'r2_design_70_22_8']) {
  const X = R[s]; L.push(''); L.push(`## daily ${s}`); L.push('');
  L.push('| d | Lmed | F | K | F/K day | r7 | r30 | M | DoI | board P | gold offered | tael bids | fillB | guide | N | guide S7 | N7 | vel | turn/F | gini | top1 | idx | idxS9 |');
  L.push('|' + '---|'.repeat(23));
  for (const d of [1, 2, 3, 4, 5, 7, 10, 14, 21, 28, 30, 35, 42, 45, 50, 56, 60, 63, 70, 75, 80, 84, 90]) {
    const x = X.days[d - 1]; const f7 = sum(X.days.slice(Math.max(0, d - 7), d).map(y => y.Ftot)) / Math.min(7, d);
    L.push(`| ${d} | ${x.Lmed} | ${fmt(x.Ftot)} | ${fmt(x.Ktot)} | ${f2(x.Ftot / x.Ktot)} | ${f2(x.r7)} | ${d >= 30 ? f2(x.r30) : '—'} | ${fmt(x.M)} | ${f2(x.daysIncome)} | ${x.board.guide ? fmt(x.board.P) : '—'} | ${fmt(x.board.G)} | ${fmt(x.board.D)} | ${x.board.guide ? pc(x.board.fillB, 0) : '—'} | ${fmt(x.board.guide)} | ${f2(x.board.N)} | ${fmt(x.board.guide7)} | ${f2(x.board.N7)} | ${pc(x.velocity)} | ${pc((x.T.market + x.T.board) / f7)} | ${f2(x.gini)} | ${pc(x.top1)} | ${f2(x.priceIdx)} | ${f2(x.priceIdxAlt)} |`);
  }
  // faucet / sink mix over 90 days
  const F = {}, K = {}; for (const x of X.days) { for (const [k, v] of Object.entries(x.F)) F[k] = (F[k] || 0) + v; for (const [k, v] of Object.entries(x.K)) K[k] = (K[k] || 0) + v; }
  const Ft = sum(Object.values(F)); L.push(''); L.push('90-day faucets: ' + Object.entries(F).map(([k, v]) => `${k} ${pc(v / Ft)}`).join(' · '));
  L.push('90-day sinks (% of faucets): ' + Object.entries(K).map(([k, v]) => `${k} ${pc(v / Ft)}`).join(' · ') + ` · total ${pc(sum(Object.values(K)) / Ft)}`);
  // weekly F/K windows
  const r7 = X.days.slice(14).map(x => x.r7); const r30 = X.days.slice(29).map(x => x.r30);
  L.push(`r7 d15-90 ${f2(Math.min(...r7))}–${f2(Math.max(...r7))} · r30 d30-90 ${f2(Math.min(...r30))}–${f2(Math.max(...r30))} · DoI max ${f2(Math.max(...X.days.map(x => x.daysIncome)))}`);
  const P = X.days.filter(x => x.d >= 4).map(x => x.board.P); L.push(`board price d4-90: min ${fmt(Math.min(...P))} max ${fmt(Math.max(...P))} · d30 ${fmt(X.days[29].board.P)} d60 ${fmt(X.days[59].board.P)} d90 ${fmt(X.days[89].board.P)} · gold sold total ${fmt(sum(X.days.map(x => x.board.goldSold)))} · tael matched total ${fmt(sum(X.days.map(x => x.board.matchedTael)))}`);
  const G = X.days.slice(6).map(x => x.gini); L.push(`gini d7-90 ${f2(Math.min(...G))}–${f2(Math.max(...G))}`);
}
// ---- shares and milestones for primary + design + 25/5
for (const s of ['r2_changes_70_22_8', 'r2_design_70_22_8', 'r2_changes_70_25_5', 'r2_changes_myopic_70_22_8', 'r2_changes_nos1s2_70_22_8']) {
  const X = R[s]; L.push(''); L.push(`## shares & milestones ${s}`); L.push('');
  for (const [p, sh] of Object.entries(X.shares)) L.push(`${p}: income90 ${fmt(sh.income90)} · ` + Object.entries(sh.pct).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · ') + ` · endBal ${fmt(sh.endBal)}`);
  const keys = ['lv80', 'weapon10', 'weapon15', 't4', 'nob9', 'nob10', 'nob11', 'nob12', 'legend', 'card', 'pass', 'rank9'];
  L.push('| ms | ' + Object.keys(X.ms).join(' | ') + ' |'); L.push('|---|' + Object.keys(X.ms).map(() => '---').join('|') + '|');
  for (const k of keys) L.push(`| ${k} | ` + Object.keys(X.ms).map(p => { const m = X.ms[p][k]; return (m.ref ?? '—') + (m.reached ? ` (${m.p10}–${m.p90} · ${m.reached}/${m.n})` : ''); }).join(' | ') + ' |');
  L.push('| end | ' + Object.keys(X.ms).map(p => { const e = X.ms[p].end; return `+${e.enhAvg.toFixed(1)} w+${e.weapon} T${e.tier} r${e.refine} ★${e.stars} gems ${e.gems.slice(0, 5).join('/')} bal ${fmt(e.bal)}`; }).join(' | ') + ' |');
}
fs.writeFileSync(path.join(OUT, 'r2_report_data.md'), L.join('\n'), 'utf8');
console.log('written', L.length, 'lines');
