# Migrations

Until September 2026 this repo had no migrations directory. The schema lived in
`supabase_schema.sql` (April 4, 2026) plus SQL applied by hand in the Supabase
dashboard. Everything the v3 redesign added — `shared_snaps`, `leaves`,
`user_facts`, `eco_chat_messages`, the `delete_account` RPC, and extra columns
on `invite_codes` — existed only in the live database. The repo could not
rebuild its own backend (OBS-018).

These files close that gap.

## 0001 has already been proven wrong once

The first `supabase db push` failed on it: the policy predicate guessed
`friendships(user_id, friend_id)` when the real columns are
`requester_id, addressee_id`. Postgres rejected the whole migration, which is
the good outcome — it was loud. Replace the reconstruction with a real dump
before relying on it for anything.

## Important: 0001 is reconstructed, not dumped

`0001_v3_baseline_reconstructed.sql` was written by reading application code, not
by dumping the live database. Column types and constraints are best-effort. Every
statement is idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), so running
it against the live project is safe and will be a no-op where objects already
exist — but it is **not** proof that the repo matches production.

To replace it with the authoritative schema, once:

```bash
supabase link --project-ref yzeslhdoviwahtunthor
supabase db dump --schema public -f supabase/migrations/0000_actual_baseline.sql
```

Then diff it against 0001, keep the dump, and delete the reconstruction.

## After that

Every schema change goes in a new numbered file here and gets committed with the
code that depends on it. No more dashboard-only SQL.

## Applying

```bash
supabase db push
```
