'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'corona' | 'coral' | 'none';
}

const glowStyles: Record<string, string> = {
  corona: 'hover:shadow-[0_0_30px_-8px_rgba(230,154,0,0.12)] hover:border-amber-500/15',
  coral:  'hover:shadow-[0_0_30px_-8px_rgba(212,101,107,0.12)] hover:border-red-400/15',
  none:   '',
};

export function GlassCard({
  children,
  className,
  hover = true,
  glow = 'none',
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      whileHover={hover ? { y: -1 } : undefined}
      className={cn(
        'rounded-xl bg-[#111114] border border-white/[0.06]',
        'transition-all duration-300',
        glow !== 'none' && glowStyles[glow],
        className
      )}
    >
      {children}
    </motion.div>
  );
}
