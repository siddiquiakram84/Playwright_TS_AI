import { NextRequest, NextResponse } from 'next/server';
import {
  getRecentLLMCalls,
  getLLMCallStats,
  getRecentTestGenSessions,
  getRecentVisualTests,
  getRecentHealingEvents,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const limit  = parseInt(params.get('limit') ?? '50');
  const type   = params.get('type');

  switch (type) {
    case 'testgen':
      return NextResponse.json({ testgen: getRecentTestGenSessions(limit) });
    case 'visual':
      return NextResponse.json({ visual: getRecentVisualTests(limit) });
    case 'healing':
      return NextResponse.json({ healing: getRecentHealingEvents(limit) });
    default:
      return NextResponse.json({
        calls: getRecentLLMCalls(limit),
        stats: getLLMCallStats(),
      });
  }
}
