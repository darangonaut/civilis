# Balancing

Hodnoty, ktoré špecifikácia **nedefinuje** a boli doplnené. Všetky sú v `src/data/*.json`,
takže sa dajú ladiť bez zmeny kódu. Finálne vyvažovanie je úloha etapy 6.

## Budovy (`src/data/buildings.json`)

| Budova     | Pracovníci | Údržba/deň | Povolený terén                       | Dosah služby |
| ---------- | ---------- | ---------- | ------------------------------------ | ------------ |
| Dom        | 0          | 0          | tráva, úrodná pôda                   | —            |
| Cesta      | 0          | 0          | tráva, úrodná, les, kamenistý, kopce | —            |
| Drevorubač | 2          | 1          | les                                  | —            |
| Farma      | 2          | 1          | úrodná pôda, tráva                   | —            |
| Kameňolom  | 3          | 1          | kamenistý terén                      | —            |
| Studňa     | 0          | 0          | tráva, úrodná pôda, kopce            | voda, 4      |
| Sklad      | 0          | 1          | tráva, úrodná pôda                   | —            |
| Dielňa     | 3          | 2          | tráva, úrodná pôda                   | —            |
| Škola      | 2          | 3          | tráva, úrodná pôda                   | vzdelanie, 6 |
| Trhovisko  | 2          | 0          | tráva, úrodná pôda                   | —            |

Úvaha: počiatočných 5 pracovníkov (10 obyvateľov × 50 %) stačí presne na farmu + drevorubača,
takže prvé rozhodnutie je „najprv domy, alebo kameňolom?“. Farma je povolená aj na tráve —
výnos sa bude škálovať podľa `fertility` políčka (etapa 3), úrodná pôda tak zostáva výhodnejšia.

Spotreba nástrojov (`toolUsePerWorker`): drevorubač, farma, kameňolom 0,1 / pracovník / deň.
Farma na tráve: `terrainEfficiency.grass = 0.5`.

## Ostatné konštanty (`src/data/balance.json`)

| Konštanta               | Hodnota       | Poznámka                                                        |
| ----------------------- | ------------- | --------------------------------------------------------------- |
| `foodPerCapita`         | 0,25          | 10 obyv. = 2,5 potravín/deň; 200 obyv. = 50 (≈ 5 fariem + tech) |
| `mapSize`               | 64 × 64       | zo špecifikácie; generátor zvládne až 256 × 256                 |
| `noToolsEfficiency`     | 0,5           | výkon výrobných budov bez nástrojov                             |
| `noFundsEfficiency`     | 0,5           | výkon budov s údržbou pri prázdnej pokladnici                   |
| `baseStorageCapacity`   | 100           | + 200 za každý sklad; počiatočný sklad ⇒ 300                    |
| `workforceShare`        | 0,5           | zo špecifikácie                                                 |
| `minimumPopulation`     | 5             | zo špecifikácie                                                 |
| `happinessWeights`      | 40/25/20/15 % | zo špecifikácie                                                 |
| prahy spokojnosti       | 60 / 40       | zo špecifikácie                                                 |
| `happinessChangePerDay` | 5             | max. zmena spokojnosti za deň                                   |
| `housingComfortMargin`  | 0,1           | voľná kapacita, pri ktorej je zložka bývania 100                |
| `populationGrowthRate`  | 0,05          | denný rast pri spokojnosti ≥ 60                                 |
| `populationDeclineRate` | 0,03          | denný pokles pri spokojnosti < 40                               |

## Technológie (`src/data/technologies.json`)

Prerekvizity (špecifikácia ich neuvádza): Organizácia práce ← Spracovanie dreva;
Mestská správa ← Organizácia práce. Ostatné sú voľne dostupné.

## Míľniky (`src/data/milestones.json`)

„Kladná bilancia“ potravín aj peňazí je modelovaná ako `minimum: 1` za deň.

## Poznámky na vyvažovanie (etapa 6)

- Pri nečinnosti na začiatku (10/10 obyvateľov, bez studne) klesne spokojnosť pod 40 asi za
  7 dní (14 s pri 1×). Hráč musí rýchlo postaviť dom a studňu — over, či to nie je príliš prísne.
- Rast 5 %/deň je rýchly: 20 → 200 obyvateľov za ~50 dní, ak stíha bývanie. Reálnou brzdou je
  drevo na domy a potraviny.
