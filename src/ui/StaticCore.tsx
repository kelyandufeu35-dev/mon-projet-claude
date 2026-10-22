/**
 * Static illustration of the core, used when WebGL is unavailable. Pure SVG,
 * same palette and proportions as the 3D object.
 */
export function StaticCore() {
  const petals = Array.from({ length: 6 }, (_, i) => i * 60);
  return (
    <div className="static-core" aria-hidden="true">
      <svg viewBox="-260 -260 520 520">
        <defs>
          <radialGradient id="sc-core" cx="45%" cy="40%" r="60%">
            <stop offset="0" stopColor="#eaffff" />
            <stop offset=".35" stopColor="#6ff2ff" />
            <stop offset=".8" stopColor="#0b5c74" />
            <stop offset="1" stopColor="#03222e" />
          </radialGradient>
          <radialGradient id="sc-glow">
            <stop offset="0" stopColor="#58f0ff" stopOpacity=".45" />
            <stop offset="1" stopColor="#58f0ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sc-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4a525c" />
            <stop offset=".45" stopColor="#1b1f24" />
            <stop offset="1" stopColor="#0c0e11" />
          </linearGradient>
        </defs>
        <circle r="250" fill="url(#sc-glow)" />
        {/* Halo */}
        <ellipse rx="245" ry="38" fill="none" stroke="#58f0ff" strokeOpacity=".35" />
        <ellipse rx="225" ry="30" fill="none" stroke="#ff7a2f" strokeOpacity=".25" transform="rotate(-4)" />
        {/* Shell petals: front-facing silhouettes */}
        {petals.map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M-38 -150 A 160 160 0 0 1 38 -150 L 30 -78 A 92 92 0 0 0 -30 -78 Z" fill="url(#sc-metal)" stroke="#2c333b" />
            <rect x="-20" y="-88" width="40" height="3" fill="#58f0ff" opacity=".8" />
            <rect x="-3" y="-143" width="6" height="8" fill="#ff7a2f" />
          </g>
        ))}
        {/* Rings */}
        <ellipse rx="138" ry="44" fill="none" stroke="#8a929c" strokeWidth="7" transform="rotate(18)" />
        <ellipse rx="122" ry="122" fill="none" stroke="#5c646d" strokeWidth="5" strokeDasharray="3 5" />
        <ellipse rx="104" ry="36" fill="none" stroke="#58f0ff" strokeWidth="2" transform="rotate(-24)" />
        {/* Core */}
        <circle r="72" fill="none" stroke="#58f0ff" strokeOpacity=".35" />
        <circle r="56" fill="url(#sc-core)" />
        {/* Injectors */}
        {[45, 135, 225, 315].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <rect x="-10" y="-232" width="20" height="58" rx="3" fill="url(#sc-metal)" stroke="#2c333b" />
            <rect x="-13" y="-176" width="26" height="5" fill="#ff7a2f" />
          </g>
        ))}
      </svg>
    </div>
  );
}
