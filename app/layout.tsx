import type { Metadata } from 'next';
import './globals.css';
import { AuthPageProviders } from '@/components/providers/RouteProviders';

export const metadata: Metadata = {
  title: 'SiteScope',
  description: 'Field documentation for construction sites, every photo, panorama, and 3D scan organized by room and date.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-base-950 text-white antialiased">
        <AuthPageProviders>{children}</AuthPageProviders>
      </body>
    </html>
  );
}
