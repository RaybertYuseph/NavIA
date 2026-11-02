'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type StudentToReview = {
  id: string;
  full_name: string;
  email: string;
  cedula: string | null;
  phone: string | null;
  status: 'pending' | 'rejected';
  created_at: string;
};

/**
 * Registros de estudiantes por aprobar (E1-H1). Aprobar le abre la línea al estudiante;
 * rechazar lo deja fuera, y se puede aprobar después si fue un error.
 * `students` es null cuando la migración 0017 todavía no está aplicada.
 */
export function StudentsReview(props: {
  students: StudentToReview[] | null;
  setStudents: (fn: (prev: StudentToReview[]) => StudentToReview[]) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  if (props.students === null) {
    return (
      <p className="card rounded-3xl p-4 text-slate-600">
        Falta aplicar la migración 0017 en Supabase para ver los registros por aprobar.
      </p>
    );
  }

  const q = filter.trim().toLowerCase();
  const shown = q
    ? props.students.filter((s) => [s.full_name, s.email, s.cedula ?? '', s.phone ?? ''].some((x) => x.toLowerCase().includes(q)))
    : props.students;
  const pending = shown.filter((s) => s.status === 'pending');
  const rejected = shown.filter((s) => s.status === 'rejected');

  async function review(s: StudentToReview, approve: boolean) {
    setBusy(s.id);
    setError(null);
    const { error } = await createClient().rpc('review_student', { p_id: s.id, p_approve: approve });
    setBusy(null);
    if (error) return setError(navigator.onLine ? `No se pudo guardar: ${error.message}` : 'Sin señal: intenta de nuevo cuando vuelva.');
    props.setStudents((prev) =>
      approve ? prev.filter((x) => x.id !== s.id) : prev.map((x) => (x.id === s.id ? { ...x, status: 'rejected' } : x)),
    );
  }

  return (
    <section aria-labelledby="registros" className="flex flex-col gap-3">
      <h2 id="registros" className="section-title">Estudiantes por aprobar</h2>
      <p className="-mt-2 text-sm text-slate-600">
        Hasta que los apruebes, los estudiantes nuevos no pueden usar la línea. Compara la cédula con su carnet o con la lista de la universidad.
      </p>
      {props.students.length > 5 && (
        <input
          type="search"
          placeholder="Buscar por nombre, cédula, correo o teléfono"
          className="rounded-xl border border-slate-300 bg-white p-3"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {pending.length === 0 && <p className="card rounded-3xl p-4 text-slate-600">No hay registros nuevos por revisar.</p>}
      {pending.map((s) => (
        <StudentCard key={s.id} s={s} busy={busy === s.id} onReview={review} />
      ))}
      {rejected.length > 0 && (
        <details className="card rounded-3xl p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Rechazados ({rejected.length})</summary>
          <div className="mt-3 flex flex-col gap-3">
            {rejected.map((s) => (
              <StudentCard key={s.id} s={s} busy={busy === s.id} onReview={review} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function StudentCard({ s, busy, onReview }: { s: StudentToReview; busy: boolean; onReview: (s: StudentToReview, approve: boolean) => void }) {
  return (
    <article className="card flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold">{s.full_name}</p>
        <p className="truncate text-sm text-slate-600">{s.email}</p>
        <p className="text-sm text-slate-600">
          C.I. {s.cedula ?? <span className="text-amber-700">sin cédula</span>}
          {s.phone && <> · {s.phone}</>}
        </p>
        <p className="text-xs text-slate-500">
          Se registró el {new Date(s.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', timeZone: 'America/Caracas' })}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {s.status === 'pending' && (
          <button type="button" disabled={busy} onClick={() => onReview(s, false)} className="rounded-xl px-4 py-2.5 font-semibold text-slate-700 ring-1 ring-slate-300 disabled:opacity-50">
            Rechazar
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => onReview(s, true)} className="rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-sm disabled:opacity-50">
          {busy ? 'Guardando…' : 'Aprobar'}
        </button>
      </div>
    </article>
  );
}
