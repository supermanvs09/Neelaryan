/**
 * The single virtual camera every cut-out sprite was rendered with. Because the
 * bowl layers and the ingredient pieces share it, the browser can stack them
 * and drop pieces onto the oats bed with matching perspective.
 */
export const SPRITE_FOV = 20;
const len = Math.hypot(0, 0.55, 1);
export const SPRITE_DIR: [number, number, number] = [0, 0.55 / len, 1 / len];

export const BOWL_TARGET: [number, number, number] = [0, 0.45, 0];
export const BOWL_DIST = 8.2;
export const BOWL_PX = 1024;

export const PIECE_DIST = 1.2;
export const PIECE_PX = 512;

/** World units spanned by the full sprite width at the target depth. */
export const unitsAcross = (dist: number) => 2 * dist * Math.tan(((SPRITE_FOV / 2) * Math.PI) / 180);

/**
 * Projects a world point (bowl space) into the bowl sprite box.
 * Returns x/y as fractions of the box (0..1) and the perspective scale at that depth.
 */
export function projectToBowl([x, y, z]: [number, number, number]) {
  const [dx, dy, dz] = SPRITE_DIR;
  const cam = [BOWL_TARGET[0] + dx * BOWL_DIST, BOWL_TARGET[1] + dy * BOWL_DIST, BOWL_TARGET[2] + dz * BOWL_DIST];
  // camera basis (matches three.js lookAt with world-up Y): right = +x, up = right × forward
  const fwd = [-dx, -dy, -dz];
  const right = [1, 0, 0];
  const up = [0, -fwd[2], fwd[1]];
  const rel = [x - cam[0], y - cam[1], z - cam[2]];
  const depth = rel[0] * fwd[0] + rel[1] * fwd[1] + rel[2] * fwd[2];
  const sx = rel[0] * right[0] + rel[1] * right[1] + rel[2] * right[2];
  const sy = rel[0] * up[0] + rel[1] * up[1] + rel[2] * up[2];
  const half = Math.tan(((SPRITE_FOV / 2) * Math.PI) / 180) * depth;
  return { x: 0.5 + sx / (2 * half), y: 0.5 - sy / (2 * half), scale: BOWL_DIST / depth };
}
