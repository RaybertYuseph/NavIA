import { DemoLogin } from '@/features/auth/DemoLogin';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { OtpLogin } from '@/features/auth/OtpLogin';
import { PasswordLogin } from '@/features/auth/PasswordLogin';

// Contraseña mientras el envío de correos está pendiente; 'otp' activa el código por correo.
const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';
const LOGIN_MODE = process.env.NEXT_PUBLIC_LOGIN_MODE === 'otp' ? 'otp' : 'password';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center text-center">
        <NaviaAgent size={150} animated />
        <h1 className="brand-text mt-1 text-5xl font-extrabold tracking-tight">NavIA</h1>
        <p className="mt-1 text-lg font-bold">¡Epa! Soy tu copiloto de ruta</p>
        <p className="mt-1 text-sm text-slate-600">Sabe dónde viene tu camioneta sin buscar en el grupo de WhatsApp.</p>
      </div>
      {DEMO && <DemoLogin />}
      {DEMO ? (
        <details className="card rounded-3xl p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Entrar con mi cuenta</summary>
          <div className="mt-4 flex flex-col gap-4">{LOGIN_MODE === 'otp' ? <OtpLogin /> : <PasswordLogin />}</div>
        </details>
      ) : LOGIN_MODE === 'otp' ? (
        <OtpLogin />
      ) : (
        <PasswordLogin />
      )}
    </main>
  );
}
