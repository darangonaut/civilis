# Architektúra

```
React UI (src/components, src/app) ─┐
                                    ├─► Game Controller (src/app) ─► Simulation Engine (src/engine)
PixiJS Renderer (src/renderer) ─────┘           │
                                                └─► Persistence (src/persistence) ─► IndexedDB (Dexie)
```

## Vrstvy a pravidlá závislostí

| Adresár            | Zodpovednosť                                                         | Smie importovať                                                      |
| ------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/types/`       | Dátový kontrakt zo špecifikácie (sekcie 5–6). Iba typy a konštanty.  | nič                                                                  |
| `src/engine/`      | Čistá deterministická simulácia, validácia dát a príkazov.           | `@/types`, `zod`                                                     |
| `src/data/`        | Deklaratívne JSON definície + načítanie cez `loadGameData`.          | `@/engine/core`, `@/types`                                           |
| `src/persistence/` | Dexie, save sloty, export/import, migrácie.                          | `@/engine`, `@/types`, `dexie`                                       |
| `src/app/`         | Game Controller (herná slučka, napojenie engine ↔ store), i18n, App. | všetko                                                               |
| `src/stores/`      | Zustand — iba UI stav a snapshot herného stavu pre React.            | `@/types`, `zustand`                                                 |
| `src/renderer/`    | PixiJS izometrický renderer, kamera, picking.                        | `@/types`, `@/data`, `pixi.js`                                       |
| `src/components/`  | React komponenty.                                                    | `@/app`, `@/stores`, `@/data`, `@/types`, `@/renderer/pixel/sprites` |

Izolácia enginu je vynútená ESLint pravidlom `no-restricted-imports` v `eslint.config.js`
(React, PixiJS, Zustand, Dexie ani vyššie vrstvy nesmú byť v `src/engine/**`).

## Kľúčové princípy

- **`GameState` je jediný autoritatívny stav.** Odvodené hodnoty (cestné pripojenie, produktivita,
  pokrytie službami) sú cache, ktorú engine vie kedykoľvek prepočítať zo stavu.
- **Engine dostáva herné dáta parametrom** (`GameData`), nie globálnym importom — testy si vedia
  podstrčiť vlastné definície.
- **Determinizmus:** žiadne `Math.random()`, `Date.now()` ani iterácia cez neusporiadané štruktúry
  v engine. Náhodnosť len cez seeded PRNG uložený v stave.
- **Fixný krok:** Game Controller akumuluje reálny čas a volá `engine.tick()` po celých dňoch
  (2 s / 1 s / 0,5 s). Render loop PixiJS beží nezávisle. Pri neaktívnej karte sa akumulátor
  zahodí — zameškaný čas sa nedobieha.
- **Príkazy:** všetky zmeny stavu idú cez `engine.execute(command)`. Validácia prebehne celá pred
  akoukoľvek mutáciou, takže neplatný príkaz stav nezmení.
- **Herné dáta sa validujú pri štarte** (`src/data/index.ts` → `loadGameData`): Zod schémy
  a krížové kontroly (duplicitné ID, neznáme referencie, cykly v technologickom strome, súčet
  váh spokojnosti). Neplatné dáta = okamžitá chyba so zoznamom všetkých problémov.
- **Lokalizácia:** všetky UI texty v `src/app/i18n.ts` (`t(key)`); názvy herných objektov
  v JSON dátach.

## Tok dát v etape 2

1. Klik na mapu → `GameRenderer` prepočíta políčko (`renderer/iso.ts`) → callback `onTileClick`.
2. `MapView` pošle `PLACE_BUILDING` cez `GameController.execute` → engine zvaliduje a zmení stav.
3. Pri úspechu controller upozorní odberateľov: renderer zavolá `sync(state)` (diff sprite-ov podľa
   ID inštancie) a Zustand `revision` sa zvýši, takže React komponenty cez `useGameState` prečítajú
   nový stav.
4. Pri neúspechu sa kód dôvodu preloží (`commandReasonLabel`) a zobrazí v hlásení nad mapou.

## Ukladanie (etapa 6)

- `persistence/gameStateSchema.ts` — Zod schéma `GameState` (`satisfies z.ZodType<GameState>`).
- `persistence/migrations.ts` — `migrateGameState(raw)`: podľa `schemaVersion` postupne aplikuje
  migrácie z `MIGRATIONS` a výsledok zvaliduje. Novšia verzia / chýbajúca migrácia / poškodený
  stav → `SaveError` s kódom, ktorý UI preloží.
- `persistence/db.ts` — Dexie databáza `civilis`, tabuľka `saves` (pozície `slot-1..3`, `autosave`).
- `persistence/saveService.ts` — uloženie (validácia pred zápisom, jedna transakcia), načítanie
  (migrácia + kontrola odkazov na budovy a technológie), export/import JSON.
- `persistence/unloadSnapshot.ts` — synchronná záloha do `localStorage` pri `pagehide`.
- `app/saving.ts` — akcie pre UI (pozície, Ctrl/Cmd+S, export/import, nová hra) a automatické
  ukladanie; zápisy idú cez frontu, aby sa neprekrývali.
- `main.tsx` pred prvým vykreslením zavolá `initializeGame()` (obnova rozohranej hry).

## Testovanie

- `tests/unit` — pravidlá enginu, dáta, ukladanie (fake-indexeddb).
- `tests/integration` — determinizmus (test A), výkon (500 budov), hrateľnosť (test F: bot
  v `tests/helpers/bot.ts` dohrá hru na 7 mapách iba hernými príkazmi).
- `tests/e2e` — Playwright v Chromiu a Firefoxe; `PW_WEBKIT=1` pridá WebKit (potrebuje
  `sudo npx playwright install-deps webkit`). Testy používajú `?seed=42&e2e&paused`; `?e2e`
  sprístupní `window.__civilis` (čítanie stavu, `canPlace`, `tileToClient`, `advanceDays`).

## Grafika — pixel art

- `renderer/pixel/PixelCanvas.ts` — RGBA plátno bez vyhladzovania: polygóny testom stredu pixela
  (čisté schodíky 2:1, políčka sa skladajú bez medzier a prekryvov), ASCII sprity, obrys.
  Čistý TypeScript, testované v `tests/unit/pixelCanvas.test.ts`.
- `renderer/pixel/sprites.ts` — paleta a všetky sprity (terén vo 4 variantoch, budovy, obrys
  políčka, výstražná značka). Políčko má 32 × 16 logických pixelov.
- `renderer/textures.ts` — sprity → Pixi textúry s filtrom `nearest`; aplikácia beží s
  `antialias: false` a `roundPixels: true`, kamera má celočíselné úrovne zoomu (½, 1, 2, 3, 4)
  a zaokrúhľuje polohu na celé pixely.
- Katalóg budov používa tie isté sprity ako ikony (`components/BuildingIcon.tsx`, 2×).
