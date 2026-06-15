import type { AiAgent } from '../../services/ai-agents.service';
import type { AgentFolder } from '../../services/agent-folders.service';

export interface TemplateVM {
  folder: AgentFolder;
  agents: AiAgent[]; // orquestrador primeiro, depois workers
}

/** Monta os view-models dos templates (pastas isTemplate=true) com seus agentes. */
export function buildTemplateVMs(
  folders: AgentFolder[] | undefined,
  agents: AiAgent[] | undefined,
): TemplateVM[] {
  if (!folders) return [];
  const byFolder = new Map<string, AiAgent[]>();
  for (const a of agents ?? []) {
    if (!a.folderId) continue;
    const arr = byFolder.get(a.folderId) ?? [];
    arr.push(a);
    byFolder.set(a.folderId, arr);
  }
  return folders
    .filter((f) => f.isTemplate)
    .map((folder) => {
      const list = (byFolder.get(folder.id) ?? []).slice().sort((a, b) => {
        // orquestrador no topo, depois alfabético
        const ao = a.kind === 'ORCHESTRATOR' ? 0 : 1;
        const bo = b.kind === 'ORCHESTRATOR' ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name);
      });
      return { folder, agents: list };
    })
    .sort((a, b) => {
      // mais usados primeiro; empate → ordem definida (sortOrder)
      if (b.folder.useCount !== a.folder.useCount)
        return b.folder.useCount - a.folder.useCount;
      return a.folder.sortOrder - b.folder.sortOrder;
    });
}

/** Subtítulo do card: descrição própria OU "N agentes especializados". */
export function templateSubtitle(vm: TemplateVM): string {
  if (vm.folder.description?.trim()) return vm.folder.description.trim();
  const n = vm.agents.length;
  if (n === 0) return 'Sem descrição';
  return `${n} ${n === 1 ? 'agente especializado' : 'agentes especializados'}`;
}

export const TEMPLATE_CATEGORIES = [
  'Todas',
  'Financeiro',
  'Trabalhista',
  'Previdenciário',
  'Auxílio Acidente',
  'Consumidor',
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
