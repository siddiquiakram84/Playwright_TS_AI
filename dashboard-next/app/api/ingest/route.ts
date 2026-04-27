/**
 * Cross-process event forwarder.
 * Playwright test workers (different processes) POST events here.
 * We re-emit them on the in-process aiEventBus so SSE clients receive them.
 */
import { NextRequest, NextResponse } from 'next/server';
import { aiEventBus } from '@/lib/aiEventBus';
import { costTracker } from '@/lib/costTracker';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { event?: string; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { event, data } = body;
  if (!event || !data) return new NextResponse(null, { status: 204 });

  // Accumulate cost in dashboard process's costTracker when a worker finishes an LLM call
  if (event === 'llm:end') {
    const e = data as { provider?: string; inputTokens?: number; outputTokens?: number; cacheHitTokens?: number };
    costTracker.record(
      e.provider      ?? 'ollama',
      e.inputTokens   ?? 0,
      e.outputTokens  ?? 0,
      e.cacheHitTokens ?? 0,
    );
  }

  // Re-emit on the in-process bus — SSE route picks it up
  aiEventBus.emit(event as Parameters<typeof aiEventBus.emit>[0], data);

  return new NextResponse(null, { status: 204 });
}
