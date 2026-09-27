// src/lib/purchases.ts
//
// The store layer, via RevenueCat (react-native-purchases). Kept behind this
// wrapper so the rest of the app never imports the SDK directly, and so the
// app still runs (in sample mode) where the native module isn't available,
// such as Expo Go or the web preview.
//
// App Store Connect setup this expects (see supabase/run-once/v5-setup.md):
//   • Subscription group "Eco Pulse", product ecopulse_monthly at $10 a month,
//     introductory offer: 7-day free trial.
//   • Promotional offer on ecopulse_monthly with id "half_month": 1 month at
//     50% off. This is how a key's half-price month is delivered, for the
//     friend who used the key and for the person who passed it on. A
//     promotional offer redeemed during the trial applies to the first paid
//     month. Confirm this in the sandbox before launch.
//   • Consumable ecopulse_streak_repair, $0.99.
//   • RevenueCat: entitlement "pulse", offering "default" with the monthly
//     package; webhook → supabase/functions/revenuecat-webhook.
//
// Server truth: the webhook writes public.user_entitlements. The client uses
// customerInfo only to unlock immediately after a purchase.

import { Platform } from 'react-native';

export const ENTITLEMENT_ID = 'pulse';
export const MONTHLY_PRODUCT_ID = 'ecopulse_monthly';
export const REPAIR_PRODUCT_ID = 'ecopulse_streak_repair';
export const HALF_MONTH_OFFER_ID = 'half_month';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';

let sdk: any = null;
let configured = false;

function load(): any {
  if (sdk) return sdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sdk = require('react-native-purchases').default;
  } catch {
    sdk = null;
  }
  return sdk;
}

export function purchasesAvailable(): boolean {
  return Platform.OS === 'ios' && !!IOS_KEY && !!load();
}

export async function configurePurchases(userId: string): Promise<void> {
  if (!purchasesAvailable()) return;
  const P = load();
  if (!configured) {
    P.configure({ apiKey: IOS_KEY, appUserID: userId });
    configured = true;
  } else {
    await P.logIn(userId);
  }
}

export type PurchaseOutcome = 'trial' | 'active' | 'cancelled' | 'unavailable' | 'error';

function outcomeFrom(info: any): PurchaseOutcome {
  const ent = info?.entitlements?.active?.[ENTITLEMENT_ID];
  if (!ent) return 'error';
  return ent.periodType === 'TRIAL' || ent.periodType === 'trial' ? 'trial' : 'active';
}

export async function startMonthly(): Promise<PurchaseOutcome> {
  if (!purchasesAvailable()) return 'unavailable';
  const P = load();
  try {
    const offerings = await P.getOfferings();
    const pkg = offerings?.current?.monthly ?? offerings?.current?.availablePackages?.[0];
    if (!pkg) return 'error';
    const { customerInfo } = await P.purchasePackage(pkg);
    return outcomeFrom(customerInfo);
  } catch (e: any) {
    return e?.userCancelled ? 'cancelled' : 'error';
  }
}

/** Redeems the half-price month a key earned (invitee or inviter). */
export async function claimHalfMonth(): Promise<boolean> {
  if (!purchasesAvailable()) return false;
  const P = load();
  try {
    const offerings = await P.getOfferings();
    const pkg = offerings?.current?.monthly;
    const discount = pkg?.product?.discounts?.find((d: any) => d.identifier === HALF_MONTH_OFFER_ID);
    if (!pkg || !discount) return false;
    const promo = await P.getPromotionalOffer(pkg.product, discount);
    if (!promo) return false;
    await P.purchaseDiscountedPackage(pkg, promo);
    return true;
  } catch {
    return false;
  }
}

/** Buys one streak repair. The webhook credits it; the caller then repairs. */
export async function buyRepair(): Promise<boolean> {
  if (!purchasesAvailable()) return false;
  const P = load();
  try {
    const [product] = await P.getProducts([REPAIR_PRODUCT_ID], P.PRODUCT_CATEGORY?.NON_SUBSCRIPTION ?? 'NON_SUBSCRIPTION');
    if (!product) return false;
    await P.purchaseStoreProduct(product);
    return true;
  } catch {
    return false;
  }
}

export async function restore(): Promise<PurchaseOutcome> {
  if (!purchasesAvailable()) return 'unavailable';
  try {
    const info = await load().restorePurchases();
    return outcomeFrom(info);
  } catch {
    return 'error';
  }
}
