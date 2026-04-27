import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    provider:        process.env.AI_PROVIDER        ?? 'anthropic',
    model:           process.env.AI_MODEL           ?? 'claude-sonnet-4-6',
    fallbackProvider:process.env.AI_FALLBACK_PROVIDER ?? '',
    langsmithEnabled:Boolean(process.env.LANGCHAIN_API_KEY),
    langsmithProject:process.env.LANGCHAIN_PROJECT  ?? '',
    tokenLimit:      parseInt(process.env.AI_TOKEN_LIMIT    ?? '0'),
    costLimitUsd:    parseFloat(process.env.AI_COST_LIMIT_USD ?? '0'),
  });
}
