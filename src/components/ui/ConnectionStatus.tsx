'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Loader2, Shield } from 'lucide-react';

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

const stateConfig: Record<ConnectionState, {
  icon: typeof Wifi;
  label: string;
  accent: string;
  bg: string;
  border: string;
}> = {
  disconnected: {
    icon: WifiOff,
    label: 'Déconnecté',
    accent: '#5c5c66',
    bg: 'bg-[#111114]',
    border: 'border-white/[0.06]',
  },
  connecting: {
    icon: Loader2,
    label: 'Connexion...',
    accent: '#e69a00',
    bg: 'bg-[#1a180f]',
    border: 'border-amber-500/15',
  },
  connected: {
    icon: Wifi,
    label: 'Core connecté',
    accent: '#8b9dc3',
    bg: 'bg-[#111114]',
    border: 'border-white/[0.06]',
  },
  authenticated: {
    icon: Shield,
    label: 'Discord connecté',
    accent: '#2d9e8a',
    bg: 'bg-[#0f1a17]',
    border: 'border-teal-500/15',
  },
  error: {
    icon: WifiOff,
    label: 'Erreur',
    accent: '#d4656b',
    bg: 'bg-[#1a1214]',
    border: 'border-red-500/15',
  },
};

export function ConnectionStatus({ state, user, className }: ConnectionStatusProps) {
  const { icon: Icon, label, accent, bg, border } = stateConfig[state];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl',
        'border',
        bg,
        border,
        className
      )}
    >
      <div className="relative" style={{ color: accent }}>
        <motion.div
          animate={state === 'connecting' ? { rotate: 360 } : {}}
          transition={state === 'connecting' ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
        >
          <Icon className="w-4 h-4" />
        </motion.div>
        {state === 'authenticated' && (
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full border"
            style={{ borderColor: accent, opacity: 0.3 }}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: accent }}>
          {label}
        </div>
        {user && (
          <div className="text-xs text-[#7a7671] truncate">
            {user.tag}
          </div>
        )}
      </div>

      {user?.avatarURL && state === 'authenticated' && (
        <div className="relative shrink-0">
          <img
            src={user.avatarURL}
            alt=""
            className="w-7 h-7 rounded-full"
            style={{ borderColor: accent, borderWidth: 1, borderStyle: 'solid' }}
          />
          <div
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#070709]"
            style={{ backgroundColor: accent }}
          />
        </div>
      )}
    </motion.div>
  );
}
