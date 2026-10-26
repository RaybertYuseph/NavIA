'use client';
import { useEffect, useRef, useState } from 'react';
import { NaviaLogo } from '@/features/brand/NaviaAgent';
import { AUDIENCES, readAudience } from '@/features/auth/demoAccess';
import { useLeave } from '@/features/auth/useLeave';
import { useGuide } from '@/features/guide/GuideProvider';
import { Icon } from './icons';

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';

/**
 * Barra superior fija: logo, rol y un menú con el tour y la salida. En la demo, además, un
 * botón visible "Inicio demo" para volver a elegir rol sin abrir el menú.
 */
export function TopBar({ name, role, wide }: { name: string; role: string; wide: boolean }) {
  const { startTour } = useGuide();
  const { leaving, leave } = useLeave(DEMO ? 'local' : 'global');
  const [open, setOpen] = useState(false);
  // Encuesta del enlace de demo por el que se entró (se lee después de montar: vive en el navegador).
  const [survey, setSurvey] = useState<string | undefined>();
  useEffect(() => {
    const audience = DEMO ? readAudience() : null;
    setSurvey(audience ? AUDIENCES[audience].survey : undefined);
  }, []);
  const menu = useRef<HTMLDivElement>(null);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !menu.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <header className="glass sticky top-0 z-20 border-b border-white/60 pt-[env(safe-area-inset-top)]">
      <div className={`mx-auto flex items-center gap-3 px-4 py-2.5 ${wide ? 'max-w-5xl' : 'max-w-md'}`}>
        <NaviaLogo size={34} />
        <span className={`${DEMO ? 'hidden sm:inline' : ''} rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100`}>{role}</span>
        {DEMO && (
          <button
            type="button"
            onClick={() => void leave()}
            disabled={leaving}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-semibold text-brand-700 shadow-sm ring-1 ring-brand-200 transition active:scale-95 disabled:opacity-60"
          >
            <Icon name="home" className="h-4 w-4" />
            {leaving ? 'Saliendo…' : 'Inicio demo'}
          </button>
        )}
        <div ref={menu} className={`relative ${DEMO ? '' : 'ml-auto'}`}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Menú"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-brand-400 to-indigo-500 text-sm font-bold text-white shadow-md shadow-brand-500/30"
          >
            {initials || '·'}
          </button>
          {open && (
            <div role="menu" className="tour-pop absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/70">
              <p className="border-b border-slate-100 px-4 py-3">
                <span className="block font-semibold">{name}</span>
                <span className="text-xs text-slate-500">{role}</span>
              </p>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  startTour(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50"
              >
                <Icon name="sparkle" className="h-5 w-5 text-brand-500" /> Ver el recorrido de NavIA
              </button>
              {survey && (
                <a
                  role="menuitem"
                  href={survey}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50"
                >
                  <Icon name="list" className="h-5 w-5 text-brand-500" /> Responder la encuesta
                </a>
              )}
              <button
                type="button"
                role="menuitem"
                disabled={leaving}
                onClick={() => void leave()}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Icon name="logout" className="h-5 w-5 text-slate-400" /> {leaving ? 'Saliendo…' : DEMO ? 'Salir de la demo' : 'Salir'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
