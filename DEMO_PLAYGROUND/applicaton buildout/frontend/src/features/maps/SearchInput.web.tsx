import { useEffect, useRef } from 'react';
import type { SearchInputProps } from './SearchInput';
export function SearchInput({ label = 'Search campus buildings', placeholder = 'Search buildings or abbreviations', value, onChange, onKey, expanded, activeId, listId }: SearchInputProps) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' }); }, [activeId]);
  return <input ref={input} type="search" role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded ? activeId : undefined} placeholder={placeholder} value={value} maxLength={120} autoComplete="off" onChange={event => onChange(event.target.value)} onKeyDown={event => { if (!event.nativeEvent.isComposing && onKey(event.key)) event.preventDefault(); }} style={{ minHeight: 46, minWidth: 0, width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 12, padding: '0 12px', fontSize: 16, color: '#172033', backgroundColor: '#f8fafc', flex: 1 }} />;
}
