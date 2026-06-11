'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Search, Loader2, ChevronDown } from 'lucide-react';
import { membersService, type Member } from '@/features/settings/services/members.service';

const REASONS = [
  { id: 'resolved', label: 'Chat do cliente resolvido com sucesso.' },
  { id: 'no_response', label: 'Cliente não responde mais.' },
  { id: 'accidental', label: 'Abri sem querer.' },
  { id: 'other', label: '' },
] as const;

interface ArchiveModalProps {
  onConfirm: (reason: string, nextResponsibleId: string | null) => Promise<void>;
  onClose: () => void;
}

function MemberAvatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const initials = (name ?? '??').slice(0, 2).toUpperCase();
  if (avatarUrl && !failed) {
    return (
      <img src={avatarUrl} alt={name ?? ''} onError={() => setFailed(true)}
        className="h-6 w-6 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600">
      {initials}
    </div>
  );
}

export function ArchiveModal({ onConfirm, onClose }: ArchiveModalProps) {
  const [reason, setReason] = useState<string>('resolved');
  const [otherText, setOtherText] = useState('');
  const [nextResponsible, setNextResponsible] = useState<Member | null>(null);
  const [showResponsiblePicker, setShowResponsiblePicker] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const otherRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { data: members = [] } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => membersService.list(),
    staleTime: 60_000,
  });

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return members.filter((m) => m.user.isActive).filter((m) =>
      q ? m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q) : true
    );
  }, [members, memberSearch]);

  useEffect(() => {
    if (reason === 'other') otherRef.current?.focus();
  }, [reason]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowResponsiblePicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleConfirm = async () => {
    const finalReason =
      reason === 'other'
        ? otherText.trim() || 'Outro motivo'
        : REASONS.find((r) => r.id === reason)?.label ?? reason;
    setLoading(true);
    try {
      await onConfirm(finalReason, nextResponsible?.user.id ?? null);
    } finally {
      setLoading(false);
    }
  };

  const canConfirm = reason !== 'other' || otherText.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
        onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) handleConfirm(); if (e.key === 'Escape') onClose(); }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="pr-4">
            <h2 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">
              Arquivamento do chat
            </h2>
            <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
              Selecione o motivo do arquivamento e o próximo responsável. Pressione Enter para confirmar.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Reason section */}
        <div className="px-6 pb-4">
          <p className="mb-3 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
            Motivo do arquivamento
          </p>
          <div className="space-y-2.5">
            {REASONS.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-start gap-3">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="radio"
                    name="archive-reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="h-4 w-4 cursor-pointer accent-red-500"
                  />
                </div>
                {r.id === 'other' ? (
                  <input
                    ref={otherRef}
                    type="text"
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    onFocus={() => setReason('other')}
                    placeholder="Outro motivo..."
                    className="flex-1 border-b border-zinc-300 bg-transparent pb-0.5 text-[13px] text-zinc-500 outline-none placeholder:text-zinc-400 focus:border-red-400 dark:border-zinc-600 dark:text-zinc-400"
                  />
                ) : (
                  <span className="text-[13px] text-zinc-700 dark:text-zinc-300">{r.label}</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Next responsible */}
        <div className="px-6 pb-5">
          <p className="mb-2 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
            Próximo responsável
          </p>
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setShowResponsiblePicker((v) => !v)}
              className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
            >
              {nextResponsible ? (
                <>
                  <MemberAvatar name={nextResponsible.user.name} avatarUrl={nextResponsible.user.avatarUrl} />
                  <span className="flex-1 text-left text-[13px] text-zinc-800 dark:text-zinc-200">
                    {nextResponsible.user.name}
                  </span>
                  <X className="h-3.5 w-3.5 text-zinc-400" onClick={(e) => { e.stopPropagation(); setNextResponsible(null); }} />
                </>
              ) : (
                <>
                  <span className="text-zinc-400">👤</span>
                  <span className="flex-1 text-left text-[13px] text-zinc-400">Selecionar</span>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                </>
              )}
            </button>

            {showResponsiblePicker && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <div className="sticky top-0 border-b border-zinc-100 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                    <input
                      autoFocus
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Buscar membro..."
                      className="w-full rounded-md bg-zinc-50 py-1.5 pl-7 pr-2 text-[12px] outline-none dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
                {filteredMembers.length === 0 ? (
                  <p className="py-3 text-center text-[12px] text-zinc-400">Nenhum membro encontrado</p>
                ) : (
                  filteredMembers.map((m) => (
                    <button
                      key={m.user.id}
                      onClick={() => { setNextResponsible(m); setShowResponsiblePicker(false); setMemberSearch(''); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <MemberAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} />
                      <span className="flex-1 truncate text-zinc-800 dark:text-zinc-200">{m.user.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-400">
            Este será o responsável quando o lead retornar. (Opcional)
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !canConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Arquivar chat'}
          </button>
        </div>
      </div>
    </div>
  );
}
