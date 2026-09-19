'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DropZone } from '@/components/drop-zone';
import { Check, Copy, ExternalLink, Paperclip, Pencil, Plus, Trash2, Upload, User, Building2, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { inboxService } from '@/features/inbox/services/inbox.service';
import type { ConversaDoCliente } from '@/components/ui/abrir-conversa';

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
  /** Quando o pedido foi enviado ao cliente — base para cobrar de novo. */
  pedidoEm?: string;
};

const novoId = () => `p${Date.now().toString(36)}`;

/**
 * A lista vem do metadata do contato, que é campo livre — e já entrou lixo ali:
 * um item sem id e sem título, resíduo do editor que salvava em branco.
 *
 * 🚨 Item sem id não era só feio: fazia `rascunho?.id === p.id` comparar
 * undefined com undefined, o que é VERDADEIRO. O editor abria com rascunho nulo,
 * lia `null.dados` e derrubava a página inteira ao abrir o card.
 *
 * Por isso o saneamento é na porta de entrada, não no render: id sempre existe, e
 * pendência sem título não diz o que falta — não entra.
 */
function normalizar(bruta: unknown): Pendencia[] {
  if (!Array.isArray(bruta)) return [];
  return bruta
    .filter((p): p is Record<string, any> => !!p && typeof p === 'object')
    .map((p) => ({
      id: String(p.id ?? '').trim() || novoId(),
      titulo: String(p.titulo ?? '').trim(),
      responsavel: p.responsavel === 'cliente' ? ('cliente' as const) : ('escritorio' as const),
      motivo: String(p.motivo ?? '').trim() || undefined,
      url: String(p.url ?? '').trim() || undefined,
      dados: Array.isArray(p.dados)
        ? p.dados
            .filter((d: any) => d && String(d.rotulo ?? '').trim())
            .map((d: any) => ({ rotulo: String(d.rotulo).trim(), valor: String(d.valor ?? '') }))
        : undefined,
      status: p.status === 'resolvido' ? ('resolvido' as const) : ('pendente' as const),
      pedidoEm: String(p.pedidoEm ?? '').trim() || undefined,
    }))
    .filter((p) => p.titulo !== '');
}

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
  caseId, onIrParaAnexos, onAnexado, conversa, clienteNome,
}: {
  caseId: string;
  onIrParaAnexos?: () => void;
  /** Avisa o card para recarregar a lista de anexos depois do upload. */
  onAnexado?: () => void;
  /** Conversa do cliente no WhatsApp — sem ela não há para onde enviar o pedido. */
  conversa?: ConversaDoCliente | null;
  clienteNome?: string | null;
}) {
  const qc = useQueryClient();
  // A lista mora no CLIENTE, não no caso: o mesmo cliente tem um card por réu, e
  // "falta o print do IR" é dele, não de cada processo. Resolveu, some de todos.
  const { data, isLoading, error } = useQuery({
    queryKey: ['pendencias-cliente', caseId],
    queryFn: () => legalCasesService.lerPendencias(caseId),
    enabled: !!caseId,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const lista = useMemo(() => normalizar(data?.lista), [data]);
  const [novo, setNovo] = useState('');
  // O rascunho vive AQUI, não dentro do <Editor>: componente filho some numa
  // remontagem e leva o que foi digitado junto — foi o que aconteceu.
  const [rascunho, setRascunho] = useState<Pendencia | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [subindo, setSubindo] = useState<string | null>(null);

  const persistir = async (nova: Pendencia[]) => {
    qc.setQueryData(['pendencias-cliente', caseId], (old: any) => ({ ...(old ?? {}), lista: nova }));
    setSalvando(true);
    try {
      await legalCasesService.salvarPendencias(caseId, nova);
      // Outros cards do mesmo cliente mostram a mesma lista — invalida todos.
      qc.invalidateQueries({ queryKey: ['pendencias-cliente'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui salvar a pendência');
    } finally { setSalvando(false); }
  };

  /**
   * Sobe os arquivos soltos no item e marca a pendência como resolvida — quem
   * arrastou o print já fez o que faltava, e ter de clicar de novo no quadradinho
   * é o tipo de passo que se esquece.
   */
  const subirArquivos = async (p: Pendencia, files: File[]) => {
    if (!files.length) return;
    setSubindo(p.id);
    try {
      for (const f of files) {
        const base64 = await new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.onerror = () => rej(new Error('falha ao ler o arquivo'));
          fr.readAsDataURL(f);
        });
        await legalCasesService.uploadDocumento(caseId, { nome: f.name, base64, mime: f.type, categoria: 'pendencia' });
      }
      toast.success(files.length > 1 ? `${files.length} arquivos anexados` : 'Arquivo anexado');
      onAnexado?.();
      await persistir(lista.map((x) => (x.id === p.id ? { ...x, status: 'resolvido' as const } : x)));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui anexar o arquivo');
    } finally {
      setSubindo(null);
    }
  };

  const [pedindo, setPedindo] = useState(false);

  /**
   * O pedido dos documentos que dependem do CLIENTE, em uma mensagem só.
   *
   * Mandar um pedido por item vira enxurrada e ninguém responde; mandar sem
   * dizer por que precisa também não. Aqui vai a lista com o motivo de cada um,
   * na ordem em que estão no card.
   *
   * 🚨 Só o advogado dispara, por clique. O texto é montado aqui, mas quem
   * manda é quem leu — e a mensagem sai da conversa que já existe.
   */
  const textoDoPedido = (itens: Pendencia[]): string => {
    const primeiro = (clienteNome ?? '').trim().split(/\s+/)[0] || 'Senhor(a)';
    const l: string[] = [];
    l.push(`${primeiro}, para eu entrar com a sua ação ainda falta o seguinte:`);
    l.push('');
    itens.forEach((p, i) => {
      l.push(`${i + 1}. ${p.titulo}`);
      if (p.motivo) l.push(`   ${p.motivo}`);
    });
    l.push('');
    l.push('Pode mandar por aqui mesmo, foto serve. Assim que chegar, eu sigo com o seu caso.');
    return l.join('\n');
  };

  const pedirAoCliente = async () => {
    const doCliente = lista.filter((p) => p.status !== 'resolvido' && p.responsavel === 'cliente');
    if (!doCliente.length) { toast.error('Nenhuma pendência do cliente em aberto.'); return; }
    if (!conversa?.conversationId) {
      toast.error('Sem conversa vinculada a este cliente — vincule o WhatsApp dele antes.');
      return;
    }
    setPedindo(true);
    try {
      await inboxService.sendMessage({
        conversationId: conversa.conversationId,
        type: 'text',
        content: { text: textoDoPedido(doCliente) },
        oneOff: true,
      });
      // Fica no card QUANDO se pediu: é o que diz se já é hora de cobrar de novo.
      await persistir(lista.map((p) => (
        doCliente.some((d) => d.id === p.id) ? { ...p, pedidoEm: new Date().toISOString() } : p
      )));
      toast.success(`Pedido enviado — ${doCliente.length} documento(s)`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui enviar o pedido.');
    } finally { setPedindo(false); }
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
  const salvarRascunho = async () => {
    const r = rascunho;
    if (!r) return;
    if (!r.titulo.trim()) { toast.error('A pendência precisa de um título.'); return; }
    // Se o item sumiu da lista (refetch no meio da edição, id trocado), ele entra
    // de novo em vez de o texto se perder em silêncio.
    const nova = lista.some((x) => x.id === r.id)
      ? lista.map((x) => (x.id === r.id ? r : x))
      : [...lista, r];
    setRascunho(null);
    await persistir(nova);
    toast.success('Pendência salva');
  };
  const adicionar = () => {
    const t = novo.trim();
    if (!t) return;
    setNovo('');
    persistir([...lista, { id: novoId(), titulo: t, responsavel: 'escritorio', status: 'pendente' }]);
  };

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#101820] dark:text-zinc-200" title="Valem para todos os processos deste cliente">
          Pendências <span className="font-normal text-[#48626f] dark:text-zinc-400">do cliente</span>
        </p>
        <span className="text-[11px] text-[#48626f] dark:text-zinc-400">
          {isLoading ? 'carregando…' : pendentes.length === 0
            ? 'nada pendente'
            : `${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''}${doEscritorio ? ` · ${doEscritorio} do escritório` : ''}`}
          {salvando && ' · salvando…'}
        </span>
      </div>

      {error ? (
        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          {(error as any)?.response?.data?.message || 'Não consegui ler as pendências deste cliente.'}
        </p>
      ) : null}

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

                  {!ok && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-[#228BE6] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#1c7ed6]">
                          <ExternalLink className="h-3 w-3" /> Abrir portal
                        </a>
                      )}
                      {p.dados?.map((d) => <Chip key={d.rotulo} rotulo={d.rotulo} valor={d.valor} />)}
                      <DropZone multiple disabled={subindo === p.id} onFiles={(fs) => void subirArquivos(p, fs)}
                        className="inline-block" overlayLabel="Soltar aqui">
                        <label className={`inline-flex items-center gap-1 rounded-md border border-dashed border-[#9dc3e6] px-2 py-1 text-[11px] font-medium ${subindo === p.id ? 'opacity-50' : 'cursor-pointer text-[#1b6ec2] hover:border-[#4a90e2] hover:bg-[#eef4fa]'} dark:border-zinc-600 dark:text-[#7db2e8]`}
                          title="Arraste os arquivos aqui ou clique para escolher. Ao soltar, a pendência é marcada como resolvida.">
                          <Upload className="h-3 w-3" />
                          {subindo === p.id ? 'Enviando…' : 'Arraste os arquivos aqui'}
                          <input type="file" multiple className="hidden" disabled={subindo === p.id}
                            onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; void subirArquivos(p, fs); }} />
                        </label>
                      </DropZone>
                      {onIrParaAnexos && (
                        <button type="button" onClick={onIrParaAnexos} title="Ver os anexos do card"
                          className="inline-flex items-center gap-1 rounded-md border border-[#cfe0ed] px-2 py-1 text-[11px] font-medium text-[#4b5863] hover:border-[#4a90e2] hover:text-[#1b6ec2] dark:border-zinc-700 dark:text-zinc-300">
                          <Paperclip className="h-3 w-3" /> Ver anexos
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => setRascunho(rascunho !== null && rascunho.id === p.id ? null : { ...p })} title="Editar pendência"
                    className="text-zinc-300 hover:text-[#1b6ec2] dark:text-zinc-600">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => remover(p.id)} title="Remover pendência"
                    className="text-zinc-300 hover:text-red-500 dark:text-zinc-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {rascunho !== null && rascunho.id === p.id && (
                <Editor valor={rascunho} onChange={setRascunho} onSalvar={salvarRascunho} />
              )}
            </li>
          );
        })}
      </ul>

      {(() => {
        const doCliente = lista.filter((p) => p.status !== 'resolvido' && p.responsavel === 'cliente');
        if (!doCliente.length) return null;
        // Há quantos dias o pedido foi feito: é o que diz se já passou da hora
        // de cobrar. Sem isso, "mandar de novo" vira chute — ou insistência.
        const carimbos = doCliente.map((p) => p.pedidoEm).filter(Boolean) as string[];
        const ultimo = carimbos.sort().slice(-1)[0];
        const dias = ultimo
          ? Math.floor((Date.now() - new Date(ultimo).getTime()) / 86_400_000)
          : null;
        return (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#cfe0ed] bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-[11px] leading-4 text-[#48626f] dark:text-zinc-400">
              {dias == null
                ? `${doCliente.length} documento(s) dependem do cliente — ainda não pedidos.`
                : dias === 0
                  ? `Pedido hoje. Aguarde antes de cobrar de novo.`
                  : `Pedido há ${dias} dia(s)${dias >= 3 ? ' — já cabe cobrar.' : '.'}`}
            </span>
            <button type="button" onClick={pedirAoCliente} disabled={pedindo || !conversa?.conversationId}
              title={conversa?.conversationId ? 'Monta a lista e envia ao cliente no WhatsApp' : 'Sem conversa vinculada a este cliente'}
              className={`ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40 ${
                dias != null && dias >= 3 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#228BE6] hover:bg-[#1c7ed6]'}`}>
              {pedindo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              {pedindo ? 'Enviando…' : dias == null ? 'Pedir ao cliente' : 'Cobrar de novo'}
            </button>
          </div>
        );
      })()}

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

/**
 * Edição inline de uma pendência. Os dados a copiar entram como "rótulo: valor",
 * um por linha — é o formato que se digita sem pensar, e evita um formulário de
 * pares que ninguém quer preencher no meio do atendimento.
 */
/**
 * Edição de uma pendência — totalmente controlada pelo painel.
 *
 * A versão anterior guardava o texto em useState aqui dentro e perdia tudo se o
 * componente remontasse: a tela mostrava os campos preenchidos e o Salvar gravava
 * o item vazio, sem erro nenhum. Agora não há estado local: o que se digita vai
 * direto para o rascunho do pai.
 *
 * Os dados a copiar entram como "rótulo: valor", um por linha, que é como se
 * digita sem pensar.
 */
function Editor({
  valor, onChange, onSalvar,
}: {
  /** Nullable de propósito: quem renderiza já guarda, mas o editor não confia. */
  valor: Pendencia | null;
  onChange: (p: Pendencia) => void;
  onSalvar: () => void;
}) {
  const campo = 'w-full rounded-md border border-[#cfe0ed] bg-transparent px-2 py-1 text-[12px] text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-200';
  if (!valor) return null;
  const dadosTexto = (valor.dados ?? []).map((d) => `${d.rotulo}: ${d.valor}`).join('\n');
  const setDados = (txt: string) => onChange({
    ...valor,
    dados: txt.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const i = l.indexOf(':');
      return i > 0 ? { rotulo: l.slice(0, i).trim(), valor: l.slice(i + 1).trim() } : { rotulo: 'dado', valor: l };
    }),
  });
  return (
    <div className="mt-2 space-y-1.5 border-t border-dashed border-[#cfe0ed] pt-2 dark:border-zinc-700">
      <input value={valor.titulo} onChange={(e) => onChange({ ...valor, titulo: e.target.value })}
        placeholder="Título" className={campo} autoFocus />
      <input value={valor.motivo ?? ''} onChange={(e) => onChange({ ...valor, motivo: e.target.value })}
        placeholder="Por que travou (captcha, senha, 2FA…)" className={campo} />
      <input value={valor.url ?? ''} onChange={(e) => onChange({ ...valor, url: e.target.value })}
        placeholder="https://portal…" className={campo} />
      <textarea value={dadosTexto} onChange={(e) => setDados(e.target.value)} rows={2}
        placeholder={'Dados a copiar, um por linha:\nCPF: 000.000.000-00'} className={campo} />
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={onSalvar}
          className="rounded-md bg-[#228BE6] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1c7ed6]">Salvar</button>
      </div>
    </div>
  );
}
