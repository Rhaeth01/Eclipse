'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRef, useEffect } from 'react';
import { Trash2, Clock, AlertTriangle, Eye, Radio } from 'lucide-react';

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

const accentColors: Record<string, string> = {
  info:    '#e69a00',
  success: '#2d9e8a',
  warning: '#b8860b',
  error:   '#d4656b',
  spy:     '#8b9dc3',
  core:    '#7a7671',
};

export function Console({
  logs,
  onClear,
  onRemove,
  className,
  maxHeight = '400px',
  autoScroll = true,
}: ConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className={cn('flex flex-col h-full rounded-xl bg-[#0c0c0f] border border-white/[0.06]', className)}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05] shrink-0">
        <span className="text-xs font-medium text-[#7a7671] tracking-wide uppercase">
          Logs
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#5c5c66] tabular-nums">{logs.length}</span>
          <button
            onClick={onClear}
            className="p-1 rounded-md text-[#5c5c66] hover:text-[#d4656b] hover:bg-[#1e1e22] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-1.5"
        style={{ maxHeight }}
      >
        <AnimatePresence mode="popLayout">
          {logs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-[#5c5c66]"
            >
              <Radio className="w-6 h-6 mb-2 opacity-30" />
              <span className="text-xs">En attente d&apos;événements...</span>
            </motion.div>
          ) : (
            logs.map((log) => {
              const color = accentColors[log.type];

              return (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{
                    opacity: log.isDeleting ? 0 : 1,
                    x: log.isDeleting ? 60 : 0,
                  }}
                  exit={{ opacity: 0, x: 60 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => onRemove?.(log.id)}
                  className="group flex items-start gap-2.5 p-2.5 rounded-lg bg-[#0e0e11] border border-white/[0.03] hover:border-white/[0.06] cursor-pointer transition-colors"
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-medium"
                        style={{ color }}
                      >
                        {log.title}
                      </span>
                      <span className="text-[10px] text-[#5c5c66] tabular-nums font-mono">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    {log.message && (
                      <p className="text-xs text-[#7a7671] mt-0.5 leading-relaxed line-clamp-2">
                        {log.message}
                      </p>
                    )}
                  </div>
                  <Trash2 className="w-3 h-3 text-[#5c5c66] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
