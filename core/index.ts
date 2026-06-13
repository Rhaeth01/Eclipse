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
  logger.error('Main', 'Uncaught Exception (mode degrade, le serveur WebSocket reste actif)', err);
  // NE PAS exit(1) immediatement - laisser le WebSocket server tourner
  // pour que le frontend puisse toujours lire les logs et debugger.
  // Le handler SIGINT/SIGTERM ou la fermeture de l'exe Tauri stoppera le process.
});

process.on('unhandledRejection', (reason, promesse) => {
  logger.error('Main', 'Unhandled Rejection (mode degrade)', { reason, promesse });
});

// Démarrage
try {
  core.start();
  logger.info('Main', 'Core demarre avec succes');
} catch (err) {
  logger.error('Main', 'Erreur fatale au demarrage du Core', err);
  logger.error('Main', 'Le Core est en mode degrade. Voir les logs ci-dessus.');
  // NE PAS exit - laisser le serveur WebSocket tourner pour permettre
  // au frontend de voir les logs et debugger via core_startup.log
}

// Exposer pour debug (optionnel)
(global as any).eclipseCore = core;
