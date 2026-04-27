import { NextResponse } from 'next/server';
import { costTracker }  from '@/lib/costTracker';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Lazy-import so the AI stack isn't loaded unless needed
  const { aiResponseCache } = await import('../../../../core/ai/ops/AIResponseCache');
  return NextResponse.json({
    ...costTracker.getSessionTotals(),
    ...costTracker.getLimits(),
    responseCache: aiResponseCache.stats(),
  });
}
