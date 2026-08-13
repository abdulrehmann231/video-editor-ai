import React from 'react';

/**
 * Bundled vector illustrations (the vault's flat-illustration / icon / sticker
 * family). Each is a pure SVG drawn in a 0..100 viewBox, tastefully flat with a
 * light/dark tone for depth and an accent highlight. `c` = primary tint, `a` =
 * accent; both optional (each illo has a sensible semantic default). The
 * IllustrationRenderer handles positioning, entrance/idle animation, and shadow.
 */

export interface IlloProps {
  c?: string;
  a?: string;
}

const shade = (hex: string, f: number): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

const MoneyBag: React.FC<IlloProps> = ({ c = '#2fbf71', a = '#ffd60a' }) => (
  <g>
    <path d="M35 32 h30 l-6 10 h-18 z" fill={shade(c, 1.25)} />
    <path d="M38 42 C22 54 20 92 50 92 C80 92 78 54 62 42 Z" fill={c} />
    <path d="M38 42 C30 48 26 62 27 72 C40 66 60 66 73 72 C74 62 70 48 62 42 Z" fill={shade(c, 1.18)} opacity={0.5} />
    <text x="50" y="76" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="30" fill={a}>$</text>
    <rect x="34" y="28" width="32" height="7" rx="3.5" fill={shade(c, 0.8)} />
  </g>
);

const CoinStack: React.FC<IlloProps> = ({ c = '#ffd60a', a = '#b8860b' }) => (
  <g>
    {[74, 60, 46].map((y, i) => (
      <g key={i}>
        <ellipse cx="50" cy={y + 6} rx="26" ry="9" fill={shade(c, 0.7)} />
        <rect x="24" y={y} width="52" height="7" fill={shade(c, 0.85)} />
        <ellipse cx="50" cy={y} rx="26" ry="9" fill={c} />
      </g>
    ))}
    <text x="50" y="42" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="15" fill={a}>$</text>
  </g>
);

const DollarCoin: React.FC<IlloProps> = ({ c = '#ffd60a', a = '#b8860b' }) => (
  <g>
    <circle cx="50" cy="52" r="34" fill={shade(c, 0.7)} />
    <circle cx="50" cy="48" r="34" fill={c} />
    <circle cx="50" cy="48" r="27" fill="none" stroke={a} strokeWidth="3" opacity={0.6} />
    <text x="50" y="62" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="42" fill={a}>$</text>
  </g>
);

const GrowthArrow: React.FC<IlloProps> = ({ c = '#34d399', a = '#ffffff' }) => (
  <g>
    <rect x="18" y="60" width="14" height="24" rx="2" fill={shade(c, 0.7)} />
    <rect x="40" y="46" width="14" height="38" rx="2" fill={shade(c, 0.85)} />
    <rect x="62" y="30" width="14" height="54" rx="2" fill={c} />
    <path d="M20 66 L44 50 L58 58 L82 30" fill="none" stroke={a} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M68 26 L86 24 L82 42 Z" fill={a} />
  </g>
);

const ChartUp: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#34d399' }) => (
  <g>
    <rect x="16" y="18" width="68" height="64" rx="8" fill={shade(c, 0.35)} />
    <rect x="16" y="18" width="68" height="64" rx="8" fill="none" stroke={shade(c, 1.3)} strokeWidth="2" />
    <path d="M26 68 L42 54 L54 60 L74 34" fill="none" stroke={a} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="74" cy="34" r="5" fill={a} />
    <path d="M62 32 L78 30 L76 46 Z" fill={a} />
  </g>
);

const Rocket: React.FC<IlloProps> = ({ c = '#e5e9f0', a = '#ff375f' }) => (
  <g>
    <path d="M50 12 C64 24 66 44 62 62 H38 C34 44 36 24 50 12 Z" fill={c} />
    <path d="M50 12 C57 18 60 32 60 46 H50 Z" fill={shade(c, 0.85)} />
    <circle cx="50" cy="38" r="8" fill={a} />
    <circle cx="50" cy="38" r="4" fill={shade(a, 0.7)} />
    <path d="M38 56 L26 70 L38 66 Z" fill={a} />
    <path d="M62 56 L74 70 L62 66 Z" fill={a} />
    <path d="M43 64 h14 l-3 12 c-2 5 -6 5 -8 0 Z" fill="#ffb703" />
    <path d="M46 66 h8 l-2 8 c-1 3 -3 3 -4 0 Z" fill="#ffd60a" />
  </g>
);

const Target: React.FC<IlloProps> = ({ c = '#ff375f', a = '#ffffff' }) => (
  <g>
    <circle cx="48" cy="52" r="34" fill={c} />
    <circle cx="48" cy="52" r="24" fill={a} />
    <circle cx="48" cy="52" r="14" fill={c} />
    <circle cx="48" cy="52" r="5" fill={a} />
    <path d="M48 52 L92 20" stroke="#ffd60a" strokeWidth="5" strokeLinecap="round" />
    <path d="M84 14 L94 18 L90 28 Z" fill="#ffd60a" />
    <path d="M84 14 L80 24 L90 28 L94 18 Z" fill={shade('#ffd60a', 0.75)} />
  </g>
);

const Lightbulb: React.FC<IlloProps> = ({ c = '#ffd60a', a = '#ffffff' }) => (
  <g>
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
      const r1 = 40, r2 = 48;
      const rad = (deg * Math.PI) / 180;
      return <line key={deg} x1={50 + r1 * Math.cos(rad)} y1={42 + r1 * Math.sin(rad)} x2={50 + r2 * Math.cos(rad)} y2={42 + r2 * Math.sin(rad)} stroke={c} strokeWidth="3" strokeLinecap="round" opacity={0.7} />;
    })}
    <circle cx="50" cy="42" r="24" fill={c} />
    <circle cx="43" cy="35" r="8" fill={a} opacity={0.5} />
    <rect x="41" y="62" width="18" height="6" rx="2" fill="#8a8f98" />
    <rect x="43" y="70" width="14" height="5" rx="2" fill="#6b7280" />
    <rect x="45" y="77" width="10" height="5" rx="2.5" fill="#4b5563" />
  </g>
);

const Briefcase: React.FC<IlloProps> = ({ c = '#8b5e34', a = '#ffd60a' }) => (
  <g>
    <rect x="38" y="24" width="24" height="14" rx="4" fill="none" stroke={shade(c, 0.7)} strokeWidth="4" />
    <rect x="18" y="34" width="64" height="50" rx="7" fill={c} />
    <rect x="18" y="50" width="64" height="8" fill={shade(c, 0.75)} />
    <rect x="44" y="50" width="12" height="12" rx="2" fill={a} />
  </g>
);

const Trophy: React.FC<IlloProps> = ({ c = '#ffd60a', a = '#b8860b' }) => (
  <g>
    <path d="M32 20 h36 v18 c0 14 -8 22 -18 22 s-18 -8 -18 -22 Z" fill={c} />
    <path d="M32 24 c-12 0 -14 18 4 20 M68 24 c12 0 14 18 -4 20" fill="none" stroke={a} strokeWidth="4" />
    <rect x="44" y="60" width="12" height="12" fill={shade(c, 0.8)} />
    <rect x="34" y="72" width="32" height="8" rx="3" fill={a} />
    <path d="M50 30 l3 6 6 1 -4.5 4.5 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4.5 6 -1 Z" fill={a} />
  </g>
);

const Gears: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#93c5fd' }) => {
  const gear = (cx: number, cy: number, R: number, col: string) => (
    <g>
      {Array.from({ length: 8 }).map((_, i) => {
        const rad = (i * 45 * Math.PI) / 180;
        return <rect key={i} x={cx - 3} y={cy - R - 5} width="6" height="10" rx="1" fill={col} transform={`rotate(${i * 45} ${cx} ${cy})`} />;
      })}
      <circle cx={cx} cy={cy} r={R} fill={col} />
      <circle cx={cx} cy={cy} r={R * 0.4} fill="#12151c" />
    </g>
  );
  return (
    <g>
      {gear(40, 44, 20, c)}
      {gear(68, 66, 14, a)}
    </g>
  );
};

const Gift: React.FC<IlloProps> = ({ c = '#ff375f', a = '#ffd60a' }) => (
  <g>
    <rect x="24" y="44" width="52" height="40" rx="4" fill={c} />
    <rect x="24" y="36" width="52" height="14" rx="3" fill={shade(c, 1.15)} />
    <rect x="45" y="36" width="10" height="48" fill={a} />
    <path d="M50 36 C40 22 24 30 50 36 C60 22 76 30 50 36" fill={a} />
    <circle cx="50" cy="34" r="4" fill={shade(a, 0.85)} />
  </g>
);

const Shield: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#34d399' }) => (
  <g>
    <path d="M50 14 L80 24 V52 C80 72 66 82 50 88 C34 82 20 72 20 52 V24 Z" fill={c} />
    <path d="M50 14 L80 24 V52 C80 72 66 82 50 88 Z" fill={shade(c, 0.82)} />
    <path d="M36 50 L46 60 L66 38" fill="none" stroke={a} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

const House: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#ff375f' }) => (
  <g>
    <path d="M50 16 L86 46 H14 Z" fill={a} />
    <path d="M50 16 L86 46 H50 Z" fill={shade(a, 0.82)} />
    <rect x="24" y="46" width="52" height="38" fill={c} />
    <rect x="24" y="46" width="52" height="38" fill={shade(c, 1.12)} opacity={0.001} />
    <rect x="42" y="60" width="16" height="24" rx="1" fill={shade(c, 0.7)} />
    <rect x="30" y="54" width="10" height="10" fill="#ffd60a" />
    <rect x="60" y="54" width="10" height="10" fill="#ffd60a" />
  </g>
);

const Clock: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#ffffff' }) => (
  <g>
    <circle cx="50" cy="52" r="34" fill={shade(c, 0.7)} />
    <circle cx="50" cy="49" r="34" fill={c} />
    <circle cx="50" cy="49" r="27" fill={shade(c, 1.25)} />
    {Array.from({ length: 12 }).map((_, i) => {
      const rad = (i * 30 * Math.PI) / 180;
      return <line key={i} x1={50 + 24 * Math.sin(rad)} y1={49 - 24 * Math.cos(rad)} x2={50 + 27 * Math.sin(rad)} y2={49 - 27 * Math.cos(rad)} stroke={a} strokeWidth="2" />;
    })}
    <line x1="50" y1="49" x2="50" y2="32" stroke={a} strokeWidth="4" strokeLinecap="round" />
    <line x1="50" y1="49" x2="64" y2="55" stroke={a} strokeWidth="4" strokeLinecap="round" />
    <circle cx="50" cy="49" r="3.5" fill={a} />
  </g>
);

const Fire: React.FC<IlloProps> = ({ c = '#ff6b35', a = '#ffd60a' }) => (
  <g>
    <path d="M50 12 C58 30 76 38 68 62 C64 78 52 86 42 84 C26 80 24 62 34 50 C36 58 42 60 44 58 C40 46 44 28 50 12 Z" fill={c} />
    <path d="M50 40 C56 50 60 58 54 70 C50 78 42 78 40 70 C38 62 44 56 44 50 C46 54 49 54 50 52 Z" fill={a} />
  </g>
);

const Magnet: React.FC<IlloProps> = ({ c = '#ff375f', a = '#e5e9f0' }) => (
  <g>
    <path d="M28 30 a22 22 0 0 1 44 0 V54 H56 V30 a6 6 0 0 0 -12 0 V54 H28 Z" fill={c} />
    <rect x="28" y="54" width="16" height="14" fill={a} />
    <rect x="56" y="54" width="16" height="14" fill={a} />
    <rect x="28" y="66" width="16" height="8" fill="#c9d1d9" />
    <rect x="56" y="66" width="16" height="8" fill="#c9d1d9" />
  </g>
);

const StarBadge: React.FC<IlloProps> = ({ c = '#ffd60a', a = '#ff375f' }) => (
  <g>
    <path d="M50 66 l-10 16 -4 -14 -14 2 10 -12 -12 -8 14 -3 -2 -14 12 8 12 -8 -2 14 14 3 -12 8 10 12 -14 -2 -4 14 z" fill={a} opacity={0.35} />
    {Array.from({ length: 12 }).map((_, i) => {
      const rad = (i * 30 * Math.PI) / 180;
      return <path key={i} d={`M50 50 L${50 + 38 * Math.cos(rad)} ${48 + 38 * Math.sin(rad)} L${50 + 38 * Math.cos(rad + 0.26)} ${48 + 38 * Math.sin(rad + 0.26)} Z`} fill={shade(c, 0.85)} />;
    })}
    <circle cx="50" cy="48" r="28" fill={c} />
    <path d="M50 30 l6 12 13 2 -9.5 9 2.5 13 -12 -6.5 -12 6.5 2.5 -13 -9.5 -9 13 -2 Z" fill="#fff" />
  </g>
);

// ── people / creator ─────────────────────────────────────────────────────────
const Person: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#fff' }) => (
  <g>
    <circle cx="50" cy="50" r="38" fill={shade(c, 0.55)} />
    <circle cx="50" cy="50" r="38" fill={c} opacity={0.85} />
    <circle cx="50" cy="42" r="14" fill={a} />
    <path d="M26 78 C26 60 74 60 74 78 Z" fill={a} />
  </g>
);
const Mascot: React.FC<IlloProps> = ({ c = '#7c5cff', a = '#ffd60a' }) => (
  <g>
    <rect x="24" y="26" width="52" height="52" rx="22" fill={c} />
    <rect x="30" y="20" width="8" height="12" rx="4" fill={c} />
    <rect x="62" y="20" width="8" height="12" rx="4" fill={c} />
    <circle cx="40" cy="46" r="8" fill="#fff" />
    <circle cx="60" cy="46" r="8" fill="#fff" />
    <circle cx="41" cy="47" r="4" fill="#12151c" />
    <circle cx="61" cy="47" r="4" fill="#12151c" />
    <path d="M38 62 Q50 72 62 62" fill="none" stroke={a} strokeWidth="4" strokeLinecap="round" />
  </g>
);
const Crowd: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#34d399' }) => (
  <g>
    {[[26, c], [74, c]].map(([x, col], i) => (
      <g key={i}><circle cx={x as number} cy="46" r="11" fill={shade(col as string, 0.8)} /><path d={`M${(x as number) - 16} 82 C${(x as number) - 16} 62 ${(x as number) + 16} 62 ${(x as number) + 16} 82 Z`} fill={shade(col as string, 0.8)} /></g>
    ))}
    <circle cx="50" cy="40" r="14" fill={a} />
    <path d="M28 84 C28 60 72 60 72 84 Z" fill={a} />
  </g>
);
const Climb: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#ff375f' }) => (
  <g>
    <rect x="14" y="66" width="20" height="18" fill={shade(c, 0.6)} />
    <rect x="34" y="54" width="20" height="30" fill={shade(c, 0.8)} />
    <rect x="54" y="40" width="20" height="44" fill={c} />
    <circle cx="64" cy="26" r="5" fill="#fff" />
    <path d="M64 31 v10 M64 34 l-6 4 M64 34 l6 4 M64 41 l-5 8 M64 41 l5 8" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M78 20 v14 l10 -4 -10 -4" fill={a} />
    <line x1="78" y1="20" x2="78" y2="40" stroke="#fff" strokeWidth="2" />
  </g>
);
const Handshake: React.FC<IlloProps> = ({ c = '#ffb37b', a = '#3b82f6' }) => (
  <g>
    <rect x="10" y="44" width="34" height="14" rx="7" fill={a} transform="rotate(-8 27 51)" />
    <rect x="56" y="44" width="34" height="14" rx="7" fill={shade(a, 0.8)} transform="rotate(8 73 51)" />
    <path d="M38 44 h14 c8 0 12 6 8 10 l-10 8 c-4 3 -10 1 -12 -3 l-6 -10 z" fill={c} />
    <path d="M44 50 l10 6" stroke={shade(c, 0.7)} strokeWidth="3" strokeLinecap="round" />
  </g>
);
const Mic: React.FC<IlloProps> = ({ c = '#e5e9f0', a = '#ff375f' }) => (
  <g>
    <rect x="38" y="14" width="24" height="42" rx="12" fill={c} />
    <rect x="43" y="22" width="14" height="6" rx="3" fill={shade(c, 0.75)} />
    <rect x="43" y="32" width="14" height="6" rx="3" fill={shade(c, 0.75)} />
    <path d="M28 44 a22 22 0 0 0 44 0" fill="none" stroke={a} strokeWidth="5" />
    <rect x="46" y="66" width="8" height="16" fill={shade(c, 0.7)} />
    <rect x="34" y="82" width="32" height="7" rx="3" fill={shade(c, 0.6)} />
  </g>
);
const Megaphone: React.FC<IlloProps> = ({ c = '#ff375f', a = '#ffd60a' }) => (
  <g>
    <path d="M18 44 L58 30 v40 L18 56 z" fill={c} />
    <rect x="10" y="44" width="10" height="12" rx="2" fill={shade(c, 0.7)} />
    <path d="M58 34 v32 l10 -4 v-24 z" fill={shade(c, 0.8)} />
    <path d="M74 40 q8 10 0 20 M80 34 q14 16 0 32" fill="none" stroke={a} strokeWidth="4" strokeLinecap="round" />
    <rect x="30" y="56" width="8" height="20" rx="3" fill={shade(c, 0.7)} />
  </g>
);
// ── UI / tech ────────────────────────────────────────────────────────────────
const Phone: React.FC<IlloProps> = ({ c = '#12151c', a = '#34d399' }) => (
  <g>
    <rect x="30" y="12" width="40" height="76" rx="10" fill={shade(c, 1.6)} />
    <rect x="34" y="20" width="32" height="56" rx="3" fill="#0d1017" />
    <rect x="44" y="15" width="12" height="3" rx="1.5" fill={shade(c, 2)} />
    <rect x="38" y="58" width="8" height="14" fill={a} />
    <rect x="48" y="50" width="8" height="22" fill={shade(a, 1.1)} />
    <rect x="58" y="42" width="8" height="30" fill={a} />
    <circle cx="50" cy="82" r="3" fill={shade(c, 2)} />
  </g>
);
const Browser: React.FC<IlloProps> = ({ c = '#e5e9f0', a = '#3b82f6' }) => (
  <g>
    <rect x="14" y="20" width="72" height="60" rx="6" fill={c} />
    <rect x="14" y="20" width="72" height="14" rx="6" fill={shade(c, 0.85)} />
    <circle cx="22" cy="27" r="2.5" fill="#ff5f57" /><circle cx="30" cy="27" r="2.5" fill="#febc2e" /><circle cx="38" cy="27" r="2.5" fill="#28c840" />
    <rect x="46" y="24" width="34" height="6" rx="3" fill={c} />
    <rect x="22" y="42" width="30" height="30" rx="3" fill={a} />
    <rect x="58" y="42" width="22" height="6" rx="3" fill={shade(c, 0.7)} />
    <rect x="58" y="54" width="22" height="6" rx="3" fill={shade(c, 0.7)} />
    <rect x="58" y="66" width="14" height="6" rx="3" fill={shade(a, 1.1)} />
  </g>
);
const PlayButton: React.FC<IlloProps> = ({ c = '#ff375f', a = '#fff' }) => (
  <g>
    <circle cx="50" cy="50" r="36" fill={shade(c, 0.7)} />
    <circle cx="50" cy="47" r="36" fill={c} />
    <path d="M42 34 L68 47 L42 60 Z" fill={a} />
  </g>
);
const Chat: React.FC<IlloProps> = ({ c = '#34d399', a = '#fff' }) => (
  <g>
    <path d="M18 24 h64 a8 8 0 0 1 8 8 v28 a8 8 0 0 1 -8 8 H44 l-16 14 v-14 h-10 a8 8 0 0 1 -8 -8 V32 a8 8 0 0 1 8 -8 z" fill={c} />
    <circle cx="36" cy="46" r="4" fill={a} /><circle cx="50" cy="46" r="4" fill={a} /><circle cx="64" cy="46" r="4" fill={a} />
  </g>
);
const Email: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#fff' }) => (
  <g>
    <rect x="14" y="28" width="72" height="48" rx="8" fill={c} />
    <path d="M16 32 L50 56 L84 32" fill="none" stroke={a} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 74 L40 52 M84 74 L60 52" stroke={shade(c, 0.75)} strokeWidth="4" strokeLinecap="round" />
  </g>
);
const Bell: React.FC<IlloProps> = ({ c = '#ffd60a', a = '#ff375f' }) => (
  <g>
    <path d="M50 16 a5 5 0 0 1 5 5 c14 4 12 20 14 34 l6 8 H25 l6 -8 c2 -14 0 -30 14 -34 a5 5 0 0 1 5 -5 z" fill={c} />
    <path d="M42 70 a8 8 0 0 0 16 0 z" fill={shade(c, 0.7)} />
    <circle cx="72" cy="24" r="9" fill={a} />
  </g>
);
const Cursor: React.FC<IlloProps> = ({ c = '#fff', a = '#12151c' }) => (
  <g>
    <path d="M36 28 L36 74 L48 62 L56 80 L64 76 L56 58 L72 58 Z" fill={c} stroke={a} strokeWidth="3" strokeLinejoin="round" />
  </g>
);
// ── finance / business ───────────────────────────────────────────────────────
const CreditCard: React.FC<IlloProps> = ({ c = '#7c5cff', a = '#ffd60a' }) => (
  <g>
    <rect x="14" y="30" width="72" height="46" rx="7" fill={c} />
    <rect x="14" y="40" width="72" height="10" fill="#12151c" />
    <rect x="22" y="58" width="16" height="12" rx="2" fill={a} />
    <rect x="46" y="62" width="34" height="4" rx="2" fill={shade(c, 1.4)} />
  </g>
);
const Bank: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#e5e9f0' }) => (
  <g>
    <path d="M50 16 L86 34 H14 Z" fill={c} />
    <rect x="18" y="34" width="64" height="6" fill={shade(c, 0.8)} />
    {[24, 40, 56, 72].map((x) => <rect key={x} x={x - 3} y="42" width="10" height="30" fill={a} />)}
    <rect x="14" y="74" width="72" height="8" rx="2" fill={shade(c, 0.8)} />
    <circle cx="50" cy="26" r="4" fill={a} />
  </g>
);
const PiggyBank: React.FC<IlloProps> = ({ c = '#ff8fc7', a = '#ffd60a' }) => (
  <g>
    <ellipse cx="50" cy="54" rx="34" ry="26" fill={c} />
    <circle cx="70" cy="50" r="12" fill={shade(c, 1.08)} />
    <circle cx="72" cy="50" r="3" fill="#12151c" />
    <path d="M30 34 q6 -8 14 -4" fill="none" stroke={shade(c, 0.8)} strokeWidth="5" strokeLinecap="round" />
    <rect x="44" y="26" width="16" height="5" rx="2.5" fill={shade(c, 0.7)} />
    <rect x="49" y="14" width="4" height="14" rx="2" fill={a} />
    {[36, 50, 64].map((x) => <rect key={x} x={x - 4} y="76" width="8" height="10" rx="2" fill={shade(c, 0.8)} />)}
  </g>
);
const DocumentIllo: React.FC<IlloProps> = ({ c = '#e5e9f0', a = '#3b82f6' }) => (
  <g>
    <path d="M26 14 h34 l16 16 v56 H26 z" fill={c} />
    <path d="M60 14 v16 h16 z" fill={shade(c, 0.8)} />
    {[40, 50, 60, 70].map((y, i) => <rect key={y} x="34" y={y} width={i === 3 ? 20 : 34} height="5" rx="2.5" fill={i === 0 ? a : shade(c, 0.7)} />)}
  </g>
);
const Diamond: React.FC<IlloProps> = ({ c = '#22d3ee', a = '#a5f3fc' }) => (
  <g>
    <path d="M28 30 h44 l16 16 -38 42 -38 -42 z" fill={c} />
    <path d="M28 30 l10 16 h-24 z M72 30 l-10 16 h24 z" fill={a} />
    <path d="M38 46 h24 l-12 42 z" fill={shade(c, 0.8)} />
    <path d="M14 46 h24 l12 42 z" fill={shade(c, 1.15)} opacity={0.6} />
  </g>
);
const Funnel: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#34d399' }) => (
  <g>
    <path d="M18 24 h64 L58 56 v22 l-16 8 V56 z" fill={c} opacity={0.85} />
    <path d="M18 24 h64 L64 42 H36 z" fill={shade(c, 1.2)} />
    <circle cx="50" cy="90" r="5" fill={a} />
    <circle cx="50" cy="80" r="3" fill={a} opacity={0.6} />
  </g>
);
// ── concepts ─────────────────────────────────────────────────────────────────
const Brain: React.FC<IlloProps> = ({ c = '#ff8fc7', a = '#fff' }) => (
  <g>
    <path d="M48 20 c-14 -6 -30 4 -28 18 c-8 4 -8 16 0 20 c-2 12 10 20 20 16 c4 4 8 4 8 -2 z" fill={c} />
    <path d="M52 20 c14 -6 30 4 28 18 c8 4 8 16 0 20 c2 12 -10 20 -20 16 c-4 4 -8 4 -8 -2 z" fill={shade(c, 0.9)} />
    <path d="M48 30 q-8 4 -6 12 q-8 4 -2 12 M52 30 q8 4 6 12 q8 4 2 12" fill="none" stroke={a} strokeWidth="2.5" strokeLinecap="round" opacity={0.7} />
  </g>
);
const Globe: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#34d399' }) => (
  <g>
    <circle cx="50" cy="50" r="36" fill={c} />
    <ellipse cx="50" cy="50" rx="15" ry="36" fill="none" stroke={a} strokeWidth="3" />
    <line x1="14" y1="50" x2="86" y2="50" stroke={a} strokeWidth="3" />
    <path d="M20 34 h60 M20 66 h60" stroke={a} strokeWidth="2.5" opacity={0.7} />
    <circle cx="50" cy="50" r="36" fill="none" stroke={shade(c, 1.4)} strokeWidth="2" />
  </g>
);
const Calendar: React.FC<IlloProps> = ({ c = '#fff', a = '#ff375f' }) => (
  <g>
    <rect x="16" y="22" width="68" height="62" rx="7" fill={c} />
    <rect x="16" y="22" width="68" height="16" rx="7" fill={a} />
    <rect x="30" y="16" width="6" height="14" rx="3" fill={shade(a, 0.7)} />
    <rect x="64" y="16" width="6" height="14" rx="3" fill={shade(a, 0.7)} />
    {[0, 1, 2].map((r) => [0, 1, 2, 3].map((col) => <rect key={`${r}${col}`} x={26 + col * 14} y={46 + r * 12} width="8" height="8" rx="2" fill={r === 1 && col === 2 ? a : '#c9d1d9'} />))}
  </g>
);
const Key: React.FC<IlloProps> = ({ c = '#ffd60a', a = '#b8860b' }) => (
  <g>
    <circle cx="34" cy="40" r="20" fill={c} />
    <circle cx="34" cy="40" r="9" fill="#12151c" />
    <rect x="46" y="46" width="38" height="10" rx="3" fill={c} transform="rotate(45 46 46)" />
    <rect x="64" y="64" width="12" height="8" rx="2" fill={c} transform="rotate(45 64 64)" />
    <rect x="72" y="72" width="12" height="8" rx="2" fill={shade(c, 0.85)} transform="rotate(45 72 72)" />
  </g>
);
const Lock: React.FC<IlloProps> = ({ c = '#ffd60a', a = '#12151c' }) => (
  <g>
    <path d="M34 46 V36 a16 16 0 0 1 32 0 v10" fill="none" stroke={shade(c, 0.7)} strokeWidth="8" />
    <rect x="24" y="46" width="52" height="40" rx="8" fill={c} />
    <circle cx="50" cy="62" r="6" fill={a} />
    <rect x="47" y="64" width="6" height="12" rx="3" fill={a} />
  </g>
);
const Flag: React.FC<IlloProps> = ({ c = '#ff375f', a = '#e5e9f0' }) => (
  <g>
    <rect x="26" y="16" width="6" height="72" rx="3" fill={shade(a, 0.7)} />
    <path d="M32 20 h44 l-10 12 10 12 H32 z" fill={c} />
    <circle cx="29" cy="86" r="6" fill={shade(a, 0.6)} />
  </g>
);
const Mountain: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#fff' }) => (
  <g>
    <circle cx="72" cy="28" r="10" fill="#ffd60a" />
    <path d="M8 82 L38 34 L54 60 L66 44 L92 82 Z" fill={c} />
    <path d="M32 42 L38 34 L44 42 L40 46 L36 42 Z" fill={a} />
    <path d="M60 50 L66 44 L72 52 L68 55 L64 50 Z" fill={a} />
  </g>
);
const Lightning: React.FC<IlloProps> = ({ c = '#ffd60a', a = '#ffb703' }) => (
  <g>
    <path d="M56 10 L28 54 H46 L40 90 L72 42 H52 z" fill={c} stroke={a} strokeWidth="2" strokeLinejoin="round" />
  </g>
);
const Eye: React.FC<IlloProps> = ({ c = '#3b82f6', a = '#fff' }) => (
  <g>
    <path d="M10 50 C28 26 72 26 90 50 C72 74 28 74 10 50 Z" fill={a} stroke={shade(c, 0.6)} strokeWidth="3" />
    <circle cx="50" cy="50" r="16" fill={c} />
    <circle cx="50" cy="50" r="8" fill="#12151c" />
    <circle cx="45" cy="45" r="3" fill={a} />
  </g>
);
const ThumbsUp: React.FC<IlloProps> = ({ c = '#34d399', a = '#12151c' }) => (
  <g>
    <rect x="18" y="46" width="16" height="34" rx="4" fill={shade(c, 0.7)} />
    <path d="M38 48 l14 -26 c2 -4 10 -3 10 4 l-2 14 h18 c5 0 8 4 6 9 l-8 22 c-1 4 -5 6 -9 6 H38 z" fill={c} />
  </g>
);

export const ILLO_COMPONENTS: Record<string, React.FC<IlloProps>> = {
  person: Person,
  mascot: Mascot,
  crowd: Crowd,
  climb: Climb,
  handshake: Handshake,
  mic: Mic,
  megaphone: Megaphone,
  phone: Phone,
  browser: Browser,
  play_button: PlayButton,
  chat: Chat,
  email: Email,
  bell: Bell,
  cursor: Cursor,
  credit_card: CreditCard,
  bank: Bank,
  piggy_bank: PiggyBank,
  document: DocumentIllo,
  diamond: Diamond,
  funnel: Funnel,
  brain: Brain,
  globe: Globe,
  calendar: Calendar,
  key: Key,
  lock: Lock,
  flag: Flag,
  mountain: Mountain,
  lightning: Lightning,
  eye: Eye,
  thumbs_up: ThumbsUp,
  money_bag: MoneyBag,
  coin_stack: CoinStack,
  dollar_coin: DollarCoin,
  growth_arrow: GrowthArrow,
  chart_up: ChartUp,
  rocket: Rocket,
  target: Target,
  lightbulb: Lightbulb,
  briefcase: Briefcase,
  trophy: Trophy,
  gears: Gears,
  gift: Gift,
  shield: Shield,
  house: House,
  clock: Clock,
  fire: Fire,
  magnet: Magnet,
  star_badge: StarBadge,
};

/** Generic fallback for an unknown id — a rounded accent badge with a "?". */
export const IlloFallback: React.FC<IlloProps> = ({ c = '#ffd60a', a = '#12151c' }) => (
  <g>
    <rect x="18" y="18" width="64" height="64" rx="16" fill={c} />
    <text x="50" y="66" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="44" fill={a}>?</text>
  </g>
);
