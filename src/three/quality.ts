"use client";

/**
 * Rendering budget per device. Desktop GPUs get the full cinematic stack
 * (ambient occlusion, depth of field, transmission glass); phones get the same
 * composition with cheaper passes so ordering never feels slow.
 */
export type Tier = "high" | "medium" | "low";

export interface QualitySettings {
  tier: Tier;
  dpr: [number, number];
  shadowMap: number;
  ao: boolean;
  dof: boolean;
  bloom: boolean;
  transmission: boolean;
  oatFlakes: number;
  sparkles: number;
}

export const QUALITY: Record<Tier, QualitySettings> = {
  high: { tier: "high", dpr: [1, 1.75], shadowMap: 2048, ao: true, dof: true, bloom: true, transmission: true, oatFlakes: 1100, sparkles: 60 },
  medium: { tier: "medium", dpr: [1, 1.5], shadowMap: 1024, ao: false, dof: true, bloom: true, transmission: false, oatFlakes: 700, sparkles: 36 },
  low: { tier: "low", dpr: [1, 1.25], shadowMap: 1024, ao: false, dof: false, bloom: false, transmission: false, oatFlakes: 420, sparkles: 18 },
};

export function detectTier(): Tier {
  if (typeof window === "undefined") return "medium";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saveData || memory <= 2 || cores <= 2) return "low";
  if (coarse || small) return cores >= 6 && memory >= 4 ? "medium" : "low";
  return cores >= 4 ? "high" : "medium";
}

export const downgrade = (t: Tier): Tier => (t === "high" ? "medium" : "low");
