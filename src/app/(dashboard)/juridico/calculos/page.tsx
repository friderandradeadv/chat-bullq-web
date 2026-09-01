'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  Briefcase,
  Calculator,
  FileSearch,
  Gavel,
  Landmark,
  ListChecks,
  Percent,
  Scale,
  ShieldCheck,
  Sigma,
  Wrench,
} from 'lucide-react';

type Calc = {
  href: string;
  titulo: string;
  descricao: string;
  icon: React.ComponentType<{ className?: string }>;
  disponivel: boolean;
};

const CALCULADORAS: Calc[] = [
  {
    href: '/juridico/calculos/hiscon',
    titulo: 'Análise de HISCON',
    descricao:
      'Lê o HISCON pela geometria do PDF e responde quantas ações o caso comporta, contra quem e quais não valem a pena: réus por grupo econômico, gates do escritório e restituição do consignado comum corrigida pelo INPC. Gera o laudo e a memória de cálculo.',
    icon: FileSearch,
    disponivel: true,
  },
  {
    href: '/juridico/calculos/rmc-rcc',
    titulo: 'Revisão de RMC / RCC',
    descricao:
      'Conversão em empréstimo + restituição em dobro (CDC 42) com correção monetária. Taxa do BACEN e validado contra cálculos reais.',
    icon: Landmark,
    disponivel: true,
  },
  {
    href: '/juridico/calculos/cumprimento-sentenca',
    titulo: 'Cumprimento de Sentença',
    descricao:
      'Atualização da condenação: correção + juros de mora + multa e honorários do art. 523 (CPC). Importe a sentença/inicial e a IA preenche o cálculo.',
    icon: Gavel,
    disponivel: true,
  },
  {
    href: '/juridico/calculos/trabalhista',
    titulo: 'Rescisão Trabalhista',
    descricao:
      'Motor único, 3 saídas: calculadora de verbas por modalidade (com comparativo da conversão), planilha analítica em PDF (anexo de inicial, padrão pericial) e confronto de TRCT. Importa TRCT/holerite/extrato FGTS por IA.',
    icon: Briefcase,
    disponivel: true,
  },
  {
    href: '/juridico/calculos/provisionamento',
    titulo: 'Provisionamento Bancário (REPB)',
    descricao:
      'Estima quanto o banco já provisionou a dívida (Res. CMN 4.966/21, por atraso × carteira) e sugere a proposta de acordo. Linkado aos cards do REPB.',
    icon: Banknote,
    disponivel: true,
  },
  {
    href: '/juridico/calculos/revisional',
    titulo: 'Revisional de Juros',
    descricao:
      'Acha a taxa real do contrato (empréstimo, consignado, financiamento, capital de giro, cartão) e compara com a taxa média do BACEN na época. Monta a planilha de restituição.',
    icon: Percent,
    disponivel: true,
  },
  {
    href: '/juridico/calculos/superendividamento',
    titulo: 'Superendividamento (mínimo existencial)',
    descricao:
      'Análise segmentada da renda (Lei 14.181/21): renda líquida, comprometimento, renda livre e capacidade para o plano de pagamento. Triagem do superendividamento.',
    icon: Scale,
    disponivel: true,
  },
  {
    href: '/juridico/calculos/base-juridica',
    titulo: 'Base jurídica do REPB',
    descricao:
      'A fonte versionada de tudo que é lei no módulo: tabelas de provisão (Res. 352), estágios, prazos, mínimo existencial e todas as súmulas/temas — com status validado e a nuance de cada uma.',
    icon: ShieldCheck,
    disponivel: true,
  },
  {
    href: '/juridico/calculos/plano-repactuacao',
    titulo: 'Plano de repactuação (superendividamento)',
    descricao:
      'Gera o plano de pagamento do art. 104-A/B: distribui os 35% da renda entre os credores, readequa a cada dívida quitada e checa a viabilidade nos 60 meses. Método do PLANO da mentoria.',
    icon: ListChecks,
    disponivel: true,
  },
  {
    href: '/juridico/calculos/perda-esperada',
    titulo: 'Perda Esperada (PE) — bancões S1–S3',
    descricao:
      'PE = PD × LGD × EAD (metodologia completa, Res. 4.966/21) com arrasto e 3 cenários. Estima o provisionamento dos grandes bancos para a negociação. Complementa a de Provisionamento (S4/S5).',
    icon: Sigma,
    disponivel: true,
  },
];

export default function CalculosHubPage() {
  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8] dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Calculadoras</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ferramentas de cálculo jurídico do escritório
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CALCULADORAS.map((c) => {
          const Icon = c.icon;
          const inner = (
            <div
              className={`group flex h-full flex-col rounded-xl border p-5 transition-colors ${
                c.disponivel
                  ? 'border-zinc-200 bg-white hover:border-blue-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-500/40'
                  : 'border-dashed border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    c.disponivel
                      ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
                      : 'bg-zinc-200/60 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {c.disponivel ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    Disponível
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    <Wrench className="h-3 w-3" /> Em breve
                  </span>
                )}
              </div>
              <h2
                className={`text-sm font-semibold ${
                  c.disponivel ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {c.titulo}
              </h2>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {c.descricao}
              </p>
              {c.disponivel && (
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                  Abrir calculadora
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              )}
            </div>
          );
          return c.disponivel ? (
            <Link key={c.titulo} href={c.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={c.titulo} className="cursor-not-allowed">
              {inner}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
