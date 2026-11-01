# Nutrition coach (first release)

Four entry points on Home → **Food coach**: *Scan My Fridge*, *What Should I Eat?*, *Grocery List*, *I'm Working Late*.
Main flow: photo → confirm ingredients → choose a meal → confirm what was eaten, or add groceries.

## What it uses, and where things live

| Input | Source | Notes |
|---|---|---|
| Targets | Meal plan targets (`ags:meals:targets`, plan defaults otherwise) | Used only once **confirmed**: the user edited targets in the Meal plan, or tapped "Use these targets" (`ags:nutrition:targets-ok`). A body-fat goal is never used to set calories. |
| Today's intake | `ags:nutrition:log` (confirmed meals) + plan meals ticked eaten that carry Cronometer recipe values | If today's Cronometer daily totals were imported, those are used **alone**, so nothing is counted twice. Ticked plan meals without values are listed as "not counted". |
| Food on hand | `ags:nutrition:inventory` | Only rows the user confirmed. Older than 7 days → "still have it?". Never auto-depleted, bought or eaten. |
| Allergies / foods avoided / prep time / budget swaps | `ags:nutrition:prefs` | Asked before the first suggestion. Allergies are a fixed list based on FDA's nine major food allergens (see NUTRITION_REFERENCE.md for what each covers and the limits). |
| Grocery list | `ags:nutrition:grocery` | Ticking an item = "in my basket". Moving it to food at home needs an explicit "Yes, add to my food". |
| Reminders | `ags:nutrition:reminders`, `…:dismissed` | Opt-in; see below. |
| Stopping time | `ags:nutrition:stop` | Today's date + time only. |

All keys are `ags:` keys, so the existing backup, restore and "Delete everything" cover them. No existing record is written by the coach.

## Where AI is (and isn't) used

- **AI (Google Gemini, server-side, consent every time):** reading a fridge/pantry photo into a draft list (`/api/read-pantry`) and reading a Nutrition Facts panel (`/api/read-food-label`). Both reuse `visionRoute` from the gym scanner: consent header required, one image of at most 4 MB with its type checked from the file's bytes, the per-session/total daily AI cap, allow-listed logs (never images or model text), and the server key never reaches the browser. Photos are shrunk on the phone, sent once and **not stored** anywhere by the app.
- The gym scanner's *prompt and normalizer* were not reused — they only return gym equipment names. Each new route has its own prompt and an allow-list normalizer (`lib/nutrition/readings.ts`): names are plain text, amounts are kept only with a recognised unit and a sane range, at most 30 items, and anything else in the reply is ignored. Text visible in a photo is treated as product data; the prompts say never to follow it, and nothing from a reply is executed or saved without the user's review.
- **No AI:** portions, calories, macros, allergy checks, label comparisons, explanations and the check-in are deterministic (`lib/nutrition/*`), so the same inputs give the same answer and can be tested.

## Nutrition numbers

- Reference values come from USDA FoodData Central (SR Legacy), retrieved 2026-11-01 and stored with their FDC IDs, descriptions, units and portion weights. Sources, calculation methods, the full table, allergen basis and limits are in [`NUTRITION_REFERENCE.md`](NUTRITION_REFERENCE.md). (Before 2026-11-01 these values were written from memory and were not sourced; that table and what changed are listed there too.)
- Values are per 100 g of the food in the state FDC describes; each ingredient says how to weigh it (e.g. "cooked weight"). Raw and cooked weights are never converted.
- Everything stays labelled **Estimate**: a sourced reference still isn't your brand, cut, cooking or portion. Values entered from a label show **From your label**; a meal mixing both is **Partly estimated**. Today's summary says when it is using a Cronometer import.
- Net carbs = total carbohydrate − fiber, once. Missing fiber is not treated as zero (total carbs are used as an upper bound and flagged).
- Only exact names match a reference food. Broad names ("rice", "salmon", "nuts", "oil") ask which one; anything else is unknown and is left out until you choose a reference food or use the label. No food is silently substituted for another.
- If an amount on hand is unknown, the coach asks instead of inventing precision. Cooked-weight portions are not compared with a raw amount on hand.
- The coach never calls a product safe; unknown and packaged foods point to the package label.

## Coaching rules (enforced in code and tests)

- Suggestions are not logs. A meal is logged only after the user confirms foods and grams; the same suggestion (same day, same foods) can't be logged twice; entries can be corrected or removed.
- Over today's target: a modest, protein-forward option, "No need to cut tomorrow's food — tomorrow starts from your normal targets." No restriction, compensation, punishment exercise, moral food words or guarantees. Carbs are never framed as bad; when none are suggested, the text says it's about today's plan.
- The late-work check-in records nothing about mood, doesn't attribute hunger to sleep, and offers one concrete next step (simple meal, prepare tomorrow, update groceries, choose a stopping time).

## Reminders: what works today, and the push work that remains

**Implemented and tested:** in-app reminders. They show on Home when the app is opened after the chosen time, in the time zone saved with them (the phone's zone at save time), never during quiet hours (default 22:30–07:00, can cross midnight), and can be dismissed for the day, edited or turned off. The settings screen states that nothing is delivered while the app is closed. The browser's notification permission is **never requested** (a browser test checks this).

**Not implemented (no infrastructure or credentials exist):** delivery while the app is closed. That would need, at minimum:
1. VAPID key pair (public key in the client, private key as a server secret).
2. A permission request triggered only by an explicit "Notify me on this phone" tap, then a `PushManager` subscription sent to the server.
3. Server storage of subscriptions per device (e.g. the existing Upstash), with deletion on sign-out/revoke and in "Delete everything".
4. A scheduler (e.g. a Vercel Cron job) that evaluates each device's reminders in its time zone and quiet hours (reuse `dueReminders`), sends Web Push, and drops expired subscriptions.
5. A `push` / `notificationclick` handler in `public/sw.js`.
6. iOS limits: Web Push only works for a PWA added to the Home Screen (iOS 16.4+).
7. Tests with a real or mock push service, and a privacy-map update (the server would then hold reminder times).

This needs owner approval: it adds server-side storage of reminder settings and an always-on scheduled job.
