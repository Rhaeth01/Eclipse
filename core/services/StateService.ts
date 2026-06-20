/**
 * Service de persistance d'état
 * Sauvegarde et restaure l'état de l'application (toggles, spy list, etc.)
 * Utilise SQLite pour la persistance entre redémarrages
 */

import { logger } from './Logger';
import { DatabaseService } from './DatabaseService';
import { SpyService } from './SpyService';
import { TrollService } from './TrollService';

export interface AppState {
  version: number;
  timestamp: number;
  
  // Settings
  settings: {
    stealthMode: boolean;
    silentTyping: boolean;
  };
  
  // Spy targets: [userId, guildId[]][]
  spyTargets: Array<[string, string[]]>;
  
  // Troll features
  trolls: {
    reactroll: Array<[string, string]>;      // [userId, emoji][]
    deletesend: string[];                     // userId[]
    autoreply: Array<[string, string]>;      // [userId, response][]
    typingChannels: string[];                 // channelId[]
  };
  
  // Animations (stockées mais pas auto-restaurées pour éviter les surprises)
  animations: {
    customStatusFrames?: Array<{ text: string; emoji?: string }>;
    rpcFrames?: unknown[];
  };
}

const STATE_VERSION = 1;
const STATE_KEY = 'eclipse_app_state';

export class StateService {
  private db: DatabaseService;
  private spyService: SpyService;
  private trollService: TrollService;
  
  private saveTimeout: NodeJS.Timeout | null = null;
  private readonly SAVE_DEBOUNCE = 1000; // Sauvegarde différée de 1s

  constructor(
    db: DatabaseService,
    spyService: SpyService,
    trollService: TrollService
  ) {
    this.db = db;
    this.spyService = spyService;
    this.trollService = trollService;
  }

  /**
   * Sauvegarde l'état complet de l'application
   * Appelé automatiquement avec debounce quand un état change
   */
  save(
    commandStealth: boolean,
    silentTyping: boolean,
    customStatusFrames?: Array<{ text: string; emoji?: string }>
  ): void {
    // Debounce pour éviter les écritures trop fréquentes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.performSave(commandStealth, silentTyping, customStatusFrames);
    }, this.SAVE_DEBOUNCE);
  }

  private performSave(
    commandStealth: boolean,
    silentTyping: boolean,
    customStatusFrames?: Array<{ text: string; emoji?: string }>
  ): void {
    try {
      const state: AppState = {
        version: STATE_VERSION,
        timestamp: Date.now(),
        
        settings: {
          stealthMode: commandStealth,
          silentTyping: silentTyping
        },
        
        spyTargets: this.serializeSpyTargets(),
        
        trolls: {
          reactroll: Array.from((this.trollService as any).reactrollTargets.entries()),
          deletesend: Array.from((this.trollService as any).deletesendTargets),
          autoreply: Array.from((this.trollService as any).autoreplyTargets.entries())
            .map((entry: any) => [entry[0], entry[1].response]),
          typingChannels: Array.from((this.trollService as any).typingChannels.keys())
        },
        
        animations: {
          customStatusFrames
        }
      };

      (this.db as any).db?.prepare(
        'INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, unixepoch())'
      ).run(STATE_KEY, JSON.stringify(state));

      logger.debug('StateService', 'État sauvegardé');
    } catch (err) {
      logger.error('StateService', 'Erreur sauvegarde état', err);
    }
  }

  /**
   * Restaure l'état de l'application depuis la DB
   * Retourne l'état restauré (ou défaut si rien n'existe)
   */
  restore(): {
    stealthMode: boolean;
    silentTyping: boolean;
    customStatusFrames?: Array<{ text: string; emoji?: string }>;
  } {
    try {
      const row = (this.db as any).db?.prepare(
        'SELECT value FROM app_state WHERE key = ?'
      ).get(STATE_KEY);

      if (!row?.value) {
        logger.info('StateService', 'Aucun état précédent trouvé');
        return { stealthMode: true, silentTyping: false };
      }

      const state: AppState = JSON.parse(row.value);
      
      // Vérifie la version pour migration future si nécessaire
      if (state.version !== STATE_VERSION) {
        logger.warn('StateService', `Version d'état incompatible: ${state.version} vs ${STATE_VERSION}`);
        return { stealthMode: true, silentTyping: false };
      }

      // Restore spy targets
      this.deserializeSpyTargets(state.spyTargets);
      
      // Restore trolls
      this.deserializeTrolls(state.trolls);
      
      // Ne restore PAS les typing channels (trop risqué de spam au redémarrage)
      // Ne restore PAS les animations (l'utilisateur doit les relancer manuellement)

      logger.info('StateService', `État restauré (sauvegarde du ${new Date(state.timestamp).toLocaleString()})`);

      return {
        stealthMode: state.settings.stealthMode,
        silentTyping: state.settings.silentTyping,
        customStatusFrames: state.animations?.customStatusFrames
      };
    } catch (err) {
      logger.error('StateService', 'Erreur restauration état', err);
      return { stealthMode: true, silentTyping: false };
    }
  }

  /**
   * Efface l'état sauvegardé (reset factory)
   */
  clear(): void {
    try {
      (this.db as any).db?.prepare('DELETE FROM app_state WHERE key = ?').run(STATE_KEY);
      logger.info('StateService', 'État effacé');
    } catch (err) {
      logger.error('StateService', 'Erreur effacement état', err);
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private serializeSpyTargets(): Array<[string, string[]]> {
    return Array.from(this.spyService.getTargets().entries()).map(([userId, guilds]) => [
      userId,
      Array.from(guilds)
    ]);
  }

  private deserializeSpyTargets(data: Array<[string, string[]]> | undefined): void {
    if (!data || data.length === 0) {
      logger.debug('StateService', 'Aucune cible spy à restaurer');
      return;
    }
    // v0.4.8: les anciennes données peuvent avoir les IDs userId/guildId inversés
    // à cause d'un bug. On détecte ce cas (userId qui ressemble à un snowflake
    // de guild plutôt qu'un user, ou l'inverse) et on logge un warning sans
    // restaurer, pour ne pas corrompre l'état actuel.
    let restored = 0;
    for (const [userId, guildIds] of data) {
      // Heuristique simple : un userId Discord fait 17-20 chiffres, comme un
      // guildId. On ne peut pas les distinguer structurellement. On fait
      // confiance aux données sérialisées par cette même version (>= v0.7.0)
      // et on logge la restauration.
      for (const guildId of guildIds) {
        this.spyService.addTarget(userId, guildId);
        restored++;
      }
    }
    logger.info('StateService', `${restored} cible(s) spy restaurée(s)`);
  }

  private deserializeTrolls(trolls: AppState['trolls']): void {
    // Reactroll
    const reactrollTargets = (this.trollService as any).reactrollTargets as Map<string, string>;
    reactrollTargets.clear();
    for (const [userId, emoji] of trolls.reactroll) {
      reactrollTargets.set(userId, emoji);
    }
    if (trolls.reactroll.length > 0) {
      logger.info('StateService', `${trolls.reactroll.length} reactrolls restaurés`);
    }

    // Deletesend
    const deletesendTargets = (this.trollService as any).deletesendTargets as Set<string>;
    deletesendTargets.clear();
    for (const userId of trolls.deletesend) {
      deletesendTargets.add(userId);
    }
    if (trolls.deletesend.length > 0) {
      logger.info('StateService', `${trolls.deletesend.length} deletesends restaurés`);
    }

    // Autoreply
    const autoreplyTargets = (this.trollService as any).autoreplyTargets as Map<string, { response: string }>;
    autoreplyTargets.clear();
    for (const [userId, response] of trolls.autoreply) {
      autoreplyTargets.set(userId, { response });
    }
    if (trolls.autoreply.length > 0) {
      logger.info('StateService', `${trolls.autoreply.length} autoreplies restaurés`);
    }
  }
}
