import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { inviteLink } from '../lib/roomCode';
import { CharacterFace, characterName } from '../components/CharacterFace';
import { Button, SignLabel } from '../components/ui';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';

// v6.0 — the lobby is a boarding pass: two seats, one of them still open.
export default function Lobby({ roomCode }: { roomCode: string }) {
  const identity = useSession((s) => s.identity);
  const you = useRoom((s) => s.you);
  const riders = useRoom((s) => s.riders);
  const [copied, setCopied] = useState(false);

  const yourRider = riders.find((r) => r.role === you);
  const peerRider = riders.find((r) => r.role !== you);
  const yourName = characterName(yourRider?.character);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink(roomCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* shown as text below if clipboard unavailable */ }
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-cream px-6">
      <SignLabel>boarding</SignLabel>

      {/* The boarding pass */}
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-paper shadow-card">
        <div className="flex items-center justify-between bg-sunset px-5 py-3">
          <p className="font-display font-semibold text-paper">Roadie</p>
          <p className="font-display text-xs font-medium uppercase tracking-[0.18em] text-paper/85">
            ride {roomCode}
          </p>
        </div>

        <div className="flex items-center justify-center gap-10 px-6 py-7">
          <div className="flex flex-col items-center gap-2">
            <CharacterFace id={yourRider?.character} color={yourRider?.color ?? identity?.color} size={72} />
            <p className="text-xs text-ink-soft">
              {yourName ? `you're ${yourName}` : 'you'}{you ? ` · ${you}` : ''}
            </p>
          </div>
          <span className="font-display text-2xl text-ink-faint">+</span>
          {peerRider ? (
            <div className="flex flex-col items-center gap-2">
              <CharacterFace id={peerRider.character} color={peerRider.color} size={72} />
              <p className="text-xs text-ink-soft">
                {characterName(peerRider.character) ?? 'co-rider'} · {peerRider.role}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="h-[72px] w-[72px] rounded-full border-2 border-dashed border-ink/15" />
              <p className="text-xs text-ink-faint">seat open…</p>
            </div>
          )}
        </div>

        <div className="border-t-2 border-dashed border-ink/10 px-6 py-5">
          <p className="text-sm text-ink-soft">send this to your co-rider:</p>
          <code className="mt-2 block w-full truncate rounded-lg bg-sand px-3 py-2 text-xs text-ink-soft">
            {inviteLink(roomCode)}
          </code>
          <Button variant="secondary" onClick={copyInvite} className="mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-sm">
            {copied ? <Check size={15} className="text-teal" /> : <Copy size={15} />}
            {copied ? 'copied' : 'copy invite link'}
          </Button>
        </div>
      </div>
    </main>
  );
}
