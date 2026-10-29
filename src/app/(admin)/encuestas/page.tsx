import type { Metadata } from 'next';
import { Dashboard } from '@/features/encuestas/Dashboard';
import type { DemoEvento, Encuesta } from '@/features/encuestas/kpis';
import { requireRole } from '@/lib/profile';

export const metadata: Metadata = { title: 'Encuestas · NavIA' };

/** Tablero de la prueba de 7 días: solo el admin (la RLS de encuestas tampoco deja leer a nadie más). */
export default async function EncuestasPage() {
  const { supabase, profile } = await requireRole(['admin']);
  const { data, error } = await supabase
    .from('encuestas')
    .select('id, created_at, audiencia, vista, respuestas, contacto')
    .order('created_at', { ascending: false })
    .limit(5000);
  // Embudo (migración 0015): si la tabla aún no existe, el tablero lo dice y sigue con las encuestas.
  const eventos = await supabase.from('demo_eventos').select('created_at, audiencia, evento, canal, visitante').order('created_at', { ascending: false }).limit(20000);
  return (
    <Dashboard
      rows={(data ?? []) as Encuesta[]}
      error={error?.message ?? null}
      eventos={(eventos.data ?? []) as DemoEvento[]}
      eventosError={eventos.error?.message ?? null}
      name={profile.full_name}
    />
  );
}
