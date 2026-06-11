// §5b — the ride performance layer ("the ride is the recording session").
// One seed → identical event schedule on the server and both clients, so no
// per-spawn messages are needed. All windows are validated server-side with
// generous slack; there are no fail states, only things that didn't happen.

import type { Role } from './messages';

export type RideNote = { id: number; atSec: number; lane: 0 | 1 };
export type RideRiff = { idx: number; atSec: number; caller: Role };
export type RideLandmark = { idx: number; atSec: number };

export type RideSchedule = {
  notes: RideNote[];
  riffs: RideRiff[];
  landmarks: RideLandmark[];
};

/** What the pair actually did during the ride — persisted inside the recipe. */
export type RidePerformance = {
  catches: { id: number; atSec: number }[]; // cooperative catches that landed
  riffs: number[];                          // call-and-response riffs that landed
  landmarks: number[];                      // landmarks both riders lit
};

export const LANE_X = [-0.75, 0.75] as const; // car positions on the two lanes
export const CATCH_WINDOW_SEC = 0.9;          // |note.atSec − position| for a catch
export const RIFF_TAPS = 3;                   // taps to complete a phrase
export const RIFF_CALL_SEC = 5;               // caller's window after riff.atSec
export const RIFF_ANSWER_SEC = 10;            // answerer's window after riff.atSec
export const FLASH_WINDOW_SEC = 3;            // ± window around landmark.atSec

export function buildRideSchedule(seed: number, durationSec = 120): RideSchedule {
  const rng = rideRng(seed);

  const landmarks: RideLandmark[] = [
    { idx: 0, atSec: 38 + Math.floor(rng() * 6) },
    { idx: 1, atSec: 86 + Math.floor(rng() * 6) },
  ];
  const riffs: RideRiff[] = [
    { idx: 0, atSec: 24 + Math.floor(rng() * 4), caller: 'driver' },
    { idx: 1, atSec: 62 + Math.floor(rng() * 4), caller: 'passenger' },
  ];

  // notes fill the gaps, never within 6s of a riff or landmark, clear of the finale
  const blocked = [...landmarks.map((l) => l.atSec), ...riffs.map((r) => r.atSec)];
  const notes: RideNote[] = [];
  let t = 10;
  let id = 0;
  while (t < durationSec - 18) {
    if (blocked.every((b) => Math.abs(b - t) > 6)) {
      notes.push({ id: id++, atSec: Math.round(t * 10) / 10, lane: rng() < 0.5 ? 0 : 1 });
    }
    t += 5 + rng() * 4;
  }

  return { notes, riffs, landmarks };
}

/** Stable seed from a room id — same ride, same schedule, even across reconnects. */
export function rideSeedFromRoom(roomId: string): number {
  let h = 2166136261;
  for (let i = 0; i < roomId.length; i++) {
    h ^= roomId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rideRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
