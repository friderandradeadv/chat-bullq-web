import { Suspense } from 'react';
import { RegisterForm } from '@/features/auth/components/register-form';
import { ThemeToggle } from '@/features/auth/components/theme-toggle';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ThemeToggle />
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
