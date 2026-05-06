import { AuthShell } from '@/components/auth/AuthShell';
import { RegisterClientIsland } from '@/components/auth/RegisterClientIsland';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create account"
      subtitle="Pick a username and password to start using SiteScope."
      altLink={{ href: '/login', prompt: 'Already have an account?', cta: 'Sign in' }}
    >
      <RegisterClientIsland />
    </AuthShell>
  );
}
