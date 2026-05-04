'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SiteScope] global error boundary', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#020617', color: '#fff', fontFamily: 'sans-serif' }}>
        <main
          style={{
            display: 'grid',
            minHeight: '100vh',
            placeItems: 'center',
            padding: 24,
          }}
        >
          <section
            style={{
              maxWidth: 560,
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.92)',
              padding: 32,
            }}
          >
            <p style={{ color: '#f59e0b', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Global runtime error
            </p>
            <h1 style={{ margin: '16px 0 0', fontSize: 32, lineHeight: 1.1 }}>
              SiteScope failed before the page could render.
            </h1>
            <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
              Open DevTools Console and look for the latest <code>[SiteScope]</code> or{' '}
              <code>[SiteScope boot]</code> log entry.
            </p>
            <pre
              style={{
                maxHeight: 160,
                overflow: 'auto',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: 8,
                background: '#020617',
                padding: 16,
                color: '#cbd5e1',
                whiteSpace: 'pre-wrap',
              }}
            >
              {error.message}
              {error.digest ? `\nDigest: ${error.digest}` : ''}
            </pre>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 20,
                border: 0,
                borderRadius: 8,
                background: '#f59e0b',
                color: '#020617',
                cursor: 'pointer',
                fontWeight: 700,
                padding: '10px 16px',
              }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
