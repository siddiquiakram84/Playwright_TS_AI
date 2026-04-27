'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import type { SessionMetrics } from '@/types';

const EMPTY: SessionMetrics = {
  calls: 0, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0, estimatedCostUsd: 0,
};

const fetcher = (url: string) => fetch(url).then(r => r.json());

/**
 * Returns current session metrics and a push() function to apply SSE updates.
 * SWR polls /api/metrics every 60 s as a fallback; SSE pushes are instant.
 */
export function useMetrics() {
  const { data } = useSWR<SessionMetrics>('/api/metrics', fetcher, {
    refreshInterval: 60_000,
    fallbackData:    EMPTY,
  });

  const [live, setLive] = useState<SessionMetrics | null>(null);

  const push = useCallback((update: SessionMetrics) => {
    setLive(update);
  }, []);

  const metrics = live ?? data ?? EMPTY;

  return {
    metrics,
    totalTokens: metrics.inputTokens + metrics.outputTokens,
    push,
  };
}
