// Beat-locked gesture sounds (§8b) — quantised to the next quarter-note via Tone Transport.
// The Transport is started (at the correct BPM) by player.ts when the track is scheduled.

import * as Tone from 'tone';
import type { GestureKind } from '@roadie/shared';

// Lazy singletons — created on first use, not before.
let tambourine: Tone.MetalSynth | null = null;
let shaker: Tone.NoiseSynth | null = null;
let chime: Tone.Synth | null = null;

function getTambourine(): Tone.MetalSynth {
  if (!tambourine) {
    tambourine = new Tone.MetalSynth({
      harmonicity: 5.1, modulationIndex: 32,
      resonance: 4000, octaves: 1.5, volume: -10,
      envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
    }).toDestination();
  }
  return tambourine;
}

function getShaker(): Tone.NoiseSynth {
  if (!shaker) {
    shaker = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.005, decay: 0.06, sustain: 0, release: 0.01 },
      volume: -12,
    }).toDestination();
  }
  return shaker;
}

function getChime(): Tone.Synth {
  if (!chime) {
    chime = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.6, sustain: 0.05, release: 1.2 },
      volume: -8,
    }).toDestination();
  }
  return chime;
}

const BEAT_SOUNDS: GestureKind[] = ['tambourine', 'shaker', 'chime'];

/** True for the three gesture kinds that produce a beat-locked sound (§8b). */
export function isBeatSound(kind: GestureKind): boolean {
  return BEAT_SOUNDS.includes(kind);
}

/**
 * Trigger a beat-locked sound at the next quarter-note boundary (§8b).
 * No-ops if the audio context isn't running or the Transport has no BPM yet.
 */
export function playGestureSound(kind: GestureKind): void {
  if (Tone.getContext().state !== 'running') return;
  if (Tone.Transport.state !== 'started') return;
  const nextBeat = Tone.Transport.nextSubdivision('4n');
  switch (kind) {
    case 'tambourine': getTambourine().triggerAttackRelease('16n', nextBeat); break;
    case 'shaker':     getShaker().triggerAttackRelease('16n', nextBeat); break;
    case 'chime':      getChime().triggerAttackRelease('C5', '8n', nextBeat); break;
  }
}

/** Musical accent for the synced firework bloom — a brief rising chord sting. */
export function playFireworkAccent(): void {
  if (Tone.getContext().state !== 'running') return;
  const poly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.15, release: 1.5 },
    volume: -4,
  }).toDestination();
  poly.triggerAttackRelease(['C5', 'E5', 'G5', 'C6'], '8n');
  setTimeout(() => poly.dispose(), 4000);
}
