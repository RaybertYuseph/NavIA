'use client';
import { useEffect, useState } from 'react';

/**
 * Muestra `text` letra a letra para que NavIA "lo vaya diciendo" (mientras tanto mueve la boca).
 * Con `paused` espera; con prefers-reduced-motion lo muestra completo de una vez.
 */
export function useTypewriter(text: string, { paused = false, cps = 55 }: { paused?: boolean; cps?: number } = {}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
  }, [text]);

  useEffect(() => {
    if (paused) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(text.length);
      return;
    }
    if (count >= text.length) return;
    // Pausa breve tras la puntuación, como al hablar.
    const prev = text[count - 1] ?? '';
    const delay = /[.,!?¿¡:]/.test(prev) ? 220 : 1000 / cps;
    const t = setTimeout(() => setCount((c) => Math.min(text.length, c + 1)), delay);
    return () => clearTimeout(t);
  }, [text, count, paused, cps]);

  return { shown: text.slice(0, count), done: count >= text.length, skip: () => setCount(text.length) };
}
