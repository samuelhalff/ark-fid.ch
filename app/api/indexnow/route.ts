import { NextResponse } from 'next/server';
import {
  checkIndexNowSecret,
  parseIndexNowUrls,
  submitToIndexNow,
} from '@/src/lib/indexnow';

export async function POST(req: Request) {
  try {
    // Authenticate before reading the body.
    const auth = checkIndexNowSecret(
      req.headers.get('x-indexnow-secret'),
      process.env.INDEXNOW_SECRET,
    );
    if (auth === 'misconfigured') {
      return NextResponse.json({ error: 'missing_configuration' }, { status: 500 });
    }
    if (auth === 'unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = parseIndexNowUrls((body as { urls?: unknown })?.urls);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_urls' }, { status: 400 });
    }
    await submitToIndexNow(parsed.urls);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'IndexNow error' }, { status: 500 });
  }
}
