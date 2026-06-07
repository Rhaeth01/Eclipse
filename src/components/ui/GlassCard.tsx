'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'none';
  intensity?: 'low' | 'medium' | 'high';
}

const glowColors = {
  indigo: 'hover:shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]',
  emerald: 'hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)]',
  rose: 'hover:shadow-[0_0_40px_-10px_rgba(244,63,94,0.5)]',
  amber: 'hover:shadow-[0_0_40px_-10px_rgba(245,158,11,0.5)]',
  none: ''
};

const intensities = {
  low: 'bg-white/[0.02] border-white/[0.05]',
  medium: 'bg-white/[0.04] border-white/[0.08]',
  high: 'bg-white/[0.08] border-white/[0.12]'
};

export function GlassCard({
  children,
  className,
  hover = true,
  glow = 'indigo',
  intensity = 'medium'
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      whileHover={hover ? { scale: 1.01, y: -2 } : undefined}
      className={cn(
        'relative rounded-2xl backdrop-blur-xl',
        'border backdrop-saturate-150',
        intensities[intensity],
        glow !== 'none' && hover && glowColors[glow],
        'transition-all duration-500 ease-out',
        className
      )}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] to-transparent pointer-events-none" />
      
      {/* Border glow effect */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className={cn(
          'absolute inset-0 rounded-2xl',
          glow === 'indigo' && 'bg-indigo-500/10',
          glow === 'emerald' && 'bg-emerald-500/10',
          glow === 'rose' && 'bg-rose-500/10',
          glow === 'amber' && 'bg-amber-500/10'
        )} />
      </div>

      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
