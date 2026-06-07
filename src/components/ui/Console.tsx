'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode, useRef, useEffect } from 'react';
import { Trash2, Clock, Shield, AlertTriangle, Eye, Radio } from 'lucide-react';

export interface LogEntry {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'spy' | 'core';
  title: string;
  message?: string;
  timestamp: Date;
  isDeleting?: boolean;
}

interface ConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
  onRemove?: (id: string) => void;
  className?: string;
  maxHeight?: string;
  autoScroll?: boolean;
}

const typeConfig = {
  info: {
    icon: Radio,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    glow: 'shadow-[0_0_15px_-5px_rgba(99,102,241,0.3)]'
  },
  success: {
    icon: Shield,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    glow: 'shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    glow: 'shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]'
  },
  error: {
    icon: AlertTriangle,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    glow: 'shadow-[0_0_15px_-5px_rgba(244,63,94,0.3)]'
  },
  spy: {
    icon: Eye,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    glow: 'shadow-[0_0_15px_-5px_rgba(168,85,247,0.3)]'
  },
  core: {
    icon: Clock,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    glow: 'shadow-[0_0_15px_-5px_rgba(34,211,238,0.3)]'
  }
};

export function Console({
  logs,
  onClear,
  onRemove,
  className,
  maxHeight = '400px',
  autoScroll = true
}: ConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className={cn(
      'relative rounded-2xl overflow-hidden',
      'bg-black/40 backdrop-blur-xl',
      'border border-white/[0.08]',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="ml-3 text-xs font-mono text-zinc-500 uppercase tracking-wider">
            Console Output
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 font-mono">
            {logs.length} entries
          </span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClear}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
        style={{ maxHeight }}
      >
        <AnimatePresence mode="popLayout">
          {logs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-zinc-600"
            >
              <Radio className="w-8 h-8 mb-2 opacity-50" />
              <span className="text-sm font-mono">En attente d&apos;événements...</span>
            </motion.div>
          ) : (
            logs.map((log) => {
              const config = typeConfig[log.type];
              const Icon = config.icon;

              return (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ 
                    opacity: log.isDeleting ? 0 : 1, 
                    x: log.isDeleting ? 100 : 0,
                    scale: log.isDeleting ? 0.9 : 1
                  }}
                  exit={{ opacity: 0, x: 100, scale: 0.9 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  onClick={() => onRemove?.(log.id)}
                  className={cn(
                    'group relative flex items-start gap-3 p-3 rounded-xl',
                    'border backdrop-blur-sm',
                    'transition-all duration-300',
                    'hover:scale-[1.02] cursor-pointer',
                    config.bg,
                    config.border,
                    config.glow
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    'p-2 rounded-lg shrink-0',
                    'bg-black/20'
                  )}>
                    <Icon className={cn('w-4 h-4', config.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn('text-sm font-semibold', config.color)}>
                        {log.title}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    {log.message && (
                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                        {log.message}
                      </p>
                    )}
                  </div>

                  {/* Hover indicator */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    whileHover={{ opacity: 1, scale: 1 }}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center"
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                  </motion.div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl opacity-[0.02]">
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,_rgba(255,255,255,0.1)_50%)] bg-[length:100%_4px]" />
      </div>
    </div>
  );
}
