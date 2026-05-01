import { NextResponse }  from 'next/server';
import { parseResults }  from '@/lib/parseResults';
import { getRecentTestGenSessions } from '@/lib/db';
import * as fs   from 'fs';
import * as path from 'path';
import { PROJECT_ROOT } from '@core/utils/envConfig';

export const dynamic = 'force-dynamic';

export function GET() {
  const base = parseResults();

  // AI pipeline sessions from SQLite
  let pipeline: unknown[] = [];
  try {
    pipeline = getRecentTestGenSessions(20) as unknown[];
  } catch { /* DB might not be ready yet */ }

  // Report availability
  const allureReady   = fs.existsSync(path.join(PROJECT_ROOT, 'dashboard', 'allure',      'report', 'index.html'));
  const pwReportReady = fs.existsSync(path.join(PROJECT_ROOT, 'dashboard', 'playwright',  'report', 'index.html'));

  return NextResponse.json({
    ...base,
    pipeline,
    reports: { allureReady, pwReportReady },
  });
}
