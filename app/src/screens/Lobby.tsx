import { useEffect, useState, type ReactNode } from 'react';
import { connectToRoom } from '../net/room';
import { getOrCreateRoomCode, inviteLink } from '../lib/roomCode';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';

export default function Lobby() {
  const userId = useSession((s) => s.userId);
  const identity = useSession((s) => s.identity);

  const connected = useRoom((s) => s.connected);
  const you = useRoom((s) => s.you);
  const riders = useRoom((s) => s.riders);
  const rejectedFull = useRoom((s) => s.rejectedFull);

  const [roomCode] = useState(getOrCreateRoomCode);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId || !identity) return;
    const conn = connectToRoom(roomCode, {
      onOpen: () => {
        useRoom.getState().setConnected(true);
        conn.send({ t: 'join', userId, glyph: identity.glyph, color: identity.color });
      },
      onMessage: (msg) => useRoom.getState().ingest(msg),
      onClose: () => useRoom.getState().setConnected(false),
    });
    return () => {
      conn.close();
      useRoom.getState().reset();
    };
  }, [roomCode, userId, identity]);

  const yourRider = riders.find((r) => r.role === you) ?? null;
  const peerRider = riders.find((r) => r.role !== you) ?? null;

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink(roomCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard needs a secure context; the link is shown below to copy manually
    }
  }

  if (rejectedFull) {
    return (
      <Centered>
        <p className="text-lg">this car's already full 🚗</p>
        <p className="text-sm text-white/50">two riders per ride.</p>
        <a href={location.pathname} className="rounded-full bg-amber-400 px-6 py-3 font-semibold text-black">
          start a new ride
        </a>
      </Centered>
    );
  }

  return (
    <Centered>
      <p className="text-sm uppercase tracking-widest text-white/50">the lobby</p>

      <div className="flex items-center gap-10">
        <RiderBadge
          glyph={yourRider?.glyph ?? identity?.glyph}
          color={yourRider?.color ?? identity?.color}
          label={you ? `you · ${you}` : 'you'}
        />
        <span className="text-2xl text-white/30">+</span>
        {peerRider ? (
          <RiderBadge glyph={peerRider.glyph} color={peerRider.color} label={`co-rider · ${peerRider.role}`} />
        ) : (
          <RiderBadge label="waiting…" />
        )}
      </div>

      {peerRider ? (
        <p className="text-sm text-emerald-400">you're both here — composing comes next (M2).</p>
      ) : (
        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <p className="text-sm text-white/50">send this link to your co-rider:</p>
          <code className="w-full truncate rounded bg-white/5 px-3 py-2 text-xs text-white/70">
            {inviteLink(roomCode)}
          </code>
          <button onClick={copyInvite} className="rounded-full border border-white/20 px-5 py-2 text-sm">
            {copied ? 'copied ✓' : 'copy invite link'}
          </button>
        </div>
      )}

      <p className="text-xs text-white/20">{connected ? `room ${roomCode}` : 'connecting…'}</p>
    </Centered>
  );
}

function RiderBadge({ glyph, color, label }: { glyph?: string; color?: string; label: string }) {
  const waiting = !glyph;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-6xl leading-none" style={{ color: waiting ? '#4b5563' : color }}>
        {waiting ? '○' : glyph}
      </div>
      <p className="text-xs text-white/50">{label}</p>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 bg-[#0b1020] px-6 text-center text-white">
      {children}
    </main>
  );
}
