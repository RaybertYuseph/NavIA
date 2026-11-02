import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Vuelta desde el enlace del correo (recuperar contraseña): cambia el código por una sesión y
 * lleva a `next`, que solo puede ser una ruta de esta misma app.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  const fail = new URL('/login', url.origin);
  fail.searchParams.set('aviso', 'enlace-vencido');
  return NextResponse.redirect(fail);
}

function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
