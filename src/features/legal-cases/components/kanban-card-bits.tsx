'use client';

// Header de fase reutilizável dos kanbans jurídicos (Fase Judicial + Pré-Processual):
// clica no nome da fase → edita inline. Só sócios (o gate `canRename` vem da página);
// o `onRename` persiste em org.settings.kanbanPhaseLabels via renamePhaseLabel.

import { useEffect, useState } from 'react';

export function PhaseHeader({
  phase,
  canRename,
  onRename,
}: {
  phase: { key: string; label: string };
  canRename: boolean;
  onRename: (key: string, label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(phase.label);
  useEffect(() => setText(phase.label), [phase.label]);

  if (!canRename) {
    return (
      <h2 className="truncate text-sm font-medium text-[#e11970] dark:text-[#f06595]">
        {phase.label}
      </h2>
    );
  }

  const commit = () => {
    const t = text.trim();
    setEditing(false);
    if (t && t !== phase.label) onRename(phase.key, t);
    else setText(phase.label);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { setEditing(false); setText(phase.label); }
        }}
        className="w-full rounded border border-[#e11970] bg-white px-1 py-0.5 text-sm font-medium text-[#101820] outline-none dark:bg-zinc-800 dark:text-zinc-100"
      />
    );
  }

  return (
    <h2
      onClick={() => setEditing(true)}
      title="Clique pra renomear a fase (só sócios)"
      className="cursor-text truncate text-sm font-medium text-[#e11970] hover:underline dark:text-[#f06595]"
    >
      {phase.label}
    </h2>
  );
}
