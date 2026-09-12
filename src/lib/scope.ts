// src/lib/scope.ts
//
// One time-scope vocabulary, shared by every surface that shows the
// given-back number (Section M).
//
// v3 split the same metric across three tabs by timeframe: Home was today,
// Air was this month, Pulse was week/month/year. Users had to learn a filing
// system before they could read their own data (OBS-013). The scope now lives
// on the ring itself, and this module is the single definition of what each
// scope means.

export const BASELINE_KG_PER_DAY = 28.6;
export const KG_TO_LB = 2.20462;

export type Scope = 'today' | 'week' | 'month' | 'year';

export const SCOPES: Scope[] = ['today', 'week', 'month', 'year'];

export const SCOPE_LABEL: Record<Scope, string> = {
  today: 'TODAY',
  week: 'THIS WEEK',
  month: 'THIS MONTH',
  year: 'THIS YEAR',
};

export const SCOPE_FLOW_TITLE: Record<Scope, string> = {
  today: "TODAY'S FLOW",
  week: "THIS WEEK'S FLOW",
  month: "THIS MONTH'S FLOW",
  year: "THIS YEAR'S FLOW",
};

export function nextScope(current: Scope): Scope {
  return SCOPES[(SCOPES.indexOf(current) + 1) % SCOPES.length];
}

/**
 * Start of the given scope in local time, plus how many days of baseline the
 * scope has accrued so far. Partial periods count the current day in full,
 * matching how HomeScreen has always treated today.
 */
export function scopeRange(scope: Scope, now: Date = new Date()): { start: Date; days: number } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (scope) {
    case 'today':
      return { start, days: 1 };

    case 'week': {
      // Week starts Monday.
      const dow = (start.getDay() + 6) % 7; // Mon = 0
      start.setDate(start.getDate() - dow);
      return { start, days: dow + 1 };
    }

    case 'month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s, days: now.getDate() };
    }

    case 'year': {
      const s = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((start.getTime() - s.getTime()) / 86_400_000) + 1;
      return { start: s, days };
    }
  }
}

/**
 * Air given back, in lb, for a set of activities inside a scope.
 * An empty period earns nothing — silence is never credited.
 */
export function givenBackLb(totalEmittedKg: number, activityCount: number, days: number): number {
  if (activityCount === 0) return 0;
  return Math.max(0, (BASELINE_KG_PER_DAY * days - totalEmittedKg) * KG_TO_LB);
}

export function lb(kg: number): string {
  return (kg * KG_TO_LB).toFixed(1);
}
