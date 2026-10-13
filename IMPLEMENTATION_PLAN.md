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
| 5 – Používateľské rozhranie    | ⏳ ďalšia |
| 6 – Ukladanie a dokončenie     | —         |

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

## Etapa 5 – UI

- [ ] Horná lišta napojená na stav + ovládanie rýchlosti (medzerník, 1/2/3)
- [ ] Katalóg: dostupnosť podľa surovín a technológií, režim výstavby
- [ ] Detail inštancie budovy: výroba, spotreba, pracovníci, problémy, priorita, zbúranie
- [ ] Obrazovka výskumu, panel míľnikov, štatistiky (obrazovka úspechu je hotová z etapy 4)

## Etapa 6 – Ukladanie a dokončenie

- [ ] Dexie: 3 manuálne sloty + autosave (každých 30 dní, `pagehide`), Ctrl/Cmd+S
- [ ] Zod schéma `GameState`, `schemaVersion`, migrácie, transakčný zápis
- [ ] Export / import JSON
- [ ] E2E: test D, kompletný herný priebeh; test F (simulovaný „bot“ hráč v integration teste)
- [ ] Balancing, výkonnostný test (500 budov, tick < 20 ms), produkčný build, README

## Log rozhodnutí a odchýlok od špecifikácie

| Dátum      | Rozhodnutie / odchýlka                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-13 | **TypeScript 6.0** namiesto najnovšieho 7.0 — typescript-eslint zatiaľ podporuje len `<6.1`.                                                                                                            |
| 2026-10-13 | `exactOptionalPropertyTypes` vypnuté — nekompatibilné s inferenciou voliteľných polí v Zod.                                                                                                             |
| 2026-10-13 | `BuildingDefinition` rozšírená o `moneyOutput` a `storageCapacity` (model zo špecifikácie nevie vyjadriť „+8 peňazí/deň“ ani „+200 kapacita skladu“).                                                   |
| 2026-10-13 | Pridaný `src/data/balance.json` (počiatočný stav + konštanty simulácie), aby žiadne herné číslo nebolo natvrdo v kóde.                                                                                  |
| 2026-10-13 | ID v dátach sú anglické `snake_case` (`lumberjack`, `woodworking`…), zobrazované názvy slovenské. UI texty v `src/app/i18n.ts`.                                                                         |
| 2026-10-13 | Doplnené hodnoty, ktoré špecifikácia nedefinuje (pracovníci, údržba, terén, dosahy služieb, spotreba potravín, prerekvizity) — viď `docs/BALANCING.md`.                                                 |
| 2026-10-13 | Interpretácie pravidiel (aditívne bonusy, sekvenčné míľniky, kopce) a otvorené otázky (nástroje, peniaze) — viď `docs/GAME_DESIGN.md`.                                                                  |
| 2026-10-13 | **Dôvody zlyhania príkazov sú kódy** (`tile_occupied`, `insufficient_resources`…, `engine/core/commandReasons.ts`), UI ich prekladá cez `command.<kód>`. Pole `reason: string` zo špecifikácie zostáva. |
| 2026-10-13 | ID inštancií budov sú `b<n>`, kde n = najväčšie existujúce + 1 — deterministické a bez nového poľa v `GameState`.                                                                                       |
| 2026-10-13 | Zbúranie nevracia suroviny. Posledný sklad sa zbúrať nedá (od neho sa počíta cestná sieť).                                                                                                              |
| 2026-10-13 | Priorita budovy je celé číslo 1–3 (predvolene 2).                                                                                                                                                       |
| 2026-10-13 | Z `balance.json` odstránené `startingState.housingCapacity` (odvodí sa z počiatočného domu), pridané `mapSize`.                                                                                         |
| 2026-10-13 | Engine nevolá `Date.now()` ani `crypto` — `gameId` a `createdAt` dodáva Game Controller pri vytvorení hry.                                                                                              |
| 2026-10-13 | Seed mapy sa dá zadať cez `?seed=N`. Parameter `?e2e` sprístupní `window.__civilis` (čítanie stavu, `canPlace`, `tileToClient`) pre Playwright testy.                                                   |
| 2026-10-13 | `tick()` zatiaľ iba posúva deň a nie je napojený na čas — ekonomika a herná slučka prídu v etape 3.                                                                                                     |
| 2026-10-13 | Príkaz `SET_SPEED` (rozšírenie `GameCommand`) — rýchlosť je súčasť `GameState`, takže aj jej zmena ide cez validovaný príkaz.                                                                           |
| 2026-10-13 | `BuildingDefinition` rozšírená o `toolUsePerWorker` a voliteľné `terrainEfficiency`; `balance.json` o `noToolsEfficiency` a `noFundsEfficiency`.                                                        |
| 2026-10-13 | Schválené: nástroje spotrebúvajú výrobné budovy, peniaze slúžia len na údržbu — detaily v `docs/GAME_DESIGN.md`.                                                                                        |
| 2026-10-13 | Cestná sieť začína pri akomkoľvek sklade, nielen pri prvom.                                                                                                                                             |
| 2026-10-13 | Odvodené hodnoty (`housingCapacity`, `storageCapacity`, `availableWorkers`, `employedWorkers`) sa prepočítavajú po každom príkaze, ticku a `load()` (`refreshDerivedState`).                            |
| 2026-10-13 | `?paused` spustí hru v pauze; test hook má `advanceDays(n)` (len pre E2E).                                                                                                                              |
| 2026-10-13 | `PopulationState.happinessFactors` — zložky spokojnosti z posledného dňa (rozšírenie modelu, potrebné pre UI a štatistiky).                                                                             |
| 2026-10-13 | Spokojnosť sa mení postupne (max. 5 bodov/deň), nie skokom na vážený priemer — dôvod v `docs/GAME_DESIGN.md`.                                                                                           |
| 2026-10-13 | `GameEngine` rozšírený na `CivilisEngine` o `takeEvents()`; `tick()` ostáva `void` podľa špecifikácie.                                                                                                  |
| 2026-10-13 | Prepnutie výskumu vráti investované vedomosti (špecifikácia prepínanie nerieši).                                                                                                                        |
