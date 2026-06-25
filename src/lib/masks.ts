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
