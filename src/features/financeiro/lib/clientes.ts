import type { FinDashboard, FinTransacao } from '../services/financeiro.service';

// ── Helpers de data/mês ───────────────────────────────────────────────────────
export const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const isoOf = (br: string) => { const m = (br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
export const normNome = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Competência do escritório FECHA no dia 3 (vencimento da fatura): lançamento até o dia 3
// conta como o mês ANTERIOR. ESPELHA `mesFromBR` do backend (financeiro.service.ts) — se
// mudar um, mude o outro. Ex.: 03/08 → 2026-07 (julho); 04/08 → 2026-08.
export const DIA_FECHA_COMPETENCIA = 3;
export const competenciaBR = (br: string) => {
  const m = (br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return '';
  let dia = +m[1], mes = +m[2], ano = +m[3];
  if (dia <= DIA_FECHA_COMPETENCIA) { mes -= 1; if (mes < 1) { mes = 12; ano -= 1; } }
  return `${ano}-${String(mes).padStart(2, '0')}`;
};
/** Mês-competência de HOJE (respeita o fechamento no dia 3). */
export const mesAtualCompetencia = () => {
  const d = new Date();
  return competenciaBR(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
};
/** Mês (YYYY-MM) de um lançamento: deriva da data pela competência (dia 3); só cai no
 *  `mes` gravado se a data faltar/for inválida. */
export const mesKey = (t: Pick<FinTransacao, 'mes' | 'data'>) => {
  const k = competenciaBR(t.data || '');
  if (k) return k;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(t.mes || '') ? (t.mes as string) : '0000-00';
};
export const mesLabel = (mes: string) => { const m = (mes || '').match(/^(\d{4})-(\d{2})$/); return m && +m[2] >= 1 && +m[2] <= 12 ? `${MESES_PT[+m[2] - 1]} de ${m[1]}` : 'Sem data'; };
export const mesCurtoKey = (mes: string) => { const m = (mes || '').match(/^(\d{4})-(\d{2})$/); return m && +m[2] >= 1 && +m[2] <= 12 ? `${MESES_ABREV[+m[2] - 1]}/${m[1].slice(2)}` : mes; };
export const diffMeses = (a: string, b: string) => { // b - a, em meses
  const ma = (a || '').match(/^(\d{4})-(\d{2})$/); const mb = (b || '').match(/^(\d{4})-(\d{2})$/);
  if (!ma || !mb) return 0;
  return (+mb[1] - +ma[1]) * 12 + (+mb[2] - +ma[2]);
};

// ── Status comportamental do cliente (não há saldo de contrato no Astrea) ──────
export type StatusFin = 'em-dia' | 'atencao' | 'pontual' | 'inativo';
export const STATUS_FIN: Record<StatusFin, { label: string; cor: string; badge: string; dica: string }> = {
  'em-dia': { label: 'Em dia', cor: '#2F9E44', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300', dica: 'pagou neste mês ou no anterior' },
  'atencao': { label: 'Atenção', cor: '#F59F00', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300', dica: 'pagava todo mês e parou — vale uma cobrança' },
  'pontual': { label: 'Pontual', cor: '#228BE6', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300', dica: 'pagamento único (caso pontual), não recorrente' },
  'inativo': { label: 'Sem movimento', cor: '#868E96', badge: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400', dica: 'sem pagamentos recentes' },
};

export interface PagamentoFin { data: string; mes: string; valor: number }
export interface ClienteFin {
  nome: string;
  recebido: number;      // soma de honorários recebidos
  repassado: number;     // honorários repassados/estornados (saídas)
  liquido: number;       // recebido − repassado
  n: number;             // nº de pagamentos
  medio: number;         // recebido / n
  primeiro: string | null;
  ultimo: string | null;
  ultimoMes: string | null;
  mesesAtivos: number;   // meses distintos com pagamento
  recorrente: boolean;
  mesesParado: number;   // meses desde o último pagamento (vs mês atual)
  status: StatusFin;
  pagamentos: PagamentoFin[];
}

function statusDe(c: ClienteFin, mesAtual: string): StatusFin {
  const parado = c.ultimoMes ? Math.max(0, diffMeses(c.ultimoMes, mesAtual)) : 99;
  if (parado <= 1) return 'em-dia';
  if (c.recorrente && parado <= 5) return 'atencao';
  if (!c.recorrente && c.n <= 1) return 'pontual';
  return 'inativo';
}

/** Agrega os honorários (transações) por cliente, derivando histórico + status. */
export function aggregarClientes(data: FinDashboard | undefined | null): ClienteFin[] {
  if (!data?.transacoes?.length) return [];
  const mesAtual = data.mesAtual || mesKey(data.transacoes[0]);
  const map = new Map<string, ClienteFin>();
  for (const t of data.transacoes) {
    if (!/honor/i.test(t.categoria)) continue; // só honorários (receita ou repasse)
    const nome = (t.party || '').trim();
    if (!nome) continue;
    const key = normNome(nome);
    let c = map.get(key);
    if (!c) {
      c = { nome, recebido: 0, repassado: 0, liquido: 0, n: 0, medio: 0, primeiro: null, ultimo: null, ultimoMes: null, mesesAtivos: 0, recorrente: false, mesesParado: 0, status: 'inativo', pagamentos: [] };
      map.set(key, c);
    }
    // conta só honorários efetivamente recebidos (ignora 'a_receber'); repasses contam sempre
    if (t.valor >= 0) { if (!t.status || t.status === 'recebido') c.pagamentos.push({ data: t.data, mes: mesKey(t), valor: t.valor }); }
    else c.repassado += -t.valor;
  }
  const out = [...map.values()];
  for (const c of out) {
    c.pagamentos.sort((a, b) => isoOf(b.data).localeCompare(isoOf(a.data)));
    c.n = c.pagamentos.length;
    c.recebido = round(c.pagamentos.reduce((s, p) => s + p.valor, 0));
    c.repassado = round(c.repassado);
    c.liquido = round(c.recebido - c.repassado);
    c.medio = c.n ? round(c.recebido / c.n) : 0;
    c.ultimo = c.pagamentos[0]?.data ?? null;
    c.primeiro = c.pagamentos[c.pagamentos.length - 1]?.data ?? null;
    c.ultimoMes = c.pagamentos[0]?.mes ?? null;
    c.mesesAtivos = new Set(c.pagamentos.map((p) => p.mes)).size;
    c.recorrente = c.mesesAtivos >= 3;
    c.mesesParado = c.ultimoMes ? Math.max(0, diffMeses(c.ultimoMes, mesAtual)) : 99;
    c.status = statusDe(c, mesAtual);
  }
  return out.filter((c) => c.n > 0).sort((a, b) => b.recebido - a.recebido);
}

// ── Retiradas / Pró-labore por advogado ───────────────────────────────────────
export interface RetiradaUser { userId: string; nome: string; aReceber: number; retirado: number; saldo: number }
export interface RetiradasResumo { porUser: RetiradaUser[]; escritorio: number; totalHonorarios: number; totalRetirado: number; totalAdvogados: number }
// "repass" cobre "Honorários repassados" (o repasse do rateio) — igual ao holerite do backend.
const ehRetirada = (cat: string) => /pr[óo]\s*-?\s*labore|retirada|repass/i.test(cat || '');

/**
 * Rateio de honorários por advogado: a parte de cada sócio/associado (do split dos
 * honorários recebidos) × o que já foi retirado (despesas de Pró-labore/Retirada).
 */
export function aggregarRetiradas(data: FinDashboard | undefined | null, users: { id: string; name: string }[]): RetiradasResumo {
  const txs = data?.transacoes ?? [];
  const aReceber = new Map<string, number>();
  const retirado = new Map<string, number>();
  let escritorio = 0, totalHon = 0, totalRetirado = 0;
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  for (const t of txs) {
    // honorários recebidos → distribui pelo split
    if (/honor/i.test(t.categoria) && t.valor >= 0 && (!t.status || t.status === 'recebido')) {
      totalHon += t.valor;
      const split = t.split ?? [];
      if (!split.length) { escritorio += t.valor; continue; }
      let assigned = 0;
      for (const s of split) {
        const v = Number(s.valor) || 0; assigned += v;
        if (s.tipo === 'escritorio') escritorio += v;
        else { const k = s.userId || normNome(s.nome); aReceber.set(k, (aReceber.get(k) ?? 0) + v); }
      }
      if (t.valor - assigned > 0.01) escritorio += t.valor - assigned;
    }
    // retiradas/pró-labore pagas → por recebedor (advogado). Casamento robusto:
    // 1) responsavelId (repasse automático já grava); 2) nome exato; 3) recebedor
    // COMEÇA com o nome do advogado (ex.: "Matheus Frider Andrade Quebra de Caixa
    // PRÓLABORE" casa com "Matheus Frider Andrade") — senão a retirada some do "já retirou".
    if (t.valor < 0 && ehRetirada(t.categoria) && (!t.status || t.status === 'pago')) {
      const nome = normNome((t.recebedor || t.party || '').trim());
      const u = (t.responsavelId && users.find((x) => x.id === t.responsavelId))
        || users.find((x) => normNome(x.name) === nome)
        || users.find((x) => nome && normNome(x.name) && nome.startsWith(normNome(x.name)));
      const k = u ? u.id : nome;
      retirado.set(k, (retirado.get(k) ?? 0) - t.valor);
      totalRetirado += -t.valor;
    }
  }

  const porUser: RetiradaUser[] = users.map((u) => {
    const ar = round((aReceber.get(u.id) ?? 0) + (aReceber.get(normNome(u.name)) ?? 0));
    const rt = round((retirado.get(u.id) ?? 0) + (retirado.get(normNome(u.name)) ?? 0));
    return { userId: u.id, nome: u.name, aReceber: ar, retirado: rt, saldo: round(ar - rt) };
  }).sort((a, b) => (b.aReceber + b.retirado) - (a.aReceber + a.retirado));

  return { porUser, escritorio: round(escritorio), totalHonorarios: round(totalHon), totalRetirado: round(totalRetirado), totalAdvogados: users.length };
}

/** Resumo financeiro de um cliente específico (casa por nome normalizado). */
export function clienteFinanceiro(data: FinDashboard | undefined | null, nome: string): ClienteFin | null {
  if (!nome) return null;
  const alvo = normNome(nome);
  return aggregarClientes(data).find((c) => normNome(c.nome) === alvo) ?? null;
}
