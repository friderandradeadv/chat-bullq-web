'use client';

/**
 * Card de conferência da TUTELA no cumprimento de sentença.
 *
 * Regra do escritório: antes de pedir o cumprimento de sentença, confere-se
 * sempre (a) se houve tutela deferida nos autos e (b) se o réu cumpriu. Se não
 * cumpriu, a multa fixada se executa no mesmo pedido, junto com a condenação
 * (CPC 537, §§ 2º e 4º). Antes deste card o hub só perguntava "tutela
 * deferida?" para estender os descontos — a multa nunca era cobrada.
 *
 * As duas perguntas são SEPARADAS de propósito: tutela deferida e descontos que
 * continuaram não são a mesma coisa — essa é justamente a hipótese de
 * descumprimento, e era o que ficava invisível quando as duas andavam juntas.
 */

import { ShieldAlert } from 'lucide-react';
import { calcularAstreinte, type AstreinteResultado, type MultaTipo } from '../lib/astreinte';

export interface TutelaCumprimento {
  /** houve tutela deferida nos autos? */
  deferida: boolean;
  /** o réu cumpriu a obrigação? */
  cumprida: boolean;
  /** data da decisão que deferiu — 'YYYY-MM-DD' */
  data: string;
  /** data da intimação do réu (o prazo corre dela) */
  dataIntimacao: string;
  /** prazo em dias dado na decisão */
  prazoDias: string;
  multaTipo: MultaTipo;
  multaValor: string;
  multaTeto: string;
  /** data em que o réu cumpriu (cessou o desconto / baixou a reserva) */
  dataCumprimento: string;
  /** valor da multa já liquidado por decisão, se houver */
  multaLiquidada: string;
}

export const tutelaInicial: TutelaCumprimento = {
  deferida: true,
  cumprida: true,
  data: '',
  dataIntimacao: '',
  prazoDias: '',
  multaTipo: 'diaria',
  multaValor: '',
  multaTeto: '',
  dataCumprimento: '',
  multaLiquidada: '',
};

export function parseValorBr(raw: string): number {
  let s = (raw || '').replace(/r\$|\s/gi, '').trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s);
}

const num = (raw: string): number | undefined => {
  const v = parseValorBr(raw);
  return isNaN(v) ? undefined : v;
};

/** A multa desta tutela, já valorada até a data-base (ou null se não há nada a executar). */
export function astreinteDaTutela(
  t: TutelaCumprimento,
  termoFinal: string,
): AstreinteResultado | null {
  return calcularAstreinte({
    deferida: t.deferida,
    cumprida: t.cumprida,
    data: t.data || undefined,
    dataInicioCumprimento: t.dataIntimacao || undefined,
    prazoDias: t.prazoDias ? parseInt(t.prazoDias, 10) : undefined,
    multaTipo: t.multaTipo,
    multaValor: num(t.multaValor),
    multaTeto: num(t.multaTeto),
    dataCumprimento: t.dataCumprimento || undefined,
    multaLiquidada: num(t.multaLiquidada),
    termoFinal,
  });
}

/** Os descontos continuaram? (tutela negada, ou deferida e descumprida) */
export function descontosContinuaram(t: TutelaCumprimento): boolean {
  return !t.deferida || !t.cumprida;
}

/** Até quando estender os descontos: a cessação, se houve; senão a data-base. */
export function ateQuandoDescontos(t: TutelaCumprimento, termoFinal: string): string {
  return t.cumprida && t.dataCumprimento ? t.dataCumprimento : termoFinal;
}

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const labelCls = 'mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400';
const brl = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

function Opcao({
  ativo,
  cor,
  onClick,
  children,
}: {
  ativo: boolean;
  cor: 'violet' | 'amber';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const on =
    cor === 'violet'
      ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-300'
      : 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-300';
  const off =
    'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${ativo ? on : off}`}
    >
      {children}
    </button>
  );
}

export function CardTutelaCumprimento({
  value,
  onChange,
  termoFinal,
  cardCls,
  /** bloco de descontos continuados da página (rótulos variam entre as duas calculadoras) */
  blocoDescontos,
}: {
  value: TutelaCumprimento;
  onChange: (t: TutelaCumprimento) => void;
  termoFinal: string;
  cardCls: string;
  blocoDescontos?: React.ReactNode;
}) {
  const t = value;
  const set = <K extends keyof TutelaCumprimento>(k: K, v: TutelaCumprimento[K]) =>
    onChange({ ...t, [k]: v });
  const multa = astreinteDaTutela(t, termoFinal);
  const temCominacao = !!num(t.multaValor) || !!num(t.multaLiquidada);

  return (
    <div className={cardCls}>
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <ShieldAlert className="h-4 w-4 text-amber-500" /> Houve tutela nos autos?{' '}
        <span className="text-xs font-normal text-zinc-400">(e o réu cumpriu?)</span>
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Conferência obrigatória antes do cumprimento: se a tutela foi deferida e o réu{' '}
        <b>não cumpriu</b>, a multa se executa junto com a condenação (CPC 537, §§ 2º e 4º).
        Se não foi deferida, os descontos continuaram e o saldo é recalculado.
      </p>

      {/* 1 — houve tutela deferida? */}
      <div className="flex gap-2">
        <Opcao ativo={t.deferida} cor="violet" onClick={() => set('deferida', true)}>
          Tutela deferida
        </Opcao>
        <Opcao ativo={!t.deferida} cor="amber" onClick={() => set('deferida', false)}>
          Não deferida / indeferida
        </Opcao>
      </div>

      {/* 2 — o réu cumpriu? (só faz sentido se houve tutela deferida) */}
      {t.deferida && (
        <div className="mt-3">
          <label className={labelCls}>O réu cumpriu a tutela?</label>
          <div className="flex gap-2">
            <Opcao ativo={t.cumprida} cor="violet" onClick={() => set('cumprida', true)}>
              Cumpriu
            </Opcao>
            <Opcao ativo={!t.cumprida} cor="amber" onClick={() => set('cumprida', false)}>
              Não cumpriu
            </Opcao>
          </div>
          <p className="mt-2 text-[10px] leading-tight text-zinc-400">
            Cumprimento se prova no HISCRE/extrato: os descontos cessaram depois do prazo? A
            reserva de margem foi baixada? Silêncio da sentença não é cumprimento.
          </p>
        </div>
      )}

      {/* Dados da tutela e da cominação — pedidos sempre que houve tutela deferida,
          porque até o cumprimento TARDIO gera multa pelos dias de atraso. */}
      {t.deferida && (
        <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data da decisão</label>
              <input
                type="date"
                className={inputCls}
                value={t.data}
                onChange={(e) => set('data', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Intimação do réu (se souber)</label>
              <input
                type="date"
                className={inputCls}
                value={t.dataIntimacao}
                onChange={(e) => set('dataIntimacao', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Prazo p/ cumprir (dias)</label>
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="5"
                value={t.prazoDias}
                onChange={(e) => set('prazoDias', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Multa fixada</label>
              <select
                className={inputCls}
                value={t.multaTipo}
                onChange={(e) => set('multaTipo', e.target.value as MultaTipo)}
              >
                <option value="diaria">Diária</option>
                <option value="fixa">Fixa (única)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>
                Valor {t.multaTipo === 'diaria' ? 'por dia' : 'da multa'} (R$)
              </label>
              <input
                className={inputCls}
                inputMode="decimal"
                placeholder="200,00"
                value={t.multaValor}
                onChange={(e) => set('multaValor', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Teto, se houver (R$)</label>
              <input
                className={inputCls}
                inputMode="decimal"
                placeholder="5.000,00"
                value={t.multaTeto}
                onChange={(e) => set('multaTeto', e.target.value)}
              />
            </div>
            {t.cumprida ? (
              <div>
                <label className={labelCls}>Cumpriu em</label>
                <input
                  type="date"
                  className={inputCls}
                  value={t.dataCumprimento}
                  onChange={(e) => set('dataCumprimento', e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label className={labelCls}>Multa já liquidada (R$)</label>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  placeholder="opcional"
                  value={t.multaLiquidada}
                  onChange={(e) => set('multaLiquidada', e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Resultado da conferência */}
          {multa ? (
            <div className="rounded-lg bg-amber-100/70 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
              <b>Multa a executar: {brl(multa.valor)}</b>
              {multa.liquidadaPorDecisao
                ? ' — valor já liquidado em decisão judicial.'
                : ` — ${multa.dias} dia(s) de descumprimento (${multa.inicio
                    .split('-')
                    .reverse()
                    .join('/')} a ${multa.fim.split('-').reverse().join('/')})${
                    multa.limitadaPeloTeto ? ', limitada ao teto' : ''
                  }${multa.emCurso ? '. Descumprimento em curso na data-base' : ''}.`}
              <br />
              Entra no cálculo como verba própria, sem juros de mora (a multa já pune o atraso
              dia a dia) e com correção só a partir do fim do período. <b>A peça precisa pedir
              a execução da multa</b> — CPC 537, §§ 2º e 4º.
            </div>
          ) : t.cumprida && t.deferida ? (
            <p className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
              Cumprimento no prazo (ou sem data de cumprimento informada): nada de multa a
              executar. Se o réu cumpriu com atraso, informe a data em que cumpriu.
            </p>
          ) : !temCominacao ? (
            <p className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
              Descumprimento marcado, mas sem cominação informada: preencha a data da decisão,
              o prazo e o valor da multa fixada. Se a decisão deferiu a tutela <b>sem</b> multa,
              não há astreinte a executar — registre isso no cálculo.
            </p>
          ) : (
            <p className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
              Faltam dados para contar o período: informe a data da decisão (ou da intimação) e
              o prazo dado ao réu.
            </p>
          )}
        </div>
      )}

      {/* Descontos continuados — da página (rótulos próprios de cada calculadora) */}
      {descontosContinuaram(t) && blocoDescontos}
    </div>
  );
}
