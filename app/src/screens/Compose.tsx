import { useEffect, useState } from 'react';
import {
  INSTRUMENTS,
  PROMPT_EXAMPLES,
  PROMPT_MAX_CHARS,
  PROMPT_MAX_TRIES,
} from '@roadie/shared';
import { CharacterFace, characterName } from '../components/CharacterFace';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';
import { track } from '../lib/analytics';

// §5 v5.0 — prompt-first composition: a mood word each (drives the visuals,
// guarantees a valid song with zero typing) + an optional free-text prompt.
// fal is the arbiter of interpretation; the gate only moderates.
export default function Compose() {
  const identity = useSession((s) => s.identity);
  const you = useRoom((s) => s.you);
  const riders = useRoom((s) => s.riders);
  const instruments = useRoom((s) => s.instruments);
  const readyRoles = useRoom((s) => s.readyRoles);
  const destination = useRoom((s) => s.destination);
  const peerChoices = useRoom((s) => s.peerChoices);
  const promptCards = useRoom((s) => s.promptCards);
  const promptRejectedAt = useRoom((s) => s.promptRejectedAt);
  const vocalsVotes = useRoom((s) => s.vocalsVotes);
  const send = useRoom((s) => s.send);

  const [ownInstrument, setOwnInstrument] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [promptTries, setPromptTries] = useState(0);
  const [promptPending, setPromptPending] = useState(false);
  const [promptFailed, setPromptFailed] = useState(false);
  const [ownVocals, setOwnVocals] = useState(false);
  const [promptExample] = useState(() => PROMPT_EXAMPLES[Math.floor(Math.random() * PROMPT_EXAMPLES.length)]);

  const peer = riders.find((r) => r.role !== you);
  const me = riders.find((r) => r.role === you);
  const peerRole = you === 'driver' ? 'passenger' : 'driver';
  const peerName = characterName(peer?.character) ?? 'your co-rider';
  const peerInstrument = peerChoices['instrument'] ?? null;
  const peerPicked = you ? instruments.includes(peerRole) : false;
  const peerReady = you ? readyRoles.includes(peerRole) : false;
  const ownCard = you ? promptCards[you] : undefined;
  const peerCard = you ? promptCards[peerRole] : undefined;
  const peerWantsVocals = vocalsVotes.includes(peerRole);
  const bothVocals = vocalsVotes.length === 2;

  useEffect(() => {
    if (!ownCard) return;
    setPromptPending(false);
    setPromptFailed(false);
    track('prompt_accepted', { display: ownCard.display });
  }, [ownCard]);

  useEffect(() => {
    if (promptRejectedAt === 0) return;
    setPromptPending(false);
    setPromptFailed(true);
    track('prompt_rejected');
  }, [promptRejectedAt]);

  function pickInstrument(name: string) {
    setOwnInstrument(name);
    send({ t: 'instrument', name });
  }

  function submitPrompt() {
    const text = promptText.trim();
    if (!text || promptPending || promptTries >= PROMPT_MAX_TRIES) return;
    setPromptTries((n) => n + 1);
    setPromptPending(true);
    setPromptFailed(false);
    send({ t: 'prompt', text });
    track('prompt_submitted');
  }

  function toggleVocals() {
    const next = !ownVocals;
    setOwnVocals(next);
    send({ t: 'vocals', on: next });
    track('vocals_voted', { on: next });
  }

  function goReady() {
    if (!ownInstrument || isReady) return;
    setIsReady(true);
    send({ t: 'ready' });
  }

  const charsLeft = PROMPT_MAX_CHARS - promptText.length;

  return (
    <main className="flex min-h-full flex-col bg-[#0b1020] px-5 pb-32 pt-8 text-white">
      {/* Header */}
      <div className="mb-6 text-center">
        <p className="text-xs uppercase tracking-widest text-white/40">making your song</p>
        <div className="mt-3 flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <CharacterFace id={me?.character} color={identity?.color} size={56} />
            <p className="text-xs text-white/45">{characterName(me?.character) ?? 'you'}</p>
          </div>
          <span className="text-sm text-white/30">+</span>
          <div className="flex flex-col items-center gap-1">
            <CharacterFace id={peer?.character} color={peer?.color} size={56} />
            <p className="text-xs text-white/45">{peer ? peerName : 'waiting…'}</p>
          </div>
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

      {/* Featured instrument — the required tap */}
      <Section title="PICK YOUR INSTRUMENT">
        <div className="grid grid-cols-2 gap-2">
          {INSTRUMENTS.map((name) => (
            <ChoiceButton
              key={name}
              label={name}
              selected={ownInstrument === name}
              color={identity?.color}
              onSelect={() => pickInstrument(name)}
            />
          ))}
        </div>
        {peerInstrument && (
          <p className="mt-2 text-xs" style={{ color: peer?.color ?? '#1FB6C4' }}>
            {peerName} brings the <span className="font-semibold">{peerInstrument}</span>
          </p>
        )}
        {!peerPicked && !peerInstrument && (
          <p className="mt-2 text-xs text-white/30">waiting for co-rider's instrument…</p>
        )}
      </Section>

      {/* Direction paragraph — the heart of the song */}
      <Section title="WRITE THE SONG">
        <p className="mb-2 text-xs text-white/35">
          describe the mood and lyrical direction for your song — the studio blends both riders' directions into one track
        </p>
        {ownCard && (
          <div className="mb-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="text-xs" style={{ color: identity?.color }}>
              you wrote <span className="font-semibold">{ownCard.display}</span>
            </p>
          </div>
        )}
        {(!ownCard || promptTries < PROMPT_MAX_TRIES) && (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <textarea
                value={promptText}
                maxLength={PROMPT_MAX_CHARS}
                rows={3}
                placeholder={`e.g. ${promptExample}`}
                onChange={(e) => setPromptText(e.target.value)}
                disabled={promptPending || promptTries >= PROMPT_MAX_TRIES}
                className="w-full resize-none rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 pb-6 text-sm leading-5 text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none disabled:opacity-50"
              />
              <span
                className="pointer-events-none absolute bottom-2 right-3 text-xs tabular-nums"
                style={{ color: charsLeft <= 15 ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}
              >
                {charsLeft}
              </span>
            </div>
            <button
              onClick={submitPrompt}
              disabled={!promptText.trim() || promptPending || promptTries >= PROMPT_MAX_TRIES}
              className="self-end rounded-lg border border-white/12 px-4 py-2 text-sm text-white/70 transition active:scale-95 disabled:opacity-40"
            >
              {promptPending ? 'sending…' : ownCard ? 'rewrite' : 'send it'}
            </button>
          </div>
        )}
        {promptFailed && (
          <p className="mt-2 text-xs text-amber-400/80">
            the studio couldn't take that one. try different words?
          </p>
        )}
        {peerCard && (
          <p className="mt-2 text-xs" style={{ color: peer?.color ?? '#1FB6C4' }}>
            {peerName} wrote <span className="font-semibold">{peerCard.display}</span>
          </p>
        )}
      </Section>

      {/* Vocals — both must opt in (§12) */}
      <Section title="VOICE">
        <div className="flex gap-2">
          <ChoiceButton label="🎻 instrumental" selected={!ownVocals} color={identity?.color} onSelect={() => { if (ownVocals) toggleVocals(); }} />
          <ChoiceButton label="🎤 sung" selected={ownVocals} color={identity?.color} onSelect={() => { if (!ownVocals) toggleVocals(); }} />
        </div>
        <p className="mt-2 text-xs text-white/30">
          {bothVocals
            ? '🎤 you both want vocals — this song will sing'
            : peerWantsVocals
            ? `${peerName} wants vocals — pick 🎤 to agree`
            : ownVocals
            ? `waiting for ${peerName} to agree to vocals`
            : 'songs stay instrumental unless you both pick 🎤'}
        </p>
      </Section>

      {/* Peer readiness */}
      {peerReady && (
        <p className="mb-4 text-center text-sm text-emerald-400">
          {peerName} is ready to drive
        </p>
      )}

      {/* Let's drive */}
      <div className="fixed bottom-6 left-0 right-0 flex flex-col items-center gap-2 px-5">
        {!ownInstrument && <p className="text-xs text-white/40">still need: your instrument</p>}
        <button
          onClick={goReady}
          disabled={isReady}
          className="w-full max-w-xs rounded-full py-4 text-lg font-semibold transition active:scale-95"
          style={{
            background: ownInstrument ? '#F5A623' : 'rgba(255,255,255,0.1)',
            color: ownInstrument ? '#000' : 'rgba(255,255,255,0.3)',
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
