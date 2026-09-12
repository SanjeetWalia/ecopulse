# Eco Pulse — Launch Roadmap

**Status:** Private beta (invite-only, live on tryecopulse.com) · v3 redesign built but unmerged and unbuilt
**Active branch:** `redesign-v3` (4 commits ahead of `sdk-54-upgrade`, which is 3 ahead of `main`)
**Target TestFlight rebuild:** next session — nothing else is safe until v3 + SDK 55 runtime-passes
**Target external beta:** gated on OBS-012 (email signup), unresolved since April 28
**Target public launch:** unset. May 16 and June 17 both passed. Do not set a new date until the branch stack is merged and OBS-012 is closed.
**Owner:** Sanjeet Walia (solo founder)
**Last updated:** September 12, 2026 (v6 — repo audit after a 7-week gap; v3 reality captured; Sections M/N/O/P added)

---

## What changed since v5 (April 24)

v5 described a 5-tab logging app being polished for a May 16 launch. That app no longer exists in the code. Between July 2 and July 25 the product was redesigned:

- **4-tab navigation** (Home · Air · Pulse · You) with a center camera button, replacing the old structure
- **The metric was reframed** from "CO₂e emitted" to **"lb of air given back"** — `max(0, 28.6kg baseline − emitted)`. Positive framing, Oura-style: open on the outcome, never a demand.
- **New screens:** AirScreen (composition + optimizer + unclaimed air), PulseScreen (time scope + circle feed + EcoKey invites), YouScreen (membership + account + delete), EcoChatScreen
- **New edge function:** `eco-chat`, which carries the first real memory layer (`user_facts`: reads up to 25 durable facts into the system prompt, extracts new ones from each message, upserts them)
- **Social landed** as Circle via EcoKey friendships — shared_snaps, leaves, RLS-filtered feed
- **Delete account flow shipped** (C2, Apple requirement)
- **Snap** gained photo persistence and share

None of this has been built to TestFlight. The last runtime-verified build is #11/#12 from April 28, which is the *old* app.

---

## 🌱 Product vision (unchanged, and v3 serves it better)

The thesis holds: the app has to be for the user first; only then does it gather insights for corporate reporting. User value → retention → data density → B2B credibility.

A behavioral coach for low-carbon living on the observe → interpret → coach → reinforce loop:

1. **Observe** — passive + manual collection. v3 status: manual, Snap, eco-chat. Apple Health / Timeline / Plaid still unclaimed (AirScreen literally says so).
2. **Interpret** — Moko-Avi's line on Home, the composition bar and optimizer on Air. Shipped in thin form.
3. **Coach** — the optimizer exists but is rule-based, not personalized. **This is where Sections N + O land.**
4. **Reinforce** — nothing. No targets, no milestones, no notifications. **This is where Sections O + P land.**

The gap between v3 and the thesis is exactly stages 3 and 4. Everything in Sections M-P below closes it.

---

## 🚨 THE STACK (do these in order, nothing overtakes them)

- [ ] **S1. Build `redesign-v3` to TestFlight.** SDK 55 has never been runtime-verified; v3 has never been built. Verify together: ring animation (Reanimated 4), camera modal, date picker, focus/blur behavior (React 19), Snap persistence, eco-chat round trip, delete account RPC.
- [ ] **S2. Merge the stack.** If S1 is clean: `sdk-54-upgrade` → `main`, then `redesign-v3` → `main`. Stop carrying two unmerged branches.
- [ ] **S3. OBS-012 — route email signup.** `SignUpScreen.tsx` exists and is unrouted. Add it to the post-invite-code path in `src/navigation/index.tsx`. Blocks Beta App Review → blocks external testers → blocks launch. Open since April 28.
- [ ] **S4. Schema into version control (OBS-018).** Create `supabase/migrations/`, dump the live schema, commit `delete_account.sql`. The v3 tables exist only in the dashboard.

---

## 🔵 SECTION M — Navigation: minimum tabs, maximum usability

**Problem (OBS-013):** the same number is split across three tabs by timeframe. Home = today, Air = this month, Pulse = week/month/year. Users must learn a filing system before they can read their own data.

**Principle:** a tab answers a different *question*, not a different *timeframe*.

| Tab | Question it answers |
|---|---|
| Today | How am I doing right now, and why? |
| Pulse | Am I trending, and who is with me? |
| You | What does the app know, what am I aiming at, what do I pay? |

- [ ] M1. **Collapse to 3 tabs + center camera.** Today · Pulse · You. Camera stays center — it is input, not a destination.
- [ ] M2. **Scope control on the ring.** Tapping the ring cycles Today / Week / Month / Year in place. This single control removes the entire reason Air and Pulse held different windows.
- [ ] M3. **Absorb Air into Today, below the fold.** Composition bar + contribution rows + optimizer become a scroll-down section of Today, in this order: ring → Moko-Avi line → today's flow → where your air went → optimizer. Composition is the answer to "why is my number what it is," so it belongs directly under the number, not one tab away.
- [ ] M4. **Promote eco-chat out of tab space.** Chat is the interpretation layer, not a destination. Entry point: tap Moko-Avi's line on Today. It opens as a modal over Today, same presentation as Snap.
- [ ] M5. **"Unclaimed air" moves to You → Sources.** A permanent, honest list of data sources with real states (connected / not connected / coming). Removes the two dead "Soon" buttons from the main surface (OBS-020).
- [ ] M6. **Pulse keeps time + circle.** Trend sparkline, period totals, circle feed, EcoKey invites. Unchanged.
- [ ] M7. **You gains three sections:** Memory (Section N), Targets (Section O), Notifications (Section P), alongside Membership and Account.

**Optional harder cut (decide in X11):** 2 tabs — Today and Circle — with You behind the header avatar. Defensible, but destructive to do at the same time as M1-M7. Ship 3 tabs first, measure, then decide.

---

## 🔵 SECTION N — Memory: what the app knows about you

**Current state:** `user_facts` exists and works, but only `eco-chat` writes to it, and it stores only what the user *said*.

- [ ] N1. **Extract memory on every AI path, not just chat (OBS-014).** Run the same fact-extraction pass in `analyze-activity` and `analyze-food-photo`. A user who only snaps and logs should still build a memory.
- [ ] N2. **Split stated from observed (OBS-015).** Add `source` (`stated` | `observed`) and `confidence` to `user_facts`. Stated = the user told you. Observed = the app computed it. Never let an observed inference masquerade as something the user said.
- [ ] N3. **Write observed facts nightly.** Personal baseline (rolling 10-day), typical weekday vs weekend, per-category personal averages, dominant transport mode, logging cadence. These are what make the optimizer personal instead of rule-based.
- [ ] N4. **Make memory visible and editable.** You → "What Eco Pulse remembers": a plain list of facts, each deletable, each showing whether it was told or observed. Users trust what they can correct, and this is the cheapest possible answer to an App Store privacy question.
- [ ] N5. **Calibrate the numbers with memory.** Their actual vehicle drives the transport factor. Their electricity bill drives the home-energy factor. Their diet shapes food comparisons. Memory that does not change a number is decoration.
- [ ] N6. **Confirm, don't accumulate.** Facts older than ~90 days get one gentle re-confirmation in chat ("still the Civic?"). Stale memory is worse than no memory.
- [ ] N7. **Memory feeds targets and milestones.** Section O proposes targets from the observed baseline; Section P detects milestones against it. N3 is a hard dependency for both.

---

## 🔵 SECTION O — Targets

**Problem (OBS-016):** the app measures continuously and asks for nothing. Nothing closes a loop, so there is no honest reason to come back weekly.

- [ ] O1. **One target, not many.** A single primary target in the app's own unit: **lb of air given back per week.** Positive framing, consistent with v3.
- [ ] O2. **Never let them set it blind.** Target setting unlocks only after the 10-day baseline exists (reuse the Moko-Avi warmup gate). Before that, the app says what it is still learning.
- [ ] O3. **Propose three tiers off the observed baseline.** Gentle (+5%), Steady (+10%), Ambitious (+20%), each translated into a concrete behavior ("about two fewer car trips a week"). The user accepts or drags to a custom value.
- [ ] O4. **`targets` table.** `user_id, metric, period, value, source (suggested|custom), started_at, ended_at, status (active|hit|missed|abandoned)`. One active row per user.
- [ ] O5. **Progress lives on the ring, not on a new screen.** A faint arc behind the live arc. No second destination, no dashboard.
- [ ] O6. **Weekly close-out is the retention loop.** At period end: result, by how much, one Moko-Avi sentence, then the next target proposed. This is the moment worth a notification (P3).
- [ ] O7. **A miss is never punished.** No streak-break language, no red, no guilt. "Short by 4 lb. Tuesday and Wednesday carried the week." Then re-propose, possibly lower. The anti-engagement principle applies here or it applies nowhere.

---

## 🔵 SECTION P — Milestones and notifications

**Problem (OBS-017):** no infrastructure at all. `expo-notifications` is not installed, there is no `push_tokens` table, no APNs key in EAS, no scheduled job.

**Governing rule:** milestones are rare and earned. Hard budget: **max 2 push per week, max 1 per day**, quiet hours respected via `profiles.timezone` (already stored and already correct). Never a "don't forget to log today."

- [ ] P1. **Install the plumbing.** `expo-notifications`, push permission handling, `push_tokens` table (user_id, token, platform, updated_at), APNs key in EAS, `aps-environment` entitlement.
- [ ] P2. **Compute milestones server-side.** A nightly Supabase scheduled job, bucketed by timezone, evaluates rules against `daily_summaries` + `user_facts` and inserts into a `milestones` table with a dedupe key. A sender edge function reads undelivered rows and pushes via the Expo Push API. Client-side local notifications cannot detect "best week ever" — this has to be server-side.
- [ ] P3. **Milestone classes worth firing:**
  1. **Target period closed** (Section O) — 1/week, scheduled, the anchor notification
  2. **Firsts** — first snap, first full week, baseline ready on day 10. Once each, ever.
  3. **Streak thresholds** — 7, 30, 100 days only. Never daily.
  4. **Personal records** — best week, best day. Deduped, max 1/week.
  5. **Real pattern detection** — "three car-free days in a row." Capped at 1/week.
  6. **Dormancy** — one message after 7 silent days. Then silence until they return.
- [ ] P4. **Every milestone also renders in-app** as a card in Today's flow. Users who deny push must still get the reinforcement.
- [ ] P5. **Ask for permission at the right moment.** Never at onboarding. Ask immediately after their first milestone fires in-app: "Want me to tell you when this happens?" Opt-in rates are several times higher and the ask is honest, because they have just seen what they would be getting.
- [ ] P6. **User control in You → Notifications.** Per-class toggles (targets / records / streaks / patterns), quiet hours, and a master off.

---

## 🔴 SECTION A — Ship-blocking bugs

- [x] A1, A3, A7, A8, A10, A11, A13, A14, A2 — shipped April 23-28
- [ ] **A4. Deduplicate Moments feed** — verify whether v3 still surfaces Moments at all; may be obsolete
- [ ] **A5 / A6. Messages + Gift a Plant stubs** — v3 dropped both from navigation. Confirm the screens are dead code and delete them, or re-route. Currently unrouted but present.
- [ ] A9. Day tab stale data on refresh — re-verify against v3 Home
- [ ] A12. Baseline error reporting (Sentry free tier) — still nothing. With two untested branches merging, this matters more now than it did in April.

---

## 🔴 SECTION B — TestFlight + EAS pipeline

- [x] B1-B12 — pipeline, builds, submission all working
- [x] B13 — Expo SDK 51 → 55 upgrade **committed** April 28, still **never runtime-verified** (see S1)
- [ ] B14. Rebuild and submit `redesign-v3`. `eas submit --profile production --platform ios --latest` remains the path. `eas.json` preview profile must stay unpinned (SDK 55 defaults to the right Xcode image).
- [ ] B15. `app.json` still says `"version": "1.0.0"`, `"buildNumber": "1"` with `appVersionSource: remote`. Confirm remote versioning is actually driving TestFlight numbering before the next submit.

---

## 🔴 SECTION C — Apple compliance

- [x] **C2. Delete account flow — SHIPPED** in v3 (YouScreen → `delete_account` RPC). Note: the RPC SQL is not in the repo (OBS-018).
- [ ] C1. Verify TestFlight is production bundle
- [ ] C3. Camera permission rationale screen — more urgent now that camera is the center tab button
- [ ] C4. Privacy policy at tryecopulse.com/privacy — **now gating**: Sections N and P add memory and push, both of which Apple will ask about
- [ ] C5. Terms of service at tryecopulse.com/terms
- [ ] C6. App Store listing metadata — screenshots must be reshot for v3
- [ ] C7. App icon all sizes
- [ ] C8. Final app name (see X7)

---

## 🔴 SECTION D — Security

- [ ] D1. Audit RLS on every table — **expanded scope**: v3 added `snaps`, `shared_snaps`, `leaves`, `user_facts`, `eco_chat_messages` and friendships. PulseScreen's comment says "RLS does the filtering — the client never sees strangers' rows." That claim needs to be tested, not assumed.
- [ ] D2. Audit production bundle for hardcoded secrets
- [ ] D3. Moments feed privacy gate
- [ ] D4. Revisit Edge Function `--no-verify-jwt`
- [ ] D5. Billing alerts: Anthropic + Supabase ($25/$50/$100) — **more urgent with v3**: eco-chat makes two Claude calls per message (reply + fact extraction)
- [ ] D6. US trademark for "Eco Pulse"
- [ ] D7. Remove placeholder `YOUR_SUPABASE_URL` from `app.json` extra block — still present

---

## 🟡 SECTION E — Should-fix

- [ ] E1. Character limit + fallback when AI can't parse
- [ ] E2. "Air given back" first-encounter explainer — v3 renamed the metric, so this is now a *new* unexplained concept, not a solved one
- [ ] E3-E4. Leaderboard / badge copy — likely obsolete under v3, verify then close
- [ ] E5. Streak counter inconsistency — unresolved and now entangled with Section P
- [ ] E6. Audit async screens for timeout + retry — the four v3 screens were never audited

---

## 🟡 SECTION F / 🟢 G / 🟡 H / 🟢 I — Funnel, growth, marketing, cross-partisan

Unchanged from v5. All post-launch. Note I1 (dollars saved) pairs naturally with N5 calibration — the bill data needed for one is the bill data needed for the other.

---

## 🟢 SECTION J — Moko-Avi

- [x] J1/J2/J4 — v1 shipped April 24, still live
- [ ] J3. In-app knowledge layer — **partially superseded** by `eco-chat`, which already answers app questions. Reconcile: eco-chat and moko-avi-summary are now two Claude surfaces with separate prompts and separate memory access. Decide whether moko-avi-summary should read `user_facts` too (it currently does not).
- Standing decision from April: Moko-Avi v2 ships as the v1.1 paid tier. YouScreen already renders the Eco (free) / Eco Pulse (paid) split with no payment flow behind it.

---

## 🟢 SECTION K — Reference points

- [x] K3 — shipped via Moko-Avi
- [ ] K1. Dollars saved / trend arrow / comparison on every number — **v3 made this worse before better**: "lb of air given back" is a more motivating unit but a *less* familiar one. It needs a comparator more than CO₂e did.
- [ ] K2. First-encounter explainer (see E2)

---

## ⚠️ SECTION X — Decisions needed

- [x] X9 — RESOLVED: v1 free, Moko-Avi v2 paid
- [x] X10 — RESOLVED: Apple Health in v1 (walking + biking, read-only) — **still not started, and now 4.5 months old.** Re-decide: is this still v1 scope, or does it move behind the Sections M-P retention work? AirScreen currently promises it with a "Soon" button.
- [ ] **X11 — 3 tabs or 2?** Section M ships 3. Decide after a real beta cohort uses it.
- [ ] **X12 — Does a target reset weekly or roll?** O1 says weekly. Confirm before building O4.
- [ ] **X13 — New public launch date.** Do not set one until S1-S3 are done.
- [ ] X1-X8 — unchanged from v4/v5

---

## 🗓️ Sunday Planning Ritual

15 min every Sunday evening: check off what shipped, move or cut what didn't, pick 3-5 items for the week, revise dates, write one sentence of what you learned.

**Skip the ritual 2 weeks in a row → pace is wrong.** It was skipped for roughly 20 weeks. The build did not stop, but the record of it did, and these two documents drifted 4.5 months out of date while ~6,500 lines of new product shipped into a branch. The ritual is the cheapest defence against that.
