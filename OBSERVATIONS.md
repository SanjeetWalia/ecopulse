# Eco Pulse — Observations Log

Running log of bugs, insights, and product notes found during self-test or daily use. Append-only. Triaged into ROADMAP.md during Sunday planning ritual.

Format: `YYYY-MM-DD · OBS-NNN · [tag] short description`

Tags: `bug`, `ux`, `perf`, `idea`, `copy`, `data`

---

## 2026-04-23 (first self-test, TestFlight build #5)

- **OBS-001** · bug · Splash screen hangs indefinitely on cold launch. Root cause: `onLayout`-triggered `SplashScreen.hideAsync()` fires once before async auth init completes. **FIXED** in commit `fe8466c` (App.tsx — moved hide to `useEffect` keyed on `appReady` state + 8s safety timeout).
- **OBS-002** · ux · CO₂e alone is meaningless to users. No reference point → user takes no action. Maps to Section K (reference points) in ROADMAP.
- **OBS-003** · bug · Logging is point-in-time, not editable. Mistakes stick. Maps to A10. **FIXED** in commit `eca09a9` (timeline + edit modal + delete + daily_summaries trigger redesign).
- **OBS-004** · bug · Single tap on a Recent activity chip re-logs without confirmation. Maps to A3. **FIXED** in commit `b...` (Alert.alert confirmation).
- **OBS-005** · ux · Product needs a habit/behavior loop — users need to return for coaching, not reporting. Maps to product vision; drives v1.1+ post-launch.

## 2026-04-24 (TestFlight build #8 — A10 timeline shipped)

- **OBS-006** · bug · LogActivityScreen chat input field is hidden behind the keyboard when it opens on iOS. Input text is not visible while typing. Likely: `KeyboardAvoidingView` misconfigured or missing `keyboardVerticalOffset`. High priority — blocks the primary input flow. Maps to Section A (new item).
- **OBS-007** · bug · Claude's `analyze-activity` edge function doesn't know the current date/time. User said "Working from home in Mac Studio since 7 am till now" and Claude replied "What time is it now — how many hours have you been working?" Fix: inject current ISO timestamp + user's timezone into the system prompt so Claude can resolve relative time references like "now", "earlier", "since 7 am." Maps to E1 (parsing fallback) and improves time-relative logging broadly.
- **OBS-008** · ux · "App doesn't feel impressive." User observation post-A10 ship. Root cause: app is a logger, not a coach. Every number is inert because there's no reference point, no narrative, no "so what?" layer. Maps directly to Sections J (Moko-Avi agent) and K (reference points everywhere). These are the highest-leverage v1 additions between now and June 17.

---

## Next-session priorities (candidates)

Not prescriptive — just the queue as of last update.

1. **OBS-006** — keyboard hides input. Blocks primary flow. Small fix, high user-pain ratio.
2. **K3** — Day tab "So what?" one-liner. Makes the number mean something. ~3-4 hours. Highest emotional-impact feature available pre-launch.
3. **OBS-007** — pass current time to Claude. Small fix, improves parsing quality.
4. **J1-J4** — Moko-Avi core. Foundation for the coach loop.
5. **A2** — loading spinner timeouts. Critique item, good polish.

Triage at next Sunday planning ritual.
