'use client';

/**
 * A CAMPANHA DA CARTEIRA QUE PERDEU A RMC (28/10/2026).
 *
 * Pedido do escritório: oferecer a ação de refin aos clientes da base cuja RMC
 * foi improcedente ou extinta sem mérito. A tese é fato distinto: não se
 * discute a contratação do cartão, discute-se o saldo que o banco refinanciou
 * sozinho.
 *
 * A lista vem da carteira (`resultadoReal` do card) e cada cliente cai numa
 * caixa depois que o hub lê o HISCON da pasta: oferta pronta, HISCON antigo
 * (que não alcança 11/2023), sem HISCON, sem refin.
 *
 * Desde 29/10/2026 a mesma leitura mede também o CHURNING do cliente, e quem
 * tem as duas teses recebe uma mensagem só com as duas. O churning só entra com
 * o veredito AJUIZAR do HISCON, e não entra quando já saiu ao cliente por outro
 * card (o cruzamento com o quadro do Churning é feito no servidor).
 *
 * O formato é o do quadro do Churning, a pedido: *"uma visualização parecida,
 * pelo menos"*. Quadro para trabalhar um caso, lista para percorrer cem.
 *
 * 🚨 O ENVIO É CLIQUE, UM CLIENTE POR VEZ, na conversa que já existe. O botão
 * "analisar" lê documentos; nenhum botão deste quadro fala com mais de um
 * cliente. A inicial contra a Meta afirma ao juízo que os scripts de envio em
 * lote saíram de operação. E não se arrasta card: passar de coluna aqui é falar
 * com o cliente.
 *
 * 🚨🚨 09/11/2026: ENTROU O "DISPARAR N", E A REGRA ACIMA FICA DE PROPÓSITO.
 *
 * Ordem do escritório, na véspera do primeiro disparo: *"faz o botão, propõe o
 * ritmo e o teto"*, depois de medido que são 107 ofertas, cada uma em 6 ou 7
 * bolhas — cerca de 650 saídas de um número só, se tudo for clicado no mesmo
 * dia, e de um número cujo canal irmão (4212) já foi banido pela Meta.
 *
 * 🚨🚨 A FRASE DO 1º PARÁGRAFO — "a inicial contra a Meta afirma ao juízo que
 * os scripts de envio em lote saíram de operação" — FOI CONFERIDA NAS PEÇAS
 * E ESTÁ ERRADA (09/11/2026). Fica escrita lá de propósito, para quem vier
 * depois não reescrevê-la de memória.
 *
 * Procurado "lote", "script", "automação", "massa" e "disparo" nos 36.008
 * caracteres da inicial (`INICIAL - META - OBRIGACAO DE FAZER.docx`) e nos
 * 24.504 da réplica de 03/11/2026: **a inicial não afirma nada sobre scripts
 * de envio em lote**. A afirmação simplesmente não existe nos autos.
 *
 * O que EXISTE é uma linha da tabela da réplica, que rebate as hipóteses da
 * Meta uma a uma:
 *
 *   Hipótese da Ré        | "Envio de mensagens em massa não autorizadas"
 *   Resposta da Autora    | "Conversas iniciadas pelo cliente em 86,3% e
 *                         |  89,6% dos casos; 45 iniciadas pela Autora ao todo"
 *
 * E a réplica lista, entre os fatos que a Meta NÃO impugnou e que por isso se
 * tornaram incontroversos (art. 341 do CPC), "a predominância de conversas
 * iniciadas pelos próprios clientes".
 *
 * 🚨 ESSES NÚMEROS SÃO DAS CONTAS DA API OFICIAL, não deste canal. Saem do
 * painel da própria Meta: portfólio 417858283638509, conta 1745617789779330,
 * número (44) 99157-4212, `quality_rating` GREEN. São duas porcentagens
 * porque são dois portfólios.
 *
 * 🚨 A CAMPANHA NÃO CORRE POR LÁ. Medido no banco em 09/11/2026:
 *
 *   4212 (aposentado — Meta)  554491574212  appId + accessToken Cloud API  INATIVO
 *   ESCRITÓRIO                554491645394  Evolution                      INATIVO
 *   RMC/RCC                   554491747315  Evolution, instância COMERCIAL  ATIVO
 *
 * O disparo sai pelo **7315**, que não é conta da plataforma da Meta: sem
 * portfólio, sem `appId`, sem `accessToken`. Não gera registro no painel dela,
 * e os "registros de envio" que a Autora pediu ao juízo (arts. 396 a 400 do
 * CPC) são os registros DA RÉ, das contas DELA.
 *
 * ⚠️ O RISCO REAL NÃO É PROCESSUAL: é perder o 7315. Ele roda em Evolution,
 * não oficial, que é o perfil que a Meta derruba — e este escritório já perdeu
 * seis contas. O 7315 é o número que a base de clientes tem salvo. É para isso
 * que existem o teto de 60 e a pausa sorteada, não para a ação.
 *
 * O que mudou: um clique dele passa a valer por N envios, no ritmo do servidor
 * e com o teto do dia do próprio escritório. O que NÃO mudou: cada rodada
 * começa num clique dele, na sessão dele; nada fala com quem não é cliente da
 * casa; e o texto é o que já estava gravado no card.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check, ExternalLink, LayoutGrid, List, Loader2, RefreshCw, ScanSearch, Search, Send, Square, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { inboxService } from '@/features/inbox/services/inbox.service';
import { CaseDetailDrawer } from '@/features/legal-cases/components/case-detail-drawer';
import { VincularContatoCliente } from '@/features/legal-cases/components/vincular-contato-cliente';
import { LinhaDoTempoDaOferta } from './linha-do-tempo-da-oferta';
import { PreviaEmBolhas } from './previa-em-bolhas';
import { ConversaAoVivo } from './conversa-ao-vivo';
import { phasesOfBoard } from '@/features/legal-cases/lib/phase-board';
import {
  dispararEmLote, type AndamentoDoDisparo,
} from '@/features/legal-cases/lib/disparar-em-lote';

const ACCENT = 'rgb(25,118,210)';

type Item = {
  caseId: string; cliente: string; card: string; reu: string | null; resultado: string;
  caixa: string | null; rotulo: string; status: string; resumo: string | null;
  estimativa: { dobro: number; danoMoral: number; total: number; ate: string | null } | null;
  /** O foro da inicial pelo pagador do benefício (29/10/2026); null antes de ler de novo o HISCON. */
  foro?: 'jef' | 'jec' | 'estadual' | null;
  pagador?: string | null;
  ultimaCompetencia: string | null; temConversa: boolean;
  analisadaEm: string | null; enviadaEm: string | null; cardRefin: string | null;
  /**
   * Os honorários FECHADOS deste cliente, lidos do card de refin.
   *
   * 🚨 ACEITAR A REVISÃO NÃO É ACEITAR OS HONORÁRIOS (03/11/2026). Ordem do
   * escritório: *"aceitar a revisão é uma coisa, aceitar os honorários é
   * outra, separe bem isso, deixe visível"*. `null` enquanto o preço não
   * fechou — e é essa a diferença entre as duas colunas.
   */
  honorarios: { opcao: 'entrada' | 'meio-a-meio' | null; fonte: string; em: string;
    entradaCobrada?: boolean; modelo?: string | null } | null;
  churning: { ofertado: boolean; grupo: string | null; contratos: number; veredito: string | null;
    statusNoChurning: string | null; motivo: string | null } | null;
  oferecivel: boolean;
  /** Card de ENSAIO: fica fora de qualquer varredura em massa. */
  ensaio?: boolean;
  /** O churning da mensagem saiu ao cliente por outro card depois da análise. */
  reanalisar?: boolean;
};

const aberta = (i: Item) => i.status === 'analisada' || i.status === 'nova';
/** Fechou o PREÇO — não a ação. A prova é o registro de honorários do card. */
const fechouHonorarios = (i: Item) => !!i.honorarios?.opcao;
/** Como o escritório chama cada opção, em uma palavra. */
const ROTULO_DA_OPCAO: Record<string, string> = {
  entrada: 'entrada + 30%',
  'meio-a-meio': 'meio a meio (50%)',
};
const semDocumento = (i: Item) => !i.caixa || i.caixa === 'hiscon-antigo' || i.caixa === 'sem-hiscon';

/**
 * As colunas, na ordem em que o trabalho anda.
 *
 * 🚨 A campanha começou pelo REFIN (02/11/2026) e voltou a ser REFIN +
 * CHURNING. A chave `CHURNING_NA_MENSAGEM_DO_REFIN` (API) está em `true`
 * desde o 3º ensaio, e estes textos ficaram para trás — foi o que o
 * escritório viu em 06/11: *"corrija o kanban, não está certo ainda, refin +
 * churning"*.
 *
 * ⚠️ E O TEXTO NÃO CONSERTA O DADO. Medido em 06/11: das 102 ofertas reais
 * analisadas, **zero** tinham churning ofertado, e 79 carregavam o motivo
 * *"a campanha começa pelo refin: o churning não entra nesta mensagem"* —
 * gravado quando a chave estava desligada. A mensagem é congelada na
 * análise; religar a chave só alcança análise nova. Quem reescreve é a
 * varredura de releitura, nos dois botões abaixo.
 */
const COLUNAS: { chave: string; titulo: string; ajuda: string; de: (i: Item) => boolean }[] = [
  { chave: 'pronta', titulo: 'OFERTA PRONTA', ajuda: 'refin do cartão e/ou churning dos empréstimos medidos no HISCON: leia a mensagem e envie',
    de: (i) => i.oferecivel && aberta(i) },
  { chave: 'enviada', titulo: 'ENVIADA', ajuda: 'a oferta foi ao cliente, aguardando resposta',
    de: (i) => i.status === 'enviada' },
  // 🚨 DUAS ACEITAÇÕES, DUAS COLUNAS (03/11/2026). O "Sim" do cliente aceita a
  // AÇÃO; o preço vem depois e pode ser recusado. Numa coluna só, quem disse
  // sim e sumiu ficava igual a quem assinou e pagou a entrada — e é exatamente
  // entre os dois que está o trabalho de vender.
  { chave: 'aceita', titulo: 'ACEITOU A REVISÃO', ajuda: 'topou a ação; os honorários ainda não fecharam',
    de: (i) => i.status === 'aceita' && !fechouHonorarios(i) },
  { chave: 'honorarios', titulo: 'FECHOU OS HONORÁRIOS', ajuda: 'aceitou o preço: contrato assinado ou entrada cobrada',
    de: (i) => fechouHonorarios(i) },
  { chave: 'recusada', titulo: 'RECUSADA', ajuda: 'o cliente disse não',
    de: (i) => i.status === 'recusada' && !fechouHonorarios(i) },
  { chave: 'documento', titulo: 'FALTA HISCON', ajuda: 'não analisado, sem HISCON na pasta ou extrato antes de 11/2023',
    de: (i) => !i.oferecivel && aberta(i) && semDocumento(i) },
  { chave: 'fora', titulo: 'FORA', ajuda: 'sem refin nem churning medidos, refin depois da IN 158 ou já tem card',
    de: (i) => !i.oferecivel && aberta(i) && !semDocumento(i) },
];

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;

export function RefinBoard() {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [oferta, setOferta] = useState<string | null>(null);
  const [vincular, setVincular] = useState<{ caseId: string; cliente: string } | null>(null);
  const [analisando, setAnalisando] = useState<{ feitos: number; total: number } | null>(null);
  const [disparando, setDisparando] = useState<AndamentoDoDisparo | null>(null);
  /**
   * 🚨 O TETO DO DIA DA CAMPANHA, EDITÁVEL AQUI (09/11/2026). Ordem do
   * escritório: *"deixa configurável e começa em 10"*. Fica ao lado do botão,
   * não numa tela de configuração: quem decide quantas conversas reabrir hoje
   * é quem está olhando a fila agora.
   */
  const [teto, setTeto] = useState<number | null>(null);
  /**
   * 🚨 O RÓTULO DO BOTÃO NÃO PODE MENTIR (09/11/2026). Ordem do escritório:
   * *"muda o rótulo pra Disparar 10 (de 62)"*. Para isso o quadro precisa da
   * SOBRA do dia, não do teto: teto 10 com 4 já enviados hoje são 6, e um botão
   * escrito "Disparar 10" prometeria dez.
   */
  const [regime, setRegime] = useState<{ tetoDaCampanha: number; sobra: number } | null>(null);
  const lerRegime = async () => {
    await legalCasesService.regimeDoDisparo()
      .then((r) => { setRegime(r); setTeto(r.tetoDaCampanha); })
      .catch(() => undefined);
  };
  useEffect(() => { void lerRegime(); }, []);
  /**
   * 🚨 O RÓTULO SEGUE O CAMPO ENQUANTO SE DIGITA (09/11/2026). Ordem do
   * escritório, com o campo em 9 e o botão ainda dizendo 10: *"o disparar tem
   * que ser de acordo com os selecionados ali"*.
   *
   * Grava com um respiro de meio segundo e RELÊ o regime, em vez de recalcular
   * a sobra aqui. A conta do teto (o menor entre o da campanha e o que sobra do
   * canal, descontado o que já saiu hoje) mora em `regime-do-disparo.ts`,
   * testada. Reproduzi-la no navegador para "ir mais rápido" é a mesma regra em
   * duas pontas — e a ponta que fala com o cliente é a que decide.
   */
  const respiroDoTeto = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvarTeto = async (n: number) => {
    if (respiroDoTeto.current) clearTimeout(respiroDoTeto.current);
    const limpo = Math.max(0, Math.min(500, Math.floor(n || 0)));
    setTeto(limpo);
    await legalCasesService.salvarTetoDaCampanha(limpo)
      .then(() => toast.success(`Teto da campanha: ${limpo} conversa(s) por dia`))
      .catch(() => toast.error('Não consegui gravar o teto.'));
    await lerRegime();
  };
  /** Enquanto digita: grava sem avisar, só para o rótulo acompanhar. */
  const tetoDigitado = (n: number | null) => {
    setTeto(n);
    if (respiroDoTeto.current) clearTimeout(respiroDoTeto.current);
    if (n === null || !Number.isFinite(n)) return;
    const limpo = Math.max(0, Math.min(500, Math.floor(n)));
    respiroDoTeto.current = setTimeout(() => {
      void legalCasesService.salvarTetoDaCampanha(limpo).then(lerRegime).catch(() => undefined);
    }, 500);
  };
  const parar = useRef(false);

  // Quadro × lista, lembrado no navegador como no quadro do Churning.
  const [modo, setModo] = useState<'quadro' | 'lista'>('quadro');
  useEffect(() => {
    try {
      const v = window.localStorage.getItem('refin-modo');
      if (v === 'lista' || v === 'quadro') setModo(v);
    } catch { /* sem storage: fica no quadro */ }
  }, []);
  const trocarModo = (v: 'quadro' | 'lista') => {
    setModo(v);
    try { window.localStorage.setItem('refin-modo', v); } catch { /* idem */ }
  };

  const { data: kanban } = useQuery({
    queryKey: ['legal-cases', 'kanban', 'judicial'],
    queryFn: () => legalCasesService.kanban({ lane: 'judicial' }),
    refetchOnWindowFocus: false,
  });
  const fases = kanban?.phases ?? [];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['refin', 'ofertas'],
    queryFn: () => legalCasesService.quadroDeOfertasRefin(),
    refetchOnWindowFocus: false,
  });

  const itens: Item[] = useMemo(() => {
    const todos = (data?.itens ?? []) as Item[];
    const q = busca.trim().toLowerCase();
    return q
      ? todos.filter((o) => `${o.cliente} ${o.reu ?? ''} ${o.card} ${o.churning?.grupo ?? ''}`.toLowerCase().includes(q))
      : todos;
  }, [data, busca]);

  const naoAnalisados = itens.filter((i) => !i.caixa);
  /**
   * 🚨 OS JÁ ANALISADOS TAMBÉM PRECISAM SER RELIDOS, ÀS VEZES (04/11/2026).
   *
   * No 3º ensaio o escritório religou o churning na mensagem do refin
   * (`CHURNING_NA_MENSAGEM_DO_REFIN`) e o quadro continuou todo "só refin":
   * *"agora vi, os refins estão todos só refin, sem churning....."*. A chave
   * não reescreve nada — quem escreve `ofertado` e o texto é
   * `analisarOfertaRefin`, card a card. E não havia como chamá-la em massa:
   * "Analisar N pendentes" só alcança quem nunca foi analisado (`!caixa`) e o
   * "Reler" é um refetch da tela.
   *
   * Medido no mesmo minuto: dos 106 cards da campanha, 28 ganhariam a 2ª tese
   * e 51 voltariam a ser oferta. Setenta e nove cards parados por falta de um
   * botão.
   */
  /**
   * 🚨 A VARREDURA VIROU DUAS, POR RISCO (04/11/2026).
   *
   * Medido antes de rodar, em modo seco: dos 103 analisados, **29 estão em
   * "oferta pronta"** — esses têm o que PERDER, porque quem perdeu o HISCON da
   * pasta cai para "sem hiscon" na releitura, e 13 já estão nesse estado. Os
   * outros só podem melhorar.
   *
   * Um botão só é tudo-ou-nada, e tudo-ou-nada em cima de 29 ofertas que já
   * valem dinheiro não é escolha que o quadro deva tomar pelo escritório.
   *
   * Card de ENSAIO fica fora dos dois: reler apaga a oferta semeada.
   */
  const semNadaAPerder = itens.filter((i) => !!i.caixa && aberta(i) && !i.ensaio && i.caixa !== 'pronta');
  const comOfertaPronta = itens.filter((i) => !!i.caixa && aberta(i) && !i.ensaio && i.caixa === 'pronta');
  const jaAnalisados = itens.filter((i) => !!i.caixa);
  const emOferta = oferta ? itens.find((i) => i.caseId === oferta) ?? null : null;

  /**
   * Lê o HISCON de cada um, UM DE CADA VEZ, e mostra o andamento. Só lê
   * documentos: não fala com cliente nenhum.
   */
  const analisarFila = async (alvos: Item[]) => {
    parar.current = false;
    const fila = [...alvos];
    setAnalisando({ feitos: 0, total: fila.length });
    const erros: string[] = [];
    for (let i = 0; i < fila.length; i++) {
      if (parar.current) break;
      await legalCasesService.analisarOfertaRefin(fila[i].caseId).catch((e: any) => {
        erros.push(`${fila[i].cliente.split(' ')[0]}: ${e?.response?.data?.message || 'não consegui ler o HISCON'}`);
      });
      setAnalisando({ feitos: i + 1, total: fila.length });
      if ((i + 1) % 5 === 0) refetch();
    }
    setAnalisando(null);
    refetch();
    // O motivo de cada um: "veja a pasta" não serve quando falta o réu no card.
    if (erros.length) toast.error(erros.join(' · '), { duration: 15000 });
  };

  /** Os que o botão "Disparar" alcança: oferta viva, com WhatsApp, fora do ensaio. */
  const disparaveis = itens.filter(
    (i) => i.oferecivel && aberta(i) && !i.reanalisar && i.temConversa && !i.ensaio,
  );
  /**
   * Quantos REALMENTE saem neste clique: a fila, cortada pela sobra do dia.
   * É esta a conta que o rótulo mostra — o teto sozinho prometeria demais
   * quando parte do dia já foi gasta.
   */
  const vaoSair = Math.max(0, Math.min(regime?.sobra ?? disparaveis.length, disparaveis.length));


  /**
   * 🚨 FALA COM N CLIENTES. Ver o cabeçalho deste arquivo: é o único botão do
   * quadro que faz isso, entrou por ordem expressa, e a confirmação abaixo diz
   * ao advogado tudo o que ele precisa aceitar antes — inclusive a afirmação
   * que a inicial contra a Meta faz ao juízo.
   */
  const dispararFila = async () => {
    const regime = await legalCasesService.regimeDoDisparo().catch(() => null);
    if (!regime) {
      toast.error('Não consegui medir o teto do dia no servidor. Sem isso eu não disparo.');
      return;
    }
    // 🚨 DO MAIS QUENTE PARA O MAIS FRIO (09/11/2026). Ordem do escritório:
    // *"faz, ordena por temperatura"*. Medido antes de pedir: 59% dos alvos
    // estão calados há mais de 90 dias ou nunca falaram NESTE número, e o
    // número é Evolution, não oficial, já em 2,9 saídas por entrada. O que
    // derruba número é bloqueio, e bloqueio vem de conversa dormente.
    //
    // Mandando o quente primeiro, as primeiras dezenas são as de menor risco e
    // maior chance de resposta — e a rodada termina com a taxa real de bloqueio
    // e de aceite MEDIDA, antes de encostar nos frios. Parou no meio? Queimou
    // os mais seguros, não os frágeis.
    const fila = await legalCasesService
      .filaPorTemperatura(disparaveis.map((i) => i.caseId))
      .catch(() => null);
    if (!fila) {
      toast.error('Não consegui medir a temperatura das conversas. Sem isso eu não ordeno o lote.');
      return;
    }
    const posicao = new Map(fila.ordem.map((id, i) => [id, i]));
    const emOrdem = [...disparaveis].sort(
      (a, b) => (posicao.get(a.caseId) ?? 1e9) - (posicao.get(b.caseId) ?? 1e9),
    );

    const cabem = Math.max(0, Math.min(regime.sobra, emOrdem.length));
    if (cabem === 0) {
      toast.error(
        `O teto da campanha já foi gasto hoje: ${regime.campanha} de ${regime.tetoDaCampanha} conversas. `
        + 'Amanhã o contador zera — ou mude o teto ali no quadro, se quiser mandar mais hoje.',
        { duration: 15000 },
      );
      return;
    }
    const seg = Math.round((regime.pausaMinMs + regime.pausaMaxMs) / 2000);
    const minutos = Math.max(1, Math.round((cabem * seg) / 60));
    const ok = window.confirm(
      `Disparar a oferta para ${cabem} cliente${cabem === 1 ? '' : 's'}, agora?\n\n`
      + `RITMO: um cliente a cada ${Math.round(regime.pausaMinMs / 1000)}–`
      + `${Math.round(regime.pausaMaxMs / 1000)} segundos, sorteado. Leva cerca de ${minutos} min.\n`
      + `TETO DA CAMPANHA: ${regime.tetoDaCampanha} conversas por dia (já foram ${regime.campanha} hoje). `
      + `${emOrdem.length - cabem > 0 ? `${emOrdem.length - cabem} ficam para os próximos dias.` : 'Cabem todos.'}\n`
      + 'É o p75 de conversas que este WhatsApp toca num dia normal. Muda no quadro.\n\n'
      + `TEMPERATURA: sai do mais quente para o mais frio. ${fila.faixas.quentes} falaram `
      + `com você nos últimos 30 dias, ${fila.faixas.mornos} entre 31 e 90, e `
      + `${fila.faixas.frios} estão calados há mais de 90 dias ou nunca falaram neste número.\n\n`
      + 'Manda o texto que JÁ está gravado em cada card. Dá para parar no meio, '
      + 'e retomar depois sem repetir ninguém.\n\n'
      // 🚨 MEDIDO EM PRODUÇÃO (09/11/2026): o lote de 10 saiu 3 porque a aba foi
      // para o fundo e o Chrome congelou o relógio dela. O laço agora para e
      // diz, mas quem evita a parada é esta linha, lida ANTES do clique.
      // 🚨 O TEXTO MUDOU EM 10/11/2026, junto com o relógio no Web Worker. O
      // aviso anterior mandava "deixe esta aba na frente até terminar", e era
      // verdade: três lotes do dia morreram no primeiro cliente porque o
      // advogado foi responder no celular. Agora a espera não depende mais da
      // aba, e o aviso não pode continuar pedindo uma vigília que não existe.
      + '⚠️ O DISPARO RODA NESTA ABA, mas não precisa dela na frente: o relógio '
      + 'da espera roda fora da thread da página. Pode trocar de aba e usar o '
      + 'computador. O que para o lote é FECHAR esta aba ou o navegador — e se '
      + 'ainda assim o relógio for estrangulado, ele para avisando, sem repetir '
      + 'quem já saiu.\n\n'
      + '⚠️ Envio em lote, pelo 7315 — Evolution, fora da plataforma da Meta e fora '
      + 'das contas da ação contra ela. O risco aqui não é processual: é perder o 7315, '
      + 'que é o número que seus clientes têm salvo.',
    );
    if (!ok) return;

    parar.current = false;
    setDisparando({ feitos: 0, total: cabem, pulados: 0, esperandoMs: null, cliente: null });
    const r = await dispararEmLote({
      // A fila INTEIRA, já ordenada: quem corta pelo teto é o laço, e é ele
      // que sabe dizer quantos ficaram para amanhã.
      alvos: emOrdem.map((i) => ({ caseId: i.caseId, cliente: i.cliente })),
      regime,
      conferir: (id) => legalCasesService.conferirOfertaRefin(id),
      lerTexto: (caso) => String(caso?.metadata?.ofertaRefin?.mensagem ?? ''),
      registrar: (id, mensagem) => legalCasesService.registrarOfertaRefin(id, { status: 'enviada', mensagem }),
      onAndamento: setDisparando,
      parar,
    });
    setDisparando(null);
    refetch();
    void lerRegime();
    // 🚨 PAROU SOZINHO É ERRO, NÃO SUCESSO. Antes isto dizia "parado por você"
    // em qualquer parada, e no lote de 09/11 o laço morreu calado com 7 ofertas
    // por sair. Quando há motivo, ele vem em vermelho, com o que falta e o que
    // fazer — e o verde fica só para a fila que terminou.
    if (r.motivoDaParada) {
      const faltaram = Math.max(0, cabem - r.enviados - r.pulados.length);
      toast.error(
        `O DISPARO PAROU: ${r.motivoDaParada}. `
        + `Saíram ${r.enviados}${faltaram ? `, faltaram ${faltaram}` : ''}. `
        + 'Deixe esta aba na frente e clique em Disparar de novo: '
        + 'quem já saiu não sai de novo.',
        { duration: 30000 },
      );
    } else {
      toast.success(
        `${r.enviados} oferta(s) enviada(s)${r.parado ? ' — parado por você' : ''}`
        + `${r.foraDoTeto ? `; ${r.foraDoTeto} ficaram para amanhã pelo teto` : ''}`,
        { duration: 12000 },
      );
    }
    if (r.pulados.length) {
      toast.error(
        `${r.pulados.length} pulado(s): `
        + r.pulados.slice(0, 6).map((p) => `${p.cliente.split(' ')[0]} (${p.motivo})`).join(' · ')
        + (r.pulados.length > 6 ? ` …e mais ${r.pulados.length - 6}` : ''),
        { duration: 20000 },
      );
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <h1 className="text-lg font-semibold text-[#101820] dark:text-zinc-100">Refin</h1>
        <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: ACCENT }}>
          {itens.length}
        </span>
        <p className="text-xs text-[#48626f] dark:text-zinc-400">
          RMC/RCC perdida ou extinta: refin do cartão e churning dos empréstimos como ações novas
        </p>
        {/*
          🚨🚨 A BARRA QUEBRA NO CELULAR (10/11/2026). Ordem do escritório,
          com print do iPhone: *"Pelo celular não aparece para clicar"*. Esta
          linha era `flex` sem `flex-wrap`, então no estreito ela virava uma
          fila só que transbordava para a direita: ficavam visíveis a busca, o
          "Analisar pendentes" e o "teto/dia", e o **Disparar** — o único botão
          que importa aqui — caía fora da tela, sem barra de rolagem à vista.
          O advogado tinha o lote parado na mão e nenhum jeito de retomar.
          `flex-wrap` + a busca encolhendo resolvem sem mexer em nada no largo.
        */}
        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente ou banco…"
              className="h-8 w-full min-w-[8rem] rounded-lg border border-[#cfe0ed] bg-white pl-7 pr-2 text-sm sm:w-56 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
          </div>
          {analisando ? (
            <button onClick={() => { parar.current = true; }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cfe0ed] px-2 text-xs font-semibold text-[#48626f] dark:border-zinc-700 dark:text-zinc-300">
              <Loader2 className="h-3 w-3 animate-spin" /> lendo {analisando.feitos}/{analisando.total}
              <Square className="ml-1 h-3 w-3" /> parar
            </button>
          ) : !disparando && naoAnalisados.length ? (
            <button onClick={() => analisarFila(naoAnalisados)} title="Lê o HISCON de cada cliente ainda não analisado, um de cada vez. Não envia nada."
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-white" style={{ background: ACCENT }}>
              <ScanSearch className="h-3.5 w-3.5" /> Analisar {naoAnalisados.length} pendente{naoAnalisados.length === 1 ? '' : 's'}
            </button>
          ) : null}
          {/*
            🚨 O ÚNICO BOTÃO DESTE QUADRO QUE FALA COM N CLIENTES (09/11/2026).
            Fica em vermelho e com o número na frente, de propósito: um clique
            aqui não é como os outros. A confirmação diz o ritmo, o teto e a
            afirmação da inicial contra a Meta.
          */}
          {!disparando && disparaveis.length ? (
            <label
              title="Quantas conversas a campanha pode reabrir por dia. O padrão, 10, é o p75 de conversas que este WhatsApp toca num dia normal — medido em 30 dias. Subir isto sem medir a taxa de bloqueio do lote anterior é apostar o número."
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cfe0ed] px-2 text-[11px] text-[#48626f] dark:border-zinc-700 dark:text-zinc-300"
            >
              teto/dia
              <input
                type="number" min={0} max={500}
                value={teto ?? ''}
                onChange={(e) => tetoDigitado(e.target.value === '' ? null : Number(e.target.value))}
                onBlur={(e) => salvarTeto(Number(e.target.value))}
                className="w-11 rounded border border-[#cfe0ed] bg-white px-1 py-0.5 text-center text-[11px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
          ) : null}
          {disparando ? (
            <button onClick={() => { parar.current = true; }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-300 px-2 text-xs font-semibold text-red-700 dark:border-red-800 dark:text-red-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              enviando {disparando.feitos}/{disparando.total}
              {disparando.esperandoMs
                ? ` · próxima em ${Math.ceil(disparando.esperandoMs / 1000)}s`
                : disparando.cliente ? ` · ${disparando.cliente.split(' ')[0]}` : ''}
              <Square className="ml-1 h-3 w-3" /> parar
            </button>
          ) : !analisando && disparaveis.length ? (
            <button
              onClick={dispararFila}
              disabled={vaoSair === 0}
              title={vaoSair === 0
                ? 'O teto do dia já foi gasto. Mude o teto ao lado, ou volte amanhã.'
                : 'Manda a oferta já gravada em cada card, um cliente de cada vez, no ritmo e no teto do dia. Dá para parar no meio.'}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-600 px-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {vaoSair === 0
                ? 'teto do dia gasto'
                : vaoSair < disparaveis.length
                  ? `Disparar ${vaoSair} (de ${disparaveis.length})`
                  : `Disparar ${vaoSair}`}
            </button>
          ) : null}
          {/*
            🚨 RELER OS JÁ ANALISADOS. Pede confirmação, e a frase diz as duas
            consequências que o advogado precisa aceitar antes: é lento (um
            HISCON por cliente, no Drive) e PODE TIRAR oferta do quadro, se o
            documento saiu da pasta. Sem a confirmação, um clique sem querer
            mexe em cem cards.
          */}
          {!analisando && !disparando && semNadaAPerder.length ? (
            <button
              onClick={() => {
                const ok = window.confirm(
                  `Reler o HISCON de ${semNadaAPerder.length} cliente(s) que HOJE não têm oferta?\n\n`
                  + 'São os que estão em "sem refin", "sem hiscon", "hiscon antigo" ou '
                  + '"posterior à IN 158". Eles só podem MELHORAR: não há oferta a perder.\n\n'
                  + 'Demora: um documento por cliente, um de cada vez (dá para parar no meio).\n'
                  + 'Não envia nada a cliente nenhum.',
                );
                if (ok) analisarFila(semNadaAPerder);
              }}
              title="Relê só quem não tem oferta hoje. Não há o que perder, e não envia nada."
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cfe0ed] px-2 text-xs font-semibold text-[#48626f] hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ScanSearch className="h-3.5 w-3.5" /> Reler {semNadaAPerder.length} sem oferta
            </button>
          ) : null}
          {!analisando && !disparando && comOfertaPronta.length ? (
            <button
              onClick={() => {
                const ok = window.confirm(
                  `⚠️ Reler ${comOfertaPronta.length} cliente(s) que JÁ ESTÃO EM OFERTA PRONTA?\n\n`
                  + 'Estes têm o que PERDER: quem tiver perdido o HISCON da pasta cai para '
                  + '"sem hiscon" e SAI da oferta.\n\n'
                  + 'Rode isto quando a regra da oferta mudar e você quiser a mudança '
                  + 'também nos que já estão prontos.\n\n'
                  + 'Não envia nada a cliente nenhum.',
                );
                if (ok) analisarFila(comOfertaPronta);
              }}
              title="Relê quem JÁ tem oferta pronta. Pode fazer card sair da oferta se o HISCON sumiu da pasta."
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-300 px-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
            >
              <ScanSearch className="h-3.5 w-3.5" /> Reler {comOfertaPronta.length} em oferta
            </button>
          ) : null}
          <div className="inline-flex overflow-hidden rounded-lg border border-[#cfe0ed] dark:border-zinc-700">
            {([['quadro', LayoutGrid, 'Quadro'], ['lista', List, 'Lista']] as const).map(([v, Icone, rotulo]) => (
              <button
                key={v}
                onClick={() => trocarModo(v)}
                title={rotulo}
                className={`inline-flex h-8 items-center gap-1 px-2 text-xs font-semibold ${
                  modo === v
                    ? 'bg-[#101820] text-white dark:bg-zinc-200 dark:text-zinc-900'
                    : 'bg-white text-[#48626f] hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300'}`}
              >
                <Icone className="h-3.5 w-3.5" /> {rotulo}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cfe0ed] px-2 text-xs text-[#48626f] hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Reler
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="p-4 text-sm text-[#48626f] dark:text-zinc-400">Lendo a carteira…</p>
      ) : modo === 'lista' ? (
        <ListaDeOfertas
          itens={itens}
          onAbrir={setOferta}
          onVincular={(caseId, cliente) => setVincular({ caseId, cliente })}
        />
      ) : (
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {COLUNAS.map((col) => {
            const lista = itens.filter(col.de);
            return (
              <div key={col.chave} className="flex w-[310px] shrink-0 flex-col">
                <div className="flex items-center gap-1.5 px-1 pb-2">
                  <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: ACCENT }}>{col.titulo}</h2>
                  <span className="text-xs font-semibold text-[#48626f] dark:text-zinc-400">{lista.length}</span>
                </div>
                <p className="px-1 pb-2 text-[10px] leading-3 text-[#48626f] dark:text-zinc-500">{col.ajuda}</p>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto pb-2">
                  {lista.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#cfe0ed] p-4 text-center text-xs text-[#48626f] dark:border-zinc-700 dark:text-zinc-500">
                      Vazio
                    </div>
                  ) : lista.map((o) => (
                    <CardDaOferta
                      key={o.caseId}
                      o={o}
                      onAbrir={() => setOferta(o.caseId)}
                      onVincular={() => setVincular({ caseId: o.caseId, cliente: o.cliente })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {emOferta && (
        <PainelDaOferta
          o={emOferta}
          onFechar={() => setOferta(null)}
          onAbrirCard={() => setAberto(emOferta.caseId)}
          onMudou={() => refetch()}
        />
      )}

      {vincular && (
        <VincularContatoCliente
          caseId={vincular.caseId}
          clienteNome={vincular.cliente}
          onClose={() => setVincular(null)}
          onVinculado={() => refetch()}
        />
      )}

      {aberto && (
        <CaseDetailDrawer
          caseId={aberto}
          phases={[...phasesOfBoard(fases, 'judicial'), ...phasesOfBoard(fases, 'pre')]}
          onClose={() => { setAberto(null); refetch(); }}
        />
      )}
    </div>
  );
}

const ROTULO_DO_FORO: Record<string, { curto: string; longo: string }> = {
  jef: { curto: 'JEF', longo: 'Juizado Especial Federal, contra o banco e o INSS (pagador do benefício é outro banco)' },
  jec: { curto: 'JEC', longo: 'Juizado Especial Cível estadual, só contra o banco (pagador do benefício é a própria Ré)' },
  estadual: { curto: 'VARA', longo: 'Vara cível estadual' },
};

/** Onde a inicial do refin vai sair. Some antes de o HISCON ser lido de novo. */
function Foro({ o }: { o: Item }) {
  const r = o.caixa === 'pronta' && o.foro ? ROTULO_DO_FORO[o.foro] : null;
  if (!r) return null;
  return (
    <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:border-zinc-600 dark:text-zinc-300"
      title={`${r.longo}${o.pagador ? `. Pago em: ${o.pagador}` : ''}`}>
      {r.curto}
    </span>
  );
}

/** As teses do cliente, em etiquetas: o que a mensagem vai oferecer. */
function Teses({ o }: { o: Item }) {
  return (
    <>
      {o.caixa === 'pronta' && (
        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: ACCENT }}>REFIN</span>
      )}
      {o.churning?.ofertado && (
        <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
          title={`${o.churning.contratos} contratos no ${o.churning.grupo}: veredito ${o.churning.veredito}`}>
          CHURNING · {o.churning.grupo}
        </span>
      )}
    </>
  );
}

/**
 * Extinta sem mérito não faz coisa julgada material; improcedente faz, e o
 * banco vai alegá-la (art. 508 do CPC). Por isso a cor: verde é o caso limpo.
 */
function Acao({ o }: { o: Item }) {
  return o.resultado === 'extinto'
    ? <span className="text-emerald-700 dark:text-emerald-400">ação extinta</span>
    : <span className="text-amber-700 dark:text-amber-400">ação perdida</span>;
}

function CardDaOferta({ o, onAbrir, onVincular }: { o: Item; onAbrir: () => void; onVincular: () => void }) {
  return (
    // NÃO é <button>: dentro há o botão de vincular o WhatsApp.
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}
      className="cursor-pointer rounded-lg border border-[#cfe0ed] bg-white p-3 text-left shadow-sm transition hover:shadow-md dark:border-transparent dark:bg-[#1E2226]"
    >
      <p className="line-clamp-2 text-sm font-semibold uppercase leading-5 text-[#101820] dark:text-zinc-100">{o.cliente}</p>
      <p className="mt-0.5 truncate text-xs text-[#48626f] dark:text-zinc-400">× {o.reu ?? 'sem réu'} · <Acao o={o} /></p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Teses o={o} />
        <Foro o={o} />
        {/* 🚨 O PREÇO FECHADO SE VÊ NO CARD (03/11/2026): sem isto, "aceitou"
            e "fechou honorários" voltam a parecer a mesma coisa de longe. */}
        {fechouHonorarios(o) && (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            title={`Honorários fechados: ${o.honorarios?.fonte ?? ''}`}>
            {ROTULO_DA_OPCAO[String(o.honorarios?.opcao)] ?? 'honorários fechados'}
          </span>
        )}
        {o.status === 'aceita' && !fechouHonorarios(o) && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            title="Topou a ação. Os honorários ainda não fecharam.">
            honorários em aberto
          </span>
        )}
        {o.caixa === 'pronta' && o.estimativa ? (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            title={`Refin: dobro dos descontos até ${o.estimativa.ate ?? '?'} + dano moral. Não soma o churning.`}>
            {reais(o.estimativa.total)}
          </span>
        ) : null}
      </div>
      {o.reanalisar && (
        <p className="mt-1.5 text-[10px] font-semibold text-red-700 dark:text-red-400">
          o churning já saiu por outro card: leia o HISCON de novo
        </p>
      )}
      {!o.oferecivel && (o.churning?.motivo || o.caixa) ? (
        <p className="mt-1.5 line-clamp-2 text-[10px] text-[#48626f] dark:text-zinc-500">
          {o.rotulo}{o.churning?.motivo ? ` · churning: ${o.churning.motivo}` : ''}
        </p>
      ) : null}
      <p className="mt-1.5 flex items-center gap-2 text-[10px] text-[#48626f] dark:text-zinc-500">
        {dia(o.enviadaEm) ? `enviada ${dia(o.enviadaEm)}` : dia(o.analisadaEm) ? `lida ${dia(o.analisadaEm)}` : 'não lida'}
        {!o.temConversa && (
          <button
            onClick={(e) => { e.stopPropagation(); onVincular(); }}
            className="inline-flex items-center gap-0.5 rounded px-1 font-semibold text-amber-700 underline decoration-dotted hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
          >
            <Users className="h-3 w-3" /> vincular WhatsApp
          </button>
        )}
      </p>
    </div>
  );
}

/** A mesma oferta em linha, para percorrer cem. */
function ListaDeOfertas({ itens, onAbrir, onVincular }: {
  itens: Item[]; onAbrir: (id: string) => void; onVincular: (caseId: string, cliente: string) => void;
}) {
  if (!itens.length) {
    return <p className="p-4 text-sm text-[#48626f] dark:text-zinc-400">Nenhum card de RMC/RCC perdida ou extinta.</p>;
  }
  const coluna = (o: Item) => COLUNAS.find((c) => c.de(o))?.titulo ?? '—';
  return (
    <div className="flex-1 overflow-auto px-4 pb-4 pt-3">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#f3f7fa] text-left text-[10px] font-bold uppercase tracking-wide text-[#48626f] dark:bg-zinc-900 dark:text-zinc-400">
            <th className="rounded-l-lg px-2.5 py-2">Cliente</th>
            <th className="px-2.5 py-2">Ação perdida</th>
            <th className="px-2.5 py-2">Teses</th>
            <th className="px-2.5 py-2 text-right" title="Refin: dobro dos descontos + dano moral. Não soma o churning.">Refin</th>
            <th className="px-2.5 py-2">Estado</th>
            <th className="rounded-r-lg px-2.5 py-2">WhatsApp</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((o) => (
            <tr key={o.caseId} onClick={() => onAbrir(o.caseId)}
              className="cursor-pointer border-b border-[#eef3f7] hover:bg-[#f8fbfd] dark:border-zinc-800 dark:hover:bg-zinc-800/50">
              <td className="px-2.5 py-2">
                <p className="font-semibold uppercase leading-4 text-[#101820] dark:text-zinc-100">{o.cliente}</p>
                {o.reanalisar && <p className="text-[10px] font-semibold text-red-700 dark:text-red-400">churning já saiu por outro card</p>}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2 text-[11px] text-[#48626f] dark:text-zinc-300">
                {o.reu ?? 'sem réu'} · <Acao o={o} />
              </td>
              <td className="px-2.5 py-2"><span className="flex flex-wrap gap-1"><Teses o={o} /><Foro o={o} /></span></td>
              <td className="whitespace-nowrap px-2.5 py-2 text-right font-semibold tabular-nums text-[#101820] dark:text-zinc-100">
                {o.caixa === 'pronta' && o.estimativa ? reais(o.estimativa.total) : ''}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2 text-[11px] text-[#48626f] dark:text-zinc-400">{coluna(o)}</td>
              <td className="whitespace-nowrap px-2.5 py-2">
                {o.temConversa ? (
                  <span className="text-[11px] text-[#48626f] dark:text-zinc-500">ligado</span>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); onVincular(o.caseId, o.cliente); }}
                    className="inline-flex items-center gap-0.5 rounded px-1 text-[11px] font-semibold text-amber-700 underline decoration-dotted hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10">
                    <Users className="h-3 w-3" /> vincular
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A OFERTA DE UM CLIENTE: o que foi medido, a mensagem (editável) e os botões.
 * Abre ao clicar no card ou na linha.
 */
function PainelDaOferta({ o, onFechar, onAbrirCard, onMudou }: {
  o: Item; onFechar: () => void; onAbrirCard: () => void; onMudou: () => void;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const [vendoBolhas, setVendoBolhas] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const temRefin = o.caixa === 'pronta';
  const temChurning = o.churning?.ofertado === true;
  const podeEnviar = o.oferecivel && aberta(o) && !o.reanalisar;

  useEffect(() => {
    let vivo = true;
    setTexto(null);
    legalCasesService.get(o.caseId)
      .then((c: any) => { if (vivo) setTexto(String(c?.metadata?.ofertaRefin?.mensagem ?? '')); })
      .catch(() => { if (vivo) setTexto(''); });
    return () => { vivo = false; };
  }, [o.caseId, o.analisadaEm]);

  const analisar = async () => {
    setOcupado(true);
    try {
      await legalCasesService.analisarOfertaRefin(o.caseId);
      onMudou();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui ler o HISCON da pasta.');
    } finally {
      setOcupado(false);
    }
  };

  /**
   * O ENVIO: a mensagem vai pela conversa que o hub já liga a este cliente, e
   * só depois de enviada a oferta passa a "enviada" (e nasce o card de refin).
   */
  const enviar = async () => {
    if (!texto?.trim()) return;
    setOcupado(true);
    try {
      // 🚨 O PORTÃO ANTES DO ENVIO (09/11/2026). O `sendMessage` vem antes do
      // registro, então sem perguntar aqui a recusa da oferta repetida chegaria
      // DEPOIS de a mensagem já estar no celular do cliente.
      const veredito = await legalCasesService.conferirOfertaRefin(o.caseId);
      if (!veredito.ok) {
        toast.error(veredito.motivo ?? 'Esta oferta não pode ser enviada.', { duration: 15000 });
        return;
      }
      const c: any = await legalCasesService.get(o.caseId);
      const conversa = c?.clienteConversa;
      if (!conversa?.conversationId) {
        toast.error('Sem conversa vinculada a este cliente: vincule o WhatsApp antes.');
        return;
      }
      await inboxService.sendMessage({
        conversationId: conversa.conversationId,
        type: 'TEXT', // 🚨 MAIÚSCULA: o DTO é @IsEnum(['TEXT',...]) e 'text' leva 400 (02/11/2026)
        content: { text: texto.trim() },
        oneOff: true,
        // Igual aos ensaios: uma bolha por parágrafo, no ritmo do servidor.
        emBolhas: true,
      });
      await legalCasesService.registrarOfertaRefin(o.caseId, { status: 'enviada', mensagem: texto.trim() });
      toast.success('Oferta enviada ao cliente');
      onMudou();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui enviar a mensagem.');
    } finally {
      setOcupado(false);
    }
  };

  const responder = async (status: 'aceita' | 'recusada') => {
    setOcupado(true);
    try {
      await legalCasesService.registrarOfertaRefin(o.caseId, { status });
      toast.success(status === 'aceita'
        ? (temChurning
          ? 'Aceita no refin. O churning segue pela escada do robô no card de campanha do cliente.'
          : 'Aceita: o card de refin foi para "montar inicial"')
        : 'Recusa registrada');
      onMudou();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui registrar a resposta.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    /* 🚨 RESERVA A BARRA DE BAIXO (30/10/2026). Sem isto o painel vai até a
       borda da janela e o botão de enviar some sob a barra de atalhos. A altura
       mora em `--dock-h` (globals.css), porque muda com o modo de navegação e
       com a safe-area do aparelho.
       ⚠️ Comentário de BLOCO. Comentário de JSX entre chaves, antes do elemento
       raiz e dentro do `return (`, NÃO é comentário: é expressão, e o build
       quebra com "Property assignment expected". E não se escreve a sequência
       de fechar comentário dentro de um comentário — ela o encerra ali mesmo,
       que foi o segundo erro desta mesma correção. */
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30"
      style={{ paddingBottom: 'var(--dock-h, 0px)' }}
      onClick={onFechar}
    >
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2 border-b border-[#eef3f7] p-4 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold uppercase text-[#101820] dark:text-zinc-100">{o.cliente}</p>
            <p className="text-xs text-[#48626f] dark:text-zinc-400">× {o.reu ?? 'sem réu'} · <Acao o={o} /></p>
            <div className="mt-2 flex flex-wrap gap-1.5"><Teses o={o} /></div>
          </div>
          <button onClick={onAbrirCard} title="Abrir o card da ação"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cfe0ed] px-2 text-xs text-[#48626f] dark:border-zinc-700 dark:text-zinc-300">
            <ExternalLink className="h-3 w-3" /> card
          </button>
          <button onClick={onFechar} className="h-8 w-8 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Fechar">
            <X className="mx-auto h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs text-[#48626f] dark:text-zinc-400">
          {/* 🚨 ONDE ESTE CLIENTE ESTÁ (30/10/2026). O estado vivia espalhado —
              selo no card, data em cinza no rodapé — e "em que pé está?" exigia
              deduzir. O componente é o MESMO do quadro do churning. */}
          <LinhaDoTempoDaOferta o={o} />

          {/* 🚨 A CONVERSA, AO VIVO (03/11/2026). Pedido do escritório no
              primeiro teste de ponta a ponta: *"consegue deixar a conversa em
              tempo real ali no kanban? Para sabermos como está"*. Enquanto a
              oferta não saiu, o que vale é a prévia logo abaixo; depois dela, o
              que vale é o que o cliente respondeu — e isso estava em outra tela.
              Recortada na OFERTA: o que veio antes é outra venda. */}
          {o.enviadaEm && <ConversaAoVivo caseId={o.caseId} desde={o.enviadaEm} />}
          <div className="space-y-1">
            {temRefin && o.resumo && <p><b className="text-[#101820] dark:text-zinc-200">Refin:</b> {o.resumo}</p>}
            {temRefin && o.estimativa && (
              <p>Estimativa do refin: {reais(o.estimativa.total)} (dobro {reais(o.estimativa.dobro)} até {o.estimativa.ate ?? '?'} + dano moral {reais(o.estimativa.danoMoral)})</p>
            )}
            {temRefin && o.foro && ROTULO_DO_FORO[o.foro] && (
              <p>Foro da inicial: {ROTULO_DO_FORO[o.foro].longo}{o.pagador ? `. Pago em: ${o.pagador}` : ''}</p>
            )}
            {!temRefin && <p><b className="text-[#101820] dark:text-zinc-200">Refin:</b> {o.rotulo}</p>}
            {/* 🚨 AS DUAS ACEITAÇÕES, SEPARADAS (03/11/2026). */}
            {o.status === 'aceita' && (
              <p>
                <b className="text-[#101820] dark:text-zinc-200">Honorários:</b>{' '}
                {fechouHonorarios(o) ? (
                  <>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      fechados em {ROTULO_DA_OPCAO[String(o.honorarios?.opcao)] ?? String(o.honorarios?.opcao)}
                    </span>
                    {o.honorarios?.em ? ` · ${dia(o.honorarios.em)}` : ''}
                    {o.honorarios?.fonte ? ` · ${o.honorarios.fonte}` : ''}
                  </>
                ) : (
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    em aberto. Ele topou a ação; o preço ainda não fechou.
                  </span>
                )}
              </p>
            )}
            {o.churning && (
              <p><b className="text-[#101820] dark:text-zinc-200">Churning:</b>{' '}
                {temChurning
                  ? `${o.churning.contratos} contratos no ${o.churning.grupo} (veredito ${o.churning.veredito})`
                  : o.churning.motivo ?? 'fora'}
              </p>
            )}
            {o.reanalisar && (
              <p className="font-semibold text-red-700 dark:text-red-400">
                O churning deste cliente saiu por outro card depois da análise. Leia o HISCON de novo para a mensagem sair sem ele.
              </p>
            )}
          </div>

          {/* 🚨 DEPOIS DE ENVIADA, A PRÉVIA SOBRA (03/11/2026). Pedido do
              escritório olhando o painel: *"depois que iniciou, não precisa
              mais dessa 'como vai chegar' né?"*. Ela mostra o que VAI chegar —
              e já chegou. O que vale dali em diante é a conversa ao vivo,
              logo acima, que mostra o que de fato aconteceu. */}
          {o.oferecivel && !o.enviadaEm && (
            texto === null ? (
              <p>Carregando a mensagem…</p>
            ) : (
              <>
                {/* 🚨 ABRE EM BOLHAS (30/10/2026): o que o cliente lê é a bolha,
                    não o campo. O texto continua a um clique, para revisar. */}
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setVendoBolhas(!vendoBolhas)}
                    className="rounded-md border border-[#cfe0ed] px-2 py-0.5 text-[10px] font-semibold text-[#4b5863] hover:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-300"
                  >
                    {vendoBolhas ? 'editar o texto' : 'ver como vai chegar'}
                  </button>
                </div>
                {vendoBolhas ? (
                  <PreviaEmBolhas texto={texto} />
                ) : (
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    disabled={!podeEnviar}
                    rows={16}
                    className="w-full rounded-lg border border-[#cfe0ed] bg-white p-2 text-sm leading-5 text-[#101820] disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                )}
              </>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[#eef3f7] p-4 dark:border-zinc-800">
          {podeEnviar && (
            <>
              <button disabled={ocupado || !texto?.trim() || !o.temConversa} onClick={enviar}
                className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: ACCENT }}>
                {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Enviar a {o.cliente.split(' ')[0]} pelo WhatsApp
              </button>
              <span className="text-[11px] text-[#48626f] dark:text-zinc-500">
                {!o.temConversa ? 'vincule o WhatsApp antes' : 'vai pela conversa dele'}
                {temRefin ? '; nasce o card de refin em "informações faltantes"' : ''}
                {temChurning ? "; o churning entra na escada do robô pelo card de campanha do cliente" : ""}
              </span>
            </>
          )}
          {o.status === 'enviada' && (
            <>
              <button disabled={ocupado} onClick={() => responder('aceita')}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50">
                <Check className="h-3 w-3" /> aceitou
              </button>
              <button disabled={ocupado} onClick={() => responder('recusada')}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 px-3 text-xs font-semibold text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
                <X className="h-3 w-3" /> recusou
              </button>
            </>
          )}
          {aberta(o) && (
            <button disabled={ocupado} onClick={analisar} title="Lê de novo o HISCON da pasta"
              className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg border border-[#cfe0ed] px-3 text-xs text-[#48626f] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
              {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanSearch className="h-3 w-3" />} ler HISCON de novo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
