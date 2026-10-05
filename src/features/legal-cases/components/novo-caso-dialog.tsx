'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { legalCasesService, type PartyInput } from '@/features/legal-cases/services/legal-cases.service';
import { membersService } from '@/features/settings/services/members.service';
import { OpponentCombobox } from '@/features/legal-cases/components/opponent-combobox';
import { ClientCombobox } from '@/features/legal-cases/components/client-combobox';
import { PRODUTO_PRESETS } from '@/features/legal-cases/lib/etiquetas';

const INPUT = 'h-9 w-full rounded-lg border border-[#cfe0ed] bg-white px-2.5 text-sm text-[#101820] outline-none focus:border-[#4a90e2] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';
// 🚨 a lista era uma CÓPIA, e divergiu da do card — agora é uma só (lib/etiquetas.ts)

/** Dialog de criação de processo/card. targetPhase = fase inicial; phases = opções de fase. */
export function NovoCasoDialog({ targetPhase, phases = [], onClose, onCreated }: { targetPhase?: string; phases?: { key: string; label: string }[]; onClose: () => void; onCreated: () => void }) {
  const [cliente, setCliente] = useState('');
  const [clienteDoc, setClienteDoc] = useState('');
  const [clienteContactId, setClienteContactId] = useState('');
  const [produto, setProduto] = useState('');
  const [adversa, setAdversa] = useState('');
  const [adversaDoc, setAdversaDoc] = useState<string>('');
  const [adversaContactId, setAdversaContactId] = useState<string>('');
  const [respId, setRespId] = useState('');
  const [phase, setPhase] = useState(targetPhase ?? phases[0]?.key ?? '');
  const [busy, setBusy] = useState(false);
  const { data: members = [] } = useQuery({ queryKey: ['org-members'], queryFn: () => membersService.list() });
  // 🚨 SUGESTÃO = PRESET + O QUE O ESCRITÓRIO JÁ USA (05/10/2026). Só os presets
  // deixavam toda etiqueta nova invisível para a próxima vez: quem criasse
  // "Portabilidade BMG" digitando teria de digitar de novo no processo seguinte,
  // e é assim que nasce grafia divergente. As em uso vêm do banco, ordenadas da
  // mais comum para a mais rara, e entram DEPOIS dos presets. O dedupe é sem
  // caixa, para não oferecer "RMC" e "rmc" lado a lado.
  const { data: emUso = [] } = useQuery({
    queryKey: ['etiquetas-em-uso'],
    queryFn: () => legalCasesService.etiquetasEmUso(),
    staleTime: 5 * 60_000,
  });
  const sugestoes = (() => {
    const vistas = new Set(PRODUTO_PRESETS.map((p) => p.toLowerCase()));
    return [...PRODUTO_PRESETS, ...emUso.filter((e) => {
      const k = (e ?? '').trim().toLowerCase();
      if (!k || vistas.has(k)) return false;
      vistas.add(k);
      return true;
    })];
  })();

  const submit = async () => {
    if (!cliente.trim()) { toast.error('Informe o nome do cliente'); return; }
    setBusy(true);
    try {
      const parties: PartyInput[] = [{
        role: 'CLIENT',
        name: cliente.trim(),
        contactId: clienteContactId || undefined,
        document: clienteDoc || undefined,
      }];
      if (adversa.trim())
        parties.push({
          role: 'OPPONENT',
          name: adversa.trim(),
          document: adversaDoc || undefined,
          contactId: adversaContactId || undefined,
        });
      const novo = await legalCasesService.create({
        title: cliente.trim(),
        area: produto.trim() || undefined,
        responsibleId: respId || undefined,
        parties,
      });
      if (phase) await legalCasesService.movePhase(novo.id, phase);
      toast.success('Processo criado');
      onCreated();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao criar processo');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-[440px] max-w-[94vw] rounded-xl bg-white p-5 shadow-2xl dark:bg-zinc-950">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        <h2 className="text-base font-bold text-[#101820] dark:text-zinc-100">Novo processo</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Cria o card no kanban. Os demais dados você completa na ficha (ou a IA preenche).</p>

        <div className="mt-4 space-y-3">
          <Field label="Cliente *">
            <ClientCombobox
              value={cliente}
              onSelect={(s) => {
                setCliente(s.name);
                setClienteDoc(s.document ?? '');
                setClienteContactId(s.contactId ?? '');
              }}
              inputClassName={`${INPUT} pl-8`}
            />
            {clienteContactId && (
              <span className="mt-1 block text-[10px] font-medium text-emerald-600 dark:text-emerald-400">✓ vinculado ao cliente cadastrado</span>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Produto">
              <input list="produtos-novo" value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="RMC, RCC…" className={INPUT} />
              <datalist id="produtos-novo">{sugestoes.map((p) => <option key={p} value={p} />)}</datalist>
            </Field>
            <Field label="Responsável">
              <select value={respId} onChange={(e) => setRespId(e.target.value)} className={INPUT}>
                <option value="">—</option>
                {members.filter((m) => m.assignable !== false).map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Parte adversa (opcional)">
            <OpponentCombobox
              value={adversa}
              onSelect={(s) => {
                setAdversa(s.name);
                setAdversaDoc(s.document ?? '');
                setAdversaContactId(s.contactId ?? '');
              }}
            />
          </Field>
          {phases.length > 0 && (
            <Field label="Criar na fase">
              <select value={phase} onChange={(e) => setPhase(e.target.value)} className={INPUT}>
                {phases.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </Field>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={submit} disabled={busy} className="rounded-lg bg-[#005efc] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy ? 'Criando…' : 'Criar processo'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#48626f]">{label}</span>
      {children}
    </div>
  );
}
