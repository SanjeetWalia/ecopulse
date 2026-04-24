# Eco Pulse — Launch Roadmap

**Status:** Pre-launch · Building toward TestFlight beta
**Target TestFlight date:** Saturday, May 16, 2026 (revisable each Sunday)
**Target global launch:** Wednesday, June 17, 2026 (revisable each Sunday)
**Owner:** Sanjeet Walia (solo founder)
**Last updated:** April 24, 2026 (v5 — end of heavy build day; Moko-Avi K3 landed; Week 1 substantially complete)

---

## 🌱 Product vision: what this app becomes

**The thesis:** the app has to be for the user first; only then do we gather insights for corporate reporting.

User value → retention → data density → B2B credibility. Reversing the chain produces a tool users abandon, which leaves corporations with sparse data that proves nothing.

### What Eco Pulse is becoming

A behavioral coach for low-carbon living, modeled on Oura's observe → interpret → coach → reinforce loop. The user doesn't return to see a number. They return because the app helps them live the way they want to live.

### Four-phase behavior loop

1. **Observe** — passively collect carbon-relevant behavior (Plaid, Google Timeline, Snap, manual logs) over ~10 days to build a personal baseline.
2. **Interpret** — turn raw behavior into patterns and meaning. Moko-Avi is the interpretation layer: "Your footprint dropped 12% this week, mostly because you biked Tuesday through Thursday." **Minimum version shipped in v1 (K3).**
3. **Coach** — specific, timely nudges based on observed patterns. v1.2+.
4. **Reinforce** — the avatar evolves based on behavior, not activity count. v1.1+.

### Current state vs. target

| Dimension | v0 (pre-4/23) | v1 (shipping now) | v1.1-1.3 (Fall 2026) | v2 (2027+) |
|---|---|---|---|---|
| Measurement | CO₂e per activity | CO₂e + smart formatting + timezone-correct summaries | Same + reference points ($, % vs avg) | Same |
| Interpretation | None | 🟢 **Moko-Avi K3 shipped** — 10-day warmup, warm day summary | Proactive insights, pattern detection | Predictive |
| Coaching | None | None (on roadmap) | Specific nudges | Personalized coaching plans |
| Reinforcement | Streak only | Streak + Moko-Avi | Avatar evolution (Living Friend basic) | Living Friend fully |
| Data sources | Manual, Snap | Manual, Snap, edit/delete | + Google Timeline, Plaid, Apple Health, weather | + bank aggregation, IoT |
| B2B offering | None | None | Sustainability Dashboard (v1 case studies) | Primary revenue |

---

## How to use this document

- Top to bottom within each section
- Tags: 🔴 Critical · 🟡 Should fix · 🟢 Quality / growth · ⚠️ Decide
- Dates are targets, not contracts — revise every Sunday
- If launch slips, cut from the bottom

---

## 🗓️ Sunday Planning Ritual

15 min every Sunday evening:
1. Open this file
2. Check off what shipped
3. Move or cut what didn't
4. Pick 3-5 items for the week
5. If 2+ weeks of slippage, reset target launch date
6. Write one sentence at the bottom: "Week of [date]: what I learned"

Skip the ritual 2 weeks in a row → pace is wrong.

---

## 📝 Observations log

See `OBSERVATIONS.md` at repo root for the running list (OBS-001 through OBS-008 as of April 24). Triaged into ROADMAP during Sunday ritual.

**Active pending items from observations:**
- OBS-006 — keyboard hides chat input on Log Activity (bug, high priority, blocks primary input)
- OBS-007 — Claude can't resolve "since 7 am till now" (needs current time in system prompt)

---

## 🔴 SECTION A — Ship-blocking bugs

- [x] A1. Navigation tab hit-target offset — **FIXED** (commit `647a6fc`)
- [ ] A2. Infinite loading spinners on Profile and Habits (timeout + retry + error state)
- [x] A3. Confirmation before re-logging Recent activity — **FIXED** (April 24)
- [ ] A4. Deduplicate Moments feed
- [ ] A5. Decide on Messages stub (see X2)
- [ ] A6. Decide on Gift a Plant stub (see X2)
- [x] A7. "Your Story" avatar tap — **FIXED** (removed dead affordance)
- [x] A8. "SW" header avatar tap — **FIXED** (routes to Profile now)
- [ ] A9. Day tab stale data on refresh
- [x] A10. Edit/delete logged activity — **FULL FEATURE SHIPPED** (April 24, commit `eca09a9`)
- [x] A11. Splash freeze on cold launch — **FIXED** (April 23, commit `fe8466c`)
- [ ] A12. Baseline error reporting (Sentry free tier)
- [ ] **A13. Keyboard hides chat input on LogActivityScreen** (OBS-006 — high priority, blocks primary input flow)
- [ ] **A14. analyze-activity edge function doesn't know current time** (OBS-007 — inject ISO timestamp + timezone into system prompt)

---

## 🔴 SECTION B — TestFlight + EAS pipeline

- [x] B1-B11 Complete — EAS pipeline, first build, submission, installation, splash fix, resubmission all done
- [x] B12 Ready to add invitees (pending launch date)

### ⚠️ B13. iOS 26 SDK upgrade required by April 28
Current builds use `image: "latest"` workaround. Proper SDK 54 upgrade unavoidable for April 28+.

- [ ] Weekend session with rollback branch
- [ ] Upgrade Expo 51 → 54+
- [ ] Test web + simulator + TestFlight rebuild
- [ ] Must be done before any post-April-28 rebuild

---

## 🔴 SECTION C — Apple compliance

- [ ] C1. Verify TestFlight is production bundle
- [ ] C2. Full Delete Account flow (self-serve required for public launch)
- [ ] C3. Camera permission rationale screen
- [ ] C4. Privacy policy at tryecopulse.com/privacy
- [ ] C5. Terms of service at tryecopulse.com/terms
- [ ] C6. App Store listing metadata (screenshots, description, keywords)
- [ ] C7. App icon all sizes (Expo handles)
- [ ] C8. Rename app from "Eco Pulse (b640cf)" to final name (see X7)

---

## 🔴 SECTION D — Security

- [ ] D1. Audit Supabase RLS on every table
- [ ] D2. Audit production bundle for hardcoded secrets
- [ ] D3. Moments feed privacy gate
- [ ] D4. Revisit Edge Function `--no-verify-jwt` flag
- [ ] D5. Billing alerts: Anthropic + Supabase ($25/$50/$100 thresholds)
- [ ] D6. File US trademark for "Eco Pulse" (~$250-350)
- [ ] D7. Remove placeholder `YOUR_SUPABASE_URL` from app.json extra block

---

## 🟡 SECTION E — Should-fix

- [ ] E1. Character limit + fallback message when AI can't parse
- [ ] E2. "CO₂e" first-encounter explainer (see K2)
- [ ] E3. Clarify leaderboard scope labels
- [ ] E4. Explain "✦ 19% below avg" badge
- [ ] E5. Reconcile streak counter inconsistency
- [ ] E6. Audit async screens for timeout + retry UX

---

## 🟡 SECTION F — Quiz funnel

- [ ] F1-F6 — unchanged from v4

---

## 🟢 SECTION G — Growth / virality

- [ ] G1-G4 — unchanged from v4

---

## 🟢 SECTION I — Cross-partisan Tier 1

- [ ] I1. Dollars-saved parallel readout (overlaps K1)
- [ ] I2. Unit picker (dollars / CO₂ / gallons / trees)
- [ ] I3. Rename "ESG Dashboard" → "Sustainability Dashboard"
- [ ] I4. Local gas price integration (stretch)

---

## 🟢 SECTION J — Moko-Avi agent

**v1 scope:**
- [x] **J1. Edge function `moko-avi-summary`** — **SHIPPED** April 24. Reads today's activities + 14-day summary history, warmup-gated (10 consecutive days), returns warm non-prescriptive sentence via Claude Haiku.
- [x] **J2. Home screen entry point** — **SHIPPED** April 24. Teal card between hero and Gift-a-Plant, renders warmup/ready/empty states.
- [x] **J4. Summary card UI with styling** — **SHIPPED** April 24. Inline in HomeScreen, matches app visual language.
- [ ] J3. In-app knowledge layer — Moko-Avi explains app metrics (CO₂e definition, badges, streaks). Deferred to post-launch.

**v1.1+:**
- Weather integration ("rainy day — streaming was longer than usual")
- Visual wrap cards (Spotify-Wrapped style)
- IG Stories / iMessage share formatting
- Proactive coaching (insights without being asked)
- Population comparisons
- What-if simulations
- General climate facts

---

## 🟢 SECTION K — Reference points everywhere

CO₂e alone is inert data. Every number needs a comparator.

**v1 scope:**
- [ ] K1. Every CO₂e number shows dollars saved / trend arrow / comparison to average (overlaps I1)
- [ ] K2. First-time CO₂e tooltip explaining what good vs. bad looks like
- [x] **K3. Day tab "So what?" one-liner** — **SHIPPED via Moko-Avi J1+J2** April 24. Moko-Avi's sentence is the K3 implementation.

**v1.1+:**
- Personal baseline (10-day rolling average)
- Pattern detection per user

---

## 🟡 SECTION H — Marketing + social

Unchanged from v4 — H1-H14.

---

## ⚠️ SECTION X — Decisions needed

- [ ] X1. Explore tab — keep hidden for beta or enable?
- [ ] X2. Messages + Gift stubs — hide or "coming soon"?
- [ ] X3. Moments feed privacy — real names / pseudonyms / opt-in?
- [ ] X4. "2,400+" counter — real or placeholder?
- [ ] X5. Hours/day available through launch
- [ ] X6. Pre-TestFlight early access?
- [ ] X7. Final app name for App Store
- [ ] X8. Household mode v1 or v1.1? (Recommended: v1.1)

---

## 📅 8-Week target sequencing

Revised every Sunday.

### Week 1 (Apr 23 – Apr 29) — Critical bugs + foundations ✅ **substantially complete**

**Shipped:**
- [x] EAS pipeline end-to-end (B1-B11)
- [x] A1 navigation, A3 re-log confirmation, A7 Your Story, A8 avatar, A10 full timeline+edit+delete, A11 splash freeze
- [x] Production DB migration: timezone-aware daily_summaries (recompute trigger for INSERT/UPDATE/DELETE)
- [x] formatCo2 smart rounding
- [x] Device timezone sync on auth
- [x] Moko-Avi K3: edge function + client module + Home card + cache invalidation
- [x] OBSERVATIONS.md process established

**Carried into Week 2:**
- [ ] A13 (keyboard hides input — OBS-006)
- [ ] A14 (current time to Claude — OBS-007)
- [ ] B13 (SDK 54 upgrade — weekend session)
- [ ] D6 (file US trademark)
- [ ] D7 (cleanup app.json placeholders)
- [ ] A12 (baseline error reporting / Sentry)
- [ ] X1-X4, X7 decisions

### Week 2 (Apr 30 – May 6) — SDK upgrade + bug polish
- [ ] ⚠️ **SDK 54 upgrade** (weekend, rollback branch)
- [ ] A13 keyboard fix
- [ ] A14 current time injection
- [ ] A2 loading spinners with timeout
- [ ] A4, A5, A6, A9
- [ ] Second EAS build + resubmit on SDK 54
- [ ] D1, D2, D5
- [ ] A12 Sentry

### Week 3 (May 7 – May 13) — Compliance + reference points
- [ ] C1, C2, C3, C4, C5 Apple compliance
- [ ] D3 Moments privacy
- [ ] E1-E6 should-fix
- [ ] **K1 (dollars-saved everywhere) + K2 (CO₂e explainer)**
- [ ] B12 prep invite templates

### Week 4 (May 14 – May 20) — TestFlight beta launches 🚀
- **Target Saturday May 16**
- [ ] B12 add 20 external testers
- [ ] H12 invite email sent
- [ ] Daily monitoring

### Week 5 (May 21 – May 27) — Beta iteration + Tier 1
- [ ] Ship fixes from beta
- [ ] New build mid-week
- [ ] **I1, I2, I3** Tier 1 cross-partisan
- [ ] G1 waitlist referrals

### Week 6 (May 28 – Jun 3) — Quiz + marketing
- [ ] F1-F6, G2-G4
- [ ] H1-H5 accounts + Meta Pixel
- [ ] H6 founder video
- [ ] I4 gas prices (stretch)

### Week 7 (Jun 4 – Jun 10) — Content + buzz
- [ ] H7-H9 content
- [ ] H10-H11 Meta ad live
- [ ] C6 App Store metadata

### Week 8 (Jun 11 – Jun 17) — Launch week
- [ ] Submit production build (48-hr lead)
- [ ] H13 announcement
- **Target Wednesday June 17: Global launch**

---

## Definition of Done

### TestFlight beta (target May 16)
- All 🔴 Section A, B, C, D items
- SDK 54 upgrade complete
- **Moko-Avi shipped ✅** (already done)
- Reference points on numbers (K1 minimum)
- Build working on personal iPhone 48+ hrs without blocking bugs
- 20 invitees can: login → snap → log → edit → delete → see result → share → understand result

### Global launch (target June 17)
- Above PLUS:
- All 🟡 E, F
- All 🟢 I, J, K items
- Meta Pixel firing on waitlist
- ≥100 waitlist signups
- Founder video on 2+ channels
- G1 working
- App Store listing approved
- No known crashes in last 2 weeks of beta

---

## 🌱 Post-launch roadmap

### v1.1 — July/August 2026 (flagship: Household + avatar + Moko-Avi visuals)
- Household mode (3-4 weeks)
- Personal baseline (Moko-Avi speaks in user's own terms)
- Avatar evolution v1 (precursor to Living Friend)
- Moko-Avi visual wraps (Spotify-Wrapped-style share cards)
- Walking & biking via Apple Health
- "What this app knows about you" transparency dashboard
- Repair log

### v1.2 — Fall 2026 (the coach phase)
- **Moko-Avi coaching** — proactive insights without being asked
- **Moko-Avi weather integration** (user location + Open-Meteo/OpenWeatherMap)
- Pattern detection (best/worst days, trigger events, seasonal shifts)
- What-if simulations
- **Google Timeline integration** — 90-day retroactive onboarding, OAuth + Takeout fallback, passive transport tracking
- **Plaid integration** — green receipts (#1 retention driver)

### v1.3+ / v2 — 2027
- Living Friend Avatars fully (Sprint 9)
- Land & Water stewardship section
- Local-impact mapping
- Self-sufficiency score
- Carbon credit wallet + marketplace (Stripe Connect)
- Sustainability Dashboard B2B (per-employee SaaS)
- Behavior vector platform

### Explicitly deferred or rejected
- Food quality layer on Snap
- Buy-local filter
- Offline-only mode
- Kids mode (ships with household mode)

---

## Revenue projections (Month 12 MRR, June 2027)

| Scenario | Consumer subs | B2B dashboard | Family plan | **Total MRR** |
|---|---|---|---|---|
| A. Current roadmap only | $160-640 | $0-2,500 | $0 | **$160 – $3,140** |
| B. + Tier 1 cross-partisan (I) | $320-960 | $2,500-15,000 | $0 | **$2,820 – $15,960** |
| C. + Moko-Avi + Reference points (J, K) | $800-2,400 | $3,500-20,000 | $0 | **$4,300 – $22,400** |
| D. + Household mode v1.1 | $1,500-5,000 | $5,000-30,000 | $500-2,500 | **$7,000 – $37,500** |

Note: numbers are directional, not forecast. The thesis (user value → retention → data density → B2B credibility) holds regardless of exact numbers.

---

## Notes on astrological timing

- Saturday May 16 (TestFlight) — per Rahasya Veda consultation
- Wednesday June 17 (Global) — Super-Day window June 15-22
- Dates are targets, not contracts.

---

## Weekly learning log

### Week of April 23, 2026
**Built EAS pipeline from zero to first TestFlight submission in one evening.** Hit iOS 26 SDK wall (fixed with `image: "latest"` stopgap; full SDK 54 upgrade unavoidable before April 28).

**Splash freeze on first install** — `onLayout`-triggered `SplashScreen.hideAsync()` fires once before async init completes. Fixed via `useEffect` keyed on `appReady` state + 8s safety timeout. Lesson: first contact with reality always surfaces bugs no critique document found. Sunday ritual + weekly self-test is the catch mechanism.

**Clarified product vision during self-test:** the app as-shipped is a measurement tool. Oura-style interpretation layer (Moko-Avi + reference points) is what makes numbers mean something. Without it, CO₂e is inert data.

**Corrected causal chain:** user value → retention → data → B2B credibility.

### Week of April 24, 2026 (today — heavy build day)
**Shipped 4 bug fixes + A10 full feature + production DB migration + Moko-Avi K3 in ~7 hours.** 11 commits total.

**Daily summaries trigger redesign.** Old incremental `update_daily_summary` only fired on INSERT and would double-count or drift on UPDATE/DELETE. Replaced with `recompute_daily_summary` that reads all activities for the affected user+date and writes a full aggregate. Self-healing; works identically for INSERT/UPDATE/DELETE. Then made timezone-aware — added `profiles.timezone`, rewrote to use `AT TIME ZONE` per user. Two production migrations in one session; both verified by invariant-check (sum of activities = sum of summaries).

**Moko-Avi K3 landed.** Edge function reads user data, checks 10-day warmup, calls Claude Haiku with a warm non-prescriptive voice prompt. Client module caches with 10-min TTL, invalidates on any activity write. HomeScreen renders a teal card between hero and Gift-a-Plant showing warmup progress (3/10 days currently) or the generated sentence once the user hits 10 consecutive days. Tested end-to-end; warmup state confirmed on device.

**Lessons:**
- Two prod migrations in one session is the maximum safe dose. Would not have survived a third today.
- Feature additions mid-session are the pattern to watch. Weather and Timeline API were legitimate adds in spirit, wrong timing for today.
- The Sunday ritual's "honest recalibration" is what keeps solo founders shippable. Without it, hours compound into unsustainable pace.
- "The app doesn't feel impressive" observation is the vision pointing at the roadmap. Moko-Avi K3 landing today is the first step toward fixing it — many more to go.

---

## Change log

- **April 22 (v1):** Created. 8-week timeline.
- **April 23 early evening (v2):** EAS pipeline built. Section I added. B13 SDK 54. Revenue table.
- **April 23 evening (v3):** Section J (Moko-Avi) added. Sunday ritual added. Dates reframed as targets.
- **April 23 night (v4):** Product vision section at top. Section K (reference points) added. OBS-001 through OBS-005 logged. Post-launch restructured around behavior loop phases.
- **April 24 (v5):** Week 1 substantially checked off. A10 + A11 complete. DB migration to timezone-aware summaries. Moko-Avi K3 (J1, J2, J4) shipped — also satisfies K3. A13, A14 added to Section A from OBS-006, OBS-007. Weather integration moved to v1.2. Timeline API remains v1.2.
