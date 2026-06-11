// §5 — "two hands on one wheel". Driver controls foundation, passenger controls color.
// buildPrompt() is deterministic + server-side so the recipe is the canonical record.

import type { Destination } from './destinations';
import type { RidePerformance } from './ride';

export type DriverChoices = {
  groove: 'cruising' | 'winding' | 'open-highway';
  tempo: 'slow' | 'medium' | 'brisk';
  energy: 'mellow' | 'steady' | 'driving';
};

export type PassengerChoices = {
  lead_instrument: 'piano' | 'nylon-guitar' | 'synth-pad' | 'rhodes' | 'strings';
  brightness: 'warm' | 'neutral' | 'bright';
  texture: 'clean' | 'lush' | 'lo-fi';
};

/** Minted style descriptors from the whisper gate (§5a) — never raw player text. */
export type RadioStyles = {
  driver?: string;
  passenger?: string;
};

export type Recipe = {
  driver: { seed: string } & DriverChoices;
  passenger: { seed: string } & PassengerChoices;
  radio?: RadioStyles;
  performance?: RidePerformance; // §5b — what the pair did during the ride
};

// §5a "tune the radio" — optional free text, gated + translated by an LLM
// server-side. Raw text never reaches the music API or the other player.
export const WHISPER_MAX_CHARS = 100;
export const WHISPER_MAX_TRIES = 3;

export const WHISPER_EXAMPLES = [
  'early-70s soul with warm electric piano',
  'like a rainy night in a Tokyo taxi',
  'desert blues, dusty and slow',
  "my dad's garage band on a Sunday",
  'strings like the first day of summer',
] as const;

export const MOOD_WORDS = [
  'golden-hour',
  'rainy',
  'restless',
  'dreaming',
  'midnight',
  'wide-open',
] as const;

export type MoodWord = (typeof MOOD_WORDS)[number];

export const DRIVER_OPTIONS = {
  groove: ['cruising', 'winding', 'open-highway'] as const,
  tempo: ['slow', 'medium', 'brisk'] as const,
  energy: ['mellow', 'steady', 'driving'] as const,
} satisfies Record<keyof DriverChoices, readonly string[]>;

export const PASSENGER_OPTIONS = {
  lead_instrument: ['piano', 'nylon-guitar', 'synth-pad', 'rhodes', 'strings'] as const,
  brightness: ['warm', 'neutral', 'bright'] as const,
  texture: ['clean', 'lush', 'lo-fi'] as const,
} satisfies Record<keyof PassengerChoices, readonly string[]>;

export function tempoToBpm(tempo: DriverChoices['tempo']): number {
  return { slow: 72, medium: 92, brisk: 112 }[tempo];
}

/** Server-side, deterministic — §5. durationSec is 120 (2-min ride, decision 2026-06-05). */
export function buildPrompt(
  seedDriver: string,
  seedPassenger: string,
  d: DriverChoices,
  p: PassengerChoices,
  destination?: Destination,
  radio?: RadioStyles,
): { prompt: string; bpm: number; durationSec: number; recipe: Recipe } {
  const place = destination
    ? `${destination.promptFlavor}, inspired by ${destination.name}, ${destination.country}, `
    : '';
  const radioBits = [radio?.driver, radio?.passenger].filter(Boolean).join('; ');
  const tuned = radioBits ? `${radioBits}, ` : '';

  return {
    prompt:
      `Instrumental, ${seedDriver} + ${seedPassenger} mood, ${place}${tuned}${d.groove} groove, ` +
      `${d.energy} energy, ${p.lead_instrument} lead, ${p.brightness} tone, ${p.texture} texture, ` +
      `relaxing road-trip feel, no vocals`,
    bpm: tempoToBpm(d.tempo),
    durationSec: 120,
    recipe: {
      driver: { seed: seedDriver, ...d },
      passenger: { seed: seedPassenger, ...p },
      ...(radioBits ? { radio } : {}),
    },
  };
}
