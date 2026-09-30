# ref_mmo: How successful MMOs run free player trading and control it with taxes and fees

> Task: ref_mmo · researched 2026-09-29 · for the Thai H5 Three Kingdoms MMORPG (PixiJS 8, mobile browser, Thai launch to Lv 80, one developer + AI)
> Owner decisions this research serves: (1) all in-game money is **ตำลึง** (player trading, NPC shops, enhancement); (2) the cash-shop currency is **ทอง**; (3) player trading is **free** and controlled by **taxes**; (4) the economy is to be laid out in detail. Player-facing names must be plain Thai.
> Input read first: `scratchpad/economy.json` (earlier economy review). Where this file refers to the blueprint's existing proposals, it uses that file's block ids. It also used `scratchpad/econ/doc_money.md` for context: the reference game 3kingdoms.in.th has free trading through player stalls and a trading station.
>
> Source reliability tags: **[O]** official developer or publisher page · **[W]** community wiki · **[S]** press or secondary site · **[F]** forum or blog. Every number below carries its source. A number from a search-result summary that I could not open directly is marked *(search summary)*.

---

## 0. TL;DR

1. **Every big market that works charges the seller a small fee to list and a larger cut when the item sells, and destroys most of it.** The totals range from 2% (RuneScape) to 35% (Black Desert). The common range is **10–15%**: Guild Wars 2 takes 15% (5% + 10%), Albion 10.5% (2.5% + 8%), EVE about 10.5% at base, MapleStory 5% plus a flat deposit, Lost Ark 5% plus a refundable deposit, FFXIV 5% from the buyer plus 0–5% from the seller.
2. **A high tax only works when players cannot go around the market.** Black Desert takes 35% because it has no direct player-to-player trading. Games that keep a trade window (MapleStory 5% on mesos, RuneScape, Ragnarok) keep market fees low or tax the trade window too. If you allow direct trade, the direct-trade tax must be at least as high as the market tax, or players and RMT sellers will leave the market.
3. **Price bands and allocation rules stop RMT better than tax does.** Black Desert (developer min/max caps, ±10% bands, a random winner among buy orders placed at the cap, 15-minute listing delay for very expensive items), Ragnarok M (system-set prices, a lottery "snap" period, only some gear listable) and Guild Wars 2 (a sale must leave the seller at least the NPC sell price after fees) all make it hard to pass currency to a buyer through an overpriced junk item or a pre-arranged sale.
4. **Owner-set taxes turn territory wars into an economy, but the owner's share must be capped.** Lineage II lets castle lords set 0–15% on NPC shops in their towns. Throne and Liberty adds a 1–5% castle tax on top of a 20% base, and the castle guild gets 40% of that pool. New World lets the ruling company set trading tax and crafting fees, changeable once every 24 hours. FFXIV lowers the seller tax (5%, 3% or 0%) in cities with fewer retainers to spread them out.
5. **New and untrusted accounts are the main fraud and RMT channel, and every large game restricts them.** Lost Ark blocks untrusted accounts (created after 14 Dec 2022) from the auction house, market and all player-to-player trade, and limits every roster to 20 new listings a day. Albion's gold-limits page (search summary) lists a new account selling 0 Gold on day 1, 500/day on days 2–5, 2,500/day on days 6–10 and 5,000/day after that, and also a status scheme (500/day after a purchase or Tier 3, 2,500/day after $30 in purchases and a 10-day check); support removes the limit after verifying a purchase of any amount. RuneScape limits never-member accounts to giving away 25,000 coins a day. GW2 makes new accounts wait 72 hours before using the currency exchange. Steam holds items for 7 days and can reverse the trade.
6. **Money bought with real cash has to wait before it can move.** Lost Ark holds gold bought through the currency exchange for 3 days, and also holds gold from Una's tokens on a paid Powerpass character and Rapport gold for 72 hours. Albion gives the 2,500/day tier only after $30 in purchases and a 10-day check. Steam requires a purchase at least 30 days old, 15 days of Steam Guard, and no new payment method in the last 7 days.
7. **Do not let trading replace the core loot loop.** Diablo III shut both of its auction houses on 18 March 2014 because trading was a quicker way to get loot than killing monsters. Its game director said at GDC 2013 that the auction houses "really hurt the game". Throne and Liberty and Lost Ark let players trade materials and base gear, but upgraded gear, raid gear and progression items stay bound.
8. **Watch the economy on a regular schedule and publish what you find.** EVE has published a Monthly Economic Report since 2016 covering faucets, sinks, money supply, velocity and a price index. OSRS shows what its item sink has deleted (the wiki totals about 5.7 trillion coins' worth of items). NetEase's GDC 2020 talk tracks production, consumption, stock, price, player-to-player trade and alerts.
9. **What this means for a one-person Thai mobile MMO:** build **one** central market engine (the in-town "stall" is just a storefront view of that engine), one direct-trade window that is taxed as heavily as the market, reference prices with bands, trust tiers for new accounts, a 7-day hold on anything bought with ทอง, an append-only ledger and one daily dashboard. Section 6 has concrete numbers in ตำลึง.

---

## 1. Benchmark table (numbers as of the sources' dates)

| Game | Trade channels | Seller-side fee | Buyer-side fee | Listing / deposit | Price controls | Throughput limits | Where the tax goes | Sources |
|---|---|---|---|---|---|---|---|---|
| **Guild Wars 2** | Trading Post (global), mail | 10% exchange fee on sale | none | 5% listing fee on the listing price, non-refundable (min 1 copper) | The seller's profit after fees must be at least the item's NPC vendor value (since 9 Sep 2014), so the lowest listing is about vendor value ÷ 0.85 | Max 250 units per transaction. Listing is rate-limited over short periods. Free accounts can trade only whitelisted items. | Removed from the game | [W] wiki.guildwars2.com/wiki/Trading_Post · [W] Talk/forum on minimum price |
| GW2 gem↔gold exchange | Currency exchange (pool-based) | 17.5% transaction fee, plus 1 extra gem when buying gems with gold | — | — | Rate moves with the size of the two pools | 9,999 gems or 999 gold per transaction. 72-hour wait for new accounts. Free accounts can only change gems to gold. | Removed | [W] wiki.guildwars2.com/wiki/Currency_exchange · [W] …/Free_account |
| **Black Desert** | Central Market only (no general trade window; only items marked "personal transaction available", such as some potions, can be traded directly, inside Central Market price limits) | 35% (seller keeps 65%). With the Value Pack (paid) the seller keeps 84.5%. Family Fame adds +0.5–1.5%. | none | — | Developer hard min/max caps. Base price ±7.5% (old). Asia TH/SEA renewal (notice of 30 Jan 2019): buy orders up to +10% over the standard price, sell listings at the standard price or up to 10% under it. Random winner among buy orders at the max price. About 15-minute delay for listings of certain items and all items at ≥20 billion silver (console 1.85, 16 Jun 2021). | Pearl (cash) items: 5 registrations a week, plus up to 30 more with Family Fame (35 at most). Only 1 pearl-item buy order at a time. Per-item buy order quantity caps. | Removed | [S] grumpygreen.cricket/bdo-central-market · [O] blackdesert.pearlabyss.com/ASIA/…/Detail?_boardNo=784 · [S] mp1st.com (1.85) |
| **Albion Online** | Local city markets, player buildings | 8% sales tax, or 4% with Premium (paid) | 2.5% setup fee on buy orders too | 2.5% setup fee on each sell order, paid when the order is created or changed | Free pricing | — | Removed | [S] albiononlinegrind.com market guide · [W] wiki.albiononline.com/wiki/Marketplace *(search summary)* |
| Albion Gold Market | Gold (paid) ↔ silver exchange | — | Purchase fee (%) since 15 Aug 2023, meant to stop gold hoarding | — | — The page (search summary only) shows two schemes. By account age: day 1 = 0 · days 2–5 = 500 · days 6–10 = 2,500 · day 10+ = 5,000. By status: none during the tutorial · 500/day after any purchase or reaching Tier 3 · 2,500/day after $30+ in purchases and a 10-day check. After support verifies a purchase of **any amount** (usually within 24 h, once per account) there is no limit. | — | [O] albiononline.com/gold-limits *(search summary)* · [S] mmos.com Gold Market purchase fees |
| **OSRS (Old School RuneScape)** | Grand Exchange, direct trade | 2% (was 1% from 9 Dec 2021, 2% from 29 May 2025), capped at 5,000,000 GP per item | none | — | No bands now. From 2007 to 2011 the GE allowed only ±5% of the guide price. | GE buy limits per item every 4 hours. Free-to-play accounts need 20 h of play, 10 quest points and total level 100 to sell bot-prone items. | Mostly deleted. Some funds an **item sink** that buys expensive items and deletes them. The wiki totals about 5.7 trillion coins' worth of items deleted by the sink (the value of items, not coins taxed). | [O] secure.runescape.com/m=news/grand-exchange-tax--item-sink?oldschool=1 · [W] oldschool.runescape.wiki/w/Grand_Exchange |
| **RuneScape 3** | GE, direct trade | 2% since 9 Jan 2023 (items sold below 50 coins and bonds exempt) | none | — | Guide price only | Never-member accounts can give away at most 25,000 coins of value a day (since 22 Nov 2011) | Removed | [W] runescape.wiki/w/Grand_Exchange *(search summary)* · [W] runescape.wiki/w/Trade_limit |
| **EVE Online** | Regional order-book markets, contracts | Sales tax 7.5% base (4%→7.5% in patch 22.02, 12 Mar 2025). The Accounting skill cuts it by 11% per level, to about 3.4% (3.375% by formula; the EVE Uni wiki writes 3.3%). | Broker fee on buy orders too | Broker fee 3% base at NPC stations, down to about 1% with skills and standings. **Structure owners set their own broker fee.** | Free pricing | — | NPC tax and NPC broker fees are destroyed. Broker fees in player structures go to the owner. In June 2019, 22% of broker fees stayed in the economy this way. | [W] wiki.eveuniversity.org/Tax · [O] eveonline.com/news/view/updates-to-sales-taxes-and-brokers-fees · [F] tagn.wordpress.com/tag/brokerss-fees |
| **Lost Ark** | Market (materials), Auction House (gear), direct trade, mail | 5% on sale | — | Refundable deposit that grows with listing length (up to 3 days) | Free pricing within listing rules | 20 new listings a day per roster. Untrusted accounts created after 14 Dec 2022 cannot use the auction house, market or any player-to-player trade (starting trades and sending mail were already blocked before). Selling trade-skill materials and some items needs a character at item level 1375 (Feb 2023). | Removed | [O] playlostark.com/…/wreck-the-halls-release-notes · [S] mmos.com, mmorpg.com (Feb 2023) · [S] gamepressure guide |
| Lost Ark currency exchange | Blue Crystal ↔ gold | 5% | — | — | Player-driven rate | Purchased gold is held 3 days: it cannot go by mail, trade, auction house, market or loot auction bids. Gold from Una's tokens on a paid Powerpass character and Rapport gold is held 72 h (3 Aug 2022). | — | [O] help.playlostark.com …/Currency-Exchange-Restrictions-for-Purchased-Gold *(search summary)* · [S] mmos.com gold withholding |
| **MapleStory (GMS)** | Auction House, direct trade, Meso Market (mesos ↔ Maple Points) | Auction House 5% (3% for MVP rank). Direct trade of mesos 5%. Meso Market 1% on sold mesos. | — | 2,000 meso deposit per listing | Free pricing | 30 listings per world (up from 10 on 24 Sep 2025, when the 48 h option was also added). 24 or 48 h duration. Cash items bought from the Auction House **become untradable** at once. | Removed | [W] maplestorywiki.net/w/Auction_House · /Meso · /Meso_Market |
| MapleStory KMS 2017 | Free Market (player shops) removed and folded into the Auction House | — | — | — | Unified fee "to prevent unusual transactions" | Player-shop cash items stopped selling 13 Nov 2017. The Free Market closed 23 Nov 2017. | — | [F] orangemushroom.net/2017/11/06/removal-of-the-free-market |
| MapleStory Heroic/Reboot worlds | **No player trading at all** (no trade, no drops to others, no Auction House, no Meso Market) | — | — | — | — | — | — | [S] maplestory fandom and wiki (Reboot World) |
| **Lineage II** | NPC shops taxed by castle lords, private stores | — | Castle tax added to NPC shop prices | — | Lord sets **0–15%** (C3 made it any number, not just 0/5/10/15) | — | Castle treasury (about 60% per a secondary source), paid weekly on Monday at 00:00 | [S] predator.ge castle guides · [W] wiki.l2ertheia.eu (castle) |
| Lineage II (Tauti) | Light and Dark castle choice | Dark castles: 30% on NPC sales | Dark castles: 10% on NPC purchases | — | Light castles 0% | Castles under Aden/Rune collect tax only if Aden/Rune chose Dark | Castle chest | [W] wiki.l2ertheia.eu/doku.php?id=general:castle |
| **Throne and Liberty** | Auction House paid in **Lucent (paid currency)** | 20% base + castle tax (**1–5%**, set by the castle guild) | — | Sollant listing fee, not refunded if the item does not sell | — | 30 listings. **Upgraded gear, dungeon and raid gear, and cash-shop items cannot be traded.** | Castle guild gets 40% of the castle-tax pool (secondary source). The rest is paid out through guild PvP events (Tax Delivery and the castle siege). | [O] playthroneandliberty.com/…/tl-business-model · [S] game8 · [S] mein-mmo.de · Steam discussion *(search summary)* |
| **New World** | Trading Post per settlement | Trading tax set by the ruling company | — | — | — | Rates can change once every 24 h | Company treasury (pays territory upkeep) | [W] newworld.fandom.com Territory_Governance *(search summary)* |
| **Final Fantasy XIV** | Market board through retainers | 0%, 3% or 5% by the retainer's city. The three starting cities are always 5%. Sources disagree on how often rates change: a community FAQ says at the weekly reset (or after maintenance), the consolegameswiki says daily. | **5% flat** | — (the phone app charges a paid-currency coin per listing action) | Free pricing | 20 listings per retainer | Removed. Players explain the lower seller rate as a way to spread retainers across cities (no official statement found). | [W] ffxiv.consolegameswiki.com/wiki/Market_Board · [F] forum.square-enix.com/ffxiv/threads/463574 · [O] companion-app help |
| **Ragnarok Online** | Vending stall (Merchant class skill), trade window, buying store | 5% only on items priced above 10,000,000 zeny | — | — | Max price 1,000,000,000 z (some servers 99,990,000 z). Must stand at least 4 cells from any NPC. | 3–12 item stacks by skill level. Needs Pushcart. | Removed | [W] irowiki.org/wiki/Vending |
| **Ragnarok M: Eternal Love** | Exchange with **system-set prices**, vending, auction house for rare items | 9% | — | Relisting after 24 h pays tax again | Prices set by the system from supply and demand. Vending ±50% of the market price. **Lottery "snap" period** for scarce items at the cap. | 8 slots. Only crafted, Rift, miniboss and MVP gear is listable. | Removed | [F] sites.google.com/view/ragnarok-mobile-newbie-book · [S] gamingph.com |
| **Diablo III RMAH (2012–2014)** | Real-money AH + gold AH | RMAH: $1 per gear sale, 15% on commodities, plus 15% to cash out to PayPal | — | — | $250 cap on the Battle.net Balance and on any bid | 10 listings at once *(search summary, not checked)* | Blizzard revenue | [S] kotaku.com (1 May 2012) · [O] news.blizzard.com/…/diablo-iii-auction-house-update |
| **WoW Token** | Paid token sold for gold at the auction house | Price set by Blizzard's algorithm. A token bought with cash can be sold once. A token bought with gold can only be used. | — | — | System price | — | Gold goes to the seller. Blizzard sells the token. | [F] us.forums.blizzard.com · [S] token trackers |
| **OSRS Bond** | Paid token, tradable | Exempt from GE tax | — | Once traded it becomes untradable. Making it tradable again costs 10% of its GE value. | — | — | — | [W] oldschool.runescape.wiki/w/Old_school_bond |
| **EVE PLEX** | Paid item sold for ISK (legal RMT since 2008). Global PLEX market from 2025. | Normal market taxes | — | — | Free pricing | — | — | [F] nosygamer.blogspot.com/2025/04 · [O] eveonline.com/news/view/global-plex-market-and-friction-free-trade |
| **Steam (CS2 items)** | Community Market + trades | 5% Steam fee plus a game fee (10% for CS2), about 15% in total | — | — | — | **Trade Protection (July 2025):** traded items are held 7 days and the trade can be reversed. Reversing brings a 30-day trade and market ban. Market needs 15 days of Steam Guard, a purchase at least 30 days and at most 1 year old, no password reset in 5 days, and no new payment method in 7 days. | — | [O] help.steampowered.com FAQs (titles) · [S] skinflow.gg, tradeit.gg *(search summaries)* |
| **NetEase Fantasy Westward Journey** | Official real-money trading site (藏宝阁 "Treasure Pavilion") | about 5% seller fee (5–10% by game and item; characters up to 10%) *(secondary)* | — | — | **4 × 24 h publicity period** for items and pets before the sale completes (none for coins and characters) | Security token binding | NetEase | [S] baike.baidu.com/en/item/Treasure%20Pavilion *(search summary)* |

---

## 2. Game-by-game notes and lessons

### 2.1 Guild Wars 2: a two-part fee, a floor at NPC price and a pooled currency exchange
- **Fees:** 5% listing fee (paid up front, non-refundable, minimum 1 copper) plus 10% exchange fee on sale, 15% in total. The listing fee is charged on the listing price when the item is listed, and the exchange fee when it sells. [W] wiki.guildwars2.com/wiki/Trading_Post
- **Why two parts:** the up-front, non-refundable part stops players from listing and cancelling over and over, and from underbidding by 1 copper. Only the sale fee grows with success.
- **Floor at NPC value:** since 9 Sep 2014 the seller's profit after both fees must be at least the item's NPC vendor value, so the lowest listing price is about vendor value ÷ 0.85. The market never undercuts the NPC buy-back, so selling to the NPC stays a real floor and very cheap handovers stop. [W] Trading Post page and forum threads
- **Throughput:** 250 units per transaction and a limit on listings in a short period. Free accounts can trade only a whitelist, cannot send coin or items by mail, and can only change gems to gold. The stated reason is to stop malicious use and encourage buying the game. [W] wiki.guildwars2.com/wiki/Free_account
- **Gem↔gold exchange:** a pool-based rate with a 17.5% fee (a round trip loses about 32%), capped per transaction, and closed to new accounts for 72 hours "to help combat botting and scams". [W] wiki.guildwars2.com/wiki/Currency_exchange
- **Economist practice:** ArenaNet had a staff economist (John Smith, from before the 2012 launch until April 2017) who wrote public economy posts. The team added limited-time Mystic Forge recipes to use up surplus items, and treated a large exploit (a karma vendor priced a weapon at 21 karma instead of 35,000, and 4,862 players bought 1.46 million of them; post of 14 Sep 2012) differently from single players who got a cheap item. [O] guildwars2.com/en/news/john-smith-on-the-state-of-the-guild-wars-2-economy/
- **Lesson:** use a small up-front fee plus a larger sale fee, and set the price floor at the NPC buy-back price.

### 2.2 Black Desert: high tax, no direct trade, hard caps and random allocation
- **35% tax**, so the seller keeps 65% (the GrumpyG guide gives only the 35% total; I found no source for a 30% + 5% split). With the paid **Value Pack** the seller keeps 84.5%, a 30% bonus on the net, not a lower tax. Family Fame adds +0.5–1.5%. [S] grumpygreen.cricket/bdo-central-market
- **Almost no direct player-to-player trading.** The Central Market is the only way to exchange most items. Only items marked "personal transaction available" (a few, such as some potions) can be traded directly, and those trades use Central Market price limits. Community and press explain this as the main reason RMT is low and the reason 35% can be charged. [S] theriagames/dottz guides *(search summary)*
- **Price bands:** under the old system the base price could move ±7.5% per step, inside **developer max/min caps that players cannot move**. The Asia (TH/SEA) renewal (notice of 30 Jan 2019) allows buy orders up to +10% over the standard price and sell listings at the standard price or up to 10% under it. The standard price adjusts "fluidly to the transaction volume". [O] blackdesert.pearlabyss.com/ASIA/en-US/News/Notice/Detail?_boardNo=784
- **Allocation:** normally the highest buy order wins, and ties go to the earliest. When two or more buy orders sit at the developer max price, the winner is **random**. Enhanced items are delivered at the lowest enhancement in the group. [S] GrumpyG · [O] Asia GM notes
- **Anti-RMT logic:** the caps stop an RMT seller from listing a worthless item at a huge price for a paying customer to buy, which would move silver outside any control. The random winner at the cap means a seller cannot promise a buyer a specific item. [S] search summary of community explanations
- **Cash items (Pearl items):** outfits bought with real money can be sold on the market for silver. Registration is limited to 5 a week, plus up to 30 more with Family Fame (35 at most, reset Monday 00:00 UTC), and only one pearl-item buy order at a time. Pearl-item caps are adjusted from time to time (for example the maximum price of Pearl outfits was raised about 1.8× on 8 May 2024, per a search summary of the official notices). [S] GrumpyG · [O] BDO console/Asia notices (titles)
- **Delay on huge listings:** update 1.85 (console, 16 Jun 2021) added about 15 minutes before listings of certain items and of all items at ≥20,000,000,000 silver can be bought. [S] mp1st.com
- **Lesson:** a high tax is only possible when the market is the only channel. Hard caps plus a random winner at the cap are the strongest anti-RMT tools that need no staff.

### 2.3 Albion Online: a setup fee on both sides, cheaper tax with Premium, and gold limits for fraud
- **Setup fee 2.5%** on both buy and sell orders, paid when the order is created or changed. **Sales tax 8%, or 4% with Premium.** A full flip therefore costs at least about 9% in fees. [S] albiononlinegrind.com · [W] Albion wiki *(search summary)*
- **Gold Market purchase fee** (15 Aug 2023): a percentage added to silver→gold purchases "to discourage the hoarding of Gold". Premium bought with gold is exempt. [S] mmos.com
- **Gold limits against stolen cards:** the official page says gold sellers buy Gold with stolen cards and use it before the chargeback lands. Daily Gold sale limits rise with account age (0 → 500 → 2,500 → 5,000). The same page also lists limits by status: none in the tutorial, 500/day after any purchase or reaching Tier 3, and 2,500/day after $30+ in purchases and a 10-day check. After a purchase of **any amount**, a player can ask support for verification, usually done within 24 h and once per account, which removes the limit. [O] albiononline.com/gold-limits *(search summary)*. Albion also publicly announced a ban wave (forum title: 2,029 accounts banned for third-party currency transactions, April 2021).
- **Owner-set fees:** the owners of crafting buildings earn usage fees. Since 24 Nov 2020 these are silver per 100 nutrition used (before, a percentage). [O] devtrackers.gg (Lands Awakened)
- **Lesson:** a paid perk that lowers the market tax (Premium, Value Pack, MapleStory MVP) is standard and accepted. Limits on how fast new accounts can move money are the main defense against chargebacks.

### 2.4 RuneScape and OSRS: a low tax, an item sink and the free-trade lesson of 2007–2011
- **OSRS tax:** 1% from 9 Dec 2021, then 2% from 29 May 2025, capped at 5M GP per item. At 2% the tax rounds down, so items sold below 50 coins pay nothing (below 100 coins at 1%). Basic tools, some cheap consumables and bonds are exempt. [O] Jagex news · [W] OSRS wiki
- **Item sink:** part of the tax buys selected high-end items from players and deletes them, to hold up their prices. Jagex started with a short list to watch the money flowing in and out. The wiki lists items worth about **5.7 trillion coins** deleted by the sink (the value of the items, not the coins taxed), and says "probably" well over half the taxed coins are simply destroyed. [O] Jagex news · [W] OSRS wiki
- **RS3:** 2% since 9 Jan 2023. Items sold below 50 coins and bonds are exempt. [W] RS wiki *(search summary)*
- **Free trade removed and restored:** in December 2007 Jagex added trade limits and removed free trade and the Wilderness to fight gold farming. The first limit was 3,000 coins. Later it was 10,000 coins every 15 minutes for free players and up to 60,000 every 15 minutes for members with quest points. In a 2011 poll more than 1.2 million players voted and 91% said yes, and free trade came back on 1 Feb 2011 after Jagex had better bot detection. The GE's ±5% price limits were removed at the same time. On 22 Nov 2011 a lasting limit followed: never-member accounts cannot give away more than 25,000 coins of value a day. [W] runescape.wiki/w/Trade_limit · [S] gamedeveloper.com · [W] RS GE history *(search summary)*
- **Buy limits every 4 hours** per item stop anyone cornering a market and slow the flood of botted goods. Free-to-play accounts need 20 h of play, 10 QP and total level 100 before selling logs, ores or raw fish. [W] OSRS wiki
- **Lesson:** blanket trade bans hurt the game more than they hurt RMT. Limit **new or non-paying accounts** and **bot-prone items** instead. Funding an item sink from the tax is an automatic stabilizer.

### 2.5 EVE Online: fee size as a policy lever, owner-set fees and the Monthly Economic Report
- **Current base:** sales tax 7.5% (raised from 4% on 12 Mar 2025, patch 22.02), cut to about 3.4% at Accounting V (3.375% by the 11%-per-level formula; the EVE Uni wiki writes 3.3%). Broker fee 3% at NPC stations, down to about 1% with skills and standings. In player-owned structures the **owner sets the broker fee**. [W] wiki.eveuniversity.org/Tax
- **History of raising taxes:** on 29 Jul 2019 CCP raised the maximum sales tax from 2% to 5%, the NPC broker fee from 3% to 5%, and the combined maximum from 5% to 10%. [O] eveonline.com/news/view/updates-to-sales-taxes-and-brokers-fees
- **Size of the sink:** in June 2019 broker fees and transaction tax together removed about 21.5 trillion ISK, **about a third of all ISK removed that month**, and were the two largest sinks. 22% of broker fees were paid in player structures and stayed in the economy. [F] tagn.wordpress.com/tag/brokerss-fees/
- **MER (since 2016):** faucets and sinks by category (bounties, commodities, missions / transaction tax, broker fees, skill books, manufacturing, insurance), money supply, ISK velocity, the Mineral Price Index, production, mining and destruction, with downloadable data. [O] eveonline.com/news/t/monthly-economic-reports · [W] adam4eve.eu · [S] medium/vanguard
- **Warnings from outside readers:** the money supply almost doubled in 4.5 years (2,614.5 trillion ISK in Nov 2025, +7.5% year on year). Three reports in a row (Sep–Nov 2025) used the wrong end-of-month date, so verify the data behind every chart. A May 2026 commentary asks for evidence before acting against money growth, because squeezing players cost CCP logins before. [F] nosygamer.blogspot.com/2025/12 · [F] tagn 2026/06
- **PLEX (legal RMT since 2008):** PLEX rose from 2.55M ISK (May 2017) to about 6.1M ISK (Apr 2025). The higher the ISK price of PLEX, the less real money CCP earns per player who needs a fixed amount of ISK. CCP has since added more PLEX as rewards and moved it to a single global market in 2025. [F] nosygamer 2025/04 · [O] eveonline.com global PLEX market
- **Lesson:** market fees are a large sink only when a lot of money trades on the market. They are also a lever you can move openly with a published reason. If you ever add a paid-to-soft bridge, soft-currency inflation directly changes your revenue.

### 2.6 Lost Ark: trust gates, per-day listing caps and holds on purchased money
- **Fees:** 5% on sale plus a refundable deposit that grows with listing length (up to 3 days), to stop floods of unrealistic listings. [S] gamepressure guide
- **Wreck the Halls (14 Dec 2022):** untrusted accounts are barred from the auction house, market and all player-to-player trading. Before this they were already unable to start trades or send mail. The new rule applies only to accounts created after the update. An account becomes trusted **either** by using Steam Guard mobile on a non-limited Steam account **or** by making any purchase. Other changes the same month: **20 new listings a day per roster**, and some quest rewards paid in silver instead of gold. [O] playlostark.com/en-us/news/articles/wreck-the-halls-release-notes. The same release notes say "millions of bot accounts" had been banned over the previous few months. [O] release notes
- **Item-level gate (Feb 2023):** selling trade-skill materials and a list of high-value items (Solar Grace/Blessing/Protection, crystallized stones, honor leapstones, gems levels 1–10, and others) needs a character at item level 1375 on the roster. [S] mmorpg.com (8 Feb 2023) · mmos.com (22 Feb 2023)
- **Holds on purchased money:** gold from the currency exchange is held **3 days**, during which it cannot be used for mail, private trades, the auction house, the market or loot-auction bids. "Unsafe" Royal Crystals keep the hold. The criteria are not published. Gold from Una's tokens on a paid Powerpass character and Rapport gold are held 72 h (3 Aug 2022). [O] help.playlostark.com *(search summary)* · [S] mmos.com
- **Lesson:** combine a trust gate (verification **or** a purchase), a daily listing cap, an item-level gate on bot-farmed goods and a hold on money bought with cash. A one-person team can run all of this automatically.

### 2.7 MapleStory: a flat deposit, cash items that trade once, and a paid-currency market
- **Auction House:** 2,000 meso deposit plus 5% on sale (3% for MVP), 30 listings, 24 or 48 h. A cash item bought from the Auction House **becomes untradable at once**, so a cash item can change hands for mesos only once. [W] maplestorywiki.net/w/Auction_House
- **Direct trade:** mesos passed in a trade are taxed 5%. [W] maplestorywiki.net/w/Meso
- **Meso Market (GMS, May 2017):** players swap mesos for Maple Points (paid) with each other, 1% fee on mesos sold, in a closed pool where the system creates neither side. It is not available in Heroic worlds. [W] maplestorywiki.net/w/Meso_Market
- **KMS 2017:** the player-shop Free Market was removed (closed 23 Nov 2017) and folded into the Auction House to end the confusion of two markets and to apply one fee "to prevent unusual transactions". [F] orangemushroom.net
- **Heroic/Reboot worlds:** no trading at all. This is another model (solo progression), but it does not match the owner's decision for free trading.
- **Lesson:** "tradable once" is the standard control for cash-bought items. One channel with one fee is easier to police than several.

### 2.8 Lineage II, Throne and Liberty, New World: taxes set by territory owners
- **Lineage II:** the castle-owning clan sets a tax of 0–15% (any value since C3) that is added to NPC shop prices in its territory. Grocery shops (soulshots, spiritshots) and weapon shops are the base of it. Players shop in the cheaper town, so lords compete on rate. Tax goes into the castle chest weekly (Monday 00:00). [S] predator.ge · [W] l2ertheia wiki. The Tauti revamp replaced this with Light castles (0%) and Dark castles (30% on NPC sales, 10% on NPC purchases), and castles under Aden and Rune collect only if Aden or Rune chose Dark. [W] l2ertheia wiki
- **Throne and Liberty:** 20% base tax plus a castle tax of 1–5% set by the castle guild. The castle guild gets 40% of the castle-tax pool (secondary source), and the rest goes to guild PvP events (Tax Delivery and the castle siege), where the Lucent goes to whoever wins. The auction house trades in **Lucent (paid currency)**, and cash-shop items cannot be traded. [O] playthroneandliberty.com business model · [S] mein-mmo.de · [S] Steam discussion *(search summary)*
- **New World:** the ruling company sets trading tax, crafting and refining fees and a weekly property tax at the Governor's Desk, **no more than once a day**. The money pays territory upkeep, and income is shown hourly. [W] New World wiki *(search summary)*
- **FFXIV:** not an owner system, but a rate that changes by location. The seller tax is 0, 3 or 5% by the retainer's city (starting cities always 5%). Sources disagree on whether it changes weekly or daily, and players (not Square Enix) explain that it is lower where fewer retainers are placed. The buyer pays 5% flat. [W] consolegameswiki · [F] SE forum
- **Lesson for our city war:** give the capital holder a **small added rate (1–5%)** that can be changed **once per 24 h**. Pay out only **part** of it (TL 40%), and make it visible so traders can react. Most of the tax should still come from the fixed system base and be destroyed.

### 2.9 Ragnarok Online and Ragnarok M: the stall feel Thai players know
- **RO vending:** a Merchant-class skill with 3–12 stacks and a Pushcart. Stalls must stand at least 4 cells from any NPC. A 5% commission applies only above 10,000,000 zeny. Max price 1,000,000,000 z (some servers 99,990,000 z). There is also a buying store and a trade window. [W] irowiki.org/wiki/Vending
- **Ragnarok M:** 9% exchange tax. **The system sets the price** from supply and demand. Listings last 24 h and pay tax again on relist. Vending may deviate ±50%. Scarce items go into a **snap period with a lottery**: in one case 2 Eclipse Cards and 162 buyers, so 2 won. Only crafted, Rift, miniboss and MVP gear can be listed. Rare cards moved to a separate premium auction house. [F] ROM newbie book · [S] gamingph.com
- **Lesson:** Thai players are used to "เปิดร้าน" stalls and exchange lotteries. The reference game 3kingdoms.in.th has stalls and a trading station (economy.json / doc_money). A stall can simply be a **map-visible storefront of one central market engine**, so it keeps the feel at almost no extra server or anti-RMT cost.

### 2.10 Diablo III auction houses: why they were closed
- The RMAH launched in 2012 with a $1 fee per gear sale, 15% on commodities, another 15% to cash out to PayPal, and a $250 cap on the Battle.net Balance and on any bid. [S] kotaku.com, 1 May 2012
- Game director Jay Wilson said at GDC 2013 that both auction houses (real money and gold) "really hurt the game". More than 50% of players used them regularly, and Blizzard said it would turn them off if it could. [S] PC Gamer / Engadget *(search summary)*
- Closure was announced on 17 Sep 2013 (press coverage on 18 Sep) and happened on **18 Mar 2014**. John Hight said the auction houses undermined the core loop of killing monsters for loot and short-circuited the reward loop. Loot 2.0 replaced them. [O] news.blizzard.com/en-us/article/10974978 · [S] nbcnews.com
- **Lesson:** never let the market become the easiest source of top progression gear. Keep finished power (enhanced, socketed, set, legendary) bound or trade-once, and let trade move **materials and base gear**.

### 2.11 Paid-to-soft bridges (for reference only: the owner decided ทอง is not traded between players)
| Game | Bridge | Control |
|---|---|---|
| GW2 | Gems↔gold pool exchange | 17.5% fee, per-transaction cap, 72 h for new accounts |
| Lost Ark | Royal→Blue Crystals↔gold exchange | 5% fee, 3-day hold on purchased gold, daily purchase limits *(secondary)* |
| EVE | PLEX sold for ISK | Normal market fees. The ISK price of PLEX is a revenue risk. |
| WoW | WoW Token | System-set price. A cash-bought token can be sold once. |
| OSRS | Bond | Trades once, then 10% of its value to make it tradable again. GE tax exempt. |
| MapleStory | Meso Market | 1% fee, closed pool |
| BDO | Pearl items on the market for silver | Weekly registration cap, price caps, 35% tax |
| TL | The auction house itself runs on paid currency | 20% + castle tax |
| D3 | Real money for items (closed) | Hurt the game and was closed |

What they share: each bridge is **one channel run by the system**, with a **fee**, a **cap or hold**, and usually **one trade per unit**. Official bridges reduce the demand for gray-market RMT but make buying power in the game more visible.

### 2.12 Anti-RMT and fraud controls: the pattern
| Control | Examples | What it stops |
|---|---|---|
| Trust tier for new accounts (verify or pay) | Lost Ark trusted, Albion trusted, Steam Guard 15 days | Bot farms, stolen-card fronts |
| Money that can move grows with account age | Albion 0/500/2,500/5,000 gold a day, RS 25k/day | Fast cash-out of stolen or botted money |
| Hold on money or items bought with cash | Lost Ark 3 days, Steam 7 days + reversal, Albion 10-day check for the $30 tier | Chargebacks after a trade |
| Tradable once, then bound | MapleStory cash items, OSRS bond, WoW Token | Laundering chains |
| Price bands and developer caps | BDO, ROM system prices, GW2 NPC floor, early RS ±5% | Moving value through overpriced junk or underpriced gems |
| Random winner at the cap and a publicity delay | BDO random, ROM snap lottery, BDO 15-minute delay, NetEase 4-day publicity | Pre-arranged handovers to a paying customer |
| Daily listing caps and buy limits | Lost Ark 20/day, OSRS 4-hour buy limits, GW2 listing rate | Bot dumping, cornering a market |
| Item-level gate on bot-prone goods | Lost Ark 1375, OSRS F2P 20 h/10 QP/100 total | Sales by fresh bot accounts |
| Block money in mail for untrusted accounts | GW2 F2P, Lost Ark untrusted | Gold delivery by mail |
| Ban waves and public notices | Lost Ark >1M bots, Albion 2,029 accounts | Deterrence |
| Never remove trade for everyone | RS 2007–2011 reversal | Unintended harm to the game |

### 2.13 Watching for inflation: current practice
- **What to measure:** money created by source (faucets), money destroyed by source (sinks), net, total money supply, velocity (market volume ÷ money supply), a fixed-basket price index (EVE Mineral Price Index), and production, consumption and stock of key items. [O] EVE MER · [O] GDC Vault 1026913 (NetEase, GDC 2020: production, consumption, storage, price, player trade, risk alerts)
- **Automatic stabilizers:** the OSRS item sink, GW2's limited recipes that use up surplus items, Albion's purchase fee against hoarding, EVE's tax changes.
- **Transparency:** EVE publishes monthly with data files, GW2's economist wrote public posts, OSRS reports how much the sink removed. Published numbers cut rumours and let players trust tax changes.
- **Caveat:** check the data behind every chart (the EVE MER errors in Sep–Nov 2025). Money growth is not always bad, and a squeeze can cost logins. [F] nosygamer, tagn

---

## 3. How big can a market-tax sink be in our game? (rough numbers)

Inputs from economy.json (renamed ทอง → ตำลึง): a mid player earns about **19,300–25,000 ตำลึง a day** counting cash only, or 33,600–45,000 counting supply value (numeric_checks). Assume 1,000 DAU.
- Money created ≈ 1,000 × ~20,000 = **~20,000,000 ตำลึง a day**.
- If 20–40% of earnings changes hands on the market or in direct trade (volume 4–8M a day) and the effective tax is about 11%, the market sink is **0.44–0.88M a day, about 2–4.5% of money created**.
- **Conclusion:** the market tax **cannot** be the main sink. Enhancement, NPC shops, titles (15.7M for tiers 9–14) and army upkeep must remove most of the money. The tax exists to (a) add friction against flipping, bots and RMT, (b) give a lever you can move openly, and (c) feed the city-owner reward and a system buy-back sink. Raising the tax toward BDO levels would mostly push trades into the trade window or to outside RMT. It is safe only if the market is the **only** channel (BDO), and that conflicts with "free trading".
- EVE's sink share (about 1/3 of all sinks) shows that fees become a large sink only when nearly everything is bought from players at high velocity.

---

## 4. Choices this research points to (for the owner)

| # | Decision | Options | Recommended |
|---|---|---|---|
| D1 | Channels at the Thai launch | (a) Central market only (BDO) · (b) Market + trade window (MapleStory/RO) · (c) + physical vending stalls | **(b), plus "stalls" as a storefront view of the same market engine** (matches the reference game's feel with one backend) |
| D2 | Tax level | 5% (Lost Ark) · 10–15% (GW2/Albion/EVE) · 20–35% (TL/BDO) | **10% fixed system part (1% listing + 9% sale), plus 0–5% set by the capital holder.** Total 10–15%, inside the blueprint's 10–20% proposal (m5zp5ngnhqs.6406) |
| D3 | Direct-trade tax | 0 · the same as the market · higher | **10% on ตำลึง handed over, paid by the giver**, plus a small item-swap fee. Never lower than the market. |
| D4 | Price control | Free · ±band + developer caps · system-set price (ROM) | **±30% band around a reference price that moves at most 10% a day, a floor at the NPC buy-back price, a hard ceiling per item tier, and a random winner at the ceiling** |
| D5 | Paid perk that lowers the tax | none · monthly card −2 points | Optional: **monthly card lowers the 9% sale tax to 7%**, never the city tax (precedent: Albion, BDO, MapleStory) |
| D6 | ทอง→ตำลึง bridge | none · a token like the WoW Token or PLEX · cash items trade once | **None at launch.** Later maybe **cosmetic cash items that trade once** (MapleStory/BDO style) with a 7-day hold and a weekly cap |
| D7 | Market timing | Phase 5 (current proposal) · before the Thai launch | **Before the Thai launch**, because trading is now core. Keep a region switch to close the market (Vietnam and Indonesia rules in the gap tab) |

---

## 5. Lessons for a small Thai mobile MMO run by one developer

1. **One engine, several views.** Build one order book for listings and buy orders. The stall in town, the market tab and the item's "sell" button are all views of it. MapleStory KMS merged its two markets for the same reason, and one fee is easier to audit.
2. **Automate every rule. No staff should need to approve trades.** Bands, caps, the lottery, trust tiers, holds and daily caps are all server rules. Manual review only for flagged accounts (the ladder already in the gap tab: warning → trade lock → ban, m5zp5ngnhqs.16056).
3. **Tax the seller where possible and show the net.** Players accept fees they see as "you will receive X". Charge a small non-refundable listing fee against spam (GW2 5%, Albion 2.5%, TL listing fee), and keep the sale tax at 8–10% (Albion 8%, GW2 10%, EVE 7.5%).
4. **Tax the trade window at least as much as the market.** Otherwise the window becomes the RMT pipe. MapleStory charges 5% on mesos in direct trades. RuneScape caps what new accounts can give.
5. **Treat the reference price and band as your main anti-RMT tool.** BDO and ROM show it works with no staff. Add a random winner at the ceiling and a short publicity window for rare items.
6. **Gate new accounts, not everyone.** RuneScape 2007–2011 showed that removing free trade for all players backfires. Use Lost Ark and Albion style tiers.
7. **Hold anything bought with ทอง before it can move.** PromptPay/QR payments are usually push payments with lower chargeback risk than cards (confirm with the gateway). Card-funded items should still wait 7 days (Steam). ทอง itself never moves between players (owner decision).
8. **Trade materials, not finished power.** Diablo III and Throne and Liberty: enhanced, socketed or set gear, war rewards, 軍功-related items, generals and horses stay bound. This protects the blueprint's rule that money cannot buy 軍功 or war progress (doc_money §12).
9. **Measure daily and publish monthly.** One SQL job over the append-only ledger (already proposed, m5zp5ngnhqs.8728) is enough for a solo developer.
10. **Pay the owner's share of the city tax in a limited form.** The TL castle guild gets 40% of its pool. Cap it weekly so capital holders cannot snowball (economy.json problem on the King's 100,000/day).

---

## 6. Proposed trading rules for our game (all numbers are drafts for the blueprint)

UI names in plain Thai (no Chinese characters): **ตลาดกลาง** (central market) · **แผงร้าน** (a player's stall view) · **ลงขาย** (list) · **ตั้งรับซื้อ** (buy order) · **แลกของ** (trade window) · **ราคากลาง** (reference price) · **กรอบราคา** (price band) · **ค่าลงขาย** (listing fee) · **ภาษีการค้า** (sale tax) · **ภาษีเมืองหลวง** (capital tax) · **ช่วงประกาศขาย** (publicity window) · **จับฉลาก** (lottery) · **ระดับบัญชี** (trust tier) · **ของผูกตัว** (bound) · **ขายต่อได้ 1 ครั้ง** (trade-once) · **ช่วงรอยืนยัน** (hold).

### 6.1 Channels
| Channel | Rules |
|---|---|
| **ตลาดกลาง** (one per server) | Listings and buy orders in ตำลึง only. Open to buyers at Lv 10. Selling needs trust tier 1 (6.5). |
| **แผงร้าน** | The seller's own listings shown as a stall on the town map (RO feel). Same listings, fees and bands. Opening a stall is **not** a separate shop and needs no extra item. |
| **แลกของ** | Two players within 10 m. Each side confirms twice. The screen shows the ราคากลาง of each item and warns when ตำลึง are more than 50% away from the total ราคากลาง. |
| Mail | System mail only. Players cannot send ตำลึง or items by mail. Guild or alliance warehouse distribution stays as already designed (m5zp5ngnhqs.5243) and is logged. |
| Dropping items on the ground | Other players cannot pick them up. |

### 6.2 Fees
| Fee | Rate | Notes |
|---|---|---|
| ค่าลงขาย | **1%** of the listed price, **minimum 10 ตำลึง** | Paid when listing. **Not refunded** on cancel or expiry. Charged again on relist (GW2, TL, ROM). |
| ภาษีการค้า | **9%** of the sale price, taken from the seller | Always destroyed. Optional perk: monthly card 7% (D5). |
| ภาษีเมืองหลวง | **0–5%**, set by the capital holder (the 相國 seat, shown to players as "เสนาบดีสูงสุด") | Can change **once per 24 h** at 05:00. Shown in the listing window. **50% to the holder alliance's treasury as bound ตำลึง, capped at 3,000,000 a week. The rest is destroyed.** Before phase 5, when the capital war exists, the rate is 0%. |
| ภาษีแลกของ | **10%** of the ตำลึง handed over, paid by the giver | Item-for-item swaps: **2% of the total ราคากลาง** of the items (minimum 50 ตำลึง), paid by whoever starts the trade |
| Exemptions | Items with ราคากลาง < 100 ตำลึง, and basic potions and food | Like OSRS's cheap-item exemption |
| Per-item tax cap | 5,000,000 ตำลึง | Like the OSRS cap. It mainly calms fears on very large trades. |

A seller who lists at the ราคากลาง and sells, with city tax at 3%, keeps **87%**. Total friction is 13%, inside the blueprint's 10–20%.

### 6.3 Price controls
- **ราคากลาง** for each tradable item: the volume-weighted average of the last 24 h, when there were at least 5 sales. Otherwise it keeps the previous value. It moves **at most ±10% a day** (BDO ±7.5% per step, ±10% band). At launch it starts from **1.5 × the NPC buy-back price** (materials) or a designer value (gear).
- **Listing band:** 70–130% of the ราคากลาง (the blueprint's ±30% proposal, m5zp5ngnhqs.47260).
- **Hard floor:** never below the NPC buy-back price (GW2 since 2014; GW2 applies it to the seller's money after fees, so its lowest listing is about NPC price ÷ 0.85. We can choose either form, but the after-fees form keeps the market from ever paying the seller less than the NPC).
- **Hard ceiling:** a designer maximum per rarity tier that the market cannot push past (BDO developer caps).
- **ตั้งรับซื้อ:** up to the top of the band. The highest price wins and ties go to the earliest. When 2 or more buy orders sit at the hard ceiling, the winner is drawn at random (BDO).
- **Rare items** (red items, or ราคากลาง ≥ 500,000 ตำลึง): a **30-minute ช่วงประกาศขาย** before the item can be bought. Everyone who reserves during that window at the listed price enters a **จับฉลาก** (ROM snap, BDO 15-minute delay). The seller cannot choose the buyer.
- **Listable items:** only items marked tradable (6.6). Junk that exists only to sell to NPCs cannot be listed (ROM rule).

### 6.4 Throughput limits
| Limit | Value | Precedent |
|---|---|---|
| Active listings | 20 per character (tier 1: 10) | MapleStory 30, TL 30, FFXIV 20 per retainer |
| New listings | 30 a day per account | Lost Ark 20 a day per roster |
| Active buy orders | 10 | — |
| Listing length | 48 h | MapleStory 24/48 h, ROM 24 h |
| Buy limit on bot-prone materials | per item per 4 h (for example 200 enhancement stones) | OSRS 4-hour limits |

### 6.5 Trust tiers (ระดับบัญชี)
| Tier | Condition | Market | แลกของ (giving ตำลึง) |
|---|---|---|---|
| 0 New | Below Lv 20 **or** under 48 h since the account was created | Buy only | Items only. Cannot give ตำลึง. |
| 1 General | Lv 20+ **and** account at least 2 days old | Sell up to 10 listings | Give **up to 20,000 ตำลึง a day** (about one day of a mid player's cash income. RS 25k/day) |
| 2 Verified | Lv 40+ **and** account at least 7 days old **and** (phone OTP **or** a top-up more than 7 days old) | Full limits | Give up to 300,000 ตำลึง a day. Above that, the trade needs the 6-digit PIN already proposed (m5zp5ngnhqs.26054). |
| Locked | RMT flag, chargeback, or account binding changed in the last 72 h (m5zp5ngnhqs.26054) | None | None |

Lost Ark lets players become trusted through **either** Steam Guard verification **or** any purchase. Albion lifts its gold limit after support verifies a purchase of any amount. Keep a free route (OTP plus playtime) so free players are not locked out.

### 6.6 What can be traded
| Category | Rule |
|---|---|
| Materials from farming or bosses (ores, stones, gems, horse fodder, set pieces) | Tradable (blueprint gap proposal m5zp5ngnhqs.45944) |
| Base gear (+0, no sockets) that dropped | Tradable. **Enhancing, socketing or equipping it binds it.** |
| Red/legendary gear, war rewards, anything tied to 軍功 or rank, generals, horses, fashion | **Bound** (doc_money §12. D3 and TL lesson) |
| Items bought from NPC shops, events, codes, the battle pass, the cash shop | Bound (existing gap proposal) |
| Optional later: unopened cosmetic boxes bought with ทอง | **Tradable once**, only by tier 2, after a **7-day ช่วงรอยืนยัน**, **5 listings a week** per account (BDO 5 a week). Bound after the first sale. |
| ทอง | Never tradable and never convertible to ตำลึง (owner decision) |

### 6.7 Chargebacks and fraud
- Every ทอง credit records its payment method. Items bought with card-funded ทอง are marked "not movable for 7 days".
- On a chargeback: lock the account → take back the ทอง (the balance may go negative) → **reverse** any trades of affected items or the ตำลึง from them made in the last 7 days where possible (Steam model) → review by hand.
- Ledger signals, checked daily: (a) one account receiving ตำลึง from 10 or more tier 0–1 accounts in 24 h · (b) accounts that give more than 5× what they receive · (c) repeated sales between the same two accounts at the band edge · (d) direct trades more than 50% away from the ราคากลาง · (e) clusters on one device, IP or ASN (fingerprint idea already in gap m5zp5ngnhqs.16056).
- A public ban notice with counts (Lost Ark, Albion), with no names.

### 6.8 System buy-back (item sink)
- Put **10% of the ภาษีการค้า collected each day** into a budget for **ทางการรับซื้อ** (official buy-back). The system places buy orders at the band floor for up to 5 over-supplied materials chosen weekly, and deletes what it buys (OSRS item sink). This props up prices when bots flood and removes excess items. The other 90% of the tax is destroyed outright.

### 6.9 Daily economy dashboard (one SQL job over the ledger)
| Metric | Alert |
|---|---|
| ตำลึง created by source (quests, stipend, fief income, monster drops, NPC buy-back) and destroyed by source (enhancement, NPC shops, titles, army upkeep, ค่าลงขาย, ภาษีการค้า, city tax destroyed, buy-back) | faucet:sink > 1.3 for 3 days (already proposed, m5zp5ngnhqs.45344) |
| Money supply, total and per DAU. Median wealth, and the share held by the top 1% | Median wealth +20% a week |
| Market volume and velocity (volume ÷ supply). Tax collected. Tax as a % of all sinks. | Velocity drops 30% a week (the market is dying) |
| Price index of 10 key items (fixed basket: enhancement stone, anti-break stone, gem tier 1–3, horse fodder, set piece…) | Index ±10% a week |
| Count of listings sold at the band edge. Share of rare items won by lottery. | Band-edge sales > 25% of an item's volume |
| RMT signals from 6.7 | Any hit goes to the review queue |
| Publish a short **รายงานเศรษฐกิจประจำเดือน** (monthly economy report) to players (EVE MER, GW2) | — |

### 6.10 Build order for one developer
1. **Phase 1:** item schema with `item_uid`, `bind_state`, `trade_count` and `source`. The append-only ledger. NPC buy and sell. (doc_money says the ledger must be in phase 1.)
2. **Before the Thai launch:** ตลาดกลาง (listing, buy orders, band, floor and ceiling, fees), แลกของ, trust tiers 0–2, the 7-day hold on ทอง-bought items, the daily dashboard.
3. **After the launch is stable:** แผงร้าน map view, rare-item publicity window and lottery, system buy-back.
4. **Phase 5 (capital war):** ภาษีเมืองหลวง 0–5% with the 50/50 split and the weekly cap.
5. **Maybe later:** cosmetic boxes that trade once. **Never:** a real-money auction house, or ทอง↔ตำลึง between players.

---

## 7. สรุปภาษาไทยสำหรับยกเข้าพิมพ์เขียว

- **ภาษีรวมของเกมดังส่วนใหญ่อยู่ที่ 10–15%** (GW2 15% · Albion 10.5% · EVE ราว 10.5% · Lost Ark 5% + มัดจำ · FFXIV ผู้ซื้อ 5% + ผู้ขาย 0–5%) มีแค่เกมที่ **ไม่มีเทรดตรง** อย่าง Black Desert ที่เก็บได้ 35%
- **เสนอสำหรับเกมเรา:** ค่าลงขาย 1% (ขั้นต่ำ 10 ตำลึง ไม่คืน) + ภาษีการค้า 9% (ทำลายทิ้ง) + ภาษีเมืองหลวง 0–5% (ผู้ครองเมืองหลวงตั้ง เปลี่ยนได้วันละครั้ง ผู้ครองได้ครึ่งหนึ่งเป็นตำลึงผูกตัว เพดาน 3 ล้านต่อสัปดาห์ ที่เหลือทำลาย) รวม 10–15% · แลกของตรงเสีย 10% ของตำลึงที่ให้ และค่าบริการ 2% ของราคากลางเมื่อแลกของกับของ
- **กันฟอกเงินด้วยกรอบราคา:** ราคากลางจากการซื้อขายจริง ขยับได้ไม่เกิน ±10% ต่อวัน ลงขายได้ 70–130% ของราคากลาง ห้ามต่ำกว่าราคาที่ NPC รับซื้อ มีเพดานตายตัวต่อระดับของ ถ้ามีคนตั้งรับซื้อที่เพดานหลายคน ระบบจับฉลาก ของหายากต้องประกาศขาย 30 นาทีแล้วจับฉลาก ผู้ขายเลือกผู้ซื้อไม่ได้
- **ระดับบัญชี:** บัญชีใหม่ซื้อได้อย่างเดียว · Lv20 + อายุบัญชี 2 วัน ขายได้ 10 รายการ ให้ตำลึงได้ 20,000/วัน · Lv40 + 7 วัน + OTP หรือเคยเติมเกิน 7 วัน ได้เต็มสิทธิ์
- **ทอง (เงินเติม) ไม่มีวันเทรดได้** ของที่ซื้อด้วยทองผูกตัว ถ้าจะเปิดขายของแต่งบางชิ้นในอนาคต ให้ขายต่อได้ครั้งเดียว รอ 7 วัน และลงขายได้สัปดาห์ละ 5 ชิ้น
- **ซื้อขายวัตถุดิบ ไม่ซื้อขายพลังสำเร็จรูป:** ของตีบวกแล้ว ใส่อัญมณีแล้ว ของแดง ของจากสงคราม ขุนพล ม้า และแฟชั่น ผูกตัวทั้งหมด (บทเรียนจาก Diablo III ที่ปิดตลาดประมูลเมื่อ 18 มี.ค. 2014)
- **ภาษีตลาดเป็นตัวดูดเงินเสริม ไม่ใช่ตัวหลัก:** ถ้ามีผู้เล่น 1,000 คนต่อวัน ภาษีดูดได้ราว 2–4.5% ของตำลึงที่เข้าเกม ตัวดูดหลักยังต้องเป็นการตีบวก ร้าน NPC บรรดาศักดิ์ และค่าบำรุงทหาร
- **ติดตามทุกวัน รายงานทุกเดือน:** ตำลึงเข้า/ออกแยกตามแหล่ง ปริมาณเงินต่อคน ดัชนีราคาของ 10 รายการ และสัญญาณ RMT จาก ledger แล้วเผยแพร่รายงานเศรษฐกิจรายเดือนแบบ EVE

---

## 8. Sources (all URLs used)

**Official (developer or publisher)**
- https://news.blizzard.com/en-us/article/10974978/diablo-iii-auction-house-update
- https://secure.runescape.com/m=news/grand-exchange-tax--item-sink?oldschool=1
- https://www.eveonline.com/news/view/updates-to-sales-taxes-and-brokers-fees
- https://www.eveonline.com/news/view/global-plex-market-and-friction-free-trade
- https://www.eveonline.com/news/view/monthly-economic-report-july-2026 (and /news/t/monthly-economic-reports)
- https://www.playlostark.com/en-us/news/articles/wreck-the-halls-release-notes
- https://help.playlostark.com/hc/en-us/articles/37758134303771-Currency-Exchange-Restrictions-for-Purchased-Gold *(search summary. The page returned 403)*
- https://albiononline.com/gold-limits *(search summary. The page returned 403)*
- https://blackdesert.pearlabyss.com/ASIA/en-US/News/Notice/Detail?_boardNo=784
- https://www.playthroneandliberty.com/en-us/news/articles/tl-business-model
- https://www.playthroneandliberty.com/en-gb/news/articles/castle-siege-tax-delivery-introduction
- https://www.guildwars2.com/en/news/john-smith-on-the-state-of-the-guild-wars-2-economy/
- https://www.guildwars2.com/en/news/john-smith-on-the-guild-wars-2-virtual-economy/
- https://gdcvault.com/play/1026913/How-to-Restrain-Inflation-in
- https://devtrackers.gg/albion/p/510446ae-usage-fee-and-crafting-changes-lands-awakened-update (developer post mirror)
- https://companion-app.finalfantasyxiv.com/help/na/guide/market-exhibit.html
- https://help.steampowered.com/en/faqs/view/365F-4BEE-2AE2-7BDD and https://help.steampowered.com/en/faqs/view/61F0-72B7-9A18-C70B (titles only. Details from secondary summaries)

**Community wikis**
- https://wiki.guildwars2.com/wiki/Trading_Post
- https://wiki.guildwars2.com/wiki/Currency_exchange
- https://wiki.guildwars2.com/wiki/Free_account
- https://oldschool.runescape.wiki/w/Grand_Exchange
- https://oldschool.runescape.wiki/w/Old_school_bond
- https://runescape.wiki/w/Trade_limit
- https://runescape.wiki/w/Grand_Exchange (RS3 2% tax and ±5% history, *search summary*)
- https://wiki.eveuniversity.org/Tax
- https://maplestorywiki.net/w/Auction_House
- https://maplestorywiki.net/w/Meso
- https://maplestorywiki.net/w/Meso_Market
- https://ffxiv.consolegameswiki.com/wiki/Market_Board
- https://irowiki.org/wiki/Vending
- https://wiki.l2ertheia.eu/doku.php?id=general:castle
- https://newworld.fandom.com/wiki/Territory_Governance *(search summary)*
- https://wiki.albiononline.com/wiki/Marketplace *(search summary)*
- https://www.adam4eve.eu/mer_sinks_faucets.php?avg=7

**Secondary, press and blogs**
- https://grumpygreen.cricket/bdo-central-market/
- https://mp1st.com/title-updates-and-patches/black-desert-update-1-85-patch-notes-for-june-16
- https://albiononlinegrind.com/guides/market-flipping-guide
- https://mmos.com/news/albion-online-gold-market-purchase-fees
- https://mmos.com/news/lost-ark-anti-bot-trading-restrictions-feb-2022
- https://mmos.com/news/lost-ark-gold-3-day-witholding
- https://www.mmorpg.com/news/lost-ark-adjusts-item-restrictions-to-mitigate-botting-with-todays-anniversary-update-2000127265
- https://guides.gamepressure.com/lost-ark/guide.asp?ID=63370
- https://www.gamedeveloper.com/game-platforms/1-2m-em-runescape-em-players-vote-to-restore-pvp-free-trade-features
- https://kotaku.com/blizzard-will-take-a-big-cut-of-any-money-you-try-to-ma-5906675
- https://www.nbcnews.com/technolog/no-money-no-problems-blizzard-axes-diablo-3-auction-house-4B11192195
- https://www.pcgamer.com/diablo-3-auction-house-jay-wilson/ *(search summary)*
- https://game8.co/games/Throne-and-Liberty/archives/474852
- https://game8.co/games/Throne-and-Liberty/archives/480600
- https://mein-mmo.de/en/throne-and-liberty-auction-house-what-are-you-actually-paying-the-luzent-tax-for,1188334/
- https://predator.ge/en/news/the-castle-system-in-lineage-2-a-complete-guide-to-taxes-and-territory-control
- https://predator.ge/en/news/lineage-2-castle-economics-understanding-town-tax-systems-and-their-impact-on-server-economy
- https://orangemushroom.net/2017/11/06/removal-of-the-free-market/
- https://sites.google.com/view/ragnarok-mobile-newbie-book/basic-elements/market
- https://gamingph.com/2018/12/ghosting-card-sold-for-318000-php-in-auction-house-ragnarok-m-eternal-love/
- https://tagn.wordpress.com/tag/brokerss-fees/
- https://tagn.wordpress.com/2026/06/17/the-may-2026-eve-online-monthly-economic-report-and-how-much-isk-is-too-much-isk/
- https://tagn.wordpress.com/2025/10/20/the-september-2025-eve-online-monthly-economic-report/
- https://nosygamer.blogspot.com/2025/12/eve-onlines-november-2025-monthly.html
- https://nosygamer.blogspot.com/2025/04/new-changes-to-plex.html
- https://forum.square-enix.com/ffxiv/threads/463574
- https://baike.baidu.com/en/item/Treasure%20Pavilion/20245 *(search summary)*
- https://skinflow.gg/blog/trade-protection-update and https://tradeit.gg/blog/trade-protected-items/ *(search summaries)*
- https://us.forums.blizzard.com/en/wow/t/how-is-the-value-of-a-wow-token-determined/227316 *(search summary)*

**Pages that failed to load** (403, 402 or DNS), so their facts come from search summaries or other sources above: GameSpot D3 fees, Lost Ark support, Albion gold-limits and wiki, EVE support broker page, MapleStory fandom, L2 wiki, discoverlineage2 (Tauti tax), namu.wiki MapleStory trading, Lineage 2M guidebook (the page loaded but had no content). **I could not verify the Lineage 2M / Lineage W trade-market fee.**

---

## ผลตรวจ (verifier)

> Checked on 2026-09-29 by opening the cited pages (or, where a page returned 403, by searching for other copies). **CONFIRMED** = the source says the same thing. **CORRECTED** = the body text above has been fixed in place, and the right value and source are given here. **UNVERIFIED** = I could not find a source that confirms or refutes it. Where only a search-result summary was available, it says so.

### Guild Wars 2
| Claim | Result | Source and notes |
|---|---|---|
| 5% listing fee (non-refundable, min 1 copper) + 10% exchange fee = 15% | CONFIRMED | wiki.guildwars2.com/wiki/Trading_Post. The listing fee is charged on the listing price when the item is listed, not "on the sale price" (fixed in 2.1). |
| "Cannot list below NPC vendor value since 9 Sep 2014" | CORRECTED | The 9 Sep 2014 update raised "the minimum profit for the seller" to the vendor value. The floor is on the seller's money **after fees**, so the lowest listing is about vendor value ÷ 0.85. Fixed in TL;DR 3, the table, 2.1 and 6.3. |
| Max 250 units per transaction; listing rate limit; F2P whitelist | CONFIRMED | Trading Post wiki (the rate limit has no published number) |
| Gem↔gold 17.5% fee, +1 gem on gold→gems, 9,999 gems / 999 gold per transaction, 72 h for new accounts "to help combat botting and scams" | CONFIRMED | wiki.guildwars2.com/wiki/Currency_exchange |
| Free accounts: gems→gold only, cannot send coin or items by mail | CONFIRMED | wiki.guildwars2.com/wiki/Free_account (mail only to mutual friends; they can still receive coin and items) |
| Economist John Smith 2012–2017; 4,862 players bought 1.46 million weapons; limited-time recipes | CONFIRMED, detail added | guildwars2.com post of 14 Sep 2012: a karma vendor priced a weapon at 21 karma instead of 35,000; the recipes were limited-time Mystic Forge recipes. He left in April 2017 (search summary of the GW2 wiki). |

### Black Desert
| Claim | Result | Source and notes |
|---|---|---|
| 35% tax, seller keeps 65%, 84.5% with Value Pack, Family Fame +0.5/+1/+1.5% | CONFIRMED | grumpygreen.cricket/bdo-central-market |
| "30% market + 5% territory in the GrumpyG breakdown" | CORRECTED (removed) | The GrumpyG page gives only the 35% total. No source found for the split. |
| "No direct player-to-player trade" | CORRECTED | Almost none. Items marked "personal transaction available" (a few, such as some potions) can be traded directly, inside Central Market price limits (GrumpyG patch notes; BDO community answers). The anti-RMT lesson still holds. |
| Old ±7.5% base-price steps, developer min/max caps, random winner at the max price, lowest enhancement delivered first | CONFIRMED | GrumpyG |
| Asia TH/SEA renewal: buy orders up to +10%, listings up to −10% of the standard price, standard price adjusts "fluidly to the transaction volume", random order at the max price | CONFIRMED | blackdesert.pearlabyss.com/ASIA notice 784, dated 30 Jan 2019. Official Asia notices are titled "Black Desert Asia (TH/SEA)". |
| Pearl items: 5 a week, "about 30–35" with Family Fame; 1 pearl buy order at a time; reset Monday 00:00 UTC | CORRECTED | 5 a week base **plus up to 30 more** (Family Fame 2,501+), so **35 at most** (GrumpyG) |
| 15-minute delay at ≥20B silver (console 1.85) | CONFIRMED, detail added | mp1st.com: "approximately 15 minutes" for "certain items and all items" at ≥20,000,000,000 silver, console update 1.85, 16 Jun 2021 |
| Pearl-item caps adjusted (×1.8 console, outfits May 2024) | CONFIRMED (search summary) | Max price of Pearl outfits raised about 1.8× in maintenance on 8 May 2024 (search summary of official BDO notices). Reworded in 2.2. |

### Albion Online
| Claim | Result | Source and notes |
|---|---|---|
| 2.5% setup fee on buy and sell orders; sales tax 8%, 4% with Premium; 10.5% total per sale | CONFIRMED | albiononlinegrind.com market-flipping guide |
| Gold Market purchase fee since 15 Aug 2023 "to discourage the hoarding of Gold"; Premium exempt | CONFIRMED | mmos.com. The exemption covers buying Premium with Gold **or** Silver. The article gives no fee %. |
| Gold-sale limits day 1 = 0, days 2–5 = 500, days 6–10 = 2,500, day 10+ = 5,000 | CONFIRMED (search summary only) | albiononline.com/gold-limits returns 403. The search summary shows this age scheme and **also** a status scheme: none in the tutorial, 500/day after any purchase or Tier 3, 2,500/day after $30+ and a 10-day check. Both are now in the body. |
| "Trusted status via verification after $30 in purchases and 10 days" | CORRECTED | The limit is removed after support verifies a purchase of **any amount** (usually within 24 h, once per account). $30 + 10 days only gives the 2,500/day tier. Fixed in TL;DR 5–6, the table, 2.3, 2.12 and 6.5. |
| Stated reason: stolen cards and chargebacks | CONFIRMED (search summary) | gold-limits page text in search results |
| Usage fees "since 2021" in silver per 100 nutrition | CORRECTED | Since **24 Nov 2020** (devtrackers copy of the developer post; before that a percentage) |
| Ban wave "2,029 accounts banned for third-party currency transactions" | CONFIRMED | forum.albiononline.com thread 148646 (April 2021) |

### RuneScape / OSRS
| Claim | Result | Source and notes |
|---|---|---|
| OSRS GE tax 1% from 9 Dec 2021, 2% from 29 May 2025, cap 5M per item, bonds exempt | CONFIRMED | Jagex news; oldschool.runescape.wiki/w/Grand_Exchange |
| "Cheap items exempt" | CORRECTED, detail | At 1%: items under 100 GP untaxed. At 2%: the tax rounds down, so items below 50 coins pay nothing. Tools and some cheap consumables are on an exempt list. |
| "5.7 trillion coins removed so far" | CORRECTED | 5,727,699,814,728 is the **value of items deleted by the item sink** (the wiki calls its table a sample), not coins removed by the tax. The wiki says "probably" well over half of taxed coins are simply destroyed. |
| OSRS F2P: 20 h play, 10 QP, total level 100 before selling listed bot-prone items; 4-hour buy limits | CONFIRMED | OSRS wiki |
| RS3 2% tax since 9 Jan 2023 | CONFIRMED (search summary) | runescape.wiki/w/Grand_Exchange. Exempt: items **below** 50 coins (not "≤50") and bonds. |
| Trade limits Dec 2007, first limit 3,000 coins per 15 min | CONFIRMED, detail added | runescape.wiki/w/Trade_limit: announced 10 Dec 2007, in force 2 Jan 2008; "originally 3k"; later 10,000 per 15 min (free) and up to 60,000 per 15 min (members, by quest points) |
| Free trade back 1 Feb 2011 after 91% of 1.2 million voters said yes | CONFIRMED | gamedeveloper.com ("over 1.2 million", 91%); RS wiki |
| GE ±5% price limits removed 1 Feb 2011 | CONFIRMED (search summary) | runescape.wiki Grand_Exchange/History |
| Never-member accounts: max 25,000 coins given away a day since 22 Nov 2011 | CONFIRMED | runescape.wiki/w/Trade_limit (RuneScape, not OSRS) |
| OSRS bond: untradable after trade, 10% of GE value to make tradable again, GE-tax exempt | CONFIRMED | oldschool.runescape.wiki/w/Old_school_bond |

### EVE Online
| Claim | Result | Source and notes |
|---|---|---|
| Sales tax 7.5% base, raised from 4% on 12 Mar 2025 (patch 22.02) | CONFIRMED | wiki.eveuniversity.org/Tax |
| "About 3.4% at max skill" | CONFIRMED with note | 7.5% × (1 − 5 × 11%) = 3.375%. The EVE Uni wiki writes 3.3%. |
| Broker fee 3% at NPC stations, down to 1%; structure owners set their own | CONFIRMED | EVE Uni wiki |
| 29 Jul 2019: max sales tax 2%→5%, NPC broker fee 3%→5%, combined max 5%→10%, Accounting 11% a level | CONFIRMED | eveonline.com/news/view/updates-to-sales-taxes-and-brokers-fees |
| June 2019: broker fees + tax removed about 21.5 trillion ISK, about one third of all ISK removed; 22% of broker fees paid in player structures | CONFIRMED | tagn.wordpress.com/tag/brokerss-fees (from the June 2019 MER) |
| MER published monthly since 2016 | CONFIRMED | eveonline.com MER archive (reports from March 2016 on) |
| Money supply 2,614.5 trillion ISK in Nov 2025, +7.5% a year; Sep–Nov 2025 reports used the wrong end-of-month date | CONFIRMED | nosygamer.blogspot.com 2025/12 (those reports used 30 Aug 2025 as the end date) |
| "Almost doubled in 4.5 years"; May 2026 commentary asking for evidence, earlier squeeze cost logins | CONFIRMED | tagn.wordpress.com 2026/06/17 (quoting a Reddit post; the squeeze was the 2022 "Year of Disappointment") |
| PLEX 2.55M ISK (May 2017) → about 6.1M ISK (2025); a higher PLEX price cuts CCP's real-money revenue | CONFIRMED | nosygamer 2025/04 (2,549,000 ISK on 9 May 2017) |
| Global PLEX market in 2025 with normal taxes | CONFIRMED | eveonline.com (tested on Singularity 27–30 Jun 2025; location and standings fees unchanged) |

### Lost Ark
| Claim | Result | Source and notes |
|---|---|---|
| 5% sale fee + refundable deposit that grows with listing length (1–3 days) | CONFIRMED | gamepressure guide (Market and Auction House) |
| Dec 2022: untrusted accounts cannot use auction house, market, trade **or mail**; trusted via Steam Guard mobile or any purchase | CORRECTED, detail | playlostark.com Wreck the Halls notes (14 Dec 2022): untrusted accounts lose the Auction House, Market and all player-to-player trading. Starting trades and sending mail were **already** blocked before. Applies only to accounts created after the update. |
| 20 new listings a day per roster | CONFIRMED | same notes ("daily 20 item registration limit per Roster for the Auction House and Market") |
| "Amazon said over a million bot accounts banned" | CORRECTED | The release notes say "millions of bot accounts" were banned over the previous few months. |
| Feb 2023: item level 1375 needed to sell trade-skill materials and listed high-value items | CONFIRMED | mmorpg.com (8 Feb 2023: Solar items, crystallized stones, honor leapstones, Glory Shard pouches, gems 1–10); mmos.com (22 Feb 2023: trade-skill materials) |
| Purchased gold held 3 days (no mail, trade, AH, market, loot auction bids); unsafe Royal Crystals keep the hold | CONFIRMED (search summary) | Lost Ark support article (403; copy on amazongames.com). Release is at 03:00 UTC on the third day. |
| "Powerpass and Rapport gold held 72 h (Aug 2022)" | CORRECTED, detail | mmos.com, 3 Aug 2022: gold from Una's tokens **after using a paid Powerpass**, and Rapport gold |
| Currency exchange fee 5% | CONFIRMED (search summary) | 5% on gold→crystal exchanges |

### MapleStory
| Claim | Result | Source and notes |
|---|---|---|
| Auction House 2,000 meso deposit + 5% (3% MVP), 30 listings (from 10 in Sep 2025), 24/48 h, cash items untradable once sold and claimed | CONFIRMED | maplestorywiki.net/w/Auction_House (change dated 24 Sep 2025, which also added the 48 h option) |
| Direct trade of mesos taxed 5% | CONFIRMED | maplestorywiki.net/w/Meso |
| Meso Market 1% on mesos sold, closed pool, GMS 11 May 2017, not in Heroic worlds | CONFIRMED | maplestorywiki.net/w/Meso_Market |
| KMS Free Market removed Nov 2017 to "prevent unusual transactions"; cash items stopped 13 Nov 2017 | CONFIRMED, detail added | orangemushroom.net: the Free Market itself closed 23 Nov 2017 |
| Heroic/Reboot worlds: no trading at all | CONFIRMED (search summary) | MapleStory wiki, Reboot World |

### Lineage II, Throne and Liberty, New World, FFXIV
| Claim | Result | Source and notes |
|---|---|---|
| L2 lord sets 0–15%; C3 allowed any number, not just 0/5/10/15 | CONFIRMED (search summary) | legacylineage2.fandom, C3 castle changes |
| About 60% of collected tax to the castle treasury | CONFIRMED (secondary only) | predator.ge. Weak source. |
| Tauti: Light 0%, Dark 30% on NPC sales and 10% on NPC purchases; castles under Aden/Rune collect only if Aden/Rune chose Dark; paid Monday midnight | CONFIRMED | wiki.l2ertheia.eu castle page |
| TL 20% base + castle tax 1–5%, castle guild gets 40% | CONFIRMED (secondary) | game8 (20% base + castle rate); mein-mmo.de (about 1–5%, 40% to the siege winners). The official business-model page gives no numbers. |
| "The rest goes to Tax Delivery" | CORRECTED | The rest funds guild PvP events: Tax Delivery **and** the castle siege (search summary of guides) |
| TL Sollant listing fee not refunded, 30 listings, upgraded/instanced/cash-shop gear not tradable | CONFIRMED | game8; playthroneandliberty.com business model |
| New World: ruling company can change taxes once every 24 h | CONFIRMED (search summary) | newworld.fandom Territory_Governance. Weekly property tax and hourly income display not checked. |
| FFXIV buyer 5% flat; seller 0/3/5% by city; starting cities always 5%; 20 listings per retainer | CONFIRMED | ffxiv.consolegameswiki Market_Board; retainer slot count from several guides |
| "Recalculated weekly, to spread retainers across cities" | CORRECTED | Sources disagree: a community FAQ says weekly reset (or maintenance), the consolegameswiki says "daily". The retainer-count reason is a player explanation on the SE forum, not an official statement. |

### Ragnarok, Diablo III, bridges and others
| Claim | Result | Source and notes |
|---|---|---|
| RO vending: 5% only above 10,000,000 z; max 1,000,000,000 z; 4 cells from NPCs; 3–12 stacks; Pushcart | CONFIRMED | irowiki.org/wiki/Vending |
| ROM: 9% tax; system-set prices; relist pays tax again; vending ±50%; 8 slots; only crafted/Rift/miniboss/MVP gear | CONFIRMED | ROM newbie book (Google Sites) |
| ROM snap: 2 Eclipse Cards, 162 buyers | CONFIRMED | gamingph.com, Dec 2018 |
| D3 RMAH: $1 per gear sale, 15% on commodities, 15% PayPal cash-out, $250 cap | CONFIRMED with detail | kotaku.com, 1 May 2012. The $250 is the Battle.net Balance cap and the maximum bid. |
| D3 closure announced 18 Sep 2013 | CORRECTED | Announced **17 Sep 2013** (a Tuesday); NBC's article is dated 18 Sep. Closed 18 Mar 2014 (news.blizzard.com). |
| D3: Hight said the AH undermined "kill monsters to get cool loot"; Loot 2.0 replaced it | CONFIRMED | news.blizzard.com article 10974978 |
| Jay Wilson, GDC 2013: "really hurt the game"; >50% used them regularly; would turn them off if they could | CONFIRMED | PC Gamer, Engadget (search summaries) |
| D3 "10 listings at once" | UNVERIFIED | Not checked |
| WoW Token: cash-bought token can only be sold; gold-bought token can only be used | CONFIRMED | Blizzard shop and guides (search summary) |
| Steam Trade Protection July 2025: 7-day window, reversal, 30-day trade and market lock after reversing | CONFIRMED | PC Gamer, tradeit.gg, skinflow.gg (search summaries) |
| Steam market: purchase >30 days and <1 year old, Steam Guard 15 days, password reset 5 days, new payment method 7 days | CONFIRMED | Steam community answers (search summary) |
| Steam market fee "5%" | CORRECTED | 5% Steam fee **plus** a game fee (10% for CS2), about 15% in total |
| NetEase Treasure Pavilion: "about 1% seller fee, 5-day publicity" | CORRECTED | baike.baidu.com (Treasure Pavilion): **about 5%** seller fee (5–10% by game and item), publicity **4 × 24 h** for items and pets, none for coins and characters. Chinese search results agree: 5% for items and pets, 10% for characters on the mobile game. |
| NetEase GDC 2020 talk on monitoring production, consumption, stock, price, player trade and alerts | CONFIRMED | gdcvault.com/play/1026913 (Yongcheng Liu and Qinfang Ying, NetEase) |
| "Bridges share one channel, a fee, a cap or hold, and usually one trade per unit" | CONFIRMED | Each example is checked above |

### Our-game estimates and draft rules
| Claim | Result | Notes |
|---|---|---|
| Mid player earns about 19,300–25,000 a day (coin only), or 33,600–45,000 with supply value | CONFIRMED | Matches `scratchpad/economy.json` numeric_checks (written in ทอง there, renamed ตำลึง here) |
| 1,000 DAU × 20,000 = 20M; 20–40% traded at ~11% → 0.44–0.88M a day ≈ 2–4.5% | CONFIRMED (arithmetic) | 0.44/20 = 2.2%, 0.88/20 = 4.4%. This is an estimate from our own inputs and cannot be checked against outside sources. |
| Draft: 1% listing (min 10) + 9% sale tax + 0–5% capital tax = 10–15%; seller keeps 87% at 3% city tax | CONFIRMED (internally consistent) | 1 + 9 + 3 = 13%, so 87% |
| Draft bands, trust tiers, ทอง never tradable, what is bound | CONFIRMED (internally consistent) | Matches 6.2–6.6. The GW2 precedent for the floor is now described correctly in 6.3. |

**Summary of corrections:** the GW2 floor is on the seller's money after fees · the BDO 30% + 5% split has no source and was removed · BDO allows a few "personal transaction" items · the BDO Pearl cap is 5 + up to 30 = 35 · Albion removes the limit after support verifies a purchase of any amount ($30 + 10 days is only the 2,500/day tier) · Albion usage fees changed on 24 Nov 2020 · the OSRS 5.7 trillion is the value of items deleted by the sink · RS3 and OSRS exempt items below 50 coins · the Lost Ark Dec 2022 rules cover new accounts only, mail was already blocked, the notes say "millions" of bots, and the 72 h hold is on Una's-token gold from a paid Powerpass and on Rapport gold · TL's leftover castle tax goes to Tax Delivery and siege rewards · how often FFXIV rates change is disputed · the D3 closure was announced on 17 Sep 2013 · the Steam market fee is about 15% for CS2 · the NetEase fee is about 5% and its publicity period is 4 days.
