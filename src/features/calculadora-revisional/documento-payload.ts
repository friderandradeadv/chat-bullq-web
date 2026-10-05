import type { DadosApresentacaoRevisional } from '@/features/calculadora-revisional/components/apresentacao-vendas-revisional';
import type {
  AuditoriaContrato,
  ExtracaoContrato,
  IrregularidadeContrato,
  ResultadoRevisional,
} from '@/features/calculadora-revisional/services/calculadora-revisional.service';

/**
 * Contrato entre a calculadora e a ABA do documento.
 *
 * 🚨 O payload viaja por localStorage, NÃO pela URL: o cálculo tem dezenas de
 * linhas e os dados são do cliente — na query string isso ficaria no histórico
 * do navegador e em qualquer log de proxy. A aba recebe só a chave.
 * `sessionStorage` não serve: é por aba, e a aba nova não veria o que a
 * calculadora gravou.
 */
export const PREFIXO_DOC = 'revisional-doc:';

export interface PayloadDocumentoRevisional {
  tipo: 'calculo' | 'apresentacao' | 'parecer';
  nome: string;
  res: ResultadoRevisional;
  auditoria: AuditoriaContrato | null;
  extraido: ExtracaoContrato | null;
  irregs: IrregularidadeContrato[];
  dadosApresentacao: DadosApresentacaoRevisional | null;
}

export const TITULOS_DOC: Record<PayloadDocumentoRevisional['tipo'], string> = {
  calculo: 'Memória de cálculo',
  apresentacao: 'Apresentação ao cliente',
  parecer: 'Parecer interno',
};
