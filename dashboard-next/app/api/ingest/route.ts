/**
 * Cross-process event forwarder + SQLite persistence.
 * AI pipeline workers POST events here. We persist to DB, re-emit on SSE bus.
 */
import { NextRequest, NextResponse } from 'next/server';
import { aiEventBus }   from '@/lib/aiEventBus';
import { costTracker }  from '@/lib/costTracker';
import {
  insertLLMCall,
  upsertTestGen,
  insertVisualTest,
  insertHealingEvent,
} from '@/lib/db';

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

  // ── Persist to SQLite ────────────────────────────────────────────────────────
  try {
    if (event === 'llm:end') {
      const e = data as {
        id?: string; provider?: string; operation?: string;
        latencyMs?: number; inputTokens?: number; outputTokens?: number;
        cacheHitTokens?: number; costUsd?: number; success?: boolean; error?: string;
      };
      insertLLMCall({
        callId:       e.id             ?? '',
        provider:     e.provider       ?? 'unknown',
        operation:    e.operation      ?? 'unknown',
        latencyMs:    e.latencyMs,
        inputTokens:  e.inputTokens    ?? 0,
        outputTokens: e.outputTokens   ?? 0,
        cacheTokens:  e.cacheHitTokens ?? 0,
        costUsd:      e.costUsd        ?? 0,
        success:      e.success        ?? true,
        error:        e.error,
      });
      costTracker.record(
        e.provider       ?? 'ollama',
        e.inputTokens    ?? 0,
        e.outputTokens   ?? 0,
        e.cacheHitTokens ?? 0,
      );
    } else if (event === 'testgen') {
      const e = data as {
        sessionId?: string; source?: string; stage?: string;
        input?: string; output?: string; score?: number;
      };
      const stage  = (e.stage ?? 'planning') as string;
      const status: 'pending' | 'complete' | 'error' =
        stage === 'complete' ? 'complete'
        : stage === 'error'  ? 'error'
        : 'pending';
      upsertTestGen({
        sessionId:    e.sessionId ?? '',
        inputType:    e.source    ?? 'story',
        inputText:    stage === 'planning' ? e.input : undefined,
        outputCode:   stage === 'complete' ? e.output : undefined,
        qualityScore: e.score,
        status,
        error:        stage === 'error' ? e.output : undefined,
      });
    } else if (event === 'visual') {
      const e = data as {
        pageName?: string; status?: 'pass' | 'fail';
        diffCount?: number; diffPct?: number; provider?: string;
      };
      insertVisualTest({
        pageName:  e.pageName  ?? 'unknown',
        status:    e.status    ?? 'pass',
        diffCount: e.diffCount ?? 0,
        diffPct:   e.diffPct   ?? 0,
        provider:  e.provider,
      });
    } else if (event === 'heal') {
      const e = data as { originalSel?: string; healedSel?: string; strategy?: string };
      insertHealingEvent({
        originalSel: e.originalSel ?? '',
        healedSel:   e.healedSel   ?? '',
        strategy:    e.strategy,
      });
    }
  } catch { /* non-fatal — DB errors must never interrupt SSE delivery */ }

  // ── Re-emit on in-process bus — SSE clients receive it immediately ───────────
  aiEventBus.emit(event as Parameters<typeof aiEventBus.emit>[0], data);

  return new NextResponse(null, { status: 204 });
}
