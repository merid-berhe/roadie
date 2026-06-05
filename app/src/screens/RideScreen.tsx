import { useEffect, useRef, useState } from 'react';
import { startBedSilent, stopBed } from '../audio/bed';
import { loadAndCrossfade } from '../audio/player';
import { stopIdleHum } from '../audio/engine';
import { estimateClockOffset } from '../net/clock';
import { connectToRoom } from '../net/room';
import { getOrCreateRoomCode } from '../lib/roomCode';
import { setAnalyticsUser, setAnalyticsRide, track } from '../lib/analytics';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';
import Compose from './Compose';
import Generating from './Generating';
import Lobby from './Lobby';
import Riding from './Riding';
import Arrival from './Arrival';
import PostRide from './PostRide';
import Glovebox from './Glovebox';

type PostPhase = 'arrival' | 'post-ride' | 'glovebox';

export default function RideScreen() {
  const userId   = useSession((s) => s.userId);
  const identity = useSession((s) => s.identity);

  const connected      = useRoom((s) => s.connected);
  const full           = useRoom((s) => s.full);
  const phase          = useRoom((s) => s.phase);
  const rejectedFull   = useRoom((s) => s.rejectedFull);
  const generationFailed = useRoom((s) => s.generationFailed);
  const audioUrl       = useRoom((s) => s.audioUrl);
  const rideStartAt    = useRoom((s) => s.rideStartAt);
  const bpm            = useRoom((s) => s.bpm);
  const clockOffset    = useRoom((s) => s.clockOffset);

  const [roomCode]    = useState(getOrCreateRoomCode);
  const [postPhase, setPostPhase] = useState<PostPhase | null>(null);
  const [savedSongId, setSavedSongId] = useState<string | null>(null);

  const rideStartTracked = useRef(false);
  const tuningStart      = useRef<number | null>(null);

  // Room connection
  useEffect(() => {
    if (!userId || !identity) return;
    stopIdleHum();
    const conn = connectToRoom(roomCode, {
      onOpen: () => {
        useRoom.getState().setConnected(true);
        useRoom.getState().setSend(conn.send);
        conn.send({ t: 'join', userId, glyph: identity.glyph, color: identity.color });
        estimateClockOffset(conn.send);
      },
      onMessage: (msg) => useRoom.getState().ingest(msg),
      onClose: () => { useRoom.getState().setConnected(false); useRoom.getState().setSend(noop); },
    });
    return () => { conn.close(); useRoom.getState().reset(); stopBed(); };
  }, [roomCode, userId, identity]);

  // Analytics: set user context
  useEffect(() => { if (userId) setAnalyticsUser(userId); }, [userId]);

  // iOS keepalive bed (§11)
  useEffect(() => { if (full) startBedSilent(); }, [full]);

  // Analytics: paired
  useEffect(() => { if (full) track('paired', { mode: 'invite' }); }, [full]);

  // Analytics: tuning phase tracking (§13 highest-risk window)
  useEffect(() => {
    if (phase === 'generating' && !tuningStart.current) {
      tuningStart.current = Date.now();
      track('tuning_started');
      const intervals = [10_000, 20_000, 30_000];
      intervals.forEach((ms) =>
        setTimeout(() => {
          if (useRoom.getState().phase === 'generating')
            track(`tuning_${ms / 1000}s_reached`);
        }, ms)
      );
    }
  }, [phase]);

  // Crossfade + analytics: ride started
  useEffect(() => {
    if (!audioUrl || !rideStartAt || !bpm) return;
    loadAndCrossfade(audioUrl, rideStartAt, bpm, clockOffset);
    if (!rideStartTracked.current) {
      rideStartTracked.current = true;
      const tuningMs = tuningStart.current ? Date.now() - tuningStart.current : 0;
      track('tuning_completed', { ms_elapsed: tuningMs, source: audioUrl.startsWith('mock://') ? 'borrowed' : 'own' });
      track('ride_started', { music_source: audioUrl.startsWith('mock://') ? 'borrowed' : 'own' });
      setAnalyticsRide(roomCode);
    }
  }, [audioUrl, rideStartAt, bpm, clockOffset, roomCode]);

  // Phase: arrival
  useEffect(() => {
    if (phase === 'arrival' && !postPhase) {
      track('ride_completed');
      setPostPhase('arrival');
    }
  }, [phase, postPhase]);

  if (rejectedFull) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#0b1020] text-white">
        <p className="text-lg">this car's already full</p>
        <p className="text-sm text-white/50">two riders per ride.</p>
        <a href={location.pathname} className="mt-2 rounded-full bg-amber-400 px-6 py-3 font-semibold text-black">start a new ride</a>
      </main>
    );
  }

  if (generationFailed) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#0b1020] px-6 text-center text-white">
        <p className="text-lg">the studio was busy today</p>
        <p className="text-sm text-white/50">your song didn't print. the road's still open.</p>
        <a href={location.pathname} className="mt-4 rounded-full bg-amber-400 px-6 py-3 font-semibold text-black">try again</a>
      </main>
    );
  }

  // Post-ride flow
  if (postPhase === 'glovebox') return <Glovebox onBack={() => setPostPhase('post-ride')} />;
  if (postPhase === 'post-ride') {
    return (
      <PostRide
        songId={savedSongId}
        onGlovebox={() => setPostPhase('glovebox')}
        onNewRide={() => { window.location.href = location.pathname; }}
      />
    );
  }
  if (postPhase === 'arrival') {
    return (
      <Arrival
        onDone={(id) => { setSavedSongId(id); setPostPhase('post-ride'); }}
      />
    );
  }

  if (!connected) {
    return <main className="flex min-h-full items-center justify-center bg-[#0b1020] text-white/30 text-sm">connecting…</main>;
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
