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
2. In the project's **Settings → Environment Variables** add `GEMINI_API_KEY` (your key) and `APP_PASSCODE` (a long passcode only you know — 16+ random characters) for **every environment you use (Production and Preview)**, then redeploy.
3. On the phone, open the `https://….vercel.app` link in Chrome or Samsung Internet, enter the passcode, then menu (⋮) → **Add to Home screen / Install app**.

Every page and API route needs the passcode cookie (`middleware.ts`), so nobody who finds the link can use your Gemini key. The gate **fails closed**: if `APP_PASSCODE` is missing or blank, every page and API answers 503 — on Vercel (Production and Preview) and for `npm start`. Only `npm run dev` on your own machine runs without it. A single shared passcode is a stopgap for one owner's private app; it isn't suitable for multiple users (no per-user accounts, revocation or roles). Changing the passcode signs every device out. Your logs are stored per browser, so the phone starts with fresh data.

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

## V2: Weekly Evolution, Visual Evolution and sharing

Progress has four rows: **Weekly evolution**, **Visual evolution**, **Your wins** and **Body tracker**.
When last week has ended and hasn't been reviewed, the home screen shows a "Your weekly review is
ready" card.

- **Weekly review** (`lib/review/`, `components/WeeklyReview.tsx`)
  - Built from records the app already keeps: workouts and the missed/made-up plan, PRs and
    awards, weigh-ins, waist, body fat, habits, meal ticks, imported Cronometer days, cardio and
    photos.
  - Anything not recorded shows as "not recorded", never as 0.
  - Meal ticks are reported as ticks, not as calories eaten. Hours of sleep aren't tracked; only
    the Sleep Lock routine is.
  - The review week starts on Sunday by default; this can be changed on the review screen.
  - Saving a review keeps a versioned snapshot. If data is corrected later, the app says so and
    lets you save an updated version. Earlier versions are kept.
- **Coach** (`lib/review/coach.ts`, thresholds in `lib/review/config.ts`)
  - Deterministic, conservative rules; no AI.
  - It needs at least 2 weigh-ins in a week before it uses weekly averages. It only flags a
    possible plateau after 3 flat weeks with good adherence.
  - Pain, very low energy or unusually fast loss point you to a professional.
  - It never changes targets or training. Suggestions are approved or dismissed by the user, kept
    as a history, and followed up with "did it help?".
- **Visual Evolution** (`lib/photos.ts`, `components/VisualEvolution.tsx`)
  - Front, side, back or other photos, taken or uploaded, with dates and private notes.
  - Photos are stored in this phone's IndexedDB only and are never uploaded.
  - Features: timeline, presets (this week vs last, Week 1 vs 4/8/12, custom), a slider or
    side-by-side view, and optional measurement overlays. Each overlay says which day it was
    measured. Photos can be replaced, saved as a copy or deleted.
- **Sharing** (`lib/achievements/cards.ts`, `components/ArtifactShare.tsx`)
  - Weekly Wins cards, Transformation Comparison images and the existing certificates all use one
    preview, save and share panel at 1080×1920, 1080×1350 and 1080×1080.
  - Comparison images require an explicit confirmation of the photos and numbers.
  - Counts of previews, saves and shares stay on the phone (More → Sharing activity).
- **Referral (optional):** with `NEXT_PUBLIC_REFERRAL_URL` set, QR codes and "Copy referral link"
  use that https URL plus a random 12-character token (and an optional coach slug). Without a
  backend, the app can't count link visits or signups; only the destination site can.
- **Not included:** public achievement pages (no server), cloud photo sync, and AI explanations.
  The coach is rules-only.
- **Privacy:** pages carry `noindex`, `robots.txt` disallows everything, and the app stays behind
  the passcode.

## Security (Stage 1 hardening)

- **Sign-in:** a shared passcode cookie on every page and API, failing closed (see above).
- **Photo reading with AI:** a scale photo, report, cardio screen or gym photo is sent to Google Gemini only after the user taps **Send to Gemini** in a confirmation dialog, every time. The server refuses uploads without that confirmation (`x-ai-consent`).
  - Uploads are limited to one file of at most 4 MB.
  - The format is checked from the file's bytes: JPEG, PNG, WebP, HEIC/HEIF, and PDF for reports. PDFs with scripts or attachments are refused.
  - Images are passed straight to Gemini and never stored on the server.
- **Logs:** one JSON line per AI request with a request ID, category, status and sizes (`lib/aiSafety.ts`). Model output, image bytes and user values are never logged.
- **Headers:**
  - A per-request nonce Content-Security-Policy (`lib/csp.ts`, set in `middleware.ts`).
  - Also `X-Content-Type-Options`, `X-Frame-Options: DENY` with `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and HSTS in production (`next.config.mjs`).
- **On-phone data:**
  - The app asks the browser for persistent storage (it may refuse). This only lowers the chance of automatic cleanup.
  - Clearing site data, uninstalling, or losing the phone still erases everything.
  - **There is no backup or restore yet** (More → Data on this phone).
- **Tests:** `tests/security-auth.test.ts` and `tests/security-ai.test.ts`.

## Backups (Stage 2)

More → **Data on this phone** → **Create an encrypted backup** saves one `.aqbk` file containing every `ags:*` record and every stored file (progress photos, scale photos, reports).

- **Encryption (`lib/backup.ts`):** on the phone, with a passphrase the user chooses (12+ characters, separate from the app passcode).
  - Key derivation: PBKDF2-SHA-256, 600,000 iterations, random 16-byte salt.
  - Cipher: AES-256-GCM, random IV, with the file header bound as additional data.
  - WebCrypto only; no server ever receives the file, and nothing is readable without the passphrase. A forgotten passphrase can't be recovered.
- **Restore** (`lib/backupStore.ts`, `components/BackupPanel.tsx`):
  - Decrypts, validates strictly (format and version, `ags:` keys only, size limits, allow-listed file types, a SHA-256 check per file) and shows a preview with counts. Nothing is written before the user confirms.
  - If the phone already holds the user's data, a **safety backup** of it must be saved first.
  - Two modes: **Replace everything**, or **Add only what's missing** (keeps existing values).
- **Reminders:** a "last backup" line in More and in Data on this phone, and a reminder card in the Weekly Review once the last backup is over 7 days old.
- **Tests:** `tests/backup.test.ts` (format, tampering, validation, restore plans).
- **Limit:** the whole backup is built in memory. Very large photo libraries (hundreds of photos) may be slow or run out of memory on older phones.

## Delete everything on this phone (Stage 2b)

More → **Data on this phone** → **Delete everything on this phone** (`lib/erase.ts`, `components/ErasePanel.tsx`) removes:

- every `ags:` record;
- the photo and report store (IndexedDB `ags`);
- the app's offline caches;
- optionally, the passcode sign-in cookie (`POST /api/logout`).

Safeguards:

- You must type `DELETE`.
- With no backup from the last 24 hours, there's an extra acknowledgement that the data will be lost.
- Files are removed first, so no record is left pointing at a missing photo.
- The result screen reports exactly what was removed, including anything that didn't finish.

It can't remove copies elsewhere: backup files you saved, or photos already sent to Gemini for reading. Tests: `tests/erase.test.ts`.

## Sign-in sessions (Stage 2c)

Signing in with the passcode starts a **signed session** (`lib/session.ts`): an HttpOnly, Secure, SameSite=Lax `__Host-ags_session` cookie, HMAC-SHA-256-signed with the server-only `SESSION_SECRET`. The old year-long `ags_auth` cookie is no longer accepted.

- **Lifetime:**
  - Idle limit: 30 days without using the app. Using it renews the limit, at most once a day.
  - Absolute limit: 90 days after signing in.
  - After either, the app asks for the passcode again and says why.
- **Sign out** of this phone: More → Data on this phone → **Sign out of this phone**. This clears the session and the offline copy; data stays on the phone.
- **Lost phone:** change `SESSION_SECRET` in Vercel and redeploy. That signs out **every** device; there's no per-device list without a database. Also sign out of Vercel, and change `APP_PASSCODE` if it may be known.
- **Configuration:** `SESSION_SECRET` (32+ random characters) is **required** wherever `APP_PASSCODE` is. Without it the app fails closed (503). Only local `npm run dev` uses a stand-in key.
- **Tests:** `tests/session.test.ts` and `tests/security-auth.test.ts`.

## App lock (Stage 2d)

An optional lock, off by default, for **Visual evolution**, **Body tracker** and **Data on this phone**. The last is locked too so backups can't be used to get around it. Turn it on in More → Data on this phone → **App lock** (`lib/appLock.ts`, `components/AppLock.tsx`).

- **Unlock methods:**
  - The phone's own screen lock (fingerprint, face or phone PIN), through a passkey created on this phone (WebAuthn, user verification required).
  - An app PIN of 6–12 digits, rejecting trivial ones, stored only as a salted PBKDF2-SHA-256 hash.
- **Wrong PINs:** 4 free tries, then a 30-second wait that doubles each time, up to 1 hour. The wait survives a reload.
- **Locks again:** when you leave the app (or after 5 minutes), or after 5 or 15 minutes without use. Reloading always starts locked; the unlocked state lives only in memory.
- **Forgot the PIN:** entering the app passcode removes the lock.
- **Scope:** the lock is per phone, so `ags:lock` is never in backups. While it's on, the Progress tab doesn't show the last weigh-in.
- **Limits:** it's a privacy screen, not encryption. Data on the phone isn't encrypted by it. The Weekly Review still shows weekly body averages.
- **Tests:** `tests/appLock.test.ts`.
