import { useEffect, useState } from 'react';
import { getAudioState, onAudioStateChange, startIdleHum, unlockAudio } from '../audio/engine';
import { ensureIdentity } from '../auth/identity';
import { useSession } from '../state/session';
import { Button, RoadDivider } from '../components/ui';

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
    <main className="flex min-h-full flex-col items-center justify-center gap-8 bg-cream px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink">Roadie</h1>
        <RoadDivider className="max-w-[112px]" />
        <p className="text-ink-soft">make a song with someone. ride along to it.</p>
      </div>

      <Button onClick={handleGetIn} disabled={!agreed || entering} className="px-10 text-lg">
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
    </main>
  );
}
