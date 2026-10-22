'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DossieReplica } from './dossie-replica';
import { CumprimentoCs } from './cumprimento-cs';
import { TriagemPeca } from './triagem-peca';
import { BarraProgresso } from './barra-progresso';
import { GerarPecaIA, tipoDaAcao } from './gerar-peca-ia';

/**
 * O QUE A PUBLICAÇÃO PEDE, e o que dá para fazer com isso.
 *
 * O classificador do DJEN já lê a publicação e grava a `action` na tarefa. Daqui
 * o card mostra a peça sugerida, o estado da família e um campo para o advogado
 * dizer o que quer. Nada disso adivinha: o catálogo vem do servidor.
 *
 * 🚨 SUGERIR NÃO É MONTAR, e a diferença não é retórica. No OTAIR o card dizia
 * "o réu não reverteu a decisão e o crédito do cliente está exigível", e a
 * sentença mandava apenas cancelar um cartão: quem lesse só a publicação teria
 * montado execução de quantia certa com confiança. Por isso aqui está escrito
 * "a publicação sugere", e quem confirma são os autos, dentro de cada família.
 *
 * 🚨 O BOTÃO SÓ APARECE ONDE HÁ CAMINHO. Botão igual em toda família ensinaria
 * que toda família monta, e a primeira que não montasse pareceria defeito. As
 * que não montam dizem POR QUÊ, com a medida: quantas bases, quantos
 * marcadores, o que falta.
 */
type Familia = {
  acao: string; rotulo: string; skill: string | null;
  estado: 'pronta' | 'triagem' | 'base-sem-preenchedor' | 'sem-base' | 'nao-e-peca';
  porque?: string;
  /* 🚨 o selo do estado não serve a toda família: em embargos a triagem lê a
     DECISÃO e mede o vício, em contrarrazões lê o RECURSO ADVERSO e escolhe
     entre cinco modelos. Quando a família manda o seu, é o dela que vale. */
  selo?: string;
  situacoes?: Situacao[];
};

/* 🚨 A CLASSE ABERTA PODE TER SITUAÇÃO RECONHECIDA, e ignorá-la fazia o card
   responder "sem base, escreva o que a peça tem de dizer" a um despacho que o
   catálogo cobre palavra por palavra (MARTINHO, 22/10/2026). A regra vem da
   API; aqui só se aplica ao recorte que o card já tem — o texto da publicação
   não vai para URL nenhuma, porque leva o nome do cliente dentro. */
type Situacao = {
  nome: string; quando: string; rotulo: string; selo: string;
  porque: string; skill: string; modelo: string; instrucao: string;
};

const semAcento = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

function situacaoDoDespacho(familia: Familia | null, recorte?: string | null): Situacao | null {
  if (!familia?.situacoes?.length || !recorte) return null;
  const alvo = semAcento(recorte);
  for (const s of familia.situacoes) {
    try { if (new RegExp(s.quando, 's').test(alvo)) return s; } catch { /* regex ruim não derruba o card */ }
  }
  return null;
}

const SELO: Record<Familia['estado'], { texto: string; classe: string }> = {
  'pronta': { texto: 'pronta', classe: 'text-emerald-700 dark:text-emerald-400' },
  'triagem': { texto: 'leio os autos e faço a triagem', classe: 'text-sky-700 dark:text-sky-400' },
  'base-sem-preenchedor': { texto: 'base pronta, preenchimento pendente', classe: 'text-amber-700 dark:text-amber-400' },
  'sem-base': { texto: 'sem base', classe: 'text-zinc-500 dark:text-zinc-400' },
  'nao-e-peca': { texto: 'não produz petição', classe: 'text-zinc-500 dark:text-zinc-400' },
};

export function SugestaoDePeca({ caseId, acao, recorte, acaoInicial }: {
  caseId: string;
  acao: string | null;
  recorte?: string | null;
  /* Palpite pelo TÍTULO do card, para o prazo que não veio do DJEN. Vale como
     pré-seleção, nunca como verdade: quem confirma é o advogado no seletor. */
  acaoInicial?: string | null;
}) {
  /* 🚨 PRAZO SEM `action` NÃO É SÓ PRAZO DIGITADO À MÃO — e essa foi a minha
     leitura errada em 22/10/2026. O maior produtor deles é o PRÓPRIO HUB: do
     card de sentença/acórdão o advogado clica, o sistema decide qual recurso
     cabe e cria o prazo no fatal dele (`criarPrazoRecurso`, na agenda). Esse
     prazo copiava recorte e dispositivo, mas não a `action` — então nascia
     mudo, sem redigir e sem montar. Eram 479 dos cumpridos, contra ~110 em
     todas as famílias somadas.
     A origem foi consertada lá (o prazo de recurso já nasce com `action`).
     Este seletor cobre o resto e o passado: prazo digitado no formulário,
     prazo antigo criado antes do conserto, classe que o catálogo ainda não
     tem. Card sem bloco não parece defeito, parece card comum — foi preciso
     ele procurar um recurso recém-feito e não achar onde montar. */
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const qc = useQueryClient();
  const [texto, setTexto] = useState('');
  const [rascunho, setRascunho] = useState('');
  const [avisos, setAvisos] = useState<string[]>([]);

  /* 🚨 O QUE ELE DIGITOU TEM DE SOBREVIVER A FECHAR O CARD. A instrução e o
     rascunho são gravados no processo, mas o card nunca os lia de volta: ele
     reabria em branco e o texto parecia perdido. Aconteceu em 22/10/2026 —
     *"fui refazer, sumiu meu texto"* — e o texto estava no banco o tempo todo. */
  const estadoSalvo = useQuery({
    queryKey: ['peca-estado', caseId],
    queryFn: async () => {
      const { data } = await api.get(`/legal-cases/${caseId}/peca/rascunho`);
      return (data?.data ?? data) as
        { instrucao?: string; rascunho?: string; status?: string; arquivo?: string; pasta?: string };
    },
    staleTime: 30_000,
  });
  const [quandoRascunho, setQuandoRascunho] = useState<string | null>(null);
  const [quemEscreveu, setQuemEscreveu] = useState<string | null>(null);
  const jaCarregou = useRef(false);
  useEffect(() => {
    if (jaCarregou.current || !estadoSalvo.data) return;
    jaCarregou.current = true;
    if (estadoSalvo.data.instrucao) setTexto(estadoSalvo.data.instrucao);
    const avs = (estadoSalvo.data as any).avisos;
    if (Array.isArray(avs) && avs.length) setAvisos(avs);
    if (estadoSalvo.data.rascunho) {
      setRascunho(estadoSalvo.data.rascunho);
      const em = (estadoSalvo.data as any).rascunhoEm;
      if (em) {
        const d = new Date(em);
        setQuandoRascunho(d.toLocaleString('pt-BR',
          { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
      }
      const m = (estadoSalvo.data as any).modelo;
      setQuemEscreveu(m === 'gemini' ? 'Flash' : m === 'claude' ? 'Claude' : null);
    }
    if (estadoSalvo.data.status === 'montada' && estadoSalvo.data.arquivo) {
      setMontada({ arquivo: estadoSalvo.data.arquivo, pasta: estadoSalvo.data.pasta });
    }
  }, [estadoSalvo.data]);
  /* 🚨 FLASH É O PADRÃO (22/10/2026, decisão do escritório). O Claude fica a
     um clique: a troca existe para quando o texto pedir mais cuidado. */
  const [modelo, setModelo] = useState<'claude' | 'gemini'>('gemini');
  const [montando, setMontando] = useState(false);
  const [demorando, setDemorando] = useState(false);
  const [montada, setMontada] = useState<{ arquivo?: string; pasta?: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const { data } = useQuery({
    queryKey: ['pecas', 'familias'],
    queryFn: async (): Promise<Familia[]> => {
      const { data } = await api.get('/legal-cases/pecas/familias');
      return ((data?.data ?? data)?.familias ?? []) as Familia[];
    },
    staleTime: 10 * 60_000,
  });

  /* 🚨 MONTAR É O FIM DA CORRENTE, e ele manda o rascunho COMO ESTÁ na tela:
     se o advogado corrigiu uma palavra, é a corrigida que vira documento. */
  const montar = async (situacaoDoCatalogo?: string) => {
    setMontando(true);
    try {
      /* 🚨 COM MODELO DO CATÁLOGO NÃO VAI RASCUNHO. O corpo nasce do .txt da
         skill, no Mac. Mandar o rascunho junto faria a peça voltar a sair de
         IA justamente onde existe texto pronto e conferido. */
      const corpoOuSituacao = situacaoDoCatalogo
        ? { situacao: situacaoDoCatalogo }
        : { rascunho };
      const { data } = await api.post(`/legal-cases/${caseId}/peca/montar`, corpoOuSituacao);
      const r = (data?.data ?? data) as { ok?: boolean; motivo?: string };
      if (r?.ok === false) { toast.error(r.motivo ?? 'não consegui montar'); return; }
      toast.success('Na fila do Mac. Ele monta no timbrado e entrega na PROTOCOLO.');
      /* 🚨 "NA FILA DO MAC" SOA COMO "O MAC ESTÁ TRABALHANDO", e pode ser que
         não esteja: o vigia roda por launchd, e o launchd pode estar
         desligado. Parado dois minutos, o card diz o que fazer em vez de
         girar para sempre. Foi exatamente o que aconteceu. */
      let voltas = 0;
      setDemorando(false);
      const t = setInterval(async () => {
        if (++voltas === 24) setDemorando(true);
        try {
          const { data: d } = await api.get(`/legal-cases/${caseId}/peca/rascunho`);
          const e = (d?.data ?? d) as { status?: string; arquivo?: string; pasta?: string; erro?: string };
          if (e?.status === 'montada') {
            clearInterval(t); setMontando(false); setDemorando(false);
            setMontada({ arquivo: e.arquivo, pasta: e.pasta });
            // 🚨 O CARD TINHA DE SABER QUE O ANEXO MUDOU. A peça montada SUBSTITUI
            // a anterior nos ANEXOS, com arquivo novo e link novo. A seção de
            // anexos tem consulta própria, que não sabia disso, e seguia mostrando
            // o link da versão passada — clicar dava erro, porque aquele arquivo já
            // não existia. Medido em 22/10/2026, e eu cheguei a culpar o cache do
            // navegador antes de ir ao servidor olhar.
            qc.invalidateQueries({ queryKey: ['activity-anexos'] });
            toast.success('Peça pronta na PROTOCOLO, e nos anexos deste prazo.');
          } else if (e?.status === 'erro') {
            clearInterval(t); setMontando(false); toast.error(e.erro ?? 'a montagem parou');
          }
        } catch { /* seguir tentando */ }
      }, 5000);
      setTimeout(() => { clearInterval(t); setMontando(false); }, 240_000);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'não consegui montar');
      setMontando(false);
    }
  };

  /* `acao` do DJEN manda; não havendo, vale o que ele escolheu; não tendo
     escolhido, o palpite do título. String vazia = "ainda não escolhi". */
  const acaoEfetiva = acao ?? (escolhida !== null ? escolhida : acaoInicial) ?? null;
  const familia = data?.find((f) => f.acao === acaoEfetiva) ?? null;

  /* 🚨 SEM FAMÍLIA, O CARD FICAVA MUDO — e some justamente onde mais serve.
     Medido em 21/10/2026 num prazo de "Manifestar nos autos": o classificador
     emite 26 classes, o catálogo tinha 22, e `manifestacao` era uma das que
     faltavam. Resultado: nem a sugestão nem o CAMPO DE INSTRUÇÃO apareciam na
     peça mais aberta de todas. O serviço da API já dizia a regra certa
     ("guarda mesmo quando a família ainda não monta"); o componente é que
     desistia. Agora, família desconhecida vira aviso + campo, nunca silêncio:
     o catálogo pode envelhecer de novo, e o campo não pode sumir com ele. */
  const desconhecida = !familia;

  /* 🚨 ESTE BOTÃO COMEÇA A PEÇA, não guarda bilhete. Ele guardava o texto e
     dizia "anotado", e o advogado perguntou por que escrever ali se nada
     acontecia. Agora redige o corpo a partir da instrução e do recorte, e
     devolve o rascunho aqui embaixo para ele ler ANTES de virar documento:
     a regra da casa é não inserir texto criado do zero sem o aval dele. */
  const salvar = async () => {
    setSalvando(true);
    try {
      const { data } = await api.post(`/legal-cases/${caseId}/peca/redigir`,
        { acao: acaoEfetiva, instrucao: texto, recorte, modelo });
      const r = (data?.data ?? data) as
        { ok?: boolean; motivo?: string; rascunho?: string; avisos?: string[] };
      if (r?.ok === false) { toast.error(r.motivo ?? 'não consegui redigir'); return; }
      setRascunho(r?.rascunho ?? '');
      setAvisos(r?.avisos ?? []);
      setQuandoRascunho('agora');
      setQuemEscreveu(modelo === 'gemini' ? 'Flash' : 'Claude');
      setSalvo(true);
      /* 🚨 NÃO PROMETA MONTAGEM: este botão só GUARDA o texto. Dizia "entra na
         montagem desta peça" e o advogado perguntou, com razão, se a peça tinha
         começado a ser montada — nada tinha começado. Botão que insinua
         trabalho em curso faz procurar barra de progresso que não existe. */
      toast.success('Redigi o rascunho. Leia abaixo antes de virar documento.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'não consegui redigir');
    } finally { setSalvando(false); }
  };

  const situacao = situacaoDoDespacho(familia, recorte);
  const selo = familia ? SELO[familia.estado] : SELO['sem-base'];
  const seloTexto = desconhecida ? 'classe sem família no catálogo'
    : (situacao?.selo ?? familia!.selo ?? selo.texto);
  const rotulo = situacao?.rotulo ?? familia?.rotulo ?? acaoEfetiva;
  const porque = desconhecida
    ? 'esta classe de publicação ainda não tem família no catálogo de peças. O campo abaixo '
      + 'funciona do mesmo jeito: escreva o que a peça tem de dizer e fica guardado'
    : (situacao?.porque ?? familia!.porque);

  /* reconhecida a situação, o campo nasce escrito: ele CONFERE em vez de digitar.
     Só semeia o que está vazio — nunca por cima do que ele escreveu. */
  useEffect(() => {
    if (!jaCarregou.current) return;
    // 🚨 NUNCA POR CIMA DO QUE ELE ESCREVEU. Ler `texto` aqui não basta: o
    // `setTexto` do que veio do banco é assíncrono, e esta semente lia o campo
    // ainda vazio e escrevia por cima. Em 22/10/2026 isso apagou uma instrução
    // inteira dele e pôs o texto do modelo no lugar — ele achou que tinha
    // errado o prompt, e o erro era meu. A fonte de verdade é o que o SERVIDOR
    // respondeu, não o estado da tela no instante em que o efeito rodou.
    if (estadoSalvo.data?.instrucao?.trim()) return;
    if (situacao && !texto.trim() && !salvo) setTexto(situacao.instrucao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacao?.nome, estadoSalvo.data]);

  /* 🚨 ESTE RETORNO FICA ABAIXO DE TODOS OS HOOKS, e não lá em cima junto do
     cálculo. Eu o escrevi acima do `useEffect` da semente e DEPLOYEI assim em
     22/10/2026: enquanto `acao` era prop fixa dava certo por sorte, mas agora
     a condição depende de ESTADO (`escolhida`), e ao escolher a família o
     número de hooks mudava entre um render e outro. O React aborta o render
     inteiro — e a tela não se mexe, sem erro à vista. Cliquei no seletor três
     vezes achando que o evento é que não chegava. */
  if (!acaoEfetiva) {
    /* Só o que PRODUZ petição. `nao-e-peca` (analisar sentença, acórdão, baixa
       dos autos) na lista faria escolher um caminho que não leva a lugar
       nenhum — e o estado vem do catálogo do servidor, não de lista escrita
       aqui, que envelheceria sozinha. */
    const opcoes = (data ?? []).filter((f) => f.estado !== 'nao-e-peca');
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          <FileText className="h-3.5 w-3.5" /> Montar peça neste prazo
        </p>
        <p className="mt-1 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
          Este prazo não veio de uma publicação, então o sistema não sabe que peça ele pede.
          Escolha a família e o resto funciona igual.
        </p>
        <select
          value=""
          onChange={(e) => setEscolhida(e.target.value || null)}
          className="mt-2 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-[11px]
                     text-zinc-700 outline-none focus:border-zinc-400
                     dark:border-zinc-700 dark:text-zinc-200 dark:focus:border-zinc-500"
        >
          <option value="">que peça é esta?</option>
          {opcoes.map((f) => (
            <option key={f.acao} value={f.acao}>{f.rotulo}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          <FileText className="h-3.5 w-3.5" /> A publicação sugere: {rotulo}
        </p>
        <span className={`shrink-0 text-[10px] font-medium ${selo.classe}`}>{seloTexto}</span>
      </div>

      {recorte && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
          “{recorte.trim().slice(0, 220)}”
        </p>
      )}

      {/* 🚨 HAVENDO MODELO, ELE VEM PRIMEIRO — e a IA deixa de ser o caminho
          natural. O advogado pediu assim depois de ler um rascunho de IA com
          marca [CONFERIR: …] no meio numa peça que o catálogo já resolve:
          "a, liga o modelo do catálogo, chega de erros". */}
      {situacao && (
        <div className="mt-2.5 rounded-md border border-emerald-300/60 bg-emerald-50/60 p-2.5
                        dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
            Modelo do catálogo: {situacao.nome}
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-emerald-900/70 dark:text-emerald-200/60">
            texto pronto e conferido da skill, montado direto no timbrado. Nenhuma IA escreve esta peça.
          </p>
          <button
            onClick={() => montar(situacao.nome)}
            disabled={montando}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-2.5 py-1
                       text-[11px] font-semibold text-white disabled:opacity-50 hover:bg-emerald-800"
          >
            {montando ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {montando ? 'montando…' : 'Montar pelo modelo'}
          </button>
        </div>
      )}

      {familia?.estado !== 'pronta' && porque && (
        <p className="mt-1.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
          {porque}.
        </p>
      )}

      {/* o campo existe em TODA família, inclusive nas que ainda não montam:
          é nas peças abertas que ele mais serve, e guardado ele está lá no dia
          em que a família for ligada */}
      <div className="mt-2.5">
        <textarea
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setSalvo(false); }}
          rows={2}
          placeholder="O que você quer nesta peça? (ex.: ataca pela ausência de ICP; pede só a conversão, sem dano moral)"
          className="w-full resize-y rounded-md border border-zinc-300 bg-transparent px-2.5 py-1.5 text-[11px]
                     leading-4 outline-none placeholder:text-zinc-400 focus:border-zinc-400
                     dark:border-zinc-700 dark:placeholder:text-zinc-600 dark:focus:border-zinc-500"
        />
        {texto.trim() && (
          <div className="mt-1.5 flex items-center gap-2">
          <button
            onClick={salvar}
            disabled={salvando || salvo}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#7C3AED' }}
          >
            {salvando ? <Loader2 className="h-3 w-3 animate-spin" />
              : salvo ? <Check className="h-3 w-3" /> : null}
            {salvo ? 'redigido' : 'Redigir'}
          </button>
          {/* 🚨 QUEM REDIGE SE ESCOLHE, e o padrão é o bom. O Flash fica como
              opção explícita para peça mecânica; foi ele que misturou Autor
              com Exequente, e isso não se descobre relendo o código, só a
              peça. */}
          <select
            value={modelo}
            onChange={(e) => setModelo(e.target.value as 'claude' | 'gemini')}
            title="quem redige o rascunho"
            className="shrink-0 rounded-md border border-zinc-300 bg-transparent px-1.5 py-1 text-[10px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            <option value="gemini">Flash (padrão)</option>
            <option value="claude">Claude (mais caro)</option>
          </select>
          </div>
        )}
      </div>

      {/* 🚨 A BARRA TEM DE ESTAR NO CARD, não só no visor flutuante. Ele
          clicou em montar, viu o aviso no canto da tela e perguntou se ainda
          estava montando: dentro do card, onde ele está olhando, o passo e a
          porcentagem ficam à vista. É a mesma barra do resto do hub, não uma
          segunda. */}
      <div className="mt-2.5"><BarraProgresso caseId={caseId} compacta /></div>

      {rascunho && (
        <div className="mt-2.5 rounded-md border border-zinc-200 dark:border-zinc-800">
          <p className="border-b border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
            Rascunho do corpo — leia e corrija antes de montar
            {/* 🚨 RASCUNHO VELHO PARECE RASCUNHO NOVO. Desde que o card passou a
                restaurar o texto salvo, um rascunho de uma hora atrás reabre
                igualzinho a um recém-escrito — e em 22/10/2026 isso custou uma
                conversa inteira: o advogado viu defeitos já corrigidos e
                concluiu que a ferramenta não tinha mudado. A idade e quem
                escreveu passam a ficar à vista. */}
            {quandoRascunho && (
              <span className="ml-1.5 font-normal text-zinc-400">
                · escrito em {quandoRascunho}{quemEscreveu ? ` pelo ${quemEscreveu}` : ''}
              </span>
            )}
          </p>
          {/* 🚨 EDITÁVEL DE PROPÓSITO: o que vai para o timbrado é o que está
              aqui. Rascunho só de leitura obrigaria a refazer tudo por uma
              palavra trocada, e a palavra trocada é o normal. */}
          <textarea
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            rows={Math.min(18, Math.max(6, rascunho.split('\n').length + 1))}
            className="w-full resize-y bg-transparent px-2.5 py-2 text-[11px] leading-[1.45] text-zinc-700 outline-none dark:text-zinc-300"
          />
          <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-2.5 py-1.5 dark:border-zinc-800">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              monta no timbrado oficial e entrega na pasta PROTOCOLO
            </span>
            <button
              onClick={() => montar()}
              disabled={montando}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {montando && <Loader2 className="h-3 w-3 animate-spin" />}
              {montando ? 'montando…' : 'Montar no timbrado'}
            </button>
          </div>
          {demorando && !montada && (
            <p className="border-t border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              Dois minutos na fila e o Mac não pegou. Ele só trabalha quando o vigia roda:
              no terminal, <span className="font-mono">node ~/frider-protocolo/vigia_triagem.js</span>.
              O pedido continua na fila, não se perdeu.
            </p>
          )}

          {montada && (
            <p className="border-t border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] leading-4 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
              Pronta: <b>{montada.arquivo}</b>
              {montada.pasta ? <> em <span className="font-mono">{montada.pasta}</span></> : null}.
              O PDF saiu do Word, ao lado do .docx.
            </p>
          )}
          {/* 🚨 a lacuna é marca de conferência, não defeito: o redator põe
              [CONFERIR: ...] onde faltou dado, em vez de inventar o fato */}
          {/* 🚨 O QUE A FERRAMENTA CORRIGIU, E O QUE ELA SO PODE AVISAR.
              Letra digitada no pedido e topico de tempestividade em peca
              intermediaria a API conserta sozinha; titulo que nao cabe em uma
              linha e escolha de redacao, e cortar no meio daria portugues
              torto — entao aparece aqui, antes de montar, com o numero
              medido. 22/10/2026. */}
          {!!avisos.length && (
            <ul className="border-t border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-900
                           dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200">
              {avisos.map((a, i) => <li key={i}>· {a}</li>)}
            </ul>
          )}
          {rascunho.includes('[CONFERIR:') && (
            <p className="border-t border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              Há marcas <span className="font-mono">[CONFERIR: …]</span>: são dados que não
              estavam no recorte nem na sua instrução. Resolva antes de protocolar.
            </p>
          )}
        </div>
      )}

      {/* o gerador por IA do hub, para os 3 tipos que o DTO aceita */}
      {acaoEfetiva && tipoDaAcao(acaoEfetiva) && (
        <GerarPecaIA caseId={caseId} acao={acaoEfetiva} instrucao={texto || undefined} />
      )}

      {/* 🚨 o botão só aparece onde HÁ triagem — e é o catálogo do hub que diz
          quais são, não uma lista escrita aqui, que envelheceria sozinha */}
      {familia?.estado === 'triagem' && (
        <TriagemPeca caseId={caseId} acao={familia.acao} rotulo={familia.rotulo} />
      )}
      {familia?.acao === 'replica' && (
        <div className="mt-2.5"><DossieReplica caseId={caseId} sempreVisivel /></div>
      )}
      {familia?.acao === 'cumprimento' && (
        <div className="mt-2.5"><CumprimentoCs caseId={caseId} sempreVisivel /></div>
      )}
    </div>
  );
}
