'use client';

/**
 * O PICKER DE CONTATO DO CLIENTE, COM O TELEFONE À VISTA.
 *
 * 🚨 POR QUE EXISTE (22/10/2026). A varredura do churning deixou 31 ofertas em
 * processos cujo cliente não tem WhatsApp vinculado, e o pedido foi *"vincula o
 * whatsapp dos 26"*. Medir mostrou que só 5 têm o CPF batendo: nos outros o que
 * existe é nome parecido, e um deles tem DOIS telefones diferentes. A regra que
 * o hub já carregava é clara: *"nunca automático por nome, pra não cair em
 * homônimo"*.
 *
 * Então o servidor mede e esta tela mostra o que ele mediu; **o vínculo é um
 * clique do advogado**. O picker que já existia no envio da prestação busca por
 * nome e NÃO mostra o telefone, que é justamente o dado com que se desempata um
 * homônimo: aqui o número aparece em cada linha, e quem tem CPF conferido vem
 * marcado e em primeiro lugar.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Loader2, MessageSquare, Phone, Search, ShieldAlert, UserCircle2, X } from 'lucide-react';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

/** 558198679677 vira +55 81 9867-9677: número que não se lê não serve de conferência. */
function telefoneLegivel(t: string | null): string {
  const d = String(t ?? '').replace(/\D/g, '');
  if (d.length < 10) return t || 'sem número';
  const corpo = d.startsWith('55') ? d.slice(2) : d;
  const ddd = corpo.slice(0, 2);
  const resto = corpo.slice(2);
  return `+${d.startsWith('55') ? '55 ' : ''}${ddd} ${resto.slice(0, -4)}-${resto.slice(-4)}`;
}

/**
 * Quantos candidatos a tela mostra antes de pedir para abrir o resto.
 *
 * 🚨 MEDIDO EM 22/10/2026, e o número não é estético. Nas 26 ofertas que
 * sobraram, 17 clientes têm de 1 a 3 candidatos (clique fácil) e 7 passam de 8:
 * "MARIA APARECIDA PEREIRA DE SOUZA" casa **43 contatos**. Apertar a RÉGUA para
 * limpar essas 7 telas deixaria **13 dos 26 sem candidato nenhum**, escondendo o
 * contato certo de 12 clientes — a porta negativa de sempre. Então quem aperta é
 * a tela: ordem por força da coincidência, corte, e o resto a um clique.
 */
const MOSTRAR_DE_INICIO = 8;

export function VincularContatoCliente({
  caseId, clienteNome, onClose, onVinculado,
}: {
  caseId: string;
  clienteNome: string;
  onClose: () => void;
  onVinculado?: () => void;
}) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const [verTodos, setVerTodos] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['cliente-contatos-candidatos', caseId],
    queryFn: () => legalCasesService.contatosCandidatosDoCliente(caseId),
    refetchOnWindowFocus: false,
  });

  const vincular = useMutation({
    mutationFn: (contactId: string) => legalCasesService.vincularContatoCliente(caseId, contactId),
    onSuccess: (r) => {
      if (!r?.ok) { toast.error(r?.motivo || 'Não consegui vincular o contato'); return; }
      toast.success('Contato vinculado ✅');
      onVinculado?.();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.message || 'Erro ao vincular'),
  });

  const candidatos = data?.candidatos ?? [];
  /* O filtro casa nome E telefone, porque num homônimo o que ele reconhece é o
     DDD: digitar "81" ou "Souza" corta 43 linhas em duas. Dobra acento para
     "Antonio" achar "Antônio". */
  const dobrar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtrados = useMemo(() => {
    const q = dobrar(filtro.trim());
    if (!q) return candidatos;
    return candidatos.filter((c) =>
      dobrar(c.nome ?? '').includes(q) || String(c.telefone ?? '').includes(q));
  }, [candidatos, filtro]);
  const visiveis = verTodos || filtro.trim() ? filtrados : filtrados.slice(0, MOSTRAR_DE_INICIO);
  const escondidos = filtrados.length - visiveis.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="text-base font-bold leading-5 text-zinc-800 dark:text-zinc-100">
            WhatsApp de {clienteNome}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:text-zinc-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> medindo os contatos…
          </p>
        ) : (
          <>
            {/* O veredito do servidor, antes da lista: é ele que diz se o clique
                é seguro ou se o número tem de ser conferido. */}
            <p className={`mb-3 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs leading-4 ${
              data?.podeVincularDireto
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'}`}>
              {data?.podeVincularDireto
                ? <BadgeCheck className="mt-px h-3.5 w-3.5 shrink-0" />
                : <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" />}
              <span>{data?.aviso}</span>
            </p>

            {/* Busca só quando a lista é grande: em três candidatos ela é mais
                um campo para ler, e em 43 é o que resolve. */}
            {candidatos.length > MOSTRAR_DE_INICIO && (
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="filtrar por nome ou DDD…"
                  className="h-8 w-full rounded-lg border border-zinc-300 bg-white pl-7 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            )}

            {candidatos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
                Nenhum contato para escolher.
              </p>
            ) : filtrados.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
                Nenhum dos {candidatos.length} candidatos casa com “{filtro}”.
              </p>
            ) : (
              <div className="flex max-h-[46vh] flex-col gap-1.5 overflow-y-auto">
                {visiveis.map((c) => {
                  const ativo = escolhido === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setEscolhido(c.id)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                        ativo
                          ? 'border-[#228BE6] bg-[#228BE6]/5'
                          : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'}`}
                    >
                      <UserCircle2 className="h-4 w-4 shrink-0 text-zinc-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                          {c.nome || 'sem nome no cadastro'}
                        </p>
                        {/* 🚨 O TELEFONE é o dado que desempata homônimo: fica
                            na linha, em fonte de leitura, nunca escondido. */}
                        <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                          <Phone className="h-3 w-3 shrink-0 text-zinc-400" />
                          {telefoneLegivel(c.telefone)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {c.prova === 'cpf' ? (
                          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                            <BadgeCheck className="h-3 w-3" /> CPF confere
                          </span>
                        ) : (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                            só o nome
                          </span>
                        )}
                        {c.temConversa ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500">
                            <MessageSquare className="h-3 w-3" /> tem conversa
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">sem conversa</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {escondidos > 0 && (
              <button
                onClick={() => setVerTodos(true)}
                className="mt-1.5 w-full rounded-lg border border-dashed border-zinc-300 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                mostrar os outros {escondidos}
              </button>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-[11px] leading-3 text-zinc-400">
                Confira o número antes de vincular.
              </p>
              <button
                onClick={() => escolhido && vincular.mutate(escolhido)}
                disabled={!escolhido || vincular.isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-[#02883C] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {vincular.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Vincular
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
