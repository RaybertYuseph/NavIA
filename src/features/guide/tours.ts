import type { Role } from '@/lib/profile';
import type { SceneName } from './TourScenes';

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
  /** Simulación animada con datos de ejemplo (sin elemento que resaltar). */
  scene?: SceneName;
  title: string;
  body: string;
};

export const DEFAULT_TAB: Record<View, string> = { student: 'inicio', driver: 'ruta', fiscal: 'resumen' };

/**
 * Recorrido de cada vista: los pasos con `scene` simulan el flujo completo con datos de ejemplo y
 * los demás señalan la pantalla real. El último paso presenta el botón de NavIA.
 */
export const TOURS: Record<View, TourStep[]> = {
  student: [
    { tab: 'inicio', target: 'proxima', title: 'Tu próxima salida', body: 'Aquí ves a qué hora sale la próxima camioneta, de qué ruta es y su foto y placa para que la reconozcas al llegar.' },
    { scene: 'student-mark', title: 'Así marcas tu parada', body: 'Ya en la parada, eliges tu salida y tu parada y tocas «Estoy aquí». Confirmo con tu GPS que estás a menos de 50 m y te sumo al contador que ve el conductor.' },
    { tab: 'inicio', target: 'espera', title: 'Hazlo aquí', body: 'Este es el botón de verdad. Si no estás en una parada, en la demo puedes tocar «Simular que estoy en la parada».' },
    { scene: 'student-approach', title: 'Te aviso cuando viene', body: 'Mientras esperas te digo a cuántas paradas viene. Cuando tu parada es la siguiente te llega un aviso al teléfono, y otro cuando la camioneta llega. Sin mirar el grupo.' },
    { scene: 'student-live', title: 'Todas en el mapa', body: 'En «En vivo» ves cada camioneta que ya arrancó moviéndose por la ruta. Toca una para ver su foto, su placa, por dónde va y cuánto le falta.' },
    { tab: 'envivo', target: 'tab-envivo', title: 'En vivo', body: 'Esta es la pestaña. Las camionetas de la demo se mueven solas, como en un día real.' },
    { tab: 'horarios', target: 'tab-horarios', title: 'Salidas confirmadas', body: 'Las salidas de hoy que un conductor ya confirmó desde la parada de salida, por ruta, con sus paradas y el pasaje.' },
    { scene: 'student-paypain', title: 'Así pagas hoy', body: 'En la puerta esperas a que te dicten el teléfono, la cédula y el banco, o abres la app del banco para escanear su QR. Con poca señal no carga, y la fila se queda esperando detrás de ti.' },
    { scene: 'student-wallet', title: 'Paga con tu saldo NavIA (próximamente)', body: 'Recargas tu saldo en casa, con buena señal. Al subir tocas «Pagar mi pasaje» y muestras tu QR: el conductor lo escanea y listo, en segundos y sin internet en la puerta.' },
    { scene: 'student-ask', title: 'Pregúntame lo que sea', body: 'Escríbeme como le escribirías al grupo: «¿dónde viene?», «¿a qué hora sale la próxima?». Te respondo al momento con lo que está pasando en la ruta.' },
    { target: 'navia-fab', title: 'Aquí estoy yo', body: 'Tócame cuando tengas una duda. Y cuando quieras, repite este recorrido desde tu menú.' },
  ],
  driver: [
    { scene: 'driver-pain', title: 'Así es hoy', body: 'Manejas y a la vez respondes el grupo: dónde vienes, cuál es la próxima parada, si ya pasaste. Y revisas uno por uno en el banco los pagos móviles que te mandan en captura. NavIA hace eso por ti.' },
    { scene: 'driver-available', title: 'Avisa que estás listo', body: 'En la parada de salida escribes a qué hora sales y tocas «Estoy disponible». En ese momento el fiscal y los estudiantes ven tu salida, sin un solo mensaje.' },
    { target: 'unidad', title: 'Tu unidad y tu hora', body: 'Aquí lo haces de verdad: tu unidad, la hora de salida y el botón «Estoy disponible».' },
    { target: 'salidas', title: 'Tus salidas de hoy', body: 'Aquí está la salida que confirmaste. Si cambias de plan, toca «Cambiar hora de salida».' },
    { scene: 'driver-route', title: 'Toda la ruta con un botón', body: 'Siempre te muestro el paso que sigue: «Llegué», «Ya subieron todos» y al final «Terminar ruta». Cuando llegas, aviso a los que esperan, el contador vuelve a 0 y cuento cuántos abordaron.' },
    { target: 'accion', title: 'Tu botón', body: 'Este es el botón real. Grande, para tocarlo con el teléfono en el soporte.' },
    { target: 'paradas', title: 'Quién te espera', body: 'En cada parada ves cuántos estudiantes están esperando, para que no dejes a nadie.' },
    { scene: 'driver-offline', title: 'Sin señal, sin problema', body: 'Si te quedas sin señal en la vía, guardo tus avisos en el teléfono y los envío solos apenas vuelva, con la hora real de cada parada.' },
    { scene: 'driver-paypain', title: 'Así cobras hoy', body: 'Te llegan capturas por WhatsApp y después revisas tu cuenta pago por pago para ver si cuadran. Montos que no coinciden, pagos que no aparecen, y nunca sabes con certeza cuánto cobraste.' },
    { scene: 'driver-qr', title: 'Cobra con un QR (próximamente)', body: 'El estudiante paga con su saldo NavIA y te muestra su QR. Lo escaneas cuando sube: si pagó, ves ✓ con su nombre; si ese QR ya se usó o no tiene saldo, te aviso. Cada cobro queda validado, sin capturas que revisar.' },
    { scene: 'driver-wallet', title: 'Tu cierre del día (próximamente)', body: 'Al final del día ves cuántos pasajes cobraste, el total, tu parte de la comisión y el neto, salida por salida. Con un toque lo pasas a tu cuenta, con la certeza de que cuadra.' },
    { target: 'navia-fab', title: 'Aquí estoy yo', body: 'Tócame si tienes una duda. Puedes repetir este recorrido desde tu menú.' },
  ],
  fiscal: [
    { scene: 'fiscal-live', title: 'La línea en vivo', body: 'Mientras los conductores tocan sus botones, el resumen se actualiza solo: unidades en ruta, disponibles, fuera de servicio y estudiantes esperando, con el mapa en vivo.' },
    { tab: 'resumen', target: 'kpis', title: 'La línea de un vistazo', body: 'Este es el resumen real de la demo: cuántas unidades están en ruta, disponibles o fuera de servicio, cuántas salidas van y cuántos esperan.' },
    { tab: 'resumen', target: 'mapa', title: 'Mapa en vivo', body: 'Todas las unidades que están en ruta, con su ubicación en tiempo real.' },
    { scene: 'fiscal-departures', title: 'Salidas y alertas', body: 'Cada salida pasa sola de programada a cargando, en camino y finalizada. Si una unidad deja de enviar ubicación te aviso, para que llames al conductor.' },
    { tab: 'salidas', target: 'tab-salidas', title: 'Salidas por ruta', body: 'Aquí están las salidas del día con su estado y cuántos esperan. Aparecen cuando un conductor se activa en la parada de salida.' },
    { tab: 'unidades', target: 'tab-unidades', title: 'Unidades', body: 'Cada camioneta con su foto, su placa y su conductor. Puedes subir la foto o sacarla de servicio.' },
    { target: 'navia-fab', title: 'Aquí estoy yo', body: 'Tócame y te resumo cómo va la línea o te digo qué unidad dejó de enviar ubicación.' },
  ],
};
