'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Check, RefreshCw, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService } from '../services/legal-cases.service';
import { financeiroService } from '@/features/financeiro/services/financeiro.service';
import { calculadoraCsService } from '@/features/calculadora-cs/services/calculadora-cs.service';

// Fases suportadas pelo "kanban vivo com preenchimento".
export type AvancoFase = 'cumprimento' | 'prestacao_contas' | 'transito' | 'acoes_vencidas' | 'acoes_perdidas';

const FASE_LABEL: Record<AvancoFase, string> = {
  cumprimento: '16. Cumprimento de Sentença',
  prestacao_contas: '17. Prestação de Contas',
  transito: '15. Trânsito em Julgado',
  acoes_vencidas: '18. Ações Vencidas',
  acoes_perdidas: '19. Ações Perdidas',
};

const inp =
  'w-full rounded-lg border border-[#DEE2E6] bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const lbl = 'mb-1 mt-3 block text-xs font-semibold uppercase tracking-wide text-[#6C757D]';

// Aceita tanto o formato de máquina dos inputs `type="number"` ("25014.34", ponto
// decimal) quanto o pt-BR vindo do hub/Pipefy ("25.014,34", ponto de milhar). ANTES
// removia TODO ponto e inflava o alvará ×100 (25014.34 → 2501434) — bug dos valores.
const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').replace(/[R$\s]/g, '');
  if (!s) return 0;
  // Só há vírgula quando é pt-BR: aí o ponto é milhar (remove) e a vírgula é decimal.
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Mini-form que MOVE o card para a fase e PREENCHE os campos dela (que o Financeiro
 * e o Meu Espaço já leem). Dispara por um PRAZO concluído (deadlineId) ou por BOTÃO
 * na ficha do processo (só caseId). Na prestação de contas, oferece lançar o
 * honorário de êxito no financeiro (só sócios).
 */
export function AvancoFaseModal({
  phase, caseId, caseTitle, deadlineId, fatal, podeLancarFinanceiro, onClose, onDone, onSoConcluir,
}: {
  phase: AvancoFase;
  caseId: string;
  caseTitle?: string | null;
  deadlineId?: string;
  fatal?: boolean;
  podeLancarFinanceiro?: boolean;
  onClose: () => void;
  onDone: (next?: AvancoFase) => void;
  onSoConcluir?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pct, setPct] = useState(40);
  // Desfecho terminal (ações vencidas/perdidas)
  const [resultado, setResultado] = useState('Procedente');
  const [valorRecebido, setValorRecebido] = useState('');
  const [motivo, setMotivo] = useState('');
  const [recorremos, setRecorremos] = useState('Não');

  // Cumprimento
  const [valorCalculo, setValorCalculo] = useState('');
  const [numeroCs, setNumeroCs] = useState('');
  const [protocolado, setProtocolado] = useState('Sim');
  const [extraindo, setExtraindo] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const alvaraRef = useRef<HTMLInputElement | null>(null);
  // Prestação de contas
  const [valorAlvara, setValorAlvara] = useState('');
  const [honorarios, setHonorarios] = useState('');
  const [honTocado, setHonTocado] = useState(false);
  const [sucumbencia, setSucumbencia] = useState('Não');
  const [valorSucumbencia, setValorSucumbencia] = useState('');
  const [valorCliente, setValorCliente] = useState('');
  const [cliTocado, setCliTocado] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [lancar, setLancar] = useState(!!podeLancarFinanceiro);
  // Trânsito
  const [transitou, setTransitou] = useState('Sim');
  const [vencemos, setVencemos] = useState('');
  const [obs, setObs] = useState('');

  // Pré-preenche a partir da sugestão do backend (cálculo/valor/pipefy/resultado).
  useEffect(() => {
    let vivo = true;
    legalCasesService.avancoSugestao(caseId, phase)
      .then((s) => {
        if (!vivo) return;
        const c = s.campos ?? {};
        if (typeof s.honorariosPct === 'number') setPct(s.honorariosPct);
        if (phase === 'cumprimento') {
          if (c.valor_calculo) setValorCalculo(String(num(c.valor_calculo) || ''));
          if (c.numero_cs) setNumeroCs(String(c.numero_cs));
          if (c.protocolado) setProtocolado(String(c.protocolado));
        } else if (phase === 'transito') {
          if (c.transitou) setTransitou(String(c.transitou));
          if (c.vencemos) setVencemos(String(c.vencemos));
        } else if (phase === 'acoes_vencidas') {
          if (c.resultado) setResultado(String(c.resultado));
          if (c.valor_recebido) setValorRecebido(String(num(c.valor_recebido) || ''));
        } else if (phase === 'acoes_perdidas') {
          if (c.recorremos) setRecorremos(String(c.recorremos));
        }
      })
      .catch(() => { /* segue com defaults */ })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prestação: honorários = alvará × pct e cliente = alvará − honorários (até você editar).
  useEffect(() => {
    if (phase !== 'prestacao_contas') return;
    const alv = num(valorAlvara);
    const hon = honTocado ? num(honorarios) : Math.round(alv * (pct / 100) * 100) / 100;
    if (!honTocado) setHonorarios(hon ? String(hon) : '');
    if (!cliTocado) { const cli = Math.round((alv - hon) * 100) / 100; setValorCliente(alv ? String(cli) : ''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorAlvara, honorarios, honTocado, cliTocado, pct, phase]);

  // Sobe a petição de CS (PDF) → IA extrai o valor exequendo + nº dos autos.
  const subirPeticaoCs = async (files: FileList | null) => {
    const arr = files ? Array.from(files) : [];
    if (!arr.length) return;
    setExtraindo(true);
    try {
      const r = await calculadoraCsService.extrairCumprimento(arr);
      if (r.valorCalculo) setValorCalculo(String(r.valorCalculo));
      if (r.numeroCs) setNumeroCs(r.numeroCs);
      toast[r.valorCalculo ? 'success' : 'info'](r.valorCalculo
        ? `Extraí o valor exequendo (${brl(r.valorCalculo)}) da petição`
        : (r.aviso || 'Não encontrei o valor na petição — preencha à mão.'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui ler a petição de CS.');
    } finally { setExtraindo(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  // Sobe o alvará de levantamento (PDF) → IA extrai o valor bruto e preenche o campo.
  const subirAlvara = async (files: FileList | null) => {
    const arr = files ? Array.from(files) : [];
    if (!arr.length) return;
    setExtraindo(true);
    try {
      const r = await calculadoraCsService.extrairAlvara(arr);
      if (r.valorAlvara) { setValorAlvara(String(r.valorAlvara)); setHonTocado(false); setCliTocado(false); }
      if (typeof r.honorariosPct === 'number') { setPct(r.honorariosPct); setHonTocado(false); setCliTocado(false); }
      if (r.sucumbencia) setSucumbencia(r.sucumbencia);
      if (r.valorSucumbencia) setValorSucumbencia(String(r.valorSucumbencia));
      const achou = [
        r.valorAlvara ? `alvará ${brl(r.valorAlvara)}` : null,
        typeof r.honorariosPct === 'number' ? `honorários ${r.honorariosPct}%` : null,
        r.sucumbencia === 'Sim' && r.valorSucumbencia ? `sucumbência ${brl(r.valorSucumbencia)}` : null,
      ].filter(Boolean);
      toast[achou.length ? 'success' : 'info'](achou.length
        ? `Sugeri: ${achou.join(' · ')}`
        : (r.aviso || 'Não encontrei os valores nos documentos — preencha à mão.'));
    } catch (e: any) {
      // O interceptor do axios (lib/api.ts) rejeita com um Error simples cuja `.message`
      // já traz a mensagem do backend — não há `e.response` aqui.
      toast.error(e?.message || e?.response?.data?.message || 'Não consegui ler o documento — tente o PDF do alvará, do comprovante de depósito ou da sentença.');
    } finally { setExtraindo(false); if (alvaraRef.current) alvaraRef.current.value = ''; }
  };

  const confirmar = async () => {
    setBusy(true);
    try {
      let campos: Record<string, unknown> = {};
      if (phase === 'cumprimento') {
        campos = { protocolado, valor_calculo: num(valorCalculo), numero_cs: numeroCs.trim() };
      } else if (phase === 'prestacao_contas') {
        campos = {
          valor_alvara: num(valorAlvara),
          honorarios_contratuais: num(honorarios),
          honorarios_pct: pct,
          sucumbencia,
          valor_sucumbencia: sucumbencia === 'Sim' ? num(valorSucumbencia) : 0,
          valor_cliente: num(valorCliente),
        };
      } else if (phase === 'transito') {
        campos = { transitou, vencemos, obs: obs.trim() };
      } else if (phase === 'acoes_vencidas') {
        campos = { resultado, valor_recebido: num(valorRecebido), obs: obs.trim() };
      } else {
        campos = { motivo: motivo.trim(), recorremos, obs: obs.trim() };
      }
      await legalCasesService.avancarFaseComCampos({
        deadlineId, caseId, targetPhase: phase, campos, confirmFatal: fatal,
      });

      // Prestação: opcionalmente lança o honorário de êxito no financeiro.
      if (phase === 'prestacao_contas' && lancar && podeLancarFinanceiro) {
        try {
          const r = await financeiroService.lancarHonorarioCaso(caseId);
          toast.success(`Movido para Prestação de Contas + honorário de ${brl(r.valor)} lançado nos Recebíveis`);
        } catch (e: any) {
          toast.success('Movido para Prestação de Contas');
          toast.error(e?.response?.data?.message || 'Não consegui lançar o honorário no financeiro — lance manualmente.');
        }
      } else {
        toast.success(`Card movido para "${FASE_LABEL[phase]}"`);
      }
      // Kanban vivo: após o TRÂNSITO, encadeia o desfecho conforme "vencemos"
      // (Não → Ações Perdidas; Sim/Parcial → Ações Vencidas) — pré-preenchido.
      const next: AvancoFase | undefined = phase === 'transito'
        ? (vencemos === 'Não' ? 'acoes_perdidas' : (vencemos === 'Sim' || vencemos === 'Parcial') ? 'acoes_vencidas' : undefined)
        : undefined;
      onDone(next);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao avançar o processo');
    } finally { setBusy(false); }
  };

  const aReceber = num(honorarios) + (sucumbencia === 'Sim' ? num(valorSucumbencia) : 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-[70] max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#202124] dark:text-zinc-100">{FASE_LABEL[phase]}</h3>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm text-zinc-500">{caseTitle ? `${caseTitle} — ` : ''}move o card e preenche os campos da fase (aparece no Financeiro e no Meu Espaço).</p>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-zinc-400"><RefreshCw className="h-4 w-4 animate-spin" /> carregando sugestões…</div>
        ) : phase === 'cumprimento' ? (
          <>
            <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => subirPeticaoCs(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} disabled={extraindo} className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#7048e8]/50 bg-[#7048e8]/5 px-3 py-2.5 text-sm font-medium text-[#7048e8] hover:bg-[#7048e8]/10 disabled:opacity-60">
              {extraindo ? <><RefreshCw className="h-4 w-4 animate-spin" /> lendo a petição com IA…</> : <><Paperclip className="h-4 w-4" /> Subir petição de CS (extrai o valor com IA)</>}
            </button>
            <label className={lbl}>Valor do cálculo (execução) <span className="font-normal normal-case text-zinc-400">— do cálculo salvo / da petição</span></label>
            <div className="flex items-center gap-2"><span className="text-sm text-zinc-400">R$</span><input type="number" step="0.01" value={valorCalculo} onChange={(e) => setValorCalculo(e.target.value)} placeholder="0,00" className={inp} /></div>
            <label className={lbl}>Número dos autos de cumprimento</label>
            <input value={numeroCs} onChange={(e) => setNumeroCs(e.target.value)} placeholder="0000000-00.0000.0.00.0000" className={inp} />
            <label className={lbl}>Cumprimento protocolado?</label>
            <Radio value={protocolado} onChange={setProtocolado} options={['Sim', 'Ainda não']} />
          </>
        ) : phase === 'prestacao_contas' ? (
          <>
            <input ref={alvaraRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => subirAlvara(e.target.files)} />
            <button
              onClick={() => alvaraRef.current?.click()}
              disabled={extraindo}
              onDragOver={(e) => { e.preventDefault(); if (!extraindo) setArrastando(true); }}
              onDragLeave={(e) => { e.preventDefault(); setArrastando(false); }}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); if (!extraindo) subirAlvara(e.dataTransfer.files); }}
              className={`mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm font-medium text-[#7048e8] transition-colors disabled:opacity-60 ${arrastando ? 'border-[#7048e8] bg-[#7048e8]/15 ring-2 ring-[#7048e8]/30' : 'border-[#7048e8]/50 bg-[#7048e8]/5 hover:bg-[#7048e8]/10'}`}
            >
              {extraindo ? <><RefreshCw className="h-4 w-4 animate-spin" /> lendo os documentos com IA…</>
                : arrastando ? <><Paperclip className="h-4 w-4" /> solte os PDFs aqui…</>
                : <><Paperclip className="h-4 w-4" /> Subir ou arrastar alvará/documentos (IA sugere os valores)</>}
            </button>
            <label className={lbl}>Valor bruto do alvará</label>
            <div className="flex items-center gap-2"><span className="text-sm text-zinc-400">R$</span><input type="number" step="0.01" value={valorAlvara} onChange={(e) => setValorAlvara(e.target.value)} placeholder="0,00" className={inp} /></div>
            <label className={lbl}>Honorários contratuais</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} step="1" value={pct}
                onChange={(e) => { const p = Math.max(0, Math.min(100, Number(e.target.value) || 0)); setPct(p); setHonTocado(false); setCliTocado(false); }}
                className="w-16 rounded-lg border border-[#DEE2E6] bg-white px-2 py-2 text-center text-sm text-zinc-800 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">% do alvará <span className="text-zinc-400 dark:text-zinc-500">— do contrato de honorários (hub)</span></span>
            </div>
            <div className="mt-1 flex items-center gap-2"><span className="text-sm text-zinc-400">R$</span><input type="number" step="0.01" value={honorarios} onChange={(e) => { setHonTocado(true); setHonorarios(e.target.value); }} placeholder="0,00" className={inp} /></div>
            <label className={lbl}>Honorários de sucumbência?</label>
            <Radio value={sucumbencia} onChange={setSucumbencia} options={['Sim', 'Não']} />
            {sucumbencia === 'Sim' && (
              <><label className={lbl}>Valor da sucumbência</label>
                <div className="flex items-center gap-2"><span className="text-sm text-zinc-400">R$</span><input type="number" step="0.01" value={valorSucumbencia} onChange={(e) => setValorSucumbencia(e.target.value)} placeholder="0,00" className={inp} /></div></>
            )}
            <label className={lbl}>Valor do cliente <span className="font-normal normal-case text-zinc-400">— alvará − honorários</span></label>
            <div className="flex items-center gap-2"><span className="text-sm text-zinc-400">R$</span><input type="number" step="0.01" value={valorCliente} onChange={(e) => { setCliTocado(true); setValorCliente(e.target.value); }} placeholder="0,00" className={inp} /></div>
            <div className="mt-3 rounded-lg bg-[#02883C]/5 px-3 py-2 text-sm text-[#02883C] dark:bg-[#02883C]/10">Nosso a receber (honorários + sucumbência): <b>{brl(aReceber)}</b></div>
            {podeLancarFinanceiro && (
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input type="checkbox" checked={lancar} onChange={(e) => setLancar(e.target.checked)} className="accent-[#02883C]" />
                Lançar o honorário no financeiro (a receber, com rateio sugerido)
              </label>
            )}
          </>
        ) : phase === 'transito' ? (
          <>
            <label className={lbl}>Transitou em julgado?</label>
            <Radio value={transitou} onChange={setTransitou} options={['Sim', 'Não']} />
            <label className={lbl}>Vencemos a ação?</label>
            <Radio value={vencemos} onChange={setVencemos} options={['Sim', 'Não', 'Parcial']} />
            <p className="mt-1 text-[11px] text-zinc-400">Ao confirmar, abro o desfecho ({vencemos === 'Não' ? 'Ações Perdidas' : 'Ações Vencidas'}) já preenchido.</p>
            <label className={lbl}>Anotações</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={`${inp} resize-none`} />
          </>
        ) : phase === 'acoes_vencidas' ? (
          <>
            <label className={lbl}>Resultado</label>
            <Radio value={resultado} onChange={setResultado} options={['Procedente', 'Parcialmente procedente']} />
            <label className={lbl}>Valor recebido <span className="font-normal normal-case text-zinc-400">(estimado)</span></label>
            <div className="flex items-center gap-2"><span className="text-sm text-zinc-400">R$</span><input type="number" step="0.01" value={valorRecebido} onChange={(e) => setValorRecebido(e.target.value)} placeholder="0,00" className={inp} /></div>
            <label className={lbl}>Anotações</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={`${inp} resize-none`} />
          </>
        ) : (
          <>
            <label className={lbl}>Motivo da derrota</label>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className={`${inp} resize-none`} />
            <label className={lbl}>Recorremos?</label>
            <Radio value={recorremos} onChange={setRecorremos} options={['Sim', 'Não', 'Não cabível']} />
            <label className={lbl}>Anotações</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={`${inp} resize-none`} />
          </>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          {onSoConcluir ? (
            <button onClick={onSoConcluir} disabled={busy} className="text-sm font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300">Só concluir o prazo</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy} className="rounded-md border border-[#DEE2E6] px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">Cancelar</button>
            <button onClick={confirmar} disabled={busy || loading} className="inline-flex items-center gap-1.5 rounded-md bg-[#02883C] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"><Check className="h-4 w-4" /> Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Radio({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-[#DEE2E6] dark:border-zinc-700">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`px-3 py-1.5 text-sm font-medium ${value === o ? 'bg-[#228BE6] text-white' : 'bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300'}`}>{o}</button>
      ))}
    </div>
  );
}
