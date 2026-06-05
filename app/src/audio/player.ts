// Generated track player (§3, §9).
// Loads the fal.ai audio URL, schedules at rideStartAt (server clock, offset-corrected),
// crossfades from the ambient bed, and supports drift correction from sync messages.

import * as Tone from 'tone';
import { fadeBedOut } from './bed';

let trackGain: Tone.Gain | null = null;
let trackSource: AudioBufferSourceNode | null = null;
let localStartTime: number | null = null; // actual local ms when track started playing

/**
 * Load and schedule the generated track.
 * clockOffset = serverTime - localTime (from ping/pong, §9).
 */
export async function loadAndCrossfade(
  audioUrl: string,
  rideStartAt: number,   // server-authoritative timestamp (ms)
  _bpm: number,          // M5+: beat-locked crossfade; ignored for now
  clockOffset: number,   // server clock offset from ping/pong
): Promise<void> {
  if (trackGain) return; // already loaded

  if (audioUrl.startsWith('mock://')) {
    console.warn('[player] mock audioUrl — no track (set FAL_KEY in party/.dev.vars)');
    return;
  }

  try {
    const ctx = Tone.getContext().rawContext as AudioContext;
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`fetch ${response.status}`);
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer());

    trackGain = new Tone.Gain(0).toDestination();
    trackSource = ctx.createBufferSource();
    trackSource.buffer = buffer;
    trackSource.connect(trackGain.input as AudioNode);

    // Convert server timestamp to local delay using the estimated clock offset (§9)
    // rideStartAt is server ms; (Date.now() + clockOffset) is local clock in server units
    const delayMs = Math.max(0, rideStartAt - (Date.now() + clockOffset));
    const delaySec = delayMs / 1000;
    trackSource.start(ctx.currentTime + delaySec);
    localStartTime = Date.now() + delayMs;

    const crossfadeSec = 3;
    setTimeout(() => {
      fadeBedOut(crossfadeSec);
      trackGain?.gain.rampTo(1, crossfadeSec);
    }, delayMs);

    console.log(`[player] track scheduled, starts in ${Math.round(delayMs)}ms (offset=${Math.round(clockOffset)}ms)`);
  } catch (err) {
    console.error('[player] failed to load/schedule track:', err);
  }
}

/**
 * Current playback position in seconds (based on when track actually started).
 * Used by drift correction — compare with sync.positionSec from the room.
 */
export function getActualPositionSec(): number | null {
  if (!localStartTime) return null;
  return Math.max(0, (Date.now() - localStartTime) / 1000);
}

/**
 * Nudge playback rate to correct drift (§9).
 * |drift| > 0.25s → temporarily adjust rate by ±5% until corrected.
 * Inaudible for small corrections; limits to avoid pitch distortion.
 */
export function nudgePlayback(driftSec: number): void {
  if (!trackSource) return;
  const absDrift = Math.abs(driftSec);
  if (absDrift < 0.25) return;

  const rate = driftSec > 0 ? 0.95 : 1.05; // behind → speed up; ahead → slow down
  const correctionMs = (absDrift / 0.05) * 1000; // time needed at 5% to close the gap
  const clampedMs = Math.min(correctionMs, 10_000); // cap at 10s of correction

  trackSource.playbackRate.value = rate;
  setTimeout(() => {
    if (trackSource) trackSource.playbackRate.value = 1.0;
  }, clampedMs);

  console.log(`[player] drift ${Math.round(driftSec * 1000)}ms → rate ${rate} for ${Math.round(clampedMs)}ms`);
}

export function stopTrack(): void {
  try { trackSource?.stop(); } catch { /* already stopped */ }
  trackGain?.dispose();
  trackGain = null;
  trackSource = null;
  localStartTime = null;
}
