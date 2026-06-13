// v6.4 — harness for the generic world viewer.
//   ?world=/assets/worlds/foo.glb         view a world (auto-frames, car for scale)
//   &scale=0.1   &car=0   &carScale=4      tuning knobs
import { Suspense, lazy } from 'react';

const WorldView = lazy(() => import('../scene/WorldView'));

export default function WorldViewer() {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('world') || '';
  const worldScale = parseFloat(params.get('scale') || '1') || 1;
  const carScale = parseFloat(params.get('carScale') || '4') || 4;
  const showCar = params.get('car') !== '0';

  if (!url) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream px-6 text-center text-ink-soft">
        <p>pass a world to view: <code className="text-ink">?world=/assets/worlds/&lt;file&gt;.glb</code></p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-sky">
      <Suspense fallback={<div className="h-full w-full bg-gradient-to-b from-sky to-cream" />}>
        <WorldView url={url} worldScale={worldScale} showCar={showCar} carScale={carScale} />
      </Suspense>
    </div>
  );
}
