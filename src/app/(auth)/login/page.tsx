import { LoginForm } from '@/features/auth/components/login-form';
import { ThemeToggle } from '@/features/auth/components/theme-toggle';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950 px-4">
      <ThemeToggle />
      <LoginForm />
    </div>
  );
}
