'use client';

import { useRef, useState } from 'react';
import { Loader2, Sparkles, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '../services/legal-cases.service';

/**
 * O GERADOR POR IA que o hub já tinha, e que nenhuma tela chamava.
 *
 * 🚨 ELE JÁ EXISTIA. O `@Post(':id/peca/gerar')` redige a peça sobre o
 * timbrado e anexa nos Anexos do card desde antes — e só a tela do
 * superendividamento o usava, por outro tipo. Réplica, especificação de
 * provas e apelação tinham o motor e não tinham o botão.
 *
 * 🚨 E O DTO ACEITA TRÊS, não cinco. O `PECA_LABEL` do hub lista cinco
 * rótulos, mas o `@IsIn` do DTO só deixa passar `replica`, `especificacao` e
 * `recurso`. Superendividamento tem tela própria; parecer não tem rota. Expor
 * cinco botões, dois deles com 400 garantido, seria pior que expor três.
 *
 * 🚨 O DOCUMENTO-BASE NÃO É OPCIONAL NA PRÁTICA. Cada tipo lê um documento
 * diferente, e sem ele a IA redige no vazio: é a mesma lição das peças que
 * afirmaram o que a defesa não disse.
 */
const TIPO_DA_ACAO: Record<string, 'replica' | 'especificacao' | 'recurso'> = {
  replica: 'replica',
  provas: 'especificacao',
  apelacao: 'recurso',
};

/** o que o hub espera que você suba, por tipo (PECA_DOC_ESPERADO) */
const DOC_ESPERADO: Record<string, string> = {
  replica: 'a contestação do banco',
  especificacao: 'a réplica já protocolada',
  recurso: 'a sentença',
};

export function tipoDaAcao(acao?: string | null) {
  return acao ? TIPO_DA_ACAO[acao] ?? null : null;
}

export function GerarPecaIA({ caseId, acao, instrucao }: {
  caseId: string; acao: string; instrucao?: string;
}) {
  const tipo = TIPO_DA_ACAO[acao];
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [gerando, setGerando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  if (!tipo) return null;

  const gerar = async () => {
    if (!arquivo) { toast.error(`suba ${DOC_ESPERADO[tipo]} primeiro`); return; }
    setGerando(true);
    try {
      const b64 = await new Promise<string>((ok, nok) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result).split(',')[1] ?? '');
        fr.onerror = () => nok(new Error('não li o arquivo'));
        fr.readAsDataURL(arquivo);
      });
      const r = await legalCasesService.gerarPeca(caseId, {
        tipo, docBase64: b64, docNome: arquivo.name,
        ...(instrucao ? { instrucoes: instrucao } : {}),
      } as any);
      setFeito(r?.fileName ?? 'peça gerada');
      toast.success('Peça gerada e anexada nos Anexos do card.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'não consegui gerar a peça');
    } finally { setGerando(false); }
  };

  return (
    <div className="mt-2.5 rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
        <Sparkles className="h-3.5 w-3.5" /> Gerar a peça por IA, sobre o timbrado
      </p>
      <p className="mt-1 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
        Suba {DOC_ESPERADO[tipo]}. A IA lê o documento e os dados do card, redige a peça
        inteira no timbrado e anexa nos Anexos. Campos sem dado viram lacuna para você
        conferir antes do protocolo.
        {acao === 'replica' && (
          <> {' '}Para réplica, o caminho da casa é o <b>Dossiê</b> acima, que monta pela
          biblioteca de modelos; este aqui é a saída quando a biblioteca não serve.</>
        )}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef} type="file" className="hidden"
          accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
        >
          <Paperclip className="h-3 w-3" />
          {arquivo ? arquivo.name.slice(0, 34) : `Subir ${DOC_ESPERADO[tipo]}`}
        </button>
        <button
          onClick={gerar}
          disabled={gerando || !arquivo}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {gerando && <Loader2 className="h-3 w-3 animate-spin" />}
          {gerando ? 'redigindo… (1 a 2 min)' : 'Gerar peça'}
        </button>
      </div>

      {feito && (
        <p className="mt-2 rounded-md bg-emerald-50 p-2 text-[11px] leading-4 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Pronta e anexada: <b>{feito}</b>. Abra os Anexos deste card. 🚨 Leia antes de
          protocolar: as lacunas ficam marcadas no documento.
        </p>
      )}
    </div>
  );
}
