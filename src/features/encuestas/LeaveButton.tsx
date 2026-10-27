'use client';
import { useLeave } from '@/features/auth/useLeave';

export function LeaveButton() {
  const { leaving, leave } = useLeave('global');
  return (
    <button type="button" onClick={() => void leave()} disabled={leaving} className="text-sm font-semibold text-slate-500">
      {leaving ? 'Saliendo…' : 'Salir'}
    </button>
  );
}
