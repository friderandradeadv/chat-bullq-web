import { LoginForm } from '@/features/auth/components/login-form';
import { ThemeToggle } from '@/features/auth/components/theme-toggle';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ThemeToggle />
      <LoginForm />
    </div>
  );
}
