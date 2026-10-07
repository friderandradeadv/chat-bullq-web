'use client';

/**
 * ALERTA DE GRATUIDADE EM RISCO, com o botão que avisa o cliente.
 *
 * 🚨 POR QUE EXISTE (02/10/2026). O escritório SEMPRE pede justiça gratuita, e
 * nunca junta a declaração de IR de início. Só que renda alta declarada torna o
 * indeferimento provável, e o indeferimento tem uma armadilha que ele mediu na
 * prática, em vários processos: pediu gratuidade, o juiz negou, pediu
 * desistência e foi mandado pagar custas assim mesmo. Palavras dele: "é bater na
 * porta do judiciário, ouvir não e ainda pagar".
 *
 * Então o cliente precisa saber ANTES, com os números dele na frente, e escolher
 * entre a Justiça comum (recomendada) e o Juizado (sem custas de entrada, com
 * risco no recurso). A escolha muda o pacote, então é anterior à montagem.
 *
 * O corte é o mesmo do resto do hub: três salários mínimos por mês.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Send, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type CaseDetail } from '@/features/legal-cases/services/legal-cases.service';

const SALARIO_MINIMO = 1630; // 2026, igual ao da API
const TETO = 3 * SALARIO_MINIMO;

const reais = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function AlertaGratuidade({ caso }: { caso: CaseDetail }) {
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const [gravandoForo, setGravandoForo] = useState<'civel' | 'juizado' | null>(null);
  const foro = (caso.metadata as any)?.foro as { escolha?: string; em?: string; herdado?: boolean } | undefined;
  const irpf = (caso.metadata as any)?.irpf as
    | { ano: number; rendaAnual: number; rendaMensal: number; impostoAPagar?: number; avisadoEm?: string }
    | undefined;

  if (!irpf?.rendaMensal || irpf.rendaMensal <= TETO) return null;

  // 🚨 A ESCOLHA É DO CLIENTE, e é ela que decide o endereçamento da ação. O
  // aviso acima explica o risco; aqui se registra a resposta. Sem isto a decisão
  // morria na conversa do WhatsApp e a inicial saía sempre no padrão.
  const escolherForo = async (escolha: 'civel' | 'juizado') => {
    setGravandoForo(escolha);
    try {
      await legalCasesService.registrarForo(caso.id, escolha);
      await qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caso.id] });
      qc.invalidateQueries({ queryKey: ['legal-cases'] });
      toast.success(escolha === 'juizado'
        ? 'Anotado: a inicial vai para o Juizado Especial.'
        : 'Anotado: a inicial vai para a vara cível, com pedido de gratuidade.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Não consegui registrar a escolha.');
    } finally {
      setGravandoForo(null);
    }
  };

  const avisar = async () => {
    setEnviando(true);
    try {
      await legalCasesService.avisarRiscoDeCustas(caso.id);
      // 🚨 A CHAVE É `['legal-cases','detail',id]`. Com `['legal-case', id]`
      // (singular, sem 'detail') nada era invalidado: depois de enviar, o painel
      // continuava mostrando o BOTÃO em vez de "Cliente avisado" — e o aviso
      // sairia duas vezes no WhatsApp do cliente.
      await qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caso.id] });
      toast.success('Aviso enviado ao cliente, com os valores da declaração dele.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Não consegui enviar o aviso.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-800/60 dark:bg-amber-900/20">
      <div className="flex items-start gap-1.5">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Gratuidade em risco
          </p>
          <p className="mt-1 text-[11px] leading-4 text-amber-900 dark:text-amber-200">
            A declaração de {irpf.ano} aponta {reais(Number(irpf.rendaAnual))} no ano, cerca de{' '}
            <strong className="font-semibold">{reais(Number(irpf.rendaMensal))} por mês</strong>
            {irpf.impostoAPagar ? `, com ${reais(Number(irpf.impostoAPagar))} de imposto a pagar` : ''}.
            Acima de três salários mínimos o indeferimento é provável, e nesse caso haverá custas
            mesmo se desistirmos da ação.
          </p>
          <p className="mt-1 text-[11px] leading-4 text-amber-800 dark:text-amber-300">
            A declaração não vai no pacote. Ela só é juntada se o juízo pedir.
            {(irpf as any).herdado
              ? ' A leitura foi feita em outro processo deste mesmo cliente, e o aviso vale para todos.'
              : ''}
          </p>

          {irpf.avisadoEm ? (
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Cliente avisado em{' '}
              {new Date(irpf.avisadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </p>
          ) : null}

          {/* 🚨 A RESPOSTA DO CLIENTE, que é o que decide o foro da ação. Só
              aparece depois do aviso: perguntar antes de explicar o risco é
              pedir que ele escolha no escuro. */}
          {irpf.avisadoEm ? (
            foro?.escolha ? (
              <p className="mt-2 text-[11px] leading-4 text-amber-900 dark:text-amber-200">
                O cliente escolheu a{' '}
                <strong className="font-semibold">
                  {foro.escolha === 'juizado' ? 'Juizado Especial' : 'Justiça comum (vara cível)'}
                </strong>
                {foro.em
                  ? `, em ${new Date(foro.em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
                  : ''}
                . A inicial é montada para esse foro.
                {foro.herdado ? ' A escolha foi registrada em outro processo deste mesmo cliente, e vale para todos.' : ''}{' '}
                <button
                  type="button"
                  onClick={() => escolherForo(foro.escolha === 'juizado' ? 'civel' : 'juizado')}
                  className="underline underline-offset-2 hover:no-underline"
                >
                  trocar
                </button>
              </p>
            ) : (
              <div className="mt-2">
                <p className="text-[11px] leading-4 text-amber-900 dark:text-amber-200">
                  O que o cliente respondeu?
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => escolherForo('civel')}
                    disabled={!!gravandoForo}
                    title="Vara cível, com pedido de justiça gratuita. É o padrão do escritório, e o que costuma dar melhor resultado."
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-600 px-2.5 py-1 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60 dark:text-amber-200 dark:hover:bg-amber-900/40"
                  >
                    {gravandoForo === 'civel' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Topou a Justiça comum
                  </button>
                  <button
                    type="button"
                    onClick={() => escolherForo('juizado')}
                    disabled={!!gravandoForo}
                    title="Juizado Especial: não se paga nada para entrar. A gratuidade segue pedida, mirando a fase recursal, que é onde há preparo."
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-600 px-2.5 py-1 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60 dark:text-amber-200 dark:hover:bg-amber-900/40"
                  >
                    {gravandoForo === 'juizado' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Prefere o Juizado
                  </button>
                </div>
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={avisar}
              disabled={enviando}
              title="Manda ao cliente, no WhatsApp, o aviso com os valores da declaração dele e a escolha entre Justiça comum e Juizado"
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Avisar o cliente sobre as custas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
