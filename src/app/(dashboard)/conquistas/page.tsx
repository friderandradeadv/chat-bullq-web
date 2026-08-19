'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Heart,
  Search,
  Sparkles,
  Star,
  Trash2,
  Check,
  X,
  Plus,
  Quote,
  MessageSquare,
  HandCoins,
  Users,
  Wand2,
  Loader2,
  Pencil,
  ExternalLink,
  ShieldAlert,
  Trophy,
  Image as ImageIcon,
} from 'lucide-react';
import {
  depoimentosService,
  ORIGEM_LABEL,
  type Depoimento,
  type DepoimentoStatus,
} from '@/features/depoimentos/services/depoimentos.service';
import { titleCaseName } from '@/lib/names';
import { trechoDeGratidao } from '@/features/depoimentos/lib/trecho-gratidao';
import { avatarColor, avatarInitials } from '@/lib/avatar';

const brl = (n: number | null | undefined) =>
  n === null || n === undefined
    ? null
    : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');

const ABA: { key: DepoimentoStatus; label: string }[] = [
  { key: 'APROVADO', label: 'Mural' },
  { key: 'SUGESTAO', label: 'Sugestões' },
  { key: 'DESCARTADO', label: 'Descartados' },
];

// ─── Placar ───────────────────────────────────────────────────────────────────

function Placar({
  icon: Icon,
  color,
  value,
  label,
  hint,
  erro,
}: {
  icon: React.ElementType;
  color: string;
  value: string | number;
  label: string;
  hint?: string;
  /** true = a consulta falhou. Mostra "—", nunca zero: zero é um fato, falha não. */
  erro?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" style={{ color }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      </div>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${erro ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-900 dark:text-zinc-50'}`}>
        {erro ? '—' : value}
      </p>
      {(erro || hint) && (
        <p className={`mt-0.5 text-[11px] ${erro ? 'text-rose-500' : 'text-zinc-400'}`}>
          {erro ? 'não consegui carregar' : hint}
        </p>
      )}
    </div>
  );
}

// ─── Cartão de depoimento ─────────────────────────────────────────────────────

function DepoimentoCard({
  d,
  onPatch,
  onRemove,
  onEdit,
}: {
  d: Depoimento;
  onPatch: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const nome = titleCaseName(d.clienteNome);
  const bg = avatarColor(nome);
  const valor = brl(d.valorRecuperado);
  // Cliente costuma abrir explicando o problema e só agradecer no fim. O card
  // mostra o trecho que interessa; a fala inteira fica a um clique, porque ela
  // é a prova de que a pessoa disse aquilo.
  const [completa, setCompleta] = useState(false);
  const resumo = trechoDeGratidao(d.mensagem, 400);
  const cortada = resumo !== d.mensagem.trim();

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200/70 bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60">
      {/* Quem */}
      <div className="flex items-start gap-3">
        {d.fotoUrl || d.contact?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(d.fotoUrl ?? d.contact?.avatarUrl) as string} alt={nome} className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: bg }}
          >
            {avatarInitials(nome)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {d.partyId ? (
              <Link href={`/clientes/${d.partyId}`} className="truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
                {nome}
              </Link>
            ) : (
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{nome}</p>
            )}
            {d.destaque && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-zinc-400">
            {[d.area, d.cnjNumber, fmtDate(d.mensagemEm ?? d.createdAt)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          onClick={() => onPatch({ destaque: !d.destaque })}
          title={d.destaque ? 'Tirar do destaque' : 'Destacar'}
          className="shrink-0 rounded-lg p-1.5 text-zinc-300 transition hover:bg-amber-50 hover:text-amber-500 dark:hover:bg-amber-900/20"
        >
          <Star className={`h-4 w-4 ${d.destaque ? 'fill-amber-400 text-amber-400' : ''}`} />
        </button>
      </div>

      {/* O caso e o que mudou */}
      {(d.caso || d.impacto || d.resultado || valor) && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50">
          {d.caso && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-400">O caso: </span>
              {d.caso}
            </p>
          )}
          {d.impacto && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-400">O que mudou: </span>
              {d.impacto}
            </p>
          )}
          {(d.resultado || valor) && (
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {[d.resultado, valor].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* A mensagem, literal */}
      <blockquote className="relative mt-3 flex-1 rounded-xl border-l-2 border-[#7048E8] bg-[#7048E8]/[0.04] px-3 py-2.5 dark:bg-[#7048E8]/10">
        <Quote className="absolute right-2 top-2 h-3.5 w-3.5 text-[#7048E8]/25" />
        <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-zinc-700 dark:text-zinc-200">
          {completa ? d.mensagem : resumo}
        </p>
        {cortada && (
          <button
            onClick={() => setCompleta((v) => !v)}
            className="mt-1.5 text-[11px] font-semibold text-[#7048E8] hover:underline"
          >
            {completa ? 'mostrar só o trecho' : 'ver mensagem completa'}
          </button>
        )}
      </blockquote>

      {/* Rodapé: prova + ações */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {ORIGEM_LABEL[d.origem]}
        </span>
        {d.sourceConversationId && (
          <Link
            href={`/inbox?conversationId=${d.sourceConversationId}`}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 transition hover:bg-[#228BE6]/10 hover:text-[#228BE6] dark:bg-zinc-800 dark:text-zinc-400"
          >
            <MessageSquare className="h-3 w-3" /> ver no chat
          </Link>
        )}
        {d.caseId && (
          <Link
            href={`/processos/${d.caseId}`}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 transition hover:bg-[#228BE6]/10 hover:text-[#228BE6] dark:bg-zinc-800 dark:text-zinc-400"
          >
            <ExternalLink className="h-3 w-3" /> processo
          </Link>
        )}

        <div className="ml-auto flex items-center gap-1">
          {d.status !== 'APROVADO' && (
            <button
              onClick={() => onPatch({ status: 'APROVADO' })}
              title="Aprovar (vai pro mural)"
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          {d.status !== 'DESCARTADO' && (
            <button
              onClick={() => onPatch({ status: 'DESCARTADO' })}
              title="Descartar (não é depoimento)"
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onEdit}
            title="Editar"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onRemove}
            title="Excluir"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Formulário (novo / editar) ───────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-[#DEE2E6] bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-[#228BE6] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

function DepoimentoForm({
  edit,
  onClose,
  onSave,
  saving,
}: {
  edit: Depoimento | null;
  onClose: () => void;
  onSave: (v: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [f, setF] = useState({
    clienteNome: edit?.clienteNome ?? '',
    mensagem: edit?.mensagem ?? '',
    caso: edit?.caso ?? '',
    impacto: edit?.impacto ?? '',
    resultado: edit?.resultado ?? '',
    area: edit?.area ?? '',
    cnjNumber: edit?.cnjNumber ?? '',
    valorRecuperado: edit?.valorRecuperado != null ? String(edit.valorRecuperado) : '',
    autorizadoDivulgacao: edit?.autorizadoDivulgacao ?? false,
  });
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    if (!f.clienteNome.trim() || !f.mensagem.trim()) {
      toast.error('Nome do cliente e mensagem de agradecimento são obrigatórios.');
      return;
    }
    const valor = f.valorRecuperado.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    onSave({
      clienteNome: f.clienteNome.trim(),
      mensagem: f.mensagem.trim(),
      caso: f.caso.trim() || undefined,
      impacto: f.impacto.trim() || undefined,
      resultado: f.resultado.trim() || undefined,
      area: f.area.trim() || undefined,
      cnjNumber: f.cnjNumber.trim() || undefined,
      valorRecuperado: valor && Number.isFinite(Number(valor)) ? Number(valor) : undefined,
      autorizadoDivulgacao: f.autorizadoDivulgacao,
      ...(edit ? {} : { status: 'APROVADO' as const }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-[#E64980]" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {edit ? 'Editar depoimento' : 'Novo depoimento'}
          </h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-500">A pessoa *</label>
            <input className={inputCls} value={f.clienteNome} onChange={(e) => set('clienteNome', e.target.value)} placeholder="Ex.: Gilvan Xavier" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-500">Qual era o caso</label>
            <input className={inputCls} value={f.caso} onChange={(e) => set('caso', e.target.value)} placeholder="Ex.: Descontos de cartão consignado no benefício do INSS" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-500">Como a vida dela mudou</label>
            <textarea className={`${inputCls} min-h-[70px]`} value={f.impacto} onChange={(e) => set('impacto', e.target.value)} placeholder="Ex.: Recebeu o dinheiro numa hora em que precisava e conseguiu acertar as contas." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">O que foi recuperado</label>
              <input className={inputCls} value={f.resultado} onChange={(e) => set('resultado', e.target.value)} placeholder="Ex.: Valor devolvido pelo Agibank" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Valor (R$)</label>
              <input className={inputCls} value={f.valorRecuperado} onChange={(e) => set('valorRecuperado', e.target.value)} placeholder="12480,00" inputMode="decimal" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Área</label>
              <input className={inputCls} value={f.area} onChange={(e) => set('area', e.target.value)} placeholder="RMC/RCC, INSS, Trabalhista…" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Nº do processo</label>
              <input className={inputCls} value={f.cnjNumber} onChange={(e) => set('cnjNumber', e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-500">A mensagem de agradecimento *</label>
            <textarea
              className={`${inputCls} min-h-[120px]`}
              value={f.mensagem}
              onChange={(e) => set('mensagem', e.target.value)}
              placeholder="Cole aqui, do jeito que o cliente falou (ou a transcrição do áudio)."
            />
          </div>
          <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-900/15">
            <input
              type="checkbox"
              checked={f.autorizadoDivulgacao}
              onChange={(e) => set('autorizadoDivulgacao', e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#228BE6]"
            />
            <span className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              O cliente autorizou expressamente o uso deste depoimento fora do escritório.
              Sem essa autorização, o registro fica de <strong>uso interno</strong>.
            </span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#228BE6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1c7ed6] disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {edit ? 'Salvar' : 'Guardar história'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ConquistasPage() {
  const qc = useQueryClient();
  const [aba, setAba] = useState<DepoimentoStatus>('APROVADO');
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [form, setForm] = useState<{ open: boolean; edit: Depoimento | null }>({ open: false, edit: null });
  const [progresso, setProgresso] = useState<
    { rodadas: number; criados: number; transcritos: number; pendentes: number } | null
  >(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['depoimentos', aba],
    queryFn: () => depoimentosService.list({ status: aba }),
    staleTime: 30_000,
  });
  const { data: stats, isError: statsErro } = useQuery({
    queryKey: ['depoimentos', 'stats'],
    queryFn: () => depoimentosService.stats(),
    staleTime: 60_000,
    retry: 1,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['depoimentos'] });

  // Varredura PROFUNDA, em rodadas. Transcrever áudio é lento (é ali que mora o
  // agradecimento de verdade — "caiu o dinheiro, muito obrigado"), então cada
  // chamada transcreve uma fatia e devolve quantos faltam; repetimos até zerar.
  // Uma requisição única transcrevendo tudo estouraria o tempo limite do proxy.
  const MAX_RODADAS = 40;
  const varredura = useMutation({
    mutationFn: async () => {
      let criados = 0;
      let transcritos = 0;
      let candidatos = 0;
      let ia = false;
      let rodadas = 0;
      let pendentes = 0;
      for (;;) {
        const r = await depoimentosService.varrer({
          dias: 3650, // histórico inteiro
          limite: 120,
          transcrever: 6,
        });
        rodadas += 1;
        criados += r.criados;
        transcritos += r.audiosTranscritos;
        candidatos = r.candidatos;
        pendentes = r.audiosPendentes;
        ia = ia || r.ia;
        setProgresso({ rodadas, criados, transcritos, pendentes });
        // O backend corta por tempo, então "sem áudio na fila" não significa
        // "acabou": pode ter sobrado candidato sem analisar.
        const sobrou = r.maisPorFazer ?? pendentes > 0;
        if (!sobrou || rodadas >= MAX_RODADAS) break;
      }
      return { criados, transcritos, candidatos, ia, rodadas, pendentes };
    },
    onSettled: () => setProgresso(null),
    onSuccess: (r) => {
      invalidate();
      const detalhe = [
        r.transcritos > 0 ? `${r.transcritos} áudio${r.transcritos > 1 ? 's' : ''} transcrito${r.transcritos > 1 ? 's' : ''}` : null,
        r.ia ? 'IA confirmou' : 'sem IA — só palavras-chave',
      ]
        .filter(Boolean)
        .join(' · ');

      if (r.criados > 0) {
        setAba('SUGESTAO');
        toast.success(
          `${r.criados} ${r.criados === 1 ? 'agradecimento novo' : 'agradecimentos novos'} — confira nas Sugestões. (${detalhe})`,
        );
      } else {
        toast.info(`Nenhum agradecimento novo (${r.candidatos} mensagens já conferidas · ${detalhe}).`);
      }
      // Parou no teto de rodadas: ainda há áudio na fila, vale clicar de novo.
      if (r.pendentes > 0) {
        toast.info(`Ainda faltam ${r.pendentes} áudios pra transcrever — clique de novo pra continuar de onde parou.`);
      }
    },
    onError: (e: unknown) => {
      // Mensagem genérica esconde a causa e nos deixa adivinhando. Mostra o que
      // o servidor disse — status e texto — pra dar pra agir.
      const err = e as { response?: { status?: number; data?: { message?: string | string[] } }; message?: string };
      const status = err?.response?.status;
      const detalhe = Array.isArray(err?.response?.data?.message)
        ? err.response!.data!.message!.join(', ')
        : err?.response?.data?.message ?? err?.message ?? 'erro desconhecido';
      const dica =
        status === 504 || status === 502 || /timeout/i.test(String(detalhe))
          ? ' A varredura demorou demais e o servidor cortou — clique de novo, ela continua de onde parou.'
          : '';
      toast.error(`Falha na varredura${status ? ` (HTTP ${status})` : ''}: ${detalhe}.${dica}`, { duration: 12_000 });
    },
  });

  const fotos = useMutation({
    mutationFn: () => depoimentosService.buscarFotos(),
    onSuccess: (r) => {
      invalidate();
      if (r.comFoto > 0) toast.success(`${r.comFoto} de ${r.tentados} ganharam foto do WhatsApp.`);
      else if (r.tentados === 0) toast.info('Todo mundo do mural já tem foto.');
      else toast.info(`Nenhuma foto nova (${r.tentados} tentados${r.semCanal ? `, ${r.semCanal} sem WhatsApp vinculado` : ''}).`);
    },
    onError: () => toast.error('Não consegui buscar as fotos agora.'),
  });

  const salvar = useMutation({
    mutationFn: (v: Record<string, unknown>) =>
      form.edit
        ? depoimentosService.update(form.edit.id, v as never)
        : depoimentosService.create(v as never),
    onSuccess: () => {
      invalidate();
      setForm({ open: false, edit: null });
      toast.success('Depoimento guardado.');
    },
    onError: () => toast.error('Não consegui salvar.'),
  });

  const patch = useMutation({
    mutationFn: ({ id, v }: { id: string; v: Record<string, unknown> }) =>
      depoimentosService.update(id, v as never),
    onSuccess: () => invalidate(),
    onError: () => toast.error('Não consegui atualizar.'),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => depoimentosService.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Depoimento removido.');
    },
  });

  const areas = useMemo(
    () => Array.from(new Set(rows.map((r) => r.area).filter(Boolean))).sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (area && r.area !== area) return false;
      if (q && !`${r.clienteNome} ${r.mensagem} ${r.caso ?? ''} ${r.impacto ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, area]);

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 p-4 text-zinc-800 lg:p-6 dark:bg-zinc-950 dark:text-zinc-200">
      <div className="mx-auto w-full max-w-6xl">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center gap-2">
          <Heart className="h-5 w-5 text-[#E64980]" />
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Conquistas</h1>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
            {filtered.length}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              onClick={() => varredura.mutate()}
              disabled={varredura.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-[#DEE2E6] bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {varredura.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 text-[#7048E8]" />}
              {varredura.isPending && progresso
                ? `Varrendo… ${progresso.criados} achados${progresso.pendentes > 0 ? ` · ${progresso.pendentes} áudios na fila` : ''}`
                : 'Procurar agradecimentos'}
            </button>
            <button
              onClick={() => fotos.mutate()}
              disabled={fotos.isPending}
              title="Busca no WhatsApp a foto de quem está sem avatar"
              className="inline-flex items-center gap-2 rounded-lg border border-[#DEE2E6] bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {fotos.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4 text-[#228BE6]" />}
              Buscar fotos
            </button>
            <button
              onClick={() => setForm({ open: true, edit: null })}
              className="inline-flex items-center gap-2 rounded-lg bg-[#228BE6] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1c7ed6]"
            >
              <Plus className="h-4 w-4" /> Nova história
            </button>
          </div>
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">
          As vidas que o escritório mudou — quem é a pessoa, qual era o caso, o que foi recuperado e o que ela disse.
        </p>

        {/* Placar */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Placar erro={statsErro} icon={Heart} color="#E64980" value={stats?.total ?? 0} label="histórias" hint={stats?.noMes ? `${stats.noMes} neste mês` : undefined} />
          <Placar
            erro={statsErro}
            icon={Trophy}
            color="#02883C"
            value={stats?.vitorias ?? 0}
            label="ações vencidas"
            hint="favoráveis e ganhas"
          />
          <Placar
            erro={statsErro}
            icon={Users}
            color="#7048E8"
            value={stats?.vidas ?? 0}
            label="vidas alcançadas"
            hint="pessoas com vitória ou depoimento"
          />
          <Placar
            erro={statsErro}
            icon={HandCoins}
            color="#02883C"
            value={brl(stats?.repassadoAosClientes ?? 0) ?? 'R$ 0,00'}
            label="devolvido aos clientes"
            hint="prestações de contas dos processos"
          />
          <Placar
            erro={statsErro}
            icon={Sparkles}
            color="#F59F00"
            value={brl(stats?.valorCitado ?? 0) ?? 'R$ 0,00'}
            label="citado nos depoimentos"
            hint="valores que os próprios clientes contaram"
          />
        </div>

        {/* Abas + filtros */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-[#DEE2E6] dark:border-zinc-700">
            {ABA.map((a) => (
              <button
                key={a.key}
                onClick={() => setAba(a.key)}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  aba === a.key
                    ? 'bg-[#228BE6] text-white'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {a.label}
                {a.key === 'SUGESTAO' && (stats?.sugestoes ?? 0) > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${aba === a.key ? 'bg-white/20' : 'bg-[#E64980] text-white'}`}>
                    {stats!.sugestoes}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pessoa, caso, frase…"
              className="h-9 w-64 rounded-lg border border-[#DEE2E6] bg-white pl-8 pr-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-[#228BE6] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
          </div>
          {areas.length > 0 && (
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="h-9 rounded-lg border border-[#DEE2E6] bg-white px-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <option value="">Todas as áreas</option>
              {areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          )}
        </div>

        {/* Mural */}
        {isLoading ? (
          <p className="mt-6 text-sm text-zinc-400">Carregando…</p>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
            <Heart className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-zinc-500">
              {aba === 'APROVADO' ? 'Nenhuma história no mural ainda.' : 'Nada aqui.'}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Clique em <strong>Procurar agradecimentos</strong> para o hub varrer as conversas, ou
              cadastre a primeira em <strong>Nova história</strong>.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((d) => (
              <DepoimentoCard
                key={d.id}
                d={d}
                onPatch={(v) => patch.mutate({ id: d.id, v })}
                onRemove={() => excluir.mutate(d.id)}
                onEdit={() => setForm({ open: true, edit: d })}
              />
            ))}
          </div>
        )}

        {/* Nota de ética — o mural é memória interna, não publicidade */}
        <div className="mt-8 flex items-start gap-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-900/15">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
            <strong>Uso interno.</strong> O Provimento 205/2021 do CFOAB restringe divulgar casos,
            êxitos e depoimentos de clientes na publicidade da advocacia. Este mural existe para a
            memória e a motivação da equipe; para usar uma história fora daqui, marque a autorização
            expressa do cliente no cadastro e confira o enquadramento antes.
          </p>
        </div>
      </div>

      {form.open && (
        <DepoimentoForm
          edit={form.edit}
          saving={salvar.isPending}
          onClose={() => setForm({ open: false, edit: null })}
          onSave={(v) => salvar.mutate(v)}
        />
      )}
    </div>
  );
}
