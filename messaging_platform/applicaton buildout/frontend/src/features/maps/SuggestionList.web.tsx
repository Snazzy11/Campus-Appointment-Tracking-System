import type { PropsWithChildren } from 'react';
export function SuggestionList({ id, children }: PropsWithChildren<{ id: string }>) { return <div id={id} role="listbox" aria-label="Building suggestions">{children}</div>; }
