import { NextResponse } from 'next/server';
import { costTracker }  from '@/lib/costTracker';
import { getLLMCallStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { aiResponseCache } = await import('../../../../core/ai/ops/AIResponseCache');
  const live = costTracker.getSessionTotals();

  // If in-memory tracker is empty (fresh start / server restart), read from DB
  let calls            = live.calls;
  let inputTokens      = live.inputTokens;
  let outputTokens     = live.outputTokens;
  let cacheHitTokens   = live.cacheHitTokens;
  let estimatedCostUsd = live.estimatedCostUsd;

  if (calls === 0) {
    try {
      const rows = getLLMCallStats() as Array<{
        total_calls: number; total_tokens: number; total_cost: number;
      }>;
      for (const row of rows) {
        calls            += row.total_calls  ?? 0;
        estimatedCostUsd += row.total_cost   ?? 0;
        // total_tokens = input + output (as stored by getLLMCallStats)
        inputTokens      += Math.round((row.total_tokens ?? 0) * 0.7);
        outputTokens     += Math.round((row.total_tokens ?? 0) * 0.3);
      }
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    calls,
    inputTokens,
    outputTokens,
    cacheHitTokens,
    estimatedCostUsd,
    ...costTracker.getLimits(),
    responseCache: aiResponseCache.stats(),
  });
}
