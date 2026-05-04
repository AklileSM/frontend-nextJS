import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';

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
      <LoginForm next={searchParams?.next} />
    </AuthShell>
  );
}
