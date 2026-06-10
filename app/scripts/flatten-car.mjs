// Strip painted textures from the Cicada GLB and assign flat colors per material,
// matching Roadie's flat-shaded low-poly art direction.
import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';

const IN = '/Users/mbrh/Documents/roadie/app/public/assets/cars/cicada_retro_cartoon_car.glb';
const OUT = '/Users/mbrh/Documents/roadie/app/public/assets/cars/cicada_flat.glb';

const srgbToLinear = (c) => Math.pow(c / 255, 2.2);
const lin = (hex, a = 1) => [
  srgbToLinear((hex >> 16) & 255),
  srgbToLinear((hex >> 8) & 255),
  srgbToLinear(hex & 255),
  a,
];

const COLORS = {
  CICADA_PAINT:   { base: lin(0xc4503c), rough: 0.55, metal: 0 },          // retro red
  CICADA_DEFAULT: { base: lin(0x2e2e34), rough: 0.8,  metal: 0 },          // trim/wheels/interior
  CICADA_GLASS:   { base: lin(0xbcd8ee, 0.22), rough: 0.15, metal: 0 },    // tinted glass
  CICADA_LAMPS:   { base: lin(0xffd9a0, 0.6), rough: 0.3, metal: 0, emissive: [1, 0.62, 0.28] },
  CICADA_CHROME:  { base: lin(0xd6dade), rough: 0.35, metal: 0.3 },        // light flat chrome
};

const io = new NodeIO();
const doc = await io.read(IN);
const root = doc.getRoot();

// drop the baked shadow plane — solid black without its texture
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    if (prim.getMaterial()?.getName() === 'CICADA_SHADOW') prim.dispose();
  }
}

for (const mat of root.listMaterials()) {
  mat.setBaseColorTexture(null);
  mat.setMetallicRoughnessTexture(null);
  mat.setNormalTexture(null);
  mat.setOcclusionTexture(null);
  mat.setEmissiveTexture(null);
  const c = COLORS[mat.getName()];
  if (!c) continue;
  mat.setBaseColorFactor(c.base);
  mat.setRoughnessFactor(c.rough);
  mat.setMetallicFactor(c.metal);
  if (c.emissive) mat.setEmissiveFactor(c.emissive);
  if (c.base[3] < 1) mat.setAlphaMode('BLEND');
}

await doc.transform(prune());
await io.write(OUT, doc);
console.log('written', OUT);
