// Máscaras de input pt-BR: o usuário digita só números e o campo sai formatado.
// Moeda é guardada no formato "1.234,56" (com vírgula) — que é exatamente o que o
// backend (brlNum) e o resto do app já parseiam, então não quebra nenhum cálculo.

/** Digita só dígitos → "1.234,56" (trata a entrada como centavos). '' quando vazio. */
export function maskCurrencyBR(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  if (!Number.isFinite(cents)) return '';
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1.234,56" / "R$ 1.234,56" / "1234.56" → 1234.56 (mesma lógica do backend brlNum). null se vazio. */
export function parseCurrencyBR(s: string | number | null | undefined): number | null {
  if (s == null || s === '') return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  let t = String(s).replace(/[^\d,.-]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Número/serializado do backend → "1.234,56" para popular o input ao editar. '' quando vazio. */
export function currencyToInput(n: number | string | null | undefined): string {
  const num = parseCurrencyBR(n as any);
  if (num == null) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Digita só dígitos → CPF (000.000.000-00) até 11; CNPJ (00.000.000/0000-00) acima. */
export function maskCpfCnpj(raw: string): string {
  const d = (raw ?? '').replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, '$1/$2')
    .replace(/^(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, '$1-$2');
}

/** Digita só dígitos → CPF (000.000.000-00), no máx. 11 dígitos. */
export function maskCpf(raw: string): string {
  const d = (raw ?? '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2');
}

/** Digita só dígitos → data dd/mm/aaaa (barras entram sozinhas). '' quando vazio. */
export function maskDataBR(raw: string): string {
  const d = (raw ?? '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/**
 * Telefone pt-BR com país + DDD + número, montado conforme se digita:
 * "44991856865" → "+55 (44) 99185-6865". Assume Brasil (+55) por padrão;
 * se o usuário digitar o código do país (12–13 dígitos, começando com 55),
 * separa o país sozinho. Celular sai 5-4, fixo sai 4-4.
 */
export function maskTelefoneBR(raw: string): string {
  let d = (raw ?? '').replace(/\D/g, '');
  if (!d) return '';
  let country = '55';
  if (d.length > 11) {
    if (d.startsWith('55')) d = d.slice(2);
    else { country = d.slice(0, d.length - 11); d = d.slice(-11); }
  }
  d = d.slice(0, 11);
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  let out = `+${country}`;
  if (ddd) out += ` (${ddd}${ddd.length === 2 ? ')' : ''}`;
  if (rest) {
    if (rest.length <= 4) out += ` ${rest}`;
    else if (rest.length <= 8) out += ` ${rest.slice(0, 4)}-${rest.slice(4)}`;
    else out += ` ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return out;
}
