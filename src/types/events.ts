import type { ResourceId, Resources } from './resources';
import type { ServiceType } from './buildings';

/** Efekt udalosti. Čísla sú v src/data/events.json. */
export type EventEffect =
  /** Dočasný násobič výroby suroviny (aditívne ako technológie). */
  | { type: 'production'; resource: ResourceId | 'all'; multiplier: number; days: number }
  /** Dočasná zmena spokojnosti (body). */
  | { type: 'happiness'; amount: number; days: number }
  /** Odíde podiel obyvateľov. */
  | { type: 'population_loss'; share: number }
  /** Prídu noví obyvatelia (podiel populácie, najmenej `minimum`, najviac voľné bývanie). */
  | { type: 'immigrants'; share: number; minimum: number }
  /** Jednorazovo suroviny ako podiel kapacity skladu. */
  | { type: 'resources_share'; resources: Partial<Resources> }
  /** Jednorazovo vedomosti za `days` dní aktuálnej produkcie (najmenej `minimum`). */
  | { type: 'knowledge_days'; days: number; minimum: number }
  /** Jednorazovo peniaze za `days` dní príjmu (najmenej `minimum`). */
  | { type: 'money_days'; days: number; minimum: number }
  /** Budova zasiahnutá udalosťou (požiar) nefunguje `days` dní. */
  | { type: 'disable_building'; days: number }
  /** Karavána: kúpa podielu kapacity skladu suroviny za zlomok ceny. */
  | { type: 'caravan'; storageShare: number; priceFactor: number };

/** Ak je splnená ktorákoľvek podmienka, záporný efekt sa zmierni o `factor`. */
export interface EventMitigation {
  technologies?: string[];
  buildings?: string[];
  /** Podiel bývania v dosahu služby aspoň `minShare`. */
  services?: ServiceType[];
  minShare?: number;
  factor: number;
}

export interface EventChoice {
  id: string;
  /** Cena voľby: pevné peniaze alebo peniaze na obyvateľa (zaokrúhlené, najmenej `minimum`). */
  cost?: { money?: number; moneyPerCapita?: number; minimum?: number };
  effects: EventEffect[];
}

export interface EventDefinition {
  id: string;
  name: string;
  description: string;
  kind: 'bad' | 'good' | 'choice';
  /** Najskoršia éra. */
  era: string;
  weight: number;
  /** Udalosť nastane, len ak mesto má aspoň jednu z budov. */
  requiresBuildings?: string[];
  effects?: EventEffect[];
  choices?: EventChoice[];
  mitigation?: EventMitigation;
}

/** Prebiehajúci efekt udalosti. */
export type ActiveEventEffect =
  | { type: 'production'; resource: ResourceId | 'all'; multiplier: number }
  | { type: 'happiness'; amount: number }
  | { type: 'disable_building'; buildingId: string };

export interface ActiveEvent {
  eventId: string;
  daysLeft: number;
  effect: ActiveEventEffect;
}

/** Udalosť čakajúca na rozhodnutie hráča (s vypočítanými parametrami). */
export interface PendingEvent {
  eventId: string;
  day: number;
  buildingId?: string;
  resource?: ResourceId;
  amount?: number;
  /** Cena prvej (prijímajúcej) voľby v peniazoch. */
  cost?: number;
}

export interface EventsState {
  enabled: boolean;
  /** Deň, keď môže nastať ďalšia udalosť. */
  nextDay: number;
  active: ActiveEvent[];
  pending: PendingEvent | null;
}
