# Civilis

Webová singleplayerová budovateľská stratégia — budovanie mesta zo SimCity a civilizačný postup
z Civilization. Bez vojen a katastrof. Prvá éra: z osady s 10 obyvateľmi na civilizáciu s 200.

TypeScript · React · Vite · PixiJS 8 · Zustand · Dexie · Zod · Vitest · Playwright

## Spustenie

```sh
npm install
npm run dev          # http://localhost:5173
```

Produkčný build: `npm run build` → statické súbory v `dist/` (stačí ich servovať, žiadny backend).
Náhľad buildu: `npm run preview`.

## Ako hrať

1. **Drevo a jedlo.** Postav drevorubača na les a farmu na úrodnú pôdu — vedľa cesty napojenej na sklad.
2. **Bývanie a voda.** Domy zvyšujú kapacitu, studňa v dosahu domov zvyšuje spokojnosť. Pri spokojnosti
   aspoň 60, voľnom bývaní a dostatku jedla mesto rastie.
3. **Nástroje a kameň.** Výrobné budovy spotrebúvajú nástroje (dielňa), cesty a lepšie budovy kameň.
4. **Výskum.** Škola produkuje vedomosti; technológie vyberáš v paneli Výskum.
5. **Peniaze.** Budovy stoja údržbu, trhovisko prináša príjem. Bez peňazí budovy bežia na polovicu.
6. **Míľniky.** Panel Míľniky ukazuje aktuálny cieľ a priebeh podmienok. Po piatom míľniku sa prvá éra
   končí a hra pokračuje ako sandbox.

Nefunkčná budova má nad sebou červený výkričník; dôvod („Chýba cesta“, „Nedostatok dreva“…) vidíš
po kliknutí na ňu.

| Ovládanie                         |                          |
| --------------------------------- | ------------------------ |
| Posun mapy / priblíženie          | ťahanie myšou / koliesko |
| Výber / umiestnenie               | ľavé tlačidlo            |
| Zrušenie akcie, zatvorenie panelu | Escape                   |
| Pauza / rýchlosť 1× 2× 4×         | medzerník / 1 2 3        |
| Uloženie                          | Ctrl/Cmd + S             |

Hra sa ukladá automaticky (každých 30 dní a pri zatvorení stránky); v paneli Uložiť sú 3 pozície,
export a import JSON. Konkrétnu mapu otvoríš cez `?seed=123`, novú hru cez `?new`.

## Vývoj

| Príkaz                            | Popis                                                         |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run typecheck`               | TypeScript                                                    |
| `npm run lint` / `npm run format` | ESLint / Prettier                                             |
| `npm test`                        | unit + integration (Vitest), vrátane testu hrateľnosti        |
| `npm run test:e2e`                | E2E (Playwright, Chromium + Firefox; `PW_WEBKIT=1` aj WebKit) |

Pred prvým E2E: `npx playwright install chromium firefox`.

Dokumentácia: [`docs/SPEC.md`](docs/SPEC.md) (zadanie), [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md),
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md),
[`docs/BALANCING.md`](docs/BALANCING.md).
