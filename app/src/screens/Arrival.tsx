import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';

type Props = { onDone: (songId: string | null) => void };

export default function Arrival({ onDone }: Props) {
  const userId    = useSession((s) => s.userId);
  const riders    = useRoom((s) => s.riders);
  const recipe    = useRoom((s) => s.recipe);
  const audioUrl  = useRoom((s) => s.audioUrl);
  const destination = useRoom((s) => s.destination);
  const send      = useRoom((s) => s.send);
  const peerNameWord = useRoom((s) => s.peerNameWord);

  const [ownWord, setOwnWord]   = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving]     = useState(false);

  const driver    = riders.find((r) => r.role === 'driver');
  const passenger = riders.find((r) => r.role === 'passenger');

  const bothWords = submitted && peerNameWord;
  const title     = bothWords ? `${ownWord} ${peerNameWord}`.trim() : null;

  async function submitWord() {
    if (!ownWord.trim() || submitted) return;
    const word = ownWord.trim();
    setSubmitted(true);
    send({ t: 'name', word });
    track('song_named');
  }

  async function saveToGlovebox() {
    if (!title || saving || !supabase || !userId || !recipe || !audioUrl) return;
    setSaving(true);

    const glyphs = [driver?.glyph, passenger?.glyph].filter(Boolean) as string[];
    const { data: song, error } = await supabase
      .from('songs')
      .insert({
        audio_url: audioUrl,
        title,
        recipe,
        contributor_glyphs: glyphs,
        road: destination?.theme ?? 'coast',
        destination_id: destination?.id ?? null,
      })
      .select('id')
      .single();

    if (error || !song) { setSaving(false); onDone(null); return; }

    if (destination) {
      const { error: treasureError } = await supabase.from('treasures').insert({
        song_id: song.id,
        destination_id: destination.id,
        title,
        lat: destination.lat,
        lon: destination.lon,
        contributor_glyphs: glyphs,
        recipe,
        fact_snapshot: destination.fact,
        source_title_snapshot: destination.factSourceTitle,
        source_url_snapshot: destination.factSourceUrl,
      });
      if (treasureError) {
        console.warn('[treasure]', treasureError.message);
        track('treasure_failed', { song_id: song.id, destination_id: destination.id, reason: treasureError.message });
      } else {
        track('treasure_dropped', { song_id: song.id, destination_id: destination.id });
      }
    }

    // Add a glovebox entry for each rider (both userIds stored in the ride row — best effort here)
    await supabase.from('glovebox_entries').insert({ user_id: userId, song_id: song.id });

    track('song_saved', { title, song_id: song.id, destination_id: destination?.id });
    onDone(song.id);
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 bg-[#0b1020] px-6 text-center text-white">
      <p className="text-sm uppercase tracking-widest text-white/40">you've arrived</p>

      {destination && (
        <div className="max-w-sm">
          <p className="text-2xl font-semibold">{destination.name}</p>
          <p className="mt-1 text-sm text-white/45">{destination.region}, {destination.country}</p>
          <p className="mt-4 text-sm leading-6 text-white/65">{destination.fact}</p>
        </div>
      )}

      {/* Attribution — §5: "we made this together" legible after the fact */}
      {recipe && (
        <div className="flex flex-col gap-1 text-center text-sm">
          {driver && (
            <p style={{ color: driver.color }}>
              {driver.glyph} {recipe.driver.text ? `“${recipe.driver.text}”` : `brought the ${recipe.driver.seed} mood`}
            </p>
          )}
          {passenger && (
            <p style={{ color: passenger.color }}>
              {passenger.glyph} {recipe.passenger.text ? `“${recipe.passenger.text}”` : `brought the ${recipe.passenger.seed} mood`}
            </p>
          )}
        </div>
      )}

      {/* Co-naming */}
      {!submitted ? (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <p className="text-sm text-white/60">add one word to name your song</p>
          <input
            className="rounded-lg bg-white/10 px-4 py-3 text-center text-white placeholder-white/30 outline-none focus:bg-white/15"
            placeholder="one word…"
            value={ownWord}
            maxLength={20}
            onChange={(e) => setOwnWord(e.target.value.replace(/\s/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submitWord()}
          />
          <button
            onClick={submitWord}
            disabled={!ownWord.trim()}
            className="rounded-full bg-amber-400 py-3 font-semibold text-black disabled:opacity-30"
          >
            submit
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <p className="text-white/50 text-sm">your word: <span className="text-white">{ownWord}</span></p>
          {peerNameWord
            ? <p className="text-white/50 text-sm">co-rider's word: <span className="text-white">{peerNameWord}</span></p>
            : <p className="text-white/40 text-xs">waiting for co-rider's word…</p>
          }
        </div>
      )}

      {/* Title + save */}
      {title && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-2xl font-semibold">"{title}"</p>
          <button
            onClick={saveToGlovebox}
            disabled={saving || !supabase}
            className="rounded-full bg-amber-400 px-8 py-3 font-semibold text-black disabled:opacity-30"
          >
            {saving ? 'saving…' : supabase ? 'save to glovebox' : 'save (needs Supabase keys)'}
          </button>
          {!supabase && (
            <p className="text-xs text-white/30">add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to app/.env.local</p>
          )}
        </div>
      )}
    </main>
  );
}
