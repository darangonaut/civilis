# Game design — doplnenia k špecifikácii

Pravidlá hry sú v `docs/SPEC.md`. Tu sú interpretácie miest, kde špecifikácia nie je jednoznačná.
Konkrétne čísla sú v `docs/BALANCING.md`.

## Rozhodnuté

- **Stackovanie technologických bonusov je aditívne.** Spracovanie dreva (+20 %) a Organizácia
  práce (+10 %) dajú drevu +30 %, nie ×1,32. Ľahšie sa to hráčovi vysvetľuje.
- **Míľniky sú sekvenčné.** Vyhodnocuje sa vždy len najbližší nesplnený míľnik
  (poradie v `milestones.json`). Zodpovedá to cyklu „míľnik → odomknutie ďalšieho rozvoja“
  a zjednodušuje UI.
- **Výrobné budovy stoja priamo na požadovanom teréne** (drevorubač na lese, kameňolom na
  kamenistom teréne). Farma môže stáť aj na tráve, ale vyrába len na 50 %
  (`terrainEfficiency` v `buildings.json`).
- **Kopce:** povolené iba cesty a studne („obmedzená výstavba“).
- **Peniaze a sklad v definícii budovy:** `BuildingDefinition` má navyše `moneyOutput`
  (trhovisko) a `storageCapacity` (sklad), lebo peniaze nie sú `ResourceId` a kapacitu skladu
  model zo špecifikácie nevie vyjadriť.
- **Nástroje** (schválené 2026-10-13): drevorubač, farma a kameňolom spotrebúvajú 0,05 nástroja
  na zamestnaného pracovníka za deň (pôvodne 0,1, znížené pri vyvažovaní). Bez nástrojov bežia na 50 % (pri čiastočnom nedostatku
  pomerne). Dielňa ich vyrába.
- **Peniaze** (schválené): používajú sa len na údržbu, nie na výstavbu. Pokladnica neklesne pod
  nulu; ak nepokryje dennú údržbu, budovy s údržbou bežia pomerne slabšie (až na 50 %) a hlásia
  „Nedostatok peňazí na údržbu“. Podiel sa počíta zo stavu pokladnice na začiatku dňa.
- **Cestná sieť** začína cestami susediacimi s akýmkoľvek skladom (špecifikácia hovorí o prvom
  sklade; posledný sklad sa nedá zbúrať, takže sieť vždy má koreň).
- **Kapacita bývania a skladu** sa počíta len z pripojených budov.
- **Kapacita skladu platí pre každú surovinu zvlášť** (300 = až 300 dreva a 300 kameňa…).
  Vedomosti sa do nej nepočítajú. Plný sklad výrobu neznižuje, prebytok sa zahodí a budova
  hlási „Plný sklad“. Zbúranie skladu existujúce zásoby nezníži.
- **Poradie spracovania** pre pracovníkov aj vstupy: vyššia priorita skôr, pri zhode staršia
  budova. Trhovisko si rezervuje potraviny pred spotrebou obyvateľov (krok 4 pred krokom 6).

## Populácia, spokojnosť, výskum, míľniky (etapa 4)

- **Zložky spokojnosti (0–100):**
  - potraviny = podiel potravín, ktoré obyvatelia v daný deň zjedli;
  - bývanie = 100 pri voľnej kapacite ≥ 10 %, lineárne k 0 pri plnej obsadenosti;
  - voda / vzdelanie = podiel kapacity pripojených domov v dosahu studne / fungujúcej školy
    (dosah je štvorec, Chebyševova vzdialenosť ≤ radius; škola musí mať pracovníkov).
- **Spokojnosť sa k cieľovej hodnote (vážený priemer) posúva najviac o 5 bodov za deň.**
  Odchýlka od špecifikácie, ktorá hovorí len o váženom priemere — okamžitá zmena by na začiatku
  hry (10/10 obyvateľov, bez studne) zhodila spokojnosť zo 70 na 40 hneď v prvý deň a hráč
  by nemal čas reagovať.
- **Rast:** pri spokojnosti ≥ 60, voľnom bývaní a plne nasýtených obyvateľoch +5 % populácie
  (min. 1, max. voľná kapacita). **Pokles:** pri spokojnosti < 40 −3 % (min. 1). Pri 40–59
  stagnuje. Ak je obyvateľov viac ako bývania, polovica prebytku denne odíde. Nikdy pod 5.
- **Výskum:** každý deň sa do aktívnej technológie investujú všetky dostupné vedomosti (najviac
  zvyšok ceny). Prepnutie na inú technológiu vráti investované vedomosti do zásob.
- **Míľniky** sú sekvenčné. Podmienky s `consecutiveDays` majú počítadlo v `progressDays`
  (kľúč `<míľnik>:<index podmienky>`), ktoré sa pri nesplnení vynuluje. Odmena sa pripíše
  raz pri splnení; suroviny z odmeny nie sú obmedzené kapacitou skladu. Po poslednom míľniku
  sa hra pozastaví, zobrazí obrazovku úspechu a pokračuje ako sandbox.

## Ochrana pred neobnoviteľným stavom (etapa 6)

- **Základný zber:** mesto bez akýchkoľvek budov denne nazbiera +1 drevo a +0,5 kameňa
  (`balance.baseProduction`). Bez neho sa dalo zaseknúť natrvalo — minúť drevo pred postavením
  drevorubača (drevo sa potom nedá vyrobiť) alebo kameň pred cestou ku kamenistému terénu.
- Populácia neklesne pod 5, pokladnica pod 0 (budovy len bežia slabšie), posledný sklad sa nedá
  zbúrať.

## Ukladanie (etapa 6)

- 3 manuálne pozície + automatické uloženie každých 30 dní a pri skrytí/zatvorení stránky.
- Pri zatváraní stránky sa stav synchronne zapíše aj do `localStorage` — asynchrónny zápis do
  IndexedDB by prehliadač nemusel dokončiť. Pri ďalšom štarte sa táto záloha prednostne načíta
  a presunie do automatického uloženia.
- Pri štarte sa automaticky obnoví rozohraná hra. `?seed=N` alebo `?new` vždy založí novú hru.

## Úrovne budov a vzhľad (2026-10-13, na želanie)

- **Dom** má 3 úrovne: Dom (10 obyvateľov) → Murovaný dom (20; Kamenárstvo, studňa v dosahu) →
  Meštiansky dom (35; Mestská správa, studňa aj fungujúca škola v dosahu). **Sklad** má 2 úrovne
  (Veľký sklad; Organizácia práce). Vylepšuje sa príkazom `UPGRADE_BUILDING` za suroviny.
- Úrovne sú v dátach (`levels`), engine počíta s efektívnymi parametrami (`effectiveDefinition`).
  Na úrovni závisí aj vzhľad (`house@2`, `house@3`, `warehouse@2`).
- **Technológie menia vzhľad** výroby (efekty ostávajú zo špecifikácie): píla (Spracovanie dreva),
  zavlažovanie s veterným kolesom (Zavlažovanie), žeriav a otesané bloky (Kamenárstvo), kováčska
  vyhňa (Organizácia práce), zvonica školy (Vzdelávanie), tretí stánok trhoviska (Mestská správa).
- **Cesty** sú hlinené chodníky, po Kamenárstve dláždené.
- **Pozastavenie budovy** (`SET_BUILDING_ENABLED`): pozastavená budova nezamestnáva, nevyrába ani
  nespotrebúva — napr. dielňa, keď je nástrojov dosť (inak by minula všetok kameň).
- **Plynulý rast populácie:** denne 0,3 + 0,5 % populácie, zlomky sa sčítavajú v
  `population.growthProgress`.

## Značky nad budovami

Bublina so symbolom ukazuje najvážnejší problém: cesta (chýba napojenie), postavička (žiadni /
málo pracovníkov — oranžová), debnička (chýba surovina alebo nástroje), minca (prázdna pokladnica),
žltá debna (plný sklad), zelená šípka (budovu možno vylepšiť). Dôvod sa zobrazí aj pri prejdení
myšou nad budovou; legenda je v Nastaveniach.

## Éry (2026-10-13, na želanie)

- Tri éry (`eras.json`): **Osada** (pôvodná špecifikácia), **Starovek**, **Stredovek**. Technológie
  a míľniky majú pole `era`; éra sa odomkne splnením posledného míľnika predchádzajúcej éry.
  Technológie budúcich ér sa nedajú skúmať, budovy budúcich ér sa v katalógu nezobrazujú.
- Nové suroviny **tehly** (Tehelňa) a **železo** (Baňa na kopcoch). Nová služba **kultúra**
  (Chrám, Katedrála) — potrebuje ju Vila a Patricijský dom.
- Nové budovy: Tehelňa, Rybárska chata (stavia sa na vodu), Akvadukt (voda s dosahom 9),
  Chrám, Baňa, Huta (železo + drevo → nástroje), Univerzita, Katedrála (záverečný div).
- Úrovne domu: Dom 10 → Murovaný 16 → Meštiansky 24 → Vila 32 → Patricijský dom 40.
- Podmienka „všetky technológie“ sa vzťahuje na technológie po éru daného míľnika.
- Po dosiahnutí éry sa hra pozastaví a zobrazí obrazovku s novými budovami a technológiami;
  po poslednom míľniku (Zlatý vek) obrazovka víťazstva a sandbox.

## Ovládanie stavby (2026-10-13)

- Ťahanie v režime stavby: cesta ako lomená čiara (najprv x, potom y), ostatné budovy vyplnia
  obdĺžnik (max. 256 políčok). Mapu posúva pravé tlačidlo, šípky alebo WASD.
- **Bloky polí:** farma, drevorubač, kameňolom a baňa sú pripojené aj cez susednú pripojenú
  budovu rovnakého typu — blok stačí napojiť na cestu v jednom bode.
- **Recyklácia:** zbúranie vráti 50 % surovín investovaných do stavby a vylepšení.

## Osem ér (2026-10-13, na želanie)

Osada → Starovek → Stredovek → Renesancia → Priemyselná éra → Moderná éra → Informačný vek →
Blízka budúcnosť. Každá éra má 7–8 technológií (časť voliteľná) a 3 míľniky; posledný míľnik
„Ku hviezdam“ vyžaduje Vesmírny prístav.

- Nové suroviny: látky (Pastvina, Textilná továreň), uhlie (Uhoľná baňa), elektrina (elektrárne,
  solárne parky, fúzia), elektronika (Továreň na elektroniku, Nanotováreň).
- Nová služba **zdravotníctvo** (Nemocnica) — vyžadujú ju Mrakodrap a ďalšie domy.
- Úrovne domu až po 10: … Patricijský dom → Renesančný palác → Mestský činžiak → Mrakodrap →
  Inteligentný dom → Arkológia.
- Nový efekt technológie `money_multiplier` (príjem peňazí).
- **Plný sklad:** keď sú všetky výrobky budovy na kapacite skladu, budova si dá prestávku a
  nemíňa vstupy ani nástroje (inak by napr. huty minuli všetko železo na zahadzované nástroje).
- Mapa 96 × 96 a strop rastu populácie ako podiel populácie — neskoré éry s tisíckami obyvateľov
  sa tak dajú prejsť v rozumnom čase.

## Pohyb a život v meste (2026-10-13, na želanie)

Čisto vizuálne efekty v rendereri (`renderer/effects.ts`), simuláciu nemenia:

- **Deň a noc:** vizuálny deň trvá 48 s pri 1× (zrýchľuje sa s rýchlosťou hry, v pauze stojí).
  V noci sa scéna stmaví a rozsvietia sa okná — v domoch podľa obsadenosti (obyvatelia sa
  sťahujú od najstaršieho pripojeného domu, `houseOccupancy`), v ostatných budovách, keď pracujú.
- **Dym z komínov** iba z pracujúcich budov a obývaných domov (`CHIMNEYS` v `sprites.ts`).
- **Chodci** na cestách napojených na mesto (počet ≈ populácia / 12, max. 180); od modernej éry
  aj autá.
- **Vlniaca sa voda** a **„vyskočenie“** novej budovy s obláčikom prachu.
- Nastavenia → Zobrazenie: prepínače „Animácie“ a „Deň a noc“ (uložené v prehliadači).

## Rozhranie a mobil (2026-10-13, na želanie)

- Domy (a ďalšie budovy s úrovňami) sa dajú postaviť rovno na ľubovoľnej odomknutej úrovni.
  Cena je súčet stavby a všetkých vylepšení po danú úroveň, takže je to len skratka (žiadna
  zľava). Musia byť splnené technológie aj služby v dosahu, ako pri vylepšení.
- Poradie výskumu: max. 10 technológií. Po dokončení výskumu (alebo keď sa nič neskúma) sa začne
  prvá dostupná z poradia. Technológia môže byť v poradí aj vtedy, keď jej prerekvizity sú
  v poradí pred ňou.
- Na dotykovej obrazovke ťuknutie stavia alebo vyberá, ťahanie prstom v režime stavby stavia
  viac naraz a mapa sa vtedy posúva dvoma prstami. Mimo stavby posúva mapu jeden prst.

## Vylepšenie výrobných budov (2026-10-14, na želanie)

- 3 úrovne pre drevorubača, farmu, kameňolom, dielňu, tehelňu, rybársku chatu, baňu, pastvinu
  a uhoľnú baňu. Úroveň 2: výroba aj spotreba ×1,5, +1 pracovník, údržba ×1,3. Úroveň 3: ×2,2,
  +2 pracovníci, údržba ×1,8 — výroba na pracovníka aj na políčko rastie, takže vylepšenie šetrí
  miesto aj ľudí, ale stojí viac údržby a suroviny neskorších ér.
- Vylepšenia odomykajú technológie neskorších ér (napr. Píla — Cechy, Lesný závod — Parný stroj,
  Statok — Trojpoľný systém, Mechanizovaná farma — Automobil), výrobné budovy tak rastú s civilizáciou.
  Nevyžadujú služby v dosahu.
- Bloky polí a lesov majú veľa políčok, preto inšpektor ponúka „Vylepšiť všetky“ — vylepší všetky
  rovnaké budovy na rovnakej úrovni, kým stačia suroviny.

## Parky a dekorácie (2026-10-14, na želanie)

- Kategória Dekorácie: park (Osada), fontána (Akvadukty), námestie (Cechy), socha (Umenie),
  botanická záhrada (Ekológia). Bez pracovníkov a cesty, malá údržba, služba „oddych“ s dosahom 3–12.
- Spokojnosť: k váženému priemeru (potraviny, bývanie, voda, vzdelanie) sa pripočíta bonus
  `podiel bývania v dosahu × leisureBonus` (10 bodov). Pôvodné vyváženie sa nemení, parky sú
  nástroj na doťahovanie spokojnosti, napr. keď chýba škola.

## Obchod (2026-10-14, na želanie)

- Panel Obchod sa odomkne trhoviskom. Nákup za cenu z `balance.trade.prices`, predaj za 50 % ceny;
  prístav, železničná stanica a obchodný dom pridávajú po +10 % (max. 100 %). Vedomosti sa
  neobchodujú, nákup neprekročí kapacitu skladu.
- Automatický predaj: pre zvolené suroviny sa každý deň (po výrobe a spotrebe) predá prebytok
  nad 90 % kapacity skladu na 75 %. Príjem sa započíta do denného príjmu.
- Ceny sú nízke oproti výrobe (napr. drevo 0,6, nástroje 2, elektronika 8) — obchod má pomôcť
  vyrovnať nerovnováhu a využiť plný sklad, nie nahradiť výrobu.

## Divy sveta, úspechy a skóre (2026-10-14, na želanie)

- Šesť divov (2 × 2 políčka, v meste každý najviac raz, bez pracovníkov a cesty): Pyramída
  (−10 % údržba), Veľká knižnica (+25 % vedomosti), Hrad (+5 spokojnosť), Kolos (+25 % peniaze),
  Železná veža (+10 % všetka výroba), Olympijský štadión (+8 spokojnosť). Odomykajú ich technológie
  a cena je vyššia ako kapacita skladu na začiatku éry — treba ich plánovať.
- Efekty divov sa sčítavajú s efektmi technológií; bonus spokojnosti sa pripočíta k cieľovej
  spokojnosti (strop 100).
- Úspechy sa vyhodnocujú denne a stačí ich splniť raz (populácia, výskum, spokojnosť, peniaze,
  obchod, divy, parky, mrakodrapy, éra, rýchle dohranie do 2 500. dňa).
- Skóre = obyvatelia + 20 × technológia + 150 × míľnik + 300 × div + 100 × úspech + zárobok
  z obchodu / 100. Deň dohrania sa zapíše pri splnení posledného míľnika.

## Náhodné udalosti (2026-10-14, na želanie)

- Prvá udalosť najskôr v 40. deň, potom každých 60–120 dní; výber váhovaný podľa `weight`
  spomedzi udalostí, ktoré dávajú zmysel (éra, potrebné budovy, voľné bývanie, cieľ požiaru…).
  Deterministické podľa seedu mapy a dňa — uložená hra sa správa rovnako.
- Zlé: sucho (−40 % potravín 20 dní; zavlažovanie alebo akvadukt polovica), epidémia (−4 %
  obyvateľov, −15 spokojnosť 20 dní; nemocnice pre 60 % bývania zmiernia na 40 %), výpadok prúdu
  (−50 % elektriny 6 dní; solárny park, jadrová alebo fúzna elektráreň polovica).
- Dobré: bohatá úroda (+50 % potravín 15 dní), nové ložisko (20 % skladu kameňa, 10 % železa),
  staroveké ruiny (vedomosti za 20 dní), mecenáš (príjem za 15 dní).
- S voľbou (hra sa pozastaví): požiar (oprava za peniaze, inak budova 12 dní nefunguje),
  karavána (15 % kapacity skladu suroviny za polovičnú cenu), prisťahovalci (+5 % obyvateľov
  do voľného bývania, −5 spokojnosť 15 dní), slávnosť (+10 spokojnosť 30 dní za peniaze).
- Udalosti sa dajú vypnúť v Nastaveniach.

## Potreby obyvateľov a znečistenie (2026-10-16, na želanie)

- Lepšie domy spotrebúvajú tovar zo skladu podľa počtu obyvateľov (na obyvateľa za deň):
  meštiansky dom až patricijský dom nástroje, renesančný palác látky a nástroje, činžiak látky,
  mrakodrap látky a elektrinu, inteligentný dom a arkológia elektrinu a trochu elektroniky.
  Uhlie ako potreba zámerne nie je — je vstupom elektrární a oceliarní.
- Zložka spokojnosti „tovar“ = zásobenie domov vážené kapacitou; postih až 10 bodov.
  Ak má dom zásobenie pod 25 %, počítajú sa mu dni; po 90 dňoch (+ 0–20 podľa domu, aby neklesli
  všetky naraz) klesne o úroveň.
- Priemysel znečisťuje okolie len počas prevádzky (napr. dielňa sila 1 / dosah 1, huta 3 / 3,
  oceliareň a uhoľná elektráreň 4 / 4). Park a dekorácie znižujú znečistenie v dosahu o 2.
  Dom je znečistený pri súčte ≥ 1; zložka „prostredie“ = podiel bývania mimo znečistenia,
  postih až 10 bodov. Vrstva Znečistenie na mape; pri stavbe priemyslu sa zapne sama.
