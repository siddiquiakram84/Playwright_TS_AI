import { aiEventBus } from '@/lib/aiEventBus';
import { costTracker } from '@/lib/costTracker';

export const dynamic = 'force-dynamic';

export function GET() {
  const enc = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const push = (event: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // client disconnected — enqueue throws on a closed stream
        }
      };

      // Emit current metrics snapshot on connect
      push('metrics', costTracker.getSessionTotals());

      const onLLMStart = (d: unknown) => push('llm-start',       d);
      const onLLMEnd   = (d: unknown) => push('llm-end',         d);
      const onHealing  = (d: unknown) => push('healing',         d);
      const onVisual   = (d: unknown) => push('visual',          d);
      const onRecorder = (d: unknown) => push('recorder-action', d);
      const onTestGen  = (d: unknown) => push('testgen',         d);
      const onAdmin    = (d: unknown) => push('admin',           d);
      const onBudget   = (d: unknown) => push('budget:exceeded', d);

      aiEventBus.on('llm:start',       onLLMStart);
      aiEventBus.on('llm:end',         onLLMEnd);
      aiEventBus.on('healing',         onHealing);
      aiEventBus.on('visual',          onVisual);
      aiEventBus.on('recorder:action', onRecorder);
      aiEventBus.on('testgen',         onTestGen);
      aiEventBus.on('admin',           onAdmin);
      aiEventBus.on('budget:exceeded', onBudget);

      // Keepalive ping every 25 s — prevents proxies closing idle SSE streams
      const ping        = setInterval(() => {
        try { controller.enqueue(enc.encode(': ping\n\n')); } catch { /* disconnected */ }
      }, 25_000);

      // Push rolling metrics every 60 s as a fallback for clients that miss SSE events
      const metricsTick = setInterval(
        () => push('metrics', costTracker.getSessionTotals()),
        60_000,
      );

      cleanup = () => {
        clearInterval(ping);
        clearInterval(metricsTick);
        aiEventBus.off('llm:start',       onLLMStart);
        aiEventBus.off('llm:end',         onLLMEnd);
        aiEventBus.off('healing',         onHealing);
        aiEventBus.off('visual',          onVisual);
        aiEventBus.off('recorder:action', onRecorder);
        aiEventBus.off('testgen',         onTestGen);
        aiEventBus.off('admin',           onAdmin);
        aiEventBus.off('budget:exceeded', onBudget);
      };
    },

    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream; charset=utf-8',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
