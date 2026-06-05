import { create } from 'zustand';
import type { Phase, Rider, Role, RoomMsg } from '@roadie/shared';

// §3: Zustand is a READ-ONLY PROJECTION of room state. `ingest` (the room-message
// handler) is the only writer of ride-correctness fields; components only read.
type RoomState = {
  connected: boolean;
  rejectedFull: boolean;
  phase: Phase | null;
  you: Role | null;
  riders: Rider[];
  full: boolean;
  ingest: (msg: RoomMsg) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
};

const initial = {
  connected: false,
  rejectedFull: false,
  phase: null as Phase | null,
  you: null as Role | null,
  riders: [] as Rider[],
  full: false,
};

export const useRoom = create<RoomState>((set) => ({
  ...initial,
  ingest: (msg) =>
    set((): Partial<RoomState> => {
      switch (msg.t) {
        case 'state':
          return { phase: msg.phase, you: msg.you, riders: msg.riders, full: msg.full };
        case 'roomFull':
          return { rejectedFull: true };
        default:
          return {}; // later message variants handled in their milestones
      }
    }),
  setConnected: (connected) => set({ connected }),
  reset: () => set({ ...initial }),
}));
