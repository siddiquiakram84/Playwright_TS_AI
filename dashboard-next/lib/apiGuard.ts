import { NextRequest, NextResponse } from 'next/server';

// ── Rate limiter — in-memory, per-IP ─────────────────────────────────────────

interface RateWindow {
  count:   number;
  resetAt: number;
}

const RATE_WINDOWS = new Map<string, RateWindow>();
const RATE_LIMIT   = 5;          // max requests
const WINDOW_MS    = 60_000;     // per 60 s

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const win = RATE_WINDOWS.get(ip);

  if (!win || now > win.resetAt) {
    RATE_WINDOWS.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (win.count >= RATE_LIMIT) return false;
  win.count++;
  return true;
}

// ── Bearer-token auth ─────────────────────────────────────────────────────────

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret === 'changeme') return true; // guard skipped when not configured

  const auth = req.headers.get('x-admin-secret') ?? req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  return token === secret;
}

// ── Unified guard — call at the top of every protected route ──────────────────

export function guard(req: NextRequest): NextResponse | null {
  // 1. Auth
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Rate limit (keyed by X-Forwarded-For or remote address)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: `Rate limit exceeded — max ${RATE_LIMIT} requests per minute` },
      { status: 429 },
    );
  }

  return null; // all clear
}

// ── Input size limits ─────────────────────────────────────────────────────────

export const MAX_TEXT_BYTES   = 20_000;  // 20 KB — enough for any realistic story/JSON
export const MAX_EXCEL_BYTES  = 5_242_880; // 5 MB
