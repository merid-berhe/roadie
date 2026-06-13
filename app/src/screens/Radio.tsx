// v6.3 — the Radio as its own page: a listening hangout that scales to
// hundreds of songs. Paginated load-more, search, and a persistent
// now-playing bar so playback follows you down the list.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Archive, Mic, Pause, Play, Radio as RadioIcon,
  Search, Shuffle, SkipBack, SkipForward,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { CharacterFace, characterName } from '../components/CharacterFace';

const PAGE = 30;

type Song = {
  id: string;
  title: string | null;
  audio_url: string;
  contributor_glyphs: string[] | null;
  destinations: { name: string; country: string } | null;
  road: string | null;
  created_at: string;
  recipe: { vocals?: boolean; brief?: string } | null;
};

export default function Radio({ onBack, onGlovebox }: { onBack: () => void; onGlovebox: () => void }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(''); // debounced

  // playback
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const songsRef = useRef<Song[]>([]);
  songsRef.current = songs;

  // debounce the search box
  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // (re)load page 0 whenever the search term changes
  const load = useCallback(async (from: number, replace: boolean) => {
    if (!supabase) { setLoading(false); return; }
    let q = supabase
      .from('songs')
      .select('id, title, audio_url, contributor_glyphs, road, created_at, recipe, destinations(name, country)')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (search) q = q.ilike('title', `%${search}%`);
    const { data, error } = await q;
    if (error) console.warn('[radio]', error.message);
    const rows = (data as unknown as Song[]) ?? [];
    setSongs((prev) => (replace ? rows : [...prev, ...rows]));
    setHasMore(rows.length === PAGE);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    load(0, true).finally(() => setLoading(false));
  }, [load]);

  async function loadMore() {
    setLoadingMore(true);
    await load(songs.length, false);
    setLoadingMore(false);
  }

  // playback engine — one audio element; the now-playing bar drives it
  const playSong = useCallback((song: Song) => {
    audioRef.current?.pause();
    const audio = new Audio(song.audio_url);
    audio.onended = () => {
      const list = songsRef.current;
      const i = list.findIndex((s) => s.id === song.id);
      const next = list[i + 1];
      if (next) playSong(next);
      else { setIsPlaying(false); setCurrentId(null); }
    };
    audio.ontimeupdate = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    audioRef.current = audio;
    setCurrentId(song.id);
    track('radio_played', { song_id: song.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(song: Song) {
    if (currentId === song.id && audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
      else { audioRef.current.play(); setIsPlaying(true); }
      return;
    }
    playSong(song);
  }

  function toggleCurrent() {
    const cur = songs.find((s) => s.id === currentId);
    if (cur) toggle(cur);
    else if (songs[0]) playSong(songs[0]);
  }

  function step(delta: number) {
    const i = songs.findIndex((s) => s.id === currentId);
    const next = songs[i + delta];
    if (next) playSong(next);
  }

  function shuffle() {
    if (!songs.length) return;
    playSong(songs[Math.floor(Math.random() * songs.length)]);
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  }

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const current = songs.find((s) => s.id === currentId) ?? null;

  return (
    <main className="min-h-full bg-cream pb-32">
      {/* top bar */}
      <div className="sticky top-0 z-30 border-b border-ink/5 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-ink-soft shadow-card transition hover:text-ink"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="flex flex-1 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal/12 text-teal">
              <RadioIcon size={17} />
            </span>
            <div>
              <p className="font-display text-lg font-semibold leading-none text-ink">The Radio</p>
              <p className="text-xs text-ink-soft">every song made by two people on one ride</p>
            </div>
          </div>
          <button
            onClick={onGlovebox}
            className="flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink shadow-card transition hover:-translate-y-0.5"
          >
            <Archive size={15} className="text-sunset" />
            <span className="hidden sm:inline">glovebox</span>
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5">
        {/* search + shuffle */}
        <div className="mt-6 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search by song name…"
              className="w-full rounded-full border-2 border-ink/10 bg-paper py-2.5 pl-9 pr-4 text-sm text-ink shadow-card placeholder:text-ink-faint focus:border-sunset/60 focus:outline-none"
            />
          </div>
          <button
            onClick={shuffle}
            disabled={!songs.length}
            className="flex items-center gap-1.5 rounded-full bg-sunset px-5 py-2.5 text-sm font-display font-semibold text-paper shadow-warm transition hover:bg-sunset-deep disabled:opacity-40"
          >
            <Shuffle size={15} />
            <span className="hidden sm:inline">shuffle</span>
          </button>
        </div>

        {/* list */}
        <div className="mt-5 flex flex-col gap-1.5">
          {loading && <p className="py-6 text-center text-sm text-ink-faint">tuning…</p>}
          {!loading && !supabase && (
            <p className="py-6 text-center text-sm text-ink-faint">the radio needs Supabase keys (app/.env.local)</p>
          )}
          {!loading && supabase && songs.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-faint">
              {search ? `no songs match “${search}”` : 'silence so far — be the first two on the air'}
            </p>
          )}

          {songs.map((song) => {
            const on = currentId === song.id;
            const place = song.destinations
              ? `${song.destinations.name}, ${song.destinations.country}`
              : song.road ?? 'the road';
            return (
              <button
                key={song.id}
                onClick={() => toggle(song)}
                className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                  on ? 'bg-sunset/10 ring-1 ring-sunset/30' : 'bg-paper shadow-card hover:-translate-y-0.5'
                }`}
              >
                <span
                  className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition ${
                    on && isPlaying ? 'bg-sunset text-paper' : 'bg-sunset/12 text-sunset group-hover:bg-sunset/20'
                  }`}
                >
                  {on && isPlaying ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-display text-base font-semibold text-ink">
                    {song.title ?? 'untitled'}
                    {song.recipe?.vocals && <Mic size={13} className="flex-shrink-0 text-teal" />}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {(song.contributor_glyphs ?? []).map((c) => characterName(c) ?? c).join(' + ') || 'two riders'} · {place} ·{' '}
                    {new Date(song.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-shrink-0 -space-x-2">
                  {(song.contributor_glyphs ?? []).slice(0, 2).map((c, i) => (
                    <CharacterFace key={i} id={c} size={30} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {!loading && hasMore && songs.length > 0 && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-full border-2 border-ink/12 bg-paper px-6 py-2.5 text-sm font-display font-semibold text-ink shadow-card transition hover:border-sunset/60 disabled:opacity-50"
            >
              {loadingMore ? 'loading…' : 'load more'}
            </button>
          </div>
        )}
      </div>

      {/* persistent now-playing bar — the hangout's heartbeat */}
      {current && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink/8 bg-paper/95 backdrop-blur-md">
          <div
            onClick={seek}
            className="group h-1.5 w-full cursor-pointer bg-ink/8"
            title="seek"
          >
            <div className="h-full bg-sunset transition-[width]" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
            <div className="flex flex-shrink-0 -space-x-2">
              {(current.contributor_glyphs ?? []).slice(0, 2).map((c, i) => (
                <CharacterFace key={i} id={c} size={36} />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-display text-sm font-semibold text-ink">
                {current.title ?? 'untitled'}
                {current.recipe?.vocals && <Mic size={12} className="flex-shrink-0 text-teal" />}
              </p>
              <p className="truncate text-xs text-ink-soft">
                {(current.contributor_glyphs ?? []).map((c) => characterName(c) ?? c).join(' + ') || 'two riders'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => step(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink">
                <SkipBack size={18} />
              </button>
              <button
                onClick={toggleCurrent}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-sunset text-paper shadow-warm transition hover:bg-sunset-deep"
              >
                {isPlaying ? <Pause size={19} /> : <Play size={19} className="ml-0.5" />}
              </button>
              <button onClick={() => step(1)} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink">
                <SkipForward size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
