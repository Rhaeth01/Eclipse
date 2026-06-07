'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlassCard } from './ui/GlassCard';
import { GlowButton } from './ui/GlowButton';
import { useAutobump } from '@/hooks/useAutobump';
import type { UseWebSocketReturn } from '@/hooks/useWebSocket';
import type { AutobumpStatusMessage } from '@/lib/websocket/types';
import { ArrowUp, Clock, MapPin, Power, Settings } from 'lucide-react';

interface AutobumpConfig {
  channelId: string;
  guildId: string;
  interval: number;
  enabled: boolean;
  lastBump?: number;
  nextBump?: number;
}

interface AutobumpCardProps {
  wsHook: UseWebSocketReturn;
  guildId?: string;
  channelId?: string;
}

export function AutobumpCard({ wsHook, guildId, channelId }: AutobumpCardProps) {
  const [config, setConfig] = useState<AutobumpConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(120);
  
  const { enable, disable, getStatus } = useAutobump({ wsHook });
  const { ws } = wsHook;

  // Écouter les messages de statut autobump
  useEffect(() => {
    const websocket = ws.current;
    if (!websocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'autobump_status' && data.guildId === guildId) {
          if (data.status) {
            setConfig(data.status);
          } else {
            setConfig(null);
          }
        }
      } catch {
        // Ignorer les messages non-JSON
      }
    };

    websocket.addEventListener('message', handleMessage);
    return () => websocket.removeEventListener('message', handleMessage);
  }, [ws, guildId]);

  // Récupérer le statut initial
  useEffect(() => {
    if (guildId) {
      getStatus(guildId);
    }
  }, [guildId, getStatus]);

  const handleEnable = useCallback(() => {
    if (!guildId || !channelId) return;
    enable(guildId, channelId, intervalMinutes * 60);
  }, [guildId, channelId, intervalMinutes, enable]);

  const handleDisable = useCallback(() => {
    if (!guildId) return;
    disable(guildId);
    setConfig(null);
  }, [guildId, disable]);

  const getTimeRemaining = useCallback((): string => {
    if (!config?.nextBump) return '--';
    
    const ms = Math.max(0, config.nextBump - Date.now());
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  }, [config]);

  const isEnabled = config?.enabled || false;

  const intervalOptions = [
    { value: 60, label: '1h' },
    { value: 120, label: '2h (Disboard)' },
    { value: 180, label: '3h' },
    { value: 240, label: '4h' }
  ];

  return (
    <GlassCard className="relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
          <ArrowUp className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Bump Automatique</h3>
          <p className="text-xs text-white/50">Auto-bump pour serveurs</p>
        </div>
        <div className="ml-auto">
          <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
        </div>
      </div>

      {/* Status */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Power className={`w-4 h-4 ${isEnabled ? 'text-emerald-400' : 'text-white/30'}`} />
          <span className={isEnabled ? 'text-emerald-400' : 'text-white/50'}>
            {isEnabled ? 'Actif' : 'Inactif'}
          </span>
        </div>

        {isEnabled && (
          <>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <MapPin className="w-4 h-4" />
              <span>Dans ce salon</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Clock className="w-4 h-4" />
              <span>Prochain: {getTimeRemaining()}</span>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      {!isEnabled ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-white/50" />
            <span className="text-sm text-white/70">Intervalle:</span>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {intervalOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setIntervalMinutes(opt.value)}
                className={`px-2 py-1.5 text-xs rounded-lg border transition-all ${
                  intervalMinutes === opt.value
                    ? 'bg-indigo-500/30 border-indigo-500/50 text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <GlowButton
            onClick={handleEnable}
            disabled={!guildId || !channelId}
            variant="primary"
            size="sm"
            className="w-full"
          >
            Activer le Bump Auto
          </GlowButton>
        </div>
      ) : (
        <GlowButton
          onClick={handleDisable}
          variant="danger"
          size="sm"
          className="w-full"
        >
          Désactiver
        </GlowButton>
      )}

      {(!guildId || !channelId) && (
        <p className="text-xs text-amber-400/80 mt-3 text-center">
          Connectez-vous à Discord pour utiliser cette fonction
        </p>
      )}
    </GlassCard>
  );
}
