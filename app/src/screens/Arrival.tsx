import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { characterName } from '../components/CharacterFace';
import { Button, RoadDivider, SignLabel } from '../components/ui';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';

type Props = { onDone: (songId: string | null) => void };

// v6.0 — arrival is a postcard from the destination, co-signed by both riders.
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

    // v5.4: contributor column stores roster character ids (legacy rows hold glyphs)
    const glyphs = [driver?.character ?? driver?.glyph, passenger?.character ?? passenger?.glyph].filter(Boolean) as string[];

    // Both riders save independently but converge on ONE song row — the track
    // file URL is the ride's natural key (unique index, v5.3).
    let songId: string | null = null;
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

    if (song) {
      songId = song.id;
    } else if (error) {
      // unique violation → the co-rider saved first; reuse their row
      const { data: existing } = await supabase
        .from('songs').select('id').eq('audio_url', audioUrl).single();
      songId = existing?.id ?? null;
    }
    if (!songId) { setSaving(false); onDone(null); return; }

    if (destination) {
      const { error: treasureError } = await supabase.from('treasures').insert({
        song_id: songId,
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
      if (treasureError && treasureError.code !== '23505') {
        // 23505 = the co-rider already dropped it — not a failure
        console.warn('[treasure]', treasureError.message);
        track('treasure_failed', { song_id: songId, destination_id: destination.id, reason: treasureError.message });
      } else if (!treasureError) {
        track('treasure_dropped', { song_id: songId, destination_id: destination.id });
      }
    }

    // Each rider files the shared song into their own glovebox
    await supabase
      .from('glovebox_entries')
      .upsert({ user_id: userId, song_id: songId }, { onConflict: 'user_id,song_id', ignoreDuplicates: true });

    track('song_saved', { title, song_id: songId, destination_id: destination?.id });
    onDone(songId);
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-7 bg-cream px-6 py-10 text-center">
      <SignLabel>you've arrived</SignLabel>

      {/* The postcard */}
      {destination && (
        <div className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-paper px-6 py-6 text-left shadow-card">
          <span className="absolute right-4 top-4 flex h-11 w-11 rotate-3 items-center justify-center rounded-md border-2 border-dashed border-sunset/50 text-sunset">
            <MapPin size={18} />
          </span>
          <p className="pr-14 font-display text-2xl font-semibold text-ink">{destination.name}</p>
          <p className="mt-0.5 text-sm text-ink-soft">{destination.region}, {destination.country}</p>
          <RoadDivider className="my-4 max-w-[120px]" />
          <p className="text-sm leading-6 text-ink-soft">{destination.fact}</p>
        </div>
      )}

      {/* Attribution — §5: "we made this together" legible after the fact */}
      {recipe && (
        <div className="flex flex-col gap-1 text-center text-sm font-semibold">
          {driver && (
            <p style={{ color: driver.color }}>
              {characterName(driver.character) ?? driver.glyph} {recipe.driver.text ? `“${recipe.driver.text}”` : `brought the ${recipe.driver.instrument}`}
            </p>
          )}
          {passenger && (
            <p style={{ color: passenger.color }}>
              {characterName(passenger.character) ?? passenger.glyph} {recipe.passenger.text ? `“${recipe.passenger.text}”` : `brought the ${recipe.passenger.instrument}`}
            </p>
          )}
        </div>
      )}

      {/* Co-naming */}
      {!submitted ? (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <p className="text-sm text-ink-soft">add one word to name your song</p>
          <input
            className="rounded-xl border-2 border-ink/10 bg-paper px-4 py-3 text-center text-ink shadow-card placeholder:text-ink-faint focus:border-sunset/60 focus:outline-none"
            placeholder="one word…"
            value={ownWord}
            maxLength={20}
            onChange={(e) => setOwnWord(e.target.value.replace(/\s/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submitWord()}
          />
          <Button onClick={submitWord} disabled={!ownWord.trim()} className="py-3">
            submit
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-ink-soft">your word: <span className="font-semibold text-ink">{ownWord}</span></p>
          {peerNameWord
            ? <p className="text-sm text-ink-soft">co-rider's word: <span className="font-semibold text-ink">{peerNameWord}</span></p>
            : <p className="text-xs text-ink-faint">waiting for co-rider's word…</p>
          }
        </div>
      )}

      {/* Title + save */}
      {title && (
        <div className="flex flex-col items-center gap-4">
          <p className="font-display text-3xl font-semibold text-ink">"{title}"</p>
          <Button onClick={saveToGlovebox} disabled={saving || !supabase} className="px-8 py-3">
            {saving ? 'saving…' : supabase ? 'save to glovebox' : 'save (needs Supabase keys)'}
          </Button>
          {!supabase && (
            <p className="text-xs text-ink-faint">add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to app/.env.local</p>
          )}
        </div>
      )}
    </main>
  );
}
