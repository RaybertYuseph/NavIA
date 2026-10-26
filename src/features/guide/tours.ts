import type { Role } from '@/lib/profile';

/** Vista de cada rol: la del fiscal también la usa el admin. */
export type View = 'student' | 'driver' | 'fiscal';

export const VIEW_BY_ROLE: Record<Role, View> = {
  student: 'student',
  driver: 'driver',
  coordinator: 'fiscal',
  admin: 'fiscal',
};

export type TourStep = {
  /** Valor de data-tour del elemento que se resalta; sin él, la tarjeta va centrada. */
  target?: string;
  /** Pestaña que se abre antes de mostrar el paso. */
  tab?: string;
  title: string;
  body: string;
};

export const DEFAULT_TAB: Record<View, string> = { student: 'inicio', driver: 'ruta', fiscal: 'resumen' };

/** Recorrido corto por lo esencial de cada vista; el último paso presenta el botón de NavIA. */
export const TOURS: Record<View, TourStep[]> = {
  student: [
    { tab: 'inicio', target: 'proxima', title: 'Tu próxima salida', body: 'Aquí ves a qué hora sale la próxima camioneta, de qué ruta es y su foto para que la reconozcas.' },
    { tab: 'inicio', target: 'espera', title: 'Marca tu parada', body: 'Ya en la parada, toca «Estoy aquí»: confirmo con tu GPS que estás a menos de 50 m. El conductor ve cuántos esperan y yo te aviso cuando llegue la camioneta.' },
    { tab: 'envivo', target: 'tab-envivo', title: 'En vivo', body: 'En esta pestaña ves en el mapa dónde vienen las camionetas que ya arrancaron.' },
    { tab: 'horarios', target: 'tab-horarios', title: 'Salidas confirmadas', body: 'Las salidas de hoy que un conductor ya confirmó desde la parada de salida, por ruta, con sus paradas y el pasaje.' },
    { target: 'navia-fab', title: 'Aquí estoy yo', body: 'Si tienes una duda, tócame. Te digo dónde viene tu camioneta, cuándo sale la próxima y cómo marcar tu parada.' },
  ],
  driver: [
    { target: 'unidad', title: 'Tu unidad y tu hora', body: 'En la parada de salida escribe a qué hora sales y toca «Estoy disponible». Esa salida la ven al instante el fiscal y los estudiantes.' },
    { target: 'salidas', title: 'Tus salidas de hoy', body: 'Aquí está la salida que confirmaste. Si cambias de plan, toca «Cambiar hora de salida».' },
    { target: 'accion', title: 'Un solo botón', body: 'Siempre te muestro el paso que sigue: «Llegué» al llegar a la parada, «Ya subieron todos» al terminar de cargar y «Terminar ruta» al final. Tócalo y listo.' },
    { target: 'paradas', title: 'Quién te espera', body: 'En cada parada ves cuántos estudiantes están esperando, para que no dejes a nadie.' },
    { target: 'navia-fab', title: 'Aquí estoy yo', body: 'Si se va la señal, guardo tus avisos y los envío apenas vuelva. Tócame si tienes una duda.' },
  ],
  fiscal: [
    { tab: 'resumen', target: 'kpis', title: 'La línea de un vistazo', body: 'Cuántas unidades están en ruta, disponibles o fuera de servicio, cuántas salidas van y cuántos estudiantes esperan.' },
    { tab: 'resumen', target: 'mapa', title: 'Mapa en vivo', body: 'Todas las unidades que están en ruta, con su ubicación en tiempo real.' },
    { tab: 'unidades', target: 'tab-unidades', title: 'Unidades', body: 'Cada camioneta con su foto, su conductor y por dónde va. Puedes subir o cambiar la foto.' },
    { tab: 'salidas', target: 'tab-salidas', title: 'Salidas por ruta', body: 'Las salidas del día con su estado y cuántos esperan. Aparecen cuando un conductor se activa en la parada de salida.' },
    { target: 'navia-fab', title: 'Aquí estoy yo', body: 'Tócame y te resumo cómo va la línea o te digo qué unidad dejó de enviar ubicación.' },
  ],
};
