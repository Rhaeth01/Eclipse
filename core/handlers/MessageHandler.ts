/**
 * Handler principal des messages WebSocket
 * Route les messages vers les services appropriés
 */

import { WebSocketService } from '../services/WebSocketService';
import { AnimationService } from '../services/AnimationService';
import { DatabaseService } from '../services/DatabaseService';
import { BackupService } from '../services/BackupService';
import { SpyService } from '../services/SpyService';
import { TrollService } from '../services/TrollService';
import { StateService } from '../services/StateService';
import { AutoSlashService } from '../services/AutoSlashService';
import { logger } from '../services/Logger';
import type { WsMessage, ErrorMessage, StatusMessage, ToastMessage, NotificationMessage, WsBaseMessage, AutobumpStatusMessage } from '../shared/types';
import * as schemas from '../shared/schemas';
import { rateLimiter } from '../services/RateLimiter';
import { DiscordUserClient, Permissions } from '../discord';
import type { z } from 'zod';

export interface MessageHandlerContext {
  wsService: WebSocketService;
  animationService: AnimationService;
  dbService: DatabaseService;
  backupService: BackupService;
  spyService: SpyService;
  trollService: TrollService;
  stateService: StateService;
  autoSlashService: AutoSlashService;
  discordClient: DiscordUserClient | null;
  getCommandStealth: () => boolean;
  setCommandStealth: (value: boolean) => void;
  getSilentTyping: () => boolean;
  setSilentTyping: (value: boolean) => void;
}

export class MessageHandler {
  private context: MessageHandlerContext;

  constructor(context: MessageHandlerContext) {
    this.context = context;
  }

  async handle(clientId: string, message: WsMessage): Promise<void> {
    const { type } = message;

    logger.debug('MessageHandler', `Traitement: ${type}`);

    try {
      switch (type) {
        // Settings
        case 'set_stealth_mode':
          await this.handleSetStealthMode(clientId, message);
          break;
        case 'set_silent_typing':
          await this.handleSetSilentTyping(clientId, message);
          break;

        // Animations
        case 'start_animation':
          await this.handleStartAnimation(clientId, message);
          break;
        case 'stop_animation':
          await this.handleStopAnimation(clientId);
          break;
        case 'start_rpc_animation':
          await this.handleStartRpcAnimation(clientId, message);
          break;
        case 'stop_rpc_animation':
          await this.handleStopRpcAnimation(clientId);
          break;
        case 'set_rich_presence':
          await this.handleSetRichPresence(clientId, message);
          break;
        case 'clear_rich_presence':
          await this.handleClearRichPresence(clientId);
          break;

        // Backup
        case 'create_backup':
          await this.handleCreateBackup(clientId);
          break;
        
        // Status
        case 'get_ratelimit_status':
          await this.handleRateLimitStatus(clientId);
          break;

        // Autobump
        case 'enable_autobump':
          await this.handleEnableAutobump(clientId, message as z.infer<typeof schemas.EnableAutobumpSchema>);
          break;
        case 'disable_autobump':
          await this.handleDisableAutobump(clientId, message as z.infer<typeof schemas.DisableAutobumpSchema>);
          break;
        case 'get_autobump_status':
          await this.handleGetAutobumpStatus(clientId, message as z.infer<typeof schemas.GetAutobumpStatusSchema>);
          break;

        default:
          logger.warn('MessageHandler', `Type non géré: ${type}`);
      }
    } catch (err) {
      logger.error('MessageHandler', `Erreur traitement ${type}`, err);
      this.sendError(clientId, `Erreur: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  private async handleSetStealthMode(
    clientId: string, 
    message: Extract<WsMessage, { type: 'set_stealth_mode' }>
  ): Promise<void> {
    this.context.setCommandStealth(message.value);
    this.sendToast(clientId, 'Mode Furtif', message.value ? 'Activé (Éphémère)' : 'Désactivé (Public)');
    
    // Sauvegarder l'état
    this.context.stateService.save(
      this.context.getCommandStealth(),
      this.context.getSilentTyping()
    );
  }

  private async handleSetSilentTyping(
    clientId: string,
    message: Extract<WsMessage, { type: 'set_silent_typing' }>
  ): Promise<void> {
    this.context.setSilentTyping(message.value);
    this.sendToast(
      clientId, 
      'Silent Typing', 
      message.value ? 'Indicateur de frappe bloqué' : 'Indicateur de frappe restauré'
    );
    
    // Sauvegarder l'état
    this.context.stateService.save(
      this.context.getCommandStealth(),
      this.context.getSilentTyping()
    );
  }

  private async handleStartAnimation(
    clientId: string,
    message: Extract<WsMessage, { type: 'start_animation' }>
  ): Promise<void> {
    try {
      this.context.animationService.startCustomStatusAnimation(message.frames, message.delay);
      this.sendStatus(clientId, 'Animation démarrée.');
    } catch (err) {
      this.sendError(clientId, err instanceof Error ? err.message : 'Erreur animation');
    }
  }

  private async handleStopAnimation(clientId: string): Promise<void> {
    this.context.animationService.stopCustomStatusAnimation();
    this.sendStatus(clientId, 'Animation arrêtée.');
  }

  private async handleStartRpcAnimation(
    clientId: string,
    message: Extract<WsMessage, { type: 'start_rpc_animation' }>
  ): Promise<void> {
    try {
      await this.context.animationService.startRpcAnimation(message.frames, message.delay);
      this.sendStatus(clientId, 'Rotateur RPC démarré.');
    } catch (err) {
      this.sendError(clientId, err instanceof Error ? err.message : 'Erreur RPC animation');
    }
  }

  private async handleStopRpcAnimation(clientId: string): Promise<void> {
    this.context.animationService.stopRpcAnimation();
    this.sendStatus(clientId, 'Rotateur RPC arrêté.');
  }

  private async handleSetRichPresence(
    clientId: string,
    message: Extract<WsMessage, { type: 'set_rich_presence' }>
  ): Promise<void> {
    try {
      await this.context.animationService.setRichPresence({
        name: message.name,
        appId: message.appId,
        activityType: message.activityType,
        state: message.state,
        details: message.details,
        largeImage: message.largeImage,
        largeText: message.largeText,
        smallImage: message.smallImage,
        smallText: message.smallText,
        buttons: message.buttons,
        startTimestamp: message.startTimestamp,
        endTimestamp: message.endTimestamp
      });
      this.sendStatus(clientId, 'Rich Presence mise à jour avec succès.');
    } catch (err) {
      logger.error('MessageHandler', 'Erreur Rich Presence', err);
      this.sendError(clientId, `Erreur RPC: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  private async handleClearRichPresence(clientId: string): Promise<void> {
    try {
      await this.context.animationService.clearRichPresence();
      this.sendStatus(clientId, 'Rich Presence désactivée.');
    } catch (err) {
      logger.error('MessageHandler', 'Erreur clear Rich Presence', err);
      this.sendError(clientId, `Erreur: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  private async handleRateLimitStatus(clientId: string): Promise<void> {
    const buckets = rateLimiter.getStatus();
    const statusMsg: StatusMessage & { buckets: typeof buckets } = {
      type: 'status',
      message: 'Rate limit status',
      buckets
    } as any;
    this.context.wsService.sendToClient(clientId, statusMsg);
  }

  private async handleCreateBackup(clientId: string): Promise<void> {
    const { discordClient, backupService } = this.context;

    if (!discordClient?.user) {
      this.sendError(clientId, 'Discord non connecté. Impossible de sauvegarder.');
      return;
    }

    this.sendStatus(clientId, 'Création de la sauvegarde en cours...');

    try {
      const result = await backupService.createBackup(discordClient);
      const notif: NotificationMessage = {
        type: 'notification',
        action: 'backup_success',
        title: 'Sauvegarde Réussie',
        content: `Le compte a été cloné dans : ${result.filePath}`
      };
      this.context.wsService.sendToClient(clientId, notif);
    } catch (err) {
      logger.error('MessageHandler', 'Erreur backup', err);
      this.sendError(clientId, `Erreur de backup: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  private async handleEnableAutobump(
    clientId: string,
    message: z.infer<typeof schemas.EnableAutobumpSchema>
  ): Promise<void> {
    const { autoSlashService, discordClient } = this.context;
    
    if (!autoSlashService) {
      this.sendError(clientId, 'Service AutoSlash non disponible');
      return;
    }

    if (!discordClient) {
      this.sendError(clientId, 'Discord non connecté');
      return;
    }

    try {
      // Vérifier les permissions avant d'activer
      const guild = await discordClient.guilds.fetch(message.guildId).catch(() => null);
      if (!guild) {
        this.sendError(clientId, 'Serveur non trouvé ou non accessible');
        return;
      }

      const member = await guild.members.fetch(discordClient.user!.id).catch(() => null);
      const channel = await discordClient.channels.fetch(message.channelId).catch(() => null);
      
      if (!channel || !channel.isText()) {
        this.sendError(clientId, 'Salon non trouvé ou non textuel');
        return;
      }

      // Vérifier les permissions d'envoi de message (uniquement pour les salons de guild)
      if ('permissionsFor' in channel) {
        const permissions = channel.permissionsFor(discordClient.user!.id);
        if (permissions && !permissions.has(Permissions.FLAGS.SEND_MESSAGES)) {
          this.sendError(clientId, 'Permissions insuffisantes dans ce salon');
          return;
        }
      }

      const result = autoSlashService.enableBump(
        message.guildId,
        message.channelId,
        message.interval ? message.interval / 60 : 120 // Convertir secondes en minutes
      );

      if (result.success) {
        this.sendToast(clientId, 'Autobump Activé', 
          `Bump automatique activé toutes les ${(message.interval || 7200) / 60} minutes dans ce serveur`);
      } else {
        this.sendError(clientId, result.error || 'Erreur lors de l\'activation');
      }
    } catch (err) {
      logger.error('MessageHandler', 'Erreur autobump', err);
      this.sendError(clientId, `Erreur autobump: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  private async handleDisableAutobump(
    clientId: string,
    message: z.infer<typeof schemas.DisableAutobumpSchema>
  ): Promise<void> {
    const { autoSlashService } = this.context;
    
    if (!autoSlashService) {
      this.sendError(clientId, 'Service AutoSlash non disponible');
      return;
    }

    try {
      const result = autoSlashService.disableBump(message.guildId);

      if (result) {
        this.sendToast(clientId, 'Autobump Désactivé', 
          'Bump automatique désactivé pour ce serveur');
      } else {
        this.sendError(clientId, 'Aucun bump actif pour ce serveur');
      }
    } catch (err) {
      logger.error('MessageHandler', 'Erreur autobump', err);
      this.sendError(clientId, `Erreur autobump: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  private async handleGetAutobumpStatus(
    clientId: string,
    message: z.infer<typeof schemas.GetAutobumpStatusSchema>
  ): Promise<void> {
    const { autoSlashService } = this.context;
    
    if (!autoSlashService) {
      this.sendError(clientId, 'Service AutoSlash non disponible');
      return;
    }

    try {
      const config = autoSlashService.getBumpStatus(message.guildId);
      
      const response: AutobumpStatusMessage = {
        type: 'autobump_status',
        guildId: message.guildId,
        enabled: config?.enabled || false,
        status: config ? {
          channelId: config.channelId,
          guildId: config.guildId,
          interval: config.interval / 1000, // Convertir ms en secondes
          enabled: config.enabled,
          lastBump: config.lastBump,
          nextBump: config.nextBump
        } : undefined
      };
      this.context.wsService.sendToClient(clientId, response as any);
    } catch (err) {
      logger.error('MessageHandler', 'Erreur autobump status', err);
      this.sendError(clientId, `Erreur: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private sendToast(clientId: string, title: string, content: string): void {
    const msg: ToastMessage = {
      type: 'toast',
      title,
      content
    };
    this.context.wsService.sendToClient(clientId, msg);
  }

  private sendStatus(clientId: string, message: string): void {
    const msg: StatusMessage = {
      type: 'status',
      message
    };
    this.context.wsService.sendToClient(clientId, msg);
  }

  private sendError(clientId: string, message: string, code?: string): void {
    const msg: ErrorMessage = {
      type: 'error',
      message,
      code
    };
    this.context.wsService.sendToClient(clientId, msg);
  }
}
