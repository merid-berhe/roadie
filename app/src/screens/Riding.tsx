import { useRoom } from '../state/room';

// M4: PixiJS scenery + synced playback. Placeholder for now.
export default function Riding() {
  const riders = useRoom((s) => s.riders);
  const bpm = useRoom((s) => s.bpm);
  const driver = riders.find((r) => r.role === 'driver');
  const passenger = riders.find((r) => r.role === 'passenger');

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-[#0b1020] text-white">
      <div className="flex items-center gap-8">
        {driver && <span className="text-5xl" style={{ color: driver.color }}>{driver.glyph}</span>}
        {passenger && <span className="text-5xl" style={{ color: passenger.color }}>{passenger.glyph}</span>}
      </div>
      <p className="text-sm text-white/60">on the road — {bpm ?? '?'} bpm</p>
      <p className="text-xs text-white/30">scenery + sync coming in M4</p>
    </main>
  );
}
