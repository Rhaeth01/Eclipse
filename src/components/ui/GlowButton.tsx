'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface GlowButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<string, string> = {
  primary:   'bg-[#e69a00] text-[#070709] border-amber-500/30 hover:bg-amber-400',
  secondary: 'bg-[#1e1e22] text-[#b9b5ae] border-white/[0.06] hover:bg-[#252528] hover:text-[#e8e6e3]',
  danger:    'bg-[#3d1a1e] text-[#d4656b] border-red-500/15 hover:bg-[#4a1d21]',
  ghost:     'bg-transparent text-[#7a7671] border-transparent hover:text-[#e8e6e3] hover:bg-[#1e1e22]',
};

const sizes: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function GlowButton({
  children,
  onClick,
  className,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
}: GlowButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={disabled ? {} : { scale: 1.01 }}
      whileTap={disabled ? {} : { scale: 0.99 }}
      className={cn(
        'relative rounded-lg font-medium',
        'border transition-all duration-200',
        'flex items-center justify-center gap-2',
        variants[variant],
        sizes[size],
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
        />
      )}
      {icon && !loading && <span>{icon}</span>}
      <span>{children}</span>
    </motion.button>
  );
}
