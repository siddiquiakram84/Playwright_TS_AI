import { NextRequest, NextResponse } from 'next/server';
import { guard, MAX_TEXT_BYTES, MAX_EXCEL_BYTES } from '@/lib/apiGuard';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300; // 5 min — long-running pipeline

export async function POST(req: NextRequest) {
  // ── Security gate ──────────────────────────────────────────────────────────
  const blocked = guard(req);
  if (blocked) return blocked;

  try {
    const ct = req.headers.get('content-type') ?? '';

    let source: string;
    let text: string | undefined;
    let excelBuffer: Buffer | undefined;
    let runTests = true;

    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      source   = String(form.get('source') ?? 'excel');
      runTests = form.get('runTests') !== 'false';

      const file = form.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

      if (file.size > MAX_EXCEL_BYTES) {
        return NextResponse.json(
          { error: `Excel file too large (max ${MAX_EXCEL_BYTES / 1_048_576} MB)` },
          { status: 413 },
        );
      }

      excelBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await req.json() as { source?: string; input?: string; runTests?: boolean };
      source   = body.source ?? 'story';
      text     = body.input;
      runTests = body.runTests !== false;

      if (!text) return NextResponse.json({ error: 'input required' }, { status: 400 });

      if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) {
        return NextResponse.json(
          { error: `Input too large (max ${MAX_TEXT_BYTES / 1_000} KB)` },
          { status: 413 },
        );
      }
    }

    const { automationOrchestrator } = await import('@core/ai/AutomationOrchestrator');

    const result = await automationOrchestrator.run({
      source:      source as import('@core/ai/AutomationOrchestrator').OrchestratorSource,
      text,
      excelBuffer,
      runTests,
    });

    return NextResponse.json({
      ok:            true,
      sessionId:     result.sessionId,
      filename:      result.spec.filename,
      testCount:     result.spec.testCount,
      passed:        result.execution?.passed    ?? 0,
      failed:        result.execution?.failed    ?? 0,
      healedCount:   result.execution?.healedCount ?? 0,
      tickets:       result.tickets,
      summaryTicket: result.summaryTicket,
      timeline:      result.timeline,
    });

  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
