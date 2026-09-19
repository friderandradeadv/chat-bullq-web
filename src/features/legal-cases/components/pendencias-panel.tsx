'use client';

import { useState } from 'react';
import { DropZone } from '@/components/drop-zone';
import { Check, Copy, ExternalLink, Paperclip, Pencil, Plus, Trash2, Upload, User, Building2 } from 'lucide-react';
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
  caseId, lista, onChanged, onIrParaAnexos, onAnexado,
}: {
  caseId: string;
  lista: Pendencia[];
  onChanged: (nova: Pendencia[]) => void;
  onIrParaAnexos?: () => void;
  /** Avisa o card para recarregar a lista de anexos depois do upload. */
  onAnexado?: () => void;
}) {
  const [novo, setNovo] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [subindo, setSubindo] = useState<string | null>(null);

  const persistir = async (nova: Pendencia[]) => {
    onChanged(nova);
    setSalvando(true);
    // Guardado em metadata.faseData._pendencias.lista: vale para o caso inteiro,
    // não para uma fase — por isso a chave não é o nome de nenhuma fase.
    try { await legalCasesService.saveFaseField(caseId, '_pendencias', 'lista', nova); }
    catch { toast.error('Não consegui salvar a pendência'); }
    finally { setSalvando(false); }
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
                  <button type="button" onClick={() => setEditando(editando === p.id ? null : p.id)} title="Editar pendência"
                    className="text-zinc-300 hover:text-[#1b6ec2] dark:text-zinc-600">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => remover(p.id)} title="Remover pendência"
                    className="text-zinc-300 hover:text-red-500 dark:text-zinc-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {editando === p.id && <Editor p={p} onSalvar={(np) => { setEditando(null); persistir(lista.map((x) => (x.id === np.id ? np : x))); }} />}
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

/**
 * Edição inline de uma pendência. Os dados a copiar entram como "rótulo: valor",
 * um por linha — é o formato que se digita sem pensar, e evita um formulário de
 * pares que ninguém quer preencher no meio do atendimento.
 */
function Editor({ p, onSalvar }: { p: Pendencia; onSalvar: (p: Pendencia) => void }) {
  const [titulo, setTitulo] = useState(p.titulo);
  const [motivo, setMotivo] = useState(p.motivo ?? '');
  const [url, setUrl] = useState(p.url ?? '');
  const [dados, setDados] = useState((p.dados ?? []).map((d) => `${d.rotulo}: ${d.valor}`).join('\n'));
  const campo = 'w-full rounded-md border border-[#cfe0ed] bg-transparent px-2 py-1 text-[12px] text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-200';
  return (
    <div className="mt-2 space-y-1.5 border-t border-dashed border-[#cfe0ed] pt-2 dark:border-zinc-700">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" className={campo} />
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por que travou (captcha, senha, 2FA…)" className={campo} />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://portal…" className={campo} />
      <textarea value={dados} onChange={(e) => setDados(e.target.value)} rows={2}
        placeholder={'Dados a copiar, um por linha:\nCPF: 000.000.000-00'} className={campo} />
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={() => onSalvar({
          ...p,
          titulo: titulo.trim() || p.titulo,
          motivo: motivo.trim() || undefined,
          url: url.trim() || undefined,
          dados: dados.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
            const i = l.indexOf(':');
            return i > 0 ? { rotulo: l.slice(0, i).trim(), valor: l.slice(i + 1).trim() } : { rotulo: 'dado', valor: l };
          }),
        })} className="rounded-md bg-[#228BE6] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1c7ed6]">Salvar</button>
      </div>
    </div>
  );
}
