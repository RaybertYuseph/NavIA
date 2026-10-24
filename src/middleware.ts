import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Fuera: estáticos, íconos, manifiesto y service worker (deben abrir sin sesión ni red).
  matcher: ['/((?!_next/static|_next/image|icons/|brand/|icon.png|apple-icon.png|sw.js|swe-worker|manifest.webmanifest|favicon.ico).*)'],
};
