"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/** Photogrammetry scans from Poly Haven (CC0), optimised to WebP + meshopt. */
export const PROP_MODELS = {
  apple: "/models/food_apple_01.glb",
  kiwi: "/models/food_kiwi_01.glb",
  pomegranate: "/models/food_pomegranate_01.glb",
  lime: "/models/food_lime_01.glb",
  bananas: "/models/bananas.glb",
  jug: "/models/jug_01.glb",
} as const;

export type PropName = keyof typeof PROP_MODELS;

/** Scans are in metres; one scene unit is 7.5 cm. */
export const METRE = 1 / 0.075;

export function Prop({
  name,
  position,
  rotation = [0, 0, 0],
  scale = 1,
}: {
  name: PropName;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const { scene } = useGLTF(PROP_MODELS[name]);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat) mat.envMapIntensity = 0.9;
      }
    });
    return c;
  }, [scene]);
  return <primitive object={obj} position={position} rotation={rotation} scale={METRE * scale} />;
}

export function preloadProps(names: PropName[]) {
  names.forEach((n) => useGLTF.preload(PROP_MODELS[n]));
}
