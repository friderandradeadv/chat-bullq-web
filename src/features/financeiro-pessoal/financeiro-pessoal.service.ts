import { api } from '@/lib/api';

export type BillKind = 'conta' | 'cartao';
export type BillStatus = 'paga' | 'a_vencer' | 'vence_hoje' | 'atrasada';

export interface PersonalBill {
  id: string;
  name: string;
  kind: BillKind;
  category: string | null;
  amountCents: number | null;
  recurring: boolean;
  dueDay: number | null;
  closingDay: number | null;
  dueDate: string | null;
  remindDaysBefore: number;
  notes: string | null;
}

export interface BillMonthItem {
  billId: string;
  name: string;
  kind: BillKind;
  category: string | null;
  recurring: boolean;
  notes: string | null;
  vencimento: string;
  fechamento: string | null;
  amountCents: number | null;
  valorDoMes: boolean;
  paidAt: string | null;
  status: BillStatus;
}

export interface BillMonth {
  competencia: string;
  hoje: string;
  items: BillMonthItem[];
  totais: { total: number; pago: number; aPagar: number; atrasado: number; semValor: number };
}

export type BillInput = Omit<PersonalBill, 'id'>;

const un = <T,>(data: any): T => (data?.data ?? data) as T;

export const financeiroPessoalService = {
  async month(competencia: string): Promise<BillMonth> {
    const { data } = await api.get('/financeiro-pessoal/mes', { params: { competencia } });
    return un(data);
  },
  async list(): Promise<PersonalBill[]> {
    const { data } = await api.get('/financeiro-pessoal/contas');
    return un(data);
  },
  async create(input: BillInput): Promise<PersonalBill> {
    const { data } = await api.post('/financeiro-pessoal/contas', input);
    return un(data);
  },
  async update(id: string, input: Partial<BillInput>): Promise<PersonalBill> {
    const { data } = await api.patch(`/financeiro-pessoal/contas/${id}`, input);
    return un(data);
  },
  async archive(id: string): Promise<void> {
    await api.delete(`/financeiro-pessoal/contas/${id}`);
  },
  /** Sem competência: o servidor paga a ocorrência em aberto mais antiga. */
  async updateMonth(id: string, body: { competencia?: string; paid?: boolean; amountCents?: number | null }) {
    const { data } = await api.patch(`/financeiro-pessoal/contas/${id}/mes`, body);
    return un(data);
  },
};
