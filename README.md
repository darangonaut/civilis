# Civilis

Webová singleplayerová budovateľská stratégia (SimCity × Civilization). TypeScript, React, Vite,
PixiJS 8, Zustand, Dexie, Zod.

```sh
npm install
npx playwright install chromium   # iba pre E2E testy
npm run dev                       # http://localhost:5173
```

| Príkaz              | Popis                       |
| ------------------- | --------------------------- |
| `npm run dev`       | vývojový server             |
| `npm run build`     | typecheck + produkčný build |
| `npm run typecheck` | TypeScript                  |
| `npm run lint`      | ESLint                      |
| `npm run format`    | Prettier                    |
| `npm test`          | unit + integration (Vitest) |
| `npm run test:e2e`  | E2E (Playwright)            |

Dokumentácia: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md), [`docs/`](docs/).
