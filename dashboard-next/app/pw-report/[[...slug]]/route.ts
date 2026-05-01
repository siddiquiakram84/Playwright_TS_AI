/**
 * Serves the Playwright HTML report from dashboard/playwright/report/.
 * Access: http://localhost:9094/pw-report
 */
import { NextRequest } from 'next/server';
import * as fs   from 'fs';
import * as path from 'path';
import { PROJECT_ROOT } from '@core/utils/envConfig';

export const dynamic = 'force-dynamic';

const REPORT_DIR = path.join(PROJECT_ROOT, 'dashboard', 'playwright', 'report');

const MIME: Record<string, string> = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.png':   'image/png',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff':  'font/woff',
  '.ttf':   'font/ttf',
  '.zip':   'application/zip',
  '.webm':  'video/webm',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  const sub  = slug?.join('/') || 'index.html';
  const file = path.resolve(REPORT_DIR, sub);

  if (!file.startsWith(REPORT_DIR)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(file)) {
    const noReport = !fs.existsSync(path.join(REPORT_DIR, 'index.html'));
    return new Response(
      noReport
        ? 'Playwright report not generated yet.\n\nRun: npm run test'
        : 'File not found',
      { status: 404, headers: { 'Content-Type': 'text/plain' } },
    );
  }

  const ext  = path.extname(file).toLowerCase();
  const ct   = MIME[ext] ?? 'application/octet-stream';
  const body = fs.readFileSync(file);
  return new Response(body, {
    headers: { 'Content-Type': ct, 'Cache-Control': 'no-store' },
  });
}
