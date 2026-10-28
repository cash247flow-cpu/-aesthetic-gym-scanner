# AESTHETIQ

*Build Your Ideal Physique.*

Snap one photo of your gym, pick **Push / Pull / Legs**, and get that session of the Natty Blueprint program using only the equipment Gemini can see — with sets × reps, rest, a form cue, and an aesthetic badge per exercise. Missing equipment is swapped for a labeled substitute or the slot is dropped (never invented).

## Setup

```bash
npm install
cp .env.example .env.local   # then paste your key into .env.local
npm run dev
```

Get a Gemini API key at https://aistudio.google.com/app/apikey and set `GEMINI_API_KEY` in `.env.local`. The key is only read server-side (`app/api/identify/route.ts`) and never ships to the browser.

## Open on your phone (same Wi-Fi)

```bash
npm run dev -- -H 0.0.0.0
```

Find your laptop's LAN IP (Windows: `ipconfig` → IPv4 Address; macOS: `ipconfig getifaddr en0`; Linux: `hostname -I`) and open `http://<that-ip>:3000` on the phone. If it doesn't load, allow Node through the laptop firewall on private networks.

## Layout

| Path | What it does |
| --- | --- |
| `lib/programs.ts` | Program data: sessions, substitutes, aesthetic rankings |
| `lib/equipment.ts` | Canonical equipment whitelist + normalizer |
| `lib/plan.ts` | Pure planner: keep / swap / drop, badges, counts, missing note |
| `app/api/identify/route.ts` | Image → Gemini → `{ equipment: string[] }` (with model fallback + timeout) |
| `app/api/plan/route.ts` | `{ session, equipment }` → plan JSON |
| `app/page.tsx`, `components/ResultView.tsx` | Upload → loading → result UI |

## Exercise guide data

The "How to" photos and step-by-step instructions come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain, Unlicense). Each app exercise is matched to a database entry by hand in `scripts/build-exercise-guide.mjs`; exercises without a faithful equivalent show no guide. To refresh the data and photos, run:

```bash
node scripts/build-exercise-guide.mjs
```

Exercises it doesn't cover have a hand-picked YouTube demo in `lib/exercise-videos.ts`, loaded only when you tap play.

## Supplement label data

"Check label" on the Supplements screen looks up products in the NIH Office of Dietary Supplements' [Dietary Supplement Label Database](https://dsld.od.nih.gov/) (public domain, CC0) through `app/api/supp-label/*`. No API key is needed. It shows label facts for reference only — it never suggests a dose or lifts a hold.

National Institutes of Health, Office of Dietary Supplements. Dietary Supplement Label Database, 2026. https://dsld.od.nih.gov/

## Use it on your phone

1. Deploy on [Vercel](https://vercel.com): **Add New → Project**, import this GitHub repo, keep the defaults.
2. In the project's **Settings → Environment Variables** add `GEMINI_API_KEY` (your key) and `APP_PASSCODE` (a long passcode only you know), then redeploy.
3. On the phone, open the `https://….vercel.app` link in Chrome or Samsung Internet, enter the passcode, then menu (⋮) → **Add to Home screen / Install app**.

With `APP_PASSCODE` set, every page and API route needs the passcode cookie (`middleware.ts`), so nobody who finds the link can use your Gemini key. Changing the passcode signs every device out. Your logs are stored per browser, so the phone starts with fresh data.

## Achievements and certificates

Progress → Your Wins → **My Trophy Collection** shows awards in three series:
Conqueror (personal records and lifting volume), Transformation (body-weight and body-fat
progress) and Discipline (workouts completed and perfect habit streaks).

- **Rules** live in `lib/achievements/config.ts`, including the PR rules, the
  Silver/Gold/Platinum thresholds and the declarations. Detection (`lib/achievements/detect.ts`)
  is recomputed from saved data every time. Award IDs are stable, the same workout never
  awards twice, and editing or deleting data updates or withdraws the awards that depended on it.
- **PRs** use the per-set records saved when a workout is finished (`ags:workouts`). Only
  workouts finished after this feature was added count.
- **Certificates** (`lib/achievements/certificate.ts`) are drawn on a canvas at 1080×1920,
  1080×1350 or 1080×1080. The preview is the exact image that gets saved or shared. Sharing
  uses the phone's share sheet when it can and otherwise saves the image. Nothing is ever posted
  automatically.
- **Privacy:** awards stay on the phone. The user chooses which fields appear on each image, and
  body measurements are off unless chosen for that certificate. There are no public award pages,
  because the app has no server for them.
- **Referral QR (optional):** set `NEXT_PUBLIC_REFERRAL_URL` to an `https://` link in Vercel
  (Settings → Environment Variables) and redeploy. The QR option then appears on certificates.
  Without the variable, the option is hidden.
- **Artwork:** the emblem in `public/achievements/` is cropped from the AESTHETIQ certificate
  artwork. The Cinzel font is in `public/fonts/` under the SIL Open Font License.
- **Tests:** `npm test` runs the rule tests in `tests/`, which use example data only.
