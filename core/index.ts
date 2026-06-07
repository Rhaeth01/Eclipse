/**
 * Eclipse Core - Point d'entrée principal
 * Architecture modulaire avec orchestrateur central
 */

import { EclipseCore } from './EclipseCore';
import { logger } from './services/Logger';

const PORT = 4040;

// Créer et démarrer l'application
const core = new EclipseCore({
  port: PORT,
  backupDir: require('path').join(__dirname, 'backups')
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
  logger.error('Main', 'Uncaught Exception', err);
  core.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Main', 'Unhandled Rejection', { reason, promise });
});

// Démarrage
core.start();

// Exposer pour debug (optionnel)
(global as any).eclipseCore = core;
