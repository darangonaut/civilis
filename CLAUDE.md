# Civilis

- Zadanie: `docs/SPEC.md`. Postup a stav etáp: `IMPLEMENTATION_PLAN.md` — po každej etape ho aktualizuj
  (checklist + log odchýlok).
- `src/engine/` je čistý deterministický TypeScript: žiadny React/PixiJS/Zustand/Dexie,
  žiadne `Math.random()`/`Date.now()`. Herné dáta dostáva parametrom (`GameData`).
- Herné čísla patria do `src/data/*.json` (validované v `src/engine/core/definitions.ts`), nie do kódu.
- UI texty len cez `t()` z `src/app/i18n.ts` — nový kľúč pridaj do `locales/sk.ts`, `cs.ts` aj `en.ts`.
  Názvy z herných dát zobrazuj cez `src/app/names.ts`; nové budovy/technológie doplň aj do `src/data/locales/`.
- Overenie: `npm run typecheck && npm run lint && npm test` (+ `npm run test:e2e` pri zmenách UI).
