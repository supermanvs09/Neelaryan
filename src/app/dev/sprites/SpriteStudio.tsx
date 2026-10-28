"use client";

import { Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { FOOD } from "@/three/food";
import { Prop, type PropName } from "@/three/Props";
import Studio from "@/three/Studio";
import { Bowl } from "@/three/Bowl";
import type { IngredientId } from "@/data/builders";
import { BOWL_DIST, BOWL_PX, BOWL_TARGET, PIECE_DIST, PIECE_PX, SPRITE_DIR, SPRITE_FOV } from "@/lib/spriteCamera";

/** Resting orientation per ingredient so each sprite shows its best side to the camera. */
const BASE_ROT: Partial<Record<IngredientId, [number, number, number]>> = {
  strawberry: [0, 0, -Math.PI / 2 + 0.25],
  apple: [-Math.PI / 2, 0, 0],
  "plant-protein": [0, 0, 0],
  "whey-protein": [0, 0, 0],
  "icecream-scoop": [0, 0, 0],
  "choco-chips": [0, 0, 0],
};
const VARIANT_YAW = [0.3, 2.4, 4.4];
/** Some pieces need a specific side to face the camera (e.g. apple skin). */
const YAW_OVERRIDE: Partial<Record<IngredientId, number[]>> = {};
/** Large pieces are rendered from further away so they fit the frame. */
export const PIECE_DIST_OVERRIDE: Partial<Record<IngredientId, number>> = { "icecream-scoop": 2.2, "plant-protein": 2, "whey-protein": 2 };
const VARIANT_TILT = [0.12, -0.18, 0.25];

function Lights() {
  return (
    <>
      <ambientLight intensity={0.25} color="#fff1dc" />
      <directionalLight position={[-2, 4, 3]} intensity={2.4} color="#ffe6c0" />
      <directionalLight position={[3, 1, -2]} intensity={0.8} color="#dfe8ff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#fff0d6" position={[-5, 5, 3]} scale={[6, 4, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1} color="#ffffff" position={[5, 3, 2]} scale={[3, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.4} color="#f2d79c" position={[2, 4, 6]} scale={2.5} target={[0, 0, 0]} />
      </Environment>
    </>
  );
}

function FixedCamera({ dist, target }: { dist: number; target: [number, number, number] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(target[0] + SPRITE_DIR[0] * dist, target[1] + SPRITE_DIR[1] * dist, target[2] + SPRITE_DIR[2] * dist);
    camera.lookAt(...target);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    document.body.dataset.ready = "1";
  }, [camera, dist, target]);
  return null;
}

function Fit({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useEffect(() => {
    const t = setInterval(() => {
      const g = group.current;
      if (!g) return;
      const box = new THREE.Box3().setFromObject(g);
      if (box.isEmpty()) return;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const cam = camera as THREE.PerspectiveCamera;
      const dist = (sphere.radius * 1.05) / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2));
      cam.position.copy(sphere.center).add(new THREE.Vector3(...SPRITE_DIR).multiplyScalar(dist));
      cam.lookAt(sphere.center);
      cam.updateProjectionMatrix();
      document.body.dataset.ready = "1";
    }, 300);
    return () => clearInterval(t);
  }, [camera]);
  return <group ref={group}>{children}</group>;
}

function PieceSprite({ id, kind, variant }: { id: IngredientId; kind: number; variant: number }) {
  const k = FOOD[id]?.pieces?.[kind];
  const rot = useMemo(() => {
    const base = new THREE.Euler(...(BASE_ROT[id] ?? [0, 0, 0]));
    const q = new THREE.Quaternion().setFromEuler(base);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (YAW_OVERRIDE[id] ?? VARIANT_YAW)[variant % 3]);
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), VARIANT_TILT[variant % 3]);
    return new THREE.Euler().setFromQuaternion(tilt.multiply(yaw).multiply(q));
  }, [id, variant]);
  if (!k) return null;
  return <mesh geometry={k.geometry()} material={k.material()} rotation={rot} dispose={null} />;
}

function Inner() {
  const q = useSearchParams();
  const mode = q.get("mode") ?? "piece";
  useEffect(() => {
    (globalThis as { __NEEL_MAX_DT?: number }).__NEEL_MAX_DT = 0.25;
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  if (mode === "bowl") {
    const layer = q.get("layer") ?? "back";
    const ids = (q.get("ids") ?? "").split(",").filter(Boolean) as IngredientId[];
    return (
      <div id="stage" style={{ width: BOWL_PX, height: BOWL_PX }}>
        <Studio
          bare
          tier="high"
          reduced={false}
          fallback={null}
          minAspect={0.1}
          label="sprite"
          className="h-full w-full"
          keyframes={[{ offset: SPRITE_DIR.map((v) => v * BOWL_DIST) as [number, number, number], target: BOWL_TARGET, fov: SPRITE_FOV, duration: 0 }]}
        >
          <Bowl
            ingredients={ids}
            introAt={0}
            gap={0.35}
            shell={layer === "front" ? "front" : layer === "bed" ? "none" : "full"}
            contents={layer !== "front" && layer !== "back"}
          />
        </Studio>
      </div>
    );
  }

  const piece = mode === "piece";
  return (
    <div style={{ width: PIECE_PX, height: PIECE_PX }} id="stage">
      <Canvas
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        dpr={1}
        camera={{ fov: SPRITE_FOV, position: [0, 0.55, 1] }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
        }}
      >
        <Lights />
        {piece && <FixedCamera dist={PIECE_DIST_OVERRIDE[(q.get("id") ?? "") as IngredientId] ?? PIECE_DIST} target={[0, 0, 0]} />}
        <Suspense fallback={null}>
          {piece ? (
            <PieceSprite id={(q.get("id") ?? "strawberry") as IngredientId} kind={Number(q.get("k") ?? 0)} variant={Number(q.get("v") ?? 0)} />
          ) : (
            <Fit>
              <Prop name={(q.get("prop") ?? "apple") as PropName} position={[0, 0, 0]} />
            </Fit>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}

export default function SpriteStudio() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
