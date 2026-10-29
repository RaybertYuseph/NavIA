'use client';
import { useGuide } from '@/features/guide/GuideProvider';
import { Icon, type IconName } from './icons';

export type TabDef = { id: string; label: string; icon: IconName; badge?: number };

/**
 * Pestañas de la vista: en el teléfono, barra fija abajo al alcance del pulgar; en pantallas
 * grandes, un selector arriba del contenido. Ambas comparten la pestaña del GuideProvider.
 */
export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const { tab, setTab } = useGuide();
  return (
    <>
      <nav aria-label="Secciones" className="mb-5 hidden gap-1 rounded-2xl bg-white/70 p-1 ring-1 ring-slate-200/70 md:inline-flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            data-tour={`tab-${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon name={t.icon} className="h-4 w-4" />
            {t.label}
            {!!t.badge && <Badge n={t.badge} active={tab === t.id} />}
          </button>
        ))}
      </nav>

      <nav
        aria-label="Secciones"
        data-fixed
        className="glass fixed inset-x-0 bottom-0 z-30 border-t border-white/60 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto flex max-w-md justify-around px-2 py-1.5">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                data-tour={`tab-${t.id}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setTab(t.id)}
                className="relative flex min-w-20 flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5"
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${active ? 'bg-brand-100 text-brand-700' : 'text-slate-500'}`}>
                  <Icon name={t.icon} />
                </span>
                <span className={`text-xs font-semibold ${active ? 'text-brand-700' : 'text-slate-500'}`}>{t.label}</span>
                {!!t.badge && (
                  <span className="absolute top-0.5 right-3">
                    <Badge n={t.badge} active={false} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function Badge({ n, active }: { n: number; active: boolean }) {
  return (
    <span className={`min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-bold ${active ? 'bg-white text-brand-700' : 'bg-cyan-500 text-white'}`}>{n}</span>
  );
}
