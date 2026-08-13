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
  // people / creator
  { id: 'person', label: 'Person / avatar', whenToUse: 'a person, a customer, "you", a user, a profile', tags: ['person', 'avatar', 'user'] },
  { id: 'mascot', label: 'Mascot character', whenToUse: 'a friendly character/mascot, a playful explainer moment', tags: ['character', 'mascot', 'fun'] },
  { id: 'crowd', label: 'Crowd / audience', whenToUse: 'an audience, customers, a community, many people, a market', tags: ['crowd', 'audience', 'community'] },
  { id: 'climb', label: 'Climbing steps to a flag', whenToUse: 'a journey, progress, working toward a goal, levelling up', tags: ['journey', 'progress', 'goal'] },
  { id: 'handshake', label: 'Handshake', whenToUse: 'a deal, partnership, agreement, closing a client', tags: ['deal', 'partnership', 'agreement'] },
  { id: 'mic', label: 'Microphone', whenToUse: 'a podcast, recording, a creator, speaking, content', tags: ['podcast', 'creator', 'audio'] },
  { id: 'megaphone', label: 'Megaphone', whenToUse: 'marketing, an announcement, promotion, reaching people', tags: ['marketing', 'announce', 'promote'] },
  // UI / tech
  { id: 'phone', label: 'Phone mockup', whenToUse: 'a mobile app, a phone, social media, "on your phone"', tags: ['phone', 'mobile', 'app'] },
  { id: 'browser', label: 'Browser window', whenToUse: 'a website, a web app, a landing page, a dashboard', tags: ['website', 'web', 'dashboard'] },
  { id: 'play_button', label: 'Play button', whenToUse: 'a video, media, "watch", YouTube, playback', tags: ['video', 'media', 'youtube'] },
  { id: 'chat', label: 'Chat bubble', whenToUse: 'a message, DM, conversation, feedback, comments', tags: ['message', 'chat', 'feedback'] },
  { id: 'email', label: 'Email envelope', whenToUse: 'email, outreach, a newsletter, a message', tags: ['email', 'outreach', 'newsletter'] },
  { id: 'bell', label: 'Notification bell', whenToUse: 'notifications, "subscribe", alerts, reminders', tags: ['notification', 'subscribe', 'alert'] },
  { id: 'cursor', label: 'Click cursor', whenToUse: 'a click, a CTA, "click here", an action', tags: ['click', 'cta', 'action'] },
  // finance / business
  { id: 'credit_card', label: 'Credit card', whenToUse: 'payments, a purchase, subscriptions, spending', tags: ['payment', 'card', 'purchase'] },
  { id: 'bank', label: 'Bank building', whenToUse: 'a bank, an institution, savings, finance, a loan', tags: ['bank', 'finance', 'institution'] },
  { id: 'piggy_bank', label: 'Piggy bank', whenToUse: 'saving money, a savings account, putting money away', tags: ['savings', 'money', 'save'] },
  { id: 'document', label: 'Document / report', whenToUse: 'a report, a contract, a plan, paperwork, a doc', tags: ['document', 'report', 'contract'] },
  { id: 'diamond', label: 'Diamond', whenToUse: 'premium, high value, luxury, a rare opportunity', tags: ['premium', 'value', 'luxury'] },
  { id: 'funnel', label: 'Sales funnel', whenToUse: 'a sales funnel, converting leads, a pipeline stage', tags: ['funnel', 'sales', 'conversion'] },
  // concepts
  { id: 'brain', label: 'Brain', whenToUse: 'thinking, psychology, mindset, an idea, learning', tags: ['brain', 'mindset', 'psychology'] },
  { id: 'globe', label: 'Globe', whenToUse: 'global reach, worldwide, international, the internet', tags: ['global', 'world', 'reach'] },
  { id: 'calendar', label: 'Calendar', whenToUse: 'a date, scheduling, a deadline, "every month", planning', tags: ['calendar', 'schedule', 'date'] },
  { id: 'key', label: 'Key', whenToUse: 'unlocking, access, "the key to", a solution', tags: ['key', 'unlock', 'access'] },
  { id: 'lock', label: 'Lock', whenToUse: 'security, privacy, locked/gated, protection', tags: ['lock', 'security', 'private'] },
  { id: 'flag', label: 'Flag', whenToUse: 'a goal, a milestone, a target reached, a checkpoint', tags: ['goal', 'milestone', 'flag'] },
  { id: 'mountain', label: 'Mountain', whenToUse: 'a big goal, a summit, a challenge, ambition', tags: ['goal', 'challenge', 'ambition'] },
  { id: 'lightning', label: 'Lightning bolt', whenToUse: 'speed, power, energy, "instantly", fast results', tags: ['speed', 'power', 'energy'] },
  { id: 'eye', label: 'Eye', whenToUse: 'views, attention, visibility, watching, awareness', tags: ['views', 'attention', 'visibility'] },
  { id: 'thumbs_up', label: 'Thumbs up', whenToUse: 'approval, a like, "good", positive, agreement', tags: ['like', 'approval', 'positive'] },
];

export const ILLUSTRATION_IDS: string[] = ILLUSTRATIONS.map((i) => i.id);
