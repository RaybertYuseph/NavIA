import { describe, expect, it } from 'vitest';
import { toReport } from '@/lib/errorReport';

describe('toReport', () => {
  it('arma el reporte sin la parte de la URL después de ?', () => {
    const r = toReport('js', new TypeError('x is undefined'), '/nueva-clave?code=secreto', true);
    expect(r).toMatchObject({ kind: 'js', message: 'TypeError: x is undefined', path: '/nueva-clave', online: true });
  });

  it('no repite el mismo error en la misma página', () => {
    expect(toReport('promesa', 'falló una vez', '/', true)).not.toBeNull();
    expect(toReport('promesa', 'falló una vez', '/', true)).toBeNull();
  });

  it.each(['ResizeObserver loop limit exceeded', 'Script error.', ''])('ignora el ruido "%s"', (msg) =>
    expect(toReport('js', msg, '/', true)).toBeNull());

  it('ignora errores de extensiones del navegador', () => {
    const e = new Error('boom');
    e.stack = 'Error: boom\n    at chrome-extension://abc/content.js:1:1';
    expect(toReport('js', e, '/', true)).toBeNull();
  });
});
