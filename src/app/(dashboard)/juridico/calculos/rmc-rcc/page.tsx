'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Banknote,
  Building2,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Coins,
  FileDown,
  FileSearch,
  FileText,
  Info,
  Download,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Upload,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import {
  calculadoraRmcService,
  type CalcularRmcInput,
  type CalculoExtraido,
  type Cenario,
  type CenarioId,
  type HiscreContrato,
  type HisconContrato,
  type EntradaCalculadora,
  type PlanoAcao,
  type IndiceCorrecao,
  type ParcelaInput,
  type ResultadoRmc,
} from '@/features/calculadora-rmc/services/calculadora-rmc.service';
import {
  validar as validarAntiexcesso,
  type Ocorrencia as OcorrenciaAntiexcesso,
} from '@/features/calculadora-rmc/antiexcesso/validacao-antiexcesso';
import {
  calculadoraCsService,
  type ResultadoCs as ResultadoCsAvulso,
} from '@/features/calculadora-cs/services/calculadora-cs.service';
import { gerarPdfRmc, gerarPdfCsExecucao } from '@/features/calculadora-rmc/lib/pdf';
import { gerarPdfCs } from '@/features/calculadora-cs/lib/pdf';
import { classificarPdf } from '@/features/calculadora-rmc/lib/classificar-pdf';
import { DropZone } from '@/components/drop-zone';

const brl = (n: number | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);

/** Percentual no padrão do CJ: 2.07 → "2,0700%". */
const pct = (n: number | undefined) => `${(n ?? 0).toFixed(4).replace('.', ',')}%`;

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const labelCls = 'mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400';
const cardCls =
  'rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900';

/** Normaliza um valor monetário pt-BR ("1.212,00", "60,60", "32.06") em número. */
function parseValor(raw: string): number {
  let s = raw.replace(/r\$|\s/gi, '').trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // BR: ponto=milhar, vírgula=decimal
  return parseFloat(s);
}

/** Normaliza data DD/MM/AAAA ou AAAA-MM-DD em AAAA-MM-DD. */
function parseData(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function parseParcelas(texto: string): { parcelas: ParcelaInput[]; erros: string[] } {
  const parcelas: ParcelaInput[] = [];
  const erros: string[] = [];
  texto.split('\n').forEach((linha, i) => {
    const bruto = linha.trim();
    if (!bruto) return;
    // FONTE (trava C1): tudo depois de '#' na linha é o id do documento + página.
    // Ex.: "2022-08-01  183,17  #HISCON id. 12345, p. 4". Sem '#', fonte fica vazia.
    const hashIdx = bruto.indexOf('#');
    const fonte = hashIdx >= 0 ? bruto.slice(hashIdx + 1).trim() : undefined;
    const t = (hashIdx >= 0 ? bruto.slice(0, hashIdx) : bruto).trim();
    const partes = t.split(/[;,\t]|\s{2,}|\s(?=R\$)|\s(?=\d)/).map((p) => p.trim()).filter(Boolean);
    const data = parseData(partes[0] ?? '');
    const valor = parseValor(partes[1] ?? partes[0] ?? '');
    if (!data || isNaN(valor)) {
      erros.push(`Linha ${i + 1}: "${bruto}"`);
      return;
    }
    parcelas.push({ data, valor, fonte });
  });
  return { parcelas, erros };
}

function addMonthsISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, d || 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate(),
  ).padStart(2, '0')}`;
}

/**
 * Parcelas mensais posteriores ao cálculo (tutela NÃO deferida): os descontos
 * continuaram depois da inicial — gera uma parcela por mês, do mês seguinte à
 * última parcela conhecida até a data-base, recalculando o saldo devedor.
 */
function gerarParcelasPosteriores(
  ultimaData: string,
  ateData: string,
  valor: number,
): ParcelaInput[] {
  const out: ParcelaInput[] = [];
  for (let i = 1; i <= 600; i++) {
    const d = addMonthsISO(ultimaData, i);
    if (d > ateData) break;
    out.push({ data: d, valor });
  }
  return out;
}

/** Nº de competências (meses) entre duas datas ISO, mínimo 1. */
function mesesEntre(de: string, ate: string): number {
  const [y1, m1] = de.split('-').map(Number);
  const [y2, m2] = ate.split('-').map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
}

const hoje = new Date().toISOString().slice(0, 10);

const TIPOS = ['RMC', 'RCC'] as const;

/** Resultado da RMC + (opcional) execução só da sucumbência (obrigação de fazer). */
type ResultadoRmcExt = ResultadoRmc & { csSuc?: ResultadoCsAvulso };

export default function CalculadoraRmcPage() {
  // Fase do cálculo: "inicial" = 3 cenários de pedido (página limpa, sem CS);
  // "cs" = cumprimento de sentença (tutela + sucumbência + multa do 523).
  const [fase, setFase] = useState<'inicial' | 'cs'>('inicial');
  const [form, setForm] = useState({
    nomeCalculo: '',
    tipo: 'RMC' as (typeof TIPOS)[number],
    banco: '',
    numeroContrato: '',
    valorEmprestimo: '',
    dataContratacao: '',
    modalidadeConsignado: 'INSS' as 'INSS' | 'PUBLICO',
    taxaConversao: '2.50',
    jurosMora: '0',
    dobro: true,
    modulacaoStj: false,
    indiceCorrecao: 'INPC' as IndiceCorrecao,
    dataBase: hoje,
    proRataDie: false,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Quando aberta a partir de um card (Pré-processual → "Calcular RMC/RCC"),
  // pré-preenche banco/cliente/tipo e habilita "Salvar no processo". Lemos da URL
  // via window (client-only) p/ não exigir Suspense boundary do useSearchParams.
  const [caseId, setCaseId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvouOk, setSalvouOk] = useState(false);
  const [autoLoad, setAutoLoad] = useState<string | null>(null); // status do auto-carregamento do HISCON/HISCRE
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setCaseId(sp.get('case'));
    if (sp.get('fase') === 'cs') {
      setFase('cs');
      setCs((c) => ({ ...c, ativar: true }));
    }
    const banco = sp.get('banco');
    const cliente = sp.get('cliente');
    const tipo = sp.get('tipo');
    setForm((f) => ({
      ...f,
      ...(banco ? { banco } : {}),
      ...(cliente ? { nomeCalculo: cliente } : {}),
      ...(tipo === 'RMC' || tipo === 'RCC' ? { tipo } : {}),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cumprimento de Sentença (opcional) ─────────────────────────────────────
  const [cs, setCs] = useState({
    ativar: false,
    execucao: 'restituicao' as 'restituicao' | 'soSucumbencia',
    baseCenario: 'conversaoDobro' as CenarioId,
    sucPercentual: '10',
    sucBase: 'valorCausa' as 'principal' | 'valorCausa' | 'valorFixado',
    valorCausa: '',
    valorFixado: '',
    atualizarValorCausa: false,
    valorCausaData: '',
    multaMoratoria: false,
    multaHonorarios: false,
  });
  const setCsField = <K extends keyof typeof cs>(k: K, v: (typeof cs)[K]) =>
    setCs((c) => ({ ...c, [k]: v }));

  // Importar sentença (IA) dentro da seção de CS — preenche valor da causa + honorários.
  const csSentRef = useRef<HTMLInputElement>(null);
  const [csSentAviso, setCsSentAviso] = useState<string | null>(null);
  const csSentMut = useMutation({
    mutationFn: (files: File[]) => calculadoraCsService.extrairSentenca(files),
    onSuccess: (r) => {
      const e = r.extracao;
      // Sem condenação líquida (débitos vazios) = obrigação de fazer → a sentença
      // manda executar só a sucumbência; com condenação, restituição + sucumbência.
      const semCondenacao = !!e && !(e.debitos?.length);
      const preenchidos: string[] = [];
      if (e) {
        setCs((c) => ({
          ...c,
          execucao: semCondenacao ? 'soSucumbencia' : 'restituicao',
          sucBase: 'valorCausa',
          valorCausa: e.valorCausa != null ? String(e.valorCausa).replace('.', ',') : c.valorCausa,
          sucPercentual: e.honorarios ? String(e.honorarios.percentual).replace('.', ',') : c.sucPercentual,
          // Data da sentença pré-carrega a correção do valor da causa/honorários.
          valorCausaData: e.dataSentenca ?? c.valorCausaData,
          // Multas do art. 523 NÃO são pré-marcadas pela IA: só incidem depois de
          // esgotado o prazo de 15 dias sem pagamento — decisão do advogado.
        }));
        // Parâmetros do CÁLCULO conforme a sentença: índice, juros, dobro/modulação.
        setForm((f) => ({
          ...f,
          indiceCorrecao:
            e.indiceCorrecao && e.indiceCorrecao !== 'SELIC'
              ? (e.indiceCorrecao as IndiceCorrecao)
              : f.indiceCorrecao,
          jurosMora: e.jurosMora != null ? String(e.jurosMora).replace('.', ',') : f.jurosMora,
          // Dobro/modulação SÓ se a sentença DEFERIU explicitamente (CDC 42 é
          // exceção). Sentença lida = padrão SIMPLES, salvo dobro expresso.
          dobro: e.dobro === true,
          modulacaoStj: e.modulacaoStj === true,
        }));
        if (e.indiceCorrecao && e.indiceCorrecao !== 'SELIC') preenchidos.push(`índice ${e.indiceCorrecao}`);
        if (e.jurosMora != null) preenchidos.push(`juros ${String(e.jurosMora).replace('.', ',')}%`);
        preenchidos.push(e.dobro === true ? 'restituição EM DOBRO' : 'restituição SIMPLES');
        if (e.modulacaoStj === true) preenchidos.push('modulação Tema 929');
        if (e.valorCausa != null) preenchidos.push('valor da causa');
        if (e.honorarios) preenchidos.push(`sucumbência ${e.honorarios.percentual}%`);
        // Tutela: só "deferida" se a sentença AFIRMA que suspendeu os descontos;
        // caso contrário assume que continuaram (estende as parcelas).
        const tutelaDeferida = e.tutelaDeferida === true;
        setTutela((t) => ({ ...t, deferida: tutelaDeferida }));
        preenchidos.push(tutelaDeferida ? 'tutela deferida' : 'tutela NÃO deferida (parcelas estendidas)');
      }
      setCsSentAviso(
        (semCondenacao
          ? 'Sem condenação líquida na sentença → selecionei "Só a sucumbência (obrigação de fazer)". '
          : e
            ? 'Sentença com condenação em dinheiro → "Restituição + sucumbência". '
            : '') +
          (preenchidos.length ? `Preenchi pela sentença: ${preenchidos.join(', ')}. Confira. ` : '') +
          (e?.observacoes ? `IA: ${e.observacoes}` : (r.aviso ?? 'Sentença lida.')),
      );
    },
    onError: (err) => setCsSentAviso((err as Error)?.message ?? 'Erro ao ler a sentença.'),
  });
  const onPickCsSent = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const fs = ev.target.files ? Array.from(ev.target.files) : [];
    ev.target.value = '';
    if (fs.length) {
      // Sentença/inicial = fase de execução: liga o CS sozinho.
      setFase('cs');
      setCs((c) => ({ ...c, ativar: true }));
      setCsSentAviso(null);
      csSentMut.mutate(fs);
    }
  };

  const [parcelasTexto, setParcelasTexto] = useState('');
  const [ger, setGer] = useState({ dataInicial: '', valor: '', meses: '12' });
  const { parcelas, erros } = useMemo(() => parseParcelas(parcelasTexto), [parcelasTexto]);

  // ── Tutela deferida? (suspensão dos descontos) ─────────────────────────────
  // Se NÃO deferida, os descontos continuaram após a inicial: estende as
  // parcelas mês a mês até a data-base, recalculando o saldo devedor.
  const [tutela, setTutela] = useState({ deferida: true, valorMensal: '' });
  const ultimaParcela = useMemo(
    () => (parcelas.length ? parcelas.reduce((a, b) => (a.data > b.data ? a : b)) : null),
    [parcelas],
  );
  const parcelasExtras = useMemo(() => {
    if (fase !== 'cs' || tutela.deferida || !ultimaParcela || !form.dataBase)
      return [] as ParcelaInput[];
    const v = parseValor(tutela.valorMensal);
    const valor = !isNaN(v) && v > 0 ? v : ultimaParcela.valor;
    return gerarParcelasPosteriores(ultimaParcela.data, form.dataBase, valor);
  }, [fase, tutela, ultimaParcela, form.dataBase]);
  // HISCON/HISCRE costumam ser da época da inicial: quantos meses as parcelas
  // estão "atrasadas" em relação à data-base (0 = em dia).
  const defasagemMeses = useMemo(() => {
    if (!ultimaParcela || !form.dataBase || ultimaParcela.data > form.dataBase) return 0;
    return Math.max(0, mesesEntre(ultimaParcela.data, form.dataBase) - 1);
  }, [ultimaParcela, form.dataBase]);
  const mesBr = (iso: string) => iso.slice(0, 7).split('-').reverse().join('/');

  // ── Validação antiexcesso (client-side, imediata) ─────────────────────────
  // MESMO módulo do servidor (fonte única, sincronizada). Dá o feedback na hora
  // para ninguém digitar dez linhas e só depois descobrir. C10 (índice) roda só
  // no servidor (depende da série do BACEN). O erro aqui bloqueia "salvar no
  // processo" — mas o servidor é a autoridade final e revalida na gravação.
  const ocorrenciasLocais = useMemo<OcorrenciaAntiexcesso[]>(() => {
    const todas = [...parcelas, ...parcelasExtras];
    if (!todas.length) return [];
    return validarAntiexcesso({
      contrato: form.dataContratacao || '',
      citacao: form.dataBase || '',
      sentenca: form.dataBase || '',
      eventoDanoso: form.dataBase || '',
      dataBase: form.dataBase || '',
      descontos: todas.map((p) => ({
        competencia: (p.data || '').slice(0, 7),
        valor: p.valor,
        fonte: p.fonte,
      })),
    });
  }, [parcelas, parcelasExtras, form.dataContratacao, form.dataBase]);
  const antiexcessoErros = useMemo(
    () => ocorrenciasLocais.filter((o) => o.severidade === 'erro'),
    [ocorrenciasLocais],
  );
  const antiexcessoAvisos = useMemo(
    () => ocorrenciasLocais.filter((o) => o.severidade === 'aviso'),
    [ocorrenciasLocais],
  );

  const gerarParcelas = () => {
    const di = parseData(ger.dataInicial) ?? ger.dataInicial;
    const v = parseValor(ger.valor);
    const n = parseInt(ger.meses, 10);
    if (!parseData(di) || isNaN(v) || !n) return;
    const linhas: string[] = [];
    for (let i = 0; i < n; i++) {
      linhas.push(`${addMonthsISO(di, i)}\t${v.toFixed(2)}`);
    }
    setParcelasTexto((prev) => (prev.trim() ? prev.trim() + '\n' : '') + linhas.join('\n'));
  };

  // ── Cálculo ──────────────────────────────────────────────────────────────
  const [csInfo, setCsInfo] = useState<{ honFixado: boolean } | null>(null);
  const calc = useMutation({
    mutationFn: async (): Promise<ResultadoRmcExt> => {
      const jm = parseValor(form.jurosMora);
      const payload: CalcularRmcInput = {
        valorEmprestimo: parseValor(form.valorEmprestimo),
        taxaConversao: parseValor(form.taxaConversao),
        jurosMora: isNaN(jm) ? 0 : jm,
        dobro: form.dobro,
        modulacaoStj: form.modulacaoStj,
        indiceCorrecao: form.indiceCorrecao,
        dataBase: form.dataBase,
        dataContratacao: form.dataContratacao || undefined,
        proRataDie: form.proRataDie,
        nomeCalculo: form.nomeCalculo || undefined,
        parcelas: [...parcelas, ...parcelasExtras],
      };
      const csAtivo = fase === 'cs' && cs.ativar;
      setCsInfo({ honFixado: csAtivo && cs.sucBase === 'valorFixado' });
      if (csAtivo && cs.execucao === 'restituicao') {
        const vc = parseValor(cs.valorCausa);
        const vf = parseValor(cs.valorFixado);
        payload.cs = {
          ativar: true,
          baseCenario: cs.baseCenario,
          sucumbencia:
            cs.sucBase === 'valorFixado'
              ? {
                  // valor certo: o motor aplica 100% sobre a "quantia" informada
                  percentual: 100,
                  base: 'valorCausa',
                  valorCausa: isNaN(vf) ? 0 : vf,
                  atualizarValorCausa: cs.atualizarValorCausa,
                  valorCausaData:
                    cs.atualizarValorCausa && cs.valorCausaData ? cs.valorCausaData : undefined,
                }
              : {
                  percentual: parseValor(cs.sucPercentual) || 0,
                  base: cs.sucBase,
                  valorCausa: cs.sucBase === 'valorCausa' && !isNaN(vc) ? vc : undefined,
                  atualizarValorCausa: cs.sucBase === 'valorCausa' ? cs.atualizarValorCausa : undefined,
                  valorCausaData:
                    cs.sucBase === 'valorCausa' && cs.atualizarValorCausa && cs.valorCausaData
                      ? cs.valorCausaData
                      : undefined,
                },
          multaMoratoria523: cs.multaMoratoria,
          honorarios523: cs.multaHonorarios,
        };
      }
      const r = await calculadoraRmcService.calcular(payload);
      // Obrigação de fazer: a restituição vira abatimento no recálculo — o que se
      // executa em dinheiro são só os honorários. Calculamos a execução à parte
      // (motor de atualização de débitos), com os honorários como principal.
      if (csAtivo && cs.execucao === 'soSucumbencia') {
        const pctSuc = parseValor(cs.sucPercentual) || 0;
        const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
        // "Sobre a condenação" = restituição (+ danos) do cenário escolhido,
        // que a própria calculadora acabou de apurar — já atualizada até a data-base.
        const cenBase = r.cenarios.find((c) => c.id === cs.baseCenario) ?? r.cenarios[0];
        const condenacao = cenBase ? cenBase.resumo.restituicao + cenBase.resumo.danosMorais : 0;
        const vc = parseValor(cs.valorCausa) || 0;
        const valor =
          cs.sucBase === 'valorFixado'
            ? parseValor(cs.valorFixado) || 0
            : cs.sucBase === 'principal'
              ? round2((pctSuc / 100) * condenacao)
              : round2((pctSuc / 100) * vc);
        if (valor > 0) {
          const csSuc = await calculadoraCsService.calcular({
            indiceCorrecao: form.indiceCorrecao,
            termoFinal: form.dataBase,
            proRataDie: form.proRataDie,
            jurosMora: 0,
            jurosInicial: 'vencimento',
            multaMoratoria523: cs.multaMoratoria,
            honorarios523: cs.multaHonorarios,
            debitos: [
              {
                descricao:
                  cs.sucBase === 'valorFixado'
                    ? 'Honorários sucumbenciais fixados'
                    : cs.sucBase === 'principal'
                      ? `Honorários sucumbenciais (${cs.sucPercentual}% sobre a condenação de ${condenacao.toFixed(2).replace('.', ',')})`
                      : `Honorários sucumbenciais (${cs.sucPercentual}% sobre o valor da causa)`,
                data:
                  // condenação já vem atualizada até a data-base (sem nova correção)
                  cs.sucBase !== 'principal' && cs.atualizarValorCausa && cs.valorCausaData
                    ? cs.valorCausaData
                    : form.dataBase,
                valor,
              },
            ],
          });
          return { ...r, csSuc };
        }
      }
      return r;
    },
  });

  // ── Taxa BACEN ───────────────────────────────────────────────────────────
  const [taxaInfo, setTaxaInfo] = useState<string | null>(null);
  const taxaMut = useMutation({
    mutationFn: () =>
      calculadoraRmcService.buscarTaxaConsignado(form.dataContratacao, form.modalidadeConsignado),
    onSuccess: (r) => {
      if (r.taxa != null) {
        set('taxaConversao', String(r.taxa).replace('.', ','));
        const modLabel = form.modalidadeConsignado === 'INSS' ? 'INSS' : 'setor público';
        const mesLabel = r.mes ? r.mes.split('-').reverse().join('/') : '';
        setTaxaInfo(`Taxa média do consignado ${modLabel} em ${mesLabel}: ${r.taxa}% a.m. (BACEN). Ajuste se quiser.`);
      } else {
        setTaxaInfo(r.mensagem ?? 'Sem taxa do BACEN para essa data.');
      }
    },
    onError: (e) => setTaxaInfo((e as Error)?.message ?? 'Erro ao buscar a taxa.'),
  });

  // Aplica a taxa de conversão automaticamente: assim que há data de
  // contratação (ou muda a modalidade), busca a taxa média do BACEN da época.
  // Exceção: quando a taxa veio do cálculo da inicial (taxaAutoSkip), ela é a
  // da sentença e não pode ser sobrescrita.
  useEffect(() => {
    if (taxaAutoSkip.current) {
      taxaAutoSkip.current = false;
      return;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(form.dataContratacao)) {
      taxaMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dataContratacao, form.modalidadeConsignado]);

  // ── HISCON: metadados do contrato (nº, datas, valores) ────────────────────
  const hisconRef = useRef<HTMLInputElement>(null);
  const [hisconContratos, setHisconContratos] = useState<HisconContrato[] | null>(null);
  const [hisconSel, setHisconSel] = useState<HisconContrato | null>(null);
  const [hisconAviso, setHisconAviso] = useState<string | null>(null);
  const [hisconEntradas, setHisconEntradas] = useState<EntradaCalculadora[] | null>(null);
  const [hisconPlano, setHisconPlano] = useState<PlanoAcao | null>(null);
  const [hisconAvisos, setHisconAvisos] = useState<string[]>([]);

  const aplicarHiscon = (c: HisconContrato) => {
    setHisconSel(c);
    if (c.tipo === 'RMC' || c.tipo === 'RCC') set('tipo', c.tipo);
    if (c.banco) set('banco', c.banco);
    if (c.contrato) set('numeroContrato', c.contrato);
    if (c.valorEmprestimo != null)
      set('valorEmprestimo', c.valorEmprestimo.toFixed(2).replace('.', ','));
    const dataContrato = c.dataContratacao ?? c.dataInclusao;
    if (dataContrato) set('dataContratacao', dataContrato);
    if (!form.nomeCalculo) {
      const nome = [c.tipo, c.banco].filter(Boolean).join(' - ');
      if (nome) set('nomeCalculo', nome);
    }
    // Quando a leitura foi pela geometria do PDF, o próprio HISCON traz os
    // descontos mês a mês (tabela "Descontos de Cartão") — e aí o HISCRE não é
    // mais necessário para montar as parcelas.
    const entrada = hisconEntradas?.find((x) => x.contrato === c.contrato && x.tipo === c.tipo);
    if (entrada && entrada.parcelas.length) {
      setParcelasTexto(entrada.parcelas.map((p) => `${p.data}\t${p.valor.toFixed(2)}`).join('\n'));
      const pend = entrada.faltando.filter((f) => !f.startsWith('taxa de conversão'));
      setHisconAviso(
        `Contrato carregado com ${entrada.competencias} competências do próprio HISCON ` +
          `(${brl(entrada.totalDescontado)} descontados) — não precisa do HISCRE.` +
          (entrada.taxaConsultarEm ? ` Buscar a taxa do consignado em ${entrada.taxaConsultarEm}.` : '') +
          (pend.length ? ` Pendências: ${pend.join('; ')}.` : ''),
      );
      return;
    }
    // Sem os descontos: pré-carrega o gerador com a margem reservada.
    const inicio = c.dataInclusao ?? c.dataContratacao;
    if (inicio && c.valorReservado != null) {
      const n = c.parcelasQtd && c.parcelasQtd > 0 ? c.parcelasQtd : mesesEntre(inicio, form.dataBase);
      setGer({ dataInicial: inicio, valor: c.valorReservado.toFixed(2).replace('.', ','), meses: String(n) });
    }
    setHisconAviso(
      'Contrato carregado. Importe o HISCRE para os descontos reais — ou clique em "Gerar" para usar a margem reservada.',
    );
  };

  const hisconMut = useMutation({
    mutationFn: (file: File) => calculadoraRmcService.extrairHiscon(file),
    onSuccess: (r) => {
      setHisconEntradas(r.entradasCalculadora ?? null);
      setHisconPlano(r.planoAcao ?? null);
      setHisconAvisos(r.avisos ?? []);
      const cs = r.contratos ?? [];
      const rmcRcc = cs.filter((c) => c.tipo === 'RMC' || c.tipo === 'RCC');
      const lista = rmcRcc.length ? rmcRcc : cs;
      setHisconContratos(lista);
      if (lista.length === 1) {
        aplicarHiscon(lista[0]);
      } else if (lista.length > 1) {
        setHisconAviso(`${lista.length} contratos encontrados no HISCON — escolha qual usar:`);
      } else {
        setHisconAviso(r.aviso ?? 'Nenhum contrato identificado no HISCON.');
      }
    },
    onError: (e) => {
      setHisconContratos(null);
      setHisconEntradas(null);
      setHisconPlano(null);
      setHisconAvisos([]);
      setHisconAviso((e as Error)?.message ?? 'Erro ao processar o HISCON.');
    },
  });

  const onPickHiscon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      setHisconAviso(null);
      hisconMut.mutate(file);
    }
  };

  // ── HISCRE: descontos reais por mês ───────────────────────────────────────
  const hiscreRef = useRef<HTMLInputElement>(null);
  const [hiscreContratos, setHiscreContratos] = useState<HiscreContrato[] | null>(null);
  const [hiscreAviso, setHiscreAviso] = useState<string | null>(null);

  const aplicarHiscre = (c: HiscreContrato) => {
    const linhas = c.parcelas.map((p) => `${p.data}\t${p.valor.toFixed(2)}`).join('\n');
    setParcelasTexto(linhas);
    if (c.tipo === 'RMC' || c.tipo === 'RCC') set('tipo', c.tipo);
    if (!form.nomeCalculo) {
      const nome = [c.tipo, c.banco].filter(Boolean).join(' - ');
      if (nome) set('nomeCalculo', nome);
    }
    setHiscreContratos(null);
    setHiscreAviso(`${c.parcelas.length} parcela(s) importada(s) do HISCRE (${c.tipo}).`);
  };

  const hiscreMut = useMutation({
    mutationFn: (file: File) => calculadoraRmcService.extrairHiscre(file),
    onSuccess: (r) => {
      const cs = r.contratos ?? [];
      // Se já escolhemos um tipo no HISCON, tenta casar automaticamente.
      const match = cs.filter((c) => c.tipo === form.tipo);
      if (match.length === 1) {
        aplicarHiscre(match[0]);
      } else if (cs.length === 1) {
        aplicarHiscre(cs[0]);
      } else if (cs.length > 1) {
        setHiscreContratos(cs);
        setHiscreAviso(`${cs.length} blocos de descontos encontrados — escolha qual usar:`);
      } else {
        setHiscreContratos(null);
        setHiscreAviso(r.aviso ?? 'Nenhum desconto de RMC/RCC encontrado no extrato.');
      }
    },
    onError: (e) => {
      setHiscreContratos(null);
      setHiscreAviso((e as Error)?.message ?? 'Erro ao processar o HISCRE.');
    },
  });

  const onPickHiscre = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      setHiscreAviso(null);
      hiscreMut.mutate(file);
    }
  };

  // ── Cálculo da inicial (PDF do próprio relatório da calculadora) ──────────
  // Na execução, reaproveita as parcelas e os dados do contrato do cálculo que
  // instruiu a inicial — sem re-upar o HISCRE. A data-base fica a ATUAL (a
  // execução atualiza até hoje); a original só aparece no aviso.
  const calcPdfRef = useRef<HTMLInputElement>(null);
  const [calcPdfAviso, setCalcPdfAviso] = useState<string | null>(null);
  // Trava um ciclo do auto-preenchimento da taxa BACEN: a taxa extraída do
  // cálculo original é a da sentença — não pode ser sobrescrita pela média.
  const taxaAutoSkip = useRef(false);
  // opts.execucao=true (fase CS): o cálculo é a peça da INICIAL (feita com dobro
  // pedido) — NÃO deixa ele ditar dobro/índice, que valem só a SENTENÇA.
  const aplicarCalculo = (c: CalculoExtraido, opts?: { execucao?: boolean }) => {
    const preenchidos: string[] = [];
    if (c.parcelas.length) {
      setParcelasTexto(c.parcelas.map((p) => `${p.data}\t${p.valor.toFixed(2)}`).join('\n'));
      preenchidos.push(`${c.parcelas.length} parcela(s)`);
    }
    if (c.tipo === 'RMC' || c.tipo === 'RCC') set('tipo', c.tipo);
    if (c.banco) { set('banco', c.banco); preenchidos.push('banco'); }
    if (c.contrato) set('numeroContrato', c.contrato);
    if (c.valorEmprestimo != null) {
      set('valorEmprestimo', c.valorEmprestimo.toFixed(2).replace('.', ','));
      preenchidos.push('valor do empréstimo');
    }
    if (c.taxaConversao != null) {
      set('taxaConversao', String(c.taxaConversao).replace('.', ','));
      preenchidos.push(`taxa ${String(c.taxaConversao).replace('.', ',')}%`);
      if (c.dataContratacao) taxaAutoSkip.current = true;
    }
    if (c.dataContratacao) set('dataContratacao', c.dataContratacao);
    // Índice/dobro: na execução vêm da SENTENÇA, não do cálculo (que reflete o
    // que foi PEDIDO na inicial). Só aplica do cálculo fora da fase de execução.
    if (!opts?.execucao) {
      if (c.indiceCorrecao && ['INPC', 'IPCA-E', 'IPCA', 'IGP-M'].includes(c.indiceCorrecao)) {
        set('indiceCorrecao', c.indiceCorrecao as IndiceCorrecao);
        preenchidos.push(`índice ${c.indiceCorrecao}`);
      }
      if (c.dobro != null) set('dobro', c.dobro);
    }
    if (!form.nomeCalculo) {
      const nome = [c.tipo, c.banco].filter(Boolean).join(' - ');
      if (nome) set('nomeCalculo', nome);
    }
    const dataBr = (iso: string) => iso.split('-').reverse().join('/');
    setCalcPdfAviso(
      `Cálculo da inicial importado (${preenchidos.join(', ')}).` +
        (c.dataBase
          ? ` Data-base original: ${dataBr(c.dataBase)} — mantive a data-base ATUAL para a execução; as parcelas param lá, então confira o card "Tutela deferida?".`
          : ' Confira o card "Tutela deferida?" — as parcelas param na época da inicial.') +
        (c.observacoes ? ` IA: ${c.observacoes}` : ''),
    );
  };

  const calcPdfMut = useMutation({
    mutationFn: (file: File) => calculadoraRmcService.extrairCalculo(file),
    onSuccess: (r) => {
      if (r.calculo?.parcelas?.length) {
        // O cálculo é a peça da inicial → não deixa ditar dobro/índice (execução).
        aplicarCalculo(r.calculo, { execucao: true });
      } else {
        setCalcPdfAviso(r.aviso ?? 'Não identifiquei um cálculo de RMC/RCC nesse PDF.');
      }
    },
    onError: (e) => setCalcPdfAviso((e as Error)?.message ?? 'Erro ao processar o cálculo.'),
  });

  const onPickCalcPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      // O cálculo da inicial só existe depois do protocolo = execução.
      setFase('cs');
      setCs((c) => ({ ...c, ativar: true }));
      setCalcPdfAviso(null);
      calcPdfMut.mutate(file);
    }
  };

  // ── Área única: solta tudo (HISCON, HISCRE, sentença, inicial) de uma vez ──
  // Classifica cada PDF no navegador (pdfjs + regex, sem custo de IA) e manda
  // cada um pro extrator certo. Sentença/inicial mudam a fase p/ CS sozinhas.
  const loteRef = useRef<HTMLInputElement>(null);
  const [loteBusy, setLoteBusy] = useState(false);
  const [loteAviso, setLoteAviso] = useState<string | null>(null);
  const importarLote = async (files: File[]) => {
    if (!files.length) return;
    setLoteBusy(true);
    setLoteAviso(`Identificando ${files.length} documento(s)…`);
    try {
      const cls = await Promise.all(files.map((f) => classificarPdf(f)));
      const idx = (tipo: string) => cls.map((c, i) => (c.tipo === tipo ? i : -1)).filter((i) => i >= 0);
      const hisconIdx = idx('hiscon');
      const hiscreIdx = idx('hiscre');
      // A execução é ditada pela SENTENÇA/acórdão. A inicial NÃO entra na extração
      // (ela PEDE dobro/danos — poluía a leitura, marcando dobro e virando "condenação").
      // Só usamos a inicial p/ extrair se não houver nenhuma sentença no lote.
      const sentIdx = idx('sentenca');
      const iniIdx = idx('inicial');
      // PDFs ilegíveis pelo pdfjs (peças do TJ) viram candidatos a sentença: o
      // servidor lê e devolve vazio se não for.
      const ilegivelIdx = cls.map((c, i) => (c.via === 'ilegivel' ? i : -1)).filter((i) => i >= 0);
      // Os PARÂMETROS da execução (dobro, tutela, condenação) vêm SÓ da sentença
      // (ou de um candidato ilegível). A INICIAL nunca entra — ela PEDE dobro/danos
      // e induziria valores errados. Se só houver inicial, avisamos que falta a sentença.
      const extrairIdx = sentIdx.length ? sentIdx : ilegivelIdx;
      const calculoIdx = idx('calculo');
      const desconhecidos = cls
        .map((c, i) => (c.tipo === 'desconhecido' && c.via !== 'ilegivel' ? i : -1))
        .filter((i) => i >= 0)
        .map((i) => cls[i].nome);

      // Resumo do que foi identificado (mostra se foi pelo conteúdo ou pelo nome).
      const rotulo = (tipo: string) =>
        ({ hiscon: 'HISCON', hiscre: 'HISCRE', sentenca: 'sentença', inicial: 'inicial', calculo: 'cálculo' } as Record<string, string>)[tipo] ?? tipo;
      const idDoc = (i: number) =>
        `${rotulo(cls[i].tipo)}${cls[i].via === 'nome' ? ' (pelo nome)' : ''}: ${cls[i].nome}`;

      const partes: string[] = [];
      // FASE 1 — contrato + parcelas (HISCON, HISCRE, cálculo). Rodam juntas.
      const jobs1: Promise<unknown>[] = [];
      let extraiuSentenca = false;
      if (hisconIdx.length) {
        partes.push(idDoc(hisconIdx[0]));
        setHisconAviso(null);
        jobs1.push(hisconMut.mutateAsync(files[hisconIdx[0]]));
      }
      if (hiscreIdx.length) {
        partes.push(idDoc(hiscreIdx[0]));
        setHiscreAviso(null);
        jobs1.push(hiscreMut.mutateAsync(files[hiscreIdx[0]]));
      }
      if (calculoIdx.length) {
        partes.push(idDoc(calculoIdx[0]) + (calculoIdx.length > 1 ? ` (+${calculoIdx.length - 1} outro cálculo ignorado)` : ''));
        setFase('cs');
        setCs((c) => ({ ...c, ativar: true }));
        setCalcPdfAviso(null);
        jobs1.push(calcPdfMut.mutateAsync(files[calculoIdx[0]]));
      }
      // A inicial NÃO entra na extração dos parâmetros (ela pede dobro/danos).
      if (iniIdx.length) {
        partes.push(
          extrairIdx.length
            ? `inicial ignorada na extração (${cls[iniIdx[0]].nome}) — a sentença manda`
            : `inicial recebida (${cls[iniIdx[0]].nome}), mas dobro/tutela/condenação vêm da SENTENÇA — suba a sentença`,
        );
      }
      if (extrairIdx.length) {
        const ehIlegivel = extrairIdx === ilegivelIdx;
        partes.push(
          ehIlegivel
            ? extrairIdx.map((i) => `possível sentença (ilegível no navegador — lendo no servidor): ${cls[i].nome}`).join(' + ')
            : extrairIdx.map((i) => idDoc(i)).join(' + '),
        );
      }
      const faltaSentenca = !extrairIdx.length && (iniIdx.length > 0 || calculoIdx.length > 0);
      setLoteAviso(
        partes.length
          ? `Identifiquei — ${partes.join(' · ')}. Lendo com a IA…`
          : `Nenhum documento reconhecido (${files.length} PDF). Nomeie os arquivos (ex.: "sentença.pdf", "HISCRE.pdf") ou use "Prefere enviar um por um?".`,
      );
      const resultados1 = await Promise.allSettled(jobs1);
      // FASE 2 — a SENTENÇA por ÚLTIMO, para os parâmetros de execução (dobro,
      // tutela, índice, juros, sucumbência) ganharem de qualquer valor do cálculo.
      const resultados2: PromiseSettledResult<unknown>[] = [];
      if (extrairIdx.length) {
        extraiuSentenca = true;
        setFase('cs');
        setCs((c) => ({ ...c, ativar: true }));
        setCsSentAviso(null);
        resultados2.push(...(await Promise.allSettled([csSentMut.mutateAsync(extrairIdx.map((i) => files[i]))])));
      }
      const houveFalha = [...resultados1, ...resultados2].some((r) => r.status === 'rejected');
      const avisos: string[] = [];
      if (partes.length) avisos.push(`Documentos: ${partes.join(' · ')}.`);
      if (extraiuSentenca && houveFalha)
        avisos.push('⚠️ Falhei ao ler a sentença com a IA — confira o aviso na seção de Cumprimento de Sentença.');
      if (faltaSentenca)
        avisos.push('⚠️ Não recebi a SENTENÇA — dobro, tutela e condenação vêm dela. Suba a sentença ou ajuste esses campos na mão.');
      if (desconhecidos.length)
        avisos.push(`Não reconheci: ${desconhecidos.join(', ')} — renomeie ou envie um por um.`);
      setLoteAviso(avisos.join(' ') || 'Nada importado.');
    } catch (err) {
      setLoteAviso((err as Error)?.message ?? 'Erro ao processar os documentos.');
    } finally {
      setLoteBusy(false);
    }
  };
  const onPickLote = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    importarLote(fs);
  };
  // Envio um por um fica RECOLHIDO — a área única acima é o caminho padrão
  // (evita a redundância de vários botões de upload na tela).
  const [envioEspecifico, setEnvioEspecifico] = useState(false);

  // Auto-carrega o HISCON/HISCRE que JÁ foram upados no card — evita re-upar. Quando
  // aberta pelo card (?case=), busca os arquivos guardados (metadata.docs), extrai e
  // aplica o contrato do produto pedido (?tipo). Roda uma vez no mount.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const cid = sp.get('case');
    const want = (sp.get('tipo') || '').toUpperCase();
    if (!cid) return;
    const keyToFile = async (storageKey: string, name: string): Promise<File> => {
      const { data } = await api.get(`/uploads/${storageKey}`, { responseType: 'blob' });
      return new File([data], name, { type: 'application/pdf' });
    };
    (async () => {
      try {
        const caso: any = await legalCasesService.get(cid);
        const docs = ((caso?.metadata as any)?.docs ?? {}) as { hiscon?: string; hiscre?: string };
        if (!docs.hiscon && !docs.hiscre) return;
        setAutoLoad('Carregando HISCON/HISCRE do processo…');
        if (docs.hiscon) {
          const r = await calculadoraRmcService.extrairHiscon(await keyToFile(docs.hiscon, 'HISCON.pdf'));
          const cs = (r.contratos ?? []).filter((c) => c.tipo === 'RMC' || c.tipo === 'RCC');
          const pick = cs.find((c) => c.tipo === want) ?? cs[0];
          if (pick) aplicarHiscon(pick);
          else if (cs.length) setHisconContratos(cs);
        }
        if (docs.hiscre) {
          const r = await calculadoraRmcService.extrairHiscre(await keyToFile(docs.hiscre, 'HISCRE.pdf'));
          const cs = r.contratos ?? [];
          const pick = cs.find((c) => c.tipo === want) ?? cs[0];
          if (pick) aplicarHiscre(pick);
          else if (cs.length) setHiscreContratos(cs);
        }
      } catch { /* sem docs guardados / falha → usuário upa manual */ }
      finally { setAutoLoad(null); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const podeCalcular =
    parseValor(form.valorEmprestimo) > 0 &&
    parseValor(form.taxaConversao) > 0 &&
    parcelas.length > 0;
  const res = calc.data;

  // Cenário ativo na visualização da tabela
  const [cenarioAtivo, setCenarioAtivo] = useState<CenarioId>('conversaoDobro');
  const cenarios = res?.cenarios ?? [];
  const cenarioView = cenarios.find((c) => c.id === cenarioAtivo) ?? cenarios[0];

  // ── Baixar um cenário em PDF (relatório no formato do escritório, à la CJ) ──
  const baixarCenario = (c: Cenario) => {
    if (!res) return;
    const cfg = res.config;
    const tipo = form.tipo;
    const nome = form.nomeCalculo || [tipo, form.banco].filter(Boolean).join(' - ') || 'Cálculo RMC/RCC';
    const esc = (s: string) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dataBr = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '—');
    const taxa = pct(cfg.taxaConversao);
    const jmora = pct(cfg.jurosMora);
    const gerado = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

    const kv = (k: string, v: string, cls = '') =>
      `<div class="kv ${cls}"><span>${k}</span><span>${v}</span></div>`;
    const dados =
      kv('Nome do cálculo', esc(nome)) +
      kv('Tipo de contrato', tipo === 'RMC' ? 'RMC — Reserva de Margem Consignável' : 'RCC — Cartão de Crédito Consignado') +
      kv('Banco', esc(form.banco || '—')) +
      kv('Nº do contrato', esc(form.numeroContrato || '—')) +
      kv('Valor do empréstimo', brl(cfg.valorEmprestimo)) +
      kv('Data de obtenção do empréstimo', dataBr(form.dataContratacao)) +
      kv('Taxa de conversão (a.m.)', taxa) +
      kv('Juros de mora (a.m.)', jmora) +
      kv('Índice de correção', cfg.indiceCorrecao) +
      kv('Pro rata die', cfg.proRataDie ? 'Sim' : 'Não') +
      kv('Restituir em dobro (CDC 42)', cfg.dobro ? 'Sim' : 'Não') +
      kv('Modulação STJ (Tema 929)', cfg.modulacaoStj ? 'Sim' : 'Não') +
      kv('Data-base do cálculo', dataBr(cfg.dataBase));

    const resultado =
      kv('Saldo da conversão em empréstimo consignado', brl(c.resumo.saldoConversao)) +
      kv('Restituição de Valores', brl(c.resumo.restituicao)) +
      kv('Total', brl(c.resumo.total), 'total');

    const cols = [
      'Nº', 'Data', `Valor ${tipo} debitado`, 'Saldo devedor anterior (base juros)',
      'Taxa de juros', 'Valor dos juros mensais', '(-) Amortização', '(+) Outros Saques',
      'Saldo devedor atual', 'Valor a restituir', 'Correção Monetária', 'Juros',
      'Valor atualizado a restituir',
    ];
    const head = `<tr>${cols.map((h) => `<th>${h}</th>`).join('')}</tr>`;
    const body = c.linhas
      .map(
        (l) => `<tr class="${l.valorRestituir > 0 ? 'r' : ''}">` +
          `<td>${l.numero}</td><td class="l">${dataBr(l.data)}</td>` +
          `<td>${brl(l.valorDebitado)}</td><td>${brl(l.saldoAnterior)}</td>` +
          `<td>${taxa}</td><td>${brl(l.juros)}</td><td>${brl(l.amortizacao)}</td>` +
          `<td>${brl(l.saque)}</td><td>${brl(l.saldoAtual)}</td>` +
          `<td>${l.valorRestituir ? brl(l.valorRestituir) : 'R$ 0,00'}</td>` +
          `<td>${l.fatorCorrecao.toFixed(6).replace('.', ',')}</td>` +
          `<td>${l.valorRestituir ? pct(l.jurosMoraPct * 100) : '0,0000%'}</td>` +
          `<td>${l.valorAtualizado ? brl(l.valorAtualizado) : 'R$ 0,00'}</td></tr>`,
      )
      .join('');

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(nome)} — ${esc(c.titulo)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:26px 30px;font-size:11px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:10px;margin-bottom:16px}
  .brand{font-size:16px;font-weight:800;color:#1d4ed8;letter-spacing:.02em}
  .brand small{display:block;font-size:8.5px;font-weight:600;color:#6b7280;letter-spacing:.18em;margin-top:2px}
  .meta{text-align:right;font-size:9px;color:#9ca3af;line-height:1.5}
  h1{font-size:14px;margin:0 0 4px;color:#111827}
  .sub{font-size:10px;color:#6b7280;margin:0 0 16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
  .sec{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;break-inside:avoid}
  .sec>h2{font-size:10.5px;margin:0;padding:7px 11px;background:#eef2f7;color:#374151;border-bottom:1px solid #e5e7eb;text-transform:uppercase;letter-spacing:.04em}
  .kv{display:flex;justify-content:space-between;gap:12px;padding:5px 11px;font-size:10px}
  .kv:nth-child(even){background:#f8fafc}
  .kv span:first-child{color:#6b7280}
  .kv span:last-child{font-weight:700;text-align:right}
  .res .kv.total{background:#eff6ff;border-top:1px solid #dbeafe}
  .res .kv.total span{color:#1d4ed8;font-size:12px}
  table{width:100%;border-collapse:collapse;font-size:7.6px;margin-top:4px}
  thead{display:table-header-group}
  th{background:#eef2f7;color:#374151;font-weight:700;padding:5px 3px;border-bottom:1px solid #cbd5e1;text-align:right;vertical-align:bottom;line-height:1.15}
  td{padding:3px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap}
  th:first-child,td:first-child,.l{text-align:left}
  tr.r td{background:#ecfdf5}
  .secfull{margin-top:14px;border:none;border-radius:0;overflow:visible;break-inside:auto}
  .secfull>h2{border:1px solid #e5e7eb;border-bottom:none;border-radius:8px 8px 0 0}
  .foot{margin-top:18px;padding-top:8px;border-top:1px solid #e5e7eb;text-align:center;font-size:9px;color:#9ca3af}
  @page{size:A4 portrait;margin:12mm}
  @media print{body{padding:0}}
</style></head>
<body>
  <div class="head">
    <div class="brand">FRIDER ANDRADE<small>ADVOGADOS</small></div>
    <div class="meta">Relatório gerado em ${gerado}<br>Revisão de RMC / RCC</div>
  </div>
  <h1>Cálculo de Revisão da RMC (Reserva de Margem Consignável) /<br>RCC (Cartão de Crédito Consignado de Benefício)</h1>
  <p class="sub">Método: ${esc(METODO_LABEL[c.id])}</p>
  <div class="grid">
    <div class="sec"><h2>Dados do contrato</h2>${dados}</div>
    <div class="sec res"><h2>Resultado — ${esc(c.titulo)}</h2>${resultado}</div>
  </div>
  <div class="sec secfull"><h2>Evolução do Saldo Devedor</h2>
    <table><thead>${head}</thead><tbody>${body}</tbody></table>
  </div>
  <div class="foot">Frider Andrade | Advogados · cálculo gerado eletronicamente · ${gerado}</div>
  <scrip` + `t>window.onload=function(){window.focus();window.print();};window.onafterprint=function(){window.close();};</scrip` + `t>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      alert('Permita pop-ups para gerar o PDF (depois é só escolher "Salvar como PDF").');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
      <div className="w-full px-4 py-6 lg:px-6">
        <Link
          href="/juridico/calculos"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Calculadoras
        </Link>
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
              Revisão de RMC / RCC
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Conversão em empréstimo + restituição (CDC 42) · índices do BACEN · 3 cenários de pedido
            </p>
          </div>
        </header>

        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* ── Coluna de entrada ─────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Fase do cálculo */}
            <div className={cardCls}>
              <label className={labelCls}>Fase do cálculo</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFase('inicial')}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${fase === 'inicial' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-300' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}
                >
                  Cálculo da inicial
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFase('cs');
                    setCs((c) => ({ ...c, ativar: true }));
                  }}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${fase === 'cs' ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-300' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}
                >
                  Cumprimento de sentença
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-tight text-zinc-400">
                {fase === 'inicial'
                  ? 'Os 3 cenários de pedido para a petição inicial (HISCON/HISCRE atuais).'
                  : 'Execução: cálculo da inicial (ou HISCON/HISCRE da época) + tutela + sucumbência + multa do art. 523.'}
              </p>
            </div>

            {/* Importar documentos (área única + HISCON/HISCRE específicos) */}
            <div className={cardCls}>
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <FileSearch className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Importar documentos
              </h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                {fase === 'inicial' ? (
                  <>
                    Solte o <b>HISCON</b> (contrato) e o <b>HISCRE</b> (descontos) juntos — eu
                    identifico cada um e preencho o contrato e as parcelas.
                  </>
                ) : (
                  <>
                    Solte <b>tudo de uma vez</b> — HISCON, HISCRE, <b>sentença</b>, inicial,
                    cálculo da inicial. Eu identifico cada um e preencho a execução inteira:
                    índice, juros, dobro/simples, tutela, valor da causa e sucumbência conforme a
                    sentença.
                  </>
                )}
              </p>

              {/* Área única */}
              <input ref={loteRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={onPickLote} />
              <DropZone accept="application/pdf,.pdf" disabled={loteBusy} onFiles={importarLote} overlayLabel="Solte todos os PDFs aqui" className="mb-2">
                <button
                  type="button"
                  onClick={() => loteRef.current?.click()}
                  disabled={loteBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-400 bg-blue-50/60 py-3 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-60 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15"
                >
                  {loteBusy ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Identificando e lendo…</>
                  ) : (
                    <><Upload className="h-4 w-4" /> Enviar tudo (vários PDFs de uma vez)</>
                  )}
                </button>
              </DropZone>
              {loteAviso && <p className="mb-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{loteAviso}</p>}

              {/* Seletor de tipo */}
              <div className="mb-3">
                <label className={labelCls}>Tipo de contrato</label>
                <div className="flex gap-2">
                  {TIPOS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('tipo', t)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                        form.tipo === t
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-300'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {t === 'RMC' ? 'RMC (Reserva de Margem)' : 'RCC (Cartão Consignado)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-carregamento do HISCON/HISCRE vindos do card (sem re-upar) */}
              {autoLoad && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> {autoLoad} (reaproveitando os arquivos do processo)
                </div>
              )}

              {/* Envio um por um — recolhido: a área única acima é o caminho padrão */}
              <input ref={hisconRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPickHiscon} />
              <input ref={hiscreRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPickHiscre} />
              <input ref={csSentRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={onPickCsSent} />
              <input ref={calcPdfRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPickCalcPdf} />
              <button
                type="button"
                onClick={() => setEnvioEspecifico((v) => !v)}
                className="text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                {envioEspecifico ? '▴ Esconder envio um por um' : '▾ Prefere enviar um por um?'}
              </button>
              {envioEspecifico && (
                <div className="mt-2 space-y-2">
                  <DropZone accept="application/pdf,.pdf" multiple={false} disabled={hisconMut.isPending} onFiles={(fs) => { setHisconAviso(null); hisconMut.mutate(fs[0]); }}>
                    <button
                      type="button"
                      onClick={() => hisconRef.current?.click()}
                      disabled={hisconMut.isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 py-2.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/15"
                    >
                      {hisconMut.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Lendo o HISCON…</>
                      ) : (
                        <><Building2 className="h-4 w-4" /> 1. Contrato (HISCON)</>
                      )}
                    </button>
                  </DropZone>
                  <DropZone accept="application/pdf,.pdf" multiple={false} disabled={hiscreMut.isPending} onFiles={(fs) => { setHiscreAviso(null); hiscreMut.mutate(fs[0]); }}>
                    <button
                      type="button"
                      onClick={() => hiscreRef.current?.click()}
                      disabled={hiscreMut.isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 py-2.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-60 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15"
                    >
                      {hiscreMut.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Lendo o HISCRE…</>
                      ) : (
                        <><Upload className="h-4 w-4" /> 2. Descontos (HISCRE)</>
                      )}
                    </button>
                  </DropZone>
                  <DropZone accept="application/pdf,.pdf" disabled={csSentMut.isPending} onFiles={(fs) => { setFase('cs'); setCs((c) => ({ ...c, ativar: true })); setCsSentAviso(null); csSentMut.mutate(fs); }}>
                    <button
                      type="button"
                      onClick={() => csSentRef.current?.click()}
                      disabled={csSentMut.isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-violet-300 bg-violet-50/50 py-2.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-60 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/15"
                    >
                      {csSentMut.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Lendo a sentença…</>
                      ) : (
                        <><Sparkles className="h-4 w-4" /> 3. Sentença / inicial (IA)</>
                      )}
                    </button>
                  </DropZone>
                  <DropZone accept="application/pdf,.pdf" multiple={false} disabled={calcPdfMut.isPending} onFiles={(fs) => { setFase('cs'); setCs((c) => ({ ...c, ativar: true })); setCalcPdfAviso(null); calcPdfMut.mutate(fs[0]); }}>
                    <button
                      type="button"
                      onClick={() => calcPdfRef.current?.click()}
                      disabled={calcPdfMut.isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-violet-300 bg-violet-50/50 py-2.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-60 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/15"
                    >
                      {calcPdfMut.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Lendo o cálculo da inicial…</>
                      ) : (
                        <><Calculator className="h-4 w-4" /> 4. Cálculo da inicial (PDF do relatório)</>
                      )}
                    </button>
                  </DropZone>
                </div>
              )}

              {/* Avisos e escolhas (valem também para o envio pela área única) */}
              {hisconAviso && <p className="mb-2 mt-2 text-xs text-zinc-500 dark:text-zinc-400">{hisconAviso}</p>}

              {/* Plano de ação: o que o HISCON permite fazer, antes do cálculo. */}
              {hisconPlano && (
                <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">Plano de ação</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                      {hisconPlano.resumo.aAjuizar} a ajuizar
                    </span>
                    {hisconPlano.resumo.aReposicionar > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                        {hisconPlano.resumo.aReposicionar} a reposicionar a tese
                      </span>
                    )}
                    {hisconPlano.resumo.aDescartar > 0 && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
                        {hisconPlano.resumo.aDescartar} a não ajuizar
                      </span>
                    )}
                    <span className="text-zinc-500 dark:text-zinc-400">
                      de {hisconPlano.resumo.reus} réus · {hisconPlano.resumo.contratosDecaidos} averbações com mais de 4 anos
                    </span>
                  </div>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {hisconPlano.diagnostico.slice(0, 3).map((d, i) => (
                      <li key={i}>• {d}</li>
                    ))}
                  </ul>
                  {hisconPlano.acoes.filter((a) => a.veredito !== 'INDICIO_FRACO').length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {hisconPlano.acoes
                        .filter((a) => a.veredito !== 'INDICIO_FRACO')
                        .slice(0, 8)
                        .map((a) => (
                          <span
                            key={a.grupo}
                            title={`${a.porque} → ${a.proximoPasso}`}
                            className={`rounded border px-1.5 py-0.5 text-[10px] ${
                              a.veredito === 'AJUIZAR'
                                ? 'border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300'
                                : a.veredito === 'NAO_AJUIZAR'
                                  ? 'border-rose-300 text-rose-700 dark:border-rose-500/40 dark:text-rose-300'
                                  : 'border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-300'
                            }`}
                          >
                            {a.grupo} · {a.dentroDoPrazo}/{a.averbacoes}
                          </span>
                        ))}
                    </div>
                  )}
                  <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                    Indícios calculados a partir do documento. Não é parecer, e a decisão de ajuizar é do advogado.
                  </p>
                </div>
              )}

              {hisconAvisos.length > 0 && (
                <ul className="mb-2 space-y-1 text-[11px] text-amber-700 dark:text-amber-300">
                  {/* O parser emite um aviso por CONTRATO: o mesmo número duas vezes
                      na mesma página são duas averbações, e é dado, não ruído.
                      Agrupar com a contagem preserva isso; deduplicar apagaria uma
                      das linhas ruins. */}
                  {[...hisconAvisos.reduce(
                    (m, a) => m.set(a, (m.get(a) ?? 0) + 1),
                    new Map<string, number>(),
                  )].slice(0, 4).map(([a, n]) => (
                    <li key={a}>⚠ {a}{n > 1 && <span className="font-medium"> ({n}×)</span>}</li>
                  ))}
                </ul>
              )}
              {hisconContratos && hisconContratos.length > 1 && (
                <div className="mb-2 space-y-1.5">
                  {hisconContratos.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => aplicarHiscon(c)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                        hisconSel === c
                          ? 'border-indigo-400 bg-indigo-50/60 dark:border-indigo-500/50 dark:bg-indigo-500/10'
                          : 'border-zinc-200 bg-white hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-500/40'
                      }`}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span className="flex-1">
                        <span className="font-medium text-zinc-800 dark:text-zinc-100">
                          {c.tipo}
                          {c.banco ? ` · ${c.banco}` : ''}
                        </span>
                        <span className="block text-zinc-500 dark:text-zinc-400">
                          {c.valorEmprestimo != null ? brl(c.valorEmprestimo) : 'valor n/d'}
                          {c.valorReservado != null ? ` · parcela ${brl(c.valorReservado)}` : ''}
                          {c.contrato ? ` · nº ${c.contrato}` : ''}
                        </span>
                      </span>
                      {hisconSel === c && <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-500" />}
                    </button>
                  ))}
                </div>
              )}

              {hiscreAviso && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{hiscreAviso}</p>}
              {calcPdfAviso && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{calcPdfAviso}</p>}
              {hiscreContratos && hiscreContratos.length > 1 && (
                <div className="mt-2 space-y-1.5">
                  {hiscreContratos.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => aplicarHiscre(c)}
                      className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-xs hover:border-blue-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-500/40"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span className="flex-1">
                        <span className="font-medium text-zinc-800 dark:text-zinc-100">
                          {c.tipo}
                          {c.banco ? ` · ${c.banco}` : ''}
                        </span>
                        <span className="block text-zinc-500 dark:text-zinc-400">
                          {c.parcelas.length} parcela(s)
                          {c.contrato ? ` · contrato ${c.contrato}` : ''}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Contrato */}
            <div className={cardCls}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <FileText className="h-4 w-4 text-zinc-400" /> Contrato
              </h2>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Nome do cálculo</label>
                  <input
                    className={inputCls}
                    placeholder="Ex.: RMC - BMG - Fulano"
                    value={form.nomeCalculo}
                    onChange={(e) => set('nomeCalculo', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Banco</label>
                    <input
                      className={inputCls}
                      placeholder="BMG, PAN…"
                      value={form.banco}
                      onChange={(e) => set('banco', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Nº do contrato</label>
                    <input
                      className={inputCls}
                      placeholder="opcional"
                      value={form.numeroContrato}
                      onChange={(e) => set('numeroContrato', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Valor do empréstimo (R$)</label>
                    <input
                      className={inputCls}
                      inputMode="decimal"
                      placeholder="1.212,00"
                      value={form.valorEmprestimo}
                      onChange={(e) => set('valorEmprestimo', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Data da contratação</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={form.dataContratacao}
                      onChange={(e) => set('dataContratacao', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Taxa conversão (% a.m.)</label>
                    <input
                      className={inputCls}
                      inputMode="decimal"
                      placeholder="2,50"
                      value={form.taxaConversao}
                      onChange={(e) => set('taxaConversao', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Modalidade (consignado)</label>
                    <select
                      className={inputCls}
                      value={form.modalidadeConsignado}
                      onChange={(e) => set('modalidadeConsignado', e.target.value as 'INSS' | 'PUBLICO')}
                    >
                      <option value="INSS">INSS</option>
                      <option value="PUBLICO">Setor público</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => taxaMut.mutate()}
                  disabled={!form.dataContratacao || taxaMut.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {taxaMut.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Landmark className="h-3.5 w-3.5" />
                  )}
                  Reaplicar taxa do BACEN (preenche sozinha pela data)
                </button>
                {taxaInfo && <p className="text-xs text-zinc-500 dark:text-zinc-400">{taxaInfo}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Juros de mora (% a.m.)</label>
                    <input
                      className={inputCls}
                      inputMode="decimal"
                      placeholder="1,00"
                      value={form.jurosMora}
                      onChange={(e) => set('jurosMora', e.target.value)}
                    />
                    <p className="mt-1 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
                      Simples, sobre o valor a restituir (CC 406). 0 = sem juros.
                    </p>
                  </div>
                  <div />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Índice de correção</label>
                    <select
                      className={inputCls}
                      value={form.indiceCorrecao}
                      onChange={(e) => set('indiceCorrecao', e.target.value as IndiceCorrecao)}
                    >
                      <option value="INPC">INPC</option>
                      <option value="IPCA-E">IPCA-E</option>
                      <option value="IPCA">IPCA</option>
                      <option value="IGP-M">IGP-M</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Data-base</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={form.dataBase}
                      onChange={(e) => set('dataBase', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                      checked={form.dobro}
                      onChange={(e) => set('dobro', e.target.checked)}
                    />
                    Restituir em dobro (CDC 42, §ún.)
                  </label>
                  <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-zinc-300 disabled:opacity-40 dark:border-zinc-600"
                      checked={form.modulacaoStj}
                      disabled={!form.dobro}
                      onChange={(e) => set('modulacaoStj', e.target.checked)}
                    />
                    <span>
                      Modulação STJ (Tema 929)
                      <span className="block text-xs text-zinc-400 dark:text-zinc-500">
                        Dobro só a partir de 30/03/2021 (EAREsp 676.608); antes, simples.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                      checked={form.proRataDie}
                      onChange={(e) => set('proRataDie', e.target.checked)}
                    />
                    Pro rata die
                  </label>
                </div>
              </div>
            </div>

            {/* Parcelas descontadas */}
            <div className={cardCls}>
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <CalendarDays className="h-4 w-4 text-zinc-400" /> Parcelas descontadas
              </h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                Vêm do HISCRE, do gerador, ou cole uma por linha: <code>data valor</code>{' '}
                (ex.: <code>01/12/2022 60,60</code>).
              </p>

              <div className="mb-3 grid grid-cols-2 items-end gap-2 lg:grid-cols-[1fr_1fr_70px_auto]">
                <div>
                  <label className={labelCls}>1ª competência</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={ger.dataInicial}
                    onChange={(e) => setGer({ ...ger, dataInicial: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Valor</label>
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    placeholder="60,60"
                    value={ger.valor}
                    onChange={(e) => setGer({ ...ger, valor: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Meses</label>
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    value={ger.meses}
                    onChange={(e) => setGer({ ...ger, meses: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={gerarParcelas}
                  className="flex h-[38px] items-center gap-1 rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <Plus className="h-4 w-4" /> Gerar
                </button>
              </div>
              <textarea
                className={`${inputCls} h-40 font-mono text-xs`}
                placeholder={'01/12/2022\t60,60\t#HISCON id. 12345, p. 4\n01/01/2023\t60,60\t#HISCON id. 12345, p. 4\n...'}
                value={parcelasTexto}
                onChange={(e) => setParcelasTexto(e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">
                  {parcelas.length} parcela(s) reconhecida(s)
                </span>
                {erros.length > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    {erros.length} linha(s) ignorada(s)
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                Após o valor, use <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">#</code>{' '}
                para a <b>fonte</b> da competência (id do documento nos autos + página) — é o que amarra
                cada desconto à prova do extrato do órgão pagador.
              </p>

              {/* Painel antiexcesso — feedback imediato (mesmas regras do servidor) */}
              {ocorrenciasLocais.length > 0 && (
                <div className="mt-3 space-y-2">
                  {antiexcessoErros.length > 0 && (
                    <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-500/40 dark:bg-red-500/10">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                        <ShieldAlert className="h-4 w-4" />
                        {antiexcessoErros.length} impedimento(s) — corrija antes de salvar no processo
                      </p>
                      <ul className="space-y-1 text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                        {antiexcessoErros.map((o, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span className="font-mono font-semibold">{o.codigo}</span>
                            <span>{o.mensagem}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {antiexcessoAvisos.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        <TriangleAlert className="h-4 w-4" />
                        {antiexcessoAvisos.length} aviso(s) — não bloqueiam, mas confira
                      </p>
                      <ul className="space-y-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                        {antiexcessoAvisos.map((o, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span className="font-mono font-semibold">{o.codigo}</span>
                            <span>{o.mensagem}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tutela / descontos continuados — só no cumprimento de sentença */}
            {fase === 'cs' && (
            <div className={cardCls}>
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <ShieldAlert className="h-4 w-4 text-amber-500" /> Tutela deferida?{' '}
                <span className="text-xs font-normal text-zinc-400">(suspensão dos descontos)</span>
              </h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                O HISCON/HISCRE costumam ser <b>da época da inicial</b> — as parcelas param lá. Se
                a tutela <b>não</b> foi deferida, os descontos continuaram — o saldo devedor é
                recalculado somando uma parcela por mês, da última parcela até a data-base.
              </p>
              {tutela.deferida && defasagemMeses >= 2 && ultimaParcela && (
                <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    As parcelas param em <b>{mesBr(ultimaParcela.data)}</b> — {defasagemMeses}{' '}
                    mês(es) antes da data-base ({mesBr(form.dataBase)}). HISCRE defasado? Se os
                    descontos <b>não</b> foram suspensos por tutela, marque{' '}
                    <b>"Não — descontos continuaram"</b> para completar o período.
                  </span>
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTutela((t) => ({ ...t, deferida: true }))}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${tutela.deferida ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-300' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}
                >
                  Sim — descontos suspensos
                </button>
                <button
                  type="button"
                  onClick={() => setTutela((t) => ({ ...t, deferida: false }))}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${!tutela.deferida ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-300' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}
                >
                  Não — descontos continuaram
                </button>
              </div>
              {!tutela.deferida && (
                <div className="mt-3 space-y-2">
                  <div>
                    <label className={labelCls}>Desconto mensal após a inicial (R$)</label>
                    <input
                      className={inputCls}
                      inputMode="decimal"
                      placeholder={
                        ultimaParcela ? `${ultimaParcela.valor.toFixed(2).replace('.', ',')} (última parcela)` : '105,00'
                      }
                      value={tutela.valorMensal}
                      onChange={(e) => setTutela((t) => ({ ...t, valorMensal: e.target.value }))}
                    />
                    <p className="mt-1 text-[10px] leading-tight text-zinc-400">
                      Vazio = repete o valor da última parcela da lista.
                    </p>
                  </div>
                  {parcelasExtras.length > 0 ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                      Serão acrescidas <b>{parcelasExtras.length} parcela(s)</b> de{' '}
                      <b>{brl(parcelasExtras[0].valor)}</b> (
                      {parcelasExtras[0].data.slice(0, 7).split('-').reverse().join('/')} a{' '}
                      {parcelasExtras[parcelasExtras.length - 1].data.slice(0, 7).split('-').reverse().join('/')}
                      ) — o saldo devedor será recalculado até a data-base.
                    </p>
                  ) : (
                    <p className="text-[10px] leading-tight text-zinc-400">
                      Preencha as parcelas descontadas acima — a extensão parte da última.
                    </p>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Cumprimento de Sentença — só na fase de execução */}
            {fase === 'cs' && (
            <div className={cardCls}>
              <label className="flex items-start gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                  checked={cs.ativar}
                  onChange={(e) => setCsField('ativar', e.target.checked)}
                />
                <span className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  Cumprimento de Sentença (Atualização de Débitos)
                </span>
              </label>
              <p className="mt-1 pl-6 text-xs text-zinc-500 dark:text-zinc-400">
                Monta a execução com os parâmetros exatos da sentença: restituição como principal
                (ou só a sucumbência, na obrigação de fazer) + honorários + multa do art. 523.
              </p>

              {cs.ativar && (
                <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  {/* Alinhamento com o card "Tutela deferida?": no CS, o HISCON/HISCRE
                      da época da inicial deixa as parcelas defasadas até a data-base. */}
                  {tutela.deferida && defasagemMeses >= 2 && ultimaParcela && (
                    <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Para execução, confira o card <b>"Tutela deferida?"</b> acima: as parcelas
                        (HISCRE da época da inicial?) param em <b>{mesBr(ultimaParcela.data)}</b>,{' '}
                        {defasagemMeses} mês(es) antes da data-base. Sem tutela, os descontos
                        continuaram e o saldo a executar está maior.
                      </span>
                    </p>
                  )}
                  {!tutela.deferida && parcelasExtras.length > 0 && (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] leading-relaxed text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                      ✓ Tutela não deferida: {parcelasExtras.length} parcela(s) de{' '}
                      {brl(parcelasExtras[0].valor)} somadas até a data-base — o saldo da execução
                      já sai recalculado.
                    </p>
                  )}
                  {/* A sentença/inicial entram pela área "Importar documentos" (sem botão duplicado aqui) */}
                  {csSentMut.isPending && (
                    <p className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lendo a sentença…
                    </p>
                  )}
                  {csSentAviso && <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{csSentAviso}</p>}

                  <div>
                    <label className={labelCls}>O que a sentença mandou executar?</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCsField('execucao', 'restituicao')}
                        className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${cs.execucao === 'restituicao' ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-300' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}
                      >
                        Restituição em dinheiro + sucumbência
                      </button>
                      <button
                        type="button"
                        onClick={() => setCsField('execucao', 'soSucumbencia')}
                        className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${cs.execucao === 'soSucumbencia' ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-300' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}
                      >
                        Só a sucumbência (obrigação de fazer)
                      </button>
                    </div>
                    {cs.execucao === 'soSucumbencia' && (
                      <p className="mt-1.5 text-[10px] leading-tight text-zinc-400">
                        Sentença sem condenação líquida: a restituição vira abatimento no recálculo
                        do contrato — executa-se em dinheiro apenas os honorários sucumbenciais.
                      </p>
                    )}
                  </div>

                  {(cs.execucao === 'restituicao' || cs.sucBase === 'principal') && (
                    <div>
                      <label className={labelCls}>
                        {cs.execucao === 'restituicao'
                          ? 'Principal = restituição do cenário'
                          : 'Condenação = restituição do cenário'}
                      </label>
                      <select
                        className={inputCls}
                        value={cs.baseCenario}
                        onChange={(e) => setCsField('baseCenario', e.target.value as CenarioId)}
                      >
                        <option value="apenasConversao">Apenas conversão (simples)</option>
                        <option value="conversaoDobro">Conversão + dobro</option>
                        <option value="restituicaoTotal">Restituição total</option>
                      </select>
                    </div>
                  )}

                  <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                      Honorários sucumbenciais (CPC 85)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Percentual (%)</label>
                        <input
                          className={`${inputCls} disabled:opacity-50`}
                          inputMode="decimal"
                          placeholder={cs.sucBase === 'valorFixado' ? '—' : '10'}
                          value={cs.sucBase === 'valorFixado' ? '' : cs.sucPercentual}
                          disabled={cs.sucBase === 'valorFixado'}
                          onChange={(e) => setCsField('sucPercentual', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Base de cálculo</label>
                        <select
                          className={inputCls}
                          value={cs.sucBase}
                          onChange={(e) => setCsField('sucBase', e.target.value as typeof cs.sucBase)}
                        >
                          <option value="valorCausa">Valor da causa</option>
                          <option value="principal">Sobre a condenação (restituição do cálculo)</option>
                          <option value="valorFixado">Valor fixado (R$)</option>
                        </select>
                      </div>
                    </div>
                    {cs.sucBase === 'valorFixado' && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <label className={labelCls}>Honorários fixados (R$)</label>
                          <input
                            className={inputCls}
                            inputMode="decimal"
                            placeholder="1.175,87"
                            value={cs.valorFixado}
                            onChange={(e) => setCsField('valorFixado', e.target.value)}
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                            checked={cs.atualizarValorCausa}
                            onChange={(e) => setCsField('atualizarValorCausa', e.target.checked)}
                          />
                          Corrigir o valor até a data-base
                        </label>
                        {cs.atualizarValorCausa && (
                          <div>
                            <label className={labelCls}>Data da fixação (sentença)</label>
                            <input
                              type="date"
                              className={inputCls}
                              value={cs.valorCausaData}
                              onChange={(e) => setCsField('valorCausaData', e.target.value)}
                            />
                          </div>
                        )}
                        <p className="text-[10px] leading-tight text-zinc-400">
                          Use quando não há condenação líquida e os honorários precisam ser fixados
                          em valor certo.
                        </p>
                      </div>
                    )}
                    {cs.sucBase === 'valorCausa' && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <label className={labelCls}>Valor da causa (R$)</label>
                          <input
                            className={inputCls}
                            inputMode="decimal"
                            placeholder="12.268,18"
                            value={cs.valorCausa}
                            onChange={(e) => setCsField('valorCausa', e.target.value)}
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                            checked={cs.atualizarValorCausa}
                            onChange={(e) => setCsField('atualizarValorCausa', e.target.checked)}
                          />
                          Atualizar o valor da causa (correção até a data-base)
                        </label>
                        {cs.atualizarValorCausa && (
                          <div>
                            <label className={labelCls}>Data inicial da correção</label>
                            <input
                              type="date"
                              className={inputCls}
                              value={cs.valorCausaData}
                              onChange={(e) => setCsField('valorCausaData', e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                      Multa do art. 523 do CPC
                    </p>
                    <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                        checked={cs.multaMoratoria}
                        onChange={(e) => setCsField('multaMoratoria', e.target.checked)}
                      />
                      Multa moratória de 10%
                    </label>
                    <label className="mt-1.5 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                        checked={cs.multaHonorarios}
                        onChange={(e) => setCsField('multaHonorarios', e.target.checked)}
                      />
                      Honorários de 10%
                    </label>
                    <p className="mt-1.5 text-[10px] leading-tight text-zinc-400">
                      Só marque depois de esgotado o prazo de 15 dias do art. 523 sem pagamento.
                    </p>
                  </div>
                </div>
              )}
            </div>
            )}

            <button
              type="button"
              disabled={!podeCalcular || calc.isPending}
              onClick={() => calc.mutate()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {calc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {fase === 'cs' && cs.ativar ? 'Calcular RMC + Cumprimento de Sentença' : 'Calcular os 3 cenários'}
            </button>
            {calc.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {(calc.error as Error)?.message ?? 'Erro ao calcular.'}
              </p>
            )}
          </div>

          {/* ── Coluna de resultado ───────────────────────────────────────── */}
          <div className="min-w-0 space-y-4">
            {!res && (
              <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/50 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/40">
                <Calculator className="mb-2 h-8 w-8 opacity-40" />
                Importe o HISCON/HISCRE (ou preencha à mão) e clique em{' '}
                <b className="mx-1">Calcular</b>.
              </div>
            )}

            {res && cenarioView && (
              <>
                {/* Ações do resultado */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => gerarPdfRmc(res, { tipo: form.tipo, banco: form.banco, numeroContrato: form.numeroContrato, nomeCalculo: form.nomeCalculo })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Baixar PDF (simples + dobro)
                  </button>
                </div>

                {/* Comparação dos 3 cenários */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {cenarios.map((c) => (
                    <CenarioCard
                      key={c.id}
                      cenario={c}
                      ativo={c.id === cenarioAtivo}
                      onClick={() => setCenarioAtivo(c.id)}
                      onDownload={() => baixarCenario(c)}
                    />
                  ))}
                </div>

                {/* Bloco "Resultado" — idêntico ao Cálculo Jurídico */}
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Resultado</h2>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Método: {METODO_LABEL[cenarioView.id]}
                    </p>
                  </div>
                  <dl className="text-sm">
                    <ResRow label="Saldo da conversão em empréstimo consignado" valor={cenarioView.resumo.saldoConversao} />
                    <ResRow label="Restituição de Valores" valor={cenarioView.resumo.restituicao} />
                    <ResRow label="Total" valor={cenarioView.resumo.total} destaque />
                  </dl>
                  {caseId && (
                    <div className="border-t border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
                      <button
                        onClick={async () => {
                          setSalvando(true);
                          try {
                            await legalCasesService.salvarCalculo(caseId, {
                              cenario: cenarioView.id,
                              cenarioTitulo: cenarioView.titulo,
                              total: cenarioView.resumo.total,
                              resumo: cenarioView.resumo,
                              metodoLabel: METODO_LABEL[cenarioView.id],
                              // Linhas da evolução do saldo devedor → memorial DETALHADO nos anexos.
                              linhas: cenarioView.linhas,
                              // Marco do contrato + competências (com fonte): o servidor revalida
                              // antiexcesso na gravação e persiste p/ a auditoria retroativa.
                              dataContratacao: form.dataContratacao || undefined,
                              descontos: [...parcelas, ...parcelasExtras].map((p) => ({
                                data: p.data,
                                valor: p.valor,
                                fonte: p.fonte,
                              })),
                              config: {
                                ...(res?.config ?? {}),
                                banco: form.banco,
                                tipo: form.tipo,
                                numeroContrato: form.numeroContrato,
                                dataContratacao: form.dataContratacao,
                                nomeCalculo: form.nomeCalculo,
                              },
                            });
                            // Avisa a aba do card (BroadcastChannel) p/ ele recarregar
                            // sozinho e mostrar o cálculo + liberar "Gerar inicial".
                            try { new BroadcastChannel('bullq-calculo').postMessage({ caseId }); } catch { /* sem suporte */ }
                            setSalvouOk(true);
                            toast.success('Cálculo salvo no processo ✓');
                            // A aba foi aberta via window.open pelo card → fecha sozinha
                            // (volta o foco pro card, que já se atualizou). Se não fechar
                            // (aberta direto pela URL), fica o banner de sucesso abaixo.
                            setTimeout(() => { try { window.close(); } catch { /* */ } }, 700);
                          } catch (e: any) {
                            toast.error(e?.response?.data?.message || 'Erro ao salvar no processo');
                          } finally {
                            setSalvando(false);
                          }
                        }}
                        disabled={salvando || salvouOk || antiexcessoErros.length > 0}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#005efc] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {salvando ? 'Salvando…' : salvouOk ? 'Salvo no processo ✓' : 'Salvar no processo (valor da causa)'}
                      </button>
                      {antiexcessoErros.length > 0 && (
                        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-red-600 dark:text-red-400">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Validação antiexcesso: corrija os {antiexcessoErros.length} impedimento(s) acima antes de salvar.
                        </p>
                      )}
                      {salvouOk && (
                        <p className="mt-2 text-center text-xs text-emerald-600 dark:text-emerald-400">
                          ✓ Salvo. Volte para a aba do processo — o cálculo já aparece lá e o botão “Gerar petição inicial” está liberado. Pode fechar esta aba.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Bloco "Cumprimento de Sentença" — RMC já atualizada + sucumbência + multa 523 */}
                {res.cs && (
                  <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm dark:border-violet-500/30 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 border-b border-violet-100 bg-violet-50/60 px-5 py-3.5 dark:border-violet-500/20 dark:bg-violet-500/10">
                      <Landmark className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      <div>
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                          Cumprimento de Sentença
                        </h2>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          Principal = restituição já atualizada até{' '}
                          {res.cs.termoFinal.split('-').reverse().join('/')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          gerarPdfCsExecucao(res.cs!, {
                            tipo: form.tipo,
                            banco: form.banco,
                            numeroContrato: form.numeroContrato,
                            nomeCalculo: form.nomeCalculo,
                            indiceCorrecao: res.config.indiceCorrecao,
                            taxaConversao: res.config.taxaConversao,
                            dataBase: res.config.dataBase,
                            valorEmprestimo: res.config.valorEmprestimo,
                            dataContratacao: form.dataContratacao,
                            sucumbenciaLabel: csInfo?.honFixado ? 'valor fixado' : undefined,
                            cenario: cenarios.find((c) => c.id === res.cs!.baseCenario) ?? cenarioView,
                          })
                        }
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 shadow-sm transition-colors hover:bg-violet-50 dark:border-violet-500/40 dark:bg-zinc-900 dark:text-violet-300 dark:hover:bg-violet-500/10"
                      >
                        <FileDown className="h-3.5 w-3.5" /> Baixar PDF
                      </button>
                    </div>
                    <dl className="text-sm">
                      <ResRow label="Principal (repetição do indébito)" valor={res.cs.principal} />
                      <ResRow
                        label={
                          csInfo?.honFixado
                            ? `Honorários sucumbenciais — valor fixado${res.cs.sucumbencia.valorCausaAtualizado != null ? ' (corrigido até a data-base)' : ''}`
                            : `Honorários sucumbenciais — ${pct(res.cs.sucumbencia.percentual)} ${
                                res.cs.sucumbencia.base === 'valorCausa'
                                  ? `sobre o valor da causa (${brl(
                                      res.cs.sucumbencia.valorCausaAtualizado ?? res.cs.sucumbencia.valorCausa ?? 0,
                                    )}${res.cs.sucumbencia.valorCausaAtualizado != null ? ' atualizado' : ''})`
                                  : res.cs.sucumbencia.base === 'diferenca'
                                    ? 'sobre a diferença'
                                    : 'sobre a condenação (restituição)'
                              }`
                        }
                        valor={res.cs.sucumbencia.valor}
                      />
                      {res.cs.multa523.moratoria > 0 && (
                        <ResRow label="Multa moratória de 10% (art. 523, CPC)" valor={res.cs.multa523.moratoria} />
                      )}
                      {res.cs.multa523.honorarios > 0 && (
                        <ResRow label="Honorários de 10% (art. 523, CPC)" valor={res.cs.multa523.honorarios} />
                      )}
                      <ResRow label="Total geral (execução)" valor={res.cs.total} destaque />
                    </dl>
                  </div>
                )}

                {/* Bloco "Execução da sucumbência" — obrigação de fazer (sem condenação líquida) */}
                {res.csSuc && (
                  <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm dark:border-violet-500/30 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 border-b border-violet-100 bg-violet-50/60 px-5 py-3.5 dark:border-violet-500/20 dark:bg-violet-500/10">
                      <Landmark className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      <div>
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                          Execução da sucumbência — obrigação de fazer
                        </h2>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          A restituição de {brl(cenarioView.resumo.restituicao)} vira{' '}
                          <b>abatimento no recálculo do contrato</b> (não é executada em dinheiro) —
                          executa-se só os honorários, atualizados até{' '}
                          {res.csSuc.config.termoFinal.split('-').reverse().join('/')}.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          gerarPdfCs(res.csSuc!, {
                            honorariosLabel: 'Honorários sucumbenciais — valor da execução',
                          })
                        }
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 shadow-sm transition-colors hover:bg-violet-50 dark:border-violet-500/40 dark:bg-zinc-900 dark:text-violet-300 dark:hover:bg-violet-500/10"
                      >
                        <FileDown className="h-3.5 w-3.5" /> Baixar PDF
                      </button>
                    </div>
                    <dl className="text-sm">
                      <ResRow
                        label="Honorários sucumbenciais corrigidos (principal da execução)"
                        valor={res.csSuc.totais.principal}
                      />
                      {res.csSuc.totais.multa523Moratoria > 0 && (
                        <ResRow label="Multa moratória de 10% (art. 523, CPC)" valor={res.csSuc.totais.multa523Moratoria} />
                      )}
                      {res.csSuc.totais.multa523Honorarios > 0 && (
                        <ResRow label="Honorários de 10% (art. 523, CPC)" valor={res.csSuc.totais.multa523Honorarios} />
                      )}
                      <ResRow label="Total geral (execução)" valor={res.csSuc.totais.totalGeral} destaque />
                    </dl>
                  </div>
                )}

                {res.config.modulacaoStj && form.dobro && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Modulação do STJ (Tema 929) ativa: parcelas anteriores a <b>30/03/2021</b>{' '}
                    restituídas de forma simples; posteriores, em dobro (EAREsp 676.608).
                  </div>
                )}

                {/* Evolução do Saldo Devedor — colunas idênticas ao Cálculo Jurídico */}
                <div className={`${cardCls} overflow-hidden p-0`}>
                  <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Evolução do Saldo Devedor
                    </h2>
                    <span className="text-xs text-zinc-400">{cenarioView.linhas.length} meses</span>
                  </div>
                  <div className="max-h-[60vh] overflow-auto">
                    <table className="w-full whitespace-nowrap text-right text-[11px]">
                      <thead className="sticky top-0 z-10 bg-zinc-100 align-bottom text-[10px] font-medium leading-tight text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        <tr>
                          {[
                            'Nº',
                            'Data',
                            `Valor ${form.tipo} debitado`,
                            'Saldo devedor anterior (base juros)',
                            'Taxa de juros',
                            'Valor dos juros mensais',
                            '(-) Amortização',
                            '(+) Outros Saques',
                            'Saldo devedor atual',
                            'Valor a restituir',
                            'Correção Monetária',
                            'Juros',
                            'Valor atualizado a restituir',
                          ].map((h) => (
                            <th key={h} className="px-2 py-2 font-medium first:text-left">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {cenarioView.linhas.map((l) => (
                          <tr
                            key={l.numero}
                            className={l.valorRestituir > 0 ? 'bg-emerald-50/60 dark:bg-emerald-500/5' : undefined}
                          >
                            <td className="px-2 py-1.5 text-left text-zinc-400">{l.numero}</td>
                            <td className="px-2 py-1.5 text-left text-zinc-600 dark:text-zinc-300">
                              {l.data.split('-').reverse().join('/')}
                            </td>
                            <td className="px-2 py-1.5 text-zinc-700 dark:text-zinc-300">{brl(l.valorDebitado)}</td>
                            <td className="px-2 py-1.5 text-zinc-500">{brl(l.saldoAnterior)}</td>
                            <td className="px-2 py-1.5 text-zinc-500">{pct(res.config.taxaConversao)}</td>
                            <td className="px-2 py-1.5 text-zinc-500">{brl(l.juros)}</td>
                            <td className="px-2 py-1.5 text-zinc-500">{brl(l.amortizacao)}</td>
                            <td className="px-2 py-1.5 text-zinc-500">{brl(l.saque)}</td>
                            <td className={`px-2 py-1.5 ${l.saldoAtual < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                              {brl(l.saldoAtual)}
                            </td>
                            <td className="px-2 py-1.5 font-medium text-zinc-700 dark:text-zinc-200">
                              {l.valorRestituir ? (
                                <span className="inline-flex items-center gap-1">
                                  {brl(l.valorRestituir)}
                                  {l.dobroAplicado && (
                                    <span className="rounded bg-emerald-100 px-1 text-[9px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                      2×
                                    </span>
                                  )}
                                </span>
                              ) : (
                                'R$ 0,00'
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-zinc-400">{l.fatorCorrecao.toFixed(6).replace('.', ',')}</td>
                            <td className="px-2 py-1.5 text-zinc-400">
                              {l.valorRestituir ? pct(l.jurosMoraPct * 100) : '0,0000%'}
                            </td>
                            <td className="px-2 py-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                              {l.valorAtualizado ? brl(l.valorAtualizado) : 'R$ 0,00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const METODO_LABEL: Record<CenarioId, string> = {
  apenasConversao: 'Conversão em empréstimo consignado (restituição simples do excedente)',
  conversaoDobro: 'Conversão em empréstimo consignado + Restituição dos valores excedentes',
  restituicaoTotal: 'Restituição integral dos valores descontados',
};

/** Linha do bloco "Resultado" (rótulo à esquerda, valor à direita, zebra). */
function ResRow({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border-b border-zinc-100 px-5 py-2.5 last:border-0 odd:bg-zinc-50/60 dark:border-zinc-800 dark:odd:bg-zinc-800/30 ${
        destaque ? 'bg-blue-50/70 font-semibold dark:bg-blue-500/10' : ''
      }`}
    >
      <span className={`text-zinc-600 dark:text-zinc-300 ${destaque ? 'text-zinc-900 dark:text-white' : ''}`}>
        {label}
      </span>
      <span
        className={`shrink-0 tabular-nums ${
          destaque
            ? 'text-base text-blue-700 dark:text-blue-300'
            : valor < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-zinc-900 dark:text-white'
        }`}
      >
        {brl(valor)}
      </span>
    </div>
  );
}

const CENARIO_ICON: Record<CenarioId, React.ComponentType<{ className?: string }>> = {
  apenasConversao: RefreshCw,
  conversaoDobro: Coins,
  restituicaoTotal: Wallet,
};
const CENARIO_COR: Record<CenarioId, { ativo: string; chip: string; total: string }> = {
  apenasConversao: {
    ativo: 'border-zinc-400 shadow-md dark:border-zinc-500',
    chip: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    total: 'text-zinc-900 dark:text-white',
  },
  conversaoDobro: {
    ativo: 'border-emerald-400 shadow-md dark:border-emerald-500/60',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    total: 'text-emerald-700 dark:text-emerald-300',
  },
  restituicaoTotal: {
    ativo: 'border-violet-400 shadow-md dark:border-violet-500/60',
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    total: 'text-violet-700 dark:text-violet-300',
  },
};

function CenarioCard({
  cenario,
  ativo,
  onClick,
  onDownload,
}: {
  cenario: { id: CenarioId; titulo: string; descricao: string; resumo: { total: number } };
  ativo: boolean;
  onClick: () => void;
  onDownload: () => void;
}) {
  const Icon = CENARIO_ICON[cenario.id] ?? Banknote;
  const cor = CENARIO_COR[cenario.id];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`flex cursor-pointer flex-col rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition-all dark:bg-zinc-900 ${
        ativo ? cor.ativo : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${cor.chip}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{cenario.titulo}</span>
      </div>
      <div className={`text-xl font-bold ${cor.total}`}>{brl(cenario.resumo.total)}</div>
      <p className="mt-1 flex-1 text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">{cenario.descricao}</p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDownload();
        }}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white py-1.5 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <Download className="h-3 w-3" /> Baixar PDF
      </button>
    </div>
  );
}
