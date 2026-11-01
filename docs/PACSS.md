# PACSS controls in AESTHETIQ

PACSS stands for Privacy, Accuracy, Compliance readiness, Safety and Security. This document records what the app actually does, as checked in the code on 2026-11-01 (branch `pacss`). It covers:

1. what was missing;
2. what changed;
3. who may do what;
4. where data goes;
5. what still needs a decision.

It is an engineering record. **It is not a legal opinion, a certification or a claim that the app is secure, compliant or medically safe.**

## 1. What the app is (verified, not assumed)

| Area | What the code does |
|---|---|
| Sign-in | One shared app passcode (`APP_PASSCODE`) is checked on the server. Sessions are signed cookies (`__Host-ags_session`), 30 days idle and 90 days absolute. Middleware protects every page and API route except `/login` and `/api/login`, and it fails closed if secrets are missing. Vercel Authentication sits in front. |
| Server store | Upstash Redis (optional, fail-open). It holds the login-failure counters (keyed by a hash of the network address), daily AI-read counts, signed-in device records and revocations. No fitness data is kept there. |
| User data | All in the phone's browser: localStorage `ags:*` and IndexedDB `ags/files` for photos and reports. There are no accounts, no cloud sync and no analytics SDK. The `ags:events` counters stay on the phone. |
| AI | Only photo reading, through Google Gemini on the server: gym equipment, scale or report numbers, cardio screens, ingredient-list screenshots for the meal editor, and fridge/pantry photos and nutrition labels for the food coach. Each photo needs a consent tap, and the server refuses uploads without the consent header. The model's JSON is normalised to an allow-list of fields and range-checked. **There is no AI chat.** The food coach's portions, macros, allergy checks and explanations are deterministic code (`lib/nutrition/*`); AI only reads photos into drafts the user confirms. |
| Coaching | The weekly coach in `lib/review/coach.ts` is transparent, deterministic rules. It suggests one focus; the user approves or dismisses it. It can only point to reviewing the macro targets. It never edits anything. |
| Workout plan | `lib/plan.ts` uses fixed programmes filtered by the equipment the user has. Progressive-overload targets (`lib/overload.ts`) are deterministic and pre-fill editable boxes; they can be turned off. |
| Records and awards | Quick PRs at the end of a workout (`lib/wins.ts`). Certificate awards (`lib/achievements/detect.ts`) are pure functions of the logs. |
| Sharing | Certificate, Weekly Wins and comparison images are made on the phone and shared through the OS share sheet. Private by default: measurements and QR are opt-in. The QR code appears only if a referral link is configured over https. There is no messaging or marketing feature. |
| Backup | Encrypted `.aqbk` files (PBKDF2 600k, AES-256-GCM). Restore has been tested end to end (round trip, tampered file, wrong passphrase, "add only what's missing"). See `e2e/backup.spec.ts`. |

## 2. Gap assessment

| # | Control | Evidence found | Risk | Fix (this branch) | Verification |
|---|---|---|---|---|---|
| A1 | Units on logged sets | Set logs stored raw text with no unit. Switching lb↔kg reinterpreted numbers already typed. | A lift typed in lb and finished in kg was recorded 2.2× heavier, creating false PRs and inflating volume. | Logs record `unit`/`prevUnit`. Switching units converts what's typed. Finishing a workout converts from the unit each set was typed in. **Old logs without a unit** are never read in the selected unit (`lib/logUnits.ts`). They're matched against the finished workout saved in lb at the time (an exact lb or exact kg→lb match). Otherwise they're *ambiguous*: shown with "?", never copied into today's boxes, no targets, and no records or volume. The user is asked "lb or kg?"; the answer keeps a snapshot of the original numbers and can be undone. | `pacss.test.ts`: "finish workout…", "legacy units…" (3); `e2e/pacss.spec.ts`: "old set logs…" |
| A2 | Quick PRs | `bestOf` counted a set's weight even with no reps. | Typing a weight and ticking the set gave a false "Heaviest weight" PR. | Only sets with reps logged and plausible numbers count. | Same test (Leg Press 900 with no reps) |
| A3 | Implausible values | No sanity limits on logged sets or typed body entries; AI readings were already range-checked. | Typos such as 3000 for 300 created platinum PRs, became the new baseline and inflated volume milestones. | **Typo-screening heuristics, not physiological or safety limits** (`lib/units.ts`). A set counts with 1–300 reps and 0–1,100 lb; the 1,100 lb figure was chosen to sit above the heaviest lifts on record so a real set is very unlikely to trip it. Sets outside are kept exactly as typed and explained in the logger and the workout summary ("Saved, but not counted…"). **Large jumps** against comparable history (same exercise and record type: ×1.5 weight, ×2 volume, or +10 reps and ×2 reps) are *counted* but flagged "double-check" in the summary and trophy list. Body entries outside the AI reader's ranges get a warning; **Save anyway** keeps them as typed, labelled, and out of trends and awards. Imported food-log values outside 0–20,000 kcal or 0–2,000 g become unknown. | "PRs: sets without reps…", "typo screen vs big jumps…", "body: a value kept…", "imports…"; `e2e`: "body tracker…" |
| A4 | Provenance of AI readings | The draft said "Read by Gemini — check the numbers", but the saved entry didn't keep that. | AI interpretations become indistinguishable from typed facts. | `BodyEntry.aiRead`; the history shows "AI-read, checked by you". | Manual check (screens) |
| A5 | Recommendations show their limits | The coach listed observations but not gaps. | Uncertain evidence reads as certain. | `dataLimits()` lists too few weigh-ins, a stale latest weigh-in (over 14 days), same-day weigh-ins more than 5% apart, no goal, no plan on record and no food log. Shown as "What the data can't tell". | "missing data…", "data limits…" |
| A6 | Certificates imply verification | They said "Recorded in: Logged workouts" but nothing about verification. | A shared certificate reads like independent proof. | Every certificate prints "From your own training log · not independently verified". Shared cards say "Self-recorded". The "Recorded in" rows say "(self-recorded)". | Rendered and inspected |
| S1 | Streak pressure | The 5 daily habits include air squats and walks; one missed day breaks the streak and the "Days Unbroken" award. | Pressure to train through illness or injury. | "Recovery day" toggle in Daily habits. It pauses streaks: the day doesn't count or break them, and it's excluded from the weekly habit rate. Certificates state how many recovery days were paused. | "safety: recovery days pause streaks…" |
| S2 | Safety outside the review | Pain in the weekly check-in only changed the coach's text; the workout screen still suggested more weight. | Load keeps going up after the user reported pain. | `lib/review/pain.ts`: ticking pain records a report at once and holds overload targets at last time's numbers. **Nothing clears it automatically**: not time, not unticking, not a later check-in without pain. Only **Resume progression suggestions → Resume suggestions** clears it, and that screen says it *isn't medical clearance*. Reports and resumes are kept as a dated history. | "safety: the pain hold never expires…", "unticking… doesn't resume"; `e2e`: "pain holds workout targets…" |
| S3 | Reversible plan changes | Macro target edits overwrote the previous values with no history. | A change can't be explained or reverted. | `lib/planChanges.ts`: each saved change records before, after, when and origin ("you" or "after a weekly-review suggestion"). "Undo this change" is offered but refused if the targets were edited since. Numbers only. | "undo…", "approval…" |
| X1 | Untrusted backup files | Restore wrote every `ags:` record in the file. | A crafted file could set the app-lock PIN, or fake a recent backup date and skip the extra confirmation Delete everything asks for when there's no recent backup. | `DEVICE_ONLY_RECORDS` (`ags:lock`, `ags:backup:last`) are never written or removed by a restore. | "imports: a malformed backup is refused…" |
| P1 | Privacy statement accuracy | "Where your data lives" left out the NIH label lookups, YouTube embeds, the server's sign-in records and the hosting provider. | The statement didn't match behaviour. | Copy updated (More → Data on this phone). | Manual check |

Already in place and re-verified, so not changed:
- consent for each AI photo, enforced on the server, plus the daily caps;
- only one image field per AI upload;
- allow-listed server logs;
- no secrets in the client bundle (CI check);
- signed sessions and per-device sign-out;
- the login rate limit;
- the coach never writes;
- sharing private by default, and measurement visibility never remembered between certificates;
- the encrypted backup format;
- the erase safeguards;
- the app lock described honestly as a privacy screen, not encryption.

## 3. Action authority

| Automatic (no prompt) | Needs the user's explicit action | Outside any automated or AI authority |
|---|---|---|
| Timers; arithmetic, unit conversion, charts, weekly metrics | Saving any change to macro targets (and undoing it) | Medical diagnosis or treatment. Pain or very low energy point to a professional. |
| PR and award detection under the rules in `lib/achievements/config.ts` | Approving or dismissing the coach's weekly focus | Sending any photo or private data without a consent tap. The server refuses uploads without the header. |
| Private draft summaries (weekly review numbers, coach text) | Sending a photo to Gemini (every time) | Rewriting historical records. Corrections are the user's edits; reviews keep earlier saved versions. |
| Overload target pre-fill (editable, can be turned off, held on pain) | Sharing or saving an image; including measurements or a QR code in it | Changing permissions, the lock or the "last backup" stamp from imported files |
| | Delete everything; restore; sign out devices | Supplement doses. The app never suggests or changes doses. |

Routine logging (sets, habits, meals, weigh-ins) stays one tap with no confirmation dialogs.

**Rules for any future AI coach** (none exists today):
- Follow the sequence observe → check data quality → assess possible causes → propose → user approves → review the outcome.
- AI output is untrusted data: parse it into a fixed schema, range-check it, and never execute instructions in it.
- Any training, calorie or macro proposal must go through `applyChange` with an origin of its own, so it's logged and undoable.
- Show the current value, the proposal, the reason and the uncertainty before approval.
- Never include photos or unrelated records in a request.
- Physiological thresholds must come from a reviewed source before any automation is enabled.

## 4. Data map (as implemented)

| Data | Where | Purpose | Leaves the phone? | Retention and deletion |
|---|---|---|---|---|
| Workouts, sets, PR records, history, habits, meals, targets and change log, reviews, body entries, goals, awards, settings | Browser localStorage (`ags:*`) | The app's features | No, unless the user makes or shares a backup or image | Until deleted, or browser data is cleared. "Delete everything" removes all `ags:` records, the photo store and caches. Individual entries can be deleted in their screens. |
| Progress photos, scale photos, reports | IndexedDB `ags/files` | Visual evolution, body records | Progress photos: never by the app. Scale photos and reports: only if sent to Gemini after consent. | Same as above; deleting an entry deletes its file |
| Photos sent for reading | Gemini API (Google), via `/api/read-*` and `/api/identify` | Read equipment, scale, report or cardio numbers, a meal's ingredient lines, foods in a fridge/pantry photo, or a nutrition label | Yes, on consent only | The app's server keeps no copy. Google's retention depends on the API account's terms (see §5). |
| Food coach: confirmed food on hand, grocery list, food preferences and allergies, confirmed meal log, reminder settings, stopping time | Browser localStorage (`ags:nutrition:*`) | Meal ideas, grocery list, in-app reminders | No (fridge and label photos are sent to Gemini only after consent and are not stored) | Same as other `ags:` records; each item can be edited or removed in its screen |
| Supplement search text, label ID | NIH DSLD API, via `/api/supp-label/*` | Show label facts | Yes, when searching | Not stored by the app |
| Exercise video views | YouTube (youtube-nocookie embed) | Demo videos | Yes, when the user taps "Watch" | YouTube's terms |
| Session cookie | Phone cookie, HttpOnly | Sign-in | Sent to the app's server | 30 days idle, 90 days absolute; cleared on sign-out |
| Device record (device type from the user agent, sign-in and last-used times) | Upstash | Signed-in devices list, per-device sign-out | Server side | 90 days, or until signed out or revoked |
| Failed-login counters (keyed hash of the network address) | Upstash | Rate limit | Server side | 15 minutes |
| Daily AI-read counts per session | Upstash | Cost and abuse caps | Server side | 2 days |
| Request metadata, function logs (allow-listed fields: tag, request ID, category, status, sizes) | Vercel | Hosting, operations | Server side | Vercel's log retention |
| Sharing counters | Phone (`ags:events`) | "Sharing activity" screen | No | Until deleted |

## 5. Items for qualified legal or product review (not conclusions)

1. **Health-data laws.** The app processes body weight, body composition, photos of the body, symptoms ("pain") and nutrition. Depending on who distributes it and to whom, consumer health-data laws may apply. Examples to evaluate: Washington's My Health My Data Act, other US state privacy laws, GDPR special-category data and UK GDPR. Whether HIPAA applies is **not** assumed either way; that depends on the operator's relationship with covered entities.
2. **Gemini API terms.** Whether Google may use submitted images to improve its products depends on the API tier and account settings of the key in use. The consent dialog says images are handled "under the Gemini API terms of the account this app uses". Someone with account access must confirm the tier and data-use settings, and the dialog may need to say more.
3. **Distribution model.** It's a single shared passcode today. Offering the app to other people would need:
   - per-user accounts;
   - a privacy notice and terms;
   - age limits;
   - a process for data-subject requests;
   - a review of the referral QR (`NEXT_PUBLIC_REFERRAL_URL`) and the "coach" branding.
4. **Wellness scope wording.** The coach and supplement screens say "not medical advice" and point to professionals. Confirm the wording fits the intended market.
5. **Hosting and processor agreements.** Data processing terms with Vercel, Upstash and Google, if required for the intended use.

## 6. Reporting an incorrect record or recommendation

- **A wrong number:**
  - weigh-ins: delete and re-add them in Body tracker;
  - workouts: edit the set log and finish the workout again (same day, same session replaces the earlier record);
  - habits: change the ticks in Daily habits.

  Records, awards and the weekly review recalculate. A saved review keeps earlier versions and shows "changed after you saved".
- **A wrong suggestion:** dismiss the focus, or answer "Did it help? → Not really" in the next review; those answers are kept. Target changes can be undone in Meals.
- **A defect in a rule:** file an issue in the repository describing the data (synthetic if possible). Don't attach real photos or health data.

## 7. Control matrix

(See §8 for access boundaries.)

Legend:
- **Impl** — implemented in code.
- **Test** — covered by an automated test.
- **Future** — recommendation only.

| PACSS | Control | Implementation | Verification | Status |
|---|---|---|---|---|
| P | Consent before each AI photo; server-enforced | `components/AiConsent.tsx`, `lib/gemini.ts` (428 without the header) | `e2e/privacy.spec.ts` | Impl, Test |
| P | AI request carries only the one image | `lib/aiSafety.ts` `readImageUpload` | `pacss.test.ts` | Impl, Test |
| P | Sharing private by default; measurements never remembered | `lib/achievements/sharePrefs.ts`, `format.ts` | `pacss.test.ts` | Impl, Test |
| P | Logs allow-listed | `lib/aiSafety.ts` `safeLog` | `tests/security-ai.test.ts` | Impl, Test |
| P | Privacy statement matches behaviour | `components/HubViews.tsx` and §4 | Manual review | Impl |
| A | Units recorded with sets; converted on switch and on finish | `components/SetLogger.tsx`, `lib/wins.ts`, `lib/units.ts` | `pacss.test.ts` | Impl, Test |
| A | PRs compare exact exercise, record type, reps floor, bodyweight vs weighted | `lib/achievements/detect.ts`, `config.ts` | `pacss.test.ts`, `tests/achievements.test.ts` | Impl, Test |
| A | Implausible and no-rep sets never count | `lib/units.ts` `countableSet` | `pacss.test.ts` | Impl, Test |
| A | Body entry ranges; AI provenance kept | `components/BodyTracker.tsx`, `lib/bodyLog.ts` | `pacss.test.ts` (ranges); manual (UI) | Impl, Test (partly) |
| A | Missing data reported, never filled | `lib/review/metrics.ts`, `coach.ts` `dataLimits` | `pacss.test.ts` | Impl, Test |
| A | Certificates state self-recorded, unverified | `lib/achievements/certificate.ts`, `cards.ts`, `format.ts` | Rendered PNG inspected | Impl |
| C | Data map, retention, legal-review list | This document | — | Impl (documentation) |
| S | Coach proposes only; the user approves or dismisses | `lib/review/coach.ts`, `store.ts` | `pacss.test.ts`, `tests/review.test.ts` | Impl, Test |
| S | Plan changes logged and undoable | `lib/planChanges.ts`, `components/MealPlanView.tsx` | `pacss.test.ts` | Impl, Test |
| S | Pain report holds overload until the user explicitly resumes (not clearance) | `lib/review/pain.ts`, `components/PainHold.tsx`, `lib/overload.ts` | `pacss.test.ts`, `e2e/pacss.spec.ts` | Impl, Test |
| S | Recovery days pause streaks | `lib/habits.ts`, `detect.ts`, `metrics.ts`, `HabitsView.tsx` | `pacss.test.ts` | Impl, Test |
| S | No supplement dose suggestions | `lib/dsld.ts`, `SupplementsView.tsx` | Existing review | Impl |
| Sec | Server auth, signed sessions, rate limit, AI caps, per-device sign-out | `middleware.ts`, `lib/session.ts`, `lib/guard.ts` | `tests/security-auth.test.ts`, `guard.test.ts`, `e2e/auth.spec.ts`, `devices.spec.ts` | Impl, Test |
| Sec | Untrusted AI output reduced to typed, ranged fields | `lib/scaleReading.ts`, `lib/equipment.ts` | `pacss.test.ts` | Impl, Test |
| Sec | Untrusted backups: validated before writing; device-only records never restored | `lib/backup.ts` | `pacss.test.ts`, `tests/backup.test.ts`, `e2e/backup.spec.ts` | Impl, Test |
| Sec | No secrets in the client bundle; dependency audit; secret scan | `.github/workflows/ci.yml` | CI | Impl, Test |
| Sec | App lock is a privacy screen, not access control or encryption | `lib/appLock.ts` (stated in the UI) | `e2e/applock.spec.ts` | Impl, Test |
| — | Per-user accounts and server-side authorisation per user | — | — | Future (needs a product decision) |
| — | Encryption at rest on the phone | — | — | Future (browser storage isn't encrypted by the app) |
| A | Old logs with no unit: matched against finished workouts, or asked about; never reinterpreted | `lib/logUnits.ts`, `components/SetLogger.tsx`, `lib/wins.ts` | `pacss.test.ts`, `e2e/pacss.spec.ts` | Impl, Test |
| A | Typo-screen exclusions explained; big jumps flagged, not rejected | `lib/units.ts`, `components/Celebrate.tsx`, `TrophyCollection.tsx` | `pacss.test.ts` | Impl, Test |
| Sec | Access boundaries stated in the app (§8) | `components/HubViews.tsx` | `e2e/pacss.spec.ts` | Impl, Test |
| — | Saved records (`ags:pr`, `ags:workouts`) were converted to lb at finish time using the toggle then. A pre-change mid-workout switch may have mis-converted them, and that can't be detected. | — | — | Known limitation |

## 8. Access boundaries (as implemented)

**Two separate things are called "signing in":**

1. **Vercel Authentication** (in front of every deployment). Only people with access to the Vercel team/project get through. This is configured in Vercel, not in this code.
2. **The app passcode** (`APP_PASSCODE`). It is **one shared passcode**, not a personal account. The server checks it (`app/api/login`), rate-limits wrong guesses, and issues a signed, expiring session cookie for that browser. `middleware.ts` refuses every page and API request without a valid cookie. The server knows sessions and devices, never *people*.

**Can different users access each other's records?**

- **On different phones or browsers: no.** Workouts, body data, photos, habits, reviews and plans are stored only in each browser (localStorage and IndexedDB). There is no API that reads or writes them, so a signed-in session has nothing on the server to read.
- **Separation is enforced by the browser's same-origin storage** (each browser profile has its own copy). It is **not** enforced by any per-user check in this app, because there are no users.
- **What every signed-in session shares on the server:**
  - the **Signed-in devices** list: device type and sign-in and last-used dates, for all sessions;
  - the right to **sign any of them out**, since all sessions are equal;
  - the **daily total** of AI photo reads, which every session counts toward.

  A listed session ID can't be turned into a working cookie: that needs `SESSION_SECRET`.
- **On a shared device or browser profile: yes, fully.** Anyone who can open the app in that browser sees and can change everything in it. The only in-app control is the optional **app lock**, a privacy screen over Visual evolution, Body tracker and Data on this phone. It is **not encryption or access control**; with developer tools the data is readable.

  Real separation on one device needs:
  - separate OS user accounts or browser profiles;
  - the phone's own screen lock.
- **Backups:** an `.aqbk` file plus its passphrase gives that data to whoever holds both.

**Not built:** per-person accounts, per-user server-side authorisation, or server-side storage of records. Any of these needs a product decision (see §5.3). The app now says the above under **More → Data on this phone → Who can see this data**.
