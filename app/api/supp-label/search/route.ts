import { NextResponse } from "next/server";
import { newRequestId, safeLog } from "@/lib/aiSafety";
import { searchLabels } from "@/lib/dsld";

export const dynamic = "force-dynamic";

// GET /api/supp-label/search?q=magnesium+glycinate — product name, brand or barcode.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 100) {
    return NextResponse.json({ error: "Type 2–100 characters to search." }, { status: 400 });
  }
  try {
    return NextResponse.json({ hits: await searchLabels(q) });
  } catch (err) {
    safeLog("error", { tag: "supp-label-search", requestId: newRequestId(), category: "upstream_error", status: (err as { status?: number }).status });
    return NextResponse.json({ error: "Couldn't reach the NIH label database. Try again in a moment." }, { status: 502 });
  }
}
