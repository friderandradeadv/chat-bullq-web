'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { loginSchema, type LoginFormData } from '../schemas/login.schema';
import { authService } from '../services/auth.service';
import { useAuthStore } from '@/stores/auth-store';
import { Logo } from '@/components/brand/logo';

export function LoginForm() {
  const router = useRouter();
  const { setAuth, setActiveOrg } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await authService.login(data);

      localStorage.setItem('access_token', result.accessToken);
      localStorage.setItem('refresh_token', result.refreshToken);

      setAuth(result.user, result.organizations);
      // setAuth already picks the best org (stored or first available)

      toast.success(`Bem-vindo, ${result.user.name}!`);
      router.push('/inicio');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm space-y-8">
      <div className="flex flex-col items-center space-y-5 text-center">
        <Logo size="lg" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Entre na sua conta para acessar o painel
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            placeholder="seu@email.com"
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            placeholder="••••••"
            {...form.register('password')}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Não tem conta?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
