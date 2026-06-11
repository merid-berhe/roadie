import { create } from 'zustand';
import type { ClientMsg, Destination, GestureKind, Phase, Recipe, Rider, Role, RoomMsg } from '@roadie/shared';
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
  destination: Destination | null;
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
  // §5a "tune the radio" — minted style cards by role (never raw text)
  whisperCards: Partial<Record<Role, { glyph: string; style: string }>>;
  whisperRejectedAt: number;
  radioLocked: boolean;
  // §5b ride performance layer
  rideSeed: number | null;
  carLane: number;                  // server-relayed lane (passenger view; driver is optimistic)
  caughtIds: number[];
  lastCatch: { id: number; byGlyph: string; at: number } | null;
  peerRiffTap: { idx: number; role: Role; at: number } | null;
  riffLandedIdx: { idx: number; at: number } | null;
  landmarksLit: number[];
  lastLandmarkLit: { idx: number; at: number } | null;
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
  destination: null as Destination | null,
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
  selectedRoad: 'desert' as string,
  whisperCards: {} as Partial<Record<Role, { glyph: string; style: string }>>,
  whisperRejectedAt: 0,
  radioLocked: false,
  rideSeed: null as number | null,
  carLane: 1,
  caughtIds: [] as number[],
  lastCatch: null as { id: number; byGlyph: string; at: number } | null,
  peerRiffTap: null as { idx: number; role: Role; at: number } | null,
  riffLandedIdx: null as { idx: number; at: number } | null,
  landmarksLit: [] as number[],
  lastLandmarkLit: null as { idx: number; at: number } | null,
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
            destination: msg.destination,
            recipe: msg.recipe ?? state.recipe,
            selectedRoad: msg.destination.theme,
            radioLocked: msg.radioLocked ?? state.radioLocked,
          };
        case 'roomFull':
          return { rejectedFull: true };
        case 'peerChoice':
          return { peerChoices: { ...state.peerChoices, [msg.field]: msg.value } };
        case 'rideStart':
          return { phase: 'riding', audioUrl: msg.audioUrl, rideStartAt: msg.rideStartAt, bpm: msg.bpm, rideSeed: msg.rideSeed };
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
        case 'whisperCard':
          return {
            whisperCards: { ...state.whisperCards, [msg.role]: { glyph: msg.glyph, style: msg.style } },
          };
        case 'whisperRejected':
          return { whisperRejectedAt: Date.now() };
        case 'peerLane':
          return { carLane: msg.lane };
        case 'catchLanded':
          return {
            caughtIds: [...state.caughtIds, msg.id],
            lastCatch: { id: msg.id, byGlyph: msg.byGlyph, at: Date.now() },
          };
        case 'peerRiffTap':
          return { peerRiffTap: { idx: msg.idx, role: msg.role, at: Date.now() } };
        case 'riffLanded':
          return { riffLandedIdx: { idx: msg.idx, at: Date.now() } };
        case 'landmarkLit':
          return {
            landmarksLit: [...state.landmarksLit, msg.idx],
            lastLandmarkLit: { idx: msg.idx, at: Date.now() },
          };
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
