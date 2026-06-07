'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode, useState } from 'react';

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

const variants = {
  primary: {
    base: 'bg-indigo-600 text-white border-indigo-500/50',
    glow: 'shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.7)]',
    gradient: 'from-indigo-500/20 to-purple-500/20'
  },
  secondary: {
    base: 'bg-white/[0.08] text-white border-white/[0.12]',
    glow: 'hover:shadow-[0_0_20px_-5px_rgba(255,255,255,0.15)]',
    gradient: 'from-white/10 to-white/5'
  },
  danger: {
    base: 'bg-rose-600 text-white border-rose-500/50',
    glow: 'shadow-[0_0_20px_-5px_rgba(225,29,72,0.4)] hover:shadow-[0_0_30px_-5px_rgba(225,29,72,0.6)]',
    gradient: 'from-rose-500/20 to-orange-500/20'
  },
  ghost: {
    base: 'bg-transparent text-zinc-400 border-transparent hover:text-white hover:bg-white/[0.05]',
    glow: '',
    gradient: ''
  }
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base'
};

export function GlowButton({
  children,
  onClick,
  className,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon
}: GlowButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={cn(
        'relative overflow-hidden rounded-xl font-medium',
        'border backdrop-blur-sm transition-all duration-300',
        'flex items-center justify-center gap-2',
        variants[variant].base,
        !disabled && variants[variant].glow,
        sizes[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Animated gradient background */}
      <motion.div
        className={cn(
          'absolute inset-0 bg-gradient-to-r',
          variants[variant].gradient,
          'opacity-0 hover:opacity-100 transition-opacity duration-300'
        )}
        animate={isPressed ? { scale: 0.95 } : { scale: 1 }}
      />

      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />

      {/* Loading spinner */}
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
        />
      )}

      {/* Icon */}
      {icon && !loading && <span className="relative z-10">{icon}</span>}

      {/* Text */}
      <span className="relative z-10">{children}</span>

      {/* Ripple effect on click */}
      {isPressed && !disabled && (
        <motion.div
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 bg-white/30 rounded-full"
          style={{ transformOrigin: 'center' }}
        />
      )}
    </motion.button>
  );
}
