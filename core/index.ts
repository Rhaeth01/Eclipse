/**
 * Eclipse Core - Point d'entrée principal
 * Architecture modulaire avec orchestrateur central
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EclipseCore } from './EclipseCore';
import { logger } from './services/Logger';

const PORT = 4040;

/**
 * Lit le secret WS généré par Tauri (src-tauri/src/secure_store.rs).
 * Si absent (dev mode, premier lancement, ou Linux sans Tauri), démarre
 * sans auth (mode dev) — un warning est loggé.
 */
function loadWsSecret(): string | null {
  const secretPath = process.env.ECLIPSE_WS_SECRET_PATH
    || (process.platform === 'win32'
      ? path.join(process.env.APPDATA || '', 'Eclipse', 'ws_secret.bin')
      : path.join(os.homedir(), '.config', 'eclipse', 'ws_secret.bin'));

  try {
    if (fs.existsSync(secretPath)) {
      const secret = fs.readFileSync(secretPath, 'utf-8').trim();
      if (secret) {
        logger.info('Main', `Secret WS chargé depuis ${secretPath}`);
        return secret;
      }
    }
  } catch (err) {
    logger.warn('Main', `Impossible de lire le secret WS: ${err}`);
  }
  logger.warn('Main', 'Aucun secret WS configuré — auth désactivée (mode dev). NE PAS UTILISER EN PRODUCTION.');
  return null;
}

const wsSecret = loadWsSecret();

// Créer et démarrer l'application
const core = new EclipseCore({
  port: PORT,
  backupDir: path.join(__dirname, 'backups'),
  wsSecret: wsSecret ?? undefined
});

// Gestion des signaux de terminaison
process.on('SIGINT', () => {
  logger.info('Main', 'SIGINT reçu, arrêt...');
  core.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Main', 'SIGTERM reçu, arrêt...');
  core.stop();
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (err) => {
  logger.error('Main', 'Uncaught Exception (mode degrade, le serveur WebSocket reste actif)', err);
  // NE PAS exit(1) immediatement - laisser le WebSocket server tourner
  // pour que le frontend puisse toujours lire les logs et debugger.
  // Le handler SIGINT/SIGTERM ou la fermeture de l'exe Tauri stoppera le process.
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Main', 'Unhandled Rejection (mode degrade)', { reason, promise });
});

// Démarrage
try {
  core.start();
  logger.info('Main', 'Core demarre avec succes' + (wsSecret ? ' (WS auth activee)' : ' (WS SANS auth - dev mode)'));
} catch (err) {
  logger.error('Main', 'Erreur fatale au demarrage du Core', err);
  logger.error('Main', 'Le Core est en mode degrade. Voir les logs ci-dessus.');
  // NE PAS exit - laisser le serveur WebSocket tourner pour permettre
  // au frontend de voir les logs et debugger via core_startup.log
}

// Exposer pour debug (optionnel)
(global as any).eclipseCore = core;
