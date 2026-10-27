import type { Metadata } from 'next';
import { Dashboard } from '@/features/encuestas/Dashboard';
import type { Encuesta } from '@/features/encuestas/kpis';
import { requireRole } from '@/lib/profile';

export const metadata: Metadata = { title: 'Encuestas · NavIA' };

/** Tablero de la prueba de 7 días: solo el admin (la RLS de encuestas tampoco deja leer a nadie más). */
export default async function EncuestasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === 'preguntas' ? 'preguntas' : 'resultados';
  const { supabase, profile } = await requireRole(['admin']);
  const { data, error } = await supabase
    .from('encuestas')
    .select('id, created_at, audiencia, vista, respuestas, contacto')
    .order('created_at', { ascending: false })
    .limit(5000);
  return <Dashboard rows={(data ?? []) as Encuesta[]} error={error?.message ?? null} name={profile.full_name} tab={tab} />;
}
