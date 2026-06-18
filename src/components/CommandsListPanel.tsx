'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Command, ListTree, MousePointerClick, Loader } from 'lucide-react';
import type { CommandsSnapshot } from '@/hooks/useCommands';

interface CommandsListPanelProps {
  snapshot: CommandsSnapshot | null;
  isLoading: boolean;
  onRefresh: () => void;
}

/**
 * Affiche la liste des commandes slash enregistrées par le core.
 * Accordéon par catégorie — une catégorie dépliée montre ses sous-commandes.
 * Les menus contextuels sont listés à part.
 */
export function CommandsListPanel({ snapshot, isLoading, onRefresh }: CommandsListPanelProps) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-[#7a7671]">
          {snapshot ? (
            <>
              <span className="text-[#b9b5ae] font-mono">{snapshot.total}</span>{' '}
              commande{snapshot.total > 1 ? 's' : ''} dans{' '}
              <span className="text-[#b9b5ae] font-mono">{snapshot.categories.length}</span>{' '}
              catégorie{snapshot.categories.length > 1 ? 's' : ''}
              {snapshot.contextMenus.length > 0 && (
                <>
                  {' + '}
                  <span className="text-[#b9b5ae] font-mono">{snapshot.contextMenus.length}</span> menu
                  {snapshot.contextMenus.length > 1 ? 's' : ''} contextuel
                  {snapshot.contextMenus.length > 1 ? 's' : ''}
                </>
              )}
            </>
          ) : (
            <span className="italic">En attente du snapshot du core…</span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-xs text-[#5c5c66] hover:text-[#e69a00] transition-colors duration-150
                     disabled:opacity-50 disabled:cursor-not-allowed"
          title="Rafraîchir le snapshot"
        >
          {isLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : 'Rafraîchir'}
        </button>
      </div>

      {!snapshot ? (
        <div className="text-center text-xs text-[#5c5c66] py-6 italic">
          Le core n'a pas encore envoyé de snapshot.
        </div>
      ) : (
        <>
          {snapshot.categories.map(cat => {
            const isOpen = openCategory === cat.name;
            return (
              <div
                key={cat.name}
                className="rounded-lg bg-[#0c0c0f] border border-white/[0.04] overflow-hidden"
              >
                <button
                  onClick={() => setOpenCategory(isOpen ? null : cat.name)}
                  className="w-full flex items-center justify-between px-3 py-2.5
                             hover:bg-white/[0.02] transition-colors duration-150"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ListTree className="w-3.5 h-3.5 text-[#e69a00] shrink-0" />
                    <span className="font-mono text-sm text-[#b9b5ae]">/{cat.name}</span>
                    <span className="text-xs text-[#5c5c66] truncate">
                      — {cat.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-[#5c5c66] font-mono">
                      {cat.subcommands.length}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#5c5c66] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="border-t border-white/[0.04]"
                    >
                      <div className="px-3 py-2 space-y-1">
                        {cat.subcommands.map(sub => (
                          <div
                            key={`${sub.group ?? ''}-${sub.name}`}
                            className="flex items-start gap-2 text-xs"
                          >
                            <span className="font-mono text-[#5c5c66] shrink-0">/</span>
                            <span className="font-mono text-[#b9b5ae]">
                              {cat.name}
                              {sub.group && (
                                <>
                                  {' '}
                                  <span className="text-[#9b83cb]">{sub.group}</span>
                                </>
                              )}{' '}
                              {sub.name}
                            </span>
                            {sub.description && (
                              <span className="text-[#7a7671] truncate">— {sub.description}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {snapshot.contextMenus.length > 0 && (
            <div className="pt-2 border-t border-white/[0.04]">
              <div className="text-[10px] text-[#5c5c66] uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" />
                Menus contextuels
              </div>
              {snapshot.contextMenus.map(menu => (
                <div
                  key={`${menu.type}-${menu.name}`}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded
                             bg-[#0c0c0f] border border-white/[0.04]"
                >
                  <span className="text-[10px] text-[#5c5c66] uppercase">
                    {menu.type === 'user' ? '👤' : '💬'}
                  </span>
                  <span className="font-mono text-[#b9b5ae]">{menu.name}</span>
                </div>
              ))}
            </div>
          )}

          {snapshot.topLevel.length > 0 && (
            <div className="pt-2 border-t border-white/[0.04]">
              <div className="text-[10px] text-[#5c5c66] uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                <Command className="w-3 h-3" />
                Top-level
              </div>
              {snapshot.topLevel.map(cmd => (
                <div
                  key={cmd.name}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded
                             bg-[#0c0c0f] border border-white/[0.04]"
                >
                  <span className="font-mono text-[#b9b5ae]">/{cmd.name}</span>
                  <span className="text-[#7a7671] truncate">— {cmd.description}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
