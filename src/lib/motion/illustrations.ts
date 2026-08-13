/**
 * Illustration library — metadata for the bundled vector illustrations (the
 * vault's flat-illustration / icon / sticker family). Data-only + browser-safe
 * (no React), mirroring the lottieRegistry/threeRegistry pattern: the actual SVG
 * components live on the Remotion side (`src/remotion/motion/illustrations.tsx`).
 *
 * The AI picks an `illustration` op with one of these ids; unknown ids fall back
 * to a generic badge in the renderer.
 */

export interface IllustrationMeta {
  id: string;
  label: string;
  whenToUse: string;
  tags: string[];
}

export const ILLUSTRATIONS: IllustrationMeta[] = [
  { id: 'money_bag', label: 'Money bag', whenToUse: 'income, savings, revenue, a pile of money, "cash"', tags: ['finance', 'money', 'income'] },
  { id: 'coin_stack', label: 'Coin stack', whenToUse: 'savings, capital, growing money, wealth accumulation', tags: ['finance', 'money', 'savings'] },
  { id: 'dollar_coin', label: 'Dollar coin', whenToUse: 'a dollar, price, a single unit of money, "per dollar"', tags: ['finance', 'money'] },
  { id: 'growth_arrow', label: 'Growth arrow', whenToUse: 'growth, going up, increase, scaling, an upward trend', tags: ['growth', 'up', 'trend'] },
  { id: 'chart_up', label: 'Rising chart card', whenToUse: 'metrics rising, performance, analytics, a growing graph', tags: ['growth', 'analytics', 'chart'] },
  { id: 'rocket', label: 'Rocket', whenToUse: 'launch, fast growth, taking off, momentum, a new product', tags: ['launch', 'growth', 'speed'] },
  { id: 'target', label: 'Target / bullseye', whenToUse: 'goals, targeting, precision, hitting the mark, focus', tags: ['goal', 'focus', 'aim'] },
  { id: 'lightbulb', label: 'Lightbulb (idea)', whenToUse: 'an idea, insight, tip, creativity, "aha" moment', tags: ['idea', 'insight', 'creativity'] },
  { id: 'briefcase', label: 'Briefcase', whenToUse: 'business, work, a job, professional / B2B context', tags: ['business', 'work'] },
  { id: 'trophy', label: 'Trophy', whenToUse: 'winning, success, achievement, being #1, a milestone', tags: ['win', 'success', 'award'] },
  { id: 'gears', label: 'Gears / system', whenToUse: 'systems, automation, process, how something works, engineering', tags: ['system', 'automation', 'process'] },
  { id: 'gift', label: 'Gift box', whenToUse: 'a bonus, reward, free offer, a surprise, a deal', tags: ['reward', 'bonus', 'offer'] },
  { id: 'shield', label: 'Shield', whenToUse: 'security, trust, protection, safety, guarantee', tags: ['security', 'trust', 'safety'] },
  { id: 'house', label: 'House / property', whenToUse: 'real estate, property, home, rent, a physical asset', tags: ['real-estate', 'property', 'asset'] },
  { id: 'clock', label: 'Clock', whenToUse: 'time, speed, deadline, "in X minutes", saving time', tags: ['time', 'speed'] },
  { id: 'fire', label: 'Fire / hot', whenToUse: 'trending, hot, viral, high demand, urgency', tags: ['trending', 'hot', 'urgency'] },
  { id: 'magnet', label: 'Magnet', whenToUse: 'attracting attention, leads, customers, pulling people in', tags: ['attention', 'leads', 'attract'] },
  { id: 'star_badge', label: 'Star badge', whenToUse: 'a rating, quality, a featured item, "5-star", verified', tags: ['rating', 'quality', 'verified'] },
];

export const ILLUSTRATION_IDS: string[] = ILLUSTRATIONS.map((i) => i.id);
