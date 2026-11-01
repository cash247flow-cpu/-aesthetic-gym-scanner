# Nutrition reference data

The nutrition coach plans portions and estimates calories and macros from a small set of reference foods. This page records where every number comes from, how it's used, and what it can't tell you.

## Source

- **Database:** USDA FoodData Central (FDC), **SR Legacy** dataset (publication date 2019-04-01). SR Legacy is a stable, generic (non-branded) reference dataset.
- **Retrieved:** 2026-11-01, from the FDC API (`https://api.nal.usda.gov/fdc/v1/foods?fdcIds=…&format=full`) using the public `DEMO_KEY`. This development container's network policy blocks USDA hosts, so the API responses were fetched through a web-retrieval tool and parsed by script — values were not copied by hand.
- **Stored as:** `lib/nutrition/data/fdc-snapshot.json` — for each record: FDC ID, description, data type, publication date, NDB number, the five nutrients with unit and FDC derivation code, and FDC portion weights.
- **Used by:** `lib/nutrition/foods.ts`, which names an FDC ID per reference food and reads its values from the snapshot. No nutrient value is typed into the code.
- **Checked by:** `tests/nutrition-reference.test.ts` — every value equals the snapshot; spot checks against the raw API responses; one record per food; units; FDC portion weights; preparation state.

To re-check any value, open the FDC link in the table (each ID links to `https://fdc.nal.usda.gov/food-details/<id>/nutrients`) or query `https://api.nal.usda.gov/fdc/v1/food/<id>?api_key=<key>`.

## Basis and calculations

- **Per 100 g** of the food **in the state FDC describes** (the "Weigh" column says how to weigh it). Cooked meat values are per cooked gram; raw vegetables per raw gram; oats per dry gram; canned fish per drained gram.
- **Raw vs. cooked weight is never converted.** No yield factor is assumed. When a reference is cooked weight, suggestions say so and don't compare it with the (usually raw) amount you listed.
- **Nutrients used:** Energy (208, kcal), Protein (203, g), Carbohydrate by difference (205, g — TOTAL carbohydrate, includes fiber), Fiber, total dietary (291, g), Total lipid/fat (204, g).
- **Net carbs** (what the app's targets use) = total carbohydrate − total dietary fiber, computed **once**, in `netCarbs()` for references and labels. Logged entries store net carbs and are never reduced again.
- **Missing ≠ zero.** If the source reports no fiber value (here: cooked shrimp), fiber stays `null`, net carbs fall back to total carbohydrate as an **upper bound**, and the basis is recorded (`fiber-not-reported-total-used`) and shown. A reported 0 (including FDC's "assumed zero" code for meats) is a real zero.
- **Totals:** sums of per-food values scaled to grams (1 decimal; kcal to the nearest 1). If any food in a total has unknown fiber, the fiber total is unknown.
- **Label values** you enter are TOTAL carbs as printed (plus fiber if shown); net carbs are derived once. Missing fiber on a label is treated the same way (upper bound, flagged).
- **Still estimates.** Sourced reference values describe a reference food, not your brand, cut, cooking or portion. Everything the coach shows stays labelled **Estimate** unless it comes from your own label or Cronometer.

## Reference foods (53 records)

| Key | FDC ID | FDC description (SR Legacy) | Weigh | kcal | Protein g | Total carbs g | Fiber g | Net carbs g | Fat g | Unit (FDC portion) |
|---|---|---|---|---|---|---|---|---|---|---|
| chicken-breast | [171477](https://fdc.nal.usda.gov/food-details/171477/nutrients) | Chicken, broilers or fryers, breast, meat only, cooked, roasted | cooked weight | 165 | 31.02 | 0 | 0 | 0 | 3.57 | grams only |
| chicken-thigh | [172388](https://fdc.nal.usda.gov/food-details/172388/nutrients) | Chicken, broilers or fryers, thigh, meat only, cooked, roasted | cooked weight | 179 | 24.76 | 0 | 0 | 0 | 8.15 | grams only |
| turkey-breast | [171496](https://fdc.nal.usda.gov/food-details/171496/nutrients) | Turkey, whole, breast, meat only, cooked, roasted | cooked weight | 147 | 30.13 | 0 | 0 | 0 | 2.08 | grams only |
| ground-beef-90 | [171794](https://fdc.nal.usda.gov/food-details/171794/nutrients) | Beef, ground, 90% lean meat / 10% fat, crumbles, cooked, pan-browned | cooked weight | 230 | 28.45 | 0 | 0 | 0 | 12.04 | grams only |
| egg | [171287](https://fdc.nal.usda.gov/food-details/171287/nutrients) | Egg, whole, raw, fresh | raw weight without shell | 143 | 12.56 | 0.72 | 0 | 0.72 | 9.51 | large egg = 50 g (“1 large”) |
| egg-white | [172183](https://fdc.nal.usda.gov/food-details/172183/nutrients) | Egg, white, raw, fresh | raw weight | 52 | 10.9 | 0.73 | 0 | 0.73 | 0.17 | large egg white = 33 g (“1 large”) |
| salmon-farmed | [175168](https://fdc.nal.usda.gov/food-details/175168/nutrients) | Fish, salmon, Atlantic, farmed, cooked, dry heat | cooked weight | 206 | 22.1 | 0 | 0 | 0 | 12.35 | grams only |
| salmon-wild | [171998](https://fdc.nal.usda.gov/food-details/171998/nutrients) | Fish, salmon, Atlantic, wild, cooked, dry heat | cooked weight | 182 | 25.44 | 0 | 0 | 0 | 8.13 | grams only |
| tilapia | [175177](https://fdc.nal.usda.gov/food-details/175177/nutrients) | Fish, tilapia, cooked, dry heat | cooked weight | 128 | 26.15 | 0 | 0 | 0 | 2.65 | grams only |
| cod-atlantic | [171956](https://fdc.nal.usda.gov/food-details/171956/nutrients) | Fish, cod, Atlantic, cooked, dry heat | cooked weight | 105 | 22.83 | 0 | 0 | 0 | 0.86 | grams only |
| tuna-light-canned-water | [171986](https://fdc.nal.usda.gov/food-details/171986/nutrients) | Fish, tuna, light, canned in water, without salt, drained solids | drained weight | 116 | 25.51 | 0 | 0 | 0 | 0.82 | can (drained) = 165 g (“1 can”) |
| sardines-oil | [175139](https://fdc.nal.usda.gov/food-details/175139/nutrients) | Fish, sardine, Atlantic, canned in oil, drained solids with bone | drained weight | 208 | 24.62 | 0 | 0 | 0 | 11.45 | 3.75 oz can (drained) = 92 g (“1 can (3.75 oz)”) |
| shrimp | [175180](https://fdc.nal.usda.gov/food-details/175180/nutrients) | Crustaceans, shrimp, cooked | cooked weight | 99 | 23.98 | 0.2 | not reported | 0.2 (upper bound) | 0.28 | grams only |
| greek-yogurt-lowfat | [170903](https://fdc.nal.usda.gov/food-details/170903/nutrients) | Yogurt, Greek, plain, lowfat | as eaten | 73 | 9.95 | 3.94 | 0 | 3.94 | 1.92 | grams only |
| cottage-cheese-1 | [173417](https://fdc.nal.usda.gov/food-details/173417/nutrients) | Cheese, cottage, lowfat, 1% milkfat | as eaten | 72 | 12.39 | 2.72 | 0 | 2.72 | 1.02 | grams only |
| tofu-firm | [172475](https://fdc.nal.usda.gov/food-details/172475/nutrients) | Tofu, raw, firm, prepared with calcium sulfate | as sold, drained | 144 | 17.27 | 2.78 | 2.3 | 0.48 | 8.72 | grams only |
| rice-white | [168878](https://fdc.nal.usda.gov/food-details/168878/nutrients) | Rice, white, long-grain, regular, enriched, cooked | cooked weight | 130 | 2.69 | 28.17 | 0.4 | 27.77 | 0.28 | grams only |
| rice-brown | [169704](https://fdc.nal.usda.gov/food-details/169704/nutrients) | Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program) | cooked weight | 123 | 2.74 | 25.58 | 1.6 | 23.98 | 0.97 | grams only |
| potato-baked | [170093](https://fdc.nal.usda.gov/food-details/170093/nutrients) | Potatoes, baked, flesh and skin, without salt | cooked weight, with skin | 93 | 2.5 | 21.15 | 2.2 | 18.95 | 0.13 | medium potato = 173 g (“1 potato medium”) |
| sweet-potato-baked | [168483](https://fdc.nal.usda.gov/food-details/168483/nutrients) | Sweet potato, cooked, baked in skin, flesh, without salt | cooked weight, flesh only | 90 | 2.01 | 20.71 | 3.3 | 17.41 | 0.15 | grams only |
| oats-dry | [173904](https://fdc.nal.usda.gov/food-details/173904/nutrients) | Cereals, oats, regular and quick, not fortified, dry | dry weight | 379 | 13.15 | 67.7 | 10.1 | 57.6 | 6.52 | grams only |
| bread-whole-wheat | [172688](https://fdc.nal.usda.gov/food-details/172688/nutrients) | Bread, whole-wheat, commercially prepared | as eaten | 252 | 12.45 | 42.71 | 6 | 36.71 | 3.5 | slice = 32 g (“1 slice”) |
| bread-white | [174924](https://fdc.nal.usda.gov/food-details/174924/nutrients) | Bread, white, commercially prepared (includes soft bread crumbs) | as eaten | 266 | 8.85 | 49.42 | 2.7 | 46.72 | 3.33 | grams only |
| tortilla-flour | [175037](https://fdc.nal.usda.gov/food-details/175037/nutrients) | Tortillas, ready-to-bake or -fry, flour, refrigerated | as sold | 306 | 8.2 | 49.38 | 3.5 | 45.88 | 7.99 | grams only |
| pasta-enriched | [169737](https://fdc.nal.usda.gov/food-details/169737/nutrients) | Pasta, cooked, enriched, without added salt | cooked weight | 158 | 5.8 | 30.86 | 1.8 | 29.06 | 0.93 | grams only |
| lentils | [172421](https://fdc.nal.usda.gov/food-details/172421/nutrients) | Lentils, mature seeds, cooked, boiled, without salt | cooked weight | 116 | 9.02 | 20.13 | 7.9 | 12.23 | 0.38 | grams only |
| black-beans | [173735](https://fdc.nal.usda.gov/food-details/173735/nutrients) | Beans, black, mature seeds, cooked, boiled, without salt | cooked weight | 132 | 8.86 | 23.71 | 8.7 | 15.01 | 0.54 | grams only |
| chickpeas | [173757](https://fdc.nal.usda.gov/food-details/173757/nutrients) | Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt | cooked weight | 164 | 8.86 | 27.42 | 7.6 | 19.82 | 2.59 | grams only |
| banana | [173944](https://fdc.nal.usda.gov/food-details/173944/nutrients) | Bananas, raw | peeled weight | 89 | 1.09 | 22.84 | 2.6 | 20.24 | 0.33 | medium banana = 118 g (“1 medium (7" to 7-7/8" long)”) |
| strawberries | [167762](https://fdc.nal.usda.gov/food-details/167762/nutrients) | Strawberries, raw | as eaten | 32 | 0.67 | 7.68 | 2 | 5.68 | 0.3 | grams only |
| blueberries | [171711](https://fdc.nal.usda.gov/food-details/171711/nutrients) | Blueberries, raw | as eaten | 57 | 0.74 | 14.49 | 2.4 | 12.09 | 0.33 | grams only |
| blackberries | [173946](https://fdc.nal.usda.gov/food-details/173946/nutrients) | Blackberries, raw | as eaten | 43 | 1.39 | 9.61 | 5.3 | 4.31 | 0.49 | grams only |
| apple | [171688](https://fdc.nal.usda.gov/food-details/171688/nutrients) | Apples, raw, with skin (Includes foods for USDA's Food Distribution Program) | as eaten (no core) | 52 | 0.26 | 13.81 | 2.4 | 11.41 | 0.17 | medium apple = 182 g (“1 medium (3" dia)”) |
| spinach | [168462](https://fdc.nal.usda.gov/food-details/168462/nutrients) | Spinach, raw | raw weight | 23 | 2.86 | 3.63 | 2.2 | 1.43 | 0.39 | grams only |
| lettuce-green-leaf | [169249](https://fdc.nal.usda.gov/food-details/169249/nutrients) | Lettuce, green leaf, raw | raw weight | 15 | 1.36 | 2.87 | 1.3 | 1.57 | 0.15 | grams only |
| lettuce-romaine | [169247](https://fdc.nal.usda.gov/food-details/169247/nutrients) | Lettuce, cos or romaine, raw | raw weight | 17 | 1.23 | 3.29 | 2.1 | 1.19 | 0.3 | grams only |
| broccoli | [170379](https://fdc.nal.usda.gov/food-details/170379/nutrients) | Broccoli, raw | raw weight | 34 | 2.82 | 6.64 | 2.6 | 4.04 | 0.37 | grams only |
| pepper-red | [170108](https://fdc.nal.usda.gov/food-details/170108/nutrients) | Peppers, sweet, red, raw | raw weight | 26 | 0.99 | 6.03 | 2.1 | 3.93 | 0.3 | medium pepper = 119 g (“1 medium (approx 2-3/4" long, 2-1/2 dia.)”) |
| pepper-green | [170427](https://fdc.nal.usda.gov/food-details/170427/nutrients) | Peppers, sweet, green, raw | raw weight | 20 | 0.86 | 4.64 | 1.7 | 2.94 | 0.17 | medium pepper = 119 g (“1 medium (approx 2-3/4" long, 2-1/2" dia)”) |
| cucumber | [168409](https://fdc.nal.usda.gov/food-details/168409/nutrients) | Cucumber, with peel, raw | raw weight | 15 | 0.65 | 3.63 | 0.5 | 3.13 | 0.11 | grams only |
| tomato | [170457](https://fdc.nal.usda.gov/food-details/170457/nutrients) | Tomatoes, red, ripe, raw, year round average | raw weight | 18 | 0.88 | 3.89 | 1.2 | 2.69 | 0.2 | medium tomato = 123 g (“1 medium whole (2-3/5" dia)”) |
| cauliflower | [169986](https://fdc.nal.usda.gov/food-details/169986/nutrients) | Cauliflower, raw | raw weight | 25 | 1.92 | 4.97 | 2 | 2.97 | 0.28 | grams only |
| mushrooms-white | [169251](https://fdc.nal.usda.gov/food-details/169251/nutrients) | Mushrooms, white, raw | raw weight | 22 | 3.09 | 3.26 | 1 | 2.26 | 0.34 | grams only |
| zucchini | [169291](https://fdc.nal.usda.gov/food-details/169291/nutrients) | Squash, summer, zucchini, includes skin, raw | raw weight | 17 | 1.21 | 3.11 | 1 | 2.11 | 0.32 | grams only |
| carrots | [170393](https://fdc.nal.usda.gov/food-details/170393/nutrients) | Carrots, raw | raw weight | 41 | 0.93 | 9.58 | 2.8 | 6.78 | 0.24 | grams only |
| onion | [170000](https://fdc.nal.usda.gov/food-details/170000/nutrients) | Onions, raw | raw weight | 40 | 1.1 | 9.34 | 1.7 | 7.64 | 0.1 | medium onion = 110 g (“1 medium (2-1/2" dia)”) |
| avocado | [171705](https://fdc.nal.usda.gov/food-details/171705/nutrients) | Avocados, raw, all commercial varieties | flesh only | 160 | 2 | 8.53 | 6.7 | 1.83 | 14.66 | grams only |
| olive-oil | [171413](https://fdc.nal.usda.gov/food-details/171413/nutrients) | Oil, olive, salad or cooking | as used | 884 | 0 | 0 | 0 | 0 | 100 | grams only |
| peanut-butter | [172470](https://fdc.nal.usda.gov/food-details/172470/nutrients) | Peanut butter, smooth style, without salt | as eaten | 598 | 22.21 | 22.31 | 5 | 17.31 | 51.36 | grams only |
| almonds | [170567](https://fdc.nal.usda.gov/food-details/170567/nutrients) | Nuts, almonds | as eaten | 579 | 21.15 | 21.55 | 12.5 | 9.05 | 49.93 | grams only |
| cheddar | [173414](https://fdc.nal.usda.gov/food-details/173414/nutrients) | Cheese, cheddar (Includes foods for USDA's Food Distribution Program) | as eaten | 403 | 22.87 | 3.37 | 0 | 3.37 | 33.31 | grams only |
| milk-2 | [171267](https://fdc.nal.usda.gov/food-details/171267/nutrients) | Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D | as drunk | 50 | 3.3 | 4.8 | 0 | 4.8 | 1.98 | grams only |
| milk-whole | [171265](https://fdc.nal.usda.gov/food-details/171265/nutrients) | Milk, whole, 3.25% milkfat, with added vitamin D | as drunk | 61 | 3.15 | 4.8 | 0 | 4.8 | 3.25 | grams only |

## Words that ask instead of guessing

These names are too broad to pick one reference food. The coach asks which one (or for label values) and leaves the item out of suggestions until you choose. A preparation word the reference doesn't state ("raw shrimp", "frozen blueberries", "canned black beans") also asks for confirmation. Any other name that isn't an exact alias is **unknown** — no values are assumed and no other food is substituted.

| Word | Offered | Question |
|---|---|---|
| chicken | chicken-breast, chicken-thigh | Which cut of chicken? |
| turkey | turkey-breast | Is it turkey breast meat? Other cuts aren't in the reference list. |
| ground beef | ground-beef-90 | Is it 90% lean? Other lean percentages differ — use the label if not. |
| beef | ground-beef-90 | Is it 90% lean ground beef? Other beef isn't in the reference list. |
| mince | ground-beef-90 | Is it 90% lean ground beef? |
| salmon | salmon-farmed, salmon-wild | Farmed or wild Atlantic salmon? They differ in fat and calories; Pacific species aren't in the list. |
| farmed salmon | salmon-farmed | Is it farmed Atlantic salmon? |
| wild salmon | salmon-wild | Is it wild Atlantic salmon? Pacific species (sockeye, coho, pink) differ. |
| fish | tilapia, cod-atlantic, salmon-farmed, salmon-wild | Which fish? |
| white fish | tilapia, cod-atlantic | Which white fish? |
| cod | cod-atlantic | Is it Atlantic cod? Pacific cod differs. |
| tuna | tuna-light-canned-water | Is it light tuna canned in water? Fresh tuna, tuna in oil and white (albacore) tuna differ. |
| canned tuna | tuna-light-canned-water | Light tuna canned in water? Tuna in oil and white (albacore) tuna differ. |
| tuna in water | tuna-light-canned-water | Light (not white/albacore) tuna? |
| sardines | sardines-oil | Canned in oil (drained)? Sardines in water or sauce differ. |
| canned sardines | sardines-oil | Canned in oil (drained)? Sardines in water or sauce differ. |
| yogurt | greek-yogurt-lowfat | Is it plain lowfat Greek yogurt? Otherwise use the label values. |
| greek yogurt | greek-yogurt-lowfat | Is it plain lowfat Greek yogurt? Nonfat and whole-milk versions differ — use the label if so. |
| cottage cheese | cottage-cheese-1 | Is it 1% lowfat cottage cheese? Other fat levels differ. |
| tofu | tofu-firm | Is it firm tofu? Silken and extra-firm differ. |
| rice | rice-white, rice-brown | White or brown rice? |
| bread | bread-whole-wheat, bread-white | Which bread? |
| toast | bread-whole-wheat, bread-white | Which bread? |
| tortilla | tortilla-flour | Is it a flour tortilla? Corn and whole-wheat tortillas differ. |
| tortillas | tortilla-flour | Are they flour tortillas? Corn and whole-wheat tortillas differ. |
| wrap | tortilla-flour | Is it a flour tortilla? Other wraps differ — use the label. |
| wraps | tortilla-flour | Are they flour tortillas? Other wraps differ — use the label. |
| beans | black-beans, chickpeas | Which beans? |
| lettuce | lettuce-green-leaf, lettuce-romaine | Which lettuce? |
| salad | lettuce-green-leaf, lettuce-romaine, spinach | What's in the salad? |
| greens | lettuce-green-leaf, lettuce-romaine, spinach | Which greens? |
| mixed greens | lettuce-green-leaf, lettuce-romaine, spinach | Which greens? Mixes vary. |
| salad greens | lettuce-green-leaf, lettuce-romaine, spinach | Which greens? Mixes vary. |
| pepper | pepper-red, pepper-green | Red or green bell pepper? |
| peppers | pepper-red, pepper-green | Red or green bell peppers? |
| bell pepper | pepper-red, pepper-green | Red or green? |
| bell peppers | pepper-red, pepper-green | Red or green? |
| mushrooms | mushrooms-white | White (button) mushrooms? Other varieties differ. |
| mushroom | mushrooms-white | White (button) mushrooms? Other varieties differ. |
| berries | strawberries, blueberries, blackberries | Which berries? |
| milk | milk-2, milk-whole | Which milk? |
| cheese | cheddar | Is it cheddar? Other cheeses differ — use the label. |
| nuts | almonds | Which nuts? Only almonds are in the reference list — use the label for others. |
| mixed nuts | none — label only | Mixed nuts vary by blend — use the label values. |
| oil | olive-oil | Is it olive oil? Use the label for other oils. |
| cooking oil | olive-oil | Is it olive oil? Use the label for other oils. |
| oatmeal | oats-dry | Weighed dry? The values are for dry oats — cooked oatmeal weighs much more. |
| porridge | oats-dry | Weighed dry? The values are for dry oats. |

## Allergens

- **Reference:** FDA, *Food Allergies* (https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies, retrieved 2026-11-01). The nine US major food allergens are milk, eggs, fish, Crustacean shellfish, tree nuts, peanuts, wheat, soybeans and sesame (FALCPA 2004; sesame added by the FASTER Act, effective 2023-01-01). The app's user-facing categories map to these; "wheat/gluten" also covers other gluten grains (gluten itself isn't a major allergen), and "shellfish" hints include mollusks, which the labelling law doesn't cover.
- **What the app knows:** allergens inherent to each reference food (e.g. peanut butter → peanuts). Oats carry a cross-contact caution and are left out for a wheat/gluten allergy.
- **What it doesn't:** brand formulations, cross-contact, "may contain" practices (voluntary), and anything in foods FALCPA doesn't cover (raw produce, highly refined oils, USDA-regulated meat/poultry/egg products, most unpackaged food). FDA has set no allergen thresholds.
- **Keyword hints** for other names (e.g. "wrap" → wheat) only *suggest* an allergen. They can't show a product is free of one. Unknown and packaged items are always marked "check the package label"; the app never calls a product safe.

## Limits of ingredient and photo recognition

- A fridge/pantry photo can show what's visible, not what's inside containers, the exact product, its fat level, preparation, freshness, quantity or allergens. Names from a photo are drafts that you correct and confirm; a vague name ("yogurt", "rice") then asks which reference food it is.
- A label photo is read by an AI service and can be misread; the app checks that calories roughly match protein, carbs and fat, shows the numbers for you to check, and only flags allergens named in the statement it read.
- Text in photos is treated as product data, never as instructions.

## Effect on existing records

- **Meals logged before 2026-11-01 keep their stored values.** Nothing is recomputed or rewritten. They're marked "earlier reference values" in today's log. Correcting such an entry rescales its own stored values, not the new references.
- **New entries** record the FDC ID, weighing basis, net-carb basis and reference version (`fdc-sr-legacy@2026-11-01`) for each food.
- **Food on hand** is unchanged, but some names that used to resolve silently ("rice", "salmon", "bread", "greek yogurt", "nuts", "oil", "cod", "sardines", "lettuce") now ask which food they are — choose in the Fridge list. Your choice is saved with the item.

## Changes from the previous hand-written table

Old values per 100 g shown as kcal / protein / net carbs / fat.

| Old key | Old name | Old aliases | Old values | Now | New values |
|---|---|---|---|---|---|
| chicken | chicken breast (cooked) | chicken breast, chicken | 165/31/0/3.6 | chicken-breast | 165/31.02/0/3.57 |
| turkey | turkey breast (cooked) | turkey | 135/30/0/1 | turkey-breast | 147/30.13/0/2.08 |
| beef | lean ground beef 90% (cooked) | ground beef, beef, mince | 217/26/0/12 | ground-beef-90 | 230/28.45/0/12.04 |
| eggs | whole eggs | eggs, egg | 143/12.6/0.7/9.5 | egg | 143/12.56/0.72/9.51 |
| egg whites | liquid egg whites | egg whites, egg white | 52/11/0.7/0.2 | egg-white | 52/10.9/0.73/0.17 |
| salmon | salmon (cooked) | salmon | 200/22/0/12 | removed (now asks) | — |
| tilapia | tilapia (cooked) | tilapia, white fish, cod | 128/26/0/2.7 | tilapia | 128/26.15/0/2.65 |
| tuna | canned tuna in water (drained) | tuna | 116/26/0/0.8 | tuna-light-canned-water | 116/25.51/0/0.82 |
| sardines | canned sardines (drained) | sardines, sardine | 208/25/0/11.5 | sardines-oil | 208/24.62/0/11.45 |
| shrimp | shrimp (cooked) | shrimp, prawns, prawn | 99/24/0.2/0.3 | shrimp | 99/23.98/0.2/0.28 |
| greek yogurt | nonfat plain Greek yogurt | greek yogurt, yogurt, yoghurt, skyr | 59/10/3.6/0.4 | greek-yogurt-lowfat | 73/9.95/3.94/1.92 |
| cottage cheese | 2% cottage cheese | cottage cheese | 84/11/4.3/2.3 | cottage-cheese-1 | 72/12.39/2.72/1.02 |
| tofu | firm tofu | tofu | 144/17.3/0.5/8.7 | tofu-firm | 144/17.27/0.48/8.72 |
| rice | white rice (cooked) | white rice, rice | 130/2.7/27.8/0.3 | rice-white | 130/2.69/27.77/0.28 |
| brown rice | brown rice (cooked) | brown rice | 123/2.7/24/1 | rice-brown | 123/2.74/23.98/0.97 |
| potato | potato (boiled) | potato, potatoes | 87/1.9/18.3/0.1 | potato-baked | 93/2.5/18.95/0.13 |
| sweet potato | sweet potato (baked) | sweet potato, sweet potatoes, yam | 90/2/17.4/0.2 | sweet-potato-baked | 90/2.01/17.41/0.15 |
| oats | rolled oats (dry) | oats, oatmeal, porridge | 379/13/58/6.5 | oats-dry | 379/13.15/57.6/6.52 |
| bread | whole-wheat bread | bread, toast, wrap, tortilla | 252/12.5/37/3.5 | bread-whole-wheat | 252/12.45/36.71/3.5 |
| pasta | pasta (cooked) | pasta, spaghetti, noodles | 158/5.8/29/0.9 | pasta-enriched | 158/5.8/29.06/0.93 |
| lentils | lentils (cooked) | lentils, lentil | 116/9/12.1/0.4 | lentils | 116/9.02/12.23/0.38 |
| black beans | black beans (cooked) | black beans, beans, chickpeas | 132/8.9/15/0.5 | black-beans | 132/8.86/15.01/0.54 |
| banana | banana | banana, bananas | 89/1.1/20.2/0.3 | banana | 89/1.09/20.24/0.33 |
| strawberries | strawberries | strawberries, strawberry | 32/0.7/5.7/0.3 | strawberries | 32/0.67/5.68/0.3 |
| blueberries | blueberries | blueberries, blueberry | 57/0.7/12.1/0.3 | blueberries | 57/0.74/12.09/0.33 |
| blackberries | blackberries | blackberries, blackberry | 43/1.4/4.3/0.5 | blackberries | 43/1.39/4.31/0.49 |
| apple | apple | apple, apples | 52/0.3/11.4/0.2 | apple | 52/0.26/11.41/0.17 |
| spinach | spinach (raw) | spinach | 23/2.9/1.4/0.4 | spinach | 23/2.86/1.43/0.39 |
| salad greens | salad greens | salad, lettuce, greens, mixed greens, arugula | 17/1.5/1/0.2 | removed (now asks) | — |
| broccoli | broccoli | broccoli | 34/2.8/4/0.4 | broccoli | 34/2.82/4.04/0.37 |
| bell pepper | bell pepper | bell pepper, peppers, pepper, capsicum | 26/1/3.9/0.3 | pepper-red | 26/0.99/3.93/0.3 |
| cucumber | cucumber | cucumber | 15/0.7/3.1/0.1 | cucumber | 15/0.65/3.13/0.11 |
| tomato | tomato | tomato, tomatoes | 18/0.9/2.7/0.2 | tomato | 18/0.88/2.69/0.2 |
| cauliflower rice | cauliflower / cauliflower rice | cauliflower | 25/1.9/3/0.3 | cauliflower | 25/1.92/2.97/0.28 |
| mushrooms | mushrooms | mushrooms, mushroom | 22/3.1/2.3/0.3 | mushrooms-white | 22/3.09/2.26/0.34 |
| zucchini | zucchini | zucchini, courgette | 17/1.2/2.1/0.3 | zucchini | 17/1.21/2.11/0.32 |
| carrots | carrots | carrots, carrot | 41/0.9/6.8/0.2 | carrots | 41/0.93/6.78/0.24 |
| onion | onion | onion, onions | 40/1.1/7.6/0.1 | onion | 40/1.1/7.64/0.1 |
| avocado | avocado | avocado, avocados, guacamole | 160/2/1.8/14.7 | avocado | 160/2/1.83/14.66 |
| olive oil | olive oil | olive oil, oil | 884/0/0/100 | olive-oil | 884/0/0/100 |
| peanut butter | peanut butter | peanut butter | 588/25/14/50 | peanut-butter | 598/22.21/17.31/51.36 |
| almonds | almonds | almonds, almond, nuts | 579/21/9.1/49.9 | almonds | 579/21.15/9.05/49.93 |
| cheese | cheddar cheese | cheese, cheddar | 403/25/1.3/33 | cheddar | 403/22.87/3.37/33.31 |
| milk | 2% milk | milk | 50/3.3/4.8/2 | milk-2 | 50/3.3/4.8/1.98 |
