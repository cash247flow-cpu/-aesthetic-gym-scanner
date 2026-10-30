import { NextResponse } from "next/server";
import { buildPlan, isSessionKey } from "@/lib/plan";
import { normalizeEquipment } from "@/lib/equipment";
import { readCapped } from "@/lib/aiSafety";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_ITEMS = 40;
const MAX_ITEM_CHARS = 60;

export async function POST(req: Request) {
  const raw = await readCapped(req, MAX_BODY_BYTES);
  if (!raw) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { session, equipment, withAbs } = (body ?? {}) as { session?: unknown; equipment?: unknown; withAbs?: unknown };
  if (!isSessionKey(session)) {
    return NextResponse.json({ error: 'session must be "push", "pull", "legs", "pump", "abs" or "forearms".' }, { status: 400 });
  }
  if (
    !Array.isArray(equipment) ||
    equipment.length > MAX_ITEMS ||
    !equipment.every((e) => typeof e === "string" && e.length <= MAX_ITEM_CHARS)
  ) {
    return NextResponse.json({ error: `equipment must be up to ${MAX_ITEMS} short strings.` }, { status: 400 });
  }
  if (withAbs !== undefined && typeof withAbs !== "boolean") {
    return NextResponse.json({ error: "withAbs must be true or false." }, { status: 400 });
  }

  // Only canonical equipment names reach the planner.
  return NextResponse.json(buildPlan(session, normalizeEquipment(equipment), { withAbs: withAbs === true }));
}
