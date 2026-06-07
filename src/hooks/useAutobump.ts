/**
 * Hook pour gérer le bump automatique
 * Permet d'activer/désactiver et voir le statut du bump auto
 */

import { useCallback } from 'react';
import type { UseWebSocketReturn } from './useWebSocket';
import type { EnableAutobumpMessage, DisableAutobumpMessage, GetAutobumpStatusMessage } from '@/lib/websocket/types';

export interface UseAutobumpOptions {
  wsHook: UseWebSocketReturn;
}

export interface UseAutobumpReturn {
  enable: (guildId: string, channelId: string, intervalSeconds?: number) => void;
  disable: (guildId: string) => void;
  getStatus: (guildId: string) => void;
}

export function useAutobump({ wsHook }: UseAutobumpOptions): UseAutobumpReturn {
  const { send } = wsHook;

  // Activer le bump automatique
  const enable = useCallback((guildId: string, channelId: string, intervalSeconds = 7200) => {
    const msg: EnableAutobumpMessage = {
      type: 'enable_autobump',
      guildId,
      channelId,
      interval: intervalSeconds
    };
    send(msg);
  }, [send]);

  // Désactiver le bump automatique
  const disable = useCallback((guildId: string) => {
    const msg: DisableAutobumpMessage = {
      type: 'disable_autobump',
      guildId
    };
    send(msg);
  }, [send]);

  // Récupérer le statut
  const getStatus = useCallback((guildId: string) => {
    const msg: GetAutobumpStatusMessage = {
      type: 'get_autobump_status',
      guildId
    };
    send(msg);
  }, [send]);

  return {
    enable,
    disable,
    getStatus
  };
}
