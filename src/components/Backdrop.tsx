/**
 * Warm sunlight + soft botanical leaf shadows drifting across the page —
 * the mood of the NEELARYAN logo shoot. Pure CSS/SVG, pointer-events off.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ivory">
      <div className="absolute -left-[20%] -top-[30%] h-[90vh] w-[90vh] rounded-full bg-[radial-gradient(circle,rgba(255,226,170,0.55),rgba(255,226,170,0)_65%)]" />
      <div className="absolute -bottom-[35%] -right-[15%] h-[80vh] w-[80vh] rounded-full bg-[radial-gradient(circle,rgba(232,211,160,0.45),rgba(232,211,160,0)_65%)]" />
      <svg className="absolute -right-[8%] -top-[6%] h-[70vh] w-[70vh] animate-sway opacity-[0.10] blur-[10px]" viewBox="0 0 400 400">
        <Leaves />
      </svg>
      <svg className="absolute -bottom-[10%] -left-[10%] h-[55vh] w-[55vh] rotate-[160deg] animate-sway opacity-[0.07] blur-[12px] [animation-delay:-6s]" viewBox="0 0 400 400">
        <Leaves />
      </svg>
      {/* fine paper grain */}
      <div className="absolute inset-0 opacity-[0.35] mix-blend-multiply [background-image:url(/textures/grain.svg)]" />
    </div>
  );
}

function Leaves() {
  const leaf = "M0 0 C 30 -18, 70 -18, 100 0 C 70 18, 30 18, 0 0 Z";
  return (
    <g fill="#2f3a22">
      <path d="M40 20 C 140 120, 220 200, 380 380" stroke="#2f3a22" strokeWidth="6" fill="none" />
      {Array.from({ length: 10 }, (_, i) => {
        const t = i / 10;
        const x = 40 + 340 * t;
        const y = 20 + 360 * t * t * 0.6 + 120 * t;
        const a = (i % 2 ? 35 : -55) + i * 4;
        return <path key={i} d={leaf} transform={`translate(${x} ${y}) rotate(${a}) scale(${0.9 + (i % 3) * 0.2})`} />;
      })}
    </g>
  );
}
