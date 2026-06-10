// Car asset sandbox — localhost:5173/?car=1
// Judges the flattened Cicada GLB under the ride scene's desert-dusk light rig.
// URL params: ?car=1&yaw=35 (camera angle), &file=cicada_flat.glb

import { useEffect, useRef } from 'react';
import * as pc from 'playcanvas';

const params = new URLSearchParams(window.location.search);
const FILE = params.get('file') ?? 'cicada_flat.glb';
const YAW = Number(params.get('yaw') ?? 35) || 35;

export default function CarPreview() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    mount.appendChild(canvas);

    const app = new pc.Application(canvas, {
      graphicsDeviceOptions: { alpha: false, antialias: true },
      mouse: new pc.Mouse(canvas),
    });
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // desert-dusk rig from PlayCanvasRideScene
    app.scene.ambientLight = new pc.Color(0.36, 0.25, 0.3);

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', { clearColor: new pc.Color(0.94, 0.63, 0.35), fov: 50 });
    app.root.addChild(camera);

    const sun = new pc.Entity('sun');
    sun.addComponent('light', { type: 'directional', color: new pc.Color(1, 0.69, 0.4), intensity: 1.7 });
    sun.setEulerAngles(14, -42, 0);
    app.root.addChild(sun);
    const fill = new pc.Entity('fill');
    fill.addComponent('light', { type: 'directional', color: new pc.Color(0.42, 0.35, 0.63), intensity: 0.5 });
    fill.setEulerAngles(40, 140, 0);
    app.root.addChild(fill);

    const groundMat = new pc.StandardMaterial();
    groundMat.diffuse = new pc.Color(0.65, 0.4, 0.2);
    groundMat.update();
    const ground = new pc.Entity('ground');
    ground.addComponent('render', { type: 'box', material: groundMat });
    ground.setLocalPosition(0, -0.05, 0);
    ground.setLocalScale(60, 0.1, 60);
    app.root.addChild(ground);

    const asset = new pc.Asset(FILE, 'container', { url: `/assets/cars/${FILE}` });
    asset.on('load', () => {
      const car = (asset.resource as pc.ContainerResource).instantiateRenderEntity();
      app.root.addChild(car);
      // frame the model: find bounds from its render components
      const aabb = new pc.BoundingBox();
      let first = true;
      for (const render of car.findComponents('render') as pc.RenderComponent[]) {
        for (const mi of render.meshInstances) {
          if (first) { aabb.copy(mi.aabb); first = false; }
          else aabb.add(mi.aabb);
        }
      }
      car.setLocalPosition(0, -aabb.getMin().y, 0);
      const size = Math.max(aabb.halfExtents.x, aabb.halfExtents.y, aabb.halfExtents.z);
      const dist = size * 3.2;
      let yaw = YAW;
      const place = () => {
        const rad = (yaw * Math.PI) / 180;
        camera.setPosition(Math.sin(rad) * dist, size * 0.9, Math.cos(rad) * dist);
        camera.lookAt(0, size * 0.45, 0);
      };
      place();
      app.mouse?.on(pc.EVENT_MOUSEMOVE, (e: pc.MouseEvent) => {
        if (e.buttons[pc.MOUSEBUTTON_LEFT]) { yaw += e.dx * 0.4; place(); }
      });
    });
    asset.on('error', (err: string) => console.error('car load failed:', err));
    app.assets.add(asset);
    app.assets.load(asset);

    app.start();
    return () => { app.destroy(); canvas.remove(); };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" />;
}
