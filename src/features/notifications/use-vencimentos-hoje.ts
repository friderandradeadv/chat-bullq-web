'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type ContaAPagar = { id: string; nome: string; valor: number; vencimento: string; categoria: string | null };
type Bloco = { count: number; total: number; itens: ContaAPagar[] };

export type VencimentosHoje = {
  count: number; // vence hoje + já vencido em aberto (é este que vira a bolinha)
  total: number;
  hoje: Bloco;
  vencidas: Bloco;
};

async function fetchVencimentos(): Promise<VencimentosHoje | null> {
  const { data } = await api.get('/financeiro/vencimentos-hoje');
  return (data.data ?? data) ?? null;
}

/**
 * Contas a pagar que vencem HOJE + as já VENCIDAS e não pagas — alimenta a bolinha
 * do item "Financeiro" na barra de baixo. A vencida continua contando enquanto
 * ninguém paga (igual tarefa atrasada); quem zera é a baixa do lançamento.
 * Devolve os dois números separados porque a COR da bolinha depende disso:
 * laranja quando só vence hoje, vermelho assim que existe atrasada — mesmo código
 * de cor dos avisos de vencimento (🟠 hoje / 🔴 vencido).
 * Só consulta para OWNER/ADMIN (o endpoint é dos sócios). Cai na hora quando a tela
 * do financeiro invalida a queryKey ['financeiro', ...] (ex.: ao dar baixa na conta).
 */
export function useContasVencendo(): { count: number; hoje: number; vencidas: number } {
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user);
  const organizations = useAuthStore((s) => s.organizations);
  const role = organizations.find((o) => o.id === activeOrgId)?.role;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  const query = useQuery({
    queryKey: ['financeiro', 'vencimentos-hoje', activeOrgId],
    queryFn: fetchVencimentos,
    enabled: !!user && !!activeOrgId && isAdmin,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  const d = query.data;
  return { count: d?.count ?? 0, hoje: d?.hoje?.count ?? 0, vencidas: d?.vencidas?.count ?? 0 };
}
