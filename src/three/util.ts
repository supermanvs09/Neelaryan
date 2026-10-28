import * as THREE from "three";

/** Deterministic PRNG so ingredient layouts are stable between renders. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function easeOutBounce(x: number) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

/** A softer settle than a full bounce — one small hop. */
export function easeOutDrop(x: number) {
  const b = easeOutBounce(x);
  return b * 0.35 + (1 - Math.pow(1 - x, 3)) * 0.65;
}

export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const textureCache = new Map<string, THREE.Texture>();

function canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true) {
  const cached = textureCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

/** Speckled stoneware glaze for the bowl. */
export function ceramicTexture() {
  return canvasTexture("ceramic", 512, 256, (ctx) => {
    ctx.fillStyle = "#efe5d3";
    ctx.fillRect(0, 0, 512, 256);
    const r = rng(7);
    for (let i = 0; i < 1400; i++) {
      const s = r() * 1.6 + 0.3;
      ctx.fillStyle = `rgba(${90 + r() * 40},${70 + r() * 30},${50 + r() * 20},${0.25 + r() * 0.45})`;
      ctx.beginPath();
      ctx.arc(r() * 512, r() * 256, s, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** "Neelaryan" wordmark band wrapped around the bowl / glass. */
export function brandBandTexture(fontFamily: string, physicalAspect: number, color = "#0b1a33") {
  return canvasTexture(`band:${fontFamily}:${color}:${physicalAspect.toFixed(2)}`, 2048, 256, (ctx) => {
    ctx.clearRect(0, 0, 2048, 256);
    // the band wraps the whole circumference; squeeze/stretch so letters keep their proportions
    const sx = 2048 / 256 / physicalAspect;
    ctx.translate(1024, 0);
    ctx.scale(sx, 1);
    ctx.translate(-1024, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.font = `600 132px ${fontFamily}`;
    ctx.fillText("Neelaryan", 1024, 104);
    ctx.font = `600 26px ${fontFamily}`;
    ctx.fillStyle = "#a8812f";
    const tag = "C R A V E   T H E   G O O D N E S S";
    ctx.fillText(tag, 1024, 196);
    // gold swash under the wordmark
    ctx.strokeStyle = "#c9a04a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(812, 160);
    ctx.bezierCurveTo(930, 182, 1110, 140, 1240, 156);
    ctx.stroke();
  });
}

export function bananaTexture() {
  return canvasTexture("banana", 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, "#fbf0c4");
    g.addColorStop(0.55, "#f6e6a6");
    g.addColorStop(0.9, "#efd98a");
    g.addColorStop(1, "#e6cf7c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "rgba(150,110,60,0.55)";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(64 + Math.cos(a) * 12, 64 + Math.sin(a) * 12, 3, 1.6, a, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function kiwiTexture() {
  return canvasTexture("kiwi", 128, 128, (ctx) => {
    ctx.fillStyle = "#6a4a2a";
    ctx.fillRect(0, 0, 128, 128);
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
    g.addColorStop(0, "#f4f1d6");
    g.addColorStop(0.22, "#dfe7a8");
    g.addColorStop(0.3, "#9cc23e");
    g.addColorStop(0.95, "#6fa52a");
    g.addColorStop(1, "#5d8c22");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d1a12";
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(64 + Math.cos(a) * 22, 64 + Math.sin(a) * 22, 2.6, 1.3, a, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function strawberryTexture() {
  return canvasTexture("strawberry", 256, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#b8142a");
    g.addColorStop(0.6, "#dd2b3c");
    g.addColorStop(1, "#c41d31");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const r = rng(3);
    for (let y = 12; y < 240; y += 18) {
      for (let x = (y / 18) % 2 ? 0 : 9; x < 256; x += 18) {
        ctx.fillStyle = "rgba(255,226,140,0.95)";
        ctx.beginPath();
        ctx.ellipse(x + r() * 3, y + r() * 3, 2.2, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Soft radial blob used as a fake contact shadow. */
export function shadowTexture() {
  return canvasTexture(
    "shadow",
    256,
    256,
    (ctx) => {
      const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
      g.addColorStop(0, "rgba(40,28,10,0.55)");
      g.addColorStop(0.45, "rgba(40,28,10,0.25)");
      g.addColorStop(1, "rgba(40,28,10,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    },
    false,
  );
}

export function strawTexture() {
  return canvasTexture("straw", 64, 256, (ctx) => {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? "#c9a04a" : "#10264a";
      ctx.fillRect(0, i * 16, 64, 16);
    }
  });
}

/** Vertical chocolate/caramel drips painted on the inside of the glass. */
export function dripTexture(color: string) {
  return canvasTexture(`drip:${color}`, 512, 256, (ctx) => {
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = color;
    const r = rng(11);
    ctx.fillRect(0, 0, 512, 22);
    for (let x = 0; x < 512; x += 24 + r() * 26) {
      const len = 40 + r() * 170;
      const w = 6 + r() * 9;
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, len);
      ctx.arc(x + w / 2, len, w / 2, Math.PI, 0, true);
      ctx.lineTo(x + w, 10);
      ctx.fill();
    }
  });
}

export function oatsTexture(tint: string) {
  return canvasTexture(`oats:${tint}`, 512, 512, (ctx) => {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 512, 512);
    const r = rng(21);
    for (let i = 0; i < 900; i++) {
      const x = r() * 512;
      const y = r() * 512;
      const s = 6 + r() * 10;
      const l = 70 + r() * 18;
      ctx.fillStyle = `hsla(38, ${40 + r() * 20}%, ${l}%, ${0.55 + r() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * (0.5 + r() * 0.3), r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(120,85,40,${0.12 + r() * 0.15})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
}

/** Gold dust sprite. */
export function sparkleTexture() {
  return canvasTexture("sparkle", 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,240,200,1)");
    g.addColorStop(0.3, "rgba(232,200,120,0.6)");
    g.addColorStop(1, "rgba(201,160,74,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/**
 * Leaf-shadow gobo projected by the sun spotlight: soft botanical shadows like
 * sunlight through a café window (the mood of the NEELARYAN logo shoot).
 */
export function leafGoboTexture() {
  return canvasTexture("gobo", 512, 512, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 512);
    const r = rng(31);
    ctx.filter = "blur(7px)";
    ctx.fillStyle = "rgba(40,44,30,0.78)";
    const leaf = (x: number, y: number, len: number, w: number, a: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.5, -w, len, 0);
      ctx.quadraticCurveTo(len * 0.5, w, 0, 0);
      ctx.fill();
      ctx.restore();
    };
    // a few branches with leaves, mostly in the upper/side parts of the frame
    for (let b = 0; b < 5; b++) {
      const bx = r() * 512;
      const by = r() * 220 - 40;
      const ba = Math.PI * (0.25 + r() * 0.5);
      ctx.strokeStyle = "rgba(40,44,30,0.7)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      const ex = bx + Math.cos(ba) * 260;
      const ey = by + Math.sin(ba) * 260;
      ctx.quadraticCurveTo(bx + 60, by + 120, ex, ey);
      ctx.stroke();
      for (let i = 0; i < 9; i++) {
        const t = i / 9;
        const lx = bx + (ex - bx) * t + (r() - 0.5) * 20;
        const ly = by + (ey - by) * t + (r() - 0.5) * 20;
        leaf(lx, ly, 60 + r() * 50, 14 + r() * 12, ba + (i % 2 ? 0.9 : -0.9) + (r() - 0.5) * 0.5);
      }
    }
    ctx.filter = "none";
    // window-frame light falloff so the gobo never hard-clips
    const g = ctx.createRadialGradient(256, 256, 120, 256, 256, 300);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  });
}
