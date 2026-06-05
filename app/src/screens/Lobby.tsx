import { useState } from 'react';
import { inviteLink } from '../lib/roomCode';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';

export default function Lobby({ roomCode }: { roomCode: string }) {
  const identity = useSession((s) => s.identity);
  const you = useRoom((s) => s.you);
  const riders = useRoom((s) => s.riders);
  const [copied, setCopied] = useState(false);

  const yourRider = riders.find((r) => r.role === you);
  const peerRider = riders.find((r) => r.role !== you);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink(roomCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* shown as text below if clipboard unavailable */ }
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 bg-[#0b1020] px-6 text-center text-white">
      <p className="text-sm uppercase tracking-widest text-white/40">the lobby</p>

      <div className="flex items-center gap-10">
        <GlyphBadge
          glyph={yourRider?.glyph ?? identity?.glyph}
          color={yourRider?.color ?? identity?.color}
          label={you ? `you · ${you}` : 'you'}
        />
        <span className="text-2xl text-white/20">+</span>
        {peerRider
          ? <GlyphBadge glyph={peerRider.glyph} color={peerRider.color} label={`co-rider · ${peerRider.role}`} />
          : <GlyphBadge label="waiting…" />}
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-3">
        <p className="text-sm text-white/50">send this to your co-rider:</p>
        <code className="w-full truncate rounded bg-white/5 px-3 py-2 text-xs text-white/60">
          {inviteLink(roomCode)}
        </code>
        <button onClick={copyInvite} className="rounded-full border border-white/20 px-5 py-2 text-sm">
          {copied ? 'copied ✓' : 'copy invite link'}
        </button>
      </div>

      <p className="text-xs text-white/20">room {roomCode}</p>
    </main>
  );
}

function GlyphBadge({ glyph, color, label }: { glyph?: string; color?: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-6xl leading-none" style={{ color: glyph ? color : '#374151' }}>
        {glyph ?? '○'}
      </div>
      <p className="text-xs text-white/50">{label}</p>
    </div>
  );
}
