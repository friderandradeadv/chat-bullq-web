'use client';

import { Landmark, FileSearch, ListChecks, Wallet } from 'lucide-react';

// Fase Bancária Investigativa — etapa pré-judicial de investigação bancária
// (RMC/RCC × bancos). Ainda não há dados no BullQ: os cards vivem no pipe 02
// "PRÉ-JUDICIAL" do Pipefy e serão importados pra cá. Placeholder honesto até lá.
const ITENS = [
  { icon: Wallet, titulo: 'Extrato de consignações (INSS)', desc: 'Sobe o PDF do extrato → IA extrai cada contrato (banco · RMC/RCC · valor · parcela).' },
  { icon: ListChecks, titulo: 'Contratos a impugnar', desc: 'Lista banco a banco; cada linha vira uma futura ação (RMC/RCC contra o banco).' },
  { icon: FileSearch, titulo: 'Protocolos de investigação', desc: 'Acompanhamento de BACEN / consumidor.gov e da coleta de documentos.' },
];

export default function FaseBancariaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#228BE6]/10 text-[#228BE6]">
          <Landmark className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Fase Bancária Investigativa</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Investigação pré-judicial: descobrir quais ações (RMC/RCC) cabem e contra quais bancos.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        Etapa em montagem — os cards desta fase ainda estão no pipe <strong>02. Pré-Judicial</strong> do Pipefy e serão importados pra cá. Abaixo, o que ela vai concentrar.
      </div>

      <div className="mt-6 grid gap-3">
        {ITENS.map((it) => (
          <div key={it.titulo} className="flex items-start gap-3 rounded-2xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <it.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{it.titulo}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
