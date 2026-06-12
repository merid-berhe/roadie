import { create } from 'zustand';
import type { ClientMsg, DanceMove, Destination, GestureKind, Phase, Recipe, Rider, Role, RoomMsg } from '@roadie/shared';
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
  instruments: Role[];
  readyRoles: Role[];
  destination: Destination | null;
  recipe: Recipe | null;
  peerChoices: Record<string, string>;
  // §5 v5.0 — gated prompt display cards by role (never raw text)
  promptCards: Partial<Record<Role, { glyph: string; display: string; character?: string }>>;
  promptRejectedAt: number;
  vocalsVotes: Role[];
  // The Meeting (§8d)
  peerDance: { glyph: string; move: DanceMove; at: number } | null;
  danceSynced: { move: DanceMove; at: number } | null;
  // Generation (M3)
  audioUrl: string | null;
  rideStartAt: number | null; // server-authoritative timestamp (ms)
  bpm: number | null;
  trackDurationSec: number | null; // v5.8 — the song's real length (server-confirmed)
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
  instruments: [] as Role[],
  readyRoles: [] as Role[],
  destination: null as Destination | null,
  recipe: null as Recipe | null,
  peerChoices: {} as Record<string, string>,
  promptCards: {} as Partial<Record<Role, { glyph: string; display: string; character?: string }>>,
  promptRejectedAt: 0,
  vocalsVotes: [] as Role[],
  peerDance: null as { glyph: string; move: DanceMove; at: number } | null,
  danceSynced: null as { move: DanceMove; at: number } | null,
  audioUrl: null as string | null,
  rideStartAt: null as number | null,
  bpm: null as number | null,
  trackDurationSec: null as number | null,
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
            instruments: msg.instruments,
            readyRoles: msg.readyRoles,
            destination: msg.destination,
            recipe: msg.recipe ?? state.recipe,
            selectedRoad: msg.destination.theme,
            vocalsVotes: msg.vocalsVotes ?? state.vocalsVotes,
          };
        case 'roomFull':
          return { rejectedFull: true };
        case 'peerChoice':
          return { peerChoices: { ...state.peerChoices, [msg.field]: msg.value } };
        case 'promptCard':
          return {
            promptCards: { ...state.promptCards, [msg.role]: { glyph: msg.glyph, display: msg.display, character: msg.character } },
          };
        case 'promptRejected':
          return { promptRejectedAt: Date.now() };
        case 'peerDance':
          return { peerDance: { glyph: msg.glyph, move: msg.move, at: Date.now() } };
        case 'danceSynced':
          return { danceSynced: { move: msg.move, at: Date.now() } };
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
        case 'trackDuration':
          return { trackDurationSec: msg.sec };
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
