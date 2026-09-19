'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Paperclip, Plus, Trash2, User, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

/**
 * Pendência do caso — o que falta para a fase andar.
 *
 * Nasceu porque isso vivia como bloco de texto dentro de "Quais documentos
 * faltantes?": para saber o que fazer era preciso ler tudo e copiar CPF e portal
 * do meio da frase. Aqui cada pendência é um item: quem resolve, por que travou,
 * um botão que abre o portal e um botão por dado a copiar.
 *
 * Vale em TODAS as fases (não é campo de fase), e é interno — o cliente não vê.
 */
export type Pendencia = {
  id: string;
  titulo: string;
  responsavel: 'escritorio' | 'cliente';
  /** Por que não anda sozinho: captcha, senha do cliente, 2FA, assinatura. */
  motivo?: string;
  /** Portal/sistema onde se resolve. */
  url?: string;
  /** O que é preciso ter em mãos (CPF, nascimento, protocolo) — cada um copiável. */
  dados?: { rotulo: string; valor: string }[];
  status: 'pendente' | 'resolvido';
};

const novoId = () => `p${Date.now().toString(36)}`;

function Chip({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(valor); toast.success(`${rotulo} copiado`); }}
      title={`Copiar ${rotulo}`}
      className="inline-flex items-center gap-1 rounded-md border border-[#cfe0ed] bg-white px-1.5 py-0.5 text-[11px] text-[#4b5863] hover:border-[#4a90e2] hover:text-[#1b6ec2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <span className="font-medium">{rotulo}:</span>
      <span className="font-mono">{valor}</span>
      <Copy className="h-3 w-3 opacity-60" />
    </button>
  );
}

export function PendenciasPanel({
  caseId, lista, onChanged, onIrParaAnexos,
}: {
  caseId: string;
  lista: Pendencia[];
  onChanged: (nova: Pendencia[]) => void;
  onIrParaAnexos?: () => void;
}) {
  const [novo, setNovo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const persistir = async (nova: Pendencia[]) => {
    onChanged(nova);
    setSalvando(true);
    // Guardado em metadata.faseData._pendencias.lista: vale para o caso inteiro,
    // não para uma fase — por isso a chave não é o nome de nenhuma fase.
    try { await legalCasesService.saveFaseField(caseId, '_pendencias', 'lista', nova); }
    catch { toast.error('Não consegui salvar a pendência'); }
    finally { setSalvando(false); }
  };

  const pendentes = lista.filter((p) => p.status !== 'resolvido');
  const doEscritorio = pendentes.filter((p) => p.responsavel === 'escritorio').length;

  const alternar = (id: string) => persistir(lista.map((p) => (
    p.id === id ? { ...p, status: p.status === 'resolvido' ? 'pendente' : 'resolvido' } : p
  )));
  const trocarDono = (id: string) => persistir(lista.map((p) => (
    p.id === id ? { ...p, responsavel: p.responsavel === 'cliente' ? 'escritorio' : 'cliente' } : p
  )));
  const remover = (id: string) => persistir(lista.filter((p) => p.id !== id));
  const adicionar = () => {
    const t = novo.trim();
    if (!t) return;
    setNovo('');
    persistir([...lista, { id: novoId(), titulo: t, responsavel: 'escritorio', status: 'pendente' }]);
  };

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#101820] dark:text-zinc-200">Pendências</p>
        <span className="text-[11px] text-[#48626f] dark:text-zinc-400">
          {pendentes.length === 0
            ? 'nada pendente'
            : `${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''}${doEscritorio ? ` · ${doEscritorio} do escritório` : ''}`}
          {salvando && ' · salvando…'}
        </span>
      </div>

      <ul className="mt-2 space-y-2">
        {lista.map((p) => {
          const ok = p.status === 'resolvido';
          return (
            <li key={p.id}
              className={`rounded-lg border px-2.5 py-2 ${ok
                ? 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40'
                : 'border-[#cfe0ed] bg-white dark:border-zinc-700 dark:bg-zinc-900'}`}>
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => alternar(p.id)} title={ok ? 'Reabrir' : 'Marcar como resolvida'}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${ok ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-300 dark:border-zinc-600'}`}>
                  {ok && <Check className="h-3 w-3 text-white" />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[13px] font-medium ${ok ? 'text-zinc-400 line-through' : 'text-[#101820] dark:text-zinc-200'}`}>{p.titulo}</span>
                    <button type="button" onClick={() => trocarDono(p.id)} title="Trocar quem resolve"
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${p.responsavel === 'cliente'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                        : 'bg-[#228BE6]/10 text-[#1971c2] dark:text-[#74c0fc]'}`}>
                      {p.responsavel === 'cliente' ? <User className="h-2.5 w-2.5" /> : <Building2 className="h-2.5 w-2.5" />}
                      {p.responsavel === 'cliente' ? 'cliente' : 'escritório'}
                    </button>
                  </div>

                  {p.motivo && !ok && (
                    <p className="mt-0.5 text-[11px] leading-4 text-[#48626f] dark:text-zinc-400">{p.motivo}</p>
                  )}

                  {!ok && (p.url || p.dados?.length || onIrParaAnexos) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-[#228BE6] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#1c7ed6]">
                          <ExternalLink className="h-3 w-3" /> Abrir portal
                        </a>
                      )}
                      {p.dados?.map((d) => <Chip key={d.rotulo} rotulo={d.rotulo} valor={d.valor} />)}
                      {onIrParaAnexos && (
                        <button type="button" onClick={onIrParaAnexos}
                          className="inline-flex items-center gap-1 rounded-md border border-[#cfe0ed] px-2 py-1 text-[11px] font-medium text-[#4b5863] hover:border-[#4a90e2] hover:text-[#1b6ec2] dark:border-zinc-700 dark:text-zinc-300">
                          <Paperclip className="h-3 w-3" /> Anexar arquivo
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <button type="button" onClick={() => remover(p.id)} title="Remover pendência"
                  className="mt-0.5 shrink-0 text-zinc-300 hover:text-red-500 dark:text-zinc-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
          placeholder="Nova pendência…"
          className="h-8 flex-1 rounded-lg border border-[#cfe0ed] bg-transparent px-2.5 text-sm text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-200"
        />
        <button type="button" onClick={adicionar} disabled={!novo.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#cfe0ed] text-[#4b5863] hover:border-[#4a90e2] hover:text-[#1b6ec2] disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
