import { GuideProvider } from '@/features/guide/GuideProvider';
import { VIEW_BY_ROLE } from '@/features/guide/tours';
import type { Role } from '@/lib/profile';
import { TopBar } from './TopBar';

const ROLE_LABEL: Record<Role, string> = {
  student: 'Estudiante',
  driver: 'Conductor',
  coordinator: 'Fiscal de la línea',
  admin: 'Fiscal de la línea',
};

/** Marco de las tres vistas: barra superior con menú y el contexto del tour y de NavIA. */
export function AppShell({
  profile,
  wide = false,
  children,
}: {
  profile: { id: string; full_name: string; role: Role };
  wide?: boolean;
  children: React.ReactNode;
}) {
  const firstName = profile.full_name.trim().split(/\s+/)[0] ?? '';
  return (
    <GuideProvider view={VIEW_BY_ROLE[profile.role]} userId={profile.id} firstName={firstName}>
      <TopBar name={profile.full_name} role={ROLE_LABEL[profile.role]} wide={wide} />
      <main className={`mx-auto w-full px-4 pt-4 pb-32 md:pb-12 ${wide ? 'max-w-5xl' : 'max-w-md'}`}>{children}</main>
    </GuideProvider>
  );
}
