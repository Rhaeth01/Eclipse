import { DiscordREST } from '../discord/DiscordREST';
import { WebSocketService } from './WebSocketService';
import { logger } from './Logger';

export type SetupStep =
  | 'creating_app'
  | 'creating_bot'
  | 'getting_token'
  | 'authorizing'
  | 'complete'
  | 'error'
  | 'captcha_required';

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

  private isCaptchaError(err: any): boolean {
    const msg = (err?.message || '').toLowerCase();
    return msg.includes('captcha_key') || msg.includes('captcha-required') || msg.includes('hcaptcha');
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

      if (this.isCaptchaError(err)) {
        logger.warn('BotSetupService', 'Captcha détecté, basculement sur le setup hybride');
        this.broadcast(clientId, {
          step: 'captcha_required',
          message: 'Discord demande un captcha. Utilisez le setup hybride (assisté par navigateur).',
          error: 'captcha_required',
        });
        return;
      }

      this.broadcast(clientId, {
        step: 'error',
        message: `Erreur: ${err.message}`,
        error: err.message,
      });
    }
  }

  /**
   * Setup hybride : l'utilisateur crée l'app via le navigateur (setup_webview),
   * l'App ID est auto-extrait, puis l'API fait UNIQUEMENT 3 appels sur l'app existante :
   * createBot + resetToken + authorizeUrl. Évite le captcha de POST /applications.
   */
  async runHybridSetup(clientId: string, appId: string): Promise<void> {
    this.currentAppId = appId;
    this.currentToken = null;

    try {
      if (!this.rest) {
        throw new Error('REST client non initialisé');
      }

      if (!/^\d{17,20}$/.test(appId)) {
        throw new Error('App ID invalide (doit être un snowflake Discord)');
      }

      logger.info('BotSetupService', `Setup hybride pour App ID: ${appId}`);

      // Step 1: Add bot to existing app
      this.broadcast(clientId, {
        step: 'creating_bot',
        message: 'Ajout du Bot à l\'application...',
        appId,
      });

      const bot = await this.rest.createBotForApplication(appId);
      logger.info('BotSetupService', `Bot créé: ${bot.id}`);

      this.broadcast(clientId, {
        step: 'creating_bot',
        message: 'Bot configuré!',
        appId,
      });

      // Step 2: Reset token
      this.broadcast(clientId, {
        step: 'getting_token',
        message: 'Récupération du token...',
        appId,
      });

      const resetResult = await this.rest.resetBotToken(appId);
      this.currentToken = resetResult.token;
      logger.info('BotSetupService', 'Token Bot récupéré');

      this.broadcast(clientId, {
        step: 'getting_token',
        message: 'Token récupéré!',
        appId,
        token: resetResult.token,
      });

      // Step 3: Authorize URL
      const authorizeUrl = await this.rest.authorizeApplication(appId);

      this.broadcast(clientId, {
        step: 'authorizing',
        message: 'Autorisation nécessaire — cliquez sur le lien.',
        appId,
        token: resetResult.token,
        authorizeUrl,
      });

      this.broadcast(clientId, {
        step: 'complete',
        message: 'Configuration terminée!',
        appId,
        token: resetResult.token,
        authorizeUrl,
      });
    } catch (err: any) {
      logger.error('BotSetupService', `Erreur setup hybride: ${err.message}`);

      if (this.isCaptchaError(err)) {
        this.broadcast(clientId, {
          step: 'captcha_required',
          message: 'Discord a aussi bloqué cette étape. Utilisez la méthode manuelle (coller le token).',
          error: 'captcha_required',
        });
        return;
      }

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
