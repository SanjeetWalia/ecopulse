# Eco Pulse — React Native MVP

Carbon footprint tracker with social features, built with Expo + Supabase.

---

## Stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo 51 |
| Navigation | React Navigation v6 |
| Backend / DB | Supabase (Postgres + Auth + Storage + Realtime) |
| State | Zustand |
| Animations | React Native Reanimated 3 |

---

## Setup — Step by step

### 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Name it `ecopulse`, choose a region close to your users (US East for Frisco, TX)
3. Save your **Project URL** and **anon public key** from Settings → API

### 2. Run the database schema

1. In Supabase → SQL Editor → New query
2. Paste the entire contents of `supabase_schema.sql`
3. Click **Run** — this creates all tables, triggers, RLS policies, and indexes

### 3. Create storage buckets

In Supabase → Storage:
- Create bucket **`avatars`** → Public
- Create bucket **`stories`** → Public
- Create bucket **`food-snaps`** → Private

### 4. Configure the app

Edit `app.json` extras section:

```json
"extra": {
  "supabaseUrl": "https://YOUR_PROJECT_ID.supabase.co",
  "supabaseAnonKey": "YOUR_ANON_KEY_HERE"
}
```

### 5. Install dependencies

```bash
cd ecopulse
npm install
```

### 6. Add fonts (optional but recommended)

Download from:
- **Cabinet Grotesk** — https://fontshare.com/fonts/cabinet-grotesk (free)
- **Instrument Sans** — https://fonts.google.com/specimen/Instrument+Sans (free)

Place `.otf` / `.ttf` files in `./assets/fonts/` and uncomment the `loadAsync` calls in `App.tsx`.

### 7. Run the app

```bash
# Start Expo dev server
npx expo start

# Or run directly on simulator
npx expo run:ios
npx expo run:android
```

---

## Project structure

```
ecopulse/
├── App.tsx                        # Root — fonts, auth init, splash
├── app.json                       # Expo config + Supabase keys
├── supabase_schema.sql            # Full DB schema — run in Supabase
├── src/
│   ├── constants/
│   │   └── theme.ts               # Colors, typography, spacing
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client + auth helpers
│   │   └── authStore.ts           # Zustand auth state
│   ├── navigation/
│   │   └── index.tsx              # Auth stack + Tab navigator
│   └── screens/
│       ├── auth/
│       │   ├── WelcomeScreen.tsx  # ✅ Built
│       │   ├── SignUpScreen.tsx   # ✅ Built
│       │   ├── SignInScreen.tsx   # ✅ Built
│       │   └── ForgotPasswordScreen.tsx # ✅ Built
│       ├── home/
│       │   ├── HomeScreen.tsx     # 🔜 Next phase
│       │   ├── ProfileScreen.tsx  # 🔜 Next phase
│       │   └── SettingsScreen.tsx # 🔜 Next phase
│       ├── explore/
│       │   └── ExploreScreen.tsx  # 🔜 Next phase
│       ├── activity/
│       │   ├── SnapScreen.tsx     # 🔜 Next phase
│       │   ├── ActivityDetailScreen.tsx # 🔜 Next phase
│       │   └── LogActivityScreen.tsx    # 🔜 Next phase
│       ├── gift/
│       │   └── GiftPlantScreen.tsx # 🔜 Next phase
│       └── messages/
│           ├── MessagesScreen.tsx  # 🔜 Next phase
│           └── ConversationScreen.tsx # 🔜 Next phase
```

---

## Build phases

### ✅ Phase 1 (this build) — Scaffold + Auth
- Project structure
- Supabase schema (all tables, RLS, triggers)
- Welcome, Sign Up, Sign In, Forgot Password screens
- Auth state management (Zustand)
- Navigation shell (Auth stack + Tab navigator)

### 🔜 Phase 2 — Home screen
- Green Steps widget (Today/Month/Year tabs)
- Stories ribbon + Story viewer
- Gift a Plant card
- Log Activity widget

### 🔜 Phase 3 — Activity tracking
- Log Activity screen (all categories)
- CO₂ calculation engine
- Daily summaries + streak logic
- Activity timeline

### 🔜 Phase 4 — Social
- Friends system (add, accept, leaderboard)
- Stories (create, view, expire)
- Messages + DMs
- Eco update cards

### 🔜 Phase 5 — Explore
- Eco Reels feed (curated green content)
- Platform filters (TikTok / Instagram / YouTube)
- Share to friends

### 🔜 Phase 6 — Gift a Plant
- Unlock logic (CO₂ milestone + rank)
- Plant catalogue
- Vendor integration (when ready)

### 🔜 Phase 7 — Polish + Deploy
- Push notifications (FCM)
- Food snap AI (Claude API)
- App Store + Play Store submission

---

## Environment variables

Never commit real keys. For production use EAS Secrets:

```bash
eas secret:create --scope project --name SUPABASE_URL --value "https://..."
eas secret:create --scope project --name SUPABASE_ANON_KEY --value "eyJ..."
```
