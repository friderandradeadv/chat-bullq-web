'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Recycle, Send, Check, X, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type CaseDetail } from '@/features/legal-cases/services/legal-cases.service';
import { calculadoraRmcService } from '@/features/calculadora-rmc/services/calculadora-rmc.service';
import { inboxService } from '@/features/inbox/services/inbox.service';

/**
 * Oferta da segunda ação: CHURNING (reciclagem de contratos).
 *
 * O cliente chega pelo cartão (RMC/RCC) e assina o contrato por causa dele. Só
 * que o HISCON costuma mostrar outra coisa ao lado: o mesmo empréstimo
 * refinanciado vezes seguidas, cada troca devolvendo um troco pequeno e
 * esticando a dívida. Isso é uma ação própria, e é dele a decisão de incluí-la.
 *
 * O trabalho pesado JÁ EXISTE: o motor de indícios lê a cadeia e o plano de ação
 * traduz para dinheiro. Aqui só se faz a ponte entre esse resultado e o cliente.
 *
 * 🚨 QUEM DISPARA É O ADVOGADO. Este componente monta o texto e o deixa
 * editável, mas o envio parte de um clique humano, na conversa que já existe. A
 * inicial contra a Meta afirma ao juízo que os scripts de envio em lote saíram
 * de operação; rotina que dispara sozinha recria o que a peça diz não existir.
 */

/** Os indícios que sustentam a conversa sobre reciclagem de contratos. */
const IDS_CHURNING = new Set([
  'CADEIA_REFIN',
  'REFIN_IMEDIATO',
  'REFIN_SEM_VANTAGEM',
  'REFIN_SEM_LIBERACAO',
  'ESTEIRA_NUMERACAO',
  'AVERBACAO_PONTE',
  'PARCELA_CRESCENTE',
  'DIVIDA_CRESCENTE',
  'GAP_EMPRESTADO_LIBERADO',
]);

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

/**
 * O achado é de UM GRUPO ECONÔMICO, nunca do HISCON inteiro.
 *
 * 🚨 Medido na primeira cliente real: o HISCON trouxe 84 indícios, 37 contratos
 * e 11 bancos. Somar tudo numa frase só produzia uma mentira — "o mesmo
 * empréstimo no Facta foi refinanciado 37 vezes" — porque os 37 estavam
 * espalhados por 11 instituições, e os valores em dinheiro eram de um grupo só.
 * Cada grupo é um réu e uma ação; é por grupo que se fala com o cliente.
 */
type Achado = {
  grupo: string;
  instituicoes: string[];
  indicios: { id: string; titulo: string; evidencia: string }[];
  /** O caso em dinheiro, direto do plano de ação — nada aqui é estimativa de condenação. */
  dinheiro: { recebido: number; parcelaMensal: number; jaDescontado: number; aindaFalta: number } | null;
  contratos: number;
  /** Outros grupos com indício de reciclagem — cada um é uma conversa própria. */
  outrosGrupos: number;
};

/**
 * O texto que vai ao cliente.
 *
 * Regras que não são de estilo: fala em dinheiro (ele não sabe o que é
 * "churning" nem "averbação"), não promete resultado — Código de Ética da OAB,
 * art. 41 — e termina com uma pergunta de resposta simples, porque é dela que
 * sai o "sim" que move o card.
 */
function textoDaOferta(nome: string | null, a: Achado): string {
  const primeiro = (nome ?? '').trim().split(/\s+/)[0] || 'Olá';
  // Uma instituição: diz o nome. Várias do mesmo grupo: diz o grupo e quantas,
  // porque despejar onze nomes numa mensagem de WhatsApp não informa ninguém.
  const banco =
    a.instituicoes.length === 1 ? ` no ${a.instituicoes[0]}`
    : a.instituicoes.length > 1 ? ` no ${a.grupo} (${a.instituicoes.length} instituições do mesmo grupo)`
    : '';
  const d = a.dinheiro;
  const linhas: string[] = [];

  linhas.push(`${primeiro}, terminei de analisar o histórico dos seus empréstimos no INSS.`);
  linhas.push('');
  linhas.push(
    `Além do cartão que já vamos discutir, apareceu outra coisa: ${a.contratos} empréstimos${banco} ` +
      `foram trocados uns pelos outros, um refinanciando o anterior. A cada troca entrou pouco ` +
      `dinheiro na sua conta e a dívida foi esticada de novo.`,
  );

  if (d) {
    linhas.push('');
    linhas.push('Pelo que o próprio INSS registra:');
    if (d.recebido > 0) linhas.push(`• entrou na sua conta: ${brl(d.recebido)}`);
    if (d.parcelaMensal > 0) linhas.push(`• sai do seu benefício por mês: ${brl(d.parcelaMensal)}`);
    if (d.jaDescontado > 0) linhas.push(`• já descontado até aqui: ${brl(d.jaDescontado)}`);
    if (d.aindaFalta > 0) linhas.push(`• ainda falta pagar: ${brl(d.aindaFalta)}`);
  }

  linhas.push('');
  linhas.push(
    'Isso pode ser discutido em uma ação separada, junto com a do cartão. ' +
      'Não posso garantir resultado, isso ninguém honesto garante, mas posso dizer que o caso tem do que tratar.',
  );
  linhas.push('');
  // Honorários no padrão do escritório: quota litis meio a meio. Dito em uma
  // linha e sem percentual escondido — é a parte que o cliente mais releva e a
  // que mais gera briga depois.
  // 🚨 SEGUNDA PESSOA, SEM TRATAMENTO DE GÊNERO. Esta linha dizia "a senhora",
  // cravado — foi escrita para uma cliente e nunca parametrizada. Saiu assim
  // numa mensagem para o JOSÉ BATISTA ("josé e chamando de senhora"), e já
  // destoava do resto do próprio texto, que trata por "sua conta", "seu
  // benefício", "seus empréstimos". "Você" resolve sem adivinhar gênero.
  linhas.push(
    'Os honorários são os mesmos do seu contrato: meio a meio. Do que você ' +
      'receber, 50% fica com você e 50% com o escritório. Se não houver ' +
      'recebimento, você não paga nada.',
  );
  linhas.push('');
  linhas.push('Quer que eu inclua essa parte? Responda SIM ou NÃO que eu sigo daqui.');
  return linhas.join('\n');
}

export function OfertaChurning({ caso, onMudou }: { caso: CaseDetail; onMudou?: () => void }) {
  const qc = useQueryClient();
  const [analisando, setAnalisando] = useState(false);
  const [achado, setAchado] = useState<Achado | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  /** Todos os grupos com indício, na ordem do plano. Um de cada vez vira oferta. */
  const [grupos, setGrupos] = useState<any[]>([]);
  /** Os indícios de churning do HISCON inteiro — recortados por grupo na troca. */
  const [indiciosDoHiscon, setIndiciosDoHiscon] = useState<any[]>([]);
  /**
   * Quais grupos ENTRAM com ação. Marcar é decisão do advogado, não do motor.
   *
   * 🚨 Começa marcado só o que o plano de ação deu como AJUIZAR, porque é o que
   * tem operação dentro dos 4 anos E indício forte documentado. Os demais ficam
   * desmarcados mas CLICÁVEIS: `REPOSICIONAR_TESE` vira ação boa com outro
   * enquadramento, e `INDICIO_FRACO` pode virar depois da exibição. Filtrar em
   * silêncio esconderia um grupo inteiro do caso.
   */
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  /**
   * Põe UM grupo na tela: recorta os indícios dele, monta o texto ao cliente e
   * grava a oferta com o grupo como campo.
   *
   * 🚨 O recorte por grupo não é detalhe. O motor marca cada indício com o
   * banco, e numa cliente real o HISCON trouxe 84 indícios em 11 instituições:
   * sem recortar, os 84 entrariam numa oferta sobre um réu só, e a frase ao
   * cliente afirmaria que o mesmo empréstimo foi refinanciado 37 vezes.
   */
  const aplicarGrupo = async (alvo: any, todosOsIndicios: any[], quantosGrupos: number) => {
    const instituicoes: string[] = alvo.instituicoes ?? [];
    const doGrupo = todosOsIndicios.filter((i: any) =>
      (i.bancos ?? []).some((b: string) => instituicoes.includes(b)),
    );
    const usados = doGrupo.length ? doGrupo : todosOsIndicios;
    const contratos = new Set(usados.flatMap((i: any) => i.contratos ?? [])).size;
    const a: Achado = {
      grupo: alvo.grupo ?? instituicoes[0] ?? '',
      instituicoes,
      indicios: usados.map((i: any) => ({ id: i.id, titulo: i.titulo, evidencia: i.evidencia })),
      dinheiro: alvo?.dinheiro ?? null,
      contratos,
      outrosGrupos: Math.max(0, quantosGrupos - 1),
    };
    setAchado(a);
    setTexto(textoDaOferta(cliente?.name ?? null, a));
    await legalCasesService.registrarOfertaChurning(caso.id, {
      status: 'analisada',
      resumo: `${a.grupo || 'grupo'}: ${a.indicios.length} indício(s) em ${contratos} contrato(s)`,
      indicios: a.indicios.map((i) => i.id),
      // O grupo vai como CAMPO, não só dentro do resumo: é ele que o montador
      // de churning lê para saber contra quem é a ação.
      grupo: a.grupo || undefined,
    });
    qc.invalidateQueries({ queryKey: ['oferta-churning', caso.id] });
  };


  const cliente = caso.parties?.find((p) => p.role === 'CLIENT') ?? null;
  const conversa = caso.clienteConversa ?? null;

  const { data } = useQuery({
    queryKey: ['oferta-churning', caso.id],
    queryFn: () => legalCasesService.lerOfertaChurning(caso.id),
    enabled: !!caso.id,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const oferta = data?.oferta ?? null;

  /**
   * Lê o HISCON que já está na pasta do cliente e separa só o que interessa aqui.
   * Sem upload: exigir que o advogado baixe do Drive e suba de volta o mesmo PDF
   * é o tipo de passo que faz a ferramenta não ser usada.
   */
  const analisar = async () => {
    if (!cliente?.id) { toast.error('Este processo não tem cliente vinculado.'); return; }
    setAnalisando(true);
    try {
      const { achados } = await calculadoraRmcService.hisconsNaPasta(cliente.id);
      if (!achados.length) {
        toast.error('Nenhum HISCON na pasta deste cliente. Arquive o HISCON antes de ofertar.');
        return;
      }
      const r: any = await calculadoraRmcService.extrairHiscon(null, {
        partyId: cliente.id,
        driveFileId: achados[0].id,
      });
      const todos: any[] = r?.indicios?.indicios ?? [];
      const doChurning = todos.filter((i) => IDS_CHURNING.has(i.id));
      const acoes: any[] = r?.planoAcao?.acoes ?? [];

      if (!doChurning.length || !acoes.length) {
        setAchado({ grupo: '', instituicoes: [], indicios: [], dinheiro: null, contratos: 0, outrosGrupos: 0 });
        toast.message('Sem indício de reciclagem de contratos neste HISCON.');
        return;
      }

      // Quantos indícios de churning cada ação (= grupo econômico = réu) carrega.
      const peso = (ac: any) => (ac.indicios ?? []).filter((x: any) => IDS_CHURNING.has(x.id)).length;
      const comChurning = acoes.filter((ac) => peso(ac) > 0);
      setIndiciosDoHiscon(doChurning);
      // Ordena por AJUIZAR primeiro: não se oferta ao cliente o grupo que o
      // próprio plano manda descartar por decadência ou indício fraco.
      const ordenadas = [...comChurning].sort(
        (a, b) =>
          Number(b.veredito === 'AJUIZAR') - Number(a.veredito === 'AJUIZAR') || peso(b) - peso(a),
      );
      if (!ordenadas.length) {
        setAchado({ grupo: '', instituicoes: [], indicios: [], dinheiro: null, contratos: 0, outrosGrupos: 0 });
        setGrupos([]);
        toast.message('Sem indício de reciclagem de contratos neste HISCON.');
        return;
      }

      // 🚨 TODOS OS GRUPOS FICAM À MÃO, não só o do topo. Antes a análise
      // escolhia `ordenadas[0]` e os demais viravam um NÚMERO na frase ("outros
      // 4 grupos também têm indício"): eles existiam, apareciam na tela e não
      // havia como ofertá-los. No HISCON do JOSÉ BATISTA eram CINCO, e quatro
      // ficariam para trás sem ninguém perceber. Cada um continua sendo uma
      // ação e uma conversa própria — por isso se escolhe um de cada vez.
      setGrupos(ordenadas);
      setMarcados(new Set(
        ordenadas.filter((g: any) => g.veredito === 'AJUIZAR')
          .map((g: any) => String(g.grupo ?? (g.instituicoes ?? [])[0] ?? '')),
      ));
      aplicarGrupo(ordenadas[0], doChurning, ordenadas.length);
      qc.invalidateQueries({ queryKey: ['oferta-churning', caso.id] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui ler o HISCON da pasta.');
    } finally {
      setAnalisando(false);
    }
  };

  const enviar = async () => {
    if (!conversa?.conversationId) {
      toast.error('Sem conversa vinculada a este cliente — abra o WhatsApp dele e vincule antes.');
      return;
    }
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await inboxService.sendMessage({
        conversationId: conversa.conversationId,
        type: 'text',
        content: { text: texto.trim() },
        oneOff: true,
      });
      await legalCasesService.registrarOfertaChurning(caso.id, { status: 'enviada', mensagem: texto.trim() });
      qc.invalidateQueries({ queryKey: ['oferta-churning', caso.id] });
      toast.success('Oferta enviada ao cliente');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  };

  /**
   * Aceitou: a ação entra na lista de "contratos a impugnar" do card, marcada
   * como CHURNING, e o card sobe para "Montar inicial".
   *
   * 🚨 Não cria o card do réu aqui de propósito. Quem cria é o "Gerar iniciais",
   * o mesmo caminho de sempre — assim existe UM lugar só que faz nascer card, e
   * você vê a linha na tela e confere o réu antes de o card existir. Criar por
   * fora seria um segundo caminho, invisível e sem revisão.
   */
  /**
   * Grava os réus em "Contratos a impugnar". Devolve quantos entraram.
   *
   * 🚨 ACUMULA, não substitui: `jaTem` descarta quem já está na lista. É o que
   * permite aceitar um grupo, trocar e aceitar o seguinte sem perder o
   * anterior — e o que faz "aceitar todos" ser seguro depois de aceites
   * avulsos.
   */
  /**
   * Cria os cards dos réus logo depois do aceite, e ARQUIVA o card-mãe.
   *
   * 🚨 Arquivar é decisão do advogado, de 05/10/2026: *"ele pode sumir depois
   * que faz a filtragem"*. Só passou a fazer sentido porque o seletor com
   * caixas deixa marcar TODOS os grupos que entram numa tomada só — antes, com
   * uma oferta por vez, arquivar no primeiro aceite tornaria os demais grupos
   * inalcançáveis.
   *
   * O pai vira o registro do desmembramento, com os filhos anotados, igual ao
   * intake de sempre. Se mais tarde faltar um grupo, o card se recupera: a
   * exclusão e o arquivamento são de marca, nada se apaga de verdade.
   *
   * 🚨 Não arquiva quando NADA nasce: a API devolve cedo, sem tocar no pai, se
   * todos os réus já tiverem card.
   */
  const criarCardsDosReus = async () => {
    const r = await legalCasesService.gerarIniciais(caso.id, 'montar_inicial');
    return r?.criados ?? 0;
  };

  /**
   * 🚨 UMA ENTRADA POR AÇÃO, NÃO POR RÉU (08/10/2026). Até aqui cada
   * instituição da ação virava uma linha e, portanto, um card e uma petição —
   * e as petições impugnavam OS MESMOS contratos. `montarPlanoAcao` já decide,
   * lendo o HISCON, quem responde junto: ela une numa cadeia só os grupos
   * ligados pelo mesmo número de contrato (originação e cessão) e devolve
   * âncora + litisconsortes.
   *
   * Medido no JOSÉ BATISTA: a análise sugeria 3 ações (Itaú com as duas
   * empresas, Facta com o Pine, e o Pan sozinho) e nasceram 5 cards. Dois
   * pares impugnando a mesma averbação é litispendência, e fatiar a mesma
   * cadeia é o que o TJSP extingue por fragmentação artificial.
   */
  const gravarReus = async (entradas: { reu: string; litisconsortes?: string[]; grupo: string }[]) => {
    // A lista vive no metadata do caso, é de onde o próprio drawer a lê.
    const atuais: any[] = ((caso.metadata as any)?.contratos ?? []) as any[];
    const jaTem = (reu: string) =>
      atuais.some((c: any) => String(c?.reu ?? '').toUpperCase().trim() === reu.toUpperCase().trim());
    const vistos = new Set<string>();
    const novas = entradas
      .filter(({ reu }) => {
        const k = reu.toUpperCase().trim();
        if (!k || jaTem(reu) || vistos.has(k)) return false;
        vistos.add(k);
        return true;
      })
      .map(({ reu, litisconsortes, grupo }, i) => ({
        id: `churn${Date.now().toString(36)}${i}`,
        // 🚨 O GRUPO VAI NA LINHA, não só na oferta. A oferta guarda UM grupo,
        // o da conversa da vez, e o card filho herdava esse. Medido em
        // 05/10/2026: aceitos cinco grupos de uma vez, os cinco filhos nasceram
        // com "Itaú Unibanco" — a peça da FACTA sairia com os contratos do
        // Itaú. Conteúdo errado, sem erro na tela. Aqui cada réu leva o grupo
        // DELE.
        grupo,
        // 🚨 RÉU EM CAIXA-ALTA, como o acervo inteiro. Medido em 05/10/2026:
        // 762 dos 853 réus do escritório (89,3%) estão assim. Os nomes vêm do
        // registro de instituições em caixa mista ("Itaú Unibanco S.A.") e
        // entravam assim no card, destoando de todos os outros.
        reu: reu.toUpperCase(),
        // Os demais réus DA MESMA AÇÃO. O desmembramento os põe no polo
        // passivo deste card em vez de criar um card para cada.
        litisconsortes: (litisconsortes ?? []).map((x) => x.toUpperCase()),
        doc: null,
        produto: 'CHURNING',
        valor: null,
        beneficio: /^(AP|PM)\b/.exec(caso.title ?? '')?.[1] ?? null,
      }));
    if (novas.length) await legalCasesService.saveContratos(caso.id, [...atuais, ...novas] as any);
    return novas.length;
  };

  /**
   * ACEITA OS GRUPOS MARCADOS, de uma vez.
   *
   * 🚨 Existe para o caso em que a conversa com o cliente JÁ ACONTECEU por
   * fora — foi o pedido do advogado no JOSÉ BATISTA: *"no caso dele eu já
   * falei, ele já autorizou"*. Fora disso a regra continua sendo uma conversa
   * por grupo, porque cada grupo é uma ação própria e o cliente precisa saber
   * de qual se está falando. Por isso o botão diz quantos grupos vai aceitar e
   * fica separado do "Aceitou" do grupo da vez.
   */
  const aceitarMarcados = async () => {
    setRegistrando(true);
    try {
      const escolhidos = grupos.filter((g: any) =>
        marcados.has(String(g.grupo ?? (g.instituicoes ?? [])[0] ?? '')));
      const todos = escolhidos.map((g: any) => {
        const nome = String(g.grupo ?? (g.instituicoes ?? [])[0] ?? '');
        // A primeira instituição é a de MAIS averbações (ordenado em
        // `montarPlanoAcao`): é ela que dá nome à ação, à pasta e à peça.
        const [principal, ...demais] = (g.instituicoes ?? []) as string[];
        return { reu: principal ?? nome, litisconsortes: demais, grupo: nome };
      }).filter((x: any) => x.reu);
      await gravarReus(todos);
      const r = await legalCasesService.registrarOfertaChurning(caso.id, { status: 'aceita' });
      const criados = await criarCardsDosReus();
      qc.invalidateQueries({ queryKey: ['oferta-churning', caso.id] });
      qc.invalidateQueries({ queryKey: ['legal-cases'] });
      onMudou?.();
      toast.success(
        `${escolhidos.length} grupo(s) aceito(s). `
        + (criados
          ? `${criados} card(s) de AÇÃO criados em Montar inicial (os litisconsortes vão no polo passivo, não em card próprio).`
            + ' Este card foi arquivado e virou o registro do desmembramento.'
          : 'Nenhum card novo: os réus já tinham card.'),
        { duration: 10000 },
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui registrar os grupos.');
    } finally {
      setRegistrando(false);
    }
  };

  const responder = async (status: 'aceita' | 'recusada') => {
    setRegistrando(true);
    try {
      if (status === 'aceita' && achado?.instituicoes?.length) {
        // Um caminho só para gravar réu: `gravarReus` põe o grupo na linha,
        // acumula e não duplica.
        const [principal, ...demais] = achado.instituicoes;
        await gravarReus([{ reu: principal, litisconsortes: demais, grupo: achado.grupo }]);
      }
      const r = await legalCasesService.registrarOfertaChurning(caso.id, { status });
      qc.invalidateQueries({ queryKey: ['oferta-churning', caso.id] });
      qc.invalidateQueries({ queryKey: ['legal-cases'] });
      onMudou?.();
      // 🚨 O ACEITE NÃO CRIA OS CARDS DOS RÉUS, e isso precisa estar ESCRITO.
      // Quem cria é "Gerar iniciais" — de propósito, para existir um lugar só
      // que faz nascer card e para o réu ser conferido na lista antes. Mas o
      // drawer fecha quando o card muda de fase, e o advogado ficou olhando um
      // card sem réu achando que algo tinha dado errado: "criou esse card
      // vazio". O toast é o único lugar que sobra para dizer o próximo passo.
      if (status === 'aceita') {
        const criados = await criarCardsDosReus();
        const nomes = (achado?.instituicoes ?? []).join(' e ');
        toast.success(
          criados
            ? `${criados} card(s) de réu criados em Montar inicial: ${nomes}.`
              + ' Este card foi arquivado e virou o registro do desmembramento.'
            : `${nomes || 'Os réus'} já tinham card — nada novo foi criado.`,
          { duration: 10000 },
        );
      } else {
        toast.success('Recusa registrada');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui registrar a resposta.');
    } finally {
      setRegistrando(false);
    }
  };

  const enviada = oferta?.status === 'enviada';
  const respondida = oferta?.status === 'aceita' || oferta?.status === 'recusada';

  return (
    <div className="mt-5 rounded-lg border border-[#cfe0ed] bg-[#f7fafc] p-2.5 dark:border-zinc-700 dark:bg-zinc-800/40">
      <div className="flex items-center gap-1.5">
        <Recycle className="h-3.5 w-3.5 shrink-0 text-[#48626f] dark:text-zinc-400" />
        <p className="flex-1 text-sm font-medium text-[#101820] dark:text-zinc-200">
          Ação adicional <span className="font-normal text-[#48626f] dark:text-zinc-400">— reciclagem de contratos</span>
        </p>
        {oferta && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            oferta.status === 'aceita' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
            : oferta.status === 'recusada' ? 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
            : oferta.status === 'enviada' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
            : 'bg-[#228BE6]/10 text-[#1971c2] dark:text-[#74c0fc]'}`}>
            {oferta.status}
          </span>
        )}
      </div>

      {respondida && !achado ? (
        /* 🚨 RESPONDIDA NÃO É FIM. O painel fechava de vez ao registrar a
           resposta, e com isso sumia o "Analisar cadeia" — mas um HISCON rende
           VÁRIOS grupos, e cada um é uma ação própria. No JOSÉ BATISTA são
           cinco: aceito o Itaú, os outros quatro ficavam inalcançáveis ("não
           deixa reabrir a reciclagem"). Agora o estado respondido mostra o que
           foi feito E deixa reabrir; depois de reabrir, `achado` existe e a
           tela volta a ser a da análise. */
        <>
          <p className="mt-2 text-[11px] leading-4 text-[#48626f] dark:text-zinc-400">
            {oferta?.status === 'aceita'
              ? 'O cliente aceitou. Os réus entraram em "Contratos a impugnar" e o card foi para "Montar inicial" — confira as linhas e clique em "Gerar iniciais" para os cards nascerem.'
              : 'O cliente recusou. Fica registrado no card; a ação do cartão segue normalmente.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={analisar}
              disabled={analisando}
              title="Lê o HISCON de novo e lista os grupos. Um HISCON costuma render mais de um grupo, e cada um é uma ação própria — use para ofertar os demais."
              className="inline-flex items-center gap-1 rounded-md border border-[#cfe0ed] px-2 py-1 text-[11px] font-medium text-[#4b5863] hover:border-[#4a90e2] hover:text-[#1b6ec2] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              {analisando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              {analisando ? 'Lendo o HISCON…' : 'Reabrir — ofertar outro grupo'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-[11px] leading-4 text-[#48626f] dark:text-zinc-400">
            Lê a cadeia de refinanciamentos no HISCON que já está na pasta e, havendo lastro,
            monta a pergunta ao cliente em dinheiro. Você revisa e envia.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={analisar} disabled={analisando}
              className="inline-flex items-center gap-1 rounded-md border border-[#cfe0ed] px-2 py-1 text-[11px] font-medium text-[#4b5863] hover:border-[#4a90e2] hover:text-[#1b6ec2] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
              {analisando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              {analisando ? 'Lendo o HISCON…' : 'Analisar cadeia'}
            </button>
            {/* 🚨 A RESPOSTA DO CLIENTE NÃO DEPENDE DE TER ENVIADO POR AQUI.
                Estes botões só apareciam com `enviada`, isto é, depois de a
                mensagem sair pelo hub. Mas a conversa acontece fora dele o
                tempo todo — no JOSÉ BATISTA o advogado já tinha falado e
                autorizado ("não tem botão de cliente aceitou, quero criar os
                cards"), e sem o botão não havia como registrar o aceite nem
                criar os cards dos réus. Basta haver análise: quem fala com o
                cliente é o advogado, não a tela. */}
            {(enviada || !!achado?.instituicoes?.length) && (
              <>
                <button type="button" onClick={() => responder('aceita')} disabled={registrando}
                  title={enviada
                    ? 'Registra o aceite e põe os réus deste grupo em "Contratos a impugnar".'
                    : 'A conversa aconteceu por fora? Registra o aceite deste grupo do mesmo jeito e põe os réus em "Contratos a impugnar".'}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  <Check className="h-3 w-3" /> Cliente aceitou
                </button>
                <button type="button" onClick={() => responder('recusada')} disabled={registrando}
                  className="inline-flex items-center gap-1 rounded-md border border-[#cfe0ed] px-2 py-1 text-[11px] font-medium text-[#4b5863] hover:border-red-400 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
                  <X className="h-3 w-3" /> Recusou
                </button>
              </>
            )}
          </div>

          {achado && achado.indicios.length === 0 && (
            <p className="mt-2 rounded-lg border border-[#cfe0ed] bg-white px-2 py-1.5 text-[11px] leading-4 text-[#48626f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Nada de reciclagem neste HISCON. Não há o que oferecer — e oferecer sem lastro é o
              caminho mais curto para uma ação que não se sustenta.
            </p>
          )}

          {achado && achado.indicios.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="rounded-lg border border-[#cfe0ed] bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-[11px] font-semibold text-[#101820] dark:text-zinc-200">
                  {achado.grupo || 'Grupo'} · {achado.indicios.length} indício(s) · {achado.contratos} contrato(s)
                </p>
                {achado.instituicoes.length > 0 && (
                  <p className="text-[10px] leading-4 text-[#48626f] dark:text-zinc-500">
                    {achado.instituicoes.join(' · ')}
                  </p>
                )}
                {grupos.length > 1 && (
                  <div className="flex flex-col gap-1">
                    {/* 🚨 OS OUTROS GRUPOS PRECISAM SER ALCANÇÁVEIS, não contados.
                        Antes esta área dizia "outros 4 grupos também têm indício" e
                        parava aí: eles existiam, apareciam na tela e não havia como
                        ofertá-los. No HISCON do JOSÉ BATISTA eram cinco, e quatro
                        ficariam para trás. Cada um continua sendo uma ação e uma
                        conversa própria, por isso se escolhe UM de cada vez. */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[10px] leading-4 text-amber-700 dark:text-amber-400">
                        {grupos.length} grupos com indício de reciclagem. Marque na caixa quais
                        entram com ação; clique no nome para ver os números de cada um. Em itálico,
                        os que o plano de ação não manda ajuizar. <strong>Marque todos os que quiser
                        de uma vez</strong>: ao aceitar, os cards nascem e este aqui é arquivado.
                      </p>
                      {/* 🚨 ATALHO PARA QUANDO A CONVERSA JÁ ACONTECEU POR FORA.
                          Pedido do advogado no JOSÉ BATISTA: "no caso dele eu já
                          falei, ele já autorizou". Fora disso a regra continua
                          sendo uma conversa por grupo — por isso este botão fica
                          separado do "Aceitou" do grupo da vez e diz, no próprio
                          rótulo, quantas ações está aceitando. */}
                      <button
                        onClick={() => aceitarMarcados()}
                        disabled={registrando || analisando || marcados.size === 0}
                        title={`Grava os réus dos ${marcados.size} grupo(s) marcados em "Contratos a impugnar" de uma vez. `
                          + 'Cada grupo continua virando uma ação separada. Comece marcado só o que o plano manda ajuizar; '
                          + 'marque os outros se você decidir entrar com eles.'}
                        className="rounded-lg border border-emerald-500 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                      >
                        Aceitar os {marcados.size} marcados
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {grupos.map((g: any) => {
                        const nome = g.grupo ?? (g.instituicoes ?? [])[0] ?? '—';
                        const n = (g.indicios ?? []).filter((x: any) => IDS_CHURNING.has(x.id)).length;
                        const ativo = achado.grupo === nome;
                        return (
                          <span key={nome} className="inline-flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700">
                          {/* 🚨 DUAS AÇÕES, DOIS CONTROLES. A caixa decide se o
                              grupo ENTRA com ação; o rótulo só troca o que está
                              na tela. Juntar as duas num clique só faria olhar
                              um grupo marcá-lo sem querer. */}
                          <button
                            type="button"
                            onClick={() => setMarcados((m) => {
                              const n2 = new Set(m);
                              if (n2.has(nome)) n2.delete(nome); else n2.add(nome);
                              return n2;
                            })}
                            disabled={analisando || registrando}
                            title={marcados.has(nome) ? `${nome} ENTRA com ação.` : `${nome} fica de fora.`}
                            className={`px-1.5 text-[10px] font-bold ${
                              marcados.has(nome)
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                            }`}
                          >
                            {marcados.has(nome) ? '✓' : '○'}
                          </button>
                          <button
                            onClick={() => aplicarGrupo(g, indiciosDoHiscon, grupos.length)}
                            disabled={analisando}
                            title={g.veredito === 'AJUIZAR'
                              ? `${nome}: ${n} indício(s). O plano de ação manda ajuizar.`
                              : `${nome}: ${n} indício(s). O plano de ação NÃO manda ajuizar este — confira antes de ofertar.`}
                            className={`px-2 py-1 text-[10px] font-semibold disabled:opacity-50 ${
                              ativo
                                ? 'bg-[#CF3B2E] text-white'
                                : g.veredito === 'AJUIZAR'
                                  ? 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
                                  : 'italic text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950'
                            }`}
                          >
                            {nome} · {n}
                          </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <ul className="mt-1 space-y-0.5">
                  {achado.indicios.slice(0, 6).map((i) => (
                    <li key={i.id} className="text-[11px] leading-4 text-[#48626f] dark:text-zinc-400">
                      <span className="font-medium text-[#101820] dark:text-zinc-300">{i.titulo}:</span> {i.evidencia}
                    </li>
                  ))}
                  {achado.indicios.length > 6 && (
                    <li className="text-[10px] text-[#48626f] dark:text-zinc-500">
                      e mais {achado.indicios.length - 6} — o laudo do HISCON traz todos.
                    </li>
                  )}
                </ul>
                {achado.dinheiro && (
                  <p className="mt-1 text-[11px] leading-4 text-[#1b6ec2] dark:text-[#74c0fc]">
                    Recebido {brl(achado.dinheiro.recebido)} · sai {brl(achado.dinheiro.parcelaMensal)}/mês ·
                    falta {brl(achado.dinheiro.aindaFalta)}
                  </p>
                )}
              </div>

              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={10}
                className="w-full rounded-md border border-[#cfe0ed] bg-white px-2 py-1.5 text-[12px] leading-5 text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              />

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-[#48626f] dark:text-zinc-500">
                  {conversa?.conversationId
                    ? `vai para ${conversa.nome ?? 'o cliente'} no WhatsApp`
                    : 'sem conversa vinculada — não dá para enviar daqui'}
                </span>
                <button type="button" onClick={enviar} disabled={enviando || !conversa?.conversationId}
                  className="inline-flex items-center gap-1 rounded-md bg-[#228BE6] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1c7ed6] disabled:opacity-40">
                  {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  {enviada ? 'Enviar de novo' : 'Enviar ao cliente'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
