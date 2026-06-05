import { create } from 'zustand';
import type { ClientMsg, Phase, Recipe, Rider, Role, RoomMsg } from '@roadie/shared';

// §3: Zustand is a READ-ONLY PROJECTION of room state. `ingest` (the room-message
// handler) is the only writer of ride-correctness fields. Components only read.
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
  peerChoices: Record<string, string>; // field → value, accumulated from peerChoice messages
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
        default:
          return {};
      }
    }),
  setConnected: (connected) => set({ connected }),
  setSend: (send) => set({ send }),
  reset: () => set({ ...initial, send: noop }),
}));
