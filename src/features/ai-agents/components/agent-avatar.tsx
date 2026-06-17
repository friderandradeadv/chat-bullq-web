'use client';

import { useState } from 'react';
import { type AiAgent } from '../services/ai-agents.service';
import { avatarColor, avatarInitials } from '@/lib/avatar';

/**
 * Avatar do agente, estilo LíderHub: usa a foto própria (`avatarUrl`) quando
 * existe; senão gera uma "pessoinha" ilustrada determinística pelo seed
 * (nome/id do agente) — varia homem/mulher por agente. Fallback final
 * (se a imagem não carregar) = iniciais coloridas.
 */
const SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
};

function personAvatar(agent: Pick<AiAgent, 'id' | 'name'>) {
  const seed = encodeURIComponent(agent.id || agent.name || 'agent');
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
}

export function AgentAvatar({
  agent,
  size = 'md',
  rounded = 'rounded-lg',
  className = '',
}: {
  agent: Pick<AiAgent, 'id' | 'name' | 'avatarUrl'>;
  size?: 'sm' | 'md' | 'lg';
  rounded?: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const box = `${SIZE[size]} flex-shrink-0 ${rounded} ${className}`;

  if (errored) {
    return (
      <div
        className={`${box} flex items-center justify-center font-semibold text-white`}
        style={{ backgroundColor: avatarColor(agent.name) }}
        title={agent.name}
      >
        {avatarInitials(agent.name)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={agent.avatarUrl || personAvatar(agent)}
      alt={agent.name}
      title={agent.name}
      onError={() => setErrored(true)}
      className={`${box} bg-zinc-100 object-cover dark:bg-zinc-800`}
    />
  );
}
