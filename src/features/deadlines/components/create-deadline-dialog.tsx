'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { activitiesService, ENTITY_TYPE } from '@/features/activities/services/activities.service';
import { deadlinesService, type PrazoPreview } from '@/features/deadlines/services/deadlines.service';
import { legalCasesService } from '@/features/legal-cases/services/legal-cases.service';
import { membersService } from '@/features/settings/services/members.service';
import { CaseSearch } from '@/features/legal-cases/components/case-search';
import { TagSelector } from '@/features/activities/components/tag-selector';
import { Modal } from '@/components/ui/modal';
import { useAuthStore } from '@/stores/auth-store';
import { inputCls, Field } from '@/app/(dashboard)/processos/page';

const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ── Novo PRAZO ────────────────────────────────────────────────────────────────
// ESTE é o diálogo de prazo do hub: o mesmo na agenda e na ficha do processo.
// Dois modos, exatamente os que o backend aceita (CreateDeadlineDto):
//  • CALCULAR — dias + base (disponibilização / publicação / início da contagem):
//    o servidor conta em dias ÚTEIS (CPC 219/224/220), com dobro (CPC 183/186/229)
//    e corridos quando for o caso, e devolve a data FATAL e o prazo de segurança.
//  • INFORMAR AS DATAS — quando a fatal já é conhecida (veio do Projudi/cálculo).
// A agenda mostra o prazo no dia do PRAZO DE SEGURANÇA; a fatal é a data legal e
// fica na ficha. Prazo SEM processo não existe (a relação é obrigatória) — por
// isso, aberto de dentro de um processo (`fixedCase`), o campo vem travado nele.
export function CreateDeadlineDialog({
  date,
  fixedCase,
  onClose,
  onSaved,
}: {
  date?: Date;
  fixedCase?: { id: string; title: string; cnjNumber: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  // Responsável, via de regra, é QUEM ESTÁ CRIANDO — vem preenchido e pode trocar.
  const meId = useAuthStore((s) => s.user?.id) ?? '';
  const [title, setTitle] = useState('');
  const [caseId, setCaseId] = useState(fixedCase?.id ?? '');
  const [assignedToId, setAssignedToId] = useState(meId);
  const [type, setType] = useState<'FATAL' | 'ORDINARY' | 'INTERNAL'>('ORDINARY');
  // Clicou num dia do calendário → já sabe a data: abre em "informar as datas".
  const [modo, setModo] = useState<'calc' | 'datas'>(date ? 'datas' : 'calc');
  // modo calcular
  const [dias, setDias] = useState(15);
  const [base, setBase] = useState<'disponibilizacao' | 'publicacao' | 'inicio'>('disponibilizacao');
  const [baseDia, setBaseDia] = useState(toDateInput(new Date()));
  const [dobro, setDobro] = useState(false);
  const [corridos, setCorridos] = useState(false);
  const [preview, setPreview] = useState<PrazoPreview | null>(null);
  // modo datas
  const [fatalDia, setFatalDia] = useState(date ? toDateInput(date) : '');
  const [safeDia, setSafeDia] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Dentro do processo o caso já está decidido: não busca a lista inteira.
  const { data: cases = [] } = useQuery({ queryKey: ['legal-cases', 'select'], queryFn: () => legalCasesService.list({ status: 'ACTIVE' }), enabled: !fixedCase });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => membersService.list() });

  // Dia (YYYY-MM-DD) → ISO às 09:00 LOCAL (hora canônica dos itens "dia todo";
  // meia-noite local virava 03:00Z e jogava o prazo pro dia anterior).
  const dayToIso = (v: string) => new Date(`${v}T09:00:00`).toISOString();
  // Base da contagem escolhida no select → o campo que o backend espera.
  const basePayload = () => (base === 'publicacao' ? { publicacao: baseDia } : base === 'inicio' ? { inicio: baseDia } : { disponibilizacao: baseDia });
  const fmtDia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

  // Prévia do cálculo enquanto digita — mostra a fatal ANTES de salvar.
  useEffect(() => {
    if (modo !== 'calc' || !dias || !baseDia) { setPreview(null); return; }
    let vivo = true;
    const t = setTimeout(() => {
      deadlinesService.preview({ dias, ...basePayload(), dobro, corridos })
        .then((p) => { if (vivo) setPreview(p); })
        .catch(() => { if (vivo) setPreview(null); });
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [modo, dias, base, baseDia, dobro, corridos]);

  const submit = async () => {
    if (!title.trim()) return toast.error('Informe o título');
    if (!caseId) return toast.error('Prazo precisa de um processo vinculado');
    if (modo === 'datas' && !fatalDia) return toast.error('Informe o prazo fatal');
    if (modo === 'calc' && (!dias || !baseDia)) return toast.error('Informe os dias e a data da intimação');
    setSaving(true);
    try {
      const dl = await deadlinesService.create({
        caseId,
        title: title.trim(),
        type,
        assignedToId: assignedToId || undefined,
        ...(modo === 'calc'
          ? { dias, ...basePayload(), dobro, corridos }
          : { dueDate: dayToIso(fatalDia), safeDate: dayToIso(safeDia || fatalDia) }),
        // A descrição do prazo não tem coluna própria: mora em metadata.djen.descricao
        // (mesmo lugar que a agenda e a ficha já leem/editam).
        ...(descricao.trim() ? { metadata: { djen: { descricao: descricao.trim() } } } : {}),
      });
      if (tagIds.length) await Promise.all(tagIds.map((id) => activitiesService.attachTag(ENTITY_TYPE.prazo, dl.id, id).catch(() => {})));
      toast.success('Prazo criado'); onSaved();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Erro ao criar o prazo'); } finally { setSaving(false); }
  };

  return (
    <Modal title="Adicionar prazo" onClose={onClose} wide headerRight={<TagSelector selected={tagIds} onChange={setTagIds} />}>
      <div className="space-y-4">
        <Field label={<>Título <span className="text-rose-500">*</span></>}><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Ex.: Apresentar contestação" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={<>Processo <span className="text-rose-500">*</span></>}>
            {fixedCase ? (
              <div className="flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/40" title="O prazo é deste processo">
                <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">{fixedCase.title}{fixedCase.cnjNumber && <span className="ml-2 font-mono text-xs text-zinc-400">{fixedCase.cnjNumber}</span>}</span>
              </div>
            ) : (
              <CaseSearch value={caseId} onChange={setCaseId} cases={cases.map((c) => ({ id: c.id, title: c.title, cnjNumber: c.cnjNumber ?? null }))} />
            )}
          </Field>
          <Field label="Responsável"><select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className={inputCls}><option value="">Ninguém</option>{members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}{m.user.id === meId ? ' (eu)' : ''}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><select value={type} onChange={(e) => setType(e.target.value as 'FATAL' | 'ORDINARY' | 'INTERNAL')} className={inputCls}><option value="ORDINARY">Comum</option><option value="FATAL">Fatal</option><option value="INTERNAL">Interno</option></select></Field>
          <Field label="Como definir a data">
            <div className="flex h-[38px] items-center gap-1 rounded-md border border-zinc-300 p-1 dark:border-zinc-700">
              {([['calc', 'Calcular'], ['datas', 'Informar datas']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setModo(v)} className={`h-full flex-1 rounded text-xs font-semibold transition-colors ${modo === v ? 'bg-[#CE0000] text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>{l}</button>
              ))}
            </div>
          </Field>
        </div>

        {modo === 'calc' ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Prazo (dias)"><input type="number" min={1} max={365} value={dias} onChange={(e) => setDias(Number(e.target.value))} className={inputCls} /></Field>
              <Field label="Contar a partir de"><select value={base} onChange={(e) => setBase(e.target.value as 'disponibilizacao' | 'publicacao' | 'inicio')} className={inputCls}><option value="disponibilizacao">Disponibilização</option><option value="publicacao">Publicação</option><option value="inicio">Início da contagem</option></select></Field>
              <Field label="Data"><input type="date" value={baseDia} onChange={(e) => setBaseDia(e.target.value)} className={inputCls} /></Field>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"><input type="checkbox" checked={dobro} onChange={(e) => setDobro(e.target.checked)} className="accent-[#CE0000]" />Prazo em dobro (CPC 183/186/229)</label>
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"><input type="checkbox" checked={corridos} onChange={(e) => setCorridos(e.target.checked)} className="accent-[#CE0000]" />Dias corridos</label>
            </div>
            {preview && (
              <div className="rounded-md border border-[#CE0000]/20 bg-[#CE0000]/5 p-3 text-sm">
                <p className="font-semibold text-[#CE0000]">Data fatal: {fmtDia(preview.dataFatal)}</p>
                <p className="text-zinc-600 dark:text-zinc-300">Prazo de segurança: {fmtDia(preview.prazoSeguranca)} — é neste dia que ele aparece na agenda.</p>
                <p className="mt-1 text-xs text-zinc-500">{preview.modo}{preview.dobro ? ' · em dobro' : ''}</p>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={<>Prazo fatal <span className="text-rose-500">*</span></>}><input type="date" value={fatalDia} onChange={(e) => setFatalDia(e.target.value)} className={inputCls} /></Field>
            <Field label="Prazo de segurança"><input type="date" value={safeDia} onChange={(e) => setSafeDia(e.target.value)} className={inputCls} /></Field>
            <p className="col-span-2 -mt-1 text-xs text-zinc-400">Sem prazo de segurança, ele fica igual à data fatal. A agenda mostra o prazo no dia da segurança.</p>
          </div>
        )}

        <Field label="Descrição"><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={`${inputCls} resize-y`} /></Field>
      </div>
      <div className="mt-6 flex items-center justify-end gap-1"><button onClick={onClose} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button><button onClick={submit} disabled={saving} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#CE0000] hover:bg-[#CE0000]/10 disabled:opacity-40">{saving ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  );
}
