/** Login, register, identity, email verification, and password reset. */
import type { ApiTokenResponse } from '@/types/api';
import { apiFetch, parseApiError } from './core';

export async function apiLogin(username: string, password: string): Promise<ApiTokenResponse> {
  const response = await apiFetch(
    '/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
    false,
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiTokenResponse>;
}

export async function apiRegister(
  username: string,
  password: string,
  email?: string,
): Promise<ApiTokenResponse> {
  const response = await apiFetch(
    '/auth/register',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        email: email?.trim() || null,
      }),
    },
    false,
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiTokenResponse>;
}

export async function apiFetchCurrentUser(): Promise<ApiTokenResponse['user']> {
  const response = await apiFetch('/auth/me', { method: 'GET' }, true);
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json() as Promise<ApiTokenResponse['user']>;
}

export async function resendVerificationEmail(): Promise<void> {
  const response = await apiFetch('/auth/resend-verification', { method: 'POST' }, true);
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function verifyEmail(token: string): Promise<void> {
  const response = await apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`, { method: 'POST' });
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await apiFetch('/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function validateResetToken(token: string): Promise<void> {
  const response = await apiFetch(`/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const response = await apiFetch('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
}
