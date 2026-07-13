'use client';

// Rota própria do Funil REPB (deep-link). O funil vive normalmente como aba
// dentro de /juridico/repb (toggle "Passivo | Funil de vendas"); esta rota só
// renderiza o mesmo board em tela cheia.
import { FunilRepbBoard } from '@/features/legal-cases/components/funil-repb-board';

export default function RepbFunilPage() {
  return <FunilRepbBoard />;
}
