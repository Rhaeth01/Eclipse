'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode, useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number;
}

interface AnimatedTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'pills' | 'underline' | 'glass';
}

export function AnimatedTabs({
  tabs,
  activeTab,
  onChange,
  orientation = 'horizontal',
  variant = 'glass'
}: AnimatedTabsProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        'relative flex',
        isVertical ? 'flex-col gap-1' : 'flex-row gap-1 p-1',
        variant === 'glass' && 'bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.08]',
        variant === 'pills' && 'bg-zinc-900/50 rounded-full p-1'
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isHovered = hoveredTab === tab.id;

        return (
          <motion.button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            onMouseEnter={() => setHoveredTab(tab.id)}
            onMouseLeave={() => setHoveredTab(null)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2.5 rounded-xl',
              'text-sm font-medium transition-colors duration-200',
              'outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
              isVertical && 'w-full justify-start',
              variant === 'underline' && 'rounded-none border-b-2',
              variant === 'glass' && (isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'),
              variant === 'pills' && (isActive ? 'text-white' : 'text-zinc-400'),
              variant === 'underline' && (isActive ? 'text-white border-indigo-500' : 'text-zinc-400 border-transparent hover:text-zinc-200')
            )}
          >
            {/* Active background */}
            {isActive && variant !== 'underline' && (
              <motion.div
                layoutId="activeTab"
                className={cn(
                  'absolute inset-0 rounded-xl',
                  variant === 'glass' && 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30',
                  variant === 'pills' && 'bg-indigo-600'
                )}
                initial={false}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}

            {/* Hover effect */}
            {!isActive && variant === 'glass' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 1 : 0 }}
                className="absolute inset-0 rounded-xl bg-white/[0.05]"
              />
            )}

            {/* Icon */}
            {tab.icon && (
              <motion.span
                animate={{ scale: isActive ? 1.1 : 1 }}
                className="relative z-10"
              >
                {tab.icon}
              </motion.span>
            )}

            {/* Label */}
            <span className="relative z-10">{tab.label}</span>

            {/* Badge */}
            {tab.badge !== undefined && tab.badge > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  'relative z-10 min-w-[18px] h-[18px] px-1.5',
                  'flex items-center justify-center',
                  'text-[10px] font-bold rounded-full',
                  isActive ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-400'
                )}
              >
                {tab.badge > 99 ? '99+' : tab.badge}
              </motion.span>
            )}

            {/* Glow effect for active */}
            {isActive && variant === 'glass' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 rounded-xl bg-indigo-500/20 blur-xl -z-10"
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
