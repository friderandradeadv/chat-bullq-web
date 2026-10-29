'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Lock } from 'lucide-react';
import { financeiroPessoalService as svc, type BillMonthItem } from './financeiro-pessoal.service';

// Contas PESSOAIS dentro de Financeiro → Contas a pagar. Só aviso e "Paguei":
// nada entra no livro-razão, no caixa nem no total do escritório — é a mesma
// tabela de Minhas contas, que o servidor devolve só para o próprio usuário.

const brl = (c: number | null) => (c == null ? 'valor a definir' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (comp: string) => MESES[Number(comp.slice(5, 7)) - 1];
function somaMes(comp: string, n: number) {
  const [a, m] = comp.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
const diasAte = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

type Item = BillMonthItem & { competencia: string };

/**
 * Fonte única do bloco e das bolinhas: a PRÓXIMA ocorrência em aberto de cada
 * conta (a vencida mais antiga, ou a próxima a vencer), olhando de dois meses
 * atrás ao mês seguinte. Cartão: a competência é o mês de referência da fatura.
 */
export function usePessoaisEmAberto() {
  const hoje = new Date();
  const comp = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  return useQuery({
    queryKey: ['financeiro-pessoal', 'a-pagar', comp],
    queryFn: async () => {
      const meses = await Promise.all([-2, -1, 0, 1].map((n) => svc.month(somaMes(comp, n))));
      const hojeISO = meses[2].hoje;
      const porConta = new Map<string, Item>();
      for (const m of meses) {
        for (const i of m.items) {
          if (i.status === 'paga') continue;
          const atual = porConta.get(i.billId);
          if (!atual || i.vencimento < atual.vencimento) porConta.set(i.billId, { ...i, competencia: m.competencia });
        }
      }
      const itens = [...porConta.values()].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
      return {
        hojeISO,
        itens,
        atrasadas: itens.filter((i) => i.vencimento < hojeISO).length,
        hoje: itens.filter((i) => i.vencimento === hojeISO).length,
      };
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function ContasPessoaisNoFinanceiro() {
  const qc = useQueryClient();
  const q = usePessoaisEmAberto();

  async function paguei(i: Item) {
    try {
      await svc.updateMonth(i.billId, { competencia: i.competencia, paid: true });
      toast.success(`${i.name}: marcada como paga`);
      qc.invalidateQueries({ queryKey: ['financeiro-pessoal'] });
    } catch {
      toast.error('Não consegui marcar como paga.');
    }
  }

  // Sem conta pessoal em aberto, o bloco nem aparece: a aba é do escritório.
  if (!q.data || q.data.itens.length === 0) return null;
  const { itens, hojeISO } = q.data;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-violet-200/70 dark:border-violet-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-violet-50/70 px-4 py-2.5 dark:bg-violet-900/15">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-800 dark:text-violet-300">
          <Lock className="h-3.5 w-3.5" /> Minhas contas pessoais · só você vê
        </p>
        <Link href="/minhas-contas" className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300">Ver todas</Link>
      </div>
      {itens.map((i) => {
        const d = diasAte(hojeISO, i.vencimento);
        const selo = d < 0
          ? { t: `Vencida há ${-d} dia${d === -1 ? '' : 's'}`, c: 'bg-rose-500 text-white' }
          : d === 0
            ? { t: 'Vence hoje', c: 'bg-orange-500 text-white' }
            : { t: `Vence em ${d} dia${d === 1 ? '' : 's'}`, c: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' };
        return (
          <div key={`${i.billId}|${i.competencia}`} className="flex flex-wrap items-center gap-3 border-t border-violet-100 px-4 py-2.5 dark:border-violet-900/30">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{i.name}</p>
              <p className="text-xs text-zinc-500">
                {i.kind === 'cartao' && <>Fatura de {nomeMes(i.competencia)} · </>}Vence {ddmm(i.vencimento)} · {brl(i.amountCents)}
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${selo.c}`}>{selo.t}</span>
            <button onClick={() => paguei(i)} className="inline-flex items-center gap-1 rounded-md border border-emerald-600 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10">
              <Check className="h-3.5 w-3.5" /> Paguei
            </button>
          </div>
        );
      })}
    </div>
  );
}
