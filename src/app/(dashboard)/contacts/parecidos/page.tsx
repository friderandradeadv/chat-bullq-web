'use client';

// Contatos parecidos = a MESMA pessoa cadastrada duas vezes com nomes diferentes
// ("Nara" e "Nara Regina dos Passos Silva"). O agrupamento vem do backend por
// TELEFONE e por CPF — nunca por nome parecido: "Maria de Fátima" são 31 pessoas
// diferentes nesta base, e juntar por nome empilharia estranhos como a mesma
// pessoa. Aqui só se PADRONIZA O NOME (o mais completo do grupo); ninguém funde
// conversa nem processo — isso continua sendo decisão sua, contato a contato.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Loader2, Phone, IdCard, Check, MessageSquare, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { contactsService, type GrupoParecido } from '@/features/contacts/services/contacts.service';
import { avatarColor, avatarInitials } from '@/lib/avatar';
import { formatPhone } from '@/lib/brazil-states';

const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export default function ContatosParecidosPage() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['contacts', 'parecidos'],
    queryFn: () => contactsService.parecidos(),
  });
  const [busy, setBusy] = useState<string | null>(null);
  const grupos = data?.grupos ?? [];

  const totalContatos = useMemo(
    () => grupos.reduce((s, g) => s + g.contatos.length, 0),
    [grupos],
  );

  /** Aplica o nome escolhido a todos os OUTROS contatos do grupo. */
  const padronizar = async (g: GrupoParecido, nome: string) => {
    const alvos = g.contatos.filter((c) => (c.name ?? '') !== nome);
    if (!alvos.length) return;
    if (!confirm(`Renomear ${alvos.length} contato(s) para "${nome}"?\n\nSó o nome muda — conversas, etiquetas e processos ficam como estão.`)) return;
    setBusy(g.chave);
    try {
      for (const c of alvos) await contactsService.update(c.id, { name: nome } as any);
      toast.success(`${alvos.length} contato(s) renomeado(s)`);
      qc.invalidateQueries({ queryKey: ['contacts'] });
      refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao renomear');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Users className="h-5 w-5 text-[#e11970]" />
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Contatos parecidos</h1>
        <span className="rounded bg-[#edeff3] px-2 py-0.5 text-[13px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">
          {grupos.length} grupo(s) · {totalContatos} contatos
        </span>
        {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
        <Link href="/contacts" className="ml-auto text-sm font-medium text-[#228BE6] hover:underline">
          ← Todos os contatos
        </Link>
      </div>

      <p className="mb-5 rounded-xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        Agrupado por <b>telefone</b> e <b>CPF</b> — nunca por nome parecido. Nesta base, “Maria de Fátima” são 31 pessoas
        diferentes: juntar por semelhança de nome misturaria clientes. Padronizar o nome <b>não</b> funde conversas nem
        processos; serve para o cadastro curto (“Nara”) passar a ser encontrado pelo nome completo.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
      ) : grupos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nenhum contato repetido com nomes diferentes. 🎉
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => {
            const sugerido = g.contatos[0]?.name ?? '';
            return (
              <div key={`${g.tipo}:${g.chave}`} className="rounded-xl border border-[#dcdfe5] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {g.tipo === 'telefone' ? <Phone className="h-4 w-4 text-zinc-400" /> : <IdCard className="h-4 w-4 text-zinc-400" />}
                  <span className="font-mono text-sm text-zinc-600 dark:text-zinc-300">
                    {g.tipo === 'telefone' ? formatPhone(g.chave) || g.chave : g.chave}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {g.contatos.length} cadastros
                  </span>
                  <button
                    onClick={() => padronizar(g, sugerido)}
                    disabled={busy === g.chave || !sugerido}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#e11970] px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
                    title={`Renomear os demais para "${sugerido}"`}
                  >
                    {busy === g.chave ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Padronizar nome
                  </button>
                </div>

                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {g.contatos.map((c, i) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                      {c.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ background: avatarColor(c.name ?? c.id) }}
                        >
                          {avatarInitials(c.name ?? '?')}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {c.name || '(sem nome)'}
                          {i === 0 && (
                            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                              nome mais completo
                            </span>
                          )}
                        </span>
                        <span className="block text-[11px] text-zinc-400">
                          criado em {fmtData(c.criadoEm)}
                          {c.cpf ? ` · CPF ${c.cpf}` : ''}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-400" title="Conversas neste cadastro">
                        <MessageSquare className="h-3.5 w-3.5" /> {c.conversas}
                      </span>
                      <Link
                        href={`/contacts?search=${encodeURIComponent(c.phone ?? c.name ?? '')}`}
                        className="inline-flex items-center gap-1 rounded-md border border-[#cfe0ed] px-2 py-1 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Abrir <ExternalLink className="h-3 w-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
