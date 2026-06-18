/**
 * Hook pour récupérer le snapshot du CommandRegistry du core.
 *
 * Envoie `get_commands` au core, reçoit `commands_list` avec un snapshot
 * complet (catégories + sous-commandes + menus contextuels) et expose :
 *   - commandCount: nombre total de commandes (pour l'UI overview)
 *   - snapshot: le CommandRegistrySnapshot complet
 *   - isLoading: true pendant la requête
 *   - refreshCommands: force un nouveau fetch
 *
 * Le snapshot est typé `unknown` côté core (le core ne valide pas la forme
 * du snapshot), donc on parse avec une garde de type minimale.
 */

import { useState, useCallback, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';

export interface CommandCategorySnapshot {
  name: string;
  description: string;
  subcommands: Array<{ group?: string; name: string; description: string }>;
}

export interface CommandsSnapshot {
  categories: CommandCategorySnapshot[];
  topLevel: Array<{ name: string; description: string }>;
  contextMenus: Array<{ type: 'user' | 'message'; name: string }>;
  total: number;
}

export interface UseCommandsReturn {
  commandCount: number | null;
  snapshot: CommandsSnapshot | null;
  isLoading: boolean;
  refreshCommands: () => void;
}

function isCommandsSnapshot(value: unknown): value is CommandsSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.categories) &&
    Array.isArray(v.topLevel) &&
    Array.isArray(v.contextMenus) &&
    typeof v.total === 'number'
  );
}

export function useCommands({ wsHook }: { wsHook: ReturnType<typeof useWebSocket> }): UseCommandsReturn {
  const { send, isConnected, ws } = wsHook;

  const [snapshot, setSnapshot] = useState<CommandsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Listener WS : reçoit `commands_list` et met à jour le snapshot
  useEffect(() => {
    const currentWs = ws.current;
    if (!currentWs) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'commands_list') {
          if (isCommandsSnapshot(data.data)) {
            setSnapshot(data.data);
            setIsLoading(false);
          } else {
            console.warn('[useCommands] commands_list.data n\'a pas la forme attendue', data.data);
          }
        }
      } catch (err) {
        // ignore parse errors (handled by useWebSocket)
      }
    };

    currentWs.addEventListener('message', handleMessage);
    return () => currentWs.removeEventListener('message', handleMessage);
  }, [ws.current]);

  const refreshCommands = useCallback(() => {
    if (!isConnected) return;
    setIsLoading(true);
    send({ type: 'get_commands' } as any);
  }, [send, isConnected]);

  // Auto-fetch dès qu'on est connecté
  useEffect(() => {
    if (isConnected && snapshot === null && !isLoading) {
      refreshCommands();
    }
  }, [isConnected, snapshot, isLoading, refreshCommands]);

  return {
    commandCount: snapshot?.total ?? null,
    snapshot,
    isLoading,
    refreshCommands,
  };
}
