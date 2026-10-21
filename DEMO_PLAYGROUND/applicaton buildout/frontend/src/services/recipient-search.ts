import type { Recipient } from '../types';

export type SearchState = { status: 'idle' | 'pending' | 'loading' | 'done' | 'error'; matches: Recipient[]; error: string };
export const emptySearch: SearchState = { status: 'idle', matches: [], error: '' };

export function createRecipientSearch(
  request: (prefix: string, signal: AbortSignal) => Promise<Recipient[]>,
  update: (state: SearchState) => void,
  onError: (error: unknown) => void = () => {},
) {
  let generation = 0;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let state = emptySearch;
  const publish = (value: SearchState) => { state = value; update(value); };
  return {
    snapshot: () => state,
    change(value: string) {
      if (disposed) return;
      const version = ++generation;
      clearTimeout(timer); controller?.abort();
      const prefix = value.trim();
      publish({ status: prefix.length >= 3 ? 'pending' : 'idle', matches: [], error: '' });
      if (prefix.length < 3) return;
      timer = setTimeout(() => {
        controller = new AbortController();
        publish({ status: 'loading', matches: [], error: '' });
        request(prefix, controller.signal).then(matches => {
          if (!disposed && version === generation) publish({ status: 'done', matches: matches.slice(0, 10), error: '' });
        }).catch(error => {
          if (disposed || version !== generation) return;
          publish({ status: 'error', matches: [], error: error instanceof Error ? error.message : 'Could not search recipients. Try again.' });
          onError(error);
        });
      }, 300);
    },
    stop() { disposed = true; ++generation; clearTimeout(timer); controller?.abort(); },
  };
}
