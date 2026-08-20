'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Stamp, Upload, FileText, ArrowUp, ArrowDown, X, Loader2, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import {
  driveBrowserService,
  type FaseNoDrive,
} from '@/features/legal-cases/services/drive-browser.service';

/**
 * Arquivar peça protocolada — a porta do pós-protocolo, com duas entradas.
 *
 * Da FICHA do cliente (`partyId`): o advogado escolhe a fase.
 * Da AGENDA (`atividade`): a tarefa/prazo já sabe de que processo é, logo de que
 * cliente é e — pela ação do DJEN — que fase o ato costuma ocupar. Ele confirma.
 *
 * O que sai é sempre a convenção do escritório, não uma escolha de tela:
 *
 *     05. MANIFESTAÇÕES INTERMEDIÁRIAS/c) 20.08.2026/
 *         01. MANIFESTACAO.pdf     <- PDFs na ORDEM DO PROTOCOLO, numerados
 *         02. SENTENCA.pdf
 *         MANIFESTACAO.docx        <- o editável, sem número
 *
 * É a mesma regra do `arquivar_peca.py`, que arquiva pela Mesa. As duas portas
 * têm de escrever igual, senão a padronização do acervo se desfaz pelo uso.
 */

/**
 * A Mesa (Desktop do Mac), quando o navegador deixa.
 *
 * Página web não apaga arquivo do computador — é o navegador que não deixa, e
 * com razão. A File System Access API abre a única fresta: o advogado autoriza
 * UMA pasta, explicitamente, e a partir daí a página pode ler e apagar DENTRO
 * dela. Só existe em Chromium (Opera GX, Chrome); no Safari e no celular o
 * botão some e o fluxo continua sendo anexar do jeito normal.
 *
 * A remoção é sempre DEPOIS e só do que o servidor confirmou ter arquivado —
 * `removeEntry` não tem lixeira, então o arquivo só sai da Mesa quando já está
 * no Drive, pelo nome que o Drive devolveu.
 */
type ArquivoDaMesa = { nome: string; file: File; mtime: number };

const suportaMesa = () =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/** Data de hoje no formato do escritório. */
export function hojeDDMMAAAA() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export interface ResultadoArquivamento {
  pasta: string;
  caminho: string[];
  webViewLink: string;
  arquivos: string[];
}

export function ArquivarPecaModal({
  partyId,
  atividade,
  titulo = 'Arquivar peça protocolada',
  rotuloConfirmar = 'Arquivar',
  onFechar,
  onPronto,
}: {
  partyId?: string;
  atividade?: { entityType: 'task' | 'deadline'; entityId: string };
  titulo?: string;
  rotuloConfirmar?: string;
  onFechar: () => void;
  onPronto: (r: ResultadoArquivamento, partyId: string) => void;
}) {
  const [faseSel, setFaseSel] = useState<string>('');
  const [tocou, setTocou] = useState(false); // o advogado já mexeu no select?
  const [data, setData] = useState(hojeDDMMAAAA());
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Mesa: a pasta autorizada e os nomes que vieram de lá (só esses podem sair).
  const [mesa, setMesa] = useState<any>(null);
  const [daMesa, setDaMesa] = useState<Set<string>>(new Set());
  const [listaMesa, setListaMesa] = useState<ArquivoDaMesa[] | null>(null);
  const [tirarDaMesa, setTirarDaMesa] = useState(true);

  // Da agenda: o servidor resolve cliente + fases + sugestão numa chamada só.
  const ctx = useQuery({
    queryKey: ['drive-por-atividade', atividade?.entityType, atividade?.entityId],
    queryFn: () => driveBrowserService.porAtividade(atividade!.entityType, atividade!.entityId),
    enabled: !!atividade,
    staleTime: 30_000,
  });

  // Da ficha: só as fases daquele cliente.
  const fasesQ = useQuery({
    queryKey: ['drive-fases', partyId],
    queryFn: () => driveBrowserService.fases(partyId!),
    enabled: !!partyId && !atividade,
    staleTime: 60_000,
  });

  const alvoPartyId = atividade ? ctx.data?.partyId : partyId;
  const fases: FaseNoDrive[] = (atividade ? ctx.data?.fases : fasesQ.data) ?? [];
  const carregando = atividade ? ctx.isLoading : fasesQ.isLoading;
  const erro = (atividade ? ctx.error : fasesQ.error) as any;

  // A sugestão preenche o select, mas não decide: só vale enquanto o advogado
  // não mexeu, e só quando UMA fase casa com o ato (cliente com RMC e RCC tem
  // duas manifestações, e quem sabe de qual réu é o protocolo é ele).
  const sugerida =
    ctx.data?.sugeridas?.length === 1 ? ctx.data.sugeridas[0].join('/') : '';
  const escolhida = tocou || !sugerida ? faseSel : sugerida;
  const fase = fases.find((f) => f.caminho.join('/') === escolhida);
  const dataOk = /^\d{2}\.\d{2}\.\d{4}$/.test(data);

  // Só para mostrar onde vai cair: quem decide a letra é o servidor, lendo a
  // fase no Drive na hora de gravar.
  const { data: destino } = useQuery({
    queryKey: ['drive-destino', alvoPartyId, escolhida, data],
    queryFn: () => driveBrowserService.destino(alvoPartyId!, fase!.caminho, data),
    enabled: !!alvoPartyId && !!fase && dataOk,
    staleTime: 0,
    gcTime: 0,
  });

  /** Autoriza a Mesa e lista o que há de arquivável lá, do mais novo para o mais velho. */
  const abrirMesa = async () => {
    try {
      const dir = await (window as any).showDirectoryPicker({
        id: 'mesa-frider',
        mode: 'readwrite',
        startIn: 'desktop',
      });
      // `mode: 'readwrite'` no picker não garante a permissão: é preciso pedir.
      const perm = await dir.requestPermission?.({ mode: 'readwrite' });
      if (perm && perm !== 'granted') {
        toast.error('Sem permissão de escrita na pasta — dá para anexar, mas não para tirar de lá.');
      }
      const itens: ArquivoDaMesa[] = [];
      for await (const [nome, h] of dir.entries()) {
        if (h.kind !== 'file' || nome.startsWith('.')) continue;
        if (!/\.(pdf|docx?|jpe?g|png)$/i.test(nome)) continue;
        const file = await h.getFile();
        itens.push({ nome, file, mtime: file.lastModified });
      }
      // A peça que você acabou de protocolar é a mais recente — ela vem em cima.
      itens.sort((a, b) => b.mtime - a.mtime);
      setMesa(dir);
      setListaMesa(itens.slice(0, 40));
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error(e?.message || 'Não consegui abrir a pasta.');
    }
  };

  const pegarDaMesa = (it: ArquivoDaMesa) => {
    if (arquivos.some((a) => a.name === it.nome)) return;
    setArquivos((a) => [...a, it.file]);
    setDaMesa((s2) => new Set(s2).add(it.nome));
  };

  // Espelha a regra do servidor: PDF entra numerado na ordem, editável sem
  // número. O servidor é quem manda — isto é a prévia.
  const nomeFinal = (f: File) => {
    if (!/\.pdf$/i.test(f.name)) return f.name;
    if (/^\d{2}\.\s/.test(f.name)) return f.name;
    const pdfs = arquivos.filter((x) => /\.pdf$/i.test(x.name));
    return `${String(pdfs.indexOf(f) + 1).padStart(2, '0')}. ${f.name}`;
  };

  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= arquivos.length) return;
    const copia = [...arquivos];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setArquivos(copia);
  };

  const salvar = async () => {
    if (!alvoPartyId || !fase) return toast.error('Escolha a fase.');
    if (!dataOk) return toast.error('A data do protocolo é DD.MM.AAAA.');
    if (!arquivos.length) return toast.error('Anexe ao menos a peça.');
    setSalvando(true);
    try {
      const r = await driveBrowserService.arquivar(alvoPartyId, fase.caminho, arquivos, data);
      toast.success(`Peça arquivada em ${r.pasta} (${r.arquivos.length} arquivo(s)).`);

      // Só agora, e só o que o Drive confirmou pelo nome que ele mesmo devolveu.
      // `removeEntry` não tem lixeira: um arquivo que não subiu não pode sair da
      // Mesa por engano.
      if (mesa && tirarDaMesa && daMesa.size) {
        const confirmados = new Set(r.arquivos);
        const saiu: string[] = [];
        for (const f of arquivos) {
          if (!daMesa.has(f.name)) continue;
          if (!confirmados.has(nomeFinal(f))) continue;
          try {
            await mesa.removeEntry(f.name);
            saiu.push(f.name);
          } catch {
            /* arquivo aberto, renomeado ou permissão revogada — fica na Mesa */
          }
        }
        if (saiu.length) toast.success(`${saiu.length} arquivo(s) saíram da Mesa.`);
        else toast.warning('Arquivei, mas não consegui tirar da Mesa — apague por lá.');
      }

      onPronto(r, alvoPartyId);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Não consegui arquivar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <Stamp className="h-4 w-4 text-[#228BE6]" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{titulo}</h3>
          <button
            type="button"
            onClick={onFechar}
            className="ml-auto rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {ctx.data && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">{ctx.data.cliente}</span>
              {ctx.data.processo ? ` · ${ctx.data.processo}` : ''}
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Fase
            </label>
            {carregando ? (
              <p className="text-sm text-zinc-400">Lendo as fases no Drive…</p>
            ) : erro ? (
              <p className="text-sm text-rose-500">
                {erro?.response?.data?.message || (erro as Error)?.message}
              </p>
            ) : !fases.length ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Este cliente não tem pasta de fase no Drive. Crie a fase (ou rode a padronização)
                antes de arquivar.
              </p>
            ) : (
              <>
                <select
                  value={escolhida}
                  onChange={(e) => {
                    setTocou(true);
                    setFaseSel(e.target.value);
                  }}
                  className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <option value="">Escolha a fase…</option>
                  {fases.map((f) => (
                    <option key={f.caminho.join('/')} value={f.caminho.join('/')}>
                      {f.caminho.join('  ›  ')}
                    </option>
                  ))}
                </select>
                {!tocou && sugerida && (
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Sugerida pelo ato{ctx.data?.acao ? ` (${ctx.data.acao})` : ''} — confira antes de
                    arquivar.
                  </p>
                )}
                {!!ctx.data && ctx.data.sugeridas.length > 1 && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    Este cliente tem {ctx.data.sugeridas.length} pastas dessa fase (produtos
                    diferentes). Escolha a do réu certo.
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Data do protocolo
            </label>
            <input
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder="DD.MM.AAAA"
              className={`w-40 rounded-md border bg-white px-2 py-1.5 text-sm tabular-nums outline-none dark:bg-zinc-900 ${
                dataOk
                  ? 'border-zinc-200 text-zinc-700 focus:border-[#228BE6] dark:border-zinc-700 dark:text-zinc-200'
                  : 'border-rose-300 text-rose-600 dark:border-rose-500/50'
              }`}
            />
          </div>

          {destino && (
            <div className="rounded-lg border border-[#228BE6]/30 bg-[#228BE6]/5 px-3 py-2 text-xs dark:border-[#228BE6]/40 dark:bg-[#228BE6]/10">
              <p className="text-zinc-500 dark:text-zinc-400">Vai cair em</p>
              <p className="mt-0.5 font-medium text-[#228BE6]">{destino.destino.join('  ›  ')}</p>
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Arquivos — os PDFs na ordem do protocolo
              </label>
              <div className="flex items-center gap-3">
                {suportaMesa() && (
                  <button
                    type="button"
                    onClick={abrirMesa}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"
                  >
                    <Monitor className="h-3 w-3" /> {mesa ? 'trocar pasta' : 'pegar da Mesa'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  className="text-xs font-medium text-[#228BE6] hover:underline"
                >
                  anexar
                </button>
              </div>
            </div>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                setArquivos((a) => [...a, ...Array.from(e.target.files ?? [])]);
                if (input.current) input.current.value = '';
              }}
            />
            {listaMesa && (
              <div className="mb-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <p className="border-b border-zinc-100 px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  Na Mesa — mais recentes primeiro
                </p>
                {!listaMesa.length ? (
                  <p className="px-2.5 py-3 text-xs text-zinc-400">Nada arquivável nessa pasta.</p>
                ) : (
                  <ul className="max-h-40 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
                    {listaMesa.map((it) => {
                      const posto = arquivos.some((a) => a.name === it.nome);
                      return (
                        <li key={it.nome}>
                          <button
                            type="button"
                            onClick={() => pegarDaMesa(it)}
                            disabled={posto}
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-zinc-50 disabled:opacity-40 dark:hover:bg-zinc-800/50"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                            <span className="min-w-0 flex-1 truncate text-xs text-zinc-600 dark:text-zinc-300">
                              {it.nome}
                            </span>
                            <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
                              {new Date(it.mtime).toLocaleDateString('pt-BR')}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {!arquivos.length ? (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-xs text-zinc-400 hover:border-[#228BE6] hover:text-[#228BE6] dark:border-zinc-700"
              >
                <Upload className="h-4 w-4" /> A peça (.docx) e os PDFs do protocolo
              </button>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {arquivos.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-2.5 py-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <span className="min-w-0 flex-1 truncate text-xs text-zinc-700 dark:text-zinc-300">
                      {nomeFinal(f)}
                    </span>
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                      className="rounded p-0.5 text-zinc-300 hover:text-[#228BE6] disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={i === arquivos.length - 1}
                      className="rounded p-0.5 text-zinc-300 hover:text-[#228BE6] disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setArquivos((a) => a.filter((_, j) => j !== i))}
                      className="rounded p-0.5 text-zinc-300 hover:text-rose-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-[11px] text-zinc-400">
              PDF entra numerado na ordem acima; o editável entra sem número. Nada é sobrescrito.
            </p>
            {!!daMesa.size && (
              <label className="mt-2 flex items-start gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={tirarDaMesa}
                  onChange={(e) => setTirarDaMesa(e.target.checked)}
                  className="mt-0.5 accent-[#228BE6]"
                />
                <span>
                  Tirar da Mesa depois de arquivar ({daMesa.size} arquivo(s)).{' '}
                  <span className="text-amber-600 dark:text-amber-400">
                    Sai de vez, sem passar pela Lixeira
                  </span>{' '}
                  — e só sai o que o Drive confirmar.
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !fase || !arquivos.length || !dataOk}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#228BE6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1c7ed6] disabled:opacity-40"
          >
            {salvando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Stamp className="h-3.5 w-3.5" />
            )}
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
