# Authentication Flows (frontend)

Covers everything except the login form: registration, email verification, forgot-password, password reset. Pairs with `backend/AUTH_AND_EMAIL.md` for the server side.

## Pages


| Route                     | File                           | Auth required    |
| ------------------------- | ------------------------------ | ---------------- |
| `/login`                  | `app/login/page.tsx`           | No               |
| `/register`               | `app/register/page.tsx`        | No               |
| `/forgot-password`        | `app/forgot-password/page.tsx` | No               |
| `/reset-password?token=…` | `app/reset-password/page.tsx`  | No (token-gated) |
| `/verify-email?token=…`   | `app/verify-email/page.tsx`    | No (token-gated) |
| `/unauthorized`           | `app/unauthorized/page.tsx`    | No               |


All five sit outside the app shell and reuse `components/auth/AuthShell.tsx` for the centered card layout.

## Token storage

Single source of truth: `auth/authSession.ts`. The JWT is persisted in `localStorage` under the key `a6_auth_v2`:

```jsonc
// localStorage["a6_auth_v2"]
{
  "accessToken": "eyJ…",
  "user": {
    "id": "…",
    "username": "alice",
    "email": "alice@example.com",
    "is_admin": false,
    "email_verified": true
  }
}
```

`getAccessToken()` returns just the token string. `clearAccessToken()` wipes the whole entry.

A legacy key (`a6_access_token`) is read once and migrated transparently, old sessions don't need to re-login on upgrade.

## AuthContext lifecycle

```
mount AuthProvider
  ↓
read localStorage → if a token exists, optimistically set user from cache
  ↓
call apiFetchCurrentUser() → GET /api/auth/me
  ├── 200 → confirm user, set isLoading=false
  └── 401 → clearAccessToken(), set user=null
```

`useAuth()` exposes:

```ts
{
  user: AuthUser | null;
  isAuthenticated: boolean;     // !!user
  isLoading: boolean;           // true until /me settles
  login(username, password): Promise<void>;
  register(username, password, email?): Promise<void>;
  logout(): void;
  refreshUser(): Promise<void>; // re-fetches /me, used after verify-email
}
```

Every component that depends on auth state reads from `useAuth()`. There's no direct `localStorage` reading anywhere else.

## Global 401 handling

Inside `services/apiClient.ts::apiFetch`:

```ts
if (response.status === 401 && !on('/login') && !on('/register')) {
  clearAccessToken();
  window.location.replace('/login');
}
```

This is a **hard** redirect, not `router.push`, so all in-memory state is dropped. The login and register pages are excluded so a bad-credentials 401 doesn't redirect-loop.

There is no token refresh. When the 7-day JWT expires, the next API call triggers this redirect.

## Registration

`app/register/page.tsx`:

1. User submits `{username, password, email?}`.
2. `AuthContext.register(...)` → `apiRegister(...)` → `POST /api/auth/register`.
3. Response includes `{access_token, user}`. The provider sets both and redirects to `/app`.
4. If `email` was provided, the backend fires `send_verification_email()` in the background. The user lands in the app with `email_verified=false`; nothing blocks them.

> **The first user registered becomes admin.** This is enforced on the backend (`user_count == 0 → is_admin = True`). For a fresh deployment, register your own account before anyone else does.

## Email verification

```
1. /register with an email   → token stored, verification email sent
2. User clicks link in email → opens /verify-email?token=<urlsafe-token>
3. /verify-email reads ?token, calls verifyEmail(token):
     POST /api/auth/verify-email?token=<token>
     ├── 204 → success state; calls refreshUser() to update email_verified flag
     └── 400 → "invalid or expired" error state with a link to /app/profile to resend
4. From profile, the user can call resendVerificationEmail()
   → POST /api/auth/resend-verification (auth required) → new 7-day token
```

`VerifyEmailContent.tsx` handles all three states (`verifying`, `success`, `error`) on the same page. The error path links back to `/app/profile` rather than `/app` so the user has the resend button at hand.

**Behavior when SMTP isn't configured:** registration still completes, and the user can see "email not verified" in their profile. Resending also silently fails. To work around it in dev, read the verification token from Postgres:

```sql
SELECT email_verification_token FROM users WHERE username='alice';
```

Then construct `/verify-email?token=<that>` and visit it.

## Forgot-password

`app/forgot-password/page.tsx` is a thin wrapper around `components/auth/ForgotPasswordForm.tsx`:

1. User enters an email and submits.
2. `requestPasswordReset(email)` → `POST /api/auth/request-password-reset`.
3. The backend **always returns 204** (no enumeration). The UI shows a generic success message regardless of whether the email exists.

## Reset-password

`app/reset-password/page.tsx` reads `?token=` from the URL via `useSearchParams()` inside `<Suspense>` (App Router requires this).

The form flow inside `ResetPasswordForm.tsx`:

1. On mount, call `validateResetToken(token)` → `GET /api/auth/validate-reset-token?token=…`.
  - 204 → render the new-password form.
  - 400 → show an "invalid / expired" message with a link back to `/forgot-password`.
2. User types a new password (and confirms it client-side).
3. Submit → `resetPassword(token, newPassword)` → `POST /api/auth/reset-password`.
  - 204 → success; redirect to `/login`. No JWT is issued by the reset endpoint, the user logs in fresh.
  - 400 → error toast (token may have expired between the preflight and submit; the 1-hour TTL is unforgiving).

## Token TTLs


| Token              | Lifetime   | Where in code                  |
| ------------------ | ---------- | ------------------------------ |
| JWT access token   | 7 days     | `backend/app/core/security.py` |
| Email verification | 7 days     | `backend/app/api/auth.py:25`   |
| Password reset     | **1 hour** | `backend/app/api/auth.py:26`   |


The short password-reset TTL means a user who clicks the link the next day must request a fresh one. Cap your UX expectations accordingly.

## Protected routes

`components/layout/ProtectedRoute.tsx` wraps every authenticated layout. On mount it checks `useAuth().isAuthenticated` and:

- Not authenticated → `router.replace('/login')`
- Authenticated → render children
- Optional `roles` prop → redirects to `/unauthorized` if the user's `is_admin` doesn't satisfy a required `admin` role

The actual permission enforcement is server-side; this is purely UX so non-authenticated users don't see a flash of empty app shell while API calls 401.

## Logout

`AuthContext.logout()`:

1. Calls `clearAccessToken()` (wipes `a6_auth_v2`).
2. Sets `user=null` in context.
3. `router.replace('/login')`.

No server call, JWT is stateless, and signing the user out is a client-only operation. If you need server-side session invalidation (e.g., "log out everywhere"), rotate `JWT_SECRET` on the backend.

## Where the code lives


| Concern                 | File                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token storage           | `auth/authSession.ts`                                                                                                                                                               |
| Auth state + actions    | `context/AuthContext.tsx`                                                                                                                                                           |
| Centered card shell     | `components/auth/AuthShell.tsx`                                                                                                                                                     |
| Forms                   | `components/auth/LoginForm.tsx`, `RegisterForm.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`                                                                              |
| Verify-email page logic | `app/verify-email/VerifyEmailContent.tsx`                                                                                                                                           |
| Global 401 redirect     | `services/apiClient.ts::apiFetch`                                                                                                                                                   |
| Protected route guard   | `components/layout/ProtectedRoute.tsx`                                                                                                                                              |
| API client wrappers     | `services/apiClient.ts` (`apiLogin`, `apiRegister`, `apiFetchCurrentUser`, `verifyEmail`, `resendVerificationEmail`, `requestPasswordReset`, `validateResetToken`, `resetPassword`) |
| Backend token logic     | `backend/AUTH_AND_EMAIL.md`                                                                                                                                                         |


