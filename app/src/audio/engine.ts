import * as Tone from 'tone';

export type AudioState = AudioContextState;

function rawContext(): AudioContext {
  return Tone.getContext().rawContext as unknown as AudioContext;
}

export function getAudioState(): AudioState {
  return rawContext().state;
}

/**
 * Unlock the Web Audio context. MUST be called inside a user-gesture handler —
 * iOS Safari only allows resume inside the first tap, no exceptions (§11).
 */
export async function unlockAudio(): Promise<void> {
  await Tone.start();
  const ctx = rawContext();
  if (ctx.state !== 'running') {
    await ctx.resume();
  }
}

/** Re-resume after iOS suspends the context (backgrounding, idle) — see §11. */
export async function resumeAudio(): Promise<void> {
  await rawContext().resume();
}

/** Subscribe to AudioContext state changes (§11 reactive indicator). Returns an unsubscribe. */
export function onAudioStateChange(cb: (state: AudioState) => void): () => void {
  const ctx = rawContext();
  const handler = () => cb(ctx.state);
  ctx.addEventListener('statechange', handler);
  return () => ctx.removeEventListener('statechange', handler);
}

// A low engine idle hum (§1 step 1). It makes "Get in" produce *audible* proof the
// context unlocked, and previews the lobby keepalive pattern we'll lean on in §11.
let humNodes: Tone.ToneAudioNode[] = [];

export function startIdleHum(): void {
  if (humNodes.length > 0) return;
  const gain = new Tone.Gain(0).toDestination();
  const filter = new Tone.Filter(180, 'lowpass').connect(gain);
  const osc1 = new Tone.Oscillator(70, 'sawtooth').connect(filter).start();
  const osc2 = new Tone.Oscillator(70 * 1.012, 'sine').connect(filter).start();
  gain.gain.rampTo(0.05, 0.8);
  humNodes = [gain, filter, osc1, osc2];
}

export function stopIdleHum(): void {
  for (const node of humNodes) node.dispose();
  humNodes = [];
}
