import type { KanbanCard } from '@/features/legal-cases/services/legal-cases.service';

// Sem acento/minúsculo — "José" bate com "jose" (antes só .toLowerCase(), que não
// mexe em diacríticos e fazia a busca "não achar" cliente com nome acentuado).
export const normSearch = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const onlyDigits = (s: string) => s.replace(/\D/g, '');

/**
 * Busca de card do Kanban: nome/CNJ/título sem acento + CPF/CNPJ do cliente (só
 * dígitos, 4+ pra não confundir com CNJ/título parcial). `fields` são os textos
 * do card a incluir na busca por nome (ex.: título, cliente, réu, CNJ).
 */
export function matchesKanbanSearch(card: KanbanCard, query: string, fields: (string | null | undefined)[]): boolean {
  const qRaw = query.trim();
  if (!qRaw) return true;
  const q = normSearch(qRaw);
  const qDigits = onlyDigits(qRaw);
  const hay = normSearch(fields.filter(Boolean).join(' '));
  if (hay.includes(q)) return true;
  return qDigits.length >= 4 && !!card.clientDocument?.includes(qDigits);
}
