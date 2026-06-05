// Post-ride: rating tokens + the one validation question (§13) + report path.
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { useSession } from '../state/session';

const RATING_TOKENS = ['✨', '🎵', '🚗'];
const SURVEY_OPTIONS = ['Definitely', 'Sort of', 'Not really'] as const;
type Survey = (typeof SURVEY_OPTIONS)[number];

type Props = { songId: string | null; onGlovebox: () => void; onNewRide: () => void };

export default function PostRide({ songId, onGlovebox, onNewRide }: Props) {
  const userId  = useSession((s) => s.userId);

  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [survey, setSurvey]     = useState<Survey | null>(null);
  const [reported, setReported] = useState(false);
  const [done, setDone]         = useState(false);

  function toggleToken(t: string) {
    setSelectedTokens((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  async function submit() {
    if (!survey) return;
    track('rating_submitted', { tokens: selectedTokens });
    track('survey_answer', { answer: survey, song_id: songId });
    setDone(true);
  }

  async function report() {
    if (!supabase || !userId) return;
    await supabase.from('reports').insert({ reporter_id: userId });
    track('report_submitted');
    setReported(true);
  }

  if (done) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-[#0b1020] px-6 text-center text-white">
        <p className="text-2xl">thanks for the ride 🚗</p>
        {songId && (
          <button onClick={onGlovebox} className="rounded-full bg-amber-400 px-8 py-3 font-semibold text-black">
            open glovebox
          </button>
        )}
        <button onClick={onNewRide} className="text-sm text-white/40 underline-offset-2 hover:text-white/60">
          new ride
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 bg-[#0b1020] px-6 text-center text-white">
      {/* The one validation question — §13 */}
      <div className="flex flex-col gap-4">
        <p className="text-base font-medium">did it feel like you made that song <em>together</em>?</p>
        <div className="flex gap-3">
          {SURVEY_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setSurvey(opt)}
              className="flex-1 rounded-lg border py-3 text-sm transition"
              style={{
                borderColor: survey === opt ? '#F5A623' : 'rgba(255,255,255,0.15)',
                background:  survey === opt ? '#F5A62322' : 'transparent',
                color:       survey === opt ? '#F5A623' : 'rgba(255,255,255,0.6)',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Positive token rating */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-white/50">what felt good? (optional)</p>
        <div className="flex gap-4">
          {RATING_TOKENS.map((t) => (
            <button
              key={t}
              onClick={() => toggleToken(t)}
              className="text-3xl transition active:scale-90"
              style={{ opacity: selectedTokens.includes(t) ? 1 : 0.35 }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={submit}
        disabled={!survey}
        className="rounded-full bg-amber-400 px-10 py-3 font-semibold text-black disabled:opacity-30"
      >
        done
      </button>

      {/* Report path — system action, separate from in-world vocabulary (§12) */}
      {!reported ? (
        <button onClick={report} className="text-xs text-white/20 hover:text-white/40">
          something went wrong
        </button>
      ) : (
        <p className="text-xs text-white/30">thanks — noted.</p>
      )}
    </main>
  );
}
