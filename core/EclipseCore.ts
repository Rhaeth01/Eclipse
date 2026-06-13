/**
 * Eclipse Core - Orchestrateur principal
 * Initialise et coordonne tous les services
 */

import { WebSocketService } from './services/WebSocketService';
import { AnimationService } from './services/AnimationService';
import { DatabaseService } from './services/DatabaseService';
import { BackupService } from './services/BackupService';
import { SpyService } from './services/SpyService';
import { TrollService } from './services/TrollService';
import { StateService } from './services/StateService';
import { QuestService } from './services/QuestService';
import { SniperService } from './services/SniperService';
import { AutoSlashService } from './services/AutoSlashService';
import { DiscordManager } from './discord/DiscordManager';
import { MessageHandler, MessageHandlerContext } from './handlers/MessageHandler';
import { BotSetupService } from './services/BotSetupService';
import { logger } from './services/Logger';
import type { WsMessage, InitMessage, ErrorMessage } from './shared/types';
import * as path from 'path';

export interface EclipseCoreConfig {
  port: number;
  backupDir?: string;
}

export class EclipseCore {
  private wsService: WebSocketService;
  private animationService: AnimationService;
  private dbService: DatabaseService;
  private backupService: BackupService;
  private spyService: SpyService;
  private trollService: TrollService;
  private stateService: StateService;
  private questService: QuestService;
  private sniperService: SniperService;
  private autoSlashService: AutoSlashService;
  private discordManager: DiscordManager;
  private messageHandler: MessageHandler;
  private botSetupService: BotSetupService;

  private commandStealth = true;
  private silentTyping = false;
  private isRunning = false;

  constructor(config: EclipseCoreConfig) {
    // Services
    this.wsService = new WebSocketService({ port: config.port });
    this.animationService = new AnimationService();
    this.dbService = new DatabaseService();
    this.backupService = new BackupService(config.backupDir);
    this.spyService = new SpyService();
    this.trollService = new TrollService();

    // State Service (pour persistance)
    this.stateService = new StateService(
      this.dbService,
      this.spyService,
      this.trollService
    );

    // Discord Manager
    this.discordManager = new DiscordManager(
      this.wsService,
      this.dbService,
      this.spyService,
      this.trollService
    );

    // Quest Service
    this.questService = new QuestService(
      this.wsService,
      this.discordManager
    );

    // Sniper Service
    this.sniperService = new SniperService();

    // AutoSlash Service
    this.autoSlashService = new AutoSlashService();

    // Bot Setup Service
    this.botSetupService = new BotSetupService(this.wsService);

    // Message Handler
    const context: MessageHandlerContext = {
      wsService: this.wsService,
      animationService: this.animationService,
      dbService: this.dbService,
      backupService: this.backupService,
      spyService: this.spyService,
      trollService: this.trollService,
      stateService: this.stateService,
      autoSlashService: this.autoSlashService,
      discordClient: null,
      getCommandStealth: () => this.commandStealth,
      setCommandStealth: (v) => {
        this.commandStealth = v;
        this.saveState();
      },
      getSilentTyping: () => this.silentTyping,
      setSilentTyping: (v) => {
        this.silentTyping = v;
        this.saveState();
      }
    };
    this.messageHandler = new MessageHandler(context);

    this.setupEventHandlers();
    this.setupQuestHandlers();
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  start(): void {
    if (this.isRunning) {
      logger.warn('EclipseCore', 'Déjà en cours d\'exécution');
      return;
    }

    logger.info('EclipseCore', '=== Démarrage d\'Eclipse Core ===');

    // Setup log forwarding to WebSocket clients
    logger.onLog((entry) => {
      // N'envoie que les erreurs critiques au frontend pour éviter le spam
      if (entry.level === 'error') {
        this.wsService.broadcast({
          type: 'core_log',
          level: entry.level,
          module: entry.module,
          message: entry.message,
          logTimestamp: entry.timestamp.toISOString()
        } as any);
      }
    });

    try {
      // Connecter la DB (peut échouer si better-sqlite3 corrompu/permissions)
      this.dbService.connect();
    } catch (err) {
      logger.error('EclipseCore', 'DB connect a échoué (mode degrade)', err);
    }

    try {
      // Démarrer le WebSocket (essentiel — c'est le canal de communication)
      this.wsService.start();
    } catch (err) {
      logger.error('EclipseCore', 'WebSocket start a échoué (CRITIQUE)', err);
      // On propage : si le WS échoue, le frontend ne pourra pas se connecter
      throw err;
    }

    this.isRunning = true;
    logger.info('EclipseCore', '=== Eclipse Core prêt ===');
  }

  stop(): void {
    if (!this.isRunning) return;

    logger.info('EclipseCore', '=== Arrêt d\'Eclipse Core ===');

    // Arrêter les animations
    this.animationService.stopAll();
    this.trollService.stopAllTyping();

    // Déconnecter Discord
    this.discordManager.disconnect();

    // Arrêter les services
    this.wsService.stop();
    this.dbService.close();

    this.isRunning = false;
    logger.info('EclipseCore', '=== Eclipse Core arrêté ===');
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  private setupEventHandlers(): void {
    // WebSocket events
    this.wsService.on('clientConnected', (clientId) => {
      logger.info('EclipseCore', `Client UI connecté: ${clientId}`);
    });

    this.wsService.on('clientDisconnected', (clientId) => {
      logger.info('EclipseCore', `Client UI déconnecté: ${clientId}`);
    });

    this.wsService.on('message', async (clientId, message) => {
      await this.handleMessage(clientId, message);
    });

    this.wsService.on('error', (err) => {
      logger.error('EclipseCore', 'Erreur WebSocket', err);
    });

    // Discord events
    this.discordManager.on('ready', ({ tag }) => {
      // Connecter le client au service d'animation
      this.animationService.setClient(this.discordManager.getSelfbot());

      logger.info('EclipseCore', `Discord prêt: ${tag}`);

      // Mettre à jour le context du message handler
      (this.messageHandler as any).context.discordClient = this.discordManager.getSelfbot();

      // Setup Sniper Service handlers
      this.setupSniperHandlers();

      // Setup AutoSlash Service handlers
      this.setupAutoSlashHandlers();

      // Restaurer l'état précédent
      this.restoreState();
    });
  }

  private restoreState(): void {
    try {
      const state = this.stateService.restore();
      this.commandStealth = state.stealthMode;
      this.silentTyping = state.silentTyping;

      logger.info('EclipseCore', `État restauré - Stealth: ${this.commandStealth}, SilentTyping: ${this.silentTyping}`);

      // Notifier le frontend du mode stealth restauré
      const firstClient = this.wsService.getFirstClientId();
      if (firstClient) {
        this.wsService.sendToClient(firstClient, {
          type: 'status',
          message: 'state_restored',
          stealthMode: this.commandStealth,
          silentTyping: this.silentTyping
        } as any);
      }
    } catch (err) {
      logger.error('EclipseCore', 'Erreur restauration etat (mode degrade, defaut applique)', err);
      // Valeurs par défaut déjà en place (stealth=true, silentTyping=false)
    }
  }

  private saveState(): void {
    this.stateService.save(this.commandStealth, this.silentTyping);
  }

  // ============================================================================
  // MESSAGE ROUTING
  // ============================================================================

  private async handleMessage(clientId: string, message: WsMessage): Promise<void> {
    // Message d'init est traité spécialement
    if (message.type === 'init') {
      await this.handleInit(clientId, message as InitMessage);
      return;
    }

    // save_bot_token peut arriver à tout moment (avant ou après init)
    if (message.type === 'save_bot_token') {
      await this.handleSaveBotToken(clientId, message as any);
      return;
    }

    // auto_setup_bot peut arriver à tout moment
    if (message.type === 'auto_setup_bot') {
      await this.handleAutoSetup(clientId, message as any);
      return;
    }

    // Vérifier que Discord est connecté pour les autres messages
    if (!this.discordManager.getSelfbot()?.isReady()) {
      const errorMsg: ErrorMessage = {
        type: 'error',
        message: 'Discord non connecté. Veuillez vous authentifier d\'abord.'
      };
      this.wsService.sendToClient(clientId, errorMsg);
      return;
    }

    // Router vers le handler
    await this.messageHandler.handle(clientId, message);
  }

  private async handleInit(clientId: string, message: InitMessage): Promise<void> {
    logger.info('EclipseCore', 'Tentative de connexion Discord...');

    try {
      await this.discordManager.connect({
        userToken: message.token,
        appToken: message.appToken
      });

      logger.info('EclipseCore', 'Connexion Discord réussie');
    } catch (err) {
      logger.error('EclipseCore', 'Erreur connexion Discord', err);
      const errorMsg: ErrorMessage = {
        type: 'error',
        message: `Erreur de connexion Discord: ${err instanceof Error ? err.message : 'Unknown'}`
      };
      this.wsService.sendToClient(clientId, errorMsg);
    }
  }

  private async handleSaveBotToken(clientId: string, message: { appToken: string }): Promise<void> {
    logger.info('EclipseCore', 'Sauvegarde du token App Bot...');

    const result = await this.discordManager.saveAndConnectBotToken(message.appToken);

    if (result.success) {
      this.wsService.sendToClient(clientId, {
        type: 'bot_token_saved',
        success: true,
        message: result.message
      });
    } else {
      this.wsService.sendToClient(clientId, {
        type: 'bot_token_saved',
        success: false,
        message: result.message
      });
    }
  }

  private async handleAutoSetup(clientId: string, message: { appName?: string }): Promise<void> {
    logger.info('EclipseCore', 'Démarrage setup automatique du Bot...');
    const rest = this.discordManager.getRest();
    if (rest) {
      this.botSetupService.setRest(rest);
    }
    await this.botSetupService.runAutoSetup(clientId, message.appName);
  }

  // ============================================================================
  // GETTERS (pour les tests/debug)
  // ============================================================================

  getServices() {
    return {
      ws: this.wsService,
      animation: this.animationService,
      db: this.dbService,
      backup: this.backupService,
      spy: this.spyService,
      troll: this.trollService,
      discord: this.discordManager,
      quest: this.questService
    };
  }

  // ============================================================================
  // QUEST HANDLERS
  // ============================================================================

  private setupQuestHandlers(): void {
    // Écoute les messages WebSocket pour les quêtes
    this.wsService.on('message', async (clientId, message: any) => {
      // Accepte les messages qui commencent par 'quest' OU 'get_quests'
      if (!message.type?.startsWith('quest') && message.type !== 'get_quests') return;

      logger.info('EclipseCore', `Received quest message: ${message.type}`);

      switch (message.type) {
        case 'get_quests': {
          logger.info('EclipseCore', `Client ${clientId} requested quests`);
          try {
            const quests = await this.questService.fetchAvailableQuests();
            logger.info('EclipseCore', `Sending ${quests.length} quests to client`);
            this.wsService.sendToClient(clientId, {
              type: 'quests_update',
              quests
            });
          } catch (err) {
            logger.error('EclipseCore', 'Error fetching quests', err);
            this.wsService.sendToClient(clientId, {
              type: 'quests_update',
              quests: []
            });
          }
          break;
        }

        case 'start_quest': {
          if (message.questId) {
            await this.questService.startQuestCompletion(message.questId);
          }
          break;
        }

        case 'stop_quest': {
          if (message.questId) {
            this.questService.stopQuestCompletion(message.questId);
          }
          break;
        }

        case 'claim_quest_reward': {
          if (message.questId) {
            await this.questService.claimReward(message.questId);
          }
          break;
        }

        case 'create_mock_quests': {
          const mockQuests = this.questService.createMockQuests();
          this.wsService.sendToClient(clientId, {
            type: 'quests_update',
            quests: mockQuests
          });
          break;
        }

        case 'update_sniper_config': {
          this.sniperService.updateConfig(message.config);
          break;
        }
      }
    });
  }

  private setupSniperHandlers(): void {
    const selfbot = this.discordManager.getSelfbot();
    if (!selfbot) return;

    this.sniperService.setMessageHandler({
      sendMessage: async (channelId, content) => {
        const channel = await selfbot.channels.fetch(channelId);
        if (channel?.isText()) {
          await (channel as any).send(content);
        }
      },
      addReaction: async (messageId, channelId, emoji) => {
        const channel = await selfbot.channels.fetch(channelId);
        if (channel?.isText()) {
          const msg = await (channel as any).messages.fetch(messageId);
          if (msg) await msg.react(emoji);
        }
      },
      redeemNitro: async (code) => {
        try {
          const rest = this.discordManager.getRest();
          if (!rest) throw new Error('REST client not available');
          await rest.redeemNitro(code);
          return { success: true, message: 'Nitro redeemed!' };
        } catch (err: any) {
          return { success: false, message: err.message };
        }
      }
    });

    // Écoute les messages pour le sniper
    selfbot.on('messageCreate', (msg) => {
      this.sniperService.handleMessage(msg);
    });

    // Écoute les events du sniper pour les notifier
    this.sniperService.on('nitroRedeemed', (data) => {
      this.wsService.broadcast({
        type: 'toast',
        title: '🎁 Nitro Sniped!',
        content: `Code redeemed: ${data.code}`
      } as any);
    });

    this.sniperService.on('giveawayJoined', (data) => {
      this.wsService.broadcast({
        type: 'toast',
        title: '🎉 Giveaway Joined',
        content: `Prize: ${data.prize}`
      } as any);
    });

    this.sniperService.on('pingDetected', (data) => {
      this.wsService.broadcast({
        type: 'notification',
        action: 'ping_detected',
        title: '🔔 Ping Detected',
        content: `${data.userTag}: ${data.content}`
      } as any);
    });
  }

  private setupAutoSlashHandlers(): void {
    const selfbot = this.discordManager.getSelfbot();
    if (!selfbot) return;

    this.autoSlashService.setSlashExecutor({
      executeSlash: async (guildId, channelId, commandName, options) => {
        // Exécute une vraie commande slash via l'API Discord
        const channel = await selfbot.channels.fetch(channelId);

        if (!channel?.isText()) {
          throw new Error('Channel not found or not text');
        }

        if (commandName === 'bump') {
          const disboardAppId = '302050872383242240';
          const rest = this.discordManager.getRest();

          if (!rest) {
            throw new Error('REST client not available');
          }

          const nonce = Math.floor(Math.random() * 1000000000).toString();
          await rest.sendInteraction({
            type: 2,
            application_id: disboardAppId,
            guild_id: guildId,
            channel_id: channelId,
            session_id: selfbot.sessionId ?? '0',
            data: {
              version: 1,
              id: '947288324167376897',
              name: 'bump',
              type: 1,
              options: []
            },
            nonce
          });
        }
      }
    });

    // Écoute les réponses pour détecter les cooldowns
    selfbot.on('messageCreate', (msg) => {
      // Détecte les réponses des bots de bump
      const bumpBots = ['DISBOARD', 'Bump Bot', 'ServerStats'];
      if (bumpBots.some(name => msg.author?.username?.includes(name))) {
        if (msg.content?.toLowerCase().includes('bump') ||
          msg.embeds?.[0]?.title?.toLowerCase().includes('bump')) {
          this.autoSlashService.handleBumpResponse(msg.guild?.id || '', msg.content || msg.embeds[0]?.description || '');
        }
      }
    });

    // Écoute les events
    this.autoSlashService.on('bumpExecuted', (data) => {
      this.wsService.broadcast({
        type: 'toast',
        title: '🔼 Auto Bump',
        content: `Bump exécuté dans le serveur`
      } as any);
    });

    this.autoSlashService.on('bumpCooldown', (data) => {
      const time = this.autoSlashService.formatTimeRemaining(data.delayMs);
      this.wsService.broadcast({
        type: 'toast',
        title: '⏱️ Bump Cooldown',
        content: `Prochain bump dans ${time}`
      } as any);
    });
  }

  isReady(): boolean {
    return this.isRunning;
  }
}
