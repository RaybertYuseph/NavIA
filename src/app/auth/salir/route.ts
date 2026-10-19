import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 });
}
