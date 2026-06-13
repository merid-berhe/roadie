// v6.6 SPIKE harness — hand-built explorable cities. ?proc=tokyo / ?proc=addis
import { Suspense, lazy } from 'react';

const ProcCity = lazy(() => import('../scene/ProcCity'));

export default function ProcCitySpike() {
  const style = (new URLSearchParams(window.location.search).get('proc') === 'addis' ? 'addis' : 'tokyo') as 'tokyo' | 'addis';
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-sky">
      <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-b from-sky to-cream" />}>
        <ProcCity style={style} />
      </Suspense>
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-sm text-white">
        {style} · hand-built in playcanvas · arrow keys / WASD to drive
      </div>
    </div>
  );
}
