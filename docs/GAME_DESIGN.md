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
- **Nástroje** (schválené 2026-10-13): drevorubač, farma a kameňolom spotrebúvajú 0,1 nástroja
  na zamestnaného pracovníka za deň. Bez nástrojov bežia na 50 % (pri čiastočnom nedostatku
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

## Schválené návrhy pre etapu 4

- **Zložka „Bývanie“ v spokojnosti:** 100 pri voľnej kapacite ≥ 10 %, lineárne klesá k 0 pri
  plnej obsadenosti.
- **Zložky „Voda“ a „Vzdelanie“:** podiel domov v dosahu aspoň jednej studne / školy.
