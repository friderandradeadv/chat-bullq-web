'use client';

/**
 * Ciclo de vida do colaborador no RH: contratar → alterar contrato → promover → desligar,
 * mais o ARQUIVO de quem já saiu (dossiê completo com foto, dados, documentos e linha do tempo).
 *
 * Onde cada coisa é gravada (tudo em endpoints que já existem — nada de schema novo):
 *  · dados cadastrais + histórico + desligamento → rh.fichas[userId]           (rhService.save)
 *  · cargo, atuação, datas, contrato assinado    → escritorio.pessoas[userId]  (escritorioService.save)
 *  · papel (ADMIN/AGENT), acesso e visibilidade  → membros                     (membersService)
 *  · % de honorários e acesso ao Financeiro      → módulo Financeiro           (financeiroService)
 *
 * A pessoa desligada NÃO é removida da organização: o vínculo continua (é o que
 * mantém autoria de tarefas, casos e mensagens), só perde o acesso e sai dos
 * seletores. O que a manda para o arquivo é a presença de `ficha.desligamento`.
 */

import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  X, Save, Loader2, UserPlus, UserMinus, TrendingUp, FileSignature, Trash2, Plus,
  ExternalLink, UploadCloud, Archive, CalendarDays, RotateCcw, History, IdCard, MapPin,
  Mail, Phone, ShieldOff, Briefcase, Pencil,
} from 'lucide-react';
import {
  rhService, preKey, MOTIVO_LABEL, AVISO_LABEL,
  type Ficha, type Documento, type EventoRh, type TipoEvento,
  type Desligamento, type MotivoDesligamento, type AvisoPrevio,
} from '@/features/rh/services/rh.service';
import { membersService, type Member } from '@/features/settings/services/members.service';
import { escritorioService, type Cargo, type Vertical, type PessoaInfo } from '@/features/escritorio/services/escritorio.service';
import { financeiroService, type AcessoNivel } from '@/features/financeiro/services/financeiro.service';
import { inboxService } from '@/features/inbox/services/inbox.service';
import { DropZone } from '@/components/drop-zone';
import { maskDataBR, maskCpf, maskTelefoneBR } from '@/lib/masks';

export const INPUT = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-[#228BE6] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
export const LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-400';
export const rid = () => `x_${Math.round(Math.random() * 1e9)}`;
export const ini = (n?: string | null) => (n ?? '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const roleLabel = (r?: string) => (r === 'OWNER' ? 'Proprietário' : r === 'ADMIN' ? 'Sócio / Admin' : 'Associado');

/** Tipos de contrato que o escritório usa — lista aberta (dá para digitar outro). */
export const TIPOS_CONTRATO = [
  'Contrato de associação (advogado)',
  'CLT',
  'Estágio (Lei 11.788/2008)',
  'Prestação de serviços (PJ)',
  'Autônomo / RPA',
  'Sócio (contrato social)',
];

// ─────────────────────────── datas & tempo de casa ───────────────────────────

/** dd/mm/aaaa → Date (só o que a ficha usa). Devolve null se não der para ler. */
export function parseBR(s?: string | null): Date | null {
  const m = String(s ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const hojeBR = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

/** "3 anos e 2 meses" entre duas datas da ficha; vazio se faltar a de entrada. */
export function tempoDeCasa(admissao?: string, saida?: string): string {
  const ini = parseBR(admissao);
  if (!ini) return '';
  const fim = parseBR(saida) ?? new Date();
  if (fim < ini) return '';
  let meses = (fim.getFullYear() - ini.getFullYear()) * 12 + (fim.getMonth() - ini.getMonth());
  if (fim.getDate() < ini.getDate()) meses -= 1;
  if (meses < 0) meses = 0;
  const anos = Math.floor(meses / 12);
  const rest = meses % 12;
  const partes: string[] = [];
  if (anos) partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`);
  if (rest) partes.push(`${rest} ${rest === 1 ? 'mês' : 'meses'}`);
  return partes.length ? partes.join(' e ') : 'menos de 1 mês';
}

// ─────────────────────────── histórico ───────────────────────────

const EVENTO_UI: Record<TipoEvento, { label: string; cor: string; Icon: typeof UserPlus }> = {
  contratacao: { label: 'Contratação', cor: '#02883C', Icon: UserPlus },
  promocao: { label: 'Promoção', cor: '#7048E8', Icon: TrendingUp },
  contrato: { label: 'Contrato', cor: '#228BE6', Icon: FileSignature },
  desligamento: { label: 'Desligamento', cor: '#E64980', Icon: UserMinus },
  readmissao: { label: 'Readmissão', cor: '#F08C00', Icon: RotateCcw },
};

export function novoEvento(e: Omit<EventoRh, 'id' | 'registradoEm'>): EventoRh {
  return { ...e, id: rid(), registradoEm: new Date().toISOString() };
}

/** Linha do tempo funcional — mais recente em cima. */
export function Timeline({ historico }: { historico: EventoRh[] }) {
  const ordenado = useMemo(
    () => [...historico].sort((a, b) => (parseBR(b.data)?.getTime() ?? 0) - (parseBR(a.data)?.getTime() ?? 0)),
    [historico],
  );
  if (ordenado.length === 0) {
    return <p className="text-xs text-zinc-400">Nada registrado ainda. Contratação, promoções, mudanças de contrato e desligamento aparecem aqui.</p>;
  }
  return (
    <ol className="space-y-2.5">
      {ordenado.map((e) => {
        const ui = EVENTO_UI[e.tipo] ?? EVENTO_UI.contrato;
        return (
          <li key={e.id} className="flex gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${ui.cor}1a`, color: ui.cor }}>
              <ui.Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{e.titulo}</p>
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${ui.cor}1a`, color: ui.cor }}>{ui.label}</span>
                <span className="ml-auto text-[11px] tabular-nums text-zinc-400">{e.data}</span>
              </div>
              {(e.de || e.para) && (
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {e.de ? <span className="line-through decoration-zinc-300">{e.de}</span> : <em className="text-zinc-400">—</em>}
                  {' → '}
                  <strong className="text-zinc-700 dark:text-zinc-200">{e.para || '—'}</strong>
                </p>
              )}
              {e.obs && <p className="mt-0.5 whitespace-pre-wrap text-xs text-zinc-500 dark:text-zinc-400">{e.obs}</p>}
              {e.registradoPor && <p className="mt-1 text-[10px] text-zinc-400">registrado por {e.registradoPor}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─────────────────────────── upload de documentos ───────────────────────────

function ListaDocumentos({
  docs, onChange, canEdit, dica,
}: { docs: Documento[]; onChange: (d: Documento[]) => void; canEdit: boolean; dica: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const subir = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const novos: Documento[] = [];
      for (const file of files) {
        const up = await inboxService.uploadMedia(file);
        novos.push({ id: rid(), nome: file.name.replace(/\.[^.]+$/, ''), url: up.url });
      }
      onChange([...docs, ...novos]);
      toast.success(novos.length > 1 ? `${novos.length} documentos enviados` : 'Documento enviado.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui subir o documento.');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };
  return (
    <div>
      {canEdit && (
        <>
          <input ref={ref} type="file" accept=".pdf,.doc,.docx,image/*" multiple className="hidden" onChange={(e) => subir(Array.from(e.target.files ?? []))} />
          <DropZone accept=".pdf,.doc,.docx,image/*" multiple disabled={busy} onFiles={subir} className="block" overlayLabel="Soltar documentos">
            <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="w-full rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 px-3 py-2.5 text-center text-[11px] text-zinc-500 hover:border-[#7048E8] hover:text-[#7048E8] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950/40">
              {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <><UploadCloud className="mr-1 inline h-3.5 w-3.5" /> {dica}</>}
            </button>
          </DropZone>
        </>
      )}
      <div className="mt-1.5 space-y-1.5">
        {docs.length === 0 && <p className="text-xs text-zinc-400">Nenhum documento anexado.</p>}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-1.5">
            <input value={d.nome} onChange={(e) => onChange(docs.map((x) => (x.id === d.id ? { ...x, nome: e.target.value } : x)))} disabled={!canEdit} placeholder="Nome (ex.: TRCT)" className={`${INPUT} w-1/3 min-w-0`} />
            <input value={d.url ?? ''} onChange={(e) => onChange(docs.map((x) => (x.id === d.id ? { ...x, url: e.target.value } : x)))} disabled={!canEdit} placeholder="link do documento" className={`${INPUT} min-w-0 flex-1`} />
            {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="shrink-0 rounded p-1.5 text-zinc-400 hover:text-[#228BE6]"><ExternalLink className="h-4 w-4" /></a>}
            {canEdit && <button onClick={() => onChange(docs.filter((x) => x.id !== d.id))} className="shrink-0 rounded p-1.5 text-zinc-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
      </div>
      {canEdit && <button onClick={() => onChange([...docs, { id: rid(), nome: '', url: '' }])} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> colar link</button>}
    </div>
  );
}

// ─────────────────────────── casca dos modais ───────────────────────────

function Modal({
  titulo, Icon, cor, onClose, children, footer, largo,
}: { titulo: string; Icon: typeof UserPlus; cor: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; largo?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className={`max-h-[92vh] w-full ${largo ? 'max-w-2xl' : 'max-w-lg'} overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-zinc-900`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100"><Icon className="h-4 w-4" style={{ color: cor }} /> {titulo}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">{children}</div>
        {footer && <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-zinc-100 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">{footer}</div>}
      </div>
    </div>
  );
}

function BotaoSalvar({ onClick, busy, cor, label, Icon }: { onClick: () => void; busy: boolean; cor: string; label: string; Icon: typeof Save }) {
  return (
    <button onClick={onClick} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: cor }}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {label}
    </button>
  );
}

function Cabecalho({ membro, subtitulo, foto }: { membro: Member; subtitulo: string; foto?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      {foto ? <img src={foto} alt={membro.user.name} className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7048E8] text-base font-bold text-white">{ini(membro.user.name)}</div>}
      <div className="min-w-0">
        <p className="truncate font-bold text-zinc-800 dark:text-zinc-100">{membro.user.name}</p>
        <p className="truncate text-xs text-zinc-400">{subtitulo}</p>
      </div>
    </div>
  );
}

// ─────────────────────────── contexto compartilhado ───────────────────────────

/** Tudo o que os modais precisam para gravar nos quatro storages. */
export interface CicloCtx {
  fichas: Record<string, Ficha>;
  pessoas: Record<string, PessoaInfo>;
  cargos: Cargo[];
  verticais: Vertical[];
  honorariosPct: Record<string, number>;
  acessoFin: Record<string, AcessoNivel>;
  autor: string;   // nome de quem está operando (vai no histórico)
  meuUserId: string;
}

/** Grava a ficha de um userId preservando as demais (o PATCH substitui o mapa inteiro). */
async function salvarFicha(ctx: CicloCtx, userId: string, ficha: Ficha) {
  await rhService.save({ fichas: { ...ctx.fichas, [userId]: ficha } });
}

/** Idem, mas mexendo em várias chaves de uma vez (contratação: apaga o rascunho `pre:`). */
async function salvarFichas(ctx: CicloCtx, patch: Record<string, Ficha | null>) {
  const mapa = { ...ctx.fichas };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete mapa[k];
    else mapa[k] = v;
  }
  await rhService.save({ fichas: mapa });
}

async function salvarPessoa(ctx: CicloCtx, userId: string, patch: Partial<PessoaInfo>) {
  await escritorioService.save({ pessoas: { ...ctx.pessoas, [userId]: { ...(ctx.pessoas[userId] ?? {}), ...patch } } });
}

const comHistorico = (ficha: Ficha, ev: EventoRh): Ficha => ({ ...ficha, historico: [...(ficha.historico ?? []), ev] });

// ─────────────────────────── 1. Contratar / adicionar ───────────────────────────

export function ContratarModal({ ctx, onClose, onDone }: { ctx: CicloCtx; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('AGENT');
  const [cargoId, setCargoId] = useState('');
  const [admissao, setAdmissao] = useState(hojeBR());
  const [contrato, setContrato] = useState(TIPOS_CONTRATO[0]);
  const [honor, setHonor] = useState('');
  const [acesso, setAcesso] = useState<AcessoNivel>('none');
  const [atuacao, setAtuacao] = useState<string[]>([]);
  const [obs, setObs] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const pct = () => (honor.trim() === '' ? undefined : Math.max(0, Math.min(100, Number(honor.replace(',', '.')))));
  const cargoNome = ctx.cargos.find((c) => c.id === cargoId)?.nome;

  const contratar = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail) { toast.error('Informe o e-mail do colaborador.'); return; }
    if (!admissao.trim()) { toast.error('Informe a data de admissão.'); return; }
    setBusy(true);
    try {
      const r = await membersService.invite({ email: mail, role });
      const evento = novoEvento({
        tipo: 'contratacao', data: admissao,
        titulo: cargoNome ? `Contratado como ${cargoNome}` : 'Contratado',
        para: [cargoNome, contrato].filter(Boolean).join(' · ') || undefined,
        obs: obs.trim() || undefined, registradoPor: ctx.autor,
      });
      const fichaBase: Ficha = { admissao, contrato, historico: [evento], documentos: [] };

      if (r?.autoAccepted) {
        // Já era usuário do Hub: entrou na hora, então dá para aplicar tudo agora.
        const lista = await membersService.list();
        const novo = lista.find((m) => m.user.email.toLowerCase() === mail);
        if (!novo) throw new Error('Colaborador adicionado, mas não consegui localizá-lo para aplicar cargo e contrato. Abra a ficha dele e complete.');
        await salvarFicha(ctx, novo.user.id, fichaBase);
        await salvarPessoa(ctx, novo.user.id, { cargoId: cargoId || undefined, atuacao, contratadaDesde: admissao, conoscoDesde: admissao });
        const p = pct();
        if (p != null) await financeiroService.setHonorariosPct(novo.user.id, p);
        if (acesso !== 'none') await financeiroService.setAcesso(novo.user.id, acesso);
        toast.success('Colaborador contratado — ficha, cargo e contrato já aplicados.');
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['org-members'] }),
          qc.invalidateQueries({ queryKey: ['members'] }),
          qc.invalidateQueries({ queryKey: ['rh'] }),
          qc.invalidateQueries({ queryKey: ['escritorio'] }),
          qc.invalidateQueries({ queryKey: ['financeiro'] }),
        ]);
        onDone();
        onClose();
        return;
      }

      // Ainda não tem conta: guarda a contratação como rascunho `pre:<email>`.
      // Assim que ele aceitar o convite, o RH aplica tudo sozinho ao abrir a tela.
      await salvarFichas(ctx, {
        [preKey(mail)]: {
          ...fichaBase,
          preAdmissao: { email: mail, role, cargoId: cargoId || undefined, atuacao, honorariosPct: pct(), acessoFin: acesso, criadoEm: new Date().toISOString() },
        },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['org-members'] }),
        qc.invalidateQueries({ queryKey: ['rh'] }),
      ]);
      setLink(`${window.location.origin}/register?invite=${r.token}`);
      toast.success('Contratação registrada — mande o link para o colaborador criar a conta.');
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Erro ao contratar colaborador');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal titulo="Contratar colaborador" Icon={UserPlus} cor="#02883C" onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">{link ? 'Fechar' : 'Cancelar'}</button>
          {!link && <BotaoSalvar onClick={contratar} busy={busy} cor="#02883C" label="Contratar" Icon={UserPlus} />}
        </>
      }>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Cadastra a pessoa <strong>e</strong> já registra a contratação: cargo, data de admissão, tipo de contrato e condições.
        É o mesmo convite de <strong>Configurações › Membros</strong> — não precisa fazer duas vezes.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><p className={LABEL}>E-mail *</p><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@exemplo.com" className={`${INPUT} mt-1`} /></div>
        <div>
          <p className={LABEL}>Papel no Hub</p>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={`${INPUT} mt-1`}>
            <option value="AGENT">Associado / Agente</option>
            <option value="ADMIN">Sócio / Admin</option>
          </select>
        </div>
        <div>
          <p className={LABEL}>Cargo</p>
          <select value={cargoId} onChange={(e) => setCargoId(e.target.value)} className={`${INPUT} mt-1`}>
            <option value="">— sem cargo —</option>
            {ctx.cargos.map((c) => <option key={c.id} value={c.id}>{c.nome || 'Cargo'}</option>)}
          </select>
        </div>
        <div><p className={LABEL}>Admissão *</p><input value={admissao} onChange={(e) => setAdmissao(maskDataBR(e.target.value))} inputMode="numeric" placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /></div>
        <div>
          <p className={LABEL}>Tipo de contrato</p>
          <input list="rh-tipos-contrato" value={contrato} onChange={(e) => setContrato(e.target.value)} className={`${INPUT} mt-1`} />
          <datalist id="rh-tipos-contrato">{TIPOS_CONTRATO.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
        <div><p className={LABEL}>Honorários (%)</p><input value={honor} onChange={(e) => setHonor(e.target.value)} inputMode="decimal" placeholder="ex.: 30" className={`${INPUT} mt-1`} /></div>
        <div>
          <p className={LABEL}>Acesso ao Financeiro</p>
          <select value={acesso} onChange={(e) => setAcesso(e.target.value as AcessoNivel)} className={`${INPUT} mt-1`}>
            <option value="none">Sem acesso</option>
            <option value="cases">Só os processos dele</option>
            <option value="full">Total (visão do escritório)</option>
          </select>
        </div>
      </div>
      {ctx.verticais.length > 0 && (
        <div>
          <p className={LABEL}>Áreas de atuação</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ctx.verticais.map((v) => {
              const on = atuacao.includes(v.nome);
              return (
                <button key={v.id} type="button" onClick={() => setAtuacao((xs) => (on ? xs.filter((x) => x !== v.nome) : [...xs, v.nome]))}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${on ? 'border-[#7048E8] bg-[#7048E8] text-white' : 'border-zinc-300 bg-white text-zinc-600 hover:border-[#7048E8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}>
                  {v.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div><p className={LABEL}>Observação da contratação</p><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="ex.: veio do Labor Day de março; período de experiência de 90 dias." className={`${INPUT} mt-1`} /></div>
      {link && (
        <div className="rounded-lg border border-[#02883C]/25 bg-[#02883C]/5 p-2.5 dark:bg-[#02883C]/10">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">Contratação guardada. Mande este link — quando ele criar a conta, cargo, contrato e condições entram sozinhos.</p>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-zinc-600 dark:text-zinc-300">{link}</p>
            <button onClick={() => { navigator.clipboard.writeText(link); toast.success('Link copiado!'); }} className="shrink-0 rounded-md bg-[#02883C] px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90">Copiar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────── 2. Promover ───────────────────────────

export function PromoverModal({ ctx, membro, onClose, onDone }: { ctx: CicloCtx; membro: Member; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const uid = membro.user.id;
  const info = ctx.pessoas[uid] ?? {};
  const cargoAtual = ctx.cargos.find((c) => c.id === info.cargoId);
  const pctAtual = ctx.honorariosPct[uid];

  const [cargoId, setCargoId] = useState(info.cargoId ?? '');
  const [role, setRole] = useState(membro.role);
  const [honor, setHonor] = useState(pctAtual != null ? String(pctAtual) : '');
  const [data, setData] = useState(hojeBR());
  const [obs, setObs] = useState('');
  const [busy, setBusy] = useState(false);

  const cargoNovo = ctx.cargos.find((c) => c.id === cargoId);
  const pctNovo = honor.trim() === '' ? undefined : Math.max(0, Math.min(100, Number(honor.replace(',', '.'))));
  const mudouCargo = (info.cargoId ?? '') !== cargoId;
  const mudouRole = membro.role !== role;
  const mudouPct = pctNovo != null && pctNovo !== pctAtual;
  const nada = !mudouCargo && !mudouRole && !mudouPct;

  const promover = async () => {
    if (nada) { toast.error('Mude o cargo, o papel ou o percentual para registrar a promoção.'); return; }
    if (!data.trim()) { toast.error('Informe a data da promoção.'); return; }
    setBusy(true);
    try {
      if (mudouCargo) await salvarPessoa(ctx, uid, { cargoId: cargoId || undefined });
      if (mudouRole) await membersService.updateRole(membro.id, role);
      if (mudouPct) await financeiroService.setHonorariosPct(uid, pctNovo!);

      const de = [cargoAtual?.nome ?? roleLabel(membro.role), pctAtual != null ? `${pctAtual}% honor.` : null].filter(Boolean).join(' · ');
      const para = [cargoNovo?.nome ?? roleLabel(role), pctNovo != null ? `${pctNovo}% honor.` : null].filter(Boolean).join(' · ');
      const ficha = ctx.fichas[uid] ?? {};
      await salvarFicha(ctx, uid, comHistorico(ficha, novoEvento({
        tipo: 'promocao', data,
        titulo: cargoNovo?.nome ? `Promovido a ${cargoNovo.nome}` : 'Promoção registrada',
        de, para, obs: obs.trim() || undefined, registradoPor: ctx.autor,
      })));

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['rh'] }),
        qc.invalidateQueries({ queryKey: ['escritorio'] }),
        qc.invalidateQueries({ queryKey: ['org-members'] }),
        qc.invalidateQueries({ queryKey: ['financeiro'] }),
      ]);
      toast.success('Promoção registrada.');
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao registrar a promoção');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal titulo="Promover colaborador" Icon={TrendingUp} cor="#7048E8" onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
          <BotaoSalvar onClick={promover} busy={busy} cor="#7048E8" label="Registrar promoção" Icon={TrendingUp} />
        </>
      }>
      <Cabecalho membro={membro} foto={membro.user.avatarUrl || info.fotoUrl} subtitulo={`Hoje: ${cargoAtual?.nome ?? roleLabel(membro.role)}${pctAtual != null ? ` · ${pctAtual}% de honorários` : ''}`} />
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <p className={LABEL}>Novo cargo</p>
          <select value={cargoId} onChange={(e) => setCargoId(e.target.value)} className={`${INPUT} mt-1`}>
            <option value="">— sem cargo —</option>
            {ctx.cargos.map((c) => <option key={c.id} value={c.id}>{c.nome || 'Cargo'}</option>)}
          </select>
          {ctx.cargos.length === 0 && <p className="mt-1 text-[10px] text-amber-600">Nenhum cargo cadastrado. Monte a estrutura em <strong>Meu Espaço › Organograma</strong>.</p>}
        </div>
        <div>
          <p className={LABEL}>Papel no Hub</p>
          <select value={role} onChange={(e) => setRole(e.target.value as Member['role'])} disabled={membro.role === 'OWNER'} className={`${INPUT} mt-1`}>
            <option value="AGENT">Associado / Agente</option>
            <option value="ADMIN">Sócio / Admin</option>
            {membro.role === 'OWNER' && <option value="OWNER">Proprietário</option>}
          </select>
          <p className="mt-1 text-[10px] text-zinc-400">Sócio / Admin abre RH, Financeiro e configurações.</p>
        </div>
        <div><p className={LABEL}>Honorários (%)</p><input value={honor} onChange={(e) => setHonor(e.target.value)} inputMode="decimal" placeholder="ex.: 35" className={`${INPUT} mt-1`} /></div>
        <div><p className={LABEL}>Data da promoção</p><input value={data} onChange={(e) => setData(maskDataBR(e.target.value))} inputMode="numeric" placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /></div>
      </div>
      <div><p className={LABEL}>Motivo / observação</p><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="ex.: assumiu a titularidade da vertical Bancário." className={`${INPUT} mt-1`} /></div>
      {nada && <p className="text-xs text-amber-600 dark:text-amber-400">Nada mudou ainda — escolha um novo cargo, papel ou percentual.</p>}
    </Modal>
  );
}

// ─────────────────────────── 3. Alterar contrato ───────────────────────────

export function AlterarContratoModal({ ctx, membro, onClose, onDone }: { ctx: CicloCtx; membro: Member; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const uid = membro.user.id;
  const info = ctx.pessoas[uid] ?? {};
  const ficha = ctx.fichas[uid] ?? {};
  const cargo = ctx.cargos.find((c) => c.id === info.cargoId);
  const contratoAtual = ficha.contrato ?? '';
  const acessoAtual = ctx.acessoFin[uid] ?? 'none';
  const pctAtual = ctx.honorariosPct[uid];

  const [contrato, setContrato] = useState(contratoAtual || TIPOS_CONTRATO[0]);
  const [vigencia, setVigencia] = useState(hojeBR());
  const [honor, setHonor] = useState(pctAtual != null ? String(pctAtual) : '');
  const [acesso, setAcesso] = useState<AcessoNivel>(acessoAtual);
  const [obs, setObs] = useState('');
  const [arquivo, setArquivo] = useState<{ url: string; nome: string } | null>(null);
  const [upBusy, setUpBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const subirContrato = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUpBusy(true);
    try {
      const up = await inboxService.uploadMedia(file);
      setArquivo({ url: up.url, nome: file.name });
      toast.success('Contrato anexado — salve para aplicar.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Não consegui subir o contrato.');
    } finally {
      setUpBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pctNovo = honor.trim() === '' ? undefined : Math.max(0, Math.min(100, Number(honor.replace(',', '.'))));

  const salvar = async () => {
    if (!vigencia.trim()) { toast.error('Informe a data de vigência.'); return; }
    setBusy(true);
    try {
      if (arquivo) await salvarPessoa(ctx, uid, { contratoUrl: arquivo.url, contratoNome: arquivo.nome });
      if (pctNovo != null && pctNovo !== pctAtual) await financeiroService.setHonorariosPct(uid, pctNovo);
      if (acesso !== acessoAtual) await financeiroService.setAcesso(uid, acesso);

      const docs = arquivo ? [...(ficha.documentos ?? []), { id: rid(), nome: `Contrato — ${vigencia}`, url: arquivo.url }] : ficha.documentos;
      await salvarFicha(ctx, uid, comHistorico({ ...ficha, contrato, documentos: docs }, novoEvento({
        tipo: 'contrato', data: vigencia, titulo: 'Alteração de contrato',
        de: [contratoAtual || '—', pctAtual != null ? `${pctAtual}% honor.` : null].filter(Boolean).join(' · '),
        para: [contrato, pctNovo != null ? `${pctNovo}% honor.` : null].filter(Boolean).join(' · '),
        obs: obs.trim() || undefined, registradoPor: ctx.autor,
      })));

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['rh'] }),
        qc.invalidateQueries({ queryKey: ['escritorio'] }),
        qc.invalidateQueries({ queryKey: ['financeiro'] }),
      ]);
      toast.success('Contrato atualizado.');
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao alterar o contrato');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal titulo="Alterar contrato" Icon={FileSignature} cor="#228BE6" onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
          <BotaoSalvar onClick={salvar} busy={busy} cor="#228BE6" label="Salvar contrato" Icon={Save} />
        </>
      }>
      <Cabecalho membro={membro} foto={membro.user.avatarUrl || info.fotoUrl} subtitulo={`${cargo?.nome ?? roleLabel(membro.role)} · contrato atual: ${contratoAtual || 'não informado'}`} />
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <p className={LABEL}>Novo contrato</p>
          <input list="rh-tipos-contrato-alt" value={contrato} onChange={(e) => setContrato(e.target.value)} placeholder="ex.: Contrato de associação (advogado)" className={`${INPUT} mt-1`} />
          <datalist id="rh-tipos-contrato-alt">{TIPOS_CONTRATO.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
        <div><p className={LABEL}>Vigência a partir de</p><input value={vigencia} onChange={(e) => setVigencia(maskDataBR(e.target.value))} inputMode="numeric" placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /></div>
        <div><p className={LABEL}>Honorários (%)</p><input value={honor} onChange={(e) => setHonor(e.target.value)} inputMode="decimal" placeholder="ex.: 30" className={`${INPUT} mt-1`} /></div>
        <div className="col-span-2">
          <p className={LABEL}>Acesso ao Financeiro</p>
          <select value={acesso} onChange={(e) => setAcesso(e.target.value as AcessoNivel)} className={`${INPUT} mt-1`}>
            <option value="none">Sem acesso</option>
            <option value="cases">Só os processos dele</option>
            <option value="full">Total (visão do escritório)</option>
          </select>
        </div>
      </div>
      <div>
        <p className={LABEL}>Contrato assinado (PDF)</p>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => subirContrato(Array.from(e.target.files ?? []))} />
        <DropZone accept=".pdf,.doc,.docx,image/*" multiple={false} disabled={upBusy} onFiles={subirContrato} className="mt-1 block" overlayLabel="Soltar o contrato">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={upBusy} className="w-full rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 px-3 py-2.5 text-center text-[11px] text-zinc-500 hover:border-[#228BE6] hover:text-[#228BE6] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950/40">
            {upBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <><UploadCloud className="mr-1 inline h-3.5 w-3.5" /> {arquivo ? arquivo.nome : 'Arraste o contrato assinado ou clique para escolher'}</>}
          </button>
        </DropZone>
        <p className="mt-1 text-[10px] text-zinc-400">Substitui o contrato que a pessoa vê em <strong>Meu Espaço › Meu Contrato</strong> e entra nos documentos da ficha.{info.contratoNome && !arquivo ? ` Atual: ${info.contratoNome}.` : ''}</p>
      </div>
      <div><p className={LABEL}>Observação</p><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="ex.: migrou de estágio para associação; reajuste do percentual." className={`${INPUT} mt-1`} /></div>
    </Modal>
  );
}

// ─────────────────────────── 4. Desligar ───────────────────────────

export function DesligarModal({ ctx, membro, onClose, onDone }: { ctx: CicloCtx; membro: Member; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const uid = membro.user.id;
  const info = ctx.pessoas[uid] ?? {};
  const ficha = ctx.fichas[uid] ?? {};
  const cargo = ctx.cargos.find((c) => c.id === info.cargoId);

  const [data, setData] = useState(hojeBR());
  const [ultimoDia, setUltimoDia] = useState('');
  const [motivo, setMotivo] = useState<MotivoDesligamento>('sem_justa_causa');
  const [aviso, setAviso] = useState<AvisoPrevio>('indenizado');
  const [detalhe, setDetalhe] = useState('');
  const [elegivel, setElegivel] = useState(true);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [bloquear, setBloquear] = useState(true);
  const [esconder, setEsconder] = useState(true);
  const [confirma, setConfirma] = useState(false);
  const [busy, setBusy] = useState(false);

  const ehOwner = membro.role === 'OWNER';
  const souEu = uid === ctx.meuUserId;
  const impedido = ehOwner || souEu;

  const desligar = async () => {
    if (impedido) return;
    if (!data.trim()) { toast.error('Informe a data do desligamento.'); return; }
    if (!confirma) { toast.error('Marque a confirmação para concluir o desligamento.'); return; }
    setBusy(true);
    try {
      // 1) Acessos primeiro: se algo falhar depois, a pessoa já está fora.
      if (bloquear) await membersService.setActive(membro.id, false);
      if (esconder) await membersService.setAssignable(membro.id, false);
      if ((ctx.acessoFin[uid] ?? 'none') !== 'none') await financeiroService.setAcesso(uid, 'none');

      // 2) Congela o registro na ficha — é isso que manda a pessoa para o arquivo.
      const desligamento: Desligamento = {
        data,
        ultimoDia: ultimoDia.trim() || undefined,
        motivo,
        detalhe: detalhe.trim() || undefined,
        avisoPrevio: aviso,
        cargoNaSaida: cargo?.nome,
        papelNaSaida: membro.role,
        elegivelRecontratacao: elegivel,
        documentos: docs.filter((d) => d.nome || d.url),
        acessoBloqueado: bloquear,
        registradoPor: ctx.autor,
        registradoEm: new Date().toISOString(),
      };
      await salvarFicha(ctx, uid, comHistorico({ ...ficha, desligamento }, novoEvento({
        tipo: 'desligamento', data,
        titulo: MOTIVO_LABEL[motivo],
        de: cargo?.nome ?? roleLabel(membro.role),
        para: 'Desligado',
        obs: detalhe.trim() || undefined,
        registradoPor: ctx.autor,
      })));

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['rh'] }),
        qc.invalidateQueries({ queryKey: ['org-members'] }),
        qc.invalidateQueries({ queryKey: ['members'] }),
        qc.invalidateQueries({ queryKey: ['financeiro'] }),
      ]);
      toast.success(`${membro.user.name} foi desligado e arquivado.`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao desligar o colaborador');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal titulo="Desligar colaborador" Icon={UserMinus} cor="#E64980" onClose={onClose} largo
      footer={
        <>
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
          {!impedido && <BotaoSalvar onClick={desligar} busy={busy} cor="#E64980" label="Desligar e arquivar" Icon={UserMinus} />}
        </>
      }>
      <Cabecalho membro={membro} foto={membro.user.avatarUrl || info.fotoUrl} subtitulo={`${cargo?.nome ?? roleLabel(membro.role)}${ficha.admissao ? ` · na casa desde ${ficha.admissao} (${tempoDeCasa(ficha.admissao)})` : ''}`} />

      {impedido ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-400">
          {ehOwner
            ? 'O proprietário da organização não pode ser desligado pelo Hub. Transfira a propriedade antes.'
            : 'Você não pode desligar a si mesmo. Peça a outro sócio.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div><p className={LABEL}>Data do desligamento *</p><input value={data} onChange={(e) => setData(maskDataBR(e.target.value))} inputMode="numeric" placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /></div>
            <div><p className={LABEL}>Último dia trabalhado</p><input value={ultimoDia} onChange={(e) => setUltimoDia(maskDataBR(e.target.value))} inputMode="numeric" placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /></div>
            <div>
              <p className={LABEL}>Motivo</p>
              <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDesligamento)} className={`${INPUT} mt-1`}>
                {(Object.keys(MOTIVO_LABEL) as MotivoDesligamento[]).map((k) => <option key={k} value={k}>{MOTIVO_LABEL[k]}</option>)}
              </select>
            </div>
            <div>
              <p className={LABEL}>Aviso prévio</p>
              <select value={aviso} onChange={(e) => setAviso(e.target.value as AvisoPrevio)} className={`${INPUT} mt-1`}>
                {(Object.keys(AVISO_LABEL) as AvisoPrevio[]).map((k) => <option key={k} value={k}>{AVISO_LABEL[k]}</option>)}
              </select>
            </div>
          </div>
          <div><p className={LABEL}>Relato interno</p><textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} rows={3} placeholder="O que aconteceu, o que foi combinado, pendências. Fica só no RH." className={`${INPUT} mt-1`} /></div>
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={elegivel} onChange={(e) => setElegivel(e.target.checked)} className="h-4 w-4 accent-[#02883C]" />
            Elegível a recontratação
          </label>

          <div>
            <p className={LABEL}>Documentos da rescisão</p>
            <p className="mb-1.5 mt-0.5 text-[11px] text-zinc-400">TRCT, termo de rescisão, distrato, termo de quitação, comprovante de FGTS…</p>
            <ListaDocumentos docs={docs} onChange={setDocs} canEdit dica="Arraste os documentos da rescisão ou clique para escolher" />
          </div>

          <div className="space-y-2 rounded-xl border border-[#E64980]/25 bg-[#E64980]/5 p-3 dark:bg-[#E64980]/10">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#E64980]"><ShieldOff className="h-3.5 w-3.5" /> O que acontece no ato</p>
            <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={bloquear} onChange={(e) => setBloquear(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#E64980]" />
              <span>Bloquear o acesso ao Hub <span className="text-xs text-zinc-400">(o login para de funcionar na hora)</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={esconder} onChange={(e) => setEsconder(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#E64980]" />
              <span>Tirar dos seletores de responsável <span className="text-xs text-zinc-400">(some de atribuições, kanbans e agenda)</span></span>
            </label>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              O vínculo com a organização <strong>não é apagado</strong>: o que a pessoa já fez (casos, tarefas, mensagens) continua com o nome dela.
              A ficha completa vai para <strong>Desligados</strong> e pode ser reaberta quando quiser.
            </p>
          </div>

          <label className="flex items-start gap-2 rounded-lg bg-zinc-50 p-2.5 text-sm text-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-200">
            <input type="checkbox" checked={confirma} onChange={(e) => setConfirma(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#E64980]" />
            <span>Confirmo o desligamento de <strong>{membro.user.name}</strong> em <strong>{data || '—'}</strong>.</span>
          </label>
        </>
      )}
    </Modal>
  );
}

// ─────────────────────────── 5. Arquivo de desligados ───────────────────────────

export function Desligados({
  ctx, desligados, canEdit, onChanged,
}: { ctx: CicloCtx; desligados: Member[]; canEdit: boolean; onChanged: () => void }) {
  const [dossieId, setDossieId] = useState<string | null>(null);
  const alvo = desligados.find((m) => m.user.id === dossieId);

  const ordenados = useMemo(
    () => [...desligados].sort((a, b) => {
      const da = parseBR(ctx.fichas[a.user.id]?.desligamento?.data)?.getTime() ?? 0;
      const db = parseBR(ctx.fichas[b.user.id]?.desligamento?.data)?.getTime() ?? 0;
      return db - da;
    }),
    [desligados, ctx.fichas],
  );

  if (ordenados.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800"><Archive className="h-6 w-6" /></span>
        <p className="mt-3 font-semibold text-zinc-700 dark:text-zinc-200">Ninguém desligado até aqui</p>
        <p className="mt-1 text-sm text-zinc-500">Quando alguém sair, a ficha completa — foto, dados, documentos e linha do tempo — fica arquivada aqui.</p>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <p className="mb-3 text-sm text-zinc-500">
        {ordenados.length} {ordenados.length === 1 ? 'pessoa desligada' : 'pessoas desligadas'} · o arquivo guarda tudo: dados cadastrais, documentos pessoais, rescisão e a linha do tempo na casa.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ordenados.map((m) => {
          const ficha = ctx.fichas[m.user.id] ?? {};
          const d = ficha.desligamento!;
          const info = ctx.pessoas[m.user.id] ?? {};
          const foto = m.user.avatarUrl || info.fotoUrl;
          const periodo = tempoDeCasa(ficha.admissao, d.data);
          return (
            <button key={m.user.id} onClick={() => setDossieId(m.user.id)} className="group rounded-2xl border border-zinc-200/80 bg-white p-4 text-left transition hover:-translate-y-px hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {foto ? <img src={foto} alt={m.user.name} className="h-14 w-14 rounded-full object-cover opacity-70 grayscale ring-2 ring-zinc-100 dark:ring-zinc-800" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-400 text-lg font-bold text-white">{ini(m.user.name)}</div>}
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#E64980] text-white ring-2 ring-white dark:ring-zinc-900"><UserMinus className="h-3 w-3" /></span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-zinc-800 dark:text-zinc-100">{m.user.name}</p>
                  <p className="truncate text-xs text-zinc-400">{d.cargoNaSaida ?? roleLabel(d.papelNaSaida ?? m.role)}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#E64980]" /> {ficha.admissao ? `${ficha.admissao} → ${d.data}` : `Desligado em ${d.data}`}</p>
                {periodo && <p className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 shrink-0" /> {periodo} de casa</p>}
                <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{m.user.email}</span></p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[#E64980]/10 px-2 py-0.5 text-[10px] font-semibold text-[#E64980] dark:bg-[#E64980]/20">{MOTIVO_LABEL[d.motivo]}</span>
                {d.elegivelRecontratacao && <span className="rounded-full bg-[#02883C]/10 px-2 py-0.5 text-[10px] font-semibold text-[#02883C] dark:bg-[#02883C]/20">recontratável</span>}
                {(d.documentos?.length ?? 0) + (ficha.documentos?.length ?? 0) > 0 && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{(d.documentos?.length ?? 0) + (ficha.documentos?.length ?? 0)} doc</span>}
                <span className="ml-auto text-[11px] font-semibold text-[#7048E8] opacity-0 transition group-hover:opacity-100">Abrir dossiê →</span>
              </div>
            </button>
          );
        })}
      </div>
      {alvo && <DossieModal ctx={ctx} membro={alvo} canEdit={canEdit} onClose={() => setDossieId(null)} onChanged={() => { setDossieId(null); onChanged(); }} />}
    </div>
  );
}

function Linha({ Icon, label, valor }: { Icon: typeof Mail; label: string; valor?: string }) {
  if (!valor) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <span className="text-zinc-400">{label}:</span>
      <span className="min-w-0 flex-1 break-words text-zinc-700 dark:text-zinc-200">{valor}</span>
    </div>
  );
}

/** Documento do dossiê em modo leitura: abre em nova aba e, para sócio, remove com confirmação. */
function DocLinha({
  doc, corClass, podeRemover, confirmando, busy, onPedir, onCancelar, onRemover,
}: {
  doc: Documento; corClass: string; podeRemover: boolean; confirmando: boolean; busy: boolean;
  onPedir: () => void; onCancelar: () => void; onRemover: () => void;
}) {
  return (
    <div className={`rounded-lg border ${confirmando ? 'border-rose-300 dark:border-rose-900/60' : `border-zinc-200 dark:border-zinc-800 ${corClass}`}`}>
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <a href={doc.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <ExternalLink className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{doc.nome || 'Documento'}</span>
        </a>
        {podeRemover && !confirmando && (
          <button onClick={onPedir} title="Remover do dossiê" className="shrink-0 rounded p-1 text-zinc-400 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
        )}
      </div>
      {confirmando && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-rose-200 bg-rose-50/60 px-2.5 py-1.5 dark:border-rose-900/50 dark:bg-rose-900/10">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Remover <strong>{doc.nome || 'este documento'}</strong> do dossiê? <span className="text-zinc-400">O arquivo em si continua no storage — quem já tiver o link ainda abre.</span>
          </p>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button onClick={onCancelar} className="rounded px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
            <button onClick={onRemover} disabled={busy} className="inline-flex items-center gap-1 rounded bg-rose-500 px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Remover
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Dossiê completo do ex-colaborador — leitura, edição da ficha e opção de readmitir. */
function DossieModal({
  ctx, membro, canEdit, onClose, onChanged,
}: { ctx: CicloCtx; membro: Member; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const uid = membro.user.id;
  const info = ctx.pessoas[uid] ?? {};
  const foto = membro.user.avatarUrl || info.fotoUrl;

  // A ficha vive em estado local para que a correção apareça na hora, sem esperar o refetch.
  const [ficha, setFicha] = useState<Ficha>(ctx.fichas[uid] ?? {});
  const [busy, setBusy] = useState(false);
  const [readmitir, setReadmitir] = useState(false);
  const [dataRe, setDataRe] = useState(hojeBR());
  /** Rascunho da edição — null = só leitura. Guarda ficha e desligamento juntos. */
  const [rascunho, setRascunho] = useState<{ f: Ficha; d: Desligamento } | null>(null);
  /** Documento aguardando confirmação de remoção (na leitura, sem entrar na edição). */
  const [removendo, setRemovendo] = useState<{ escopo: 'pessoal' | 'rescisao'; id: string } | null>(null);

  const d = ficha.desligamento;
  if (!d) return null;

  const abrirEdicao = () => { setReadmitir(false); setRemovendo(null); setRascunho({ f: ficha, d }); };
  const setF = (patch: Partial<Ficha>) => setRascunho((r) => (r ? { ...r, f: { ...r.f, ...patch } } : r));
  const setD = (patch: Partial<Desligamento>) => setRascunho((r) => (r ? { ...r, d: { ...r.d, ...patch } } : r));

  const salvarEdicao = async () => {
    if (!rascunho) return;
    if (!rascunho.d.data.trim()) { toast.error('A data do desligamento não pode ficar em branco.'); return; }
    setBusy(true);
    try {
      const nova: Ficha = {
        ...rascunho.f,
        documentos: (rascunho.f.documentos ?? []).filter((x) => x.nome || x.url),
        desligamento: {
          ...rascunho.d,
          documentos: (rascunho.d.documentos ?? []).filter((x) => x.nome || x.url),
          retificadoPor: ctx.autor,
          retificadoEm: new Date().toISOString(),
        },
      };
      await salvarFicha(ctx, uid, nova);
      await qc.invalidateQueries({ queryKey: ['rh'] });
      setFicha(nova);
      setRascunho(null);
      toast.success('Dossiê atualizado.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar o dossiê');
    } finally {
      setBusy(false);
    }
  };

  /** Remove um documento direto da leitura — grava na hora, sem passar pela edição. */
  const removerDoc = async (escopo: 'pessoal' | 'rescisao', id: string) => {
    setBusy(true);
    try {
      const carimbo = { retificadoPor: ctx.autor, retificadoEm: new Date().toISOString() };
      const nova: Ficha = escopo === 'pessoal'
        ? { ...ficha, documentos: (ficha.documentos ?? []).filter((x) => x.id !== id), desligamento: { ...d, ...carimbo } }
        : { ...ficha, desligamento: { ...d, documentos: (d.documentos ?? []).filter((x) => x.id !== id), ...carimbo } };
      await salvarFicha(ctx, uid, nova);
      await qc.invalidateQueries({ queryKey: ['rh'] });
      setFicha(nova);
      setRemovendo(null);
      toast.success('Documento removido do dossiê.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao remover o documento');
    } finally {
      setBusy(false);
    }
  };

  const confirmarReadmissao = async () => {
    setBusy(true);
    try {
      await membersService.setActive(membro.id, true);
      await membersService.setAssignable(membro.id, true);
      const { desligamento: _fora, ...resto } = ficha;
      await salvarFicha(ctx, uid, comHistorico({ ...resto, desligamento: null }, novoEvento({
        tipo: 'readmissao', data: dataRe, titulo: 'Readmitido no escritório',
        de: 'Desligado', para: d.cargoNaSaida ?? 'Ativo', registradoPor: ctx.autor,
      })));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['rh'] }),
        qc.invalidateQueries({ queryKey: ['org-members'] }),
        qc.invalidateQueries({ queryKey: ['members'] }),
      ]);
      toast.success(`${membro.user.name} voltou para a equipe ativa.`);
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao readmitir');
    } finally {
      setBusy(false);
    }
  };

  const editando = rascunho != null;
  const vista = rascunho?.f ?? ficha;
  const vd = rascunho?.d ?? d;
  const docsPessoais = vista.documentos ?? [];
  const docsRescisao = vd.documentos ?? [];

  return (
    <Modal titulo={editando ? 'Editar dossiê do ex-colaborador' : 'Dossiê do ex-colaborador'} Icon={Archive} cor="#E64980" onClose={onClose} largo
      footer={canEdit ? (
        editando ? (
          <>
            <button onClick={() => setRascunho(null)} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
            <BotaoSalvar onClick={salvarEdicao} busy={busy} cor="#7048E8" label="Salvar alterações" Icon={Save} />
          </>
        ) : (
          <>
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Fechar</button>
            {readmitir
              ? <BotaoSalvar onClick={confirmarReadmissao} busy={busy} cor="#02883C" label="Confirmar readmissão" Icon={RotateCcw} />
              : (
                <>
                  <button onClick={abrirEdicao} className="inline-flex items-center gap-1.5 rounded-lg border border-[#7048E8] px-3.5 py-2 text-sm font-semibold text-[#7048E8] hover:bg-[#7048E8]/10"><Pencil className="h-4 w-4" /> Editar</button>
                  <button onClick={() => setReadmitir(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#02883C] px-3.5 py-2 text-sm font-semibold text-[#02883C] hover:bg-[#02883C]/10"><RotateCcw className="h-4 w-4" /> Readmitir</button>
                </>
              )}
          </>
        )
      ) : undefined}>
      <div className="flex items-center gap-3">
        {foto ? <img src={foto} alt={membro.user.name} className="h-16 w-16 rounded-full object-cover grayscale ring-2 ring-zinc-100 dark:ring-zinc-800" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-400 text-xl font-bold text-white">{ini(membro.user.name)}</div>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-zinc-800 dark:text-zinc-100">{membro.user.name}</p>
          <p className="truncate text-xs text-zinc-400">{vd.cargoNaSaida ?? roleLabel(vd.papelNaSaida ?? membro.role)} · {membro.user.email}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[#E64980]/10 px-2 py-0.5 text-[10px] font-semibold text-[#E64980] dark:bg-[#E64980]/20">Desligado em {vd.data}</span>
            {vista.admissao && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{tempoDeCasa(vista.admissao, vd.data)} de casa</span>}
            {vd.elegivelRecontratacao && <span className="rounded-full bg-[#02883C]/10 px-2 py-0.5 text-[10px] font-semibold text-[#02883C] dark:bg-[#02883C]/20">recontratável</span>}
          </div>
        </div>
      </div>

      {editando && (
        <p className="rounded-lg border border-[#7048E8]/25 bg-[#7048E8]/5 p-2.5 text-xs text-zinc-600 dark:bg-[#7048E8]/10 dark:text-zinc-300">
          Corrigindo o dossiê. Dá para <strong>juntar documentos</strong> (pessoais e da rescisão) e ajustar os dados do desligamento e do cadastro.
          A <strong>linha do tempo não é alterada</strong> — ela é a memória do RH; a correção fica marcada com o seu nome.
        </p>
      )}

      {readmitir && !editando && (
        <div className="rounded-xl border border-[#02883C]/25 bg-[#02883C]/5 p-3 dark:bg-[#02883C]/10">
          <p className="text-sm text-zinc-700 dark:text-zinc-200">Readmitir devolve o acesso ao Hub e traz a pessoa de volta para os seletores de responsável. O desligamento sai da ficha, mas <strong>continua na linha do tempo</strong>.</p>
          <div className="mt-2 flex items-end gap-2">
            <div className="w-40"><p className={LABEL}>Data da readmissão</p><input value={dataRe} onChange={(e) => setDataRe(maskDataBR(e.target.value))} inputMode="numeric" className={`${INPUT} mt-1`} /></div>
            <button onClick={() => setReadmitir(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#E64980]/25 bg-[#E64980]/5 p-3 dark:bg-[#E64980]/10">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#E64980]">Desligamento</p>
        {editando ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><p className={LABEL}>Data do desligamento *</p><input value={vd.data} onChange={(e) => setD({ data: maskDataBR(e.target.value) })} inputMode="numeric" placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /></div>
              <div><p className={LABEL}>Último dia trabalhado</p><input value={vd.ultimoDia ?? ''} onChange={(e) => setD({ ultimoDia: maskDataBR(e.target.value) })} inputMode="numeric" placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /></div>
              <div>
                <p className={LABEL}>Motivo</p>
                <select value={vd.motivo} onChange={(e) => setD({ motivo: e.target.value as MotivoDesligamento })} className={`${INPUT} mt-1`}>
                  {(Object.keys(MOTIVO_LABEL) as MotivoDesligamento[]).map((k) => <option key={k} value={k}>{MOTIVO_LABEL[k]}</option>)}
                </select>
              </div>
              <div>
                <p className={LABEL}>Aviso prévio</p>
                <select value={vd.avisoPrevio ?? 'nao_aplica'} onChange={(e) => setD({ avisoPrevio: e.target.value as AvisoPrevio })} className={`${INPUT} mt-1`}>
                  {(Object.keys(AVISO_LABEL) as AvisoPrevio[]).map((k) => <option key={k} value={k}>{AVISO_LABEL[k]}</option>)}
                </select>
              </div>
              <div><p className={LABEL}>Cargo na saída</p><input value={vd.cargoNaSaida ?? ''} onChange={(e) => setD({ cargoNaSaida: e.target.value })} placeholder="ex.: Sócio Júnior" className={`${INPUT} mt-1`} /></div>
              <label className="flex items-end gap-2 pb-2 text-sm text-zinc-600 dark:text-zinc-300">
                <input type="checkbox" checked={!!vd.elegivelRecontratacao} onChange={(e) => setD({ elegivelRecontratacao: e.target.checked })} className="mb-0.5 h-4 w-4 accent-[#02883C]" />
                Elegível a recontratação
              </label>
            </div>
            <div><p className={LABEL}>Relato interno</p><textarea value={vd.detalhe ?? ''} onChange={(e) => setD({ detalhe: e.target.value })} rows={3} placeholder="O que aconteceu, o que foi combinado, pendências. Fica só no RH." className={`${INPUT} mt-1`} /></div>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <Linha Icon={UserMinus} label="Motivo" valor={MOTIVO_LABEL[d.motivo]} />
              <Linha Icon={CalendarDays} label="Data" valor={d.data} />
              <Linha Icon={CalendarDays} label="Último dia" valor={d.ultimoDia} />
              <Linha Icon={FileSignature} label="Aviso prévio" valor={d.avisoPrevio ? AVISO_LABEL[d.avisoPrevio] : undefined} />
              <Linha Icon={ShieldOff} label="Acesso ao Hub" valor={d.acessoBloqueado ? 'bloqueado no ato' : 'mantido'} />
              <Linha Icon={History} label="Registrado por" valor={d.registradoPor} />
              <Linha Icon={Pencil} label="Corrigido por" valor={d.retificadoPor} />
            </div>
            {d.detalhe && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white/70 p-2 text-sm text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300">{d.detalhe}</p>}
          </>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#7048E8]">Dados cadastrais</p>
        {editando ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><p className={LABEL}>CPF</p><input value={vista.cpf ?? ''} onChange={(e) => setF({ cpf: maskCpf(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" className={`${INPUT} mt-1`} /></div>
              <div><p className={LABEL}>RG</p><input value={vista.rg ?? ''} onChange={(e) => setF({ rg: e.target.value })} className={`${INPUT} mt-1`} /></div>
              <div><p className={LABEL}>Nascimento</p><input value={vista.nascimento ?? ''} onChange={(e) => setF({ nascimento: maskDataBR(e.target.value) })} inputMode="numeric" placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /></div>
              <div><p className={LABEL}>Estado civil</p><input value={vista.estadoCivil ?? ''} onChange={(e) => setF({ estadoCivil: e.target.value })} className={`${INPUT} mt-1`} /></div>
              <div><p className={LABEL}>Telefone</p><input value={vista.telefone ?? ''} onChange={(e) => setF({ telefone: maskTelefoneBR(e.target.value) })} inputMode="tel" placeholder="+55 (44) 99185-6865" className={`${INPUT} mt-1`} /></div>
              <div><p className={LABEL}>Admissão</p><input value={vista.admissao ?? ''} onChange={(e) => setF({ admissao: maskDataBR(e.target.value) })} inputMode="numeric" placeholder="dd/mm/aaaa" className={`${INPUT} mt-1`} /></div>
              <div className="col-span-2"><p className={LABEL}>Endereço</p><input value={vista.endereco ?? ''} onChange={(e) => setF({ endereco: e.target.value })} className={`${INPUT} mt-1`} /></div>
              <div className="col-span-2">
                <p className={LABEL}>Contrato</p>
                <input list="rh-tipos-contrato-dossie" value={vista.contrato ?? ''} onChange={(e) => setF({ contrato: e.target.value })} className={`${INPUT} mt-1`} />
                <datalist id="rh-tipos-contrato-dossie">{TIPOS_CONTRATO.map((t) => <option key={t} value={t} />)}</datalist>
              </div>
            </div>
            <div><p className={LABEL}>Observações de RH</p><textarea value={vista.obs ?? ''} onChange={(e) => setF({ obs: e.target.value })} rows={2} className={`${INPUT} mt-1`} /></div>
            <p className="text-[10px] text-zinc-400">E-mail e papel no Hub continuam em <strong>Configurações › Membros</strong>.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <Linha Icon={IdCard} label="CPF" valor={ficha.cpf} />
              <Linha Icon={IdCard} label="RG" valor={ficha.rg} />
              <Linha Icon={CalendarDays} label="Nascimento" valor={ficha.nascimento} />
              <Linha Icon={IdCard} label="Estado civil" valor={ficha.estadoCivil} />
              <Linha Icon={Phone} label="Telefone" valor={ficha.telefone} />
              <Linha Icon={Mail} label="E-mail" valor={membro.user.email} />
              <Linha Icon={MapPin} label="Endereço" valor={ficha.endereco} />
              <Linha Icon={CalendarDays} label="Admissão" valor={ficha.admissao} />
              <Linha Icon={FileSignature} label="Contrato" valor={ficha.contrato} />
              {(info.atuacao?.length ?? 0) > 0 && <Linha Icon={Briefcase} label="Atuação" valor={(info.atuacao as string[]).join(', ')} />}
            </div>
            {ficha.obs && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white/70 p-2 text-sm text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300">{ficha.obs}</p>}
          </>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <p className={LABEL}>Documentos pessoais ({docsPessoais.length})</p>
          {canEdit && !editando && <button onClick={abrirEdicao} className="inline-flex items-center gap-1 text-xs font-semibold text-[#228BE6] hover:underline"><Plus className="h-3.5 w-3.5" /> juntar documento</button>}
        </div>
        {editando ? (
          <div className="mt-1">
            <ListaDocumentos docs={docsPessoais} onChange={(docs) => setF({ documentos: docs })} canEdit dica="Arraste os documentos pessoais ou clique para escolher" />
          </div>
        ) : (
          <div className="mt-1 space-y-1">
            {docsPessoais.length === 0 && <p className="text-xs text-zinc-400">Nenhum documento pessoal arquivado.</p>}
            {docsPessoais.map((doc) => (
              <DocLinha
                key={doc.id} doc={doc} corClass="hover:border-[#228BE6]" podeRemover={canEdit} busy={busy}
                confirmando={removendo?.escopo === 'pessoal' && removendo.id === doc.id}
                onPedir={() => setRemovendo({ escopo: 'pessoal', id: doc.id })}
                onCancelar={() => setRemovendo(null)}
                onRemover={() => removerDoc('pessoal', doc.id)}
              />
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className={LABEL}>Documentos da rescisão ({docsRescisao.length})</p>
          {canEdit && !editando && <button onClick={abrirEdicao} className="inline-flex items-center gap-1 text-xs font-semibold text-[#E64980] hover:underline"><Plus className="h-3.5 w-3.5" /> juntar documento</button>}
        </div>
        {editando ? (
          <div className="mt-1">
            <ListaDocumentos docs={docsRescisao} onChange={(docs) => setD({ documentos: docs })} canEdit dica="TRCT, distrato, termo de quitação — arraste ou clique para escolher" />
          </div>
        ) : (
          <div className="mt-1 space-y-1">
            {docsRescisao.length === 0 && <p className="text-xs text-zinc-400">Nenhum documento de rescisão anexado.</p>}
            {docsRescisao.map((doc) => (
              <DocLinha
                key={doc.id} doc={doc} corClass="hover:border-[#E64980]" podeRemover={canEdit} busy={busy}
                confirmando={removendo?.escopo === 'rescisao' && removendo.id === doc.id}
                onPedir={() => setRemovendo({ escopo: 'rescisao', id: doc.id })}
                onCancelar={() => setRemovendo(null)}
                onRemover={() => removerDoc('rescisao', doc.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <p className={`${LABEL} mb-1.5 flex items-center gap-1.5`}><History className="h-3.5 w-3.5" /> Linha do tempo na casa</p>
        <Timeline historico={vista.historico ?? []} />
      </div>
    </Modal>
  );
}
