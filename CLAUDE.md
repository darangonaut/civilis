# Civilis

- Zadanie: `docs/SPEC.md`. Postup a stav etáp: `IMPLEMENTATION_PLAN.md` — po každej etape ho aktualizuj
  (checklist + log odchýlok).
- `src/engine/` je čistý deterministický TypeScript: žiadny React/PixiJS/Zustand/Dexie,
  žiadne `Math.random()`/`Date.now()`. Herné dáta dostáva parametrom (`GameData`).
- Herné čísla patria do `src/data/*.json` (validované v `src/engine/core/definitions.ts`), nie do kódu.
- UI texty len cez `t()` z `src/app/i18n.ts`.
- Overenie: `npm run typecheck && npm run lint && npm test` (+ `npm run test:e2e` pri zmenách UI).
