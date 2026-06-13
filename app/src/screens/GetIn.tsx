import { useEffect, useState } from 'react';
import { Archive, Car, Music2 } from 'lucide-react';
import { getAudioState, onAudioStateChange, startIdleHum, unlockAudio } from '../audio/engine';
import { ensureIdentity } from '../auth/identity';
import { useSession } from '../state/session';
import { Button, Glass, RoadDivider } from '../components/ui';

export default function GetIn() {
  const setIdentity = useSession((s) => s.setIdentity);
  const setAudioState = useSession((s) => s.setAudioState);

  const [agreed, setAgreed] = useState(false);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAudioStateChange(setAudioState), [setAudioState]);

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
    <main className="relative flex min-h-full items-center justify-center overflow-hidden px-6 py-12"
      style={{ background: 'linear-gradient(180deg, #8ac9e8 0%, #c8dbe6 45%, #ecf1f4 100%)' }}
    >
      <Glass className="relative z-10 flex w-full max-w-md flex-col items-center gap-5 px-7 py-9 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-display text-5xl font-semibold tracking-tight text-ink">Roadie</h1>
          <RoadDivider className="max-w-[96px]" />
        </div>

        <p className="text-[15px] leading-7 text-ink-soft">
          You'll meet a co-rider and compose a song together — pick an instrument, write a
          direction, and the studio fuses both into one track. It joins this bar's collection
          for everyone to hear.
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
