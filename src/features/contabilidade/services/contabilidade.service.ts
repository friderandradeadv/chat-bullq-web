import { api } from '@/lib/api';
import { apurar, calcularInssProlabore, TETO_INSS_2026, type AnexoId } from '../lib/simples';

// Espelha os tipos do backend (chat-bullq-api/src/modules/contabilidade).
export interface EmpresaContabil {
  razaoSocial: string; cnpj: string; inscricaoMunicipal?: string;
  regime: string; anexo: AnexoId; cnae?: string; itemServico?: string;
  municipioISS?: string; aliquotaISS?: number; socio?: string; proLabore: number;
}
export type GuiaStatus = 'PAGO' | 'CALCULANDO' | 'A_PAGAR' | 'EM_ATRASO' | 'ERRO_PROCESSAR_GUIA';

export interface CompetenciaInput {
  comp: string;            // YYYY-MM
  receita: number;
  rbt12?: number;
  proLabore?: number;
  notas?: { numero: string; valorServico: number; anexo?: number; situacao?: string }[];
  guias?: { tipo: string; valor: number; status: GuiaStatus; vencimento?: string }[];
  declaracoes?: { tipo: 'PGDAS' | 'DCTFWEB' | 'DEFIS'; situacao: string }[];
}

// Competência já apurada (com DAS e INSS derivados pelo motor no backend).
export interface CompetenciaApurada extends CompetenciaInput {
  das: {
    faixa: number; aliquotaNominal: number; parcelaDeduzir: number; aliquotaEfetiva: number; das: number;
    tributos: { codigo: string; nome: string; valor: number }[];
  } | null;
  inss: {
    base: number; segurado: number; patronal: number; total: number;
    itens: { codigo: string; nome: string; aliquota: number; valor: number }[];
  } | null;
  totalMes: number;
}

export interface DocumentoContabil {
  id: string; comp: string; tipo: string; nome: string;
  url: string; mime: string; size: number; uploadedAt: string;
  valor?: number | null; pagoEm?: string | null;
}

export interface PainelContabil {
  empresa: EmpresaContabil;
  competencias: CompetenciaApurada[];
  documentos?: DocumentoContabil[];
  resumo: { meses: number; totalRecolhido: number; tetoInss: number };
}

export const contabilidadeService = {
  async painel(): Promise<PainelContabil> {
    const { data } = await api.get('/contabilidade/painel');
    return data;
  },
  async setEmpresa(dto: Partial<EmpresaContabil>): Promise<EmpresaContabil> {
    const { data } = await api.patch('/contabilidade/empresa', dto);
    return data;
  },
  async upsertCompetencia(dto: CompetenciaInput): Promise<PainelContabil> {
    const { data } = await api.post('/contabilidade/competencias', dto);
    return data;
  },
  async removeCompetencia(comp: string): Promise<PainelContabil> {
    const { data } = await api.delete(`/contabilidade/competencias/${comp}`);
    return data;
  },
  async importar(payload: { empresa?: Partial<EmpresaContabil>; competencias?: CompetenciaInput[] }, commit: boolean) {
    const { data } = await api.post('/contabilidade/importar', { ...payload, commit });
    return data;
  },
  async listDocumentos(): Promise<DocumentoContabil[]> {
    const { data } = await api.get('/contabilidade/documentos');
    return data;
  },
  async addDocumento(dto: { comp: string; tipo: string; nome: string; mime: string; base64: string; valor?: number | null; pagoEm?: string | null }): Promise<DocumentoContabil> {
    const { data } = await api.post('/contabilidade/documentos', dto);
    return data;
  },
  async removeDocumento(id: string): Promise<DocumentoContabil[]> {
    const { data } = await api.delete(`/contabilidade/documentos/${id}`);
    return data;
  },
};

// Deriva o painel LOCALMENTE (mesmo cálculo do backend) — usado como fallback
// enquanto a API não está deployada/populada, ou para o painel funcionar offline.
export function derivarPainelLocal(
  empresa: EmpresaContabil,
  competencias: CompetenciaInput[],
): PainelContabil {
  const comps = competencias.slice().sort((a, b) => a.comp.localeCompare(b.comp));
  const rbt12 = (comp: string) => {
    const [y, m] = comp.split('-').map(Number);
    const fim = y * 12 + (m - 1);
    return comps
      .filter((c) => { const [cy, cm] = c.comp.split('-').map(Number); const k = cy * 12 + (cm - 1); return k < fim && k >= fim - 12; })
      .reduce((s, c) => s + (c.receita || 0), 0);
  };
  const apuradas: CompetenciaApurada[] = comps.map((c) => {
    const base = c.rbt12 ?? (rbt12(c.comp) || c.receita);
    const proLabore = c.proLabore ?? empresa.proLabore;
    const das = c.receita > 0 ? apurar({ receitaMes: c.receita, rbt12: base, anexo: empresa.anexo }) : null;
    const inss = proLabore > 0 ? calcularInssProlabore(proLabore) : null;
    const dasVM = das
      ? { faixa: das.faixa, aliquotaNominal: das.aliquotaNominal, parcelaDeduzir: das.parcelaDeduzir, aliquotaEfetiva: das.aliquotaEfetiva, das: das.das, tributos: das.tributos }
      : null;
    return { ...c, rbt12: base, proLabore, das: dasVM, inss, totalMes: (das?.das ?? 0) + (inss?.total ?? 0) };
  });
  return {
    empresa,
    competencias: apuradas,
    resumo: { meses: apuradas.length, totalRecolhido: apuradas.reduce((s, c) => s + c.totalMes, 0), tetoInss: TETO_INSS_2026 },
  };
}
