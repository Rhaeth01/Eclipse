'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';

type UpdatePhase = 'idle' | 'downloading' | 'installing' | 'restarting' | 'error';

interface UpdateInfo {
  version: string;
  body?: string;
  date?: string;
}

export function useUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [contentLength, setContentLength] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function checkForUpdates() {
      try {
        const update = await check();
        if (cancelled || !update) return;
        setUpdateAvailable(true);
        setUpdateInfo({
          version: update.version,
          body: update.body || undefined,
          date: update.date || undefined,
        });
      } catch {
        // Pas d'update ou erreur réseau — silencieux
      }
    }

    const timer = setTimeout(checkForUpdates, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setProgress(0);
    setContentLength(0);
    setDownloaded(0);
    setError(null);
    cancelledRef.current = false;
  }, []);

  const downloadAndInstall = useCallback(async () => {
    try {
      cancelledRef.current = false;
      setError(null);
      setPhase('downloading');
      setProgress(0);
      setDownloaded(0);
      setContentLength(0);

      const update = await check();
      if (!update) {
        toast.error('Aucune mise à jour trouvée');
        setPhase('idle');
        return;
      }

      let total = 0;
      let current = 0;

      await update.downloadAndInstall((event) => {
        if (cancelledRef.current) return;
        switch (event.event) {
          case 'Started':
            total = event.data.contentLength || 0;
            current = 0;
            setContentLength(total);
            setDownloaded(0);
            setProgress(0);
            break;
          case 'Progress':
            current += event.data.chunkLength;
            setDownloaded(current);
            if (total > 0) {
              setProgress(Math.min(100, Math.round((current / total) * 100)));
            }
            break;
          case 'Finished':
            setProgress(100);
            break;
        }
      });

      if (cancelledRef.current) {
        return;
      }

      setPhase('installing');
      setProgress(100);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      setPhase('error');
      toast.error(`Échec de la mise à jour: ${msg}`);
    }
  }, []);

  const relaunchApp = useCallback(async () => {
    try {
      setPhase('restarting');
      // Petit délai pour laisser l'overlay afficher son état "Redémarrage…"
      await new Promise((r) => setTimeout(r, 600));
      await relaunch();
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      setPhase('error');
      toast.error(`Impossible de redémarrer: ${msg}`);
    }
  }, []);

  // Quand on entre en phase 'installing' et que le NSIS silencieux est en
  // cours, l'overlay attendra un peu puis tentera de relancer. Cela couvre
  // le cas où l'install se termine sans tuer l'app (rare, mais robuste).
  useEffect(() => {
    if (phase === 'installing') {
      const t = setTimeout(() => {
        relaunchApp();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, relaunchApp]);

  return {
    updateAvailable,
    updateInfo,
    phase,
    progress,
    contentLength,
    downloaded,
    error,
    downloadAndInstall,
    relaunch: relaunchApp,
    reset,
  };
}
