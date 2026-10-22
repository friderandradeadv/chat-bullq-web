'use client';

import { useState } from 'react';
import { FileText, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DossieReplica } from './dossie-replica';
import { CumprimentoCs } from './cumprimento-cs';
import { TriagemPeca } from './triagem-peca';

/**
 * O QUE A PUBLICAÇÃO PEDE, e o que dá para fazer com isso.
 *
 * O classificador do DJEN já lê a publicação e grava a `action` na tarefa. Daqui
 * o card mostra a peça sugerida, o estado da família e um campo para o advogado
 * dizer o que quer. Nada disso adivinha: o catálogo vem do servidor.
 *
 * 🚨 SUGERIR NÃO É MONTAR, e a diferença não é retórica. No OTAIR o card dizia
 * "o réu não reverteu a decisão e o crédito do cliente está exigível", e a
 * sentença mandava apenas cancelar um cartão: quem lesse só a publicação teria
 * montado execução de quantia certa com confiança. Por isso aqui está escrito
 * "a publicação sugere", e quem confirma são os autos, dentro de cada família.
 *
 * 🚨 O BOTÃO SÓ APARECE ONDE HÁ CAMINHO. Botão igual em toda família ensinaria
 * que toda família monta, e a primeira que não montasse pareceria defeito. As
 * que não montam dizem POR QUÊ, com a medida: quantas bases, quantos
 * marcadores, o que falta.
 */
type Familia = {
  acao: string; rotulo: string; skill: string | null;
  estado: 'pronta' | 'triagem' | 'base-sem-preenchedor' | 'sem-base' | 'nao-e-peca';
  porque?: string;
  /* 🚨 o selo do estado não serve a toda família: em embargos a triagem lê a
     DECISÃO e mede o vício, em contrarrazões lê o RECURSO ADVERSO e escolhe
     entre cinco modelos. Quando a família manda o seu, é o dela que vale. */
  selo?: string;
};

const SELO: Record<Familia['estado'], { texto: string; classe: string }> = {
  'pronta': { texto: 'pronta', classe: 'text-emerald-700 dark:text-emerald-400' },
  'triagem': { texto: 'leio os autos e faço a triagem', classe: 'text-sky-700 dark:text-sky-400' },
  'base-sem-preenchedor': { texto: 'base pronta, preenchimento pendente', classe: 'text-amber-700 dark:text-amber-400' },
  'sem-base': { texto: 'sem base', classe: 'text-zinc-500 dark:text-zinc-400' },
  'nao-e-peca': { texto: 'não produz petição', classe: 'text-zinc-500 dark:text-zinc-400' },
};

export function SugestaoDePeca({ caseId, acao, recorte }: {
  caseId: string;
  acao: string | null;
  recorte?: string | null;
}) {
  const [texto, setTexto] = useState('');
  const [rascunho, setRascunho] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const { data } = useQuery({
    queryKey: ['pecas', 'familias'],
    queryFn: async (): Promise<Familia[]> => {
      const { data } = await api.get('/legal-cases/pecas/familias');
      return ((data?.data ?? data)?.familias ?? []) as Familia[];
    },
    staleTime: 10 * 60_000,
  });

  const familia = data?.find((f) => f.acao === acao) ?? null;

  /* 🚨 SEM FAMÍLIA, O CARD FICAVA MUDO — e some justamente onde mais serve.
     Medido em 21/10/2026 num prazo de "Manifestar nos autos": o classificador
     emite 26 classes, o catálogo tinha 22, e `manifestacao` era uma das que
     faltavam. Resultado: nem a sugestão nem o CAMPO DE INSTRUÇÃO apareciam na
     peça mais aberta de todas. O serviço da API já dizia a regra certa
     ("guarda mesmo quando a família ainda não monta"); o componente é que
     desistia. Agora, família desconhecida vira aviso + campo, nunca silêncio:
     o catálogo pode envelhecer de novo, e o campo não pode sumir com ele. */
  if (!acao) return null;
  const desconhecida = !familia;

  /* 🚨 ESTE BOTÃO COMEÇA A PEÇA, não guarda bilhete. Ele guardava o texto e
     dizia "anotado", e o advogado perguntou por que escrever ali se nada
     acontecia. Agora redige o corpo a partir da instrução e do recorte, e
     devolve o rascunho aqui embaixo para ele ler ANTES de virar documento:
     a regra da casa é não inserir texto criado do zero sem o aval dele. */
  const salvar = async () => {
    setSalvando(true);
    try {
      const { data } = await api.post(`/legal-cases/${caseId}/peca/redigir`,
        { acao, instrucao: texto, recorte });
      const r = (data?.data ?? data) as { ok?: boolean; motivo?: string; rascunho?: string };
      if (r?.ok === false) { toast.error(r.motivo ?? 'não consegui redigir'); return; }
      setRascunho(r?.rascunho ?? '');
      setSalvo(true);
      /* 🚨 NÃO PROMETA MONTAGEM: este botão só GUARDA o texto. Dizia "entra na
         montagem desta peça" e o advogado perguntou, com razão, se a peça tinha
         começado a ser montada — nada tinha começado. Botão que insinua
         trabalho em curso faz procurar barra de progresso que não existe. */
      toast.success('Redigi o rascunho. Leia abaixo antes de virar documento.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'não consegui redigir');
    } finally { setSalvando(false); }
  };

  const selo = familia ? SELO[familia.estado] : SELO['sem-base'];
  const seloTexto = desconhecida ? 'classe sem família no catálogo' : (familia!.selo ?? selo.texto);
  const rotulo = familia?.rotulo ?? acao;
  const porque = desconhecida
    ? 'esta classe de publicação ainda não tem família no catálogo de peças. O campo abaixo '
      + 'funciona do mesmo jeito: escreva o que a peça tem de dizer e fica guardado'
    : familia!.porque;

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          <FileText className="h-3.5 w-3.5" /> A publicação sugere: {rotulo}
        </p>
        <span className={`shrink-0 text-[10px] font-medium ${selo.classe}`}>{seloTexto}</span>
      </div>

      {recorte && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
          “{recorte.trim().slice(0, 220)}”
        </p>
      )}

      {familia?.estado !== 'pronta' && porque && (
        <p className="mt-1.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
          {porque}.
        </p>
      )}

      {/* o campo existe em TODA família, inclusive nas que ainda não montam:
          é nas peças abertas que ele mais serve, e guardado ele está lá no dia
          em que a família for ligada */}
      <div className="mt-2.5">
        <textarea
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setSalvo(false); }}
          rows={2}
          placeholder="O que você quer nesta peça? (ex.: ataca pela ausência de ICP; pede só a conversão, sem dano moral)"
          className="w-full resize-y rounded-md border border-zinc-300 bg-transparent px-2.5 py-1.5 text-[11px]
                     leading-4 outline-none placeholder:text-zinc-400 focus:border-zinc-400
                     dark:border-zinc-700 dark:placeholder:text-zinc-600 dark:focus:border-zinc-500"
        />
        {texto.trim() && (
          <button
            onClick={salvar}
            disabled={salvando || salvo}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#7C3AED' }}
          >
            {salvando ? <Loader2 className="h-3 w-3 animate-spin" />
              : salvo ? <Check className="h-3 w-3" /> : null}
            {salvo ? 'redigido' : 'Redigir'}
          </button>
        )}
      </div>

      {rascunho && (
        <div className="mt-2.5 rounded-md border border-zinc-200 dark:border-zinc-800">
          <p className="border-b border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
            Rascunho do corpo — leia antes de virar documento
          </p>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap px-2.5 py-2 text-[11px] leading-[1.45] text-zinc-700 dark:text-zinc-300">
            {rascunho}
          </pre>
          {/* 🚨 a lacuna é marca de conferência, não defeito: o redator põe
              [CONFERIR: ...] onde faltou dado, em vez de inventar o fato */}
          {rascunho.includes('[CONFERIR:') && (
            <p className="border-t border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              Há marcas <span className="font-mono">[CONFERIR: …]</span>: são dados que não
              estavam no recorte nem na sua instrução. Resolva antes de protocolar.
            </p>
          )}
        </div>
      )}

      {/* 🚨 o botão só aparece onde HÁ triagem — e é o catálogo do hub que diz
          quais são, não uma lista escrita aqui, que envelheceria sozinha */}
      {familia?.estado === 'triagem' && (
        <TriagemPeca caseId={caseId} acao={familia.acao} rotulo={familia.rotulo} />
      )}
      {familia?.acao === 'replica' && (
        <div className="mt-2.5"><DossieReplica caseId={caseId} sempreVisivel /></div>
      )}
      {familia?.acao === 'cumprimento' && (
        <div className="mt-2.5"><CumprimentoCs caseId={caseId} sempreVisivel /></div>
      )}
    </div>
  );
}
