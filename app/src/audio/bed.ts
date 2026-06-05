// Procedural ambient bed (§1 step 4, §11).
// Lifecycle: silent during compose (iOS audio-context keepalive) → audible during
// generating (the "car pulls out" feel) → crossfaded out when the generated track arrives.
// Module-level singleton so it survives component unmounts.

import * as Tone from 'tone';

let started = false;
let masterGain: Tone.Gain | null = null;
let nodes: Tone.ToneAudioNode[] = [];

/** Start the bed at volume 0 (iOS keepalive, §11). Safe to call multiple times. */
export function startBedSilent(): void {
  if (started) return;
  started = true;

  masterGain = new Tone.Gain(0).toDestination();

  // Engine-like drone: two detuned oscillators at low frequencies
  const droneGain = new Tone.Gain(0.4).connect(masterGain);
  const lowFilter = new Tone.Filter(180, 'lowpass').connect(droneGain);
  const osc1 = new Tone.Oscillator(62, 'sawtooth').connect(lowFilter).start();
  const osc2 = new Tone.Oscillator(62 * 1.015, 'sine').connect(lowFilter).start();

  // Road texture: filtered pink noise
  const noiseGain = new Tone.Gain(0.3).connect(masterGain);
  const noiseFilter = new Tone.Filter(400, 'lowpass').connect(noiseGain);
  const noise = new Tone.Noise('pink').connect(noiseFilter).start();

  // Slow atmospheric pad (gives the "floating" quality during the latency mask)
  const padGain = new Tone.Gain(0.25).connect(masterGain);
  const reverb = new Tone.Reverb({ decay: 4, wet: 0.6 }).connect(padGain);
  const padFilter = new Tone.Filter(1200, 'lowpass').connect(reverb);
  const pad1 = new Tone.Oscillator(110, 'sine').connect(padFilter).start();
  const pad2 = new Tone.Oscillator(165, 'sine').connect(padFilter).start(); // fifth

  nodes = [masterGain, droneGain, lowFilter, osc1, osc2, noiseGain, noiseFilter, noise, padGain, reverb, padFilter, pad1, pad2];
}

/** Fade the bed up to audible — call when generating phase starts. */
export function fadeBedIn(durationSec = 2): void {
  masterGain?.gain.rampTo(0.18, durationSec);
}

/** Fade the bed out over crossfade duration — call when generated track begins playing. */
export function fadeBedOut(durationSec = 3): void {
  masterGain?.gain.rampTo(0, durationSec);
}

/** Full stop — call if the ride ends without a track. */
export function stopBed(): void {
  masterGain?.gain.rampTo(0, 0.5);
  setTimeout(() => {
    for (const node of nodes) node.dispose();
    nodes = [];
    masterGain = null;
    started = false;
  }, 600);
}
