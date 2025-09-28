import { NextRequest, NextResponse } from 'next/server';
import { locales } from '@/src/lib/i18n';
import { submitToIndexNow } from '@/src/lib/indexnow';

export async function POST(req: NextRequest) {
  const secret = process.env.INDEXNOW_SECRET;
  const provided = req.headers.get('x-indexnow-secret') || (await req.json().catch(() => ({})))?.secret;

  // Temporary debug logging
  console.log('INDEXNOW_SECRET env:', secret ? 'SET' : 'NOT SET');
  console.log('Provided secret:', provided ? 'PROVIDED' : 'NOT PROVIDED');

  if (!secret || provided !== secret) {
    return NextResponse.json({
      error: 'Unauthorized',
      debug: {
        hasEnvSecret: !!secret,
        hasProvidedSecret: !!provided,
        secretsMatch: secret === provided
      }
    }, { status: 401 });
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ark-fid.ch').replace(/\/$/, '');
  const corePaths = ['/', '/about', '/services', '/ressources', '/contact', '/team'];
  const servicePaths = ['/services/accounting','/services/taxes','/services/payroll','/services/incorporation','/services/outsourcing','/services/corporate','/services/domiciliation','/services/odoo'];
  const paths = [...corePaths, ...servicePaths];
  const urls = locales.flatMap((loc) => paths.map((p) => `${base}/${loc}${p === '/' ? '' : p}`));

  try {
    await submitToIndexNow(urls);
    return NextResponse.json({ ok: true, count: urls.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'IndexNow error' }, { status: 500 });
  }
}
