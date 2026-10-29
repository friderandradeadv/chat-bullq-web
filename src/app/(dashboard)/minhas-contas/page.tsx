'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, CreditCard, Lock, Pencil, Plus, Receipt, Undo2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import {
  financeiroPessoalService as svc,
  type BillInput,
  type BillMonthItem,
  type BillStatus,
  type PersonalBill,
} from '@/features/financeiro-pessoal/financeiro-pessoal.service';

// Financeiro PESSOAL: o servidor só devolve as contas do usuário logado — sócio
// e admin não enxergam as de ninguém. Nada aqui passa pelo financeiro do escritório.

const brl = (c: number | null | undefined) =>
  c == null ? '—' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** "1.234,56" → 123456 centavos; vazio → null. */
function parseCents(v: string): number | null {
  const s = v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
const centsToInput = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));

function somaMes(comp: string, n: number) {
  const [a, m] = comp.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
const nomeMes = (comp: string) => {
  const [a, m] = comp.split('-').map(Number);
  const s = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const STATUS: Record<BillStatus, { label: string; cls: string }> = {
  paga: { label: 'Paga', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  a_vencer: { label: 'A vencer', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
  vence_hoje: { label: 'Vence hoje', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  atrasada: { label: 'Atrasada', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
};

export default function MinhasContasPage() {
  const qc = useQueryClient();
  const [comp, setComp] = useState(hojeLocal);
  const [editing, setEditing] = useState<PersonalBill | 'new' | null>(null);

  const mes = useQuery({ queryKey: ['financeiro-pessoal', 'mes', comp], queryFn: () => svc.month(comp) });
  const contas = useQuery({ queryKey: ['financeiro-pessoal', 'contas'], queryFn: svc.list });
  const refresh = () => qc.invalidateQueries({ queryKey: ['financeiro-pessoal'] });

  const marcar = useMutation({
    mutationFn: (p: { id: string; paid?: boolean; amountCents?: number | null }) =>
      svc.updateMonth(p.id, { competencia: comp, ...(p.paid !== undefined ? { paid: p.paid } : {}), ...(p.amountCents !== undefined ? { amountCents: p.amountCents } : {}) }),
    onSuccess: refresh,
    onError: () => toast.error('Não consegui salvar. Tente de novo.'),
  });

  const t = mes.data?.totais;
  const contasPorId = useMemo(() => new Map((contas.data ?? []).map((c) => [c.id, c])), [contas.data]);

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Minhas contas</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            <Lock className="h-3.5 w-3.5" /> Só você vê. Contas e cartões pessoais, com aviso antes de vencer.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova conta
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button onClick={() => setComp((c) => somaMes(c, -1))} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button onClick={() => setComp(hojeLocal())} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {nomeMes(comp)}
        </button>
        <button onClick={() => setComp((c) => somaMes(c, 1))} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Total do mês" value={brl(t?.total)} />
        <Tile label="Já pago" value={brl(t?.pago)} tone="ok" />
        <Tile label="Falta pagar" value={brl(t?.aPagar)} />
        <Tile label="Atrasado" value={brl(t?.atrasado)} tone={t?.atrasado ? 'bad' : undefined} />
      </div>
      {!!t?.semValor && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {t.semValor} {t.semValor === 1 ? 'conta está' : 'contas estão'} sem valor neste mês: o total não conta com elas.
        </p>
      )}

      <div className="mt-6 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {mes.isLoading && <p className="p-6 text-sm text-zinc-500">Carregando…</p>}
        {mes.isError && <p className="p-6 text-sm text-red-600">Não consegui carregar as contas.</p>}
        {mes.data && mes.data.items.length === 0 && (
          <div className="flex flex-col items-center py-14 text-center">
            <Receipt className="h-10 w-10 text-zinc-200 dark:text-zinc-700" />
            <p className="mt-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">Nenhuma conta neste mês</p>
            <p className="mt-1 max-w-sm text-xs text-zinc-400">Cadastre luz, aluguel, internet, cartões… Elas se repetem todo mês sozinhas.</p>
          </div>
        )}
        {mes.data?.items.map((it) => (
          <Linha
            key={it.billId}
            it={it}
            busy={marcar.isPending}
            onPay={(paid) => marcar.mutate({ id: it.billId, paid })}
            onValor={(amountCents) => marcar.mutate({ id: it.billId, amountCents })}
            onEdit={() => {
              const c = contasPorId.get(it.billId);
              if (c) setEditing(c);
            }}
          />
        ))}
      </div>

      {editing && (
        <BillForm
          bill={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  const color = tone === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100';
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function Linha({ it, busy, onPay, onValor, onEdit }: {
  it: BillMonthItem;
  busy: boolean;
  onPay: (paid: boolean) => void;
  onValor: (c: number | null) => void;
  onEdit: () => void;
}) {
  const [valor, setValor] = useState<string | null>(null);
  const st = STATUS[it.status];
  const Icon = it.kind === 'cartao' ? CreditCard : Receipt;
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Icon className="h-5 w-5 shrink-0 text-zinc-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{it.name}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {it.kind === 'cartao' && <>Fatura do mês · </>}Vence {ddmm(it.vencimento)}
          {it.fechamento && <> · fecha {ddmm(it.fechamento)}</>}
          {it.category && <> · {it.category}</>}
          {!it.recurring && <> · avulsa</>}
        </p>
      </div>
      {valor !== null ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            (document.activeElement as HTMLElement | null)?.blur();
          }}
          className="flex items-center gap-1"
        >
          <span className="text-xs text-zinc-500">R$</span>
          <input
            autoFocus
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={() => {
              // Sair do campo SALVA (no celular ninguém aperta Enter); só não grava se nada mudou.
              const c = parseCents(valor);
              if (c !== it.amountCents) onValor(c);
              setValor(null);
            }}
            className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-800"
          />
        </form>
      ) : (
        <button
          onClick={() => setValor(centsToInput(it.amountCents))}
          title="Ajustar o valor deste mês"
          className={`text-sm font-semibold tabular-nums hover:underline ${it.amountCents == null ? 'text-amber-600' : 'text-zinc-900 dark:text-zinc-100'}`}
        >
          {it.amountCents == null ? 'informar valor' : brl(it.amountCents)}
        </button>
      )}
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
      {it.status === 'paga' ? (
        <button disabled={busy} onClick={() => onPay(false)} title="Desfazer pagamento" className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <Undo2 className="h-4 w-4" />
        </button>
      ) : (
        <button disabled={busy} onClick={() => onPay(true)} className="inline-flex items-center gap-1 rounded-md border border-emerald-600 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10">
          <Check className="h-3.5 w-3.5" /> Paguei
        </button>
      )}
      <button onClick={onEdit} title="Editar conta" className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}

const inputCls = 'mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100';
const labelCls = 'block text-xs font-medium text-zinc-600 dark:text-zinc-400';

function BillForm({ bill, onClose, onSaved }: { bill: PersonalBill | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: bill?.name ?? '',
    kind: bill?.kind ?? 'conta',
    category: bill?.category ?? '',
    valor: centsToInput(bill?.amountCents ?? null),
    recurring: bill?.recurring ?? true,
    dueDay: bill?.dueDay ? String(bill.dueDay) : '',
    closingDay: bill?.closingDay ? String(bill.closingDay) : '',
    dueDate: bill?.dueDate ? bill.dueDate.slice(0, 10) : '',
    remindDaysBefore: String(bill?.remindDaysBefore ?? 3),
    notes: bill?.notes ?? '',
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const [saving, setSaving] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const dueDay = Number(f.dueDay);
    if (f.recurring && !(dueDay >= 1 && dueDay <= 31)) return toast.error('Informe o dia do vencimento (1 a 31).');
    if (!f.recurring && !f.dueDate) return toast.error('Informe a data do vencimento.');
    const closing = Number(f.closingDay);
    const input: BillInput = {
      name: f.name.trim(),
      kind: f.kind as BillInput['kind'],
      category: f.category.trim() || null,
      amountCents: parseCents(f.valor),
      recurring: f.recurring,
      dueDay: f.recurring ? dueDay : null,
      closingDay: f.kind === 'cartao' && closing >= 1 && closing <= 31 ? closing : null,
      dueDate: f.recurring ? null : f.dueDate,
      remindDaysBefore: Math.min(30, Math.max(0, Number(f.remindDaysBefore) || 0)),
      notes: f.notes.trim() || null,
    };
    setSaving(true);
    try {
      if (bill) await svc.update(bill.id, input);
      else await svc.create(input);
      toast.success(bill ? 'Conta atualizada' : 'Conta cadastrada');
      onSaved();
    } catch {
      toast.error('Não consegui salvar a conta.');
    } finally {
      setSaving(false);
    }
  }

  async function arquivar() {
    if (!bill || !confirm(`Arquivar "${bill.name}"? Ela some da lista; o histórico fica guardado.`)) return;
    try {
      await svc.archive(bill.id);
      toast.success('Conta arquivada');
      onSaved();
    } catch {
      toast.error('Não consegui arquivar.');
    }
  }

  return (
    <Modal title={bill ? 'Editar conta' : 'Nova conta'} onClose={onClose}>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['conta', 'cartao'] as const).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => set('kind', k)}
              className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm ${f.kind === k ? 'border-primary bg-primary/5 font-medium text-zinc-900 dark:text-zinc-100' : 'border-zinc-300 text-zinc-500 dark:border-zinc-700'}`}
            >
              {k === 'cartao' ? <CreditCard className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
              {k === 'cartao' ? 'Cartão' : 'Conta'}
            </button>
          ))}
        </div>
        <label className={labelCls}>
          Nome
          <input required value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={f.kind === 'cartao' ? 'Nubank, Itaú Black…' : 'Luz, aluguel, internet…'} className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Valor (R$)
            <input inputMode="decimal" value={f.valor} onChange={(e) => set('valor', e.target.value)} placeholder={f.kind === 'cartao' ? 'varia' : '0,00'} className={inputCls} />
          </label>
          <label className={labelCls}>
            Categoria
            <input value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Casa, carro…" className={inputCls} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={f.recurring} onChange={(e) => set('recurring', e.target.checked)} />
          Repete todo mês
        </label>
        {f.recurring ? (
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              Dia do vencimento
              <input type="number" min={1} max={31} value={f.dueDay} onChange={(e) => set('dueDay', e.target.value)} className={inputCls} />
            </label>
            {f.kind === 'cartao' && (
              <label className={labelCls}>
                Dia do fechamento
                <input type="number" min={1} max={31} value={f.closingDay} onChange={(e) => set('closingDay', e.target.value)} className={inputCls} />
              </label>
            )}
          </div>
        ) : (
          <label className={labelCls}>
            Data do vencimento
            <input type="date" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} className={inputCls} />
          </label>
        )}
        <label className={labelCls}>
          Avisar quantos dias antes
          <input type="number" min={0} max={30} value={f.remindDaysBefore} onChange={(e) => set('remindDaysBefore', e.target.value)} className={inputCls} />
          <span className="mt-1 block font-normal text-zinc-400">Também avisa no dia e se atrasar.</span>
        </label>
        <label className={labelCls}>
          Observação
          <textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} className={inputCls} />
        </label>
        <div className="flex items-center justify-between gap-2 pt-2">
          {bill ? (
            <button type="button" onClick={arquivar} className="text-sm text-red-600 hover:underline">Arquivar</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancelar</button>
            <button disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
