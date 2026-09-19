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
  const primeiro = (nome ?? '').trim().split(/\s+/)[0] || 'Senhor(a)';
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
  linhas.push(
    'Os honorários são os mesmos do seu contrato: meio a meio. Do que a senhora ' +
      'receber, 50% fica com a senhora e 50% com o escritório. Se não houver ' +
      'recebimento, a senhora não paga nada.',
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
      // Ordena por AJUIZAR primeiro: não se oferta ao cliente o grupo que o
      // próprio plano manda descartar por decadência ou indício fraco.
      const ordenadas = [...comChurning].sort(
        (a, b) =>
          Number(b.veredito === 'AJUIZAR') - Number(a.veredito === 'AJUIZAR') || peso(b) - peso(a),
      );
      const alvo = ordenadas[0];
      if (!alvo) {
        setAchado({ grupo: '', instituicoes: [], indicios: [], dinheiro: null, contratos: 0, outrosGrupos: 0 });
        toast.message('Sem indício de reciclagem de contratos neste HISCON.');
        return;
      }

      // Só os indícios DESTE grupo: o motor marca cada indício com o banco, e as
      // instituições do grupo estão na ação. Sem esse recorte, os 84 indícios do
      // HISCON inteiro entrariam numa oferta sobre um réu só.
      const instituicoes: string[] = alvo.instituicoes ?? [];
      const doGrupo = doChurning.filter((i: any) =>
        (i.bancos ?? []).some((b: string) => instituicoes.includes(b)),
      );
      const usados = doGrupo.length ? doGrupo : doChurning;
      const contratos = new Set(usados.flatMap((i: any) => i.contratos ?? [])).size;

      const a: Achado = {
        grupo: alvo.grupo ?? instituicoes[0] ?? '',
        instituicoes,
        indicios: usados.map((i: any) => ({ id: i.id, titulo: i.titulo, evidencia: i.evidencia })),
        dinheiro: alvo?.dinheiro ?? null,
        contratos,
        outrosGrupos: Math.max(0, comChurning.length - 1),
      };
      setAchado(a);
      setTexto(textoDaOferta(cliente.name, a));
      await legalCasesService.registrarOfertaChurning(caso.id, {
        status: 'analisada',
        resumo: `${a.grupo || 'grupo'}: ${a.indicios.length} indício(s) em ${contratos} contrato(s)`,
        indicios: a.indicios.map((i) => i.id),
      });
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
  const responder = async (status: 'aceita' | 'recusada') => {
    setRegistrando(true);
    try {
      if (status === 'aceita' && achado?.instituicoes?.length) {
        // A lista vive no metadata do caso, é de onde o próprio drawer a lê.
        const atuais: any[] = ((caso.metadata as any)?.contratos ?? []) as any[];
        const jaTem = (reu: string) =>
          atuais.some((c: any) => String(c?.reu ?? '').toUpperCase().trim() === reu.toUpperCase().trim());
        const novas = achado.instituicoes
          .filter((reu) => !jaTem(reu))
          .map((reu, i) => ({
            id: `churn${Date.now().toString(36)}${i}`,
            reu,
            doc: null,
            produto: 'CHURNING',
            valor: null,
            beneficio: /^(AP|PM)\b/.exec(caso.title ?? '')?.[1] ?? null,
          }));
        if (novas.length) {
          await legalCasesService.saveContratos(caso.id, [...atuais, ...novas] as any);
          toast.success(`${novas.length} réu(s) do churning entraram em "Contratos a impugnar"`);
        }
      }
      const r = await legalCasesService.registrarOfertaChurning(caso.id, { status });
      qc.invalidateQueries({ queryKey: ['oferta-churning', caso.id] });
      qc.invalidateQueries({ queryKey: ['legal-cases'] });
      onMudou?.();
      toast.success(r.moveu ? 'Aceita — card movido para Montar inicial' : status === 'aceita' ? 'Aceita registrada' : 'Recusa registrada');
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

      {respondida ? (
        <p className="mt-2 text-[11px] leading-4 text-[#48626f] dark:text-zinc-400">
          {oferta?.status === 'aceita'
            ? 'O cliente aceitou. Os réus entraram em "Contratos a impugnar" e o card foi para "Montar inicial" — confira as linhas e clique em "Gerar iniciais" para os cards nascerem.'
            : 'O cliente recusou. Fica registrado no card; a ação do cartão segue normalmente.'}
        </p>
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
            {enviada && (
              <>
                <button type="button" onClick={() => responder('aceita')} disabled={registrando}
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
                {achado.outrosGrupos > 0 && (
                  <p className="text-[10px] leading-4 text-amber-700 dark:text-amber-400">
                    Outros {achado.outrosGrupos} grupo(s) também têm indício de reciclagem — cada um é
                    uma ação e uma conversa própria.
                  </p>
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
