import { useEffect, useState } from 'react';
import { connectToRoom } from '../net/room';
import { getOrCreateRoomCode } from '../lib/roomCode';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';
import Lobby from './Lobby';
import Compose from './Compose';

// Manages the room connection for the full ride lifecycle (M1+).
// Connection persists across phase transitions so the socket stays alive
// while the user moves from lobby → compose → generating → riding → arrival.
export default function RideScreen() {
  const userId = useSession((s) => s.userId);
  const identity = useSession((s) => s.identity);

  const connected = useRoom((s) => s.connected);
  const full = useRoom((s) => s.full);
  const phase = useRoom((s) => s.phase);
  const rejectedFull = useRoom((s) => s.rejectedFull);

  const [roomCode] = useState(getOrCreateRoomCode);

  useEffect(() => {
    if (!userId || !identity) return;
    const conn = connectToRoom(roomCode, {
      onOpen: () => {
        useRoom.getState().setConnected(true);
        useRoom.getState().setSend(conn.send);
        conn.send({ t: 'join', userId, glyph: identity.glyph, color: identity.color });
      },
      onMessage: (msg) => useRoom.getState().ingest(msg),
      onClose: () => {
        useRoom.getState().setConnected(false);
        useRoom.getState().setSend(noop);
      },
    });
    return () => {
      conn.close();
      useRoom.getState().reset();
    };
  }, [roomCode, userId, identity]);

  if (rejectedFull) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#0b1020] text-white">
        <p className="text-lg">this car's already full</p>
        <p className="text-sm text-white/50">two riders per ride.</p>
        <a href={location.pathname} className="mt-2 rounded-full bg-amber-400 px-6 py-3 font-semibold text-black">
          start a new ride
        </a>
      </main>
    );
  }

  if (!connected) {
    return (
      <main className="flex min-h-full items-center justify-center bg-[#0b1020] text-white/30 text-sm">
        connecting…
      </main>
    );
  }

  if (!full) return <Lobby roomCode={roomCode} />;
  if (phase === 'lobby') return <Compose />;

  // M3+: Generating, Riding, Arrival screens
  return (
    <main className="flex min-h-full items-center justify-center bg-[#0b1020] text-white/40 text-sm">
      {phase} — coming in M3+
    </main>
  );
}

function noop() {}
