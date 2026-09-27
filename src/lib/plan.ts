// src/lib/plan.ts
//
// Onboarding: six questions, then a starting plan (claude/ONBOARDING-PLAN.md).
// Rule: every question changes the plan, or it goes.
//
// The factors below are first-pass estimates so the screens have honest
// shapes to show. They are rough on purpose and every figure the plan shows
// is labelled an estimate. Before launch each one moves into the sourced fact
// library (the same library the Table Card and Snap facts use), and the
// estimate becomes a range.

export type Transport = 'drive' | 'transit' | 'bike' | 'mix';
export type Diet = 'meat_most' | 'some_meat' | 'vegetarian' | 'vegan';
export type Drink = 'coffee_milk' | 'plant_milk' | 'matcha' | 'tea' | 'none';
export type Household = '1' | '2' | '3-4' | '5+';
export type Currency = 'money' | 'health' | 'air' | 'all';

export interface OnboardingAnswers {
  transport?: Transport;
  car?: string; // free text, "Honda Civic 2019" — stored as a stated fact
  diet?: Diet;
  drink?: Drink;
  household?: Household;
  city?: string;
  currency?: Currency;
}

export interface Question<K extends keyof OnboardingAnswers = keyof OnboardingAnswers> {
  key: K;
  title: string;
  why: string; // what the answer changes, shown under the options
  options?: { value: string; label: string }[];
  input?: { placeholder: string; optional?: boolean };
  extraInput?: { key: keyof OnboardingAnswers; placeholder: string };
  skipIf?: (a: OnboardingAnswers) => boolean;
}

export const QUESTIONS: Question[] = [
  {
    key: 'transport',
    title: 'How do you usually get around?',
    why: 'Sets how much of your week is driving, often the biggest line.',
    options: [
      { value: 'drive', label: 'Drive' },
      { value: 'transit', label: 'Transit' },
      { value: 'bike', label: 'Bike or walk' },
      { value: 'mix', label: 'A mix' },
    ],
  },
  {
    key: 'car',
    title: 'What do you drive?',
    why: 'Every trip gets priced against your car, not an average one.',
    input: { placeholder: 'Make and model, e.g. Honda Civic', optional: true },
    skipIf: (a) => a.transport === 'transit' || a.transport === 'bike',
  },
  {
    key: 'diet',
    title: 'How do you usually eat?',
    why: 'Sets the food share, and which swaps are worth suggesting at all.',
    options: [
      { value: 'meat_most', label: 'Meat most meals' },
      { value: 'some_meat', label: 'Some meat' },
      { value: 'vegetarian', label: 'Vegetarian' },
      { value: 'vegan', label: 'Vegan' },
    ],
  },
  {
    key: 'drink',
    title: 'Your daily drink?',
    why: 'Small, daily, and most people misjudge it.',
    options: [
      { value: 'coffee_milk', label: 'Coffee with milk' },
      { value: 'plant_milk', label: 'Oat or plant milk' },
      { value: 'matcha', label: 'Matcha' },
      { value: 'tea', label: 'Tea' },
      { value: 'none', label: 'None' },
    ],
  },
  {
    key: 'household',
    title: 'Who’s at home, and which city?',
    why: 'Splits home energy per person, and picks your grid, recycling rules and recall region.',
    options: [
      { value: '1', label: 'Just me' },
      { value: '2', label: '2' },
      { value: '3-4', label: '3–4' },
      { value: '5+', label: '5+' },
    ],
    extraInput: { key: 'city', placeholder: 'City, e.g. Frisco, TX' },
  },
  {
    key: 'currency',
    title: 'What would make this worth it?',
    why: 'A starting guess. The assistant adjusts once it sees what you act on.',
    options: [
      { value: 'money', label: 'Save money' },
      { value: 'health', label: 'Feel healthier' },
      { value: 'air', label: 'Give back to the air' },
      { value: 'all', label: 'All of it' },
    ],
  },
];

export function visibleQuestions(a: OnboardingAnswers): Question[] {
  return QUESTIONS.filter((q) => !q.skipIf?.(a));
}

// ---- factors (estimates, to move into the sourced library) ---------------

const KG_PER_GALLON = 8.887; // EPA, gasoline CO2 per gallon
const LB_PER_KG = 2.20462;
const GAS_USD_PER_GALLON = 3.1; // placeholder, replace with EIA regional price
const DEFAULT_MPG = 25.4;

// A few common cars; anything else uses the fleet default until the car
// fact is resolved by the backend (EPA fuel economy data).
const MPG_HINTS: Record<string, number> = {
  civic: 36, corolla: 35, camry: 32, accord: 32, prius: 52, 'rav4': 30,
  'cr-v': 30, 'model 3': 0, 'model y': 0, 'f-150': 20, silverado: 19, tacoma: 21,
};

export function mpgFor(car?: string): number {
  if (!car) return DEFAULT_MPG;
  const c = car.toLowerCase();
  for (const key of Object.keys(MPG_HINTS)) if (c.includes(key)) return MPG_HINTS[key] || DEFAULT_MPG;
  return DEFAULT_MPG;
}

export function isElectric(car?: string): boolean {
  if (!car) return false;
  const c = car.toLowerCase();
  return c.includes('tesla') || c.includes('model 3') || c.includes('model y') || c.includes('ev') || c.includes('electric') || c.includes('leaf') || c.includes('ioniq');
}

export interface PlanMove {
  id: string;
  title: string;
  lbPerWeek: number;
  usdPerWeek: number; // negative = saves money, 0 = about even
  defaultOn: boolean;
  currency: Currency;
}

export interface StartingPlan {
  biggestLines: string[]; // "driving", "food"
  moves: PlanMove[];
}

export function buildPlan(a: OnboardingAnswers): StartingPlan {
  const moves: PlanMove[] = [];
  const drives = a.transport === 'drive' || a.transport === 'mix';
  const ev = isElectric(a.car);

  if (drives && !ev) {
    const mpg = mpgFor(a.car);
    const miles = 10; // two errand drives folded into one trip
    const gallons = miles / mpg;
    moves.push({
      id: 'combine_errands',
      title: 'Combine two errand drives',
      lbPerWeek: gallons * KG_PER_GALLON * LB_PER_KG,
      usdPerWeek: -gallons * GAS_USD_PER_GALLON,
      defaultOn: true,
      currency: 'money',
    });
  }

  if (a.drink === 'coffee_milk') {
    // About 200 ml of milk a day; dairy vs oat difference per litre.
    moves.push({
      id: 'oat_latte',
      title: 'Oat milk in your daily coffee',
      lbPerWeek: 0.2 * 7 * 2.3 * LB_PER_KG,
      usdPerWeek: 0,
      defaultOn: true,
      currency: 'air',
    });
  } else if (a.drink === 'matcha') {
    moves.push({
      id: 'matcha_plant',
      title: 'Plant milk in your matcha',
      lbPerWeek: 0.2 * 7 * 2.3 * LB_PER_KG,
      usdPerWeek: 0,
      defaultOn: true,
      currency: 'air',
    });
  }

  if (a.diet === 'meat_most' || a.diet === 'some_meat') {
    moves.push({
      id: 'meatfree_lunch',
      title: a.diet === 'meat_most' ? 'Two meat-free lunches a week' : 'One meat-free lunch a week',
      lbPerWeek: (a.diet === 'meat_most' ? 2 : 1) * 1.5 * LB_PER_KG,
      usdPerWeek: (a.diet === 'meat_most' ? 2 : 1) * -2,
      defaultOn: false,
      currency: 'health',
    });
  }

  const people = a.household === '1' ? 1 : a.household === '2' ? 2 : a.household === '3-4' ? 3.5 : a.household === '5+' ? 5 : 2;
  moves.push({
    id: 'thermostat',
    title: 'Nudge the thermostat 2° when you’re out',
    lbPerWeek: 9 / people,
    usdPerWeek: -3 / people,
    defaultOn: false,
    currency: 'money',
  });

  if (a.transport === 'transit' || a.transport === 'bike') {
    moves.unshift({
      id: 'keep_moving',
      title: 'Keep your car-free days going',
      lbPerWeek: 4,
      usdPerWeek: 0,
      defaultOn: true,
      currency: 'health',
    });
  }

  // Lead with what this person said they care about.
  const pref = a.currency && a.currency !== 'all' ? a.currency : null;
  moves.sort((x, y) => {
    if (pref) {
      const px = x.currency === pref ? 1 : 0;
      const py = y.currency === pref ? 1 : 0;
      if (px !== py) return py - px;
    }
    return y.lbPerWeek - x.lbPerWeek;
  });

  const biggestLines: string[] = [];
  if (drives && !ev) biggestLines.push('driving');
  if (a.diet === 'meat_most' || a.diet === 'some_meat') biggestLines.push('food');
  biggestLines.push('home energy');

  return { biggestLines: biggestLines.slice(0, 2), moves: moves.slice(0, 3) };
}

export function fmtUsdWeek(v: number): string {
  if (Math.abs(v) < 0.5) return 'about even';
  return `${v < 0 ? '−' : '+'}$${Math.abs(v).toFixed(0)} a week`;
}
