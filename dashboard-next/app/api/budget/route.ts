import { NextRequest, NextResponse } from 'next/server';
import { costTracker } from '@/lib/costTracker';

export const dynamic = 'force-dynamic';

export function GET() {
  const limits  = costTracker.getLimits();
  const totals  = costTracker.getSessionTotals();
  return NextResponse.json({
    tokenLimit:       limits.tokenLimit,
    costLimitUsd:     limits.costLimitUsd,
    totalTokens:      totals.inputTokens + totals.outputTokens,
    estimatedCostUsd: totals.estimatedCostUsd,
    calls:            totals.calls,
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as { tokenLimit?: number; costLimitUsd?: number };
  const tokenLimit  = Number(body.tokenLimit  ?? 0);
  const costLimitUsd = Number(body.costLimitUsd ?? 0);
  costTracker.setLimits(tokenLimit, costLimitUsd);
  return NextResponse.json({ ok: true, tokenLimit, costLimitUsd });
}

export async function POST() {
  // Reset limits to unlimited (dismiss budget guard without restarting server)
  costTracker.setLimits(0, 0);
  return NextResponse.json({ ok: true });
}
