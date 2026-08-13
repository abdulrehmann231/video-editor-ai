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

export const ILLO_COMPONENTS: Record<string, React.FC<IlloProps>> = {
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
