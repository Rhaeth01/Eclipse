'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Loader2, RefreshCw, X } from 'lucide-react';

type UpdatePhase = 'idle' | 'downloading' | 'installing' | 'restarting' | 'error';

interface UpdateOverlayProps {
  phase: UpdatePhase;
  progress: number;
  version?: string;
  downloaded?: number;
  contentLength?: number;
  error?: string | null;
  onDismiss?: () => void;
}

const phaseCopy: Record<UpdatePhase, { title: string; subtitle: string }> = {
  idle: { title: '', subtitle: '' },
  downloading: {
    title: 'Téléchargement de la mise à jour',
    subtitle: 'Récupération des nouveaux fichiers…',
  },
  installing: {
    title: 'Installation en cours',
    subtitle: 'Mise en place des nouveaux fichiers…',
  },
  restarting: {
    title: 'Redémarrage',
    subtitle: 'Eclipse se relance pour finaliser la mise à jour…',
  },
  error: {
    title: 'Mise à jour interrompue',
    subtitle: 'Une erreur est survenue. Réessayez plus tard.',
  },
};

export function UpdateOverlay({
  phase,
  progress,
  version,
  downloaded = 0,
  contentLength = 0,
  error,
  onDismiss,
}: UpdateOverlayProps) {
  const visible = phase !== 'idle';
  const copy = phaseCopy[phase];
  const showProgress = phase === 'downloading';
  const isIndeterminate = phase === 'installing' || phase === 'restarting';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#070709]/90 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Mise à jour d'Eclipse"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-[480px] max-w-[90vw] rounded-2xl border border-white/[0.06] bg-[#111114] p-10 shadow-[0_0_60px_-12px_rgba(230,154,0,0.18)]"
          >
            {phase === 'error' && onDismiss && (
              <button
                onClick={onDismiss}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#5c5c66] hover:bg-white/[0.06] hover:text-[#e8e6e3] transition-colors"
                aria-label="Fermer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            <div className="flex flex-col items-center gap-6 text-center">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="relative"
              >
                <div className="absolute inset-0 -m-6 rounded-full bg-[#e69a00]/10 blur-2xl" />
                <Image
                  src="/icon.png"
                  alt="Eclipse"
                  width={88}
                  height={88}
                  priority
                  className="relative h-[88px] w-[88px]"
                />
              </motion.div>

              <motion.div
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className="flex flex-col items-center gap-1"
              >
                <h2 className="text-lg font-medium text-[#e8e6e3]">
                  {copy.title}
                </h2>
                {version && phase === 'downloading' && (
                  <p className="text-xs uppercase tracking-[0.18em] text-[#e69a00]/80">
                    Eclipse v{version}
                  </p>
                )}
                <p className="text-sm text-[#7a7671] mt-1">
                  {phase === 'error' && error ? error : copy.subtitle}
                </p>
              </motion.div>

              <div className="w-full pt-2">
                {showProgress && (
                  <div className="flex flex-col gap-2">
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#1e1e22]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#e69a00] via-[#f4b840] to-[#e69a00]"
                      />
                      <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: '200%' }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#7a7671] font-mono">
                      <span>{progress}%</span>
                      <span>
                        {contentLength > 0
                          ? `${formatBytes(downloaded)} / ${formatBytes(contentLength)}`
                          : formatBytes(downloaded)}
                      </span>
                    </div>
                  </div>
                )}

                {isIndeterminate && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#1e1e22]">
                      <motion.div
                        initial={{ x: '-40%' }}
                        animate={{ x: '140%' }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#e69a00] to-transparent"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#7a7671]">
                      {phase === 'restarting' ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      <span>
                        {phase === 'installing' ? 'Installation…' : 'Redémarrage…'}
                      </span>
                    </div>
                  </div>
                )}

                {phase === 'error' && (
                  <div className="flex justify-center pt-1">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#d4656b]/80">
                      Échec de la mise à jour
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatBytes(n: number) {
  if (!n) return '';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
