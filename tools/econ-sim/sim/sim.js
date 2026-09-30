'use strict';
// =====================================================================================
// game3k economy balance simulation — round 2  (round-1 version kept as sim_r1.js)
// Deterministic (no randomness), day-by-day, 90 days, agent-based (one agent per player).
//
// Round 2 changes to the model:
//   * DEFAULTS now read the module designs as revised after balance_r1 (drops.json persona_band with the
//     D1–D9 mix baked in, stones counted as low-stone value ÷ 100 at every level; upgrade.json gem table
//     ×7.5 and 10 set pieces; npc.json donation 1.5 × S and city restoration; cash.json weekly seller cap)
//   * material prices split into NPC buy (floor sale), market floor (= NPC buy ÷ 0.9, trade 5.5) and ceiling
//   * market model 'r2': forward-looking holding (players keep what they will use within holdDays of
//     their projected need), glut dumping only beyond dumpDays of projected need, bargain stock-up by
//     hardcore/payers when the reference price is below its 28-day anchor, official buyback lever (trade 5.8)
//   * nobody sells or dumps seals / breakthrough stones / set pieces still needed for their next step (keepOneOff)
//   * KPIs reported against the spine as written AND the proposals S7 (KPI 5 line), S9 (KPI 8 fixed-weight basket),
//     S10 (KPI 11 turnover ÷ faucets); S8 kept as information. Level-band use ÷ production table per material.
//
// What is bottom-up (taken from module formulas, not from spine budget shares):
//   faucets  : daily quests, farm coin + NPC buyback (spine S(L) × drops boss-time ratio),
//              offline, main story (incl. gold ingots), salary, seats, king fief,
//              NPC floor sales of glut materials (drops/npc/upgrade), plunder granary sales
//   sinks    : consumables, city tax, travel, services, one-time bag/warehouse (npc 12.9),
//              alliance donation (spine #31, 1 × S per donation, max 4/week),
//              market + direct-trade tax (trade 21.6) on a real material market,
//              exchange-board fee (cash 17.5, order book with ±5%/day price move),
//              nobility (spine 10, gates + price), NPC granary purchases of short materials,
//              upgrade fees / charms / transfers / fusion / troops / horses / gems / reroll / set /
//              breakthrough (upgrade module cost tables, capacity and level gates enforced),
//              endgame cosmetics (npc 3.6 rotating catalogue)
// What is behavioural (same assumption as the spine model _judge/final_model.py):
//   hours per persona, merit per week, free players buy gold with 2% / 3% of gross income,
//   payers list 150 paid gold per day, upgrade budget = spine share of income (38/45/42/39/50%),
//   endgame budget = spine 12% after nobility 12 (6% cosmetics + 6% city restoration)
//
// Usage:
//   node sim.js                       -> runs the 12 round-2 scenarios, writes out/r2_*.json, out/tables_r2_*.md, out/summary_r2.json
//   node sim.js --one r2_changes      -> scenarios whose name starts with the prefix
//   node sim.js --params x.json --tag t   -> custom overrides deep-merged on r2_design (DEFAULTS + SPINE_R1)
//   node sim.js --recalib             -> recompute sim/r2_projneed.json (projected need used by the holding rule)
// =====================================================================================
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const DESIGN = path.resolve(DIR, '..');
const OUT = path.join(DIR, 'out');

// ------------------------------------------------------------------ helpers
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sum = a => a.reduce((s, x) => s + x, 0);
const r0 = x => Math.round(x);
function deepMerge(a, b) {
  if (b === undefined) return a;
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return b;
  const o = Array.isArray(a) ? a.slice() : Object.assign({}, a);
  for (const k of Object.keys(b)) o[k] = deepMerge(a ? a[k] : undefined, b[k]);
  return o;
}
function median(arr) { if (!arr.length) return 0; const s = arr.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; }
function pct(arr, q) { if (!arr.length) return null; const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 1e-9))]; }
function gini(vals) {
  const v = vals.map(x => Math.max(0, x)).sort((a, b) => a - b); const n = v.length; const tot = sum(v);
  if (!n || tot <= 0) return 0; let acc = 0; for (let i = 0; i < n; i++) acc += (2 * (i + 1) - n - 1) * v[i];
  return acc / (n * tot);
}
function interp(points, L) { // points: [[x,y],...] sorted
  if (L <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) if (L <= points[i][0]) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i]; return y0 + (y1 - y0) * (L - x0) / (x1 - x0);
  }
  return points[points.length - 1][1];
}
function readJSON(f) { try { return JSON.parse(fs.readFileSync(path.join(DESIGN, f), 'utf8')); } catch (e) { return null; } }

// ------------------------------------------------------------------ design inputs read from module JSON
const DROPS = readJSON('drops.json');
const NPCJ = readJSON('npc.json');
const SPINEJ = readJSON('spine.json');
const UPGJ = readJSON('upgrade.json');
const CASHJ = readJSON('cash.json');
const TRADEJ = readJSON('trade.json');
const num = (s, dflt) => { const m = String(s ?? '').match(/[\d.]+/); return m ? Number(m[0]) : dflt; };
// round-2 values read from the revised module JSON (fallback = round-1 hard-coded value)
const J = {
  gemPrice: UPGJ ? [0, ...UPGJ.gems.map(g => g.ref)] : null,
  gemFusionTotal: UPGJ ? [0, ...UPGJ.gems.map(g => g.total_fee_from_tier1)] : null,
  setPieces: UPGJ ? (UPGJ.set_break.find(x => x.Li === 80) || {}).pieces_per_item : null,
  upgShareR1: UPGJ && UPGJ.budget_share ? UPGJ.budget_share.r1_S4 : null,
  charmGold: UPGJ && UPGJ.gold_shop ? UPGJ.gold_shop.price_gold_each : null,
  charmWeek: UPGJ && UPGJ.gold_shop ? UPGJ.gold_shop.weekly_cap : null,
  allyS: NPCJ && NPCJ.services && NPCJ.services.ally_donate ? NPCJ.services.ally_donate.s_mult : null,
  allyCap: NPCJ && NPCJ.services && NPCJ.services.ally_donate ? NPCJ.services.ally_donate.weekly_cap : null,
  restoration: !!(NPCJ && NPCJ.services && NPCJ.services.city_restoration),
  grassNpc: NPCJ && NPCJ.npc_sells_tradable ? NPCJ.npc_sells_tradable.items.horse_grass : null,
  stoneNpc: NPCJ && NPCJ.npc_sells_tradable ? NPCJ.npc_sells_tradable.items.enh_stone_basic : null,
  capWeekS: CASHJ && CASHJ.exchange_board ? num(CASHJ.exchange_board.seller_tael_cap.week, 40) : null,
  capDayS: CASHJ && CASHJ.exchange_board ? num(CASHJ.exchange_board.seller_tael_cap.day, 10) : null,
};
const dropsMat = id => (DROPS ? DROPS.materials.find(m => m.id === id) : null) || {};

// drops.sim.persona_band -> per persona, per level point: tael ratio (manual+auto) and material counts
function buildDropBand(stoneMode) {
  const pts = [10, 30, 50, 70, 80];
  // round 2 (drops D7): counts in drops.json are low-stone value ÷ 100 at every level; round 1 used item-level tiers
  const stoneTier = stoneMode === 'tiers' ? (L => (L <= 40 ? 100 : L <= 60 ? 240 : 330)) : (() => 100);
  const res = {};
  for (const p of ['casual', 'hardcore', 'payer']) {
    const pb = DROPS.sim.persona_band[p]; const o = {};
    const f = (fn) => pts.map(L => [L, fn(pb[String(L)], L)]);
    o.maRatio = f((r) => (r.total - r.offline) / Math.max(1, r.spine_farm - r.offline)); // boss-time purse + boss gear vs spine farm
    o.purseNet = f((r) => (r.purse + r.boss_gear_npc - r.forgone) / r.S); // per S, for ledger split
    const c = k => f(r => r.counts[k]);
    o.stoneT_perS = f((r, L) => r.counts.stone_t * stoneTier(L) / r.S); // value / S
    o.stoneB_perS = f((r, L) => r.counts.stone_b * stoneTier(L) / r.S);
    o.grassT = c('grass_t'); o.grassB = c('grass_b');
    o.rerollT = c('reroll_t'); o.rerollB = c('reroll_b');
    o.insigT = c('insignia_t'); o.insigB = c('insignia_b');   // drops "insignia" = ตราทัพ (refine token)
    o.sealT = c('seal_t'); o.sealB = c('seal_b');             // drops "seal" = ตราเลื่อนชั้น (troop promotion)
    o.gemT = f(r => r.counts.gem_t / 10 + r.gem1);            // gem1 equivalents (10 shards = 1 gem1) + boss gem1
    o.gemB = f(r => r.counts.gem_b / 10);
    o.setT = f(r => r.set_purple);
    o.ironT = f(r => r.breakthrough);
    o.plunderT = c('plunder_t'); o.plunderB = c('plunder_b');
    o.plunderRef = f(r => (r.turnin_value > 0 ? r.turnin_value / 30 : 6));
    o.hoursMA = pb['80'].manual_h + 0.8 * pb['80'].auto_h;
    res[p] = o;
  }
  return res;
}

// ------------------------------------------------------------------ DEFAULT PARAMETERS (= module designs as revised after round 1)
// Spine proposals S1/S2/S4 are NOT in DEFAULTS (spine.md not yet revised); scenario 'r2_design' adds them (SPINE_R1).
const DEFAULTS = {
  meta: {
    days: 90, mix: { casual: 700, hardcore: 220, payer: 80 }, whales: 1, joinDays: 10,
    mults: [0.8, 0.9, 1.0, 1.1, 1.2], upgradeMode: 'budget', greedyFrac: 0.3,
  },
  spine: {
    auto: 0.8, off: 0.44, dqT: 2.0, dqX: 1.5, story: 0.5, cap: 80,
    hours: { // [quests, manual farm, auto]  (spine 4.1)
      casual: { d1: [0.5, 0.5, 2.0], dn: [0.5, 0.0, 1.0], off: 8 },
      hardcore: { d1: [0.5, 4.5, 3.0], dn: [0.5, 2.5, 2.0], off: 8 },
      payer: { d1: [0.5, 2.0, 2.5], dn: [0.5, 1.0, 1.5], off: 12 },
      whale: { d1: [0.5, 4.5, 3.0], dn: [0.5, 2.5, 2.0], off: 12 },
    },
    potion: { casual: false, hardcore: false, payer: true, whale: true },
    meritWk: { casual: 6000, hardcore: 14000, payer: 10000, whale: 14000 },
    ranks: [[1, 0, 10, 8], [2, 300, 15, 11], [3, 1500, 20, 16], [4, 4000, 30, 27], [5, 8000, 40, 50], [6, 15000, 50, 80],
      [7, 30000, 60, 100], [8, 50000, 70, 120], [9, 75000, 80, 150], [10, 105000, 90, 165], [11, 140000, 100, 180]],
    seats: [[1, 4, 200], [2, 4, 220], [3, 4, 250], [4, 4, 280], [5, 4, 300], [6, 1, 320], [7, 1, 330], [8, 1, 340], [9, 1, 350]],
    kingdoms: 3, kingFief: 15000, seatStartDay: 8, salaryPerHu: 50,
    nob: { 9: 100000, 10: 250000, 11: 500000, 12: 1000000 },
    nobReq: { 9: [45, 8000], 10: [55, 20000], 11: [65, 40000], 12: [75, 70000] },
    storyEarly: null,               // e.g. { maxLv: 40, rate: 0.3 } = main-story tael per level for levels <= maxLv
    nobInstall: false, nobInstallLead: 0, nobInstallBufferDays: 1,   // nobility installments (round-1 proposal S1)
    prepayPatchTier: false, patchTierCost: 2000000, patchBufferDays: 1, // prepay tier 13 before the patch (round-1 proposal S2)
    upgShare: [0.38, 0.45, 0.42, 0.39], upgShareCap: 0.50,           // spine 6.1 as written (S4 = upgrade.json budget_share.r1_S4)
    endgShareCosmetic: 0.06, endgShareRestoration: 0.06,
    boardBuyShare: { casual: 0.02, hardcore: 0.03, payer: 0, whale: 0 },
  },
  npc: { // npc 12.1 / 12.9 / 5.12
    use: NPCJ ? NPCJ.sim.assumptions : null,
    cosmetics: { pricesS80: [10, 20, 20, 40], cycleDays: 30 },     // npc 3.6 rotating catalogue, 4 items / month
    restorationDesigned: J.restoration,                            // npc 5.12 (round 1 N1)
    restorationCapS80PerWeek: J.restoration ? 7 : 0,               // <= 1 x S(80) per character per day
    matFloorCapS: 1.0,                                             // npc 3.9: NPC floor sales <= 1 x S(L) per day per character
    charmNpcPrice: 1000,                                           // upgrade 3.5 charm at the royal smithy
  },
  drops: { stoneMode: 'flat100', maneLv: 60, manesPerDay: { casual: 0, hardcore: 6 / 7, payer: 0.556, whale: 6 / 7 },
    maneNeed: 40, legendFeeS: 5, storySeals: 4, storySealLv: 36, dismantleShare: 0.3, gearBuybackS: 0.10,
    matMult: { stone: 1, grass: 1, reroll: 1, insig: 1, seal: 1, gem: 1, set: 1, iron: 1, plunder: 1 }, // extra multipliers (round-1 mix is now inside drops.json)
    boundMult: 1,                                                                                        // offline/bound material rate multiplier
    stoneLowLv: 50, stoneLowMult: 1,                                                                     // extra stone multiplier below Lv 50
    matBandMult: null },                                                                                 // { cat: [[L, mult], ...] } extra multiplier interpolated by level
  upgrade: {
    split: { enh: 0.50, troop: 0.20, horse: 0.10, set: 0.05, gem: 0.08, reroll: 0.04, brk: 0.03 },
    fusedShare: 0.5, transferRate: 0.3, sockets: 40,
    gemPrice: J.gemPrice || [0, 200, 720, 2590, 9320, 33550, 120780, 434810, 1565320],
    gemFusionTotal: J.gemFusionTotal || [0, 0, 120, 790, 3920, 17350, 72180, 289010, 1127920],
    rerollTaelS: 0.2, rerollStones: 1.35,
    goldCharmsPerWeek: { casual: 0, hardcore: 0, payer: J.charmWeek || 30, whale: J.charmWeek || 30 },
    freeBoundCharmShare: 0.3,       // cash C5 = upgrade 21.4: from +13, 30% of free bound gold buys charms
    charmGold: J.charmGold || 6, markTael: 5000, markLocal: 2, marksPerWeek: 10,
    carryDays: 3, setPiecesPerItem: J.setPieces || 10,
  },
  trade: { mktShare: 0.8, listFee: 0.01, relist: 1.25, saleTax: 0.09, directTax: 0.10,
    listProp: { casual: 0.5, hardcore: 0.8, payer: 0.5, whale: 0.5 }, reserveDays: 3, dumpDays: 14, dumpProp: 0.5,
    priceK: 0.5, priceStep: 0.10,                       // trade 5.5: reference price moves <= +-10% per day
    model: 'r2',                                        // 'r1' = myopic (round 1) | 'r2' = forward-looking holding + bargain buying
    holdDays: 14, holdRelease: 0.30, dumpNeedDays: 60, // r2: keep holdDays of projected need (released linearly as price goes 1.0 -> 1.3 x anchor)
    band: 0.30, refOnlyOnTrades: true, keepOneOff: true,     // keepOneOff: nobody sells or dumps seals / breakthrough stones / set pieces still needed for the next step (both market models)
    minTrades: { qty: 5, sellers: 3, buyers: 3 }, // trade 5.5: reference moves only on ≥ 5 sales from ≥ 3 sellers and ≥ 3 buyers
    sellX0: 0.6, sellX1: 1.1, bargainX0: 0.6, bargainDailyShare: 0.2,  // r2 schedules: sellers list 0% at 0.6 × anchor → 100% at 1.1 × · stock-up 0% at 0.85 → 100% at 0.6 (20% of room per day)
    anchorDays: 28, bargainBelow: 0.85, bargainPersonas: ['hardcore', 'payer', 'whale'], bargainBalShare: 0.10,
    projNeed: null,                                     // persona -> material -> units/day at Lv 80 (null = calibrated by a first pass)
    official: { on: true, trigger: -0.10, glutDrop: -0.15, price: 0.70, taxShare: 0.10, maxItems: 5, fixedBudget: 0 } },
  cash: { openDay: 4, openPrice: 150, fee: 0.06, move: 0.05, holdDays: 3, sellPerDay: { payer: 150, whale: 99999 },
    capDayS: J.capDayS || 10, capWeekS: J.capWeekS || 40, topupGold30: { payer: 10040, whale: 100000 }, freeBound30: { casual: 1330, hardcore: 1479, payer: 1479, whale: 1479 },
    boardMinLv: 30, boardMinAge: 3, guidePath: { 4: 150, 5: 158, 6: 165, 7: 174, 8: 182, 10: 201, 12: 201, 14: 181, 21: 171 }, guideV: 42,
    guideRefPayerShare: 0.05,                         // KPI 5: line as written (spine 8.2) and S7 line (x 0.05 / payer share) both reported
    openAuto: true },                                 // cash C2 (adopted): day-4 call auction, reserve = 150 x (0.05 / payer share)
  alliance: { perWeek: { casual: 3, hardcore: 4, payer: 4, whale: 4 }, costS: J.allyS || 1.0, capPerWeek: J.allyCap || 4, minLv: 25 },
  // material market (drops.materials ref / npc_buy; trade 5.5 floor = NPC buy / 0.9; ceiling = granary price or 3 x ref)
  mats: {
    stone: { ref: 100, npcBuy: dropsMat('stone_1').npc_buy ?? 20, ceil: J.stoneNpc || 200, npcSell: true },  // low-stone equivalents
    grass: { ref: 20, npcBuy: dropsMat('grass').npc_buy ?? 4, ceil: J.grassNpc || 40, npcSell: true },       // npc 40 (upgrade 2.1 says 80 - conflict)
    reroll: { ref: 300, npcBuy: dropsMat('reroll').npc_buy ?? 30, ceil: 900, npcSell: false },
    insig: { ref: 600, npcBuy: dropsMat('insignia').npc_buy ?? 60, ceil: 1800, npcSell: false },
    seal: { ref: 2000, npcBuy: dropsMat('seal').npc_buy ?? 200, ceil: 6000, npcSell: false },
    gem: { ref: 1500, npcBuy: dropsMat('gem1').npc_buy ?? 150, ceil: 4500, npcSell: false },
    set: { ref: 800, npcBuy: dropsMat('set_purple').npc_buy ?? 80, ceil: 2400, npcSell: false },
    iron: { ref: 1000, npcBuy: dropsMat('breakthrough').npc_buy ?? 100, ceil: 3000, npcSell: false },
    plunder: { ref: 36, npcBuy: 7, ceil: 72, npcSell: true },      // ref follows level (drops turnin_value / 30)
  },
  kpi: { idxAlt: { exclude: ['grass', 'seal', 'insig', 'iron'], weights: { stone: 50, gem: 30, reroll: 5, set: 10, plunder: 5 }, baseFrom: 22, baseTo: 28, from: 29, target: 0.10 } }, // S9 proposal: basket without one-off items, base = week 4, KPI from day 29
};

// ------------------------------------------------------------------ core formulas
const S = L => 100 * (L + 2);
const gOf = L => Math.max(1, Math.round((L + 2) / 12));
function h(L) { if (L <= 59) return 0.04 * Math.pow(1.075, L); if (L <= 79) return 4.7 * Math.pow(1.10, L - 60); return h(79) * Math.pow(1.02, L - 79); }
const CUM = [0, 0]; for (let L = 1; L <= 160; L++) CUM[L + 1] = CUM[L] + h(L);
const ENH = [null, // upgrade 3.2 : fee (× S of item level), stone grade, stones per try (× g for low/mid), success p, charms per fail (× g)
  { f: 0.05, gr: 'low', s: 1, p: 1, q: 0 }, { f: 0.10, gr: 'low', s: 1, p: 1, q: 0 }, { f: 0.15, gr: 'low', s: 1, p: 1, q: 0 },
  { f: 0.20, gr: 'low', s: 2, p: 1, q: 0 }, { f: 0.25, gr: 'low', s: 2, p: 1, q: 0 }, { f: 0.30, gr: 'low', s: 2, p: 1, q: 0 },
  { f: 0.35, gr: 'low', s: 3, p: 1, q: 0 }, { f: 0.40, gr: 'low', s: 3, p: 1, q: 0 }, { f: 0.45, gr: 'low', s: 3, p: 1, q: 0 },
  { f: 0.50, gr: 'low', s: 3, p: 0.8, q: 0 }, { f: 0.60, gr: 'mid', s: 1, p: 0.7, q: 0 }, { f: 0.70, gr: 'mid', s: 1, p: 0.6, q: 0 },
  { f: 0.80, gr: 'mid', s: 1, p: 0.5, q: 1 }, { f: 0.90, gr: 'mid', s: 1, p: 0.45, q: 1 }, { f: 1.00, gr: 'mid', s: 2, p: 0.4, q: 1 },
  { f: 1.20, gr: 'high', s: 3, p: 0.35, q: 2 }, { f: 1.40, gr: 'high', s: 3, p: 0.3, q: 2 }, { f: 1.60, gr: 'high', s: 3, p: 0.25, q: 2 },
  { f: 1.80, gr: 'high', s: 3, p: 0.2, q: 3 }, { f: 2.00, gr: 'high', s: 6, p: 0.15, q: 3 }];
const enhCap = Li => (Li <= 20 ? 10 : Li <= 40 ? 12 : Li <= 60 ? 15 : 20);
const PROMO = [{ lv: 12, cS: 1, sL: 12, seals: 0 }, { lv: 36, cS: 3, sL: 36, seals: 1 }, { lv: 56, cS: 3, sL: 56, seals: 3 }, { lv: 72, cS: 3, sL: 72, seals: 6 }];
const CATS = ['stone', 'grass', 'reroll', 'insig', 'seal', 'gem', 'set', 'iron', 'plunder'];
const SINK_CODES = ['K_CONS', 'K_CITY_TAX', 'K_TRAVEL', 'K_SERVICE', 'K_ALLY_DONATE', 'K_TRADE_TAX', 'K_BOARD_FEE', 'K_NOBLE',
  'K_ENH', 'K_TROOP', 'K_HORSE', 'K_GEM', 'K_REROLL', 'K_SET', 'K_BREAK', 'K_GRANARY', 'K_ENDGAME'];
const FAUCET_CODES = ['F_DAILY', 'F_MOB_COIN', 'F_NPC_BUYBACK', 'F_OFFLINE', 'F_STORY', 'F_SALARY', 'F_SEAT', 'F_FIEF', 'F_MAT_FLOOR', 'F_OFFICIAL'];
const UPG_CODES = ['K_ENH', 'K_TROOP', 'K_HORSE', 'K_GEM', 'K_REROLL', 'K_SET', 'K_BREAK', 'K_GRANARY'];
const SINK_GROUP = { K_CONS: 'cons', K_CITY_TAX: 'cons', K_TRAVEL: 'travel', K_SERVICE: 'travel', K_ALLY_DONATE: 'ally', K_TRADE_TAX: 'trade',
  K_BOARD_FEE: 'board', K_NOBLE: 'nobility', K_ENH: 'upg', K_TROOP: 'upg', K_HORSE: 'upg', K_GEM: 'upg', K_REROLL: 'upg', K_SET: 'upg',
  K_BREAK: 'upg', K_GRANARY: 'upg', K_ENDGAME: 'endg' };
const bandOf = L => (L <= 20 ? 0 : L <= 40 ? 1 : L <= 60 ? 2 : 3);

// ------------------------------------------------------------------ simulation
function run(P, tag) {
  const D = P.meta.days;
  const DB = P.drops.band || buildDropBand(P.drops.stoneMode);
  const npcBuyOf = c => P.mats[c].npcBuy ?? P.mats[c].floor;           // NPC buy price (glut sales, F_MAT_FLOOR)
  const floorOf = c => P.mats[c].floor ?? P.mats[c].npcBuy / 0.9;      // trade 5.5 market floor = NPC buy ÷ (1 − 10%)
  const R2 = P.trade.model === 'r2';
  const projNeed = (a, c) => (P.trade.projNeed && P.trade.projNeed[a.persona] ? (P.trade.projNeed[a.persona][c] || 0) : 0) * a.mult;
  // r2: items with a known one-off need are kept until that need is met (seals for T2–T4, breakthrough stones for the next gear tiers, set pieces for 6 items)
  const remainingNeed = (a, c) => {
    if (!P.trade.keepOneOff) return 0;
    if (c === 'seal') return PROMO.reduce((s_, pr, i) => s_ + (a.troopTier < i + 1 ? pr.seals : 0), 0);
    if (c === 'iron') { let n = 0; for (const t of [50, 60, 70, 80]) if (!a.brkTiers.has(t) && a.L >= t - 10) n += gOf(t); return n; }
    if (c === 'set') { if (a.L < 30) return 0; const sl = a.L < 60 ? 40 : a.L < 80 ? 60 : 80; return Math.max(0, 6 - a.setPieces[sl]) * setPcs(sl); }
    return 0;
  };
  const sellShare = x => clamp((x - P.trade.sellX0) / (P.trade.sellX1 - P.trade.sellX0), 0, 1);      // share of surplus listed at price/anchor = x
  const bargainShare = x => clamp((P.trade.bargainBelow - x) / (P.trade.bargainBelow - P.trade.bargainX0), 0, 1); // share of stock-up room bought at x
  const setPcs = sl => (P.upgrade.setPiecesByTier && P.upgrade.setPiecesByTier[sl]) || P.upgrade.setPiecesPerItem;
  const calib = {}; for (const p of ['casual', 'hardcore', 'payer', 'whale']) { calib[p] = { n: 0 }; for (const c of CATS) calib[p][c] = 0; }
  let official = { active: false, items: [], budgetY: 0, spentTot: 0 };
  const LVB = [[1, 29], [30, 49], [50, 59], [60, 69], [70, 79], [80, 80]];
  const lvBand = {}; for (const c of CATS) lvBand[c] = LVB.map(() => ({ prod: 0, use: 0, unmet: 0 }));
  function lvAcc(c, L, k, q) { const i = LVB.findIndex(([lo, hi]) => L >= lo && L <= hi); if (i >= 0) lvBand[c][i][k] += q; }
  const bandKey = a => (a.persona === 'whale' ? 'hardcore' : a.persona);
  const dropVal = (a, key, L) => interp(DB[bandKey(a)][key], L);
  const dropValB = (a, key, L) => interp(DB[a.persona === 'whale' ? 'payer' : a.persona][key], L); // whale bound mats like payer (12h offline)

  // ---- agents
  const agents = [];
  let id = 0;
  const mix = P.meta.mix;
  for (const persona of ['casual', 'hardcore', 'payer']) {
    const n = mix[persona];
    for (let k = 0; k < n; k++) {
      const join = k % P.meta.joinDays;
      const mult = P.meta.mults[Math.floor(k / P.meta.joinDays) % P.meta.mults.length];
      agents.push(newAgent(id++, persona, join, mult));
    }
  }
  // whales replace the last payer(s) (1 whale per 1,000 players, cash 8.2)
  const payers = agents.filter(a => a.persona === 'payer');
  for (let w = 0; w < P.meta.whales && w < payers.length; w++) { const a = payers[payers.length - 1 - w]; a.persona = 'whale'; a.join = 0; a.mult = 1.0; }
  // reference agents (mult 1.0, join day 1) for persona tables
  const refs = {};
  for (const p of ['casual', 'hardcore', 'payer', 'whale']) refs[p] = agents.find(a => a.persona === p && a.join === 0 && a.mult === 1.0);

  function newAgent(id, persona, join, mult) {
    const inv = {}; for (const c of CATS) inv[c] = { t: 0, b: 0 };
    const ema = {}; for (const c of CATS) ema[c] = 0;
    return { id, persona, join, mult, cum: 0, L: 1, merit: 0, reached30: false, prevHu: 0, tier: 0, hu: 0, seatHu: 0, king: false,
      bal: 0, inv, ema, weekBoard: [], goldPaid: 0, goldListed: 0, goldBoundBoard: 0, goldBoundFree: 0, goldSold: 0, goldTopped: 0,
      charmCredit: 0, nob: new Set(), troopLv: 1, troopTier: 0, refine: 0, stars: 0, marks: 0, localMarks: 0, marksWeek: 0,
      enh: new Array(10).fill(0), gearLv: 1, pendingGear: 0, gems: new Array(9).fill(0), rerolls: 0, setPieces: { 40: 0, 60: 0, 80: 0 },
      brkTiers: new Set(), manes: 0, legend: false, legendDay: null, buckets: { enh: 0, troop: 0, horse: 0, set: 0, gem: 0, reroll: 0, brk: 0, endg: 0 },
      cosBought: {}, pendingMktIncome: 0, endgame: false, ms: {}, rows: [], seasonPassDay: null, cardEqDay: null, sealStory: false };
  }
  for (const a of agents) a.gems[0] = P.upgrade.sockets;

  // ---- market state
  const price = {}; for (const c of CATS) price[c] = P.mats[c].ref;
  const priceHist = {}; for (const c of CATS) priceHist[c] = [];
  const tight = {}; for (const c of CATS) tight[c] = 0;
  const clearX = {}; for (const c of CATS) clearX[c] = 1; let tpNow = null; const tp = c => (R2 && tpNow ? tpNow[c] : price[c]);   // r2: share of market bids left unfilled (EMA) — holders release stock when buyers go unfilled
  const anchorOf = c => { const h = priceHist[c].slice(-P.trade.anchorDays); return h.length >= 7 ? sum(h) / h.length : P.mats[c].ref; };
  let pool = null;
  let boardP = P.cash.openPrice;
  const plunderUnit = L => interp(DB.casual.plunderRef, L) / P.mats.plunder.ref; // plunder counted in "Lv 80 item" units
  const days = [];
  let prevIndexBasket = null; const basketW = {}; let baseLive = null;

  for (let d = 1; d <= D; d++) {
    const act = agents.filter(a => d > a.join);
    const day = { d, dau: act.length, F: {}, K: {}, T: { market: 0, board: 0, direct: 0 }, mat: {}, board: {}, prices: {} };
    for (const c of FAUCET_CODES) day.F[c] = 0; for (const c of SINK_CODES) day.K[c] = 0;
    for (const c of CATS) day.mat[c] = { prodT: 0, prodB: 0, used: 0, listed: 0, sold: 0, npcBought: 0, dumped: 0, wanted: 0, unmet: 0 };

    // ============ 1. faucets, levels, essentials, donation
    for (const a of act) {
      const pd = d - a.join; a.pd = pd;
      const hrs = P.spine.hours[a.persona];
      const [q, m, au] = pd === 1 ? hrs.d1 : hrs.dn;
      const off = hrs.off;
      const pot = P.spine.potion[a.persona] ? 0.5 * (m + au * P.spine.auto) : 0;
      const expEq = (P.spine.dqX + m + au * P.spine.auto + off * P.spine.off + pot) * a.mult;
      const L0 = a.L;
      // integrate S(L) along the EXP path (exact piecewise)
      let c = a.cum, L = a.L, rem = expEq, farmS = 0, story = 0;
      while (rem > 1e-12) {
        if (L >= P.spine.cap) { farmS += S(L) * rem; c += rem; rem = 0; break; }
        const toNext = CUM[L + 1] - c;
        if (rem < toNext) { farmS += S(L) * rem; c += rem; rem = 0; }
        else { farmS += S(L) * toNext; c += toNext; rem -= toNext; L++;
          const se = P.spine.storyEarly; story += (se && L <= se.maxLv ? se.rate : P.spine.story) * S(L); }
      }
      a.cum = c; a.L = L;
      const Savg = farmS / expEq;
      const f = {};
      f.F_DAILY = P.spine.dqT * Savg * a.mult;
      const maBase = (m + au * P.spine.auto) * Savg * a.mult;       // spine manual + auto tael
      const ratio = pd === 1 ? 1 : dropVal(a, 'maRatio', L);          // drops module: boss time pays 0.8 × S + boss gear
      const ma = maBase * ratio;
      const vendorBase = 0.4 * maBase;
      const dismantle = P.drops.dismantleShare * P.drops.gearBuybackS * (m + au * P.spine.auto) * Savg * a.mult; // gear -> stones (upgrade 8)
      f.F_NPC_BUYBACK = vendorBase - dismantle;
      f.F_MOB_COIN = ma - vendorBase;                                  // coin 0.6 + boss purse net of forgone farm time
      f.F_OFFLINE = off * (P.spine.offTael ?? P.spine.off) * Savg * a.mult;   // offline tael rate (EXP rate stays P.spine.off)
      f.F_STORY = story;
      // merit, rank, salary (spine final_model)
      if (L >= 30) a.reached30 = true;
      if (a.reached30) a.merit += P.spine.meritWk[a.persona] * a.mult / 7;
      const merit = Math.min(L, 40) * 200 + a.merit;
      a.meritTot = merit;
      let tier = 0, hu = 0; for (const [t, mr, lv, h_] of P.spine.ranks) if (merit >= mr && L >= lv) { tier = t; hu = h_; }
      const salaryHu = pd >= 2 ? Math.max(a.prevHu, a.seatHu) : 0;
      f.F_SALARY = (pd >= 2 ? a.prevHu : 0) * P.spine.salaryPerHu;
      f.F_SEAT = pd >= 2 ? Math.max(0, salaryHu - a.prevHu) * P.spine.salaryPerHu : 0;
      f.F_FIEF = a.king ? P.spine.kingFief : 0;
      a.prevHu = hu; a.tier = tier; a.hu = hu;
      a.gross = sum(Object.values(f));
      a.fToday = f;
      a.bal += a.gross;
      for (const k of Object.keys(f)) day.F[k] += f[k];
      a.offlineToday = f.F_OFFLINE;
      if (a.rows) a.today = { d, pd, L, L0, merit, tier, f: Object.assign({}, f), k: {}, tin: 0, tout: 0, boardIn: 0, mktIn: 0, mktOut: 0, boardOut: 0 };

      // materials production (drops sim.persona_band, normal day at persona hours; scaled by speed; day 1 scaled by hours)
      const maH = m + au * P.spine.auto; const normMA = hrs.dn[1] + hrs.dn[2] * P.spine.auto;
      const tScale = a.mult * (pd === 1 ? Math.max(1, maH / Math.max(0.01, normMA)) : 1);
      const bScale = a.mult;
      const add = (cat, t, b) => { const mm = P.drops.matMult[cat] * (cat === 'stone' && L < P.drops.stoneLowLv ? P.drops.stoneLowMult : 1)
          * (P.drops.matBandMult && P.drops.matBandMult[cat] ? interp(P.drops.matBandMult[cat], L) : 1);
        t *= mm; b *= mm * P.drops.boundMult;
        a.inv[cat].t += t; a.inv[cat].b += b; day.mat[cat].prodT += t; day.mat[cat].prodB += b; lvAcc(cat, L, 'prod', t + b); };
      add('stone', dropVal(a, 'stoneT_perS', L) * S(L) / 100 * tScale + dismantle / 100, dropValB(a, 'stoneB_perS', L) * S(L) / 100 * bScale);
      add('grass', dropVal(a, 'grassT', L) * tScale, dropValB(a, 'grassB', L) * bScale);
      add('reroll', L >= 25 ? dropVal(a, 'rerollT', L) * tScale : 0, L >= 25 ? dropValB(a, 'rerollB', L) * bScale : 0);
      add('insig', L >= 25 ? dropVal(a, 'insigT', L) * tScale : 0, L >= 25 ? dropValB(a, 'insigB', L) * bScale : 0);
      add('seal', L >= 30 ? dropVal(a, 'sealT', L) * tScale : 0, L >= 30 ? dropValB(a, 'sealB', L) * bScale : 0);
      if (!a.sealStory && L >= P.drops.storySealLv) { a.inv.seal.b += P.drops.storySeals; a.sealStory = true; lvAcc('seal', L, 'prod', P.drops.storySeals); }
      add('gem', L >= 35 ? dropVal(a, 'gemT', L) * tScale : 0, L >= 35 ? dropValB(a, 'gemB', L) * bScale : 0);
      add('set', L >= 40 ? dropVal(a, 'setT', L) * bScale : 0, 0);
      add('iron', L >= 25 ? dropVal(a, 'ironT', L) * bScale : 0, 0);
      add('plunder', dropVal(a, 'plunderT', L) * tScale * plunderUnit(L), dropValB(a, 'plunderB', L) * bScale * plunderUnit(L));
      if (L >= P.drops.maneLv) a.manes += P.drops.manesPerDay[a.persona] * a.mult;
      if (L >= 30) a.localMarks += 1;
      if (pd % 7 === 1) a.marksWeek = 0;

      // essentials (npc 12.9)
      const pu = P.npc.use[{ casual: 'ฟรีเล่นน้อย', hardcore: 'ฟรีขยัน', payer: 'ผู้เติมเงิน', whale: 'ฟรีขยัน' }[a.persona]];
      const F_h = q + m + au;
      const n = Math.ceil(L / 20), kk = Math.ceil(L / 10);
      const small = 20 * F_h * 5 * n;
      const large = (L >= 20 ? pu.large_per_day : 0) * 25 * n;
      const cleanse = (L >= 40 ? pu.cleanse_per_day : 0) * 10 * n;
      const food = pu.food_per_day * (50 * kk + 10);
      const jerky = pu.jerky_per_day * 10;
      const packs = L <= 20 ? 0 : L <= 40 ? pu.troop_extra_packs['21-40'] : L <= 60 ? pu.troop_extra_packs['41-60'] : pu.troop_extra_packs['61+'];
      const troop = packs * 50;
      const goods = small + large + cleanse + food + jerky + troop;
      const pedPart = pu.peddler_share * (small + large + food);
      const cons = goods + 0.2 * pedPart;
      const cityTax = P.npc.use.war_city_share_of_town_goods * P.npc.use.avg_city_tax * (goods - pedPart);
      const S_ = S(L);
      const tr = pu.trips_per_day;
      const travel = L >= 20 ? 0.04 * S_ * (tr['0_gate'] * 1 + tr['1_gate'] * 2 + tr['2_gate'] * 3) : 0;
      let service = pu.revive_per_day * 0.1 * S_ + (L >= 10 ? pu.warehouse_ops * 30 : 0) + (L >= 20 ? pu.mail_per_day * 0.04 * S_ : 0)
        + (L >= 30 ? 2 * S_ / pu.paid_respec_every_days : 0) + P.npc.use.rename_share_90d * 10 * S_ / 90 + P.npc.use.kingdom_move_share_90d * 20 * S_ / 90;
      let oneTime = 0;
      if (pu.bag_buys[String(pd)]) oneTime += 20000 * pu.bag_buys[String(pd)];
      if (pu.wh_buys[String(pd)]) oneTime += 10000 * pu.wh_buys[String(pd)];
      spend(a, day, 'K_CONS', cons); spend(a, day, 'K_CITY_TAX', cityTax); spend(a, day, 'K_TRAVEL', travel); spend(a, day, 'K_SERVICE', service + oneTime);
      a.basket = 40 * 5 * n + 2 * (50 * kk + 10) + 2 * 0.04 * S_;
      // alliance donation (spine #31: 1 × S per donation, ≤ 4 per week, EXP + alliance points only)
      if (L >= P.alliance.minLv) {
        const per = Math.min(P.alliance.perWeek[a.persona], P.alliance.capPerWeek) * P.alliance.costS * S_ / 7;
        spend(a, day, 'K_ALLY_DONATE', Math.min(per, Math.max(0, a.bal)));
      }
      // bound gold (free) and gold top-ups
      a.goldBoundFree += P.cash.freeBound30[a.persona] / 30;
      if (a.persona === 'payer' || a.persona === 'whale') {
        const g = P.cash.topupGold30[a.persona] / 30; a.goldTopped += g; a.goldPaidPending = (a.goldPaidPending || []); a.goldPaidPending.push([d + P.cash.holdDays, g]);
      }
      // charm credits: payers buy 30/week from the gold shop; free players convert 30% of free bound gold (6 gold each), ≤ 30/week
      const wk = P.upgrade.goldCharmsPerWeek[a.persona] / 7;
      const freeC = P.upgrade.freeBoundCharmShare * P.cash.freeBound30[a.persona] / 30 / P.upgrade.charmGold;
      a.charmRate = Math.min(30 / 7, wk + (a.persona === 'casual' || a.persona === 'hardcore' ? freeC : 0));
      if (Math.max(...a.enh) >= 12) a.charmCredit += a.charmRate;
    }
    // seats (from day 8, merit ranking, previous day's standings) — assigned at end of day

    // ============ 2. exchange board (cash 6, 17.5)
    if (P.cash.openAuto && d === P.cash.openDay) boardP = Math.round(P.cash.openPrice * payerFactor(act));
    const guide = boardGuide(d, act);                                  // spine 8.2 line as written
    const guide7 = guide ? guide * payerFactor(act) : null;           // round-1 S7 / cash C3 line (× 0.05 ÷ payer share)
    let Dt = 0, G = 0;
    const buyers = [], sellers = [];
    if (d >= P.cash.openDay) {
      for (const a of act) {
        const share = P.spine.boardBuyShare[a.persona];
        if (share > 0 && a.L >= P.cash.boardMinLv && a.pd >= P.cash.boardMinAge) { const w = share * a.gross; Dt += w; buyers.push([a, w]); }
        if ((a.persona === 'payer' || a.persona === 'whale') && a.pd >= 4) {
          // release paid gold past the hold
          a.goldPaidPending = (a.goldPaidPending || []).filter(([rd, g]) => { if (rd <= d) { a.goldPaid += g; return false; } return true; });
          const capD = P.cash.capDayS * S(a.L), capW = P.cash.capWeekS * S(a.L) - sum(a.weekBoard.slice(-6));
          const taelCap = Math.max(0, Math.min(capD, capW));
          // payer lists 150/day (spine 4.1: 4,500 of 10,040 monthly gold); whale lists up to its tael caps; trust tier 2 ≤ 5,000 gold/day
          let gOffer = Math.min(P.cash.sellPerDay[a.persona], taelCap / (boardP * (1 - P.cash.fee)), 5000);
          gOffer = Math.max(0, Math.min(gOffer, a.goldPaid));
          if (gOffer > 0) { G += gOffer; sellers.push([a, gOffer]); }
        }
      }
    }
    let fillB = 1, fillS = 1;
    if (G > 0 && Dt > 0) { if (G * boardP > Dt) { fillS = Dt / (G * boardP); fillB = 1; } else { fillB = G * boardP / Dt; fillS = 1; } }
    else { fillB = G > 0 ? 1 : 0; fillS = Dt > 0 ? 1 : 0; }
    let matchedTael = 0, goldSold = 0;
    for (const [a, w] of buyers) {
      const paid = w * fillB; if (paid <= 0) continue;
      const pay = Math.min(paid, Math.max(0, a.bal)); a.bal -= pay; matchedTael += pay;
      a.goldBoundBoard += pay / boardP * (1 - P.cash.fee);
      if (a.today) { a.today.boardOut += pay; }
    }
    // tael actually delivered to sellers limited by buyers' payments
    const sellTael = matchedTael; const sellGoldTot = sum(sellers.map(s => s[1])) * fillS;
    for (const [a, g] of sellers) {
      const gs = g * fillS; if (gs <= 0) continue;
      const shareOfGold = gs / Math.max(1e-9, sellGoldTot);
      const tael = sellTael * shareOfGold * (1 - P.cash.fee);
      a.goldPaid -= gs; a.goldSold += gs; goldSold += gs;
      a.bal += tael; a.boardInToday = tael; a.weekBoard.push(tael);
      if (a.today) a.today.boardIn += tael;
    }
    for (const a of act) { if (a.boardInToday === undefined) a.weekBoard.push(0); }
    day.K.K_BOARD_FEE += matchedTael * P.cash.fee;
    day.T.board = matchedTael;
    const peq = G > 0 ? Dt / G : null;
    day.board = { P: boardP, guide, N: guide ? boardP / guide : null, guide7, N7: guide7 ? boardP / guide7 : null, D: Dt, G, fillB, fillS, matchedTael, goldSold, peq };
    if (d >= P.cash.openDay && G > 0 && Dt > 0) boardP = clamp(Dt / G, boardP * (1 - P.cash.move), boardP * (1 + P.cash.move));

    // ============ 3. material listings
    pool = {}; for (const c of CATS) pool[c] = { qty: 0, sellers: [], taken: 0, buyers: new Set() };
    const anchor = {}; for (const c of CATS) anchor[c] = anchorOf(c);
    const sched = {}; for (const c of CATS) sched[c] = { S0: 0, H: 0 };
    const pe = {}; for (const c of CATS) pe[c] = R2 ? clamp(clamp(clearX[c] * anchor[c], (1 - P.trade.band) * price[c], (1 + P.trade.band) * price[c]), floorOf(c), P.mats[c].ceil) : price[c];
    tpNow = pe;   // r2 supply base (surplus before price response) and bargain capacity
    for (const a of act) {
      if (a.L < 20) continue; // trust tier 0 cannot sell (spine 7.4)
      for (const c of CATS) {
        let reserve = Math.max(P.trade.reserveDays * a.ema[c], remainingNeed(a, c));
        if (R2) { // forward-looking: keep holdDays of projected need; release the hold as the price rises above its anchor
          const pr = pe[c] / anchor[c]; const hf = clamp(1 - (pr - 1) / P.trade.holdRelease, 0, 1);
          reserve = Math.max(reserve, P.trade.holdDays * projNeed(a, c) * hf, remainingNeed(a, c));
        }
        const free = a.inv[c].t - Math.max(0, reserve - a.inv[c].b);
        const sx = R2 ? sellShare(pe[c] / anchor[c]) : 1;             // r2: sellers list less as the price falls below their anchor
        if (R2 && free > 0) sched[c].S0 += free * P.trade.listProp[a.persona];
        const lst = Math.max(0, free) * P.trade.listProp[a.persona] * sx;
        if (lst > 1e-6) { pool[c].qty += lst; pool[c].sellers.push([a, lst]); a.inv[c].t -= lst; day.mat[c].listed += lst; }
      }
    }
    price.plunder = clamp(price.plunder, floorOf('plunder'), P.mats.plunder.ceil);

    // ============ 4. spending: turn-in, upgrades (rotating order), nobility, endgame
    const N = act.length; const start = N ? (d * 7919) % N : 0;
    for (let i = 0; i < N; i++) {
      const a = act[(start + i) % N];
      a.usedToday = {}; for (const c of CATS) a.usedToday[c] = 0;
      // plunder turn-in (daily card "ส่งของให้ทางการ", 3 × 10 items, Lv 20+), rewarded inside daily quests
      if (a.L >= 20) acquire(a, day, 'plunder', 30 * plunderUnit(a.L), 1e12, 'K_GRANARY', true);
      spendUpgrades(a, day, d);
      // nobility (spine 10): buy tiers in order when gate met and free balance allows
      const freeBal = () => a.bal - bucketSum(a);
      a.nobDep = a.nobDep || {};
      for (const s of [9, 10, 11, 12]) {
        if (a.nob.has(s)) continue;
        const [lv, mr] = P.spine.nobReq[s];
        if (a.L >= lv && a.meritTot >= mr) { if (a.ms['gate' + s] === undefined) a.ms['gate' + s] = a.pd; }
        if (P.spine.nobInstall) {
          // installment deposits (proposal): from the level gate, pay toward the tier; destroyed on deposit, not refundable
          if (a.L < lv - P.spine.nobInstallLead) break;
          const dep = a.nobDep[s] || 0; const room = P.spine.nob[s] - dep;
          const x = Math.min(room, (P.spine.nobInstallShare ?? 1) * Math.max(0, freeBal() - P.spine.nobInstallBufferDays * a.gross));
          if (x > 0) { spend(a, day, 'K_NOBLE', x); a.nobDep[s] = dep + x; }
          const paid = (a.nobDep[s] || 0) >= P.spine.nob[s] - 1e-6;
          if (paid && a.L >= lv && a.meritTot >= mr) { a.nob.add(s); a.ms['nob' + s] = a.pd; continue; }
          if (paid) continue; // fully prepaid, waiting for the gate: may start prepaying the next tier
          break;
        }
        if (a.L >= lv && a.meritTot >= mr && freeBal() >= P.spine.nob[s]) { spend(a, day, 'K_NOBLE', P.spine.nob[s]); a.nob.add(s); a.ms['nob' + s] = a.pd; }
        else break;
      }
      a.endgame = a.L >= 80 && [9, 10, 11, 12].every(s => a.nob.has(s));
      if (a.endgame && a.ms.endgame === undefined) a.ms.endgame = a.pd;
      // proposal: prepay patch tier 13 (2,000,000, Lv 85) from Lv 75 once tier 12 is owned; granted when the patch opens
      if (P.spine.nobInstall && P.spine.prepayPatchTier && a.nob.has(12) && a.L >= 85 - P.spine.nobInstallLead) {
        const dep = a.nobDep[13] || 0; const x = Math.min(P.spine.patchTierCost - dep, (P.spine.nobInstallShare ?? 1) * Math.max(0, freeBal() - P.spine.patchBufferDays * a.gross));
        if (x > 0) { spend(a, day, 'K_NOBLE', x); a.nobDep[13] = dep + x; }
      }
    }

    // ============ 4b. (r2) bargain stock-up: hardcore / payers buy unsold listings below bargainBelow × anchor, up to holdDays of need
    if (R2) {
      const buyersB = act.filter(a => a.L >= 20 && P.trade.bargainPersonas.includes(a.persona));
      for (const c of CATS) for (const a of buyersB) sched[c].H += Math.max(0, P.trade.holdDays * projNeed(a, c) - (a.inv[c].t + a.inv[c].b)) * P.trade.bargainDailyShare;
      for (const c of CATS) {
        const pl = pool[c]; let left = pl.qty - pl.taken; if (left <= 1e-9) continue;
        if (!(pe[c] < P.trade.bargainBelow * anchor[c])) continue;
        const pBuy = pe[c] * (1 + (1 - P.trade.mktShare) * P.trade.directTax);
        for (const a of buyersB) {
          if (left <= 1e-9) break;
          const want = (P.trade.holdDays * projNeed(a, c) - (a.inv[c].t + a.inv[c].b)) * P.trade.bargainDailyShare * bargainShare(pe[c] / anchor[c]); if (want <= 1e-9) continue;
          const budget = P.trade.bargainBalShare * Math.max(0, a.bal - bucketSum(a) - a.gross);
          const q = Math.min(left, want, budget / pBuy); if (q <= 1e-9) continue;
          pl.avgPrice = ((pl.avgPrice || pe[c]) * pl.taken + pe[c] * q) / (pl.taken + q);
          pl.taken += q; left -= q; a.inv[c].t += q; pl.buyers.add(a.id);
          a.bal -= q * price[c]; spend(a, day, 'K_TRADE_TAX', q * price[c] * (1 - P.trade.mktShare) * P.trade.directTax);
          if (a.today) a.today.mktOut += q * price[c];
          day.mat[c].wanted += q; day.mat[c].bargain = (day.mat[c].bargain || 0) + q;
        }
      }
    }
    // ============ 4c. official buyback lever (trade 5.8): bid at price × ref for ≤ maxItems glutted items, budget = taxShare × yesterday's 9% tax
    if (P.trade.official.on && official.active) {
      let budget = official.budgetY + (P.trade.official.fixedBudget || 0);
      for (const c of official.items) {
        const pl = pool[c]; let left = pl.qty - pl.taken; if (left <= 1e-9 || budget <= 0) continue;
        const pB = P.trade.official.price * price[c]; const q = Math.min(left, budget / pB); if (q <= 0) continue;
        pl.avgPrice = ((pl.avgPrice || price[c]) * pl.taken + pB * q) / (pl.taken + q);
        pl.taken += q; budget -= q * pB; official.spentTot += q * pB;
        day.F.F_OFFICIAL += q * pB; day.mat[c].official = (day.mat[c].official || 0) + q; day.mat[c].wanted += q;
      }
    }

    // ============ 5. market settlement (sellers paid pro rata, unsold returned), price update
    let saleTax9 = 0;
    for (const c of CATS) {
      const pl = pool[c]; const frac = pl.qty > 0 ? pl.taken / pl.qty : 0;
      for (const [a, lst] of pl.sellers) {
        const sold = lst * frac; const back = lst - sold; a.inv[c].t += back;
        if (sold > 0) {
          const gross = sold * pl.avgPrice;
          const tax = gross * P.trade.mktShare * (P.trade.listFee * P.trade.relist + P.trade.saleTax);
          const net = gross * P.trade.mktShare + gross * (1 - P.trade.mktShare) - tax;
          a.pendingMktIncome += net; a.bal += net; day.K.K_TRADE_TAX += tax; saleTax9 += gross * P.trade.mktShare * P.trade.saleTax;
          if (a.today) a.today.mktIn += net;
        }
      }
      day.mat[c].sold = pl.taken;
      const nSell = pl.sellers.filter(([, lst]) => lst * frac > 1e-9).length, nBuy = pl.buyers.size + (day.mat[c].official ? 1 : 0);
      const traded = pl.taken >= P.trade.minTrades.qty && nSell >= P.trade.minTrades.sellers && nBuy >= P.trade.minTrades.buyers;
      day.mat[c].traded = traded;
      if (R2) tight[c] = 0.7 * tight[c] + 0.3 * clamp((day.mat[c].wanted - pl.taken) / Math.max(1e-9, day.mat[c].wanted), 0, 1);
      const dem = day.mat[c].wanted, sup = day.mat[c].listed;
      const ex = (dem - sup) / Math.max(dem, sup, 1e-9);
      if (R2) { // clearing price for tomorrow's transactions (computed every day, also when nothing traded)
        const D0 = Math.max(0, day.mat[c].wanted - (day.mat[c].bargain || 0) - (day.mat[c].official || 0)), S0 = sched[c].S0, H = sched[c].H;
        const g = x => S0 * sellShare(x) - D0 - H * bargainShare(x);
        let lo = 0.3, hi = 3.0; if (g(hi) < 0) lo = hi; else if (g(lo) > 0) hi = lo; else for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (g(mid) > 0) hi = mid; else lo = mid; }
        clearX[c] = D0 + S0 + H > 0 ? (lo + hi) / 2 : clearX[c];
      }
      if (R2 && (!P.trade.refOnlyOnTrades || traded)) {
        // r2 clearing: find x = p / anchor where supply S0 × s(x) meets need demand D0 + bargain demand H × b(x); move the reference toward it (≤ priceStep per day)
        const D0 = Math.max(0, day.mat[c].wanted - (day.mat[c].bargain || 0) - (day.mat[c].official || 0)), S0 = sched[c].S0, H = sched[c].H;
        const g = x => S0 * sellShare(x) - D0 - H * bargainShare(x);
        let lo = 0.3, hi = 3.0; if (g(hi) < 0) lo = hi; else if (g(lo) > 0) hi = lo; else for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (g(mid) > 0) hi = mid; else lo = mid; }
        const target = (lo + hi) / 2 * anchor[c]; day.mat[c].clear = target / P.mats[c].ref; day.mat[c].pe = pe[c] / P.mats[c].ref;
        price[c] = clamp(clamp(pe[c], price[c] * (1 - P.trade.priceStep), price[c] * (1 + P.trade.priceStep)), floorOf(c), P.mats[c].ceil);
      } else if ((dem > 0 || sup > 0) && (!R2 || !P.trade.refOnlyOnTrades || traded)) price[c] = clamp(price[c] * (1 + clamp(P.trade.priceK * ex, -P.trade.priceStep, P.trade.priceStep)), floorOf(c), P.mats[c].ceil);
      day.prices[c] = price[c]; priceHist[c].push(price[c]);
      day.T.market += pl.taken * (pl.avgPrice || price[c]);
    }
    // official buyback trigger for tomorrow (trade 5.8): basket index −10% in 7 days → items whose price fell ≥ 15% in 7 days and that did not sell out
    official.budgetY = P.trade.official.taxShare * saleTax9;
    if (P.trade.official.on) {
      const idxNow = basketIndexNow(d), idx7 = days.length >= 7 ? days[days.length - 7].idxLive : null;
      const trig = idxNow && idx7 ? idxNow / idx7 - 1 <= P.trade.official.trigger : false;
      if (trig && (d % 7 === 1 || !official.active)) {
        official.items = CATS.filter(c => c !== 'plunder' && priceHist[c].length >= 8 && price[c] / priceHist[c][priceHist[c].length - 8] - 1 <= P.trade.official.glutDrop && day.mat[c].listed > day.mat[c].sold)
          .sort((x, y) => (price[x] / priceHist[x][priceHist[x].length - 8]) - (price[y] / priceHist[y][priceHist[y].length - 8])).slice(0, P.trade.official.maxItems);
        official.active = official.items.length > 0; official.since = d;
      } else if (official.active && d - official.since >= 7 && !trig) official.active = false;
      day.official = { active: official.active, items: official.items.slice(), budget: official.budgetY };
    }
    day.idxLive = basketIndexNow(d);

    // ============ 6. NPC floor sales of glut (npc 3.9 cap 1 × S(L)/day) and EMA of use
    for (const a of act) {
      let cap = P.npc.matFloorCapS * S(a.L); let got = 0;
      const order = CATS.slice().sort((x, y) => npcBuyOf(y) - npcBuyOf(x));
      if (a.L >= 75) { const cb = calib[a.persona]; cb.n += a.mult; for (const c of CATS) cb[c] += a.usedToday[c]; }
      for (const c of order) {
        a.ema[c] = 0.8 * a.ema[c] + 0.2 * a.usedToday[c];
        const keep = R2 ? Math.max(P.trade.dumpDays * a.ema[c], P.trade.dumpNeedDays * projNeed(a, c), remainingNeed(a, c)) : Math.max(P.trade.dumpDays * a.ema[c], remainingNeed(a, c));
        const tot = a.inv[c].t + a.inv[c].b; const excess = tot - keep;
        if (excess <= 0 || a.L < 10) continue;
        let q = excess * P.trade.dumpProp; const unit = npcBuyOf(c); if (unit <= 0) continue;
        q = Math.min(q, (cap - got) / unit); if (q <= 0) continue;
        const fromB = Math.min(a.inv[c].b, q); a.inv[c].b -= fromB; a.inv[c].t -= (q - fromB);
        got += q * unit; day.mat[c].dumped += q;
      }
      if (got > 0) { a.bal += got; day.F.F_MAT_FLOOR += got; if (a.today) a.today.f.F_MAT_FLOOR = (a.today.f.F_MAT_FLOOR || 0) + got; }
    }

    // ============ 7. seats and kings for tomorrow (spine: 72 seats + 3 kings from day 8)
    for (const a of act) { a.seatHu = 0; a.king = false; }
    if (d + 1 >= P.spine.seatStartDay) {
      const ranked = act.slice().sort((x, y) => (y.meritTot - x.meritTot) || (x.id - y.id));
      let i = 0;
      for (let k = 0; k < P.spine.kingdoms && i < ranked.length; k++) ranked[i++].king = true;
      const seatList = []; for (const [s, n, hu] of P.spine.seats.slice().reverse()) for (let k = 0; k < n * P.spine.kingdoms; k++) seatList.push(hu);
      for (const hu of seatList) { if (i >= ranked.length) break; ranked[i++].seatHu = hu; }
    }

    // ============ 8. day aggregates
    for (const a of act) {
      a.boardInToday = undefined;
      if (a.today) { a.today.bal = a.bal; a.today.enhAvg = sum(a.enh) / 10; a.today.weapon = a.enh[0]; a.rows.push(a.today); a.today = null; }
      // milestones
      if (a.ms.lv80 === undefined && a.L >= 80) a.ms.lv80 = a.pd;
      if (a.ms.weapon10 === undefined && a.enh[0] >= 10) a.ms.weapon10 = a.pd;
      if (a.ms.weapon15 === undefined && a.enh[0] >= 15) a.ms.weapon15 = a.pd;
      if (a.ms.avg10 === undefined && sum(a.enh) / 10 >= 10) a.ms.avg10 = a.pd;
      if (a.ms.t4 === undefined && a.troopTier >= 4) a.ms.t4 = a.pd;
      if (a.ms.card === undefined && a.goldBoundBoard >= 1490) a.ms.card = a.pd;
      if (a.ms.pass === undefined && a.goldBoundBoard + a.goldBoundFree * (1 - P.upgrade.freeBoundCharmShare) >= 2990) a.ms.pass = a.pd;
      for (const [t] of P.spine.ranks) if (a.tier >= t && a.ms['rank' + t] === undefined) a.ms['rank' + t] = a.pd;
    }
    const Ftot = sum(Object.values(day.F)), Ktot = sum(Object.values(day.K));
    day.Ftot = Ftot; day.Ktot = Ktot;
    day.M = sum(act.map(a => a.bal));
    day.Lmed = median(act.map(a => a.L));
    const wealth = act.filter(a => a.L >= 20).map(a => a.bal + CATS.reduce((s, c) => s + a.inv[c].t * price[c], 0));
    day.gini = gini(wealth);
    const ws = wealth.slice().sort((x, y) => y - x); const top = Math.max(1, Math.round(ws.length * 0.01));
    day.top1 = sum(ws.slice(0, top)) / Math.max(1, sum(ws));
    const freeLv40 = act.filter(a => (a.persona === 'casual' || a.persona === 'hardcore') && a.L >= 40);
    day.poverty = freeLv40.length ? freeLv40.filter(a => a.bal < a.basket).length / freeLv40.length : 0;
    day.basicsPct = freeLv40.length ? median(freeLv40.map(a => a.basket)) / Math.max(1, median(freeLv40.map(a => a.gross))) : null;
    day.offlineShare = day.F.F_OFFLINE / Ftot;
    day.upgShare = sum(UPG_CODES.map(c => day.K[c])) / Ktot;
    day.priceIdx = null;
    // basket index (spine KPI 8): weights = traded value in week 2
    if (d >= 8 && d <= 14) for (const c of CATS) basketW[c] = (basketW[c] || 0) + day.mat[c].sold * price[c];
    days.push(day);
    if (d === 14) { baseLive = {}; for (const c of CATS) baseLive[c] = sum(days.slice(7, 14).map(x => x.prices[c])) / 7; }
  }
  function basketIndexNow(dd) {
    if (!baseLive) return null; const ws = sum(CATS.map(c => basketW[c] || 0)) || 1;
    return CATS.reduce((s, c) => s + (basketW[c] || 0) / ws * price[c] / baseLive[c], 0);
  }
  // price index relative to week-2 average prices
  const wsum = sum(Object.values(basketW)) || 1;
  const baseP = {}; for (const c of CATS) baseP[c] = sum(days.slice(7, 14).map(x => x.prices[c])) / 7;
  for (const day of days) day.priceIdx = day.d >= 8 ? CATS.reduce((s, c) => s + (basketW[c] || 0) / wsum * day.prices[c] / baseP[c], 0) : null;
  // proposal index (round 2, S9): basket without one-off-need items, weights = traded value in base window, base = average price in base window
  { const K = P.kpi.idxAlt; const bw = {}; const cats = CATS.filter(c => !K.exclude.includes(c));
    if (K.weights) for (const c of cats) bw[c] = K.weights[c] || 0;
    else for (let d = K.baseFrom; d <= K.baseTo; d++) for (const c of cats) bw[c] = (bw[c] || 0) + days[d - 1].mat[c].sold * days[d - 1].prices[c];
    const ws2 = sum(Object.values(bw)) || 1; const bp = {}; for (const c of cats) bp[c] = sum(days.slice(K.baseFrom - 1, K.baseTo).map(x => x.prices[c])) / (K.baseTo - K.baseFrom + 1);
    for (const day of days) day.priceIdxAlt = day.d >= K.baseFrom ? cats.reduce((s_, c) => s_ + (bw[c] || 0) / ws2 * day.prices[c] / bp[c], 0) : null;
    days.idxAltW = Object.fromEntries(cats.map(c => [c, (bw[c] || 0) / ws2])); }

  // ------------------------------------------------ helpers bound to this run
  function spend(a, day, code, amt) {
    if (!(amt > 0)) return 0;
    a.bal -= amt; day.K[code] += amt; if (a.today) a.today.k[code] = (a.today.k[code] || 0) + amt; return amt;
  }
  function bucketSum(a) { return sum(Object.values(a.buckets)); }
  // acquire qty units of material c: own bound -> own tradable -> market pool -> NPC (if sold). Returns tael cost or null if impossible.
  // returns { cost } when possible, { blocked: true } when no supply exists at all, { cost, short: true } when unaffordable
  function acquire(a, day, c, qty, maxTael, npcCode, commit) {
    let need = qty; const own = a.inv[c];
    const fromB = Math.min(own.b, need); need -= fromB; const fromT = Math.min(own.t, need); need -= fromT;
    const pl = pool[c]; const avail = Math.max(0, pl.qty - pl.taken); const fromM = Math.min(avail, need); need -= fromM;
    const pT = tp(c); const pBuy = pT * (1 + (1 - P.trade.mktShare) * P.trade.directTax);
    const npcP = P.mats[c].npcSell ? P.mats[c].ceil : null;
    if (need > 1e-9 && npcP === null) { day.mat[c].wanted += qty - fromB - fromT; day.mat[c].unmet += need; if (commit !== false || true) lvAcc(c, a.L, 'unmet', need); return { blocked: true }; }
    const cost = fromM * pBuy + need * (npcP || 0);
    if (cost > maxTael + 1e-6) return { cost, short: true };
    if (!commit) return { cost };
    own.b -= fromB; own.t -= fromT;
    if (fromM > 0) {
      pl.avgPrice = pl.taken + fromM > 0 ? ((pl.avgPrice || pT) * pl.taken + pT * fromM) / (pl.taken + fromM) : pT;
      pl.taken += fromM; pl.buyers.add(a.id); const directTax = fromM * pT * (1 - P.trade.mktShare) * P.trade.directTax;
      a.bal -= fromM * pT; spend(a, day, 'K_TRADE_TAX', directTax); if (a.today) a.today.mktOut += fromM * pT;
    }
    if (need > 0) { spend(a, day, npcCode, need * npcP); day.mat[c].npcBought += need; }
    day.mat[c].wanted += qty - fromB - fromT; day.mat[c].used += qty; a.usedToday[c] += qty; lvAcc(c, a.L, 'use', qty);
    return { cost };
  }
  // buy a composite step: tael fees by code + materials; payment from bucket(s).
  // Returns true if bought, 'blocked' if a material has no source at all, false if not affordable yet (a._need = tael needed).
  function buyStep(a, day, bucketNames, fees, mats) {
    const feeTot = sum(Object.values(fees));
    const avail = Math.min(sum(bucketNames.map(b => a.buckets[b])), Math.max(0, a.bal));
    let matCost = 0;
    for (const [c, q] of Object.entries(mats)) {
      if (q <= 0) continue; const r = acquire(a, day, c, q, 1e15, 'K_GRANARY', false);
      if (r.blocked) return 'blocked'; matCost += r.cost;
    }
    a._need = feeTot + matCost;
    if (feeTot + matCost > avail + 1e-6) return false;
    const balBefore = a.bal;
    for (const [c, q] of Object.entries(mats)) if (q > 0) acquire(a, day, c, q, 1e15, 'K_GRANARY', true);
    for (const [code, v] of Object.entries(fees)) spend(a, day, code, v);
    let paid = balBefore - a.bal;
    for (const b of bucketNames) { const t = Math.min(a.buckets[b], paid); a.buckets[b] -= t; paid -= t; }
    return true;
  }
  function enhStepCost(a, t, Li) {
    const r = ENH[t]; const g = gOf(Li); const S_ = S(Li);
    const E = r.p >= 1 ? 1 : (1 - Math.pow(1 - r.p, 11)) / r.p;
    const fee = E * r.f * S_;
    let stones = 0, fusion = 0;
    if (r.gr === 'low') stones = E * r.s * g;
    else if (r.gr === 'mid') { const mids = E * r.s * g; stones = mids * 5; fusion = P.upgrade.fusedShare * mids * 100; }
    else { const highs = E * r.s * (Li > 90 ? 4 / 3 : 1); stones = highs * 25; fusion = P.upgrade.fusedShare * highs * 1100; }
    let charms = t >= 13 ? (E - 1) * r.q * g : 0;
    const fromCredit = Math.min(a.charmCredit, charms); const charmTael = (charms - fromCredit) * P.npc.charmNpcPrice;
    return { fees: { K_ENH: fee + fusion + charmTael }, mats: { stone: stones }, credit: fromCredit };
  }
  function spendUpgrades(a, day, d) {
    const L = a.L; const band = bandOf(L);
    const base = a.gross + (a.boardInToday || 0) + a.pendingMktIncome; a.pendingMktIncome = 0;
    a.nextCost = a.nextCost || {};
    const share = a.endgame ? P.spine.upgShareCap : P.spine.upgShare[band];
    const U = share * Math.max(0, base);
    for (const [k, v] of Object.entries(P.upgrade.split)) a.buckets[k] += U * v;
    if (P.meta.upgradeMode === 'greedy') {
      const reserve = nextNobReserve(a) + 2 * a.gross;
      a.buckets.enh += P.meta.greedyFrac * Math.max(0, a.bal - bucketSum(a) - reserve);
    }
    if (a.endgame) {
      a.buckets.endg += P.spine.endgShareCosmetic * base;
      if (P.npc.restorationDesigned) a.buckets.rest = (a.buckets.rest || 0) + P.spine.endgShareRestoration * base;
    }
    // --- gear swap every 10 levels (transfer = 0.3 × Σ f(1..k) × S(new item level))
    const LiNew = Math.max(10, Math.floor(L / 10) * 10);
    let transferCost = 0;
    if (LiNew > a.gearLv) {
      transferCost = a.enh.reduce((s, k) => { let fsum = 0; for (let t = 1; t <= Math.min(k, enhCap(LiNew)); t++) fsum += ENH[t].f; return s + P.upgrade.transferRate * fsum * S(LiNew); }, 0);
      if (transferCost <= 0) a.gearLv = LiNew;
      else if (buyStep(a, day, ['enh'], { K_ENH: transferCost }, {}) === true) { a.gearLv = LiNew; a.enh = a.enh.map(k => Math.min(k, enhCap(LiNew))); }
    }
    // --- troop promotion first, borrow from enh (upgrade 21.5)
    for (const pr of PROMO) {
      if (a.troopTier >= PROMO.indexOf(pr) + 1 || L < pr.lv) continue;
      const r = buyStep(a, day, ['troop', 'enh'], { K_TROOP: pr.cS * S(pr.sL) }, { seal: pr.seals });
      if (r === true) a.troopTier = PROMO.indexOf(pr) + 1; else break;
    }
    // --- troop catch-up if > 10 levels behind (borrow enh)
    while (a.troopLv < L - 10) { if (buyStep(a, day, ['troop', 'enh'], { K_TROOP: S(a.troopLv + 1) }, {}) !== true) break; a.troopLv++; }
    // --- legendary horse fee when manes complete
    if (!a.legend && a.manes >= P.drops.maneNeed) { if (buyStep(a, day, ['horse', 'enh'], { K_HORSE: P.drops.legendFeeS * S(L) }, {}) === true) { a.legend = true; a.ms.legend = a.pd; } }
    // --- per-system loops
    const sys = {
      troop: () => {
        if (a.troopLv < L) return buyStep(a, day, ['troop'], { K_TROOP: S(a.troopLv + 1) }, {}) === true ? (a.troopLv++, 'ok') : 'wait';
        const rmax = Math.min(10, Math.floor((L - 30) / 5));
        if (a.troopTier >= 2 && a.refine < rmax) { const r = a.refine + 1; const res = buyStep(a, day, ['troop'], { K_TROOP: 0.5 * r * r * S(L) }, { insig: 2 * r }); return res === true ? (a.refine++, 'ok') : res === 'blocked' ? 'none' : 'wait'; }
        return 'none';
      },
      horse: () => {
        const smax = Math.min(10, Math.floor(L / 8)); if (a.stars >= smax) return 'none';
        const s = a.stars + 1; const needMarks = s >= 6 ? 2 * (s - 5) : 0;
        let markBuy = Math.max(0, needMarks - a.marks);
        if (markBuy > 0) {
          const canBuy = Math.min(markBuy, P.upgrade.marksPerWeek - a.marksWeek, Math.floor(a.localMarks / P.upgrade.markLocal));
          if (canBuy < markBuy) return 'none';
          const r = buyStep(a, day, ['horse'], { K_HORSE: markBuy * P.upgrade.markTael }, {});
          if (r !== true) return 'wait';
          a.marks += markBuy; a.marksWeek += markBuy; a.localMarks -= markBuy * P.upgrade.markLocal;
        }
        const res = buyStep(a, day, ['horse'], { K_HORSE: 0.4 * s * S(L) }, { grass: 30 * s });
        if (res === true) { a.stars++; a.marks -= needMarks; return 'ok'; } return res === 'blocked' ? 'none' : 'wait';
      },
      gem: () => {
        if (L < 40) return 'none';
        const capT = 2 + Math.floor(L / 20); const G_ = a.gems;
        if (G_[0] > 0) { const res = buyStep(a, day, ['gem'], { K_GEM: 0.02 * S(L) }, { gem: 1 }); if (res === true) { G_[0]--; G_[1]++; return 'ok'; } return res === 'blocked' ? 'none' : 'wait'; }
        let k = 1; while (k < capT && G_[k] === 0) k++;
        if (k >= capT) return 'none';
        const fee = P.upgrade.gemFusionTotal[k + 1] - P.upgrade.gemFusionTotal[k];
        const res = buyStep(a, day, ['gem'], { K_GEM: fee }, { gem: 2 * Math.pow(3, k - 1) });
        if (res === true) { G_[k]--; G_[k + 1]++; return 'ok'; } return res === 'blocked' ? 'none' : 'wait';
      },
      reroll: () => {
        if (L < 30) return 'none';
        const res = buyStep(a, day, ['reroll'], { K_REROLL: P.upgrade.rerollTaelS * S(a.gearLv) }, { reroll: P.upgrade.rerollStones });
        if (res === true) { a.rerolls++; return 'ok'; } return res === 'blocked' ? 'none' : 'wait';
      },
      set: () => {
        if (L < 40) return 'none'; const sl = L < 60 ? 40 : L < 80 ? 60 : 80; if (a.setPieces[sl] >= 6) return 'none';
        const res = buyStep(a, day, ['set'], { K_SET: 2 * S(sl) }, { set: setPcs(sl) });
        if (res === true) { a.setPieces[sl]++; return 'ok'; } return res === 'blocked' ? 'none' : 'wait';
      },
      brk: () => {
        if (L < 50 || a.gearLv < 50 || a.brkTiers.has(a.gearLv)) return 'none';
        const res = buyStep(a, day, ['brk'], { K_BREAK: 3 * S(a.gearLv) }, { iron: gOf(a.gearLv) });
        if (res === true) { a.brkTiers.add(a.gearLv); return 'ok'; } return res === 'blocked' ? 'none' : 'wait';
      },
    };
    const enhOnce = () => {
      if (a.gearLv < LiNew) { a._need = transferCost; return 'wait'; } // saving for the transfer
      const cap = enhCap(a.gearLv); const mn = Math.min(...a.enh);
      let slot = -1;
      if (a.enh[0] < cap && a.enh[0] <= mn + 1) slot = 0; // weapon leads the set by up to 2
      else { let best = 99; for (let i = 0; i < 10; i++) if (a.enh[i] < cap && a.enh[i] < best) { best = a.enh[i]; slot = i; } }
      if (slot < 0) return 'none';
      const t = a.enh[slot] + 1; const c = enhStepCost(a, t, a.gearLv);
      const res = buyStep(a, day, ['enh'], c.fees, c.mats);
      if (res === true) { a.enh[slot] = t; a.charmCredit -= c.credit; return 'ok'; }
      return res === 'blocked' ? 'none' : 'wait';
    };
    // run systems; systems with nothing to buy pass their bucket to enhancement
    for (const name of ['troop', 'horse', 'gem', 'reroll', 'set', 'brk']) {
      let st; let guard = 0; do { st = sys[name](); guard++; } while (st === 'ok' && guard < 200);
      if (st === 'none') { a.buckets.enh += a.buckets[name]; a.buckets[name] = 0; a.nextCost[name] = 0; }
      else if (st === 'wait') a.nextCost[name] = a._need;
    }
    let st, guard = 0; do { st = enhOnce(); guard++; } while (st === 'ok' && guard < 400);
    if (st === 'wait') a.nextCost.enh = a._need || 0;
    if (st === 'none') { // enhancement capped: overflow to troop/horse if they have steps, else savings
      for (const name of ['troop', 'horse']) { a.buckets[name] += a.buckets.enh; a.buckets.enh = 0; let s2, g2 = 0; do { s2 = sys[name](); g2++; } while (s2 === 'ok' && g2 < 200); if (s2 === 'wait') a.nextCost[name] = a._need; }
      a.buckets.enh = 0; a.nextCost.enh = 0;
    }
    // earmarks: keep at most max(carryDays of the day's allocation, cost of the next pending step) — upgrade 21.5
    // (anything above stays in the wallet as free savings)
    for (const k of Object.keys(P.upgrade.split)) a.buckets[k] = Math.min(a.buckets[k], Math.max(P.upgrade.carryDays * U * P.upgrade.split[k], a.nextCost[k] || 0));
    // endgame cosmetics (npc 3.6): 4 items per 30-day cycle
    if (a.endgame) {
      const cyc = Math.floor((d - 1) / P.npc.cosmetics.cycleDays); a.cosBought[cyc] = a.cosBought[cyc] || [];
      const items = P.npc.cosmetics.pricesS80.map(x => x * S(80)).map((p, i) => [i, p]).filter(([i]) => !a.cosBought[cyc].includes(i)).sort((x, y) => x[1] - y[1]);
      for (const [i, p] of items) { if (a.buckets.endg >= p && a.bal >= p) { spend(a, day, 'K_ENDGAME', p); a.buckets.endg -= p; a.cosBought[cyc].push(i); } else break; }
      if (P.npc.restorationDesigned) { // city restoration: contributions capped per week (in S(80) units)
        const capR = P.npc.restorationCapS80PerWeek * S(80) / 7; const x = Math.min(capR, a.buckets.rest || 0, Math.max(0, a.bal));
        spend(a, day, 'K_ENDGAME', x); a.buckets.rest -= x; a.buckets.rest = Math.min(a.buckets.rest, 3 * capR);
      }
      const nextP = items.length ? items[0][1] : P.npc.cosmetics.pricesS80[0] * S(80);
      a.buckets.endg = Math.min(a.buckets.endg, nextP);
    }
  }
  function payerFactor(act) { const n = act.filter(a => a.persona === 'payer' || a.persona === 'whale').length; return n ? P.cash.guideRefPayerShare / (n / act.length) : 1; }
  function nextNobReserve(a) { for (const s of [9, 10, 11, 12]) if (!a.nob.has(s)) { const [lv] = P.spine.nobReq[s]; return a.L + 10 >= lv ? P.spine.nob[s] : 0; } return 0; }
  function boardGuide(d, act) {
    if (d < P.cash.openDay) return null;
    let g;
    if (d <= 20) { const gp = Object.entries(P.cash.guidePath).map(([k, v]) => [Number(k), v]).sort((x, y) => x[0] - y[0]); g = interp(gp, d); }
    else g = S(median(act.map(a => a.L))) / P.cash.guideV;
    if (P.cash.guideSupplyAdj) g *= payerFactor(act);
    return g;
  }

  const res = summarise(P, tag, agents, refs, days, price);
  res.projNeedOut = {}; for (const p of Object.keys(calib)) { const cb = calib[p]; if (!cb.n) continue; res.projNeedOut[p] = {}; for (const c of CATS) res.projNeedOut[p][c] = cb[c] / cb.n; }
  res.officialSpent = official.spentTot; res.lvBand = { bands: LVB, data: lvBand };
  return res;
}

// ------------------------------------------------------------------ summaries, KPIs, tables
function roll(days, d, n, key) { const lo = Math.max(0, d - n); return sum(days.slice(lo, d).map(x => x[key])); }
function summarise(P, tag, agents, refs, days, price) {
  const D = days.length;
  for (const day of days) {
    const d = day.d;
    day.r1 = day.Ftot / day.Ktot;
    day.r7 = roll(days, d, 7, 'Ftot') / roll(days, d, 7, 'Ktot');
    day.r14 = roll(days, d, 14, 'Ftot') / roll(days, d, 14, 'Ktot');
    day.r30 = roll(days, d, 30, 'Ftot') / roll(days, d, 30, 'Ktot');
    day.f7avg = roll(days, d, 7, 'Ftot') / Math.min(7, d);
    day.daysIncome = day.M / day.f7avg;
    day.velocity = (day.T.market + day.T.board) / Math.max(1, day.M);
  }
  const cumF = sum(days.map(x => x.Ftot)), cumK = sum(days.map(x => x.Ktot));
  const after15 = days.slice(14);
  const kpi = [];
  const add = (id, name, value, target, ok, note) => kpi.push({ id, name, value, target, ok, note: note || '' });
  const rng = (arr) => [Math.min(...arr), Math.max(...arr)];
  const f2 = x => (x === null || x === undefined ? '—' : (Math.round(x * 100) / 100).toFixed(2));
  const r7e = rng(days.slice(0, 14).map(x => x.r7)); add('fs7_early', 'เข้า:ออก 7 วัน วันที่ 1–14', `${f2(r7e[0])}–${f2(r7e[1])}`, '≤ 1.60', r7e[1] <= 1.60);
  const r7l = rng(after15.map(x => x.r7));
  const streak = (arr, bad, n) => { let s = 0; for (const x of arr) { s = bad(x) ? s + 1 : 0; if (s >= n) return true; } return false; };
  add('fs7', 'เข้า:ออก 7 วัน ตั้งแต่วันที่ 15', `${f2(r7l[0])}–${f2(r7l[1])}`, '0.95–1.20 (เหลือง >1.30 หรือ <0.85 นาน 3 วัน)', r7l[0] >= 0.95 && r7l[1] <= 1.20,
    streak(after15.map(x => x.r7), x => x > 1.30 || x < 0.85, 3) ? 'เข้าเกณฑ์เหลือง' : '');
  const r30 = rng(days.slice(29).map(x => x.r30)); add('fs30', 'เข้า:ออก 30 วัน (วันที่ 30–90)', `${f2(r30[0])}–${f2(r30[1])}`, '1.00–1.18', r30[0] >= 1.00 && r30[1] <= 1.18);
  const di = Math.max(...days.map(x => x.daysIncome)); add('days_income', 'เงินในระบบ (วันของรายได้) สูงสุด', f2(di) + ` (วันที่ 90 = ${f2(days[D - 1].daysIncome)})`, '≤ 9', di <= 9);
  const Ns = days.filter(x => x.board.N !== null).map(x => x.board.N);
  const N21 = days.filter(x => x.d >= 21).map(x => x.board.N);
  add('board_N', 'ราคากระดาน ÷ เส้นคาด', `${f2(Math.min(...Ns))}–${f2(Math.max(...Ns))} (หลังวันที่ 21: ${f2(Math.min(...N21))}–${f2(Math.max(...N21))})`, '0.85–1.20', Math.min(...Ns) >= 0.85 && Math.max(...Ns) <= 1.20);
  const fb = days.filter(x => x.d > 14).map(x => x.board.fillB); add('board_fill', 'สภาพคล่องกระดานหลังวันที่ 14 (คำสั่งซื้อได้ของ)', `${Math.round(Math.min(...fb) * 100)}%`, '≥ 60%', Math.min(...fb) >= 0.6);
  const pays = agents.filter(a => a.persona === 'payer' || a.persona === 'whale');
  const soldTop = sum(pays.map(a => a.goldSold)) / Math.max(1, sum(pays.map(a => a.goldTopped)));
  add('paid_gold_sold', 'ทองที่ขาย ÷ ทองที่เติม (90 วัน)', `${Math.round(soldTop * 100)}%`, '20–50%', soldTop >= 0.2 && soldTop <= 0.5);
  const wk = []; for (let d = 21; d <= D; d++) { const a = days[d - 1].priceIdx, b = days[d - 8].priceIdx; if (a && b) wk.push(a / b - 1); }
  const wkAll = []; for (let d = 15; d <= D; d++) { const a = days[d - 1].priceIdx, b = days[d - 8].priceIdx; if (a && b) wkAll.push(a / b - 1); }
  add('price_index', 'ดัชนีราคาตะกร้า เปลี่ยนต่อสัปดาห์ (วันที่ 15–90)', `${(Math.min(...wkAll) * 100).toFixed(1)}% ถึง +${(Math.max(...wkAll) * 100).toFixed(1)}% · ระดับวันที่ 90 = ${f2(days[D - 1].priceIdx)} ของฐาน`, '±5% ต่อสัปดาห์', Math.max(...wkAll.map(Math.abs)) <= 0.05);
  // informational variants (do not count as pass/fail)
  const info = (id, name, value, target, ok) => kpi.push({ id, name, value, target, ok, info: true, note: '' });
  // round-1 proposals (S7 line for KPI 5 · S8 target for KPI 11): shown as 'prop' — pass/fail counted in the "with proposals" set
  const prop = (id, name, value, target, ok) => kpi.push({ id, name, value, target, ok, prop: true, note: '' });
  { const e = days.filter(x => x.board.N7 !== null && x.d <= 20).map(x => x.board.N7), l = days.filter(x => x.d >= 21).map(x => x.board.N7);
    prop('board_N7', '(S7) ราคากระดาน ÷ เส้นคาดปรับตามสัดส่วนผู้เติมเงิน', `วันที่ 4–20: ${f2(Math.min(...e))}–${f2(Math.max(...e))} · หลังวันที่ 21: ${f2(Math.min(...l))}–${f2(Math.max(...l))}`, 'วันที่ 4–20: 0.80–1.25 · หลังวันที่ 21: 0.85–1.20',
      Math.min(...e) >= 0.80 && Math.max(...e) <= 1.25 && Math.min(...l) >= 0.85 && Math.max(...l) <= 1.20); }
  { const K = P.kpi.idxAlt; const w = []; for (let d = Math.max(K.from, K.baseFrom + 7); d <= D; d++) { const a = days[d - 1].priceIdxAlt, b = days[d - 8].priceIdxAlt; if (a && b) w.push(a / b - 1); }
    prop('price_index_S9', '(S9) ดัชนีราคาตะกร้าน้ำหนักคงที่ หิน 50 อัญมณี 30 ชิ้นส่วนชุด 10 หินสุ่มค่า 5 หนังฟอก 5 ฐานวันที่ ' + K.baseFrom + '–' + K.baseTo + ' วัดตั้งแต่วันที่ ' + K.from, w.length ? `${(Math.min(...w) * 100).toFixed(1)}% ถึง +${(Math.max(...w) * 100).toFixed(1)}%` : '—', '±' + Math.round(K.target * 100) + '% ต่อสัปดาห์', w.length ? Math.max(...w.map(Math.abs)) <= K.target : false); }
  { const v = days.slice(20).map(x => (x.T.market + x.T.board) / x.f7avg); prop('turnover_S10', '(S10) ปริมาณซื้อขาย (ตลาด + กระดาน) ÷ ก๊อกเฉลี่ย 7 วัน หลังวันที่ 21', `${(Math.min(...v) * 100).toFixed(1)}–${(Math.max(...v) * 100).toFixed(1)}%`, '2–8%', Math.min(...v) >= 0.02 && Math.max(...v) <= 0.08); }
  { const v = days.slice(20).map(x => x.velocity); prop('velocity_S8', '(S8) ความเร็วเงินหลังวันที่ 21', `${(Math.min(...v) * 100).toFixed(1)}–${(Math.max(...v) * 100).toFixed(1)}%`, '1.5–6%', Math.min(...v) >= 0.015 && Math.max(...v) <= 0.06); }
  { const m30 = []; for (let d = 44; d <= D; d++) { const a = days[d - 1].priceIdx, b = days[d - 31].priceIdx; if (a && b) m30.push(a / b - 1); }
    const y = wkAll.every(x => Math.abs(x) <= 0.10) && m30.every(x => Math.abs(x) <= 0.25);
    info('i_idx_yellow', '(ข้อมูลเสริม) ดัชนีราคา: เกณฑ์เหลือง ±10% ต่อสัปดาห์ และ ±25% ใน 30 วัน', `สัปดาห์ ${(Math.min(...wkAll) * 100).toFixed(1)}% ถึง +${(Math.max(...wkAll) * 100).toFixed(1)}% · 30 วัน ${(Math.min(...m30) * 100).toFixed(1)}% ถึง +${(Math.max(...m30) * 100).toFixed(1)}%`, 'ไม่เข้าเกณฑ์เหลือง', y); }
  const r7d4 = rng(days.slice(3, 14).map(x => x.r7)); info('i_fs7_d4', '(ข้อมูลเสริม) เข้า:ออก 7 วัน วันที่ 4–14', `${f2(r7d4[0])}–${f2(r7d4[1])}`, '≤ 1.60', r7d4[1] <= 1.60);
  info('i_board_d21', '(ข้อมูลเสริม) ราคากระดาน ÷ เส้นคาด หลังวันที่ 21', `${f2(Math.min(...N21))}–${f2(Math.max(...N21))}`, '0.85–1.20', Math.min(...N21) >= 0.85 && Math.max(...N21) <= 1.20);
  const wk36 = []; for (let d = 36; d <= D; d++) { const a = days[d - 1].priceIdx, b = days[d - 8].priceIdx; if (a && b) wk36.push(a / b - 1); }
  info('i_idx_d36', '(ข้อมูลเสริม) ดัชนีราคาเปลี่ยนต่อสัปดาห์ วันที่ 36–90', `${(Math.min(...wk36) * 100).toFixed(1)}% ถึง +${(Math.max(...wk36) * 100).toFixed(1)}%`, '±5% ต่อสัปดาห์', Math.max(...wk36.map(Math.abs)) <= 0.05);
  const gmax = Math.max(...days.slice(6).map(x => x.gini)); add('gini', 'Gini ความมั่งคั่ง (สูงสุดตั้งแต่วันที่ 7)', f2(gmax) + ` (วันที่ 90 = ${f2(days[D - 1].gini)})`, '≤ 0.60', gmax <= 0.60);
  const tmax = Math.max(...days.slice(6).map(x => x.top1)); add('top1', 'ส่วนแบ่งรวยสุด 1% (สูงสุด)', `${(tmax * 100).toFixed(1)}%`, '≤ 15%', tmax <= 0.15);
  const v21 = days.slice(20).map(x => x.velocity); add('velocity', 'ความเร็วเงินหลังวันที่ 21', `${(Math.min(...v21) * 100).toFixed(1)}–${(Math.max(...v21) * 100).toFixed(1)}%`, '5–20%', Math.min(...v21) >= 0.05 && Math.max(...v21) <= 0.20);
  const off = Math.max(...days.map(x => x.offlineShare)); add('offline_share', 'ส่วนแบ่งก๊อกออฟไลน์ (สูงสุด)', `${(off * 100).toFixed(1)}%`, '≤ 46%', off <= 0.46);
  const up7 = days.slice(6).map(x => { const lo = x.d - 7; const ds = days.slice(lo, x.d); return sum(ds.map(y => sum(UPG_CODES.map(c => y.K[c])))) / sum(ds.map(y => y.Ktot)); });
  const up = Math.min(...up7); add('upgrade_share', 'อัปเกรดในตัวดูดทั้งหมด (7 วัน ต่ำสุด ตั้งแต่วันที่ 7)', `${(up * 100).toFixed(1)}%–${(Math.max(...up7) * 100).toFixed(1)}%`, '≥ 35%', up >= 0.35);
  const bas = Math.max(...days.filter(x => x.basicsPct !== null).map(x => x.basicsPct)); add('basics', 'ค่าของจำเป็น ÷ รายได้มัธยฐานคนฟรี Lv 40+ (สูงสุด)', `${(bas * 100).toFixed(1)}%`, '≤ 5%', bas <= 0.05);
  const pov = Math.max(...days.slice(1).map(x => x.poverty)); add('poverty', 'กับดักความจน คนฟรี Lv 40+ (สูงสุด)', `${(pov * 100).toFixed(1)}%`, '≤ 5%', pov <= 0.05);
  // whale gap: whale daily tael incl. board ÷ median hardcore daily tael at day 60
  const w = refs.whale;
  const whaleInc = w ? avgRows(w, 55, 61) : null; const hcInc = refs.hardcore ? avgRows(refs.hardcore, 55, 61) : null;
  const pyInc = refs.payer ? avgRows(refs.payer, 55, 61) : null;
  add('whale_gap', 'ช่องว่างวาฬ (ตำลึงต่อวันรวมกระดาน ÷ ฟรีขยันอ้างอิง วันที่ 55–61)', whaleInc && hcInc ? `${f2(whaleInc / hcInc)} (ผู้เติมเงินทั่วไป ${f2(pyInc / hcInc)})` : '—', '≤ 1.6', whaleInc && hcInc ? whaleInc / hcInc <= 1.6 : true);
  // milestones
  const ms = {};
  for (const p of ['casual', 'hardcore', 'payer', 'whale']) {
    const a = refs[p]; if (!a) continue; const coh = agents.filter(x => x.persona === p);
    const pick = k => { const vals = coh.map(x => x.ms[k]).filter(v => v !== undefined); return { ref: a.ms[k], p10: pct(vals, 0.1), med: pct(vals, 0.5), p90: pct(vals, 0.9), reached: vals.length, n: coh.length }; };
    ms[p] = {};
    for (const k of ['lv80', 'weapon10', 'weapon15', 'avg10', 't4', 'gate9', 'gate10', 'gate11', 'gate12', 'nob9', 'nob10', 'nob11', 'nob12', 'endgame', 'legend', 'card', 'pass', 'rank7', 'rank8', 'rank9']) ms[p][k] = pick(k);
    ms[p].end = { enhAvg: sum(a.enh) / 10, weapon: a.enh[0], troopLv: a.troopLv, tier: a.troopTier, refine: a.refine, stars: a.stars, gems: a.gems.slice(), rerolls: a.rerolls, bal: a.bal, manes: a.manes, set: a.setPieces };
  }
  // persona band tables (reference agents)
  const bands = {};
  for (const p of ['casual', 'hardcore', 'payer', 'whale']) {
    const a = refs[p]; if (!a) continue; const B = {};
    for (const r of a.rows) {
      const key = r.pd === 1 ? 'วันที่ 1 (Lv 1→' + r.L + ')' : r.L < 61 ? 'Lv 41–60' : r.L < 80 ? 'Lv 61–79' : (a.ms.endgame !== undefined && r.pd >= a.ms.endgame ? 'Lv 80 หลังซื้อขั้น 12' : 'Lv 80 ก่อนซื้อขั้น 12');
      const b = B[key] = B[key] || { days: 0, from: r.pd, to: r.pd, fauc: 0, tin: 0, k: {}, tout: 0 };
      b.days++; b.to = r.pd; b.fauc += sum(Object.values(r.f)); b.tin += r.boardIn + r.mktIn; b.tout += r.boardOut + r.mktOut;
      for (const [c, v] of Object.entries(r.k)) b.k[c] = (b.k[c] || 0) + v;
    }
    bands[p] = B;
  }
  // realised sink shares vs spine targets per level band (reference agents), share of (faucets + transfers in)
  const shares = {};
  for (const p of ['casual', 'hardcore', 'payer']) {
    const a = refs[p]; if (!a) continue; const tot = { inc: 0, g: {} };
    for (const r of a.rows) { tot.inc += sum(Object.values(r.f)) + r.boardIn + r.mktIn; for (const [c, v] of Object.entries(r.k)) { const g = SINK_GROUP[c]; tot.g[g] = (tot.g[g] || 0) + v; } tot.g.buygold = (tot.g.buygold || 0) + r.boardOut; tot.g.mktbuy = (tot.g.mktbuy || 0) + r.mktOut; }
    shares[p] = { income90: tot.inc, pct: Object.fromEntries(Object.entries(tot.g).map(([k, v]) => [k, v / tot.inc * 100])), endBal: a.bal };
  }
  return { tag, P: { mix: P.meta.mix, mode: P.meta.upgradeMode, market: P.trade.model + (P.trade.model === 'r2' ? ' (เก็บ ' + P.trade.holdDays + ' วัน)' : '') }, days, kpi, ms, bands, shares, cum: { F: cumF, K: cumK, ratio: cumF / cumK }, refs: Object.fromEntries(Object.entries(refs).map(([k, a]) => [k, a ? a.rows : null])), finalPrice: price };
}
function avgRows(a, d0, d1) { const rs = a.rows.filter(r => r.d >= d0 && r.d <= d1); return rs.length ? sum(rs.map(r => sum(Object.values(r.f)) + r.boardIn)) / rs.length : null; }

// ------------------------------------------------------------------ markdown tables
const fmt = x => (x === null || x === undefined || Number.isNaN(x) ? '—' : Math.round(x).toLocaleString('en-US'));
const f2 = x => (x === null || x === undefined || Number.isNaN(x) ? '—' : (Math.round(x * 100) / 100).toFixed(2));
const pc = x => (x === null || x === undefined ? '—' : (x * 100).toFixed(1) + '%');
function tables(res) {
  const L = [];
  const pname = { casual: 'ฟรีเล่นน้อย', hardcore: 'ฟรีขยัน', payer: 'ผู้เติมเงิน', whale: 'วาฬ (ทดสอบ)' };
  L.push(`### ${res.tag}: ส่วนผสม ${res.P.mix.casual}/${res.P.mix.hardcore}/${res.P.mix.payer} · อัปเกรดแบบ ${res.P.mode} · ตลาดแบบ ${res.P.market}`);
  L.push('');
  L.push(`ตำลึงเข้า ÷ ออก สะสม 90 วัน = **${f2(res.cum.ratio)}** · เงินในระบบวันที่ 90 = ${fmt(res.days[res.days.length - 1].M)}`);
  L.push('');
  L.push('**KPI เทียบเป้า spine ข้อ 12**');
  L.push('');
  L.push('| KPI | ค่าในแบบจำลอง | เป้า | ผ่าน |'); L.push('|---|---|---|---|');
  for (const k of res.kpi) L.push(`| ${k.name} | ${k.value} | ${k.target} | ${k.ok ? 'ผ่าน' : (k.info ? 'ไม่ผ่าน' : '**ไม่ผ่าน**')}${k.note ? ' · ' + k.note : ''} |`);
  L.push('');
  L.push('**รายได้และรายจ่ายต่อวัน ตามช่วง (ผู้เล่นอ้างอิง ความเร็ว 1.0 เข้าวันที่ 1)**');
  L.push('');
  L.push('| ผู้เล่น | ช่วง | วัน | ก๊อกต่อวัน | รับโอน (กระดาน+ตลาด) | สิ้นเปลือง | เดินทาง+บริการ | พันธมิตร | ภาษีการค้า | อัปเกรด | ซื้อวัตถุดิบ NPC | บรรดาศักดิ์ | ปลายเกม | ค่ากระดาน | จ่ายโอน (ซื้อทอง+ตลาด) | เหลือเก็บต่อวัน |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [p, B] of Object.entries(res.bands)) for (const [key, b] of Object.entries(B)) {
    const k = c => (b.k[c] || 0) / b.days; const g = cs => sum(cs.map(k));
    const tot = g(Object.keys(b.k));
    L.push(`| ${pname[p]} | ${key} | ${b.from}–${b.to} | ${fmt(b.fauc / b.days)} | ${fmt(b.tin / b.days)} | ${fmt(g(['K_CONS', 'K_CITY_TAX']))} | ${fmt(g(['K_TRAVEL', 'K_SERVICE']))} | ${fmt(k('K_ALLY_DONATE'))} | ${fmt(k('K_TRADE_TAX'))} | ${fmt(g(['K_ENH', 'K_TROOP', 'K_HORSE', 'K_GEM', 'K_REROLL', 'K_SET', 'K_BREAK']))} | ${fmt(k('K_GRANARY'))} | ${fmt(k('K_NOBLE'))} | ${fmt(k('K_ENDGAME'))} | ${fmt(k('K_BOARD_FEE'))} | ${fmt(b.tout / b.days)} | ${fmt((b.fauc + b.tin - b.tout) / b.days - tot)} |`);
  }
  L.push('');
  L.push('**ตัวดูด 90 วัน เป็น % ของรายได้ (ก๊อก + รับโอน) เทียบ spine 6.3**');
  L.push('');
  L.push('| ผู้เล่น | รายได้ 90 วัน | สิ้นเปลือง | เดินทาง+บริการ | พันธมิตร | ภาษีการค้า | อัปเกรด (รวมซื้อวัตถุดิบ NPC) | บรรดาศักดิ์ | ปลายเกม | ค่ากระดาน | ซื้อทอง | ซื้อของตลาด | เงินคงเหลือวันที่ 90 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [p, s] of Object.entries(res.shares)) { const x = k => (s.pct[k] || 0).toFixed(1); L.push(`| ${pname[p]} | ${fmt(s.income90)} | ${x('cons')} | ${x('travel')} | ${x('ally')} | ${x('trade')} | ${x('upg')} | ${x('nobility')} | ${x('endg')} | ${x('board')} | ${x('buygold')} | ${x('mktbuy')} | ${fmt(s.endBal)} |`); }
  L.push('');
  L.push('**วันที่ถึงหลักสำคัญ (ผู้เล่นอ้างอิง · ในวงเล็บ: p10–p90 ของทั้งกลุ่ม ความเร็ว 0.8–1.2 เข้าวันที่ 1–10 · นับวันของผู้เล่น)**');
  L.push('');
  const lab = { lv80: 'Lv 80', weapon10: 'อาวุธ +10', weapon15: 'อาวุธ +15', avg10: 'ตีบวกเฉลี่ย 10 ชิ้น +10', t4: 'ทหาร T4', rank7: 'ยศ 7', rank8: 'ยศ 8', rank9: 'ยศ 9', gate9: 'ผ่านเงื่อนไขบรรดาศักดิ์ 9', nob9: 'ซื้อบรรดาศักดิ์ 9', nob10: 'ซื้อบรรดาศักดิ์ 10', nob11: 'ซื้อบรรดาศักดิ์ 11', nob12: 'ซื้อบรรดาศักดิ์ 12', legend: 'ม้าตำนาน (ขนแผง 40 + ค่าฝึก)', card: 'ทองผูกจากกระดานสะสม ≥ 1,490 (เท่าทองบัตรรายเดือน)', pass: 'ทองผูกสะสม ≥ 2,990 (บัตรผ่านซีซัน)' };
  L.push('| หลัก | ' + Object.keys(res.ms).map(p => pname[p]).join(' | ') + ' |'); L.push('|---|' + Object.keys(res.ms).map(() => '---').join('|') + '|');
  const cell = m => (m.ref === undefined ? 'ไม่ถึงใน 90 วัน' : String(m.ref)) + (m.reached ? ` (${m.p10 ?? '—'}–${m.p90 ?? '—'} · ถึง ${m.reached}/${m.n})` : '');
  for (const k of Object.keys(lab)) L.push(`| ${lab[k]} | ` + Object.keys(res.ms).map(p => cell(res.ms[p][k])).join(' | ') + ' |');
  L.push('| วันที่ 90: ตีบวกเฉลี่ย · อาวุธ · ทหาร · ดาวม้า | ' + Object.keys(res.ms).map(p => { const e = res.ms[p].end; return `+${e.enhAvg.toFixed(1)} · +${e.weapon} · Lv ${e.troopLv} T${e.tier} เกลา ${e.refine} · ${e.stars}`; }).join(' | ') + ' |');
  L.push('');
  L.push('**ทั้งเซิร์ฟรายวัน**');
  L.push('');
  L.push('| วันที่ | ผู้เล่น | Lv กลาง | ตำลึงเข้า | ตำลึงออก | เข้า:ออก 7 วัน | 30 วัน | เงินในระบบ | ต่อคน | วันของรายได้ | ราคากระดาน | เส้นคาด | ราคา÷เส้นคาด | เส้นคาด S7 | ราคา÷S7 | ซื้อได้ของ | ความเร็วเงิน | ซื้อขาย÷ก๊อก | Gini | 1% บน | ออฟไลน์ | ดัชนีราคา | ดัชนี S9 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const d of [1, 3, 4, 5, 7, 10, 14, 21, 30, 45, 60, 75, 90]) { const x = res.days[d - 1]; if (!x) continue;
    L.push(`| ${d} | ${x.dau} | ${x.Lmed} | ${fmt(x.Ftot)} | ${fmt(x.Ktot)} | ${f2(x.r7)} | ${d >= 30 ? f2(x.r30) : '—'} | ${fmt(x.M)} | ${fmt(x.M / x.dau)} | ${f2(x.daysIncome)} | ${fmt(x.board.P)} | ${fmt(x.board.guide)} | ${f2(x.board.N)} | ${fmt(x.board.guide7)} | ${f2(x.board.N7)} | ${x.board.guide ? Math.round(x.board.fillB * 100) + '%' : '—'} | ${pc(x.velocity)} | ${pc((x.T.market + x.T.board) / x.f7avg)} | ${f2(x.gini)} | ${pc(x.top1)} | ${pc(x.offlineShare)} | ${f2(x.priceIdx)} | ${f2(x.priceIdxAlt)} |`); }
  L.push('');
  L.push('**ก๊อกและตัวดูดทั้งเซิร์ฟ (% ของตำลึงเข้าวันนั้น)**');
  L.push('');
  L.push('| รหัส | วันที่ 7 | วันที่ 30 | วันที่ 60 | วันที่ 90 |'); L.push('|---|---|---|---|---|');
  for (const c of FAUCET_CODES) L.push(`| ${c} | ` + [7, 30, 60, 90].map(d => pc(res.days[d - 1].F[c] / res.days[d - 1].Ftot)).join(' | ') + ' |');
  for (const c of SINK_CODES) L.push(`| ${c} | ` + [7, 30, 60, 90].map(d => pc(res.days[d - 1].K[c] / res.days[d - 1].Ftot)).join(' | ') + ' |');
  L.push('| รวมตัวดูด | ' + [7, 30, 60, 90].map(d => pc(res.days[d - 1].Ktot / res.days[d - 1].Ftot)).join(' | ') + ' |');
  L.push('');
  L.push('**ของไหลเข้าตลาด ต่อวันทั้งเซิร์ฟ (หน่วย: หินเทียบหินต้น · อื่น ๆ เป็นชิ้น)**');
  L.push('');
  L.push('| ของ | วันที่ | ผลิตเทรดได้ | ผลิตผูกตัว | ใช้ | ลงขาย | ขายได้ | ซื้อเก็บตอนถูก | ซื้อจาก NPC | ต้องการแต่ไม่มีของ | ขาย NPC ราคาพื้น | ราคาวันนั้น ÷ ราคาอ้างอิง |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of CATS) for (const d of [14, 30, 60, 90]) { const m = res.days[d - 1].mat[c]; L.push(`| ${c} | ${d} | ${fmt(m.prodT)} | ${fmt(m.prodB)} | ${fmt(m.used)} | ${fmt(m.listed)} | ${fmt(m.sold)} | ${fmt(m.bargain || 0)} | ${fmt(m.npcBought)} | ${fmt(m.unmet)} | ${fmt(m.dumped)} | ${f2(res.days[d - 1].prices[c] / DEFAULTS.mats[c].ref)} |`); }
  if (res.lvBand) { L.push(''); L.push('**ใช้ ÷ ผลิต ตามช่วงเลเวลผู้เล่น (ทั้ง 90 วัน · ใช้ = ของที่ใช้จริง รวมซื้อจาก NPC · วงเล็บ = ต้องการแต่ไม่มีของ ÷ ผลิต)**'); L.push('');
    const B = res.lvBand.bands.slice(1); L.push('| ของ | ' + B.map(([a, b]) => `Lv ${a}–${b}`).join(' | ') + ' | รวม |'); L.push('|---|' + B.map(() => '---').join('|') + '|---|');
    for (const [c, arr] of Object.entries(res.lvBand.data)) { const a2 = arr.slice(1); const tp = sum(a2.map(x => x.prod)), tu = sum(a2.map(x => x.use)), tn = sum(a2.map(x => x.unmet));
      L.push(`| ${c} | ` + a2.map(x => x.prod > 0 ? `${f2(x.use / x.prod)}${x.unmet > 0.005 * x.prod ? ' (' + f2(x.unmet / x.prod) + ')' : ''}` : '—').join(' | ') + ` | ${tp > 0 ? f2(tu / tp) : '—'}${tn > 0.005 * tp ? ' (' + f2(tn / tp) + ')' : ''} |`); } }
  L.push('');
  return L.join('\n');
}

// ------------------------------------------------------------------ scenarios
function scenario(name, overrides) { return { name, P: deepMerge(DEFAULTS, overrides || {}) }; }
function loadOverrides(f) { const p = path.isAbsolute(f) ? f : path.join(DIR, f); return JSON.parse(fs.readFileSync(p, 'utf8')); }
// round-1 spine proposals that the modules adopted but spine.md has not (S1 installments, S2 tier-13 prepay, S4 budget)
const SPINE_R1 = { spine: { nobInstall: true, nobInstallLead: 10, nobInstallBufferDays: 0.25, prepayPatchTier: true, patchBufferDays: 1,
  upgShare: (J.upgShareR1 || [0.39, 0.463, 0.44, 0.42, 0.54]).slice(0, 4), upgShareCap: (J.upgShareR1 || [0, 0, 0, 0, 0.54])[4] } };
const MIX_SPINE = { meta: { mix: { casual: 700, hardcore: 250, payer: 50 } } };
function failsOf(res) {
  const asWritten = res.kpi.filter(k => !k.ok && !k.info && !k.prop).map(k => k.id);
  // with proposals: KPI 5 → S7 line · KPI 8 → S9 index · KPI 11 → S10 turnover (S8 velocity band kept as information)
  const withProp = res.kpi.filter(k => !k.ok && !k.info && !['board_N', 'velocity', 'price_index', 'velocity_S8'].includes(k.id)).map(k => k.id);
  return { asWritten, withProp };
}
// projected need per persona (units/day at Lv >= 75) for the r2 holding rule: calibrated once on r2_design with the myopic market
function projNeedFile() { return path.join(DIR, 'r2_projneed.json'); }
function getProjNeed(recalib) {
  if (!recalib && fs.existsSync(projNeedFile())) return JSON.parse(fs.readFileSync(projNeedFile(), 'utf8')).projNeed;
  const P = deepMerge(deepMerge(DEFAULTS, SPINE_R1), { trade: { model: 'r1' } });
  const res = run(P, 'calib');
  const out = {}; for (const [p, v] of Object.entries(res.projNeedOut)) { out[p] = {}; for (const [c, x] of Object.entries(v)) out[p][c] = Math.round(x * 1000) / 1000; }
  fs.writeFileSync(projNeedFile(), JSON.stringify({ _note: 'units per day per agent (speed 1.0) at Lv >= 75, r2_design with myopic market (trade.model r1). Used by trade.model r2 holding rule.', projNeed: out }, null, 1));
  return out;
}
function writeRun(sc, res, summary, t0) {
  const md = tables(res);
  fs.writeFileSync(path.join(OUT, 'tables_' + sc.name + '.md'), md, 'utf8');
  const slim = { tag: res.tag, P: res.P, cum: res.cum, kpi: res.kpi, ms: res.ms, shares: res.shares, officialSpent: res.officialSpent,
    days: res.days.map(x => ({ d: x.d, dau: x.dau, Lmed: x.Lmed, F: x.F, K: x.K, Ftot: x.Ftot, Ktot: x.Ktot, r7: x.r7, r14: x.r14, r30: x.r30, M: x.M,
      daysIncome: x.daysIncome, board: x.board, velocity: x.velocity, gini: x.gini, top1: x.top1, offlineShare: x.offlineShare, upgShare: x.upgShare,
      priceIdx: x.priceIdx, priceIdxAlt: x.priceIdxAlt, f7avg: x.f7avg, prices: x.prices, mat: x.mat, T: x.T, poverty: x.poverty, basicsPct: x.basicsPct, official: x.official })), lvBand: res.lvBand, projNeedUsed: res.P.projNeed };
  fs.writeFileSync(path.join(OUT, sc.name + '.json'), JSON.stringify(slim), 'utf8');
  const f = failsOf(res);
  summary.push({ scenario: sc.name, cumRatio: +res.cum.ratio.toFixed(3), failsAsWritten: f.asWritten, failsWithProposals: f.withProp, ms_ms: Date.now() - t0 });
  console.log(`== ${sc.name}  cum F/K ${res.cum.ratio.toFixed(3)}  fails (spine as written): ${f.asWritten.join(', ') || 'none'} | with S7/S9/S10: ${f.withProp.join(', ') || 'none'}  (${Date.now() - t0} ms)`);
  for (const k of res.kpi) console.log(`   ${k.ok ? 'ok  ' : 'FAIL'} ${k.id.padEnd(15)} ${k.value}  [${k.target}]`);
}
function main() {
  const args = process.argv.slice(2); const get = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
  if (!DROPS || !NPCJ) { console.error('cannot read drops.json / npc.json from ' + DESIGN); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const pn = getProjNeed(args.includes('--recalib'));
  const withPN = o => deepMerge({ trade: { projNeed: pn } }, o);
  let list;
  if (get('params')) list = [scenario(get('tag') || 'custom', deepMerge(SPINE_R1, withPN(loadOverrides(get('params')))))];
  else {
    const r2 = fs.existsSync(path.join(DIR, 'r2_changes.json')) ? loadOverrides('r2_changes.json') : null;
    list = [
      scenario('r2_design_70_22_8', withPN(SPINE_R1)),
      scenario('r2_design_70_25_5', withPN(deepMerge(SPINE_R1, MIX_SPINE))),
      scenario('r2_spine_literal_70_22_8', withPN({})),
      scenario('r2_design_myopic_70_22_8', withPN(deepMerge(SPINE_R1, { trade: { model: 'r1' } }))),
    ];
    if (r2) {
      list.push(scenario('r2_changes_70_22_8', withPN(deepMerge(SPINE_R1, r2))));
      list.push(scenario('r2_changes_70_25_5', withPN(deepMerge(deepMerge(SPINE_R1, r2), MIX_SPINE))));
      list.push(scenario('r2_changes_myopic_70_22_8', withPN(deepMerge(deepMerge(SPINE_R1, r2), { trade: { model: 'r1' } }))));
      // behaviour sensitivities on the proposed set
      const sens = (name, o) => list.push(scenario(name, withPN(deepMerge(deepMerge(SPINE_R1, r2), o))));
      sens('r2_changes_hold7_70_22_8', { trade: { holdDays: 7 } });
      sens('r2_changes_hold30_70_22_8', { trade: { holdDays: 30 } });
      sens('r2_changes_deposit30_70_22_8', { spine: { nobInstallShare: 0.3 } });
      sens('r2_changes_buffer1_70_22_8', { spine: { nobInstallBufferDays: 1 } });
      sens('r2_changes_nos1s2_70_22_8', { spine: { nobInstall: false, prepayPatchTier: false } });
    }
    const one = get('one'); if (one) list = list.filter(s => s.name.startsWith(one));
  }
  const summary = [];
  for (const sc of list) { const t0 = Date.now(); const res = run(sc.P, sc.name); writeRun(sc, res, summary, t0); }
  fs.writeFileSync(path.join(OUT, get('params') ? 'summary_' + (get('tag') || 'custom') + '.json' : 'summary_r2.json'), JSON.stringify(summary, null, 1), 'utf8');
}
if (require.main === module) main();
module.exports = { run, DEFAULTS, SPINE_R1, MIX_SPINE, deepMerge, tables, failsOf, getProjNeed };
