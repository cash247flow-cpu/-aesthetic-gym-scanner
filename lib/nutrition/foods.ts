// Reference foods for the nutrition coach.
//
// SOURCE. Every nutrient value and unit weight comes from `data/fdc-snapshot.json`: full records
// retrieved on 2026-11-01 from the USDA FoodData Central API (https://api.nal.usda.gov/fdc/v1/foods,
// format=full), all from the SR Legacy dataset (publication date 2019-04-01). No value is typed in by
// hand: each entry below names an FDC ID and the numbers are read from the snapshot, so the code
// and the retrieved source can't drift apart (tests/nutrition-reference.test.ts checks this).
//
// BASIS. Values are per 100 g of the food in the exact state FDC describes — chicken breast "meat
// only, cooked, roasted" is per 100 g of cooked meat; oats are per 100 g dry; sardines per 100 g of
// drained solids. `weighed` tells the user how to weigh the food for the numbers to apply. Unit
// weights ("1 large egg = 50 g") are FDC portion weights from the same records.
//
// CARBOHYDRATES. FDC reports TOTAL carbohydrate ("by difference", which includes fiber) and total
// dietary fiber separately. The app's targets are NET carbs, computed here exactly once:
//   net carbs = total carbohydrate − total dietary fiber.
// If the source reports no fiber value (missing, not zero), fiber is NOT assumed to be zero: total
// carbohydrate is used as an upper bound and the basis is recorded as such.
//
// STILL ESTIMATES. With a sourced reference, what someone eats is still an estimate: brands, cuts,
// cooking and portions differ from the reference food, and a photo can't establish any of them.
//
// ALLERGENS. `allergens` lists major US food allergens inherent to the food itself. FDA's major food
// allergens are milk, eggs, fish, Crustacean shellfish, tree nuts, peanuts, wheat, soybeans and
// sesame (FALCPA 2004; sesame added by the FASTER Act, effective 2023-01-01). This is not a safety
// guarantee: packaged products vary by brand and may involve cross-contact; only the product's own
// label (and the manufacturer) can answer that.

import snapshot from "./data/fdc-snapshot.json";

/** Allergen categories users can pick. Stored values are unchanged for backward compatibility. */
export type Allergen = "milk" | "egg" | "fish" | "shellfish" | "tree nuts" | "peanuts" | "wheat/gluten" | "soy" | "sesame";
export const ALLERGENS: Allergen[] = ["milk", "egg", "fish", "shellfish", "tree nuts", "peanuts", "wheat/gluten", "soy", "sesame"];
/** What each category covers, in FDA's terms. */
export const ALLERGEN_NOTE: Record<Allergen, string> = {
  milk: "milk",
  egg: "eggs",
  fish: "fish",
  shellfish: "shellfish — FDA's major allergen is Crustacean shellfish (shrimp, crab, lobster); mollusks aren't covered by that labeling law",
  "tree nuts": "tree nuts",
  peanuts: "peanuts",
  "wheat/gluten": "wheat (an FDA major allergen) plus other gluten-containing grains (gluten isn't on FDA's major-allergen list)",
  soy: "soybeans",
  sesame: "sesame",
};

export type Role = "protein" | "carb" | "veg" | "fruit" | "fat";

/** Source values per 100 g. `null` means the source reported no value — never treated as zero. */
export type Nutrients = { kcal: number | null; protein: number | null; carbs: number | null; fiber: number | null; fat: number | null };

/** What the app plans and logs with. `carbs` here are NET carbs; `fiber` stays null if unreported. */
export type Per100 = { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null };
export type NetCarbsBasis = "carbs-minus-fiber" | "fiber-not-reported-total-used";

export type FdcSource = {
  fdcId: number;
  description: string;
  dataType: string;
  publicationDate: string | null;
  ndbNumber: string;
  url: string;
  retrieved: string;
};

export type RefFood = {
  key: string;
  name: string; // user-facing name, including the state the values are for
  weighed: string; // how to weigh it for the values to apply, e.g. "cooked weight"
  aliases: string[]; // exact phrases (after tidying) that identify THIS food — never broad words
  role: Role;
  allergens: Allergen[]; // inherent to the food (see header)
  caution?: string; // e.g. cross-contact risk worth checking on the package
  packaged: boolean; // formulation and allergens vary by brand
  prepMin: number;
  unit?: { name: string; grams: number; fdcPortion: string; max?: number };
  how: string;
  subs?: string[];
  budget?: string;
  source: FdcSource;
  nutrients: Nutrients; // exactly as in the snapshot
  per100: Per100; // derived once (net carbs), see netCarbs()
  netCarbsBasis: NetCarbsBasis;
};

type SnapFood = (typeof snapshot)["foods"][number];
const SNAP = new Map<number, SnapFood>(snapshot.foods.map((f) => [f.fdcId, f]));
export const SNAPSHOT_RETRIEVED = snapshot.retrieved;
export const SNAPSHOT_FOODS = snapshot.foods;

const val = (v: { value: number } | null | undefined) => (v && typeof v.value === "number" ? v.value : null);

/** Net carbs from TOTAL carbohydrate and fiber. Missing fiber is not assumed to be zero. */
export function netCarbs(n: Pick<Nutrients, "carbs" | "fiber">): { value: number | null; basis: NetCarbsBasis | null } {
  if (n.carbs === null) return { value: null, basis: null };
  if (n.fiber === null) return { value: n.carbs, basis: "fiber-not-reported-total-used" };
  return { value: Math.max(0, Math.round((n.carbs - n.fiber) * 100) / 100), basis: "carbs-minus-fiber" };
}

type Def = Omit<RefFood, "source" | "nutrients" | "per100" | "netCarbsBasis" | "unit"> & {
  fdcId: number;
  unit?: { name: string; fdcPortion: string; max?: number };
};

// Unit weights come from the FDC record's portion list, matched by its exact portion label.
const DEFS: Def[] = [
  // ── Protein ──
  { key: "chicken-breast", fdcId: 171477, name: "chicken breast, meat only (roasted)", weighed: "cooked weight", aliases: ["chicken breast", "chicken breasts", "cooked chicken breast", "roasted chicken breast", "boneless skinless chicken breast"], role: "protein", allergens: [], packaged: false, prepMin: 20, how: "Cook the chicken until 74 °C / 165 °F inside, then weigh the cooked meat.", subs: ["chicken-thigh", "turkey-breast"], budget: "Family packs usually cost less per gram." },
  { key: "chicken-thigh", fdcId: 172388, name: "chicken thigh, meat only (roasted)", weighed: "cooked weight", aliases: ["chicken thigh", "chicken thighs", "boneless chicken thighs", "boneless skinless chicken thighs"], role: "protein", allergens: [], packaged: false, prepMin: 25, how: "Cook the thigh until 74 °C / 165 °F inside, then weigh the cooked meat.", subs: ["chicken-breast"] },
  { key: "turkey-breast", fdcId: 171496, name: "turkey breast, meat only (roasted)", weighed: "cooked weight", aliases: ["turkey breast", "roasted turkey breast"], role: "protein", allergens: [], packaged: false, prepMin: 20, how: "Cook the turkey until 74 °C / 165 °F inside, then weigh the cooked meat.", subs: ["chicken-breast"] },
  { key: "ground-beef-90", fdcId: 171794, name: "ground beef 90% lean (pan-browned crumbles)", weighed: "cooked weight", aliases: ["90% lean ground beef", "90 lean ground beef", "ground beef 90%", "90/10 ground beef", "90% ground beef"], role: "protein", allergens: [], packaged: false, prepMin: 15, how: "Brown the beef until no pink remains (71 °C / 160 °F), then weigh the cooked crumbles.", subs: ["turkey-breast", "chicken-breast"] }, // gitleaks:allow — food key, not a credential
  { key: "egg", fdcId: 171287, name: "whole egg (raw, without shell)", weighed: "raw weight without shell", aliases: ["egg", "eggs", "whole egg", "whole eggs", "large egg", "large eggs"], role: "protein", allergens: ["egg"], packaged: false, prepMin: 8, unit: { name: "large egg", fdcPortion: "1 large", max: 4 }, how: "Cook the eggs until the whites and yolks are set.", subs: ["egg-white", "tofu-firm"], budget: "Eggs are usually one of the cheapest proteins." },
  { key: "egg-white", fdcId: 172183, name: "egg white (raw)", weighed: "raw weight", aliases: ["egg white", "egg whites"], role: "protein", allergens: ["egg"], packaged: false, prepMin: 5, unit: { name: "large egg white", fdcPortion: "1 large", max: 8 }, how: "Cook the egg whites, stirring, until set.", subs: ["egg"] },
  { key: "salmon-farmed", fdcId: 175168, name: "Atlantic salmon, farmed (cooked, dry heat)", weighed: "cooked weight", aliases: ["farmed atlantic salmon", "atlantic salmon farmed"], role: "protein", allergens: ["fish"], packaged: false, prepMin: 15, how: "Bake or pan-cook the salmon until it flakes (63 °C / 145 °F).", subs: ["salmon-wild", "tilapia"] },
  { key: "salmon-wild", fdcId: 171998, name: "Atlantic salmon, wild (cooked, dry heat)", weighed: "cooked weight", aliases: ["wild atlantic salmon", "atlantic salmon wild", "wild caught atlantic salmon", "wild-caught atlantic salmon"], role: "protein", allergens: ["fish"], packaged: false, prepMin: 15, how: "Bake or pan-cook the salmon until it flakes (63 °C / 145 °F).", subs: ["salmon-farmed", "tilapia"] },
  { key: "tilapia", fdcId: 175177, name: "tilapia (cooked, dry heat)", weighed: "cooked weight", aliases: ["tilapia"], role: "protein", allergens: ["fish"], packaged: false, prepMin: 12, how: "Cook the tilapia 3–4 min per side until it flakes (63 °C / 145 °F).", subs: ["cod-atlantic"] },
  { key: "cod-atlantic", fdcId: 171956, name: "Atlantic cod (cooked, dry heat)", weighed: "cooked weight", aliases: ["atlantic cod"], role: "protein", allergens: ["fish"], packaged: false, prepMin: 12, how: "Cook the cod until it flakes (63 °C / 145 °F).", subs: ["tilapia"] },
  { key: "tuna-light-canned-water", fdcId: 171986, name: "light tuna, canned in water (drained)", weighed: "drained weight", aliases: ["canned light tuna in water", "light tuna in water", "light tuna canned in water", "canned light tuna"], role: "protein", allergens: ["fish"], packaged: true, prepMin: 2, unit: { name: "can (drained)", fdcPortion: "1 can", max: 2 }, how: "Drain the tuna and flake it with a fork.", subs: ["sardines-oil"], budget: "Store-brand canned tuna is a low-cost protein." },
  { key: "sardines-oil", fdcId: 175139, name: "Atlantic sardines, canned in oil (drained, with bone)", weighed: "drained weight", aliases: ["sardines in oil", "canned sardines in oil", "sardines canned in oil"], role: "protein", allergens: ["fish"], packaged: true, prepMin: 2, unit: { name: "3.75 oz can (drained)", fdcPortion: "1 can (3.75 oz)", max: 2 }, how: "Drain the sardines.", subs: ["tuna-light-canned-water"] },
  { key: "shrimp", fdcId: 175180, name: "shrimp (cooked)", weighed: "cooked weight", aliases: ["shrimp", "cooked shrimp"], role: "protein", allergens: ["shellfish"], packaged: false, prepMin: 8, how: "Cook the shrimp 2–3 min per side until pink and opaque, then weigh them.", subs: ["tilapia"] },
  { key: "greek-yogurt-lowfat", fdcId: 170903, name: "Greek yogurt, plain, lowfat", weighed: "as eaten", aliases: ["lowfat greek yogurt", "low fat greek yogurt", "plain lowfat greek yogurt", "lowfat plain greek yogurt"], role: "protein", allergens: ["milk"], packaged: true, prepMin: 1, how: "Spoon the yogurt into a bowl.", subs: ["cottage-cheese-1"] },
  { key: "cottage-cheese-1", fdcId: 173417, name: "cottage cheese, lowfat 1% milkfat", weighed: "as eaten", aliases: ["1% cottage cheese", "lowfat cottage cheese", "low fat cottage cheese"], role: "protein", allergens: ["milk"], packaged: true, prepMin: 1, how: "Spoon the cottage cheese into a bowl.", subs: ["greek-yogurt-lowfat"] },
  { key: "tofu-firm", fdcId: 172475, name: "firm tofu (raw, calcium sulfate)", weighed: "as sold, drained", aliases: ["firm tofu"], role: "protein", allergens: ["soy"], packaged: true, prepMin: 10, how: "Press, cube and pan-fry the tofu until golden.", subs: ["egg"] },
  // ── Carbs (legumes listed here bring protein and fiber too) ──
  { key: "rice-white", fdcId: 168878, name: "white rice, long-grain, enriched (cooked)", weighed: "cooked weight", aliases: ["white rice", "cooked white rice", "long grain white rice"], role: "carb", allergens: [], packaged: false, prepMin: 20, how: "Cook the rice, then weigh the cooked rice.", subs: ["rice-brown", "potato-baked"], budget: "A large bag of dry rice costs far less per portion than pouches." },
  { key: "rice-brown", fdcId: 169704, name: "brown rice, long-grain (cooked)", weighed: "cooked weight", aliases: ["brown rice", "cooked brown rice", "long grain brown rice"], role: "carb", allergens: [], packaged: false, prepMin: 25, how: "Cook the brown rice, then weigh the cooked rice.", subs: ["rice-white"] },
  { key: "potato-baked", fdcId: 170093, name: "potato, baked (flesh and skin)", weighed: "cooked weight, with skin", aliases: ["potato", "potatoes", "baked potato", "baked potatoes"], role: "carb", allergens: [], packaged: false, prepMin: 12, unit: { name: "medium potato", fdcPortion: "1 potato medium", max: 2 }, how: "Prick the potato and bake or microwave it until soft (6–8 min in a microwave).", subs: ["sweet-potato-baked", "rice-white"], budget: "Potatoes are a low-cost carb." },
  { key: "sweet-potato-baked", fdcId: 168483, name: "sweet potato, baked in skin (flesh)", weighed: "cooked weight, flesh only", aliases: ["sweet potato", "sweet potatoes", "baked sweet potato"], role: "carb", allergens: [], packaged: false, prepMin: 12, how: "Prick the sweet potato and bake or microwave it until soft, then scoop out the flesh.", subs: ["potato-baked"] },
  { key: "oats-dry", fdcId: 173904, name: "oats, regular or quick (dry)", weighed: "dry weight", aliases: ["oats", "rolled oats", "quick oats", "old fashioned oats"], role: "carb", allergens: [], caution: "Oats are often processed alongside wheat — check the package if you avoid wheat or gluten.", packaged: true, prepMin: 5, how: "Weigh the dry oats, then cook them with water or milk for 2–3 min.", subs: ["rice-white"] },
  { key: "bread-whole-wheat", fdcId: 172688, name: "whole-wheat bread", weighed: "as eaten", aliases: ["whole wheat bread", "wholewheat bread", "wholemeal bread"], role: "carb", allergens: ["wheat/gluten"], packaged: true, prepMin: 2, unit: { name: "slice", fdcPortion: "1 slice" }, how: "Toast the bread if you like.", subs: ["bread-white"] },
  { key: "bread-white", fdcId: 174924, name: "white bread", weighed: "as eaten", aliases: ["white bread"], role: "carb", allergens: ["wheat/gluten"], packaged: true, prepMin: 2, how: "Toast the bread if you like.", subs: ["bread-whole-wheat"] },
  { key: "tortilla-flour", fdcId: 175037, name: "flour tortilla (refrigerated, ready-to-cook)", weighed: "as sold", aliases: ["flour tortilla", "flour tortillas"], role: "carb", allergens: ["wheat/gluten"], packaged: true, prepMin: 2, how: "Warm the tortilla in a dry pan.", subs: ["bread-whole-wheat"] },
  { key: "pasta-enriched", fdcId: 169737, name: "pasta, enriched (cooked, no salt added)", weighed: "cooked weight", aliases: ["pasta", "spaghetti", "penne", "cooked pasta"], role: "carb", allergens: ["wheat/gluten"], packaged: true, prepMin: 15, how: "Boil the pasta per the package, then weigh it cooked.", subs: ["rice-white"] },
  { key: "lentils", fdcId: 172421, name: "lentils (boiled, no salt)", weighed: "cooked weight", aliases: ["lentils", "cooked lentils", "boiled lentils"], role: "carb", allergens: [], packaged: false, prepMin: 3, how: "Warm the cooked lentils.", subs: ["black-beans", "chickpeas"] },
  { key: "black-beans", fdcId: 173735, name: "black beans (boiled, no salt)", weighed: "cooked weight", aliases: ["black beans", "cooked black beans"], role: "carb", allergens: [], packaged: false, prepMin: 3, how: "Warm the cooked beans.", subs: ["lentils", "chickpeas"] },
  { key: "chickpeas", fdcId: 173757, name: "chickpeas (boiled, no salt)", weighed: "cooked weight", aliases: ["chickpeas", "garbanzo beans", "garbanzos", "cooked chickpeas"], role: "carb", allergens: [], packaged: false, prepMin: 3, how: "Warm the cooked chickpeas.", subs: ["lentils", "black-beans"] },
  // ── Fruit ──
  { key: "banana", fdcId: 173944, name: "banana (raw)", weighed: "peeled weight", aliases: ["banana", "bananas"], role: "fruit", allergens: [], packaged: false, prepMin: 0, unit: { name: "medium banana", fdcPortion: "1 medium (7\" to 7-7/8\" long)", max: 2 }, how: "Peel and slice the banana.", subs: ["apple"] },
  { key: "strawberries", fdcId: 167762, name: "strawberries (raw)", weighed: "as eaten", aliases: ["strawberries", "strawberry"], role: "fruit", allergens: [], packaged: false, prepMin: 1, how: "Rinse the strawberries.", subs: ["blueberries", "blackberries"] },
  { key: "blueberries", fdcId: 171711, name: "blueberries (raw)", weighed: "as eaten", aliases: ["blueberries", "blueberry"], role: "fruit", allergens: [], packaged: false, prepMin: 1, how: "Rinse the blueberries.", subs: ["strawberries"] },
  { key: "blackberries", fdcId: 173946, name: "blackberries (raw)", weighed: "as eaten", aliases: ["blackberries", "blackberry"], role: "fruit", allergens: [], packaged: false, prepMin: 1, how: "Rinse the blackberries.", subs: ["strawberries"] },
  { key: "apple", fdcId: 171688, name: "apple, with skin (raw)", weighed: "as eaten (no core)", aliases: ["apple", "apples"], role: "fruit", allergens: [], packaged: false, prepMin: 1, unit: { name: "medium apple", fdcPortion: "1 medium (3\" dia)", max: 1 }, how: "Slice the apple.", subs: ["banana"] },
  // ── Vegetables ──
  { key: "spinach", fdcId: 168462, name: "spinach (raw)", weighed: "raw weight", aliases: ["spinach", "baby spinach"], role: "veg", allergens: [], packaged: false, prepMin: 2, how: "Rinse the spinach (or wilt it in the pan for 1 min).", subs: ["lettuce-romaine"] },
  { key: "lettuce-green-leaf", fdcId: 169249, name: "green leaf lettuce (raw)", weighed: "raw weight", aliases: ["green leaf lettuce", "leaf lettuce"], role: "veg", allergens: [], packaged: false, prepMin: 2, how: "Rinse and tear the lettuce.", subs: ["lettuce-romaine", "spinach"] },
  { key: "lettuce-romaine", fdcId: 169247, name: "romaine lettuce (raw)", weighed: "raw weight", aliases: ["romaine", "romaine lettuce", "cos lettuce"], role: "veg", allergens: [], packaged: false, prepMin: 2, how: "Rinse and chop the romaine.", subs: ["spinach"] },
  { key: "broccoli", fdcId: 170379, name: "broccoli (raw)", weighed: "raw weight", aliases: ["broccoli", "broccoli florets"], role: "veg", allergens: [], packaged: false, prepMin: 6, how: "Weigh the broccoli raw, then microwave or steam it 3–4 min.", subs: ["cauliflower", "zucchini"] },
  { key: "pepper-red", fdcId: 170108, name: "red bell pepper (raw)", weighed: "raw weight", aliases: ["red bell pepper", "red bell peppers", "red sweet pepper"], role: "veg", allergens: [], packaged: false, prepMin: 3, unit: { name: "medium pepper", fdcPortion: "1 medium (approx 2-3/4\" long, 2-1/2 dia.)", max: 1 }, how: "Slice the pepper.", subs: ["pepper-green", "cucumber"] },
  { key: "pepper-green", fdcId: 170427, name: "green bell pepper (raw)", weighed: "raw weight", aliases: ["green bell pepper", "green bell peppers", "green sweet pepper"], role: "veg", allergens: [], packaged: false, prepMin: 3, unit: { name: "medium pepper", fdcPortion: "1 medium (approx 2-3/4\" long, 2-1/2\" dia)", max: 1 }, how: "Slice the pepper.", subs: ["pepper-red", "cucumber"] },
  { key: "cucumber", fdcId: 168409, name: "cucumber, with peel (raw)", weighed: "raw weight", aliases: ["cucumber", "cucumbers"], role: "veg", allergens: [], packaged: false, prepMin: 2, how: "Slice the cucumber.", subs: ["pepper-red"] },
  { key: "tomato", fdcId: 170457, name: "tomato, red, ripe (raw)", weighed: "raw weight", aliases: ["tomato", "tomatoes"], role: "veg", allergens: [], packaged: false, prepMin: 2, unit: { name: "medium tomato", fdcPortion: "1 medium whole (2-3/5\" dia)", max: 2 }, how: "Chop the tomato.", subs: ["cucumber"] },
  { key: "cauliflower", fdcId: 169986, name: "cauliflower (raw)", weighed: "raw weight", aliases: ["cauliflower", "cauliflower rice", "riced cauliflower", "cauliflower florets"], role: "veg", allergens: [], packaged: false, prepMin: 5, how: "Weigh it raw, then microwave the cauliflower 3–4 min.", subs: ["broccoli"] },
  { key: "mushrooms-white", fdcId: 169251, name: "white mushrooms (raw)", weighed: "raw weight", aliases: ["white mushrooms", "button mushrooms", "white button mushrooms"], role: "veg", allergens: [], packaged: false, prepMin: 5, how: "Weigh them raw, then slice and sauté the mushrooms 3–4 min.", subs: ["zucchini"] },
  { key: "zucchini", fdcId: 169291, name: "zucchini, with skin (raw)", weighed: "raw weight", aliases: ["zucchini", "courgette", "courgettes"], role: "veg", allergens: [], packaged: false, prepMin: 5, how: "Weigh it raw, then slice and sauté the zucchini 3–4 min.", subs: ["broccoli"] },
  { key: "carrots", fdcId: 170393, name: "carrots (raw)", weighed: "raw weight", aliases: ["carrots", "carrot", "baby carrots"], role: "veg", allergens: [], packaged: false, prepMin: 2, how: "Slice the carrots (or use baby carrots).", subs: ["cucumber"] },
  { key: "onion", fdcId: 170000, name: "onion (raw)", weighed: "raw weight", aliases: ["onion", "onions", "yellow onion"], role: "veg", allergens: [], packaged: false, prepMin: 4, unit: { name: "medium onion", fdcPortion: "1 medium (2-1/2\" dia)", max: 1 }, how: "Dice and sauté the onion until soft." },
  // ── Fats and dairy ──
  { key: "avocado", fdcId: 171705, name: "avocado (raw flesh)", weighed: "flesh only", aliases: ["avocado", "avocados"], role: "fat", allergens: [], packaged: false, prepMin: 1, how: "Halve the avocado and weigh the flesh you'll eat.", subs: ["olive-oil"] },
  { key: "olive-oil", fdcId: 171413, name: "olive oil", weighed: "as used", aliases: ["olive oil", "extra virgin olive oil", "evoo"], role: "fat", allergens: [], packaged: true, prepMin: 0, how: "Weigh the oil and use it for cooking or drizzling.", subs: ["avocado"] },
  { key: "peanut-butter", fdcId: 172470, name: "peanut butter, smooth (no salt added)", weighed: "as eaten", aliases: ["peanut butter", "smooth peanut butter", "creamy peanut butter"], role: "fat", allergens: ["peanuts"], packaged: true, prepMin: 0, how: "Weigh the peanut butter.", subs: ["almonds", "avocado"] },
  { key: "almonds", fdcId: 170567, name: "almonds", weighed: "as eaten", aliases: ["almonds", "almond", "raw almonds"], role: "fat", allergens: ["tree nuts"], packaged: true, prepMin: 0, how: "Weigh or count out the almonds.", subs: ["avocado"] },
  { key: "cheddar", fdcId: 173414, name: "cheddar cheese", weighed: "as eaten", aliases: ["cheddar", "cheddar cheese"], role: "fat", allergens: ["milk"], packaged: true, prepMin: 1, how: "Grate or slice the cheese.", subs: ["avocado"] },
  { key: "milk-2", fdcId: 171267, name: "2% reduced-fat milk", weighed: "as drunk", aliases: ["2% milk", "2 percent milk", "reduced fat milk", "2% reduced fat milk"], role: "fat", allergens: ["milk"], packaged: true, prepMin: 0, how: "Pour and weigh the milk." },
  { key: "milk-whole", fdcId: 171265, name: "whole milk (3.25%)", weighed: "as drunk", aliases: ["whole milk"], role: "fat", allergens: ["milk"], packaged: true, prepMin: 0, how: "Pour and weigh the milk." },
];

// Words too broad to pick one reference food. The user is asked which one, or to use a label.
// An empty option list means nothing in the reference list fits: label values only.
const GENERIC: Record<string, { options: string[]; question: string }> = {
  chicken: { options: ["chicken-breast", "chicken-thigh"], question: "Which cut of chicken?" },
  turkey: { options: ["turkey-breast"], question: "Is it turkey breast meat? Other cuts aren't in the reference list." },
  "ground beef": { options: ["ground-beef-90"], question: "Is it 90% lean? Other lean percentages differ — use the label if not." },
  beef: { options: ["ground-beef-90"], question: "Is it 90% lean ground beef? Other beef isn't in the reference list." },
  mince: { options: ["ground-beef-90"], question: "Is it 90% lean ground beef?" },
  salmon: { options: ["salmon-farmed", "salmon-wild"], question: "Farmed or wild Atlantic salmon? They differ in fat and calories; Pacific species aren't in the list." },
  "farmed salmon": { options: ["salmon-farmed"], question: "Is it farmed Atlantic salmon?" },
  "wild salmon": { options: ["salmon-wild"], question: "Is it wild Atlantic salmon? Pacific species (sockeye, coho, pink) differ." },
  fish: { options: ["tilapia", "cod-atlantic", "salmon-farmed", "salmon-wild"], question: "Which fish?" },
  "white fish": { options: ["tilapia", "cod-atlantic"], question: "Which white fish?" },
  cod: { options: ["cod-atlantic"], question: "Is it Atlantic cod? Pacific cod differs." },
  tuna: { options: ["tuna-light-canned-water"], question: "Is it light tuna canned in water? Fresh tuna, tuna in oil and white (albacore) tuna differ." },
  "canned tuna": { options: ["tuna-light-canned-water"], question: "Light tuna canned in water? Tuna in oil and white (albacore) tuna differ." },
  "tuna in water": { options: ["tuna-light-canned-water"], question: "Light (not white/albacore) tuna?" },
  sardines: { options: ["sardines-oil"], question: "Canned in oil (drained)? Sardines in water or sauce differ." },
  "canned sardines": { options: ["sardines-oil"], question: "Canned in oil (drained)? Sardines in water or sauce differ." },
  yogurt: { options: ["greek-yogurt-lowfat"], question: "Is it plain lowfat Greek yogurt? Otherwise use the label values." },
  "greek yogurt": { options: ["greek-yogurt-lowfat"], question: "Is it plain lowfat Greek yogurt? Nonfat and whole-milk versions differ — use the label if so." },
  "cottage cheese": { options: ["cottage-cheese-1"], question: "Is it 1% lowfat cottage cheese? Other fat levels differ." },
  tofu: { options: ["tofu-firm"], question: "Is it firm tofu? Silken and extra-firm differ." },
  rice: { options: ["rice-white", "rice-brown"], question: "White or brown rice?" },
  bread: { options: ["bread-whole-wheat", "bread-white"], question: "Which bread?" },
  toast: { options: ["bread-whole-wheat", "bread-white"], question: "Which bread?" },
  tortilla: { options: ["tortilla-flour"], question: "Is it a flour tortilla? Corn and whole-wheat tortillas differ." },
  tortillas: { options: ["tortilla-flour"], question: "Are they flour tortillas? Corn and whole-wheat tortillas differ." },
  wrap: { options: ["tortilla-flour"], question: "Is it a flour tortilla? Other wraps differ — use the label." },
  wraps: { options: ["tortilla-flour"], question: "Are they flour tortillas? Other wraps differ — use the label." },
  beans: { options: ["black-beans", "chickpeas"], question: "Which beans?" },
  lettuce: { options: ["lettuce-green-leaf", "lettuce-romaine"], question: "Which lettuce?" },
  salad: { options: ["lettuce-green-leaf", "lettuce-romaine", "spinach"], question: "What's in the salad?" },
  greens: { options: ["lettuce-green-leaf", "lettuce-romaine", "spinach"], question: "Which greens?" },
  "mixed greens": { options: ["lettuce-green-leaf", "lettuce-romaine", "spinach"], question: "Which greens? Mixes vary." },
  "salad greens": { options: ["lettuce-green-leaf", "lettuce-romaine", "spinach"], question: "Which greens? Mixes vary." },
  pepper: { options: ["pepper-red", "pepper-green"], question: "Red or green bell pepper?" },
  peppers: { options: ["pepper-red", "pepper-green"], question: "Red or green bell peppers?" },
  "bell pepper": { options: ["pepper-red", "pepper-green"], question: "Red or green?" },
  "bell peppers": { options: ["pepper-red", "pepper-green"], question: "Red or green?" },
  mushrooms: { options: ["mushrooms-white"], question: "White (button) mushrooms? Other varieties differ." },
  mushroom: { options: ["mushrooms-white"], question: "White (button) mushrooms? Other varieties differ." },
  berries: { options: ["strawberries", "blueberries", "blackberries"], question: "Which berries?" },
  milk: { options: ["milk-2", "milk-whole"], question: "Which milk?" },
  cheese: { options: ["cheddar"], question: "Is it cheddar? Other cheeses differ — use the label." },
  nuts: { options: ["almonds"], question: "Which nuts? Only almonds are in the reference list — use the label for others." },
  "mixed nuts": { options: [], question: "Mixed nuts vary by blend — use the label values." },
  oil: { options: ["olive-oil"], question: "Is it olive oil? Use the label for other oils." },
  "cooking oil": { options: ["olive-oil"], question: "Is it olive oil? Use the label for other oils." },
  oatmeal: { options: ["oats-dry"], question: "Weighed dry? The values are for dry oats — cooked oatmeal weighs much more." },
  porridge: { options: ["oats-dry"], question: "Weighed dry? The values are for dry oats." },
};

function portionGrams(snap: SnapFood, label: string): number {
  const p = snap.portions.find((x) => x.label === label);
  if (!p) throw new Error(`FDC ${snap.fdcId}: portion "${label}" not found in snapshot`);
  return p.gramWeight;
}

function build(d: Def): RefFood {
  const snap = SNAP.get(d.fdcId);
  if (!snap) throw new Error(`FDC ${d.fdcId} (${d.key}) is not in the snapshot`);
  const p = snap.per100g;
  const nutrients: Nutrients = { kcal: val(p.kcal), protein: val(p.protein), carbs: val(p.carbs), fiber: val(p.fiber), fat: val(p.fat) };
  const net = netCarbs(nutrients);
  if (nutrients.kcal === null || nutrients.protein === null || nutrients.fat === null || net.value === null) {
    throw new Error(`FDC ${d.fdcId} (${d.key}) is missing a core nutrient; leave it out instead`);
  }
  const { fdcId, unit, ...rest } = d;
  return {
    ...rest,
    unit: unit ? { name: unit.name, grams: portionGrams(snap, unit.fdcPortion), fdcPortion: unit.fdcPortion, max: unit.max } : undefined,
    source: {
      fdcId,
      description: snap.description,
      dataType: snap.dataType,
      publicationDate: snap.publicationDate,
      ndbNumber: snap.ndbNumber,
      url: `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`,
      retrieved: snapshot.retrieved,
    },
    nutrients,
    per100: { kcal: nutrients.kcal, protein: nutrients.protein, carbs: net.value, fat: nutrients.fat, fiber: nutrients.fiber },
    netCarbsBasis: net.basis!,
  };
}

export const FOODS: RefFood[] = DEFS.map(build);
export const FOOD_BY_KEY = new Map(FOODS.map((x) => [x.key, x]));
export const GENERIC_TERMS = GENERIC;

// ─── Matching ───────────────────────────────────────────────────────────

// Words that don't change what the food is. Any other unrecognised word makes the name unknown.
const NEUTRAL = new Set(["fresh", "organic", "large", "small", "medium", "ripe", "sliced", "chopped", "diced", "plain", "of", "a", "an", "some", "the", "pack", "packs", "package", "bag", "bags", "box", "bunch", "container", "tub", "jar", "carton", "head", "heads", "fillet", "fillets"]);
// Preparation-state words matter: a reference food is then only offered with a confirmation.
const STATE = new Set(["raw", "cooked", "frozen", "dried", "dry", "canned", "boiled", "baked", "roasted", "grilled", "fried", "smoked", "steamed"]);

/** Lower-case, drop amounts with units and punctuation (keeps % and /), collapse spaces. */
export function tidyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[“”"'’()[\],.;:!?]/g, " ")
    .replace(/\b\d+(\.\d+)?\s*(g|kg|oz|lb|lbs|ml|l|x)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Match =
  | { status: "match"; food: RefFood }
  | { status: "confirm"; options: RefFood[]; question: string }
  | { status: "unknown"; reason: string };

/**
 * Which reference food a typed or scanned name refers to. Only an exact alias (after tidying and
 * dropping neutral words) is a match. Broad words ("rice", "nuts", "oil") and preparation words that
 * the reference doesn't state ("frozen blueberries", "raw shrimp") ask the user to confirm.
 * Anything else is unknown — it is never resolved to a different food.
 */
export function matchFood(name: string): Match {
  const tidy = tidyName(name);
  if (!tidy) return { status: "unknown", reason: "No name to look up." };
  const words = tidy.split(" ").filter((w) => !NEUTRAL.has(w));
  const joined = words.join(" ");
  const core = words.filter((w) => !STATE.has(w)).join(" ");
  const states = words.filter((w) => STATE.has(w));
  const exact = FOODS.find((f) => f.aliases.includes(joined) || f.aliases.includes(tidy));
  if (exact) return { status: "match", food: exact };
  const byCore = core ? FOODS.find((f) => f.aliases.includes(core)) : undefined;
  if (byCore && states.length) {
    return { status: "confirm", options: [byCore], question: `The reference values are for ${byCore.name}, by ${byCore.weighed}. Is that how you'll weigh and eat it?` };
  }
  const generic = GENERIC[joined] ?? (core ? GENERIC[core] : undefined);
  if (generic) {
    const options = generic.options.map((k) => FOOD_BY_KEY.get(k)!).filter(Boolean);
    return options.length ? { status: "confirm", options, question: generic.question } : { status: "unknown", reason: generic.question };
  }
  return { status: "unknown", reason: "Not in the reference list as written. Choose a reference food yourself, or enter the label values." };
}

/** The reference food for an inventory/grocery name: the user's explicit choice wins, then an exact match. */
export function resolveFood(name: string, chosenKey?: string | null): RefFood | null {
  if (chosenKey && FOOD_BY_KEY.has(chosenKey)) return FOOD_BY_KEY.get(chosenKey)!;
  const m = matchFood(name);
  return m.status === "match" ? m.food : null;
}

// ─── Allergen hints ─────────────────────────────────────────────────────

// Keyword HINTS for names. They can suggest an allergen; they can never show a product is free of
// one. Unknown or packaged foods stay "uncertain".
const WORD_ALLERGENS: [RegExp, Allergen][] = [
  [/\b(milk|cheese|yog(h)?urt|whey|cream|casein|skyr|kefir|ghee)\b|(?<!(peanut|nut|almond|cashew|seed|apple) )\bbutter\b/, "milk"],
  [/\beggs?\b|\begg white/, "egg"],
  [/\b(fish|salmon|tuna|cod|tilapia|sardines?|anchov|trout|halibut|bass|pollock)/, "fish"],
  [/\b(shrimp|prawns?|crab|lobster|crayfish|crawfish|shellfish|scallop|clam|mussel|oyster)/, "shellfish"],
  [/\b(almond|cashew|walnut|pecan|pistachio|hazelnut|macadamia|brazil nut|tree nut)/, "tree nuts"],
  [/\bpeanut/, "peanuts"],
  [/\b(wheat|bread|pasta|flour|gluten|barley|rye|couscous|tortilla|wrap|noodle|cracker|cereal|seitan|spelt)s?\b/, "wheat/gluten"],
  [/\b(soy|soya|tofu|edamame|tempeh|miso)/, "soy"],
  [/\b(sesame|tahini)/, "sesame"],
];

export type AllergenCheck = {
  known: Allergen[]; // inherent to the matched reference food
  hinted: Allergen[]; // only suggested by words in the name
  uncertain: boolean; // unknown or packaged food: only its label can settle it
  caution?: string;
};

export function allergenCheck(name: string, food?: RefFood | null): AllergenCheck {
  const ref = food === undefined ? resolveFood(name) : food;
  const n = name.toLowerCase();
  const hinted = WORD_ALLERGENS.filter(([re, a]) => re.test(n) && !ref?.allergens.includes(a)).map(([, a]) => a);
  return { known: ref?.allergens ?? [], hinted: [...new Set(hinted)], uncertain: !ref || ref.packaged, caution: ref?.caution };
}

/** Allergens known or hinted for a name (union). For warnings only — never proof of absence. */
export function allergensOf(name: string, food?: RefFood | null): Allergen[] {
  const c = allergenCheck(name, food);
  return [...new Set([...c.known, ...c.hinted])];
}

// ─── Arithmetic ─────────────────────────────────────────────────────────

/** Totals for `grams` of a food at the given per-100 g values (deterministic, 1 decimal). */
export function scale(per100: Per100, grams: number): Per100 {
  const r = (x: number) => Math.round(((x * grams) / 100) * 10) / 10;
  return { kcal: Math.round((per100.kcal * grams) / 100), protein: r(per100.protein), carbs: r(per100.carbs), fat: r(per100.fat), fiber: per100.fiber === null ? null : r(per100.fiber) };
}

/** Sums totals. A missing fiber value on either side makes the fiber total missing. */
export const add = (a: Per100, b: Per100): Per100 => ({
  kcal: a.kcal + b.kcal,
  protein: Math.round((a.protein + b.protein) * 10) / 10,
  carbs: Math.round((a.carbs + b.carbs) * 10) / 10,
  fat: Math.round((a.fat + b.fat) * 10) / 10,
  fiber: a.fiber === null || b.fiber === null ? null : Math.round((a.fiber + b.fiber) * 10) / 10,
});
export const ZERO: Per100 = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/** Label values (TOTAL carbs as printed, fiber optional) → the app's per-100 g macros, net carbs once. */
export function labelToPer100(n: { kcal: number; protein: number; carbs: number; fiber: number | null; fat: number }): { per100: Per100; basis: NetCarbsBasis } {
  const net = netCarbs({ carbs: n.carbs, fiber: n.fiber });
  return { per100: { kcal: n.kcal, protein: n.protein, carbs: net.value!, fat: n.fat, fiber: n.fiber }, basis: net.basis! };
}
