'use client';
import { useEffect } from 'react';
import { installErrorReporting } from '@/lib/errorReport';

/** Activa el registro de errores en toda la app (no pinta nada). */
export function ErrorReporter() {
  useEffect(() => installErrorReporting(), []);
  return null;
}
