# Eco Pulse — Observations Log

Running log of bugs, insights, and product notes found during self-test or daily use. Append-only. Triaged into ROADMAP.md during Sunday planning ritual.

Format: `YYYY-MM-DD · OBS-NNN · [tag] short description`

Tags: `bug`, `ux`, `perf`, `idea`, `copy`, `data`

---

## 2026-04-23 (first self-test, TestFlight build #5)

- **OBS-001** · bug · Splash screen hangs indefinitely on cold launch. Root cause: `onLayout`-triggered `SplashScreen.hideAsync()` fires once before async auth init completes. **FIXED** in commit `fe8466c` (App.tsx — moved hide to `useEffect` keyed on `appReady` state + 8s safety timeout).
- **OBS-002** · ux · CO₂e alone is meaningless to users. No reference point → user takes no action. Maps to Section K (reference points) in ROADMAP. Partially addressed by Moko-Avi K3 (April 24) — full K1/K2 still pending.
- **OBS-003** · bug · Logging is point-in-time, not editable. Mistakes stick. Maps to A10. **FIXED** in commit `eca09a9` (timeline + edit modal + delete + daily_summaries trigger redesign).
- **OBS-004** · bug · Single tap on a Recent activity chip re-logs without confirmation. Maps to A3. **FIXED** in commit `b...` (Alert.alert confirmation).
- **OBS-005** · ux · Product needs a habit/behavior loop — users need to return for coaching, not reporting. Maps to product vision; drives v1.1+ post-launch.

## 2026-04-24 (TestFlight build #8 — A10 timeline shipped; Moko-Avi K3 shipped)

- **OBS-006** · bug · LogActivityScreen chat input field is hidden behind the keyboard when it opens on iOS. Input text is not visible while typing. Likely: `KeyboardAvoidingView` misconfigured or missing `keyboardVerticalOffset`. High priority — blocks the primary input flow. Maps to Section A (A13).
- **OBS-007** · bug · Claude's `analyze-activity` edge function doesn't know the current date/time. User said "Working from home in Mac Studio since 7 am till now" and Claude replied "What time is it now — how many hours have you been working?" Fix: inject current ISO timestamp + user's timezone into the system prompt so Claude can resolve relative time references. Maps to E1 and A14.
- **OBS-008** · ux · "App doesn't feel impressive." Root cause: app is a logger, not a coach. Every number is inert because there's no reference point, no narrative, no "so what?" layer. Moko-Avi K3 is the first step toward fixing this. Full fix requires Sections J, K, and passive data (Plaid, Timeline) collectively.

## 2026-04-24 evening (end-of-session — next-session queue)

- **OBS-009** · idea · Redesign hero card tiles to show 3 dual-purpose metrics (consumer-meaningful AND B2B-relevant). Replace current 4-tile grid (Transport / Food / Energy / Digital) with:
  1. **Getting around** — today's transport kg + comparator. B2B angle: Scope 3 Category 7 (employee commuting) — the number mid-size companies will have to report under CSRD / SEC rules starting 2026-2027.
  2. **Food choices** — today's food kg + comparator. B2B angle: cafeteria / catering / wellness programs increasingly want food carbon data.
  3. **Streak** — days in a row of logging activity. B2B angle: engagement metric for employee-engagement platform buyers (Pawprint, JouleBug competitors sell on "our employees actually use it").
  Energy and Digital tiles become secondary (possibly behind a "view all" tap or stacked below). Needs PNG mockup before code.
- **OBS-010** · data · Streak logic not yet defined in data model. Decisions needed before OBS-009 can be built:
  - What counts as a "streak day"? Any activity logged? ≥N activities? Days where a row exists in `daily_summaries`?
  - How is it computed — client-side on-demand, or stored as a column?
  - When does a streak break — one missed day, or a grace window?
  - Display format — "12 day streak" or "🔥 12" or just the number?
  - **Proposed default (to confirm next session):** use `daily_summaries` rows as source of truth (any day with a row = a day with activity). Compute client-side on Home focus by walking backwards from today. Break = one missed day. Display: "🔥 N" with lime color.
- **OBS-011** · idea · Before B2B features, run a demand-validation experiment: ship consumer v1, 30 days of usage data, send a one-pager to ~20 Heads of Sustainability at mid-size companies with the question "Would aggregated data like this be valuable? Would you pay for it?" If 3+ "yes," B2B is validated. If silence, keep focus on consumer. Don't build B2B dashboard until this has a yes.

---

## Next-session priorities (candidates)

Triage at next Sunday planning ritual. This list is not prescriptive — just the current queue.

1. **OBS-006** (A13) — keyboard hides input. Blocks primary flow. Small fix, high user-pain ratio.
2. **OBS-009 + OBS-010** — hero card redesign with Getting around / Food / Streak. Requires mockup + streak-logic spec before code. ~90 min total in a session.
3. **OBS-007** (A14) — pass current time to Claude. Small fix, improves parsing quality.
4. **K1 / K2** — dollars-saved everywhere, CO₂e first-encounter explainer.
5. **A2** — loading spinner timeouts. Critique item, good polish.

Longer-horizon (post-TestFlight):
- **J3** — Moko-Avi in-app knowledge layer (explain app metrics on demand).
- Weather integration for Moko-Avi (v1.2 per roadmap).
- Timeline API integration (v1.2 per roadmap).
- B2B minimum dashboard (post-launch, Q3-Q4 2026 if consumer v1 sticks and OBS-011 validates demand).

---

## 2026-09-12 (repo audit after a 7-week gap — redesign-v3 branch)

Context: no commits since July 25. `main` is still at build #9/#11 (April 28). `sdk-54-upgrade` (SDK 55) and `redesign-v3` (4 commits, ~6.5k lines) are both pushed and both unmerged. ROADMAP.md and OBSERVATIONS.md had not been updated since April 24, so they described a product that no longer exists in the code. This entry closes that gap.

- **OBS-012** · bug · **STILL OPEN.** Email signup missing after invite code. `src/navigation/index.tsx` registers only `Welcome → Phone → OTPVerify → ProfileSetup`. `SignUpScreen.tsx` and `ForgotPasswordScreen.tsx` exist but `SignUpScreen` is not routed. No auth file has been touched since April 22. This still blocks Apple Beta App Review, which still blocks external TestFlight testers. It is the single oldest unresolved blocker in the project — 4.5 months.
- **OBS-013** · ux · **Tab structure splits one number across three tabs by timeframe.** Home shows given-back *today*, Air shows given-back *this month*, Pulse shows *week/month/year*. The user has to learn which tab holds which window of the same metric. A tab should answer a different question, not a different timeframe of the same answer. Maps to new Section M.
- **OBS-014** · data · **Memory only grows through chat.** `user_facts` extraction lives solely in `supabase/functions/eco-chat/index.ts`. A user who never opens eco-chat has an empty memory forever, so calibration never improves for the majority path (Snap + manual logging). Extraction needs to run on `analyze-activity` and `analyze-food-photo` too. Maps to new Section N.
- **OBS-015** · data · **No distinction between stated and observed facts.** `user_facts` holds only what the user said. The app never writes back what it has *seen* (personal baseline, typical weekday, per-category averages), so the optimizer in AirScreen is still rule-based rather than personalized. Needs a `source` discriminator (`stated` | `observed`) or a sibling table. Maps to Section N.
- **OBS-016** · idea · **No targets anywhere.** No `targets`/`goals` table, no UI. The app measures but never asks the user what they are aiming at, so there is nothing to close a loop against and no natural reason to return on a weekly cadence. Maps to new Section O.
- **OBS-017** · bug · **No notification infrastructure at all.** `expo-notifications` is not in `package.json`, there is no `push_tokens` table, no APNs key configured in EAS, and no scheduled job on Supabase. Every milestone the app could recognise is invisible once the app is closed. Maps to new Section P.
- **OBS-018** · data · **No `supabase/migrations/` directory.** Schema lives in `supabase_schema.sql` (April 4, now stale) plus ad-hoc SQL applied through the dashboard (`delete_account.sql` is referenced in a YouScreen comment but the file is not in the repo). The v3 work added `snaps`, `shared_snaps`, `leaves`, `eco_chat_messages`, `user_facts`, friendships — none of it captured in version control. A rebuild from this repo would not reproduce the database.
- **OBS-019** · ops · **Two unmerged branches stacked on each other, neither runtime-tested through TestFlight.** `redesign-v3` sits on top of `sdk-54-upgrade`. The SDK 55 upgrade has still never been runtime-verified on device per the April handoff, and the v3 redesign has never been built at all. Risk compounds: a Reanimated 4 / React 19 regression and a v3 layout bug would surface in the same build with no clean bisect point.
- **OBS-020** · ux · **AirScreen ships two dead "Soon" buttons** ("Your walks and rides go uncounted", "Your trips are invisible"). Shipping visible unavailable features to beta users reads as abandonment rather than a roadmap. Either wire Apple Health (X10, still not started) or convert these to a single honest "what's coming" line.
- **OBS-021** · copy · Onboarding copy rewrite (April queue item) is still unshipped. WelcomeScreen still describes leaderboards and friend competition, which now contradicts the v3 product even more than it did in April, since v3 reframed everything around "air given back" rather than competition.

---

## Next-session priorities (revised 2026-09-12)

1. **Runtime-test the stack.** Build `redesign-v3` to TestFlight, verify SDK 55 + v3 together on device. Nothing else is safe until this passes.
2. **OBS-012.** Route `SignUpScreen` into the post-invite flow. Unblocks Beta App Review and external testers.
3. **Section M** — collapse 4 tabs to 3, scope control on the ring.
4. **Section N** — memory beyond chat; stated vs observed.
5. **Section O** — targets.
6. **Section P** — milestone notifications.
7. **OBS-018** — get the schema back into version control before it drifts further.

---

## 2026-09-12 evening (build session — branch `v4-retention`)

- **OBS-012** · **CLOSED.** `SignUpScreen` routed into the auth stack, reachable from PhoneScreen with the validated invite code carried forward. Redemption deferred through `src/lib/invite.ts` because email signup may withhold the session until confirmation.
- **OBS-022** · bug · **NEW, and it was live.** Invite codes were never actually being marked used. `OTPVerifyScreen.redeemInviteCode` issued a direct UPDATE on `invite_codes`; the `invite_codes_own` policy is `USING (auth.uid() = owner_id)`, so a new user updating someone else's code matched zero rows. Postgres returns no error for an update that matches nothing, so the client logged success. Every code handed out was still reusable. Fixed via the `redeem_invite_code` SECURITY DEFINER RPC (migration 0002). **Worth auditing the live `invite_codes` table — the 2 codes recorded as spent in April may not be, and codes may have been used more than once.**
- **OBS-013** · **CLOSED.** Three tabs, scope on the ring.
- **OBS-014** · **CLOSED.** Shared extractor across all three AI paths.
- **OBS-015** · **CLOSED.** `origin` column plus the nightly `observe-facts` pass.
- **OBS-018** · **CLOSED** in structure. 0001 is reconstructed from code, not dumped — replace it with a real dump before trusting it.
- **OBS-020** · **CLOSED.** Dead "Soon" buttons replaced by an honest source list in You.
- **OBS-021** · **CLOSED.** Welcome copy matches the v3 product.
- **OBS-023** · ops · `observe-facts` is deployed-ready but **not scheduled**. Migration 0005 enables pg_cron and pg_net; the schedule itself has to be created by hand because it needs the service key from Vault. Until that is done, no observed facts are ever written and Sections O and P have no baseline to build on.
- **OBS-024** · data · The `analyze-activity` memory block is injected as JSON. It works, but as memory grows past ~20 facts this will start eating the prompt budget on the app's highest-traffic function. Revisit with a summarised memory string rather than raw JSON when fact counts climb.

---

## 2026-09-13 (first db push against the live project)

- **OBS-025** · data · Migration 0001's reconstruction was **wrong**, and the push proved it. The `shared_snaps_friends_read` policy predicate guessed `friendships(user_id, friend_id)`; the real columns are `requester_id, addressee_id` (supabase_schema.sql line 114). Postgres rejected the whole migration rather than half-applying it. Fixed. This is the concrete argument for OBS-018: a reconstruction that reads plausibly is still a guess.
- **OBS-026** · security · **More serious than the column names.** 0001 originally issued bare `CREATE POLICY` statements guarded only by `EXCEPTION WHEN duplicate_object`, which catches a same-NAME collision and nothing else. The v3 tables already exist in production with policies created in the dashboard under unknown names, and Postgres OR-s permissive policies together — so those statements would have ADDED a second, broader policy rather than being skipped, widening read access on `shared_snaps`, `leaves`, `eco_chat_messages` and `user_facts`. 0001 now refuses to define policies on any table that already has one. Left as-is, this would have been a silent data-exposure bug introduced by a migration whose whole purpose was documentation.
- **OBS-027** · data · Nobody knows what the live RLS policies on the v3 tables actually say — they were never committed and `friendships` is not referenced anywhere in `src/`, yet PulseScreen's Circle feed depends entirely on RLS for filtering. Step 0 of `supabase/run-once/2026-09-13-editor.sql` lists them. This is D1 in ROADMAP.md and it is no longer a nice-to-have.

---

## 2026-09-13 (real RLS policies read back from production)

- **OBS-022** · **CORRECTED — the original diagnosis was wrong.** It assumed `invite_codes_own` was the only policy governing UPDATE, so a new user marking someone else's code used would match zero rows. Production also carries `"redeem code" FOR UPDATE TO public USING (auth.uid() IS NOT NULL)`. Permissive policies are OR-ed, so redemption was working all along. The `redeem_invite_code` RPC is still the right shape — scoped, atomic, and it removes the need for a blanket UPDATE grant — but the claim that codes were never being marked used was incorrect. Lesson: do not diagnose RLS behaviour from one policy in a stale schema file.
- **OBS-028** · security · **The invite-only gate does not gate anything.** `invite_codes_public_read` and `"validate code"` are both `FOR SELECT TO public USING (true)`. `public` includes `anon`, and the anon key ships inside the app bundle and sits in `src/lib/supabase.ts`. Anyone who pulls that key can `select * from invite_codes` and read every unused code in the pool. Invite-only is the product's entire access-control story in private beta. Fixed by `validate_invite_code` (migration 0006) plus policy drops staged in run-once step 6 — the drops must wait for a build carrying the new WelcomeScreen, or signup breaks for everyone holding a code.
- **OBS-029** · security · `"redeem code" FOR UPDATE TO public USING (auth.uid() IS NOT NULL)` lets any authenticated user update **any** row in `invite_codes`: flip a used code back to unused, reassign `owner_id`, rewrite the `code` text. Droppable once redemption goes through the RPC.
- **OBS-030** · security · `moment_likes` has `likes_all FOR ALL USING (true)`. Any caller can insert or delete anyone else's likes.
- **OBS-031** · data · Production uses a helper `are_friends(uuid, uuid)` in the `shared_snaps` and `leaves` policies. It was not in the repo and nothing in `src/` references `friendships` directly. Reconstructed in 0001, guarded.
- **OBS-032** · data · The first reconstruction of `leaves_visible_read` was materially **looser** than production: it checked only that the snap existed, which would have exposed every leaf in the table to any authenticated user. Production checks ownership or friendship. The policy guard added yesterday is the only reason that never shipped — the argument for it was theoretical when it was written and turned out to be real.
- **OBS-033** · data · Column drift found between the April baseline and production: `invite_codes.owner_id` is nullable in production (the hand-generated beta codes have no owner) and there is an undocumented `batch` column; ids default to `uuid_generate_v4()` not `gen_random_uuid()`; `shared_snaps.co2_kg` and `user_facts.value` are NOT NULL with no default. 0001 corrected to match.

---

## 2026-09-25 (state check: migrations, functions, builds)

- **OBS-034** · **CORRECTION to the Sept 12 handoff.** It stated the v3 redesign "has never been built at all" and framed the top risk as SDK 55 and v3 reaching a device together for the first time. Wrong. `eas build:list` shows four finished iOS builds on `redesign-v3` commits: #14 (afe8fcd, Jul 7), #15 (cb792c1, Jul 13), #17 (83eb687, Jul 25) and **#18 (e15a9e9, Jul 25)** — the branch tip. SDK 55 and the v3 redesign have been compiling and shipping since early July. The claim came from reading the repo alone and never checking the build service. Second time in this project a confident diagnosis was made from partial evidence (see OBS-022). The actual untested code is only `v4-retention`.
- **OBS-035** · ops · **Migration 0006 is local-only.** `supabase migration list` shows 0001-0005 applied remotely, 0006 with a blank remote column. `validate_invite_code` does not exist in production. **This is now a release blocker**: the new WelcomeScreen calls that RPC, so a build shipped before the migration is pushed would break invite validation for every user.
- **OBS-036** · ops · **No Section N code is deployed.** `observe-facts` does not exist as a function at all. `analyze-activity` is still version 3 from 2026-04-26 and `eco-chat` / `analyze-food-photo` are still at their 2026-07-26 versions, all predating the shared extractor. Everything in Section N is committed and inert.
- **OBS-037** · ops · Testers on TestFlight are running build #18, which is v3: four tabs, an Air tab, no memory screen, no email signup. Every fix and feature from `v4-retention` is invisible to them.
