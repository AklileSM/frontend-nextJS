import type { Metadata } from 'next';
import { Inter, Inter_Tight } from 'next/font/google';
import './globals.css';
import { AuthPageProviders } from '@/components/providers/RouteProviders';

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


export const metadata: Metadata = {
  title: 'SiteScope',
  description: 'Field documentation for construction sites — every photo, panorama, and 3D scan organized by room and date.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable}`}>
      <body className="bg-base-950 text-white antialiased">
        <AuthPageProviders>{children}</AuthPageProviders>
      </body>
    </html>
  );
}
