import { NextResponse } from "next/server";
import { getStorage, MockStorage, mockStorageEnabled } from "@/src/lib/tax-questionnaire/server/storage";

/**
 * Development only (TAX_QF_STORAGE=mock, never in production): stands in for the SharePoint
 * upload-session URL so the browser upload code (chunked PUT with Content-Range) can be tested
 * end to end without Microsoft 365.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const storage = getStorage();
  if (!mockStorageEnabled() || !(storage instanceof MockStorage)) return new NextResponse("Not found", { status: 404 });
  const { id } = await context.params;
  const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(request.headers.get("content-range") || "");
  if (!range) return NextResponse.json({ error: "range_required" }, { status: 400 });
  const [start, end, total] = range.slice(1).map(Number);
  const chunk = new Uint8Array(await request.arrayBuffer());
  if (chunk.byteLength !== end - start + 1 || chunk.byteLength > 8 * 1024 * 1024) return NextResponse.json({ error: "range_mismatch" }, { status: 400 });
  try {
    const item = await storage.appendChunk(id, start, chunk);
    if (end + 1 < total) return NextResponse.json({ nextExpectedRanges: [`${end + 1}-`] }, { status: 202 });
    return NextResponse.json({ id: item.id, name: item.name, size: item.size }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "upload_failed" }, { status: 416 });
  }
}
