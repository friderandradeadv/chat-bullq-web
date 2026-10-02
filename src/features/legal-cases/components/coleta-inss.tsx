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
  coleta?: { status?: string; pedidoEm?: string; terminadaEm?: string; erro?: string; arquivos?: string[]; pasta?: string | null; etapa?: string | null; etapaEm?: string; precisaLoginMir?: boolean; pedidoMir?: boolean; naPasta?: string[]; alcance?: string; avisoAlcance?: string | null; mirConferido?: boolean } | null;
  nb?: string | null;
}) {
  // 🚨 TODO HOOK ANTES DE QUALQUER `return` — ver a nota em kanban-bulk.tsx: um
  // useRef declarado depois de um return condicional derrubou a PÁGINA inteira.
  const [verSenha, setVerSenha] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  const [pedindoMir, setPedindoMir] = useState(false);
  // 🚨 ENQUANTO ESTÁ NA FILA, O CARD SE ATUALIZA SOZINHO. Sem isto o advogado
  // pedia a coleta e tinha de fechar e reabrir o card para saber se terminou —
  // e, pior, para descobrir que o vigia estava esperando o login dele. De 20 em
  // 20 segundos, e SÓ enquanto pendente: parado, não consulta nada.
  const qc = useQueryClient();
  // 🚨 O PEDIDO SÓ-DO-MIR TAMBÉM É "na fila". Ele não mexe no `status` (a coleta
  // já terminou), então sem isto o card ficava imóvel justamente enquanto espera
  // o advogado entrar no gov.br — que é quando ele mais precisa ver movimento.
  const naFila = coleta?.status === 'pendente' || coleta?.pedidoMir === true;
  useEffect(() => {
    if (!naFila || !caseId) return;
    // 🚨 8 SEGUNDOS ENQUANTO COLETA. Com 20s os passos apareciam pela metade: a
    // coleta inteira leva ~2min30 e cada documento fica pronto a cada ~40s.
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
    }, 8000);
    return () => clearInterval(t);
  }, [naFila, caseId, qc]);
  const cliente = parties?.find((p: CaseDetail['parties'][number]) => p.role === 'CLIENT');
  const cad = ((cliente?.contact?.metadata as any)?.cadastro ?? {}) as
    { login?: string; senha?: string; nascimento?: string };
  const login = cad.login?.trim();
  const senha = cad.senha?.trim();
  // 🚨 A DATA DE NASCIMENTO ENTRA AQUI PORQUE A RESTITUIÇÃO PEDE OS DOIS
  // (02/10/2026). Quando o Portal MIR recusa por nível de conta (prata/ouro), a
  // prova sai da Consulta Restituição — e ela pergunta CPF **e** nascimento. O
  // portal é Flutter e **bloqueia preenchimento automatizado** ("seu acesso foi
  // bloqueado por possuir atributos que o caracteriza como um acesso
  // automatizado"), então quem digita é ele, em qualquer navegador. Deixar os
  // dois a um clique de distância é o que resta de automação honesta ali.
  // 🚨 E O BOTÃO COPIA SÓ OS NÚMEROS (02/10/2026). O campo "Data de Nascimento"
  // da Restituição tem máscara: colar "02/07/1948" com as barras derruba o
  // formatador do Flutter e sobra **"0"** (medido, 1/10 no contador da própria
  // tela). Digitado cru, "02071948" vira "02/07/1948" sozinho. Na tela a data
  // continua legível com barra; o que vai para a área de transferência é o que o
  // portal aceita.
  const nascimento = cad.nascimento?.trim();

  // Sem cliente vinculado não há o que abrir — e sem credencial o bloco vira só
  // os atalhos dos portais, que continuam úteis.
  if (!cliente) return null;

  const pedirPrintMir = async () => {
    if (!caseId) return;
    setPedindoMir(true);
    try {
      await legalCasesService.pedirPrintMir(caseId);
      await qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
      toast.success('Abrindo o Portal MIR. Entre com o gov.br na janela do Chrome — eu printo e arquivo sozinho.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui abrir o Portal MIR.');
    } finally { setPedindoMir(false); }
  };

  const pedirColeta = async () => {
    if (!caseId) return;
    setPedindo(true);
    try {
      await legalCasesService.pedirColetaInss(caseId, nb ?? undefined);
      // 🚨 RECARREGAR O CARD AQUI, SEMPRE. Sem isto ele continuava com o estado
      // ANTERIOR — e o advogado via, em vermelho, o erro de uma coleta de ontem
      // enquanto a nova rodava. Pior: o laço de 20s só liga quando o status é
      // "pendente", e o estado velho dizia "falhou", então o card congelava até
      // ser fechado e reaberto (25/09/2026).
      await qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });
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

      {(login || senha || nascimento) ? (
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
          {nascimento && (
            <div className="flex items-center gap-1.5">
              <span className="w-12 shrink-0 text-[10px] uppercase text-[#48626f] dark:text-zinc-400">Nasc.</span>
              <button type="button" onClick={() => copiar(nascimento.replace(/\D/g, ''), 'Data de nascimento (só os números)')}
                title="Copia só os números (02071948) — o campo da Restituição monta a barra sozinho; colar com barra quebra a máscara"
                className="inline-flex min-w-0 flex-1 items-center gap-1 rounded border border-[#cfe0ed] bg-white px-1.5 py-0.5 text-left text-[11px] font-mono text-[#101820] hover:border-[#4a90e2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                <span className="truncate">{nascimento}</span>
                <Copy className="ml-auto h-3 w-3 shrink-0 opacity-60" />
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

        gov.br exige. Feita a sessão, peça a coleta: HISCON, HISCRE, informe de IR e o print do Portal MIR são baixados e

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

          {/* 🚨 O RÓTULO NOMEIA OS QUATRO. Ele dizia "HISCON + HISCRE" e a coleta
              traz também o IR e o print do Portal MIR — quem lê o botão não sabe
              o que vai receber, e o que falta depois parece defeito em vez de
              coisa que nunca foi prometida. Apontado pelo advogado em
              29/09/2026: "e o coletar agora é HISCON + HISCRE + MIR". */}
          {pedindo ? 'Pedindo…' : 'Coletar agora (HISCON, HISCRE, IR e MIR)'}

        </button>

      )}

      {/* 🚨 AVISO COM AÇÃO, NÃO SÓ COM PROBLEMA. O Portal MIR é o único dos quatro
          documentos que pode faltar por um ato do ADVOGADO: ele pede a
          autorização gov.br dele, e nenhuma automação entra por ele. Antes o card
          dizia "O print do Portal MIR não saiu" e a saída era repetir a coleta
          INTEIRA. Pedido do escritório em 29/09/2026: "quero um botão para
          resolver isso". */}
      {caseId && coleta?.precisaLoginMir && !coleta?.pedidoMir && (
        <button
          type="button"
          onClick={pedirPrintMir}
          disabled={pedindoMir}
          title="Abro o Portal MIR na janela do Chrome e espero você entrar no gov.br. Assim que entrar, tiro o print e arquivo."
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pedindoMir ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
          {pedindoMir ? 'Abrindo…' : 'Entrar no MIR e tirar o print'}
        </button>
      )}

      {coleta?.status && (
        <>
          <p className={`mt-1.5 text-[11px] leading-4 ${coleta.status === 'feita' ? 'text-emerald-700 dark:text-emerald-400' : coleta.status === 'falhou' ? 'text-rose-600 dark:text-rose-400' : 'text-[#48626f] dark:text-zinc-400'}`}>

            {/* 🚨 O PASSO VEM ANTES DO AVISO. Estando em andamento, o recado
                anterior ("entre com o login") é história: mostrá-lo esconde a
                narração e faz o hub parecer parado (25/09/2026). */}
            {coleta.status === 'pendente' && (!coleta.etapa && coleta.erro
                  ? `⏳ ${coleta.erro}`
                  : coleta.etapa
                    // 🚨 O PASSO EM QUE ESTÁ, NÃO "na fila". Entre o clique e o
                    // "Coletado" passam uns 2min30, e um card imóvel não
                    // distingue trabalhando de travado (25/09/2026).
                    ? <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                        {coleta.etapa}
                      </span>
                    : 'Na fila — o Mac pega em segundos.')}

            {/* 🚨 A PERGUNTA É SOBRE A PASTA, NÃO SOBRE A RODADA. "Coletado:
                PORTAL MIR.png" é verdade e não serve: depois de um pedido só do
                print, some da tela que HISCON, HISCRE e IR já estavam lá, e o
                advogado não sabe se pode clicar em "Documentos OK — montar
                inicial". Pedido dele em 29/09/2026: "deve avisar que está tudo
                na pasta para eu clicar em documentos ok". */}
            {coleta.status === 'feita' && (coleta.naPasta?.length
              ? `Nesta rodada: ${(coleta.arquivos ?? []).join(', ') || 'arquivos no Drive'}.`
              : (coleta.pasta
                  ? `Coletado em ${coleta.pasta}: ${(coleta.arquivos ?? []).join(', ') || 'arquivos no Drive'}.`
                  : `Coletado: ${(coleta.arquivos ?? []).join(', ') || 'arquivos no Drive'}.`))}

            {coleta.status === 'falhou' && `Não coletei: ${coleta.erro ?? 'erro desconhecido'}`}

          </p>

          {/* 🚨 COLETA PODE DAR CERTO COM RESSALVA, e a ressalva NÃO SE ENGOLE.
              Quando o print do Portal MIR não sai, os três documentos do INSS
              vêm assim mesmo e o status é "feita" — mas falta uma peça do JG.
              Sem esta linha o aviso sumia e a gratuidade ia incompleta ao
              protocolo sem ninguém perceber (25/09/2026). */}
          {/* Os quatro documentos do INSS que instruem o JG. Verde só quando os
              QUATRO estão lá — três de quatro é gratuidade incompleta, e é
              justamente o caso em que "quase pronto" engana. */}
          {/* 🚨 O VERDE NÃO É SOBRE CONTAGEM. Quatro arquivos na pasta com um
              HISCRE que não alcança a contratação é pior que faltar arquivo:
              parece pronto. A inicial sairia "em aberto" e o dobro se perderia
              (ANTÔNIA BRAGA VILELA, 29/09/2026 — contrato 06/2017, HISCRE desde
              01/2021). Verde só com os quatro E com o alcance conferido. */}
          {coleta.avisoAlcance && (
            <p className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] leading-4 font-medium text-rose-800 dark:bg-rose-900/25 dark:text-rose-300">
              ⚠ {coleta.avisoAlcance}
            </p>
          )}

          {coleta.naPasta?.length ? (
            coleta.naPasta.length >= 4 && coleta.alcance === 'ok' ? (
              <>
                <p className="mt-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] leading-4 font-medium text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300">
                  ✓ Os 4 documentos do INSS estão na pasta{coleta.pasta ? ` (${coleta.pasta})` : ''} — pode clicar em “Documentos OK”.
                </p>
                {/* 🚨 O PRINT PODE SER LEGÍTIMO E NÃO PROVAR NADA. Em 29/09/2026
                    um aviso do Portal cobriu IRPF 2026, 2025, 2024 e 2023 e o PNG
                    foi arquivado com nome e tamanho normais. Quando a captura não
                    passou pela conferência de cobertura, o card diz que não sabe
                    — em vez de deixar o verde responder por ela. */}
                {coleta.mirConferido === false && (
                  <p className="mt-1 text-[11px] leading-4 text-amber-700 dark:text-amber-400">
                    O print do MIR não passou pela conferência de cobertura — abra e confira se algum aviso do Portal tapa os anos do IRPF.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-[11px] leading-4 text-amber-700 dark:text-amber-400">
                Na pasta: {coleta.naPasta.join(', ')}
                {coleta.naPasta.length < 4
                  ? ` — faltam ${['HISCON.pdf', 'HISCRE.pdf', 'IR.pdf', 'PORTAL MIR.png']
                      .filter((d) => !coleta.naPasta?.includes(d))
                      .join(', ')}.`
                  : ' — os 4 estão aqui, mas o alcance do HISCRE não foi confirmado (veja acima).'}
              </p>
            )
          ) : null}

          {coleta.status === 'feita' && coleta.erro && (
            <p className="mt-1 text-[11px] leading-4 text-amber-700 dark:text-amber-400">
              ⚠ {coleta.erro}
            </p>
          )}
        </>
      )}
    </div>
  );
}
