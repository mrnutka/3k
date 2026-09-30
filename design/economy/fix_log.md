# Fix log

## Fix pass 2026-09-29: review_numbers · review_player · review_risk

Drafts edited in place: `tab_economy.md` · `tab_catalog.md` · `main_plan.md`. Pre-fix copies are in `_fix_backup/` (drafts, `r2_changes.json`, and `sim/out` as `sim_out_pre/`). Every edit was applied by script with an exact find string and an expected match count (`_fix_edits/*.py`); a script refused to write if any count was off. Markdown tables were re-checked after the pass (same cell count in every row, no change from before).

**Result: 87 fixes applied, 3 rejected** (review_numbers 26 / 0 · review_player 42 / 2 · review_risk 19 / 1). Some applied fixes were partial; they are listed under "Partial and out of scope".

### Conflicts between reviews and how they were settled

| Topic | Reviews | Chosen | Why |
|---|---|---|---|
| Launch server has no ทอง sellers on day 4 (7-day hold for every new account) | D1 (recommended option) vs H1 and R7 (open the first server's board on day 8, re-run the simulation with account-age holds) | **D1**: the 168-hour hold applies to cards and card-funded e-wallets only. New accounts paying by PromptPay or bank transfer wait 72 hours like everyone else. The board opens on day 4 on every server. | The simulation uses `cash.holdDays: 3` for all payers. D1 matches that assumption, so the board path in 9.5, KPI 5 and the payer figures in 9.9 stay valid. H1 and R7 would move the first server's board to day 8 and invalidate them. The risk behind the new-account hold is now covered by R10 (seller OTP, one phone per seller account) and the existing "account age ≥ 3 days" rule. The day-8 option is recorded for the owner as 18.2 #32. R7's s₄ refinement does not conflict and was adopted (see R7). |
| Board fee adjustable range below the 10% floor | D16 (5.2–8.5%, round trip 10.1–16.3%) vs H7 (5.5–8.5%, 10.7–16.3%) | **D16** | Both fix the same defect. Both keep the simulated 6% per side, so neither changes the simulation. 5.2% is the smallest step that satisfies the owner's 10% floor (1 − 0.948² = 10.13%), so it keeps the widest range. |
| Trade-window tax: 10% vs 11%, and "no channel is cheaper" | D5 (raise to 11% = m ÷ (1 − m)), L6 (the codex overclaims), R13 (item-for-item gifts cost 6%), H6 (main-tab text says 10%) | **All four combined**: 11% in 6.1, 7.1, 7.2, 11.3, C15 and the main-tab row. C15 now also says that balanced item swaps (2%) and small gifts under 1,000 are cheaper (L6). The gift fee now applies to any difference ≥ 1,000 (R13). | No conflict in substance. The simulation's trade tax is about 0.1% of faucets, so the rate does not change simulated results. |
| Charm (ยันต์) price in the gold shop | D3 (6 → 10 gold, and the hay pack 30 → 50) vs M16 (main-tab row still says 6 gold) and D23 | **D3**, with M16 and D23 merged into one main-tab row at 10 gold | D3 changes numbers, so the simulation was re-run (below). |
| ทองผูก definition in the main tab | D22 vs M14 | **M14's wording**, which contains D22's fix and also corrects "tax is the sink" | Same defect. M14 is the fuller fix. |
| Opening auction | R15 (remove it) vs the adopted design (cash C2, simulated as the day-4 reserve P0) | **Keep the auction.** R15's second point (11.3) was applied. | R15's replacement drops the single clearing price, so orders placed first get their own prices. The simulation is the same either way. Recorded for the owner as 18.2 #33. |

### Simulation re-run (D3 changes numbers)

- **Inputs updated:** `sim/r2_changes.json` now carries `upgrade.charmGold = 10` and `upgrade.goldCharmsPerWeek = { payer: 18, whale: 30 }`. Payers still spend 180 ทอง a week on charms, the same budget as before. The whale stays at the 30-a-week cap. The file's `_note` records the change.
- **Pre-existing problem in `sim/`, not caused by this pass:** `drops.json` was regenerated at 13:35 with the round-2 `matBandMult` multipliers baked in, but `sim/r2_changes.json` still applies `matBandMult`. Running `node sim/sim.js` against the current `drops.json` therefore applies the multipliers twice. Running the unchanged code this way does not reproduce the 13:10 outputs that the drafts quote (`days_income` 2.65, S9 index −10.5% to +18.1%). So that the only change measured is D3, the re-run used the same `sim.js` and the same `r2_changes.json` in `_fix_sim/B/`, with `drops.json` taken from `_drops_r2/orig/`. The other module JSON files are the current ones. This setup reproduces the old `tables_r2_changes_70_22_8.md` byte for byte before D3 is added. All 12 scenarios were then run with `/d/nodejs/node`, and `r2_report_data.js` was regenerated. The outputs were copied into `sim/out/`. `_fix_sim/B/sim/extra.js` and `extra2.js` produce the extra figures (sink shares, turnover mix). For comparison, the current drops with no `matBandMult` (`_fix_sim/D`) gives cumulative in:out 1.034, days of income 2.62, S9 index −15.2% to +17.0%. The owner should choose one of these setups before the next balance round.
- **Changes in the main scenario (70/22/8):**
  - Cumulative in:out stays at 1.034.
  - The 7-day in:out from day 15 goes from 1.01–1.06 to 1.01–1.07.
  - The day-90 money stock goes from 176,699,398 to 176,322,470. The peak stays at 2.66 days of income.
  - The S9 price index goes from −19.7% to −21.0% at its low end. The high end stays at +12.5%. It still fails.
  - KPI 11 (turnover ÷ faucets) goes from 2.1–4.7% to 2.1–3.7%.
  - KPI 13 (upgrades' share of sinks) goes from 41.2–51.7% to 41.2–52.0%.
  - Velocity at day 90 goes from 1.0% to about 1.1%.
  - 90-day sinks: enhancement 20.8 → 21.0, gems 2.7 → 2.6, granary 0.6 → 0.4. The total stays at 96.7%.
  - Weapon +15: day 68/44/40 → 70/45/42. Casual players who reach it within 90 days go from 673 to 645.
  - Legendary horse for the free heavy player: day 54 → 53.
  - Day-90 average enhancement: +14.4/+16.1/+16.5 → +14.2/+16.0/+16.4. U2 is +16.0, still inside +15 to +16.5.
  - Per-band spending rows and the day 30–90 server rows changed as well.
- **Sensitivity scenarios:**

| Scenario | Cumulative in:out | Days of income | S9 index |
|---|---|---|---|
| hold 30 | 1.035 | 2.74 | −3.3 to +12.5 |
| hold 7 | 1.031 | 2.43 | −25.1 to +3.0 |
| deposit 30% | 1.041 | 3.21 | −23.6 to +9.7 |
| hold cash 1 day | 1.036 | 2.83 | −21.3 to +12.5 |
| no installments | 1.115 | 8.32 | −21.5 to +10.2 |

- **Unchanged:** the faucets (offline peak 45.3%, 90-day average 44.2%), the board price path, KPI 5–7, whale gap 1.57, Gini ≤ 0.47, top 1% 3.9%, T4 days, nobility days, and gem tiers.
- **Draft updates:**
  - `tab_economy.md`: 1.3 · 3.4 · 5.3 · 5.6 (all four tables and the bullets) · 9.9 (16,460 → 16,461) · 14.1 KPI 2 / 8 / 11 / 13 / velocity / U2 · C16 (effect about 1,500 ตำลึง a day, down from 2,500) · 18.3 (two places).
  - `tab_catalog.md` 5.3 (charm tab note).
- **Corrected while doing this:**
  - The 5.6 income column (4,976,546 / 7,869,134 / 8,596,965) came from the `r2_design` scenario, while the rest of that table came from `r2_changes`. It now uses `r2_changes`.
  - 18.3 said "KPI 11 ราว 65% ของตัวตั้งเป็นกระดาน". The main scenario gives 73% before this pass and 75% after it, so the text now says about 75%.
  - The 5.2 upgrade split (50/28/9/13 and so on) could not be reproduced from the reference-player ledger. D3 moves those shares by less than 1 point, so the row was left unchanged.

### Applied: review_numbers (26)

| ID | Where | Change |
|---|---|---|
| D1 | econ 9.7, 9.2, ToS item 4, C24 | Hold row rewritten (see conflicts). "7 วันสำหรับบัตรเครดิตและเดบิต" in the ToS and C24. The 9.2 reason names PromptPay and bank transfer. |
| D2 | econ 10.3 | Kept the published numbers and fixed the rule. On the 10th pull, UR is rolled at the counter rate first, then SSR : SR = 4 : 15. Other tiers shrink in proportion as the UR rate rises. Markov check: 59.73 pulls, 45.25% by pull 75, 99.92% by pull 90. |
| D3 | cat 8.1, 11.6, 15.1, 15.2, 15.5 · econ 3.3, 9.8, 9.9, 10.2, 10.4, 13.2, 14.2 C16, 18.1 #10, 18.2 #9 · main_plan | Charm 10 ทอง each (pack of 10 = 100) and hay pack 50, both priced from the main-scenario board price 115. Payers buy 18 charms a week from gold. Season-pass value 850 / 6,960 (2.33) / 12,040 (2.01). Quick packs 1.00 / 1.82 / 1.69 / 1.60 / 1.50. Whale 93,000 ทอง → 343 pulls. The simulation was re-run. |
| D4 | cat 7.5 | NPC buys mid-grade stone at 60 and high-grade at 360. |
| D5 | econ 1.3, 6.1, 7.1, 7.2 #1 #5, 11.3, C15 · main_plan | Trade-window tax is now 11% (range 9–16%, never below m ÷ (1 − m)). |
| D6 | econ 5.1 | Installments start at Lv 35. The Lv 1–34 money waits in the wallet (7-day in:out 1.40 on day 1). |
| D7 | econ 4.1 · cat 10.1 | Boss time pay applies to the second free dungeon run only, not to runs bought with ทอง. |
| D8 | cat 6.1, 6.2 | Gear budget is 0.135 × S. Example: 1.58 white + 1.00 green + 0.47 blue + 0.13 purple = 1,107. |
| D9 | econ 9.6, 9.9, 10.10 | Gold sellable: 447 a day (574–576 baht a month) at a board price of 194, and 759 a day (975 baht a month) at 115. The cap is quoted in ตำลึง. |
| D10 | econ 2.5, 9.8, 13.2, 14.2 C8 · main_plan | Free ทองผูก cap raised to 1,650 per 30 days. The season-pass rows use the 1,380 free ทองผูก a 28-day season gives (1,720 / 2,160 ทอง needed; 2.9–4.9 days of income). |
| D11 | econ 14.1 KPI 12 | Daily peak 45.3%, 90-day average 44.2%. |
| D12 | econ 9.7 | The auction preview matches 1,900 ทอง. |
| D13 | econ 1.3 | Payer board income 15,300–27,600. |
| D14 | econ 10.6 | Pack value 1.5–1.8 times the price. |
| D15 | econ 10.2 | Price step 990 added. The 60 step became 50. |
| D16 | econ 6.1, 9.2 | 5.2–8.5% per side, 10.1–16.3% round trip. |
| D17 | cat 8.8 | Free light player reaches T4 about day 31 (p10–p90 22–40). |
| D18 | cat 3.9 | 0.048 × S per hour, at most 0.20 × S a day. |
| D19 | cat 3.3 (and the same claim in C19 on screen) | Player prices stay within 70–130% of the reference, the market floor and the ceiling. "(พื้น)" removed from the column header. |
| D20 | econ 4.4 | Payer on day 30 is rank 7 and reaches 8 during the day. |
| D21 | econ 4.4 | The free light player earns 67–69% of the free heavy player. |
| D22 | main_plan new paragraph 1 | Merged into M14's wording. |
| D23 | main_plan m5zp5ngnhqs.5930 | Merged with M16: โรงช่างหลวง, unlimited; gold shop 10 ทอง each, at most 30 a week. |
| D24 | cat 1.1 | G(L) is not rounded; prices are rounded to tens. |
| D25 | econ 3.2 | EXP row recomputed from h(L) × 10 × S(L) (989 … 7,898,157, checked by script). |
| D26 | econ 14.3, 14.5 | 139–195 · 84–117 · faucet −2.4. |

### Applied: review_player (42)

| ID | Where | Change |
|---|---|---|
| H2 | econ 2.4, 1.1, 9.8, 9.9, 10.1, 10.3 · cat 15.1, 15.3 | On-screen hero tiers: ขุนพลเขียว / ฟ้า / ม่วง / ส้ม / แดง. The codes N–UR stay as sheet codes. The alternative (keep UR) is 18.2 #31. |
| H3 | econ C16 body and snippet, 6.1, 17.4 | Market revenue was the private income of whoever held the land, from the emperor down to each fief holder, and not part of the state budget. New snippet: 「自天子以至封君湯沐邑，皆各為私奉養」. |
| H4 | econ 17.4 | 緜 is silk floss (ใยไหม), not cotton. |
| H5 | econ 17.2, 17.3 | C17 unlocks by tapping the city-tax sign. C21 unlocks by opening the trade history. |
| H6 | main_plan m5zp5ngnhqs.6406 | Two trade channels. Alliance storage is not a channel. Clearer wording for bound items. 11% from D5. |
| M1 | econ 1.4 | Full digits on every confirm and trade screen. "1.25 ล้าน" only in the wallet bar and in lists without a confirm button. |
| M2 | econ 6.1 | Per-piece price example and a clearer confirm text. |
| M3 | econ 7.9 | Market header reads "ค่าลงขาย 1% (ไม่คืน) + ภาษีเมื่อขายได้ 9%". |
| M4 | econ 9.7 | Units on every screen text. What ทองผูก can buy is stated. Date template. |
| M5 | econ 10.1, ToS item 2, C02 · main_plan (three rows) | ฿ symbol on screen. "1 บาท = 10 ทอง" is not allowed on screen. |
| M6 | econ 10.5 | VIP 3 gets a profile frame instead of a storage tab. |
| M7 | econ 7.9 | The limit message asks for an OTP, not identity verification. |
| M8 | econ C26 | The 15,000 is a game number, not a Han deduction. |
| M9 | econ 17.2, 17.3 C07 | Tag changed to ประวัติศาสตร์ + แต่งใหม่. The snippet is hidden until the team checks 居新 EPT4:59 (see Partial). |
| M10 | econ C29 | 候長 is นายกองหอรบ. Slaves (50,000) and ox carts with oxen (10,000) added so the total is 150,000. |
| M11 | econ 6.1, 6.2 | "One tenth" is tagged อนุมาน as a maths exercise, not law. |
| M12 | cat (18 places) · econ 2.4, 10.8 | ยาสมานแผลใหญ่ · กระต่ายแดงเพลิงถ่าน (card tag สกินม้า) · ไกหน้าไม้จารึกหลวง · กระเบื้องวังหลวง · รองเท้าฟางช่างสาน · ผ้าคลุมม้าขาวอาสา. |
| M13 | cat 8.9, 9, 10.7 · econ 17.4, 18.2 #18 | อูเจา → อัวเจ๋า everywhere. Z11 and Z12 region is กุนจิ๋ว. 18.2 #18 extended to person names and Mandarin-style map names. |
| M14 | main_plan new paragraph 1 | ทองผูก defined correctly. Tax is anti-manipulation, not "the sink". |
| M15 | main_plan m5zp5ngnhqs.8358 | Transfers between players are not sinks. |
| M16 | main_plan m5zp5ngnhqs.5930 | Merged with D23. |
| M17 | main_plan (b) and (f) | 馬鎧 → เกราะม้า in the replacement text. Two check rows added. |
| M18 | main_plan (e) notes | Recommended default: orange ramp for the ส้ม tier. Gold colour only for UI frames and the cash icon. |
| M19 | econ 5.3 · main_plan (e) | โหวแขวง → โหวกิ่งอำเภอ. The tier number is always shown before the name (rule 4). |
| L1 | econ R8, R11 | Cross-reference 17.4 → 17.5. |
| L2 | econ C05 | Tag and "ในเกม" text: two currencies, and ทองผูก is not a third. |
| L3 | econ C01 | Competitor mention removed. Note that ตำลึง in the game is a currency, not a weight. |
| L4 | econ C02 | 220–250 g. About 5,000 in early Han, 10,000 in late Western Han. |
| L5 | econ C23 | ราคากลางกระดาน. |
| L6 | econ C15 | Merged with D5. |
| L7 | econ 17.4 | Arabic numerals in 11 tooltips. |
| L8 | econ 17.4 (4 rows) · cat 8.9 | "ห้ามขึ้นจอจนตรวจตัวบท" on unverified tags. The ราคาในร้าน tag gets + แต่งใหม่. |
| L9 | econ 8.2, 10.7, 15 · cat 5.6, 15.4 | บัตรเปลี่ยนชื่อ → ป้ายเปลี่ยนชื่อ. The 18.2 #21 wording, which records the decision, was kept. |
| L10 | econ 7.9 | "ใส่ในหน้าต่างแลกของได้หลัง …". |
| L11 | cat 11.8 | Full item name on the confirm line. |
| L12 | cat 9 intro | Monster label on screen: ทั่วไป / หัวหน้า. |
| L13 | cat 8.5 | Tags on พวงเหรียญเก่า and ทองคำแท่ง: + แต่งใหม่. |
| L14 | econ 2.5 | The paid track has no ทองผูก. The free track has 500. |
| L15 | econ 1.3, 5.3, 18.1 · main_plan | "Lv ขั้น − 10" spelled out in plain words. |
| L16 | econ 10 principle 3 | Principle made precise. |
| L17 | econ 2.4, C14 | Fee-name row added. C14 title changed to ภาษีการค้า. |
| L18 | main_plan m5zp5ngnhqs.8394 | Free ทองผูก sources named (with D10's 1,650). |

### Applied: review_risk (19)

| ID | Where | Change |
|---|---|---|
| R1 | econ 9.3 step 6, 12.2 | The board-match ledger balances per currency: escrow, fee burn, convert burn, mint of ทองผูก, and a refund of the price difference. |
| R2 | econ 12.2, 12.6 | `idem_keys` table (not partitioned, PRIMARY KEY). Full key scheme covering offline, daily, board, grant per recipient, buyback and top-up. `pg_advisory_lock` per server. |
| R3 | econ 9.7, 10.10, 11.2 | Card-funded e-wallets wait 168 hours. Chargeback tracing has no 7-day limit and no double penalty. ตำลึง from card-funded ทอง is held 30 days before it can go to other players. The 3DS note was rewritten and merged with D9. |
| R4 | econ 9.6, 9.7, 10.9, ToS item 4, 12.2, 12.4, 13.2 | Age is asked at account creation. Minors cannot sell ทอง (`minor_lot` flag, `board_sell` false). |
| R5 | econ 11.1, 13.3, 14.1 KPI 16 | Net give and receive per day are 5 × S(L) and 10 × S(L), counted per account per server. Weekly combined cap: trade-window receipts plus board ตำลึง ≤ 30 × S(L). KPI 16 counts trade-window receipts. |
| R6 | econ 7.3, 10.10, 11.4, 12.4 · cat 7.11 | No linking by IP or ASN on shared mobile networks. Only an IP seen on 5 or fewer accounts in 30 days counts. |
| R8 | econ 9.7, 10.9 (four new lawyer questions: digital asset decree 2018, direct sales act 2002, PDPA 2019, film and video act 2008), 16, 18.2 #30 · main_plan c2 (four rows) | Lawyer and gateway in phase 0. Gateway test mode in phase 1. Real money by PromptPay and bank transfer only in phase 2. Closed-beta board in phase 3. Cards with 3DS, VIP perks and the lifetime card at launch. The announcement lottery moves to after launch. D1 kept the board opening on day 4. |
| R9 | econ 4.1, 10.1, 13.3 · cat 7.10 | Offline hours = min(cap, 6 × hours online). The lifetime card's "claim offline rewards for all characters" perk removed. Reference players are unchanged, so the simulation is not affected. |
| R10 | econ 9.2, 9.6, 11.1 | ทอง sellers and tier 2 need a Thai mobile OTP (one number per account per server). |
| R11 | econ 10.9 ToS item 7, 10.10 | Refund conditions cover used bonus ทองผูก, the first top-up gift, and card offline hours 9–12. |
| R12 | cat 7.13, 10.6, 10.9 | Items from alliance storage bind on receipt. Orange drops can be resold once. |
| R13 | econ 6.1, 13.2 | The gift fee applies whenever the difference is ≥ 1,000. `gift_share` removed. |
| R14 | econ 12.2 | `wallet` and `wallet_hold` gain owner_kind and server_id. `gold_lot` gains server_id. mint and burn have no wallet rows. |
| R15 (partial) | econ 11.3 | Price band against pre-arranged buyers. The lottery opens after launch. The auction removal was rejected (see conflicts). |
| R16 | econ 11.4 | A long queue is sorted by score × ตำลึง. Thresholds are never raised automatically. |
| R17 | econ 12.4 · cat 6.3 | `npc_buyback` owner state and an idempotent buy-back. |
| R18 | econ 12.2 | Spending into a sink releases the oldest hold first. |
| R19 | econ 12.6 | Hourly reconciliation is incremental, with a full run nightly. The ทอง formula subtracts chargebacks. |
| R20 | econ 11.4 B4 | "3DS is already mandatory". |

Extra rows added for the owner in econ 18.2: #31 hero-tier names (H2 alternative), #32 new-account hold (D1 vs H1/R7), #33 opening auction (R15). Econ 7.3 marks the announcement lottery as post-launch (R8, R15).

### Rejected

| ID | Reason |
|---|---|
| H1 | Conflicts with D1. H1 opens the first server's board on day 8 and changes P0. That breaks the simulated board path, KPI 5 and 9.9, which all assume a 3-day hold. D1 fixes the same defect and keeps the numbers consistent. The day-8 option is recorded as 18.2 #32. |
| H7 | The same defect is fixed by D16's range (5.2–8.5%). Two different ranges cannot both apply. D16 keeps the widest range that meets the owner's 10% floor, and the simulated 6% is unchanged either way. |
| R7 | Its fix (first server on day 8, `open_day_first_server 8`, re-run with account-age holds) conflicts with D1 for the reason given under H1. The defect is fixed by D1. R7's s₄ refinement was adopted in 9.5 because it is compatible: ready-to-sell ทอง ÷ Lv ≥ 20 accounts, with card ทอง still on hold excluded. |

### Partial and out of scope

- **D1 and D10:** the matching lines in `cash.md` (57, 202) and `spine.md` 3.1 were not edited. They are source drafts, not the files in scope, and the tabs take precedence over them.
- **M9:** the EPT4:59 text containing 六百 is not available in the files. No Chinese text was invented. C07's "ดูต้นฉบับ" is hidden until the team checks the slip, following the rule in 17.1.
- **R15:** the opening-auction removal was not applied (see conflicts). Only the 11.3 row was applied.
- **M17:** the (f) count for 軍功 uses the reviewer's figure of about 35 before the edit. main_plan still says about 33 remain; the numbers are consistent.
- **review_risk "นอกเลนส์" note** on the halved nobility fees: 18.2 #1 already records it as waiting for the owner. It is not a fix.
