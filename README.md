# Civilis

Webová singleplayerová budovateľská stratégia: budovanie mesta ako v SimCity a civilizačný postup
ako v Civilization, bez vojen a katastrof. Osem ér — od osady cez starovek, stredovek, renesanciu,
priemyselnú, modernú a informačnú éru až po blízku budúcnosť s fúziou a vesmírnym prístavom.
Pixel art grafika so striedaním dňa a noci, hrá sa na počítači aj na mobile, v slovenčine,
češtine a angličtine.

TypeScript · React · Vite · PixiJS 8 · Zustand · Dexie · Zod · Vitest · Playwright

**Hrať online:** https://darangonaut.github.io/civilis/

## Spustenie

```sh
npm install
npm run dev          # http://localhost:5173
```

Z iného zariadenia v tej istej sieti (napr. mobil): `npm run dev -- --host` a otvor adresu
`http://<IP počítača>:5173`.

Produkčný build: `npm run build` → statické súbory v `dist/` (stačí ich servovať, žiadny backend).
Nasadenie na GitHub Pages: `npm run deploy:pages` (vetva `gh-pages`).
Náhľad buildu: `npm run preview`.

## Ako hrať

1. **Drevo a jedlo.** Postav drevorubača na les a farmu na úrodnú pôdu — vedľa cesty napojenej na sklad.
2. **Bývanie a voda.** Domy zvyšujú kapacitu, studňa v dosahu domov zvyšuje spokojnosť. Pri spokojnosti
   aspoň 60, voľnom bývaní a dostatku jedla mesto rastie.
3. **Nástroje a kameň.** Výrobné budovy spotrebúvajú nástroje (dielňa), cesty a lepšie budovy kameň.
4. **Výskum.** Škola produkuje vedomosti. V paneli Výskum je strom technológií každej éry; technológie
   môžeš zaradiť do poradia a po dokončení jednej sa automaticky začne ďalšia.
5. **Peniaze.** Budovy stoja údržbu, trhovisko prináša príjem. Bez peňazí budovy bežia na polovicu.
6. **Lepšie domy.** Dom má 10 úrovní — od jednoduchého domu po arkológiu. Dá sa vylepšovať postupne, alebo
   lepší dom postaviť rovno z doku, keď máš potrebnú technológiu (cena zahŕňa všetky vylepšenia).
   Vyššie úrovne potrebujú služby v dosahu: vodu, školu, kultúru, nemocnicu.
7. **Míľniky a éry.** Vľavo hore je aktuálny cieľ s priebehom podmienok. Splnením éry sa odomknú nové
   technológie, budovy a suroviny (tehly, železo, látky, uhlie, elektrina, elektronika). Po poslednom
   míľniku „Ku hviezdam“ hra pokračuje ako sandbox.
8. **Kolónia na Marse.** Po dohraní vyšli z vesmírneho prístavu kolonizačnú loď: nové mesto začne
   na Marse (skleníky, ľadové vrty, šrot z trosiek, kupoly) so zdedenou výhodou z predošlého mesta.

Stavať sa dá aj ťahaním: cesta sa natiahne ako čiara, ostatné budovy vyplnia obdĺžnik. Susedné farmy
(aj drevorubači, lomy, bane) tvoria blok, ktorý stačí napojiť na cestu v jednom bode. Zbúranie vráti
polovicu surovín. Tlačidlo koša vpravo dole zapne búranie — ťahaním vyberieš obdĺžnik, viac budov
naraz sa zbúra po potvrdení.

Budova s problémom má nad sebou značku so symbolom (cesta, pracovníci, surovina, peniaze, plný sklad);
zelená šípka znamená, že sa dá vylepšiť. Dôvod uvidíš po prejdení myšou alebo kliknutí na budovu,
legenda značiek je v Nastaveniach.

### Rozhranie

- **Horná lišta** — éra, deň a fáza dňa, suroviny so šípkou trendu, obyvatelia, spokojnosť, rýchlosť.
- **Cieľ a udalosti** (vľavo) — aktuálny míľnik a posledné udalosti (výskum, nové éry, hlad).
- **Stavebný dok** (dole) — kategórie, budovy s cenou, detail pri prejdení myšou.
- **Inšpektor** (vpravo) — po kliknutí na budovu: stav, obyvatelia/pracovníci, vylepšenie, zbúranie.
- **Minimapa a panely** (vpravo dole) — Výskum, Míľniky, Štatistiky, Uložiť, Nastavenia.

### Ovládanie

| Akcia                              | Myš a klávesnica                      | Dotyk                         |
| ---------------------------------- | ------------------------------------- | ----------------------------- |
| Posun mapy                         | ťahanie, pravé tlačidlo, šípky / WASD | jeden prst (pri stavbe dva)   |
| Priblíženie                        | koliesko, tlačidlá + / −              | roztiahnutie dvoch prstov     |
| Výber / stavba                     | ľavé tlačidlo, ťahanie = viac naraz   | ťuknutie, ťahanie prstom      |
| Búranie viac budov                 | tlačidlo koša, ťahanie ľavým          | tlačidlo koša, ťahanie prstom |
| Zrušenie stavby, zatvorenie panelu | Escape                                | tlačidlo „Zrušiť stavbu“ / ✕  |
| Pauza / rýchlosť 1× 2× 4×          | medzerník / 1 2 3                     | tlačidlá v hornej lište       |
| Uloženie                           | Ctrl/Cmd + S                          | panel Uložiť                  |

Na mobile sa dá hra pridať na plochu („Pridať na plochu“) a spúšťa sa potom na celú obrazovku.

Hra sa ukladá automaticky (každých 30 dní a pri zatvorení stránky); v paneli Uložiť sú 3 pozície,
export a import JSON. Konkrétnu mapu otvoríš cez `?seed=123`, novú hru cez `?new`, novú hru
na Marse cez `?planet=mars`.

### Jazyky

Slovenčina, čeština a angličtina — prepínač je v Nastaveniach. Pri prvom spustení sa jazyk vyberie
podľa prehliadača. Texty rozhrania sú v `src/app/locales/`, preklady názvov budov, technológií,
míľnikov a ér v `src/data/locales/` (slovenčina je priamo v herných dátach).

## Vývoj

| Príkaz                            | Popis                                                                   |
| --------------------------------- | ----------------------------------------------------------------------- |
| `npm run typecheck`               | TypeScript                                                              |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                       |
| `npm test`                        | unit + integration (Vitest), vrátane rýchleho testu hrateľnosti (3 éry) |
| `npm run test:full`               | test hrateľnosti celej hry (8 ér na Zemi aj na Marse, ~3 min)           |
| `npm run test:e2e`                | E2E (Playwright, Chromium + Firefox; `PW_WEBKIT=1` aj WebKit)           |

Pred prvým E2E: `npx playwright install chromium firefox`.

Štruktúra: `src/engine/` (deterministická simulácia bez UI), `src/data/` (herné dáta v JSON),
`src/renderer/` (PixiJS, pixel art kreslený v kóde), `src/components/` a `src/app/` (React UI),
`src/persistence/` (ukladanie, migrácie).

Dokumentácia: [`docs/SPEC.md`](docs/SPEC.md) (zadanie), [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md),
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md),
[`docs/BALANCING.md`](docs/BALANCING.md).
