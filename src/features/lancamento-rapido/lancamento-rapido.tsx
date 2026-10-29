'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ImagePlus, Loader2, Mic, Send, Sparkles, Square, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { CreateEventDialog } from '@/features/calendar/components/create-event-dialog';
import { CreateTaskDialog } from '@/features/tasks/components/create-task-dialog';
import { financeiroPessoalService } from '@/features/financeiro-pessoal/financeiro-pessoal.service';

// Lançamento rápido: ele escreve, fala ou cola um print; a IA devolve um
// RASCUNHO e o formulário certo abre preenchido. Nada é criado sem ele salvar.

interface Rascunho {
  tipo: 'compromisso' | 'tarefa' | 'conta' | 'nao_entendi';
  compromisso?: { titulo: string; tipo: 'audiencia' | 'reuniao' | 'pericia' | 'outro'; data: string | null; hora: string | null; local: string | null; pessoal: boolean };
  tarefa?: { titulo: string; data: string | null; descricao: string | null; prioridade: 'LOW' | 'MEDIUM' | 'HIGH' };
  conta?: { acao: 'pagar' | 'valor' | 'nova'; contaId: string | null; nome: string; valorCentavos: number | null; competencia: string | null; diaVencimento: number | null; tipoConta: 'conta' | 'cartao' };
  processos: Array<{ id: string; title: string; cnjNumber: string | null }>;
  entendido: string;
  avisos: string[];
}

const brl = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));
const parseCents = (v: string) => {
  const s = v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

function avisoDe(r: Rascunho): string {
  const linhas = [r.entendido ? `Entendi: ${r.entendido}` : ''];
  if (r.processos.length === 1) linhas.push(`Processo: ${r.processos[0].title}`);
  if (r.processos.length > 1) linhas.push(`${r.processos.length} processos parecidos: escolha o certo no campo Processo.`);
  return [...linhas, ...r.avisos].filter(Boolean).join('\n');
}

export function LancamentoRapido({ onCriado }: { onCriado?: () => void }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [gravando, setGravando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Print colado com Cmd+V no campo vira o anexo.
  const onPaste = (e: React.ClipboardEvent) => {
    const img = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'))?.getAsFile();
    if (img) { e.preventDefault(); setArquivo(img); }
  };

  useEffect(() => () => recRef.current?.stream.getTracks().forEach((t) => t.stop()), []);

  async function gravar() {
    if (gravando) { recRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      pedacos.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) pedacos.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setGravando(false);
        const tipo = rec.mimeType || 'audio/webm';
        const blob = new Blob(pedacos.current, { type: tipo });
        if (blob.size < 1500) { toast.error('Áudio muito curto.'); return; }
        const ext = tipo.includes('mp4') ? 'm4a' : tipo.includes('ogg') ? 'ogg' : 'webm';
        const f = new File([blob], `audio.${ext}`, { type: tipo });
        setArquivo(f);
        void ler(f); // gravou e parou = quer que leia; não pede um clique a mais
      };
      recRef.current = rec;
      rec.start();
      setGravando(true);
    } catch {
      toast.error('Não consegui usar o microfone. Libere o acesso no navegador.');
    }
  }

  async function ler(f: File | null = arquivo) {
    if (!texto.trim() && !f) return toast.error('Escreva, grave um áudio ou cole um print.');
    setLendo(true);
    try {
      const fd = new FormData();
      if (texto.trim()) fd.append('texto', texto.trim());
      if (f) fd.append('arquivo', f);
      const { data } = await api.post('/lancamento-rapido/ler', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
      const r = (data?.data ?? data) as Rascunho;
      if (r.tipo === 'nao_entendi') {
        toast.error(r.avisos[0] ?? 'Não entendi o que lançar. Tente com mais detalhes.');
        return;
      }
      setRascunho(r);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Não consegui ler agora.');
    } finally {
      setLendo(false);
    }
  }

  const limpar = () => { setTexto(''); setArquivo(null); setRascunho(null); };
  const criado = () => {
    limpar();
    for (const k of ['calendar', 'tasks', 'deadlines', 'financeiro-pessoal']) qc.invalidateQueries({ queryKey: [k] });
    onCriado?.();
  };

  const r = rascunho;
  const caseId = r?.processos.length === 1 ? r.processos[0].id : undefined;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-end gap-2">
        <Sparkles className="mb-2.5 ml-1 h-4 w-4 shrink-0 text-[#228BE6]" />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ler(); } }}
          rows={1}
          // Curto de propósito: placeholder de textarea quebra linha e dobra a altura do campo.
          placeholder={gravando ? 'Gravando… toque no quadrado para parar' : 'Lançar rápido: digite, grave um áudio ou cole um print'}
          title='Ex.: "audiência do José dia 12 às 14h", "paguei a luz", "fatura do Nubank 1.890"'
          className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        />
        <input ref={fileRef} type="file" accept="image/*,audio/*" className="hidden" onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
        <button type="button" onClick={() => fileRef.current?.click()} title="Anexar print ou áudio" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <ImagePlus className="h-4 w-4" />
        </button>
        <button type="button" onClick={gravar} title={gravando ? 'Parar e ler' : 'Gravar áudio'} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${gravando ? 'animate-pulse bg-red-500 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
          {gravando ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => ler()} disabled={lendo || gravando} title="Ler" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#228BE6] text-white disabled:opacity-50">
          {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      {arquivo && (
        <div className="ml-7 mt-1 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {arquivo.type.startsWith('image/') ? 'Print anexado' : 'Áudio anexado'}
          <button onClick={() => setArquivo(null)} aria-label="Tirar anexo"><X className="h-3 w-3" /></button>
        </div>
      )}

      {r?.tipo === 'compromisso' && r.compromisso && (
        <CreateEventDialog
          inicial={{
            title: r.compromisso.titulo,
            kind: r.compromisso.tipo,
            startsAt: r.compromisso.data ? `${r.compromisso.data}T${r.compromisso.hora ?? '09:00'}` : undefined,
            location: r.compromisso.local,
            caseId,
            pessoal: r.compromisso.pessoal,
          }}
          aviso={avisoDe(r)}
          onClose={() => setRascunho(null)}
          onSaved={criado}
        />
      )}
      {r?.tipo === 'tarefa' && r.tarefa && (
        <CreateTaskDialog
          inicial={{ title: r.tarefa.titulo, dueAt: r.tarefa.data, description: r.tarefa.descricao, priority: r.tarefa.prioridade, caseId }}
          aviso={avisoDe(r)}
          onClose={() => setRascunho(null)}
          onSaved={criado}
        />
      )}
      {r?.tipo === 'conta' && r.conta && <ContaConfirma r={r} onClose={() => setRascunho(null)} onSaved={criado} />}
    </div>
  );
}

function ContaConfirma({ r, onClose, onSaved }: { r: Rascunho; onClose: () => void; onSaved: () => void }) {
  const c = r.conta!;
  const [valor, setValor] = useState(brl(c.valorCentavos));
  const [nome, setNome] = useState(c.nome);
  const [dia, setDia] = useState(c.diaVencimento ? String(c.diaVencimento) : '');
  const [salvando, setSalvando] = useState(false);
  const comp = c.competencia ?? '';
  const mesLabel = comp ? `${comp.slice(5, 7)}/${comp.slice(0, 4)}` : '';
  const titulo = c.acao === 'pagar' ? `Marcar "${c.nome}" como paga` : c.acao === 'valor' ? `Valor de "${c.nome}" em ${mesLabel}` : 'Nova conta pessoal';

  async function salvar() {
    setSalvando(true);
    try {
      if (c.acao === 'pagar') {
        const v = parseCents(valor);
        await financeiroPessoalService.updateMonth(c.contaId!, { competencia: comp, paid: true, ...(v != null ? { amountCents: v } : {}) });
        toast.success(`${c.nome}: paga em ${mesLabel}`);
      } else if (c.acao === 'valor') {
        await financeiroPessoalService.updateMonth(c.contaId!, { competencia: comp, amountCents: parseCents(valor) });
        toast.success(`${c.nome}: valor de ${mesLabel} salvo`);
      } else {
        const d = Number(dia);
        if (!(d >= 1 && d <= 31)) { toast.error('Informe o dia do vencimento (1 a 31).'); setSalvando(false); return; }
        await financeiroPessoalService.create({
          name: nome.trim() || 'Conta', kind: c.tipoConta, category: null, amountCents: parseCents(valor), recurring: true,
          dueDay: d, closingDay: null, dueDate: null, remindDaysBefore: 3, notes: null,
        });
        toast.success('Conta cadastrada em Minhas contas');
      }
      onSaved();
    } catch {
      toast.error('Não consegui salvar.');
      setSalvando(false);
    }
  }

  const inp = 'mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100';
  return (
    <Modal title={titulo} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-md bg-[#228BE6]/10 px-3 py-2 text-xs text-[#1c7ed6] dark:text-[#74c0fc]">
          <p className="font-semibold">Preenchido pela IA — confira antes de salvar.</p>
          <p className="mt-0.5 whitespace-pre-line">{avisoDe(r)}</p>
        </div>
        {c.acao === 'nova' && (
          <>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Nome<input value={nome} onChange={(e) => setNome(e.target.value)} className={inp} /></label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Dia do vencimento<input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} className={inp} /></label>
          </>
        )}
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Valor (R$){c.acao === 'pagar' && ' — opcional'}
          <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={c.acao === 'nova' && c.tipoConta === 'cartao' ? 'varia' : '0,00'} className={inp} />
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="rounded px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#228BE6] hover:bg-[#228BE6]/10 disabled:opacity-40">{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </Modal>
  );
}
