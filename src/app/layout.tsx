import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: 'NavIA',
  description: 'Tu copiloto de ruta: el transporte universitario en tiempo real.',
  appleWebApp: { capable: true, title: 'NavIA', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#0ea5e9',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-VE" className={jakarta.variable}>
      <body className="min-h-dvh antialiased">
        {children}
      </body>
    </html>
  );
}
