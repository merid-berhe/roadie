// v7.0 — the song is being pressed. No more car/dance "Meeting" (the ride is
// gone); a clean lounge wait showing what you two asked for, like a record being
// cut. (Phase 3: this becomes the actual bar interior with the synced playlist.)
import { useEffect } from 'react';
import { Disc3, Mic, Music2 } from 'lucide-react';
import { fadeBedIn, startBedSilent } from '../audio/bed';
import { characterName } from '../components/CharacterFace';
import { Glass } from '../components/ui';
import { useRoom } from '../state/room';

export default function Generating() {
  const riders = useRoom((s) => s.riders);
  const destination = useRoom((s) => s.destination);
  const recipe = useRoom((s) => s.recipe);

  useEffect(() => {
    startBedSilent();
    fadeBedIn(2); // the studio hums while the song presses
  }, []);

  const driver = riders.find((r) => r.role === 'driver');
  const passenger = riders.find((r) => r.role === 'passenger');

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-cream px-6 py-10 text-center">
      <div className="flex flex-col items-center gap-3">
        <Disc3 size={56} className="animate-spin text-sunset" style={{ animationDuration: '3s' }} />
        <p className="font-display text-xl font-semibold text-ink">pressing your song…</p>
        <p className="text-sm text-ink-soft">
          this takes a minute or two{destination ? ` · ${destination.name} Bar` : ''}
        </p>
      </div>

      {recipe && (
        <Glass className="max-w-md px-5 py-4 text-center">
          {recipe.driver.text && (
            <p className="text-sm font-semibold" style={{ color: driver?.color }}>
              {characterName(driver?.character) ?? driver?.glyph} “{recipe.driver.text}”
            </p>
          )}
          {recipe.passenger.text && (
            <p className="mt-1 text-sm font-semibold" style={{ color: passenger?.color }}>
              {characterName(passenger?.character) ?? passenger?.glyph} “{recipe.passenger.text}”
            </p>
          )}
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
            {recipe.driver.instrument} + {recipe.passenger.instrument}
            <span className="inline-flex items-center gap-1">
              · {recipe.vocals ? <Mic size={11} /> : <Music2 size={11} />} {recipe.vocals ? 'sung' : 'instrumental'}
            </span>
          </p>
          {recipe.brief && (
            <p className="mt-2 border-t border-ink/10 pt-2 text-xs italic text-ink-soft">
              the studio hears: {recipe.brief}
            </p>
          )}
          {recipe.lyrics && (
            <p className="mt-2 whitespace-pre-line border-t border-ink/10 pt-2 text-xs italic leading-5 text-ink-soft">
              {recipe.lyrics.split('\n').slice(0, 4).join('\n')}
              {recipe.lyrics.split('\n').length > 4 ? '\n…' : ''}
            </p>
          )}
        </Glass>
      )}

      <a href={location.pathname} className="text-xs text-ink-faint hover:text-ink-soft">exit</a>
    </main>
  );
}
