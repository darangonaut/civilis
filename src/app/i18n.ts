import { COMMAND_FAILURE_REASONS, type BuildingProblem, type CommandFailureReason } from '@/engine';
import type { BuildingCategory, ResourceId } from '@/types';

/**
 * Všetky texty UI sú tu, aby sa dala neskôr doplniť ďalšia lokalizácia.
 * Názvy budov, technológií a míľnikov sú v herných dátach (src/data/*.json).
 */
const sk = {
  'app.title': 'Civilis',
  'topbar.day': 'Deň',
  'topbar.population': 'Populácia',
  'topbar.happiness': 'Spokojnosť',
  'topbar.money': 'Peniaze',
  'topbar.speed': 'Rýchlosť',
  'topbar.pause': 'Pauza',
  'topbar.workers': 'Pracovníci',
  'topbar.perDay': 'za deň',
  'topbar.storage': 'Sklad',
  'topbar.speedHint': 'Medzerník = pauza, 1/2/3 = rýchlosť',
  'catalog.title': 'Budovy',
  'catalog.all': 'Všetko',
  'catalog.empty': 'V tejto kategórii nie sú žiadne budovy.',
  'detail.title': 'Detail',
  'detail.empty': 'Vyber budovu v katalógu alebo na mape.',
  'detail.buildHint': 'Klikni na mapu pre umiestnenie. Escape ukončí výstavbu.',
  'detail.position': 'Poloha',
  'detail.demolish': 'Zbúrať',
  'detail.demolished': 'Budova bola zbúraná.',
  'detail.status': 'Stav',
  'detail.efficiency': 'Výkon',
  'detail.producing': 'Vyrába / deň',
  'detail.consuming': 'Spotrebúva / deň',
  'detail.workersAssigned': 'Pracovníci',
  'detail.priority': 'Priorita',
  'detail.ok': 'V poriadku',
  'priority.1': 'Nízka',
  'priority.2': 'Normálna',
  'priority.3': 'Vysoká',
  'problem.disabled': 'Vypnutá',
  'problem.no_road': 'Chýba cesta',
  'problem.no_workers': 'Žiadni pracovníci',
  'problem.understaffed': 'Nedostatok pracovníkov',
  'problem.poor_terrain': 'Menej úrodná pôda',
  'problem.no_tools': 'Nedostatok nástrojov',
  'problem.no_funds': 'Nedostatok peňazí na údržbu',
  'problem.missing_input': 'Nedostatok',
  'problem.storage_full': 'Plný sklad',
  'detail.cost': 'Cena výstavby',
  'detail.inputs': 'Spotreba / deň',
  'detail.outputs': 'Produkcia / deň',
  'detail.workers': 'Pracovníci',
  'detail.housing': 'Kapacita bývania',
  'detail.storage': 'Kapacita skladu',
  'detail.maintenance': 'Údržba / deň',
  'detail.moneyOutput': 'Príjem / deň',
  'detail.requiresRoad': 'Vyžaduje cestu',
  'detail.terrain': 'Povolený terén',
  'detail.serviceRadius': 'Dosah služby',
  'detail.yes': 'áno',
  'detail.no': 'nie',
  'detail.none': '—',
  'map.loading': 'Načítavam mapu…',
  'map.tile': 'Políčko',
  'map.fertility': 'úrodnosť',
  'map.buildMode': 'Výstavba',
  'bottom.research': 'Výskum',
  'bottom.milestones': 'Míľniky',
  'bottom.statistics': 'Štatistiky',
  'bottom.save': 'Uložiť',
  'bottom.settings': 'Nastavenia',
  'common.notYetAvailable': 'Zatiaľ nedostupné',
  'events.foodShortage': 'Obyvatelia hladujú — postav farmy.',
  'events.researchCompleted': 'Výskum dokončený',
  'events.milestoneCompleted': 'Míľnik splnený',
  'events.badge': 'odznak prvej éry',
  'victory.title': 'Zrod civilizácie',
  'victory.text':
    'Tvoja osada sa stala civilizáciou a prvá éra je za tebou. Mesto môžeš ďalej rozvíjať v režime sandbox.',
  'victory.continue': 'Pokračovať v hre',
  'happiness.factors': 'Zložky spokojnosti',
  'happiness.food': 'potraviny',
  'happiness.housing': 'bývanie',
  'happiness.water': 'voda',
  'happiness.education': 'vzdelanie',
  'command.unknown_building': 'Neznáma budova.',
  'command.out_of_bounds': 'Mimo mapy.',
  'command.tile_occupied': 'Políčko je obsadené.',
  'command.invalid_terrain': 'Na tento terén sa budova nedá postaviť.',
  'command.technology_required': 'Vyžaduje technológiu.',
  'command.insufficient_resources': 'Nedostatok surovín.',
  'command.unknown_instance': 'Budova neexistuje.',
  'command.last_warehouse': 'Mesto musí mať aspoň jeden sklad.',
  'command.invalid_priority': 'Neplatná priorita.',
  'command.invalid_speed': 'Neplatná rýchlosť.',
  'command.unknown_technology': 'Neznáma technológia.',
  'command.technology_completed': 'Technológia je už preskúmaná.',
  'command.research_active': 'Táto technológia sa už skúma.',
  'command.prerequisites_missing': 'Najprv treba preskúmať predchádzajúce technológie.',
  'category.housing': 'Bývanie',
  'category.production': 'Výroba',
  'category.service': 'Služby',
  'category.infrastructure': 'Infraštruktúra',
  'resource.food': 'Potraviny',
  'resource.wood': 'Drevo',
  'resource.stone': 'Kameň',
  'resource.tools': 'Nástroje',
  'resource.knowledge': 'Vedomosti',
  'resourceGenitive.food': 'potravín',
  'resourceGenitive.wood': 'dreva',
  'resourceGenitive.stone': 'kameňa',
  'resourceGenitive.tools': 'nástrojov',
  'resourceGenitive.knowledge': 'vedomostí',
  'terrain.grass': 'tráva',
  'terrain.forest': 'les',
  'terrain.fertile': 'úrodná pôda',
  'terrain.rock': 'kamenistý terén',
  'terrain.water': 'voda',
  'terrain.hill': 'kopce',
  'service.water': 'voda',
  'service.education': 'vzdelanie',
} as const;

export type TranslationKey = keyof typeof sk;

export function t(key: TranslationKey): string {
  return sk[key];
}

/** Preloží kód dôvodu zlyhania príkazu z enginu. */
export function commandReasonLabel(reason: string): string {
  return (COMMAND_FAILURE_REASONS as readonly string[]).includes(reason)
    ? t(`command.${reason as CommandFailureReason}`)
    : reason;
}

/** Text problému budovy, napr. „Nedostatok dreva“. */
export function problemLabel(problem: BuildingProblem): string {
  if (problem.code === 'missing_input') {
    return `${t('problem.missing_input')} ${t(`resourceGenitive.${problem.resource}`)}`;
  }
  if (problem.code === 'storage_full')
    return `${t('problem.storage_full')} (${resourceLabel(problem.resource).toLowerCase()})`;
  return t(`problem.${problem.code}`);
}

export const resourceLabel = (id: ResourceId): string => t(`resource.${id}`);
export const categoryLabel = (category: BuildingCategory): string => t(`category.${category}`);
