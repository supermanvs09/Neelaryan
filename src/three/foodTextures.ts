import * as THREE from "three";
import { rng } from "./util";

/**
 * Procedural food textures (diffuse + normal) drawn once on canvases.
 * Normal maps are derived from painted height fields so surfaces catch light
 * like real produce: strawberry seed dimples, almond grooves, kiwi fibres.
 */

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })!] as const;
}

function toTexture(key: string, c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}

function cached(key: string, make: () => THREE.Texture) {
  return cache.get(key) ?? make();
}

/** Converts a grayscale height canvas into a tangent-space normal map. */
function normalFromHeight(key: string, src: HTMLCanvasElement, strength: number) {
  const w = src.width;
  const h = src.height;
  const data = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  const [c, ctx] = canvas(w, h);
  const out = ctx.createImageData(w, h);
  const H = (x: number, y: number) => data[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return toTexture(key, c, false);
}

/* Strawberry skin: deep red with recessed golden achenes ---------------- */
export function strawberrySkin() {
  const key = "strawberry-skin";
  if (cache.has(key)) return { map: cache.get(key)!, normal: cache.get(key + ":n")! };
  const [c, ctx] = canvas(512, 512);
  const [hc, hctx] = canvas(512, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#f2d6b8"); // pale shoulders near the calyx
  g.addColorStop(0.12, "#d8463f");
  g.addColorStop(0.5, "#c3172a");
  g.addColorStop(1, "#a50f22");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  hctx.fillStyle = "#808080";
  hctx.fillRect(0, 0, 512, 512);
  const r = rng(12);
  for (let y = 18; y < 512; y += 30) {
    for (let x = (y / 30) % 2 ? 0 : 15; x < 512; x += 30) {
      const px = x + (r() - 0.5) * 6;
      const py = y + (r() - 0.5) * 6;
      // dimple
      const dg = hctx.createRadialGradient(px, py, 0, px, py, 9);
      dg.addColorStop(0, "#202020");
      dg.addColorStop(1, "rgba(128,128,128,0)");
      hctx.fillStyle = dg;
      hctx.beginPath();
      hctx.arc(px, py, 9, 0, Math.PI * 2);
      hctx.fill();
      // seed
      ctx.fillStyle = "rgba(160,30,30,0.6)";
      ctx.beginPath();
      ctx.ellipse(px, py, 6, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = r() > 0.5 ? "#f0c060" : "#e2a548";
      ctx.beginPath();
      ctx.ellipse(px, py + 1, 2.4, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      hctx.fillStyle = "#b0b0b0";
      hctx.beginPath();
      hctx.ellipse(px, py + 1, 2.4, 3.4, 0, 0, Math.PI * 2);
      hctx.fill();
    }
  }
  const map = toTexture(key, c, true);
  const normal = normalFromHeight(key + ":n", hc, 6);
  return { map, normal };
}

/* Strawberry cross-section: red rim, pink flesh, white core & streaks ---- */
export function strawberryCut() {
  return cached("strawberry-cut", () => {
    const [c, ctx] = canvas(512, 512);
    ctx.fillStyle = "#b8132a";
    ctx.fillRect(0, 0, 512, 512);
    // the cut face is mapped with u across the width and v along the height
    const cx = 256;
    const g = ctx.createRadialGradient(cx, 300, 20, cx, 300, 260);
    g.addColorStop(0, "#fde7e4");
    g.addColorStop(0.35, "#f3a7a6");
    g.addColorStop(0.7, "#df4a52");
    g.addColorStop(0.92, "#c21a30");
    g.addColorStop(1, "#a50f22");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    // pithy core
    ctx.fillStyle = "rgba(255,244,240,0.85)";
    ctx.beginPath();
    ctx.ellipse(cx, 260, 34, 170, 0, 0, Math.PI * 2);
    ctx.fill();
    // radiating vascular streaks
    const r = rng(4);
    ctx.strokeStyle = "rgba(255,236,232,0.55)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 30, 270 + Math.sin(a) * 120);
      ctx.quadraticCurveTo(cx + Math.cos(a) * 120, 270 + Math.sin(a) * 170, cx + Math.cos(a) * (190 + r() * 30), 270 + Math.sin(a) * (220 + r() * 20));
      ctx.stroke();
    }
    return toTexture("strawberry-cut", c, true);
  });
}

/* Kiwi slice face ---------------------------------------------------------- */
export function kiwiFace() {
  return cached("kiwi-face", () => {
    const [c, ctx] = canvas(512, 512);
    ctx.fillStyle = "#5b4426";
    ctx.fillRect(0, 0, 512, 512);
    const g = ctx.createRadialGradient(256, 256, 10, 256, 256, 244);
    g.addColorStop(0, "#fbf7e2");
    g.addColorStop(0.2, "#e9efb4");
    g.addColorStop(0.3, "#a6c94a");
    g.addColorStop(0.85, "#79b02f");
    g.addColorStop(0.96, "#6a9a26");
    g.addColorStop(1, "#4f3b20");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(256, 256, 248, 0, Math.PI * 2);
    ctx.fill();
    const r = rng(8);
    // fibres
    ctx.strokeStyle = "rgba(240,248,200,0.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 120; i++) {
      const a = r() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a) * 80, 256 + Math.sin(a) * 80);
      ctx.lineTo(256 + Math.cos(a) * 236, 256 + Math.sin(a) * 236);
      ctx.stroke();
    }
    // seed ring
    ctx.fillStyle = "#16120c";
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + r() * 0.05;
      const d = 74 + r() * 16;
      ctx.beginPath();
      ctx.ellipse(256 + Math.cos(a) * d, 256 + Math.sin(a) * d, 6, 2.6, a, 0, Math.PI * 2);
      ctx.fill();
    }
    return toTexture("kiwi-face", c, true);
  });
}

/* Banana slice face --------------------------------------------------------- */
export function bananaFace() {
  return cached("banana-face", () => {
    const [c, ctx] = canvas(256, 256);
    const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 126);
    g.addColorStop(0, "#f6e7b0");
    g.addColorStop(0.3, "#fbf0c6");
    g.addColorStop(0.85, "#f4e2a4");
    g.addColorStop(0.95, "#e9d48a");
    g.addColorStop(1, "#cdb05c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "rgba(120,90,50,0.55)";
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      ctx.beginPath();
      ctx.ellipse(128 + Math.cos(a) * 18, 128 + Math.sin(a) * 18, 5, 2.4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(220,200,140,0.6)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110);
      ctx.stroke();
    }
    return toTexture("banana-face", c, true);
  });
}

/* Almond skin with lengthwise grooves ------------------------------------- */
export function almondSkin() {
  const key = "almond";
  if (cache.has(key)) return { map: cache.get(key)!, normal: cache.get(key + ":n")! };
  const [c, ctx] = canvas(256, 256);
  const [hc, hctx] = canvas(256, 256);
  ctx.fillStyle = "#9a5b30";
  ctx.fillRect(0, 0, 256, 256);
  hctx.fillStyle = "#808080";
  hctx.fillRect(0, 0, 256, 256);
  const r = rng(6);
  for (let i = 0; i < 90; i++) {
    const x = r() * 256;
    const w = 1 + r() * 3;
    ctx.fillStyle = r() > 0.5 ? "rgba(70,36,16,0.35)" : "rgba(190,120,70,0.3)";
    ctx.fillRect(x, 0, w, 256);
    hctx.fillStyle = r() > 0.5 ? "#606060" : "#a0a0a0";
    hctx.fillRect(x, 0, w, 256);
  }
  for (let i = 0; i < 400; i++) {
    hctx.fillStyle = "#505050";
    hctx.fillRect(r() * 256, r() * 256, 2, 2);
  }
  const map = toTexture(key, c, true);
  const normal = normalFromHeight(key + ":n", hc, 3);
  return { map, normal };
}

/* Glazed speckled stoneware ---------------------------------------------- */
export function stoneware() {
  const key = "stoneware";
  if (cache.has(key)) return { map: cache.get(key)!, normal: cache.get(key + ":n")! };
  const [c, ctx] = canvas(1024, 512);
  const [hc, hctx] = canvas(1024, 512);
  ctx.fillStyle = "#efe6d4";
  ctx.fillRect(0, 0, 1024, 512);
  hctx.fillStyle = "#808080";
  hctx.fillRect(0, 0, 1024, 512);
  const r = rng(77);
  // soft glaze pooling
  for (let i = 0; i < 40; i++) {
    const x = r() * 1024;
    const y = r() * 512;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 60 + r() * 80);
    g.addColorStop(0, "rgba(226,212,186,0.35)");
    g.addColorStop(1, "rgba(226,212,186,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 140, y - 140, 280, 280);
  }
  for (let i = 0; i < 2600; i++) {
    const x = r() * 1024;
    const y = r() * 512;
    const s = r() < 0.92 ? 0.6 + r() * 1.2 : 1.8 + r() * 1.6;
    ctx.fillStyle = `rgba(${88 + r() * 30},${62 + r() * 22},${40 + r() * 16},${0.35 + r() * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
    hctx.fillStyle = "#6a6a6a";
    hctx.beginPath();
    hctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
    hctx.fill();
  }
  const map = toTexture(key, c, true);
  const normal = normalFromHeight(key + ":n", hc, 1.6);
  return { map, normal };
}

/* Water droplets for a cold glass ----------------------------------------- */
export function condensation() {
  const key = "condensation";
  if (cache.has(key)) return { alpha: cache.get(key)!, normal: cache.get(key + ":n")! };
  const [c, ctx] = canvas(512, 512);
  const [hc, hctx] = canvas(512, 512);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 512, 512);
  hctx.fillStyle = "#000";
  hctx.fillRect(0, 0, 512, 512);
  const r = rng(19);
  const drop = (x: number, y: number, rad: number, elong = 1) => {
    const g = hctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.7, "#999999");
    g.addColorStop(1, "#000000");
    hctx.fillStyle = g;
    hctx.beginPath();
    hctx.ellipse(x, y, rad, rad * elong, 0, 0, Math.PI * 2);
    hctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * elong, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let i = 0; i < 1400; i++) drop(r() * 512, r() * 512, 0.8 + r() * 2.2);
  for (let i = 0; i < 60; i++) drop(r() * 512, r() * 512, 3 + r() * 4, 1.15);
  // a few trickles
  for (let i = 0; i < 6; i++) {
    const x = r() * 512;
    const y0 = r() * 300;
    for (let y = y0; y < y0 + 120 + r() * 80; y += 3) drop(x + Math.sin(y * 0.05) * 2, y, 2.2);
    drop(x, y0 + 200, 6, 1.3);
  }
  const alpha = toTexture(key, c, false);
  const normal = normalFromHeight(key + ":n", hc, 9);
  return { alpha, normal };
}
