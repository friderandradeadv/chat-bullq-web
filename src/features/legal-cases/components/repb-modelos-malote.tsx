'use client';

import { useState } from 'react';
import { Copy, Check, ChevronDown, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { MODELOS_MALOTE } from '@/features/legal-cases/lib/repb-modelos-malote';

// Biblioteca de MODELOS DE MALOTE copiáveis (os do Pipefy) — texto pronto pra colar
// no Consumidor.gov / BACEN. Cada modelo tem botão "Copiar". Recolhível.

export function RepbModelosMalote() {
  const [aberto, setAberto] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const copiar = async (id: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      toast.success('Texto copiado — cole no Consumidor.gov / BACEN');
      setTimeout(() => setCopiado((c) => (c === id ? null : c)), 2000);
    } catch { toast.error('Não consegui copiar — selecione e copie manualmente'); }
  };

  return (
    <div className="rounded-lg border border-[#e3e8ef] bg-[#fafbfc] dark:border-zinc-800 dark:bg-zinc-900/40">
      <button onClick={() => setAberto((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <FileText className="h-4 w-4 text-[#B7791F]" />
        <span className="text-[13px] font-semibold text-[#101820] dark:text-zinc-100">Modelos de malote (copiar e colar)</span>
        <span className="rounded bg-[#edeff3] px-1.5 text-[11px] text-[#101820] dark:bg-zinc-800 dark:text-zinc-300">{MODELOS_MALOTE.length}</span>
        <ChevronDown className={`ml-auto h-4 w-4 text-zinc-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="space-y-1.5 border-t border-[#e3e8ef] p-2 dark:border-zinc-800">
          {MODELOS_MALOTE.map((m) => {
            const open = openId === m.id;
            return (
              <div key={m.id} className="rounded-md border border-[#e3e8ef] bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <button onClick={() => setOpenId(open ? null : m.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[#101820] dark:text-zinc-100">{m.titulo}</span>
                      <span className="block text-[10px] text-zinc-400">{m.canal}</span>
                    </span>
                  </button>
                  <button onClick={() => copiar(m.id, m.texto)} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#B7791F]/40 px-2 py-1 text-[11px] font-semibold text-[#B7791F] hover:bg-[#B7791F]/10">
                    {copiado === m.id ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
                  </button>
                </div>
                {open && (
                  <div className="border-t border-[#eef1f5] px-2.5 py-2 dark:border-zinc-800">
                    {m.descricao && <p className="mb-1.5 text-[11px] text-zinc-400">{m.descricao}</p>}
                    <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded bg-[#f7f5f0] p-2 text-[11px] leading-4 text-[#3a3730] dark:bg-zinc-800/50 dark:text-zinc-300">{m.texto}</pre>
                  </div>
                )}
              </div>
            );
          })}
          <p className="px-1 pt-1 text-[10px] text-zinc-400">Campos entre [colchetes] você preenche antes de enviar. O DDA e o malote completo já vêm prontos.</p>
        </div>
      )}
    </div>
  );
}
