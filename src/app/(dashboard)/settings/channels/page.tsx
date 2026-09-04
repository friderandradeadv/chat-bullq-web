'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChannelsList } from '@/features/channels/components/channels-list';
import { channelsService } from '@/features/channels/services/channels.service';

export default function SettingsChannelsPage() {
  const queryClient = useQueryClient();

  // Mesmo "eu vi" da tela /conexoes: por Configurações > Canais a pessoa chega
  // no mesmo lugar, e a bolinha tem de apagar aqui também. Sem isto, quem
  // navega por dentro das Configurações via a bolinha nunca sumir.
  useEffect(() => {
    channelsService
      .ackConnectionHealth()
      .then(() =>
        queryClient.invalidateQueries({ queryKey: ['channels', 'connection-health'] }),
      )
      .catch(() => {});
  }, [queryClient]);

  return <ChannelsList />;
}
