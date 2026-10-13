# Architektúra

```
React UI (src/components, src/app) ─┐
                                    ├─► Game Controller (src/app) ─► Simulation Engine (src/engine)
PixiJS Renderer (src/renderer) ─────┘           │
                                                └─► Persistence (src/persistence) ─► IndexedDB (Dexie)
```

## Vrstvy a pravidlá závislostí

| Adresár            | Zodpovednosť                                                         | Smie importovať                                                |
| ------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/types/`       | Dátový kontrakt zo špecifikácie (sekcie 5–6). Iba typy a konštanty.  | nič                                                            |
| `src/engine/`      | Čistá deterministická simulácia, validácia dát a príkazov.           | `@/types`, `zod`                                               |
| `src/data/`        | Deklaratívne JSON definície + načítanie cez `loadGameData`.          | `@/engine/core`, `@/types`                                     |
| `src/persistence/` | Dexie, save sloty, export/import, migrácie.                          | `@/engine`, `@/types`, `dexie`                                 |
| `src/app/`         | Game Controller (herná slučka, napojenie engine ↔ store), i18n, App. | všetko                                                         |
| `src/stores/`      | Zustand — iba UI stav a snapshot herného stavu pre React.            | `@/types`, `zustand`                                           |
| `src/renderer/`    | PixiJS izometrický renderer, kamera, picking.                        | `@/types`, `@/data`, `pixi.js`                                 |
| `src/components/`  | React komponenty.                                                    | `@/app`, `@/stores`, `@/data`, `@/types`, `@/renderer/palette` |

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
