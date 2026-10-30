import { NextResponse } from "next/server";
import { mockStorageEnabled } from "@/src/lib/kyc-questionnaire/server/config";
import type { MockStorage } from "@/src/lib/tax-questionnaire/server/storage";
import { getPorts } from "@/src/lib/kyc-questionnaire/server/sharepoint";

/** Development only (KYC_QF_STORAGE=mock, never in production): stands in for the SharePoint upload-session URL. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const storage = getPorts().storage;
  // Duck-typed: route bundles may hold different copies of the class in development.
  if (!mockStorageEnabled() || storage.kind !== "mock") return new NextResponse("Not found", { status: 404 });
  const { id } = await context.params;
  const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(request.headers.get("content-range") || "");
  if (!range) return NextResponse.json({ error: "range_required" }, { status: 400 });
  const [start, end, total] = range.slice(1).map(Number);
  const chunk = new Uint8Array(await request.arrayBuffer());
  if (chunk.byteLength !== end - start + 1 || chunk.byteLength > 8 * 1024 * 1024) return NextResponse.json({ error: "range_mismatch" }, { status: 400 });
  try {
    const item = await (storage as MockStorage).appendChunk(id, start, chunk);
    if (end + 1 < total) return NextResponse.json({ nextExpectedRanges: [`${end + 1}-`] }, { status: 202 });
    return NextResponse.json({ id: item.id, name: item.name, size: item.size }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "upload_failed" }, { status: 416 });
  }
}
