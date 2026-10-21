import { fetch } from 'expo/fetch';
import { API_URL, ApiError, sessionHeaders } from './api';
import { createSseParser, StreamEvent } from './sse-parser';

export function subscribe(path: string, token: string | null, callbacks: {
  idleTimeoutMs?: number;
  onOpen: () => void;
  onEvent: (event: StreamEvent) => void;
  onError: (error: Error) => void;
}) {
  const controller = new AbortController();
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryResolve: (() => void) | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let attemptAbort: AbortController | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  async function connect() {
    while (!controller.signal.aborted) {
      try {
        attemptAbort = callbacks.idleTimeoutMs ? new AbortController() : undefined;
        const armDeadline = () => { clearTimeout(idleTimer); if(callbacks.idleTimeoutMs) idleTimer=setTimeout(()=>attemptAbort?.abort(),callbacks.idleTimeoutMs); };
        armDeadline();
        const response = await fetch(`${API_URL}${path}`, {
          headers: { Accept: 'text/event-stream', ...sessionHeaders(token) },
          credentials: 'omit', signal: attemptAbort?.signal || controller.signal,
        });
        if (!response.ok) throw new ApiError(response.status, `Stream failed (${response.status})`);
        if (!response.body) throw new Error('Streaming is unavailable');
        reader = response.body.getReader();
        callbacks.onOpen();
        const decoder = new TextDecoder();
        const parse = createSseParser(callbacks.onEvent);
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          armDeadline();
          parse(decoder.decode(value, { stream: true }));
        }
        if (!controller.signal.aborted) throw new Error('Stream disconnected');
      } catch (error) {
        if (controller.signal.aborted) break;
        const failure = error instanceof Error ? error : new Error(String(error));
        callbacks.onError(failure);
        // An expired session must be cleared, not retried forever.
        if (failure instanceof ApiError && [401, 403].includes(failure.status)) break;
      } finally {
        clearTimeout(idleTimer);
        await reader?.cancel().catch(() => {});
        reader = undefined;
      }
      if (controller.signal.aborted) break;
      await new Promise<void>(resolve => {
        retryResolve = resolve;
        retryTimer = setTimeout(resolve, 2000);
      });
    }
  }
  void connect();
  return () => {
    controller.abort();
    attemptAbort?.abort();
    clearTimeout(idleTimer);
    clearTimeout(retryTimer);
    retryResolve?.();
    void reader?.cancel().catch(() => {});
  };
}
