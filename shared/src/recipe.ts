// §5 — "two hands on one wheel". Driver controls foundation, passenger controls color.
// buildPrompt() is deterministic + server-side so the recipe is the canonical record.

import type { Destination } from './destinations';

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

export type Recipe = {
  driver: { seed: string } & DriverChoices;
  passenger: { seed: string } & PassengerChoices;
};

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
): { prompt: string; bpm: number; durationSec: number; recipe: Recipe } {
  const place = destination
    ? `${destination.promptFlavor}, inspired by ${destination.name}, ${destination.country}, `
    : '';

  return {
    prompt:
      `Instrumental, ${seedDriver} + ${seedPassenger} mood, ${place}${d.groove} groove, ` +
      `${d.energy} energy, ${p.lead_instrument} lead, ${p.brightness} tone, ${p.texture} texture, ` +
      `relaxing road-trip feel, no vocals`,
    bpm: tempoToBpm(d.tempo),
    durationSec: 120,
    recipe: {
      driver: { seed: seedDriver, ...d },
      passenger: { seed: seedPassenger, ...p },
    },
  };
}
