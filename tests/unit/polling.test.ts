import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { liveDelay, startPolling } from '@/lib/polling';

// Navegador mínimo: visibilidad, señal y eventos.
const env = { visibility: 'visible', online: true };
const docTarget = new EventTarget();
const winTarget = new EventTarget();

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.5); // sin azar: ritmo exacto
  env.visibility = 'visible';
  env.online = true;
  vi.stubGlobal('document', {
    get visibilityState() {
      return env.visibility;
    },
    addEventListener: docTarget.addEventListener.bind(docTarget),
    removeEventListener: docTarget.removeEventListener.bind(docTarget),
  });
  vi.stubGlobal('window', {
    addEventListener: winTarget.addEventListener.bind(winTarget),
    removeEventListener: winTarget.removeEventListener.bind(winTarget),
  });
  vi.stubGlobal('navigator', {
    get onLine() {
      return env.online;
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('startPolling', () => {
  it('consulta al ritmo pedido mientras la app está abierta', () => {
    const load = vi.fn();
    const stop = startPolling(load, () => 10_000);
    vi.advanceTimersByTime(30_000);
    expect(load).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(30_000);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('no consulta con la app minimizada y consulta al volver', () => {
    const load = vi.fn();
    const stop = startPolling(load, () => 10_000);
    env.visibility = 'hidden';
    vi.advanceTimersByTime(60_000);
    expect(load).not.toHaveBeenCalled();
    env.visibility = 'visible';
    docTarget.dispatchEvent(new Event('visibilitychange'));
    expect(load).toHaveBeenCalledTimes(1);
    stop();
  });

  it('no consulta sin señal y consulta al recuperarla', () => {
    const load = vi.fn();
    const stop = startPolling(load, () => 10_000);
    env.online = false;
    vi.advanceTimersByTime(30_000);
    expect(load).not.toHaveBeenCalled();
    env.online = true;
    winTarget.dispatchEvent(new Event('online'));
    vi.advanceTimersByTime(3_000); // reparto al azar de la reconexión
    expect(load).toHaveBeenCalledTimes(1);
    stop();
  });

  it('cambia de ritmo en caliente según Realtime', () => {
    const load = vi.fn();
    let live = true;
    const stop = startPolling(load, () => liveDelay(live));
    vi.advanceTimersByTime(59_000);
    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(load).toHaveBeenCalledTimes(1);
    live = false;
    vi.advanceTimersByTime(60_000); // la vuelta ya agendada a 60 s, después cada 10 s
    expect(load.mock.calls.length).toBeGreaterThanOrEqual(2);
    stop();
  });
});
