import { useEffect, useState } from 'react';
import { getAudioState, onAudioStateChange, startIdleHum, unlockAudio } from '../audio/engine';
import { ensureIdentity } from '../auth/identity';
import { useSession } from '../state/session';

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
    <main className="flex min-h-full flex-col items-center justify-center gap-8 bg-[#0b1020] px-6 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Roadie</h1>
        <p className="mt-2 text-white/50">make a song with a stranger. ride along to it.</p>
      </div>

      <button
        onClick={handleGetIn}
        disabled={!agreed || entering}
        className="rounded-full bg-amber-400 px-10 py-4 text-lg font-semibold text-black transition active:scale-95 disabled:opacity-40"
      >
        {entering ? 'getting in…' : 'Get in'}
      </button>

      <label className="flex items-center gap-2 text-sm text-white/60">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="h-4 w-4 accent-amber-400"
        />
        I'm 18 or older
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </main>
  );
}
