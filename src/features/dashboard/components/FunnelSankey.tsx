'use client';

import { useQuery } from '@tanstack/react-query';
import { Sankey, Tooltip, Rectangle, Layer, ResponsiveContainer } from 'recharts';
import { dashboardService } from '../services/dashboard.service';
import { useOrgId } from '@/hooks/use-org-query-key';

/** Nó do Sankey: retângulo na cor do status/canal + rótulo do lado de fora. */
function NodeShape(props: any) {
  const { x, y, width, height, payload } = props;
  const color = payload?.color || '#a1a1aa';
  const onLeft = payload?.kind === 'channel';
  const labelX = onLeft ? x - 8 : x + width + 8;
  const h = Math.max(2, height);
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={h} fill={color} fillOpacity={0.92} radius={[3, 3, 3, 3]} />
      <text
        x={labelX}
        y={y + height / 2}
        textAnchor={onLeft ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize={11}
        className="fill-zinc-600 dark:fill-zinc-300"
        style={{ pointerEvents: 'none' }}
      >
        {payload?.name}
        {typeof payload?.value === 'number' && (
          <tspan dx="6" fontSize={10} className="fill-zinc-400">{payload.value}</tspan>
        )}
      </text>
    </Layer>
  );
}

/** Link colorido pela cor do destino (status), translúcido. */
function LinkShape(props: any) {
  const { sourceX, sourceY, sourceControlX, targetControlX, targetX, targetY, linkWidth, payload } = props;
  const color =
    payload?.target?.color || payload?.payload?.target?.color || '#94a3b8';
  return (
    <path
      d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={color}
      strokeWidth={Math.max(1, linkWidth)}
      strokeOpacity={0.25}
    />
  );
}

export function FunnelSankey() {
  const orgId = useOrgId();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-sankey', orgId],
    queryFn: () => dashboardService.getFunnelSankey(),
  });

  if (isLoading) {
    return <div className="h-full animate-pulse rounded-lg bg-zinc-50 dark:bg-zinc-800" />;
  }
  if (!data || data.nodes.length === 0 || data.links.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        Sem fluxo de leads no período (precisa de conversas com status definido).
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Sankey
        data={data}
        nodePadding={24}
        nodeWidth={12}
        linkCurvature={0.5}
        iterations={32}
        margin={{ top: 8, right: 120, bottom: 8, left: 110 }}
        node={<NodeShape />}
        link={<LinkShape />}
      >
        <Tooltip
          contentStyle={{
            background: 'rgba(24,24,27,0.92)',
            border: 'none',
            borderRadius: 6,
            fontSize: 11,
            color: '#fff',
          }}
        />
      </Sankey>
    </ResponsiveContainer>
  );
}
