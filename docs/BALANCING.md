# Balancing

Všetky čísla sú v `src/data/*.json` a dajú sa ladiť bez zmeny kódu. Ceny a výroba budov, spotreba
dielne a trhoviska a efekty technológií sú **zo špecifikácie**. Ceny technológií, úrovne budov,
nároky míľnikov a ostatné hodnoty sú upravené alebo doplnené a vyladené simulovaným hráčom
(test F, `tests/integration/playthrough.test.ts`).

## Budovy (`buildings.json`)

| Budova     | Cena               | Výroba / deň | Spotreba / deň   | Pracovníci | Údržba | Nástroje / prac. | Terén                                | Služba       |
| ---------- | ------------------ | ------------ | ---------------- | ---------- | ------ | ---------------- | ------------------------------------ | ------------ |
| Dom        | 10 drevo           | —            | —                | 0          | 0      | —                | tráva, úrodná                        | —            |
| Cesta      | 1 kameň            | —            | —                | 0          | 0      | —                | tráva, úrodná, les, kamenistý, kopce | —            |
| Drevorubač | 15 drevo           | 6 drevo      | —                | 3          | 0,5    | 0,05             | les                                  | —            |
| Farma      | 10 drevo           | 8 potraviny  | —                | 3          | 0,5    | 0,05             | úrodná, tráva (tráva 50 %)           | —            |
| Kameňolom  | 20 drevo           | 4 kameň      | —                | 3          | 0,5    | 0,05             | kamenistý                            | —            |
| Studňa     | 10 drevo, 5 kameň  | —            | —                | 0          | 0      | —                | tráva, úrodná, kopce                 | voda, 4      |
| Sklad      | 20 drevo, 10 kameň | —            | —                | 0          | 0,5    | —                | tráva, úrodná                        | —            |
| Dielňa     | 20 drevo, 10 kameň | 2 nástroje   | 2 drevo, 1 kameň | 3          | 1      | —                | tráva, úrodná                        | —            |
| Škola      | 30 drevo, 20 kameň | 3 vedomosti  | —                | 3          | 1,5    | —                | tráva, úrodná                        | vzdelanie, 6 |
| Trhovisko  | 20 drevo, 10 kameň | — + 8 peňazí | 2 potraviny      | 3          | 0      | —                | tráva, úrodná                        | —            |

## Úrovne budov (`levels` v `buildings.json`)

Vylepšuje hráč tlačidlom v detaile budovy. Neuvedené parametre sa preberajú z nižšej úrovne.

| Vylepšenie           | Úroveň | Cena                           | Technológia       | Služby v dosahu | Zmena               |
| -------------------- | ------ | ------------------------------ | ----------------- | --------------- | ------------------- |
| Dom → Murovaný dom   | 2      | 15 kameň, 4 nástroje           | Kamenárstvo       | voda            | bývanie 20          |
| Dom → Meštiansky dom | 3      | 20 drevo, 25 kameň, 8 nástroje | Mestská správa    | voda, vzdelanie | bývanie 35          |
| Sklad → Veľký sklad  | 2      | 30 drevo, 30 kameň, 5 nástroje | Organizácia práce | —               | sklad 450, údržba 1 |

## Technológie (`technologies.json`)

Ceny sú oproti špecifikácii **2×** (predĺženie hry, 2026-10-13).

| Technológia       | Cena | Prerekvizity      |
| ----------------- | ---- | ----------------- |
| Spracovanie dreva | 20   | —                 |
| Zavlažovanie      | 30   | —                 |
| Kamenárstvo       | 30   | —                 |
| Organizácia práce | 40   | Spracovanie dreva |
| Vzdelávanie       | 50   | —                 |
| Mestská správa    | 60   | Organizácia práce |

## Míľniky (`milestones.json`)

Oproti špecifikácii pribudli podmienky na vylepšené domy a vyššie počty obyvateľov v míľnikoch 4 a 5
(predĺženie hry). „Kladná bilancia“ je modelovaná ako `minimum: 1` za deň.

| Míľnik              | Podmienky                                                                        |
| ------------------- | -------------------------------------------------------------------------------- |
| Založená osada      | 20 obyvateľov; Farma ≥ 1; Drevorubač ≥ 1                                         |
| Sebestačná dedina   | 40 obyvateľov; bilancia potraviny ≥ 1 (10 dní); spokojnosť ≥ 60                  |
| Vzdelaná spoločnosť | Škola ≥ 1; 3 technológie; Dom úrovne 2+ ≥ 3                                      |
| Prosperujúce mesto  | 120 obyvateľov; Trhovisko ≥ 1; bilancia peňazí ≥ 1 (15 dní); Dom úrovne 2+ ≥ 8   |
| Zrod civilizácie    | 300 obyvateľov; všetky technológie; spokojnosť ≥ 75 (20 dní); Dom úrovne 3+ ≥ 10 |

## Konštanty simulácie (`balance.json`)

| Konštanta               | Hodnota             | Význam                                                                   |
| ----------------------- | ------------------- | ------------------------------------------------------------------------ |
| `mapSize`               | 64 × 64             | zo špecifikácie; generátor zvládne až 256 × 256                          |
| `baseStorageCapacity`   | 100                 | + kapacita pripojených skladov (na každú surovinu, vedomosti bez limitu) |
| `workforceShare`        | 0,5                 | zo špecifikácie                                                          |
| `minimumPopulation`     | 5                   | zo špecifikácie                                                          |
| `foodPerCapita`         | 0,25                | spotreba potravín na obyvateľa za deň                                    |
| `baseProduction`        | 1 drevo, 0,5 kameň  | základný zber bez budov — zabraňuje neobnoviteľnému stavu                |
| `noToolsEfficiency`     | 0,5                 | výkon výrobných budov bez nástrojov                                      |
| `noFundsEfficiency`     | 0,5                 | výkon budov s údržbou pri prázdnej pokladnici                            |
| `happinessWeights`      | 40 / 25 / 20 / 15 % | zo špecifikácie (potraviny, bývanie, voda, vzdelanie)                    |
| prahy spokojnosti       | 60 / 40             | zo špecifikácie                                                          |
| `happinessChangePerDay` | 5                   | max. zmena spokojnosti za deň                                            |
| `housingComfortMargin`  | 0,1                 | voľná kapacita, pri ktorej je zložka bývania 100                         |
| `populationBaseGrowth`  | 0,3                 | prisťahovalci za deň (zlomky sa sčítavajú)                               |
| `populationGrowthRate`  | 0,005               | denný prirodzený rast pri spokojnosti ≥ 60                               |
| `populationDeclineRate` | 0,03                | denný pokles pri spokojnosti < 40                                        |

## Výsledky vyvažovania (2026-10-13, po predĺžení hry)

Simulovaný hráč robí najviac **jednu stavebnú akciu za deň**, používa iba herné príkazy
a vylepšuje domy. Na 7 mapách (seedy 1, 2, 3, 7, 42, 99, 1234):

| Míľnik              | Deň (približne) | Pred predĺžením |
| ------------------- | --------------- | --------------- |
| Založená osada      | 29–30           | 12–13           |
| Sebestačná dedina   | 74–84           | 32–34           |
| Vzdelaná spoločnosť | 84–101          | 48–51           |
| Prosperujúce mesto  | 276–347         | 105–106         |
| Zrod civilizácie    | 332–367         | 134–135         |

Celá prvá éra je teda ≈ 2,5–2,7× dlhšia (dokonalá hra ≈ 11–12 minút pri 1×; človek viac).
Test F kontroluje hranicu 500 dní.

História zmien:

- Rast populácie 5 % → 2 % → plynulý rast 0,3 + 0,5 % denne so sčítavaním zlomkov (predtým
  min. 1 obyvateľ denne, takže začiatok bol vždy rovnako rýchly).
- Výrobné budovy 3 pracovníci, nástroje 0,05 / pracovník, údržba na polovicu.
- Základný zber +1 drevo, +0,5 kameňa denne (ochrana pred zaseknutím).
- Ceny technológií 2×, míľniky 3–5 vyžadujú vylepšené domy, míľnik 4 120 a míľnik 5 300 obyvateľov.

## Otvorené body

- Prosperujúce mesto (kladná peňažná bilancia 15 dní) je pre bota najdlhší úsek, lebo trhovisko
  stavia až pri nízkej pokladnici. Človek ho môže splniť skôr.
- Hra je pre skúseného hráča skôr ľahká (zamestnaných ~40 % pracovníkov). Páky: `foodPerCapita`,
  pracovníci budov, ceny vylepšení.
