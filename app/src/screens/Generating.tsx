import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Hand, Mic, Music2, RotateCw, MoveVertical, Sparkles } from 'lucide-react';
import { DANCE_MOVES, type DanceMove } from '@roadie/shared';
import type { RoadId } from '../scene/scenes';
import type { DanceState } from '../scene/PlayCanvasRideScene';
import { fadeBedIn, startBedSilent } from '../audio/bed';
import { playFireworkAccent, playGestureSound } from '../audio/gestures';
import { characterName } from '../components/CharacterFace';
import { Glass } from '../components/ui';
import { useRoom } from '../state/room';
import { track } from '../lib/analytics';

const PlayCanvasRideScene = lazy(() => import('../scene/PlayCanvasRideScene'));

const MOVE_LABELS: Record<DanceMove, { icon: React.ReactNode; word: string }> = {
  bounce: { icon: <MoveVertical size={15} />, word: 'bounce' },
  spin: { icon: <RotateCw size={15} />, word: 'spin' },
  wave: { icon: <Hand size={15} />, word: 'wave' },
  shimmy: { icon: <Sparkles size={15} />, word: 'shimmy' },
};

// §8d The Meeting — the generation wait IS the place where the pair meets.
// Parked car, ambient bed (whose beat WE control), a dance-off, and the
// combined prompt on display like a record label being pressed.
export default function Generating() {
  const riders = useRoom((s) => s.riders);
  const destination = useRoom((s) => s.destination);
  const recipe = useRoom((s) => s.recipe);
  const selectedRoad = useRoom((s) => s.selectedRoad) as RoadId;
  const you = useRoom((s) => s.you);
  const peerDance = useRoom((s) => s.peerDance);
  const danceSynced = useRoom((s) => s.danceSynced);
  const send = useRoom((s) => s.send);

  const [ownDance, setOwnDance] = useState<DanceState>(null);
  const lastDanceSentRef = useRef(0);
  const prevDanceSyncedAt = useRef(0);

  useEffect(() => {
    startBedSilent(); // safe no-op if already started during compose
    fadeBedIn(2);     // the studio hums — bed becomes audible
  }, []);

  // synced dance — celebrate (burst handled by the scene)
  useEffect(() => {
    if (!danceSynced || danceSynced.at <= prevDanceSyncedAt.current) return;
    prevDanceSyncedAt.current = danceSynced.at;
    playFireworkAccent();
    track('dance_synced', { move: danceSynced.move });
  }, [danceSynced]);

  function dance(move: DanceMove) {
    const now = Date.now();
    if (now - lastDanceSentRef.current < 600) return;
    lastDanceSentRef.current = now;
    setOwnDance({ move, at: now });
    playGestureSound(move === 'shimmy' ? 'shaker' : move === 'spin' ? 'chime' : 'tambourine');
    send({ t: 'dance', move });
    track('dance_sent', { move });
  }

  const driver = riders.find((r) => r.role === 'driver');
  const passenger = riders.find((r) => r.role === 'passenger');
  const driverDance: DanceState = you === 'driver' ? ownDance : peerDance ? { move: peerDance.move, at: peerDance.at } : null;
  const passengerDance: DanceState = you === 'passenger' ? ownDance : peerDance ? { move: peerDance.move, at: peerDance.at } : null;

  return (
    <div className="relative h-screen overflow-hidden bg-sky">
      <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-b from-sky to-cream" />}>
        <PlayCanvasRideScene
          road={(destination?.theme ?? selectedRoad) as RoadId}
          positionSec={0}
          driverColor={driver?.color ?? '#E85D2F'}
          passengerColor={passenger?.color ?? '#18A39A'}
          driverCharacter={driver?.character}
          passengerCharacter={passenger?.character}
          mode="meeting"
          driverDance={driverDance}
          passengerDance={passengerDance}
          danceSyncedAt={danceSynced?.at ?? 0}
        />
      </Suspense>

      {/* The record label — what you two asked for */}
      <div className="pointer-events-none absolute left-0 right-0 top-4 flex flex-col items-center gap-2 px-6">
        <span className="rounded-full bg-paper/80 px-3 py-1 font-display text-xs font-medium uppercase tracking-[0.18em] text-ink-soft backdrop-blur-md">
          now pressing your song
        </span>
        <Glass className="max-w-md px-4 py-3 text-center">
          {recipe?.driver.text && (
            <p className="text-sm font-semibold" style={{ color: driver?.color }}>
              {characterName(driver?.character) ?? driver?.glyph} “{recipe.driver.text}”
            </p>
          )}
          {recipe?.passenger.text && (
            <p className="text-sm font-semibold" style={{ color: passenger?.color }}>
              {characterName(passenger?.character) ?? passenger?.glyph} “{recipe.passenger.text}”
            </p>
          )}
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
            {recipe ? `${recipe.driver.instrument} + ${recipe.passenger.instrument}` : ''}
            <span className="inline-flex items-center gap-1">
              · {recipe?.vocals ? <Mic size={11} /> : <Music2 size={11} />} {recipe?.vocals ? 'sung' : 'instrumental'}
            </span>
            {destination ? ` · ${destination.name}` : ''}
          </p>
          {recipe?.brief && (
            <p className="mt-2 border-t border-ink/10 pt-2 text-xs italic text-ink-soft">
              the studio hears: {recipe.brief}
            </p>
          )}
          {recipe?.lyrics && (
            <p className="mt-2 whitespace-pre-line border-t border-ink/10 pt-2 text-xs italic leading-5 text-ink-soft">
              {recipe.lyrics.split('\n').slice(0, 4).join('\n')}
              {recipe.lyrics.split('\n').length > 4 ? '\n…' : ''}
            </p>
          )}
        </Glass>
      </div>

      {/* Dance-off controls */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 pb-6">
        {danceSynced && Date.now() - danceSynced.at < 3000 && (
          <span className="flex items-center gap-1.5 rounded-full bg-paper/85 px-4 py-1.5 text-sm font-semibold text-sunset-deep shadow-card backdrop-blur-md">
            <Sparkles size={14} />
            synced {MOVE_LABELS[danceSynced.move].word}!
          </span>
        )}
        <div className="flex gap-2">
          {DANCE_MOVES.map((move) => (
            <button
              key={move}
              onClick={() => dance(move)}
              className="flex items-center gap-1.5 rounded-full bg-paper/85 px-4 py-2.5 text-sm font-semibold text-ink shadow-card backdrop-blur-md transition hover:bg-paper active:scale-90"
            >
              {MOVE_LABELS[move].icon}
              {MOVE_LABELS[move].word}
            </button>
          ))}
        </div>
        <p className="rounded-full bg-paper/60 px-3 py-1 text-xs text-ink-soft backdrop-blur-sm">
          match a move together for a spark · the song takes a minute or two
        </p>
        <a href={location.pathname} className="text-xs text-ink-soft/60 hover:text-ink-soft">new ride</a>
      </div>
    </div>
  );
}
