// src/lib/checkins.ts
//
// Follow-up questions that keep a streak alive (decided 27 Sep 2026): every
// habit gets a one-tap check-in, so a day counts even when nothing was snapped.
//
// Rules that keep this honest:
//   • Only ask what the onboarding answers make relevant.
//   • At most three open check-ins at once.
//   • One tap answers it. The backend phase adds the same questions as
//     actionable notifications, so most can be answered without opening
//     the app.
//   • A check-in keeps the streak. It feeds estimates as "you said", and is
//     never counted as verified air given back on its own.
//   • Some answers lead to a snap (receipt, bill); the answer still counts
//     if the person doesn't snap.

import { OnboardingAnswers } from './plan';

export type CheckInCadence = 'daily' | 'weekly' | 'monthly';

export interface CheckIn {
  id: string;
  cadence: CheckInCadence;
  question: string;
  options: { value: string; label: string; snap?: boolean }[];
}

function drinkWord(a: OnboardingAnswers): string {
  switch (a.drink) {
    case 'matcha':
      return 'matcha';
    case 'tea':
      return 'tea';
    default:
      return 'coffee';
  }
}

export function checkInsFor(a: OnboardingAnswers, now: Date = new Date()): CheckIn[] {
  const out: CheckIn[] = [];

  if (a.drink && a.drink !== 'none') {
    const w = drinkWord(a);
    out.push({
      id: 'drink',
      cadence: 'daily',
      question: `Your ${w} today?`,
      options:
        a.drink === 'tea'
          ? [
              { value: 'had', label: 'Had it' },
              { value: 'skipped', label: 'Skipped' },
            ]
          : [
              { value: 'plant', label: 'With oat or plant' },
              { value: 'dairy', label: 'With dairy' },
              { value: 'black', label: 'Black' },
              { value: 'skipped', label: 'Skipped' },
            ],
    });
  }

  if (a.transport === 'drive' || a.transport === 'mix' || !a.transport) {
    out.push({
      id: 'drive',
      cadence: 'daily',
      question: 'How far did you drive today?',
      options: [
        { value: '0', label: 'Didn’t' },
        { value: 'lt10', label: 'Under 10 mi' },
        { value: '10-30', label: '10–30 mi' },
        { value: 'gt30', label: '30+ mi' },
      ],
    });
  }

  out.push({
    id: 'lunch',
    cadence: 'daily',
    question: 'What was lunch?',
    options: [
      { value: 'snap', label: 'Snap it', snap: true },
      { value: 'plant', label: 'Plant-based' },
      { value: 'meat', label: 'Had meat' },
      { value: 'skipped', label: 'Skipped' },
    ],
  });

  // Weekly: groceries (asked from Thursday on, until answered that week).
  if (now.getDay() >= 4 || now.getDay() === 0) {
    out.push({
      id: 'groceries',
      cadence: 'weekly',
      question: 'Grocery run or order this week?',
      options: [
        { value: 'snap', label: 'Snap the receipt', snap: true },
        { value: 'yes', label: 'Yes, no receipt' },
        { value: 'not_yet', label: 'Not yet' },
      ],
    });
  }

  // Monthly: the electricity bill, from the 1st until answered.
  if (now.getDate() <= 10) {
    out.push({
      id: 'bill',
      cadence: 'monthly',
      question: 'Has your electricity bill arrived?',
      options: [
        { value: 'snap', label: 'Snap it', snap: true },
        { value: 'not_yet', label: 'Not yet' },
      ],
    });
  }

  return out;
}

/** The open check-ins for today, capped at three, skipping answered ones. */
export function openCheckIns(
  a: OnboardingAnswers,
  answeredToday: Record<string, string> | undefined,
  answeredThisPeriod: (id: string, cadence: CheckInCadence) => boolean,
  now: Date = new Date()
): CheckIn[] {
  return checkInsFor(a, now)
    .filter((c) => !(answeredToday && answeredToday[c.id]))
    .filter((c) => c.cadence === 'daily' || !answeredThisPeriod(c.id, c.cadence))
    .slice(0, 3);
}
