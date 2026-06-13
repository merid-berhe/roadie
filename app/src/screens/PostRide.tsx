// Post-ride: rating tokens + the one validation question (§13) + report path.
import { useState } from 'react';
import { Car, Music2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { Button } from '../components/ui';
import { useSession } from '../state/session';

const RATING_TOKENS = [
  { id: 'spark', icon: Sparkles, label: 'the spark' },
  { id: 'song', icon: Music2, label: 'the song' },
  { id: 'ride', icon: Car, label: 'the ride' },
] as const;
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
      <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-cream px-6 text-center">
        <p className="font-display text-2xl font-semibold text-ink">thanks for the ride</p>
        {songId && (
          <Button onClick={onGlovebox} className="px-8 py-3">
            open glovebox
          </Button>
        )}
        <button onClick={onNewRide} className="text-sm text-ink-soft underline-offset-2 hover:text-ink">
          new ride
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-9 bg-cream px-6 text-center">
      {/* The one validation question — §13 */}
      <div className="flex w-full max-w-sm flex-col gap-4">
        <p className="text-base font-semibold text-ink">did it feel like you made that song <em>together</em>?</p>
        <div className="flex gap-2">
          {SURVEY_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setSurvey(opt)}
              className="flex-1 rounded-xl border-2 bg-paper py-3 text-sm shadow-card transition active:scale-95"
              style={{
                borderColor: survey === opt ? '#C23A2B' : 'rgba(27,42,51,0.10)',
                background:  survey === opt ? '#C23A2B1A' : undefined,
                color:       survey === opt ? '#9E2D20' : '#45575F',
                fontWeight:  survey === opt ? 700 : 500,
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Positive token rating */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-ink-soft">what felt good? (optional)</p>
        <div className="flex gap-3">
          {RATING_TOKENS.map(({ id, icon: Icon, label }) => {
            const on = selectedTokens.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggleToken(id)}
                className="flex flex-col items-center gap-1.5 rounded-xl border-2 bg-paper px-4 py-3 shadow-card transition active:scale-90"
                style={{
                  borderColor: on ? '#E6B23E' : 'rgba(27,42,51,0.10)',
                  background: on ? '#E6B23E26' : undefined,
                }}
              >
                <Icon size={22} className={on ? 'text-sunset' : 'text-ink-faint'} />
                <span className={`text-xs ${on ? 'font-bold text-ink' : 'font-medium text-ink-soft'}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Button onClick={submit} disabled={!survey} className="px-10 py-3">
        done
      </Button>

      {/* Report path — system action, separate from in-world vocabulary (§12) */}
      {!reported ? (
        <button onClick={report} className="text-xs text-ink-faint hover:text-ink-soft">
          something went wrong
        </button>
      ) : (
        <p className="text-xs text-ink-soft">thanks — noted.</p>
      )}
    </main>
  );
}
