import { NextRequest, NextResponse } from 'next/server';
import { locales } from '@/src/lib/i18n';
import { submitToIndexNow } from '@/src/lib/indexnow';

export async function POST(req: NextRequest) {
  // Simple auth: check for secret header (hardcoded, not sensitive)
  const provided = req.headers.get('x-indexnow-secret');
  const expected = 'arkfid2025';
  
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = 'https://ark-fid.ch';
  const corePaths = ['/', '/about', '/services', '/ressources', '/contact', '/team'];
  const servicePaths = ['/services/accounting','/services/taxes','/services/payroll','/services/incorporation','/services/outsourcing','/services/corporate','/services/domiciliation','/services/odoo','/services/family-office','/services/mergers-acquisitions','/services/immigration'];
  const paths = [...corePaths, ...servicePaths];
  const urls = locales.flatMap((loc) => paths.map((p) => {
    const path = p === '/' ? '' : p;
    const url = `${base}/${loc}${path}`;
    return url.endsWith('/') ? url : `${url}/`;
  }));

  try {
    await submitToIndexNow(urls);
    return NextResponse.json({ ok: true, count: urls.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Search indexing error' }, { status: 500 });
  }
}
