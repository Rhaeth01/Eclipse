/**
 * Hook pour gérer les Discord Quests
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { Quest } from '@/components/QuestPanel';

export interface UseQuestsOptions {
  wsHook: ReturnType<typeof useWebSocket>;
}

export interface UseQuestsReturn {
  quests: Quest[];
  runningQuests: string[];
  isLoading: boolean;
  refreshQuests: () => void;
  startQuest: (questId: string) => void;
  stopQuest: (questId: string) => void;
  claimReward: (questId: string) => void;
  createMockQuests: () => void;
}

export function useQuests({ wsHook }: UseQuestsOptions): UseQuestsReturn {
  const { send, isConnected, ws } = wsHook;
  
  const [quests, setQuests] = useState<Quest[]>([]);
  const [runningQuests, setRunningQuests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Ref pour stocker le handler sans re-créer l'effet
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  // Setup message listener
  useEffect(() => {
    const currentWs = ws.current;
    if (!currentWs) {
      console.log('[useQuests] No WS connection yet');
      return;
    }
    
    console.log('[useQuests] Setting up message listener');
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[useQuests] Received message:', data.type);
        
        switch (data.type) {
          case 'quests_update':
            console.log('[useQuests] Got quests_update with', data.quests?.length || 0, 'quests');
            setQuests(data.quests || []);
            setIsLoading(false);
            break;
          case 'quest_status':
            if (data.status === 'running') {
              setRunningQuests(prev => [...prev, data.questId]);
            } else if (data.status === 'stopped' || data.status === 'completed') {
              setRunningQuests(prev => prev.filter(id => id !== data.questId));
            }
            break;
          case 'quest_progress':
            setQuests(prev => prev.map(q => 
              q.id === data.questId 
                ? { ...q, progress: { ...q.progress, current: data.current } }
                : q
            ));
            break;
        }
      } catch (err) {
        console.error('[useQuests] Error parsing message:', err);
      }
    };
    
    currentWs.addEventListener('message', handleMessage);
    
    return () => {
      console.log('[useQuests] Removing message listener');
      currentWs.removeEventListener('message', handleMessage);
    };
  }, [ws.current]);

  const refreshQuests = useCallback(() => {
    console.log('[useQuests] Refresh requested, isConnected:', isConnected);
    if (!isConnected) {
      console.warn('[useQuests] Not connected, aborting');
      return;
    }
    setIsLoading(true);
    console.log('[useQuests] Sending get_quests message');
    const success = send({ type: 'get_quests' } as any);
    console.log('[useQuests] Message sent:', success);
  }, [send, isConnected]);

  const startQuest = useCallback((questId: string) => {
    if (!isConnected) return;
    send({ type: 'start_quest', questId } as any);
    setRunningQuests(prev => [...prev, questId]);
  }, [send, isConnected]);

  const stopQuest = useCallback((questId: string) => {
    if (!isConnected) return;
    send({ type: 'stop_quest', questId } as any);
    setRunningQuests(prev => prev.filter(id => id !== questId));
  }, [send, isConnected]);

  const claimReward = useCallback((questId: string) => {
    if (!isConnected) return;
    send({ type: 'claim_quest_reward', questId } as any);
  }, [send, isConnected]);

  const createMockQuests = useCallback(() => {
    if (!isConnected) return;
    send({ type: 'create_mock_quests' } as any);
  }, [send, isConnected]);

  return {
    quests,
    runningQuests,
    isLoading,
    refreshQuests,
    startQuest,
    stopQuest,
    claimReward,
    createMockQuests
  };
}
