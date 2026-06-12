// §15 contract spine — messages between client and the PartyKit room.
// Room is single source of truth (§3). Peer is only ever described by glyph+role (§6).

import type { Recipe } from './recipe';
import type { Destination } from './destinations';

export type Role = 'driver' | 'passenger';
export type Phase = 'lobby' | 'generating' | 'riding' | 'arrival';
export type GestureKind = 'wave' | 'headlights' | 'heart' | 'tambourine' | 'shaker' | 'chime';
export type DanceMove = 'bounce' | 'spin' | 'wave' | 'shimmy';

export const DANCE_MOVES: DanceMove[] = ['bounce', 'spin', 'wave', 'shimmy'];

export type Rider = {
  role: Role;
  glyph: string;     // legacy identity symbol — retired from UI in v5.4
  color: string;
  character?: string; // v5.4 — roster character id, dealt per ride by the room
  connected: boolean;
};

/** Client → Room */
export type ClientMsg =
  | { t: 'join'; userId: string; glyph: string; color: string }
  | { t: 'instrument'; name: string } // v5.6 — each rider's featured instrument (required)
  | { t: 'road'; roadId: string }  // legacy scene debug control
  // §5 v5.0 — free-text prompt; raw text goes ONLY to the room's gate, the peer
  // sees the gated display text
  | { t: 'prompt'; text: string }
  | { t: 'vocals'; on: boolean }   // each rider votes; vocals only if BOTH say yes
  | { t: 'ready' }
  | { t: 'ping'; sentAt: number } // clock offset estimation (§9)
  // v5.8 — the client decodes the audio and reports its REAL length; the room
  // re-times arrival to the song's true end (MiniMax ignores durationSec)
  | { t: 'trackDuration'; sec: number }
  // --- the Meeting (generation wait, §8d) ---
  | { t: 'dance'; move: DanceMove }
  // --- M5+ ---
  | { t: 'gesture'; kind: GestureKind }
  | { t: 'firework' }
  | { t: 'name'; word: string }
  | { t: 'report' };

/** Room → Client */
export type RoomMsg =
  | {
      t: 'state';
      phase: Phase;
      you: Role;
      riders: Rider[];
      full: boolean;
      instruments: Role[]; // roles that have picked their instrument (v5.6)
      readyRoles: Role[];
      destination: Destination;
      recipe?: Recipe;
      vocalsVotes: Role[];
    }
  | { t: 'roomFull' }
  | { t: 'peerChoice'; glyph: string; field: string; value: string }
  // §5 v5.0 — the gated display text of a rider's prompt; sent to BOTH riders.
  // v5.9: carries the author's character so attribution survives reconnects.
  | { t: 'promptCard'; role: Role; glyph: string; character?: string; display: string }
  | { t: 'promptRejected' } // sender only — gate said no (abuse/unusable)
  | { t: 'generationFailed'; reason: string }
  | { t: 'pong'; sentAt: number; serverTime: number }
  | { t: 'nameWord'; glyph: string; word: string }
  | { t: 'peerRoad'; roadId: string }  // legacy scene debug control
  // --- the Meeting (§8d) ---
  | { t: 'peerDance'; glyph: string; move: DanceMove }
  | { t: 'danceSynced'; move: DanceMove } // both did the same move inside the window
  // --- M3+ ---
  | { t: 'rideStart'; audioUrl: string; source: 'own' | 'borrowed'; rideStartAt: number; bpm: number }
  | { t: 'trackReady'; audioUrl: string; bpm: number }
  | { t: 'trackDuration'; sec: number } // v5.8 — confirmed real length, to both riders
  | { t: 'sync'; positionSec: number }
  | { t: 'peerGesture'; glyph: string; kind: GestureKind; atBeat?: number }
  | { t: 'fireworkSynced'; synced: boolean }
  | { t: 'peerLeft' };
