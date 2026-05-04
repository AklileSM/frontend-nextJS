import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SiteScope',
  description: 'Field documentation for construction sites.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}