'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageCircleHeart, Loader2, ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';
import { depoimentosService, type ConquistasConfig } from '../services/depoimentos.service';

const input =
  'w-full rounded-lg border border-[#DEE2E6] bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-[#228BE6] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

/**
 * Painel da automação pós-prestação de contas: depois que o cliente recebe o
 * dinheiro, o hub pergunta o que ele achou e, dias depois, convida para avaliar.
 * A resposta dele não precisa de captura própria — a varredura do mural já lê
 * as mensagens recebidas e transforma agradecimento em sugestão.
 */
export function AutomacaoFeedback() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const { data } = useQuery({ queryKey: ['depoimentos', 'config'], queryFn: () => depoimentosService.getConfig() });
  const [f, setF] = useState<ConquistasConfig | null>(null);
  useEffect(() => { if (data && !f) setF(data); }, [data, f]);

  const salvar = useMutation({
    mutationFn: (v: Partial<ConquistasConfig>) => depoimentosService.setConfig(v),
    onSuccess: (r) => {
      setF(r);
      qc.invalidateQueries({ queryKey: ['depoimentos', 'config'] });
      toast.success(r.pedirFeedback ? 'Automação ligada.' : 'Automação desligada.');
    },
    onError: () => toast.error('Não consegui salvar.'),
  });

  if (!f) return null;
  const set = (k: keyof ConquistasConfig, v: unknown) => setF({ ...f, [k]: v } as ConquistasConfig);

  return (
    <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/60">
      <button onClick={() => setAberto((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <MessageCircleHeart className="h-4 w-4 shrink-0 text-[#E64980]" />
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Pedir feedback depois da prestação de contas</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${f.pedirFeedback ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
          {f.pedirFeedback ? 'LIGADA' : 'DESLIGADA'}
        </span>
        {aberto ? <ChevronDown className="ml-auto h-4 w-4 text-zinc-400" /> : <ChevronRight className="ml-auto h-4 w-4 text-zinc-400" />}
      </button>

      {aberto && (
        <div className="space-y-3 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
          <p className="text-xs leading-relaxed text-zinc-500">
            Quando a prestação de contas é enviada, o hub agenda uma pergunta simples ao cliente
            (&quot;deu tudo certo com o dinheiro aí? o que você achou do nosso trabalho?&quot;) e, dias depois,
            o convite para avaliar. A resposta cai sozinha nas <strong>Sugestões</strong> do mural — quem
            escuta é a varredura, que já lê tudo que chega.
          </p>

          <label className="flex items-start gap-2">
            <input type="checkbox" checked={f.pedirFeedback} onChange={(e) => set('pedirFeedback', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#228BE6]" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Ligar o pedido automático de feedback</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Perguntar depois de (dias)</label>
              <input type="number" min={1} max={30} className={input} value={f.diasFeedback} onChange={(e) => set('diasFeedback', Number(e.target.value))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Convidar a avaliar depois de (dias)</label>
              <input type="number" min={1} max={60} className={input} value={f.diasAvaliacao} onChange={(e) => set('diasAvaliacao', Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-500">Link de avaliação do Google</label>
            <input className={input} value={f.googleUrl} onChange={(e) => set('googleUrl', e.target.value)} placeholder="https://g.page/r/.../review — sem link, o convite não é enviado" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-500">Como perguntar (vazio = texto padrão)</label>
            <textarea className={`${input} min-h-[70px]`} value={f.textoFeedback} onChange={(e) => set('textoFeedback', e.target.value)} placeholder="Oi! Deu tudo certo com o dinheiro aí? 😊 Queria muito saber o que você achou do nosso trabalho…" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-500">Como convidar a avaliar</label>
            <textarea className={`${input} min-h-[70px]`} value={f.textoAvaliacao} onChange={(e) => set('textoAvaliacao', e.target.value)} placeholder="Que bom que deu tudo certo! Se você puder deixar uma avaliação, ajuda demais outras pessoas…" />
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-900/15">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              Pedir feedback para uso interno é uma coisa; <strong>convidar o cliente a publicar avaliação</strong> é
              publicidade da advocacia e tem leitura própria no Provimento 205/2021 do CFOAB. Por isso a
              automação nasce desligada e o convite só existe se você preencher o link — a decisão é sua,
              não do sistema.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => salvar.mutate(f)}
              disabled={salvar.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#228BE6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1c7ed6] disabled:opacity-60"
            >
              {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
