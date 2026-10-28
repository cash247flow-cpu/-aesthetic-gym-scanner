// Shareable cards that sit alongside the certificates in the same artifact engine:
//   Format A — Weekly Wins card ("THE SCALE ISN'T THE WHOLE STORY.")
//   Format B — Transformation Comparison (two of the user's own photos, unaltered, side by side)
// Same canvas helpers, fonts and metal palette as the certificates; every number is passed in
// from recorded data — nothing is invented here. Photos are only scaled to fit (proportions kept).

import { FOOTER, type Tier } from "@/lib/achievements/config";
import {
  METAL,
  background,
  canvasToBlob,
  chevron,
  fit,
  frame,
  loadFont,
  metalFill,
  metalText,
  qrToCanvas,
  ribbon,
  rule,
  setFont,
  spaced,
  wrap,
  FORMATS,
  type CertFormat,
  type Ctx,
  type RenderReport,
} from "@/lib/achievements/certificate";
import type { WinMetric } from "@/lib/review/winsCard";

export { canvasToBlob };
export const WEEKLY_HEADLINE = ["THE SCALE ISN'T", "THE WHOLE STORY."];
export const WEEKLY_FOOTER = "PROGRESS ISN'T ALWAYS MEASURED IN POUNDS.";
const LIME = "#c6f432";

export type CardOptions = { name: string | null; coach: string | null; qr: { url: string; caption: string } | null };

function setup(format: CertFormat, tier: Tier) {
  const { w: W, h: H } = FORMATS[format];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  background(ctx, W, H, tier);
  frame(ctx, W, H, tier);
  const k = format === "story" ? 1 : format === "portrait" ? 0.8 : 0.66;
  return { canvas, ctx, W, H, k, pad: format === "story" ? 90 : 72 };
}

/** Brand mark at the top: small, so the achievement stays the hero. */
function header(ctx: Ctx, W: number, y: number, k: number, tier: Tier) {
  chevron(ctx, W / 2, y, 40 * k, tier);
  setFont(ctx, 20 * k, 600);
  ctx.fillStyle = METAL[tier].dim;
  spaced(ctx, "AESTHETIQ™", W / 2, y + 40 * k + 26 * k, 9 * k);
  return y + 40 * k + 46 * k;
}

/** Footer line, discreet brand/coach line and the optional real QR code. Returns its top y. */
async function footer(ctx: Ctx, W: number, H: number, k: number, pad: number, tier: Tier, line: string, opts: CardOptions, r: RenderReport) {
  const m = METAL[tier];
  const qr = opts.qr ? await qrToCanvas(opts.qr.url) : null;
  const qrSize = qr ? Math.round(150 * Math.max(k, 0.8)) : 0;
  const textW = W - pad * 2 - (qr ? qrSize + 40 : 0);
  const cx = qr ? pad + textW / 2 : W / 2;
  const base = H - pad - 4;
  const brand = opts.coach ? `AESTHETIQ™  ·  COACHED BY ${opts.coach.toUpperCase()}` : "AESTHETIQ™";
  const bs = fit(ctx, brand, textW, 19 * k + 4, 11, 600, 6, r);
  ctx.fillStyle = m.dim;
  spaced(ctx, brand, cx, base, 6 * (bs / (19 * k + 4)));
  const ls = fit(ctx, line, textW, 30 * k + 4, 12, 700, 4, r);
  ctx.fillStyle = metalFill(ctx, tier, base - ls * 2.6, base - ls * 1.4);
  setFont(ctx, ls, 700);
  spaced(ctx, line, cx, base - bs * 1.9, 4 * (ls / (30 * k + 4)));
  const top = base - bs * 1.9 - ls * 1.6;
  rule(ctx, pad, W - pad, top - 18 * k, m.line, 0.5);
  if (qr && opts.qr) {
    const qx = W - pad - qrSize;
    const qy = H - pad - qrSize - 22;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qx - 8, qy - 8, qrSize + 16, qrSize + 16);
    ctx.drawImage(qr, qx, qy, qrSize, qrSize);
    setFont(ctx, 13, 600);
    ctx.fillStyle = m.text;
    spaced(ctx, opts.qr.caption.toUpperCase(), qx + qrSize / 2, H - pad + 8, 3);
    return Math.min(top - 18 * k, qy - 20);
  }
  return top - 18 * k;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, rad: number) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// ─── Format A: Weekly Wins ──────────────────────────────────────────────
export async function renderWeeklyWins(
  metrics: WinMetric[],
  period: string | null,
  opts: CardOptions,
  format: CertFormat,
): Promise<{ canvas: HTMLCanvasElement; report: RenderReport }> {
  await loadFont();
  const tier: Tier = "gold";
  const m = METAL[tier];
  const { canvas, ctx, W, H, k, pad } = setup(format, tier);
  const r: RenderReport = { overflow: false, shrunkText: [], emblemH: 0 };
  const innerW = W - pad * 2;
  ctx.textAlign = "center";

  let y = header(ctx, W, pad + 6, k, tier);
  setFont(ctx, 22 * k + 2, 700);
  ctx.fillStyle = LIME;
  y += 34 * k;
  spaced(ctx, "WEEKLY EVOLUTION™", W / 2, y, 8 * k);
  if (period) {
    y += 38 * k;
    setFont(ctx, 24 * k + 2, 600);
    ctx.fillStyle = m.dim;
    spaced(ctx, period.toUpperCase(), W / 2, y, 4 * k);
  }
  y += 40 * k;
  for (const line of WEEKLY_HEADLINE) {
    const s = fit(ctx, line, innerW, 104 * k, 30, 800, 2, r);
    y += s * 1.02;
    metalText(ctx, line, W / 2, y, s, tier, 2);
  }
  if (opts.name) {
    y += 66 * k;
    const s = fit(ctx, `${opts.name.toUpperCase()}'S WEEK`, innerW, 34 * k + 4, 14, 700, 5, r);
    ctx.fillStyle = m.text;
    spaced(ctx, `${opts.name.toUpperCase()}'S WEEK`, W / 2, y, 5 * (s / (34 * k + 4)));
  }
  y += 40 * k;
  rule(ctx, pad + 60, W - pad - 60, y, m.line, 0.7);
  y += 34 * k;

  const footTop = await footer(ctx, W, H, k, pad, tier, WEEKLY_FOOTER, opts, r);

  // Metric tiles (2 columns), filling the space between headline and footer.
  const list = metrics.slice(0, 4);
  if (!list.length) {
    setFont(ctx, 28 * k + 4, 600);
    ctx.fillStyle = m.dim;
    spaced(ctx, "KEEP LOGGING — YOUR WINS WILL SHOW HERE", W / 2, (y + footTop) / 2, 2);
    return { canvas, report: r };
  }
  const rows = Math.ceil(list.length / 2);
  const gap = 26 * k;
  const avail = footTop - 30 * k - y;
  const tileH = Math.min(380 * k + 20, (avail - gap * (rows - 1)) / rows);
  if (tileH < 150 * k) r.overflow = true;
  const gridTop = y + (avail - (tileH * rows + gap * (rows - 1))) / 2;
  const tileW = (innerW - gap) / 2;
  list.forEach((t, i) => {
    const row = Math.floor(i / 2);
    const lastAlone = list.length % 2 === 1 && i === list.length - 1;
    const x = lastAlone ? W / 2 - tileW / 2 : pad + (i % 2) * (tileW + gap);
    const ty = gridTop + row * (tileH + gap);
    ctx.save();
    roundRect(ctx, x, ty, tileW, tileH, 22 * k);
    ctx.fillStyle = "rgba(255,240,210,0.035)";
    ctx.fill();
    ctx.strokeStyle = m.line;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    const cx = x + tileW / 2;
    const vs = fit(ctx, t.value, tileW - 40, Math.min(110 * k, tileH * 0.36), 22, 800, 0, r);
    const vy = ty + tileH * 0.22 + vs * 0.8;
    metalText(ctx, t.value, cx, vy, vs, tier, 0);
    ctx.fillStyle = LIME;
    ctx.fillRect(cx - 22 * k, vy + 16 * k, 44 * k, 4 * k);
    const label = t.label.toUpperCase();
    const ls = fit(ctx, label, tileW - 36, 22 * k + 3, 11, 700, 3, r);
    ctx.fillStyle = m.text;
    spaced(ctx, label, cx, vy + 16 * k + ls * 2.1, 3 * (ls / (22 * k + 3)));
    if (t.sub) {
      const ss = fit(ctx, t.sub, tileW - 36, 20 * k + 3, 10, 500, 0, r);
      ctx.fillStyle = m.dim;
      setFont(ctx, ss, 500);
      ctx.fillText(t.sub, cx, vy + 16 * k + ls * 2.1 + ss * 1.6);
    }
  });
  return { canvas, report: r };
}

// ─── Format B: Transformation Comparison ───────────────────────────────
export type CompareSide = { img: HTMLImageElement | null; date: string; label: string };
export type CompareRow = { label: string; before: string; after: string };
export type ComparisonData = {
  before: CompareSide;
  after: CompareSide;
  duration: string; // "12 weeks"
  view: string | null; // "Front view"
  rows: CompareRow[]; // only rows the user chose, from recorded values
  notes: string[]; // e.g. "Weight from Oct 3, 2 days after the photo"
  strength: string | null; // e.g. "6 personal records between these dates"
  tier: Tier;
};

/** Draw an image to fit inside the box without changing its proportions. */
function contain(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export async function renderComparison(d: ComparisonData, opts: CardOptions, format: CertFormat): Promise<{ canvas: HTMLCanvasElement; report: RenderReport }> {
  await loadFont();
  const tier = d.tier;
  const m = METAL[tier];
  const { canvas, ctx, W, H, k, pad } = setup(format, tier);
  const r: RenderReport = { overflow: false, shrunkText: [], emblemH: 0 };
  const innerW = W - pad * 2;
  ctx.textAlign = "center";

  let y = header(ctx, W, pad + 6, k, tier);
  y += 30 * k;
  setFont(ctx, 22 * k + 2, 700);
  ctx.fillStyle = m.text;
  spaced(ctx, "THE TRANSFORMATION SERIES™", W / 2, y, 7 * k);
  const title = "VISUAL EVOLUTION™";
  const ts = fit(ctx, title, innerW, 92 * k, 30, 800, 2, r);
  y += ts * 1.15;
  metalText(ctx, title, W / 2, y, ts, tier, 2);
  y += 46 * k;
  ribbon(ctx, W / 2, y, [d.duration.toUpperCase(), d.view?.toUpperCase()].filter(Boolean).join("  ·  "), 22 * k + 2, tier, innerW, r);
  y += 44 * k;
  if (opts.name) {
    const s = fit(ctx, opts.name.toUpperCase(), innerW, 32 * k + 4, 14, 700, 5, r);
    y += s;
    ctx.fillStyle = m.text;
    spaced(ctx, opts.name.toUpperCase(), W / 2, y, 5 * (s / (32 * k + 4)));
    y += 16 * k;
  }

  const footTop = await footer(ctx, W, H, k, pad, tier, FOOTER, opts, r);

  // Measurement table + notes height (bigger when there are no photos to show).
  const photos = !!(d.before.img && d.after.img);
  const big = photos ? 1 : 1.7;
  const rowH = (46 * k + 8) * big;
  const notesH = d.notes.length * (20 * k + 8) + (d.strength ? 40 * k + 6 : 0);
  const tableH = d.rows.length ? rowH * (d.rows.length + 1) + 16 : 0;

  if (photos) {
    const gap = 26 * k;
    const capH = 56 * k + 6;
    const ph = footTop - 24 * k - y - tableH - notesH - capH - 10;
    if (ph < 260 * k) r.overflow = true;
    const fw = (innerW - gap) / 2;
    [d.before, d.after].forEach((side, i) => {
      const x = pad + i * (fw + gap);
      ctx.fillStyle = "#050505";
      ctx.fillRect(x, y, fw, ph);
      contain(ctx, side.img!, x, y, fw, ph);
      ctx.strokeStyle = m.line;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, fw, ph);
      setFont(ctx, 22 * k + 3, 700);
      ctx.fillStyle = i ? m.text : m.dim;
      spaced(ctx, side.label.toUpperCase(), x + fw / 2, y + ph + 30 * k + 4, 5 * k);
      setFont(ctx, 20 * k + 3, 500);
      ctx.fillStyle = m.dim;
      ctx.fillText(side.date, x + fw / 2, y + ph + 56 * k + 6);
    });
    y += ph + capH + 10;
  } else {
    // Measurement-only version.
    setFont(ctx, 24 * k + 3, 600);
    ctx.fillStyle = m.dim;
    y += 30 * k;
    spaced(ctx, `${d.before.date.toUpperCase()}  →  ${d.after.date.toUpperCase()}`, W / 2, y, 3);
    y += Math.max(30 * k, (footTop - y - tableH - notesH) / 2 - 20 * k);
  }

  if (d.rows.length) {
    const cols = [pad + innerW * 0.2, pad + innerW * 0.55, pad + innerW * 0.85];
    setFont(ctx, (18 * k + 3) * big, 700);
    ctx.fillStyle = m.dim;
    ["", d.before.label.toUpperCase(), d.after.label.toUpperCase()].forEach((h, i) => spaced(ctx, h, cols[i], y + rowH * 0.6, 3));
    y += rowH;
    for (const row of d.rows) {
      rule(ctx, pad, W - pad, y, m.line, 0.35);
      const s = fit(ctx, row.label.toUpperCase(), innerW * 0.36, (20 * k + 4) * big, 10, 700, 2, r);
      ctx.fillStyle = m.text;
      spaced(ctx, row.label.toUpperCase(), cols[0], y + rowH * 0.62, 2 * (s / (20 * k + 4)));
      setFont(ctx, (26 * k + 5) * big, 700);
      ctx.fillStyle = m.dim;
      ctx.fillText(row.before, cols[1], y + rowH * 0.66);
      ctx.fillStyle = metalFill(ctx, tier, y, y + rowH);
      ctx.fillText(row.after, cols[2], y + rowH * 0.66);
      y += rowH;
    }
    y += 16;
  }
  if (d.strength) {
    setFont(ctx, 22 * k + 4, 700);
    ctx.fillStyle = LIME;
    y += 30 * k;
    const line = wrap(ctx, d.strength.toUpperCase(), innerW)[0];
    spaced(ctx, line, W / 2, y, 2);
    y += 10 * k;
  }
  for (const n of d.notes) {
    fit(ctx, n, innerW, 17 * k + 4, 9, 500, 0, r);
    ctx.fillStyle = m.dim;
    y += 20 * k + 8;
    ctx.fillText(n, W / 2, y);
  }
  if (y > footTop - 10) r.overflow = true;
  return { canvas, report: r };
}
