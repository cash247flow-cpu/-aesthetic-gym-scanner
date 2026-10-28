// Certificate renderer — draws a personalized AESTHETIQ certificate onto a canvas at the exact
// export size (Instagram story 1080×1920, portrait 1080×1350, square 1080×1080). The on-screen
// preview is this same canvas, so what you see is exactly what gets saved or shared.
//
// Design follows the provided Strength Conqueror artwork (gold = the reference): cinematic black
// backdrop with light rays, framed border, monumental metallic serif titles, the winged emblem
// (cropped from the artwork; silver/platinum are recoloured copies), a four-column record panel,
// the declaration, and the footer "STRENGTH IS EARNED. NEVER GIVEN." All text is drawn live from
// the achievement — nothing is baked into the background image.

import QRCode from "qrcode";
import { FAMILIES, FOOTER, TIERS, type Tier } from "@/lib/achievements/config";
import type { Achievement } from "@/lib/achievements/detect";
import { columns, fmtDate, type Unit } from "@/lib/achievements/format";

export type CertFormat = "story" | "portrait" | "square";
export const FORMATS: Record<CertFormat, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: "Story 1080×1920" },
  portrait: { w: 1080, h: 1350, label: "Portrait 1080×1350" },
  square: { w: 1080, h: 1080, label: "Square 1080×1080" },
};

export type CertOptions = {
  unit: Unit;
  name: string | null; // null = name hidden
  showExercise: boolean;
  showPerformance: boolean;
  showDate: boolean;
  showMeasurements: boolean;
  coach: string | null;
  qr: { url: string; caption: string } | null;
};

export type RenderReport = { overflow: boolean; shrunkText: string[]; emblemH: number };

export const SERIF = "Cinzel, 'Times New Roman', serif";

export const METAL: Record<Tier, { stops: string[]; line: string; glow: string; bg: [string, string, string]; ray: string; text: string; dim: string }> = {
  gold: {
    stops: ["#fff7d6", "#f3d58a", "#c99a3e", "#fbe7a8", "#9b6a1f"],
    line: "#c9a14f",
    glow: "rgba(255,196,92,0.45)",
    bg: ["#0b0906", "#050403", "#120d07"],
    ray: "rgba(255,206,120,0.10)",
    text: "#f4dc9a",
    dim: "#b89a5c",
  },
  silver: {
    stops: ["#ffffff", "#dde1e6", "#8e959f", "#f1f3f6", "#5f6670"],
    line: "#a7adb6",
    glow: "rgba(220,228,240,0.35)",
    bg: ["#16181c", "#0b0c0e", "#1c1f24"],
    ray: "rgba(230,236,245,0.08)",
    text: "#e7eaee",
    dim: "#9aa1ab",
  },
  platinum: {
    stops: ["#ffffff", "#e9eff8", "#a8b3c6", "#f7faff", "#6f7a8f"],
    line: "#c6d0e0",
    glow: "rgba(200,220,255,0.45)",
    bg: ["#05070b", "#010204", "#0a0d14"],
    ray: "rgba(200,220,255,0.10)",
    text: "#eef3fb",
    dim: "#a9b4c7",
  },
};

let fontReady: Promise<void> | null = null;
export function loadFont(): Promise<void> {
  fontReady ??= (async () => {
    try {
      const face = new FontFace("Cinzel", "url(/fonts/Cinzel.ttf)", { weight: "400 900" });
      document.fonts.add(await face.load());
    } catch {
      /* falls back to a system serif */
    }
  })();
  return fontReady;
}

const images = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  if (!images.has(src)) {
    images.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Couldn't load ${src}`));
        img.src = src;
      }),
    );
  }
  return images.get(src)!;
}

// ─── drawing helpers ────────────────────────────────────────────────────
export type Ctx = CanvasRenderingContext2D;

export function setFont(ctx: Ctx, size: number, weight = 600) {
  ctx.font = `${weight} ${size}px ${SERIF}`;
}

export function spacedWidth(ctx: Ctx, text: string, spacing: number) {
  return ctx.measureText(text).width + spacing * Math.max(0, [...text].length - 1);
}

/** Text with letter-spacing, drawn char by char so it works in every browser. */
export function spaced(ctx: Ctx, text: string, x: number, y: number, spacing: number, align: "center" | "left" | "right" = "center") {
  const w = spacedWidth(ctx, text, spacing);
  let cx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = prev;
}

/** Largest font size (down to min) at which the text fits the width. */
export function fit(ctx: Ctx, text: string, maxW: number, size: number, min: number, weight: number, spacing = 0, report?: RenderReport): number {
  let s = size;
  setFont(ctx, s, weight);
  while (s > min && spacedWidth(ctx, text, spacing * (s / size)) > maxW) {
    s -= 1;
    setFont(ctx, s, weight);
  }
  if (s < size && report) report.shrunkText.push(text);
  if (spacedWidth(ctx, text, spacing * (s / size)) > maxW + 1 && report) report.overflow = true;
  return s;
}

export function metalFill(ctx: Ctx, tier: Tier, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  const stops = METAL[tier].stops;
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

/** Monumental metallic title line with depth: dark extrusion, gradient face, soft glow. */
export function metalText(ctx: Ctx, text: string, cx: number, baseline: number, size: number, tier: Tier, spacing: number) {
  setFont(ctx, size, 800);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  for (let d = 1; d <= 5; d++) spaced(ctx, text, cx + d * 0.6, baseline + d, spacing);
  ctx.shadowColor = METAL[tier].glow;
  ctx.shadowBlur = size * 0.35;
  ctx.fillStyle = metalFill(ctx, tier, baseline - size * 0.85, baseline + size * 0.1);
  spaced(ctx, text, cx, baseline, spacing);
  ctx.restore();
}

export function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxW || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function rule(ctx: Ctx, x0: number, x1: number, y: number, color: string, alpha = 1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.5, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x0, y - 1, x1 - x0, 2);
  ctx.restore();
}

/** The AESTHETIQ double chevron mark. */
export function chevron(ctx: Ctx, cx: number, top: number, size: number, tier: Tier) {
  ctx.save();
  ctx.strokeStyle = metalFill(ctx, tier, top, top + size);
  ctx.lineWidth = size * 0.12;
  ctx.lineJoin = "miter";
  for (const k of [0, 0.42]) {
    ctx.beginPath();
    ctx.moveTo(cx - size * (0.62 - k * 0.5), top + size * (0.75 + k * 0.1));
    ctx.lineTo(cx, top + size * k * 0.55);
    ctx.lineTo(cx + size * (0.62 - k * 0.5), top + size * (0.75 + k * 0.1));
    ctx.stroke();
  }
  ctx.restore();
}

export function diamond(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.7, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.7, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function background(ctx: Ctx, W: number, H: number, tier: Tier) {
  const m = METAL[tier];
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, m.bg[0]);
  g.addColorStop(0.55, m.bg[1]);
  g.addColorStop(1, m.bg[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Light rays from the top corners.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [x, dir] of [
    [0, 1],
    [W, -1],
  ] as const) {
    for (let i = 0; i < 4; i++) {
      const rg = ctx.createLinearGradient(x, 0, x + dir * W * 0.7, H * 0.55);
      rg.addColorStop(0, m.ray);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(x, H * (0.02 + i * 0.07));
      ctx.lineTo(x + dir * W * (0.75 - i * 0.08), H * (0.42 + i * 0.05));
      ctx.lineTo(x + dir * W * (0.6 - i * 0.08), H * (0.5 + i * 0.05));
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  // Floor sheen and vignette.
  const fl = ctx.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, W * 0.7);
  fl.addColorStop(0, m.ray);
  fl.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fl;
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

export function frame(ctx: Ctx, W: number, H: number, tier: Tier) {
  const m = METAL[tier];
  ctx.save();
  ctx.strokeStyle = m.line;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  ctx.strokeRect(42, 42, W - 84, H - 84);
  ctx.restore();
  for (const [x, y] of [
    [28, 28],
    [W - 28, 28],
    [28, H - 28],
    [W - 28, H - 28],
  ]) {
    diamond(ctx, x, y, 12, m.line);
    if (tier === "platinum") diamond(ctx, x, y, 5, "#ffffff");
  }
  if (tier === "platinum") {
    // Diamond-cut accents along the frame.
    for (let i = 1; i < 6; i++) {
      diamond(ctx, (W * i) / 6, 28, 6, "rgba(235,242,255,0.9)");
      diamond(ctx, (W * i) / 6, H - 28, 6, "rgba(235,242,255,0.9)");
    }
  }
}

export function ribbon(ctx: Ctx, cx: number, y: number, text: string, size: number, tier: Tier, maxW: number, report: RenderReport) {
  const s = fit(ctx, text, maxW - 120, size, 14, 700, size * 0.32, report);
  const w = spacedWidth(ctx, text, s * 0.32) + 110;
  const h = s * 2.1;
  ctx.save();
  ctx.fillStyle = metalFill(ctx, tier, y - h / 2, y + h / 2);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y);
  ctx.lineTo(cx - w / 2 + h * 0.45, y - h / 2);
  ctx.lineTo(cx + w / 2 - h * 0.45, y - h / 2);
  ctx.lineTo(cx + w / 2, y);
  ctx.lineTo(cx + w / 2 - h * 0.45, y + h / 2);
  ctx.lineTo(cx - w / 2 + h * 0.45, y + h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#14100a";
  setFont(ctx, s, 700);
  ctx.textBaseline = "middle";
  spaced(ctx, text, cx, y + 1, s * 0.32);
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

// Small line icons for the four columns.
export function icon(ctx: Ctx, kind: number, cx: number, cy: number, s: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = "round";
  if (kind === 0) {
    ctx.fillRect(cx - s * 0.55, cy - s * 0.3, s * 0.14, s * 0.6);
    ctx.fillRect(cx + s * 0.41, cy - s * 0.3, s * 0.14, s * 0.6);
    ctx.fillRect(cx - s * 0.35, cy - s * 0.2, s * 0.1, s * 0.4);
    ctx.fillRect(cx + s * 0.25, cy - s * 0.2, s * 0.1, s * 0.4);
    ctx.fillRect(cx - s * 0.25, cy - s * 0.05, s * 0.5, s * 0.1);
  } else if (kind === 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 2) {
    [0.25, 0.5, 0.8].forEach((h, i) => ctx.fillRect(cx - s * 0.45 + i * s * 0.33, cy + s * 0.4 - s * h, s * 0.22, s * h));
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy + s * 0.4);
    ctx.lineTo(cx + s * 0.4, cy - s * 0.4);
    ctx.moveTo(cx + s * 0.05, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.4, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.4, cy - s * 0.05);
    ctx.stroke();
  }
  ctx.restore();
}

const recipientLine = (a: Achievement) =>
  a.type === "first-pr"
    ? "SET A FIRST PERSONAL RECORD"
    : a.family === "conqueror" && a.type !== "volume-milestone"
      ? "ESTABLISHED A NEW PERSONAL RECORD"
      : a.family === "transformation"
        ? "REACHED A TRANSFORMATION MILESTONE"
        : "REACHED A NEW MILESTONE";

/**
 * Draw the certificate. Layout is a top-to-bottom flow sized for the format; if it would run
 * past the bottom, the emblem shrinks until everything fits (and the report says so).
 */
export async function renderCertificate(a: Achievement, opts: CertOptions, format: CertFormat): Promise<{ canvas: HTMLCanvasElement; report: RenderReport }> {
  await loadFont();
  const emblem = await loadImage(`/achievements/emblem-${a.tier}.webp`);
  const qrCanvas = opts.qr ? await qrToCanvas(opts.qr.url) : null;
  const { w: W, h: H } = FORMATS[format];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const tier = a.tier;
  const m = METAL[tier];
  const story = format === "story";
  const square = format === "square";
  const fam = FAMILIES[a.family];
  const titleWords = a.title.toUpperCase().split(" ");
  const tm = a.title === fam.title ? "™" : "";
  const titleLines = titleWords.length > 1 ? [titleWords.slice(0, -1).join(" "), titleWords.at(-1)! + tm] : [titleWords[0] + tm];
  const cols = columns(a, opts.unit, { exercise: opts.showExercise, performance: opts.showPerformance, measurements: opts.showMeasurements });
  const [decl1, decl2] = (() => {
    const parts = a.declaration.split(/(?<=\.)\s+/);
    return [parts[0], parts.slice(1).join(" ")];
  })();

  // Per-format sizes (px at 1080 wide).
  const S = story
    ? { pad: 70, brand: 30, series: 26, t1: 150, t2: 118, rib: 28, emblem: 560, name: 74, line: 22, colLabel: 18, colVal: 27, colH: 230, decl: 44, foot: 26, gap: 26 }
    : format === "portrait"
      ? { pad: 64, brand: 24, series: 20, t1: 108, t2: 86, rib: 22, emblem: 300, name: 56, line: 18, colLabel: 15, colVal: 23, colH: 190, decl: 32, foot: 21, gap: 16 }
      : { pad: 60, brand: 20, series: 17, t1: 86, t2: 70, rib: 18, emblem: 190, name: 46, line: 15, colLabel: 13, colVal: 20, colH: 160, decl: 26, foot: 17, gap: 11 };

  const report: RenderReport = { overflow: false, shrunkText: [], emblemH: S.emblem };
  const cx = W / 2;
  const innerW = W - S.pad * 2;

  const flow = (draw: boolean, emblemH: number): number => {
    const r: RenderReport = draw ? report : { overflow: false, shrunkText: [], emblemH };
    if (draw) {
      background(ctx, W, H, tier);
      frame(ctx, W, H, tier);
    }
    let y = S.pad + 6;

    // Brand header.
    if (draw) chevron(ctx, cx, y, S.brand * 1.3, tier);
    y += S.brand * 1.3 + S.gap * 0.7 + S.brand;
    if (draw) {
      setFont(ctx, S.brand, 600);
      ctx.fillStyle = m.text;
      spaced(ctx, "AESTHETIQ™", cx, y, S.brand * 0.55);
    }
    y += S.brand * 0.9;
    if (draw) {
      setFont(ctx, S.brand * 0.42, 500);
      ctx.fillStyle = m.dim;
      spaced(ctx, "BUILD YOUR IDEAL PHYSIQUE", cx, y, S.brand * 0.3);
      if (story) {
        setFont(ctx, 15, 500);
        ctx.fillStyle = m.dim;
        ["STRENGTH", "DISCIPLINE", "PROGRESS"].forEach((t, i) => spaced(ctx, t, S.pad + 4, S.pad + 18 + i * 24, 5, "left"));
        ["A STRONGER", "YOU BUILDS", "A BRIGHTER", "TOMORROW"].forEach((t, i) => spaced(ctx, t, W - S.pad - 4, S.pad + 18 + i * 24, 5, "right"));
      }
      rule(ctx, S.pad, W - S.pad, y + S.gap * 0.8, m.line, 0.7);
    }
    y += S.gap * 1.6 + S.series;

    // Series, title, ribbon.
    const seriesText = `${fam.series.toUpperCase()}™`;
    const ss = fit(ctx, seriesText, innerW, S.series, 12, 600, S.series * 0.4, r);
    if (draw) {
      ctx.fillStyle = m.text;
      setFont(ctx, ss, 600);
      spaced(ctx, seriesText, cx, y, ss * 0.4);
    }
    y += S.gap * 0.6;
    const t1 = fit(ctx, titleLines[0], innerW, S.t1, 40, 800, S.t1 * 0.02, r);
    y += t1 * 0.92;
    if (draw) metalText(ctx, titleLines[0], cx, y, t1, tier, t1 * 0.02);
    if (titleLines[1]) {
      const t2 = fit(ctx, titleLines[1], innerW, S.t2, 34, 800, S.t2 * 0.02, r);
      y += t2 * 1.0;
      if (draw) metalText(ctx, titleLines[1], cx, y, t2, tier === "gold" ? "silver" : tier, t2 * 0.02);
    }
    y += S.rib * 1.6 + S.gap * 0.4;
    if (draw) ribbon(ctx, cx, y, a.subtitle.toUpperCase(), S.rib, tier, innerW, r);
    y += S.rib * 1.2 + S.gap * 0.5;

    // Emblem.
    const eh = emblemH;
    const ew = eh * (emblem.width / emblem.height);
    if (draw) {
      ctx.save();
      ctx.shadowColor = m.glow;
      ctx.shadowBlur = eh * 0.12;
      ctx.drawImage(emblem, cx - ew / 2, y, ew, eh);
      ctx.restore();
    }
    y += eh + S.gap * 0.5;
    if (draw) {
      setFont(ctx, S.line * 0.85, 600);
      ctx.fillStyle = m.dim;
      spaced(ctx, `${tier.toUpperCase()} · ${TIERS[tier].collection.toUpperCase()}`, cx, y + S.line * 0.4, S.line * 0.35);
    }
    y += S.line * 1.2 + S.gap * 0.6;

    // Recipient.
    if (opts.name) {
      const ns = fit(ctx, opts.name.toUpperCase(), innerW, S.name, 22, 700, S.name * 0.03, r);
      y += ns * 0.9;
      if (draw) {
        ctx.save();
        ctx.fillStyle = metalFill(ctx, tier, y - ns * 0.8, y + ns * 0.1);
        ctx.shadowColor = m.glow;
        ctx.shadowBlur = 18;
        setFont(ctx, ns, 700);
        spaced(ctx, opts.name.toUpperCase(), cx, y, ns * 0.03);
        ctx.restore();
      }
      y += S.gap * 0.6;
    }
    const rl = recipientLine(a);
    const rs = fit(ctx, rl, innerW, S.line, 11, 500, S.line * 0.45, r);
    y += rs;
    if (draw) {
      ctx.fillStyle = "#f2efe8";
      setFont(ctx, rs, 500);
      spaced(ctx, rl, cx, y, rs * 0.45);
    }
    y += S.gap;

    // Four-column record panel.
    const px = S.pad - 8;
    const pw = W - px * 2;
    const colW = pw / 4;
    if (draw) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(px, y, pw, S.colH);
      ctx.strokeStyle = m.line;
      ctx.lineWidth = 2;
      ctx.strokeRect(px, y, pw, S.colH);
      ctx.globalAlpha = 0.5;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(px + colW * i, y + 16);
        ctx.lineTo(px + colW * i, y + S.colH - 16);
        ctx.stroke();
      }
      ctx.restore();
    }
    cols.forEach((c, i) => {
      const ccx = px + colW * i + colW / 2;
      const top = y + S.colH * 0.08;
      const iconS = S.colLabel * 2;
      if (draw) icon(ctx, i, ccx, top + iconS / 2, iconS, m.text);
      const labelY = top + iconS + S.colLabel * 1.5;
      const label = c.label.toUpperCase();
      const ls = fit(ctx, label, colW - 18, S.colLabel, 9, 600, S.colLabel * 0.2, r);
      if (draw) {
        ctx.fillStyle = "#f2efe8";
        setFont(ctx, ls, 600);
        spaced(ctx, label, ccx, labelY, ls * 0.2);
        rule(ctx, ccx - colW * 0.3, ccx + colW * 0.3, labelY + ls * 0.8, m.line, 0.8);
      }
      // Value: wrap to at most 3 lines, shrinking if needed.
      let vs = S.colVal;
      let lines: string[] = [];
      for (; vs >= 12; vs--) {
        setFont(ctx, vs, 500);
        lines = wrap(ctx, c.value, colW - 22);
        const tooWide = lines.some((l) => ctx.measureText(l).width > colW - 20);
        const room = y + S.colH - (labelY + ls * 1.6) - 8;
        if (lines.length <= 3 && !tooWide && lines.length * vs * 1.2 <= room) break;
      }
      if (vs < S.colVal) r.shrunkText.push(c.value);
      if (vs < 12) r.overflow = true;
      if (draw) {
        ctx.fillStyle = c.private ? m.dim : m.text;
        setFont(ctx, vs, c.private ? 500 : 600);
        ctx.textAlign = "center";
        const startY = labelY + ls * 1.6 + vs;
        lines.forEach((l, k) => ctx.fillText(l, ccx, startY + k * vs * 1.2));
        ctx.textAlign = "left";
      }
    });
    y += S.colH + S.gap * 0.9;

    // Earned on.
    if (opts.showDate) {
      y += S.line;
      if (draw) {
        const d = fmtDate(a.date).toUpperCase();
        setFont(ctx, S.line * 0.8, 500);
        const lw = spacedWidth(ctx, "EARNED ON", S.line * 0.35);
        setFont(ctx, S.line * 1.15, 700);
        const dw = spacedWidth(ctx, d, S.line * 0.08);
        const total = lw + 24 + dw;
        const x0 = cx - total / 2;
        setFont(ctx, S.line * 0.8, 500);
        ctx.fillStyle = "#f2efe8";
        spaced(ctx, "EARNED ON", x0, y, S.line * 0.35, "left");
        setFont(ctx, S.line * 1.15, 700);
        ctx.fillStyle = m.text;
        spaced(ctx, d, x0 + lw + 24, y, S.line * 0.08, "left");
      }
      y += S.gap * 0.9;
    }
    if (draw) rule(ctx, S.pad, W - S.pad, y, m.line, 0.7);
    y += S.gap * 0.8;

    // Declaration.
    const d1 = fit(ctx, decl1, innerW, S.decl, 16, 600, S.decl * 0.18, r);
    y += d1;
    if (draw) {
      ctx.fillStyle = "#f5f2ea";
      setFont(ctx, d1, 600);
      spaced(ctx, decl1, cx, y, d1 * 0.18);
    }
    if (decl2) {
      const d2 = fit(ctx, decl2, innerW, S.decl, 16, 700, S.decl * 0.18, r);
      y += d2 * 1.15;
      if (draw) {
        ctx.fillStyle = metalFill(ctx, tier, y - d2, y);
        setFont(ctx, d2, 700);
        spaced(ctx, decl2, cx, y, d2 * 0.18);
      }
    }
    y += S.gap * 0.8;
    if (opts.coach) {
      const ct = `COACHED BY ${opts.coach.toUpperCase()}`;
      const cs = fit(ctx, ct, innerW, S.line * 0.9, 10, 600, S.line * 0.3, r);
      y += cs;
      if (draw) {
        ctx.fillStyle = m.dim;
        setFont(ctx, cs, 600);
        spaced(ctx, ct, cx, y, cs * 0.3);
      }
      y += S.gap * 0.6;
    }
    if (draw) rule(ctx, S.pad, W - S.pad, y, m.line, 0.5);

    // Footer: brand mark + "STRENGTH IS EARNED. NEVER GIVEN." (+ QR on the right if chosen).
    const qrSize = qrCanvas ? (story ? 170 : square ? 116 : 130) : 0;
    const footTop = H - S.pad - Math.max(qrSize + (qrCanvas ? 26 : 0), S.foot * 3.6);
    if (y > footTop - 6) r.overflow = true;
    if (draw) {
      const fx = qrCanvas ? (W - qrSize - S.pad) / 2 + 6 : cx;
      chevron(ctx, fx, footTop, S.foot * 1.1, tier);
      setFont(ctx, S.foot * 0.9, 600);
      ctx.fillStyle = m.text;
      spaced(ctx, "AESTHETIQ™", fx, footTop + S.foot * 2.15, S.foot * 0.45);
      const fs = fit(ctx, FOOTER, (qrCanvas ? W - qrSize - S.pad * 2 - 20 : innerW), S.foot * 0.78, 10, 700, S.foot * 0.22, r);
      ctx.fillStyle = metalFill(ctx, tier, footTop + S.foot * 2.4, footTop + S.foot * 3.4);
      setFont(ctx, fs, 700);
      spaced(ctx, FOOTER, fx, footTop + S.foot * 3.35, fs * 0.22);
      if (qrCanvas && opts.qr) {
        const qx = W - S.pad - qrSize;
        const qy = H - S.pad - qrSize - 22;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(qx - 8, qy - 8, qrSize + 16, qrSize + 16);
        ctx.drawImage(qrCanvas, qx, qy, qrSize, qrSize);
        ctx.strokeStyle = m.line;
        ctx.lineWidth = 2;
        ctx.strokeRect(qx - 12, qy - 12, qrSize + 24, qrSize + 24);
        setFont(ctx, story ? 15 : 12, 600);
        ctx.fillStyle = m.text;
        spaced(ctx, opts.qr.caption.toUpperCase(), qx + qrSize / 2, H - S.pad + 6, 3);
      }
    }
    return footTop - y; // spare room (negative = overflow)
  };

  // Shrink the emblem until the flow fits above the footer.
  let emblemH = S.emblem;
  while (flow(false, emblemH) < 6 && emblemH > S.emblem * 0.45) emblemH -= 10;
  report.emblemH = emblemH;
  flow(true, emblemH);
  return { canvas, report };
}

/** Real, scannable QR code (error correction M, quiet zone included). */
export async function qrToCanvas(url: string): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  await QRCode.toCanvas(c, url, { errorCorrectionLevel: "M", margin: 2, width: 400, color: { dark: "#000000", light: "#ffffff" } });
  return c;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png"));
}
