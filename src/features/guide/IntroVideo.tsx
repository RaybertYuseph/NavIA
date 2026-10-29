'use client';
import { useEffect, useState } from 'react';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { trackDemo } from './demoTrack';

const SEEN_KEY = 'navia:demo:video';
export const INTRO_VIDEO = { src: '/video/navia-estudiantes.mp4', poster: '/video/navia-estudiantes.webp' };

/** El video ya se mostró en esta pestaña: no se repite solo (sigue en el menú). */
export function introSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* sin almacenamiento: no se vuelve a abrir solo porque introSeen da true */
  }
}

/**
 * Video de bienvenida del enlace de estudiantes: NavIA se presenta antes del tour. Sin autoplay
 * (se reproduce con el botón, con sonido); «Saltar» lo cierra y al terminar ofrece el recorrido.
 */
export function IntroVideo({ onClose, onTour }: { onClose: () => void; onTour: () => void }) {
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    markIntroSeen();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="video-titulo">
      <div className="tour-pop w-full max-w-lg rounded-[2rem] bg-white p-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <NaviaAgent size={36} compact />
          <p id="video-titulo" className="flex-1 font-extrabold">
            Conoce a NavIA <span className="font-medium text-slate-500">· 1:48</span>
          </p>
          <button type="button" onClick={onClose} className="px-1 text-sm font-medium text-slate-500">
            {ended ? 'Cerrar' : 'Saltar'}
          </button>
        </div>
        <video
          src={INTRO_VIDEO.src}
          poster={INTRO_VIDEO.poster}
          controls
          playsInline
          preload="metadata"
          onEnded={() => {
            setEnded(true);
            trackDemo('video');
          }}
          className="mt-3 aspect-video w-full rounded-2xl bg-slate-100"
        />
        {ended ? (
          <button type="button" autoFocus onClick={onTour} className="btn-primary tour-pop mt-3 w-full">
            Comenzar el recorrido
          </button>
        ) : (
          <p className="mt-2 text-center text-xs text-slate-500">Toca ▶ para verlo con sonido. Después te enseño la app paso a paso.</p>
        )}
      </div>
    </div>
  );
}
