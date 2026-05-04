import type { Metadata } from 'next';
import { Inter, Inter_Tight, IBM_Plex_Mono } from 'next/font/google';
import Script from 'next/script';
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

const browserBootLogger = `
  (function () {
    var prefix = '[SiteScope boot]';
    var extensionWarning = 'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received';

    function serialize(value) {
      if (!value) return value;
      if (value instanceof Error) return { message: value.message, stack: value.stack };
      try { return JSON.stringify(value); } catch (_) { return String(value); }
    }

    console.info(prefix, 'inline logger loaded', {
      href: window.location.href,
      timestamp: new Date().toISOString()
    });

    window.addEventListener('error', function (event) {
      var target = event.target;
      var resourceUrl = target && (target.src || target.href);

      if (resourceUrl) {
        console.error(prefix, 'resource failed before hydration', {
          tagName: target.tagName,
          url: resourceUrl
        });
        return;
      }

      if (event.message && event.message.indexOf(extensionWarning) !== -1) {
        console.info(prefix, 'ignored extension warning');
        return;
      }

      console.error(prefix, 'window error before hydration', {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        error: serialize(event.error)
      });
    }, true);

    window.addEventListener('unhandledrejection', function (event) {
      var reason = event.reason;
      var message = reason && reason.message ? reason.message : String(reason);

      if (message.indexOf(extensionWarning) !== -1) {
        event.preventDefault();
        console.info(prefix, 'ignored extension promise warning');
        return;
      }

      console.error(prefix, 'unhandled rejection before hydration', serialize(reason));
    });
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${plexMono.variable}`}>
      <Script id="sitescope-boot-logger" strategy="beforeInteractive">
        {browserBootLogger}
      </Script>
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
