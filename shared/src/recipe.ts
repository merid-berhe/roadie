// §5 — composition (v5.6): each rider picks ONE instrument (required — the
// tap-minimum that guarantees a valid song) and writes an optional direction
// paragraph (≤140 chars). The producer LLM combines both texts + instruments
// into one coherent brief; fal interprets. Mood words are gone — they made
// little audible difference and washed out user intent.

import type { Destination } from './destinations';

export const INSTRUMENTS = [
  'piano',
  'guitar',
  'rhodes',
  'synth',
  'strings',
  'saxophone',
  'trumpet',
  'percussion',
] as const;

export type Instrument = (typeof INSTRUMENTS)[number];

// free-text direction limits (the §5a gate bounds LLM spend per rider)
export const PROMPT_MAX_CHARS = 140;
export const PROMPT_MAX_TRIES = 3;

export const PROMPT_EXAMPLES = [
  'slow heartbreak soul about leaving a city you love',
  'rainy-night ethiopian jazz, melancholic but warm',
  'playful funk about two strangers stuck in traffic',
  'dreamy synthwave for driving past neon signs at 2am',
  'triumphant horns — a song about finally quitting',
  'gentle bossa nova that smells like sunscreen',
] as const;

/** The canonical record of what the pair made. Texts are the DISPLAY versions
 * (what both riders saw); the music-side prompt may differ (artist-name swaps). */
export type Recipe = {
  driver: { instrument: string; text?: string };
  passenger: { instrument: string; text?: string };
  vocals: boolean;
  brief?: string;  // §5a producer pass — the fused, coherence-enforced direction
  lyrics?: string; // v5.2 — producer-written words (vocal rides only)
};

/** Server-side, deterministic — §5. durationSec is 120 (2-min ride, decision 2026-06-05).
 * `MusicText`s are the gate's music-side versions (artist names swapped). */
export function buildPrompt(
  destination: Destination | undefined,
  opts: {
    driverInstrument: string;
    passengerInstrument: string;
    driverMusicText?: string;
    passengerMusicText?: string;
    driverDisplayText?: string;
    passengerDisplayText?: string;
    vocals?: boolean;
    /** §5a producer pass — when present, replaces the raw join as the
     * musical direction (the coherence/alignment layer). */
    fusedBrief?: string;
  },
): { prompt: string; bpm: number; durationSec: number; vocals: boolean; recipe: Recipe } {
  const vocals = opts.vocals ?? false;
  const hasText = Boolean(opts.driverMusicText || opts.passengerMusicText);
  const instruments = `featuring ${opts.driverInstrument} and ${opts.passengerInstrument}`;
  const direction = opts.fusedBrief
    ? opts.fusedBrief
    : [opts.driverMusicText, opts.passengerMusicText].filter(Boolean).join('; ');
  const place = destination
    ? `inspired by ${destination.name}, ${destination.country} — ${destination.promptFlavor}`
    : '';

  // when the riders typed anything, their words ARE the direction (the fused
  // brief already folds the instruments in); without text, instruments +
  // destination carry the song.
  const prompt = (hasText
    ? [direction, opts.fusedBrief ? '' : instruments, place, vocals ? 'with vocals' : 'instrumental, no vocals']
    : [instruments, place, 'road-trip feel', vocals ? 'with vocals' : 'instrumental, no vocals']
  )
    .filter(Boolean)
    .join(', ');

  return {
    prompt,
    bpm: 92, // legacy plumbing for the ambient bed / gesture sounds; not sent to the model
    durationSec: 120,
    vocals,
    recipe: {
      driver: { instrument: opts.driverInstrument, ...(opts.driverDisplayText ? { text: opts.driverDisplayText } : {}) },
      passenger: { instrument: opts.passengerInstrument, ...(opts.passengerDisplayText ? { text: opts.passengerDisplayText } : {}) },
      vocals,
      ...(opts.fusedBrief ? { brief: opts.fusedBrief } : {}),
    },
  };
}
