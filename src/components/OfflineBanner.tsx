export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
      Sin conexión. Lo que ves puede estar desactualizado.
    </p>
  );
}
