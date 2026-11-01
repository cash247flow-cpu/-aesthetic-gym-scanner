// Reference foods for the nutrition coach. Values are per 100 g, rounded from typical
// USDA FoodData Central entries for the form named (e.g. "cooked"). They are ESTIMATES:
// brands, cuts and cooking change them. A value read from the user's own label or Cronometer
// export always wins and is shown as such. Carbs here are NET carbs (total − fiber), matching
// how the app's targets are set.

export type Allergen = "milk" | "egg" | "fish" | "shellfish" | "tree nuts" | "peanuts" | "wheat/gluten" | "soy" | "sesame";
export const ALLERGENS: Allergen[] = ["milk", "egg", "fish", "shellfish", "tree nuts", "peanuts", "wheat/gluten", "soy", "sesame"];

export type Role = "protein" | "carb" | "veg" | "fruit" | "fat";
export type Per100 = { kcal: number; protein: number; carbs: number; fat: number; fiber: number };

export type RefFood = {
  key: string;
  name: string; // display name, including the form the values are for
  aliases: string[]; // lower-case words that identify it in a typed or scanned name
  role: Role;
  per100: Per100;
  allergens: Allergen[];
  prepMin: number; // typical hands-on + cooking time from the fridge
  unit?: { name: string; grams: number; max?: number }; // e.g. 1 egg ≈ 50 g; max per meal
  how: string; // one simple preparation step
  subs?: string[]; // simple swaps (other keys)
  budget?: string; // a cheaper way to buy it — no prices are claimed
};

const f = (kcal: number, protein: number, carbs: number, fat: number, fiber = 0): Per100 => ({ kcal, protein, carbs, fat, fiber });

export const FOODS: RefFood[] = [
  // ── Protein ──
  { key: "chicken", name: "chicken breast (cooked)", aliases: ["chicken breast", "chicken"], role: "protein", per100: f(165, 31, 0, 3.6), allergens: [], prepMin: 20, how: "Pan-cook the chicken 5–7 min per side until 74 °C / 165 °F inside (or use cooked leftovers).", subs: ["turkey", "tofu"], budget: "Thighs or a family pack cost less per gram of protein." },
  { key: "turkey", name: "turkey breast (cooked)", aliases: ["turkey"], role: "protein", per100: f(135, 30, 0, 1), allergens: [], prepMin: 15, how: "Warm the turkey through, or pan-cook raw turkey until 74 °C / 165 °F inside.", subs: ["chicken"] },
  { key: "beef", name: "lean ground beef 90% (cooked)", aliases: ["ground beef", "beef", "mince"], role: "protein", per100: f(217, 26, 0, 12), allergens: [], prepMin: 15, how: "Brown the beef in a pan, breaking it up, until no pink remains (71 °C / 160 °F).", subs: ["turkey", "chicken"] },
  { key: "eggs", name: "whole eggs", aliases: ["eggs", "egg"], role: "protein", per100: f(143, 12.6, 0.7, 9.5), allergens: ["egg"], prepMin: 8, unit: { name: "egg", grams: 50, max: 4 }, how: "Scramble or fry the eggs until the whites and yolks are set.", subs: ["egg whites", "tofu"], budget: "Eggs are usually one of the cheapest proteins." },
  { key: "egg whites", name: "liquid egg whites", aliases: ["egg whites", "egg white"], role: "protein", per100: f(52, 11, 0.7, 0.2), allergens: ["egg"], prepMin: 5, how: "Cook the egg whites in a pan, stirring, until set.", subs: ["eggs"] },
  { key: "salmon", name: "salmon (cooked)", aliases: ["salmon"], role: "protein", per100: f(200, 22, 0, 12), allergens: ["fish"], prepMin: 15, how: "Bake or pan-cook the salmon until it flakes (63 °C / 145 °F).", subs: ["tilapia", "tuna"], budget: "Frozen or canned salmon costs less than fresh fillets." },
  { key: "tilapia", name: "tilapia (cooked)", aliases: ["tilapia", "white fish", "cod"], role: "protein", per100: f(128, 26, 0, 2.7), allergens: ["fish"], prepMin: 12, how: "Pan-cook the fish 3–4 min per side until it flakes (63 °C / 145 °F).", subs: ["salmon", "tuna"] },
  { key: "tuna", name: "canned tuna in water (drained)", aliases: ["tuna"], role: "protein", per100: f(116, 26, 0, 0.8), allergens: ["fish"], prepMin: 2, unit: { name: "can (drained)", grams: 120 }, how: "Drain the tuna and flake it with a fork.", subs: ["sardines", "chicken"], budget: "Store-brand canned tuna is a low-cost protein." },
  { key: "sardines", name: "canned sardines (drained)", aliases: ["sardines", "sardine"], role: "protein", per100: f(208, 25, 0, 11.5), allergens: ["fish"], prepMin: 2, unit: { name: "can (drained)", grams: 90 }, how: "Drain the sardines.", subs: ["tuna"] },
  { key: "shrimp", name: "shrimp (cooked)", aliases: ["shrimp", "prawns", "prawn"], role: "protein", per100: f(99, 24, 0.2, 0.3), allergens: ["shellfish"], prepMin: 8, how: "Cook the shrimp 2–3 min per side until pink and opaque.", subs: ["tilapia", "chicken"] },
  { key: "greek yogurt", name: "nonfat plain Greek yogurt", aliases: ["greek yogurt", "yogurt", "yoghurt", "skyr"], role: "protein", per100: f(59, 10, 3.6, 0.4), allergens: ["milk"], prepMin: 1, how: "Spoon the yogurt into a bowl.", subs: ["cottage cheese"] },
  { key: "cottage cheese", name: "2% cottage cheese", aliases: ["cottage cheese"], role: "protein", per100: f(84, 11, 4.3, 2.3), allergens: ["milk"], prepMin: 1, how: "Spoon the cottage cheese into a bowl.", subs: ["greek yogurt"] },
  { key: "tofu", name: "firm tofu", aliases: ["tofu"], role: "protein", per100: f(144, 17.3, 0.5, 8.7, 2.3), allergens: ["soy"], prepMin: 10, how: "Press, cube and pan-fry the tofu until golden.", subs: ["eggs", "lentils"] },
  // ── Carbs (also count legumes here; they bring protein and fiber too) ──
  { key: "rice", name: "white rice (cooked)", aliases: ["white rice", "rice"], role: "carb", per100: f(130, 2.7, 27.8, 0.3, 0.4), allergens: [], prepMin: 20, how: "Cook the rice (or microwave a ready pouch per its label).", subs: ["potato", "sweet potato"], budget: "A large bag of dry rice costs far less per portion than pouches." },
  { key: "brown rice", name: "brown rice (cooked)", aliases: ["brown rice"], role: "carb", per100: f(123, 2.7, 24, 1, 1.6), allergens: [], prepMin: 25, how: "Cook the brown rice (or microwave a ready pouch).", subs: ["rice"] },
  { key: "potato", name: "potato (boiled)", aliases: ["potato", "potatoes"], role: "carb", per100: f(87, 1.9, 18.3, 0.1, 1.8), allergens: [], prepMin: 12, unit: { name: "medium potato", grams: 170 }, how: "Prick the potato and microwave 6–8 min until soft (or boil 15 min).", subs: ["sweet potato", "rice"], budget: "Potatoes are a low-cost carb." },
  { key: "sweet potato", name: "sweet potato (baked)", aliases: ["sweet potato", "sweet potatoes", "yam"], role: "carb", per100: f(90, 2, 17.4, 0.2, 3.3), allergens: [], prepMin: 12, unit: { name: "medium sweet potato", grams: 130 }, how: "Prick the sweet potato and microwave 6–8 min until soft.", subs: ["potato"] },
  { key: "oats", name: "rolled oats (dry)", aliases: ["oats", "oatmeal", "porridge"], role: "carb", per100: f(379, 13, 58, 6.5, 10), allergens: ["wheat/gluten"], prepMin: 5, how: "Microwave the oats with water or milk for 2–3 min.", subs: ["rice"] },
  { key: "bread", name: "whole-wheat bread", aliases: ["bread", "toast", "wrap", "tortilla"], role: "carb", per100: f(252, 12.5, 37, 3.5, 6), allergens: ["wheat/gluten"], prepMin: 2, unit: { name: "slice", grams: 32 }, how: "Toast the bread if you like.", subs: ["potato", "rice"] },
  { key: "pasta", name: "pasta (cooked)", aliases: ["pasta", "spaghetti", "noodles"], role: "carb", per100: f(158, 5.8, 29, 0.9, 1.8), allergens: ["wheat/gluten"], prepMin: 15, how: "Boil the pasta per the package.", subs: ["rice", "potato"] },
  { key: "lentils", name: "lentils (cooked)", aliases: ["lentils", "lentil"], role: "carb", per100: f(116, 9, 12.1, 0.4, 7.9), allergens: [], prepMin: 3, how: "Warm the cooked lentils (canned or pouch, rinsed).", subs: ["black beans"] },
  { key: "black beans", name: "black beans (cooked)", aliases: ["black beans", "beans", "chickpeas"], role: "carb", per100: f(132, 8.9, 15, 0.5, 8.7), allergens: [], prepMin: 3, how: "Rinse and warm the beans.", subs: ["lentils"], budget: "Canned beans are a low-cost carb and protein." },
  // ── Fruit ──
  { key: "banana", name: "banana", aliases: ["banana", "bananas"], role: "fruit", per100: f(89, 1.1, 20.2, 0.3, 2.6), allergens: [], prepMin: 0, unit: { name: "medium banana", grams: 118 }, how: "Slice the banana.", subs: ["apple"] },
  { key: "strawberries", name: "strawberries", aliases: ["strawberries", "strawberry"], role: "fruit", per100: f(32, 0.7, 5.7, 0.3, 2), allergens: [], prepMin: 1, how: "Rinse the strawberries.", subs: ["blueberries", "blackberries"], budget: "Frozen berries cost less and keep longer." },
  { key: "blueberries", name: "blueberries", aliases: ["blueberries", "blueberry"], role: "fruit", per100: f(57, 0.7, 12.1, 0.3, 2.4), allergens: [], prepMin: 1, how: "Rinse the blueberries.", subs: ["strawberries"], budget: "Frozen berries cost less and keep longer." },
  { key: "blackberries", name: "blackberries", aliases: ["blackberries", "blackberry"], role: "fruit", per100: f(43, 1.4, 4.3, 0.5, 5.3), allergens: [], prepMin: 1, how: "Rinse the blackberries.", subs: ["strawberries"] },
  { key: "apple", name: "apple", aliases: ["apple", "apples"], role: "fruit", per100: f(52, 0.3, 11.4, 0.2, 2.4), allergens: [], prepMin: 1, unit: { name: "medium apple", grams: 180 }, how: "Slice the apple.", subs: ["banana"] },
  // ── Vegetables ──
  { key: "spinach", name: "spinach (raw)", aliases: ["spinach"], role: "veg", per100: f(23, 2.9, 1.4, 0.4, 2.2), allergens: [], prepMin: 2, how: "Rinse the spinach (or wilt it in the pan for 1 min).", subs: ["salad greens"] },
  { key: "salad greens", name: "salad greens", aliases: ["salad", "lettuce", "greens", "mixed greens", "arugula"], role: "veg", per100: f(17, 1.5, 1, 0.2, 2), allergens: [], prepMin: 2, how: "Rinse the greens.", subs: ["spinach"] },
  { key: "broccoli", name: "broccoli", aliases: ["broccoli"], role: "veg", per100: f(34, 2.8, 4, 0.4, 2.6), allergens: [], prepMin: 6, how: "Microwave or steam the broccoli 3–4 min until bright green.", subs: ["zucchini"], budget: "Frozen broccoli costs less and keeps longer." },
  { key: "bell pepper", name: "bell pepper", aliases: ["bell pepper", "peppers", "pepper", "capsicum"], role: "veg", per100: f(26, 1, 3.9, 0.3, 2.1), allergens: [], prepMin: 3, unit: { name: "pepper", grams: 120 }, how: "Slice the pepper.", subs: ["cucumber"] },
  { key: "cucumber", name: "cucumber", aliases: ["cucumber"], role: "veg", per100: f(15, 0.7, 3.1, 0.1, 0.5), allergens: [], prepMin: 2, how: "Slice the cucumber.", subs: ["bell pepper"] },
  { key: "tomato", name: "tomato", aliases: ["tomato", "tomatoes"], role: "veg", per100: f(18, 0.9, 2.7, 0.2, 1.2), allergens: [], prepMin: 2, unit: { name: "medium tomato", grams: 120 }, how: "Chop the tomato.", subs: ["cucumber"] },
  { key: "cauliflower rice", name: "cauliflower / cauliflower rice", aliases: ["cauliflower"], role: "veg", per100: f(25, 1.9, 3, 0.3, 2), allergens: [], prepMin: 5, how: "Microwave the cauliflower rice 3–4 min.", subs: ["broccoli"] },
  { key: "mushrooms", name: "mushrooms", aliases: ["mushrooms", "mushroom"], role: "veg", per100: f(22, 3.1, 2.3, 0.3, 1), allergens: [], prepMin: 5, how: "Slice and sauté the mushrooms 3–4 min.", subs: ["zucchini"] },
  { key: "zucchini", name: "zucchini", aliases: ["zucchini", "courgette"], role: "veg", per100: f(17, 1.2, 2.1, 0.3, 1), allergens: [], prepMin: 5, how: "Slice and sauté the zucchini 3–4 min.", subs: ["broccoli"] },
  { key: "carrots", name: "carrots", aliases: ["carrots", "carrot"], role: "veg", per100: f(41, 0.9, 6.8, 0.2, 2.8), allergens: [], prepMin: 2, how: "Slice the carrots (or use baby carrots).", subs: ["cucumber"] },
  { key: "onion", name: "onion", aliases: ["onion", "onions"], role: "veg", per100: f(40, 1.1, 7.6, 0.1, 1.7), allergens: [], prepMin: 4, unit: { name: "onion", grams: 110 }, how: "Dice and sauté the onion until soft." },
  // ── Fats ──
  { key: "avocado", name: "avocado", aliases: ["avocado", "avocados", "guacamole"], role: "fat", per100: f(160, 2, 1.8, 14.7, 6.7), allergens: [], prepMin: 1, unit: { name: "avocado (flesh)", grams: 136 }, how: "Slice the avocado.", subs: ["olive oil"] },
  { key: "olive oil", name: "olive oil", aliases: ["olive oil", "oil"], role: "fat", per100: f(884, 0, 0, 100), allergens: [], prepMin: 0, how: "Use the oil for cooking or drizzle it over.", subs: ["avocado"] },
  { key: "peanut butter", name: "peanut butter", aliases: ["peanut butter"], role: "fat", per100: f(588, 25, 14, 50, 6), allergens: ["peanuts"], prepMin: 0, how: "Measure the peanut butter with a spoon.", subs: ["almonds", "avocado"] },
  { key: "almonds", name: "almonds", aliases: ["almonds", "almond", "nuts"], role: "fat", per100: f(579, 21, 9.1, 49.9, 12.5), allergens: ["tree nuts"], prepMin: 0, how: "Weigh or count out the almonds.", subs: ["avocado"] },
  { key: "cheese", name: "cheddar cheese", aliases: ["cheese", "cheddar"], role: "fat", per100: f(403, 25, 1.3, 33), allergens: ["milk"], prepMin: 1, how: "Grate or slice the cheese.", subs: ["avocado"] },
  { key: "milk", name: "2% milk", aliases: ["milk"], role: "fat", per100: f(50, 3.3, 4.8, 2), allergens: ["milk"], prepMin: 0, how: "Pour the milk." },
];

export const FOOD_BY_KEY = new Map(FOODS.map((x) => [x.key, x]));

const words = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * The reference food a typed or scanned name refers to, or null. Longest alias wins
 * ("peanut butter" before "butter", "egg whites" before "egg"). Never guesses beyond the aliases.
 */
export function matchFood(name: string): RefFood | null {
  const n = ` ${words(name)} `;
  let best: { food: RefFood; len: number } | null = null;
  for (const food of FOODS) {
    for (const a of food.aliases) {
      if (n.includes(` ${a} `) && (!best || a.length > best.len)) best = { food, len: a.length };
    }
  }
  return best?.food ?? null;
}

/** Allergens a name or reference food may contain, from the reference list and obvious words. */
const WORD_ALLERGENS: [RegExp, Allergen][] = [
  [/\b(milk|cheese|yog(h)?urt|whey|cream|casein|skyr|kefir|ghee)\b|(?<!(peanut|nut|almond|cashew|seed|apple) )\bbutter\b/, "milk"],
  [/\beggs?\b|\begg white/, "egg"],
  [/\b(fish|salmon|tuna|cod|tilapia|sardine|anchov|trout)/, "fish"],
  [/\b(shrimp|prawn|crab|lobster|shellfish|scallop|clam|mussel|oyster)/, "shellfish"],
  [/\b(almond|cashew|walnut|pecan|pistachio|hazelnut|macadamia|tree nut)/, "tree nuts"],
  [/\bpeanut/, "peanuts"],
  [/\b(wheat|bread|pasta|flour|gluten|barley|rye|oat|couscous|tortilla|noodle|cracker|cereal)/, "wheat/gluten"],
  [/\b(soy|tofu|edamame|tempeh|miso)/, "soy"],
  [/\b(sesame|tahini)/, "sesame"],
];

export function allergensOf(name: string): Allergen[] {
  const set = new Set<Allergen>(matchFood(name)?.allergens ?? []);
  const n = name.toLowerCase();
  for (const [re, a] of WORD_ALLERGENS) if (re.test(n)) set.add(a);
  return [...set];
}

/** Totals for `grams` of a food at the given per-100 g values (deterministic, 1 decimal). */
export function scale(per100: Per100, grams: number): Per100 {
  const r = (x: number) => Math.round(((x * grams) / 100) * 10) / 10;
  return { kcal: Math.round((per100.kcal * grams) / 100), protein: r(per100.protein), carbs: r(per100.carbs), fat: r(per100.fat), fiber: r(per100.fiber) };
}

export const add = (a: Per100, b: Per100): Per100 => ({
  kcal: a.kcal + b.kcal,
  protein: Math.round((a.protein + b.protein) * 10) / 10,
  carbs: Math.round((a.carbs + b.carbs) * 10) / 10,
  fat: Math.round((a.fat + b.fat) * 10) / 10,
  fiber: Math.round((a.fiber + b.fiber) * 10) / 10,
});
export const ZERO: Per100 = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
