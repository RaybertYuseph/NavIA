import { OtpLogin } from '@/features/auth/OtpLogin';
import { PasswordLogin } from '@/features/auth/PasswordLogin';

// Contraseña mientras el envío de correos está pendiente; 'otp' activa el código por correo.
const LOGIN_MODE = process.env.NEXT_PUBLIC_LOGIN_MODE === 'otp' ? 'otp' : 'password';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">NavIA</p>
        <h1 className="text-3xl font-bold">Tu copiloto de ruta</h1>
        <p className="mt-1 text-slate-600">
          {LOGIN_MODE === 'otp' ? 'Entra con tu correo. Te enviamos un código, sin contraseñas.' : 'Entra o crea tu cuenta con tu correo.'}
        </p>
      </div>
      {LOGIN_MODE === 'otp' ? <OtpLogin /> : <PasswordLogin />}
    </main>
  );
}
