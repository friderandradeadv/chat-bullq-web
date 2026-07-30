'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, UserRound, X, Plus, Loader2, Send, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { contactsService, type Contact } from '@/features/contacts/services/contacts.service';

export interface PickedContact {
  name: string;
  phone: string;
}

interface Props {
  onClose: () => void;
  onSend: (contacts: PickedContact[]) => Promise<void>;
}

const sameContact = (a: PickedContact, b: PickedContact) =>
  a.phone.replace(/\D/g, '') === b.phone.replace(/\D/g, '') && a.phone.replace(/\D/g, '') !== '';

export function ContactPickerModal({ onClose, onSend }: Props) {
  const [tab, setTab] = useState<'search' | 'manual'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PickedContact[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [sending, setSending] = useState(false);

  // Busca cadastrados (debounce). Só contatos com telefone servem de cartão.
  useEffect(() => {
    if (tab !== 'search') return;
    const q = query.trim();
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { contacts } = await contactsService.list({
          ...(q ? { search: q } : {}),
          limit: '20',
        });
        if (active) setResults(contacts.filter((c) => c.phone));
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, tab]);

  const toggle = (c: PickedContact) => {
    setSelected((prev) =>
      prev.some((p) => sameContact(p, c))
        ? prev.filter((p) => !sameContact(p, c))
        : [...prev, c],
    );
  };

  const addManual = () => {
    const name = manualName.trim();
    const phone = manualPhone.trim();
    if (!phone.replace(/\D/g, '')) {
      toast.error('Informe o telefone do contato.');
      return;
    }
    const c = { name: name || phone, phone };
    if (selected.some((p) => sameContact(p, c))) {
      toast.error('Esse contato já foi adicionado.');
      return;
    }
    setSelected((prev) => [...prev, c]);
    setManualName('');
    setManualPhone('');
  };

  const handleSend = async () => {
    if (!selected.length || sending) return;
    setSending(true);
    try {
      await onSend(selected);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Erro ao enviar contato');
    } finally {
      setSending(false);
    }
  };

  const isSelected = useMemo(
    () => (phone: string) =>
      selected.some((p) => p.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')),
    [selected],
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            <UserRound className="h-4 w-4 text-primary" /> Enviar contato
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pt-3">
          <button
            onClick={() => setTab('search')}
            className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === 'search'
                ? 'bg-primary/10 text-primary'
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Buscar cadastrado
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === 'manual'
                ? 'bg-primary/10 text-primary'
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Digitar
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {tab === 'search' ? (
            <>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nome ou telefone do cliente…"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-8 text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : results.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-zinc-400">
                  Nenhum contato encontrado.
                </p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {results.map((c) => {
                    const picked = isSelected(c.phone || '');
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggle({ name: c.name || c.phone || 'Contato', phone: c.phone || '' })}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                          picked
                            ? 'bg-primary/10'
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
                          {c.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <UserRound className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
                            {c.name || 'Sem nome'}
                          </p>
                          <p className="truncate text-[11px] tabular-nums text-zinc-400">{c.phone}</p>
                        </div>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            picked
                              ? 'border-primary bg-primary text-white'
                              : 'border-zinc-300 dark:border-zinc-600'
                          }`}
                        >
                          {picked && <Plus className="h-3 w-3 rotate-45" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Nome do contato"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <input
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addManual();
                  }
                }}
                inputMode="tel"
                placeholder="Telefone com DDD (ex.: 44 91234-5678)"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                onClick={addManual}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 py-2 text-[13px] font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <UserPlus className="h-4 w-4" /> Adicionar à lista
              </button>
            </div>
          )}
        </div>

        {/* Selecionados + enviar */}
        {selected.length > 0 && (
          <div className="border-t border-zinc-100 px-3 pt-2 dark:border-zinc-800">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {selected.map((c, i) => (
                <span
                  key={`${c.phone}-${i}`}
                  className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  <span className="truncate">{c.name}</span>
                  <button
                    onClick={() => setSelected((prev) => prev.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded-full p-0.5 hover:bg-primary/10"
                    aria-label="Remover"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-3 py-3 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={!selected.length || sending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar{selected.length > 1 ? ` (${selected.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
