'use client';

import Link from 'next/link';
import { WhatsAppIcon } from '@/components/ui/icons';

/** Como o contato foi achado. Só 'contato' e 'cpf' são vínculo confirmado. */
export type VinculoConversa = 'contato' | 'cpf' | 'nome' | 'ambiguo';

export interface ConversaDoCliente {
  contactId: string | null;
  nome: string | null;
  phone: string | null;
  conversationId: string | null;
  vinculo: VinculoConversa;
  /** Preenchido só quando `vinculo === 'ambiguo'`: os homônimos da base. */
  candidatos: {
    contactId: string;
    nome: string | null;
    phone: string | null;
    conversationId: string | null;
  }[];
}

export const href = (conversationId: string) => `/inbox?conversationId=${conversationId}`;

/** Telefone formatado, quando o contato tem um — é o que identifica com quem se fala. */
function fone(phone: string | null | undefined) {
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length < 10) return phone ?? '';
  const c = d.startsWith('55') ? d.slice(2) : d;
  const ddd = c.slice(0, 2);
  const n = c.slice(2);
  return `(${ddd}) ${n.slice(0, n.length - 4)}-${n.slice(-4)}`;
}

/**
 * Atalho "Abrir conversa". Duas formas do MESMO botão, pra caber tanto num
 * cartão quanto ao lado do nome no cabeçalho:
 *   - `botao`: verde, com rótulo (destaque de cartão);
 *   - `icone`: só o ícone do WhatsApp (linha de metadados, lista).
 *
 * O aviso de vínculo FRACO ('nome') fica no title: quando o contato foi achado
 * só pelo nome, quem clica precisa saber que pode haver homônimo — a base tem
 * 31 "Maria de Fátima" com 31 telefones. Sem conversationId não renderiza nada:
 * botão que não leva a lugar nenhum é pior que ausência de botão.
 */
export function AbrirConversa({
  conversationId,
  phone,
  vinculo = 'contato',
  variant = 'botao',
  label = 'Abrir conversa',
  className = '',
}: {
  conversationId: string | null | undefined;
  phone?: string | null;
  vinculo?: VinculoConversa;
  variant?: 'botao' | 'icone';
  label?: string;
  className?: string;
}) {
  if (!conversationId) return null;

  const fraco = vinculo === 'nome';
  const quem = phone ? ` · ${fone(phone)}` : '';
  const title = fraco
    ? `Abrir conversa${quem} — contato achado só pelo NOME; confira se é a pessoa certa`
    : `Abrir conversa${quem}`;

  if (variant === 'icone') {
    return (
      <Link
        href={href(conversationId)}
        title={title}
        aria-label={title}
        className={`inline-grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-[#25D366]/10 hover:text-[#25D366] ${className}`}
      >
        <WhatsAppIcon className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <Link
      href={href(conversationId)}
      title={title}
      className={`inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 ${className}`}
    >
      <WhatsAppIcon className="h-3.5 w-3.5" />
      {label}
      {fraco && <span className="opacity-80" title="vínculo fraco: só o nome bateu">·&nbsp;?</span>}
    </Link>
  );
}

/**
 * Bloco do atalho com o que a ficha do processo sabe sobre o cliente. Cobre os
 * 3 estados reais: conversa achada, homônimos (o advogado escolhe) e nada.
 */
export function ConversaDoClienteBloco({
  conversa,
  vazio = 'Sem conversa vinculada.',
}: {
  conversa: ConversaDoCliente | null | undefined;
  vazio?: string;
}) {
  if (!conversa) return <p className="text-xs text-zinc-400">{vazio}</p>;

  if (conversa.vinculo === 'ambiguo') {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-amber-600 dark:text-amber-500">
          {conversa.candidatos.length} contatos com esse nome — escolha de quem é a conversa:
        </p>
        <ul className="space-y-1">
          {conversa.candidatos.map((c) => (
            <li key={c.contactId} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="truncate">{c.nome ?? '—'}</span>
              <span className="shrink-0 text-zinc-400">{fone(c.phone)}</span>
              <AbrirConversa conversationId={c.conversationId} phone={c.phone} vinculo="nome" variant="icone" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!conversa.conversationId) {
    return <p className="text-xs text-zinc-400">{vazio}</p>;
  }

  return (
    <div className="space-y-1">
      <AbrirConversa
        conversationId={conversa.conversationId}
        phone={conversa.phone}
        vinculo={conversa.vinculo}
      />
      {conversa.vinculo === 'nome' && (
        <p className="text-[11px] text-amber-600 dark:text-amber-500">
          Contato achado pelo nome (sem vínculo no cadastro) — confira o número antes de escrever.
        </p>
      )}
    </div>
  );
}
