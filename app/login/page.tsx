import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';
import { AuthPageProviders } from '@/components/providers/RouteProviders';

export const dynamic = 'force-dynamic';

type LoginPageProps = {
  searchParams?: {
    next?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Use your username and password."
      altLink={{ href: '/register', prompt: "Don't have an account?", cta: 'Create one' }}
    >
      <AuthPageProviders>
        <LoginForm next={searchParams?.next} />
      </AuthPageProviders>
    </AuthShell>
  );
}
