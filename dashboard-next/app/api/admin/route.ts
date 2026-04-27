import { NextRequest, NextResponse } from 'next/server';
import { costTracker } from '@/lib/costTracker';
import { aiEventBus }  from '@/lib/aiEventBus';

export const dynamic = 'force-dynamic';

type AdminAction =
  | { action: 'reset-session' }
  | { action: 'clear-cache'; operation?: string }
  | { action: 'reset-client' }
  | { action: 'switch-provider'; provider: string };

export async function POST(req: NextRequest) {
  let body: AdminAction;
  try { body = await req.json() as AdminAction; }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  switch (body.action) {
    case 'reset-session': {
      costTracker.reset();
      aiEventBus.emitAdmin({ action: 'session-reset', timestamp: Date.now() });
      return NextResponse.json({ ok: true, action: 'reset-session' });
    }

    case 'clear-cache': {
      const { aiResponseCache } = await import('../../../../core/ai/ops/AIResponseCache');
      aiResponseCache.clear(body.operation);
      return NextResponse.json({ ok: true, action: 'clear-cache', operation: body.operation ?? 'all' });
    }

    case 'reset-client': {
      const { AIClient } = await import('../../../../core/ai/AIClient');
      AIClient.reset();
      aiEventBus.emitAdmin({ action: 'client-reset', timestamp: Date.now() });
      return NextResponse.json({ ok: true, action: 'reset-client' });
    }

    case 'switch-provider': {
      const { AIClient } = await import('../../../../core/ai/AIClient');
      const allowed = ['anthropic', 'local'];
      if (!allowed.includes(body.provider)) {
        return NextResponse.json({ error: `provider must be one of: ${allowed.join(', ')}` }, { status: 400 });
      }
      process.env.AI_PROVIDER = body.provider;
      AIClient.reset();
      aiEventBus.emitAdmin({ action: 'provider-switch', provider: body.provider, timestamp: Date.now() });
      return NextResponse.json({ ok: true, action: 'switch-provider', provider: body.provider });
    }

    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
}
