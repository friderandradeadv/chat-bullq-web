'use client';

/**
 * O PORTÃO DO EXTRATO, no alto do card.
 *
 * 🚨 POR QUE SUBIU PARA CÁ (21/10/2026). O veredito nasceu dentro da lista do
 * pacote, na linha `08.1 EXTRATO DA CONTA`, e ele abriu o card e disse: *"Não
 * aparece, deve aparecer bem no começo, nítido"*. Tinha razão: o que decide se
 * a ação pode ou não ser protocolada não pode morar no fim de uma lista de nove
 * documentos, atrás de duas rolagens. A linha do pacote continua, porque é lá
 * que se confere documento por documento; aqui fica a CONCLUSÃO.
 *
 * O conteúdo é medido na montagem da peça, nos contratos do grupo, e gravado em
 * `metadata.portaoDoExtrato`. Card sem medição não mostra nada: ausência de
 * medição não é veredito. Ver `portao-do-extrato.ts` na API.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Loader2, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type CaseDetail } from '@/features/legal-cases/services/legal-cases.service';

type Portao = {
  caso: 'declarado' | 'sem-vantagem' | 'sinal-presente' | 'sem-refinanciamento' | 'cotejo-nao-medido';
  protocolaSemExtrato: boolean;
  motivo: string;
  refis?: number;
  declarados?: number;
  emBranco?: number;
  zerados?: number;
  datas?: string[];
  sinaisPresentes?: string[];
};

export function PortaoDoExtrato({ caso }: { caso: CaseDetail }) {
  const qc = useQueryClient();
  const [pedindo, setPedindo] = useState(false);
  const p = (caso.metadata as any)?.portaoDoExtrato as Portao | undefined;
  const pedido = (caso.metadata as any)?.extratoDaConta as { pedidoEm?: string } | undefined;

  // Sem medição, e sem cadeia de refinanciamento, não há o que dizer.
  if (!p?.caso || p.caso === 'sem-refinanciamento') return null;

  const segura = !p.protocolaSemExtrato;

  const pedir = async () => {
    setPedindo(true);
    try {
      const r = await legalCasesService.pedirExtratoDaConta(caso.id);
      if (r?.enviado) toast.success(`Pedido enviado: ${(r.datas ?? []).join(', ') || 'extrato da conta'}.`);
      else toast.info(r?.motivo ?? 'O pedido já havia sido feito.');
      await qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caso.id] });
      qc.invalidateQueries({ queryKey: ['legal-cases'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Não consegui mandar o pedido.');
    } finally {
      setPedindo(false);
    }
  };

  // Vermelho é o que segura o protocolo. Verde é o que libera. Nada de âmbar
  // aqui: âmbar já é a cor do "quase", e este bloco responde sim ou não.
  const cor = segura
    ? {
      caixa: 'border-red-300 bg-red-50 dark:border-red-800/60 dark:bg-red-900/20',
      icone: 'text-red-700 dark:text-red-400',
      titulo: 'text-red-900 dark:text-red-100',
      texto: 'text-red-900 dark:text-red-200',
      fraco: 'text-red-800 dark:text-red-300',
      // 🚨 Cor explícita no botão: `border-current/30` não vira regra nenhuma,
      // porque o modificador de opacidade não se aplica a `currentColor` — o
      // botão sairia sem borda, parecendo texto solto.
      botao: 'border-red-300 text-red-900 hover:bg-red-100 dark:border-red-800/60 dark:text-red-200 dark:hover:bg-red-900/40',
    }
    : {
      caixa: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-900/20',
      icone: 'text-emerald-700 dark:text-emerald-400',
      titulo: 'text-emerald-900 dark:text-emerald-100',
      texto: 'text-emerald-900 dark:text-emerald-200',
      fraco: 'text-emerald-800 dark:text-emerald-300',
      botao: 'border-emerald-300 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800/60 dark:text-emerald-200 dark:hover:bg-emerald-900/40',
    };

  const Icone = segura ? AlertTriangle : ShieldCheck;

  return (
    <div className={`mt-3 rounded-lg border p-2.5 ${cor.caixa}`}>
      <div className="flex items-start gap-1.5">
        <Icone className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${cor.icone}`} />
        <div className="flex-1">
          <p className={`text-sm font-medium ${cor.titulo}`}>
            {segura
              ? 'Extrato da conta: não protocole sem ele'
              : 'Extrato da conta: não segura o protocolo'}
          </p>

          <p className={`mt-1 text-[11px] leading-4 ${cor.texto}`}>{p.motivo}</p>

          {p.sinaisPresentes?.length ? (
            <ul className={`mt-1 list-disc pl-4 text-[11px] leading-4 ${cor.fraco}`}>
              {p.sinaisPresentes.map((s) => <li key={s}>{s}</li>)}
            </ul>
          ) : null}

          {/* 🚨 PEDIR VALE NOS DOIS CASOS. Com o portão aberto o documento deixa
              de ser condição, não de ser útil: o que chegar depois serve na
              réplica. O servidor recusa fora das 6h às 20h e no pedido repetido. */}
          {pedido?.pedidoEm ? (
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Extrato pedido ao cliente em{' '}
              {new Date(pedido.pedidoEm).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          ) : (
            <button
              type="button"
              onClick={pedir}
              disabled={pedindo}
              className={`mt-2 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium disabled:opacity-50 ${cor.botao}`}
            >
              {pedindo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Pedir o extrato ao cliente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
