/** Témy príspevkov „Hlasu ulice“ — reakcie na stav mesta a udalosti. */
export const VOICE_TOPICS = [
  'hunger',
  'housing',
  'water',
  'education',
  'pollution',
  'goods',
  'surplus',
  'unemployment',
  'money',
  'noParks',
  'parks',
  'happy',
  'flavor',
  'newBuilding',
  'wonder',
  'milestone',
  'era',
  'research',
  'downgrade',
  'drought',
  'fire',
  'festival',
  'epidemic',
  'immigrants',
  'harvest',
  'caravan',
  'mars',
  'proxima',
  'dustStorm',
] as const;
export type VoiceTopic = (typeof VOICE_TOPICS)[number];

/** Médium podľa éry (index éry). */
export const MEDIA = [
  'rock',
  'forum',
  'crier',
  'leaflet',
  'newspaper',
  'radio',
  'network',
  'holonet',
] as const;
export type Medium = (typeof MEDIA)[number];

export interface VoiceTexts {
  media: Record<Medium, string>;
  /** Šablóny: {building}, {resource}, {resourceGen}, {tech}, {milestone}, {era}. Flavor podľa éry. */
  topics: Record<Exclude<VoiceTopic, 'flavor'>, string[]>;
  flavor: string[][];
  /** Krátke hashtagy pre éry so sieťou. */
  hashtags: Partial<Record<VoiceTopic, string>>;
  names: { male: string[]; female: string[]; surnames: string[] };
  /** Ženská podoba priezviska (sk/cs: -ová), null = rovnaké. */
  feminine: ((surname: string) => string) | null;
  occupations: { male: string[]; female: string[] };
}
