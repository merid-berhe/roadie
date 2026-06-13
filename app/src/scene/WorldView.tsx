// v6.4 — a generic world viewer: load ANY GLB by URL, frame it, optionally drop
// the Roadie car in for scale, slow orbit + drag. Used to evaluate off-the-shelf
// low-poly worlds before committing to one. Reached via ?world=<glb-url>.
import { useEffect, useRef } from 'react';
import * as pc from 'playcanvas';

type Props = {
  url: string;
  worldScale?: number;
  showCar?: boolean;
  carScale?: number; // car width in world units
};

export default function WorldView({ url, worldScale = 1, showCar = true, carScale = 4 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const app = new pc.Application(canvas, {
      graphicsDeviceOptions: { alpha: false, antialias: true, powerPreference: 'high-performance' },
    });
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 1.75);
    const resize = () => app.resizeCanvas(canvas.clientWidth, canvas.clientHeight);

    app.scene.ambientLight = new pc.Color(0.55, 0.6, 0.66);

    const sun = new pc.Entity('sun');
    sun.addComponent('light', { type: 'directional', color: new pc.Color(1, 0.96, 0.86), intensity: 1.1, castShadows: false });
    sun.setEulerAngles(50, 35, 0);
    app.root.addChild(sun);
    const fill = new pc.Entity('fill');
    fill.addComponent('light', { type: 'directional', color: new pc.Color(0.62, 0.76, 0.86), intensity: 0.45 });
    fill.setEulerAngles(-15, -150, 0);
    app.root.addChild(fill);

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', { clearColor: new pc.Color(0.62, 0.76, 0.84), fov: 50, nearClip: 0.05, farClip: 5000 });
    app.root.addChild(camera);

    // orbit state
    let center = new pc.Vec3(0, 0, 0);
    let dist = 20;
    let yaw = 0.6, pitch = 0.5;
    let dragging = false, lastX = 0, lastY = 0, auto = true;
    const onDown = (e: PointerEvent) => { dragging = true; auto = false; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw -= (e.clientX - lastX) * 0.008; pitch = Math.max(0.05, Math.min(1.4, pitch - (e.clientY - lastY) * 0.006));
      lastX = e.clientX; lastY = e.clientY;
    };
    const onUp = () => { dragging = false; };
    const onWheel = (e: WheelEvent) => { dist = Math.max(2, dist * (1 + Math.sign(e.deltaY) * 0.1)); e.preventDefault(); };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    let groundY = 0;

    // --- load the world
    const world = new pc.Asset('world', 'container', { url });
    world.on('load', () => {
      const root = new pc.Entity('world');
      root.setLocalScale(worldScale, worldScale, worldScale);
      app.root.addChild(root);
      root.addChild((world.resource as pc.ContainerResource).instantiateRenderEntity());
      // measure
      const aabb = new pc.BoundingBox();
      let first = true;
      for (const r of root.findComponents('render') as pc.RenderComponent[]) {
        for (const mi of r.meshInstances) { if (first) { aabb.copy(mi.aabb); first = false; } else aabb.add(mi.aabb); }
      }
      if (!first) {
        center = aabb.center.clone();
        groundY = aabb.getMin().y;
        const r = aabb.halfExtents.length();
        dist = r * 2.4;
        let tris = 0;
        for (const rc of root.findComponents('render') as pc.RenderComponent[]) {
          for (const mi of rc.meshInstances) tris += (mi.mesh.indexBuffer?.[0]?.numIndices ?? 0) / 3;
        }
        const sz = aabb.halfExtents.clone().mulScalar(2);
        if (infoRef.current) {
          infoRef.current.textContent =
            `${url.split('/').pop()}  ·  ${Math.round(sz.x)}×${Math.round(sz.y)}×${Math.round(sz.z)} u  ·  ~${Math.round(tris).toLocaleString()} tris  ·  drag to orbit, scroll to zoom`;
        }
      }
    });
    world.on('error', (e: string) => { if (infoRef.current) infoRef.current.textContent = `failed to load: ${e}`; });
    app.assets.add(world);
    app.assets.load(world);

    // --- drop the car in for scale
    if (showCar) {
      const car = new pc.Asset('car', 'container', { url: '/assets/cars/cicada_flat.glb' });
      car.on('load', () => {
        const holder = new pc.Entity('car');
        holder.setLocalEulerAngles(0, 90, 0);
        app.root.addChild(holder);
        holder.addChild((car.resource as pc.ContainerResource).instantiateRenderEntity());
        const aabb = new pc.BoundingBox();
        let first = true;
        for (const r of holder.findComponents('render') as pc.RenderComponent[]) {
          for (const mi of r.meshInstances) { if (first) { aabb.copy(mi.aabb); first = false; } else aabb.add(mi.aabb); }
        }
        const s = carScale / (aabb.halfExtents.x * 2);
        const c = aabb.center.clone(), min = aabb.getMin().clone();
        holder.setLocalScale(s, s, s);
        // sit the car at the world centre, wheels on the world's ground level
        holder.setLocalPosition(center.x - c.x * s, groundY - min.y * s, center.z - c.z * s);
      });
      app.assets.add(car);
      app.assets.load(car);
    }

    app.on('update', () => {
      if (auto) yaw += 0.0015;
      const cp = pitch;
      camera.setPosition(
        center.x + Math.sin(yaw) * Math.cos(cp) * dist,
        center.y + Math.sin(cp) * dist,
        center.z + Math.cos(yaw) * Math.cos(cp) * dist,
      );
      camera.lookAt(center);
    });

    app.start();
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); app.destroy(); };
  }, [url, worldScale, showCar, carScale]);

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} />
      <div ref={infoRef} className="absolute left-3 top-3 rounded bg-black/55 px-3 py-1.5 font-mono text-xs text-white">loading…</div>
    </div>
  );
}
