'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, FileText, Loader2, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { inboxService, type Conversation } from '@/features/inbox/services/inbox.service';
import { channelsService, type Channel } from '@/features/channels/services/channels.service';
import { useAuthStore } from '@/stores/auth-store';

/**
 * ENVIO DA PROPOSTA PELO WHATSAPP — bloco compartilhado.
 *
 * Quem chama monta as MENSAGENS (curtas, uma ideia em cada, a última sendo
 * pergunta fechada) e, se quiser, um PDF. Este bloco cuida do resto: escolher
 * o destinatário entre as conversas do hub, disparar em sequência pelo número
 * oficial e anexar o documento.
 *
 * 🚨 Não entra no PDF de nada: use sempre dentro de um container `no-print`
 * ou com a classe abaixo, que já carrega.
 */

const STATUS_ROTULO: Record<string, string> = {
  PENDING: 'pendente', OPEN: 'aberta', WAITING: 'aguardando', BOT: 'com o robô', CLOSED: 'encerrada',
};
const STATUS_COR: Record<string, string> = {
  PENDING: 'bg-amber-500', OPEN: 'bg-emerald-500', WAITING: 'bg-sky-500', BOT: 'bg-violet-500', CLOSED: 'bg-zinc-400',
};

export function EnviarPropostaWhatsapp({
  mensagens: mensagensPadrao,
  montarPdf,
  nomeArquivoPdf,
  legendaPdf = 'A proposta completa, em PDF.',
  buscaInicial = '',
  nota,
}: {
  mensagens: string[];
  /** devolve o PDF já montado; sem isso, o bloco não oferece anexo */
  montarPdf?: () => Promise<Blob>;
  /** 🚨 SEM ESPAÇO: a Evolution reprova a URL da mídia no `isURL` antes de baixar */
  nomeArquivoPdf?: string;
  legendaPdf?: string;
  /** pré-filtra a lista de conversas (nome ou telefone do cliente) */
  buscaInicial?: string;
  nota?: string;
}) {
  const { user } = useAuthStore();
  const [msgs, setMsgs] = useState<string[] | null>(null);
  const mensagens = msgs ?? mensagensPadrao;

  const [modo, setModo] = useState<'hub' | 'numero'>('hub');
  const [soMinhas, setSoMinhas] = useState(true);
  const [status, setStatus] = useState<'ATIVAS' | 'PENDING' | 'OPEN' | 'WAITING' | 'TODAS'>('ATIVAS');
  const [busca, setBusca] = useState(buscaInicial);
  const [conversas, setConversas] = useState<Conversation[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [escolhida, setEscolhida] = useState<Conversation | null>(null);

  const [fone, setFone] = useState('');
  const [canais, setCanais] = useState<Channel[]>([]);
  const [canalId, setCanalId] = useState('');
  const [anexar, setAnexar] = useState(!!montarPdf);
  const [enviando, setEnviando] = useState<number | null>(null);
  const [enviandoPdf, setEnviandoPdf] = useState(false);

  useEffect(() => {
    channelsService.list()
      .then((cs) => {
        const wpp = cs.filter((c) => c.isActive && /whatsapp/i.test(c.type));
        setCanais(wpp);
        if (wpp.length) setCanalId(wpp[0].id);
      })
      .catch(() => { /* sem canal: sobra o wa.me */ });
  }, []);

  /**
   * "ATIVAS" = PENDING + OPEN + WAITING: a conversa que está viva, de qualquer
   * forma. CLOSED fica de fora — mandar proposta para conversa encerrada reabre
   * atendimento sem ninguém esperando do outro lado.
   */
  useEffect(() => {
    if (modo !== 'hub') return;
    let vivo = true;
    setCarregando(true);
    const base: Record<string, string> = { limit: '40', archived: 'exclude', groups: 'exclude' };
    if (soMinhas && user?.id) base.assignedToId = user.id;
    if (busca.trim()) base.search = busca.trim();
    const pedidos = status === 'ATIVAS'
      ? ['PENDING', 'OPEN', 'WAITING'].map((st) => inboxService.getConversations({ ...base, status: st }))
      : [inboxService.getConversations(status === 'TODAS' ? base : { ...base, status })];
    Promise.all(pedidos)
      .then((rs) => {
        if (!vivo) return;
        const todas = rs.flatMap((r) => r.conversations ?? []);
        const vistas = new Set<string>();
        setConversas(todas
          .filter((c) => (vistas.has(c.id) ? false : (vistas.add(c.id), true)))
          .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')));
      })
      .catch(() => vivo && setConversas([]))
      .finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [modo, soMinhas, status, busca, user?.id]);

  const numeroLimpo = () => {
    const d = fone.replace(/\D/g, '');
    if (d.length < 10) return null;
    return d.startsWith('55') ? d : `55${d}`;
  };
  const semDestino = !escolhida && (!canalId || !fone);

  const resolverConversa = async () => {
    if (escolhida) return escolhida;
    const numero = numeroLimpo();
    if (!numero) { toast.error('Escolha a conversa no hub ou informe o WhatsApp com DDD.'); return null; }
    if (!canalId) { toast.error('Nenhum canal de WhatsApp ativo para enviar.'); return null; }
    return inboxService.startConversation(canalId, numero);
  };

  const anexarPdf = async (conversaId: string) => {
    if (!montarPdf) return;
    const blob = await montarPdf();
    const arquivo = new File([blob], nomeArquivoPdf || 'proposta.pdf', { type: 'application/pdf' });
    await inboxService.sendMediaMessage(conversaId, arquivo, legendaPdf);
  };

  /**
   * 🚨 NÃO é `oneOff`. O envio ASSUME a conversa e pausa a IA de propósito: a
   * última mensagem pede uma escolha, e sem pausar o robô ele responderia o
   * cliente no lugar do advogado.
   */
  const enviarTudo = async () => {
    try {
      setEnviando(0);
      const conversa = await resolverConversa();
      if (!conversa) return;
      for (let i = 0; i < mensagens.length; i++) {
        setEnviando(i + 1);
        await inboxService.sendMessage({ conversationId: conversa.id, type: 'TEXT', content: { text: mensagens[i] } });
        if (i < mensagens.length - 1) await new Promise((r) => setTimeout(r, 900));
      }
      if (anexar && montarPdf) {
        setEnviando(mensagens.length + 1);
        await anexarPdf(conversa.id);
      }
      toast.success(anexar && montarPdf
        ? `${mensagens.length} mensagens + o PDF enviados pelo hub`
        : `${mensagens.length} mensagens enviadas pelo hub`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Não consegui enviar pelo hub.');
    } finally {
      setEnviando(null);
    }
  };

  /** Só o anexo — para quando as mensagens já foram. */
  const enviarApenasPdf = async () => {
    try {
      setEnviandoPdf(true);
      const conversa = await resolverConversa();
      if (!conversa) return;
      await anexarPdf(conversa.id);
      toast.success('PDF enviado pelo hub');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Não consegui enviar o PDF pelo hub.');
    } finally {
      setEnviandoPdf(false);
    }
  };

  const abrirWhatsapp = () => {
    const numero = escolhida?.contact?.phone?.replace(/\D/g, '') || numeroLimpo();
    if (!numero) return toast.error('Escolha a conversa no hub ou informe o WhatsApp com DDD.');
    const n = numero.startsWith('55') ? numero : `55${numero}`;
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(mensagens[0])}`, '_blank');
  };

  const copiar = (t: string, aviso: string) => {
    navigator.clipboard.writeText(t).then(() => toast.success(aviso)).catch(() => toast.error('Não consegui copiar'));
  };

  const foraDeHora = (() => { const h = new Date().getHours(); return h < 8 || h >= 19; })();
  const primeiroNome = (escolhida?.contact?.name || '').split(' ')[0];

  return (
    <div className="no-print rounded-2xl border border-emerald-500/30 bg-white p-6 dark:border-emerald-400/20 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Mandar a proposta pelo WhatsApp</p>
      </div>
      <p className="mt-1 text-[12px] text-zinc-500">
        {mensagens.length} mensagens curtas, uma ideia em cada. A última é a pergunta que faz o cliente responder.
      </p>

      <div className="mt-4 flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {([['hub', 'Escolher do hub'], ['numero', 'Digitar número']] as const).map(([k, rot]) => (
          <button key={k} onClick={() => { setModo(k); setEscolhida(null); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${modo === k ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
            {rot}
          </button>
        ))}
      </div>

      {modo === 'hub' ? (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[12px] text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={soMinhas} onChange={(e) => setSoMinhas(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-600" />
              Só as minhas
            </label>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[12px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100">
              <option value="ATIVAS">Ativas (pendente + aberta + aguardando)</option>
              <option value="PENDING">Só pendentes</option>
              <option value="OPEN">Só abertas</option>
              <option value="WAITING">Só aguardando</option>
              <option value="TODAS">Todas</option>
            </select>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone"
              className="min-w-[200px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
          </div>
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            {carregando && <p className="p-3 text-[12px] text-zinc-400">Carregando conversas…</p>}
            {!carregando && conversas.length === 0 && (
              <p className="p-3 text-[12px] text-zinc-400">Nenhuma conversa com esses filtros. Tire o “só as minhas” ou mude o status.</p>
            )}
            {conversas.map((cv) => {
              const sel = escolhida?.id === cv.id;
              return (
                <button key={cv.id} onClick={() => setEscolhida(sel ? null : cv)}
                  className={`flex w-full items-center gap-3 border-b border-zinc-100 px-3 py-2 text-left last:border-0 dark:border-zinc-800 ${sel ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COR[cv.status] ?? 'bg-zinc-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
                      {cv.contact?.name || cv.contact?.phone || 'sem nome'}
                    </span>
                    <span className="block truncate text-[11px] text-zinc-400">
                      {cv.contact?.phone ?? '—'} · {STATUS_ROTULO[cv.status] ?? cv.status}
                      {cv.assignedTo?.name ? ` · ${cv.assignedTo.name}` : ' · sem responsável'}
                    </span>
                  </span>
                  {sel && <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={fone} onChange={(e) => setFone(e.target.value)} placeholder="WhatsApp do cliente com DDD" inputMode="tel"
            className="w-60 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
          {canais.length > 1 && (
            <select value={canalId} onChange={(e) => setCanalId(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100">
              {canais.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
            </select>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={enviarTudo} disabled={enviando !== null || enviandoPdf || semDestino}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {enviando !== null
            ? <><Loader2 className="h-4 w-4 animate-spin" /> {enviando > mensagens.length ? 'Enviando o PDF…' : `Enviando ${enviando}/${mensagens.length}…`}</>
            : <><Send className="h-4 w-4" /> Enviar {mensagens.length}{anexar && montarPdf ? ' + PDF' : ''} {primeiroNome ? `para ${primeiroNome}` : 'pelo hub'}</>}
        </button>
        {montarPdf && (
          <button onClick={enviarApenasPdf} disabled={enviandoPdf || enviando !== null || semDestino}
            title="Para quando as mensagens já foram e falta só o anexo"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-400 dark:hover:bg-emerald-500/10">
            {enviandoPdf ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando o PDF…</> : <><FileText className="h-4 w-4" /> Enviar só o PDF</>}
          </button>
        )}
        <button onClick={abrirWhatsapp}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800">
          <MessageCircle className="h-4 w-4" /> Abrir no meu WhatsApp
        </button>
        {montarPdf && (
          <label className="inline-flex items-center gap-1.5 text-[12px] text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={anexar} onChange={(e) => setAnexar(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-600" />
            Anexar o PDF ao final
          </label>
        )}
        {msgs !== null && (
          <button onClick={() => setMsgs(null)} className="text-[12px] text-zinc-400 underline hover:text-zinc-600">voltar ao texto gerado</button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">
        {canais.length
          ? 'Pelo hub as mensagens saem em sequência, do número oficial do escritório, e a conversa fica atribuída a você com a IA pausada — senão o robô responde o cliente no seu lugar. O botão do WhatsApp é a alternativa: abre no seu número com a 1ª mensagem, e as demais vão pelo copiar.'
          : 'Nenhum canal de WhatsApp ativo encontrado — sobra o envio pelo seu WhatsApp: a 1ª vai pelo botão, as demais pelo copiar de cada bolha.'}
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        {mensagens.map((m, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2 w-5 shrink-0 text-right text-[11px] font-bold text-zinc-400">{i + 1}</span>
            <textarea value={m} rows={Math.min(8, m.split('\n').length + 1)}
              onChange={(e) => { const prox = [...mensagens]; prox[i] = e.target.value; setMsgs(prox); }}
              className="flex-1 rounded-xl rounded-tl-sm border border-zinc-200 bg-emerald-50/50 p-3 text-[12.5px] leading-relaxed text-zinc-800 dark:border-zinc-700 dark:bg-emerald-900/10 dark:text-zinc-200" />
            <button onClick={() => copiar(m, `Mensagem ${i + 1} copiada`)} title={`Copiar a mensagem ${i + 1}`}
              className="mt-1 shrink-0 rounded-lg border border-zinc-300 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {foraDeHora && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Fora do horário comercial. Proposta que chega de madrugada costuma ser lida como golpe — vale enviar a partir das 8h.
        </p>
      )}
      {nota && <p className="mt-3 text-[11px] text-zinc-400">{nota}</p>}
    </div>
  );
}
