// §15 contract spine — messages between client and the PartyKit room.
// Room is single source of truth (§3). Peer is only ever described by glyph+role (§6).

import type { Recipe } from './recipe';

export type Role = 'driver' | 'passenger';
export type Phase = 'lobby' | 'generating' | 'riding' | 'arrival';
export type GestureKind = 'wave' | 'headlights' | 'heart' | 'tambourine' | 'shaker' | 'chime';

export type Rider = {
  role: Role;
  glyph: string;
  color: string;
  connected: boolean;
};

/** Client → Room */
export type ClientMsg =
  | { t: 'join'; userId: string; glyph: string; color: string }
  | { t: 'seed'; word: string }
  | { t: 'choice'; field: string; value: string }
  | { t: 'ready' }
  | { t: 'ping'; sentAt: number } // clock offset estimation (§9)
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
      seeded: Role[];
      readyRoles: Role[];
      recipe?: Recipe;
    }
  | { t: 'roomFull' }
  | { t: 'peerChoice'; glyph: string; field: string; value: string }
  | { t: 'generationFailed'; reason: string }
  | { t: 'pong'; sentAt: number; serverTime: number }
  | { t: 'nameWord'; glyph: string; word: string }  // peer submitted a name word (arrival)
  // --- M3+ ---
  | { t: 'rideStart'; audioUrl: string; source: 'own' | 'borrowed'; rideStartAt: number; bpm: number }
  | { t: 'trackReady'; audioUrl: string; bpm: number }
  | { t: 'sync'; positionSec: number }
  | { t: 'peerGesture'; glyph: string; kind: GestureKind; atBeat?: number }
  | { t: 'fireworkSynced'; synced: boolean }
  | { t: 'peerLeft' };
