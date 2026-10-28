"use client";

import {
  Component,
  createContext,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor, useTexture } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, N8AO, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode, type DepthOfFieldEffect } from "postprocessing";
import { Physics, useRapier } from "@react-three/rapier";
import * as THREE from "three";
import { downgrade, QUALITY, type QualitySettings, type Tier } from "./quality";
import { clamp01, easeInOutCubic, leafGoboTexture } from "./util";

/* Director: shared clock, focus point and camera plan ------------------- */

export interface Shot {
  /** Camera position relative to the target. */
  offset: [number, number, number];
  target: [number, number, number];
  /** World point kept in focus (defaults to target). */
  focus?: [number, number, number];
  fov?: number;
}

export interface Keyframe extends Shot {
  /** Seconds to travel from the previous keyframe to this one. */
  duration: number;
}

interface Director {
  quality: QualitySettings;
  reduced: boolean;
  /** Physics/animation time multiplier — < 1 for slow motion. */
  timeScale: MutableRefObject<number>;
  focus: THREE.Vector3;
  /** Seconds since the scene started (scaled by timeScale). */
  clock: MutableRefObject<number>;
}

const DirectorContext = createContext<Director | null>(null);

export function useDirector() {
  const d = useContext(DirectorContext);
  if (!d) throw new Error("useDirector must be used inside <Studio>");
  return d;
}

/* Lighting ---------------------------------------------------------------- */

function StudioLights({ quality, reduced }: { quality: QualitySettings; reduced: boolean }) {
  const sun = useRef<THREE.SpotLight>(null);
  const gobo = useMemo(() => {
    const t = leafGoboTexture().clone();
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.center.set(0.5, 0.5);
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(() => () => gobo.dispose(), [gobo]);

  useEffect(() => {
    const s = sun.current;
    if (!s) return;
    s.target.position.set(0, 0, 0);
    s.target.updateMatrixWorld();
  }, []);

  // leaves sway gently in a breeze
  useFrame(() => {
    if (reduced) return;
    const t = performance.now() / 1000;
    gobo.offset.set(Math.sin(t * 0.35) * 0.02 + Math.sin(t * 1.1) * 0.006, Math.cos(t * 0.27) * 0.015);
    gobo.rotation = Math.sin(t * 0.2) * 0.03;
  });

  return (
    <>
      <ambientLight intensity={0.18} color="#fff1dc" />
      <spotLight
        ref={sun}
        position={[-6.5, 9, 5.5]}
        angle={0.55}
        penumbra={0.9}
        intensity={190}
        decay={2}
        color="#ffe2b0"
        map={gobo}
        castShadow
        shadow-mapSize={[quality.shadowMap, quality.shadowMap]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={6}
        shadow-camera-near={4}
        shadow-camera-far={22}
      />
      {/* cool back rim to separate the subject from the backdrop */}
      <directionalLight position={[4, 3.5, -6]} intensity={0.9} color="#dfe8ff" />
      <Environment resolution={256} frames={1} environmentIntensity={0.8}>
        <Lightformer form="rect" intensity={2.4} color="#fff0d6" position={[-5, 5, 3]} scale={[6, 4, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[5, 3, 2]} scale={[3, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.9} color="#ffe7c2" position={[0, 6, -6]} scale={[10, 2, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.6} color="#f2d79c" position={[2, 4, 6]} scale={2.5} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.5} color="#f4e6cc" position={[0, -3, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[20, 20, 1]} />
      </Environment>
    </>
  );
}

/* Set: polished cream marble counter + warm out-of-focus backdrop ------- */

function MarbleCounter() {
  const [map, rough] = useTexture(["/textures/marble_diff.webp", "/textures/marble_rough.webp"]);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [map, rough]) {
      t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
      t.repeat.set(2.5, 2.5);
      t.anisotropy = 8;
      t.needsUpdate = true;
    }
  }, [map, rough]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshPhysicalMaterial map={map} roughnessMap={rough} roughness={1} clearcoat={0.55} clearcoatRoughness={0.18} envMapIntensity={0.7} />
    </mesh>
  );
}

function Backdrop() {
  const mat = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#d9c6a3");
    g.addColorStop(0.55, "#efe2c8");
    g.addColorStop(1, "#f6ecd9");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false });
  }, []);
  useEffect(() => () => {
    mat.map?.dispose();
    mat.dispose();
  }, [mat]);
  return (
    <mesh position={[0, 6, -14]} material={mat}>
      <planeGeometry args={[60, 16]} />
    </mesh>
  );
}

/* Camera ------------------------------------------------------------------ */

const v3 = (a: [number, number, number]) => new THREE.Vector3(...a);

/**
 * Plays an intro of keyframes, then rests on the final shot with a gentle
 * handheld drift, pointer parallax, drag-to-orbit and scroll crane.
 */
function CameraRig({
  keyframes,
  minAspect,
  scroll,
  orbit,
}: {
  keyframes: Keyframe[];
  minAspect: number;
  scroll?: MutableRefObject<number>;
  orbit: boolean;
}) {
  const { camera, size, gl, pointer } = useThree();
  const { reduced, focus } = useDirector();
  const startAt = useRef(performance.now() / 1000);
  const drag = useRef({ az: 0, azVel: 0, active: false, lastX: 0, lastInteract: -10 });
  const tmp = useMemo(
    () => ({ pos: new THREE.Vector3(), tgt: new THREE.Vector3(), foc: new THREE.Vector3(), off: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3() }),
    [],
  );

  useEffect(() => {
    startAt.current = performance.now() / 1000;
  }, [keyframes]);

  useEffect(() => {
    if (!orbit) return;
    const el = gl.domElement;
    const d = drag.current;
    const down = (e: PointerEvent) => {
      d.active = true;
      d.lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!d.active) return;
      const dx = e.clientX - d.lastX;
      d.lastX = e.clientX;
      d.az = THREE.MathUtils.clamp(d.az - dx * 0.006, -1.1, 1.1);
      d.azVel = -dx * 0.006;
      d.lastInteract = performance.now() / 1000;
    };
    const up = () => (d.active = false);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [gl, orbit]);

  useFrame((_, dt) => {
    const t = performance.now() / 1000 - startAt.current;
    const frames = reduced ? keyframes.slice(-1) : keyframes;

    // find the active segment of the intro
    let acc = 0;
    let from = frames[0];
    let to = frames[0];
    let p = 1;
    for (let i = 0; i < frames.length; i++) {
      const k = frames[i];
      if (i === 0) {
        acc += k.duration;
        if (t < acc) {
          from = to = k;
          p = 1;
          break;
        }
        from = to = k;
        continue;
      }
      if (t < acc + k.duration) {
        from = frames[i - 1];
        to = k;
        p = easeInOutCubic(clamp01((t - acc) / k.duration));
        break;
      }
      acc += k.duration;
      from = to = k;
      p = 1;
    }

    tmp.off.copy(v3(from.offset)).lerp(tmp.a.set(...to.offset), p);
    tmp.tgt.copy(v3(from.target)).lerp(tmp.b.set(...to.target), p);
    tmp.foc.copy(v3(from.focus ?? from.target)).lerp(tmp.a.set(...(to.focus ?? to.target)), p);
    const fov = THREE.MathUtils.lerp(from.fov ?? 28, to.fov ?? 28, p);

    // portrait screens: step back so the subject still fits
    const aspect = size.width / Math.max(1, size.height);
    const fit = aspect < minAspect ? Math.pow(minAspect / aspect, 0.85) : 1;
    tmp.off.multiplyScalar(fit);

    // drag orbit with inertia, easing back to centre when idle
    const d = drag.current;
    if (!d.active) {
      d.az += d.azVel;
      d.azVel *= Math.pow(0.02, dt);
      const now = performance.now() / 1000;
      if (now - d.lastInteract > 3.5) d.az *= Math.pow(0.35, dt);
    }
    tmp.off.applyAxisAngle(THREE.Object3D.DEFAULT_UP, d.az);

    // scroll crane: rise and look down as the hero scrolls away
    const s = scroll ? clamp01(scroll.current) : 0;
    if (s > 0) {
      tmp.off.y += s * 2.6;
      tmp.off.multiplyScalar(1 - s * 0.12);
    }

    tmp.pos.copy(tmp.tgt).add(tmp.off);
    if (!reduced) {
      const now = performance.now() / 1000;
      // handheld micro-drift + pointer parallax
      tmp.pos.x += Math.sin(now * 0.6) * 0.025 + Math.sin(now * 1.7) * 0.008 + pointer.x * 0.18;
      tmp.pos.y += Math.sin(now * 0.45 + 1) * 0.02 + pointer.y * 0.1;
    }

    const k = 1 - Math.exp(-dt * (t < 0.1 ? 60 : 5));
    camera.position.lerp(tmp.pos, k);
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov += (fov - cam.fov) * k;
      cam.updateProjectionMatrix();
    }
    camera.lookAt(tmp.tgt);
    focus.lerp(tmp.foc, k);
  });

  return null;
}

/* Physics clock with speed ramps ---------------------------------------- */

function PhysicsClock() {
  const { step } = useRapier();
  const { timeScale, clock } = useDirector();
  useFrame((_, dt) => {
    // sub-step so slow devices (or a long frame) stay stable instead of tunnelling
    const maxDt = (globalThis as { __NEEL_MAX_DT?: number }).__NEEL_MAX_DT ?? 0.1;
    let d = Math.min(dt, maxDt) * timeScale.current;
    clock.current += d;
    while (d > 1e-5) {
      const s = Math.min(d, 1 / 60);
      step(s);
      d -= s;
    }
  });
  return null;
}

/* Post-production --------------------------------------------------------- */

function Post({ quality }: { quality: QualitySettings }) {
  const { focus } = useDirector();
  const dof = useRef<DepthOfFieldEffect>(null);
  useFrame(() => {
    if (dof.current?.target) dof.current.target.copy(focus);
  });
  return (
    <EffectComposer multisampling={0} stencilBuffer={false}>
      <>{quality.ao && <N8AO aoRadius={0.55} distanceFalloff={0.6} intensity={2.4} quality="medium" halfRes color="#3a2a14" />}</>
      <>{quality.dof && <DepthOfField ref={dof} target={[0, 0.5, 0]} worldFocusRange={quality.tier === "high" ? 2.6 : 3.2} bokehScale={quality.tier === "high" ? 4.5 : 3} resolutionScale={quality.tier === "high" ? 0.75 : 0.5} />}</>
      <>{quality.bloom && <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={0.32} />}</>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.5} />
      <>{quality.tier !== "low" && <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.22} />}</>
      <SMAA />
    </EffectComposer>
  );
}

/* Studio ------------------------------------------------------------------ */

class GLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("3D scene unavailable — showing fallback.", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface StudioProps {
  children: ReactNode;
  fallback: ReactNode;
  tier: Tier;
  reduced: boolean;
  keyframes: Keyframe[];
  minAspect?: number;
  scroll?: MutableRefObject<number>;
  orbit?: boolean;
  className?: string;
  label: string;
  /** Initial physics time scale (slow-motion intros start below 1). */
  initialTimeScale?: number;
  onReady?: () => void;
}

export default function Studio({
  children,
  fallback,
  tier: initialTier,
  reduced,
  keyframes,
  minAspect = 1.2,
  scroll,
  orbit = true,
  className,
  label,
  initialTimeScale = 1,
}: StudioProps) {
  const host = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<Tier>(initialTier);
  const [visible, setVisible] = useState(true);
  const [lost, setLost] = useState(false);
  const quality = QUALITY[tier];
  const timeScale = useRef(reduced ? 1 : initialTimeScale);
  const clock = useRef(0);
  const focus = useMemo(() => new THREE.Vector3(0, 0.5, 0), []);
  const director = useMemo<Director>(() => ({ quality, reduced, timeScale, focus, clock }), [quality, reduced, focus]);

  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "160px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (lost) return <>{fallback}</>;

  return (
    <div ref={host} className={className} role="img" aria-label={label} style={{ touchAction: "pan-y", cursor: orbit ? "grab" : undefined }}>
      <GLBoundary fallback={fallback}>
        <Canvas
          shadows="soft"
          dpr={quality.dpr}
          flat
          frameloop={visible ? "always" : "never"}
          gl={{ antialias: false, alpha: false, powerPreference: "high-performance", stencil: false }}
          camera={{ fov: 28, near: 0.1, far: 80, position: [0, 3, 9] }}
          onCreated={({ gl, scene }) => {
            scene.background = new THREE.Color("#eadcc0");
            scene.fog = new THREE.Fog("#eadcc0", 14, 30);
            gl.localClippingEnabled = true;
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
              setLost(true);
            });
          }}
        >
          <DirectorContext.Provider value={director}>
            <PerformanceMonitor onDecline={() => setTier((t) => downgrade(t))} flipflops={2} />
            <StudioLights quality={quality} reduced={reduced} />
            <Suspense fallback={null}>
              <MarbleCounter />
            </Suspense>
            <Backdrop />
            <Physics paused timeStep="vary" gravity={[0, -22, 0]}>
              <PhysicsClock />
              <Suspense fallback={null}>{children}</Suspense>
            </Physics>
            <CameraRig keyframes={keyframes} minAspect={minAspect} scroll={scroll} orbit={orbit} />
            <Post quality={quality} />
          </DirectorContext.Provider>
        </Canvas>
      </GLBoundary>
    </div>
  );
}
