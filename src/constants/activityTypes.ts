// src/constants/activityTypes.ts
//
// Canonical registry of activity categories and types used across Eco Pulse.
// Used by:
//   - EditActivityModal pickers (category / activity_type dropdowns)
//   - ActivityDetailScreen (icon + color lookup by activity_type)
//   - LogActivityScreen (already has QUICK_FACTORS, will migrate here later)
//
// When editing an activity's amount, co2_kg is recomputed from co2_per_unit.
// This keeps amount and co2_kg consistent after edits.

export type Category = 'transport' | 'food' | 'energy' | 'digital' | 'other';

export interface ActivityTypeDef {
  /** Machine key (matches `activity_type` column) */
  key: string;
  /** Human-readable label shown in pickers */
  name: string;
  /** Emoji icon shown in timeline rows */
  icon: string;
  /** Default unit for this activity ('mi', 'kg', 'hr', etc.) */
  unit: string;
  /** CO2 in kg per 1 unit of `unit`. Used to recompute co2_kg when amount changes. */
  co2PerUnit: number;
}

export const CATEGORIES: { key: Category; name: string; icon: string; color: string }[] = [
  { key: 'transport', name: 'Transport', icon: '🗺️', color: '#7DD3FC' },
  { key: 'food',      name: 'Food',      icon: '🍽️', color: '#FB923C' },
  { key: 'energy',    name: 'Energy',    icon: '🌡️', color: '#FCD34D' },
  { key: 'digital',   name: 'Digital',   icon: '📱', color: '#A78BFA' },
  { key: 'other',     name: 'Other',     icon: '◯',  color: '#9CA3AF' },
];

/**
 * Activity types grouped by category.
 * co2PerUnit values are approximate — good enough for MVP. Will be refined
 * with actual emission factors in v1.1.
 */
export const ACTIVITY_TYPES: Record<Category, ActivityTypeDef[]> = {
  transport: [
    { key: 'car',      name: 'Drive (car)',     icon: '🚗', unit: 'mi', co2PerUnit: 0.411 },
    { key: 'cycling',  name: 'Cycle',           icon: '🚴', unit: 'mi', co2PerUnit: 0 },
    { key: 'walking',  name: 'Walk',            icon: '🚶', unit: 'mi', co2PerUnit: 0 },
    { key: 'bus',      name: 'Bus',             icon: '🚌', unit: 'mi', co2PerUnit: 0.105 },
    { key: 'train',    name: 'Train / metro',   icon: '🚆', unit: 'mi', co2PerUnit: 0.041 },
    { key: 'flight',   name: 'Flight',          icon: '✈️', unit: 'mi', co2PerUnit: 0.255 },
  ],
  food: [
    { key: 'meatmeal', name: 'Meat meal',       icon: '🍖', unit: 'meal', co2PerUnit: 4.5 },
    { key: 'vegmeal',  name: 'Veg / plant meal', icon: '🥗', unit: 'meal', co2PerUnit: 0.9 },
    { key: 'coffee',   name: 'Coffee',          icon: '☕', unit: 'cup', co2PerUnit: 0.28 },
    { key: 'custom',   name: 'Other food',      icon: '🍽️', unit: 'kg', co2PerUnit: 1 },
  ],
  energy: [
    { key: 'electricity', name: 'Electricity',  icon: '⚡', unit: 'kWh', co2PerUnit: 0.4 },
    { key: 'heating',     name: 'Heating',      icon: '🔥', unit: 'hr',  co2PerUnit: 1.2 },
    { key: 'gas',         name: 'Gas',          icon: '🏠', unit: 'm³',  co2PerUnit: 2.0 },
  ],
  digital: [
    { key: 'streaming', name: 'Streaming',      icon: '📺', unit: 'hr', co2PerUnit: 0.055 },
    { key: 'videoconf', name: 'Video call',     icon: '📹', unit: 'hr', co2PerUnit: 0.15 },
    { key: 'custom',    name: 'Other digital',  icon: '📱', unit: 'hr', co2PerUnit: 0.05 },
  ],
  other: [
    { key: 'custom',    name: 'Other',          icon: '◯', unit: 'kg', co2PerUnit: 1 },
  ],
};

/**
 * Lookup helper: find a type definition given a (category, activity_type) pair.
 * Returns null if not found — caller should handle gracefully.
 */
export function findActivityType(category: string, activityType: string): ActivityTypeDef | null {
  const cat = ACTIVITY_TYPES[category as Category];
  if (!cat) return null;
  return cat.find(t => t.key === activityType) ?? null;
}

/**
 * Lookup helper: find a category definition by key.
 */
export function findCategory(key: string): (typeof CATEGORIES)[number] | null {
  return CATEGORIES.find(c => c.key === key) ?? null;
}

/**
 * Compute co2_kg from amount using activity type's factor.
 * If the type is unknown, falls back to treating amount as kg (co2PerUnit = 1).
 */
export function computeCo2(category: string, activityType: string, amount: number): number {
  const def = findActivityType(category, activityType);
  if (!def) return amount; // fallback: treat amount as kg
  return Math.max(0, amount * def.co2PerUnit);
}
