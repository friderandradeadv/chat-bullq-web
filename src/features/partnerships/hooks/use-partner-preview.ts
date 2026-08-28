'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PartnershipInfo } from '@/stores/auth-store';

const KEY = 'preview_partnership';
const KEY_DADOS = 'preview_partnership_data';

export type PreviewAlvo = Pick<
  PartnershipInfo,
  'id' | 'name' | 'slug' | 'color' | 'areas' | 'boards' | 'partnerPct'
>;

/** Lê o alvo da pré-visualização de forma síncrona (o shell precisa disso no 1º render). */
export function lerPreview(): PreviewAlvo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY_DADOS);
    return raw ? (JSON.parse(raw) as PreviewAlvo) : null;
  } catch {
    return null;
  }
}

/**
 * "Ver como parceiro" — o sócio assume o recorte de uma parceria e passa a
 * receber do servidor exatamente o que o parceiro receberia.
 *
 * Divisão de responsabilidade, e ela importa: o **servidor** corta os dados (o
 * cabeçalho `x-preview-partnership`, honrado no OrgGuard); o localStorage só
 * guarda nome e cor para desenhar a casca. Se fosse o contrário — front
 * fingindo o recorte — a tela mostraria a inbox inteira com a casca do parceiro
 * e diria que está tudo certo. Pré-visualização que mente é pior que nenhuma.
 *
 * Entrar e sair recarregam a página de propósito: o cache do React Query está
 * cheio de respostas do escopo anterior, e misturá-las é exatamente como a
 * pré-visualização passaria a mentir.
 */
export function usePartnerPreview() {
  const [alvo, setAlvo] = useState<PreviewAlvo | null>(null);

  useEffect(() => {
    setAlvo(lerPreview());
  }, []);

  const entrar = useCallback((p: PreviewAlvo) => {
    try {
      localStorage.setItem(KEY, p.id);
      localStorage.setItem(KEY_DADOS, JSON.stringify(p));
      window.location.href = '/parceria';
    } catch {
      // Storage bloqueado: sem pré-visualização, e tudo bem — ela é uma
      // conveniência, não parte da trava.
    }
  }, []);

  const sair = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(KEY_DADOS);
      window.location.href = '/settings/parcerias';
    } catch {
      /* idem */
    }
  }, []);

  return { alvo, entrar, sair };
}
