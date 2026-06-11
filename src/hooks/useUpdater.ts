'use client';

import { useEffect, useState, useCallback } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { toast } from 'sonner';

interface UpdateInfo {
  version: string;
  body?: string;
  date?: string;
}

export function useUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);

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

  const downloadAndInstall = useCallback(async () => {
    try {
      setDownloading(true);
      const update = await check();
      if (!update) {
        toast.error('Aucune mise à jour trouvée');
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            downloaded = 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            break;
          case 'Finished':
            break;
        }
      });

      toast.success('Mise à jour installée, redémarrage...');
      await update.install();
    } catch (err: any) {
      toast.error(`Échec de la mise à jour: ${err.message || err}`);
    } finally {
      setDownloading(false);
    }
  }, []);

  return { updateAvailable, updateInfo, downloading, downloadAndInstall };
}
