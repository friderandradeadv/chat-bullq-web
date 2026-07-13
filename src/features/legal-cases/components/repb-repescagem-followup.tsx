'use client';

// Follow-ups da REPESCAGEM (leads REPB que não fecharam na reunião). Cadência
// sugerida + roteiros de reengajamento copiáveis (WhatsApp, sem promessa de
// resultado — OAB art. 41) + histórico de contatos, persistido em
// faseData.repbc_repescagem via saveFaseField. Web-only.

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Copy, Check, Plus, CalendarClock, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type KanbanCard } from '../services/legal-cases.service';

interface Contato { data: string; nota: string }

const ROTEIROS: { rotulo: string; quando: string; texto: (nome: string) => string }[] = [
  {
    rotulo: 'Lembrete gentil', quando: 'D+2',
    texto: (n) => `Oi ${n}, aqui é da equipe do Frider Andrade 🙂 Passando pra saber se ficou alguma dúvida da nossa conversa sobre a reestruturação das suas dívidas. Estou por aqui pra ajudar no que precisar!`,
  },
  {
    rotulo: 'Reforço de valor (risco baixo)', quando: 'D+7',
    texto: (n) => `${n}, só reforçando como funciona: a gente analisa seus contratos e o quanto o banco já provisionou a dívida pra *buscar* um acordo com desconto. A entrada é pequena e a maior parte dos nossos honorários só incide se conseguirmos reduzir a sua dívida. Quer retomar a análise?`,
  },
  {
    rotulo: 'Remover objeção / janela', quando: 'D+15',
    texto: (n) => `${n}, entendo que a decisão não é simples. Vale lembrar que, enquanto a dívida corre, os juros continuam somando — e algumas janelas de negociação com os bancos são melhores em certas épocas do ano. Se quiser, marco de novo um horário rápido com o advogado, sem compromisso.`,
  },
  {
    rotulo: 'Última tentativa (porta aberta)', quando: 'D+30',
    texto: (n) => `${n}, vou deixar seu contato registrado aqui com a gente. Se em algum momento quiser retomar a análise das suas dívidas, é só me chamar neste número que seguimos de onde paramos. Um abraço!`,
  },
];

export function RepescagemFollowupModal({ card, onClose }: { card: KanbanCard; onClose: () => void }) {
  const nome = ((card.client ?? card.title ?? 'cliente').split(' ')[0] || 'cliente');
  const nomeCap = nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();

  const { data: detail } = useQuery({ queryKey: ['legal-cases', 'detail', card.id], queryFn: () => legalCasesService.get(card.id) });
  const salvo = ((detail?.metadata as any)?.faseData?.repbc_repescagem ?? {}) as { proximo_followup?: string; contatos?: Contato[]; motivo?: string };

  const [proximo, setProximo] = useState('');
  const [historico, setHistorico] = useState<Contato[]>([]);
  const [novaNota, setNovaNota] = useState('');
  const [copiado, setCopiado] = useState<number | null>(null);

  useEffect(() => {
    if (detail) {
      setProximo(salvo.proximo_followup ?? '');
      setHistorico(Array.isArray(salvo.contatos) ? salvo.contatos : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const persistir = async (patch: { proximo_followup?: string; contatos?: Contato[] }) => {
    try {
      await legalCasesService.saveFaseField(card.id, 'repbc_repescagem', 'proximo_followup', patch.proximo_followup ?? proximo);
      if (patch.contatos) await legalCasesService.saveFaseField(card.id, 'repbc_repescagem', 'contatos', patch.contatos);
    } catch { toast.error('Não consegui salvar o follow-up'); }
  };

  const registrarContato = async () => {
    const nota = novaNota.trim();
    if (!nota) return;
    const novo = [{ data: hoje, nota }, ...historico];
    setHistorico(novo); setNovaNota('');
    await persistir({ contatos: novo });
    toast.success('Contato registrado');
  };

  const copiar = (i: number, texto: string) => {
    navigator.clipboard?.writeText(texto);
    setCopiado(i); setTimeout(() => setCopiado(null), 1500);
    toast.success('Roteiro copiado');
  };

  const proximoAtrasado = proximo && proximo < hoje;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <MessageCircle className="h-4 w-4 text-[#E8590C]" />
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Follow-up — {nomeCap}</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {salvo.motivo && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <b>Não fechou:</b> {salvo.motivo}
            </p>
          )}

          {/* Próximo follow-up */}
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className={`h-4 w-4 ${proximoAtrasado ? 'text-rose-500' : 'text-zinc-400'}`} />
            <span className="text-sm text-zinc-600 dark:text-zinc-300">Próximo follow-up:</span>
            <input type="date" value={proximo} onChange={(e) => { setProximo(e.target.value); persistir({ proximo_followup: e.target.value }); }}
              className="rounded-lg border border-[#cfe0ed] bg-transparent px-2 py-1 text-sm text-[#101820] outline-none focus:border-[#E8590C] dark:border-zinc-700 dark:text-zinc-200" />
            {proximoAtrasado && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-900/30">atrasado</span>}
          </div>

          {/* Roteiros copiáveis */}
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Roteiros de reengajamento</p>
          <div className="space-y-2">
            {ROTEIROS.map((r, i) => {
              const texto = r.texto(nomeCap);
              return (
                <div key={i} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded bg-[#E8590C]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#E8590C]">{r.quando}</span>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{r.rotulo}</span>
                    <button onClick={() => copiar(i, texto)} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300">
                      {copiado === i ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
                    </button>
                  </div>
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">{texto}</p>
                </div>
              );
            })}
          </div>

          {/* Histórico de contatos */}
          <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Histórico de contatos</p>
          <div className="flex gap-2">
            <input value={novaNota} onChange={(e) => setNovaNota(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') registrarContato(); }}
              placeholder="Ex.: liguei, pediu pra retomar mês que vem"
              className="h-9 flex-1 rounded-lg border border-[#cfe0ed] bg-transparent px-2.5 text-sm text-[#101820] outline-none focus:border-[#E8590C] dark:border-zinc-700 dark:text-zinc-200" />
            <button onClick={registrarContato} className="inline-flex items-center gap-1 rounded-lg bg-[#E8590C] px-3 text-sm font-semibold text-white hover:opacity-90">
              <Plus className="h-4 w-4" /> Registrar
            </button>
          </div>
          {historico.length > 0 && (
            <ul className="mt-2 space-y-1">
              {historico.map((h, i) => (
                <li key={i} className="flex gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-300">
                  <span className="shrink-0 font-semibold text-zinc-400">{h.data.split('-').reverse().join('/')}</span>
                  <span>{h.nota}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
