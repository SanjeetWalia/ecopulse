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
