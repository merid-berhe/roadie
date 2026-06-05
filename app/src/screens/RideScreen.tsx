import { useEffect, useState } from 'react';
import { startBedSilent, stopBed } from '../audio/bed';
import { loadAndCrossfade } from '../audio/player';
import { stopIdleHum } from '../audio/engine';
import { connectToRoom } from '../net/room';
import { getOrCreateRoomCode } from '../lib/roomCode';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';
import Compose from './Compose';
import Generating from './Generating';
import Lobby from './Lobby';
import Riding from './Riding';

export default function RideScreen() {
  const userId = useSession((s) => s.userId);
  const identity = useSession((s) => s.identity);

  const connected = useRoom((s) => s.connected);
  const full = useRoom((s) => s.full);
  const phase = useRoom((s) => s.phase);
  const rejectedFull = useRoom((s) => s.rejectedFull);
  const generationFailed = useRoom((s) => s.generationFailed);
  const audioUrl = useRoom((s) => s.audioUrl);
  const rideStartAt = useRoom((s) => s.rideStartAt);
  const bpm = useRoom((s) => s.bpm);

  const [roomCode] = useState(getOrCreateRoomCode);

  // Room connection — persists across phase transitions
  useEffect(() => {
    if (!userId || !identity) return;
    stopIdleHum(); // transition from GetIn hum to the driving bed
    const conn = connectToRoom(roomCode, {
      onOpen: () => {
        useRoom.getState().setConnected(true);
        useRoom.getState().setSend(conn.send);
        conn.send({ t: 'join', userId, glyph: identity.glyph, color: identity.color });
      },
      onMessage: (msg) => useRoom.getState().ingest(msg),
      onClose: () => { useRoom.getState().setConnected(false); useRoom.getState().setSend(noop); },
    });
    return () => { conn.close(); useRoom.getState().reset(); stopBed(); };
  }, [roomCode, userId, identity]);

  // Start silent bed when room is full (iOS keepalive through composition, §11)
  useEffect(() => {
    if (full) startBedSilent();
  }, [full]);

  // Crossfade: fires from here so it works regardless of which screen is mounted (§1 step 4)
  useEffect(() => {
    if (audioUrl && rideStartAt && bpm) {
      loadAndCrossfade(audioUrl, rideStartAt, bpm);
    }
  }, [audioUrl, rideStartAt, bpm]);

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

  if (generationFailed) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#0b1020] px-6 text-center text-white">
        <p className="text-lg">the studio was busy today</p>
        <p className="text-sm text-white/50">your song didn't print. the road's still open.</p>
        <a href={location.pathname} className="mt-4 rounded-full bg-amber-400 px-6 py-3 font-semibold text-black">
          try again
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

  switch (phase) {
    case 'lobby':      return <Compose />;
    case 'generating': return <Generating />;
    case 'riding':     return <Riding />;
    default:           return null;
  }
}

function noop() {}
