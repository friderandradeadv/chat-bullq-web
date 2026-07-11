'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LayoutGrid, Banknote, FileText, Clock, Building2, User, Phone, Mail, MapPin, IdCard, Users, Download, ExternalLink } from 'lucide-react';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { ResumoClienteRepb, BancosReusEditor, RepbFaseCard } from '@/features/legal-cases/components/bancos-reus-editor';

const ACCENT = '#B7791F';
const FASE_LABEL: Record<string, string> = {
  repb_novo_cliente: '01. Novos clientes', repb_docs_faltantes: '02. Documentos faltantes',
  repb_investigativa: '03. Fase investigativa', repb_provisionamento: '04. Em provisionamento',
  repb_negociacao: '05. Negociação', repb_acao_judicial: '06. Ação judicial',
  repb_acordo: '07. Acordo / cumprimento', repb_concluido: 'Concluído', repb_inviavel: 'Inviável',
};
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export default function RepbFichaPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: c, isLoading } = useQuery({ queryKey: ['legal-cases', 'detail', caseId], queryFn: () => legalCasesService.get(caseId), enabled: !!caseId });

  if (isLoading) return <div className="p-6 text-sm text-zinc-400">Carregando ficha…</div>;
  if (!c) return <div className="p-6 text-sm text-zinc-400">Caso não encontrado. <button onClick={() => router.push('/juridico/repb')} className="text-[#B7791F] hover:underline">Voltar</button></div>;

  const cliente = c.parties.find((p) => p.role === 'CLIENT');
  const cad: any = (c.metadata as any)?.cadastro ?? {};
  const malotes = ((c.metadata as any)?.faseData?.repb_malotes?.lista ?? []) as any[];
  const nome = (cliente?.name ?? c.title ?? 'Cliente').toUpperCase();
  const movements = [...(c.movements ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const refresh = () => qc.invalidateQueries({ queryKey: ['legal-cases', 'detail', caseId] });

  return (
    <div className="h-full overflow-y-auto bg-[#fafafa] text-[#101820] dark:bg-zinc-950 dark:text-zinc-200">
      {/* Cabeçalho */}
      <div className="border-b border-[#dbeaf5] bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 lg:px-6 lg:pt-12">
        <div className="mx-auto max-w-6xl">
          <button onClick={() => router.push('/juridico/repb')} className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-[#48626f] hover:text-[#B7791F] dark:text-zinc-400">
            <ArrowLeft className="h-4 w-4" /> Lista de clientes
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: ACCENT }}><Banknote className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold text-zinc-900 dark:text-zinc-100">{nome}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#48626f] dark:text-zinc-400">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: ACCENT }}>REPB</span>
                <span className="rounded-full bg-[#edeff3] px-2 py-0.5 text-[10px] font-semibold text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{FASE_LABEL[c.legalPhase ?? ''] ?? c.legalPhase}</span>
                {cad.cnpj && <span>· CNPJ {cad.cnpj}</span>}
                {c.responsible && <span>· {c.responsible.name}</span>}
              </div>
            </div>
            <button onClick={() => router.push(`/juridico/repb?foco=${caseId}`)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#B7791F]/40 px-3 py-1.5 text-sm font-semibold text-[#B7791F] hover:bg-[#B7791F]/10">
              <LayoutGrid className="h-4 w-4" /> Ver kanban dos bancos
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[1fr_360px] lg:px-6">
        {/* Coluna principal: nesta fase + panorama + bancos */}
        <div className="min-w-0 space-y-4">
          <RepbFaseCard phase={c.legalPhase} faseData={(c.metadata as any)?.faseData} parties={c.parties} />
          <ResumoClienteRepb parties={c.parties} />
          <BancosReusEditor caseId={c.id} parties={c.parties} malotes={malotes} onChanged={refresh} />
        </div>

        {/* Coluna lateral: cadastro + timeline + anexos */}
        <div className="space-y-4">
          {/* Cadastro do cliente */}
          <section className="rounded-xl border border-[#e3e8ef] bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center gap-1.5"><Building2 className="h-4 w-4 text-[#B7791F]" /><p className="text-[11px] font-semibold uppercase tracking-wide text-[#48626f]">Cadastro do cliente</p></div>
            <div className="mt-2 space-y-1.5 text-[13px]">
              {cad.cnpj && <Row icon={<IdCard className="h-3.5 w-3.5" />} v={cad.cnpj} k="CNPJ" />}
              {(cad.telefone) && <Row icon={<Phone className="h-3.5 w-3.5" />} v={cad.telefone} k="Telefone" />}
              {(cad.email) && <Row icon={<Mail className="h-3.5 w-3.5" />} v={cad.email} k="E-mail" />}
              {cad.endereco && <Row icon={<MapPin className="h-3.5 w-3.5" />} v={cad.endereco} k="Endereço" />}
              {cad.representante?.nome && <Row icon={<User className="h-3.5 w-3.5" />} v={`${cad.representante.nome}${cad.representante.cpf ? ` · ${cad.representante.cpf}` : ''}`} k="Representante" />}
              {Array.isArray(cad.avalistas) && cad.avalistas.length > 0 && <Row icon={<Users className="h-3.5 w-3.5" />} v={cad.avalistas.map((a: any) => a.nome).join(', ')} k="Avalistas" />}
              {cad.contador && <Row icon={<User className="h-3.5 w-3.5" />} v={cad.contador} k="Contador" />}
            </div>
            {Array.isArray(cad.empresasRelacionadas) && cad.empresasRelacionadas.length > 0 && (
              <div className="mt-2 border-t border-[#eef2f8] pt-2 dark:border-zinc-800">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Empresas do grupo</p>
                {cad.empresasRelacionadas.map((e: any, i: number) => <p key={i} className="mt-0.5 text-[12px] text-[#101820] dark:text-zinc-200">{e.razaoSocial}{e.cnpj ? ` · ${e.cnpj}` : ''}</p>)}
              </div>
            )}
            {(c.metadata as any)?.driveUrl && (
              <a href={(c.metadata as any).driveUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#B7791F] hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Pasta no Drive</a>
            )}
          </section>

          {/* Timeline (atividades / movimentos) */}
          <section className="rounded-xl border border-[#e3e8ef] bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-[#B7791F]" /><p className="text-[11px] font-semibold uppercase tracking-wide text-[#48626f]">Timeline</p><span className="rounded bg-[#edeff3] px-1.5 text-[11px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{movements.length}</span></div>
            {movements.length === 0 && <p className="mt-2 text-[12px] text-zinc-400">Sem movimentos ainda.</p>}
            <div className="mt-2 space-y-2.5">
              {movements.slice(0, 15).map((m) => (
                <div key={m.id} className="relative border-l border-[#e3e8ef] pl-3 dark:border-zinc-800">
                  <span className="absolute -left-[3px] top-1 h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
                  <p className="text-[10px] text-zinc-400">{fmtDate(m.date)}{m.source ? ` · ${m.source}` : ''}</p>
                  <p className="text-[12px] text-[#101820] dark:text-zinc-200">{m.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Anexos / documentos */}
          <section className="rounded-xl border border-[#e3e8ef] bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center gap-1.5"><FileText className="h-4 w-4 text-[#B7791F]" /><p className="text-[11px] font-semibold uppercase tracking-wide text-[#48626f]">Anexos</p><span className="rounded bg-[#edeff3] px-1.5 text-[11px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{c.documents?.length ?? 0}</span></div>
            {(!c.documents || c.documents.length === 0) && <p className="mt-2 text-[12px] text-zinc-400">Nenhum documento anexado.</p>}
            <div className="mt-2 space-y-1">
              {(c.documents ?? []).map((d) => (
                <a key={d.id} href={d.url ?? '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px] hover:bg-[#B7791F]/5">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <span className="min-w-0 flex-1 truncate text-[#101820] dark:text-zinc-200">{d.name}</span>
                  <span className="shrink-0 text-[10px] text-zinc-400">{fmtSize(d.sizeBytes)}</span>
                  {d.url && <Download className="h-3.5 w-3.5 shrink-0 text-[#B7791F]" />}
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-zinc-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">{k}</p>
        <p className="break-words text-[13px] text-[#101820] dark:text-zinc-200">{v}</p>
      </div>
    </div>
  );
}
