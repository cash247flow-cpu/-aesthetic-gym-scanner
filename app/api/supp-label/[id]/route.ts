import { NextResponse } from "next/server";
import { newRequestId, safeLog } from "@/lib/aiSafety";
import { getLabel } from "@/lib/dsld";

export const dynamic = "force-dynamic";

// GET /api/supp-label/82118 — one label's supplement facts.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!/^\d{1,9}$/.test(raw) || id <= 0) {
    return NextResponse.json({ error: "Bad label id." }, { status: 400 });
  }
  try {
    const label = await getLabel(id);
    if (!label) return NextResponse.json({ error: "Label not found." }, { status: 404 });
    return NextResponse.json(label);
  } catch (err) {
    safeLog("error", { tag: "supp-label", requestId: newRequestId(), category: "upstream_error", status: (err as { status?: number }).status });
    return NextResponse.json({ error: "Couldn't reach the NIH label database. Try again in a moment." }, { status: 502 });
  }
}
