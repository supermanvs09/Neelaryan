import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { IngredientId } from "@/data/builders";
import { almondSkin, bananaFace, kiwiFace, strawberryCut, strawberrySkin } from "./foodTextures";
import { rng } from "./util";

/**
 * Physical food pieces. Every piece is a real mesh dropped through the physics
 * world, so it tumbles, collides and settles like food plated by hand.
 */

export type ColliderKind = "hull" | "ball" | "cuboid";
export type Layout = "sector" | "scatter" | "center";

export interface PieceKind {
  geometry: () => THREE.BufferGeometry;
  material: () => THREE.Material | THREE.Material[];
  collider: ColliderKind;
  count: number;
  scale: [number, number];
  layout: Layout;
  /** Seconds between consecutive pieces (physics time). */
  stagger: number;
  /** Optional per-piece tint variation. */
  mass?: number;
}

export interface DustKind {
  geometry: () => THREE.BufferGeometry;
  material: () => THREE.Material;
  count: number;
  size: [number, number];
  colors?: string[];
}

export interface DrizzleKind {
  color: string;
  radius: number;
  roughness: number;
  transmission?: number;
}

export interface FoodVisual {
  pieces?: PieceKind[];
  dust?: DustKind;
  drizzle?: DrizzleKind;
}

/* helpers ----------------------------------------------------------------- */

const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};

function noisify(geo: THREE.BufferGeometry, amount: number, freq = 9, seed = 1) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * freq + seed) * Math.cos(v.y * freq * 0.83 + seed * 2.1) * Math.sin(v.z * freq * 1.07 + seed * 3.3);
    v.multiplyScalar(1 + n * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);

/** Normalises ShapeGeometry UVs to 0..1 over its bounds. */
function fitUVs(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (pos.getX(i) - b.min.x) / (b.max.x - b.min.x), (pos.getY(i) - b.min.y) / (b.max.y - b.min.y));
  }
  return geo;
}

/* geometry ---------------------------------------------------------------- */

function strawberryProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const t = i / n; // 0 = tip, 1 = shoulder
    const r = Math.sin(Math.PI * Math.pow(t, 0.62) * 0.98) * 0.13 * (0.5 + 0.5 * Math.pow(t, 0.6));
    pts.push(new THREE.Vector2(Math.max(0.002, r), -0.15 + t * 0.29));
  }
  pts.push(new THREE.Vector2(0.002, 0.145));
  return pts;
}

/** A strawberry cut lengthwise: glossy half shell + textured cut face. */
const strawberryHalf = once(() => {
  const prof = strawberryProfile();
  const shell = new THREE.LatheGeometry(prof, 28, 0, Math.PI);
  const shape = new THREE.Shape();
  shape.moveTo(prof[0].x, prof[0].y);
  prof.forEach((p) => shape.lineTo(p.x, p.y));
  [...prof].reverse().forEach((p) => shape.lineTo(-p.x, p.y));
  const face = fitUVs(new THREE.ShapeGeometry(shape, 12));
  face.rotateY(-Math.PI / 2);
  noisify(shell, 0.03, 14, 2);
  // normals were computed per part (smooth shell, flat face) — keep them
  const merged = mergeGeometries([shell.toNonIndexed(), face.toNonIndexed()], true)!;
  // recentre on the centre of mass so it tumbles believably
  merged.translate(-0.04, 0, 0);
  return merged;
});

const blueberry = once(() => {
  const g = new THREE.SphereGeometry(0.075, 28, 20);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.y *= 0.84;
    // five-pointed crown dimple at the top
    const top = Math.max(0, v.y / 0.063);
    if (top > 0.78) {
      const a = Math.atan2(v.z, v.x);
      const star = 0.5 + 0.5 * Math.cos(a * 5);
      v.y -= (top - 0.78) * 0.06 * (0.6 + 0.4 * star);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  noisify(g, 0.025, 20, 5);
  return g;
});

/** Coin with softly rounded edges (banana, kiwi). */
function roundedCoin(radius: number, thickness: number, edge: number) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.001, -thickness / 2)];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI;
    pts.push(new THREE.Vector2(radius - edge + Math.cos(a) * edge, Math.sin(a) * (thickness / 2)));
  }
  pts.push(new THREE.Vector2(0.001, thickness / 2));
  const g = new THREE.LatheGeometry(pts, 40);
  // planar UVs from x/z so the face textures map straight down
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * radius) + 0.5, pos.getZ(i) / (2 * radius) + 0.5);
  g.computeVertexNormals();
  return g;
}

const bananaSlice = once(() => noisify(roundedCoin(0.15, 0.036, 0.012), 0.025, 8, 1));
const kiwiSlice = once(() => roundedCoin(0.15, 0.04, 0.008));

/** Apple wedge with red skin only on the outer arc (vertex colours). */
const appleWedge = once(() => {
  const R = 0.2;
  // a crescent: skin on the outer arc, the core cut away on the inner side
  const s = new THREE.Shape();
  s.absarc(0, 0, R, -0.42, 0.42, false);
  s.absarc(0.02, 0, R * 0.5, 0.62, -0.62, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 18 }).toNonIndexed();
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const skin = new THREE.Color("#b3192a");
  const flesh = new THREE.Color("#f3e3b4");
  for (let i = 0; i < pos.count; i += 3) {
    let rr = 0;
    for (let k = 0; k < 3; k++) rr += Math.hypot(pos.getX(i + k), pos.getY(i + k));
    const c = rr / 3 > R * 0.97 ? skin : flesh;
    for (let k = 0; k < 3; k++) c.toArray(colors, (i + k) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.center();
  g.computeVertexNormals();
  return g;
});

const mangoCube = once(() => noisify(new RoundedBoxGeometry(0.11, 0.1, 0.11, 4, 0.03), 0.08, 14, 3));

const almond = once(() => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    pts.push(new THREE.Vector2(Math.max(0.002, Math.sin(Math.PI * t) * 0.05 * (1 - 0.35 * t)), -0.075 + t * 0.15));
  }
  const g = new THREE.LatheGeometry(pts, 18);
  g.scale(1, 1, 0.55);
  g.rotateZ(Math.PI / 2);
  return noisify(g, 0.04, 16, 4);
});

const pomegranateAril = once(() => {
  const g = new THREE.IcosahedronGeometry(0.036, 2);
  g.scale(0.9, 1.25, 0.85);
  return noisify(g, 0.08, 18, 7);
});

const cashew = once(() => {
  const g = new THREE.TorusGeometry(0.045, 0.024, 10, 18, Math.PI * 1.1);
  return noisify(g, 0.05, 20, 2);
});

const raisin = once(() => {
  const g = new THREE.SphereGeometry(0.04, 14, 10);
  g.scale(1.25, 0.65, 0.9);
  return noisify(g, 0.22, 26, 9);
});

const pumpkinSeed = once(() => {
  const g = new THREE.SphereGeometry(0.05, 14, 8);
  g.scale(1, 0.22, 0.55);
  return noisify(g, 0.03, 10, 2);
});

const nib = once(() => noisify(new THREE.DodecahedronGeometry(0.026, 0), 0.1, 30, 3));

const granolaCluster = once(() => {
  const r = rng(13);
  const parts: THREE.BufferGeometry[] = [];
  const colors: number[][] = [];
  const tones = ["#c58b47", "#b2793a", "#d8a965", "#9c6630", "#e2bb7c"].map((c) => new THREE.Color(c));
  for (let i = 0; i < 9; i++) {
    // smooth toasted lumps and a few flat oat shards stuck together
    const shard = i % 3 === 2;
    const p = shard ? new THREE.CircleGeometry(0.028, 7) : new THREE.IcosahedronGeometry(0.018 + r() * 0.014, 1);
    if (shard) p.rotateX(-Math.PI / 2 + (r() - 0.5));
    noisify(p, shard ? 0.1 : 0.22, 40, i);
    p.translate((r() - 0.5) * 0.07, (r() - 0.5) * 0.03, (r() - 0.5) * 0.07);
    const flat = p.toNonIndexed();
    const tone = tones[Math.floor(r() * tones.length)];
    colors.push(Array.from({ length: flat.attributes.position.count }, () => [tone.r, tone.g, tone.b]).flat());
    parts.push(flat);
  }
  const g = mergeGeometries(parts)!;
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors.flat(), 3));
  return g;
});

const chocoChip = once(() => {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.001, 0)];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(0.03 * (1 - Math.pow(t, 0.7)) + 0.001, t * 0.042));
  }
  const g = new THREE.LatheGeometry(pts, 14);
  g.translate(0, -0.014, 0);
  return g;
});

const scoop = once(() => {
  const g = new THREE.SphereGeometry(0.26, 48, 32);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    // ridges left by the scoop + a flattened, ragged base
    const ridge = Math.sin(a * 3 + v.y * 16) * 0.018 + Math.sin(v.y * 40) * 0.006;
    v.multiplyScalar(1 + ridge);
    if (v.y < -0.12) v.y = -0.12 - (v.y + 0.12) * 0.15;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  noisify(g, 0.04, 10, 6);
  return g;
});

const powderMound = once(() => {
  const g = new THREE.SphereGeometry(0.22, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, 0.45, 1);
  return noisify(g, 0.05, 14, 5);
});

/* materials --------------------------------------------------------------- */

const MAT = {
  strawberry: once(() => {
    const { map, normal } = strawberrySkin();
    return [
      phys({ map, normalMap: normal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.3, sheenColor: new THREE.Color("#ff9a9a") }),
      phys({ map: strawberryCut(), roughness: 0.42, clearcoat: 0.9, clearcoatRoughness: 0.2 }),
    ];
  }),
  blueberry: once(() =>
    phys({ color: "#2b3160", roughness: 0.5, sheen: 1, sheenColor: new THREE.Color("#a7b6dc"), sheenRoughness: 0.55 }),
  ),
  banana: once(() => phys({ map: bananaFace(), roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.2, sheenColor: new THREE.Color("#fff5d0") })),
  kiwi: once(() => phys({ map: kiwiFace(), roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15 })),
  apple: once(() => phys({ vertexColors: true, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.25 })),
  mango: once(() => phys({ color: "#ffa41a", roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.3, sheen: 0.6, sheenColor: new THREE.Color("#ffe08a") })),
  almond: once(() => {
    const { map, normal } = almondSkin();
    return phys({ map, normalMap: normal, roughness: 0.62 });
  }),
  aril: once(() =>
    phys({ color: "#a10d2b", roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.6, sheenColor: new THREE.Color("#ff4d6d"), emissive: new THREE.Color("#2a0008") }),
  ),
  cashew: once(() => phys({ color: "#e6cd98", roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color("#fff2cf") })),
  raisin: once(() => phys({ color: "#3d1611", roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.4 })),
  pumpkin: once(() => phys({ color: "#5b7a36", roughness: 0.5, sheen: 0.3, sheenColor: new THREE.Color("#b9d38a") })),
  nib: once(() => phys({ color: "#3b2016", roughness: 0.75 })),
  granola: once(() => phys({ vertexColors: true, roughness: 0.75, sheen: 0.3, sheenColor: new THREE.Color("#ffd99a"), side: THREE.DoubleSide })),
  chip: once(() => phys({ color: "#36190d", roughness: 0.32, clearcoat: 0.4 })),
  scoop: once(() => phys({ color: "#f6ecd2", roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color("#ffffff") })),
  plant: once(() => phys({ color: "#d6cda7", roughness: 1 })),
  whey: once(() => phys({ color: "#f5eedf", roughness: 1 })),
};

/* catalogue ---------------------------------------------------------------- */

const piece = (p: Partial<PieceKind> & Pick<PieceKind, "geometry" | "material" | "count">): PieceKind => ({
  collider: "hull",
  scale: [0.9, 1.1],
  layout: "sector",
  stagger: 0.06,
  ...p,
});

const chiaGeo = once(() => {
  const g = new THREE.SphereGeometry(0.011, 6, 5);
  g.scale(1.3, 0.8, 1);
  return g;
});

export const FOOD: Partial<Record<IngredientId, FoodVisual>> = {
  strawberry: { pieces: [piece({ geometry: strawberryHalf, material: MAT.strawberry, count: 6, stagger: 0.09 })] },
  blueberry: { pieces: [piece({ geometry: blueberry, material: MAT.blueberry, count: 13, collider: "ball", stagger: 0.04 })] },
  banana: { pieces: [piece({ geometry: bananaSlice, material: MAT.banana, count: 7, stagger: 0.08 })] },
  kiwi: { pieces: [piece({ geometry: kiwiSlice, material: MAT.kiwi, count: 5, stagger: 0.09 })] },
  apple: { pieces: [piece({ geometry: appleWedge, material: MAT.apple, count: 6, stagger: 0.08 })] },
  mango: { pieces: [piece({ geometry: mangoCube, material: MAT.mango, count: 9, collider: "cuboid", stagger: 0.05 })] },
  pomegranate: { pieces: [piece({ geometry: pomegranateAril, material: MAT.aril, count: 30, collider: "ball", stagger: 0.02 })] },
  almonds: { pieces: [piece({ geometry: almond, material: MAT.almond, count: 8, stagger: 0.06 })] },
  "dry-fruits": {
    pieces: [
      piece({ geometry: cashew, material: MAT.cashew, count: 6 }),
      piece({ geometry: almond, material: MAT.almond, count: 4 }),
      piece({ geometry: raisin, material: MAT.raisin, count: 7, collider: "ball", stagger: 0.04 }),
    ],
  },
  raisins: { pieces: [piece({ geometry: raisin, material: MAT.raisin, count: 14, collider: "ball", layout: "scatter", stagger: 0.03 })] },
  "pumpkin-seeds": { pieces: [piece({ geometry: pumpkinSeed, material: MAT.pumpkin, count: 16, layout: "scatter", stagger: 0.025 })] },
  "cocoa-nibs": { pieces: [piece({ geometry: nib, material: MAT.nib, count: 26, collider: "ball", layout: "scatter", stagger: 0.015 })] },
  granola: { pieces: [piece({ geometry: granolaCluster, material: MAT.granola, count: 12, stagger: 0.05 })] },
  "choco-chips": { pieces: [piece({ geometry: chocoChip, material: MAT.chip, count: 24, collider: "ball", layout: "scatter", stagger: 0.02 })] },
  "icecream-scoop": { pieces: [piece({ geometry: scoop, material: MAT.scoop, count: 1, collider: "ball", layout: "center", scale: [1, 1] })] },
  "plant-protein": { pieces: [piece({ geometry: powderMound, material: MAT.plant, count: 1, layout: "center", scale: [1, 1], collider: "cuboid" })] },
  "whey-protein": { pieces: [piece({ geometry: powderMound, material: MAT.whey, count: 1, layout: "center", scale: [1, 1], collider: "cuboid" })] },
  chia: {
    dust: {
      geometry: chiaGeo,
      material: once(() => new THREE.MeshStandardMaterial({ roughness: 0.45 })),
      count: 160,
      size: [0.8, 1.3],
      colors: ["#1e1b19", "#3a3631", "#5b554c", "#2a2622"],
    },
  },
  cinnamon: {
    dust: {
      geometry: once(() => new THREE.IcosahedronGeometry(0.008, 0)),
      material: once(() => new THREE.MeshStandardMaterial({ roughness: 0.95 })),
      count: 220,
      size: [0.7, 1.6],
      colors: ["#8a4a20", "#6e3815", "#a35b2a"],
    },
  },
  "peanut-butter": { drizzle: { color: "#9c5d26", radius: 0.03, roughness: 0.22 } },
  honey: { drizzle: { color: "#e39a12", radius: 0.022, roughness: 0.05, transmission: 0.5 } },
  "choco-sauce": { drizzle: { color: "#341709", radius: 0.026, roughness: 0.15 } },
};

export const hasFood = (id: IngredientId) => !!FOOD[id];
