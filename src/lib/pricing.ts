// src/lib/pricing.ts
//
// One place for what Eco Pulse charges (decided 27 Sep 2026, see
// claude/PRICING-MODEL.md in the project).
//
//   • No free tier. Hard paywall after onboarding.
//   • 7-day free trial, then $10 a month.
//   • A key from someone's kept pact takes half off the first paid month,
//     for the friend who uses it and for the person who passed it on.
//     The reward is granted when the friend pays their first month, never
//     at sign-up, so it can't be farmed with throwaway accounts.
//   • Every new link gives the whole chain a free streak repair.
//   • A streak repair can also be bought for $0.99.
//
// Display strings only. The App Store is the source of truth for the actual
// price, which will arrive per-locale from StoreKit in the backend phase.

export const PRICE_MONTHLY_USD = 10;
export const TRIAL_DAYS = 7;
export const TRIAL_REMINDER_DAY = 5; // we tell people two days before billing
export const KEY_DISCOUNT = 0.5; // off the first paid month, both people
export const REPAIR_PRICE_USD = 0.99;

export const priceLabel = `$${PRICE_MONTHLY_USD}`;
export const discountedFirstMonth = `$${(PRICE_MONTHLY_USD * (1 - KEY_DISCOUNT)).toFixed(0)}`;
export const repairLabel = `$${REPAIR_PRICE_USD.toFixed(2)}`;
