// ── Level Engine ──────────────────────────────────────────────────────────────
// Calculates all 4 dimensions of a user's Green Profile
// Past (story level), Present (role), Future (impact), Community (status)

export type PastLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type PresentLevel = 1 | 2 | 3;
export type FutureLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type AvatarLevel = 1 | 2 | 3 | 4 | 5 | 6;

// ── Past — Your Story (6 levels) ──────────────────────────────────────────────
export const PAST_LEVELS = {
  1: { label: 'Just Arrived',         desc: 'You just started paying attention. That moment of awareness is where every green story begins.' },
  2: { label: 'Waking Up',            desc: 'Something shifted. You\'re noticing the footprint of your choices.' },
  3: { label: 'Finding Footing',      desc: 'You\'re experimenting. Some days green, some days not — but the intention is real.' },
  4: { label: 'Building Habits',      desc: 'Your green choices are becoming part of who you are, not just what you do.' },
  5: { label: 'Living Intentionally', desc: 'Consistency. Your choices are shaping the world around you quietly and persistently.' },
  6: { label: 'Part of the Solution', desc: 'You\'ve crossed a line most people never reach. This is who you are now.' },
};

// ── Present — Your Role (3 levels) ────────────────────────────────────────────
export const PRESENT_LEVELS = {
  1: { label: 'Awakening', desc: 'Aware. Beginning. Every forest starts as a single seed.' },
  2: { label: 'Steward',   desc: 'Consistent. Caring. You tend the green life around you.' },
  3: { label: 'Nurturer',  desc: 'Your presence makes the eco-system around you healthier.' },
};

// ── Future — Your Real Impact (6 levels) ──────────────────────────────────────
export const FUTURE_LEVELS = {
  1: { label: 'A Seed Planted',        cleanAirHours: 0,    desc: 'Your journey begins. Even a seed holds the whole forest.' },
  2: { label: 'A Breath Given Back',   cleanAirHours: 1,    desc: 'You\'ve given Earth 1 hour of clean air. Someone is breathing it.' },
  3: { label: 'A Day for the Planet',  cleanAirHours: 24,   desc: 'You\'ve given Earth 1 full day of clean air.' },
  4: { label: 'A Week Returned',       cleanAirHours: 168,  desc: 'You\'ve given Earth a full week of clean air.' },
  5: { label: 'A Season Saved',        cleanAirHours: 2190, desc: 'A whole season. The trees are keeping score.' },
  6: { label: 'A Legacy',              cleanAirHours: 8760, desc: 'You\'ve given Earth over a year of clean air. This is a legacy.' },
};

// ── Avatar level (visual) maps to Past level ──────────────────────────────────
// Past level directly determines the avatar shown on profile
export const pastLevelToAvatar = (pastLevel: PastLevel): AvatarLevel => pastLevel as AvatarLevel;

// ── Calculation functions ──────────────────────────────────────────────────────

interface ActivityStats {
  totalActivities: number;
  uniqueDays: number;
  currentStreak: number;
  co2Saved: number;        // kg saved vs average person
  co2Logged: number;       // total kg logged
  monthlyActivityDays: number; // unique days this month with activities
}

/**
 * PAST level — based on consistency over time (unique days logged)
 */
export function calcPastLevel(stats: ActivityStats): PastLevel {
  const { uniqueDays, currentStreak } = stats;

  if (uniqueDays >= 180 || currentStreak >= 60) return 6;
  if (uniqueDays >= 90  || currentStreak >= 30) return 5;
  if (uniqueDays >= 30  || currentStreak >= 14) return 4;
  if (uniqueDays >= 14  || currentStreak >= 7)  return 3;
  if (uniqueDays >= 3   || currentStreak >= 2)  return 2;
  return 1;
}

/**
 * PRESENT role — based on activity frequency this month
 */
export function calcPresentLevel(stats: ActivityStats): PresentLevel {
  const { monthlyActivityDays } = stats;
  if (monthlyActivityDays >= 15) return 3;
  if (monthlyActivityDays >= 6)  return 2;
  return 1;
}

/**
 * FUTURE impact — based on CO₂ saved vs average person
 * Average person emits ~28.6 kg CO₂/day → saved = (avg × logged_days) - actual
 */
export function calcFutureLevel(stats: ActivityStats): FutureLevel {
  const { co2Saved } = stats;
  // Convert kg CO₂ saved to approximate "hours of clean air"
  // 1 kg CO₂ ≈ 0.85 hours of clean air (rough equivalence for UX purposes)
  const cleanAirHours = co2Saved * 0.85;

  if (cleanAirHours >= 8760) return 6;
  if (cleanAirHours >= 2190) return 5;
  if (cleanAirHours >= 168)  return 4;
  if (cleanAirHours >= 24)   return 3;
  if (cleanAirHours >= 1)    return 2;
  return 1;
}

/**
 * Clean air stat — human-readable impact
 */
export function calcCleanAirStat(co2Saved: number): string {
  const hours = co2Saved * 0.85;
  if (hours >= 8760) return `${(hours / 8760).toFixed(1)} years of clean air`;
  if (hours >= 720)  return `${(hours / 720).toFixed(1)} months of clean air`;
  if (hours >= 24)   return `${(hours / 24).toFixed(1)} days of clean air`;
  if (hours >= 1)    return `${hours.toFixed(0)} hours of clean air`;
  return 'Your first clean breath';
}

/**
 * Profile tagline — the 4-word identity (or with community status)
 * e.g. "Waking Up · Steward · A Breath Given Back · Grove Keeper"
 */
export function buildProfileTagline(
  pastLevel: PastLevel,
  presentLevel: PresentLevel,
  futureLevel: FutureLevel,
  communityStatus?: string
): string {
  const parts = [
    PAST_LEVELS[pastLevel].label,
    PRESENT_LEVELS[presentLevel].label,
    FUTURE_LEVELS[futureLevel].label,
  ];
  if (communityStatus) parts.push(communityStatus);
  return parts.join(' · ');
}

/**
 * Check if user leveled up (compare old vs new stats)
 */
export function checkLevelUp(
  oldStats: ActivityStats,
  newStats: ActivityStats
): { leveledUp: boolean; oldLevel: AvatarLevel; newLevel: AvatarLevel } {
  const oldLevel = pastLevelToAvatar(calcPastLevel(oldStats));
  const newLevel = pastLevelToAvatar(calcPastLevel(newStats));
  return {
    leveledUp: newLevel > oldLevel,
    oldLevel,
    newLevel,
  };
}
