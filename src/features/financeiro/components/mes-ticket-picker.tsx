'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mesLabel } from '@/features/financeiro/lib/clientes';

/** Soma `n` meses a um "YYYY-MM". */
export function addMesYM(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Seletor de mês estilo holerite: ‹ Mês de Ano › + grade de 12 meses/ano ao clicar
 *  no título. Meses com dados (`comDados`) ganham um ponto; futuro (> maxMes) desabilita. */
export function MesTicketPicker({ value, onChange, comDados, maxMes }: { value: string; onChange: (m: string) => void; comDados: Set<string>; maxMes: string }) {
  const [open, setOpen] = useState(false);
  const [verAno, setVerAno] = useState(() => Number(value.split('-')[0]) || new Date().getFullYear());
  const next = addMesYM(value, 1);
  const podeNext = next <= maxMes;
  const MN = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return (
    <div className="relative flex items-center justify-center gap-1">
      <button onClick={() => onChange(addMesYM(value, -1))} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Mês anterior"><ChevronLeft className="h-5 w-5" /></button>
      <button onClick={() => { setVerAno(Number(value.split('-')[0]) || verAno); setOpen((o) => !o); }} className="inline-flex min-w-[150px] items-center justify-center rounded-lg px-3 py-1.5 text-lg font-bold text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800">{mesLabel(value)}</button>
      <button onClick={() => podeNext && onChange(next)} disabled={!podeNext} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-zinc-800" aria-label="Próximo mês"><ChevronRight className="h-5 w-5" /></button>
      {open && (<>
        <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
        <div className="absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-2 flex items-center justify-between">
            <button onClick={() => setVerAno((v) => v - 1)} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Ano anterior"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{verAno}</span>
            <button onClick={() => setVerAno((v) => v + 1)} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Próximo ano"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MN.map((mn, i) => {
              const key = `${verAno}-${String(i + 1).padStart(2, '0')}`;
              const futuro = key > maxMes; const sel = key === value; const tem = comDados.has(key);
              return <button key={i} disabled={futuro} onClick={() => { onChange(key); setOpen(false); }} className={`relative rounded-lg px-2 py-2 text-sm transition ${sel ? 'bg-[#7048E8] font-semibold text-white' : futuro ? 'cursor-default text-zinc-300 dark:text-zinc-600' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'}`}>{mn}{tem && !sel && <span className="absolute left-1/2 top-1 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500" />}</button>;
            })}
          </div>
        </div>
      </>)}
    </div>
  );
}
