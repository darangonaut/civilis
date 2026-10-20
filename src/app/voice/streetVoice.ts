import { gameData } from '@/data';
import { currentEraIndex, effectiveDefinition, isPolluted, type GameEvent } from '@/engine';
import { useLanguageStore, type Language } from '@/stores/languageStore';
import { useVoiceStore, type VoicePost } from '@/stores/voiceStore';
import { RESOURCE_IDS, type GameState, type ResourceId } from '@/types';
import { controller } from '../game';
import { resourceLabel, t } from '../i18n';
import { buildingName, eraName, milestoneTitle, techName } from '../names';
import { cs } from './cs';
import { en } from './en';
import { sk } from './sk';
import { MEDIA, type Medium, type VoiceTexts, type VoiceTopic } from './types';

const TEXTS: Record<Language, VoiceTexts> = { sk, cs, en };
export const voiceTexts = () => TEXTS[useLanguageStore.getState().language];

const random = (n: number) => Math.floor(Math.random() * n);
/** Budovy, ktorých otvorenie mesto nekomentuje (sú všade). */
const ORDINARY = new Set(['road', 'house', 'warehouse', 'farm', 'lumberjack', 'quarry', 'well']);

export function mediumFor(eraIndex: number): Medium {
  return MEDIA[Math.min(eraIndex, MEDIA.length - 1)]!;
}

/** Text príspevku v aktuálnom jazyku. */
export function postText(post: VoicePost): string {
  const texts = voiceTexts();
  const list =
    post.topic === 'flavor'
      ? texts.flavor[Math.min(post.eraIndex, texts.flavor.length - 1)]!
      : texts.topics[post.topic as Exclude<VoiceTopic, 'flavor'>];
  const template = list[post.variant % list.length]!;
  const p = post.params;
  const resource = p.resource as ResourceId | undefined;
  const values: Record<string, string> = {
    building: p.buildingId ? buildingName(p.buildingId, p.level ?? 1) : '',
    resource: resource ? resourceLabel(resource).toLowerCase() : '',
    resourceGen: resource ? t(`resourceGenitive.${resource}`) : '',
    tech: p.techId ? techName(p.techId) : '',
    milestone: p.milestoneId ? milestoneTitle(p.milestoneId) : '',
    era: p.eraId ? eraName(p.eraId) : '',
  };
  const text = template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
  // V érach siete príspevok končí hashtagom.
  const hashtag = post.eraIndex >= 6 ? texts.hashtags[post.topic as VoiceTopic] : undefined;
  return hashtag ? `${text} ${hashtag}` : text;
}

export interface VoiceAuthor {
  name: string;
  handle: string;
  occupation: string;
}

export function postAuthor(seed: number): VoiceAuthor {
  const texts = voiceTexts();
  const female = seed % 2 === 1;
  const first = (female ? texts.names.female : texts.names.male)[(seed >> 1) % 10]!;
  const surnameBase = texts.names.surnames[(seed >> 4) % texts.names.surnames.length]!;
  const surname = female && texts.feminine ? texts.feminine(surnameBase) : surnameBase;
  const ascii = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return {
    name: `${first} ${surname}`,
    handle: `@${ascii(first)}.${ascii(surname)}`,
    occupation: (female ? texts.occupations.female : texts.occupations.male)[(seed >> 7) % 10]!,
  };
}

function post(
  topic: VoiceTopic,
  mood: VoicePost['mood'],
  params: VoicePost['params'] = {},
  target?: string,
): void {
  const state = controller.state;
  const texts = voiceTexts();
  const count =
    topic === 'flavor' ? 2 : texts.topics[topic as Exclude<VoiceTopic, 'flavor'>].length;
  // Rovnaký vtip sa neopakuje, kým sa neminú ostatné varianty (posledné príspevky).
  const eraIndex = currentEraIndex(state, gameData);
  const recent = useVoiceStore
    .getState()
    .posts.slice(0, 12)
    .filter((p) => p.topic === topic && (topic !== 'flavor' || p.eraIndex === eraIndex))
    .map((p) => p.variant % count);
  const fresh = [...Array(count).keys()].filter((v) => !recent.includes(v));
  const variant = fresh.length > 0 ? fresh[random(fresh.length)]! : random(count);
  useVoiceStore.getState().add({
    day: state.simulation.day,
    eraIndex,
    topic,
    variant,
    authorSeed: random(1 << 12),
    mood,
    params,
    ...(target ? { target } : {}),
  });
}

/** Pracujúca znečisťujúca budova pri znečistenom dome (pre sťažnosť na smog). */
function polluterNearHome(
  state: Readonly<GameState>,
): GameState['city']['buildings'][number] | undefined {
  const grid = controller.pollution;
  const home = state.city.buildings.find((b) => {
    const base = gameData.buildingsById.get(b.definitionId);
    return (
      base &&
      effectiveDefinition(base, b.level).housingCapacity > 0 &&
      isPolluted(state, gameData, b, grid)
    );
  });
  if (!home) return undefined;
  return state.city.buildings.find((b) => {
    const pollution = gameData.buildingsById.get(b.definitionId)?.pollution;
    return (
      pollution &&
      Math.max(
        Math.abs(b.position.x - home.position.x),
        Math.abs(b.position.y - home.position.y),
      ) <= pollution.radius
    );
  });
}

/** Tovar, ktorý domom chýba (zásoba pod dennou spotrebou). */
function missingGood(state: Readonly<GameState>): ResourceId | undefined {
  const economy = state.city.economy;
  return RESOURCE_IDS.find(
    (id) =>
      (economy.dailyConsumption[id] ?? 0) > 0 &&
      economy.resources[id] < (economy.dailyConsumption[id] ?? 0),
  );
}

/** Téma podľa stavu mesta: čím vážnejší problém, tým častejšie sa o ňom hovorí. */
function stateTopic(lastTopic: VoiceTopic | null): void {
  const state = controller.state;
  const population = state.city.population;
  const f = population.happinessFactors;
  const economy = state.city.economy;
  const options: { topic: VoiceTopic; weight: number; run: () => void }[] = [];
  const add = (topic: VoiceTopic, weight: number, run: () => void) => {
    if (weight > 0 && topic !== lastTopic) options.push({ topic, weight, run });
  };
  add('hunger', f.food < 100 ? 10 : 0, () => post('hunger', 'angry'));
  add('housing', f.housing < 20 && population.total > 30 ? 5 : 0, () => post('housing', 'angry'));
  add('water', f.water < 60 && population.total > 20 ? 5 : 0, () => post('water', 'angry'));
  add('education', f.education < 60 && state.simulation.day > 120 ? 4 : 0, () =>
    post('education', 'angry'),
  );
  const polluter = f.environment < 90 ? polluterNearHome(state) : undefined;
  add('pollution', polluter ? 5 : 0, () =>
    post(
      'pollution',
      'angry',
      { buildingId: polluter!.definitionId, level: polluter!.level },
      polluter!.id,
    ),
  );
  const good = f.goods < 95 ? missingGood(state) : undefined;
  add('goods', good ? 6 : 0, () => post('goods', 'angry', { resource: good! }));
  const full = RESOURCE_IDS.filter(
    (id) => id !== 'knowledge' && economy.resources[id] >= economy.storageCapacity,
  );
  add('surplus', full.length > 0 ? 2 : 0, () =>
    post('surplus', 'neutral', { resource: full[random(full.length)]! }),
  );
  add(
    'unemployment',
    population.availableWorkers > 20 &&
      population.employedWorkers < population.availableWorkers * 0.7
      ? 3
      : 0,
    () => post('unemployment', 'angry'),
  );
  add('money', economy.money < 50 && economy.dailyExpenses > economy.dailyIncome ? 4 : 0, () =>
    post('money', 'angry'),
  );
  add('noParks', f.leisure === 0 && population.total > 150 ? 2 : 0, () => post('noParks', 'angry'));
  add('parks', f.leisure > 60 ? 1 : 0, () => post('parks', 'happy'));
  add('happy', population.happiness >= 85 ? 3 : 0, () => post('happy', 'happy'));
  // Na Marse namiesto vtipov z pozemských dôb komentujú život na červenej planéte.
  const flavor: VoiceTopic = gameData.planet.id === 'mars' ? 'mars' : 'flavor';
  add(flavor, 2, () => post(flavor, 'neutral'));

  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let pick = Math.random() * total;
  const chosen = options.find((o) => (pick -= o.weight) < 0) ?? options.at(-1);
  // Nič iné na komentovanie: aspoň iný vtip z doby (varianty sa neopakujú).
  if (chosen) chosen.run();
  else post(flavor, 'neutral');
}

/** Reakcie na udalosti zo simulácie (najviac jedna denne). */
function reaction(event: GameEvent): boolean {
  switch (event.type) {
    case 'milestone_completed':
      post('milestone', 'happy', { milestoneId: event.milestoneId });
      return true;
    case 'era_reached':
      post('era', 'happy', { eraId: event.eraId });
      return true;
    case 'research_completed':
      if (Math.random() < 0.5) return false;
      post('research', 'neutral', { techId: event.technologyId });
      return true;
    case 'houses_downgraded':
      post('downgrade', 'angry');
      return true;
    case 'event_started': {
      const topics: Partial<Record<string, [VoiceTopic, VoicePost['mood']]>> = {
        drought: ['drought', 'angry'],
        epidemic: ['epidemic', 'angry'],
        bumper_harvest: ['harvest', 'happy'],
        caravan: ['caravan', 'neutral'],
        immigrants: ['immigrants', 'neutral'],
        festival: ['festival', 'happy'],
      };
      if (event.eventId === 'fire') {
        const id = controller.state.events.pending?.buildingId;
        const building = id ? controller.state.city.buildings.find((b) => b.id === id) : undefined;
        if (!building) return false;
        post(
          'fire',
          'angry',
          { buildingId: building.definitionId, level: building.level },
          building.id,
        );
        return true;
      }
      if (gameData.planet.id === 'mars') {
        // Púštne vtipy (ťavy, dážď) na Marse nesedia.
        topics.drought = ['dustStorm', 'angry'];
        delete topics.caravan;
      }
      const entry = topics[event.eventId];
      if (!entry) return false;
      post(entry[0], entry[1]);
      return true;
    }
    default:
      return false;
  }
}

/** Zapne „Hlas ulice“: príspevky podľa stavu mesta, nových budov a udalostí. */
export function installStreetVoice(): () => void {
  useVoiceStore.getState().clear();
  let nextDay = controller.state.simulation.day + 2;
  let lastTopic: VoiceTopic | null = null;
  let lastReactionDay = -1;
  const seen = new Set(controller.state.city.buildings.map((b) => b.definitionId));

  const unsubscribeDay = controller.onDayAdvanced(() => {
    const state = controller.state;
    const day = state.simulation.day;
    // Prvá budova nového typu — obyvatelia ju komentujú (divy vždy).
    for (const building of state.city.buildings) {
      if (seen.has(building.definitionId)) continue;
      seen.add(building.definitionId);
      if (ORDINARY.has(building.definitionId) || lastReactionDay === day) continue;
      const wonder = gameData.buildingsById.get(building.definitionId)?.wonder;
      post(
        wonder ? 'wonder' : 'newBuilding',
        'happy',
        { buildingId: building.definitionId },
        building.id,
      );
      lastReactionDay = day;
    }
    if (day < nextDay) return;
    nextDay = day + 6 + random(7);
    stateTopic(lastTopic);
    lastTopic = (useVoiceStore.getState().posts[0]?.topic as VoiceTopic | undefined) ?? null;
  });

  const unsubscribeEvents = controller.onEvents((events) => {
    const day = controller.state.simulation.day;
    if (lastReactionDay === day) return;
    for (const event of events) {
      if (reaction(event)) {
        lastReactionDay = day;
        break;
      }
    }
  });

  return () => {
    unsubscribeDay();
    unsubscribeEvents();
  };
}
