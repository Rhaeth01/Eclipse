'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Gift, Play, Square, CheckCircle, Clock, 
  Monitor, Gamepad2, Video, Loader2, Sparkles,
  ChevronDown, ChevronUp, RefreshCw, Wand2
} from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { GlowButton } from './ui/GlowButton';

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: 'VIDEO' | 'PLAY' | 'STREAM' | 'PLAY_ACTIVITY';
  targetGame?: {
    id: string;
    name: string;
    executables: string[];
  };
  targetVideo?: {
    id: string;
    durationSeconds: number;
  };
  reward: {
    type: 'NITRO' | 'ORBS' | 'DECORATION' | 'BADGE';
    name: string;
  };
  expiresAt: string;
  progress: {
    current: number;
    target: number;
    completed: boolean;
  };
}

interface QuestPanelProps {
  quests: Quest[];
  runningQuests: string[];
  onRefresh: () => void;
  onStart: (questId: string) => void;
  onStop: (questId: string) => void;
  onClaim: (questId: string) => void;
  onCreateMock?: () => void;
  isLoading?: boolean;
}

const QUEST_TYPE_ICONS = {
  VIDEO: Video,
  PLAY: Gamepad2,
  STREAM: Monitor,
  PLAY_ACTIVITY: Gamepad2
};

const QUEST_TYPE_LABELS = {
  VIDEO: 'Vidéo',
  PLAY: 'Jeu',
  STREAM: 'Stream',
  PLAY_ACTIVITY: 'Activité'
};

const REWARD_COLORS = {
  NITRO: 'from-pink-500 to-rose-500',
  ORBS: 'from-purple-500 to-indigo-500',
  DECORATION: 'from-amber-500 to-orange-500',
  BADGE: 'from-emerald-500 to-teal-500'
};

export const QuestPanel: React.FC<QuestPanelProps> = ({
  quests,
  runningQuests,
  onRefresh,
  onStart,
  onStop,
  onClaim,
  onCreateMock,
  isLoading = false
}) => {
  const [expandedQuest, setExpandedQuest] = useState<string | null>(null);

  const activeQuests = quests.filter(q => !q.progress.completed);
  const completedQuests = quests.filter(q => q.progress.completed);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m${secs > 0 ? ` ${secs}s` : ''}`;
  };

  const formatTimeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff < 0) return 'Expiré';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}j restants`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours}h restantes`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20">
            <Gift className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Discord Quests</h3>
            <p className="text-xs text-zinc-500">
              {activeQuests.length} active · {completedQuests.length} complétées
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {onCreateMock && (
            <GlowButton
              variant="secondary"
              size="sm"
              onClick={onCreateMock}
              icon={<Wand2 className="w-4 h-4" />}
            >
              Mode démo
            </GlowButton>
          )}
          <GlowButton
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            loading={isLoading}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Rafraîchir
          </GlowButton>
        </div>
      </div>

      {/* Active Quests */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Quêtes disponibles
        </h4>

        {activeQuests.length === 0 ? (
          <GlassCard intensity="low" className="p-8 text-center">
            <Gift className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
            <p className="text-zinc-500">Aucune quête active</p>
            <p className="text-xs text-zinc-600 mt-1">
              Les quêtes apparaissent quand Discord en propose
            </p>
          </GlassCard>
        ) : (
          activeQuests.map((quest) => {
            const Icon = QUEST_TYPE_ICONS[quest.type];
            const isRunning = runningQuests.includes(quest.id);
            const isExpanded = expandedQuest === quest.id;
            const progressPercent = Math.min(100, (quest.progress.current / quest.progress.target) * 100);

            return (
              <GlassCard
                key={quest.id}
                intensity="medium"
                className="overflow-hidden"
                glow="rose"
              >
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`
                      p-3 rounded-xl bg-gradient-to-br ${REWARD_COLORS[quest.reward.type]}/20
                    `}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="font-semibold text-sm truncate">{quest.title}</h5>
                          <p className="text-xs text-zinc-500 mt-0.5">{quest.description}</p>
                        </div>
                        <span className={`
                          text-xs px-2 py-1 rounded-full font-medium
                          bg-gradient-to-r ${REWARD_COLORS[quest.reward.type]} text-white
                        `}>
                          {quest.reward.name}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-500">
                            {QUEST_TYPE_LABELS[quest.type]}
                            {quest.targetGame && ` · ${quest.targetGame.name}`}
                          </span>
                          <span className="text-zinc-400">
                            {quest.type === 'VIDEO' && quest.targetVideo
                              ? `${formatDuration(quest.progress.current)} / ${formatDuration(quest.targetVideo.durationSeconds)}`
                              : `${Math.round(progressPercent)}%`
                            }
                          </span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full bg-gradient-to-r ${REWARD_COLORS[quest.reward.type]}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        {isRunning ? (
                          <GlowButton
                            variant="danger"
                            size="sm"
                            className="flex-1"
                            onClick={() => onStop(quest.id)}
                            icon={<Square className="w-4 h-4" />}
                          >
                            Arrêter
                          </GlowButton>
                        ) : (
                          <GlowButton
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            onClick={() => onStart(quest.id)}
                            disabled={quest.type === 'STREAM'}
                            icon={quest.type === 'STREAM' ? <Clock className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          >
                            {quest.type === 'STREAM' ? 'Manuel requis' : 'Auto-compléter'}
                          </GlowButton>
                        )}

                        <button
                          onClick={() => setExpandedQuest(isExpanded ? null : quest.id)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5"
                    >
                      <div className="p-4 space-y-2 text-sm">
                        {quest.targetGame && (
                          <div className="flex justify-between text-zinc-400">
                            <span>Jeu:</span>
                            <span className="text-zinc-300">{quest.targetGame.name}</span>
                          </div>
                        )}
                        {quest.targetVideo && (
                          <div className="flex justify-between text-zinc-400">
                            <span>Durée vidéo:</span>
                            <span className="text-zinc-300">{formatDuration(quest.targetVideo.durationSeconds)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-zinc-400">
                          <span>Expire dans:</span>
                          <span className="text-zinc-300">{formatTimeLeft(quest.expiresAt)}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>Récompense:</span>
                          <span className="text-zinc-300">{quest.reward.name}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>ID:</span>
                          <span className="text-zinc-500 font-mono text-xs">{quest.id}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Completed Quests */}
      {completedQuests.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Complétées ({completedQuests.length})
          </h4>

          <div className="grid grid-cols-2 gap-2">
            {completedQuests.map((quest) => (
              <GlassCard
                key={quest.id}
                intensity="low"
                className="p-3 opacity-60 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm truncate">{quest.title}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">{quest.reward.name}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
