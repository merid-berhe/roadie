import { create } from 'zustand';
import type { GlyphIdentity } from '@roadie/shared';
import type { AudioState } from '../audio/engine';

// Local session state (identity + audio). NOT room state — once the PartyKit room
// exists (M1+), ride-correctness state becomes a read-only projection of room messages
// per §3; this store stays for purely-local concerns.
type SessionState = {
  userId: string | null;
  identity: GlyphIdentity | null;
  audioState: AudioState;
  setIdentity: (userId: string, identity: GlyphIdentity) => void;
  setAudioState: (audioState: AudioState) => void;
};

export const useSession = create<SessionState>((set) => ({
  userId: null,
  identity: null,
  audioState: 'suspended',
  setIdentity: (userId, identity) => set({ userId, identity }),
  setAudioState: (audioState) => set({ audioState }),
}));
