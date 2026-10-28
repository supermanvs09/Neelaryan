"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import type { IngredientId } from "@/data/builders";
import { FOOD, type DrizzleKind, type DustKind, type PieceKind } from "./food";
import { useDirector } from "./Studio";
import { clamp01, easeOutCubic, hash, rng } from "./util";

/** Live description of the surface food lands on (mutated each frame by its container). */
export interface SurfaceState {
  level: number;
  radius: number;
  dome: number;
}

interface Entry {
  id: IngredientId;
  /** Director-clock time the first piece is released. */
  at: number;
  removedAt: number | null;
  sector: number;
  sectors: number;
  center: number;
  order: number;
}

const noRaycast = () => null;

/**
 * Keeps animated entries in sync with the selected ingredients. On first mount
 * the existing selection is released one ingredient at a time, so the dish
 * builds itself; later additions drop immediately; removals lift away.
 */
function useEntries(ids: IngredientId[], introAt: number, gap: number) {
  const { clock, reduced } = useDirector();
  const [entries, setEntries] = useState<Entry[]>([]);
  const first = useRef(true);
  const key = ids.join("|");

  useEffect(() => {
    const wanted = key ? (key.split("|") as IngredientId[]) : [];
    const now = clock.current;
    const isFirst = first.current;
    first.current = false;
    setEntries((prev) => {
      const sectorIds = wanted.filter((id) => FOOD[id]?.pieces?.[0].layout === "sector");
      const centerIds = wanted.filter((id) => FOOD[id]?.pieces?.[0].layout === "center");
      let fresh = 0;
      const next: Entry[] = wanted.map((id, order) => {
        const live = prev.find((e) => e.id === id && e.removedAt === null);
        const at = live ? live.at : reduced ? now : isFirst ? Math.max(now, introAt) + fresh++ * gap : now + fresh++ * 0.12;
        return {
          id,
          at,
          removedAt: null,
          sector: Math.max(0, sectorIds.indexOf(id)),
          sectors: Math.max(1, sectorIds.length),
          center: Math.max(0, centerIds.indexOf(id)),
          order,
        };
      });
      for (const e of prev) {
        if (next.some((n) => n.id === e.id)) continue;
        if (e.removedAt === null) next.push({ ...e, removedAt: now });
        else if (now - e.removedAt < 0.9) next.push(e);
      }
      return next;
    });
    const t = window.setTimeout(() => setEntries((prev) => prev.filter((e) => e.removedAt === null || clock.current - e.removedAt < 0.8)), 1000);
    return () => window.clearTimeout(t);
  }, [key, introAt, gap, clock, reduced]);

  return entries;
}

/* Physics pieces --------------------------------------------------------- */

interface Spawn {
  pos: [number, number, number];
  rot: [number, number, number];
  vel: [number, number, number];
  spin: [number, number, number];
  scale: number;
  at: number;
}

function Piece({ kind, spawn, leaving }: { kind: PieceKind; spawn: Spawn; leaving: number | null }) {
  const body = useRef<RapierRigidBody>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const { clock, reduced } = useDirector();

  useFrame(() => {
    if (leaving === null || !mesh.current) return;
    const b = body.current;
    if (b && b.isEnabled()) b.setEnabled(false);
    const p = clamp01((clock.current - leaving) / (reduced ? 0.01 : 0.45));
    mesh.current.position.y = easeOutCubic(p) * 0.6;
    mesh.current.scale.setScalar(spawn.scale * (1 - easeOutCubic(p)) + 1e-4);
  });

  return (
    <RigidBody
      ref={body}
      colliders={kind.collider}
      position={spawn.pos}
      rotation={spawn.rot}
      linearVelocity={spawn.vel}
      angularVelocity={spawn.spin}
      restitution={0.12}
      friction={0.95}
      linearDamping={0.35}
      angularDamping={0.9}
      ccd
    >
      <mesh ref={mesh} geometry={kind.geometry()} material={kind.material()} scale={spawn.scale} castShadow receiveShadow dispose={null} />
    </RigidBody>
  );
}

function PieceSet({ entry, kind, kindIndex, surface }: { entry: Entry; kind: PieceKind; kindIndex: number; surface: MutableRefObject<SurfaceState> }) {
  const { clock, reduced } = useDirector();
  const [spawned, setSpawned] = useState(0);
  const spawnedRef = useRef(0);

  // pre-plan every piece: where it lands, how it tumbles
  const plan = useMemo(() => {
    const r = rng(hash(entry.id) + kindIndex * 101 + entry.sector * 7 + entry.sectors * 31);
    const n = kind.count;
    const span = (Math.PI * 2) / entry.sectors;
    const start = entry.sector * span + 0.4;
    return Array.from({ length: n }, (_, i) => {
      let a: number;
      let f: number;
      if (kind.layout === "sector") {
        a = start + span * (0.12 + 0.76 * r());
        f = 0.3 + 0.55 * Math.sqrt(r());
      } else if (kind.layout === "scatter") {
        a = r() * Math.PI * 2;
        f = Math.sqrt(r()) * 0.88;
      } else {
        const spots = [
          [0, 0],
          [2.4, 0.42],
          [5.1, 0.4],
        ];
        [a, f] = spots[entry.center % spots.length];
      }
      return {
        a,
        f,
        h: 1.6 + r() * 0.5 + i * 0.02,
        rot: [r() * 6.28, r() * 6.28, r() * 6.28] as [number, number, number],
        spin: [(r() - 0.5) * 8, (r() - 0.5) * 8, (r() - 0.5) * 8] as [number, number, number],
        drift: [(r() - 0.5) * 0.4, (r() - 0.5) * 0.4] as [number, number],
        scale: kind.scale[0] + r() * (kind.scale[1] - kind.scale[0]),
        delay: i * kind.stagger + kindIndex * 0.1,
      };
    });
  }, [entry.id, entry.sector, entry.sectors, entry.center, kind, kindIndex]);

  const spawns = useRef<Spawn[]>([]);

  useFrame(() => {
    if (entry.removedAt !== null || spawnedRef.current >= plan.length) return;
    const t = clock.current;
    let n = spawnedRef.current;
    while (n < plan.length && (reduced || t >= entry.at + plan[n].delay)) {
      const p = plan[n];
      const s = surface.current;
      const x = Math.cos(p.a) * p.f * s.radius;
      const z = Math.sin(p.a) * p.f * s.radius;
      const centre = kind.layout === "center";
      spawns.current[n] = {
        pos: [x, s.level + (reduced ? 0.25 : centre ? 1.2 : p.h), z],
        rot: centre ? [0, p.rot[1], 0] : p.rot,
        vel: reduced || centre ? [0, 0, 0] : [p.drift[0], -1.5, p.drift[1]],
        spin: reduced || centre ? [0, 0, 0] : p.spin,
        scale: p.scale,
        at: t,
      };
      n++;
    }
    if (n !== spawnedRef.current) {
      spawnedRef.current = n;
      setSpawned(n);
    }
  });

  return (
    <>
      {spawns.current.slice(0, spawned).map((s, i) => (
        <Piece key={i} kind={kind} spawn={s} leaving={entry.removedAt} />
      ))}
    </>
  );
}

/* Dust: chia, cinnamon — settles on top of whatever is below ------------- */

const ray = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);

function landingHeight(contents: RefObject<THREE.Object3D | null>, x: number, z: number, fallback: number) {
  const root = contents.current;
  if (!root) return fallback;
  // x/z are in the container's local space; raycast in world space
  const origin = root.localToWorld(new THREE.Vector3(x, 6, z));
  ray.set(origin, DOWN);
  ray.far = 14;
  const hit = ray.intersectObject(root, true)[0];
  return hit ? root.worldToLocal(hit.point.clone()).y : fallback;
}

function Dust({ entry, kind, surface, contents }: { entry: Entry; kind: DustKind; surface: MutableRefObject<SurfaceState>; contents: RefObject<THREE.Object3D | null> }) {
  const { clock, reduced } = useDirector();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const plan = useMemo(() => {
    const r = rng(hash(entry.id));
    return Array.from({ length: kind.count }, () => ({
      a: r() * Math.PI * 2,
      f: Math.sqrt(r()) * 0.92,
      rot: new THREE.Euler(r() * 6, r() * 6, r() * 6),
      s: kind.size[0] + r() * (kind.size[1] - kind.size[0]),
      delay: r() * 0.7,
      color: kind.colors?.[Math.floor(r() * kind.colors.length)] ?? "#333",
    }));
  }, [entry.id, kind]);
  const landed = useRef<number[] | null>(null);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    plan.forEach((p, i) => m.setColorAt(i, c.set(p.color)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [plan]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.current - entry.at;
    const s = surface.current;
    if (t < 0 && !reduced) {
      m.visible = false;
      return;
    }
    m.visible = true;
    // work out where each grain lands once, the moment it is released
    if (!landed.current) {
      landed.current = plan.map((p) => landingHeight(contents, Math.cos(p.a) * p.f * s.radius, Math.sin(p.a) * p.f * s.radius, s.level));
    }
    const out = entry.removedAt === null ? 0 : clamp01((clock.current - entry.removedAt) / 0.4);
    let active = false;
    plan.forEach((p, i) => {
      const local = reduced ? 1 : clamp01((t - p.delay) / 0.55);
      if (local < 1) active = true;
      const y = landed.current![i] + 0.006;
      v.set(Math.cos(p.a) * p.f * s.radius, y + (1 - local * local) * 2.2 + out * 0.4, Math.sin(p.a) * p.f * s.radius);
      q.setFromEuler(p.rot);
      m4.compose(v, q, sc.setScalar((local > 0 ? p.s : 0.0001) * (1 - out) + 1e-4));
      m.setMatrixAt(i, m4);
    });
    if (active || out > 0 || t < 3) m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[kind.geometry(), kind.material(), plan.length]} raycast={noRaycast} frustumCulled={false} castShadow={false} receiveShadow dispose={null} />;
}

/* Drizzle: a pouring stream that drapes over the food -------------------- */

function Drizzle({ entry, kind, surface, contents }: { entry: Entry; kind: DrizzleKind; surface: MutableRefObject<SurfaceState>; contents: RefObject<THREE.Object3D | null> }) {
  const { clock, reduced } = useDirector();
  const [geo, setGeo] = useState<THREE.TubeGeometry | null>(null);
  const tube = useRef<THREE.Mesh>(null);
  const stream = useRef<THREE.Mesh>(null);
  const head = useRef(new THREE.Vector3());
  const curveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: kind.color,
        roughness: kind.roughness,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        transmission: kind.transmission ?? 0,
        thickness: 0.2,
        ior: 1.5,
        attenuationColor: new THREE.Color(kind.color),
        attenuationDistance: 0.3,
      }),
    [kind],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => () => geo?.dispose(), [geo]);

  useFrame(() => {
    const t = clock.current - entry.at;
    if (t < 0 && !reduced) return;
    const s = surface.current;
    // build the draped path once, when the pour begins (food has mostly settled)
    if (!curveRef.current) {
      const r = rng(hash(entry.id));
      const rot = r() * Math.PI * 2;
      const passes = 2.2 + r() * 0.8;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 70; i++) {
        const u = i / 70;
        let x = 0.78 * Math.sin(Math.PI * 2 * passes * u);
        let z = -0.75 + 1.5 * u;
        const len = Math.hypot(x, z);
        if (len > 0.84) {
          x *= 0.84 / len;
          z *= 0.84 / len;
        }
        const wx = (x * Math.cos(rot) - z * Math.sin(rot)) * s.radius;
        const wz = (x * Math.sin(rot) + z * Math.cos(rot)) * s.radius;
        pts.push(new THREE.Vector3(wx, landingHeight(contents, wx, wz, s.level) + kind.radius * 0.7, wz));
      }
      curveRef.current = new THREE.CatmullRomCurve3(pts);
      setGeo(new THREE.TubeGeometry(curveRef.current, 280, kind.radius, 8, false));
      return;
    }
    if (!geo || !tube.current) return;
    const p = reduced ? 1 : clamp01(t / 1.6);
    const out = entry.removedAt === null ? 0 : clamp01((clock.current - entry.removedAt) / 0.4);
    const total = geo.index!.count;
    geo.setDrawRange(0, Math.floor((total * p * (1 - out)) / 6) * 6);
    curveRef.current.getPointAt(Math.min(0.999, p), head.current);
    if (stream.current) {
      const pouring = !reduced && p > 0 && p < 1 && out === 0;
      stream.current.visible = pouring;
      if (pouring) {
        const top = head.current.y + 2.6;
        stream.current.position.set(head.current.x, (top + head.current.y) / 2, head.current.z);
        stream.current.scale.set(1, top - head.current.y, 1);
      }
    }
  });

  return (
    <>
      {geo && <mesh ref={tube} geometry={geo} material={mat} castShadow raycast={noRaycast} />}
      <mesh ref={stream} material={mat} visible={false} raycast={noRaycast}>
        <cylinderGeometry args={[kind.radius * 0.45, kind.radius * 0.8, 1, 10, 1, true]} />
      </mesh>
    </>
  );
}

/* Public component --------------------------------------------------------- */

export function FoodDrops({
  ids,
  surface,
  contents,
  introAt,
  gap = 0.55,
}: {
  ids: IngredientId[];
  surface: MutableRefObject<SurfaceState>;
  contents: RefObject<THREE.Object3D | null>;
  introAt: number;
  gap?: number;
}) {
  const entries = useEntries(ids, introAt, gap);
  return (
    <>
      {entries.map((e) => {
        const f = FOOD[e.id];
        if (!f) return null;
        return (
          <group key={`${e.id}:${e.at}`}>
            {f.pieces?.map((k, i) => <PieceSet key={i} entry={e} kind={k} kindIndex={i} surface={surface} />)}
            {f.dust && <Dust entry={e} kind={f.dust} surface={surface} contents={contents} />}
            {f.drizzle && <Drizzle entry={e} kind={f.drizzle} surface={surface} contents={contents} />}
          </group>
        );
      })}
    </>
  );
}
