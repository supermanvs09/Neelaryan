import type { ArtKind } from "@/data/menu";

/**
 * Hand-built vector food illustrations for items that don't have photography
 * yet. Each is tinted per menu item (liquid colour, filling…), so a Rose Soda
 * and a Blue Lagoon look different at a glance. Replace with real photos later.
 */
export function FoodArt({ kind, tint, className }: { kind: ArtKind; tint: [string, string]; className?: string }) {
  const [a, b] = tint;
  const id = `fa-${kind}-${a.slice(1)}-${b.slice(1)}`;
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${id}-plate`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#efe5d1" />
        </radialGradient>
        <linearGradient id={`${id}-a`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={b} />
          <stop offset="1" stopColor={a} />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" x2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="0.18" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" x2="1">
          <stop offset="0" stopColor="#a8812f" />
          <stop offset="0.5" stopColor="#f0d99a" />
          <stop offset="1" stopColor="#a8812f" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="104" rx="38" ry="6" fill="rgba(60,40,15,0.16)" />
      {ART[kind](id, a, b)}
    </svg>
  );
}

const ART: Record<ArtKind, (id: string, a: string, b: string) => React.ReactNode> = {
  tea: (id, a) => (
    <g>
      <path d="M30 46 h52 l-5 46 q-1 9 -10 9 h-22 q-9 0 -10 -9 z" fill="#fdfaf3" stroke="#d8c9a8" />
      <path d="M33 54 h46 l-4 37 q-1 6 -8 6 h-22 q-7 0 -8 -6 z" fill={a} />
      <path d="M33 54 h46 l-.6 5 h-44.8 z" fill="#fff" opacity="0.35" />
      <path d="M82 58 q14 0 14 12 t-16 13" fill="none" stroke="#d8c9a8" strokeWidth="5" />
      <path d="M30 46 h52" stroke={`url(#${id}-gold)`} strokeWidth="2.4" />
      <path d="M48 36 q-6 -8 0 -16 M60 34 q-6 -9 0 -18 M72 36 q-6 -8 0 -16" fill="none" stroke="#c9b48a" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </g>
  ),
  coffee: (id, a, b) => (
    <g>
      <ellipse cx="60" cy="98" rx="38" ry="8" fill="#fdfaf3" stroke="#d8c9a8" />
      <path d="M30 52 h56 l-6 36 q-2 10 -12 10 h-20 q-10 0 -12 -10 z" fill="#fdfaf3" stroke="#d8c9a8" />
      <ellipse cx="58" cy="52" rx="28" ry="7" fill={a} />
      <path d="M46 52 q12 -6 24 0 q-12 6 -24 0z" fill={b} />
      <path d="M53 52 q5 -3 10 0 q-5 3 -10 0z" fill={a} opacity="0.6" />
      <path d="M86 60 q13 1 12 12 t-15 11" fill="none" stroke="#d8c9a8" strokeWidth="5" />
      <ellipse cx="58" cy="52" rx="28" ry="7" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2" />
    </g>
  ),
  soda: (id, a, b) => (
    <g>
      <path d="M36 24 h48 l-6 72 q-1 6 -7 6 h-22 q-6 0 -7 -6 z" fill="#ffffff" fillOpacity="0.5" stroke="#cfd7da" />
      <path d="M38 40 h44 l-4.8 55 q-1 5 -6 5 h-22.4 q-5 0 -6 -5 z" fill={`url(#${id}-a)`} opacity="0.92" />
      {[48, 58, 66, 52, 70, 62].map((x, i) => (
        <circle key={i} cx={x} cy={88 - i * 8} r={1.6 + (i % 3)} fill="#fff" opacity="0.7" />
      ))}
      <circle cx="80" cy="30" r="12" fill="#f4e27a" stroke="#d9c04a" />
      <path d="M80 18 v24 M68 30 h24 M71.5 21.5 l17 17 M88.5 21.5 l-17 17" stroke="#fffbe0" strokeWidth="1.3" />
      <rect x="54" y="10" width="4" height="56" rx="2" fill={b} transform="rotate(14 56 38)" />
      <path d="M36 24 h48 l-6 72 q-1 6 -7 6 h-22 q-6 0 -7 -6 z" fill={`url(#${id}-glass)`} />
      <path d="M36 24 h48" stroke={`url(#${id}-gold)`} strokeWidth="2" />
    </g>
  ),
  iced: (id, a, b) => (
    <g>
      <path d="M34 26 h52 l-7 70 q-1 6 -7 6 h-24 q-6 0 -7 -6 z" fill="#ffffff" fillOpacity="0.45" stroke="#cfd7da" />
      <path d="M36 44 h48 l-5.3 52 q-1 5 -6 5 h-25.4 q-5 0 -6 -5 z" fill={a} />
      <path d="M36 44 h48 l-1 9 h-46z" fill={b} />
      <rect x="44" y="50" width="13" height="13" rx="3" fill="#fff" opacity="0.5" transform="rotate(12 50 56)" />
      <rect x="62" y="56" width="12" height="12" rx="3" fill="#fff" opacity="0.45" transform="rotate(-10 68 62)" />
      <path d="M50 24 q12 -10 22 0 q4 6 -4 10 h-14 q-8 -4 -4 -10z" fill="#fffaf0" stroke="#e6dccb" />
      <rect x="66" y="6" width="4" height="58" rx="2" fill="#10264a" transform="rotate(12 68 35)" />
      <path d="M34 26 h52 l-7 70 q-1 6 -7 6 h-24 q-6 0 -7 -6 z" fill={`url(#${id}-glass)`} />
    </g>
  ),
  chaat: (id, a, b) => (
    <g>
      <path d="M18 62 q42 4 84 0 q-4 34 -42 36 q-38 -2 -42 -36z" fill="#fdfaf3" stroke="#d8c9a8" />
      <ellipse cx="60" cy="62" rx="42" ry="10" fill={a} />
      {Array.from({ length: 22 }, (_, i) => (
        <circle key={i} cx={26 + ((i * 37) % 68)} cy={56 + ((i * 13) % 11)} r={2 + (i % 3)} fill={i % 3 === 0 ? b : i % 3 === 1 ? "#6fae4a" : "#f4ead2"} />
      ))}
      <path d="M18 62 q42 4 84 0" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2" />
      <path d="M72 38 l18 -14" stroke="#c9a04a" strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  eggs: (id, a, b) => (
    <g>
      <ellipse cx="60" cy="80" rx="46" ry="16" fill={`url(#${id}-plate)`} stroke="#d8c9a8" />
      <ellipse cx="46" cy="72" rx="15" ry="11" fill="#fffdf6" stroke="#eadfca" />
      <circle cx="46" cy="72" r="6.5" fill={b} />
      <ellipse cx="74" cy="76" rx="15" ry="11" fill="#fffdf6" stroke="#eadfca" />
      <circle cx="74" cy="76" r="6.5" fill={b} />
      {[40, 52, 70, 80].map((x, i) => (
        <circle key={i} cx={x} cy={68 + (i % 2) * 8} r="1.2" fill={a === "#f7f1e3" ? "#8a5a32" : "#c2412a"} />
      ))}
    </g>
  ),
  omelette: (id, a, b) => (
    <g>
      <ellipse cx="60" cy="80" rx="48" ry="17" fill={`url(#${id}-plate)`} stroke="#d8c9a8" />
      <path d="M22 76 q38 -26 76 0 q-38 18 -76 0z" fill={a} />
      <path d="M22 76 q38 -26 76 0" fill="none" stroke="#e4b43c" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={30 + ((i * 29) % 58)} y={68 + ((i * 7) % 10)} width="4" height="2.4" rx="1" fill={i % 2 ? b : "#6fae4a"} transform={`rotate(${i * 30} ${32 + ((i * 29) % 58)} 70)`} />
      ))}
    </g>
  ),
  sandwich: (id, a, b) => (
    <g>
      <ellipse cx="60" cy="86" rx="46" ry="12" fill={`url(#${id}-plate)`} stroke="#d8c9a8" />
      <path d="M22 78 L60 40 L98 78z" fill="#e9c88f" stroke="#c99b5a" />
      <path d="M26 78 L60 46 L94 78z" fill="#f8ead0" />
      <path d="M27 77 L60 50 L93 77" fill="none" stroke={a} strokeWidth="5" />
      <path d="M30 79 L60 55 L90 79" fill="none" stroke={b} strokeWidth="3.5" />
      <path d="M22 80 h76 v4 h-76z" fill="#e2b679" />
      <path d="M58 30 v28" stroke="#c9a04a" strokeWidth="2" />
      <circle cx="58" cy="28" r="3" fill={`url(#${id}-gold)`} />
    </g>
  ),
  wrap: (id, a, b) => (
    <g>
      <ellipse cx="60" cy="88" rx="46" ry="11" fill={`url(#${id}-plate)`} stroke="#d8c9a8" />
      <g transform="rotate(-18 60 64)">
        <rect x="26" y="52" width="70" height="26" rx="13" fill="#efd3a0" stroke="#c99b5a" />
        <ellipse cx="94" cy="65" rx="9" ry="13" fill={a} />
        <ellipse cx="94" cy="65" rx="5" ry="8" fill={b} />
        {[40, 54, 68].map((x) => (
          <path key={x} d={`M${x} 54 q4 11 0 22`} fill="none" stroke="#d6a868" strokeWidth="1.4" opacity="0.7" />
        ))}
      </g>
      <path d="M30 86 q12 -8 26 0" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2" />
    </g>
  ),
  rice: (id, a, b) => (
    <g>
      <path d="M16 58 q44 4 88 0 q-4 38 -44 40 q-40 -2 -44 -40z" fill="#fdfaf3" stroke="#d8c9a8" />
      <ellipse cx="60" cy="58" rx="44" ry="11" fill="#fbf7ee" />
      {Array.from({ length: 30 }, (_, i) => (
        <ellipse key={i} cx={24 + ((i * 23) % 72)} cy={53 + ((i * 11) % 10)} rx="2.6" ry="1.1" fill="#ffffff" stroke="#ece4d2" strokeWidth="0.5" transform={`rotate(${i * 25} ${24 + ((i * 23) % 72)} ${53 + ((i * 11) % 10)})`} />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={46 + (i % 4) * 8} y={50 + Math.floor(i / 4) * 7} width="7" height="6" rx="1.6" fill={a} stroke={b} strokeWidth="0.8" />
      ))}
      <path d="M16 58 q44 4 88 0" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2" />
    </g>
  ),
  oats: (id, a, b) => (
    <g>
      <path d="M16 58 q44 4 88 0 q-4 38 -44 40 q-40 -2 -44 -40z" fill="#fdfaf3" stroke="#d8c9a8" />
      <ellipse cx="60" cy="58" rx="44" ry="11" fill="#e2c995" />
      {Array.from({ length: 10 }, (_, i) => (
        <circle key={i} cx={32 + ((i * 19) % 56)} cy={54 + ((i * 7) % 8)} r="4" fill={i % 2 ? a : b} />
      ))}
      <path d="M16 58 q44 4 88 0" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2" />
    </g>
  ),
  shake: (id) => (
    <g>
      <path d="M36 30 h48 l-7 66 q-1 6 -7 6 h-20 q-6 0 -7 -6 z" fill={`url(#${id}-a)`} stroke="#cfd7da" />
      <path d="M38 30 q22 -16 44 0" fill="#fffaf0" stroke="#e6dccb" />
      <path d="M36 30 h48 l-7 66 q-1 6 -7 6 h-20 q-6 0 -7 -6 z" fill={`url(#${id}-glass)`} />
      <rect x="62" y="6" width="4" height="40" rx="2" fill="#10264a" transform="rotate(10 64 26)" />
    </g>
  ),
  icecream: (id, a, b) => (
    <g>
      <path d="M30 66 h60 l-8 28 q-2 6 -8 6 h-28 q-6 0 -8 -6z" fill="#fdfaf3" stroke="#d8c9a8" />
      <path d="M30 66 h60" stroke={`url(#${id}-gold)`} strokeWidth="2.2" />
      <circle cx="48" cy="58" r="15" fill={a} />
      <circle cx="70" cy="56" r="15" fill={b === "#2b2421" ? "#efeae2" : a} />
      <circle cx="59" cy="42" r="13" fill={a} />
      <path d="M44 48 q8 -6 14 2 M62 34 q6 -3 10 3" fill="none" stroke="#fff" strokeWidth="2" opacity="0.5" strokeLinecap="round" />
      {[46, 56, 66, 74].map((x, i) => (
        <rect key={x} x={x} y={44 + (i % 2) * 8} width="4" height="2" rx="1" fill={b} transform={`rotate(${i * 40} ${x} 46)`} />
      ))}
    </g>
  ),
};
