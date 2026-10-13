# Civilis — implementačný plán

Zadanie: `docs/SPEC.md` · Architektúra: `docs/ARCHITECTURE.md` · Doplnenia pravidiel:
`docs/GAME_DESIGN.md` · Čísla: `docs/BALANCING.md`

**Pravidlo:** etapa je hotová, až keď prejde `npm run typecheck`, `npm run lint`, `npm test`
(a pri UI zmenách `npm run test:e2e`), plán je aktualizovaný a odchýlky zapísané nižšie.
Žiadne predstierané funkcie — čo ešte nefunguje, je v UI vypnuté (`disabled`).

## Stav

| Etapa                          | Stav      |
| ------------------------------ | --------- |
| 1 – Inicializácia projektu     | ✅ hotovo |
| 2 – Herná mapa a renderer      | ✅ hotovo |
| 3 – Ekonomický engine          | ✅ hotovo |
| 4 – Populácia, výskum, míľniky | ✅ hotovo |
| 5 – Používateľské rozhranie    | ✅ hotovo |
| 6 – Ukladanie a dokončenie     | ✅ hotovo |

## Etapa 1 – Inicializácia projektu ✅

- [x] Vite + React + TypeScript (strict, `noUncheckedIndexedAccess`), alias `@/` → `src/`
- [x] ESLint (typescript-eslint, react-hooks, izolácia enginu), Prettier, Vitest, Playwright
- [x] Adresárová štruktúra podľa špecifikácie 4.2
- [x] Základné rozloženie hernej obrazovky (5 častí), katalóg s filtrom a detail definície budovy
- [x] Dátové definície (`src/data/*.json`) + Zod schémy a krížová validácia
      (`src/engine/core/definitions.ts`), typy kontraktu v `src/types/`

Testy: 11 unit (validácia dát, zhoda so špecifikáciou), 2 E2E (layout, katalóg → detail).

## Etapa 2 – Herná mapa a renderer ✅

- [x] Seeded PRNG (mulberry32 + bezstavový hash) v `engine/core/random.ts` — iba celočíselné operácie
- [x] Generátor mapy `engine/world/generateWorld.ts`: fbm value-noise (výška, vlhkosť, kamenistosť)
      prevedený na percentily → stabilné zastúpenie terénov; štartovacia oblasť 12 × 12 v strede
      mapy bez vody a kopcov, chýbajúci les/kameň/úrodná pôda sa doplnia plochou na okraji
- [x] `createNewGame(data, { seed, gameId, now })` → `GameState` so skladom, domom a cestou
- [x] Izometrický renderer PixiJS 8 (`src/renderer/`): zdieľané textúry z `Graphics` (4 varianty
      terénu, 1 textúra na typ budovy), vrstvy terén / cesty / overlay / budovy (z-order podľa x+y),
      `CullerPlugin` pre objekty mimo obrazovky, PixiJS v samostatnom lazy chunku
- [x] Kamera: ťahanie, zoom kolieskom k pozícii kurzora (0,35–2,5×), stred obrazovky držaný v mape
- [x] Picking (`renderer/iso.ts`), zvýraznenie políčka, náhľad stavby zelená/červená podľa
      `validatePlacement`, info o políčku pod kurzorom
- [x] `GameEngine` (`engine/core/engine.ts`) s príkazmi `PLACE_BUILDING`, `DEMOLISH_BUILDING`,
      `SET_BUILDING_PRIORITY`; `START_RESEARCH` zatiaľ vracia `not_implemented` (etapa 4)
- [x] Game Controller (`app/GameController.ts`) + Zustand revízia stavu (`useGameState`), výber
      budovy na mape, panel detailu so zbúraním, hlásenie dôvodu neúspechu, Escape
- [x] Testy: 41 unit (PRNG, generátor vrátane garancií na 100 seedoch a mapy 256 × 256, nová hra,
      test C, búranie, priorita, izometria), 6 E2E (stavba, neplatná stavba, výber/zbúranie/Escape,
      ťahanie mapy)

## Etapa 3 – Ekonomika ✅

- [x] Inventár surovín, kapacita skladu na surovinu (vedomosti bez limitu), suroviny nikdy < 0
- [x] Fixný krok (`app/gameLoop.ts`): akumulátor nad `requestAnimationFrame`, rýchlosti 0/1/2/4,
      max. 4 kroky za snímku, pri skrytej karte stojí a nedobieha
- [x] Cestná sieť (`engine/world/connectivity.ts`): BFS od ciest pri skladoch, 4-okolie
- [x] Pracovníci podľa priority (1–3), pri zhode staršia budova; čiastočné obsadenie
- [x] Produkcia v poradí 2.4 (`engine/economy/analysis.ts` kroky 1–4, `simulateDay.ts` kroky 5, 6, 8):
      rezervácia vstupov podľa priorít, pomerné krátenie, terén, nástroje, financovanie údržby
- [x] Peniaze: príjem z trhovísk, údržba so zľavou z technológií (efekty technológií sú hotové,
      samotný výskum príde v etape 4)
- [x] Kapacita bývania a skladu len z pripojených budov
- [x] Ovládanie času v hornej lište + medzerník a 1/2/3, denná bilancia surovín a peňazí
- [x] Dôvody nefunkčnosti (`BuildingProblem`): chýba cesta, pracovníci, nástroje, vstup („Nedostatok
      dreva“), menej úrodná pôda, peniaze, plný sklad — v detaile budovy a ako „!“ na mape
- [x] Priorita budovy v detaile
- [x] Testy: 68 unit/integration (test B, priority, sklad, nástroje, peniaze, technológie, cestná
      sieť, 300 dní bez záporných hodnôt, test A — 1 000 krokov, výkon 500 budov ≈ 1 ms/tick,
      herná slučka), 9 E2E (beh času a pauza, „Chýba cesta“ → pripojenie, denná bilancia)

## Etapa 4 – Populácia a výskum ✅

- [x] Spokojnosť zo 4 zložiek (`engine/population/population.ts`), pokrytie studňami a školami,
      postupná zmena max. 5 bodov/deň, zložky uložené v `population.happinessFactors`
- [x] Rast (+5 %) a pokles (−3 %) populácie, odchod pri nedostatku bývania, minimum 5
- [x] Výskum (`engine/research/research.ts`): `START_RESEARCH` s validáciou prerekvizít,
      postupné investovanie vedomostí, vrátenie vedomostí pri prepnutí
- [x] Efekty technológií (z etapy 3) sa uplatnia po dokončení výskumu
- [x] Míľniky (`engine/milestones/milestones.ts`): sekvenčné, počítadlá po sebe idúcich dní,
      odmena presne raz
- [x] Udalosti z ticku (`GameEvent`: výskum, míľnik, hlad, zmena populácie) → hlásenia v UI
      (`app/gameEvents.ts`), obrazovka úspechu po 5. míľniku (pauza → sandbox)
- [x] Testy: 92 unit/integration (spokojnosť, rast/pokles, výskum, test E), 10 E2E (hlad)

## Etapa 5 – UI ✅

- [x] Horná lišta: deň, populácia, pracovníci, spokojnosť (rozpis zložiek v tooltipe), suroviny
      s dennou bilanciou a varovaním (plný sklad, nula potravín), peniaze, rýchlosť
- [x] Katalóg: cena pri každej budove, nedostupné budovy (suroviny / technológia) zošednuté
      s dôvodom v tooltipe, režim výstavby
- [x] Detail inštancie budovy: stav a problémy, pracovníci, výkon, výroba, spotreba, priorita,
      zbúranie (z etáp 2–3)
- [x] Panel výskumu (`components/panels/ResearchPanel.tsx`): stav technológií (preskúmaná /
      skúma sa / dostupná / zamknutá), efekty, prerekvizity, priebeh a odhad dní, prepínanie
- [x] Panel míľnikov: aktuálny cieľ s priebehom každej podmienky a počítadlom dní, odmeny
- [x] Panel štatistík: obyvateľstvo, zložky spokojnosti s váhami, denná tabuľka surovín
      a peňazí, počty budov a budov s problémom
- [x] Spodná lišta: prepínanie panelov, aktuálny výskum a míľnik; Escape zatvára panel
- [x] Testy: 93 unit/integration, 15 E2E (výskum, míľniky, štatistiky, Escape, dostupnosť v katalógu)

## Etapa 6 – Ukladanie a dokončenie ✅

- [x] Dexie (`persistence/`): 3 manuálne pozície + automatické uloženie každých 30 dní
      a pri skrytí/zatvorení stránky; Ctrl/Cmd+S; ukladanie funguje aj v pauze
- [x] Zod schéma `GameState`, `schemaVersion`, migrácie (`migrateGameState`), validácia pred
      zápisom, zápis v jednej transakcii; kontrola odkazov na budovy a technológie
- [x] Synchronná záloha do `localStorage` pri `pagehide` — obnovenie stránky nestratí hru
- [x] Export / import JSON, panel Uložené hry, panel Nastavenia (nová hra so seedom, ovládanie)
- [x] Test D (uloženie → akcie → načítanie), migrácie, poškodené súbory, neúspešná transakcia
- [x] Test F: bot (`tests/helpers/bot.ts`) dohrá všetkých 5 míľnikov na 7 mapách iba hernými
      príkazmi; vyvažovanie podľa jeho výsledkov (`docs/BALANCING.md`)
- [x] Ochrana pred neobnoviteľným stavom: základný zber dreva a kameňa
- [x] Renderer: terén v blokoch 16 × 16 s cullingom celých blokov (škáluje na 256 × 256)
- [x] E2E v Chromiu a Firefoxe (42 testov); WebKit voliteľne (`PW_WEBKIT=1`, potrebuje systémové knižnice)
- [x] Produkčný build, README s návodom na hru, aktualizovaná dokumentácia

Testy: 112 unit/integration, 21 E2E scenárov × 2 prehliadače.

## Možné ďalšie kroky (mimo MVP)

- Overiť v Safari (WebKit) a na Windows/Edge; zmerať FPS na bežnom notebooku.
- Hrateľnostné testy s ľuďmi — bot je dokonalý hráč, čas človeka je odhad.
- Ďalšia éra (špecifikácia 3.2: „prechod do ďalšej historickej éry“).
- Zvukové efekty, animácie, prehľadnejšie zobrazenie dosahu studní a škôl pri stavbe.

## Log rozhodnutí a odchýlok od špecifikácie

| Dátum      | Rozhodnutie / odchýlka                                                                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-13 | **TypeScript 6.0** namiesto najnovšieho 7.0 — typescript-eslint zatiaľ podporuje len `<6.1`.                                                                                                                                                                                                                                                     |
| 2026-10-13 | `exactOptionalPropertyTypes` vypnuté — nekompatibilné s inferenciou voliteľných polí v Zod.                                                                                                                                                                                                                                                      |
| 2026-10-13 | `BuildingDefinition` rozšírená o `moneyOutput` a `storageCapacity` (model zo špecifikácie nevie vyjadriť „+8 peňazí/deň“ ani „+200 kapacita skladu“).                                                                                                                                                                                            |
| 2026-10-13 | Pridaný `src/data/balance.json` (počiatočný stav + konštanty simulácie), aby žiadne herné číslo nebolo natvrdo v kóde.                                                                                                                                                                                                                           |
| 2026-10-13 | ID v dátach sú anglické `snake_case` (`lumberjack`, `woodworking`…), zobrazované názvy slovenské. UI texty v `src/app/i18n.ts`.                                                                                                                                                                                                                  |
| 2026-10-13 | Doplnené hodnoty, ktoré špecifikácia nedefinuje (pracovníci, údržba, terén, dosahy služieb, spotreba potravín, prerekvizity) — viď `docs/BALANCING.md`.                                                                                                                                                                                          |
| 2026-10-13 | Interpretácie pravidiel (aditívne bonusy, sekvenčné míľniky, kopce) a otvorené otázky (nástroje, peniaze) — viď `docs/GAME_DESIGN.md`.                                                                                                                                                                                                           |
| 2026-10-13 | **Dôvody zlyhania príkazov sú kódy** (`tile_occupied`, `insufficient_resources`…, `engine/core/commandReasons.ts`), UI ich prekladá cez `command.<kód>`. Pole `reason: string` zo špecifikácie zostáva.                                                                                                                                          |
| 2026-10-13 | ID inštancií budov sú `b<n>`, kde n = najväčšie existujúce + 1 — deterministické a bez nového poľa v `GameState`.                                                                                                                                                                                                                                |
| 2026-10-13 | Zbúranie nevracia suroviny. Posledný sklad sa zbúrať nedá (od neho sa počíta cestná sieť).                                                                                                                                                                                                                                                       |
| 2026-10-13 | Priorita budovy je celé číslo 1–3 (predvolene 2).                                                                                                                                                                                                                                                                                                |
| 2026-10-13 | Z `balance.json` odstránené `startingState.housingCapacity` (odvodí sa z počiatočného domu), pridané `mapSize`.                                                                                                                                                                                                                                  |
| 2026-10-13 | Engine nevolá `Date.now()` ani `crypto` — `gameId` a `createdAt` dodáva Game Controller pri vytvorení hry.                                                                                                                                                                                                                                       |
| 2026-10-13 | Seed mapy sa dá zadať cez `?seed=N`. Parameter `?e2e` sprístupní `window.__civilis` (čítanie stavu, `canPlace`, `tileToClient`) pre Playwright testy.                                                                                                                                                                                            |
| 2026-10-13 | `tick()` zatiaľ iba posúva deň a nie je napojený na čas — ekonomika a herná slučka prídu v etape 3.                                                                                                                                                                                                                                              |
| 2026-10-13 | Príkaz `SET_SPEED` (rozšírenie `GameCommand`) — rýchlosť je súčasť `GameState`, takže aj jej zmena ide cez validovaný príkaz.                                                                                                                                                                                                                    |
| 2026-10-13 | `BuildingDefinition` rozšírená o `toolUsePerWorker` a voliteľné `terrainEfficiency`; `balance.json` o `noToolsEfficiency` a `noFundsEfficiency`.                                                                                                                                                                                                 |
| 2026-10-13 | Schválené: nástroje spotrebúvajú výrobné budovy, peniaze slúžia len na údržbu — detaily v `docs/GAME_DESIGN.md`.                                                                                                                                                                                                                                 |
| 2026-10-13 | Cestná sieť začína pri akomkoľvek sklade, nielen pri prvom.                                                                                                                                                                                                                                                                                      |
| 2026-10-13 | Odvodené hodnoty (`housingCapacity`, `storageCapacity`, `availableWorkers`, `employedWorkers`) sa prepočítavajú po každom príkaze, ticku a `load()` (`refreshDerivedState`).                                                                                                                                                                     |
| 2026-10-13 | `?paused` spustí hru v pauze; test hook má `advanceDays(n)` (len pre E2E).                                                                                                                                                                                                                                                                       |
| 2026-10-13 | `PopulationState.happinessFactors` — zložky spokojnosti z posledného dňa (rozšírenie modelu, potrebné pre UI a štatistiky).                                                                                                                                                                                                                      |
| 2026-10-13 | Spokojnosť sa mení postupne (max. 5 bodov/deň), nie skokom na vážený priemer — dôvod v `docs/GAME_DESIGN.md`.                                                                                                                                                                                                                                    |
| 2026-10-13 | `GameEngine` rozšírený na `CivilisEngine` o `takeEvents()`; `tick()` ostáva `void` podľa špecifikácie.                                                                                                                                                                                                                                           |
| 2026-10-13 | Prepnutie výskumu vráti investované vedomosti (špecifikácia prepínanie nerieši).                                                                                                                                                                                                                                                                 |
| 2026-10-13 | `t()` podporuje parametre (`{days}`); priebeh podmienok míľnikov počíta engine (`conditionProgress`), `isConditionMetToday` je z neho odvodené.                                                                                                                                                                                                  |
| 2026-10-13 | Pridaná dev závislosť `fake-indexeddb` (len pre unit testy ukladania).                                                                                                                                                                                                                                                                           |
| 2026-10-13 | Synchronná záloha do `localStorage` pri zatváraní stránky — IndexedDB zápis v `pagehide` sa nemusí dokončiť (overené E2E testom, ktorý bez zálohy zlyhal).                                                                                                                                                                                       |
| 2026-10-13 | Pri štarte sa obnoví automatické uloženie; `?seed=N` alebo `?new` založí novú hru.                                                                                                                                                                                                                                                               |
| 2026-10-13 | Vyvažovanie: rast 2 %, výrobné budovy 3 pracovníci, nástroje 0,05/pracovník, údržba na polovicu; nový `balance.baseProduction` (+1 drevo, +0,5 kameňa) proti neobnoviteľnému stavu. Ceny a výroba zo špecifikácie nezmenené.                                                                                                                     |
| 2026-10-13 | Ekonomické unit testy bežia nad dátami bez základného zberu (`economyTestData`) a ladiace hodnoty čítajú z dát, aby ďalšie vyvažovanie nerozbíjalo testy.                                                                                                                                                                                        |
| 2026-10-13 | **Pixel art grafika** (na želanie): sprity sa kreslia po pixeloch v kóde (`renderer/pixel/`), políčko 32 × 16 px, paleta inšpirovaná Endesga 32, obrysy, zoom po celých krokoch, pixelové ikony v katalógu. Pôvodná vektorová grafika (`Graphics`) a `renderer/palette.ts` odstránené.                                                           |
| 2026-10-13 | **Úrovne budov** (na želanie): dom 3 úrovne, sklad 2; `BuildingDefinition.levels`, `BuildingInstance.level`, príkaz `UPGRADE_BUILDING`, podmienka míľnika `building_level`. Schéma uložených hier **v2** s migráciou z v1.                                                                                                                       |
| 2026-10-13 | **Predĺženie hry** (na želanie, ~2,5–2,7×): plynulý rast (`populationBaseGrowth` + `growthProgress`), ceny technológií 2×, vyššie nároky míľnikov 3–5. Odchýlky od čísel špecifikácie — viď `docs/BALANCING.md`.                                                                                                                                 |
| 2026-10-13 | **Vzhľad podľa vývoja**: sprity podľa úrovne a preskúmaných technológií (`buildingSpriteKey`, `TECH_LOOKS`), hlinené → dláždené cesty.                                                                                                                                                                                                           |
| 2026-10-13 | **Značky** so symbolom podľa typu problému + zelená šípka pre možné vylepšenie; dôvod pri prejdení myšou, legenda v Nastaveniach.                                                                                                                                                                                                                |
| 2026-10-13 | Príkaz `SET_BUILDING_ENABLED` (pozastavenie budovy) — bez neho mohla dielňa natrvalo minúť všetok kameň (odhalil test F).                                                                                                                                                                                                                        |
| 2026-10-13 | **Stavanie ťahaním** (cesta = čiara, budovy = obdĺžnik), posun mapy pravým tlačidlom a šípkami/WASD; **bloky polí** (`connectsAdjacent`); **recyklácia** (`balance.demolishRefund`).                                                                                                                                                             |
| 2026-10-13 | **Éry Starovek a Stredovek** (na želanie): `eras.json`, `era` v technológiách a míľnikoch, udalosť `era_reached`, zamknutie technológií (`era_locked`). Nové suroviny tehly a železo, služba kultúra, 8 nových budov, úrovne domu 4–5. Schéma uložených hier **v3** (migrácia v2→v3 + oprava migrácie v1→v2, ktorá nedopĺňala `growthProgress`). |
| 2026-10-13 | Strop rastu populácie `populationMaxGrowth` (5/deň) — bez neho populácia v neskorých érach rástla exponenciálne a ciele ér boli triviálne.                                                                                                                                                                                                       |
| 2026-10-13 | Služby bez výroby (chrám, katedrála) fungujú podľa obsadenia pracovníkmi.                                                                                                                                                                                                                                                                        |
| 2026-10-13 | Pixelové ikony surovín v hornej lište a katalógu (emoji nemali tehly ani železo), suroviny budúcich ér sú skryté.                                                                                                                                                                                                                                |
