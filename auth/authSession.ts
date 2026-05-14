'use client';

/**
 * Low-level JWT persistence in localStorage.
 *
 * The current key is `a6_auth_v2`. On first read the module transparently
 * migrates any token stored under the legacy key `a6_access_token` so existing
 * browser sessions survive a key rename without forcing re-login.
 *
 * All functions are no-ops in SSR (typeof window check guards them) so they
 * are safe to import in Server Components even though they read the DOM.
 */
const ACCESS_TOKEN_KEY = 'a6_auth_v2';
const LEGACY_ACCESS_TOKEN_KEY = 'a6_access_token';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) return null;

  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) return token;

  // One-time migration so existing sessions survive the key rename.
  const legacyToken = window.localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
  if (!legacyToken) return null;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, legacyToken);
  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  return legacyToken;
}

export function setAccessToken(token: string): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
}
