/**
 * Service AutoSlash - Exécute automatiquement des commandes slash
 * Principalement utilisé pour les bumps (Disboard, etc.)
 */

import { EventEmitter } from 'events';
import { logger } from './Logger';

export interface BumpConfig {
  channelId: string;
  guildId: string;
  interval: number; // En millisecondes (par défaut 2h = 7200000ms)
  enabled: boolean;
  lastBump?: number;
  nextBump?: number;
}

export class AutoSlashService extends EventEmitter {
  private bumpConfigs = new Map<string, BumpConfig>(); // guildId -> config
  // v0.4.1 (audit fix): deux maps séparées pour le setTimeout initial
  // et le setInterval qui le suit. Avant: la même map contenait successivement
  // un Timeout puis un Interval, ce qui causait des leaks si disableBump
  // était appelé entre les deux phases.
  private initialTimeouts = new Map<string, NodeJS.Timeout>();
  private intervals = new Map<string, NodeJS.Timeout>();

  // Callback pour exécuter les commandes slash
  private slashExecutor?: {
    executeSlash: (guildId: string, channelId: string, commandName: string, options?: any) => Promise<void>;
  };

  setSlashExecutor(executor: {
    executeSlash: (guildId: string, channelId: string, commandName: string, options?: any) => Promise<void>;
  }): void {
    this.slashExecutor = executor;
  }

  /**
   * Active le bump automatique pour un serveur
   */
  // Sécurité: intervalle minimum (Disboard = 120min minimum)
  private readonly MIN_INTERVAL_MINUTES = 60;
  private readonly DEFAULT_INTERVAL_MINUTES = 120;
  private readonly MAX_ACTIVE_BUMPS = 10; // Limite globale

  enableBump(guildId: string, channelId: string, intervalMinutes = this.DEFAULT_INTERVAL_MINUTES, offsetMinutes = 0): { success: boolean; error?: string } {
    try {
      // Vérifier la limite globale
      if (this.getActiveBumps().length >= this.MAX_ACTIVE_BUMPS) {
        return { success: false, error: `Limite de ${this.MAX_ACTIVE_BUMPS} bumps simultanés atteinte` };
      }

      // Valider l'intervalle minimum (sécurité anti-spam)
      if (intervalMinutes < this.MIN_INTERVAL_MINUTES) {
        logger.warn('AutoSlash', `Intervalle ${intervalMinutes}min trop court, utilisation de ${this.MIN_INTERVAL_MINUTES}min`);
        intervalMinutes = this.MIN_INTERVAL_MINUTES;
      }

      // Valider l'intervalle maximum (éviter les bugs)
      if (intervalMinutes > 1440) { // 24h max
        intervalMinutes = 1440;
      }

      // Arrête l'ancien interval si existe
      this.disableBump(guildId);

      const config: BumpConfig = {
        channelId,
        guildId,
        interval: intervalMinutes * 60 * 1000,
        enabled: true,
        lastBump: 0,
        nextBump: Date.now() + (offsetMinutes > 0 ? (offsetMinutes * 60 * 1000) : 5000)
      };

      this.bumpConfigs.set(guildId, config);
      this.startBumpInterval(guildId);

      logger.info('AutoSlash', `Bump auto activé pour ${guildId} dans <#${channelId}> toutes les ${intervalMinutes}min avec offset ${offsetMinutes}min`);
      this.emit('bumpEnabled', { guildId, channelId, intervalMinutes, offsetMinutes });
      return { success: true };
    } catch (err) {
      logger.error('AutoSlash', 'Erreur activation bump', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Désactive le bump automatique
   */
  disableBump(guildId: string): boolean {
    // v0.4.1: nettoyer les DEUX maps (initial timeout + interval)
    const initial = this.initialTimeouts.get(guildId);
    if (initial) {
      clearTimeout(initial);
      this.initialTimeouts.delete(guildId);
    }
    const interval = this.intervals.get(guildId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(guildId);
    }

    const config = this.bumpConfigs.get(guildId);
    if (config) {
      config.enabled = false;
      this.bumpConfigs.set(guildId, config);
      logger.info('AutoSlash', `Bump auto désactivé pour ${guildId}`);
      this.emit('bumpDisabled', { guildId });
      return true;
    }
    return false;
  }

  /**
   * Démarre l'interval de bump
   */
  private startBumpInterval(guildId: string): void {
    const config = this.bumpConfigs.get(guildId);
    if (!config || !config.enabled) return;

    // Calcul du délai initial avant le tout premier bump
    const initialDelay = Math.max(0, (config.nextBump || Date.now()) - Date.now());

    const initialTimeout = setTimeout(() => {
      this.initialTimeouts.delete(guildId);
      this.executeBump(guildId);

      // Interval régulier qui s'amorce après le bump initial
      const interval = setInterval(() => {
        this.executeBump(guildId);
      }, config.interval);

      // Met à jour la référence vers l'interval (map séparée du setTimeout)
      this.intervals.set(guildId, interval);
    }, initialDelay);

    // Stocke dans la map des timeouts (distincte de celle des intervals)
    this.initialTimeouts.set(guildId, initialTimeout);
  }

  /**
   * Exécute la commande /bump
   */
  private async executeBump(guildId: string): Promise<void> {
    const config = this.bumpConfigs.get(guildId);
    if (!config || !this.slashExecutor) return;

    try {
      logger.info('AutoSlash', `Exécution bump pour ${guildId}`);

      await this.slashExecutor.executeSlash(
        guildId,
        config.channelId,
        'bump'
      );

      config.lastBump = Date.now();
      config.nextBump = Date.now() + config.interval;
      this.bumpConfigs.set(guildId, config);

      this.emit('bumpExecuted', {
        guildId,
        channelId: config.channelId,
        timestamp: config.lastBump
      });

    } catch (err) {
      logger.error('AutoSlash', `Erreur bump ${guildId}`, err);
      this.emit('bumpError', { guildId, error: err });
    }
  }

  /**
   * Gère la réponse du bot de bump
   * Utile pour détecter les cooldowns
   */
  handleBumpResponse(guildId: string, messageContent: string): void {
    const config = this.bumpConfigs.get(guildId);
    if (!config) return;

    // Détecte les messages de cooldown
    const cooldownPatterns = [
      /wait\s+(\d+)\s+(minute|hour|second)/i,
      /cooldown\s*:\s*(\d+)/i,
      /please\s+wait/i,
      /déjà\s+bump/i,
      /already\s+bumped/i
    ];

    const hasCooldown = cooldownPatterns.some(pattern => pattern.test(messageContent));

    if (hasCooldown) {
      logger.warn('AutoSlash', `Cooldown détecté pour ${guildId}`);

      // Essaie d'extraire le temps d'attente
      const timeMatch = messageContent.match(/(\d+)\s*(minute|hour|min|h)/i);
      if (timeMatch) {
        const amount = parseInt(timeMatch[1]);
        const unit = timeMatch[2].toLowerCase();
        const delayMs = unit.startsWith('h') ? amount * 60 * 60 * 1000 : amount * 60 * 1000;

        // Recalcule le prochain bump
        config.nextBump = Date.now() + delayMs;
        this.bumpConfigs.set(guildId, config);

        this.emit('bumpCooldown', { guildId, delayMs, message: messageContent });
      }
    } else if (messageContent.includes('bumped') || messageContent.includes('done')) {
      logger.info('AutoSlash', `Bump confirmé pour ${guildId}`);
      this.emit('bumpSuccess', { guildId, channelId: config.channelId });
    }
  }

  /**
   * Récupère le statut du bump pour un serveur
   */
  getBumpStatus(guildId: string): BumpConfig | null {
    return this.bumpConfigs.get(guildId) || null;
  }

  /**
   * Liste tous les bumps actifs
   */
  getActiveBumps(): BumpConfig[] {
    return Array.from(this.bumpConfigs.values()).filter(c => c.enabled);
  }

  /**
   * Calcule le temps restant avant le prochain bump
   */
  getTimeUntilBump(guildId: string): number {
    const config = this.bumpConfigs.get(guildId);
    if (!config || !config.nextBump) return 0;
    return Math.max(0, config.nextBump - Date.now());
  }

  /**
   * Formate le temps restant en lisible
   */
  formatTimeRemaining(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  }
}
