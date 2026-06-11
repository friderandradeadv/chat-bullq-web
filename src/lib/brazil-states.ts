// ─── Brazilian states from phone DDD (area code) ─────────────────────────────
//
// Telefones chegam em dois formatos no banco:
//   '5522981653877'        (cru, só dígitos)
//   '+55 11 98149-6844'    (com + e separadores)
// Normalizamos para só dígitos e, quando o número é BR (DDI 55), extraímos o
// DDD (2 dígitos após o 55) e mapeamos para a UF.

export interface BrazilState {
  uf: string;
  name: string;
}

// DDD → UF. Fonte: Plano Nacional de Numeração (Anatel).
const DDD_TO_UF: Record<string, string> = {
  // Sudeste
  '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP',
  '16': 'SP', '17': 'SP', '18': 'SP', '19': 'SP',
  '21': 'RJ', '22': 'RJ', '24': 'RJ',
  '27': 'ES', '28': 'ES',
  '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG',
  '35': 'MG', '37': 'MG', '38': 'MG',
  // Sul
  '41': 'PR', '42': 'PR', '43': 'PR', '44': 'PR', '45': 'PR', '46': 'PR',
  '47': 'SC', '48': 'SC', '49': 'SC',
  '51': 'RS', '53': 'RS', '54': 'RS', '55': 'RS',
  // Centro-Oeste
  '61': 'DF',
  '62': 'GO', '64': 'GO',
  '63': 'TO',
  '65': 'MT', '66': 'MT',
  '67': 'MS',
  // Norte
  '68': 'AC',
  '69': 'RO',
  '91': 'PA', '93': 'PA', '94': 'PA',
  '92': 'AM', '97': 'AM',
  '95': 'RR',
  '96': 'AP',
  '98': 'MA', '99': 'MA',
  // Nordeste
  '71': 'BA', '73': 'BA', '74': 'BA', '75': 'BA', '77': 'BA',
  '79': 'SE',
  '81': 'PE', '87': 'PE',
  '82': 'AL',
  '83': 'PB',
  '84': 'RN',
  '85': 'CE', '88': 'CE',
  '86': 'PI', '89': 'PI',
};

const UF_TO_NAME: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
};

/** Só os dígitos do telefone. */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** É um número brasileiro (DDI 55 + 10 ou 11 dígitos)? */
export function isBrazilPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const d = digitsOnly(phone);
  // 55 + DDD(2) + assinante(8 ou 9) = 12 ou 13 dígitos
  return d.startsWith('55') && (d.length === 12 || d.length === 13);
}

/**
 * Extrai o estado (UF + nome) a partir do DDD de um telefone brasileiro.
 * Retorna null se não for BR ou se o DDD não mapear para uma UF conhecida.
 */
export function getBrazilState(phone: string | null | undefined): BrazilState | null {
  if (!phone) return null;
  const d = digitsOnly(phone);
  let ddd: string | null = null;

  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    ddd = d.slice(2, 4);
  } else if (d.length === 10 || d.length === 11) {
    // número sem DDI mas com DDD (fallback)
    ddd = d.slice(0, 2);
  }

  if (!ddd) return null;
  const uf = DDD_TO_UF[ddd];
  if (!uf) return null;
  return { uf, name: UF_TO_NAME[uf] ?? uf };
}

/**
 * Formata um telefone para exibição. BR vira `+55 (DD) XXXXX-XXXX`
 * (celular 9 dígitos) ou `+55 (DD) XXXX-XXXX` (fixo 8 dígitos).
 * Números não-BR são retornados sem alteração.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const d = digitsOnly(phone);
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    if (rest.length === 8) {
      return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }
  // já formatado ou não-BR: devolve original
  return phone;
}

/**
 * Bandeira (emoji) do país a partir do DDI. Mantido aqui para centralizar a
 * lógica de telefone. Estados brasileiros não têm emoji — usamos 🇧🇷 + UF.
 */
export function getCountryFlag(phone: string | null | undefined): string {
  if (!phone) return '🌍';
  const p = phone.replace(/\s/g, '');
  const d = digitsOnly(phone);
  if (p.startsWith('+55') || (d.startsWith('55') && (d.length === 12 || d.length === 13))) return '🇧🇷';
  if (p.startsWith('+1')) return '🇺🇸';
  if (p.startsWith('+351')) return '🇵🇹';
  if (p.startsWith('+54')) return '🇦🇷';
  if (p.startsWith('+57')) return '🇨🇴';
  if (p.startsWith('+598')) return '🇺🇾';
  if (p.startsWith('+595')) return '🇵🇾';
  if (p.startsWith('+591')) return '🇧🇴';
  if (p.startsWith('+56')) return '🇨🇱';
  if (p.startsWith('+51')) return '🇵🇪';
  if (p.startsWith('+49')) return '🇩🇪';
  if (p.startsWith('+44')) return '🇬🇧';
  if (p.startsWith('+33')) return '🇫🇷';
  if (p.startsWith('+34')) return '🇪🇸';
  if (p.startsWith('+39')) return '🇮🇹';
  return '🌍';
}
