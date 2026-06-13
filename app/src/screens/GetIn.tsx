import { Suspense, lazy, useEffect, useState } from 'react';
import { Archive, Car, Music2 } from 'lucide-react';
import { getAudioState, onAudioStateChange, startIdleHum, unlockAudio } from '../audio/engine';
import { ensureIdentity } from '../auth/identity';
import { useSession } from '../state/session';
import { Button, Glass, RoadDivider } from '../components/ui';

const PlayCanvasRideScene = lazy(() => import('../scene/PlayCanvasRideScene'));

export default function GetIn() {
  const setIdentity = useSession((s) => s.setIdentity);
  const setAudioState = useSession((s) => s.setAudioState);

  const [agreed, setAgreed] = useState(false);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [t, setT] = useState(0);

  useEffect(() => onAudioStateChange(setAudioState), [setAudioState]);

  // a slow coast drive behind the glass — a taste of where you're headed
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => { setT((now - start) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  async function handleGetIn() {
    if (!agreed || entering) return;
    setEntering(true);
    setError(null);
    try {
      await unlockAudio(); // inside the gesture — iOS requirement (§11)
      startIdleHum(); // audible proof the engine is running
      setAudioState(getAudioState());
      const session = await ensureIdentity();
      setIdentity(session.userId, session.identity);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong getting in.');
    } finally {
      setEntering(false);
    }
  }

  return (
    <main className="relative flex min-h-full items-center justify-center overflow-hidden bg-cream px-6 py-12">
      {/* a live coast scene as the backdrop */}
      <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-b from-sky to-cream" />}>
        <PlayCanvasRideScene
          road="coast"
          positionSec={t}
          driverColor="#E85D2F"
          passengerColor="#18A39A"
          driverCharacter="theo"
          passengerCharacter="wren"
        />
      </Suspense>
      <div className="pointer-events-none absolute inset-0 bg-cream/35" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-cream" />

      <Glass className="relative z-10 flex w-full max-w-md flex-col items-center gap-5 px-7 py-9 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-display text-5xl font-semibold tracking-tight text-ink">Roadie</h1>
          <RoadDivider className="max-w-[96px]" />
        </div>

        <p className="text-[15px] leading-7 text-ink-soft">
          You'll meet a co-rider and compose a song together — pick an instrument, write a
          direction, and the studio fuses both into one track. Then ride to a real place while
          it plays.
        </p>

        <div className="flex flex-col gap-2 text-left text-sm text-ink-soft">
          <span className="flex items-center gap-2">
            <Music2 size={15} className="text-sunset" /> your song exists nowhere else, ever again
          </span>
          <span className="flex items-center gap-2">
            <Archive size={15} className="text-sunset" /> save it to your Glovebox to keep it
          </span>
        </div>

        <Button onClick={handleGetIn} disabled={!agreed || entering} className="mt-1 flex items-center gap-2 px-10 text-lg">
          <Car size={20} />
          {entering ? 'getting in…' : 'Get in'}
        </Button>

        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="h-4 w-4 accent-sunset"
          />
          I'm 18 or older
        </label>

        {error && <p className="text-sm text-sunset-deep">{error}</p>}
      </Glass>
    </main>
  );
}
