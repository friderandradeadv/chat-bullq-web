'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, Check, FileText, Handshake, Loader2, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { acordosService, type Acordo, type AcordoParcela, type SalvarAcordoInput } from '@/features/financeiro/services/acordos.service';
import { financeiroService } from '@/features/financeiro/services/financeiro.service';
import { maskCurrencyBR, parseCurrencyBR, currencyToInput } from '@/lib/masks';

const INPUT = 'h-9 w-full rounded-lg border border-[#cfe0ed] bg-white px-2.5 text-sm text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';
// 🚨 RÓTULO EM CAIXA NORMAL, não em CAIXA-ALTA com `tracking-wide`. A gaveta do
// card tem 420px de coluna (case-detail-drawer.tsx), e caixa-alta espaçada gasta
// ~30% mais largura: "REEMBOLSO AO ESCRITÓRIO" quebrava em três linhas e colava
// no campo vizinho. Os campos das outras fases (FaseFields) já são caixa normal.
const LABEL = 'mb-1 block text-[11px] font-medium leading-tight text-[#6C757D] dark:text-zinc-400';
const brl = (n: number | null | undefined) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** DD/MM/YYYY → YYYY-MM-DD (valor do <input type=date>). */
const brToInput = (d?: string | null) => {
  const m = String(d ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};
/** YYYY-MM-DD → DD/MM/YYYY (o que a API grava). */
const inputToBr = (d?: string | null) => {
  const m = String(d ?? '').match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
const hojeInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const venceu = (venc: string) => {
  const iso = brToInput(venc);
  return !!iso && iso < hojeInput();
};

type Form = {
  valorTotal: string;
  forma: 'avista' | 'parcelado';
  nParcelas: string;
  diaVencimento: string;
  dataPrimeira: string;         // YYYY-MM-DD
  entrada: string;
  dataEntrada: string;
  tipo: 'judicial' | 'extrajudicial';
  homologado: '' | 'Sim' | 'Não' | 'Aguardando';
  dataHomologacao: string;
  dataAcordo: string;
  pagador: string;
  multaAtraso: string;
  vencimentoAntecipado: boolean;
  obrigacoes: string;
  obs: string;
  honorariosPct: string;
  honorarios: string;
  sucumbencia: string;
  reembolsoEscritorio: string;
  retencoes: string;
  clienteRecebeuDireto: boolean;
  conta: string;
};

const vazio = (pctSugerido: number): Form => ({
  valorTotal: '', forma: 'parcelado', nParcelas: '1', diaVencimento: '', dataPrimeira: hojeInput(),
  entrada: '', dataEntrada: '', tipo: 'judicial', homologado: '', dataHomologacao: '', dataAcordo: hojeInput(),
  pagador: '', multaAtraso: '', vencimentoAntecipado: false, obrigacoes: '', obs: '',
  honorariosPct: String(pctSugerido), honorarios: '', sucumbencia: '', reembolsoEscritorio: '', retencoes: '',
  clienteRecebeuDireto: false, conta: '',
});

const doAcordo = (a: Acordo): Form => ({
  valorTotal: currencyToInput(a.valorTotal),
  forma: a.forma,
  nParcelas: String(a.nParcelas ?? 1),
  diaVencimento: a.diaVencimento ? String(a.diaVencimento) : '',
  dataPrimeira: brToInput(a.dataPrimeira) || hojeInput(),
  entrada: a.entrada ? currencyToInput(a.entrada) : '',
  dataEntrada: brToInput(a.dataEntrada),
  tipo: a.tipo,
  homologado: a.homologado ?? '',
  dataHomologacao: brToInput(a.dataHomologacao),
  dataAcordo: brToInput(a.dataAcordo),
  pagador: a.pagador ?? '',
  multaAtraso: a.multaAtraso ? String(a.multaAtraso) : '',
  vencimentoAntecipado: !!a.vencimentoAntecipado,
  obrigacoes: a.obrigacoes ?? '',
  obs: a.obs ?? '',
  honorariosPct: a.honorariosPct ? String(a.honorariosPct) : '',
  honorarios: a.honorarios ? currencyToInput(a.honorarios) : '',
  sucumbencia: a.sucumbencia ? currencyToInput(a.sucumbencia) : '',
  reembolsoEscritorio: a.reembolsoEscritorio ? currencyToInput(a.reembolsoEscritorio) : '',
  retencoes: a.retencoes ? currencyToInput(a.retencoes) : '',
  clienteRecebeuDireto: !!a.clienteRecebeuDireto,
  conta: a.conta ?? '',
});

type RepasseEdit = { tipo: 'parceiro' | 'socio' | 'associado'; nome: string; userId: string | null; modo: 'pct' | 'valor'; pct: string; valor: string };

/**
 * ACORDO do processo — valor, parcelamento, dia de vencimento, divisão (cliente ×
 * escritório × parceiro) e o cronograma com o recebimento de cada parcela.
 *
 * Por que não são campos de fase como nas outras colunas: acordo é o único recebível
 * PARCELADO do escritório. Parcela tem vencimento, atrasa, é recebida uma a uma e
 * cada uma gera prestação de contas própria — isso é tabela viva, não formulário.
 *
 * Marcar uma parcela como recebida LANÇA no livro-razão (honorário nosso com o rateio
 * da prestação, a parte do cliente e o repasse a pagar). O botão de estorno desfaz
 * exatamente esses lançamentos: quem recebe errado conserta no mesmo lugar, sem SQL.
 */
export function AcordoPanel({ caseId, podeLancar }: { caseId: string; podeLancar: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['acordo', caseId],
    queryFn: () => acordosService.painel(caseId),
    staleTime: 30_000,
  });

  const acordo = data?.acordo ?? null;
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Form>(vazio(40));
  const [repasses, setRepasses] = useState<RepasseEdit[]>([]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Carrega o formulário com o que está gravado (ou o sugerido, quando é novo).
  //
  // 🚨 NÃO mexe enquanto o formulário está ABERTO. O react-query refaz a busca ao
  // voltar o foco na janela, e sem esta trava quem abrisse o PDF do acordo em outra
  // aba para conferir um número voltava com tudo o que digitou apagado.
  useEffect(() => {
    if (!data || editando) return;
    setForm(acordo ? doAcordo(acordo) : vazio(data.contexto.honorariosPctSugerido));
    setRepasses(
      (acordo?.repasses ?? []).map((r) => ({
        tipo: r.tipo, nome: r.nome, userId: r.userId ?? null,
        modo: Number(r.pct) > 0 ? 'pct' : 'valor',
        pct: Number(r.pct) > 0 ? String(r.pct) : '',
        valor: Number(r.valor) > 0 ? currencyToInput(r.valor) : '',
      })),
    );
  }, [data, acordo, editando]);

  const salvar = useMutation({
    mutationFn: async (): Promise<void> => {
      const valorTotal = parseCurrencyBR(form.valorTotal);
      if (!valorTotal || valorTotal <= 0) throw new Error('Informe o valor do acordo.');
      const dto: SalvarAcordoInput = {
        valorTotal,
        forma: form.forma,
        nParcelas: form.forma === 'avista' ? 1 : Math.max(1, parseInt(form.nParcelas || '1', 10) || 1),
        diaVencimento: form.diaVencimento ? Math.min(31, Math.max(1, parseInt(form.diaVencimento, 10))) : null,
        dataPrimeira: inputToBr(form.dataPrimeira) || undefined,
        entrada: parseCurrencyBR(form.entrada) ?? 0,
        dataEntrada: inputToBr(form.dataEntrada) || null,
        tipo: form.tipo,
        homologado: form.homologado || null,
        dataHomologacao: inputToBr(form.dataHomologacao) || null,
        dataAcordo: inputToBr(form.dataAcordo) || null,
        pagador: form.pagador.trim() || null,
        obrigacoes: form.obrigacoes.trim() || null,
        multaAtraso: form.multaAtraso ? Number(form.multaAtraso) : null,
        vencimentoAntecipado: form.vencimentoAntecipado,
        obs: form.obs.trim() || null,
        honorariosPct: form.honorariosPct ? Number(form.honorariosPct) : null,
        honorarios: parseCurrencyBR(form.honorarios) ?? 0,
        sucumbencia: parseCurrencyBR(form.sucumbencia) ?? 0,
        reembolsoEscritorio: parseCurrencyBR(form.reembolsoEscritorio) ?? 0,
        retencoes: parseCurrencyBR(form.retencoes) ?? 0,
        clienteRecebeuDireto: form.clienteRecebeuDireto,
        conta: form.conta || null,
        repasses: repasses
          .filter((r) => r.nome.trim())
          .map((r) => ({
            tipo: r.tipo, nome: r.nome.trim(), userId: r.userId,
            pct: r.modo === 'pct' && r.pct ? Number(r.pct) : null,
            valor: r.modo === 'valor' ? parseCurrencyBR(r.valor) : null,
          })),
      };
      const res = await acordosService.salvar(caseId, dto);
      if (res.movido) toast.success('Acordo salvo — card movido para a coluna ACORDO.');
      else toast.success('Acordo salvo.');
    },
    onSuccess: () => {
      setEditando(false);
      qc.invalidateQueries({ queryKey: ['acordo', caseId] });
      qc.invalidateQueries({ queryKey: ['legal-cases'] });
      qc.invalidateQueries({ queryKey: ['legal-case', caseId] });
      qc.invalidateQueries({ queryKey: ['financeiro'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.message || 'Não consegui salvar o acordo.'),
  });

  const invalidarTudo = () => {
    qc.invalidateQueries({ queryKey: ['acordo', caseId] });
    qc.invalidateQueries({ queryKey: ['legal-cases'] });
    qc.invalidateQueries({ queryKey: ['financeiro'] });
  };

  if (isLoading) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#cfe0ed] p-3 text-xs text-zinc-400 dark:border-zinc-800">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> carregando acordo…
      </div>
    );
  }
  if (!data) return null;

  const d = data.divisao;
  const st = data.estado;
  const pctRecebido = acordo && acordo.valorTotal > 0 ? Math.round(((st?.recebido ?? 0) / acordo.valorTotal) * 100) : 0;

  return (
    // 🚨 `@container` + variantes `@sm/@lg`: os breakpoints do Tailwind (sm:, lg:)
    // medem a JANELA, e este painel vive numa coluna de 420px dentro de uma tela
    // de 2000px — `sm:grid-cols-4` enfiava quatro campos em 380px e cortava
    // "Parcelado" em "Parce…". Container query mede a largura REAL do painel.
    <div className="@container mt-4 rounded-lg border border-[#cfe0ed] p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#6C757D]">
          <Handshake className="h-3.5 w-3.5" /> Acordo
          {st && <StatusBadge status={st.status} />}
        </p>
        {podeLancar && (
          <div className="flex items-center gap-2">
            {acordo && !editando && (
              <button onClick={() => setEditando(true)} className="rounded-lg border border-[#DEE2E6] px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-200">
                Editar termos
              </button>
            )}
            {!acordo && !editando && (
              <button onClick={() => setEditando(true)} className="inline-flex items-center gap-1 rounded-lg bg-[#02883C] px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90">
                <Plus className="h-3 w-3" /> Registrar acordo
              </button>
            )}
          </div>
        )}
      </div>

      {!acordo && !editando && (
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          {podeLancar
            ? 'Fizemos acordo neste processo? Registre aqui o valor, o parcelamento e o dia de pagamento — cada parcela recebida entra no financeiro e gera a prestação de contas ao cliente.'
            : 'Nenhum acordo registrado neste processo.'}
        </p>
      )}

      {/* ── Resumo: a conta do acordo e o andamento do cronograma ───────────── */}
      {acordo && d && st && !editando && (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg bg-[#f7fafc] p-2.5 dark:bg-zinc-800/40">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {acordo.forma === 'avista' ? 'À vista' : `${st.nParcelasTotal}× ${acordo.diaVencimento ? `todo dia ${acordo.diaVencimento}` : 'mensal'}`}
                  {acordo.homologado === 'Sim' ? ' · homologado' : acordo.homologado === 'Aguardando' ? ' · aguardando homologação' : ''}
                  {acordo.parceria ? ` · parceria ${acordo.parceria.nome}` : ''}
                </p>
                <p className="text-xl font-bold tabular-nums text-[#101820] dark:text-zinc-100">{brl(acordo.valorTotal)}</p>
              </div>
              <div className="text-right text-[11px] tabular-nums">
                <p className="text-emerald-600 dark:text-emerald-400">recebido {brl(st.recebido)}</p>
                <p className="text-amber-600 dark:text-amber-400">falta {brl(st.aReceber)}</p>
                {st.atrasado > 0 && <p className="font-semibold text-red-600 dark:text-red-400">atrasado {brl(st.atrasado)} ({st.nAtrasadas})</p>}
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pctRecebido}%` }} />
            </div>
          </div>

          {/* A divisão — a mesma cascata da prestação de contas do alvará */}
          <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 @xs:grid-cols-2 @xl:grid-cols-3 @3xl:grid-cols-4">
            <Mini label="Cliente (líquido)" valor={d.clienteLiquido} cor="#228BE6" />
            <Mini label={`Contratual${d.honorariosPct ? ` ${d.honorariosPct}%` : ''}`} valor={d.honorarios} cor="#2F9E44" />
            <Mini label="Sucumbência" valor={d.sucumbencia} cor="#7048E8" />
            <Mini label="Nosso (bruto)" valor={d.nosso} cor="#101820" />
          </div>
          {(d.repasses.length > 0 || d.retencoes > 0 || d.reembolsoEscritorio > 0) && (
            <div className="space-y-1 rounded-lg border border-dashed border-[#cfe0ed] p-2 text-[11px] dark:border-zinc-700">
              {d.reembolsoEscritorio > 0 && <Linha label="Reembolso de despesas do escritório" valor={d.reembolsoEscritorio} />}
              {d.retencoes > 0 && <Linha label="Retenções da parte do cliente (IR / INSS / custas)" valor={-d.retencoes} />}
              {d.repasses.map((r, i) => (
                <Linha key={i} label={`Repasse a ${r.nome}${r.pct ? ` (${r.pct}% do nosso)` : ''}`} valor={-r.valorCalculado} />
              ))}
              {d.repasses.length > 0 && <Linha label="Fica com o escritório" valor={d.escritorio} forte />}
            </div>
          )}
          {d.excedeCliente && (
            <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              O escritório está ficando com mais que o cliente ({brl(d.nosso)} contra {brl(d.clienteLiquido)}) — art. 50 do Código de Ética. Confira o percentual antes de prestar contas.
            </p>
          )}
          {(acordo.obrigacoes || acordo.obs || acordo.pagador || acordo.multaAtraso) && (
            <div className="space-y-1 text-[11px] text-zinc-600 dark:text-zinc-300">
              {acordo.pagador && <p><span className="text-zinc-400">Quem paga:</span> {acordo.pagador}</p>}
              {acordo.multaAtraso ? <p><span className="text-zinc-400">Multa por atraso:</span> {acordo.multaAtraso}%{acordo.vencimentoAntecipado ? ' · vencimento antecipado das demais' : ''}</p> : null}
              {acordo.obrigacoes && <p className="whitespace-pre-wrap"><span className="text-zinc-400">Obrigações:</span> {acordo.obrigacoes}</p>}
              {acordo.obs && <p className="whitespace-pre-wrap"><span className="text-zinc-400">Observações:</span> {acordo.obs}</p>}
              {acordo.cancelado && <p className="font-semibold text-red-600 dark:text-red-400">Acordo cancelado{acordo.canceladoMotivo ? `: ${acordo.canceladoMotivo}` : ''}</p>}
            </div>
          )}

          <Cronograma
            caseId={caseId}
            acordo={acordo}
            podeLancar={podeLancar && data.contexto.podeLancar}
            contas={data.contexto.contas}
            onMudou={invalidarTudo}
          />

          {podeLancar && (
            <div className="flex flex-wrap gap-2 border-t border-[#eef0f3] pt-2 dark:border-zinc-800">
              {!acordo.cancelado && (
                <button
                  onClick={async () => {
                    const motivo = window.prompt('Acordo descumprido — qual o motivo? (fica no histórico do card)');
                    if (motivo == null) return;
                    try { await acordosService.cancelar(caseId, motivo); toast.success('Acordo marcado como descumprido.'); invalidarTudo(); }
                    catch (e: any) { toast.error(e?.response?.data?.message || 'Não consegui cancelar.'); }
                  }}
                  className="rounded-lg border border-[#DEE2E6] px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:border-amber-500 dark:border-zinc-700 dark:text-amber-400"
                >
                  Marcar descumprido
                </button>
              )}
              <button
                onClick={async () => {
                  if (!window.confirm('Excluir o acordo deste processo? As parcelas já recebidas precisam ser estornadas antes.')) return;
                  try { await acordosService.excluir(caseId); toast.success('Acordo excluído.'); invalidarTudo(); }
                  catch (e: any) { toast.error(e?.response?.data?.message || 'Não consegui excluir.'); }
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-[#DEE2E6] px-2.5 py-1 text-[11px] font-medium text-red-600 hover:border-red-400 dark:border-zinc-700 dark:text-red-400"
              >
                <Trash2 className="h-3 w-3" /> Excluir acordo
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Formulário dos termos ────────────────────────────────────────────── */}
      {editando && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 @xs:grid-cols-2 @xl:grid-cols-3 @3xl:grid-cols-4">
            <div>
              <label className={LABEL}>Valor do acordo</label>
              <input value={form.valorTotal} onChange={(e) => set('valorTotal', maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Pagamento</label>
              <select value={form.forma} onChange={(e) => set('forma', e.target.value as Form['forma'])} className={INPUT}>
                <option value="avista">À vista</option>
                <option value="parcelado">Parcelado</option>
              </select>
            </div>
            {form.forma === 'parcelado' && (
              <div>
                <label className={LABEL}>Parcelas</label>
                <input value={form.nParcelas} onChange={(e) => set('nParcelas', e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="12" className={INPUT} />
              </div>
            )}
            <div>
              <label className={LABEL}>Dia do vencimento</label>
              <input value={form.diaVencimento} onChange={(e) => set('diaVencimento', e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="10" className={INPUT} title="Dia do mês em que cada parcela vence. Em branco, conta mês a mês a partir da 1ª parcela." />
            </div>
            <div>
              <label className={LABEL}>{form.forma === 'avista' ? 'Data do pagamento' : '1ª parcela'}</label>
              <input type="date" value={form.dataPrimeira} onChange={(e) => set('dataPrimeira', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Entrada / sinal</label>
              <input value={form.entrada} onChange={(e) => set('entrada', maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} title="Sinal pago fora do parcelamento (ex.: na audiência). Entra como a 1ª linha do cronograma." />
            </div>
            {parseCurrencyBR(form.entrada) ? (
              <div>
                <label className={LABEL}>Data da entrada</label>
                <input type="date" value={form.dataEntrada} onChange={(e) => set('dataEntrada', e.target.value)} className={INPUT} />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 @xs:grid-cols-2 @xl:grid-cols-3 @3xl:grid-cols-4">
            <div>
              <label className={LABEL}>Acordo</label>
              <select value={form.tipo} onChange={(e) => set('tipo', e.target.value as Form['tipo'])} className={INPUT}>
                <option value="judicial">Judicial (nos autos)</option>
                <option value="extrajudicial">Extrajudicial</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Homologado?</label>
              <select value={form.homologado} onChange={(e) => set('homologado', e.target.value as Form['homologado'])} className={INPUT}>
                <option value="">—</option>
                <option value="Sim">Sim</option>
                <option value="Aguardando">Aguardando</option>
                <option value="Não">Não</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Data do acordo</label>
              <input type="date" value={form.dataAcordo} onChange={(e) => set('dataAcordo', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Homologação</label>
              <input type="date" value={form.dataHomologacao} onChange={(e) => set('dataHomologacao', e.target.value)} className={INPUT} />
            </div>
          </div>

          {/* Divisão do dinheiro */}
          <div className="rounded-lg border border-dashed border-[#cfe0ed] p-2.5 dark:border-zinc-700">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6C757D]">A divisão</p>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 @xs:grid-cols-2 @xl:grid-cols-3 @3xl:grid-cols-4">
              <div>
                <label className={LABEL}>Contratual (%)</label>
                <input value={form.honorariosPct} onChange={(e) => set('honorariosPct', e.target.value.replace(/[^\d]/g, '').slice(0, 2))} inputMode="numeric" placeholder="40" className={INPUT} title="Percentual do contrato sobre o proveito do cliente." />
              </div>
              <div>
                <label className={LABEL}>Contratual (R$)</label>
                <input value={form.honorarios} onChange={(e) => set('honorarios', maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="calculado do %" className={INPUT} title="Preencha só para REDUZIR o honorário abaixo do percentual do contrato (art. 50 do CED). Sem o %, vale como valor fixo." />
              </div>
              <div>
                <label className={LABEL}>Sucumbência</label>
                <input value={form.sucumbencia} onChange={(e) => set('sucumbencia', maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} title="Honorários de sucumbência fixados no acordo — nossos por lei, saem do bruto antes do contratual." />
              </div>
              <div>
                <label className={LABEL}>Reembolso ao escritório</label>
                <input value={form.reembolsoEscritorio} onChange={(e) => set('reembolsoEscritorio', maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} title="Custas, perícia e diligência que o escritório adiantou e voltam para nós." />
              </div>
              <div>
                <label className={LABEL}>Retenções (IR/INSS)</label>
                <input value={form.retencoes} onChange={(e) => set('retencoes', maskCurrencyBR(e.target.value))} inputMode="decimal" placeholder="R$ 0,00" className={INPUT} title="Tributo e custa que saem da parte do CLIENTE, depois do honorário." />
              </div>
              <div>
                <label className={LABEL}>Conta onde cai</label>
                <select value={form.conta} onChange={(e) => set('conta', e.target.value)} className={INPUT}>
                  <option value="">—</option>
                  {data.contexto.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Multa por atraso (%)</label>
                <input value={form.multaAtraso} onChange={(e) => set('multaAtraso', e.target.value.replace(/[^\d]/g, '').slice(0, 3))} inputMode="numeric" placeholder="2" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Quem paga</label>
                <input value={form.pagador} onChange={(e) => set('pagador', e.target.value)} placeholder="parte adversa" className={INPUT} />
              </div>
            </div>
            <label className="mt-2 flex items-start gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={form.clienteRecebeuDireto} onChange={(e) => set('clienteRecebeuDireto', e.target.checked)} className="mt-0.5" />
              <span>O cliente recebe <strong>direto</strong> da parte adversa — o dinheiro dele não passa pela nossa conta (não nasce repasse a pagar).</span>
            </label>
            <label className="mt-1.5 flex items-start gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={form.vencimentoAntecipado} onChange={(e) => set('vencimentoAntecipado', e.target.checked)} className="mt-0.5" />
              <span>Atraso de uma parcela vence antecipadamente as demais (cláusula de vencimento antecipado).</span>
            </label>
          </div>

          {/* Repasse a parceiros */}
          <div className="rounded-lg border border-dashed border-[#cfe0ed] p-2.5 dark:border-zinc-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6C757D]">
                <Users className="h-3.5 w-3.5" /> Repasse a parceiros
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.contexto.parceria && (
                  <button
                    type="button"
                    onClick={() => {
                      const p = data.contexto.parceria!;
                      const membros = p.membros.length ? p.membros : [{ nome: p.nome, userId: null, pct: null }];
                      setRepasses(membros.map((m) => ({
                        tipo: m.userId ? 'socio' : 'parceiro',
                        nome: m.nome,
                        userId: m.userId,
                        modo: 'pct',
                        // Fatia individual do membro dentro da parte do parceiro; sem ela,
                        // divide igual — é a regra do próprio cadastro da parceria.
                        pct: String(m.pct != null ? Math.round(p.partnerPct * (m.pct / 100)) : Math.round(p.partnerPct / membros.length)),
                        valor: '',
                      })));
                    }}
                    className="rounded-lg border border-[#DEE2E6] px-2 py-0.5 text-[10px] font-medium text-zinc-700 hover:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-200"
                    title={`Parceria ${data.contexto.parceria.nome}: ${data.contexto.parceria.partnerPct}% do resultado é do parceiro`}
                  >
                    Usar a parceria ({data.contexto.parceria.partnerPct}%)
                  </button>
                )}
                {data.contexto.splitSugerido.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRepasses(data.contexto.splitSugerido.map((s) => ({ tipo: 'socio', nome: s.nome, userId: s.userId, modo: 'pct', pct: String(s.pct), valor: '' })))}
                    className="rounded-lg border border-[#DEE2E6] px-2 py-0.5 text-[10px] font-medium text-zinc-700 hover:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-200"
                    title="Mesmo rateio entre sócios que o alvará usa (configurado no Financeiro)"
                  >
                    Usar o rateio dos sócios
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRepasses((r) => [...r, { tipo: 'parceiro', nome: '', userId: null, modo: 'pct', pct: '', valor: '' }])}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#DEE2E6] px-2 py-0.5 text-[10px] font-medium text-zinc-700 hover:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-200"
                >
                  <Plus className="h-3 w-3" /> Parceiro
                </button>
              </div>
            </div>
            {repasses.length === 0 ? (
              <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                Sem repasse: o honorário fica inteiro com o escritório.
              </p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {repasses.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-1.5">
                    <input
                      value={r.nome}
                      onChange={(e) => setRepasses((xs) => xs.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                      placeholder="Nome do parceiro / advogado"
                      className={INPUT + ' col-span-3 min-w-0'}
                    />
                    <select
                      value={r.modo}
                      onChange={(e) => setRepasses((xs) => xs.map((x, j) => (j === i ? { ...x, modo: e.target.value as 'pct' | 'valor' } : x)))}
                      className="h-9 w-full min-w-0 rounded-lg border border-[#cfe0ed] bg-white px-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      <option value="pct">% do nosso</option>
                      <option value="valor">valor fixo</option>
                    </select>
                    {r.modo === 'pct' ? (
                      <input
                        value={r.pct}
                        onChange={(e) => setRepasses((xs) => xs.map((x, j) => (j === i ? { ...x, pct: e.target.value.replace(/[^\d]/g, '').slice(0, 3) } : x)))}
                        inputMode="numeric" placeholder="70"
                        className="h-9 w-16 rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      />
                    ) : (
                      <input
                        value={r.valor}
                        onChange={(e) => setRepasses((xs) => xs.map((x, j) => (j === i ? { ...x, valor: maskCurrencyBR(e.target.value) } : x)))}
                        inputMode="decimal" placeholder="R$ 0,00"
                        className="h-9 w-28 rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      />
                    )}
                    <button type="button" onClick={() => setRepasses((xs) => xs.filter((_, j) => j !== i))} className="rounded p-1 text-zinc-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  O % incide sobre o <strong>nosso</strong> (sucumbência + contratual) de cada parcela. A fatia vira linha de rateio no lançamento — o pagamento e o espelho em PDF saem pelo botão de repasse no Financeiro.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className={LABEL}>Obrigações combinadas (baixa na CTPS, carta de referência, abstenção…)</label>
            <textarea value={form.obrigacoes} onChange={(e) => set('obrigacoes', e.target.value)} rows={2} className="w-full rounded-lg border border-[#cfe0ed] bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-200" />
          </div>
          <div>
            <label className={LABEL}>Observações</label>
            <textarea value={form.obs} onChange={(e) => set('obs', e.target.value)} rows={2} className="w-full rounded-lg border border-[#cfe0ed] bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:text-zinc-200" />
          </div>

          {acordo && (st?.nRecebidas ?? 0) > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg bg-[#eef4fa] p-2 text-[11px] text-[#1b6ec2] dark:bg-zinc-800/60 dark:text-[#7db2e8]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {st!.nRecebidas} parcela(s) já recebida(s) e lançada(s): elas não serão alteradas. O cronograma é refeito só nas parcelas abertas, com o saldo que falta.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => salvar.mutate()}
              disabled={salvar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#02883C] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {salvar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {acordo ? 'Salvar acordo' : 'Criar acordo e gerar parcelas'}
            </button>
            <button onClick={() => setEditando(false)} className="rounded-lg border border-[#DEE2E6] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: 'ativo' | 'inadimplente' | 'quitado' | 'cancelado' }) {
  const cfg = {
    ativo: { txt: 'em pagamento', cls: 'bg-[#228BE6]/10 text-[#1b6ec2] dark:text-[#7db2e8]' },
    inadimplente: { txt: 'parcela atrasada', cls: 'bg-red-500/10 text-red-700 dark:text-red-400' },
    quitado: { txt: 'quitado', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
    cancelado: { txt: 'descumprido', cls: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300' },
  }[status];
  return <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${cfg.cls}`}>{cfg.txt}</span>;
}

function Mini({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="rounded-lg border border-[#eef0f3] p-2 dark:border-zinc-800">
      <p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color: cor }}>{brl(valor)}</p>
    </div>
  );
}

function Linha({ label, valor, forte }: { label: string; valor: number; forte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${forte ? 'font-semibold' : ''}`}>
      <span className="text-zinc-600 dark:text-zinc-300">{label}</span>
      <span className={`tabular-nums ${valor < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-100'}`}>{brl(valor)}</span>
    </div>
  );
}

/**
 * O CRONOGRAMA. Cada linha é uma parcela: vencimento, valor, estado. Receber lança no
 * financeiro; estornar desfaz. Na parcela já recebida aparece a prestação de contas
 * DAQUELA parcela — é o documento que o cliente recebe a cada entrada, com o saldo
 * que ainda falta.
 */
function Cronograma({
  caseId, acordo, podeLancar, contas, onMudou,
}: {
  caseId: string;
  acordo: Acordo;
  podeLancar: boolean;
  contas: Array<{ id: string; nome: string }>;
  onMudou: () => void;
}) {
  // Parceiros que entram no rateio de CADA parcela: é para eles que sai a prestação
  // do parceiro (o espelho do documento que o cliente recebe, terminando na fatia dele).
  const parceiros = (acordo.repasses ?? []).filter((r) => String(r.nome || '').trim());
  const [abrindo, setAbrindo] = useState<number | null>(null);
  const [data, setData] = useState(hojeInput());
  const [valor, setValor] = useState('');
  const [conta, setConta] = useState(acordo.conta ?? '');
  const [busy, setBusy] = useState<number | null>(null);
  const [pcLoad, setPcLoad] = useState<number | null>(null);
  const [rpLoad, setRpLoad] = useState<string | null>(null);

  const parcelas = useMemo(() => acordo.parcelas ?? [], [acordo]);

  const receber = async (p: AcordoParcela) => {
    setBusy(p.num);
    try {
      const v = parseCurrencyBR(valor);
      const res = await acordosService.receberParcela(caseId, p.num, {
        dataPagamento: inputToBr(data) || undefined,
        valor: v && v > 0 ? v : undefined,
        conta: conta || null,
      });
      setAbrindo(null);
      setValor('');
      toast.success(res.quitado ? 'Parcela recebida — acordo QUITADO.' : 'Parcela recebida e lançada no financeiro.');
      onMudou();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Não consegui lançar a parcela.');
    } finally { setBusy(null); }
  };

  const estornar = async (p: AcordoParcela) => {
    if (!window.confirm(`Estornar a parcela ${p.num}? Os lançamentos criados no financeiro serão apagados.`)) return;
    setBusy(p.num);
    try {
      await acordosService.estornarParcela(caseId, p.num);
      toast.success('Parcela estornada.');
      onMudou();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui estornar.');
    } finally { setBusy(null); }
  };

  const prestacao = async (p: AcordoParcela) => {
    if (!p.txId) { toast.error('Esta parcela não tem lançamento de honorário — sem ele não há prestação de contas.'); return; }
    setPcLoad(p.num);
    try {
      const dados = await financeiroService.prestacaoDados(p.txId);
      const { gerarPrestacaoPdf } = await import('@/features/financeiro/lib/prestacao-pdf');
      const blob = await gerarPrestacaoPdf(dados, (nomes) => toast(`Não consegui anexar ao PDF: ${nomes.join(', ')}.`, { icon: '⚠️', duration: 9000 }));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao gerar a prestação de contas.');
    } finally { setPcLoad(null); }
  };

  /**
   * PRESTAÇÃO DE CONTAS DO PARCEIRO — o espelho, para quem dividiu o trabalho, do
   * documento que o cliente recebe: termina na fatia DELE e diz de onde veio cada
   * parcela do honorário. Mesmo gerador que o repasse do alvará já usa; aqui ele só
   * passa a estar à mão na parcela, em vez de obrigar a caçar o lançamento no razão.
   */
  const prestacaoParceiro = async (p: AcordoParcela, nome: string, userId?: string | null) => {
    if (!p.txId) { toast.error('Esta parcela não tem lançamento — sem ele não há o que repassar.'); return; }
    const chave = `${p.num}:${nome}`;
    setRpLoad(chave);
    try {
      const d = await financeiroService.repasseAdvogado(p.txId, userId ?? null, nome);
      const { gerarRepasseAdvogadoPdf, nomeRepasseAdvogadoPdf } = await import('@/features/financeiro/lib/repasse-advogado-pdf');
      const blob = await gerarRepasseAdvogadoPdf(d);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nomeRepasseAdvogadoPdf(d); a.click();
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao gerar a prestação do parceiro.');
    } finally { setRpLoad(null); }
  };

  if (!parcelas.length) return null;

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6C757D]">
        <CalendarClock className="h-3.5 w-3.5" /> Cronograma
      </p>
      <div className="overflow-x-auto rounded-lg border border-[#eef0f3] dark:border-zinc-800">
        <table className="w-full min-w-[300px] text-left text-[11px]">
          <thead className="bg-[#f7fafc] text-[10px] uppercase tracking-wide text-zinc-400 dark:bg-zinc-800/60">
            <tr>
              <th className="px-1.5 py-1.5">Parcela</th>
              <th className="px-1.5 py-1.5 text-right">Valor</th>
              <th className="px-1.5 py-1.5">Situação</th>
              <th className="px-1.5 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {parcelas.map((p) => {
              const atrasada = p.status === 'aberta' && venceu(p.vencimento);
              return (
                <tr key={p.num} className="border-t border-[#eef0f3] dark:border-zinc-800">
                  <td className={`px-1.5 py-1.5 whitespace-nowrap tabular-nums ${atrasada ? 'font-semibold text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-300'}`}>
                    <span className="mr-1 text-zinc-400">{p.entrada ? 'E' : p.num}</span>{p.vencimento}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-medium tabular-nums whitespace-nowrap text-[#101820] dark:text-zinc-100">{brl(p.valor)}</td>
                  <td className="px-1.5 py-1.5">
                    {p.status === 'recebida' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" /> recebida {p.dataPagamento ?? ''}
                      </span>
                    ) : p.status === 'cancelada' ? (
                      <span className="text-zinc-400">cancelada</span>
                    ) : atrasada ? (
                      <span className="font-semibold text-red-600 dark:text-red-400">atrasada</span>
                    ) : (
                      <span className="text-zinc-400">aberta</span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {p.status === 'recebida' && (
                        <>
                          <button
                            onClick={() => prestacao(p)}
                            disabled={pcLoad === p.num}
                            title="Prestação de contas desta parcela (PDF) — com o saldo que ainda falta"
                            className="inline-flex items-center gap-1 rounded border border-[#DEE2E6] px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 hover:border-[#4a90e2] disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
                          >
                            {pcLoad === p.num ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="hidden h-3 w-3 @md:inline" />} cliente
                          </button>
                          {parceiros.map((rp) => (
                            <button
                              key={rp.nome}
                              onClick={() => prestacaoParceiro(p, rp.nome, rp.userId)}
                              disabled={rpLoad === `${p.num}:${rp.nome}`}
                              title={`Prestação de contas do parceiro ${rp.nome} desta parcela (PDF): a fatia dele e de onde veio cada parte do honorário`}
                              className="inline-flex items-center gap-1 rounded border border-[#DEE2E6] px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 hover:border-[#4a90e2] disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
                            >
                              {rpLoad === `${p.num}:${rp.nome}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="hidden h-3 w-3 @md:inline" />} {rp.nome.split(' ')[0].toLowerCase()}
                            </button>
                          ))}
                          {podeLancar && (
                            <button
                              onClick={() => estornar(p)}
                              disabled={busy === p.num}
                              title="Estornar: apaga os lançamentos desta parcela no financeiro"
                              className="rounded border border-[#DEE2E6] p-1 text-zinc-500 hover:border-amber-400 hover:text-amber-600 disabled:opacity-60 dark:border-zinc-700"
                            >
                              {busy === p.num ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            </button>
                          )}
                        </>
                      )}
                      {p.status === 'aberta' && podeLancar && (
                        <button
                          onClick={() => { setAbrindo(abrindo === p.num ? null : p.num); setValor(currencyToInput(p.valor)); setData(hojeInput()); }}
                          className="rounded border border-[#DEE2E6] px-1.5 py-0.5 text-[10px] font-semibold text-[#02883C] hover:border-[#02883C] dark:border-zinc-700"
                        >
                          recebi
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {parceiros.length > 0 && (
        <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
          Os botões com o nome do parceiro geram a <strong>prestação de contas dele</strong> daquela parcela.
          O <strong>pagamento</strong> do repasse (a saída do caixa) continua saindo pelo botão “Repassar” no
          livro-razão, que é onde se anexa o comprovante do Pix.
        </p>
      )}

      {/* Confirmação do recebimento: data, valor efetivo e conta. O valor vem preenchido
          com o da parcela — parcela paga a menor é comum, e o razão tem de registrar o
          que entrou, não o que estava combinado. */}
      {abrindo != null && (
        <div className="mt-2 grid grid-cols-1 items-end gap-2 rounded-lg bg-[#f7fafc] p-2.5 @xs:grid-cols-2 dark:bg-zinc-800/40">
          <div>
            <label className={LABEL}>Recebido em</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
          </div>
          <div>
            <label className={LABEL}>Valor que entrou</label>
            <input value={valor} onChange={(e) => setValor(maskCurrencyBR(e.target.value))} inputMode="decimal" className="h-9 w-full min-w-0 rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
          </div>
          <div>
            <label className={LABEL}>Conta</label>
            <select value={conta} onChange={(e) => setConta(e.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-[#cfe0ed] bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <option value="">—</option>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <button
            onClick={() => { const p = parcelas.find((x) => x.num === abrindo); if (p) receber(p); }}
            disabled={busy != null}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#02883C] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 @xs:w-auto"
          >
            {busy != null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Lançar no financeiro
          </button>
          <button onClick={() => setAbrindo(null)} className="h-9 w-full rounded-lg border border-[#DEE2E6] px-3 text-xs font-medium text-zinc-600 @xs:w-auto dark:border-zinc-700 dark:text-zinc-300">
            Cancelar
          </button>
          <p className="w-full text-[10px] text-zinc-400 dark:text-zinc-500">
            Entra como honorário de êxito (com o rateio da prestação de contas), a parte do cliente e o <strong>repasse ao cliente a pagar</strong> — o Pix que ainda falta fazer.
          </p>
        </div>
      )}
    </div>
  );
}
