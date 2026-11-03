'use client';

/**
 * A CONVERSA DO CLIENTE, AO VIVO, DENTRO DO PAINEL DA OFERTA.
 *
 * 🚨 POR QUE EXISTE (03/11/2026). Pedido do escritório durante o primeiro teste
 * de ponta a ponta: *"consegue deixar a conversa em tempo real ali no kanban?
 * Para sabermos como está"*. Até aqui o painel mostrava só a mensagem que VAI
 * sair (`PreviaEmBolhas`) e, depois de enviada, uma linha dizendo "aguardando a
 * resposta do cliente" — para saber o que tinha acontecido era preciso sair do
 * quadro, abrir Conversas e procurar o contato.
 *
 * O quadro é onde o advogado acompanha a campanha; a resposta do cliente é o
 * que faz a campanha andar. As duas coisas estavam em telas diferentes.
 *
 * NÃO é um chat: não se responde daqui. É uma janela de leitura, e isso é
 * deliberado — quem responde é o robô, e um campo de texto aqui convidaria a
 * atropelar a escada que a esteira está conduzindo.
 */

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { inboxService, type Message } from '@/features/inbox/services/inbox.service';
import { legalCasesService } from '../services/legal-cases.service';
import { useSocket } from '@/features/inbox/hooks/use-socket';

/** Quantas bolhas mostrar. A campanha inteira cabe folgado nisto. */
const QUANTAS = 40;

const hora = (d: string | Date) =>
  new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** O texto de uma mensagem, seja `text` ou a legenda de uma mídia. */
function textoDa(m: Message): string {
  const c = ((m as any)?.content ?? {}) as Record<string, unknown>;
  const t = (typeof c.text === 'string' && c.text) || (typeof c.caption === 'string' && c.caption) || '';
  return String(t).trim();
}

/** Mídia sem legenda não é bolha vazia: é "ele mandou uma foto". */
function rotuloDaMidia(m: Message): string | null {
  const tipo = String((m as any)?.type ?? '').toUpperCase();
  if (!tipo || tipo === 'TEXT') return null;
  const nomes: Record<string, string> = {
    IMAGE: '📷 foto', VIDEO: '🎬 vídeo', AUDIO: '🎤 áudio',
    DOCUMENT: '📄 documento', STICKER: '🙂 figurinha', LOCATION: '📍 localização',
  };
  return nomes[tipo] ?? `anexo (${tipo.toLowerCase()})`;
}

export function ConversaAoVivo({ caseId, desde }: {
  caseId: string;
  /** A oferta desta rodada: o que veio antes dela é outra venda. */
  desde?: string | null;
}) {
  const qc = useQueryClient();
  const { on } = useSocket();

  // O painel não carrega o id da conversa: quem o tem é o caso. Mesma leitura
  // que o botão de enviar já faz, agora em cache para as duas usarem.
  const { data: caso } = useQuery({
    queryKey: ['caso-para-conversa', caseId],
    queryFn: () => legalCasesService.get(caseId),
    staleTime: 60_000,
  });
  const conversationId: string | undefined = (caso as any)?.clienteConversa?.conversationId;

  const { data, isLoading } = useQuery({
    queryKey: ['conversa-ao-vivo', conversationId],
    queryFn: () => inboxService.getMessages(conversationId as string, 1, QUANTAS),
    enabled: !!conversationId,
    // Rede de segurança: se o socket cair, ainda assim atualiza sozinha.
    refetchInterval: 15_000,
  });

  // 🚨 AO VIVO DE VERDADE: o mesmo evento que a caixa de entrada escuta. Sem
  // isto, "tempo real" seria um recarregar de 15 em 15 segundos — e o advogado
  // está olhando a tela justamente nos segundos em que a resposta chega.
  useEffect(() => {
    if (!conversationId) return;
    const sai = on('message:new', (p: any) => {
      if (!p?.conversationId || p.conversationId === conversationId) {
        qc.invalidateQueries({ queryKey: ['conversa-ao-vivo', conversationId] });
      }
    });
    return () => { try { sai?.(); } catch { /* o desmonte não derruba a tela */ } };
  }, [on, qc, conversationId]);

  const bolhas = useMemo(() => {
    const todas = (data?.messages ?? []) as Message[];
    const corte = desde ? new Date(desde).getTime() : 0;
    return todas
      .filter((m) => !corte || new Date((m as any).createdAt).getTime() >= corte - 1000)
      .slice()
      .sort((a, b) => +new Date((a as any).createdAt) - +new Date((b as any).createdAt));
  }, [data, desde]);

  if (!caso) return null;
  if (!conversationId) {
    return (
      <p className="rounded-lg border border-dashed border-[#cfe0ed] p-3 text-[11px] dark:border-zinc-700">
        Sem conversa vinculada a este cliente.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-[#cfe0ed] bg-[#e9edef] p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f] dark:text-zinc-400">
          a conversa, ao vivo · {bolhas.length} {bolhas.length === 1 ? 'bolha' : 'bolhas'}
          {desde ? ' nesta rodada' : ''}
        </p>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin text-[#48626f]" />}
      </div>

      {!bolhas.length ? (
        <p className="py-2 text-center text-[11px] text-[#48626f] dark:text-zinc-500">
          {isLoading ? 'Carregando…' : 'Nada ainda nesta rodada.'}
        </p>
      ) : (
        <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
          {bolhas.map((m) => {
            const meu = String((m as any).direction).toUpperCase() !== 'INBOUND';
            const t = textoDa(m);
            const midia = rotuloDaMidia(m);
            return (
              <div key={(m as any).id} className={`flex ${meu ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[12px] leading-[1.35] shadow-sm ${
                    meu
                      ? 'bg-[#d9fdd3] text-[#101820] dark:bg-emerald-900/40 dark:text-zinc-100'
                      : 'bg-white text-[#101820] dark:bg-zinc-800 dark:text-zinc-100'
                  }`}
                >
                  {t ? (
                    <span className="whitespace-pre-wrap break-words">{t}</span>
                  ) : (
                    <span className="italic opacity-70">{midia ?? '(sem texto)'}</span>
                  )}
                  {t && midia && <span className="ml-1 text-[10px] italic opacity-60">· {midia}</span>}
                  <span className="ml-2 align-bottom text-[9px] opacity-50">
                    {hora((m as any).createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
