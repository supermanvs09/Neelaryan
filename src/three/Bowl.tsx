"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import type { IngredientId } from "@/data/builders";
import { FoodDrops, type SurfaceState } from "./Drops";
import { stoneware } from "./foodTextures";
import { useDirector } from "./Studio";
import { useDisplayFont } from "./useDisplayFont";
import { brandBandTexture, clamp01, easeOutCubic, rng } from "./util";

/* Bowl profile ------------------------------------------------------------ */

const WALL = 0.07;
const outerR = (t: number) => 0.58 + 0.62 * (1 - Math.pow(1 - t, 2));
const outerY = (t: number) => 0.08 + 0.84 * t;
const tAtY = (y: number) => clamp01((y - 0.08) / 0.84);
export const RIM_Y = 0.92;
/** Inner radius of the bowl at height y. */
export const innerRadiusAt = (y: number) => outerR(tAtY(y)) - WALL;

function bowlProfile(steps = 28) {
  const p: THREE.Vector2[] = [new THREE.Vector2(0.001, 0.012), new THREE.Vector2(0.44, 0.012), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.56, 0.03)];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    p.push(new THREE.Vector2(outerR(t), outerY(t)));
  }
  const cx = 1.2 - WALL / 2;
  for (let i = 1; i < 10; i++) {
    const a = (i / 10) * Math.PI;
    p.push(new THREE.Vector2(cx + Math.cos(a) * (WALL / 2), RIM_Y + Math.sin(a) * (WALL / 2)));
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const y = outerY(t);
    if (y < 0.17) break;
    p.push(new THREE.Vector2(outerR(t) - WALL, y));
  }
  p.push(new THREE.Vector2(innerRadiusAt(0.17) * 0.8, 0.16));
  p.push(new THREE.Vector2(0.001, 0.16));
  return p;
}

function bandProfile(t0: number, t1: number) {
  return Array.from({ length: 17 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / 16;
    return new THREE.Vector2(outerR(t) + 0.003, outerY(t));
  });
}

/** Hand-glazed speckled stoneware with a gold rim and the NEELARYAN wordmark. */
export function BowlShell() {
  const font = useDisplayFont();
  const geo = useMemo(() => new THREE.LatheGeometry(bowlProfile(), 128), []);
  const band = useMemo(() => new THREE.LatheGeometry(bandProfile(0.3, 0.86), 128, -Math.PI, Math.PI * 2), []);
  const rim = useMemo(() => new THREE.TorusGeometry(1.2 - WALL / 2, WALL / 2 + 0.005, 16, 160), []);
  const ceramic = useMemo(() => {
    const { map, normal } = stoneware();
    return new THREE.MeshPhysicalMaterial({
      map,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.38,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      sheen: 0.2,
      sheenColor: new THREE.Color("#fff6e4"),
      side: THREE.DoubleSide,
    });
  }, []);
  const gold = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#d7b062", metalness: 1, roughness: 0.2, clearcoat: 0.5 }), []);
  const bandMat = useMemo(() => {
    if (!font) return null;
    return new THREE.MeshPhysicalMaterial({
      map: brandBandTexture(font, (2 * Math.PI * 1.02) / 0.5),
      transparent: true,
      roughness: 0.3,
      clearcoat: 1,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
  }, [font]);

  useEffect(
    () => () => {
      [geo, band, rim, ceramic, gold].forEach((o) => o.dispose());
      bandMat?.dispose();
    },
    [geo, band, rim, ceramic, gold, bandMat],
  );

  return (
    <group>
      <mesh geometry={geo} material={ceramic} castShadow receiveShadow />
      {bandMat && <mesh geometry={band} material={bandMat} />}
      <mesh geometry={rim} material={gold} position={[0, RIM_Y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
    </group>
  );
}

/** Static physics shell so food rolls down the walls and settles. */
function BowlCollider() {
  const geo = useMemo(() => new THREE.LatheGeometry(bowlProfile(10), 36), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <RigidBody type="fixed" colliders="trimesh" friction={0.9}>
      <mesh geometry={geo} visible={false} />
    </RigidBody>
  );
}

/* Oats bed ---------------------------------------------------------------- */

const BASE_LEVEL: Partial<Record<IngredientId, number>> = { "regular-oats": 0.6, "oats-milk": 0.6, "extra-oats": 0.69 };
const EMPTY_LEVEL = 0.17;
const BASES: IngredientId[] = ["regular-oats", "oats-milk", "extra-oats"];
const OAT_TONES = ["#e2c995", "#d9bc85", "#ecd6a6", "#cfae74", "#f0dfb7", "#c99f63"];

function flakeGeometry() {
  const g = new THREE.CircleGeometry(0.055, 10);
  const pos = g.attributes.position;
  const r = rng(3);
  for (let i = 1; i < pos.count; i++) {
    const k = 0.75 + r() * 0.4;
    pos.setXY(i, pos.getX(i) * k * 1.15, pos.getY(i) * k * 0.85);
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, -(x * x + y * y) * 3.2); // slightly cupped, like rolled oats
  }
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/**
 * Hundreds of individual rolled-oat flakes cascade in and pile into a bed.
 * Oats + milk shows a creamy pool through the flakes.
 */
function OatBed({ base, surface, introAt }: { base: IngredientId | null; surface: React.MutableRefObject<SurfaceState>; introAt: number }) {
  const { quality, clock, reduced } = useDirector();
  const N = quality.oatFlakes;
  const flakes = useRef<THREE.InstancedMesh>(null);
  const porridge = useRef<THREE.Mesh>(null);
  const collider = useRef<RapierRigidBody>(null);
  const anim = useRef({ from: EMPTY_LEVEL, to: EMPTY_LEVEL, at: introAt, pourAt: introAt });
  const geo = useMemo(flakeGeometry, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.82, side: THREE.DoubleSide }), []);
  const porridgeGeo = useMemo(() => {
    const g = new THREE.CircleGeometry(1, 64);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const milky = base === "oats-milk";
  const porridgeMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: milky ? "#f3e9d4" : "#d8bf8e",
        roughness: milky ? 0.18 : 0.9,
        clearcoat: milky ? 1 : 0,
        sheen: milky ? 0.5 : 0,
      }),
    [milky],
  );
  useEffect(() => () => {
    geo.dispose();
    mat.dispose();
    porridgeGeo.dispose();
  }, [geo, mat, porridgeGeo]);
  useEffect(() => () => porridgeMat.dispose(), [porridgeMat]);

  const slots = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: N }, () => ({
      a: r() * Math.PI * 2,
      f: Math.sqrt(r()) * 0.97,
      j: r(),
      order: r(),
      rot: new THREE.Euler((r() - 0.5) * 0.9, r() * 6.28, (r() - 0.5) * 0.9),
      s: 0.75 + r() * 0.55,
      tone: OAT_TONES[Math.floor(r() * OAT_TONES.length)],
    }));
  }, [N]);

  useEffect(() => {
    const m = flakes.current;
    if (!m) return;
    const c = new THREE.Color();
    slots.forEach((s, i) => m.setColorAt(i, c.set(s.tone)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [slots]);

  useEffect(() => {
    const target = base ? BASE_LEVEL[base] ?? 0.6 : EMPTY_LEVEL;
    const a = anim.current;
    const t = clock.current;
    const cur = t < a.at ? a.from : a.from + (a.to - a.from) * easeOutCubic(clamp01((t - a.at) / 1.4));
    const at = Math.max(t, introAt);
    anim.current = { from: cur, to: target, at, pourAt: a.to === EMPTY_LEVEL ? at : a.pourAt };
  }, [base, introAt, clock]);

  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const settledFor = useRef(-1);

  useFrame(() => {
    const a = anim.current;
    const t = clock.current;
    const p = reduced ? 1 : clamp01((t - a.at) / 1.4);
    const level = a.from + (a.to - a.from) * easeOutCubic(p);
    const radius = innerRadiusAt(level) - 0.02;
    surface.current.level = level + 0.03;
    surface.current.radius = radius * 0.86;
    surface.current.dome = 0.05;
    const visible = level > EMPTY_LEVEL + 0.01 || a.to > EMPTY_LEVEL;

    if (porridge.current) {
      porridge.current.visible = level > EMPTY_LEVEL + 0.02;
      porridge.current.position.y = level - 0.005;
      porridge.current.scale.set(radius, 1, radius);
    }
    collider.current?.setNextKinematicTranslation({ x: 0, y: level - 0.25 + 0.03, z: 0 });

    const m = flakes.current;
    if (!m) return;
    m.visible = visible;
    const pourT = t - a.pourAt;
    const settled = reduced || pourT > 2.4;
    // skip the per-flake update once nothing is moving
    const key = Math.round(level * 1000);
    if (settled && settledFor.current === key) return;
    if (settled) settledFor.current = key;

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const appear = s.order * 1.5; // the pour reaches each flake at a different moment
      const local = settled ? 1 : clamp01((pourT - appear) / 0.42);
      const r = s.f * radius;
      const y = level + 0.05 * (1 - s.f * s.f) + s.j * 0.035;
      const fall = (1 - local) * (1 - local) * 2.4;
      v.set(Math.cos(s.a) * r * (0.35 + 0.65 * local), y + fall, Math.sin(s.a) * r * (0.35 + 0.65 * local));
      q.setFromEuler(s.rot);
      m4.compose(v, q, sc.setScalar(local > 0 ? s.s : 1e-4));
      m.setMatrixAt(i, m4);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh ref={porridge} geometry={porridgeGeo} material={porridgeMat} visible={false} receiveShadow />
      <instancedMesh ref={flakes} args={[geo, mat, slots.length]} frustumCulled={false} castShadow={quality.tier === "high"} receiveShadow visible={false} />
      <RigidBody ref={collider} type="kinematicPosition" colliders={false} position={[0, EMPTY_LEVEL - 0.25, 0]}>
        <CylinderCollider args={[0.25, innerRadiusAt(0.6) - 0.02]} friction={1} />
      </RigidBody>
    </>
  );
}

/* Bowl -------------------------------------------------------------------- */

/** A complete bowl whose contents build themselves as `ingredients` change. */
export function Bowl({
  ingredients,
  introAt = 0.5,
  gap = 0.55,
  position = [0, 0, 0],
}: {
  ingredients: IngredientId[];
  /** Director-clock time the pour begins. */
  introAt?: number;
  gap?: number;
  position?: [number, number, number];
}) {
  const base = ingredients.find((i) => BASES.includes(i)) ?? null;
  const food = useMemo(() => ingredients.filter((i) => !BASES.includes(i)), [ingredients]);
  const surface = useRef<SurfaceState>({ level: EMPTY_LEVEL, radius: innerRadiusAt(EMPTY_LEVEL), dome: 0 });
  const contents = useRef<THREE.Group>(null);

  return (
    <group position={position}>
      <BowlShell />
      <BowlCollider />
      <group ref={contents}>
        <OatBed base={base} surface={surface} introAt={introAt} />
        <FoodDrops ids={food} surface={surface} contents={contents} introAt={introAt + 1.5} gap={gap} />
      </group>
    </group>
  );
}
