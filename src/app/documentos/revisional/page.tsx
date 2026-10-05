'use client';

import { Suspense, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ApresentacaoVendasRevisional } from '@/features/calculadora-revisional/components/apresentacao-vendas-revisional';
import {
  MemoriaCalculoRevisional,
  ParecerInternoRevisional,
} from '@/features/calculadora-revisional/components/documentos-revisional';
import {
  PREFIXO_DOC,
  TITULOS_DOC,
  type PayloadDocumentoRevisional,
} from '@/features/calculadora-revisional/documento-payload';

/** ABA PRÓPRIA dos documentos da revisional. O payload vem por localStorage
 *  (ver `documento-payload.ts`); a URL carrega só a chave. */

export default function DocumentoRevisionalPage() {
  return (
    <Suspense fallback={<Aviso texto="Carregando…" />}>
      <Conteudo />
    </Suspense>
  );
}

function Conteudo() {
  const [payload, setPayload] = useState<PayloadDocumentoRevisional | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    try {
      const chave = new URLSearchParams(window.location.search).get('k');
      if (!chave) return setErro('Link sem referência do documento.');
      const bruto = localStorage.getItem(PREFIXO_DOC + chave);
      if (!bruto) return setErro('Documento não encontrado. Gere de novo pela calculadora.');
      setPayload(JSON.parse(bruto) as PayloadDocumentoRevisional);
    } catch {
      setErro('Não consegui ler o documento. Gere de novo pela calculadora.');
    }
  }, []);

  useEffect(() => {
    if (payload) document.title = `${TITULOS_DOC[payload.tipo]} — ${payload.nome || 'caso'}`;
  }, [payload]);

  if (erro) return <Aviso texto={erro} />;
  if (!payload) return <Aviso texto="Carregando…" />;

  if (payload.tipo === 'apresentacao') {
    if (!payload.dadosApresentacao) return <Aviso texto="Sem dados para a apresentação." />;
    return <ApresentacaoVendasRevisional dados={payload.dadosApresentacao} />;
  }
  if (payload.tipo === 'calculo') {
    return (
      <MemoriaCalculoRevisional
        res={payload.res} auditoria={payload.auditoria}
        extraido={payload.extraido} nome={payload.nome}
      />
    );
  }
  return (
    <ParecerInternoRevisional
      res={payload.res} auditoria={payload.auditoria} extraido={payload.extraido}
      irregs={payload.irregs} nome={payload.nome}
    />
  );
}


function Aviso({ texto }: { texto: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-8 dark:bg-zinc-950">
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-6 py-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        <AlertTriangle className="h-4 w-4 text-amber-500" /> {texto}
      </div>
    </div>
  );
}
