import { NextResponse } from "next/server";
import { buildPlan, isSessionKey } from "@/lib/plan";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { session, equipment } = (body ?? {}) as { session?: unknown; equipment?: unknown };
  if (!isSessionKey(session)) {
    return NextResponse.json({ error: 'session must be "push", "pull" or "legs".' }, { status: 400 });
  }
  if (!Array.isArray(equipment)) {
    return NextResponse.json({ error: "equipment must be an array of strings." }, { status: 400 });
  }

  return NextResponse.json(buildPlan(session, equipment));
}
