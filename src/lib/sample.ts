// src/lib/sample.ts
//
// SAMPLE DATA for the v5 UI pass ("UI first, then the backend").
//
// Every new screen reads through src/lib/growth.ts, which returns these
// samples while SAMPLE_MODE is true. The backend phase replaces each read with
// a real query and flips the flag. Screens show a SAMPLE DATA tag whenever
// they are rendering anything from this file, so a tester can never mistake
// it for their own numbers.
//
// Nothing here is a sourced fact. Figures are placeholders chosen to have
// realistic shapes.

// On by default. A build that should talk to the real backend sets
// EXPO_PUBLIC_SAMPLE_MODE=false (eas.json env), after migration 0007 and the
// v5 functions are deployed and RevenueCat is configured.
export const SAMPLE_MODE = process.env.EXPO_PUBLIC_SAMPLE_MODE !== 'false';

// ---- chain ----------------------------------------------------------------

export interface ChainPerson {
  id: string;
  name: string;
  givenBackLb: number;
  joinedDaysAgo: number;
  firstMonthPaid: boolean;
  children: ChainPerson[];
}

export const SAMPLE_CHAIN: { upstream: { name: string; pact: string } | null; you: ChainPerson } = {
  upstream: { name: 'Maya', pact: 'two fewer drives a week' },
  you: {
    id: 'me',
    name: 'You',
    givenBackLb: 48,
    joinedDaysAgo: 41,
    firstMonthPaid: true,
    children: [
      {
        id: 'p1',
        name: 'Arjun',
        givenBackLb: 112,
        joinedDaysAgo: 30,
        firstMonthPaid: true,
        children: [
          { id: 'p3', name: 'Leah', givenBackLb: 64, joinedDaysAgo: 12, firstMonthPaid: true, children: [] },
          { id: 'p4', name: 'Sam', givenBackLb: 9, joinedDaysAgo: 4, firstMonthPaid: false, children: [] },
        ],
      },
      { id: 'p2', name: 'Priya', givenBackLb: 105, joinedDaysAgo: 22, firstMonthPaid: true, children: [] },
    ],
  },
};

export interface KeyInfo {
  id: string;
  code: string;
  earnedFrom: string; // the pact that earned it
  used: boolean;
}

export const SAMPLE_KEYS: KeyInfo[] = [
  { id: 'k1', code: 'ECO-7Q4M', earnedFrom: 'Oat milk in your daily coffee, kept 7 of 7 days', used: false },
  { id: 'k2', code: 'ECO-2HXN', earnedFrom: 'Combine two errand drives, kept 2 weeks', used: true },
  { id: 'k3', code: 'ECO-9TPA', earnedFrom: 'One meat-free lunch a week, kept 3 weeks', used: true },
];

export const SAMPLE_REWARDS = [
  { id: 'r1', when: '4 days ago', text: 'Sam joined through Arjun. Everyone in your chain got a free streak repair.' },
  { id: 'r2', when: '12 days ago', text: 'Leah paid her first month. Arjun’s next month is half price.' },
  { id: 'r3', when: '22 days ago', text: 'Priya paid her first month. Your next month was half price.' },
];

// ---- Heads up -------------------------------------------------------------

export type HeadsUpKind = 'recall' | 'regulation' | 'testing';

export interface HeadsUpItem {
  id: string;
  kind: HeadsUpKind;
  matched: boolean; // touches something in the user's history
  title: string;
  body: string;
  action: string;
  sourceName: string;
  sourceUrl: string;
  published: string;
  evidence?: 'one study' | 'several studies' | 'settled finding' | 'binding rule' | 'voluntary' | 'official recall';
  matchedItem?: { name: string; when: string; how: 'label scan' | 'receipt' | 'snap' };
  lotCodes?: string[];
}

export const SAMPLE_HEADS_UP: HeadsUpItem[] = [
  {
    id: 'h1',
    kind: 'recall',
    matched: true,
    title: 'The oat milk you scanned is in a recall',
    body: 'The maker is recalling some cartons of its barista oat milk because they may not have been sealed properly. Only the lot codes below are affected.',
    action: 'Check the lot code printed near the cap. If it matches, don’t drink it. The store will refund it with or without a receipt.',
    sourceName: 'FDA recall notice',
    sourceUrl: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts',
    published: 'Today',
    evidence: 'official recall',
    matchedItem: { name: 'Barista oat milk, 32 fl oz', when: '14 Jul', how: 'label scan' },
    lotCodes: ['L2419A', 'L2419B', 'L2420A'],
  },
  {
    id: 'h2',
    kind: 'regulation',
    matched: true,
    title: 'Synthetic dyes: the FDA asked makers to phase out six',
    body: 'The FDA has asked food makers to remove six petroleum-based dyes, including Red 40, with a 2027 target. It’s a request, not a ban, and some companies have made no commitment.',
    action: 'Three things you bought this month list Red 40. Nothing you need to do; if you’d rather avoid it, your label scans will flag it.',
    sourceName: 'Consumer Reports',
    sourceUrl: 'https://www.consumerreports.org/health/food-additives/one-year-later-are-synthetic-dyes-still-in-our-food-a5846944223/',
    published: 'This week',
    evidence: 'voluntary',
  },
  {
    id: 'h3',
    kind: 'testing',
    matched: false,
    title: 'An independent lab tested protein powders for lead',
    body: 'Levels varied widely by brand, and plant-based powders tended to test higher. None of the products you’ve scanned were in the test.',
    action: 'Nothing needed. If you start buying one, scan the label and it will be checked against the results.',
    sourceName: 'Independent testing report',
    sourceUrl: 'https://www.consumerreports.org/',
    published: 'This week',
    evidence: 'one study',
  },
];

export const SAMPLE_WATCH_LIST = [
  { id: 'w1', name: 'Barista oat milk, 32 fl oz', brand: 'Sample Oat Co.', addedFrom: 'label scan · 14 Jul' },
  { id: 'w2', name: 'Greek yogurt, plain, 32 oz', brand: 'Sample Dairy', addedFrom: 'receipt · 2 Aug' },
  { id: 'w3', name: 'Tortilla chips, 13 oz', brand: 'Sample Snacks', addedFrom: 'receipt · 2 Aug' },
];

// ---- Pulse timeline -------------------------------------------------------
// Weekly points. Past is observed, future is projected two ways.

export const SAMPLE_TIMELINE = {
  weeksPast: 12,
  weeksFuture: 12,
  air: {
    past: [18, 22, 19, 25, 27, 24, 30, 29, 33, 31, 35, 38], // lb given back per week
    asYouAre: 38,
    withPlan: 49,
    unit: 'lb',
    totalPast: 331,
  },
  money: {
    past: [2, 3, 3, 4, 6, 5, 7, 7, 8, 8, 9, 11], // $ saved per week
    asYouAre: 11,
    withPlan: 16,
    unit: '$',
    totalPast: 73,
  },
};

// ---- camera reads ---------------------------------------------------------

export type SnapKind =
  | 'meal' | 'menu' | 'label' | 'shelf' | 'receipt' | 'bill' | 'fuel' | 'fridge' | 'tag' | 'bin';

export const KIND_LABEL: Record<SnapKind, string> = {
  meal: 'a meal or drink',
  menu: 'a menu',
  label: 'a product label',
  shelf: 'two products to compare',
  receipt: 'a grocery receipt',
  bill: 'a utility bill',
  fuel: 'a fuel receipt',
  fridge: 'your fridge',
  tag: 'a clothing tag',
  bin: 'something to throw away',
};

export interface MealItem {
  id: string;
  name: string;
  guess?: boolean; // model's best guess
  lb: number;
  kcal: [number, number];
  proteinG: number;
  options?: { id: string; label: string; lb: number }[]; // pour / portion chips
  optionId?: string;
}

export const SAMPLE_MEAL = {
  title: 'A pint and an old fashioned',
  place: 'Frisco, TX',
  items: [
    {
      id: 'beer',
      name: 'Pint of lager',
      lb: 0.7,
      kcal: [180, 220],
      proteinG: 2,
      options: [
        { id: 'draft', label: 'Draft', lb: 0.7 },
        { id: 'bottle', label: 'Bottle', lb: 1.2 },
        { id: 'can', label: 'Can', lb: 1.2 },
      ],
      optionId: 'draft',
    },
    { id: 'of', name: 'Old fashioned', guess: true, lb: 1.0, kcal: [150, 190], proteinG: 0 },
  ] as MealItem[],
  good: 'Beer from a keg comes in around 40% lower than the same beer bottled, mostly because of the glass.',
  fewKnow: 'Growing the barley is a smaller share of a beer’s footprint than the packaging it ships in.',
  catch: null as string | null,
  tip: { title: 'Choose draft when the bar has it', lb: 0.5, usd: null as number | null, showFor: ['bottle', 'can'] },
  source: 'Beer packaging life-cycle study, Science of the Total Environment, 2024',
};

export const SAMPLE_MENU: {
  restaurant: string;
  dishes: { id: string; name: string; lb: number; kcal: [number, number]; price?: number; lighter?: boolean }[];
  usualLb: number;
} = {
  restaurant: 'Sample Kitchen, Frisco',
  dishes: [
    { id: 'd1', name: 'Grilled chicken bowl', lb: 3.1, kcal: [620, 740], price: 16 },
    { id: 'd2', name: 'Falafel plate', lb: 1.4, kcal: [680, 820], price: 14, lighter: true },
    { id: 'd3', name: 'Short rib', lb: 14.8, kcal: [900, 1100], price: 28 },
    { id: 'd4', name: 'Salmon, greens', lb: 4.2, kcal: [520, 640], price: 24 },
    { id: 'd5', name: 'Mushroom risotto', lb: 2.0, kcal: [700, 850], price: 19, lighter: true },
  ],
  usualLb: 3.6,
};

export const SAMPLE_LABEL = {
  brand: 'Sample Oat Co.',
  product: 'Barista oat milk',
  size: '32 fl oz',
  lb: 0.9,
  packaging: 'Carton, recyclable in Frisco curbside',
  facts: [
    { label: 'On the label', text: 'Contains dipotassium phosphate. Allowed in the US and EU.' },
    { label: 'Palm oil', text: 'None listed.' },
    { label: 'Processing', text: 'Has added oil and stabilisers, so it counts as ultra-processed.' },
  ],
  nutrition: { kcal: 120, proteinG: 3, sugarG: 7, per: 'per cup' },
  source: 'Additive rules: FDA and EU additive lists',
};

export const SAMPLE_SHELF = {
  a: { name: 'Store-brand oat milk', lb: 0.9, usdPerUnit: 0.11, unit: 'fl oz', kcal: 120, proteinG: 3 },
  b: { name: 'Whole dairy milk', lb: 2.9, usdPerUnit: 0.05, unit: 'fl oz', kcal: 150, proteinG: 8 },
};

export const SAMPLE_RECEIPT = {
  store: 'Sample Market',
  totalUsd: 86.4,
  lines: [
    { cat: 'Meat', lb: 21.4, usd: 24.9 },
    { cat: 'Dairy', lb: 9.8, usd: 12.1 },
    { cat: 'Produce', lb: 3.2, usd: 18.3 },
    { cat: 'Pantry', lb: 4.1, usd: 21.6 },
    { cat: 'Drinks', lb: 2.7, usd: 9.5 },
  ],
  swap: { text: 'Chicken instead of ground beef next time', lb: 14, usd: -3 },
};

export const SAMPLE_GENERIC: Record<'bill' | 'fuel' | 'fridge' | 'tag' | 'bin', {
  title: string;
  value: string;
  unit: string;
  line: string;
  rows: { label: string; text: string }[];
  asks?: string;
}> = {
  bill: {
    title: 'Electricity, August',
    value: '612',
    unit: 'lb CO₂e',
    line: '1,020 kWh over 31 days. 14% above your July, typical for August in Texas.',
    rows: [
      { label: 'Per day', text: '$4.30 and 19.7 lb.' },
      { label: 'Watch', text: 'September usually drops about a fifth once cooling eases.' },
    ],
    asks: 'Split it across the 31 days so each day carries its share?',
  },
  fuel: {
    title: '11.2 gallons, regular',
    value: '219',
    unit: 'lb CO₂e',
    line: 'That tank moves your Civic about 400 miles.',
    rows: [
      { label: 'Your mileage', text: '35.8 mpg since the last fill-up. Your trips now use this, not the fleet average.' },
      { label: 'Cost', text: '$34.60, about $0.09 a mile.' },
    ],
  },
  fridge: {
    title: 'Three things to use this week',
    value: '4.1',
    unit: 'lb at risk',
    line: 'About $9 of food is close to its best days.',
    rows: [
      { label: 'Spinach', text: 'Bought 5 days ago. Tonight: wilt it into pasta or eggs.' },
      { label: 'Yogurt', text: 'Two days left. Breakfast tomorrow.' },
      { label: 'Peppers', text: 'Fine for four more days.' },
    ],
  },
  tag: {
    title: '60% cotton, 40% polyester',
    value: '14',
    unit: 'lb CO₂e',
    line: 'Most of a shirt’s footprint is made before you ever wear it.',
    rows: [
      { label: 'Wear it longer', text: 'One more year of wear cuts its yearly footprint by about a third.' },
      { label: 'Care', text: 'Cold wash and line dry help it last.' },
    ],
  },
  bin: {
    title: 'Pizza box',
    value: 'Compost',
    unit: 'in Frisco',
    line: 'Greasy cardboard goes in compost. A clean lid can go in recycling.',
    rows: [{ label: 'Rule', text: 'City of Frisco curbside guide.' }],
  },
};
