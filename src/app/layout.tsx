import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NavIA',
  description: 'Tu copiloto de ruta: el transporte universitario en tiempo real.',
  appleWebApp: { capable: true, title: 'NavIA', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#0ea5e9',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-VE">
      <body className="min-h-dvh antialiased">
        {children}
      </body>
    </html>
  );
}
