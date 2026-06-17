/**
 * Service de surveillance (Spy)
 * Gère la liste des cibles et notifie les événements
 */

import { EventEmitter } from 'events';
import { logger } from './Logger';

export interface SpyEvent {
  type: 'message' | 'voice_join' | 'voice_leave' | 'voice_move' | 'message_delete';
  targetId: string;
  guildId?: string;
  channelId?: string;
  data?: Record<string, unknown>;
}

export class SpyService extends EventEmitter {
  // targetId -> Set de guildIds surveillés
  private targets = new Map<string, Set<string>>();

  addTarget(userId: string, guildId: string): boolean {
    let guilds = this.targets.get(userId);
    if (!guilds) {
      guilds = new Set();
      this.targets.set(userId, guilds);
    }

    if (guilds.has(guildId)) {
      return false; // Déjà surveillé
    }

    guilds.add(guildId);
    logger.info('Spy', `Surveillance activée: ${userId} sur ${guildId}`);
    return true;
  }

  removeTarget(userId: string, guildId: string): boolean {
    const guilds = this.targets.get(userId);
    if (!guilds || !guilds.has(guildId)) {
      return false;
    }

    guilds.delete(guildId);
    if (guilds.size === 0) {
      this.targets.delete(userId);
    }
    
    logger.info('Spy', `Surveillance désactivée: ${userId} sur ${guildId}`);
    return true;
  }

  toggleTarget(userId: string, guildId: string): boolean {
    const isActive = this.isTargetActive(userId, guildId);
    if (isActive) {
      this.removeTarget(userId, guildId);
      return false;
    } else {
      this.addTarget(userId, guildId);
      return true;
    }
  }

  isTargetActive(userId: string, guildId?: string): boolean {
    const guilds = this.targets.get(userId);
    if (!guilds) return false;
    if (guildId) return guilds.has(guildId);
    return guilds.size > 0;
  }

  getTargets(): Map<string, Set<string>> {
    return new Map(this.targets);
  }

  restoreTargets(data: Array<[string, string[]]>): void {
    this.targets.clear();
    for (const [userId, guildIds] of data) {
      this.targets.set(userId, new Set(guildIds));
    }
    logger.info('Spy', `${this.targets.size} cible(s) restaurée(s)`);
  }

  getUserGuilds(userId: string): Set<string> | undefined {
    return this.targets.get(userId);
  }

  clear(): void {
    this.targets.clear();
    logger.info('Spy', 'Toutes les surveillances ont été effacées');
  }

  // ============================================================================
  // EVENT HELPERS
  // ============================================================================

  notify(event: SpyEvent): void {
    this.emit('spyEvent', event);
  }

  // Helper pour vérifier si un événement doit être notifié
  shouldNotify(userId: string, guildId?: string): boolean {
    return this.isTargetActive(userId, guildId);
  }
}
