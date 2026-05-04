'use client';

import { useEffect } from 'react';

const PREFIX = '[SiteScope]';
const EXTENSION_CHANNEL_CLOSED =
  'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received';

function errorMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function errorStack(value: unknown) {
  return value instanceof Error ? value.stack : undefined;
}

function targetUrl(target: EventTarget | null) {
  if (target instanceof HTMLScriptElement) return target.src;
  if (target instanceof HTMLLinkElement) return target.href;
  if (target instanceof HTMLImageElement) return target.src;
  return undefined;
}

export function ClientLogger() {
  useEffect(() => {
    console.info(`${PREFIX} client mounted`, {
      href: window.location.href,
      userAgent: window.navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    const onError = (event: ErrorEvent) => {
      if (event.message.includes(EXTENSION_CHANNEL_CLOSED)) {
        console.info(`${PREFIX} ignored browser extension message-channel warning`);
        return;
      }

      console.error(`${PREFIX} window error`, {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = errorMessage(event.reason);

      if (message.includes(EXTENSION_CHANNEL_CLOSED)) {
        event.preventDefault();
        console.info(`${PREFIX} ignored browser extension promise warning`);
        return;
      }

      console.error(`${PREFIX} unhandled promise rejection`, {
        message,
        stack: errorStack(event.reason),
      });
    };

    const onResourceError = (event: Event) => {
      const url = targetUrl(event.target);
      if (!url) return;

      console.error(`${PREFIX} resource failed to load`, {
        tagName: event.target instanceof Element ? event.target.tagName : undefined,
        url,
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onResourceError, true);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onResourceError, true);
    };
  }, []);

  return null;
}
