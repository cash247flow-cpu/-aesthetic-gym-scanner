// Weekly Wins metric selection and referral links — run with `npm test`. Example data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWeek, type ReviewInput } from "@/lib/review/metrics";
import { periodFor } from "@/lib/review/period";
import { defaultWins, winCandidates } from "@/lib/review/winsCard";
import { referralLink, referralToken } from "@/lib/achievements/sharePrefs";

const W = periodFor("2026-10-20", 0);
const base: ReviewInput = {
  history: [],
  achievements: [],
  body: [],
  goal: null,
  habitLogs: {},
  meals: {},
  intake: [],
  targets: { protein: 155, carbs: 70, fat: 60 },
  scheduleFor: () => null,
  cardio: {},
  photos: [],
};

test("Weekly Wins: nothing recorded → nothing offered (no fabricated zeros)", () => {
  assert.deepEqual(winCandidates(computeWeek(base, W), "lb"), []);
});

test("Weekly Wins: only recorded metrics; body numbers offered but never selected by default", () => {
  const m = computeWeek(
    {
      ...base,
      history: [{ date: "2026-10-19", session: "Pull Day", label: "Pull Day", volumeLb: 12000, sets: 22, prs: 0, cardioMin: 30, exercises: ["Meadows Row"] }],
      body: [
        { id: "a", date: "2026-10-12", weightLb: 201, source: "manual" },
        { id: "b", date: "2026-10-14", weightLb: 200, source: "manual" },
        { id: "c", date: "2026-10-19", weightLb: 199, source: "manual", waistIn: 36 },
        { id: "d", date: "2026-10-23", weightLb: 198, source: "manual", waistIn: 35.5 },
      ],
      scheduleFor: () => [
        { key: "1", date: "2026-10-19", kind: "lift", label: "Pull Day", status: "done" },
        { key: "2", date: "2026-10-21", kind: "lift", label: "Push Day", status: "missed" },
      ],
    },
    W,
  );
  const c = winCandidates(m, "lb");
  assert.deepEqual(c.map((x) => x.key), ["workouts", "cardio", "volume", "weight", "waist"]);
  assert.equal(c.find((x) => x.key === "workouts")!.value, "1/2");
  assert.equal(c.find((x) => x.key === "weight")!.value, "−2 lb"); // 198.5 avg vs 200.5
  assert.equal(c.find((x) => x.key === "waist")!.value, "−0.5 in");
  assert.ok(!c.some((x) => x.key === "prs")); // no PRs → no "0 PRs" tile
  assert.deepEqual(defaultWins(c), ["workouts", "cardio", "volume"]);
  assert.equal(winCandidates(m, "kg").find((x) => x.key === "waist")!.value, "−1.3 cm");
});

test("referral: random opaque tokens and links only for a configured https base", () => {
  const a = referralToken();
  const b = referralToken();
  assert.match(a, /^[A-Za-z0-9]{12}$/);
  assert.notEqual(a, b); // (no storage in tests, so each call is fresh)
  assert.equal(referralLink(null), null);
  const link = referralLink("https://example.com/join", "AbCdEfGh2345", "Coach Sam!");
  assert.equal(link, "https://example.com/join?ref=AbCdEfGh2345&coach=coach-sam");
  assert.ok(!/local-|@|%40/.test(link!)); // no profile id or email
});
