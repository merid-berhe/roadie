// §5 — prompt-first composition (v5.0). Each rider contributes a mood word and
// an optional free-text prompt; fal is the arbiter of interpretation. The gate
// (party/gate.ts) moderates text and swaps artist names on the music side only.

import type { Destination } from './destinations';

export const MOOD_WORDS = [
  'golden-hour',
  'rainy',
  'restless',
  'dreaming',
  'midnight',
  'wide-open',
] as const;

export type MoodWord = (typeof MOOD_WORDS)[number];

// free-text prompt limits (the §5a gate bounds LLM spend per rider)
export const PROMPT_MAX_CHARS = 100;
export const PROMPT_MAX_TRIES = 3;

export const PROMPT_EXAMPLES = [
  'early-70s soul with warm electric piano',
  'like a rainy night in a Tokyo taxi',
  'desert blues, dusty and slow',
  "my dad's garage band on a Sunday",
  'strings like the first day of summer',
  'a song about two strangers driving nowhere',
] as const;

/** The canonical record of what the pair made. Texts are the DISPLAY versions
 * (what both riders saw); the music-side prompt may differ (artist-name swaps). */
export type Recipe = {
  driver: { seed: string; text?: string };
  passenger: { seed: string; text?: string };
  vocals: boolean;
  brief?: string; // §5a producer pass — the fused, coherence-enforced direction
};

/** Server-side, deterministic — §5. durationSec is 120 (2-min ride, decision 2026-06-05).
 * `texts` here are the MUSIC-side versions from the gate (artist names swapped). */
export function buildPrompt(
  seedDriver: string,
  seedPassenger: string,
  destination: Destination | undefined,
  opts: {
    driverMusicText?: string;
    passengerMusicText?: string;
    driverDisplayText?: string;
    passengerDisplayText?: string;
    vocals?: boolean;
    /** §5a producer pass — when present, replaces the raw text join as the
     * musical direction (the coherence/alignment layer). */
    fusedBrief?: string;
  } = {},
): { prompt: string; bpm: number; durationSec: number; vocals: boolean; recipe: Recipe } {
  const vocals = opts.vocals ?? false;
  const direction = opts.fusedBrief
    ? opts.fusedBrief
    : [opts.driverMusicText, opts.passengerMusicText].filter(Boolean).join('; ');
  const place = destination
    ? `inspired by ${destination.name}, ${destination.country} — ${destination.promptFlavor}`
    : '';

  const prompt = [
    direction,
    // the brief already folds the moods in; keep them only on the fallback path
    opts.fusedBrief ? '' : `${seedDriver} + ${seedPassenger} mood`,
    place,
    'road-trip feel',
    vocals ? 'with vocals' : 'instrumental, no vocals',
  ]
    .filter(Boolean)
    .join(', ');

  return {
    prompt,
    bpm: 92, // legacy plumbing for the ambient bed / gesture sounds; not sent to the model
    durationSec: 120,
    vocals,
    recipe: {
      driver: { seed: seedDriver, ...(opts.driverDisplayText ? { text: opts.driverDisplayText } : {}) },
      passenger: { seed: seedPassenger, ...(opts.passengerDisplayText ? { text: opts.passengerDisplayText } : {}) },
      vocals,
      ...(opts.fusedBrief ? { brief: opts.fusedBrief } : {}),
    },
  };
}
