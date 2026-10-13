# Balancing

Všetky čísla sú v `src/data/*.json` a dajú sa ladiť bez zmeny kódu. Prvá éra vychádza zo
špecifikácie (ceny a výroba budov, efekty technológií); éry Starovek a Stredovek, úrovne budov,
ceny technológií a nároky míľnikov sú doplnené na želanie (dlhšia hra) a vyladené simulovaným
hráčom (test F, `tests/integration/playthrough.test.ts`).

## Budovy (`buildings.json`)

„blok“ = pripojenie sa šíri cez susedné budovy rovnakého typu (`connectsAdjacent`).

| Budova         | Éra       | Cena                                                    | Výroba / deň | Spotreba / deň    | Pracovníci | Údržba | Terén                                | Služba        |
| -------------- | --------- | ------------------------------------------------------- | ------------ | ----------------- | ---------- | ------ | ------------------------------------ | ------------- |
| Dom            | Osada     | 10 drevo                                                | —            | —                 | 0          | 0      | tráva, úrodná                        | —             |
| Cesta          | Osada     | 1 kameň                                                 | —            | —                 | 0          | 0      | tráva, úrodná, les, kamenistý, kopce | —             |
| Drevorubač     | Osada     | 15 drevo                                                | 6 drevo      | —                 | 3          | 0,5    | les · blok                           | —             |
| Farma          | Osada     | 10 drevo                                                | 8 potraviny  | —                 | 3          | 0,5    | úrodná, tráva (tráva 50 %) · blok    | —             |
| Kameňolom      | Osada     | 20 drevo                                                | 4 kameň      | —                 | 3          | 0,5    | kamenistý · blok                     | —             |
| Studňa         | Osada     | 10 drevo, 5 kameň                                       | —            | —                 | 0          | 0      | tráva, úrodná, kopce                 | voda, 4       |
| Sklad          | Osada     | 20 drevo, 10 kameň                                      | —            | —                 | 0          | 0,5    | tráva, úrodná                        | —             |
| Dielňa         | Osada     | 20 drevo, 10 kameň                                      | 2 nástroje   | 2 drevo, 1 kameň  | 3          | 1      | tráva, úrodná                        | —             |
| Škola          | Osada     | 30 drevo, 20 kameň                                      | 3 vedomosti  | —                 | 3          | 1,5    | tráva, úrodná                        | vzdelanie, 6  |
| Trhovisko      | Osada     | 20 drevo, 10 kameň                                      | — + 8 peňazí | 2 potraviny       | 3          | 0      | tráva, úrodná                        | —             |
| Tehelňa        | Starovek  | 40 drevo, 30 kameň                                      | 3 tehly      | 2 kameň, 1 drevo  | 4          | 1,5    | tráva, úrodná                        | —             |
| Rybárska chata | Starovek  | 30 drevo                                                | 10 potraviny | —                 | 2          | 0,5    | voda                                 | —             |
| Akvadukt       | Starovek  | 40 kameň, 20 tehly                                      | —            | —                 | 0          | 1      | tráva, úrodná                        | voda, 9       |
| Chrám          | Starovek  | 20 drevo, 60 kameň, 40 tehly                            | —            | —                 | 2          | 2      | tráva, úrodná                        | kultúra, 7    |
| Baňa           | Stredovek | 60 drevo, 40 kameň                                      | 3 železo     | —                 | 4          | 1      | kopce · blok                         | —             |
| Huta           | Stredovek | 40 kameň, 40 tehly                                      | 6 nástroje   | 2 železo, 2 drevo | 4          | 2      | tráva, úrodná                        | —             |
| Univerzita     | Stredovek | 60 kameň, 80 tehly, 20 nástroje                         | 8 vedomosti  | —                 | 5          | 4      | tráva, úrodná                        | vzdelanie, 10 |
| Katedrála      | Stredovek | 150 drevo, 200 kameň, 200 tehly, 80 železo, 40 nástroje | —            | —                 | 6          | 6      | tráva, úrodná                        | kultúra, 14   |

## Úrovne budov (`levels`)

| Vylepšenie            | Úroveň | Cena                             | Technológia       | Služby v dosahu          | Zmena               |
| --------------------- | ------ | -------------------------------- | ----------------- | ------------------------ | ------------------- |
| Dom → Murovaný dom    | 2      | 15 kameň, 4 nástroje             | Kamenárstvo       | voda                     | bývanie 16          |
| Dom → Meštiansky dom  | 3      | 20 drevo, 25 kameň, 8 nástroje   | Mestská správa    | voda, vzdelanie          | bývanie 24          |
| Dom → Vila            | 4      | 20 kameň, 30 tehly, 10 nástroje  | Architektúra      | voda, vzdelanie, kultúra | bývanie 32          |
| Dom → Patricijský dom | 5      | 50 tehly, 20 železo, 20 nástroje | Bankovníctvo      | voda, vzdelanie, kultúra | bývanie 40          |
| Sklad → Veľký sklad   | 2      | 30 drevo, 30 kameň, 5 nástroje   | Organizácia práce | —                        | sklad 450, údržba 1 |

## Technológie (`technologies.json`)

| Éra       | Technológia       | Cena | Prerekvizity           |
| --------- | ----------------- | ---- | ---------------------- |
| Osada     | Spracovanie dreva | 20   | —                      |
| Osada     | Zavlažovanie      | 30   | —                      |
| Osada     | Kamenárstvo       | 30   | —                      |
| Osada     | Organizácia práce | 40   | Spracovanie dreva      |
| Osada     | Vzdelávanie       | 50   | —                      |
| Osada     | Mestská správa    | 60   | Organizácia práce      |
| Starovek  | Tehliarstvo       | 80   | Kamenárstvo            |
| Starovek  | Rybárstvo         | 70   | Zavlažovanie           |
| Starovek  | Mytológia         | 100  | Vzdelávanie            |
| Starovek  | Akvadukty         | 120  | Tehliarstvo            |
| Starovek  | Architektúra      | 150  | Tehliarstvo, Mytológia |
| Stredovek | Baníctvo          | 200  | Architektúra           |
| Stredovek | Hutníctvo         | 250  | Baníctvo               |
| Stredovek | Univerzity        | 300  | Architektúra           |
| Stredovek | Bankovníctvo      | 280  | Univerzity             |
| Stredovek | Teológia          | 400  | Univerzity, Hutníctvo  |

## Míľniky (`milestones.json`)

Splnenie posledného míľnika éry odomkne ďalšiu éru (jej technológie a budovy).

| Éra       | Míľnik              | Podmienky                                                                            |
| --------- | ------------------- | ------------------------------------------------------------------------------------ |
| Osada     | Založená osada      | 20 obyvateľov; Farma ≥ 1; Drevorubač ≥ 1                                             |
| Osada     | Sebestačná dedina   | 40 obyvateľov; bilancia potraviny ≥ 1 (10 dní); spokojnosť ≥ 60                      |
| Osada     | Vzdelaná spoločnosť | Škola ≥ 1; 3 technológií; Dom úrovne 2+ ≥ 3                                          |
| Osada     | Prosperujúce mesto  | 120 obyvateľov; Trhovisko ≥ 1; bilancia peňazí ≥ 1 (15 dní); Dom úrovne 2+ ≥ 8       |
| Osada     | Zrod civilizácie    | 300 obyvateľov; všetky technológie éry; spokojnosť ≥ 75 (20 dní); Dom úrovne 3+ ≥ 10 |
| Starovek  | Staroveké mesto     | 500 obyvateľov; Tehelňa ≥ 1; Rybárska chata ≥ 1                                      |
| Starovek  | Chrámy a akvadukty  | Chrám ≥ 1; Akvadukt ≥ 1; Dom úrovne 4+ ≥ 5                                           |
| Starovek  | Staroveká metropola | 900 obyvateľov; Dom úrovne 4+ ≥ 15; 11 technológií; spokojnosť ≥ 75 (20 dní)         |
| Stredovek | Remeslá a baníctvo  | 1300 obyvateľov; Baňa ≥ 2; Huta ≥ 1                                                  |
| Stredovek | Mesto učencov       | Univerzita ≥ 1; Dom úrovne 5+ ≥ 10; 14 technológií                                   |
| Stredovek | Zlatý vek           | 2000 obyvateľov; Katedrála ≥ 1; všetky technológie éry; spokojnosť ≥ 80 (30 dní)     |

## Konštanty simulácie (`balance.json`)

| Konštanta                                 | Hodnota            | Význam                                                             |
| ----------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| `baseStorageCapacity`                     | 100                | + kapacita pripojených skladov (na surovinu, vedomosti bez limitu) |
| `foodPerCapita`                           | 0,25               | spotreba potravín na obyvateľa za deň                              |
| `demolishRefund`                          | 0,5                | podiel surovín, ktorý vráti zbúranie (recyklácia)                  |
| `baseProduction`                          | 1 drevo, 0,5 kameň | základný zber bez budov — ochrana pred zaseknutím                  |
| `noToolsEfficiency` / `noFundsEfficiency` | 0,5 / 0,5          | výkon bez nástrojov / pri prázdnej pokladnici                      |
| `happinessChangePerDay`                   | 5                  | max. zmena spokojnosti za deň                                      |
| `housingComfortMargin`                    | 0,1                | voľná kapacita, pri ktorej je zložka bývania 100                   |
| `populationBaseGrowth`                    | 0,3                | prisťahovalci za deň (zlomky sa sčítavajú)                         |
| `populationGrowthRate`                    | 0,005              | denný prirodzený rast pri spokojnosti ≥ 60                         |
| `populationMaxGrowth`                     | 5                  | najviac nových obyvateľov za deň                                   |
| `populationDeclineRate`                   | 0,03               | denný pokles pri spokojnosti < 40                                  |

## Výsledky vyvažovania (2026-10-13, tri éry)

Simulovaný hráč (2 stavebné akcie denne, iba herné príkazy) na mapách 1, 7, 42, 1234:

| Koniec éry                     | Deň (približne) |
| ------------------------------ | --------------- |
| Osada (Zrod civilizácie)       | 330–360         |
| Starovek (Staroveká metropola) | 530–540         |
| Stredovek (Zlatý vek)          | 860–910         |

Pôvodná prvá éra trvala botovi 135 dní, celá hra je teraz ≈ 6,5× dlhšia. Na konci stojí
~680 budov a ciest (≈ 17 % mapy) a v meste žije ~2 700 obyvateľov. Test F kontroluje hranicu 1 200 dní.

## Otvorené body

- Na konci hry sa hromadia veľké prebytky surovín — priestor pre ďalšie „spotrebiče“
  (obchod, divy, ďalšia éra).
- Mesto zaberá ~17 % mapy; pre ešte väčšie mestá možno zväčšiť mapu (`mapSize`, engine zvládne 256 × 256).
