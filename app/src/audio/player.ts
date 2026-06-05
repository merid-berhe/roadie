// Generated track player (§3, §9).
// Loads the fal.ai audio URL, schedules playback at the server-authoritative
// rideStartAt timestamp, and crossfades from the ambient bed (§1 step 4).

import * as Tone from 'tone';
import { fadeBedOut } from './bed';

let trackGain: Tone.Gain | null = null;
let source: AudioBufferSourceNode | null = null;

/**
 * Load the generated track, schedule it at rideStartAt (server wall-clock ms),
 * and crossfade from the bed. Safe to call once; subsequent calls are no-ops.
 */
export async function loadAndCrossfade(
  audioUrl: string,
  rideStartAt: number,
  _bpm: number, // M4+: use for beat-locked crossfade; ignored for now
): Promise<void> {
  if (trackGain) return; // already loaded

  // A 'mock://' URL means we're in local dev without a FAL_KEY — skip gracefully.
  if (audioUrl.startsWith('mock://')) {
    console.warn('[player] mock audioUrl — no track to play (set FAL_KEY in party/.dev.vars)');
    return;
  }

  try {
    const ctx = Tone.getContext().rawContext as AudioContext;
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`fetch ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);

    // Wire through a gain node so we can crossfade
    trackGain = new Tone.Gain(0).toDestination();
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(trackGain.input as AudioNode);

    // Schedule start at the server-authoritative timestamp (simple offset for M3;
    // M4 adds proper clock-offset correction, §9)
    const delayMs = Math.max(0, rideStartAt - Date.now());
    const delayTone = delayMs / 1000;
    source.start(ctx.currentTime + delayTone);

    // Crossfade: bed fades out, track fades in over 3s starting at rideStartAt
    const crossfadeSec = 3;
    setTimeout(() => {
      fadeBedOut(crossfadeSec);
      trackGain?.gain.rampTo(1, crossfadeSec);
    }, delayMs);

    console.log(`[player] track scheduled, starts in ${Math.round(delayMs)}ms`);
  } catch (err) {
    console.error('[player] failed to load/schedule track:', err);
    // Bed continues playing — rider still has the ambient experience
  }
}

export function stopTrack(): void {
  try { source?.stop(); } catch { /* already stopped */ }
  trackGain?.dispose();
  trackGain = null;
  source = null;
}
