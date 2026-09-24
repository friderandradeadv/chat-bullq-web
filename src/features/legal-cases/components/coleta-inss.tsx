'use client';

import { useEffect, useState } from 'react';
import { Copy, Eye, EyeOff, ExternalLink, KeyRound, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { legalCasesService, type CaseDetail } from '@/features/legal-cases/services/legal-cases.service';

/**
 * Atalho de coleta no Meu INSS.
 *
 * O login é a única parte que não se automatiza: senha não se digita por robô, e
 * o gov.br pode pedir segundo fator. Então este bloco existe para encurtar
 * exatamente esse trecho — abre o portal e deixa login e senha a um clique de
 * distância, em vez de obrigar a caçar a credencial na ficha ou na conversa.
 *
 * O resto (percorrer os extratos, baixar, separar por benefício e arquivar no
 * Drive) é trabalho de máquina e acontece depois que a sessão está de pé.
 */
const PORTAIS = [
  { nome: 'Meu INSS', url: 'https://meu.inss.gov.br' },
  { nome: 'Portal MIR (IR)', url: 'https://mir.receita.fazenda.gov.br/portalmir/pagina-inicial' },
  { nome: 'Restituição', url: 'https://www.restituicao.receita.fazenda.gov.br/' },
];

export function ColetaInss({ parties, caseId, coleta, nb }: {
  parties: CaseDetail['parties'];
  caseId?: string;
  /** `metadata.coletaInss` — o estado do último pedido. */
  coleta?: { status?: string; pedidoEm?: string; terminadaEm?: string; erro?: string; arquivos?: string[] } | null;
  nb?: string | null;
}) {
  // 🚨 TODO HOOK ANTES DE QUALQUER `return` — ver a nota em kanban-bulk.tsx: um
  // useRef declarado depois de um return condicional derrubou a PÁGINA inteira.
  const [verSenha, setVerSenha] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  // 🚨 ENQUANTO ESTÁ NA FILA, O CARD SE ATUALIZA SOZINHO. Sem isto o advogado
  // pedia a coleta e tinha de fechar e reabrir o card para saber se terminou —
  // e, pior, para descobrir que o vigia estava esperando o login dele. De 20 em
  // 20 segundos, e SÓ enquanto pendente: parado, não consulta nada.
  const qc = useQueryClient();
  const naFila = coleta?.status === 'pendente';
  useEffect(() => {
    if (!naFila || !caseId) return;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
    }, 20000);
    return () => clearInterval(t);
  }, [naFila, caseId, qc]);
  const cliente = parties?.find((p: CaseDetail['parties'][number]) => p.role === 'CLIENT');
  const cad = ((cliente?.contact?.metadata as any)?.cadastro ?? {}) as { login?: string; senha?: string };
  const login = cad.login?.trim();
  const senha = cad.senha?.trim();

  // Sem cliente vinculado não há o que abrir — e sem credencial o bloco vira só
  // os atalhos dos portais, que continuam úteis.
  if (!cliente) return null;

  const pedirColeta = async () => {
    if (!caseId) return;
    setPedindo(true);
    try {
      await legalCasesService.pedirColetaInss(caseId, nb ?? undefined);
      toast.success('Pedido enviado. Se precisar de login, a janela do Meu INSS abre em alguns segundos.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui pedir a coleta.');
    } finally { setPedindo(false); }
  };

  const copiar = (valor: string, rotulo: string) => {
    navigator.clipboard.writeText(valor);
    toast.success(`${rotulo} copiado`);
  };

  return (
    <div className="mt-5 rounded-lg border border-[#cfe0ed] bg-[#f7fafc] p-2.5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <div className="flex items-center gap-1.5">
        <KeyRound className="h-3.5 w-3.5 shrink-0 text-[#48626f] dark:text-zinc-400" />
        <p className="flex-1 text-sm font-medium text-[#101820] dark:text-zinc-200">Coleta no Meu INSS</p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {PORTAIS.map((p) => (
          <a key={p.url} href={p.url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-[#228BE6] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#1c7ed6]">
            <ExternalLink className="h-3 w-3" /> {p.nome}
          </a>
        ))}
      </div>

      {(login || senha) ? (
        <div className="mt-2 space-y-1">
          {login && (
            <div className="flex items-center gap-1.5">
              <span className="w-12 shrink-0 text-[10px] uppercase text-[#48626f] dark:text-zinc-400">Login</span>
              <button type="button" onClick={() => copiar(login, 'Login')} title="Copiar login"
                className="inline-flex min-w-0 flex-1 items-center gap-1 rounded border border-[#cfe0ed] bg-white px-1.5 py-0.5 text-left text-[11px] font-mono text-[#101820] hover:border-[#4a90e2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                <span className="truncate">{login}</span>
                <Copy className="ml-auto h-3 w-3 shrink-0 opacity-60" />
              </button>
            </div>
          )}
          {senha && (
            <div className="flex items-center gap-1.5">
              <span className="w-12 shrink-0 text-[10px] uppercase text-[#48626f] dark:text-zinc-400">Senha</span>
              <button type="button" onClick={() => copiar(senha, 'Senha')} title="Copiar senha"
                className="inline-flex min-w-0 flex-1 items-center gap-1 rounded border border-[#cfe0ed] bg-white px-1.5 py-0.5 text-left text-[11px] font-mono text-[#101820] hover:border-[#4a90e2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                <span className="truncate">{verSenha ? senha : '•'.repeat(Math.min(senha.length, 12))}</span>
                <Copy className="ml-auto h-3 w-3 shrink-0 opacity-60" />
              </button>
              <button type="button" onClick={() => setVerSenha((v) => !v)} title={verSenha ? 'Esconder' : 'Mostrar'}
                className="shrink-0 text-zinc-400 hover:text-[#1b6ec2]">
                {verSenha ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[11px] leading-4 text-[#48626f] dark:text-zinc-400">
          Sem login do gov.br no cadastro deste cliente. Peça na conversa e salve na ficha — sem ele, a coleta não começa.
        </p>
      )}

      <p className="mt-2 text-[11px] leading-4 text-[#48626f] dark:text-zinc-400">

        Abra o portal e entre com as credenciais — o login e o segundo fator são seus, o

        gov.br exige. Feita a sessão, peça a coleta: o HISCON e o HISCRE são baixados e

        arquivados no Drive sem você.

      </p>

      {caseId && (

        <button

          type="button"

          onClick={pedirColeta}

          disabled={pedindo}

          title="Enfileira a coleta. Quem executa é este Mac, na janela do Meu INSS que você autenticou."

          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"

        >

          {pedindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}

          {pedindo ? 'Pedindo…' : 'Coletar agora (HISCON + HISCRE)'}

        </button>

      )}

      {coleta?.status && (

        <p className={`mt-1.5 text-[11px] leading-4 ${coleta.status === 'feita' ? 'text-emerald-700 dark:text-emerald-400' : coleta.status === 'falhou' ? 'text-rose-600 dark:text-rose-400' : 'text-[#48626f] dark:text-zinc-400'}`}>

          {coleta.status === 'pendente' && (coleta.erro
                ? `⏳ ${coleta.erro}`
                : 'Na fila — o Mac pega em segundos.')}

          {coleta.status === 'feita' && `Coletado: ${(coleta.arquivos ?? []).join(', ') || 'arquivos no Drive'}.`}

          {coleta.status === 'falhou' && `Não coletei: ${coleta.erro ?? 'erro desconhecido'}`}

        </p>

      )}
    </div>
  );
}
