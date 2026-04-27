import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Lazy-import to avoid loading the heavy AI stack unless actually called
async function getGenerator() {
  const { TestGenerator } = await import('../../../../core/ai/TestGenerator');
  return new TestGenerator();
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { source?: string; input?: string };
  const { source = 'story', input = '' } = body;

  if (!input.trim()) {
    return NextResponse.json({ error: 'input is required' }, { status: 400 });
  }

  try {
    const gen = await getGenerator();
    let result: { filename: string; testCount: number };

    switch (source) {
      case 'json-tc':
        result = await gen.fromJsonTestCases(input);
        break;
      case 'txt-tc':
        result = await gen.fromManualTxt(input);
        break;
      case 'squishtest':
        result = await gen.fromSquishStory(input);
        break;
      case 'nl':
        result = await gen.fromNaturalLanguage(input);
        break;
      default:
        result = await gen.fromUserStory(input);
    }

    return NextResponse.json({ ok: true, filename: result.filename, testCount: result.testCount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
