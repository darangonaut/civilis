# Balancing

Všetky čísla sú v `src/data/*.json` a dajú sa ladiť bez zmeny kódu. Prvá éra vychádza zo
špecifikácie (ceny a výroba budov, efekty technológií); ďalších 7 ér, úrovne budov, voliteľné
technológie a nároky míľnikov sú doplnené na želanie a vyladené simulovaným hráčom
(test F, `tests/integration/playthrough.test.ts`).

**8 ér, 58 technológií** (Osada 8 · Starovek 7 · Stredovek 7 · Renesancia 7 · Priemyselná éra 7 · Moderná éra 8 · Informačný vek 7 · Blízka budúcnosť 7), **45 typov budov**, **26 míľnikov**.

## Budovy (`buildings.json`)

„blok“ = pripojenie sa šíri cez susedné budovy rovnakého typu (`connectsAdjacent`).

| Budova                      | Éra              | Cena                                                                     | Výroba / deň   | Spotreba / deň              | Pracovníci | Údržba | Terén                                  | Služba            |
| --------------------------- | ---------------- | ------------------------------------------------------------------------ | -------------- | --------------------------- | ---------- | ------ | -------------------------------------- | ----------------- |
| Dom                         | Osada            | 10 drevo                                                                 | —              | —                           | 0          | 0      | tráva, úrodná                          | —                 |
| Cesta                       | Osada            | 1 kameň                                                                  | —              | —                           | 0          | 0      | tráva, úrodná, les, kamenistý, kopce   | —                 |
| Drevorubač                  | Osada            | 15 drevo                                                                 | 6 drevo        | —                           | 3          | 0,5    | les · blok                             | —                 |
| Farma                       | Osada            | 10 drevo                                                                 | 8 potraviny    | —                           | 3          | 0,5    | úrodná, tráva (tráva 50 %) · blok      | —                 |
| Kameňolom                   | Osada            | 20 drevo                                                                 | 4 kameň        | —                           | 3          | 0,5    | kamenistý · blok                       | —                 |
| Studňa                      | Osada            | 10 drevo, 5 kameň                                                        | —              | —                           | 0          | 0      | tráva, úrodná, kopce                   | voda, 4           |
| Sklad                       | Osada            | 20 drevo, 10 kameň                                                       | —              | —                           | 0          | 0,5    | tráva, úrodná                          | —                 |
| Dielňa                      | Osada            | 20 drevo, 10 kameň                                                       | 2 nástroje     | 2 drevo, 1 kameň            | 3          | 1      | tráva, úrodná                          | —                 |
| Škola                       | Osada            | 30 drevo, 20 kameň                                                       | 3 vedomosti    | —                           | 3          | 1,5    | tráva, úrodná                          | vzdelanie, 6      |
| Trhovisko                   | Osada            | 20 drevo, 10 kameň                                                       | — + 8 peňazí   | 2 potraviny                 | 3          | 0      | tráva, úrodná                          | —                 |
| Tehelňa                     | Starovek         | 40 drevo, 30 kameň                                                       | 3 tehly        | 2 kameň, 1 drevo            | 4          | 1,5    | tráva, úrodná                          | —                 |
| Rybárska chata              | Starovek         | 30 drevo                                                                 | 10 potraviny   | —                           | 2          | 0,5    | voda                                   | —                 |
| Akvadukt                    | Starovek         | 40 kameň, 20 tehly                                                       | —              | —                           | 0          | 1      | tráva, úrodná                          | voda, 9           |
| Chrám                       | Starovek         | 20 drevo, 60 kameň, 40 tehly                                             | —              | —                           | 2          | 2      | tráva, úrodná                          | kultúra, 7        |
| Baňa                        | Stredovek        | 60 drevo, 40 kameň                                                       | 3 železo       | —                           | 4          | 1      | kopce · blok                           | —                 |
| Huta                        | Stredovek        | 40 kameň, 40 tehly                                                       | 6 nástroje     | 2 železo, 2 drevo           | 4          | 2      | tráva, úrodná                          | —                 |
| Univerzita                  | Stredovek        | 60 kameň, 80 tehly, 20 nástroje                                          | 8 vedomosti    | —                           | 5          | 4      | tráva, úrodná                          | vzdelanie, 10     |
| Katedrála                   | Stredovek        | 150 drevo, 200 kameň, 200 tehly, 80 železo, 40 nástroje                  | —              | —                           | 6          | 6      | tráva, úrodná                          | kultúra, 14       |
| Pastvina                    | Renesancia       | 40 drevo                                                                 | 2 látky        | —                           | 2          | 0,5    | tráva, kopce · blok                    | —                 |
| Prístav                     | Renesancia       | 80 drevo, 60 kameň, 40 tehly                                             | — + 40 peňazí  | 2 látky, 1 nástroje         | 6          | 3      | voda                                   | —                 |
| Tlačiareň                   | Renesancia       | 40 kameň, 60 tehly, 20 nástroje                                          | 14 vedomosti   | 2 drevo                     | 5          | 3      | tráva, úrodná                          | —                 |
| Observatórium               | Renesancia       | 80 kameň, 80 tehly, 20 železo                                            | 6 vedomosti    | —                           | 4          | 4      | tráva, úrodná, kopce                   | vzdelanie, 14     |
| Divadlo                     | Renesancia       | 60 kameň, 100 tehly, 40 látky                                            | —              | —                           | 6          | 5      | tráva, úrodná                          | kultúra, 12       |
| Uhoľná baňa                 | Priemyselná éra  | 80 drevo, 60 kameň, 20 nástroje                                          | 4 uhlie        | —                           | 5          | 2      | kopce, kamenistý · blok                | —                 |
| Oceliareň                   | Priemyselná éra  | 120 tehly, 60 železo                                                     | 18 nástroje    | 3 železo, 3 uhlie           | 8          | 4      | tráva, úrodná                          | —                 |
| Textilná továreň            | Priemyselná éra  | 150 tehly, 40 železo, 40 nástroje                                        | 12 látky       | 2 uhlie, 2 drevo            | 8          | 4      | tráva, úrodná                          | —                 |
| Železničná stanica          | Priemyselná éra  | 150 tehly, 80 železo, 50 uhlie                                           | — + 50 peňazí  | 2 uhlie                     | 6          | 4      | tráva, úrodná                          | —                 |
| Vodáreň                     | Priemyselná éra  | 100 tehly, 40 železo, 30 nástroje                                        | —              | —                           | 4          | 3      | tráva, úrodná                          | voda, 14          |
| Výstavný palác              | Priemyselná éra  | 300 kameň, 400 tehly, 200 železo, 100 nástroje, 150 látky, 150 uhlie     | —              | —                           | 10         | 10     | tráva, úrodná                          | kultúra, 18       |
| Uhoľná elektráreň           | Moderná éra      | 200 tehly, 120 železo, 60 nástroje                                       | 16 elektrina   | 3 uhlie                     | 8          | 5      | tráva, úrodná                          | —                 |
| Nemocnica                   | Moderná éra      | 200 tehly, 80 železo, 60 nástroje                                        | —              | 2 elektrina                 | 10         | 6      | tráva, úrodná                          | zdravotníctvo, 14 |
| Chladiarenský sklad         | Moderná éra      | 150 tehly, 100 železo                                                    | —              | 2 elektrina                 | 3          | 3      | tráva, úrodná                          | —                 |
| Montážna linka              | Moderná éra      | 250 tehly, 150 železo, 80 nástroje                                       | 36 nástroje    | 2 železo, 4 elektrina       | 12         | 6      | tráva, úrodná                          | —                 |
| Rozhlasová stanica          | Moderná éra      | 150 tehly, 100 železo, 40 nástroje                                       | —              | 3 elektrina                 | 5          | 4      | tráva, úrodná                          | kultúra, 20       |
| Obchodný dom                | Moderná éra      | 250 tehly, 100 železo, 80 látky                                          | — + 120 peňazí | 2 látky, 2 elektrina        | 10         | 5      | tráva, úrodná                          | —                 |
| Továreň na elektroniku      | Informačný vek   | 300 tehly, 200 železo, 150 nástroje                                      | 6 elektronika  | 1 železo, 4 elektrina       | 12         | 8      | tráva, úrodná                          | —                 |
| Jadrová elektráreň          | Informačný vek   | 500 tehly, 300 železo, 60 elektronika, 150 nástroje                      | 80 elektrina   | —                           | 15         | 15     | tráva, úrodná                          | —                 |
| Dátové centrum              | Informačný vek   | 300 tehly, 200 železo, 80 elektronika                                    | 120 vedomosti  | 1 elektronika, 6 elektrina  | 8          | 10     | tráva, úrodná                          | —                 |
| Solárny park                | Informačný vek   | 80 železo, 30 elektronika                                                | 10 elektrina   | —                           | 1          | 1      | tráva, úrodná, kamenistý, kopce · blok | —                 |
| Vertikálna farma            | Informačný vek   | 200 tehly, 150 železo, 40 elektronika                                    | 60 potraviny   | 4 elektrina                 | 8          | 6      | tráva, úrodná                          | —                 |
| Robotická továreň           | Informačný vek   | 300 tehly, 250 železo, 120 elektronika                                   | 90 nástroje    | 2 elektronika, 6 elektrina  | 6          | 10     | tráva, úrodná                          | —                 |
| Fúzny reaktor               | Blízka budúcnosť | 800 železo, 400 elektronika, 400 nástroje                                | 300 elektrina  | —                           | 20         | 30     | tráva, úrodná                          | —                 |
| Centrum umelej inteligencie | Blízka budúcnosť | 400 železo, 500 elektronika, 400 tehly                                   | 400 vedomosti  | 20 elektrina, 3 elektronika | 10         | 25     | tráva, úrodná                          | vzdelanie, 24     |
| Nanotováreň                 | Blízka budúcnosť | 500 železo, 300 elektronika                                              | 30 elektronika | 2 železo, 20 elektrina      | 10         | 20     | tráva, úrodná                          | —                 |
| Vesmírny prístav            | Blízka budúcnosť | 3000 železo, 2000 elektronika, 2000 nástroje, 2000 tehly, 2000 elektrina | —              | —                           | 50         | 50     | tráva, úrodná                          | kultúra, 30       |

## Úrovne domu (`levels`)

| Vylepšenie             | Úroveň | Cena                                                     | Technológia         | Služby v dosahu                         | Zmena               |
| ---------------------- | ------ | -------------------------------------------------------- | ------------------- | --------------------------------------- | ------------------- |
| Dom → Murovaný dom     | 2      | 15 kameň, 4 nástroje                                     | Kamenárstvo         | voda                                    | bývanie 16          |
| Dom → Meštiansky dom   | 3      | 20 drevo, 25 kameň, 8 nástroje                           | Mestská správa      | voda, vzdelanie                         | bývanie 24          |
| Dom → Vila             | 4      | 20 kameň, 30 tehly, 10 nástroje                          | Architektúra        | voda, vzdelanie, kultúra                | bývanie 32          |
| Dom → Patricijský dom  | 5      | 50 tehly, 20 železo, 20 nástroje                         | Bankovníctvo        | voda, vzdelanie, kultúra                | bývanie 40          |
| Dom → Renesančný palác | 6      | 40 tehly, 20 nástroje, 30 látky                          | Umenie              | voda, vzdelanie, kultúra                | bývanie 48          |
| Dom → Mestský činžiak  | 7      | 60 tehly, 30 železo, 20 látky, 20 uhlie                  | Urbanizmus          | voda, vzdelanie, kultúra                | bývanie 60          |
| Dom → Mrakodrap        | 8      | 80 železo, 80 tehly, 60 nástroje, 40 elektrina           | Oceľové konštrukcie | voda, vzdelanie, kultúra, zdravotníctvo | bývanie 80          |
| Dom → Inteligentný dom | 9      | 100 železo, 40 elektronika, 80 elektrina                 | Inteligentné mestá  | voda, vzdelanie, kultúra, zdravotníctvo | bývanie 100         |
| Dom → Arkológia        | 10     | 200 železo, 150 elektronika, 200 elektrina, 200 nástroje | Arkológie           | voda, vzdelanie, kultúra, zdravotníctvo | bývanie 150         |
| Sklad → Veľký sklad    | 2      | 30 drevo, 30 kameň, 5 nástroje                           | Organizácia práce   | —                                       | sklad 450, údržba 1 |

## Technológie (`technologies.json`)

Neskoré míľniky vyžadujú **počet** technológií s rezervou (napr. 48 z 58), takže časť výskumu je
na výbere hráča (voliteľné vetvy: Pekárstvo, Obchod, Filozofia, Mincovníctvo, Cechy, …).

| Éra              | Technológia             | Cena  | Efekt             | Prerekvizity                        |
| ---------------- | ----------------------- | ----- | ----------------- | ----------------------------------- |
| Osada            | Spracovanie dreva       | 20    | +20 % drevo       | —                                   |
| Osada            | Zavlažovanie            | 30    | +20 % potraviny   | —                                   |
| Osada            | Kamenárstvo             | 30    | +20 % kameň       | —                                   |
| Osada            | Organizácia práce       | 40    | +10 % všetko      | Spracovanie dreva                   |
| Osada            | Vzdelávanie             | 50    | +50 % vedomosti   | —                                   |
| Osada            | Mestská správa          | 60    | −20 % údržba      | Organizácia práce                   |
| Starovek         | Tehliarstvo             | 80    | +20 % tehly       | Kamenárstvo                         |
| Starovek         | Rybárstvo               | 70    | +10 % potraviny   | Zavlažovanie                        |
| Starovek         | Mytológia               | 100   | +20 % vedomosti   | Vzdelávanie                         |
| Starovek         | Akvadukty               | 120   | +10 % potraviny   | Tehliarstvo                         |
| Starovek         | Architektúra            | 150   | −10 % údržba      | Tehliarstvo, Mytológia              |
| Stredovek        | Baníctvo                | 200   | +20 % kameň       | Architektúra                        |
| Stredovek        | Hutníctvo               | 250   | +25 % nástroje    | Baníctvo                            |
| Stredovek        | Univerzity              | 300   | +25 % vedomosti   | Architektúra                        |
| Stredovek        | Bankovníctvo            | 280   | −15 % údržba      | Univerzity                          |
| Stredovek        | Teológia                | 400   | +10 % všetko      | Univerzity, Hutníctvo               |
| Renesancia       | Súkenníctvo             | 1200  | +20 % látky       | Bankovníctvo                        |
| Renesancia       | Kníhtlač                | 1400  | +30 % vedomosti   | Univerzity                          |
| Renesancia       | Navigácia               | 1600  | +10 % potraviny   | Súkenníctvo                         |
| Renesancia       | Astronómia              | 1800  | +20 % vedomosti   | Kníhtlač                            |
| Renesancia       | Umenie                  | 2000  | −10 % údržba      | Kníhtlač, Súkenníctvo               |
| Priemyselná éra  | Parný stroj             | 3000  | +10 % všetko      | Astronómia, Navigácia               |
| Priemyselná éra  | Oceliarstvo             | 3400  | +30 % nástroje    | Parný stroj                         |
| Priemyselná éra  | Industrializácia        | 3600  | +30 % látky       | Parný stroj                         |
| Priemyselná éra  | Železnice               | 4000  | −10 % údržba      | Oceliarstvo                         |
| Priemyselná éra  | Kanalizácia             | 4000  | +10 % potraviny   | Industrializácia                    |
| Priemyselná éra  | Urbanizmus              | 5000  | +10 % všetko      | Železnice, Kanalizácia              |
| Osada            | Pekárstvo               | 40    | +15 % potraviny   | Zavlažovanie                        |
| Osada            | Obchod                  | 40    | +20 % príjem      | Spracovanie dreva                   |
| Starovek         | Filozofia               | 110   | +15 % vedomosti   | Mytológia                           |
| Starovek         | Mincovníctvo            | 90    | +20 % príjem      | Tehliarstvo                         |
| Stredovek        | Cechy                   | 260   | +15 % nástroje    | Baníctvo                            |
| Stredovek        | Trojpoľný systém        | 240   | +15 % potraviny   | Architektúra                        |
| Renesancia       | Bankové domy            | 1500  | +25 % príjem      | Súkenníctvo                         |
| Renesancia       | Optika                  | 1500  | +15 % vedomosti   | Kníhtlač                            |
| Priemyselná éra  | Chémia                  | 3500  | +20 % uhlie       | Parný stroj                         |
| Moderná éra      | Elektrina               | 7000  | +20 % elektrina   | Urbanizmus                          |
| Moderná éra      | Medicína                | 7500  | +10 % potraviny   | Elektrina                           |
| Moderná éra      | Chladenie               | 7500  | +20 % potraviny   | Elektrina                           |
| Moderná éra      | Sériová výroba          | 8500  | +30 % nástroje    | Elektrina                           |
| Moderná éra      | Rádio                   | 8000  | +20 % vedomosti   | Elektrina                           |
| Moderná éra      | Oceľové konštrukcie     | 9000  | −10 % údržba      | Sériová výroba                      |
| Moderná éra      | Automobil               | 9500  | +10 % všetko      | Sériová výroba                      |
| Moderná éra      | Spotrebná spoločnosť    | 9000  | +30 % príjem      | Rádio                               |
| Informačný vek   | Počítače                | 13000 | +20 % vedomosti   | Rádio, Oceľové konštrukcie          |
| Informačný vek   | Jadrová energia         | 14000 | +20 % elektrina   | Počítače                            |
| Informačný vek   | Internet                | 15000 | +30 % vedomosti   | Počítače                            |
| Informačný vek   | Ekológia                | 13000 | −15 % údržba      | Počítače                            |
| Informačný vek   | Genetika                | 14000 | +30 % potraviny   | Medicína, Počítače                  |
| Informačný vek   | Robotika                | 16000 | +30 % nástroje    | Internet                            |
| Informačný vek   | Inteligentné mestá      | 17000 | +10 % všetko      | Internet, Ekológia                  |
| Blízka budúcnosť | Jadrová fúzia           | 24000 | +30 % elektrina   | Jadrová energia, Robotika           |
| Blízka budúcnosť | Umelá inteligencia      | 26000 | +20 % všetko      | Robotika, Internet                  |
| Blízka budúcnosť | Nanotechnológie         | 25000 | +50 % elektronika | Robotika                            |
| Blízka budúcnosť | Kvantové počítače       | 27000 | +50 % vedomosti   | Umelá inteligencia                  |
| Blízka budúcnosť | Klimatické inžinierstvo | 25000 | +20 % potraviny   | Genetika, Ekológia                  |
| Blízka budúcnosť | Arkológie               | 28000 | −15 % údržba      | Inteligentné mestá, Nanotechnológie |
| Blízka budúcnosť | Vesmírne lety           | 32000 | +50 % príjem      | Jadrová fúzia, Umelá inteligencia   |

## Míľniky (`milestones.json`)

Splnenie posledného míľnika éry odomkne ďalšiu éru (jej technológie a budovy).

| Éra              | Míľnik                | Podmienky                                                                         |
| ---------------- | --------------------- | --------------------------------------------------------------------------------- |
| Osada            | Založená osada        | 20 obyvateľov; Farma ≥ 1; Drevorubač ≥ 1                                          |
| Osada            | Sebestačná dedina     | 40 obyvateľov; bilancia potraviny ≥ 1 (10 dní); spokojnosť ≥ 60                   |
| Osada            | Vzdelaná spoločnosť   | Škola ≥ 1; 3 technológií; Dom úrovne 2+ ≥ 3                                       |
| Osada            | Prosperujúce mesto    | 120 obyvateľov; Trhovisko ≥ 1; bilancia peňazí ≥ 1 (15 dní); Dom úrovne 2+ ≥ 8    |
| Osada            | Zrod civilizácie      | 300 obyvateľov; 7 technológií; spokojnosť ≥ 75 (20 dní); Dom úrovne 3+ ≥ 10       |
| Starovek         | Staroveké mesto       | 500 obyvateľov; Tehelňa ≥ 1; Rybárska chata ≥ 1                                   |
| Starovek         | Chrámy a akvadukty    | Chrám ≥ 1; Akvadukt ≥ 1; Dom úrovne 4+ ≥ 5                                        |
| Starovek         | Staroveká metropola   | 900 obyvateľov; Dom úrovne 4+ ≥ 15; 11 technológií; spokojnosť ≥ 75 (20 dní)      |
| Stredovek        | Remeslá a baníctvo    | 1300 obyvateľov; Baňa ≥ 2; Huta ≥ 1                                               |
| Stredovek        | Mesto učencov         | Univerzita ≥ 1; Dom úrovne 5+ ≥ 10; 14 technológií                                |
| Stredovek        | Zlatý vek             | 2000 obyvateľov; Katedrála ≥ 1; 17 technológií; spokojnosť ≥ 80 (30 dní)          |
| Renesancia       | Obchodné mesto        | 2400 obyvateľov; Pastvina ≥ 4; Prístav ≥ 1                                        |
| Renesancia       | Mesto umenia          | Divadlo ≥ 1; Observatórium ≥ 1; Dom úrovne 6+ ≥ 10                                |
| Renesancia       | Renesančná metropola  | 3000 obyvateľov; 22 technológií; spokojnosť ≥ 80 (20 dní)                         |
| Priemyselná éra  | Uhlie a para          | 3500 obyvateľov; Uhoľná baňa ≥ 2; Oceliareň ≥ 1                                   |
| Priemyselná éra  | Továrne               | Textilná továreň ≥ 2; Železničná stanica ≥ 1; Dom úrovne 7+ ≥ 10                  |
| Priemyselná éra  | Priemyselná veľmoc    | 4500 obyvateľov; Výstavný palác ≥ 1; 27 technológií; spokojnosť ≥ 80 (30 dní)     |
| Moderná éra      | Elektrifikované mesto | 5500 obyvateľov; Uhoľná elektráreň ≥ 2; Nemocnica ≥ 1                             |
| Moderná éra      | Spotrebná spoločnosť  | Obchodný dom ≥ 1; Montážna linka ≥ 1; Dom úrovne 8+ ≥ 10                          |
| Moderná éra      | Moderná metropola     | 6500 obyvateľov; 36 technológií; spokojnosť ≥ 80 (20 dní)                         |
| Informačný vek   | Digitálne mesto       | 7500 obyvateľov; Továreň na elektroniku ≥ 2; Dátové centrum ≥ 1                   |
| Informačný vek   | Zelené mesto          | Solárny park ≥ 6; Vertikálna farma ≥ 2; Dom úrovne 9+ ≥ 10                        |
| Informačný vek   | Informačná spoločnosť | 9000 obyvateľov; Jadrová elektráreň ≥ 1; 42 technológií; spokojnosť ≥ 80 (20 dní) |
| Blízka budúcnosť | Vek fúzie             | 10000 obyvateľov; Fúzny reaktor ≥ 1; Centrum umelej inteligencie ≥ 1              |
| Blízka budúcnosť | Mesto arkológií       | Nanotováreň ≥ 1; Dom úrovne 10+ ≥ 15                                              |
| Blízka budúcnosť | Ku hviezdam           | 12000 obyvateľov; Vesmírny prístav ≥ 1; 48 technológií; spokojnosť ≥ 85 (30 dní)  |

## Konštanty simulácie (`balance.json`)

| Konštanta                                          | Hodnota            | Význam                                                             |
| -------------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| `mapSize`                                          | 96 × 96            | väčšia mapa pre neskoré éry                                        |
| `baseStorageCapacity`                              | 100                | + kapacita pripojených skladov (na surovinu, vedomosti bez limitu) |
| `foodPerCapita`                                    | 0,25               | spotreba potravín na obyvateľa za deň                              |
| `demolishRefund`                                   | 0,5                | podiel surovín, ktorý vráti zbúranie (recyklácia)                  |
| `baseProduction`                                   | 1 drevo, 0,5 kameň | základný zber bez budov — ochrana pred zaseknutím                  |
| `populationBaseGrowth` / `populationGrowthRate`    | 0,3 / 0,005        | prírastok za deň: prisťahovalci + podiel populácie                 |
| `populationMaxGrowth` / `populationMaxGrowthShare` | 5 / 0,001          | strop prírastku: väčšie z čísla a podielu populácie                |
| `happinessChangePerDay`                            | 5                  | max. zmena spokojnosti za deň                                      |
| `difficulties`                                     | presety            | násobiče podľa obtiažnosti hry (tabuľka nižšie)                    |

### Obtiažnosť (`balance.difficulties`)

Obtiažnosť sa volí pri založení novej hry (`GameState.difficulty`). Normálna má všetky násobiče 1,
takže hra sa nemení. Ceny surovín a výskumu sa zaokrúhľujú nahor; stavba a každé vylepšenie
zvlášť. Vrátenie pri zbúraní = `demolishRefund` × násobič zo skutočne zaplatenej ceny.

| Násobič            | Ľahká | Normálna | Ťažká |
| ------------------ | ----- | -------- | ----- |
| `constructionCost` | 0,75  | 1        | 1,5   |
| `maintenance`      | 0,75  | 1        | 1,5   |
| `researchCost`     | 0,75  | 1        | 1,5   |
| `foodPerCapita`    | 0,8   | 1        | 1,25  |
| `baseProduction`   | 1     | 1        | 0     |
| `demolishRefund`   | 1,5   | 1        | 0,5   |

## Výsledky vyvažovania (2026-10-13, 8 ér)

Simulovaný hráč (2 stavebné akcie denne, iba herné príkazy). Koniec éry (deň):

| Éra              | seed 7 | seed 42 |
| ---------------- | ------ | ------- |
| Osada            | 331    | 331     |
| Starovek         | 528    | 528     |
| Stredovek        | 748    | 748     |
| Renesancia       | 948    | 948     |
| Priemyselná éra  | 1 248  | 1 248   |
| Moderná éra      | 1 631  | 2 068   |
| Informačný vek   | 1 983  | 2 358   |
| Blízka budúcnosť | 2 285  | 2 747   |

Na konci ~12 000–19 000 obyvateľov, ~2 900–3 100 budov a ciest, mesto zaberá ~31–33 % mapy 96 × 96.
Rýchly test F overuje prvé tri éry na 4 mapách; celú hru `npm run test:full` (~2,5 min).

## Otvorené body

- Neskoré éry nechávajú veľké prebytky základných surovín — priestor pre ďalšie spotrebiče alebo obchod.
- Populácia v sandboxe po splnení cieľov rastie ďalej (strop rastu je podiel populácie).
