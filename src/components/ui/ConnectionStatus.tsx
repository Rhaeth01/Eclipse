'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Loader2, Shield, Zap } from 'lucide-react';

export type ConnectionState = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'authenticated' 
  | 'error';

interface ConnectionStatusProps {
  state: ConnectionState;
  user?: {
    tag: string;
    avatarURL?: string | null;
  } | null;
  className?: string;
}

const states = {
  disconnected: {
    icon: WifiOff,
    label: 'Déconnecté',
    color: 'text-zinc-500',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/20',
    pulse: false
  },
  connecting: {
    icon: Loader2,
    label: 'Connexion...',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    pulse: true
  },
  connected: {
    icon: Wifi,
    label: 'Core connecté',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    pulse: false
  },
  authenticated: {
    icon: Shield,
    label: 'Discord connecté',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    pulse: false
  },
  error: {
    icon: WifiOff,
    label: 'Erreur',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    pulse: false
  }
};

export function ConnectionStatus({ state, user, className }: ConnectionStatusProps) {
  const config = states[state];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl',
        'border backdrop-blur-sm',
        config.bg,
        config.border,
        className
      )}
    >
      {/* Status Icon with animation */}
      <div className={cn('relative', config.color)}>
        <motion.div
          animate={config.pulse ? { rotate: 360 } : {}}
          transition={config.pulse ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
        >
          <Icon className="w-5 h-5" />
        </motion.div>
        
        {/* Pulse rings for authenticated */}
        {state === 'authenticated' && (
          <>
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border border-emerald-400/50"
            />
            <motion.div
              animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              className="absolute inset-0 rounded-full border border-emerald-400/30"
            />
          </>
        )}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-semibold', config.color)}>
          {config.label}
        </div>
        {user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="text-xs text-zinc-400 truncate flex items-center gap-1"
          >
            <Zap className="w-3 h-3 text-yellow-400" />
            {user.tag}
          </motion.div>
        )}
      </div>

      {/* Avatar for authenticated */}
      {user?.avatarURL && state === 'authenticated' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="relative"
        >
          <img
            src={user.avatarURL}
            alt="Avatar"
            className="w-8 h-8 rounded-full border-2 border-emerald-500/50"
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black" />
        </motion.div>
      )}

      {/* Live indicator for authenticated */}
      {state === 'authenticated' && (
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono uppercase tracking-wider"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          LIVE
        </motion.div>
      )}
    </motion.div>
  );
}
