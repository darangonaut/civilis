# Balancing

Všetky čísla sú v `src/data/*.json` a dajú sa ladiť bez zmeny kódu. Ceny, výroba, spotreba
dielne a trhoviska, technológie a míľniky sú **zo špecifikácie**; ostatné hodnoty sú doplnené
a vyladené simulovaným hráčom (test F, `tests/integration/playthrough.test.ts`).

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

## Konštanty simulácie (`balance.json`)

| Konštanta               | Hodnota             | Význam                                                                   |
| ----------------------- | ------------------- | ------------------------------------------------------------------------ |
| `mapSize`               | 64 × 64             | zo špecifikácie; generátor zvládne až 256 × 256                          |
| `baseStorageCapacity`   | 100                 | + kapacita pripojených skladov (na každú surovinu, vedomosti bez limitu) |
| `workforceShare`        | 0,5                 | zo špecifikácie                                                          |
| `minimumPopulation`     | 5                   | zo špecifikácie                                                          |
| `foodPerCapita`         | 0,25                | spotreba potravín na obyvateľa za deň                                    |
| `baseProduction`        | 1 drevo, 0.5 kameň  | základný zber bez budov — zabraňuje neobnoviteľnému stavu                |
| `noToolsEfficiency`     | 0,5                 | výkon výrobných budov bez nástrojov                                      |
| `noFundsEfficiency`     | 0,5                 | výkon budov s údržbou pri prázdnej pokladnici                            |
| `happinessWeights`      | 40 / 25 / 20 / 15 % | zo špecifikácie (potraviny, bývanie, voda, vzdelanie)                    |
| prahy spokojnosti       | 60 / 40             | zo špecifikácie                                                          |
| `happinessChangePerDay` | 5                   | max. zmena spokojnosti za deň                                            |
| `housingComfortMargin`  | 0,1                 | voľná kapacita, pri ktorej je zložka bývania 100                         |
| `populationGrowthRate`  | 0,02                | denný rast pri spokojnosti ≥ 60 (min. 1 obyvateľ)                        |
| `populationDeclineRate` | 0,03                | denný pokles pri spokojnosti < 40                                        |

## Technológie (`technologies.json`)

Prerekvizity (špecifikácia ich neuvádza): Organizácia práce ← Spracovanie dreva;
Mestská správa ← Organizácia práce. Ostatné sú voľne dostupné.

## Míľniky (`milestones.json`)

„Kladná bilancia“ potravín aj peňazí je modelovaná ako `minimum: 1` za deň.

## Výsledky vyvažovania (2026-10-13)

Simulovaný hráč robí najviac **jednu stavebnú akciu za deň** a používa iba herné príkazy.
Na 7 mapách (seedy 1, 2, 3, 7, 42, 99, 1234) splní všetky míľniky:

| Míľnik              | Deň (približne) |
| ------------------- | --------------- |
| Založená osada      | 12–13           |
| Sebestačná dedina   | 32–34           |
| Vzdelaná spoločnosť | 48–51           |
| Prosperujúce mesto  | 105–106         |
| Zrod civilizácie    | 134–135         |

Pri 1× je to ≈ 4,5 minúty dokonalej hry; človek s rozmýšľaním a čítaním UI potrebuje
niekoľkonásobne viac. Test F kontroluje hranicu 400 dní.

Zmeny oproti prvému návrhu a prečo:

- **Rast populácie 5 % → 2 %** — bot hru dokončil za ~75 dní, príliš rýchlo.
- **Pracovníci výrobných budov 2 → 3** — pracovná sila nebola obmedzením (zamestnaných ~40 %).
- **Spotreba nástrojov 0,1 → 0,05 / pracovník** — nástroje došli okolo 8. dňa a dielňa zabrala
  väčšinu začiatočných pracovníkov.
- **Údržba znížená na polovicu** (napr. farma 1 → 0,5) — pokladnica sa minula okolo 50. dňa
  a mesto padlo do špirály „bez peňazí → 50 % výkon → viac budov → vyššia údržba“.
- **Základný zber (+1 drevo, +0,5 kameňa denne)** — bez neho sa dalo zaseknúť natrvalo: minúť
  drevo pred postavením drevorubača, alebo kameň pred cestou ku kamenistému terénu.

## Otvorené body

- Hra je pre skúseného hráča skôr ľahká (na konci je zamestnaných ~40 % pracovníkov). Ak má byť
  náročnejšia, prvé páky sú `foodPerCapita` a počet pracovníkov budov.
- Pri nečinnosti na začiatku klesne spokojnosť pod 40 asi za 7 dní (14 s pri 1×).
