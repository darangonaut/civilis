# Civilis – projektová špecifikácia (v1.0)

> Pôvodné zadanie, očistené o formátovacie artefakty. Je to zdroj pravdy pre pravidlá hry.
> Rozhodnutia a doplnenia, ktoré špecifikácia nedefinuje, sú v `docs/GAME_DESIGN.md`,
> `docs/BALANCING.md` a v logu odchýlok v `IMPLEMENTATION_PLAN.md`.

Civilis je singleplayerová strategická hra pre webové prehliadače, kombinujúca budovanie mesta
(SimCity) a technologický a historický rozvoj (Civilization). Hráč začne s malou osadou a postupne
vybuduje mesto, ktoré prejde historickými obdobiami. Bez vojen, katastrof a náhodného ničenia.

**Schválené rozhodnutia:** jedno veľké mesto · jednoduchá simulácia · postup cez civilizačné
míľniky · desktopový web · singleplayer · real-time s pauzou.

Princíp: ľahké pochopenie, zaujímavé rozhodovanie. Žiadne manuálne prideľovanie pracovníkov,
zložité obchodné zmluvy ani desiatky ukazovateľov.

## 1. Herný dizajn

### 1.1 Herný cyklus

Získavanie surovín (drevo, kameň, potraviny) → výstavba (domy, výroba, služby) → rast populácie →
výskum technológií → civilizačný míľnik → odomknutie ďalšieho rozvoja.

### 1.2 Mapa

64 × 64 políčok, generovaná zo seedu.

| Terén           | Vlastnosti            |
| --------------- | --------------------- |
| Tráva           | Bežná výstavba        |
| Les             | Ťažba dreva           |
| Úrodná pôda     | Efektívne farmy       |
| Kamenistý terén | Ťažba kameňa          |
| Voda            | Nezastavateľná plocha |
| Kopce           | Obmedzená výstavba    |

Každá mapa musí mať dosť pôdy a surovín na prvé míľniky. Počiatočná oblasť má min. 12 × 12
využiteľných políčok a garantovaný prístup k drevu, kameňu a úrodnej pôde. Mapa sa neskôr môže
rozšíriť až na 256 × 256 bez zmeny dátového modelu.

### 1.3 Čas

1 herný deň = 1 simulačný krok. Pauza / 1× = 2 s / 2× = 1 s / 4× = 0,5 s. Ekonomika sa vyhodnocuje
raz za deň, animácie bežia nezávisle.

### 1.4 Populácia a pracovná sila

Nemodelujú sa jednotliví občania. Mesto má populáciu, kapacitu bývania, pracovné miesta
a dostupných pracovníkov.

- 50 % populácie je pracovná sila (zaokrúhlené nadol).
- Domy určujú max. kapacitu populácie.
- Produkčné budovy automaticky zamestnávajú dostupných pracovníkov.
- Pri nedostatku pracovníkov sa produkcia pomerne zníži.
- Rast populácie závisí od voľného bývania, potravín a spokojnosti.

Počiatočná populácia 10, kapacita bývania 10.

### 1.5 Spokojnosť

0–100, vážený priemer zložiek (každá 0–100): potraviny 40 %, bývanie 25 %, voda 20 %,
vzdelanie 15 %. Pri ≥ 60 populácia rastie, 40–59 stagnuje, < 40 postupne klesá. Populácia nikdy
neklesne pod 5.

## 2. Ekonomika

Päť skladovaných surovín: potraviny, drevo, kameň, nástroje, vedomosti. Peniaze sú samostatná
veličina. Všetky hodnoty sú za herný deň.

### 2.1 Počiatočný stav

Populácia 10, potraviny 100, drevo 80, kameň 30, nástroje 10, vedomosti 0, peniaze 500,
spokojnosť 70. Osada má automaticky umiestnený jeden dom, jeden sklad a prístupovú cestu.

### 2.2 Budovy MVP

| Budova     | Náklady             | Funkcia              |
| ---------- | ------------------- | -------------------- |
| Dom        | 10 dreva            | +10 kapacita bývania |
| Cesta      | 1 kameň             | Pripojenie budov     |
| Drevorubač | 15 dreva            | +6 dreva/deň         |
| Farma      | 10 dreva            | +8 potravín/deň      |
| Kameňolom  | 20 dreva            | +4 kamene/deň        |
| Studňa     | 10 dreva, 5 kameňa  | Voda pre okolie      |
| Sklad      | 20 dreva, 10 kameňa | +200 kapacita skladu |
| Dielňa     | 20 dreva, 10 kameňa | Výroba nástrojov     |
| Škola      | 30 dreva, 20 kameňa | +3 vedomosti/deň     |
| Trhovisko  | 20 dreva, 10 kameňa | +8 peňazí/deň        |

Produkcia je maximálna pri plnom obsadení a splnených podmienkach. Dielňa: 2 drevo + 1 kameň →
2 nástroje. Trhovisko spotrebuje 2 potraviny. Všetky budovy okrem ciest a studní potrebujú
pripojenie k cestnej sieti, inak neprodukujú.

### 2.3 Logistika

Žiadne vozidlá. Spoločný sklad mesta. Cestná sieť sa počíta od začiatočnej cesty pri prvom
sklade; budova je pripojená, ak aspoň jedno susedné políčko obsahuje cestu z tejto siete. Lesy
a úrodná pôda sú požiadavky na umiestnenie produkčných budov.

### 2.4 Poradie simulačného kroku

1. Pripojenie budov k cestám. 2. Pridelenie pracovníkov. 3. Dostupná produkčná kapacita.
2. Rezervácia vstupov podľa priorít. 5. Výroba. 6. Spotreba potravín. 7. Spokojnosť a rast
   populácie. 8. Peniaze a údržba. 9. Výskum. 10. Míľniky.

Pri nedostatku suroviny sa výroba primerane zníži. Suroviny nikdy nie sú záporné.

## 3. Technológie a míľniky

Jedna éra, šesť technológií, päť míľnikov.

| Technológia       | Cena | Efekt                     |
| ----------------- | ---- | ------------------------- |
| Spracovanie dreva | 10   | +20 % produkcia dreva     |
| Zavlažovanie      | 15   | +20 % produkcia potravín  |
| Kamenárstvo       | 15   | +20 % produkcia kameňa    |
| Organizácia práce | 20   | +10 % všetka produkcia    |
| Vzdelávanie       | 25   | +50 % produkcia vedomostí |
| Mestská správa    | 30   | −20 % údržba budov        |

Výskum po jednej technológii; vedomosti sa postupne spotrebúvajú, po zaplatení ceny sa aktivuje
efekt.

1. **Založená osada** – 20 obyvateľov, farma a drevorubač. Odmena 100 peňazí.
2. **Sebestačná dedina** – 40 obyvateľov, kladná bilancia potravín 10 dní, spokojnosť ≥ 60.
   Odmena 20 dreva, 20 kameňa.
3. **Vzdelaná spoločnosť** – škola a tri technológie. Odmena 100 peňazí, 20 vedomostí.
4. **Prosperujúce mesto** – 100 obyvateľov, trhovisko, kladná peňažná bilancia 15 dní.
   Odmena 300 peňazí.
5. **Zrod civilizácie** – 200 obyvateľov, všetkých 6 technológií, spokojnosť ≥ 75 počas 20 dní.
   Odmena: odznak dokončenia prvej éry.

Po piatom míľniku obrazovka úspechu, hra pokračuje v sandbox režime.

## 4. Technológie a architektúra

TypeScript (strict), React + Vite, PixiJS 8, Zustand, čistý TS engine, Dexie (IndexedDB), Zod,
Vitest, Playwright, Prettier + ESLint.

Engine používa nezávislý fixný simulačný krok (Pixi má vlastný render loop). Engine nesmie
importovať React, PixiJS ani Zustand. UI a renderer získavajú stav cez Game Controller. Všetky
zmeny idú cez validované príkazy. Ukladá sa dátový stav, nie grafické objekty.

Architektúra: React UI / PixiJS Renderer → Game Controller → Simulation Engine (World, Economy,
Population, Research & Milestones) · Game Controller → Persistence Service → IndexedDB.

## 5.–6. Dátové modely a API enginu

Implementované v `src/types/` (1:1 so špecifikáciou, odchýlky v `IMPLEMENTATION_PLAN.md`).
Políčka v jednorozmernom poli, index `y * width + x`. Budovy v MVP 1 × 1, model podporuje väčšie.
`GameState` je jediný autoritatívny stav; odvodené hodnoty (pripojenie, produktivita) sa dajú
po načítaní prepočítať.

Príkazy: `PLACE_BUILDING`, `DEMOLISH_BUILDING`, `SET_BUILDING_PRIORITY`, `START_RESEARCH`. Každý
príkaz sa validuje pred vykonaním (hranice, terén, obsadenosť, suroviny, technológie). Neplatný
príkaz nesmie zmeniť stav.

## 7. Rozhranie

Horná lišta (deň, populácia, spokojnosť, suroviny, peniaze, rýchlosť) · ľavý panel (katalóg budov
podľa kategórie) · mapa (izometria, zoom, kamera, výber, režim výstavby) · pravý panel (detail
budovy, výroba, spotreba, problémy) · spodná lišta (výskum, míľniky, štatistiky, ukladanie,
nastavenia). Nefunkčná budova musí ukázať konkrétny dôvod („Chýba cesta“, „Nedostatok
pracovníkov“, „Nedostatok dreva“).

Ovládanie: ťahanie = posun, koliesko = zoom, ĽTM = výber / umiestnenie, Escape = zrušenie,
medzerník = pauza, 1/2/3 = rýchlosť 1×/2×/4×, Ctrl/Cmd+S = uloženie.

## 8. Ukladanie

Tri manuálne pozície + jedna automatická (každých 30 dní a pri opustení obrazovky). Manuálne
ukladanie funguje aj počas pauzy. Save obsahuje verziu schémy (migrácia alebo zrozumiteľné
upozornenie). Export/import JSON. Transakčný zápis — neúspech nepoškodí posledný platný save.

## 9. Nefunkčné požiadavky

60 FPS; 64 × 64 a 500 budov bez spomaľovania; tick < 20 ms; zdieľané textúry a renderovanie len
viditeľných objektov; Chrome, Firefox, Edge, Safari; UI v slovenčine pripravené na lokalizáciu;
dáta sa nestratia pri obnovení stránky; pri neaktívnej karte simulácia stojí a nedobieha čas.

## 11. Akceptačné testy

- **A – Determinizmus:** rovnaký seed + príkazy → identický stav po 1 000 krokoch.
- **B – Ekonomika:** plne obsadená farma produkuje presne definované množstvo; bez pracovníkov
  menej; žiadna surovina pod nulou.
- **C – Výstavba:** nedá sa stavať mimo mapy, na obsadenom políčku, bez surovín; neúspech
  nespotrebuje zdroje.
- **D – Ukladanie:** uloženie → akcie → načítanie vráti budovy, suroviny, technológie, míľniky.
- **E – Progres:** míľnik iba po splnení všetkých podmienok, odmena presne raz, dlhodobé
  podmienky počas po sebe idúcich dní.
- **F – Hrateľnosť:** na štandardnej mape sa dá dokončiť všetkých 5 míľnikov bez dev nástrojov.

## 13. Mimo MVP

Pohybujúce sa vozidlá, individuálni obyvatelia, politika, obchod medzi mestami, online účty,
ďalšie historické obdobia. Najväčšie riziko je vyváženie ekonomiky, nie technika.
Cieľ MVP: jedna funkčná, dobre hrateľná civilizačná etapa.
