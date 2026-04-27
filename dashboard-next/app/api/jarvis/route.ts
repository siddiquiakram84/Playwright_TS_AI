import { NextResponse } from 'next/server';
import { parseResults } from '@/lib/parseResults';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(parseResults());
}
