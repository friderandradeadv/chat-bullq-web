'use client';

import { Check, Circle, Clock } from 'lucide-react';

/**
 * ONDE ESTE CLIENTE ESTÁ, numa linha do tempo só.
 *
 * 🚨 POR QUE EXISTE (30/10/2026). Pedido do escritório, com os dois quadros
 * abertos: *"quero um mapa completo da conversa, do que já foi enviado, o que
 * está pra ser enviado"*. O estado existia espalhado — um selo de status no
 * card, uma data em cinza no rodapé, o resto na cabeça de quem lembrava — e
 * responder "e esse aqui, em que pé está?" exigia abrir o card e deduzir.
 *
 * Tudo aqui sai do que JÁ está gravado na oferta: nenhuma leitura nova, nenhuma
 * ida ao WhatsApp. É de propósito — o mapa tem de abrir junto com o painel, sem
 * esperar rede.
 *
 * ⚠️ UM COMPONENTE, DOIS QUADROS (refin e churning). Se um dia o churning tiver
 * a sua própria cópia disto, as duas vão envelhecer em datas diferentes e o
 * mesmo cliente vai parecer estar em dois pontos distintos da esteira.
 */
export type EstadoDaOferta = {
  /** `pronta` e `analisada` são o mesmo degrau: medida, falta enviar. */
  status: string | null | undefined;
  analisadaEm?: string | null;
  enviadaEm?: string | null;
  respondidaEm?: string | null;
  /** Sem WhatsApp vinculado, o envio nem começa — e é a pendência mais comum. */
  temConversa?: boolean;
};

const dia = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

/** O passo em que a oferta está, e o que falta para o próximo. */
export function oQueFaltaNaOferta(o: EstadoDaOferta): string {
  const s = String(o.status ?? 'analisada');
  if (s === 'recusada') return 'Nada: a recusa está registrada e a ação do cartão segue normalmente.';
  if (s === 'aceita') {
    return 'O cliente aceitou. O card foi para "montar inicial" — confira as linhas e gere as iniciais.';
  }
  if (s === 'enviada') return 'Aguardando a resposta do cliente. A próxima mensagem dele chega na conversa.';
  if (o.temConversa === false) return 'Falta vincular o WhatsApp deste cliente — sem conversa, o envio não começa.';
  return 'Falta você revisar a mensagem e enviar.';
}

type Passo = { rotulo: string; quando: string | null; estado: 'feito' | 'agora' | 'depois' };

export function LinhaDoTempoDaOferta({ o }: { o: EstadoDaOferta }) {
  const s = String(o.status ?? 'analisada');
  const enviou = s === 'enviada' || s === 'aceita' || s === 'recusada';
  const respondeu = s === 'aceita' || s === 'recusada';

  const passos: Passo[] = [
    {
      rotulo: 'medida no HISCON',
      quando: dia(o.analisadaEm),
      estado: o.analisadaEm ? 'feito' : 'agora',
    },
    {
      rotulo: 'oferta enviada ao cliente',
      quando: dia(o.enviadaEm),
      estado: enviou ? 'feito' : o.analisadaEm ? 'agora' : 'depois',
    },
    {
      rotulo: respondeu
        ? (s === 'aceita' ? 'cliente aceitou' : 'cliente recusou')
        : 'resposta do cliente',
      quando: dia(o.respondidaEm),
      estado: respondeu ? 'feito' : enviou ? 'agora' : 'depois',
    },
  ];

  return (
    <div className="rounded-lg border border-[#cfe0ed] bg-[#f7fbfe] p-2.5 dark:border-zinc-700 dark:bg-zinc-900/60">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#48626f] dark:text-zinc-400">
        onde este cliente está
      </p>
      <ol className="space-y-1">
        {passos.map((p) => (
          <li key={p.rotulo} className="flex items-start gap-1.5 text-[11px] leading-4">
            {p.estado === 'feito'
              ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
              : p.estado === 'agora'
                ? <Clock className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                : <Circle className="mt-0.5 h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />}
            <span className={p.estado === 'depois'
              ? 'text-zinc-400 dark:text-zinc-500'
              : 'text-[#101820] dark:text-zinc-200'}>
              {p.rotulo}
              {p.quando ? <span className="text-[#48626f] dark:text-zinc-400"> · {p.quando}</span> : null}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 border-t border-[#e3eef7] pt-1.5 text-[11px] leading-4 text-[#1b6ec2] dark:border-zinc-700 dark:text-sky-300">
        {oQueFaltaNaOferta(o)}
      </p>
    </div>
  );
}
