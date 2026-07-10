// Diretório de bancos réus do REPB — nome + escritório de contato (cobrança/
// jurídico) + telefone/e-mail. Fonte: "LISTA DE CONTATO DOS BANCOS" (Andressa).
// Usado no autocomplete dos Bancos réus e para mostrar quem contatar na negociação.
// Alguns contatos vieram truncados no material — campos incompletos ficam vazios.

export interface BancoContato {
  nome: string;
  escritorio?: string;
  telefone?: string;
  email?: string;
}

export const BANCOS_DIRETORIO: BancoContato[] = [
  { nome: 'Banco Honda S/A', escritorio: 'Leão Mattos', telefone: '(85) 3052-3000 / (81) 3467-4666', email: 'CESEC@CESEC.COM.BR' },
  { nome: 'Banco Yamaha Motor do Brasil S.A.', escritorio: 'Lee Brock Camargo', telefone: '(11) 2149-5400', email: 'publica@lbca.com.br' },
  { nome: 'Lendico Serviços', escritorio: 'Gasparini, Nogueira de Lima e Barbosa', telefone: '(11) 2171-1300' },
  { nome: 'Banco Bradesco S.A.', escritorio: 'Pessoa e Pessoa / Garcia Perez / Melhado Adv.', telefone: '(11) 2344-1919 / (11) 2619-8015', email: 'garciaperez@perezadvocacia.com.br' },
  { nome: 'FIDIC NPL II', escritorio: 'Tortoro, Madureira, Ragazzi', telefone: '(11) 3018-4848 / (16) 3975-9100' },
  { nome: 'Motoparts', escritorio: 'Alvim Coelho', telefone: '(11) 3030-3333' },
  { nome: 'Banco Original S.A.', escritorio: 'Vigna', telefone: '(11) 3133-8000', email: 'contato@vigna.adv.br' },
  { nome: 'Banco Volkswagen S.A.', escritorio: 'Hernandes Blanco / Queiroz Cavalcanti / Perez', telefone: '(11) 3323-5113 / 0800 700 6116', email: 'bancovolks@qca.adv.br' },
  { nome: 'Creditas', escritorio: 'Vezzi, Lopalla, Mesquita', telefone: '(11) 3514-7200', email: 'processo@vlm.adv.br' },
  { nome: 'Banco do Brasil', escritorio: 'JBM Law / Avallone Advogados / Viana Peixoto', telefone: '(11) 3201-9950 / (14) 3235-0800', email: 'contato@janzon.com.br' },
  { nome: 'Banco J. Safra S.A.', escritorio: 'JBM Law / NPAA / Bruno Vanderlei', telefone: '(11) 3201-9950 / (14) 3235-0800', email: 'contato@brunovanderlei.adv.br' },
  { nome: 'Banco Votorantim S.A.', escritorio: 'Urbano Vitalino / Grupo Pasquali / Toledo Piza', telefone: '(14) 98130-3252 / (81) 3797-4455', email: 'juridico@ppgj.com.br' },
  { nome: 'Banco Itaucard S.A.', escritorio: 'JCS Junior / ABVM', telefone: '(41) 3219-3974 / (81) 2127-6500' },
  { nome: 'Caixa Econômica Federal', escritorio: 'Abdalla e Abdalla', telefone: '(41) 3352-9642', email: 'contato@abda.adv.br' },
  { nome: 'Banco Santander', escritorio: 'Castaldello / Viana Peixoto / Drumond, Gadêlha', telefone: '(54) 3209-6000 / (81) 3465-4343', email: 'apoiocobranca@apoiocobranca.com.br' },
  { nome: 'Aymoré', escritorio: 'Nelson Williams / Rafael PorDeus', telefone: '(67) 3056-8050 / (85) 3268-2323', email: 'advocacia@rafaelpordeus.com.br' },
  { nome: 'Itaú Unibanco', escritorio: 'Freire, Gerbasi, Bittencourt / ABVM', telefone: '(71) 3038-0650 / (81) 2127-6500', email: 'contato@freiregerbasi.adv.br' },
  { nome: 'Unicred Recife', escritorio: 'Rangel Moreira', telefone: '(81) 3325-5133', email: 'advocacia@rangelmoreira.adv.br' },
  { nome: 'Sicoob Consórcios', escritorio: 'Tattini Advogados', telefone: '(81) 3508-3060', email: 'intimacoes@tattiniadvogados.com.br' },
  { nome: 'Portoseg', escritorio: 'Queiroz Cavalcanti', email: 'camilamoraes@queirozcavalcanti.adv.br' },
  { nome: 'BMW Financeira', escritorio: 'Meira Breseghello', telefone: '(11) 5506-3374' },
  { nome: 'Consórcio Renault', escritorio: 'ML Gomes', telefone: '(11) 3188-9400', email: 'intimacoes@mlgomes.com.br' },
  { nome: 'Banco PAN', escritorio: 'Schulze', telefone: '(47) 3026-6161', email: 'juridico@schulze.com.br' },
  { nome: 'BV Financeira', escritorio: 'Didier, Sodré e Rosa', telefone: '(71) 99127-4671', email: 'ssa@dsr.adv.br' },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+|s\.?a\.?|banco|financeira|s\/a/g, '').trim();

/** Acha o contato do banco pelo nome digitado (match tolerante). */
export function acharBancoContato(nome: string): BancoContato | undefined {
  const n = norm(nome || '');
  if (!n || n.length < 3) return undefined;
  return BANCOS_DIRETORIO.find((b) => { const bn = norm(b.nome); return bn.includes(n) || n.includes(bn); });
}
