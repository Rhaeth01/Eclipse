/**
 * Service de gestion des Discord Quests
 * Permet de compléter automatiquement les quêtes Discord
 */

import { logger } from './Logger';
import { WebSocketService } from './WebSocketService';
import { DiscordManager } from '../discord/DiscordManager';

export interface DiscordQuest {
  id: string;
  title: string;
  description: string;
  type: 'VIDEO' | 'PLAY' | 'STREAM' | 'PLAY_ACTIVITY';
  targetGame?: {
    id: string;
    name: string;
    executables: string[];
  };
  targetVideo?: {
    id: string;
    durationSeconds: number;
  };
  reward: {
    type: 'NITRO' | 'ORBS' | 'DECORATION' | 'BADGE';
    name: string;
  };
  expiresAt: string;
  progress: {
    current: number;
    target: number;
    completed: boolean;
  };
}

interface QuestConfig {
  autoCompleteVideos: boolean;
  autoCompleteGames: boolean;
  autoClaimRewards: boolean;
}

export class QuestService {
  private wsService: WebSocketService;
  private discordManager: DiscordManager;
  private activeQuests: Map<string, DiscordQuest> = new Map();
  private runningProcesses: Map<string, any> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private config: QuestConfig = {
    autoCompleteVideos: true,
    autoCompleteGames: false, // Par défaut désactivé (crée des processus)
    autoClaimRewards: true
  };

  constructor(
    wsService: WebSocketService,
    discordManager: DiscordManager
  ) {
    this.wsService = wsService;
    this.discordManager = discordManager;
  }

  /**
   * Récupère la liste des quêtes disponibles
   */
  async fetchAvailableQuests(): Promise<DiscordQuest[]> {
    try {
      const rest = this.discordManager.getRest();
      if (!rest) {
        throw new Error('REST client non disponible');
      }

      logger.info('QuestService', 'Fetching quests from Discord API...');

      const response = await rest.getQuests();
      if (!response) {
        throw new Error('Aucune réponse de l\'API quests');
      }

      // v0.4.3: logs de debug (raw response peut faire plusieurs KB et spam
      // la console). Avant: log.info() à chaque getQuests().
      logger.debug('QuestService', `Raw response type: ${typeof response}`);
      logger.debug('QuestService', `Is Array: ${Array.isArray(response)}`);

      const responseStr = JSON.stringify(response);
      logger.debug('QuestService', `Response length: ${responseStr.length}`);

      if (responseStr.length > 0) {
        logger.debug('QuestService', `Raw response: ${responseStr.substring(0, 2000)}`);
      }

      // Parse la réponse
      let questsArray: any[] = [];
      if (Array.isArray(response)) {
        questsArray = response;
      } else if (response && typeof response === 'object') {
        questsArray = response.quests || response.data || response.user_quests || [];
      }

      logger.debug('QuestService', `Found ${questsArray.length} raw quests`);

      const quests: DiscordQuest[] = questsArray
        .map((q: any) => this.parseQuest(q))
        .filter((q): q is DiscordQuest => q !== null);
      
      this.activeQuests.clear();
      quests.forEach(q => this.activeQuests.set(q.id, q));

      logger.info('QuestService', `${quests.length} quêtes parsées avec succès`);
      this.broadcastQuestsUpdate();
      
      return quests;
    } catch (err: any) {
      logger.error('QuestService', 'Erreur récupération quests', err);
      logger.error('QuestService', `Error details: ${err.message}`);
      if (err.status) {
        logger.error('QuestService', `HTTP Status: ${err.status}`);
      }
      
      // Broadcast quand même une liste vide pour arrêter le loading
      this.wsService.broadcast({
        type: 'quests_update',
        quests: []
      });
      
      return [];
    }
  }

  /**
   * Accepte une quête
   */
  async acceptQuest(questId: string): Promise<boolean> {
    try {
      const rest = this.discordManager.getRest();
      if (!rest) return false;

      await rest.acceptQuest(questId);
      logger.info('QuestService', `Quête ${questId} acceptée`);
      
      // Re-fetch les quêtes pour avoir les données à jour
      await this.fetchAvailableQuests();
      
      return true;
    } catch (err) {
      logger.error('QuestService', `Erreur acceptation quête ${questId}`, err);
      return false;
    }
  }

  /**
   * Démarre l'auto-complétion d'une quête
   */
  async startQuestCompletion(questId: string): Promise<void> {
    const quest = this.activeQuests.get(questId);
    if (!quest) {
      logger.warn('QuestService', `Quête ${questId} non trouvée`);
      return;
    }

    if (quest.progress.completed) {
      logger.info('QuestService', `Quête ${questId} déjà complétée`);
      if (this.config.autoClaimRewards) {
        await this.claimReward(questId);
      }
      return;
    }

    logger.info('QuestService', `Démarrage complétion quête ${quest.type}: ${quest.title}`);

    switch (quest.type) {
      case 'VIDEO':
        await this.startVideoQuest(quest);
        break;
      case 'PLAY':
        await this.startPlayQuest(quest);
        break;
      case 'STREAM':
        logger.warn('QuestService', 'Quêtes STREAM non supportées automatiquement');
        this.broadcastToast('Quest Stream', 'Requiert un canal vocal avec spectateurs');
        break;
      case 'PLAY_ACTIVITY':
        await this.startActivityQuest(quest);
        break;
    }
  }

  /**
   * Arrête l'auto-complétion d'une quête
   */
  stopQuestCompletion(questId: string): void {
    // Arrête les heartbeats
    const heartbeatInterval = this.heartbeatIntervals.get(questId);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      this.heartbeatIntervals.delete(questId);
    }

    // Tue le processus simulé si existe
    const process = this.runningProcesses.get(questId);
    if (process) {
      this.stopDummyProcess(process);
      this.runningProcesses.delete(questId);
    }

    logger.info('QuestService', `Complétion arrêtée pour quête ${questId}`);
    this.broadcastStatus(questId, 'stopped');
  }

  /**
   * Complète une quête vidéo (envoie des heartbeats)
   */
  private async startVideoQuest(quest: DiscordQuest): Promise<void> {
    if (!quest.targetVideo) return;

    const selfbot = this.discordManager.getSelfbot();
    if (!selfbot) return;

    const duration = quest.targetVideo.durationSeconds;
    const heartbeatInterval = 10; // Heartbeat toutes les 10 secondes
    let elapsed = quest.progress.current;

    logger.info('QuestService', `Vidéo quest: ${duration}s total, déjà ${elapsed}s`);

    const interval = setInterval(async () => {
      try {
        elapsed += heartbeatInterval;
        
        // Envoie le heartbeat à l'API Discord
        const rest = this.discordManager.getRest();
        if (rest) {
          await rest.heartbeatQuest(quest.id, {
            videoId: quest.targetVideo!.id,
            timestamp: elapsed
          });
        }

        this.broadcastProgress(quest.id, elapsed, duration);

        if (elapsed >= duration) {
          clearInterval(interval);
          this.heartbeatIntervals.delete(quest.id);
          logger.info('QuestService', `Quête vidéo ${quest.id} complétée!`);
          this.broadcastStatus(quest.id, 'completed');
          
          if (this.config.autoClaimRewards) {
            await this.claimReward(quest.id);
          }
        }
      } catch (err) {
        logger.error('QuestService', 'Erreur heartbeat vidéo', err);
      }
    }, heartbeatInterval * 1000);

    this.heartbeatIntervals.set(quest.id, interval);
    this.broadcastStatus(quest.id, 'running');
  }

  /**
   * Complète une quête jeu (lance un processus factice)
   */
  private async startPlayQuest(quest: DiscordQuest): Promise<void> {
    if (!quest.targetGame?.executables.length) return;

    const executable = quest.targetGame.executables[0];
    logger.info('QuestService', `Lancement processus factice: ${executable}`);

    try {
      // Crée et lance un processus factice
      const process = await this.launchDummyProcess(executable, quest.targetGame.name);
      this.runningProcesses.set(quest.id, process);

      this.broadcastStatus(quest.id, 'running');
      
      // Surveille la progression via l'API
      this.monitorQuestProgress(quest);
    } catch (err) {
      logger.error('QuestService', 'Erreur lancement processus', err);
      this.broadcastToast('Erreur Quest', 'Impossible de lancer le processus factice');
    }
  }

  /**
   * Complète une quête activité (via RPC)
   */
  private async startActivityQuest(quest: DiscordQuest): Promise<void> {
    // Utilise le Rich Presence pour simuler l'activité
    logger.info('QuestService', `Démarrage activité: ${quest.targetGame?.name}`);
    
    // Pour l'instant, on utilise juste le monitoring
    // L'implémentation complète nécessiterait d'envoyer des updates RPC
    this.broadcastToast('Quest Activité', 'Mode activité démarré (beta)');
    this.monitorQuestProgress(quest);
  }

  /**
   * Surveille la progression d'une quête via polling
   */
  private monitorQuestProgress(quest: DiscordQuest): void {
    const interval = setInterval(async () => {
      try {
        const rest = this.discordManager.getRest();
        if (!rest) return;

        const response = await rest.getQuests();
        const updatedQuest = response.find((q: any) => q.id === quest.id);
        
        if (updatedQuest) {
          const parsed = this.parseQuest(updatedQuest);
          if (!parsed) return;
          
          this.activeQuests.set(quest.id, parsed);
          
          this.broadcastProgress(quest.id, parsed.progress.current, parsed.progress.target);

          if (parsed.progress.completed) {
            clearInterval(interval);
            this.stopQuestCompletion(quest.id);
            
            if (this.config.autoClaimRewards) {
              await this.claimReward(quest.id);
            }
          }
        }
      } catch (err) {
        logger.error('QuestService', 'Erreur monitoring progression', err);
      }
    }, 30000); // Check toutes les 30s

    this.heartbeatIntervals.set(quest.id, interval);
  }

  /**
   * Réclame la récompense d'une quête
   */
  async claimReward(questId: string): Promise<boolean> {
    try {
      const rest = this.discordManager.getRest();
      if (!rest) return false;

      await rest.claimQuestReward(questId);
      logger.info('QuestService', `Récompense réclamée pour quête ${questId}`);
      
      this.broadcastToast('Quest Complétée!', 'Récompense réclamée avec succès');
      this.broadcastStatus(questId, 'claimed');
      
      return true;
    } catch (err) {
      logger.error('QuestService', `Erreur réclamation récompense ${questId}`, err);
      return false;
    }
  }

  /**
   * Parse une quête depuis la réponse API Discord
   */
  private parseQuest(apiQuest: any): DiscordQuest | null {
    try {
      if (!apiQuest || !apiQuest.id) {
        logger.warn('QuestService', 'Invalid quest data: missing id');
        return null;
      }

      // Discord peut retourner différentes structures
      const config = apiQuest.config || apiQuest;
      const progress = apiQuest.user_progress || apiQuest.progress || { current: 0, target: 1, completed: false };
      
      // Détermine le type de quête
      let questType: DiscordQuest['type'] = 'PLAY';
      const taskType = config.task_type || config.taskType || 'PLAY';
      if (taskType.includes('VIDEO')) questType = 'VIDEO';
      else if (taskType.includes('STREAM')) questType = 'STREAM';
      else if (taskType.includes('ACTIVITY')) questType = 'PLAY_ACTIVITY';

      // Parse la récompense
      let rewardType: DiscordQuest['reward']['type'] = 'ORBS';
      const rawRewardType = config.reward_type || config.rewardType || 'orbs';
      if (rawRewardType.includes('NITRO')) rewardType = 'NITRO';
      else if (rawRewardType.includes('DECORATION')) rewardType = 'DECORATION';
      else if (rawRewardType.includes('BADGE')) rewardType = 'BADGE';

      const quest: DiscordQuest = {
        id: apiQuest.id,
        title: config.title || config.name || 'Quête sans nom',
        description: config.description || config.desc || '',
        type: questType,
        targetGame: config.game ? {
          id: config.game.id,
          name: config.game.name,
          executables: config.game.executables?.map((e: any) => e.name || e) || []
        } : undefined,
        targetVideo: config.video ? {
          id: config.video.id,
          durationSeconds: config.video.duration_seconds || config.video.durationSeconds || 0
        } : undefined,
        reward: {
          type: rewardType,
          name: config.reward_name || config.rewardName || 'Récompense'
        },
        expiresAt: apiQuest.expires_at || apiQuest.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        progress: {
          current: progress.current || progress.value || 0,
          target: progress.target || progress.targetValue || 1,
          completed: progress.completed || progress.claimed || false
        }
      };

      logger.debug('QuestService', `Parsed quest: ${quest.title} (${quest.type})`);
      return quest;
    } catch (err) {
      logger.error('QuestService', 'Error parsing quest', err);
      return null;
    }
  }

  /**
   * Lance un processus factice (simulation)
   * Note: Sur Windows, crée un petit exe temporaire avec le bon nom
   */
  private async launchDummyProcess(executableName: string, gameName: string): Promise<any> {
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    const os = require('os');

    // Sur Windows: crée un exe factice dans un dossier temporaire
    if (os.platform() === 'win32') {
      const tempDir = path.join(os.tmpdir(), 'eclipse_quests', gameName.replace(/\s+/g, '_'));
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const exePath = path.join(tempDir, executableName);
      
      // Copie un template exe ou crée un simple processus Node
      // Pour l'instant, on utilise un simple processus Node renommé
      // v0.4.3: backticks pour interpoler ${gameName} (avant: le string
      // contenait littéralement '${gameName}' au lieu du nom du jeu).
      const dummyScript = `console.log('Dummy process for ${gameName}'); setInterval(() => {}, 1000);`;
      
      const scriptPath = path.join(tempDir, 'dummy.js');
      fs.writeFileSync(scriptPath, dummyScript);

      // Crée un wrapper batch avec le nom du jeu
      const batContent = `@echo off\nnode "${scriptPath}"\n`;
      const batPath = path.join(tempDir, executableName.replace('.exe', '.bat'));
      fs.writeFileSync(batPath, batContent);

      // Lance le processus
      const proc = spawn('node', [scriptPath], {
        detached: true,
        stdio: 'ignore',
        cwd: tempDir
      });

      proc.unref();
      
      logger.info('QuestService', `Processus factice lancé: ${batPath} (PID: ${proc.pid})`);
      
      return { pid: proc.pid, path: batPath, type: 'node' };
    }
    
    // Linux/Mac: processus simple
    const proc = spawn('sleep', ['3600'], { detached: true });
    proc.unref();
    return { pid: proc.pid, type: 'unix' };
  }

  /**
   * Arrête un processus factice et nettoie les fichiers temporaires.
   * v0.4.1 (audit fix): avant, les .bat et dummy.js étaient créés dans
   * os.tmpdir() mais jamais supprimés → disk leak. Maintenant on supprime
   * le dossier complet à l'arrêt.
   */
  private stopDummyProcess(processInfo: any): void {
    try {
      if (processInfo.pid) {
        process.kill(processInfo.pid);
        logger.info('QuestService', `Processus ${processInfo.pid} arrêté`);
      }
    } catch (err) {
      logger.warn('QuestService', 'Erreur arrêt processus', err);
    }

    // Cleanup des fichiers temporaires (.bat, dummy.js, etc.)
    if (processInfo.path) {
      try {
        const fs = require('fs');
        const path = require('path');
        const dir = path.dirname(processInfo.path);
        // Petit délai pour s'assurer que le process Node a libéré les fichiers
        setTimeout(() => {
          try {
            fs.rmSync(dir, { recursive: true, force: true });
            logger.info('QuestService', `Dossier temporaire ${dir} supprimé`);
          } catch (err) {
            logger.warn('QuestService', `Impossible de supprimer ${dir}`, err);
          }
        }, 500);
      } catch (err) {
        logger.warn('QuestService', 'Erreur cleanup tmp', err);
      }
    }
  }

  // ============================================================================
  // WEBSOCKET BROADCAST
  // ============================================================================

  private broadcastQuestsUpdate(): void {
    const quests = Array.from(this.activeQuests.values());
    this.wsService.broadcast({
      type: 'quests_update',
      quests
    });
  }

  private broadcastProgress(questId: string, current: number, target: number): void {
    this.wsService.broadcast({
      type: 'quest_progress',
      questId,
      current,
      target,
      percent: Math.round((current / target) * 100)
    });
  }

  private broadcastStatus(questId: string, status: 'running' | 'stopped' | 'completed' | 'claimed'): void {
    this.wsService.broadcast({
      type: 'quest_status',
      questId,
      status
    });
  }

  private broadcastToast(title: string, message: string): void {
    this.wsService.broadcast({
      type: 'toast',
      title,
      content: message
    });
  }

  // ============================================================================
  // GETTERS / SETTERS
  // ============================================================================

  getActiveQuests(): DiscordQuest[] {
    return Array.from(this.activeQuests.values());
  }

  getRunningQuests(): string[] {
    return Array.from(this.heartbeatIntervals.keys());
  }

  updateConfig(newConfig: Partial<QuestConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): QuestConfig {
    return { ...this.config };
  }

  /**
   * Crée des quêtes de test pour démonstration
   */
  createMockQuests(): DiscordQuest[] {
    const mockQuests: DiscordQuest[] = [
      {
        id: 'mock_video_quest',
        title: 'Regarde la bande-annonce',
        description: 'Visionne la vidéo pendant 2 minutes pour débloquer la récompense',
        type: 'VIDEO',
        targetVideo: {
          id: 'video_123',
          durationSeconds: 120
        },
        reward: {
          type: 'ORBS',
          name: '100 Orbs'
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        progress: {
          current: 0,
          target: 120,
          completed: false
        }
      },
      {
        id: 'mock_game_quest',
        title: 'Joue à Fortnite',
        description: 'Joue pendant 15 minutes pour débloquer la récompense',
        type: 'PLAY',
        targetGame: {
          id: 'game_fortnite',
          name: 'Fortnite',
          executables: ['FortniteClient-Win64-Shipping.exe']
        },
        reward: {
          type: 'NITRO',
          name: 'Nitro 1 mois'
        },
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        progress: {
          current: 0,
          target: 900,
          completed: false
        }
      },
      {
        id: 'mock_completed_quest',
        title: 'Stream League of Legends',
        description: 'Stream à un ami pendant 30 minutes',
        type: 'STREAM',
        targetGame: {
          id: 'game_lol',
          name: 'League of Legends',
          executables: ['League of Legends.exe']
        },
        reward: {
          type: 'DECORATION',
          name: 'Avatar LOL'
        },
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        progress: {
          current: 1800,
          target: 1800,
          completed: true
        }
      }
    ];

    mockQuests.forEach(q => this.activeQuests.set(q.id, q));
    this.broadcastQuestsUpdate();
    
    logger.info('QuestService', `${mockQuests.length} quêtes de test créées`);
    return mockQuests;
  }
}
