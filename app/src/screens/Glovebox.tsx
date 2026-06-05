// §2: minimal glovebox — list saved songs, playable. Keyed by userId (§6).
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { useSession } from '../state/session';

type Song = {
  id: string;
  title: string | null;
  audio_url: string;
  contributor_glyphs: string[] | null;
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
      .select('songs(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
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
    <main className="flex min-h-full flex-col bg-[#0b1020] px-5 pt-8 text-white">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={onBack} className="text-white/40 hover:text-white/70">←</button>
        <div>
          <p className="text-sm uppercase tracking-widest text-white/40">glovebox</p>
          {identity && (
            <p className="text-xs text-white/30">
              <span style={{ color: identity.color }}>{identity.glyph}</span> {identity.colorName} rider
            </p>
          )}
        </div>
      </div>

      {loading && <p className="text-white/30 text-sm">loading…</p>}
      {!loading && !supabase && (
        <p className="text-white/30 text-sm">Glovebox needs Supabase keys (see app/.env.local)</p>
      )}
      {!loading && supabase && songs.length === 0 && (
        <p className="text-white/30 text-sm">no songs yet — finish a ride to save one</p>
      )}

      <div className="flex flex-col gap-4">
        {songs.map((song) => {
          const date = new Date(song.created_at).toLocaleDateString();
          const isPlaying = playing === song.id;
          return (
            <button
              key={song.id}
              onClick={() => playSong(song)}
              className="flex items-center gap-4 rounded-xl bg-white/5 px-4 py-3 text-left active:bg-white/10"
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg"
                style={{ background: isPlaying ? '#F5A62333' : 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                {isPlaying ? '⏸' : '▶'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{song.title ?? 'untitled'}</p>
                <p className="text-xs text-white/40">
                  {song.contributor_glyphs?.join(' + ')} · {song.road ?? 'coast'} · {date}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}
