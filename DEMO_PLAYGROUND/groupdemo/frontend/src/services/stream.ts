import { fetch } from 'expo/fetch';
import { API_URL, ApiError, sessionHeaders } from './api';
import { createSseParser, StreamEvent } from './sse-parser';

export function subscribe(path: string, token: string | null, callbacks: {
  onOpen: () => void;
  onEvent: (event: StreamEvent) => void;
  onError: (error: Error) => void;
}) {
  const controller = new AbortController();
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryResolve: (() => void) | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  async function connect() {
    while (!controller.signal.aborted) {
      try {
        const response = await fetch(`${API_URL}${path}`, {
          headers: { Accept: 'text/event-stream', ...sessionHeaders(token) },
          credentials: 'omit', signal: controller.signal,
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
          parse(decoder.decode(value, { stream: true }));
        }
        if (!controller.signal.aborted) throw new Error('Stream disconnected');
      } catch (error) {
        if (controller.signal.aborted) break;
        const failure = error instanceof Error ? error : new Error(String(error));
        callbacks.onError(failure);
        // An expired session must be cleared, not retried forever.
        if (failure instanceof ApiError && failure.status === 401) break;
      } finally {
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
    clearTimeout(retryTimer);
    retryResolve?.();
    void reader?.cancel().catch(() => {});
  };
}
