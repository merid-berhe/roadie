import { create } from 'zustand';
import type { ClientMsg, GestureKind, Phase, Recipe, Rider, Role, RoomMsg } from '@roadie/shared';
import { offsetFromPong } from '../net/clock';

// §3: Zustand is a READ-ONLY PROJECTION of room state. `ingest` is the only writer
// of ride-correctness fields. Components only read.
type RoomState = {
  connected: boolean;
  rejectedFull: boolean;
  phase: Phase | null;
  you: Role | null;
  riders: Rider[];
  full: boolean;
  seeded: Role[];
  readyRoles: Role[];
  recipe: Recipe | null;
  peerChoices: Record<string, string>;
  // Generation (M3)
  audioUrl: string | null;
  rideStartAt: number | null; // server-authoritative timestamp (ms)
  bpm: number | null;
  generationFailed: boolean;
  generationFailedReason: string | null;
  // Clock sync (M4, §9)
  clockOffset: number;
  clockSamples: number;
  syncPositionSec: number | null;
  // Gestures (M5, §8)
  peerGestureKind: GestureKind | null;
  peerGestureAt: number;     // Date.now() when last peerGesture arrived
  fireworkSynced: boolean | null;
  fireworkAt: number;
  peerNameWord: string | null;
  selectedRoad: string;
  // Plumbing
  send: (msg: ClientMsg) => void;
  ingest: (msg: RoomMsg) => void;
  setConnected: (connected: boolean) => void;
  setSend: (send: (msg: ClientMsg) => void) => void;
  reset: () => void;
};

const noop = () => {};

const initial = {
  connected: false,
  rejectedFull: false,
  phase: null as Phase | null,
  you: null as Role | null,
  riders: [] as Rider[],
  full: false,
  seeded: [] as Role[],
  readyRoles: [] as Role[],
  recipe: null as Recipe | null,
  peerChoices: {} as Record<string, string>,
  audioUrl: null as string | null,
  rideStartAt: null as number | null,
  bpm: null as number | null,
  generationFailed: false,
  generationFailedReason: null as string | null,
  clockOffset: 0,
  clockSamples: 0,
  syncPositionSec: null as number | null,
  peerGestureKind: null as GestureKind | null,
  peerGestureAt: 0,
  fireworkSynced: null as boolean | null,
  fireworkAt: 0,
  peerNameWord: null as string | null,
  selectedRoad: 'desert' as string,     // driver-picked road; default desert
  send: noop,
};

export const useRoom = create<RoomState>((set) => ({
  ...initial,
  ingest: (msg) =>
    set((state): Partial<RoomState> => {
      switch (msg.t) {
        case 'state':
          return {
            phase: msg.phase,
            you: msg.you,
            riders: msg.riders,
            full: msg.full,
            seeded: msg.seeded,
            readyRoles: msg.readyRoles,
            recipe: msg.recipe ?? state.recipe,
          };
        case 'roomFull':
          return { rejectedFull: true };
        case 'peerChoice':
          return { peerChoices: { ...state.peerChoices, [msg.field]: msg.value } };
        case 'rideStart':
          return { phase: 'riding', audioUrl: msg.audioUrl, rideStartAt: msg.rideStartAt, bpm: msg.bpm };
        case 'generationFailed':
          return { generationFailed: true, generationFailedReason: msg.reason };
        case 'pong': {
          // Running average of clock offset across ping samples (§9)
          const sample = offsetFromPong(msg.sentAt, msg.serverTime);
          const n = state.clockSamples + 1;
          const clockOffset = (state.clockOffset * state.clockSamples + sample) / n;
          return { clockOffset, clockSamples: n };
        }
        case 'sync':
          return { syncPositionSec: msg.positionSec };
        case 'peerGesture':
          return { peerGestureKind: msg.kind, peerGestureAt: Date.now() };
        case 'fireworkSynced':
          return { fireworkSynced: msg.synced, fireworkAt: Date.now() };
        case 'nameWord':
          return { peerNameWord: msg.word };
        case 'peerRoad':
          return { selectedRoad: msg.roadId };
        default:
          return {};
      }
    }),
  setConnected: (connected) => set({ connected }),
  setSend: (send) => set({ send }),
  reset: () => set({ ...initial, send: noop }),
}));
