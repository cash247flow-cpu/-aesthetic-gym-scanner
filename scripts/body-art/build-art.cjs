// Step 2 of 2: node scripts/body-art/build-art.cjs body-art.json lib/bodyArt.ts (needs Playwright).
// Builds lib/bodyArt.ts from the extracted JSON. Measures upper-back shapes in a browser to split
// them into lats (the large shapes) and mid back (the small ones by the shoulder blades).
const fs = require("fs");
const { chromium } = require("playwright");

const [jsonPath, outPath] = process.argv.slice(2);
const art = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

// Library slug → app muscle (lib/muscles.ts). Missing = drawn, but not a muscle the app tracks.
const MAP = {
  chest: "chest", obliques: "abdominals", abs: "abdominals", biceps: "biceps", triceps: "triceps",
  trapezius: "traps", deltoids: "shoulders", adductors: "adductors", quadriceps: "quadriceps",
  calves: "calves", forearm: "forearms", gluteal: "glutes", hamstring: "hamstrings", "lower-back": "lower back",
};
const NEUTRAL_TONE = new Set(["head", "hair", "hands", "feet", "ankles", "knees", "neck"]);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent("<svg id=s></svg>");
  const area = async (d) =>
    page.evaluate((d) => {
      const s = document.getElementById("s");
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      s.appendChild(p);
      const b = p.getBBox();
      p.remove();
      return b.width * b.height;
    }, d);

  const out = {};
  for (const sex of ["male", "female"]) {
    out[sex] = {};
    for (const side of ["front", "back"]) {
      const v = art[sex][side];
      const shapes = [];
      for (const part of v.parts) {
        let sizes = [];
        if (part.slug === "upper-back") sizes = await Promise.all(part.paths.map(area));
        const max = Math.max(0, ...sizes);
        part.paths.forEach((d, i) => {
          let muscle = MAP[part.slug];
          if (part.slug === "upper-back") muscle = sizes[i] > max * 0.5 ? "lats" : "middle back";
          shapes.push(muscle ? { m: muscle, d } : NEUTRAL_TONE.has(part.slug) ? { n: 1, d } : { d });
        });
      }
      out[sex][side] = { viewBox: v.viewBox, outline: v.outline, shapes };
      const counts = {};
      shapes.forEach((s) => (counts[s.m ?? (s.n ? "(neutral)" : "(other)")] = (counts[s.m ?? (s.n ? "(neutral)" : "(other)")] ?? 0) + 1));
      console.log(sex, side, JSON.stringify(counts));
    }
  }
  await browser.close();

  const header = `// Body figures (male and female, front and back) for the muscle maps. Generated from the data of
// react-native-body-highlighter v3.2.0 (https://github.com/HichamELBSI/react-native-body-highlighter),
// used under the MIT License below. Shapes are mapped to the app's muscle names (lib/muscles.ts):
// "m" = muscle, "n: 1" = head, hands, feet and joints (drawn in a darker tone), neither = drawn only
// (e.g. shins). Upper-back shapes are split by size into lats and mid back.
//
// MIT License
//
// Copyright (c) 2022 ELABBASSI Hicham
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import type { Muscle } from "@/lib/muscles";

export type BodyShape = { m?: Muscle; n?: 1; d: string };
export type BodyView = { viewBox: string; outline: string; shapes: BodyShape[] };
export type BodySex = "male" | "female";

export const BODY_ART: Record<BodySex, { front: BodyView; back: BodyView }> = `;
  fs.writeFileSync(outPath, header + JSON.stringify(out, null, 1) + ";\n");
})();
