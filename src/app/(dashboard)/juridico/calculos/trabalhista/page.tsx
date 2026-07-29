'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Briefcase,
  Calculator,
  FileDown,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Scale,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DropZone } from '@/components/drop-zone';
import {
  calculadoraRescisaoService,
  MODALIDADE_LABEL,
  type CalcularRescisaoInput,
  type Modalidade,
  type ResultadoRescisao,
} from '@/features/calculadora-rescisao/services/calculadora-rescisao.service';
import { gerarPlanilhaRescisao } from '@/features/calculadora-rescisao/lib/pdf-planilha';
import { gerarConfrontoTrct } from '@/features/calculadora-rescisao/lib/trct-comparativo';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';

const brl = (n: number | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0);

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const labelCls = 'mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400';
const cardCls =
  'rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900';

function parseValor(raw: string): number {
  let s = (raw || '').replace(/r\$|\s/gi, '').trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s);
}

const MODALIDADES = Object.keys(MODALIDADE_LABEL) as Modalidade[];
const MOD_OK: string[] = MODALIDADES;

// Mapeia o JSON genérico da IA (conversa/print/texto/caso) para o formulário.
function aplicarPrefill(ex: any, p: Form): Form {
  return {
    ...p,
    reclamante: ex.reclamante ?? p.reclamante,
    reclamado: ex.reclamado ?? p.reclamado,
    cnaeReu: ex.cnae ?? p.cnaeReu,
    admissao: ex.admissao ?? p.admissao,
    desligamento: ex.desligamento ?? p.desligamento,
    maiorRemuneracao: ex.remuneracao != null ? String(ex.remuneracao) : p.maiorRemuneracao,
    cargaHoraria: ex.cargaHoraria != null ? String(Math.round(ex.cargaHoraria)) : p.cargaHoraria,
    modalidade: MOD_OK.includes(ex.modalidadeSugerida) ? (ex.modalidadeSugerida as Modalidade) : p.modalidade,
    feriasVencidasAvos: ex.feriasVencidas != null ? String(ex.feriasVencidas) : p.feriasVencidasAvos,
    liquidoTrctZero: ex.liquidoTrctZero === true ? true : p.liquidoTrctZero,
  };
}
function prefillToast(ex: any): string {
  const verbas = Array.isArray(ex.verbasMencionadas) && ex.verbasMencionadas.length ? ` Verbas citadas: ${ex.verbasMencionadas.join(', ')}.` : '';
  return `Preenchi o que deu.${verbas}${ex.observacoes ? ' ' + ex.observacoes : ''} Confira antes de calcular.`;
}

// Catálogo de verbas adicionais (o motor já calcula; aqui só a UI).
type VerbaLinhaUI = { chave: string; base: string; divisor: string; multiplicador: string; quantidade: string; valorDireto: string; dobra: boolean; obs: string };
const VERBAS_CATALOGO: { chave: string; label: string; tipo: 'param' | 'direto'; hintQtd?: string }[] = [
  { chave: 'horas_extras_50', label: 'Horas extras 50%', tipo: 'param', hintQtd: 'nº de horas' },
  { chave: 'horas_extras_100', label: 'Horas extras 100%', tipo: 'param', hintQtd: 'nº de horas' },
  { chave: 'adicional_noturno', label: 'Adicional noturno', tipo: 'param', hintQtd: 'horas noturnas' },
  { chave: 'domingos_dobro', label: 'Domingos em dobro', tipo: 'param', hintQtd: 'nº de domingos' },
  { chave: 'insalubridade', label: 'Insalubridade', tipo: 'param', hintQtd: 'nº de meses' },
  { chave: 'periculosidade', label: 'Periculosidade', tipo: 'param', hintQtd: 'nº de meses' },
  { chave: 'restituicao_descontos', label: 'Restituição de descontos', tipo: 'direto' },
  { chave: 'estabilidade', label: 'Estabilidade (indenização subst.)', tipo: 'direto' },
  { chave: 'dano_moral', label: 'Dano moral', tipo: 'direto' },
  { chave: 'dano_material', label: 'Dano material', tipo: 'direto' },
  { chave: 'custom', label: 'Outra (personalizada)', tipo: 'param' },
];
const verbaLinhaVazia = (chave = 'horas_extras_50'): VerbaLinhaUI => ({ chave, base: '', divisor: '', multiplicador: '', quantidade: '', valorDireto: '', dobra: false, obs: '' });

type Form = {
  reclamante: string;
  reclamado: string;
  admissao: string;
  desligamento: string;
  modalidade: Modalidade;
  maiorRemuneracao: string;
  ultimaRemuneracao: string;
  cargaHoraria: string;
  salarioMinimo: string;
  diasSaldoSalario: string;
  feriasVencidasAvos: string;
  feriasVencidasDobra: boolean;
  projetarAviso: boolean;
  liquidoTrctZero: boolean;
  honorariosPercentual: string;
  satAliquota: string;
  satFonte: string;
  cnaeReu: string;
  municipio: string;
  uf: string;
};

const formInicial: Form = {
  reclamante: '',
  reclamado: '',
  admissao: '',
  desligamento: '',
  modalidade: 'sem_justa_causa',
  maiorRemuneracao: '',
  ultimaRemuneracao: '',
  cargaHoraria: '220',
  salarioMinimo: '1621',
  diasSaldoSalario: '',
  feriasVencidasAvos: '',
  feriasVencidasDobra: false,
  projetarAviso: true,
  liquidoTrctZero: false,
  honorariosPercentual: '15',
  satAliquota: '',
  satFonte: '',
  cnaeReu: '',
  municipio: '',
  uf: '',
};

export default function RescisaoTrabalhistaPage() {
  const [f, setF] = useState<Form>(formInicial);
  const [res, setRes] = useState<ResultadoRescisao | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipoUpload, setTipoUpload] = useState<'documento' | 'texto' | 'trct' | 'holerite' | 'fgts'>('documento');
  const [textoColado, setTextoColado] = useState('');
  const [verbasUI, setVerbasUI] = useState<VerbaLinhaUI[]>([]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const cid = new URLSearchParams(window.location.search).get('case');
    if (cid) setCaseId(cid);
  }, []);

  const montarPayload = (): CalcularRescisaoInput => {
    const feriasAvos = parseValor(f.feriasVencidasAvos);
    const verbasExtras = verbasUI
      .map((v) => {
        const cat = VERBAS_CATALOGO.find((c) => c.chave === v.chave);
        const num = (s: string) => (s.trim() ? parseValor(s) : undefined);
        if (cat?.tipo === 'direto') {
          const vd = num(v.valorDireto);
          if (!vd) return null;
          return { chave: v.chave, valorDireto: vd, obs: v.obs || undefined };
        }
        const base = { chave: v.chave, base: num(v.base), divisor: num(v.divisor), multiplicador: num(v.multiplicador), quantidade: num(v.quantidade), dobra: v.dobra || undefined, obs: v.obs || undefined };
        // precisa de ao menos quantidade ou base pra valer
        if (base.quantidade == null && base.base == null) return null;
        return base;
      })
      .filter(Boolean) as CalcularRescisaoInput['verbasExtras'];
    return {
      identificacao: { reclamante: f.reclamante, reclamado: f.reclamado },
      admissao: f.admissao,
      desligamento: f.desligamento,
      modalidade: f.modalidade,
      maiorRemuneracao: parseValor(f.maiorRemuneracao),
      ultimaRemuneracao: f.ultimaRemuneracao ? parseValor(f.ultimaRemuneracao) : undefined,
      cargaHoraria: f.cargaHoraria ? parseValor(f.cargaHoraria) : undefined,
      salarioMinimo: f.salarioMinimo ? parseValor(f.salarioMinimo) : undefined,
      diasSaldoSalario: f.diasSaldoSalario ? parseValor(f.diasSaldoSalario) : undefined,
      projetarAviso: f.projetarAviso,
      liquidoTrctZero: f.liquidoTrctZero,
      incluirMulta477: f.liquidoTrctZero,
      feriasVencidas:
        feriasAvos > 0
          ? [{ periodoAquisitivo: 'vencido', avos: feriasAvos, dobra: f.feriasVencidasDobra }]
          : undefined,
      honorariosPercentual: f.honorariosPercentual ? parseValor(f.honorariosPercentual) : undefined,
      encargos:
        f.satAliquota && f.satFonte
          ? { aliquota_sat: parseValor(f.satAliquota), fonte_sat: f.satFonte, cnae_reu: f.cnaeReu || undefined }
          : undefined,
      verbasExtras: verbasExtras?.length ? verbasExtras : undefined,
      municipio: f.municipio || undefined,
      uf: f.uf || undefined,
    };
  };

  const calc = useMutation({
    mutationFn: () => calculadoraRescisaoService.calcular(montarPayload()),
    onSuccess: (r) => {
      setRes(r);
      if (r.pendencias.length) toast.warning('Cálculo com pendências — ver alertas.');
    },
    onError: (e) => toast.error((e as Error)?.message ?? 'Erro ao calcular.'),
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      if (tipoUpload === 'trct') return { tipo: 'trct' as const, r: await calculadoraRescisaoService.extrairTrct(files) };
      if (tipoUpload === 'holerite') return { tipo: 'holerite' as const, r: await calculadoraRescisaoService.extrairHolerite(files) };
      if (tipoUpload === 'fgts') return { tipo: 'fgts' as const, r: await calculadoraRescisaoService.extrairFgts(files) };
      return { tipo: 'documento' as const, r: await calculadoraRescisaoService.extrairDocumento(files) };
    },
    onSuccess: ({ tipo, r }) => {
      const ex = (r as any).extracao ?? {};
      if (tipo === 'documento') {
        setF((p) => aplicarPrefill(ex, p));
        toast.success(prefillToast(ex));
        return;
      }
      if (tipo === 'trct') {
        setF((p) => ({
          ...p,
          reclamante: ex.empregado?.nome ?? p.reclamante,
          reclamado: ex.empregador?.razaoSocial ?? p.reclamado,
          cnaeReu: ex.empregador?.cnae ?? p.cnaeReu,
          admissao: ex.admissao ?? p.admissao,
          desligamento: ex.afastamento ?? p.desligamento,
          maiorRemuneracao: ex.remuneracaoMesAnterior != null ? String(ex.remuneracaoMesAnterior) : p.maiorRemuneracao,
          liquidoTrctZero: ex.valorLiquido === 0 ? true : p.liquidoTrctZero,
        }));
        toast.success(ex.valorLiquido === 0 ? 'TRCT lido — líquido R$ 0,00 (multa 477 ativada).' : 'TRCT lido — confira os campos.');
      } else if (tipo === 'holerite') {
        setF((p) => ({
          ...p,
          cargaHoraria: ex.cargaHorariaMes != null ? String(Math.round(ex.cargaHorariaMes)) : p.cargaHoraria,
        }));
        toast.success('Holerite lido — confira a composição da remuneração.');
      } else {
        const total = (r as any).extracao?.totalDepositado;
        setF((p) => ({ ...p }));
        toast.success(`Extrato FGTS lido — depositado: ${brl(total ?? 0)}.${(r as any).alertas?.length ? ' ' + (r as any).alertas.join(' ') : ''}`);
      }
    },
    onError: (e) => toast.error((e as Error)?.message ?? 'Não consegui ler o documento.'),
  });

  const uploadTexto = useMutation({
    mutationFn: () => calculadoraRescisaoService.extrairTexto(textoColado),
    onSuccess: ({ extracao }) => {
      setF((p) => aplicarPrefill(extracao as any, p));
      toast.success(prefillToast(extracao as any));
    },
    onError: (e) => toast.error((e as Error)?.message ?? 'Não consegui ler o texto.'),
  });

  const puxarCaso = useMutation({
    mutationFn: () => calculadoraRescisaoService.extrairDoCaso(caseId!),
    onSuccess: ({ extracao }) => {
      setF((p) => aplicarPrefill(extracao as any, p));
      toast.success(`Conversa do cliente lida. ${prefillToast(extracao as any)}`);
    },
    onError: (e) => toast.error((e as Error)?.message ?? 'Não consegui puxar a conversa do cliente.'),
  });

  const podeCalcular = f.admissao && f.desligamento && parseValor(f.maiorRemuneracao) > 0;

  const salvar = useMutation({
    mutationFn: async () => {
      if (!caseId || !res) return;
      await legalCasesService.salvarCalculo(caseId, {
        cenario: 'rescisao',
        cenarioTitulo: `Rescisão — ${MODALIDADE_LABEL[f.modalidade]}`,
        total: res.totais.totalDevido,
        resumo: { bruto: res.totais.bruto, honorarios: res.totais.honorarios },
        config: { modalidade: f.modalidade },
      } as any);
      try { new BroadcastChannel('bullq-calculo').postMessage({ caseId }); } catch { /* */ }
    },
    onSuccess: () => toast.success('Cálculo salvo no processo ✓'),
    onError: (e) => toast.error((e as Error)?.message ?? 'Erro ao salvar.'),
  });

  const comparativoOrdenado = useMemo(
    () => (res ? [...res.comparativoModalidades].sort((a, b) => b.total - a.total) : []),
    [res],
  );
  const totalAtual = res?.comparativoModalidades.find((c) => c.atual)?.total ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link
          href="/juridico/calculos"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Calculadoras
        </Link>

        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-sm">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Rescisão Trabalhista</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Verbas por modalidade · planilha analítica (anexo de inicial) · confronto de TRCT
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
          {/* ─── ENTRADAS ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Upload */}
            <div className={cardCls}>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                <Upload className="h-4 w-4 text-violet-500" /> Importar documento (IA)
              </div>
              {caseId && (
                <button
                  onClick={() => puxarCaso.mutate()}
                  disabled={puxarCaso.isPending}
                  className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-50 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:bg-violet-500/10 dark:text-violet-300"
                >
                  {puxarCaso.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                  {puxarCaso.isPending ? 'Lendo a conversa do cliente…' : 'Puxar a conversa do cliente (deste processo)'}
                </button>
              )}
              <div className="mb-2 flex flex-wrap gap-1">
                {(['documento', 'texto', 'trct', 'holerite', 'fgts'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipoUpload(t)}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      tipoUpload === t
                        ? 'bg-violet-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {t === 'documento' ? 'Arquivo / Print' : t === 'texto' ? 'Colar texto' : t === 'trct' ? 'TRCT' : t === 'holerite' ? 'Holerite' : 'Extrato FGTS'}
                  </button>
                ))}
              </div>
              {tipoUpload === 'texto' ? (
                <div>
                  <textarea
                    value={textoColado}
                    onChange={(e) => setTextoColado(e.target.value)}
                    rows={5}
                    placeholder="Cole aqui a conversa do cliente, o relato, um e-mail… A IA lê e preenche o que der."
                    className={`${inputCls} resize-y`}
                  />
                  <button
                    type="button"
                    onClick={() => uploadTexto.mutate()}
                    disabled={uploadTexto.isPending || textoColado.trim().length < 20}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 py-2.5 text-sm text-zinc-500 hover:border-violet-400 hover:text-violet-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
                  >
                    {uploadTexto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {uploadTexto.isPending ? 'Lendo…' : 'Analisar texto colado'}
                  </button>
                </div>
              ) : (
              <><input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf,.pdf,.txt"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && upload.mutate(Array.from(e.target.files))}
              />
              <DropZone
                accept="image/*,application/pdf,.pdf,.txt"
                disabled={upload.isPending}
                onFiles={(fs) => upload.mutate(fs)}
                overlayLabel="Solte aqui — PDF, foto, print ou conversa"
              >
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={upload.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 py-3 text-sm text-zinc-500 hover:border-violet-400 hover:text-violet-600 dark:border-zinc-700 dark:text-zinc-400"
                >
                  {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {upload.isPending
                    ? 'Lendo…'
                    : tipoUpload === 'documento'
                      ? 'Enviar conversa, print, foto ou PDF'
                      : `Enviar ${tipoUpload === 'trct' ? 'TRCT' : tipoUpload === 'holerite' ? 'holerite' : 'extrato de FGTS'} (PDF, foto ou print)`}
                </button>
              </DropZone>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                {tipoUpload === 'documento'
                  ? 'Aceita qualquer coisa — PDF, foto de documento, print de tela ou a conversa do cliente. A IA lê e preenche o que der.'
                  : 'Aceita PDF, foto ou print. A IA propõe; você valida. Nada é gravado sem sua confirmação.'}
              </p>
              </>
              )}
            </div>

            {/* Dados do contrato */}
            <div className={cardCls}>
              <div className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Contrato</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Reclamante</label>
                  <input className={inputCls} value={f.reclamante} onChange={(e) => set('reclamante', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Reclamado</label>
                  <input className={inputCls} value={f.reclamado} onChange={(e) => set('reclamado', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Admissão</label>
                  <input type="date" className={inputCls} value={f.admissao} onChange={(e) => set('admissao', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Desligamento</label>
                  <input type="date" className={inputCls} value={f.desligamento} onChange={(e) => set('desligamento', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Modalidade rescisória</label>
                  <select className={inputCls} value={f.modalidade} onChange={(e) => set('modalidade', e.target.value as Modalidade)}>
                    {MODALIDADES.map((m) => (
                      <option key={m} value={m}>{MODALIDADE_LABEL[m]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Maior remuneração</label>
                  <input className={inputCls} placeholder="R$" value={f.maiorRemuneracao} onChange={(e) => set('maiorRemuneracao', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Última remuneração</label>
                  <input className={inputCls} placeholder="R$" value={f.ultimaRemuneracao} onChange={(e) => set('ultimaRemuneracao', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Dias do saldo de salário</label>
                  <input className={inputCls} placeholder="auto (dia do desligamento)" value={f.diasSaldoSalario} onChange={(e) => set('diasSaldoSalario', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Carga horária (divisor)</label>
                  <input className={inputCls} value={f.cargaHoraria} onChange={(e) => set('cargaHoraria', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Férias vencidas (avos)</label>
                  <input className={inputCls} placeholder="0" value={f.feriasVencidasAvos} onChange={(e) => set('feriasVencidasAvos', e.target.value)} />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                    <input type="checkbox" checked={f.feriasVencidasDobra} onChange={(e) => set('feriasVencidasDobra', e.target.checked)} /> em dobro (art. 137)
                  </label>
                </div>
                <div className="col-span-2 flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                    <input type="checkbox" checked={f.projetarAviso} onChange={(e) => set('projetarAviso', e.target.checked)} /> projetar aviso prévio
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                    <input type="checkbox" checked={f.liquidoTrctZero} onChange={(e) => set('liquidoTrctZero', e.target.checked)} /> líquido do TRCT R$ 0,00 (multa 477)
                  </label>
                </div>
              </div>
            </div>

            {/* Encargos + honorários */}
            <div className={cardCls}>
              <div className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Encargos e honorários</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Honorários (%)</label>
                  <input className={inputCls} value={f.honorariosPercentual} onChange={(e) => set('honorariosPercentual', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>CNAE da ré</label>
                  <input className={inputCls} value={f.cnaeReu} onChange={(e) => set('cnaeReu', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Alíquota SAT/RAT (%)</label>
                  <input className={inputCls} placeholder="ex.: 3,00" value={f.satAliquota} onChange={(e) => set('satAliquota', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>UF / Município</label>
                  <div className="flex gap-2">
                    <input className={inputCls} placeholder="UF" value={f.uf} onChange={(e) => set('uf', e.target.value)} />
                    <input className={inputCls} placeholder="Município" value={f.municipio} onChange={(e) => set('municipio', e.target.value)} />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Fonte do SAT/RAT (Anexo V, Decreto 3.048/99 + data)</label>
                  <input className={inputCls} placeholder="obrigatório para gerar encargos" value={f.satFonte} onChange={(e) => set('satFonte', e.target.value)} />
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                O SAT/RAT não é presumido: sem alíquota + fonte, a seção de encargos é bloqueada (regra §6).
              </p>
            </div>

            {/* Verbas adicionais */}
            <div className={cardCls}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Verbas adicionais</div>
                <button
                  onClick={() => setVerbasUI((p) => [...p, verbaLinhaVazia()])}
                  className="flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
              {verbasUI.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Horas extras, adicional noturno, domingos, insalubridade, periculosidade, danos, estabilidade… entram no cálculo e na planilha.
                </p>
              ) : (
                <div className="space-y-3">
                  {verbasUI.map((v, i) => {
                    const cat = VERBAS_CATALOGO.find((c) => c.chave === v.chave);
                    const upd = (patch: Partial<VerbaLinhaUI>) => setVerbasUI((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <div key={i} className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                        <div className="mb-2 flex items-center gap-2">
                          <select className={`${inputCls} py-1.5 text-xs`} value={v.chave} onChange={(e) => upd({ chave: e.target.value })}>
                            {VERBAS_CATALOGO.map((c) => (
                              <option key={c.chave} value={c.chave}>{c.label}</option>
                            ))}
                          </select>
                          <button onClick={() => setVerbasUI((p) => p.filter((_, j) => j !== i))} className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {cat?.tipo === 'direto' ? (
                          <input className={`${inputCls} py-1.5 text-xs`} placeholder="Valor (R$)" value={v.valorDireto} onChange={(e) => upd({ valorDireto: e.target.value })} />
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <input className={`${inputCls} py-1.5 text-xs`} placeholder={cat?.hintQtd ?? 'Quantidade'} value={v.quantidade} onChange={(e) => upd({ quantidade: e.target.value })} />
                            <input className={`${inputCls} py-1.5 text-xs`} placeholder="Base (opcional)" value={v.base} onChange={(e) => upd({ base: e.target.value })} />
                            {v.chave === 'custom' && (
                              <>
                                <input className={`${inputCls} py-1.5 text-xs`} placeholder="Divisor" value={v.divisor} onChange={(e) => upd({ divisor: e.target.value })} />
                                <input className={`${inputCls} py-1.5 text-xs`} placeholder="Multiplicador" value={v.multiplicador} onChange={(e) => upd({ multiplicador: e.target.value })} />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => calc.mutate()}
              disabled={!podeCalcular || calc.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {calc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Calcular rescisão
            </button>
          </div>

          {/* ─── RESULTADOS ───────────────────────────────────────────── */}
          <div className="space-y-4">
            {!res ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 text-center text-sm text-zinc-400 dark:border-zinc-700">
                <Scale className="mb-2 h-8 w-8" />
                Preencha os dados e clique em <b className="mx-1">Calcular</b> — funciona sem upload.
              </div>
            ) : (
              <>
                {(res.pendencias.length > 0 || res.alertas.length > 0) && (
                  <div className={`${cardCls} border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10`}>
                    <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                      <TriangleAlert className="h-4 w-4" /> {res.pendencias.length ? 'Pendências (não exportar)' : 'Alertas'}
                    </div>
                    <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-300">
                      {[...res.pendencias, ...res.alertas].map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Total + comparativo */}
                <div className={cardCls}>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">Total bruto devido (postulável)</div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-white">{brl(res.totais.bruto)}</div>
                    </div>
                    <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                      + honorários {brl(res.totais.honorarios)}<br />
                      {res.totais.encargosPrevidenciarios > 0 && <>+ encargos {brl(res.totais.encargosPrevidenciarios)}<br /></>}
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">total devido {brl(res.totais.totalDevido)}</span>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Comparativo entre modalidades</div>
                    <div className="space-y-1">
                      {comparativoOrdenado.map((c) => {
                        const diff = c.total - totalAtual;
                        return (
                          <div
                            key={c.modalidade}
                            className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs ${
                              c.atual ? 'bg-violet-50 font-semibold dark:bg-violet-500/10' : ''
                            }`}
                          >
                            <span className="text-zinc-700 dark:text-zinc-300">{c.label}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-zinc-900 dark:text-zinc-100">{brl(c.total)}</span>
                              {!c.atual && (
                                <span className={diff > 0 ? 'text-emerald-600' : 'text-red-500'}>
                                  {diff > 0 ? '+' : ''}{brl(diff)}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => gerarPlanilhaRescisao(res)}
                    disabled={res.pendencias.length > 0}
                    className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Baixar planilha (PDF)
                  </button>
                  <button
                    onClick={() => gerarConfrontoTrct(res)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                  >
                    <FileText className="h-3.5 w-3.5" /> Confronto de TRCT
                  </button>
                  {caseId && (
                    <button
                      onClick={() => salvar.mutate()}
                      disabled={salvar.isPending}
                      className="flex items-center gap-1.5 rounded-lg border border-violet-300 px-3 py-2 text-xs font-medium text-violet-700 dark:border-violet-500/40 dark:text-violet-300"
                    >
                      {salvar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar no processo
                    </button>
                  )}
                </div>

                {/* Quadro por verba */}
                <div className={`${cardCls} overflow-x-auto`}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        <th className="py-1.5 pr-2">Rubrica</th>
                        <th className="py-1.5 pr-2 text-right">Devido</th>
                        <th className="py-1.5 pr-2 text-right">Pago (TRCT)</th>
                        <th className="py-1.5 text-right">Diferença</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.verbas.map((v, i) => (
                        <tr key={i} className="border-b border-zinc-50 dark:border-zinc-800/50">
                          <td className="py-1.5 pr-2 text-zinc-700 dark:text-zinc-300">
                            {v.nome}
                            {v.estimativa && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">est.</span>}
                          </td>
                          <td className="py-1.5 pr-2 text-right text-zinc-600 dark:text-zinc-400">{brl(v.devido)}</td>
                          <td className="py-1.5 pr-2 text-right text-zinc-400">{brl(v.pago)}</td>
                          <td className="py-1.5 text-right font-medium text-zinc-900 dark:text-zinc-100">{brl(v.diferenca)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold text-zinc-900 dark:text-white">
                        <td className="py-2 pr-2">Total</td>
                        <td colSpan={2} />
                        <td className="py-2 text-right">{brl(res.totais.bruto)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
