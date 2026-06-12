import { DiscordREST } from '../discord/DiscordREST';
import { WebSocketService } from './WebSocketService';
import { logger } from './Logger';

export type SetupStep =
  | 'creating_app'
  | 'creating_bot'
  | 'getting_token'
  | 'authorizing'
  | 'complete'
  | 'error';

export interface SetupProgress {
  step: SetupStep;
  message: string;
  appId?: string;
  token?: string;
  authorizeUrl?: string;
  error?: string;
}

const DEFAULT_APP_NAME = 'Eclipse';

export class BotSetupService {
  private wsService: WebSocketService;
  private rest: DiscordREST | null = null;
  private currentAppId: string | null = null;
  private currentToken: string | null = null;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  setRest(rest: DiscordREST): void {
    this.rest = rest;
  }

  private broadcast(clientId: string, progress: SetupProgress): void {
    this.wsService.sendToClient(clientId, {
      type: 'setup_progress',
      ...progress,
    });
  }

  async runAutoSetup(clientId: string, appName: string = DEFAULT_APP_NAME): Promise<void> {
    this.currentAppId = null;
    this.currentToken = null;

    try {
      // Step 1: Create the application
      this.broadcast(clientId, {
        step: 'creating_app',
        message: `Création de l'application "${appName}"...`,
      });

      if (!this.rest) {
        throw new Error('REST client non initialisé');
      }

      logger.info('BotSetupService', `Création de l'application "${appName}"...`);
      const app = await this.rest.createApplication(appName);
      this.currentAppId = app.id;
      logger.info('BotSetupService', `Application créée: ${app.id} (${app.name})`);

      this.broadcast(clientId, {
        step: 'creating_app',
        message: `Application "${appName}" créee!`,
        appId: app.id,
      });

      // Step 2: Create the bot user
      this.broadcast(clientId, {
        step: 'creating_bot',
        message: 'Configuration du Bot...',
        appId: app.id,
      });

      logger.info('BotSetupService', 'Création du Bot...');
      const bot = await this.rest.createBotForApplication(app.id);
      logger.info('BotSetupService', `Bot créé: ${bot.id}`);

      this.broadcast(clientId, {
        step: 'creating_bot',
        message: 'Bot configuré!',
        appId: app.id,
      });

      // Step 3: Reset token to get a fresh one
      this.broadcast(clientId, {
        step: 'getting_token',
        message: 'Récupération du token...',
        appId: app.id,
      });

      logger.info('BotSetupService', 'Reset du token Bot...');
      const resetResult = await this.rest.resetBotToken(app.id);
      this.currentToken = resetResult.token;

      this.broadcast(clientId, {
        step: 'getting_token',
        message: 'Token récupéré!',
        appId: app.id,
        token: resetResult.token,
      });

      // Step 4: Generate authorize URL
      const authorizeUrl = await this.rest.authorizeApplication(app.id);

      this.broadcast(clientId, {
        step: 'authorizing',
        message: 'Autorisation nécessaire — cliquez sur le lien pour autoriser l\'application.',
        appId: app.id,
        token: resetResult.token,
        authorizeUrl,
      });

      // Step 5: Done
      this.broadcast(clientId, {
        step: 'complete',
        message: 'Configuration terminée!',
        appId: app.id,
        token: resetResult.token,
        authorizeUrl,
      });

    } catch (err: any) {
      logger.error('BotSetupService', `Erreur setup automatique: ${err.message}`);
      this.broadcast(clientId, {
        step: 'error',
        message: `Erreur: ${err.message}`,
        error: err.message,
      });
    }
  }

  getCurrentAppId(): string | null {
    return this.currentAppId;
  }

  getCurrentToken(): string | null {
    return this.currentToken;
  }
}
