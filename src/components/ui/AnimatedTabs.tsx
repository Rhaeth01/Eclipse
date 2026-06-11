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
  variant?: 'pills' | 'underline' | 'surface';
}

export function AnimatedTabs({
  tabs,
  activeTab,
  onChange,
  orientation = 'horizontal',
  variant = 'surface'
}: AnimatedTabsProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        'relative flex',
        isVertical ? 'flex-col gap-0.5' : 'flex-row gap-1 p-1',
        variant === 'surface' && 'bg-[#0c0c0f] rounded-xl border border-white/[0.04]',
        variant === 'pills' && 'bg-[#0c0c0f] rounded-full p-1'
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
              'relative flex items-center gap-2 px-3.5 py-2 rounded-lg',
              'text-sm font-medium transition-colors duration-150',
              'outline-none focus-visible:ring-2 focus-visible:ring-[#e69a00]/30',
              isVertical && 'w-full justify-start',
              variant === 'underline' && 'rounded-none border-b-2',
              variant === 'surface' && (isActive ? 'text-[#e8e6e3]' : 'text-[#5c5c66] hover:text-[#b9b5ae]'),
              variant === 'pills' && (isActive ? 'text-[#070709]' : 'text-[#5c5c66]'),
              variant === 'underline' && (isActive ? 'text-[#e8e6e3] border-[#e69a00]' : 'text-[#5c5c66] border-transparent hover:text-[#b9b5ae]')
            )}
          >
            {isActive && variant !== 'underline' && (
              <motion.div
                layoutId="activeTab"
                className={cn(
                  'absolute inset-0 rounded-lg',
                  variant === 'surface' && 'bg-[#1e1e22] border border-white/[0.05]',
                  variant === 'pills' && 'bg-[#e69a00]'
                )}
                initial={false}
                transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
              />
            )}

            {!isActive && variant === 'surface' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 1 : 0 }}
                className="absolute inset-0 rounded-lg bg-white/[0.03]"
              />
            )}

            {tab.icon && (
              <motion.span
                animate={{ scale: isActive ? 1.05 : 1 }}
                className="relative z-10"
              >
                {tab.icon}
              </motion.span>
            )}

            <span className="relative z-10">{tab.label}</span>

            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  'relative z-10 min-w-[18px] h-[18px] px-1.5',
                  'flex items-center justify-center',
                  'text-[10px] font-bold rounded-full',
                  isActive
                    ? variant === 'pills'
                      ? 'bg-[#070709]/20 text-[#070709]'
                      : 'bg-white/[0.08] text-[#e8e6e3]'
                    : 'bg-white/[0.04] text-[#5c5c66]'
                )}
              >
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
