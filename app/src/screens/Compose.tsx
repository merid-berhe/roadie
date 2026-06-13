import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Mic, Music2, Send, Sparkles } from 'lucide-react';
import {
  INSTRUMENTS,
  PROMPT_EXAMPLES,
  PROMPT_MAX_CHARS,
  PROMPT_MAX_TRIES,
} from '@roadie/shared';
import { CharacterFace, characterName } from '../components/CharacterFace';
import { Button, SignLabel } from '../components/ui';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';
import { track } from '../lib/analytics';

// §5 v5.6 — prompt-first composition: an instrument each (required) + a
// free-text direction each. fal is the arbiter of interpretation; the gate
// only moderates.
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
  const nudgeRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  const peer = riders.find((r) => r.role !== you);
  const me = riders.find((r) => r.role === you);
  const peerRole = you === 'driver' ? 'passenger' : 'driver';
  const peerName = characterName(peer?.character) ?? 'your co-rider';
  const peerInstrument = peerChoices['instrument'] ?? null;
  const peerPicked = you ? instruments.includes(peerRole) : false;
  const peerReady = you ? readyRoles.includes(peerRole) : false;
  // v5.9: authorship follows the CHARACTER, not the seat — roles can be
  // re-dealt on reconnect, but each card carries its author's character
  const allCards = [promptCards.driver, promptCards.passenger].filter(Boolean) as
    { glyph: string; display: string; character?: string }[];
  const ownCard = allCards.find((c) => c.character && me?.character && c.character === me.character)
    ?? (you ? promptCards[you] : undefined);
  const peerCard = allCards.find((c) => c !== ownCard);
  const peerCardName = characterName(peerCard?.character) ?? peerName;
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

  // §8 nudge — when the co-rider is ready, make it impossible to miss (GSAP):
  // the banner pops in and breathes, and the CTA glows to pull the eye to it.
  useEffect(() => {
    if (!peerReady) return;
    const tweens: gsap.core.Tween[] = [];
    if (nudgeRef.current) {
      gsap.fromTo(nudgeRef.current, { scale: 0.6, y: 18, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' });
      tweens.push(gsap.to(nudgeRef.current, { scale: 1.06, duration: 0.75, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 0.5 }));
    }
    if (ctaRef.current && !isReady) {
      tweens.push(gsap.to(ctaRef.current, { boxShadow: '0 0 0 6px rgba(194,58,43,0.26)', duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
    }
    return () => { tweens.forEach((t) => t.kill()); if (ctaRef.current) gsap.set(ctaRef.current, { clearProps: 'boxShadow' }); };
  }, [peerReady, isReady]);

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
    <main className="flex min-h-full flex-col bg-cream px-5 pb-44 pt-8">
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <div className="mb-7 text-center">
          <SignLabel>making your song</SignLabel>
          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <CharacterFace id={me?.character} color={identity?.color} size={56} />
              <p className="text-xs text-ink-soft">{characterName(me?.character) ?? 'you'}</p>
            </div>
            <span className="font-display text-ink-faint">+</span>
            <div className="flex flex-col items-center gap-1">
              <CharacterFace id={peer?.character} color={peer?.color} size={56} />
              <p className="text-xs text-ink-soft">{peer ? peerName : 'waiting…'}</p>
            </div>
          </div>
        </div>

        {destination && (
          <Section title="today's destination">
            <div className="rounded-2xl bg-paper px-4 py-4 text-left shadow-card">
              <p className="font-display text-lg font-semibold text-ink">{destination.name}</p>
              <p className="text-sm text-ink-soft">{destination.region}, {destination.country}</p>
              <p className="mt-3 text-sm leading-6 text-ink-soft">{destination.fact}</p>
              <p className="mt-3 font-display text-xs font-medium uppercase tracking-[0.18em] text-ink-faint">
                {destination.theme} road
              </p>
            </div>
          </Section>
        )}

        {/* Featured instrument — the required tap */}
        <Section title="pick your instrument">
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
            <p className="mt-2 text-xs font-semibold" style={{ color: peer?.color ?? '#1F7A74' }}>
              {peerName} brings the {peerInstrument}
            </p>
          )}
          {!peerPicked && !peerInstrument && (
            <p className="mt-2 text-xs text-ink-faint">waiting for co-rider's instrument…</p>
          )}
        </Section>

        {/* Direction paragraph — the heart of the song */}
        <Section title="write the song">
          <p className="mb-2 text-xs text-ink-soft">
            describe the mood and lyrical direction for your song — the studio blends both riders' directions into one track
          </p>
          {ownCard && (
            <div className="mb-2 rounded-xl bg-paper px-3 py-2 shadow-card">
              <p className="text-xs text-ink-soft">
                you wrote <span className="font-semibold" style={{ color: identity?.color }}>{ownCard.display}</span>
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
                  className="w-full resize-none rounded-xl border-2 border-ink/10 bg-paper px-3 py-2 pb-6 text-sm leading-5 text-ink shadow-card placeholder:text-ink-faint focus:border-sunset/60 focus:outline-none disabled:opacity-50"
                />
                <span
                  className="pointer-events-none absolute bottom-2.5 right-3 text-xs tabular-nums"
                  style={{ color: charsLeft <= 15 ? '#C23A2B' : '#8597A0' }}
                >
                  {charsLeft}
                </span>
              </div>
              <Button
                onClick={submitPrompt}
                disabled={!promptText.trim() || promptPending || promptTries >= PROMPT_MAX_TRIES}
                className="flex items-center justify-center gap-2 py-3"
              >
                <Send size={16} />
                {promptPending ? 'sharing…' : ownCard ? 'update your prompt' : 'share with your co-rider'}
              </Button>
              <p className="text-center text-xs text-ink-soft">
                {peerName} sees what you write — it's how you build the song together
              </p>
            </div>
          )}
          {promptFailed && (
            <p className="mt-2 text-xs text-sunset-deep">
              the studio couldn't take that one. try different words?
            </p>
          )}
          {peerCard && (
            <p className="mt-2 text-xs text-ink-soft">
              {peerCardName} wrote{' '}
              <span className="font-semibold" style={{ color: peer?.color ?? '#1F7A74' }}>{peerCard.display}</span>
            </p>
          )}
        </Section>

        {/* Vocals — both must opt in (§12) */}
        <Section title="voice">
          <div className="flex gap-2">
            <ChoiceButton
              label="instrumental"
              icon={<Music2 size={15} />}
              selected={!ownVocals}
              color={identity?.color}
              onSelect={() => { if (ownVocals) toggleVocals(); }}
            />
            <ChoiceButton
              label="sung"
              icon={<Mic size={15} />}
              selected={ownVocals}
              color={identity?.color}
              onSelect={() => { if (!ownVocals) toggleVocals(); }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {bothVocals
              ? 'you both want vocals — this song will sing'
              : peerWantsVocals
              ? `${peerName} wants vocals — pick sung to agree`
              : ownVocals
              ? `waiting for ${peerName} to agree to vocals`
              : 'songs stay instrumental unless you both pick sung'}
          </p>
        </Section>

      </div>

      {/* Let's ride */}
      <div className="fixed bottom-0 left-0 right-0 flex flex-col items-center gap-3 bg-gradient-to-t from-cream via-cream/90 to-transparent px-5 pb-6 pt-10">
        {peerReady && (
          <div
            ref={nudgeRef}
            className="flex items-center gap-2 rounded-full bg-teal px-5 py-2.5 font-display text-sm font-bold text-paper shadow-warm"
          >
            <Sparkles size={16} />
            {peerName} is ready — hit the road!
          </div>
        )}
        {!ownInstrument && <p className="text-xs text-ink-soft">still need: your instrument</p>}
        <Button
          ref={ctaRef}
          onClick={goReady}
          disabled={!ownInstrument || isReady}
          className="w-full max-w-xs py-4 text-lg"
        >
          {isReady ? 'waiting for co-rider…' : "Let's Ride"}
        </Button>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <p className="mb-3 font-display text-xs font-medium uppercase tracking-[0.18em] text-ink-faint">{title}</p>
      {children}
    </div>
  );
}

function ChoiceButton({
  label, icon, selected, color, onSelect,
}: {
  label: string; icon?: React.ReactNode; selected: boolean; color?: string; onSelect: () => void;
}) {
  const accent = color ?? '#C23A2B';
  return (
    <button
      onClick={onSelect}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 bg-paper px-2 py-3 text-sm shadow-card transition active:scale-95"
      style={{
        borderColor: selected ? accent : 'rgba(27,42,51,0.10)',
        background: selected ? `${accent}1A` : undefined,
        color: selected ? '#28201A' : '#45575F',
        fontWeight: selected ? 700 : 500,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
