import { NextResponse } from 'next/server';
import { submitToIndexNow } from '@/src/lib/indexnow';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const urls: string[] = Array.isArray(body?.urls) ? body.urls : [];
    if (!urls.length) {
      return NextResponse.json({ error: 'Missing urls[]' }, { status: 400 });
    }
    await submitToIndexNow(urls);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'IndexNow error' }, { status: 500 });
  }
}
