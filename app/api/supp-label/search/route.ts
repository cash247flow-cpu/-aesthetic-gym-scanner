import { NextResponse } from "next/server";
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
    console.error("[supp-label] search failed:", err);
    return NextResponse.json({ error: "Couldn't reach the NIH label database. Try again in a moment." }, { status: 502 });
  }
}
