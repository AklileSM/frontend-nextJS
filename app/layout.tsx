import type { Metadata } from 'next';
import { Inter, Inter_Tight, IBM_Plex_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/context/AuthContext';
import { SelectedDateProvider } from '@/context/SelectedDateContext';
import { ClientLogger } from '@/components/diagnostics/ClientLogger';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-inter-tight',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SiteScope',
  description: 'Field documentation for construction sites — every photo, panorama, and 3D scan organized by room and date.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${plexMono.variable}`}>
      <body className="bg-base-950 text-white antialiased">
        <ClientLogger />
        <AuthProvider>
          <SelectedDateProvider>{children}</SelectedDateProvider>
        </AuthProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                '!bg-base-900 !border !border-base-700 !text-white !font-body !text-[14px]',
              error: '!bg-base-900 !border-amber-500/40',
              description: '!text-ink-300',
            },
          }}
        />
      </body>
    </html>
  );
}
