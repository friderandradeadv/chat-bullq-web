'use client';

import { useEffect, useState } from 'react';
import { X, User } from 'lucide-react';

/**
 * Filtro "só os processos DESTE cliente" nos quadros do jurídico.
 *
 * O chat manda o quadro abrir com `?cases=<id,id,id>&cliente=<nome>` — a lista
 * de ids vem do painel do atendimento, que já sabe exatamente quais processos
 * são daquela pessoa. Filtra-se por ID, nunca por nome: homônimo no quadro
 * traria processo de outra pessoa, que é justamente o erro que a trava do
 * vínculo chat↔jurídico existe pra impedir.
 *
 * O nome viaja só pra ESCREVER na tarja — quem filtra é o id.
 */
export function useCasesFilter() {
  const [state, setState] = useState<{ ids: Set<string>; cliente: string | null } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const raw = p.get('cases');
    if (!raw) return;
    const ids = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
    if (!ids.size) return;
    setState({ ids, cliente: p.get('cliente') });
  }, []);

  /** Tira o filtro E limpa o URL — recarregar não deve ressuscitar o recorte. */
  const clear = () => {
    setState(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('cases');
    url.searchParams.delete('cliente');
    window.history.replaceState({}, '', url.toString());
  };

  return {
    /** null = sem recorte (o quadro inteiro). */
    caseIds: state?.ids ?? null,
    cliente: state?.cliente ?? null,
    clear,
    /** Use no .filter() dos cards: `if (!matchesCasesFilter(c.id)) return false`. */
    matchesCasesFilter: (id: string) => !state || state.ids.has(id),
  };
}

/** Tarja do recorte por cliente — diz por que o quadro está pela metade e
 *  dá a saída num clique. Sem ela o quadro filtrado parece quadro vazio. */
export function CasesFilterBanner({
  cliente,
  total,
  onClear,
}: {
  cliente: string | null;
  total: number;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-1.5 text-xs lg:px-6">
      <User className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="text-zinc-600 dark:text-zinc-300">
        Mostrando só os processos de{' '}
        <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
          {cliente || 'um cliente'}
        </strong>{' '}
        <span className="text-zinc-400">
          ({total} {total === 1 ? 'processo' : 'processos'} neste quadro)
        </span>
      </span>
      <button
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 rounded-full border border-primary/30 px-2 py-0.5 font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <X className="h-3 w-3" /> Ver o quadro inteiro
      </button>
    </div>
  );
}
