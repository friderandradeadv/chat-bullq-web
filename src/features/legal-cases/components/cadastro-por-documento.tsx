'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  FileSearch,
  Loader2,
  AlertTriangle,
  Paperclip,
  ShieldCheck,
  ScanLine,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { DropZone } from '@/components/drop-zone';
import {
  legalCasesService,
  type CadastroDocLeitura,
  type FichaCadastroDoc,
  type ParteCadastroDoc,
} from '@/features/legal-cases/services/legal-cases.service';

const INPUT =
  'h-9 w-full rounded-lg border border-[#cfe0ed] bg-white px-2.5 text-sm text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

const ACEITA = 'application/pdf,.pdf,image/*,.png,.jpg,.jpeg,.webp';
const MAX_ARQUIVOS = 6;

const TIPO_LABEL: Record<string, string> = {
  inicial: 'Petição inicial',
  comprovante_protocolo: 'Comprovante de protocolo',
  print_tribunal: 'Tela do tribunal',
  decisao: 'Decisão',
  outro: 'Documento',
};

const lerBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^;]+;base64,/, ''));
    r.onerror = () => reject(new Error(`Não consegui ler "${file.name}"`));
    r.readAsDataURL(file);
  });

/**
 * Cadastro de processo por LEITURA DE DOCUMENTO: arrasta a inicial, o
 * comprovante de protocolo e/ou o print da tela do tribunal; a IA lê, o DataJud
 * confirma o que é dado oficial, e o advogado CONFERE antes de gravar.
 *
 * A conferência não é cerimônia: a leitura vem de pixel, e processo errado no
 * hub só sócio apaga. Cada campo mostra de onde veio o valor.
 */
export function CadastroPorDocumento({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [leitura, setLeitura] = useState<CadastroDocLeitura | null>(null);
  const [ficha, setFicha] = useState<FichaCadastroDoc | null>(null);
  const [vincularCliente, setVincularCliente] = useState(true);
  const [apensar, setApensar] = useState(true);
  const [completarExistente, setCompletarExistente] = useState(true);

  const addFiles = (novos: File[]) =>
    setFiles((atual) => [...atual, ...novos].slice(0, MAX_ARQUIVOS));

  const ler = async () => {
    if (!files.length) return;
    setLendo(true);
    try {
      const arquivos = await Promise.all(
        files.map(async (f) => ({
          nome: f.name,
          mime: f.type || 'application/pdf',
          base64: await lerBase64(f),
        })),
      );
      const res = await legalCasesService.lerCadastroDoc(arquivos);
      setLeitura(res);
      setFicha(res.ficha);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Não consegui ler os documentos');
    } finally {
      setLendo(false);
    }
  };

  const gravar = async () => {
    if (!ficha || !leitura) return;
    if (!ficha.title?.trim()) {
      toast.error('O processo precisa de um título.');
      return;
    }
    const usarExistente = !!leitura.existente && completarExistente;
    setSalvando(true);
    try {
      const r = await legalCasesService.confirmarCadastroDoc({
        ficha,
        contactId: vincularCliente ? leitura.clienteSugerido?.contactId ?? null : null,
        caseIdExistente: usarExistente ? leitura.existente!.id : null,
        apensarAoCaseId: apensar ? leitura.apensoSugerido?.id ?? null : null,
        arquivos: files.map((f) => f.name),
      });
      toast.success(
        r.criado
          ? 'Processo cadastrado'
          : r.completou.length
            ? `Cadastro completado (${r.completou.join(', ')})`
            : 'Nada a completar — a ficha já estava preenchida',
      );
      onDone();
      router.push(`/processos/${r.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao gravar');
      setSalvando(false);
    }
  };

  const set = <K extends keyof FichaCadastroDoc>(campo: K, valor: FichaCadastroDoc[K]) =>
    setFicha((f) => (f ? { ...f, [campo]: valor } : f));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-[660px] max-w-[95vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[#101820] dark:text-zinc-100">
              <ScanLine className="h-4 w-4 text-[#228BE6]" /> Cadastrar por documento
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              A inicial, o comprovante de protocolo ou o print da tela do tribunal. Pode mandar os três de uma vez.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!leitura ? (
            <>
              <DropZone onFiles={addFiles} accept={ACEITA} overlayLabel="Solte os documentos aqui">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-10 text-center hover:border-[#228BE6] dark:border-zinc-700">
                  <FileSearch className="h-7 w-7 text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Arraste os documentos ou clique para escolher
                  </span>
                  <span className="text-xs text-zinc-500">
                    PDF ou imagem (print serve). Até {MAX_ARQUIVOS} arquivos, 15 MB cada.
                  </span>
                  <input
                    type="file"
                    multiple
                    accept={ACEITA}
                    className="hidden"
                    onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
                  />
                </label>
              </DropZone>

              {files.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 text-xs text-zinc-400">
                          {(f.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </span>
                      <button
                        onClick={() => setFiles((a) => a.filter((_, j) => j !== i))}
                        className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-800"
                        title="Tirar da lista"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            ficha && (
              <div className="space-y-4">
                {leitura.avisos.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5" /> Confira antes de gravar
                    </p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-amber-800 dark:text-amber-200">
                      {leitura.avisos.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}

                {leitura.existente && (
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#228BE6]/40 bg-[#228BE6]/5 p-3">
                    <input
                      type="checkbox"
                      checked={completarExistente}
                      onChange={(e) => setCompletarExistente(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">
                      Esse número <strong>já está no hub</strong> como “{leitura.existente.title}”.
                      Completar o cadastro dele em vez de criar outro processo (recomendado — marcar
                      desmarcado cria um segundo card com o mesmo número).
                    </span>
                  </label>
                )}

                {leitura.apensoSugerido && (
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <input type="checkbox" checked={apensar} onChange={(e) => setApensar(e.target.checked)} className="mt-0.5" />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">
                      O documento diz que corre apenso a{' '}
                      <strong>{leitura.apensoSugerido.cnjNumber || leitura.apensoSugerido.title}</strong> — apensar.
                    </span>
                  </label>
                )}

                {leitura.clienteSugerido && (
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <input
                      type="checkbox"
                      checked={vincularCliente}
                      onChange={(e) => setVincularCliente(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">
                      Vincular ao cliente <strong>{leitura.clienteSugerido.name}</strong> que já está na base
                      {leitura.clienteSugerido.por === 'cpf' ? ' (casou pelo CPF)' : ' (casou pelo nome — confira)'}.
                    </span>
                  </label>
                )}

                <Campo label="Título" origem={null}>
                  <input className={INPUT} value={ficha.title ?? ''} onChange={(e) => set('title', e.target.value)} />
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Número CNJ" origem={leitura.origem.cnjNumber}>
                    <input className={INPUT} value={ficha.cnjNumber ?? ''} onChange={(e) => set('cnjNumber', e.target.value)} />
                  </Campo>
                  <Campo label="Ação / classe" origem={leitura.origem.area}>
                    <input className={INPUT} value={ficha.area ?? ''} onChange={(e) => set('area', e.target.value)} />
                  </Campo>
                  <Campo label="Juízo / vara" origem={leitura.origem.court}>
                    <input className={INPUT} value={ficha.court ?? ''} onChange={(e) => set('court', e.target.value)} />
                  </Campo>
                  <Campo label="Comarca / foro" origem={leitura.origem.jurisdiction}>
                    <input className={INPUT} value={ficha.jurisdiction ?? ''} onChange={(e) => set('jurisdiction', e.target.value)} />
                  </Campo>
                  <Campo label="Valor da causa" origem={leitura.origem.value}>
                    <input
                      className={INPUT}
                      inputMode="decimal"
                      value={ficha.value ?? ''}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value.replace(',', '.'));
                        set('value', Number.isFinite(n) ? n : null);
                      }}
                    />
                  </Campo>
                  <Campo label="Distribuído em" origem={leitura.origem.distributedAt}>
                    <input
                      type="date"
                      className={INPUT}
                      value={ficha.distributedAt ?? ''}
                      onChange={(e) => set('distributedAt', e.target.value || null)}
                    />
                  </Campo>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Partes</p>
                  {ficha.partes.length === 0 && (
                    <p className="text-xs text-zinc-400">
                      Nenhuma parte identificada no documento — cadastre na ficha depois.
                    </p>
                  )}
                  <ul className="space-y-2">
                    {ficha.partes.map((p, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <select
                          value={p.papel}
                          onChange={(e) => {
                            const partes = [...ficha.partes];
                            partes[i] = { ...p, papel: e.target.value as ParteCadastroDoc['papel'] };
                            set('partes', partes);
                          }}
                          className="h-9 shrink-0 rounded-lg border border-[#cfe0ed] bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="AUTOR">Cliente</option>
                          <option value="REU">Parte contrária</option>
                          <option value="OUTRO">Terceiro</option>
                        </select>
                        <input
                          className={INPUT}
                          value={p.nome}
                          onChange={(e) => {
                            const partes = [...ficha.partes];
                            partes[i] = { ...p, nome: e.target.value };
                            set('partes', partes);
                          }}
                        />
                        <input
                          className={`${INPUT} w-44 shrink-0`}
                          placeholder="CPF/CNPJ"
                          value={p.documento ?? ''}
                          onChange={(e) => {
                            const partes = [...ficha.partes];
                            partes[i] = { ...p, documento: e.target.value || null };
                            set('partes', partes);
                          }}
                        />
                        <button
                          onClick={() => set('partes', ficha.partes.filter((_, j) => j !== i))}
                          className="shrink-0 rounded p-1 text-zinc-400 hover:text-rose-500"
                          title="Tirar esta parte"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <details className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    O que a IA leu em cada arquivo ({leitura.lidos.length})
                  </summary>
                  <ul className="mt-2 space-y-1.5 text-xs text-zinc-500">
                    {leitura.lidos.map((d, i) => (
                      <li key={i}>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{d.arquivo}</span>{' '}
                        — {TIPO_LABEL[d.tipoDoc] ?? d.tipoDoc}
                        {d.cnj ? ` · ${d.cnj}` : ''}
                        {d.partes.length ? ` · ${d.partes.length} parte(s)` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            )
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <span className="text-xs text-zinc-400">
            {leitura ? 'Nada foi gravado ainda.' : `${files.length}/${MAX_ARQUIVOS} arquivo(s)`}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm font-medium text-zinc-500">
              Cancelar
            </button>
            {!leitura ? (
              <button
                onClick={ler}
                disabled={!files.length || lendo}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#228BE6] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c7ed6] disabled:opacity-50"
              >
                {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                {lendo ? 'Lendo…' : 'Ler documentos'}
              </button>
            ) : (
              <button
                onClick={gravar}
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#228BE6] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c7ed6] disabled:opacity-50"
              >
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                {leitura.existente && completarExistente ? 'Completar cadastro' : 'Cadastrar processo'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Campo com etiqueta de procedência: dado oficial do CNJ × leitura do papel. */
function Campo({
  label,
  origem,
  children,
}: {
  label: string;
  origem: 'datajud' | 'documento' | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        {label}
        {origem === 'datajud' && (
          <span
            title="Veio do DataJud (CNJ) — dado oficial do tribunal"
            className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
          >
            <ShieldCheck className="h-3 w-3" /> oficial
          </span>
        )}
        {origem === 'documento' && (
          <span
            title="A IA leu do documento que você mandou — confira"
            className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
          >
            lido do documento
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
