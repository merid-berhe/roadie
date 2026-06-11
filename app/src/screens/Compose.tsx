import { useEffect, useState } from 'react';
import {
  DRIVER_OPTIONS,
  MOOD_WORDS,
  PASSENGER_OPTIONS,
  WHISPER_EXAMPLES,
  WHISPER_MAX_CHARS,
  WHISPER_MAX_TRIES,
  type DriverChoices,
  type PassengerChoices,
} from '@roadie/shared';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';
import { track } from '../lib/analytics';

type AnyChoices = Partial<DriverChoices & PassengerChoices>;

export default function Compose() {
  const identity = useSession((s) => s.identity);
  const you = useRoom((s) => s.you);
  const riders = useRoom((s) => s.riders);
  const seeded = useRoom((s) => s.seeded);
  const readyRoles = useRoom((s) => s.readyRoles);
  const destination = useRoom((s) => s.destination);
  const peerChoices = useRoom((s) => s.peerChoices);
  const send = useRoom((s) => s.send);

  const whisperCards = useRoom((s) => s.whisperCards);
  const whisperRejectedAt = useRoom((s) => s.whisperRejectedAt);
  const radioLocked = useRoom((s) => s.radioLocked);

  const [ownSeed, setOwnSeed]     = useState<string | null>(null);
  const [ownChoices, setOwnChoices] = useState<AnyChoices>({});
  const [isReady, setIsReady]     = useState(false);
  const [whisperText, setWhisperText] = useState('');
  const [whisperTries, setWhisperTries] = useState(0);
  const [whisperPending, setWhisperPending] = useState(false);
  const [whisperExample] = useState(() => WHISPER_EXAMPLES[Math.floor(Math.random() * WHISPER_EXAMPLES.length)]);

  const [whisperFailed, setWhisperFailed] = useState(false);

  const ownCard = you ? whisperCards[you] : undefined;
  const peerCard = you ? whisperCards[you === 'driver' ? 'passenger' : 'driver'] : undefined;

  useEffect(() => {
    if (!ownCard) return;
    setWhisperPending(false);
    setWhisperFailed(false);
    track('whisper_tuned', { style: ownCard.style });
  }, [ownCard]);

  useEffect(() => {
    if (whisperRejectedAt === 0) return;
    setWhisperPending(false);
    setWhisperFailed(true);
    track('whisper_rejected');
  }, [whisperRejectedAt]);

  function submitWhisper() {
    const text = whisperText.trim();
    if (!text || whisperPending || whisperTries >= WHISPER_MAX_TRIES) return;
    setWhisperTries((n) => n + 1);
    setWhisperPending(true);
    setWhisperFailed(false);
    send({ t: 'whisper', text });
    track('whisper_submitted');
  }

  const peer = riders.find((r) => r.role !== you);
  const peerSeed = peerChoices['seed'] ?? null;
  const peerSeeded = you ? seeded.includes(you === 'driver' ? 'passenger' : 'driver') : false;
  const peerReady = you ? readyRoles.includes(you === 'driver' ? 'passenger' : 'driver') : false;

  const options = you === 'driver' ? DRIVER_OPTIONS : PASSENGER_OPTIONS;
  const peerOptions = you === 'driver' ? PASSENGER_OPTIONS : DRIVER_OPTIONS;
  const optionKeys = Object.keys(options) as Array<keyof typeof options>;
  const peerOptionKeys = Object.keys(peerOptions) as Array<keyof typeof peerOptions>;

  const missingItems: string[] = [];
  if (ownSeed === null) missingItems.push('a mood word');
  for (const k of optionKeys) {
    if (ownChoices[k as keyof AnyChoices] === undefined)
      missingItems.push((k as string).replace('_', ' '));
  }
  const allOwnChosen = missingItems.length === 0;

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

      {destination && (
        <Section title="TODAY'S DESTINATION">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
            <p className="text-lg font-semibold text-white">{destination.name}</p>
            <p className="text-sm text-white/45">{destination.region}, {destination.country}</p>
            <p className="mt-3 text-sm leading-6 text-white/65">{destination.fact}</p>
            <p className="mt-3 text-xs uppercase tracking-wider text-white/30">{destination.theme} road</p>
          </div>
        </Section>
      )}

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

      {/* §5a Tune the radio — optional free text, LLM-gated server-side */}
      <Section title="TUNE THE RADIO (OPTIONAL)">
        <p className="mb-2 text-xs text-white/35">
          whisper a vibe to the radio — it tunes your words into the song
        </p>
        {ownCard ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="text-xs" style={{ color: identity?.color }}>
              📻 tuned to: <span className="font-semibold">{ownCard.style}</span>
            </p>
          </div>
        ) : null}
        {radioLocked && (
          <p className="mt-2 text-xs text-white/35">📻 the radio's set — your song is already being recorded</p>
        )}
        {!radioLocked && (!ownCard || whisperTries < WHISPER_MAX_TRIES) ? (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={whisperText}
              maxLength={WHISPER_MAX_CHARS}
              placeholder={`e.g. ${whisperExample}`}
              onChange={(e) => setWhisperText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitWhisper(); }}
              disabled={whisperPending || whisperTries >= WHISPER_MAX_TRIES}
              className="min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={submitWhisper}
              disabled={!whisperText.trim() || whisperPending || whisperTries >= WHISPER_MAX_TRIES}
              className="rounded-lg border border-white/12 px-3 py-2 text-sm text-white/70 transition active:scale-95 disabled:opacity-40"
            >
              {whisperPending ? 'tuning…' : ownCard ? 're-tune' : 'tune in'}
            </button>
          </div>
        ) : null}
        {whisperFailed && !radioLocked && (
          <p className="mt-2 text-xs text-amber-400/80">
            static… the radio couldn't tune to that. try different words?
          </p>
        )}
        {whisperTries >= WHISPER_MAX_TRIES && !ownCard && (
          <p className="mt-2 text-xs text-white/30">the radio's had enough fiddling for one ride</p>
        )}
        {peerCard && (
          <p className="mt-2 text-xs" style={{ color: peer?.color ?? '#1FB6C4' }}>
            {peerCard.glyph} tuned the radio to <span className="font-semibold">{peerCard.style}</span>
          </p>
        )}
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
      <div className="fixed bottom-6 left-0 right-0 flex flex-col items-center gap-2 px-5">
        {!allOwnChosen && missingItems.length > 0 && (
          <p className="text-xs text-white/40">still need: {missingItems.join(', ')}</p>
        )}
        <button
          onClick={goReady}
          disabled={isReady}
          className="w-full max-w-xs rounded-full py-4 text-lg font-semibold transition active:scale-95"
          style={{
            background: allOwnChosen ? '#F5A623' : 'rgba(255,255,255,0.1)',
            color: allOwnChosen ? '#000' : 'rgba(255,255,255,0.3)',
          }}
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
