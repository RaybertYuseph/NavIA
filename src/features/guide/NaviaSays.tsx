'use client';
import { useState } from 'react';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { useTypewriter } from './useTypewriter';

/** NavIA saluda con un globo: lo dice letra a letra la primera vez; luego solo se actualiza. */
export function NaviaSays({ text }: { text: string }) {
  const [first] = useState(text);
  const { shown, done } = useTypewriter(first);
  const said = text === first ? shown : text;
  const talking = text === first && !done;
  return (
    <div className="flex items-end gap-1">
      <NaviaAgent size={68} animated compact talking={talking} mood={!talking && text.startsWith('¡') ? 'happy' : 'idle'} className="shrink-0" />
      <p className="card mb-4 min-h-12 flex-1 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm font-medium" aria-live="polite">
        {said}
        {talking && <span className="sr-only">{first.slice(shown.length)}</span>}
      </p>
    </div>
  );
}
