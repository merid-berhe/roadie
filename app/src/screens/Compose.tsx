import { useState } from 'react';
import {
  DRIVER_OPTIONS,
  MOOD_WORDS,
  PASSENGER_OPTIONS,
  type DriverChoices,
  type PassengerChoices,
} from '@roadie/shared';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';

type AnyChoices = Partial<DriverChoices & PassengerChoices>;

export default function Compose() {
  const identity = useSession((s) => s.identity);
  const you = useRoom((s) => s.you);
  const riders = useRoom((s) => s.riders);
  const seeded = useRoom((s) => s.seeded);
  const readyRoles = useRoom((s) => s.readyRoles);
  const peerChoices = useRoom((s) => s.peerChoices);
  const send = useRoom((s) => s.send);

  const [ownSeed, setOwnSeed] = useState<string | null>(null);
  const [ownChoices, setOwnChoices] = useState<AnyChoices>({});
  const [isReady, setIsReady] = useState(false);

  const peer = riders.find((r) => r.role !== you);
  const peerSeed = peerChoices['seed'] ?? null;
  const peerSeeded = you ? seeded.includes(you === 'driver' ? 'passenger' : 'driver') : false;
  const peerReady = you ? readyRoles.includes(you === 'driver' ? 'passenger' : 'driver') : false;

  const options = you === 'driver' ? DRIVER_OPTIONS : PASSENGER_OPTIONS;
  const peerOptions = you === 'driver' ? PASSENGER_OPTIONS : DRIVER_OPTIONS;
  const optionKeys = Object.keys(options) as Array<keyof typeof options>;
  const peerOptionKeys = Object.keys(peerOptions) as Array<keyof typeof peerOptions>;

  const allOwnChosen =
    ownSeed !== null && optionKeys.every((k) => ownChoices[k as keyof AnyChoices] !== undefined);

  function pickSeed(word: string) {
    setOwnSeed(word);
    send({ t: 'seed', word });
  }

  function pickChoice(field: string, value: string) {
    setOwnChoices((prev) => ({ ...prev, [field]: value }));
    send({ t: 'choice', field, value });
  }

  function goReady() {
    if (!allOwnChosen || isReady) return;
    setIsReady(true);
    send({ t: 'ready' });
  }

  const roleLabel = you === 'driver' ? 'DRIVER — THE FOUNDATION' : 'PASSENGER — THE COLOR';
  const peerRoleLabel = you === 'driver' ? "CO-RIDER'S COLOR" : "CO-RIDER'S FOUNDATION";

  return (
    <main className="flex min-h-full flex-col bg-[#0b1020] px-5 pb-32 pt-8 text-white">
      {/* Header */}
      <div className="mb-6 text-center">
        <p className="text-xs uppercase tracking-widest text-white/40">making your song</p>
        <div className="mt-3 flex items-center justify-center gap-6">
          <span className="text-4xl" style={{ color: identity?.color }}>{identity?.glyph}</span>
          <span className="text-sm text-white/30">+</span>
          <span className="text-4xl" style={{ color: peer?.color ?? '#374151' }}>{peer?.glyph ?? '○'}</span>
        </div>
      </div>

      {/* Mood seed */}
      <Section title="PICK A MOOD">
        <div className="grid grid-cols-2 gap-2">
          {MOOD_WORDS.map((word) => (
            <ChoiceButton
              key={word}
              label={word}
              selected={ownSeed === word}
              color={identity?.color}
              onSelect={() => pickSeed(word)}
            />
          ))}
        </div>
        {peerSeed && (
          <PeerPick glyph={peer?.glyph} color={peer?.color} field="mood" value={peerSeed} />
        )}
        {!peerSeeded && !peerSeed && (
          <p className="mt-2 text-xs text-white/30">waiting for co-rider's mood…</p>
        )}
      </Section>

      {/* Own role choices */}
      <Section title={roleLabel}>
        {optionKeys.map((field) => (
          <div key={field} className="mb-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-white/40">{(field as string).replace('_', ' ')}</p>
            <div className="flex gap-2">
              {(options[field as keyof typeof options] as readonly string[]).map((val) => (
                <ChoiceButton
                  key={val}
                  label={val}
                  selected={ownChoices[field as keyof AnyChoices] === val}
                  color={identity?.color}
                  onSelect={() => pickChoice(field, val)}
                />
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* Peer's choices (read-only, appear as they land) */}
      {peerOptionKeys.some((k) => peerChoices[k] !== undefined) && (
        <Section title={peerRoleLabel}>
          {peerOptionKeys.map((field) => {
            const val = peerChoices[field as string];
            if (!val) return null;
            return (
              <div key={field as string} className="mb-2">
                <p className="text-xs uppercase tracking-wider text-white/30">{(field as string).replace('_', ' ')}</p>
                <PeerPick glyph={peer?.glyph} color={peer?.color} field="" value={val} />
              </div>
            );
          })}
        </Section>
      )}

      {/* Peer readiness */}
      {peerReady && (
        <p className="mb-4 text-center text-sm text-emerald-400">
          {peer?.glyph} co-rider is ready to drive
        </p>
      )}

      {/* Let's drive */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-5">
        <button
          onClick={goReady}
          disabled={!allOwnChosen || isReady}
          className="w-full max-w-xs rounded-full bg-amber-400 py-4 text-lg font-semibold text-black transition active:scale-95 disabled:opacity-30"
        >
          {isReady ? 'waiting for co-rider…' : "Let's drive"}
        </button>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/50">{title}</p>
      {children}
    </div>
  );
}

function ChoiceButton({
  label, selected, color, onSelect,
}: {
  label: string; selected: boolean; color?: string; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex-1 rounded-lg border px-2 py-3 text-sm transition active:scale-95"
      style={{
        borderColor: selected ? (color ?? '#F5A623') : 'rgba(255,255,255,0.12)',
        background: selected ? `${(color ?? '#F5A623')}22` : 'transparent',
        color: selected ? (color ?? '#F5A623') : 'rgba(255,255,255,0.6)',
        fontWeight: selected ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function PeerPick({ glyph, color, field: _field, value }: { glyph?: string; color?: string; field: string; value: string }) {
  return (
    <p className="mt-1 text-xs" style={{ color: color ?? '#1FB6C4' }}>
      {glyph} picked <span className="font-semibold">{value}</span>
    </p>
  );
}
