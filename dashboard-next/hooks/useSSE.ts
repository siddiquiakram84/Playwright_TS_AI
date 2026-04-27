'use client';

import { useEffect, useRef } from 'react';

type SSEHandlers = Partial<Record<string, (data: unknown) => void>>;

interface SSEOptions {
  onOpen?:  () => void;
  onClose?: () => void;
}

/**
 * Subscribe to the /api/events SSE stream.
 * Auto-reconnects on error with 3 s back-off.
 * Handlers must be stable (useCallback) to avoid unnecessary reconnections.
 */
export function useSSE(handlers: SSEHandlers, options?: SSEOptions): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let es: EventSource;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource('/api/events');

      es.addEventListener('open', () => {
        clearTimeout(retryTimer);
        optionsRef.current?.onOpen?.();
      });

      Object.keys(handlersRef.current).forEach(event => {
        es.addEventListener(event, (e: Event) => {
          const fn = handlersRef.current[event];
          if (fn) {
            try {
              fn(JSON.parse((e as MessageEvent<string>).data));
            } catch {
              // malformed JSON — skip
            }
          }
        });
      });

      es.onerror = () => {
        es.close();
        optionsRef.current?.onClose?.();
        retryTimer = setTimeout(connect, 3_000);
      };
    }

    connect();
    return () => {
      clearTimeout(retryTimer);
      es?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — handlersRef/optionsRef handle updates
}
