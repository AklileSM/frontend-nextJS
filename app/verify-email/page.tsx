import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
import { VerifyEmailContent } from './VerifyEmailContent';

export const dynamic = 'force-dynamic';

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Email verification">
      <Suspense>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}
