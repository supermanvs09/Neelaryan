"use client";

import { Suspense, useMemo, type MutableRefObject, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { IngredientId } from "@/data/builders";
import Studio, { useDirector, type Keyframe } from "./Studio";
import { Bowl } from "./Bowl";
import { Prop } from "./Props";
import { FOOD } from "./food";
import type { Tier } from "./quality";
import { clamp01, easeInOutCubic, rng } from "./util";

/** Slow-motion at the start of a shot that ramps back to real time. */
function SpeedRamp({ from, hold, ramp }: { from: number; hold: number; ramp: number }) {
  const { timeScale, reduced } = useDirector();
  const start = useMemo(() => performance.now() / 1000, []);
  useFrame(() => {
    if (reduced) {
      timeScale.current = 1;
      return;
    }
    const t = performance.now() / 1000 - start;
    const p = easeInOutCubic(clamp01((t - hold) / ramp));
    timeScale.current = from + (1 - from) * p;
  });
  return null;
}

/** A few berries resting on the counter close to the lens — they fall into soft bokeh. */
function CounterScatter() {
  const items = useMemo(() => {
    const r = rng(77);
    const spots: [number, number][] = [
      [0.9, 2.2],
      [1.25, 2.05],
      [-1.4, 1.9],
      [2.0, 1.3],
      [-2.2, 0.2],
    ];
    return spots.map(([x, z], i) => ({ x, z, ry: r() * 6, kind: i % 3 === 0 ? "strawberry" : "blueberry" }));
  }, []);
  return (
    <>
      {items.map((it, i) => {
        const k = FOOD[it.kind as IngredientId]!.pieces![0];
        return (
          <mesh
            key={i}
            geometry={k.geometry()}
            material={k.material()}
            position={[it.x, it.kind === "strawberry" ? 0.13 : 0.065, it.z]}
            rotation={it.kind === "strawberry" ? [0, it.ry, Math.PI / 2] : [0, it.ry, 0]}
            castShadow
            dispose={null}
          />
        );
      })}
    </>
  );
}

const HERO_BOWL: IngredientId[] = ["regular-oats", "banana", "strawberry", "blueberry", "almonds", "chia", "honey"];

const HERO_SHOTS: Keyframe[] = [
  // macro: the first flakes and berries tumbling in, slow-motion
  { offset: [1.1, 1.25, 2.4], target: [0, 0.75, 0], focus: [0, 0.9, 0], fov: 24, duration: 1.2 },
  { offset: [1.5, 1.7, 3.0], target: [0, 0.7, 0], focus: [0, 0.75, 0], fov: 25, duration: 2.6 },
  // settle on the hero composition
  { offset: [0.9, 3.1, 6.6], target: [0.15, 0.45, 0], focus: [0, 0.6, 0], fov: 28, duration: 3.6 },
];

export function HeroScene({
  tier,
  reduced,
  fallback,
  scroll,
}: {
  tier: Tier;
  reduced: boolean;
  fallback: ReactNode;
  scroll?: MutableRefObject<number>;
}) {
  return (
    <Studio
      tier={tier}
      reduced={reduced}
      fallback={fallback}
      keyframes={HERO_SHOTS}
      minAspect={1.25}
      scroll={scroll}
      initialTimeScale={0.4}
      className="h-full w-full"
      label="A NEELARYAN oats bowl being built in slow motion on a marble counter in warm sunlight: oats pour in, then banana, strawberries, blueberries and almonds tumble in and honey is drizzled on top. Drag to look around."
    >
      <SpeedRamp from={0.4} hold={3.2} ramp={2.2} />
      <Bowl ingredients={HERO_BOWL} introAt={0.3} gap={0.5} />
      <Suspense fallback={null}>
        <Prop name="pomegranate" position={[-1.75, 0, -1.25]} rotation={[0, 0.6, 0]} />
        <Prop name="apple" position={[-2.25, 0, 0.55]} rotation={[0, 2.1, 0]} />
        <Prop name="kiwi" position={[1.95, 0, 0.75]} rotation={[0, 1.2, 0]} />
        <Prop name="lime" position={[2.45, 0, -0.35]} rotation={[0, 0.3, 0]} />
        <Prop name="bananas" position={[2.9, 0.62, -2.4]} rotation={[0, -0.7, 0]} />
        <Prop name="jug" position={[-3.3, 0, -3.0]} rotation={[0, 0.9, 0]} scale={1.15} />
      </Suspense>
      <CounterScatter />
    </Studio>
  );
}

const BUILDER_SHOTS: Keyframe[] = [
  { offset: [0, 2.1, 2.9], target: [0, 0.55, 0], focus: [0, 0.55, 0], fov: 30, duration: 0.6 },
  { offset: [0.4, 2.8, 3.9], target: [0, 0.45, 0], focus: [0, 0.55, 0], fov: 30, duration: 1.8 },
];

export function BowlBuilderScene({ ingredients, tier, reduced, fallback }: { ingredients: IngredientId[]; tier: Tier; reduced: boolean; fallback: ReactNode }) {
  return (
    <Studio
      tier={tier}
      reduced={reduced}
      fallback={fallback}
      keyframes={BUILDER_SHOTS}
      minAspect={1.15}
      className="h-full w-full"
      label="Your oats bowl in 3D. Each ingredient you pick drops into the bowl. Drag to look around."
    >
      <Bowl ingredients={ingredients} introAt={0.35} gap={0.45} />
    </Studio>
  );
}
