// §2: minimal glovebox — list saved songs, playable. Keyed by userId (§6).
// v6.0 — a shelf of cassettes, each one a ride you took.
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Pause, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { characterName } from '../components/CharacterFace';
import { SignLabel } from '../components/ui';
import { useSession } from '../state/session';

type Song = {
  id: string;
  title: string | null;
  audio_url: string;
  contributor_glyphs: string[] | null;
  destination_id: string | null;
  destinations: { name: string; country: string } | null;
  road: string | null;
  created_at: string;
  recipe: Record<string, unknown> | null;
};

export default function Glovebox({ onBack }: { onBack: () => void }) {
  const userId   = useSession((s) => s.userId);
  const identity = useSession((s) => s.identity);
  const [songs, setSongs]   = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!supabase || !userId) { setLoading(false); return; }
    supabase
      .from('glovebox_entries')
      .select('songs(*, destinations(name, country))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.warn('[glovebox]', error.message);
        setSongs((data ?? []).map((r: { songs: unknown }) => r.songs as Song));
        setLoading(false);
      });
  }, [userId]);

  function playSong(song: Song) {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playing === song.id) { setPlaying(null); return; }
    const audio = new Audio(song.audio_url);
    audio.play().catch(() => {});
    audio.onended = () => setPlaying(null);
    audioRef.current = audio;
    setPlaying(song.id);
    track('song_replayed', { song_id: song.id });
  }

  return (
    <main className="flex min-h-full flex-col bg-cream px-5 pb-16 pt-8">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-7 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-ink-soft shadow-card transition hover:text-ink"
          >
            <ArrowLeft size={17} />
          </button>
          <div>
            <SignLabel>glovebox</SignLabel>
            {identity && (
              <p className="mt-1 text-xs text-ink-faint">
                <span className="font-semibold" style={{ color: identity.color }}>{identity.colorName}</span> rider
              </p>
            )}
          </div>
        </div>

        {loading && <p className="text-sm text-ink-faint">loading…</p>}
        {!loading && !supabase && (
          <p className="text-sm text-ink-faint">Glovebox needs Supabase keys (see app/.env.local)</p>
        )}
        {!loading && supabase && songs.length === 0 && (
          <p className="text-sm text-ink-faint">no songs yet — finish a ride to save one</p>
        )}

        <div className="flex flex-col gap-3">
          {songs.map((song) => {
            const date = new Date(song.created_at).toLocaleDateString();
            const isPlaying = playing === song.id;
            const place = song.destinations
              ? `${song.destinations.name}, ${song.destinations.country}`
              : song.road ?? 'road';
            return (
              <button
                key={song.id}
                onClick={() => playSong(song)}
                className={`flex items-center gap-4 overflow-hidden rounded-2xl bg-paper py-3 pl-0 pr-4 text-left shadow-card transition hover:-translate-y-0.5 ${
                  isPlaying ? 'ring-2 ring-sunset' : ''
                }`}
              >
                {/* cassette spine */}
                <span className="h-12 w-1.5 flex-shrink-0 rounded-r-full bg-gold" />
                <span
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition ${
                    isPlaying ? 'bg-sunset text-paper' : 'bg-sunset/12 text-sunset'
                  }`}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold text-ink">{song.title ?? 'untitled'}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {(song.contributor_glyphs ?? []).map((c) => characterName(c) ?? c).join(' + ')} · {place} · {date}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
