'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Banknote,
  Building2,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Coins,
  FileSearch,
  FileText,
  Info,
  Landmark,
  Loader2,
  Percent,
  Plus,
  RefreshCw,
  Scale,
  Sparkles,
  TriangleAlert,
  Upload,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import {
  calculadoraRmcService,
  type CalcularRmcInput,
  type CenarioId,
  type HiscreContrato,
  type HisconContrato,
  type IndiceCorrecao,
  type ParcelaInput,
} from '@/features/calculadora-rmc/services/calculadora-rmc.service';

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
    const t = linha.trim();
    if (!t) return;
    const partes = t.split(/[;,\t]|\s{2,}|\s(?=R\$)|\s(?=\d)/).map((p) => p.trim()).filter(Boolean);
    const data = parseData(partes[0] ?? '');
    const valor = parseValor(partes[1] ?? partes[0] ?? '');
    if (!data || isNaN(valor)) {
      erros.push(`Linha ${i + 1}: "${t}"`);
      return;
    }
    parcelas.push({ data, valor });
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

/** Nº de competências (meses) entre duas datas ISO, mínimo 1. */
function mesesEntre(de: string, ate: string): number {
  const [y1, m1] = de.split('-').map(Number);
  const [y2, m2] = ate.split('-').map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
}

const hoje = new Date().toISOString().slice(0, 10);

const TIPOS = ['RMC', 'RCC'] as const;

export default function CalculadoraRmcPage() {
  const [form, setForm] = useState({
    nomeCalculo: '',
    tipo: 'RMC' as (typeof TIPOS)[number],
    banco: '',
    numeroContrato: '',
    valorEmprestimo: '',
    dataContratacao: '',
    modalidadeConsignado: 'INSS' as 'INSS' | 'PUBLICO',
    taxaConversao: '2.50',
    dobro: true,
    modulacaoStj: false,
    indiceCorrecao: 'INPC' as IndiceCorrecao,
    dataBase: hoje,
    proRataDie: false,
    danosMorais: '',
    honorariosTipo: 'NENHUM' as 'NENHUM' | 'FIXO' | 'PERCENTUAL',
    honorariosValor: '',
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [parcelasTexto, setParcelasTexto] = useState('');
  const [ger, setGer] = useState({ dataInicial: '', valor: '', meses: '12' });
  const { parcelas, erros } = useMemo(() => parseParcelas(parcelasTexto), [parcelasTexto]);

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
  const calc = useMutation({
    mutationFn: () => {
      const payload: CalcularRmcInput = {
        valorEmprestimo: parseValor(form.valorEmprestimo),
        taxaConversao: parseValor(form.taxaConversao),
        dobro: form.dobro,
        modulacaoStj: form.modulacaoStj,
        indiceCorrecao: form.indiceCorrecao,
        dataBase: form.dataBase,
        proRataDie: form.proRataDie,
        danosMorais: form.danosMorais ? parseValor(form.danosMorais) : 0,
        nomeCalculo: form.nomeCalculo || undefined,
        parcelas,
      };
      if (form.honorariosTipo !== 'NENHUM') {
        payload.honorariosTipo = form.honorariosTipo;
        payload.honorariosValor = form.honorariosValor ? parseValor(form.honorariosValor) : 0;
      }
      return calculadoraRmcService.calcular(payload);
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

  // ── HISCON: metadados do contrato (nº, datas, valores) ────────────────────
  const hisconRef = useRef<HTMLInputElement>(null);
  const [hisconContratos, setHisconContratos] = useState<HisconContrato[] | null>(null);
  const [hisconSel, setHisconSel] = useState<HisconContrato | null>(null);
  const [hisconAviso, setHisconAviso] = useState<string | null>(null);

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
    // Pré-carrega o gerador de parcelas com a margem reservada do HISCON.
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

  const podeCalcular =
    parseValor(form.valorEmprestimo) > 0 &&
    parseValor(form.taxaConversao) > 0 &&
    parcelas.length > 0;
  const res = calc.data;

  // Cenário ativo na visualização da tabela
  const [cenarioAtivo, setCenarioAtivo] = useState<CenarioId>('conversaoDobro');
  const cenarios = res?.cenarios ?? [];
  const cenarioView = cenarios.find((c) => c.id === cenarioAtivo) ?? cenarios[0];

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-6">
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
          {/* ── Coluna de entrada ─────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Importar documentos (HISCON + HISCRE) */}
            <div className={cardCls}>
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <FileSearch className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Importar do INSS
              </h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                A IA lê o <b>HISCON</b> (dados do contrato) e o <b>HISCRE</b> (descontos mês a mês).
              </p>

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

              {/* Upload HISCON */}
              <input ref={hisconRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPickHiscon} />
              <button
                type="button"
                onClick={() => hisconRef.current?.click()}
                disabled={hisconMut.isPending}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 py-2.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/15"
              >
                {hisconMut.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Lendo o HISCON…</>
                ) : (
                  <><Building2 className="h-4 w-4" /> 1. Importar contrato (HISCON)</>
                )}
              </button>
              {hisconAviso && <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">{hisconAviso}</p>}
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

              {/* Upload HISCRE */}
              <input ref={hiscreRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPickHiscre} />
              <button
                type="button"
                onClick={() => hiscreRef.current?.click()}
                disabled={hiscreMut.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 py-2.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-60 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15"
              >
                {hiscreMut.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Lendo o HISCRE…</>
                ) : (
                  <><Upload className="h-4 w-4" /> 2. Importar descontos (HISCRE)</>
                )}
              </button>
              {hiscreAviso && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{hiscreAviso}</p>}
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
                  Sugerir taxa média do BACEN (data da contratação)
                </button>
                {taxaInfo && <p className="text-xs text-zinc-500 dark:text-zinc-400">{taxaInfo}</p>}
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

            {/* Danos morais & honorários */}
            <div className={cardCls}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <Percent className="h-4 w-4 text-zinc-400" /> Danos morais & honorários
              </h2>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Danos morais (R$)</label>
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.danosMorais}
                    onChange={(e) => set('danosMorais', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Honorários</label>
                    <select
                      className={inputCls}
                      value={form.honorariosTipo}
                      onChange={(e) => set('honorariosTipo', e.target.value as typeof form.honorariosTipo)}
                    >
                      <option value="NENHUM">Nenhum</option>
                      <option value="PERCENTUAL">% sobre o devido</option>
                      <option value="FIXO">Valor fixo</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>
                      {form.honorariosTipo === 'FIXO' ? 'Valor (R$)' : 'Percentual (%)'}
                    </label>
                    <input
                      className={inputCls}
                      inputMode="decimal"
                      disabled={form.honorariosTipo === 'NENHUM'}
                      value={form.honorariosValor}
                      onChange={(e) => set('honorariosValor', e.target.value)}
                    />
                  </div>
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

              <div className="mb-3 grid grid-cols-[1fr_1fr_70px_auto] items-end gap-2">
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
                placeholder={'01/12/2022\t60,60\n01/01/2023\t60,60\n...'}
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
            </div>

            <button
              type="button"
              disabled={!podeCalcular || calc.isPending}
              onClick={() => calc.mutate()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {calc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Calcular os 3 cenários
            </button>
            {calc.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {(calc.error as Error)?.message ?? 'Erro ao calcular.'}
              </p>
            )}
          </div>

          {/* ── Coluna de resultado ───────────────────────────────────────── */}
          <div className="space-y-4">
            {!res && (
              <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/50 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/40">
                <Calculator className="mb-2 h-8 w-8 opacity-40" />
                Importe o HISCON/HISCRE (ou preencha à mão) e clique em{' '}
                <b className="mx-1">Calcular</b>.
              </div>
            )}

            {res && cenarioView && (
              <>
                {/* Comparação dos 3 cenários */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {cenarios.map((c) => (
                    <CenarioCard
                      key={c.id}
                      cenario={c}
                      ativo={c.id === cenarioAtivo}
                      onClick={() => setCenarioAtivo(c.id)}
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
                    <ResRow label="Danos Morais" valor={cenarioView.resumo.danosMorais} />
                    <ResRow label="Total" valor={cenarioView.resumo.total} destaque />
                    <ResRow label="Honorários" valor={cenarioView.resumo.honorarios} />
                  </dl>
                </div>

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
                            <td className="px-2 py-1.5 text-zinc-400">0,0000%</td>
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
}: {
  cenario: { id: CenarioId; titulo: string; descricao: string; resumo: { total: number } };
  ativo: boolean;
  onClick: () => void;
}) {
  const Icon = CENARIO_ICON[cenario.id] ?? Banknote;
  const cor = CENARIO_COR[cenario.id];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition-all dark:bg-zinc-900 ${
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
      <p className="mt-1 text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">{cenario.descricao}</p>
    </button>
  );
}
