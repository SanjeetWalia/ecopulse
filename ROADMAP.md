# Eco Pulse — Launch Roadmap

**Status:** Pre-launch · Building toward TestFlight beta
**TestFlight beta date:** Saturday, May 16, 2026
**Global launch target:** Wednesday, June 17, 2026 (astrologically auspicious window is June 15–22; ship when ready, not before)
**Owner:** Sanjeet Walia (solo founder)
**Last updated:** April 23, 2026

---

## How to use this document

- Work top to bottom within each section
- Items are tagged: 🔴 Critical · 🟡 Should fix · 🟢 Quality / growth · ⚠️ Decide
- Check off items as you complete them — this is the canonical source of truth
- Don't jump ahead until all 🔴 items in the current section are done
- If the global launch date (June 17) slips, cut from the bottom, not the top

---

## Context for this timeline

Previous placeholder was April 28, which would have required cramming 8+ weeks of work into 6 days. New timeline, confirmed April 22, gives you:

- **~3.5 weeks** to TestFlight beta (May 16)
- **~4 weeks** of beta testing + iteration with 20 invitees
- **~8 weeks total** to global public launch (June 17)

This is realistic, not aspirational. It lets us fix things properly, iterate on real user feedback, and ship a product worth launching.

---

## 🔴 SECTION A — Ship-blocking bugs (from critique)

These must be fixed before TestFlight on May 16. Every one of these will destroy a beta tester's experience within their first 5 minutes of use.

- [ ] A1. Fix navigation bar hit-target offset (tap on Snap opens Profile, etc.)
- [ ] A2. Fix infinite loading spinners on Profile and Habits screens — add real timeout, error state, retry
- [ ] A3. Add confirmation step before re-logging a "Recent" activity (prevents accidental duplicates)
- [ ] A4. Deduplicate entries in Moments feed (db-level or display-level)
- [ ] A5. Decide on Messages stub (hide from nav, or build a proper "coming soon" state — see X2)
- [ ] A6. Decide on Gift a Plant stub (hide Home card, or build proper coming soon — see X2)
- [ ] A7. Fix or remove the "Your Story" avatar tap on Home (currently does nothing)
- [ ] A8. Fix or remove the "SW" header avatar tap (currently does nothing)
- [ ] A9. Fix Day tab stale data issue on refresh (shows 9.4 kg CO₂ from a duplicate-logged activity that was never deleted)
- [ ] A10. Add "edit/delete logged activity" capability — currently no way to undo a bad log

---

## 🔴 SECTION B — TestFlight technical setup

### Prerequisites
- [x] Apple Developer enrollment paid ($99, active since April 22)
- [x] Supabase Edge Functions live (analyze-food-photo, analyze-activity)
- [x] Anthropic key moved server-side

### Setup
- [ ] B1. Verify App Store Connect loads with Apps tab (appstoreconnect.apple.com)
- [ ] B2. `eas login`
- [ ] B3. `eas init` in project root (adds projectId to app.json)
- [ ] B4. Write `eas.json` with `preview` and `production` build profiles
- [ ] B5. Add `ITSAppUsesNonExemptEncryption: false` to app.json ios.infoPlist
- [ ] B6. Add `buildNumber: "1"` to app.json ios section
- [ ] B7. Add EAS secrets for Supabase URL + anon key (if env-vars needed at build time)
- [ ] B8. `eas build --platform ios --profile preview`
- [ ] B9. `eas submit --platform ios` → App Store Connect
- [ ] B10. Wait for TestFlight review to pass (typically <24 hrs)
- [ ] B11. Self-test TestFlight build on your own iPhone before inviting anyone
- [ ] B12. Add 20 EcoKey invitees as external testers in App Store Connect

---

## 🔴 SECTION C — Apple compliance

Non-negotiable for Apple review, regardless of launch date.

- [ ] C1. Verify TestFlight build is a production bundle (not dev mode). EAS preview profile should handle this; confirm in build logs.
- [ ] C2. Build full Delete Account flow on Profile screen (not a stub — self-serve deletion required for public App Store)
- [ ] C3. Camera permission rationale screen before iOS system prompt (Snap screen)
- [ ] C4. Privacy policy URL live at `tryecopulse.com/privacy` and linked from onboarding + settings
- [ ] C5. Terms of service URL live at `tryecopulse.com/terms` and linked from onboarding
- [ ] C6. Configure App Store listing metadata: screenshots (6.7" + 6.1"), app description, keywords, category, support URL, marketing URL
- [ ] C7. App icon in all required sizes (1024x1024 master + auto-generated via Expo)

---

## 🔴 SECTION D — Security

From the critique + our audit.

- [ ] D1. Audit Supabase Row Level Security policies on every table: `activities`, `profiles`, `waitlist`, `invite_codes`, and any others. Each user-data table needs a policy like `user_id = auth.uid()`. Test by trying to query another user's data with a valid JWT.
- [ ] D2. Audit production bundle for any remaining hardcoded secrets (Anthropic is clean; verify no other API keys leaked)
- [ ] D3. Privacy gate on Moments feed — decide approach per X3, then implement
- [ ] D4. Revisit Supabase Edge Function `--no-verify-jwt` flag. Check if Supabase has shipped ES256 support to edge runtime. If yes, redeploy functions without the flag.
- [ ] D5. Set billing alerts on Anthropic console — monthly spend cap + alert threshold. Opus calls on Snap aren't free; a viral week could spike the bill.
- [ ] D6. Check Supabase free tier limits — database size, edge function invocations, auth users. Set alerts before hitting 80% of any limit.

---

## 🟡 SECTION E — Remaining critique items (should fix)

- [ ] E1. Character limit and fallback message for Log Activity when AI can't parse input
- [ ] E2. Explain "CO₂e" on first encounter (tooltip or tap-to-learn)
- [ ] E3. Clarify leaderboard scope labels — "#3 friends" vs "#7 Frisco" — consistent or explained
- [ ] E4. Explain the "✦ 19% below avg" badge on Home (compared to what?)
- [ ] E5. Reconcile streak counter inconsistency between Day tab (12-day) and Habits tab (1d best)
- [ ] E6. Audit all async screens and add timeout + retry UX (beyond just Profile/Habits)

---

## 🟡 SECTION F — Quiz funnel improvements

- [ ] F1. Update waitlist confirmation copy to name June 17 launch date
- [ ] F2. Make Share the primary CTA after waitlist submit (currently buried)
- [ ] F3. Tighten share text — shorter, hookier
- [ ] F4. Add UTM tracking — read `?utm_source=` from URL, save to waitlist row
- [ ] F5. Add "Learn more about Eco Pulse →" cross-link from quiz to landing page
- [ ] F6. Verify or fix "2,400+ people have seen their mirror" social proof counter (X4)

---

## 🟢 SECTION G — Growth / virality (now feasible with 8-week timeline)

Items previously deferred to v2, now back in scope because we have the time.

- [ ] G1. Invite-to-friend waitlist mechanic — user gets position ("#287 on list"), each referral moves them up 10 spots. The k-factor unlock from the product strategy doc.
- [ ] G2. Image-based share card for IG Stories — Spotify Wrapped style, visual result with user's annual lbs CO₂e
- [ ] G3. Different share text per network (iMessage vs WhatsApp vs Twitter)
- [ ] G4. Settings page — edit name, avatar, username

---

## 🟡 SECTION H — Marketing + social

### Account setup
- [ ] H1. Reserve Instagram handle (@ecopulse, @trypulse, @ecopulse.app — whichever is available)
- [ ] H2. Reserve TikTok handle
- [ ] H3. Set up `hello@tryecopulse.com` via domain email forwarding

### Tracking
- [ ] H4. Install Meta Pixel on tryecopulse.com
- [ ] H5. Configure Meta Pixel conversion event on waitlist submission

### Content creation
- [ ] H6. Record 60-second founder video — iPhone, unpolished, your face. "I'm Sanjeet. I built Eco Pulse because..."
- [ ] H7. Prepare 8-10 Instagram posts across the 8-week runway (cadence: 1/week pre-launch, 2-3/week near launch)
- [ ] H8. Prepare 5-6 TikTok videos — informal, authentic
- [ ] H9. Prepare 3-4 LinkedIn posts from your personal account

### Paid campaign ($100 total)
- [ ] H10. Configure Meta Ads — single campaign, single ad set, single creative. Target: SF + LA metros, 28-40, climate interests. Budget: $7/day × 14 days. Objective: waitlist Conversions via pixel.
- [ ] H11. Launch Meta ad ~2 weeks before global launch (starts ~June 3)

### Launch comms
- [ ] H12. Write invite email for 20 EcoKey holders (send day of TestFlight launch, May 16)
- [ ] H13. Write public launch announcement for global launch day (June 17)

### App Store Optimization (ASO)
- [ ] H14. Research top keywords for carbon tracking apps — check what Klima, Joulebug, Commons, Capture target
- [ ] H15. Write App Store description using those keywords naturally (don't stuff)
- [ ] H16. Create 5 App Store screenshots that sell the concept, not the UI — each screenshot needs a headline and benefit callout
- [ ] H17. Write 100-character subtitle (the key ASO field most people miss)
- [ ] H18. Pick primary + secondary App Store categories (Health & Fitness is saturated; Productivity or Lifestyle may convert better)

---

## ⚠️ SECTION X — Decisions needed

Make these calls before building the related items. Not urgent tonight, but don't start related work without deciding.

- [ ] X1. Explore tab — keep hidden for beta, or enable? (Currently hidden in nav)
- [ ] X2. Messages + Gift stubs — hide completely, or build proper "coming soon" states? Recommend hiding for TestFlight beta (takes ~15 min), revisit for global launch.
- [ ] X3. Moments feed privacy — real names default, pseudonyms default, or opt-in during onboarding?
- [ ] X4. "2,400+ seen their mirror" quiz counter — real number, or placeholder? If placeholder, fix or remove before any paid ads drive traffic.
- [ ] X5. Hours/day available to work on this — determines whether the May 16 TestFlight date is comfortable or tight
- [ ] X6. Any pre-TestFlight users who should get early access (friends, family, beta testers before the 20 EcoKey invitees)

---

## 📅 8-Week sequencing plan

The macro plan. Each week has a focus area so you don't context-switch constantly.

### Week 1 (Apr 23 – Apr 29) — Critical bugs + EAS setup
**Focus:** Fix the bugs that would immediately break beta testing. Get EAS building.

- A1 (navigation hit-target bug) — highest impact single fix
- A2 (loading spinners with timeout + retry)
- A3 (re-log confirmation)
- A9, A10 (data integrity — edit/delete activities)
- B1 through B4 (EAS setup + config)
- ⚠️ Make decisions X1, X2, X3, X4

### Week 2 (Apr 30 – May 6) — Finish bugs, first build
**Focus:** Complete remaining critique items. First EAS build.

- A4 (dedup Moments)
- A5, A6 (stub screens — per X2 decision)
- A7, A8 (dead avatar taps)
- B5 through B9 (app.json config + first build + submit)
- D1 (RLS audit — important before any build reaches users)
- D2 (bundle secret audit)

### Week 3 (May 7 – May 13) — Compliance + security + polish
**Focus:** Make the build Apple-compliant. Security tight. Smooth rough edges.

- C1, C2, C3, C4, C5 (Apple compliance must-haves)
- D3 (Moments privacy gate per X3)
- E1 through E6 (the critique "should fix" items)
- B11 (self-test first TestFlight build on your iPhone)
- Any build reshoots required

### Week 4 (May 14 – May 20) — TestFlight beta launches 🚀
**Focus:** Ship to 20 invitees. Start collecting feedback.

- **Saturday May 16: TestFlight launch**
- B12 (add 20 invitees as external testers)
- H12 (invite email sent day-of)
- Daily monitoring of feedback + bug reports
- Start collecting what's working and what isn't

### Week 5 (May 21 – May 27) — Iterate on beta feedback
**Focus:** Fix what real testers found. Build virality features.

- Ship fixes from beta feedback (expect 5-10 bug reports)
- New build submitted mid-week
- G1 (invite-to-friend waitlist mechanic — the k-factor play)
- G2 (image-based share card for IG Stories)

### Week 6 (May 28 – Jun 3) — Buffer + marketing prep
**Focus:** If on track, polish + start ads. If behind, catch up. This is your one buffer week — use it.

- If on schedule: F1 through F6 (quiz improvements), G3/G4 (share text, settings page), H1–H5 (social accounts, Meta Pixel)
- If behind: use this week to finish any Section A-E items you didn't get to. Ads + social can shift to Week 7.
- H6 (founder video recorded) — do this regardless, it's the highest-ROI single asset

### Week 7 (Jun 4 – Jun 10) — Content + pre-launch buzz
**Focus:** Start organic content drumbeat. Launch paid ad. Start ASO prep.

- H7, H8, H9 (post content on schedule)
- H10, H11 (Meta ad live, ~2 weeks runway)
- H14 through H18 (ASO — research, description, screenshots, subtitle, category)
- C6, C7 (App Store listing metadata + icon sizes)
- Second beta iteration build if needed

### Week 8 (Jun 11 – Jun 17+) — Launch week
**Focus:** Submit for App Store review. Launch when ready within the June 15–22 window.

- Submit production build to App Store (allow 48 hrs; first submissions often bounce once)
- H13 (launch announcement written)
- Organic content ramps up (post every 1-2 days)
- **Launch target: Wednesday June 17.** If review delays or polish needs more time, the astrological window extends through June 22. Better to ship ready than ship on a specific date.
- Launch day push: IG, TikTok, LinkedIn post, Meta ad continues, monitor reviews, respond fast

---

## Definition of Done

### For TestFlight beta (May 16)
- All 🔴 Section A, B, C, D items checked
- Build installed and working on your own iPhone for 48 hrs without blocking bugs
- 20 invitees can install and complete: login → snap a photo → log via chat → see result → share

### For global launch (June 17)
- Above PLUS:
- All 🟡 Section E, F items checked
- Meta Pixel fires correctly on waitlist submission
- At least 100 waitlist signups from quiz funnel
- Founder video posted on at least 2 channels
- Invite-to-friend mechanic working (G1)
- App Store listing approved and live
- No known crashes in last 2 weeks of beta

Everything else is bonus.

---

## 🌱 Post-launch roadmap (reference, not scope)

Major features that ship after global launch:

- **Google Timeline integration** — passive transport tracking (Sprint 6B). Product moat.
- **Plaid integration** — green receipts, #1 retention driver per user research
- **Living Friend Avatars** — plants grow with friendship duration (Sprint 9). Spec already written.
- **Carbon credit wallet + marketplace** — Stripe Connect, user earnings
- **Corporate ESG dashboard** — per-employee SaaS, near-term revenue
- **Behavior vector platform** — anonymized cohort data licensed to green brands

These are NOT launch items. Listed here so they stay visible.

---

## Notes on astrological timing

Launch dates were chosen based on consultation with Rahasya Veda (April 22, 2026). Per their guidance:

- Beta launch on a **Saturday** (to appease Saturn) → Saturday, May 16
- Global launch on a **Wednesday** → Wednesday, June 17
- Their recommended "Super-Day" window: June 15–22, 2026
- Their reasoning: Mars Digbala, Mercury Mahadasha supported by Jupiter Antardasha, 4th house alignment with environmental/ecological ventures

*This document lives at the root of the Eco Pulse repo. Edit it as items complete. After global launch, archive to `/docs/roadmap-v1-launch.md` and start v2.*

---

## 🔁 Weekly ritual — do not skip

Every Sunday evening, 15 minutes:

1. Open this file
2. Check off items completed during the week
3. Honestly note which items slipped and why
4. Update the current week's focus section if the plan has drifted
5. Confirm whether next week's focus still makes sense or needs rework

This ritual is the difference between a useful plan and a plan that becomes archaeology by Week 3. Without it, scope creeps, deadlines slip silently, and Week 8 arrives with half the critical items undone.

Also: **take one full day off per week.** No app work. Sunday after the ritual, or Saturday — pick one and defend it. Solo-founder burnout is the #1 launch killer, and prevention is cheaper than recovery.
