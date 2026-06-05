// §15 contract spine — the messages that flow between client and the PartyKit room.
// The room is the single source of truth (§3); these types are the wire format.
// IMPORTANT (§6): a peer is only ever described by glyph + color + role — never by
// user_id or any cross-ride linkage.

export type Role = 'driver' | 'passenger';

export type Phase = 'lobby' | 'generating' | 'riding' | 'arrival';

export type GestureKind = 'wave' | 'headlights' | 'heart' | 'tambourine' | 'shaker' | 'chime';

/** A rider as seen by the room and peers — anonymous (glyph identity only). */
export type Rider = {
  role: Role;
  glyph: string;
  color: string;
  connected: boolean;
};

/** Client → Room. M1 implements `join`; later variants land in their milestones (M2+). */
export type ClientMsg =
  | { t: 'join'; userId: string; glyph: string; color: string }
  // --- M2+ (declared for the contract; not yet handled) ---
  | { t: 'seed'; word: string }
  | { t: 'choice'; field: string; value: string }
  | { t: 'ready' }
  | { t: 'gesture'; kind: GestureKind }
  | { t: 'firework' }
  | { t: 'name'; word: string }
  | { t: 'report' };

/** Room → Client. M1 implements `state` / `roomFull`; later variants land in their milestones. */
export type RoomMsg =
  | { t: 'state'; phase: Phase; you: Role; riders: Rider[]; full: boolean }
  | { t: 'roomFull' }
  // --- M2+ (declared for the contract; not yet emitted) ---
  | { t: 'peerChoice'; glyph: string; field: string; value: string }
  | { t: 'rideStart'; audioUrl: string; source: 'own' | 'borrowed'; rideStartAt: number; bpm: number }
  | { t: 'trackReady'; audioUrl: string; bpm: number }
  | { t: 'sync'; positionSec: number }
  | { t: 'peerGesture'; glyph: string; kind: GestureKind; atBeat?: number }
  | { t: 'fireworkSynced'; synced: boolean }
  | { t: 'peerLeft' };
